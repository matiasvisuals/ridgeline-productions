/* ============================================
   WORK PAGE
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {

    // Pull the latest content first so admin thumbnail/title edits show up here
    // (the grid is otherwise hardcoded), and so any project added in the
    // dashboard but not yet in the static markup still appears.
    await hydrateWorkGrid();

    // Entrance delay if arriving from transition
    const transitionDelay = sessionStorage.getItem('pt-active') ? 600 : 100;
    setTimeout(() => document.body.classList.add('loaded'), transitionDelay);

    // Header scroll
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });

    // Mobile menu
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    menuBtn.addEventListener('click', () => {
        menuBtn.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        menuBtn.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    }));

    // ─── Category Filtering ───
    const pills = document.querySelectorAll('.filter-pill');
    const cards = document.querySelectorAll('.work-card');
    const countEl = document.getElementById('workCount');
    let currentFilter = 'all';

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            const filter = pill.dataset.filter;
            if (filter === currentFilter) return;
            currentFilter = filter;

            // Update active pill
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            // Filter cards
            let visibleCount = 0;
            cards.forEach(card => {
                const categories = (card.dataset.category || '').split(' ');
                const matches = filter === 'all' || categories.includes(filter);

                if (matches) {
                    card.classList.remove('filtered-out');
                    visibleCount++;
                    // Stagger the reveal
                    setTimeout(() => {
                        card.classList.add('visible');
                    }, visibleCount * 60);
                } else {
                    card.classList.add('filtered-out');
                    card.classList.remove('visible');
                }
            });

            // Update count
            if (countEl) countEl.textContent = visibleCount;
        });
    });

    // ─── Staggered card reveal on scroll ───
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('filtered-out')) {
                const visibleCards = [...document.querySelectorAll('.work-card:not(.filtered-out)')];
                const idx = visibleCards.indexOf(entry.target);
                entry.target.style.transitionDelay = `${(idx % 2) * 0.1}s`;
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
    cards.forEach(card => observer.observe(card));
});

// Sync the work grid with the live content (data/content.json via data-loader.js).
async function hydrateWorkGrid() {
    if (window.contentReady) {
        try { await window.contentReady; } catch (e) { /* fall back to static markup */ }
    }
    const projects = window.projects || {};
    const grid = document.getElementById('workGrid');
    if (!grid) return;

    const idOf = (card) => {
        try { return new URL(card.href, location.href).searchParams.get('id'); }
        catch { return null; }
    };

    // Refresh thumbnail + labels on cards that already exist in the markup.
    grid.querySelectorAll('.work-card').forEach(card => {
        const p = projects[idOf(card)];
        if (!p) return;
        const img = card.querySelector('.work-card-img img');
        if (img && p.thumb) {
            img.src = p.thumb;
            img.alt = `${p.client || ''} ${p.title || ''}`.trim();
        }
    });

    // Append any project from content that isn't already on the page.
    const have = new Set([...grid.querySelectorAll('.work-card')].map(idOf));
    Object.keys(projects).forEach(id => {
        if (have.has(id)) return;
        grid.appendChild(buildWorkCard(id, projects[id]));
    });

    const countEl = document.getElementById('workCount');
    if (countEl) countEl.textContent = grid.querySelectorAll('.work-card').length;
}

function buildWorkCard(id, p) {
    const a = document.createElement('a');
    a.href = `project.html?id=${id}`;
    a.className = 'work-card';
    a.setAttribute('data-category', '');

    const imgWrap = document.createElement('div');
    imgWrap.className = 'work-card-img';
    const img = document.createElement('img');
    img.src = p.thumb || '';
    img.alt = `${p.client || ''} ${p.title || ''}`.trim();
    img.loading = 'lazy';
    imgWrap.appendChild(img);

    const info = document.createElement('div');
    info.className = 'work-card-info';
    const client = document.createElement('span');
    client.className = 'work-card-client';
    client.textContent = p.client || '';
    const title = document.createElement('h3');
    title.className = 'work-card-title';
    title.textContent = p.title || '';
    const type = document.createElement('span');
    type.className = 'work-card-type';
    type.textContent = p.type || '';
    info.append(client, title, type);

    a.append(imgWrap, info);
    return a;
}
