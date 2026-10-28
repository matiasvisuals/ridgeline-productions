/* ============================================
   Ridgeline Admin Dashboard — Studio Dashboard
   Vanilla JS — no build step.
   ============================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let state = {
    content: null,    // current working copy (mutated as user types)
    original: null,   // last server-confirmed copy (for dirty checks)
    selectedProject: null,
    dirty: false,
};

const api = {
    async me() {
        try {
            const r = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
            if (!r.ok) return { authenticated: false };
            return r.json();
        } catch {
            return { authenticated: false, offline: true };
        }
    },
    async login(password) {
        let r;
        try {
            r = await fetch('/api/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
        } catch {
            throw new Error('network_error');
        }
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            throw new Error(data.error || 'login_failed');
        }
        return r.json();
    },
    async logout() {
        try { await fetch('/api/logout', { method: 'POST', credentials: 'include' }); } catch {}
    },
    async loadContent() {
        let r;
        try {
            r = await fetch('/api/content?draft=1', { credentials: 'include', cache: 'no-store' });
        } catch {
            throw new Error('network_error');
        }
        if (r.status === 401) throw new Error('unauthorized');
        if (!r.ok) throw new Error('content_load_failed');
        return r.json();
    },
    async saveDraft(content) {
        let r;
        try {
            r = await fetch('/api/save-draft', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });
        } catch {
            throw new Error('network_error');
        }
        if (r.status === 401) { handleSessionExpired(); throw new Error('your login expired. Log in again, your changes are kept'); }
        if (r.status === 413) throw new Error('too much data in one save');
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            throw new Error(data.error || 'save_failed');
        }
        return r.json();
    },
    async publish() {
        let r;
        try {
            r = await fetch('/api/publish', { method: 'POST', credentials: 'include' });
        } catch {
            throw new Error('network_error');
        }
        if (r.status === 401) { handleSessionExpired(); throw new Error('your login expired. Log in again, your changes are kept'); }
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            throw new Error(data.error || 'publish_failed');
        }
        return r.json();
    },
    async discardDraft() {
        let r;
        try {
            r = await fetch('/api/discard-draft', { method: 'POST', credentials: 'include' });
        } catch {
            throw new Error('network_error');
        }
        if (!r.ok) {
            const data = await r.json().catch(() => ({}));
            throw new Error(data.error || 'discard_failed');
        }
        return r.json();
    },
};

/* ────────────── Utilities ────────────── */

function setText(sel, value) { const el = $(sel); if (el) el.textContent = value; }

function toast(message, type = '') {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'admin-toast' + (type ? ' is-' + type : '');
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 3200);
}

function confirmDialog({ title, message, okLabel = 'Confirm', danger = false }) {
    return new Promise(resolve => {
        const modal = $('#confirmModal');
        $('#confirmTitle').textContent = title;
        $('#confirmMessage').textContent = message;
        const okBtn = $('#confirmOk');
        okBtn.textContent = okLabel;
        okBtn.className = 'admin-btn ' + (danger ? 'admin-btn--danger' : 'admin-btn--primary');
        modal.hidden = false;
        const cleanup = (result) => {
            modal.hidden = true;
            okBtn.removeEventListener('click', onOk);
            $('#confirmCancel').removeEventListener('click', onCancel);
            resolve(result);
        };
        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        okBtn.addEventListener('click', onOk);
        $('#confirmCancel').addEventListener('click', onCancel);
    });
}

function setDirty(isDirty) {
    state.dirty = isDirty;
    const el = $('#dirtyStatus');
    if (!el) return;
    if (isDirty) {
        el.textContent = 'Unsaved changes';
        el.classList.add('is-dirty');
    } else {
        el.textContent = 'All changes saved';
        el.classList.remove('is-dirty');
    }
}

function slugify(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function uniqueProjectId(base) {
    const projects = state.content.projects;
    let id = base || 'untitled';
    let i = 2;
    while (projects[id]) {
        id = `${base}-${i++}`;
    }
    return id;
}

// Change a project's id (its /work/<id> address). Keeps its place in the list,
// updates the homepage Reel, and remembers the old id so old links forward.
function renameProject(oldId, newId) {
    const projects = state.content.projects;
    if (!projects[oldId] || projects[newId]) return false;
    const p = projects[oldId];
    const aliases = new Set(Array.isArray(p.aliases) ? p.aliases : []);
    aliases.add(oldId);
    aliases.delete(newId);
    p.aliases = [...aliases];

    const renamed = {};
    Object.keys(projects).forEach(k => { renamed[k === oldId ? newId : k] = projects[k]; });
    state.content.projects = renamed;

    if (Array.isArray(state.content.reel)) {
        state.content.reel = state.content.reel.map(r => (r === oldId ? newId : r));
    }
    if (state.selectedProject === oldId) state.selectedProject = newId;
    setDirty(true);
    renderProjectList();
    renderProjectEditor();
    if (typeof renderHomepage === 'function') renderHomepage();
    return true;
}

/* ────────────── Vimeo parsing ────────────── */
// Accepts a full Vimeo URL (public or unlisted) or a bare numeric ID and
// returns { id, hash }. The site uses these two fields separately to build
// the player embed, so we keep storing them split.
function parseVimeo(input) {
    const raw = String(input || '').trim();
    if (!raw) return { id: '', hash: '' };
    if (/^\d+$/.test(raw)) return { id: raw, hash: '' };

    let id = '', hash = '';
    // vimeo.com/ID, vimeo.com/ID/HASH, player.vimeo.com/video/ID
    const m = raw.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-zA-Z]+))?/i);
    if (m) { id = m[1]; hash = m[2] || ''; }
    // ?h=HASH form
    const h = raw.match(/[?&]h=([0-9a-zA-Z]+)/i);
    if (h) hash = h[1];
    // Last-resort: first long run of digits
    if (!id) { const d = raw.match(/(\d{6,})/); if (d) id = d[1]; }
    return { id, hash };
}

function vimeoDisplay(id, hash) {
    if (!id) return '';
    return hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`;
}

/* ────────────── Image handling ────────────── */
// Reads a dropped/selected image, downscales it on a canvas to keep the
// committed content.json reasonable, and returns a data URL. The site treats
// thumb / gallery / bts images as plain <img src>, so a data URL just works.
function fileToDataURL(file, maxDim = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            reject(new Error('not an image'));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('could not read file'));
        reader.onload = () => {
            // Vector / animated formats: keep as-is (canvas would flatten them).
            if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
                resolve(reader.result);
                return;
            }
            const img = new Image();
            img.onerror = () => reject(new Error('could not decode image'));
            img.onload = () => {
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const w = Math.max(1, Math.round(img.width * scale));
                const h = Math.max(1, Math.round(img.height * scale));
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                    resolve(canvas.toDataURL(mime, quality));
                } catch {
                    resolve(reader.result); // tainted/other — fall back to raw
                }
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// Photos go to Blob storage as real files. Embedding them in the content as
// base64 made every save carry every photo, so a big batch (e.g. 18 stills)
// pushed the save past the server's ~4.5MB request limit and it failed.
async function imageFileToUrl(file) {
    if (file.type === 'image/svg+xml') return fileToDataURL(file); // tiny, keep inline
    const dataUrl = await fileToDataURL(file, 2400, 0.85);
    const blob = await (await fetch(dataUrl)).blob();
    return uploadToBlob(blob, file.name, 'images');
}

// Upload any leftover inline (base64) images in the content and swap in their
// URLs. Runs before every save, so older inline photos get moved out too.
async function moveInlineImagesToBlob(content) {
    const refs = [];
    (function walk(obj) {
        if (!obj || typeof obj !== 'object') return;
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (typeof v === 'string') {
                if (/^data:image\/(jpeg|png|webp|gif);base64,/.test(v)) refs.push([obj, k]);
            } else walk(v);
        }
    })(content);
    if (!refs.length) return 0;
    let n = 0;
    for (const [obj, k] of refs) {
        n++;
        toast(`Uploading photos… ${n} of ${refs.length}`);
        const blob = await (await fetch(obj[k])).blob();
        obj[k] = await uploadToBlob(blob, 'photo', 'images');
    }
    return refs.length;
}

const UPLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>`;
const IMG_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>`;

// Reusable image field: drag-and-drop / click-to-upload zone + URL fallback.
function imageInput({ value = '', onChange, urlPlaceholder = 'https://… or drop a file above' }) {
    const wrap = document.createElement('div');
    wrap.className = 'admin-imageinput';

    const zone = document.createElement('div');
    zone.className = 'admin-dropzone';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;

    const urlRow = document.createElement('div');
    urlRow.className = 'admin-imageinput-url';
    const urlLabel = document.createElement('span');
    urlLabel.className = 'lbl';
    urlLabel.textContent = 'or URL';
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.placeholder = urlPlaceholder;
    urlRow.append(urlLabel, urlInput);

    let current = value || '';

    function isData(v) { return /^data:/.test(v); }

    function renderZone() {
        if (current) {
            zone.className = 'admin-dropzone has-image';
            zone.innerHTML = `
                <img class="preview" src="${escapeAttr(current)}" alt="">
                <div class="admin-dropzone-overlay">
                    <span class="meta">${isData(current) ? 'Uploaded image' : escapeAttr(current)}</span>
                    <span class="acts">
                        <button type="button" class="admin-btn admin-btn--small admin-btn--secondary" data-act="replace">Replace</button>
                        <button type="button" class="admin-btn admin-btn--small admin-btn--danger" data-act="remove">Remove</button>
                    </span>
                </div>`;
        } else {
            zone.className = 'admin-dropzone';
            zone.innerHTML = `
                <div class="admin-dropzone-empty">
                    ${UPLOAD_ICON}
                    <span class="t">Drop a photo here</span>
                    <span class="s">or click to browse — PNG, JPG, WebP</span>
                </div>`;
        }
    }

    function commit(v, { syncUrl = true } = {}) {
        current = v || '';
        renderZone();
        if (syncUrl) urlInput.value = (current && !isData(current)) ? current : '';
        onChange(current);
    }

    async function handleFile(file) {
        try {
            toast('Uploading image…');
            const url = await imageFileToUrl(file);
            commit(url);
            toast('Image added', 'success');
        } catch (err) {
            toast('Could not add image: ' + err.message, 'error');
        }
    }

    zone.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]');
        if (act && act.dataset.act === 'remove') { e.stopPropagation(); commit(''); return; }
        fileInput.click();
    });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('is-dragover');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) handleFile(file);
        fileInput.value = '';
    });
    urlInput.addEventListener('input', () => commit(urlInput.value.trim(), { syncUrl: false }));

    renderZone();
    urlInput.value = (current && !isData(current)) ? current : '';
    wrap.append(zone, fileInput, urlRow);
    return wrap;
}

/* ────────────── Small DOM helpers ────────────── */

function textField(placeholder, value, onInput) {
    const i = document.createElement('input');
    i.type = 'text';
    i.placeholder = placeholder;
    i.value = value || '';
    i.addEventListener('input', () => onInput(i.value));
    return i;
}
function deleteButton(onClick, title = 'Remove') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'admin-btn admin-btn--ghost admin-btn--small';
    b.textContent = '✕';
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
}

// Generic drag-to-reorder for a row backed by an array `list`. `handle` is the
// only element that initiates a drag (so inputs inside the row stay usable).
// `getIndex` returns this row's current index; `rerender` repaints after a move.
function makeRowReorderable({ row, handle, getIndex, list, rerender }) {
    handle.classList.add('admin-drag-handle');
    handle.addEventListener('mousedown', () => { row.draggable = true; });
    handle.addEventListener('touchstart', () => { row.draggable = true; }, { passive: true });
    row.addEventListener('dragstart', e => {
        row.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(getIndex()));
    });
    row.addEventListener('dragend', () => {
        row.draggable = false;
        row.classList.remove('is-dragging');
    });
    row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('is-dragover'); });
    row.addEventListener('dragleave', () => row.classList.remove('is-dragover'));
    row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('is-dragover');
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const to = getIndex();
        if (Number.isNaN(from) || from === to) return;
        const [moved] = list.splice(from, 1);
        list.splice(to, 0, moved);
        setDirty(true);
        rerender();
    });
}

/* ────────────── Tabs / nav ────────────── */

function initTabs() {
    $$('.admin-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.admin-tab').forEach(t => t.classList.remove('is-active'));
            btn.classList.add('is-active');
            const tab = btn.dataset.tab;
            $$('.admin-panel').forEach(p => p.classList.toggle('is-active', p.dataset.panel === tab));
            setText('#sectionTitle', btn.dataset.title || '');
            setText('#sectionDesc', btn.dataset.desc || '');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function updateCounts() {
    if (!state.content) return;
    setText('#countProjects', Object.keys(state.content.projects || {}).length);
    setText('#countServices', (state.content.services || []).length);
    setText('#countReel', (state.content.reel || []).length);
}

/* ────────────── Login ────────────── */

async function showLogin() {
    $('#adminLogin').hidden = false;
    $('#adminShell').hidden = true;
    $('#loginPassword').focus();
}
async function showShell() {
    $('#adminLogin').hidden = true;
    $('#adminShell').hidden = false;
    maybeShowFirstRunHelp();
}

/* ────────────── Help / Guide ────────────── */

const HELP_SEEN_KEY = 'rdgl_admin_help_seen';

function openHelp() { const m = $('#helpModal'); if (m) m.hidden = false; }
function closeHelp() {
    const m = $('#helpModal');
    if (m) m.hidden = true;
    try { localStorage.setItem(HELP_SEEN_KEY, '1'); } catch {}
}
function maybeShowFirstRunHelp() {
    let seen = false;
    try { seen = localStorage.getItem(HELP_SEEN_KEY) === '1'; } catch {}
    if (!seen) openHelp();
}
function initHelp() {
    const open = $('#helpBtn');
    if (open) open.addEventListener('click', openHelp);
    const close = $('#helpClose');
    if (close) close.addEventListener('click', closeHelp);
    const gotit = $('#helpGotIt');
    if (gotit) gotit.addEventListener('click', closeHelp);
    const modal = $('#helpModal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeHelp(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal && !modal.hidden) closeHelp();
    });
}

// Shown when an API call comes back 401 mid-session. Keeps the in-memory edits
// so nothing is lost: logging back in returns to the dashboard as it was.
function handleSessionExpired() {
    state.reauth = true;
    showLogin();
    $('#loginError').textContent = 'Your login expired. Sign in again. Your unsaved changes are kept.';
    $('#loginError').hidden = false;
}

async function bootstrap() {
    // Check the session before showing anything, so a refresh doesn't flash the
    // login screen (which looked like being logged out).
    $('#adminLogin').hidden = true;
    $('#adminShell').hidden = true;

    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
        $('#loginError').textContent = 'Open this page on the deployed site — local file mode is preview-only.';
        $('#loginError').hidden = false;
        $('#loginBtn').disabled = true;
        await showLogin();
        return;
    }

    const me = await api.me();
    if (me.authenticated) {
        await loadAndRender();
        if (state.content) { await showShell(); return; }
    }
    await showLogin();
}

async function loadAndRender() {
    try {
        const data = await api.loadContent();
        state.content = JSON.parse(JSON.stringify(data.content));
        state.original = JSON.parse(JSON.stringify(data.content));
        // Photos still pointing at the old Squarespace site → our own copies, and
        // fill in the Homepage tab's data if this content predates it.
        const moved = window.rdglLocalizeImages ? window.rdglLocalizeImages(state.content) : 0;
        const seeded = await seedHomepageContent(state.content);
        renderAll();
        if (moved || seeded) setDirty(true);
        if (data.source === 'draft') {
            toast('Loaded unpublished draft', '');
        }
    } catch (err) {
        if (String(err.message) === 'unauthorized') {
            await showLogin();
            return;
        }
        toast('Failed to load content: ' + err.message, 'error');
    }
}

const EYE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';

function initLogin() {
    const pw = $('#loginPassword');
    const toggle = $('#loginPasswordToggle');
    if (pw && toggle) {
        toggle.addEventListener('click', () => {
            const reveal = pw.type === 'password';
            pw.type = reveal ? 'text' : 'password';
            toggle.innerHTML = reveal ? EYE_OFF_ICON : EYE_ICON;
            const label = reveal ? 'Hide password' : 'Show password';
            toggle.setAttribute('aria-label', label);
            toggle.title = label;
            pw.focus();
        });
    }

    $('#loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = $('#loginPassword').value;
        $('#loginError').hidden = true;
        $('#loginBtn').disabled = true;
        $('#loginBtn').textContent = 'Signing in…';
        try {
            await api.login(password);
            $('#loginPassword').value = '';
            if (state.reauth && state.content) {
                // Logged back in after an expired session: keep the open edits.
                state.reauth = false;
                await showShell();
                toast('Signed back in. Save again to keep your changes.', 'success');
                return;
            }
            await loadAndRender();
            await showShell();
        } catch (err) {
            $('#loginError').textContent =
                err.message === 'invalid_password' ? 'Wrong password.' : 'Sign-in failed.';
            $('#loginError').hidden = false;
        } finally {
            $('#loginBtn').disabled = false;
            $('#loginBtn').textContent = 'Sign in';
        }
    });
}

/* ────────────── Render: About ────────────── */

function renderAbout() {
    const a = state.content.about;
    $('#aboutHeadline').value = (a.headlineLines || []).join('\n');
    $('#aboutParagraphs').value = (a.paragraphs || []).join('\n\n');
    $('#aboutEmphasis').value = a.emphasis || '';
    $('#aboutPhilosophy').value = a.philosophy || '';
    for (let i = 0; i < 3; i++) {
        $('#stat' + i + 'Count').value = a.stats?.[i]?.count ?? 0;
        $('#stat' + i + 'Label').value = a.stats?.[i]?.label ?? '';
    }
}

function bindAbout() {
    $('#aboutHeadline').addEventListener('input', e => {
        state.content.about.headlineLines = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
        setDirty(true);
    });
    $('#aboutParagraphs').addEventListener('input', e => {
        state.content.about.paragraphs = e.target.value.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
        setDirty(true);
    });
    $('#aboutEmphasis').addEventListener('input', e => {
        state.content.about.emphasis = e.target.value;
        setDirty(true);
    });
    $('#aboutPhilosophy').addEventListener('input', e => {
        state.content.about.philosophy = e.target.value;
        setDirty(true);
    });
    for (let i = 0; i < 3; i++) {
        $('#stat' + i + 'Count').addEventListener('input', e => {
            if (!state.content.about.stats[i]) state.content.about.stats[i] = { count: 0, label: '' };
            state.content.about.stats[i].count = parseInt(e.target.value, 10) || 0;
            setDirty(true);
        });
        $('#stat' + i + 'Label').addEventListener('input', e => {
            if (!state.content.about.stats[i]) state.content.about.stats[i] = { count: 0, label: '' };
            state.content.about.stats[i].label = e.target.value;
            setDirty(true);
        });
    }
}

/* ────────────── Render: Services ────────────── */

function renderServices() {
    const root = $('#servicesEditor');
    root.innerHTML = '';
    (state.content.services || []).forEach((svc, idx) => {
        const block = document.createElement('div');
        block.className = 'admin-service-block';
        block.innerHTML = `
            <div class="admin-service-block-header">
                <span class="admin-service-num">${escapeText(svc.number || String(idx + 1).padStart(2, '0'))}</span>
                <h3>${escapeText(svc.name || '')}</h3>
            </div>
            <div class="admin-grid-2">
                <label class="admin-field">
                    <span class="admin-field-label">Display name</span>
                    <input type="text" data-field="name" value="${escapeAttr(svc.name)}">
                </label>
                <label class="admin-field">
                    <span class="admin-field-label">Number</span>
                    <input type="text" data-field="number" value="${escapeAttr(svc.number || '')}" placeholder="01">
                </label>
            </div>
            <label class="admin-field">
                <span class="admin-field-label">Description</span>
                <textarea data-field="description" rows="4">${escapeText(svc.description)}</textarea>
            </label>
            <label class="admin-field">
                <span class="admin-field-label">Tag chips</span>
                <input type="text" data-field="tags" value="${escapeAttr((svc.tags || []).join(', '))}">
                <p class="admin-field-hint">Comma separated.</p>
            </label>
        `;
        block.querySelectorAll('[data-field]').forEach(input => {
            input.addEventListener('input', () => {
                const field = input.dataset.field;
                if (field === 'tags') {
                    state.content.services[idx].tags = input.value.split(',').map(s => s.trim()).filter(Boolean);
                } else {
                    state.content.services[idx][field] = input.value;
                    if (field === 'number' || field === 'name') {
                        const hdr = block.querySelector('.admin-service-block-header');
                        if (field === 'number') hdr.querySelector('.admin-service-num').textContent = input.value || String(idx + 1).padStart(2, '0');
                        if (field === 'name') hdr.querySelector('h3').textContent = input.value;
                    }
                }
                setDirty(true);
            });
        });
        root.appendChild(block);
    });
}

/* ────────────── Render: Projects ────────────── */

function renderProjectList() {
    const host = $('#projectList');
    const scrollTop = host.scrollTop;
    host.innerHTML = '';
    const ids = Object.keys(state.content.projects);
    if (ids.length === 0) {
        host.innerHTML = '<div class="admin-empty" style="border:none;padding:1.5rem 1rem">No projects yet.</div>';
        return;
    }
    // Fresh wrapper per render so the reorder listeners never stack up.
    const list = document.createElement('div');
    list.className = 'admin-list-items';
    host.appendChild(list);
    ids.forEach((id, idx) => {
        const p = state.content.projects[id];
        const item = document.createElement('div');
        item.className = 'admin-list-item' + (id === state.selectedProject ? ' is-selected' : '');
        item.dataset.id = id;
        const thumb = p.thumb
            ? `<img src="${escapeAttr(p.thumb)}" alt="">`
            : IMG_ICON;
        item.dataset.idx = String(idx);
        item.innerHTML = `
            <span class="admin-list-grip" title="Drag to reorder" aria-hidden="true">⠿</span>
            <div class="admin-list-thumb" title="Drag to reorder">${thumb}</div>
            <div class="admin-list-item-info">
                <div class="admin-list-item-title">${escapeText(p.title || '(untitled)')}</div>
                <div class="admin-list-item-sub">${escapeText(p.client || '')}${p.year ? ' · ' + escapeText(p.year) : ''}</div>
            </div>
            <div class="admin-list-item-actions">
                <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-action="delete" title="Delete project">✕</button>
            </div>
        `;

        // Drag-to-reorder is wired once for the whole list below (pointer-based, so
        // it works with a mouse, trackpad, or touch).

        item.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="delete"]')) return;
            state.selectedProject = id;
            renderProjectList();
            renderProjectEditor();
        });
        item.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
            e.stopPropagation();
            const ok = await confirmDialog({
                title: 'Delete project',
                message: `Remove "${p.title}" from the site? This is reversible until you publish.`,
                okLabel: 'Delete',
                danger: true,
            });
            if (!ok) return;
            delete state.content.projects[id];
            if (state.selectedProject === id) state.selectedProject = null;
            setDirty(true);
            renderProjectList();
            renderProjectEditor();
            updateCounts();
        });
        list.appendChild(item);
    });

    // Mouse: drag the whole row. Touch: drag by the grip or thumbnail so the
    // list can still be scrolled with a finger. Order here drives All Work.
    enableGridReorder(list, ids, () => {
        const next = {};
        ids.forEach(id => { next[id] = state.content.projects[id]; });
        state.content.projects = next;
        setDirty(true);
        renderProjectList();
    }, {
        tileClass: 'admin-list-item',
        handleSel: '.admin-list-grip, .admin-list-thumb',
        mouseHandleSel: '.admin-list-item',
        ignoreSel: '[data-action]',
        axis: 'y',
        scroller: host,
    });
    host.scrollTop = scrollTop;
}

function buildVimeoField(project) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
        <label class="admin-field" style="margin-bottom:.4rem">
            <span class="admin-field-label">Vimeo link or video ID</span>
            <input type="text" class="vimeo-input" placeholder="https://vimeo.com/123456789/abc123  ·  or just 123456789">
            <p class="admin-field-hint">Paste the full Vimeo URL — the ID and private hash are detected automatically.</p>
        </label>
        <div class="admin-vimeo-readback"></div>
        <div class="vimeo-preview-mount"></div>
    `;
    const input = wrap.querySelector('.vimeo-input');
    const readback = wrap.querySelector('.admin-vimeo-readback');
    const mount = wrap.querySelector('.vimeo-preview-mount');
    input.value = vimeoDisplay(project.vimeo, project.vimeoHash);

    function refresh() {
        readback.innerHTML = `
            <span class="admin-chip ${project.vimeo ? '' : 'is-empty'}">ID <code>${project.vimeo ? escapeText(project.vimeo) : '—'}</code></span>
            <span class="admin-chip ${project.vimeoHash ? '' : 'is-empty'}">hash <code>${project.vimeoHash ? escapeText(project.vimeoHash) : 'none'}</code></span>
        `;
        if (project.vimeo) {
            const h = project.vimeoHash ? `&h=${encodeURIComponent(project.vimeoHash)}` : '';
            const src = `https://player.vimeo.com/video/${encodeURIComponent(project.vimeo)}?title=0&byline=0&portrait=0${h}`;
            // Only rebuild the iframe when the src actually changes (avoid reload on every keystroke).
            if (mount.dataset.src !== src) {
                mount.dataset.src = src;
                mount.innerHTML = `<div class="admin-vimeo-preview"><iframe src="${src}" allow="fullscreen" loading="lazy"></iframe></div>`;
            }
        } else {
            mount.dataset.src = '';
            mount.innerHTML = `<div class="admin-vimeo-preview-empty">No video yet — paste a Vimeo link above</div>`;
        }
    }

    input.addEventListener('input', () => {
        const { id, hash } = parseVimeo(input.value);
        project.vimeo = id;
        project.vimeoHash = hash;
        setDirty(true);
        refresh();
    });
    refresh();
    return wrap;
}

function renderProjectEditor() {
    const root = $('#projectEditor');
    const id = state.selectedProject;
    if (!id || !state.content.projects[id]) {
        root.innerHTML = `<div class="admin-empty">${IMG_ICON}<div>Select a project to edit, or click <strong>Add project</strong>.</div></div>`;
        return;
    }
    const p = state.content.projects[id];
    root.innerHTML = `
        <div class="admin-editor-titlebar">
            <h3>Editing <span>${escapeText(p.title || '(untitled)')}</span></h3>
            <span class="admin-id-chip">/work/${escapeText(id)}</span>
        </div>

        <div class="admin-card admin-card-accent">
            <div class="admin-card-head"><div class="admin-card-head-l"><h3>Basics</h3></div></div>
            <div class="admin-card-body">
                <div class="admin-grid-2">
                    <label class="admin-field">
                        <span class="admin-field-label">Client</span>
                        <input type="text" data-field="client" value="${escapeAttr(p.client)}">
                    </label>
                    <label class="admin-field">
                        <span class="admin-field-label">Title</span>
                        <input type="text" data-field="title" value="${escapeAttr(p.title)}">
                    </label>
                    <div class="admin-field admin-field--wide">
                        <span class="admin-field-label">Categories <span class="admin-field-sub">— pick one or more; these drive the filters on All Work</span></span>
                        <div data-mount="categories"></div>
                    </div>
                    <label class="admin-field">
                        <span class="admin-field-label">Year</span>
                        <input type="text" data-field="year" value="${escapeAttr(p.year)}">
                    </label>
                    <div class="admin-field admin-field--wide">
                        <span class="admin-field-label">Page URL <span class="admin-field-sub">— the link you share for this project</span></span>
                        <div class="admin-slug">
                            <span class="admin-slug-prefix">ridgelineproductions.com/work/</span>
                            <input type="text" data-slug value="${escapeAttr(id)}" spellcheck="false" autocomplete="off">
                            <button type="button" class="admin-btn admin-btn--secondary admin-btn--small" data-slug-suggest>Use client + title</button>
                        </div>
                        <p class="admin-field-hint">Lowercase letters, numbers and dashes. Press Enter to apply. The old link keeps working and forwards here. Publish to make it live.</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="admin-card admin-card-accent">
            <div class="admin-card-head">
                <div class="admin-card-head-l"><h3>Hero videos <span class="sub" data-hero-count></span></h3></div>
                <span class="admin-hero-add">
                    <button type="button" class="admin-btn admin-btn--secondary admin-btn--small" data-add-hero="vimeo">+ Vimeo</button>
                    <button type="button" class="admin-btn admin-btn--secondary admin-btn--small" data-add-hero="file">+ Upload</button>
                </span>
            </div>
            <div class="admin-card-body">
                <p class="admin-field-hint" style="margin-top:0;margin-bottom:.7rem">Add one or more feature videos. They show on the project page as a swipeable carousel. Each can be a Vimeo link or a hosted video file.</p>
                <div data-mount="hero"></div>
            </div>
        </div>

        <div class="admin-card admin-card-accent">
            <div class="admin-card-head"><div class="admin-card-head-l"><h3>Thumbnail</h3></div></div>
            <div class="admin-card-body">
                <p class="admin-field-hint" style="margin-top:0;margin-bottom:.7rem">Shown in the work grid and as the video poster — 16:9 looks best. Drop a file or paste a URL.</p>
                <div data-mount="thumb"></div>
            </div>
        </div>

        <div class="admin-card admin-card-accent">
            <div class="admin-card-head"><div class="admin-card-head-l"><h3>Description</h3></div></div>
            <div class="admin-card-body">
                <label class="admin-field">
                    <textarea data-field="description" rows="4">${escapeText(p.description)}</textarea>
                </label>
            </div>
        </div>

        <div class="admin-card admin-card-accent">
            <div class="admin-card-head">
                <div class="admin-card-head-l"><h3>Credits</h3></div>
                <button type="button" class="admin-btn admin-btn--secondary admin-btn--small" data-add="credits">+ Add credit</button>
            </div>
            <div class="admin-card-body"><div data-repeater="credits"></div></div>
        </div>

        <div class="admin-card admin-card-accent">
            <div class="admin-card-head">
                <div class="admin-card-head-l"><h3>Photography <span class="sub" data-media-count="gallery"></span></h3></div>
            </div>
            <div class="admin-card-body"><div data-media="gallery"></div></div>
        </div>

        <div class="admin-card admin-card-accent">
            <div class="admin-card-head">
                <div class="admin-card-head-l"><h3>Behind the scenes <span class="sub" data-media-count="btsMedia"></span></h3></div>
            </div>
            <div class="admin-card-body">
                <p class="admin-field-hint" style="margin-top:0;margin-bottom:.7rem">Photos and videos together, in one place. Drag any tile to set the exact order they appear on the site. Drop in photos or videos below — large videos are compressed for the web automatically.</p>
                <div data-media="btsMedia"></div>
            </div>
        </div>
    `;

    // Bind primary text fields
    root.querySelectorAll('[data-field]').forEach(input => {
        input.addEventListener('input', () => {
            state.content.projects[id][input.dataset.field] = input.value;
            setDirty(true);
            if (['title', 'client', 'year'].includes(input.dataset.field)) {
                renderProjectList();
                if (input.dataset.field === 'title') {
                    const h = root.querySelector('.admin-editor-titlebar h3 span');
                    if (h) h.textContent = input.value || '(untitled)';
                }
            }
        });
    });

    // Page URL (project id)
    const slugInput = root.querySelector('[data-slug]');
    const applySlug = () => {
        const next = slugify(slugInput.value);
        if (!next || next === id) { slugInput.value = id; return; }
        if (state.content.projects[next]) {
            toast(`"${next}" is already used by another project`, 'error');
            slugInput.value = id;
            return;
        }
        renameProject(id, next);
        toast(`Page URL is now /work/${next} — Publish to make it live`, 'success');
    };
    slugInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); slugInput.blur(); }
        if (e.key === 'Escape') { slugInput.value = id; slugInput.blur(); }
    });
    slugInput.addEventListener('change', applySlug);
    root.querySelector('[data-slug-suggest]').addEventListener('click', () => {
        const cur = state.content.projects[id];
        slugInput.value = slugify(`${cur.client || ''} ${cur.title || ''}`);
        applySlug();
    });

    root.querySelector('[data-mount="categories"]').appendChild(
        buildCategoryPicker(state.content.projects[id], () => setDirty(true)));

    // Hero videos (carousel)
    renderHeroVideos(root, id);

    // Thumbnail
    root.querySelector('[data-mount="thumb"]').appendChild(imageInput({
        value: p.thumb,
        onChange: v => { p.thumb = v; setDirty(true); renderProjectList(); },
    }));

    // Repeaters / media managers
    renderRepeater(root, id, 'credits');
    renderMediaManager(root, id, 'gallery');
    renderBtsManager(root, id);

    root.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.add;
            const project = state.content.projects[id];
            if (!Array.isArray(project[field])) project[field] = [];
            if (field === 'credits') project[field].push({ role: '', name: '' });
            else if (field === 'bts') project[field].push({ label: '', img: '' });
            else project[field].push('');
            setDirty(true);
            renderRepeater(root, id, field, project[field].length - 1);
        });
    });

    root.querySelectorAll('[data-add-hero]').forEach(btn => {
        btn.addEventListener('click', () => {
            const p2 = state.content.projects[id];
            const list = ensureHeroVideos(p2);
            if (btn.dataset.addHero === 'file') list.push({ type: 'file', src: '', poster: '' });
            else list.push({ type: 'vimeo', vimeo: '', vimeoHash: '', poster: '' });
            setDirty(true);
            syncLegacyVimeo(p2);
            renderHeroVideos(root, id);
        });
    });
}

/* ────────────── Hero videos (carousel) ────────────── */
// Each project can have several feature videos shown as a swipeable carousel.
// A hero entry is either { type:'vimeo', vimeo, vimeoHash, poster } or
// { type:'file', src, poster }. We migrate the legacy single vimeo field in,
// and mirror the first Vimeo entry back to vimeo/vimeoHash for back-compat.
function ensureHeroVideos(p) {
    if (!Array.isArray(p.heroVideos)) {
        p.heroVideos = [];
        if (p.vimeo) p.heroVideos.push({ type: 'vimeo', vimeo: p.vimeo, vimeoHash: p.vimeoHash || '', poster: '' });
    }
    return p.heroVideos;
}

function syncLegacyVimeo(p) {
    const first = (p.heroVideos || []).find(v => v.type !== 'file' && v.vimeo);
    p.vimeo = first ? first.vimeo : '';
    p.vimeoHash = first ? (first.vimeoHash || '') : '';
}

function renderHeroVideos(root, projectId) {
    const host = root.querySelector('[data-mount="hero"]');
    if (!host) return;
    const p = state.content.projects[projectId];
    const list = ensureHeroVideos(p);

    const countEl = root.querySelector('[data-hero-count]');
    if (countEl) countEl.textContent = list.length ? `— ${list.length}` : '';

    host.innerHTML = '';
    if (!list.length) {
        host.innerHTML = `<div class="admin-hint" style="margin:0">No hero videos yet — add a Vimeo link or upload above.</div>`;
        return;
    }
    list.forEach((v, idx) => host.appendChild(buildHeroRow(root, projectId, v, idx)));
}

function buildHeroRow(root, projectId, v, idx) {
    const p = state.content.projects[projectId];
    const list = p.heroVideos;
    const row = document.createElement('div');
    row.className = 'admin-hero-row';

    const head = document.createElement('div');
    head.className = 'admin-hero-row-head';
    const label = document.createElement('span');
    label.className = 'admin-repeater-handle';
    label.title = 'Drag to reorder';
    label.innerHTML = `<span class="admin-grip">⠿</span> Hero ${idx + 1} · ${v.type === 'file' ? 'Upload' : 'Vimeo'}`;
    const acts = document.createElement('span');
    acts.className = 'admin-hero-row-acts';

    const move = (delta) => {
        const j = idx + delta;
        if (j < 0 || j >= list.length) return;
        [list[idx], list[j]] = [list[j], list[idx]];
        setDirty(true);
        syncLegacyVimeo(p);
        renderHeroVideos(root, projectId);
    };
    const up = miniBtn('↑', 'Move up', () => move(-1));
    const down = miniBtn('↓', 'Move down', () => move(1));
    up.disabled = idx === 0;
    down.disabled = idx === list.length - 1;
    const del = deleteButton(() => {
        list.splice(idx, 1);
        setDirty(true);
        syncLegacyVimeo(p);
        renderHeroVideos(root, projectId);
    });
    acts.append(up, down, del);
    head.append(label, acts);
    row.appendChild(head);

    // Drag-to-reorder (in addition to the ↑/↓ buttons). Keep the legacy single
    // vimeo field mirrored to the first clip after a move.
    makeRowReorderable({
        row, handle: label, getIndex: () => idx, list,
        rerender: () => { syncLegacyVimeo(p); renderHeroVideos(root, projectId); },
    });

    if (v.type === 'file') {
        const srcField = textField('Video URL (.mp4)', v.src, val => { v.src = val.trim(); setDirty(true); });
        row.appendChild(srcField);
        const note = document.createElement('p');
        note.className = 'admin-field-hint';
        note.style.margin = '.4rem 0 0';
        note.textContent = 'Paste a hosted .mp4 URL, or run the clip through the media pipeline.';
        row.appendChild(note);
    } else {
        const vimeoField = textField('Vimeo link or ID', vimeoDisplay(v.vimeo, v.vimeoHash), val => {
            const parsed = parseVimeo(val);
            v.vimeo = parsed.id;
            v.vimeoHash = parsed.hash;
            setDirty(true);
            syncLegacyVimeo(p);
        });
        row.appendChild(vimeoField);
    }

    const posterLabel = document.createElement('span');
    posterLabel.className = 'admin-field-label';
    posterLabel.style.cssText = 'display:block;margin:.7rem 0 .35rem';
    posterLabel.textContent = 'Poster image (optional — falls back to the thumbnail)';
    row.appendChild(posterLabel);
    row.appendChild(imageInput({ value: v.poster || '', onChange: val => { v.poster = val; setDirty(true); } }));

    return row;
}

function miniBtn(glyph, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'admin-btn admin-btn--ghost admin-btn--small';
    b.textContent = glyph;
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
}

function renderRepeater(root, projectId, field, focusIndex = null) {
    const host = root.querySelector(`[data-repeater="${field}"]`);
    if (!host) return;
    host.innerHTML = '';
    const project = state.content.projects[projectId];
    const items = project[field] || [];

    if (items.length === 0) {
        const labels = { credits: 'credits', gallery: 'stills', bts: 'BTS images' };
        host.innerHTML = `<div class="admin-hint" style="margin:0">No ${labels[field] || field} yet.</div>`;
        return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'admin-repeater';

    items.forEach((item, idx) => {
        const row = document.createElement('div');

        if (field === 'credits') {
            row.className = 'admin-repeater-item admin-repeater-item--credit';
            const grip = document.createElement('span');
            grip.className = 'admin-grip';
            grip.title = 'Drag to reorder';
            grip.textContent = '⠿';
            const roleI = textField('ROLE', item.role, v => { items[idx].role = v; setDirty(true); });
            roleI.className = 'credit-role';
            const nameI = textField('Full name', item.name, v => { items[idx].name = v; setDirty(true); });
            nameI.className = 'credit-name';
            row.append(grip, roleI, nameI, deleteButton(() => { items.splice(idx, 1); setDirty(true); renderRepeater(root, projectId, field); }));
            makeRowReorderable({ row, handle: grip, getIndex: () => idx, list: items, rerender: () => renderRepeater(root, projectId, field) });
        } else if (field === 'bts') {
            row.className = 'admin-repeater-item admin-repeater-item--media';
            const top = document.createElement('div');
            top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:.5rem';
            top.innerHTML = `<span class="admin-repeater-handle">BTS ${idx + 1}</span>`;
            top.appendChild(deleteButton(() => { items.splice(idx, 1); setDirty(true); renderRepeater(root, projectId, field); }));
            const cap = textField('Caption', item.label, v => { items[idx].label = v; setDirty(true); });
            const img = imageInput({ value: item.img, onChange: v => { items[idx].img = v; setDirty(true); } });
            row.append(top, cap, img);
        } else { // gallery — plain string URL/dataURL
            row.className = 'admin-repeater-item admin-repeater-item--media';
            const top = document.createElement('div');
            top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:.5rem';
            top.innerHTML = `<span class="admin-repeater-handle">Still ${idx + 1}</span>`;
            top.appendChild(deleteButton(() => { items.splice(idx, 1); setDirty(true); renderRepeater(root, projectId, field); }));
            const img = imageInput({ value: item, onChange: v => { items[idx] = v; setDirty(true); } });
            row.append(top, img);
        }

        wrap.appendChild(row);
    });

    host.appendChild(wrap);

    // When a row was just added, glide to it and focus its first input.
    if (focusIndex != null && wrap.children[focusIndex]) {
        const newRow = wrap.children[focusIndex];
        newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const firstInput = newRow.querySelector('input, textarea');
        if (firstInput) {
            // Wait for the smooth scroll to settle before focusing so the
            // browser doesn't yank the scroll position.
            setTimeout(() => firstInput.focus({ preventScroll: true }), 320);
        }
        newRow.classList.add('is-new');
        setTimeout(() => newRow.classList.remove('is-new'), 900);
    }
}

/* ────────────── Media manager (stills / BTS) ────────────── */
// A comfortable bulk editor for image arrays: drop many files at once, see
// them as a compact reorderable thumbnail grid, remove with one click.

function mediaImageOf(type, item) {
    if (type === 'gallery') return item;
    if (type === 'videos') return (item && item.poster) || '';
    return (item && item.img) || '';
}

function renderMediaManager(root, projectId, type) {
    const host = root.querySelector(`[data-media="${type}"]`);
    if (!host) return;
    const project = state.content.projects[projectId];
    if (!Array.isArray(project[type])) project[type] = [];
    const items = project[type];
    const isVideo = type === 'videos';
    const noun = type === 'gallery' ? 'photos' : isVideo ? 'clips' : 'BTS photos';

    const countEl = root.querySelector(`[data-media-count="${type}"]`);
    if (countEl) countEl.textContent = items.length ? `— ${items.length}` : '';

    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'admin-media-manager';

    if (!isVideo) {
        // Bulk dropzone (multi-file) — images only
        const bulk = document.createElement('div');
        bulk.className = 'admin-media-bulk';
        bulk.innerHTML = `${UPLOAD_ICON}<div class="admin-media-bulk-text"><div class="t">Drop images here</div><div class="s">or click to upload — add as many as you like at once</div></div>`;
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.multiple = true; fileInput.hidden = true;

        const addFiles = async (fileList) => {
            const files = Array.from(fileList || []).filter(f => f.type && f.type.startsWith('image/'));
            if (!files.length) return;
            bulk.classList.add('is-busy');
            let added = 0, failed = 0;
            for (const f of files) {
                toast(`Uploading ${added + failed + 1} of ${files.length}…`);
                try {
                    const url = await imageFileToUrl(f);
                    if (type === 'gallery') items.push(url);
                    else items.push({ label: '', img: url });
                    added++;
                } catch { failed++; }
            }
            setDirty(true);
            renderMediaManager(root, projectId, type);
            toast(`Added ${added} image${added !== 1 ? 's' : ''}` + (failed ? ` · ${failed} failed` : ''), failed ? 'error' : 'success');
        };

        bulk.addEventListener('click', () => fileInput.click());
        bulk.addEventListener('dragover', e => { e.preventDefault(); bulk.classList.add('is-dragover'); });
        bulk.addEventListener('dragleave', () => bulk.classList.remove('is-dragover'));
        bulk.addEventListener('drop', e => { e.preventDefault(); bulk.classList.remove('is-dragover'); addFiles(e.dataTransfer.files); });
        fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
        wrap.append(bulk, fileInput);
    } else {
        const note = document.createElement('div');
        note.className = 'admin-media-note';
        note.textContent = 'These are the behind-the-scenes clips. Reorder, caption, or remove them here. New clips are encoded through the media pipeline (not uploaded in the browser), or paste a hosted video URL below.';
        wrap.append(note);
    }

    // Add by URL (image URL, or video URL for clips)
    const urlRow = document.createElement('div');
    urlRow.className = 'admin-media-urlrow';
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.placeholder = isVideo ? 'Paste a video (.mp4) URL' : '…or paste an image URL';
    const urlBtn = document.createElement('button');
    urlBtn.type = 'button'; urlBtn.className = 'admin-btn admin-btn--secondary admin-btn--small'; urlBtn.textContent = 'Add';
    const addUrl = () => {
        const v = urlInput.value.trim();
        if (!v) return;
        if (type === 'gallery') items.push(v);
        else if (isVideo) items.push({ src: v, poster: '', label: '' });
        else items.push({ label: '', img: v });
        urlInput.value = '';
        setDirty(true);
        renderMediaManager(root, projectId, type);
    };
    urlBtn.addEventListener('click', addUrl);
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } });
    urlRow.append(urlInput, urlBtn);

    // Thumbnail grid
    const grid = document.createElement('div');
    grid.className = 'admin-media-grid';
    if (items.length === 0) {
        grid.innerHTML = `<div class="admin-hint" style="grid-column:1/-1;margin:0">No ${noun} yet${isVideo ? '.' : ' — drop some above.'}</div>`;
    } else {
        items.forEach((item, idx) => grid.appendChild(buildMediaTile(root, projectId, type, item, idx)));
        enableGridReorder(grid, items, () => { setDirty(true); renderMediaManager(root, projectId, type); });
    }

    wrap.append(urlRow, grid);
    host.appendChild(wrap);
}

function buildMediaTile(root, projectId, type, item, idx) {
    const items = state.content.projects[projectId][type];
    const hasCaption = type === 'bts' || type === 'videos';
    const tile = document.createElement('div');
    tile.className = 'admin-media-tile' + (hasCaption ? ' has-cap' : '') + (type === 'videos' ? ' is-video' : '');
    tile.dataset.idx = idx;

    const num = document.createElement('span');
    num.className = 'admin-media-tile-num';
    num.textContent = String(idx + 1).padStart(2, '0');

    // Thumbnail (or a placeholder if a clip has no poster yet)
    const src = mediaImageOf(type, item);
    let thumb;
    if (src) {
        thumb = document.createElement('img');
        thumb.className = 'admin-media-tile-img';
        thumb.src = src;
        thumb.alt = '';
        thumb.loading = 'lazy';
    } else {
        thumb = document.createElement('div');
        thumb.className = 'admin-media-tile-img admin-media-tile-ph';
        thumb.innerHTML = IMG_ICON;
    }
    // The thumbnail is the drag handle (caption text stays editable). Reordering
    // is handled by enableGridReorder() at the grid level (pointer drag + FLIP).
    thumb.draggable = false;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'admin-media-tile-del';
    del.title = 'Remove';
    del.textContent = '✕';
    del.addEventListener('click', e => {
        e.stopPropagation();
        items.splice(idx, 1);
        setDirty(true);
        renderMediaManager(root, projectId, type);
    });

    tile.append(num, thumb, del);

    if (type === 'videos') {
        const play = document.createElement('span');
        play.className = 'admin-media-tile-play';
        play.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        tile.appendChild(play);
    }

    if (hasCaption) {
        const cap = document.createElement('input');
        cap.type = 'text';
        cap.className = 'admin-media-tile-cap';
        cap.placeholder = 'Caption';
        cap.value = item.label || '';
        cap.addEventListener('input', () => { items[idx].label = cap.value; setDirty(true); });
        tile.appendChild(cap);
    }

    return tile;
}

/* ────────────── iOS-style pointer drag-reorder for media grids ────────────── */
// The grabbed tile floats under the pointer while the rest slide (FLIP) to open a
// gap, committing on release. Replaces native HTML5 DnD for the photo/video
// grids. `items` is the backing array (mutated in place); `onReorder` persists +
// repaints once, only if the order actually changed.
// Options (used by the project list): `tileClass`, `handleSel` (touch/pen handle),
// `mouseHandleSel` (mouse handle — can be the whole row), `ignoreSel` (never starts
// a drag, e.g. buttons), `axis` ('grid' or 'y' for a single column) and `scroller`
// (the element to auto-scroll; defaults to the page).
function enableGridReorder(grid, items, onReorder, opts = {}) {
    const THRESHOLD = 4;
    const tileClass = opts.tileClass || 'admin-media-tile';
    const handleSel = opts.handleSel || '.admin-media-tile-img';
    const mouseHandleSel = opts.mouseHandleSel || handleSel;
    const axis = opts.axis || 'grid';
    const scroller = opts.scroller || null;
    let st = null;
    let suppressClick = false;

    const tilesIn = () => [...grid.children].filter(c => c.classList.contains(tileClass));
    const orderKey = () => tilesIn().map(t => t.dataset.idx).join(',');

    // A drag ends with a click on the row underneath; swallow it so dropping a
    // project doesn't also open it.
    grid.addEventListener('click', (e) => {
        if (!suppressClick) return;
        suppressClick = false;
        e.stopPropagation();
        e.preventDefault();
    }, true);

    grid.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (opts.ignoreSel && e.target.closest(opts.ignoreSel)) return;
        const handle = e.target.closest(e.pointerType === 'mouse' ? mouseHandleSel : handleSel);
        if (!handle || !grid.contains(handle)) return;
        const tile = handle.closest('.' + tileClass);
        if (!tile) return;
        // Keep text fields usable inside a draggable row.
        if (e.target.closest('input, textarea, select')) return;
        e.preventDefault();
        st = { tile, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, active: false, clone: null, dx: 0, dy: 0, raf: 0, startOrder: orderKey() };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
        window.addEventListener('pointercancel', onUp, { once: true });
    });

    function beginDrag(e) {
        const tile = st.tile;
        const rect = tile.getBoundingClientRect();
        st.dx = e.clientX - rect.left;
        st.dy = e.clientY - rect.top;
        const clone = tile.cloneNode(true);
        clone.classList.add('admin-media-drag-clone');
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(1.05)`;
        document.body.appendChild(clone);
        st.clone = clone;
        tile.classList.add('is-drag-src');
        document.body.classList.add('is-grid-dragging');
        st.active = true;
        st.raf = requestAnimationFrame(autoScrollTick);
    }

    function positionClone() {
        st.clone.style.transform = `translate(${st.lastX - st.dx}px, ${st.lastY - st.dy}px) scale(1.05)`;
    }

    // Insertion point = first tile whose midpoint is past the pointer (row-major).
    // Comparing against midpoints gives hysteresis, so neighbours don't oscillate.
    function updateInsertion() {
        const others = tilesIn().filter(t => t !== st.tile);
        let ref = null;
        for (const t of others) {
            const r = t.getBoundingClientRect();
            const before = axis === 'y'
                ? st.lastY < r.top + r.height / 2
                : st.lastY < r.top ? true
                : st.lastY > r.bottom ? false
                : st.lastX < r.left + r.width / 2;
            if (before) { ref = t; break; }
        }
        if (ref === st.tile || st.tile.nextSibling === ref) return; // already in place
        flipMove(() => grid.insertBefore(st.tile, ref));
    }

    // While dragging near the top/bottom edge of the viewport, scroll the page in
    // that direction so a tile can be dropped beyond what's currently on screen.
    function autoScrollTick() {
        if (!st || !st.active) return;
        const MAX = 22;
        let top = 0, bottom = window.innerHeight, MARGIN = 100;
        if (scroller) {
            const r = scroller.getBoundingClientRect();
            top = Math.max(0, r.top); bottom = Math.min(window.innerHeight, r.bottom);
            MARGIN = Math.min(60, (bottom - top) / 4);
        }
        let dy = 0;
        if (st.lastY < top + MARGIN) dy = -MAX * Math.min(1, 1 - (st.lastY - top) / MARGIN);
        else if (st.lastY > bottom - MARGIN) dy = MAX * Math.min(1, 1 - (bottom - st.lastY) / MARGIN);
        if (dy) {
            const target = scroller || document.scrollingElement || document.documentElement;
            const before = target.scrollTop;
            if (scroller) scroller.scrollTop += dy; else window.scrollBy(0, dy);
            if (target.scrollTop !== before) updateInsertion(); // tiles moved under the pointer
        }
        st.raf = requestAnimationFrame(autoScrollTick);
    }

    function onMove(e) {
        if (!st) return;
        st.lastX = e.clientX; st.lastY = e.clientY;
        if (!st.active) {
            if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) < THRESHOLD) return;
            beginDrag(e);
        }
        positionClone();
        updateInsertion();
    }

    // FLIP: record sibling positions, move the placeholder in the DOM, then play
    // each sibling from its old spot to its new one.
    function flipMove(mutate) {
        const tiles = tilesIn();
        const firsts = tiles.map(t => [t, t.getBoundingClientRect()]);
        mutate();
        for (const [t, f] of firsts) {
            if (t === st.tile) continue;
            const l = t.getBoundingClientRect();
            const dx = f.left - l.left, dy = f.top - l.top;
            if (!dx && !dy) continue;
            t.style.transition = 'none';
            t.style.transform = `translate(${dx}px, ${dy}px)`;
            requestAnimationFrame(() => {
                t.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)';
                t.style.transform = '';
            });
        }
    }

    function onUp() {
        window.removeEventListener('pointermove', onMove);
        if (!st) return;
        const s = st; st = null;
        if (s.raf) cancelAnimationFrame(s.raf);
        if (!s.active) return;

        const rect = s.tile.getBoundingClientRect();
        s.clone.style.transition = 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s';
        s.clone.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(1)`;

        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            s.clone.remove();
            s.tile.classList.remove('is-drag-src');
            document.body.classList.remove('is-grid-dragging');
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
            if (orderKey() === s.startOrder) return; // nothing actually moved
            const newOrder = tilesIn().map(t => items[+t.dataset.idx]);
            items.splice(0, items.length, ...newOrder);
            onReorder();
        };
        s.clone.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, 240);
    }
}

/* ────────────── Combined BTS (photos + videos, hand-ordered) ────────────── */
// `btsMedia` is the single ordered source of truth. Each entry is either
//   { kind:'image', img, label }   or   { kind:'video', src, poster, label, w, h }
// We migrate the legacy split arrays (bts photos + videos clips) in on first use,
// and mirror btsMedia back out to bts/videos so anything still reading those keys
// (the site fallback, the media pipeline) keeps working.
function ensureBtsMedia(p) {
    if (!Array.isArray(p.btsMedia)) {
        const photos = (p.bts || []).map(b => ({ kind: 'image', img: b.img || '', label: b.label || '' }));
        const clips = (p.videos || []).map(v => {
            const o = { kind: 'video', src: v.src || '', poster: v.poster || '', label: v.label || '' };
            if (v.w) o.w = v.w; if (v.h) o.h = v.h;
            return o;
        });
        p.btsMedia = [...photos, ...clips];
    }
    return p.btsMedia;
}

function syncLegacyBts(p) {
    const media = p.btsMedia || [];
    p.bts = media.filter(m => m.kind !== 'video').map(m => ({ label: m.label || '', img: m.img || '' }));
    p.videos = media.filter(m => m.kind === 'video').map(m => {
        const o = { src: m.src || '', poster: m.poster || '', label: m.label || '' };
        if (m.w) o.w = m.w; if (m.h) o.h = m.h;
        return o;
    });
}

function renderBtsManager(root, projectId) {
    const host = root.querySelector('[data-media="btsMedia"]');
    if (!host) return;
    const project = state.content.projects[projectId];
    const items = ensureBtsMedia(project);

    const countEl = root.querySelector('[data-media-count="btsMedia"]');
    if (countEl) {
        const nv = items.filter(m => m.kind === 'video').length;
        const np = items.length - nv;
        countEl.textContent = items.length ? `— ${np} photo${np !== 1 ? 's' : ''}, ${nv} video${nv !== 1 ? 's' : ''}` : '';
    }

    const rerender = () => renderBtsManager(root, projectId);
    const commit = () => { setDirty(true); syncLegacyBts(project); };

    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'admin-media-manager';

    // Bulk dropzone — accepts BOTH images and videos.
    const bulk = document.createElement('div');
    bulk.className = 'admin-media-bulk';
    bulk.innerHTML = `${UPLOAD_ICON}<div class="admin-media-bulk-text"><div class="t">Drop photos or videos here</div><div class="s">click to browse — large videos are compressed for the web automatically</div></div>`;
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*,video/*'; fileInput.multiple = true; fileInput.hidden = true;

    const addFiles = async (fileList) => {
        const files = Array.from(fileList || []).filter(f => f.type && (f.type.startsWith('image/') || f.type.startsWith('video/')));
        if (!files.length) return;
        bulk.classList.add('is-busy');
        for (const f of files) {
            try {
                if (f.type.startsWith('image/')) {
                    toast('Uploading ' + (f.name || 'photo') + '…');
                    const url = await imageFileToUrl(f);
                    items.push({ kind: 'image', img: url, label: '' });
                    commit(); rerender();
                } else {
                    await addVideoFile(f, items, commit, rerender);
                }
            } catch (err) {
                toast('Could not add ' + (f.name || 'file') + ': ' + err.message, 'error');
            }
        }
        bulk.classList.remove('is-busy');
    };

    bulk.addEventListener('click', () => fileInput.click());
    bulk.addEventListener('dragover', e => { e.preventDefault(); bulk.classList.add('is-dragover'); });
    bulk.addEventListener('dragleave', () => bulk.classList.remove('is-dragover'));
    bulk.addEventListener('drop', e => { e.preventDefault(); bulk.classList.remove('is-dragover'); addFiles(e.dataTransfer.files); });
    fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });
    wrap.append(bulk, fileInput);

    // Add by URL — image or hosted video.
    const urlRow = document.createElement('div');
    urlRow.className = 'admin-media-urlrow';
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.placeholder = 'Paste an image or video (.mp4) URL';
    const addImgBtn = document.createElement('button');
    addImgBtn.type = 'button'; addImgBtn.className = 'admin-btn admin-btn--secondary admin-btn--small'; addImgBtn.textContent = '+ Photo';
    const addVidBtn = document.createElement('button');
    addVidBtn.type = 'button'; addVidBtn.className = 'admin-btn admin-btn--secondary admin-btn--small'; addVidBtn.textContent = '+ Video';
    const addUrl = (kind) => {
        const v = urlInput.value.trim();
        if (!v) return;
        if (kind === 'video') items.push({ kind: 'video', src: v, poster: '', label: '' });
        else items.push({ kind: 'image', img: v, label: '' });
        urlInput.value = '';
        commit(); rerender();
    };
    addImgBtn.addEventListener('click', () => addUrl('image'));
    addVidBtn.addEventListener('click', () => addUrl('video'));
    urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addUrl('image'); } });
    urlRow.append(urlInput, addImgBtn, addVidBtn);

    // Tiles
    const grid = document.createElement('div');
    grid.className = 'admin-media-grid';
    if (items.length === 0) {
        grid.innerHTML = `<div class="admin-hint" style="grid-column:1/-1;margin:0">No behind-the-scenes media yet — drop some above.</div>`;
    } else {
        items.forEach((item, idx) => grid.appendChild(buildBtsTile(root, item, idx, items, commit, rerender)));
        enableGridReorder(grid, items, () => { commit(); rerender(); });
    }

    wrap.append(urlRow, grid);
    host.appendChild(wrap);
}

function buildBtsTile(root, item, idx, items, commit, rerender) {
    const isVideo = item.kind === 'video';
    const tile = document.createElement('div');
    tile.className = 'admin-media-tile has-cap' + (isVideo ? ' is-video' : '');
    tile.dataset.idx = idx;

    const num = document.createElement('span');
    num.className = 'admin-media-tile-num';
    num.textContent = String(idx + 1).padStart(2, '0');

    const src = isVideo ? (item.poster || '') : (item.img || '');
    let thumb;
    if (src) {
        thumb = document.createElement('img');
        thumb.className = 'admin-media-tile-img';
        thumb.src = src; thumb.alt = ''; thumb.loading = 'lazy';
    } else if (isVideo && item.src) {
        thumb = document.createElement('video');
        thumb.className = 'admin-media-tile-img';
        thumb.src = item.src + '#t=0.1';
        thumb.muted = true; thumb.playsInline = true; thumb.preload = 'metadata';
    } else {
        thumb = document.createElement('div');
        thumb.className = 'admin-media-tile-img admin-media-tile-ph';
        thumb.innerHTML = IMG_ICON;
    }
    thumb.draggable = false; // pointer drag handled by enableGridReorder()

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'admin-media-tile-del';
    del.title = 'Remove';
    del.textContent = '✕';
    del.addEventListener('click', e => { e.stopPropagation(); items.splice(idx, 1); commit(); rerender(); });

    tile.append(num, thumb, del);

    if (isVideo) {
        const play = document.createElement('span');
        play.className = 'admin-media-tile-play';
        play.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        tile.appendChild(play);
    }

    const cap = document.createElement('input');
    cap.type = 'text';
    cap.className = 'admin-media-tile-cap';
    cap.placeholder = 'Caption';
    cap.value = item.label || '';
    cap.addEventListener('input', () => { items[idx].label = cap.value; commit(); });
    tile.appendChild(cap);

    return tile;
}

/* ────────────── Video: probe / compress / poster / upload ────────────── */

const VIDEO_COMPRESS_THRESHOLD = 8 * 1024 * 1024; // compress anything bigger than ~8 MB
const VIDEO_MAX_DIM = 1280;                         // cap the long edge (≈720p vertical / 720p)

// Drop/replace a single video: probe → (compress if large) → poster → upload → push.
async function addVideoFile(file, items, commit, rerender) {
    let blob = file;
    let dims = null;
    try {
        dims = await probeVideo(file);
        const tooBig = file.size > VIDEO_COMPRESS_THRESHOLD;
        const tooLarge = Math.max(dims.w || 0, dims.h || 0) > VIDEO_MAX_DIM;
        if (tooBig || tooLarge) {
            toast('Compressing video for the web… (about as long as the clip)', '');
            const out = await compressVideo(file, dims).catch(() => null);
            if (out && out.blob && out.blob.size > 0 && out.blob.size < file.size) {
                blob = out.blob;
                dims = { w: out.w, h: out.h };
            }
        }
    } catch { /* unreadable metadata — upload the original as-is */ }

    let poster = '';
    try { poster = await grabPoster(blob); } catch { /* no poster — the site falls back */ }

    toast('Uploading video…', '');
    const url = await uploadToBlob(blob, file.name);
    const entry = { kind: 'video', src: url, poster, label: '' };
    if (dims && dims.w) entry.w = dims.w;
    if (dims && dims.h) entry.h = dims.h;
    items.push(entry);
    commit(); rerender();
    toast('Video added', 'success');
}

function probeVideo(fileOrBlob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(fileOrBlob);
        const v = document.createElement('video');
        v.preload = 'metadata'; v.muted = true;
        v.onloadedmetadata = () => { resolve({ w: v.videoWidth, h: v.videoHeight, duration: v.duration }); URL.revokeObjectURL(url); };
        v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read video')); };
        v.src = url;
    });
}

function grabPoster(fileOrBlob, maxDim = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(fileOrBlob);
        const v = document.createElement('video');
        v.preload = 'metadata'; v.muted = true; v.playsInline = true;
        const done = (fn) => { URL.revokeObjectURL(url); fn(); };
        v.onloadeddata = () => { try { v.currentTime = Math.min(0.1, (v.duration || 1) / 2); } catch { /* ignore */ } };
        v.onseeked = () => {
            try {
                const scale = Math.min(1, maxDim / Math.max(v.videoWidth, v.videoHeight));
                const w = Math.max(1, Math.round(v.videoWidth * scale));
                const h = Math.max(1, Math.round(v.videoHeight * scale));
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                c.getContext('2d').drawImage(v, 0, 0, w, h);
                const data = c.toDataURL('image/jpeg', quality);
                done(() => resolve(data));
            } catch (e) { done(() => reject(e)); }
        };
        v.onerror = () => done(() => reject(new Error('poster failed')));
        v.src = url;
    });
}

function pickRecorderMime() {
    const cands = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (const m of cands) { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; }
    return '';
}

// Realtime re-encode via canvas + MediaRecorder: downscale to VIDEO_MAX_DIM and
// cap the bitrate. No external deps, no special headers. Best-effort — callers
// fall back to the original file if this resolves null or throws.
function compressVideo(file, probe) {
    return new Promise((resolve, reject) => {
        const mime = pickRecorderMime();
        if (!mime || !window.MediaRecorder) { resolve(null); return; }
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.src = url; v.playsInline = true;
        v.onloadedmetadata = () => {
            const scale = Math.min(1, VIDEO_MAX_DIM / Math.max(probe.w, probe.h));
            const w = Math.max(2, Math.round(probe.w * scale / 2) * 2);
            const h = Math.max(2, Math.round(probe.h * scale / 2) * 2);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            const canvasStream = canvas.captureStream(30);

            // Pull the audio track off the source element so the clip keeps sound.
            let stream = canvasStream;
            try {
                const elStream = v.captureStream ? v.captureStream() : (v.mozCaptureStream && v.mozCaptureStream());
                const audio = elStream && elStream.getAudioTracks ? elStream.getAudioTracks() : [];
                if (audio.length) stream = new MediaStream([...canvasStream.getVideoTracks(), audio[0]]);
            } catch { /* video-only output */ }

            const bitrate = Math.min(4_000_000, Math.max(1_200_000, Math.round(w * h * 30 * 0.07)));
            let rec;
            try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate }); }
            catch { URL.revokeObjectURL(url); resolve(null); return; }

            const chunks = [];
            let raf = 0;
            rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
            rec.onstop = () => { URL.revokeObjectURL(url); cancelAnimationFrame(raf); resolve({ blob: new Blob(chunks, { type: mime }), w, h, mime }); };

            const draw = () => {
                if (v.ended) { if (rec.state !== 'inactive') rec.stop(); return; }
                ctx.drawImage(v, 0, 0, w, h);
                raf = requestAnimationFrame(draw);
            };
            v.onended = () => { if (rec.state !== 'inactive') rec.stop(); };
            let started = false;
            v.onplay = () => { if (started) return; started = true; rec.start(250); draw(); };
            // Try to play with sound first (keeps audio in the output). If the
            // autoplay policy blocks it, retry muted so compression still runs.
            v.play().catch(() => {
                v.muted = true;
                v.play().catch(() => { URL.revokeObjectURL(url); resolve(null); });
            });
        };
        v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('compress: cannot load video')); };
    });
}

function extFromMime(m) {
    if (!m) return '';
    if (m.includes('mp4')) return 'mp4';
    if (m.includes('webm')) return 'webm';
    if (m.includes('quicktime')) return 'mov';
    if (m.includes('jpeg')) return 'jpg';
    if (m.includes('png')) return 'png';
    if (m.includes('webp')) return 'webp';
    if (m.includes('gif')) return 'gif';
    return '';
}

// Direct-to-Blob client upload (bypasses the serverless body limit). /api/upload
// authorizes the session and mints a one-time client token.
async function uploadToBlob(blob, originalName, folder = 'bts', onProgress = null) {
    const ext = extFromMime(blob.type) || (originalName && originalName.split('.').pop()) || 'mp4';
    const base = (originalName || 'clip').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'clip';
    const pathname = `${folder}/${base}.${ext}`;
    let mod;
    try {
        mod = await import('https://esm.sh/@vercel/blob@2/client');
    } catch {
        throw new Error('upload module failed to load (offline?)');
    }
    const result = await mod.upload(pathname, blob, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        contentType: blob.type || undefined,
        multipart: true,
        onUploadProgress: onProgress ? (e) => onProgress(Math.round(e.percentage || 0)) : undefined,
    });
    return result.url;
}

function addProject() {
    if (!state.content) return;
    if (!state.content.projects) state.content.projects = {};
    const id = uniqueProjectId('new-project');
    state.content.projects[id] = {
        client: '',
        title: 'Untitled project',
        type: '',
        year: String(new Date().getFullYear()),
        vimeo: '',
        vimeoHash: '',
        thumb: '',
        description: '',
        credits: [],
        bts: [],
        gallery: [],
    };
    state.selectedProject = id;
    setDirty(true);
    renderProjectList();
    renderProjectEditor();
    updateCounts();
    toast('Project added — fill in the details', 'success');
    // Jump to the editor and focus the Title field so they can rename right away.
    const editor = $('#projectEditor');
    if (editor) {
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const titleField = editor.querySelector('[data-field="title"]');
        if (titleField) {
            setTimeout(() => { titleField.focus(); titleField.select(); }, 120);
        }
    }
}

/* ────────────── Misc HTML helpers ────────────── */

function escapeText(s) {
    return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ────────────── Top-level render ────────────── */

function renderAll() {
    renderAbout();
    renderServices();
    renderHomepage();
    renderProjectList();
    renderProjectEditor();
    updateCounts();
    setDirty(false);
}

/* ────────────── Save / Publish ────────────── */

async function saveDraft() {
    const btn = $('#saveDraftBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
        await moveInlineImagesToBlob(state.content);
        await api.saveDraft(state.content);
        state.original = JSON.parse(JSON.stringify(state.content));
        setDirty(false);
        toast('Draft saved. Preview it from the Preview button.', 'success');
    } catch (err) {
        toast('Save failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save draft';
    }
}

async function publish() {
    const ok = await confirmDialog({
        title: 'Publish to the live site',
        message: 'This commits your draft to GitHub and triggers a Vercel deploy. The live site updates in ~30-60 seconds.',
        okLabel: 'Publish now',
    });
    if (!ok) return;

    try {
        if (await moveInlineImagesToBlob(state.content)) setDirty(true);
    } catch (err) {
        toast('Could not upload photos: ' + err.message, 'error');
        return;
    }
    if (state.dirty) {
        try { await api.saveDraft(state.content); } catch (err) {
            toast('Could not save before publishing: ' + err.message, 'error');
            return;
        }
    }

    const btn = $('#publishBtn');
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    try {
        const result = await api.publish();
        toast(`Published. Commit ${result.commit?.slice(0, 7) || ''} pushed.`, 'success');
        state.original = JSON.parse(JSON.stringify(state.content));
        setDirty(false);
    } catch (err) {
        toast('Publish failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Publish';
    }
}

/* ────────────── Init ────────────── */

function initShellButtons() {
    $('#saveDraftBtn').addEventListener('click', saveDraft);
    $('#publishBtn').addEventListener('click', publish);
    $('#addProjectBtn').addEventListener('click', addProject);
    const refreshBtn = $('#refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', async () => {
        if (state.dirty) {
            const ok = await confirmDialog({
                title: 'Reload latest content?',
                message: 'This pulls the current published content from the server and discards your unsaved changes.',
                okLabel: 'Reload',
                danger: true,
            });
            if (!ok) return;
        }
        refreshBtn.disabled = true;
        const prev = refreshBtn.textContent;
        refreshBtn.textContent = 'Refreshing…';
        try {
            await loadAndRender();
            const n = Object.keys(state.content?.projects || {}).length;
            toast(`Loaded latest content — ${n} projects`, 'success');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = prev;
        }
    });

    const discardBtn = $('#discardDraftBtn');
    if (discardBtn) discardBtn.addEventListener('click', async () => {
        const ok = await confirmDialog({
            title: 'Discard draft?',
            message: 'This deletes the saved draft and reloads the published (live) content. Any unsaved changes will be lost.',
            okLabel: 'Discard draft',
            danger: true,
        });
        if (!ok) return;
        discardBtn.disabled = true;
        const prev = discardBtn.textContent;
        discardBtn.textContent = 'Discarding…';
        try {
            await api.discardDraft();
            await loadAndRender();
            toast('Draft discarded — showing published content', 'success');
        } catch (err) {
            toast('Discard failed: ' + err.message, 'error');
        } finally {
            discardBtn.disabled = false;
            discardBtn.textContent = prev;
        }
    });

    const doLogout = async () => { await api.logout(); location.reload(); };
    $('#logoutBtn').addEventListener('click', doLogout);
    const logoutTop = $('#logoutBtnTop');
    if (logoutTop) logoutTop.addEventListener('click', doLogout);

    window.addEventListener('beforeunload', e => {
        if (state.dirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// Defensive init: render the login first, then bind handlers and bootstrap.
(async function init() {
    try {
        const loginEl = document.getElementById('adminLogin');
        if (loginEl) loginEl.hidden = false;
    } catch (e) { /* DOM not ready */ }

    try { initHelp(); } catch (e) { console.error('[admin] initHelp failed', e); }
    try { initTabs(); } catch (e) { console.error('[admin] initTabs failed', e); }
    try { initLogin(); } catch (e) { console.error('[admin] initLogin failed', e); }
    try { initShellButtons(); } catch (e) { console.error('[admin] initShellButtons failed', e); }
    try { bindAbout(); } catch (e) { console.error('[admin] bindAbout failed', e); }
    try { await bootstrap(); } catch (e) {
        console.error('[admin] bootstrap failed', e);
        const errEl = document.getElementById('loginError');
        if (errEl) {
            errEl.textContent = 'Init error: ' + (e?.message || e);
            errEl.hidden = false;
        }
    }
})();

/* ────────────── Homepage: banner video, The Reel, client logos ────────────── */

const DEFAULT_HERO = {
    src: '/media/hero/hero-1080.mp4',
    mobile: '/media/hero/hero-720.mp4',
    poster: '/media/hero/hero-poster.jpg',
};

// Older saved content has no hero / reel / clients yet. Fill them in from the
// deployed content.json (which has them) so the Homepage tab starts from what
// the site shows today.
async function seedHomepageContent(content) {
    if (content.hero && Array.isArray(content.reel) && Array.isArray(content.clients)) return false;
    let base = null;
    try {
        const r = await fetch('/data/content.json', { cache: 'no-store' });
        if (r.ok) base = await r.json();
    } catch { /* use built-in defaults */ }
    let changed = false;
    if (!content.hero) { content.hero = (base && base.hero) || { ...DEFAULT_HERO }; changed = true; }
    if (!Array.isArray(content.reel)) {
        const ids = Object.keys(content.projects || {});
        content.reel = ((base && base.reel) || ids.slice(0, 5)).filter(id => content.projects[id]);
        changed = true;
    }
    if (!Array.isArray(content.clients)) { content.clients = (base && base.clients) || []; changed = true; }
    return changed;
}

// Site-relative asset paths (brand/clients/x.svg) need a leading slash here,
// because the dashboard lives under /admin/.
function siteSrc(src) {
    if (!src) return '';
    if (/^(https?:|data:|blob:|\/)/.test(src)) return src;
    return '/' + src;
}

function renderHomepage() {
    if (!state.content) return;
    renderHomeHero();
    renderHomeReel();
    renderHomeClients();
}

function renderHomeHero() {
    const host = $('#homeHero');
    if (!host) return;
    const hero = state.content.hero || (state.content.hero = { ...DEFAULT_HERO });
    host.innerHTML = `
        <div class="admin-hero-preview">
            <video muted loop playsinline autoplay preload="metadata"></video>
        </div>
        <div class="admin-hero-actions">
            <button type="button" class="admin-btn admin-btn--primary admin-btn--small" data-act="upload">Upload new banner video</button>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-act="mobile">${hero.mobile ? 'Replace phone version' : 'Add phone version (optional)'}</button>
            ${hero.src !== DEFAULT_HERO.src ? '<button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-act="reset">Back to the current banner</button>' : ''}
        </div>
        <p class="admin-field-hint admin-hero-meta"></p>
        <span class="admin-field-label" style="display:block;margin:1rem 0 .35rem">Still image (shows while the video loads)</span>
        <div data-mount="poster"></div>
        <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden data-file="main">
        <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden data-file="mobile">
    `;
    const video = host.querySelector('video');
    video.src = siteSrc(hero.src);
    if (hero.poster) video.poster = siteSrc(hero.poster);
    host.querySelector('.admin-hero-meta').textContent = hero.mobile
        ? 'Phones get the lighter phone version; computers get the main video.'
        : 'Phones and computers both play this video.';

    host.querySelector('[data-mount="poster"]').appendChild(imageInput({
        value: hero.poster || '',
        onChange: v => { hero.poster = v; setDirty(true); if (v) video.poster = siteSrc(v); },
    }));

    const pick = (which) => host.querySelector(`[data-file="${which}"]`).click();
    host.querySelector('[data-act="upload"]').addEventListener('click', () => pick('main'));
    host.querySelector('[data-act="mobile"]').addEventListener('click', () => pick('mobile'));
    const reset = host.querySelector('[data-act="reset"]');
    if (reset) reset.addEventListener('click', () => {
        state.content.hero = { ...DEFAULT_HERO };
        setDirty(true);
        renderHomeHero();
    });

    host.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            input.value = '';
            if (!file) return;
            await uploadHeroVideo(file, input.dataset.file === 'mobile');
        });
    });
}

async function uploadHeroVideo(file, isMobile) {
    const hero = state.content.hero;
    const mb = file.size / (1024 * 1024);
    if (mb > 60) {
        const ok = await confirmDialog({
            title: 'This video is large',
            message: `It's ${Math.round(mb)} MB, so the homepage will be slow to start on phones. For a fast banner, export it at 1080p, about 20–30 MB, with no audio. Upload it anyway?`,
            okLabel: 'Upload anyway',
        });
        if (!ok) return;
    }
    try {
        let poster = '';
        if (!isMobile) { try { poster = await grabPoster(file, 1920, 0.82); } catch { /* keep the old still */ } }
        const url = await uploadToBlob(file, file.name, 'hero', pct => toast(`Uploading banner video… ${pct}%`));
        if (isMobile) {
            hero.mobile = url;
        } else {
            hero.src = url;
            hero.mobile = ''; // the old phone version would show the old video
            if (poster) hero.poster = poster;
        }
        setDirty(true);
        renderHomeHero();
        toast(isMobile ? 'Phone version added. Save draft, then Preview.' : 'Banner video uploaded. Save draft, then Preview.', 'success');
    } catch (err) {
        toast('Upload failed: ' + err.message, 'error');
    }
}

function renderHomeReel() {
    const host = $('#homeReel');
    if (!host) return;
    const projects = state.content.projects || {};
    const reel = state.content.reel = (state.content.reel || []).filter(id => projects[id]);
    host.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'admin-list-items admin-reel-list';
    host.appendChild(list);
    if (!reel.length) {
        list.innerHTML = '<div class="admin-hint" style="margin:0">No projects in the Reel. Add some below.</div>';
    }
    reel.forEach((id, idx) => {
        const p = projects[id];
        const row = document.createElement('div');
        row.className = 'admin-list-item admin-reel-item';
        row.dataset.idx = String(idx);
        row.innerHTML = `
            <span class="admin-list-grip" title="Drag to reorder" aria-hidden="true">⠿</span>
            <span class="admin-reel-num">${String(idx + 1).padStart(2, '0')}</span>
            <div class="admin-list-thumb" title="Drag to reorder">${p.thumb ? `<img src="${escapeAttr(siteSrc(p.thumb))}" alt="">` : IMG_ICON}</div>
            <div class="admin-list-item-info">
                <div class="admin-list-item-title">${escapeText(p.title || '(untitled)')}</div>
                <div class="admin-list-item-sub">${escapeText(p.client || '')}</div>
            </div>
            <div class="admin-list-item-actions">
                <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-action="remove" title="Take out of the Reel">✕</button>
            </div>`;
        row.querySelector('[data-action="remove"]').addEventListener('click', () => {
            reel.splice(idx, 1);
            setDirty(true);
            renderHomeReel();
        });
        list.appendChild(row);
    });
    enableGridReorder(list, reel, () => { setDirty(true); renderHomeReel(); }, {
        tileClass: 'admin-reel-item',
        handleSel: '.admin-list-grip, .admin-list-thumb',
        mouseHandleSel: '.admin-reel-item',
        ignoreSel: '[data-action]',
        axis: 'y',
    });

    const rest = Object.keys(projects).filter(id => !reel.includes(id));
    const add = document.createElement('div');
    add.className = 'admin-reel-add';
    add.innerHTML = `
        <select ${rest.length ? '' : 'disabled'}>
            <option value="">${rest.length ? '+ Add a project to the Reel…' : 'Every project is already in the Reel'}</option>
            ${rest.map(id => `<option value="${escapeAttr(id)}">${escapeText((projects[id].client ? projects[id].client + ' — ' : '') + (projects[id].title || id))}</option>`).join('')}
        </select>`;
    add.querySelector('select').addEventListener('change', (e) => {
        const id = e.target.value;
        if (!id) return;
        reel.push(id);
        setDirty(true);
        renderHomeReel();
    });
    host.appendChild(add);
    updateCounts();
}

function renderHomeClients() {
    const host = $('#homeClients');
    if (!host) return;
    const clients = state.content.clients || (state.content.clients = []);
    host.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'admin-client-list';
    host.appendChild(list);

    clients.forEach((c, idx) => {
        const row = document.createElement('div');
        row.className = 'admin-client-item';
        row.dataset.idx = String(idx);
        const scale = c.scale || 1;
        row.innerHTML = `
            <span class="admin-list-grip" title="Drag to reorder" aria-hidden="true">⠿</span>
            <button type="button" class="admin-client-logo ${c.invert ? 'is-invert' : ''}" data-action="logo" title="Click to replace the logo">
                ${c.src ? `<img src="${escapeAttr(siteSrc(c.src))}" alt="" style="transform:scale(${scale})">` : '<span>Add logo</span>'}
            </button>
            <input type="text" class="admin-client-name" value="${escapeAttr(c.name || '')}" placeholder="Brand name" aria-label="Brand name">
            <label class="admin-client-opt" title="Turns a dark logo white so it shows on the black strip">
                <input type="checkbox" data-opt="invert" ${c.invert ? 'checked' : ''}> Make white
            </label>
            <label class="admin-client-opt admin-client-size" title="Logo size">
                Size <input type="range" min="0.5" max="1.8" step="0.05" value="${scale}" data-opt="scale">
            </label>
            <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-action="delete" title="Remove logo">✕</button>
            <input type="file" accept="image/svg+xml,image/png,image/webp,image/jpeg" hidden>`;

        const nameI = row.querySelector('.admin-client-name');
        nameI.addEventListener('input', () => { c.name = nameI.value; setDirty(true); });
        row.querySelector('[data-opt="invert"]').addEventListener('change', (e) => {
            c.invert = e.target.checked;
            row.querySelector('.admin-client-logo').classList.toggle('is-invert', c.invert);
            setDirty(true);
        });
        row.querySelector('[data-opt="scale"]').addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            if (Math.abs(v - 1) < 0.001) delete c.scale; else c.scale = v;
            const img = row.querySelector('.admin-client-logo img');
            if (img) img.style.transform = `scale(${v})`;
            setDirty(true);
        });
        const file = row.querySelector('input[type="file"]');
        row.querySelector('[data-action="logo"]').addEventListener('click', () => file.click());
        file.addEventListener('change', async () => {
            const f = file.files && file.files[0];
            file.value = '';
            if (!f) return;
            try {
                toast('Uploading logo…');
                c.src = await imageFileToUrl(f);
                if (!c.name) c.name = f.name.replace(/\.[^.]+$/, '');
                setDirty(true);
                renderHomeClients();
                toast('Logo updated', 'success');
            } catch (err) {
                toast('Could not add logo: ' + err.message, 'error');
            }
        });
        row.querySelector('[data-action="delete"]').addEventListener('click', () => {
            clients.splice(idx, 1);
            setDirty(true);
            renderHomeClients();
        });
        list.appendChild(row);
    });

    enableGridReorder(list, clients, () => { setDirty(true); renderHomeClients(); }, {
        tileClass: 'admin-client-item',
        handleSel: '.admin-list-grip',
        mouseHandleSel: '.admin-list-grip',
        axis: 'y',
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'admin-btn admin-btn--secondary admin-btn--small';
    addBtn.textContent = '+ Add logo';
    addBtn.style.marginTop = '.8rem';
    addBtn.addEventListener('click', () => {
        clients.push({ name: '', src: '', invert: true });
        setDirty(true);
        renderHomeClients();
        const rows = list.querySelectorAll('.admin-client-item');
        const last = rows[rows.length - 1];
        if (last) last.querySelector('[data-action="logo"]').click();
    });
    host.appendChild(addBtn);
    updateCounts();
}

/* ────────────── Project categories ────────────── */
// The filter pills on All Work come from these. Stored on the project as
// "Commercial / Product" (the format the site already reads).
const PROJECT_CATEGORIES = ['Commercial', 'Product', 'Sport', 'Automotive', 'Documentary', 'Adventure', 'Social', 'Corporate'];

function parseTypeList(type) {
    return String(type || '').split(/[\/,·|]+/).map(t => t.trim()).filter(Boolean);
}

function buildCategoryPicker(project, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'admin-cat-picker';
    const render = () => {
        const chosen = parseTypeList(project.type);
        const lower = chosen.map(c => c.toLowerCase());
        // Keep any older free-text labels (e.g. "Brand Film") visible so nothing is lost.
        const extras = chosen.filter(c => !PROJECT_CATEGORIES.some(k => k.toLowerCase() === c.toLowerCase()));
        wrap.innerHTML = '';
        [...PROJECT_CATEGORIES, ...extras].forEach(cat => {
            const on = lower.includes(cat.toLowerCase());
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'admin-cat-chip' + (on ? ' is-on' : '');
            b.textContent = cat;
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            b.addEventListener('click', () => {
                let next = parseTypeList(project.type);
                if (on) next = next.filter(c => c.toLowerCase() !== cat.toLowerCase());
                else next.push(cat);
                project.type = next.join(' / ');
                onChange();
                render();
            });
            wrap.appendChild(b);
        });
    };
    render();
    return wrap;
}
