/* ============================================
   Ridgeline Admin Dashboard
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
            const r = await fetch('/api/me', { credentials: 'include' });
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
            r = await fetch('/api/content?draft=1', { credentials: 'include' });
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
};

/* ────────────── Utilities ────────────── */

function toast(message, type = '') {
    const el = $('#toast');
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
    if (isDirty) {
        el.textContent = '● Unsaved changes';
        el.classList.add('is-dirty');
    } else {
        el.textContent = 'No unsaved changes';
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

/* ────────────── Tabs ────────────── */

function initTabs() {
    $$('.admin-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.admin-tab').forEach(t => t.classList.remove('is-active'));
            btn.classList.add('is-active');
            const tab = btn.dataset.tab;
            $$('.admin-panel').forEach(p => p.classList.toggle('is-active', p.dataset.panel === tab));
        });
    });
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
}

async function bootstrap() {
    // Render the login first so the page never looks blank, then probe the session.
    await showLogin();

    // file:// (or any non-http context) — no API available, just leave login visible.
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

function initLogin() {
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

/* ────────────── Render: Creatives ────────────── */

function renderCreatives() {
    $('#creativesList').value = (state.content.creatives || []).join('\n');
}
function bindCreatives() {
    $('#creativesList').addEventListener('input', e => {
        state.content.creatives = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
        setDirty(true);
    });
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
                <span class="admin-service-num">${svc.number || ''}</span>
                <h3 style="margin:0">${svc.name}</h3>
            </div>
            <label class="admin-field">
                <span class="admin-field-label">Display name</span>
                <input type="text" data-field="name" value="${escapeAttr(svc.name)}">
            </label>
            <label class="admin-field">
                <span class="admin-field-label">Description</span>
                <textarea data-field="description" rows="5">${escapeText(svc.description)}</textarea>
            </label>
            <label class="admin-field">
                <span class="admin-field-label">Tag chips (comma separated)</span>
                <input type="text" data-field="tags" value="${escapeAttr((svc.tags || []).join(', '))}">
            </label>
        `;
        block.querySelectorAll('[data-field]').forEach(input => {
            input.addEventListener('input', () => {
                const field = input.dataset.field;
                if (field === 'tags') {
                    state.content.services[idx].tags = input.value.split(',').map(s => s.trim()).filter(Boolean);
                } else {
                    state.content.services[idx][field] = input.value;
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
        item.innerHTML = `
            <div class="admin-list-item-info">
                <div class="admin-list-item-title">${escapeText(p.title || '(untitled)')}</div>
                <div class="admin-list-item-sub">${escapeText(p.client || '')} · ${escapeText(p.year || '')}</div>
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
        });
        list.appendChild(item);
    });
}

function renderProjectEditor() {
    const root = $('#projectEditor');
    const id = state.selectedProject;
    if (!id || !state.content.projects[id]) {
        root.innerHTML = '<div class="admin-empty">Select a project to edit, or click <strong>Add project</strong>.</div>';
        return;
    }
    const p = state.content.projects[id];
    root.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h3 style="margin:0">Editing: <span style="color:var(--fg-2)">${escapeText(p.title || '(untitled)')}</span></h3>
            <code style="color:var(--fg-3);font-size:0.8rem">id: ${escapeText(id)}</code>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
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
            <label class="admin-field">
                <span class="admin-field-label">Vimeo video ID</span>
                <input type="text" data-field="vimeo" value="${escapeAttr(p.vimeo)}" placeholder="1234567890">
            </label>
            <label class="admin-field">
                <span class="admin-field-label">Vimeo private hash (optional)</span>
                <input type="text" data-field="vimeoHash" value="${escapeAttr(p.vimeoHash || '')}" placeholder="abc123">
            </label>
        </div>

        <label class="admin-field">
            <span class="admin-field-label">Thumbnail image URL</span>
            <input type="url" data-field="thumb" value="${escapeAttr(p.thumb)}">
        </label>

        <label class="admin-field">
            <span class="admin-field-label">Description (shown under the hero video on the project page)</span>
            <textarea data-field="description" rows="4">${escapeText(p.description)}</textarea>
        </label>

        <h3>Credits</h3>
        <div data-repeater="credits"></div>
        <button type="button" class="admin-btn admin-btn--secondary admin-btn--small admin-repeater-add" data-add="credits">+ Add credit</button>

        <h3>Stills gallery</h3>
        <div data-repeater="gallery"></div>
        <button type="button" class="admin-btn admin-btn--secondary admin-btn--small admin-repeater-add" data-add="gallery">+ Add image</button>

        <h3>Behind the scenes</h3>
        <div data-repeater="bts"></div>
        <button type="button" class="admin-btn admin-btn--secondary admin-btn--small admin-repeater-add" data-add="bts">+ Add BTS image</button>
    `;

    // Bind primary fields
    root.querySelectorAll('[data-field]').forEach(input => {
        input.addEventListener('input', () => {
            state.content.projects[id][input.dataset.field] = input.value;
            setDirty(true);
            // Live-update list label if title/client changed
            if (input.dataset.field === 'title' || input.dataset.field === 'client' || input.dataset.field === 'year') {
                renderProjectList();
            }
        });
    });

    // Repeaters
    renderRepeater(root, id, 'credits');
    renderRepeater(root, id, 'gallery');
    renderRepeater(root, id, 'bts');

    root.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.add;
            const project = state.content.projects[id];
            if (!Array.isArray(project[field])) project[field] = [];
            if (field === 'credits') project[field].push({ role: '', name: '' });
            else if (field === 'bts') project[field].push({ label: '', img: '' });
            else project[field].push('');
            setDirty(true);
            renderRepeater(root, id, field);
        });
    });
}

function renderRepeater(root, projectId, field) {
    const host = root.querySelector(`[data-repeater="${field}"]`);
    if (!host) return;
    host.innerHTML = '';
    const project = state.content.projects[projectId];
    const items = project[field] || [];

    items.forEach((item, idx) => {
        const row = document.createElement('div');
        const isCredit = field === 'credits';
        const isBts = field === 'bts';

        if (isCredit) {
            row.className = 'admin-repeater-item';
            row.innerHTML = `
                <input type="text" placeholder="Role (e.g. Director)" value="${escapeAttr(item.role || '')}" data-key="role">
                <input type="text" placeholder="Name" value="${escapeAttr(item.name || '')}" data-key="name">
                <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-del="${idx}">✕</button>
            `;
        } else if (isBts) {
            row.className = 'admin-repeater-item';
            row.innerHTML = `
                <input type="text" placeholder="Caption" value="${escapeAttr(item.label || '')}" data-key="label">
                <input type="url" placeholder="Image URL" value="${escapeAttr(item.img || '')}" data-key="img">
                <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-del="${idx}">✕</button>
            `;
        } else {
            row.className = 'admin-repeater-item admin-repeater-item--single';
            row.innerHTML = `
                <input type="url" placeholder="Image URL" value="${escapeAttr(item || '')}" data-key="value">
                <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-del="${idx}">✕</button>
            `;
        }

        row.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                const key = input.dataset.key;
                if (key === 'value') {
                    state.content.projects[projectId][field][idx] = input.value;
                } else {
                    state.content.projects[projectId][field][idx][key] = input.value;
                }
                setDirty(true);
            });
        });

        row.querySelector('[data-del]').addEventListener('click', () => {
            state.content.projects[projectId][field].splice(idx, 1);
            setDirty(true);
            renderRepeater(root, projectId, field);
        });

        host.appendChild(row);
    });

    if (items.length === 0) {
        host.innerHTML = `<div class="admin-hint">No ${field} yet.</div>`;
    }
}

async function addProject() {
    const titleInput = prompt('Project title?');
    if (!titleInput) return;
    const clientInput = prompt('Client name?') || '';
    const baseSlug = slugify(`${clientInput}-${titleInput}`) || slugify(titleInput) || 'project';
    const id = uniqueProjectId(baseSlug);
    state.content.projects[id] = {
        client: clientInput,
        title: titleInput,
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
    toast('Project added (unsaved)', 'success');
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
    renderCreatives();
    renderServices();
    renderProjectList();
    renderProjectEditor();
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

    // Ensure we have a draft saved server-side first
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
    $('#logoutBtn').addEventListener('click', async () => {
        await api.logout();
        location.reload();
    });

    // Warn on unload if dirty
    window.addEventListener('beforeunload', e => {
        if (state.dirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// Defensive init: make the login render first, then attempt to bind handlers and
// run bootstrap. Any error in init shouldn't leave the page completely blank.
(async function init() {
    try {
        // Always show the login overlay first — at minimum the user sees the password screen.
        const loginEl = document.getElementById('adminLogin');
        if (loginEl) loginEl.hidden = false;
    } catch (e) { /* DOM not ready (shouldn't happen — script is at end of body) */ }

    try { initTabs(); } catch (e) { console.error('[admin] initTabs failed', e); }
    try { initLogin(); } catch (e) { console.error('[admin] initLogin failed', e); }
    try { initShellButtons(); } catch (e) { console.error('[admin] initShellButtons failed', e); }
    try { bindAbout(); } catch (e) { console.error('[admin] bindAbout failed', e); }
    try { bindCreatives(); } catch (e) { console.error('[admin] bindCreatives failed', e); }
    try { await bootstrap(); } catch (e) {
        console.error('[admin] bootstrap failed', e);
        // Surface the error on the login screen so the user knows something went wrong.
        const errEl = document.getElementById('loginError');
        if (errEl) {
            errEl.textContent = 'Init error: ' + (e?.message || e);
            errEl.hidden = false;
        }
    }
})();
