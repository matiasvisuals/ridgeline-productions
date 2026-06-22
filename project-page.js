/* ============================================
   PROJECT PAGE
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {

    // Wait for data-loader (if present) to finish so window.projects reflects the latest content.
    if (window.contentReady) {
        try { await window.contentReady; } catch (e) { /* fall back to legacy data */ }
    }
    // Re-read projects from window so we pick up dashboard updates / draft preview.
    const projects = window.projects || {};
    const projectKeys = Object.keys(projects);

    // Get project ID from URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const p = projects[id];

    if (!p) {
        window.location.href = 'index.html';
        return;
    }

    const idx = projectKeys.indexOf(id);

    // Set page title
    document.title = `${p.client} — ${p.title} | Ridgeline Productions`;

    // Populate hero
    const heroImg = document.getElementById('projHeroImg');
    heroImg.src = p.thumb;
    heroImg.alt = `${p.client} ${p.title}`;
    document.getElementById('projClient').textContent = p.client;
    document.getElementById('projTitleText').textContent = p.title;
    document.getElementById('projType').textContent = p.type;

    // Ken Burns on hero — delay to start after entrance animation
    setTimeout(() => document.getElementById('projHero').classList.add('loaded'), 1800);

    const PLAY_SVG = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="23" stroke="white" stroke-width="1.5"/>
        <path d="M20 16L32 24L20 32V16Z" fill="white"/>
    </svg>`;

    // ─── Hero video(s) — swipeable carousel ───
    // Supports a mix of Vimeo links and self-hosted files via p.heroVideos.
    // Falls back to the legacy single p.vimeo field so older content still works.
    function getHeroVideos(proj) {
        let list = Array.isArray(proj.heroVideos) ? proj.heroVideos.slice() : [];
        list = list.filter(v => v && ((v.type === 'file' && v.src) || (v.type !== 'file' && v.vimeo)));
        if (!list.length && proj.vimeo) {
            list = [{ type: 'vimeo', vimeo: proj.vimeo, vimeoHash: proj.vimeoHash || '', poster: proj.thumb }];
        }
        return list;
    }

    const heroVideos = getHeroVideos(p);
    const videoSection = document.getElementById('projVideo');
    const carousel = document.getElementById('projHeroCarousel');
    const carTrack = document.getElementById('projHeroCarouselTrack');
    const carDots = document.getElementById('projHeroDots');
    const carPrev = document.getElementById('projHeroPrev');
    const carNext = document.getElementById('projHeroNext');

    if (heroVideos.length && carTrack) {
        carTrack.innerHTML = heroVideos.map((v, i) => {
            const poster = v.poster || p.thumb || '';
            return `<div class="proj-hero-slide">
                <div class="proj-video-player" data-vid="${i}">
                    <img class="proj-video-thumb" src="${poster}" alt="" loading="${i ? 'lazy' : 'eager'}">
                    <div class="proj-video-play">${PLAY_SVG}</div>
                </div>
            </div>`;
        }).join('');

        carTrack.querySelectorAll('.proj-video-player').forEach(player => {
            player.addEventListener('click', () => {
                if (player.classList.contains('is-playing')) return;
                const v = heroVideos[+player.dataset.vid];
                player.classList.add('is-playing');
                if (v.type === 'file') {
                    player.innerHTML = `<video class="proj-video-el" src="${v.src}" controls autoplay playsinline ${v.poster ? `poster="${v.poster}"` : ''}></video>`;
                } else {
                    const hParam = v.vimeoHash ? `&h=${v.vimeoHash}` : '';
                    player.innerHTML = `<iframe src="https://player.vimeo.com/video/${v.vimeo}?autoplay=1&title=0&byline=0&portrait=0${hParam}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
                }
            });
        });

        if (heroVideos.length > 1) {
            carDots.innerHTML = heroVideos.map((_, i) => `<button class="proj-dot${i === 0 ? ' active' : ''}" aria-label="Video ${i + 1}"></button>`).join('');
            const dots = [...carDots.children];
            let current = 0;
            const sync = () => {
                dots.forEach((d, i) => d.classList.toggle('active', i === current));
                carPrev.disabled = current === 0;
                carNext.disabled = current === heroVideos.length - 1;
            };
            const goTo = (i) => {
                current = Math.max(0, Math.min(heroVideos.length - 1, i));
                const slide = carTrack.children[current];
                if (slide) carTrack.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
                sync();
            };
            carPrev.addEventListener('click', () => goTo(current - 1));
            carNext.addEventListener('click', () => goTo(current + 1));
            dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
            let scrollTimer;
            carTrack.addEventListener('scroll', () => {
                clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => {
                    current = Math.round(carTrack.scrollLeft / carTrack.clientWidth);
                    sync();
                }, 90);
            }, { passive: true });
            sync();
        } else {
            carousel.classList.add('is-single');
        }
    } else if (videoSection) {
        videoSection.style.display = 'none';
    }

    // Populate info
    document.getElementById('projDesc').textContent = p.description;
    document.getElementById('projYear').textContent = p.year;
    document.getElementById('projCategory').textContent = p.type;

    // Credits
    const creditsEl = document.getElementById('projCredits');
    creditsEl.innerHTML = p.credits.map(c =>
        `<div class="proj-credit anim" data-anim="fade-up">
            <span class="proj-credit-role">${c.role}</span>
            <span class="proj-credit-name">${c.name}</span>
        </div>`
    ).join('');

    // Show only a preview of big media sets; reveal the rest on "View all".
    function applyViewAll(gridEl, moreWrap, total, limit, noun) {
        if (!moreWrap) return;
        moreWrap.innerHTML = '';
        if (total <= limit) return;
        const items = [...gridEl.children];
        items.forEach((el, i) => { if (i >= limit) el.classList.add('proj-media-collapsed'); });
        const btn = document.createElement('button');
        btn.className = 'proj-view-all';
        btn.textContent = `View all ${total} ${noun}`;
        btn.addEventListener('click', () => {
            items.forEach(el => { el.classList.remove('proj-media-collapsed'); el.classList.add('visible'); });
            moreWrap.innerHTML = '';
        });
        moreWrap.appendChild(btn);
    }

    const PREVIEW = 9; // full 3×3 grid — avoids an empty bottom-right tile before "View all"

    // Gallery
    const galleryEl = document.getElementById('projGallery');
    const gallerySection = document.getElementById('projGallerySection');
    if (p.gallery && p.gallery.length) {
        galleryEl.innerHTML = p.gallery.map((img, i) =>
            `<div class="proj-gallery-item anim" data-anim="fade-up" data-lb-idx="${i}" data-lb-group="gallery">
                <img src="${img}" alt="Still ${i + 1}" loading="lazy">
            </div>`
        ).join('');
        applyViewAll(galleryEl, document.getElementById('projGalleryMore'), p.gallery.length, PREVIEW, 'photos');
    } else {
        gallerySection.style.display = 'none';
    }

    // ─── BTS — photos + film combined into one grid ───
    const btsGrid = document.getElementById('projBtsGrid');
    const btsSection = document.getElementById('projBtsSection');
    const btsPhotos = (p.bts || []).map(b => ({ kind: 'image', src: b.img, label: b.label || '' }));
    const btsClips = (p.videos || []).map(v => ({ kind: 'video', src: v.src, poster: v.poster || '', label: v.label || '', w: v.w, h: v.h }));
    const btsItems = [...btsPhotos, ...btsClips];

    if (btsItems.length) {
        btsGrid.innerHTML = btsItems.map((m, i) => {
            // Reserve the clip's real aspect ratio so masonry doesn't reflow when it loads.
            const ar = (m.w && m.h) ? ` style="aspect-ratio:${m.w} / ${m.h}"` : '';
            const thumb = m.kind === 'video'
                ? (m.poster
                    ? `<img src="${m.poster}" alt="${m.label}" loading="lazy"${ar}>`
                    : `<video src="${m.src}#t=0.1" muted playsinline preload="metadata"${ar}></video>`)
                : `<img src="${m.src}" alt="${m.label}" loading="lazy">`;
            const playBadge = m.kind === 'video'
                ? `<span class="proj-bts-play">${PLAY_SVG}</span>`
                : '';
            const label = m.label ? `<span class="proj-bts-label">${m.label}</span>` : '';
            return `<div class="proj-bts-item anim" data-anim="fade-up" data-lb-idx="${i}">
                ${thumb}${playBadge}${label}
            </div>`;
        }).join('');
        applyViewAll(btsGrid, document.getElementById('projBtsMore'), btsItems.length, PREVIEW, 'items');
    } else {
        btsSection.style.display = 'none';
    }

    // Prev / Next
    const prevIdx = (idx - 1 + projectKeys.length) % projectKeys.length;
    const nextIdx = (idx + 1) % projectKeys.length;
    const prev = projects[projectKeys[prevIdx]];
    const next = projects[projectKeys[nextIdx]];

    document.getElementById('projPrevName').textContent = `${prev.client} — ${prev.title}`;
    document.getElementById('projPrev').href = `project.html?id=${projectKeys[prevIdx]}`;
    document.getElementById('projNextName').textContent = `${next.client} — ${next.title}`;
    document.getElementById('projNext').href = `project.html?id=${projectKeys[nextIdx]}`;

    // --- Animations ---
    // Delay entrance if arriving via page transition
    const transitionDelay = sessionStorage.getItem('pt-active') ? 600 : 100;
    setTimeout(() => document.body.classList.add('loaded'), transitionDelay);

    // Header scroll
    const header = document.getElementById('header');
    const heroMedia = document.querySelector('.proj-hero-media');
    const heroContent = document.querySelector('.proj-hero-content');
    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        header.classList.toggle('scrolled', y > 60);
        if (y < window.innerHeight && heroMedia) {
            heroMedia.style.transform = `translateY(${y * 0.2}px)`;
            heroContent.style.opacity = 1 - y / (window.innerHeight * 0.6);
        }
    }, { passive: true });

    // Scroll reveal
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const siblings = [...entry.target.parentElement.querySelectorAll('.anim')];
                const i = siblings.indexOf(entry.target);
                entry.target.style.transitionDelay = `${i * 0.06}s`;
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.anim').forEach(el => observer.observe(el));

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

    // --- Lightbox (images + videos, full aspect ratio, swipeable) ---
    const lightbox = document.getElementById('lightbox');
    const lbContent = document.getElementById('lightboxContent');
    const lbCaption = document.getElementById('lightboxCaption');
    const lbPrevBtn = document.getElementById('lbPrev');
    const lbNextBtn = document.getElementById('lbNext');
    let lbItems = [];
    let lbIdx = 0;

    // Accepts an array of media objects: { kind:'image'|'video', src, poster?, label? }
    function openLightbox(items, startIdx) {
        lbItems = items;
        lbIdx = startIdx;
        showLb();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function showLb() {
        const m = lbItems[lbIdx];
        if (m.kind === 'video') {
            lbContent.innerHTML = `<video class="lightbox-video" src="${m.src}" controls autoplay playsinline ${m.poster ? `poster="${m.poster}"` : ''}></video>`;
        } else {
            lbContent.innerHTML = `<img src="${m.src}" alt="">`;
        }
        lbCaption.textContent = m.label || `${lbIdx + 1} / ${lbItems.length}`;
        const multi = lbItems.length > 1;
        lbPrevBtn.style.display = multi ? '' : 'none';
        lbNextBtn.style.display = multi ? '' : 'none';
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        lbContent.innerHTML = ''; // stop any playing video
        document.body.style.overflow = '';
    }

    function lbStep(dir) {
        lbIdx = (lbIdx + dir + lbItems.length) % lbItems.length;
        showLb();
    }

    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
    lbPrevBtn.addEventListener('click', e => { e.stopPropagation(); lbStep(-1); });
    lbNextBtn.addEventListener('click', e => { e.stopPropagation(); lbStep(1); });

    document.addEventListener('keydown', e => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') lbStep(-1);
        if (e.key === 'ArrowRight') lbStep(1);
    });

    // Swipe to navigate on touch
    let touchX = null;
    lbContent.addEventListener('touchstart', e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
    lbContent.addEventListener('touchend', e => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
        touchX = null;
    }, { passive: true });

    // Gallery lightbox (stills are plain image URLs)
    galleryEl.querySelectorAll('.proj-gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const galleryItems = p.gallery.map(src => ({ kind: 'image', src }));
            openLightbox(galleryItems, parseInt(item.dataset.lbIdx));
        });
    });

    // BTS lightbox (photos + videos combined)
    btsGrid.querySelectorAll('.proj-bts-item').forEach(item => {
        item.addEventListener('click', () => {
            openLightbox(btsItems, parseInt(item.dataset.lbIdx));
        });
    });
});
