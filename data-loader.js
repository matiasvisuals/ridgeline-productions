/* ============================================
   Ridgeline Content Loader
   Fetches data/content.json (or draft via /api/content) and hydrates the DOM
   before the rest of the site scripts run. Other scripts can `await window.contentReady`.
   ============================================ */

(function () {
    const isDraft = /[?&]draft=1\b/.test(location.search);
    const endpoint = isDraft ? '/api/content?draft=1' : '/data/content.json';

    let resolveReady;
    window.contentReady = new Promise(r => { resolveReady = r; });
    window.SITE_CONTENT = null;
    window.projects = window.projects || {};

    function safeText(el, text) {
        if (!el || text == null) return;
        if (el.textContent !== text) el.textContent = text;
    }

    function hydrateAbout(about) {
        if (!about) return;

        // Headline lines (vertical stack — three .reveal-line-inner spans inside .about-headline)
        const headline = document.querySelector('.about-headline');
        if (headline && Array.isArray(about.headlineLines)) {
            const spans = headline.querySelectorAll('.reveal-line-inner');
            about.headlineLines.forEach((line, i) => {
                if (spans[i]) safeText(spans[i], line);
            });
            // If JSON has fewer/more lines than spans, we leave the extra DOM alone for now.
        }

        // Paragraphs (two regular paragraphs)
        const paragraphs = Array.isArray(about.paragraphs) ? about.paragraphs : [];
        const aboutRight = document.querySelector('.about-right');
        if (aboutRight) {
            const ps = aboutRight.querySelectorAll('.about-text:not(.about-text--em)');
            paragraphs.forEach((text, i) => {
                if (ps[i]) safeText(ps[i], text);
            });
            const em = aboutRight.querySelector('.about-text--em');
            if (em && about.emphasis) safeText(em, about.emphasis);
        }

        // Stats — update data-count + label text
        if (Array.isArray(about.stats)) {
            const statBlocks = document.querySelectorAll('.about-stats .stat');
            about.stats.forEach((stat, i) => {
                const block = statBlocks[i];
                if (!block) return;
                const num = block.querySelector('.stat-num');
                const label = block.querySelector('.stat-label');
                if (num) {
                    num.setAttribute('data-count', String(stat.count));
                    num.textContent = '0'; // script.js animates this from 0 to data-count
                }
                if (label) safeText(label, stat.label);
            });
        }

        // Philosophy text (must run before script.js splits it into word spans)
        const phil = document.getElementById('philosophyText');
        if (phil && about.philosophy) safeText(phil, about.philosophy);
    }

    function hydrateCreatives(names) {
        if (!Array.isArray(names)) return;
        const list = document.querySelector('.creatives-list');
        if (!list) return;
        list.innerHTML = '';
        names.forEach(name => {
            const li = document.createElement('li');
            li.textContent = name;
            list.appendChild(li);
        });
    }

    function hydrateServices(services) {
        if (!Array.isArray(services)) return;
        const items = document.querySelectorAll('.services-list .service-item');
        services.forEach((svc, i) => {
            const item = items[i];
            if (!item) return;
            const num = item.querySelector('.service-num');
            const name = item.querySelector('.service-name');
            const desc = item.querySelector('.service-desc');
            const tagsHost = item.querySelector('.service-tags');
            if (num && svc.number) safeText(num, svc.number);
            if (name && svc.name) safeText(name, svc.name);
            if (desc && svc.description) safeText(desc, svc.description);
            if (tagsHost && Array.isArray(svc.tags)) {
                tagsHost.innerHTML = '';
                svc.tags.forEach(t => {
                    const span = document.createElement('span');
                    span.textContent = t;
                    tagsHost.appendChild(span);
                });
            }
        });
    }

    function hydrate(content) {
        if (!content) return;
        window.SITE_CONTENT = content;
        if (content.projects) window.projects = content.projects;
        hydrateAbout(content.about);
        hydrateCreatives(content.creatives);
        hydrateServices(content.services);
    }

    async function load() {
        try {
            const res = await fetch(endpoint, { credentials: 'include' });
            if (!res.ok) throw new Error('content_fetch_failed');
            const payload = await res.json();
            const content = payload.content || payload;
            hydrate(content);
            if (isDraft && payload.source === 'draft') {
                showDraftBadge();
            }
            resolveReady(content);
        } catch (err) {
            console.warn('[content-loader] falling back to static HTML:', err.message || err);
            resolveReady(null);
        }
    }

    function showDraftBadge() {
        if (document.getElementById('draftBadge')) return;
        const badge = document.createElement('div');
        badge.id = 'draftBadge';
        badge.textContent = 'DRAFT PREVIEW';
        Object.assign(badge.style, {
            position: 'fixed', bottom: '12px', left: '12px', zIndex: 9999,
            background: '#c8baa2', color: '#1a1a1a',
            padding: '4px 10px', borderRadius: '4px',
            fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '11px',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
        });
        document.body.appendChild(badge);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load, { once: true });
    } else {
        load();
    }
})();
