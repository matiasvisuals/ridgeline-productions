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
            toast('Processing image…');
            const dataUrl = await fileToDataURL(file);
            commit(dataUrl);
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

async function bootstrap() {
    await showLogin();

    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
        $('#loginError').textContent = 'Open this page on the deployed site — local file mode is preview-only.';
        $('#loginError').hidden = false;
        $('#loginBtn').disabled = true;
        return;
    }

    const me = await api.me();
    if (me.authenticated) {
        await loadAndRender();
        await showShell();
    }
}

async function loadAndRender() {
    try {
        const data = await api.loadContent();
        state.content = JSON.parse(JSON.stringify(data.content));
        state.original = JSON.parse(JSON.stringify(data.content));
        renderAll();
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
    const list = $('#projectList');
    list.innerHTML = '';
    const ids = Object.keys(state.content.projects);
    if (ids.length === 0) {
        list.innerHTML = '<div class="admin-empty" style="border:none;padding:1.5rem 1rem">No projects yet.</div>';
        return;
    }
    ids.forEach(id => {
        const p = state.content.projects[id];
        const item = document.createElement('div');
        item.className = 'admin-list-item' + (id === state.selectedProject ? ' is-selected' : '');
        const thumb = p.thumb
            ? `<img src="${escapeAttr(p.thumb)}" alt="">`
            : IMG_ICON;
        item.innerHTML = `
            <div class="admin-list-thumb">${thumb}</div>
            <div class="admin-list-item-info">
                <div class="admin-list-item-title">${escapeText(p.title || '(untitled)')}</div>
                <div class="admin-list-item-sub">${escapeText(p.client || '')}${p.year ? ' · ' + escapeText(p.year) : ''}</div>
            </div>
            <div class="admin-list-item-actions">
                <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-action="delete" title="Delete project">✕</button>
            </div>
        `;
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
            <span class="admin-id-chip">id: ${escapeText(id)}</span>
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
                    <label class="admin-field">
                        <span class="admin-field-label">Type / category</span>
                        <input type="text" data-field="type" value="${escapeAttr(p.type)}" placeholder="Commercial / Product">
                    </label>
                    <label class="admin-field">
                        <span class="admin-field-label">Year</span>
                        <input type="text" data-field="year" value="${escapeAttr(p.year)}">
                    </label>
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
                <div class="admin-card-head-l"><h3>Behind the scenes <span class="sub" data-media-count="bts"></span></h3></div>
            </div>
            <div class="admin-card-body"><div data-media="bts"></div></div>
        </div>

        <div class="admin-card admin-card-accent">
            <div class="admin-card-head">
                <div class="admin-card-head-l"><h3>Behind the scenes — film <span class="sub" data-media-count="videos"></span></h3></div>
            </div>
            <div class="admin-card-body"><div data-media="videos"></div></div>
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
    renderMediaManager(root, id, 'bts');
    renderMediaManager(root, id, 'videos');

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
    label.textContent = `Hero ${idx + 1} · ${v.type === 'file' ? 'Upload' : 'Vimeo'}`;
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
            const roleI = textField('ROLE', item.role, v => { items[idx].role = v; setDirty(true); });
            roleI.className = 'credit-role';
            const nameI = textField('Full name', item.name, v => { items[idx].name = v; setDirty(true); });
            nameI.className = 'credit-name';
            row.append(roleI, nameI, deleteButton(() => { items.splice(idx, 1); setDirty(true); renderRepeater(root, projectId, field); }));
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
            toast(`Processing ${files.length} image${files.length > 1 ? 's' : ''}…`);
            let added = 0;
            for (const f of files) {
                try {
                    const dataUrl = await fileToDataURL(f);
                    if (type === 'gallery') items.push(dataUrl);
                    else items.push({ label: '', img: dataUrl });
                    added++;
                } catch { /* skip bad file */ }
            }
            setDirty(true);
            renderMediaManager(root, projectId, type);
            toast(`Added ${added} image${added !== 1 ? 's' : ''}`, 'success');
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
    // Only the thumbnail is the drag handle, so caption text stays editable.
    thumb.addEventListener('mousedown', () => { tile.draggable = true; });

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

    tile.addEventListener('dragstart', e => {
        tile.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
    });
    tile.addEventListener('dragend', () => {
        tile.draggable = false;
        tile.classList.remove('is-dragging');
        root.querySelectorAll('.admin-media-tile').forEach(t => t.classList.remove('is-dragover'));
    });
    tile.addEventListener('dragover', e => { e.preventDefault(); tile.classList.add('is-dragover'); });
    tile.addEventListener('dragleave', () => tile.classList.remove('is-dragover'));
    tile.addEventListener('drop', e => {
        e.preventDefault();
        tile.classList.remove('is-dragover');
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const to = idx;
        if (Number.isNaN(from) || from === to) return;
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        setDirty(true);
        renderMediaManager(root, projectId, type);
    });

    return tile;
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
        await api.saveDraft(state.content);
        state.original = JSON.parse(JSON.stringify(state.content));
        setDirty(false);
        toast('Draft saved. Preview at /?draft=1', 'success');
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
