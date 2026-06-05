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

    // Populate video (hide the hero player if there's no Vimeo hero yet)
    if (p.vimeo) {
        document.getElementById('projVideoThumb').src = p.thumb;
        document.getElementById('projPlayBtn').addEventListener('click', () => {
            const player = document.getElementById('projVideoPlayer');
            const hParam = p.vimeoHash ? `&h=${p.vimeoHash}` : '';
            player.innerHTML = `<iframe src="https://player.vimeo.com/video/${p.vimeo}?autoplay=1&title=0&byline=0&portrait=0${hParam}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
        });
    } else {
        const vs = document.getElementById('projVideo');
        if (vs) vs.style.display = 'none';
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

    const PREVIEW = 8;

    // Gallery
    const galleryEl = document.getElementById('projGallery');
    const gallerySection = document.getElementById('projGallerySection');
    if (p.gallery && p.gallery.length) {
        galleryEl.innerHTML = p.gallery.map((img, i) =>
            `<div class="proj-gallery-item anim" data-anim="fade-up" data-lb-idx="${i}" data-lb-group="gallery">
                <img src="${img}" alt="Still ${i + 1}" loading="lazy">
            </div>`
        ).join('');
        applyViewAll(galleryEl, document.getElementById('projGalleryMore'), p.gallery.length, PREVIEW, 'stills');
    } else {
        gallerySection.style.display = 'none';
    }

    // BTS
    const btsGrid = document.getElementById('projBtsGrid');
    const btsSection = document.getElementById('projBtsSection');
    if (p.bts && p.bts.length) {
        btsGrid.innerHTML = p.bts.map((b, i) =>
            `<div class="proj-bts-item anim" data-anim="fade-up" data-lb-idx="${i}" data-lb-group="bts">
                <img src="${b.img}" alt="${b.label}" loading="lazy">
                <span class="proj-bts-label">${b.label}</span>
            </div>`
        ).join('');
        applyViewAll(btsGrid, document.getElementById('projBtsMore'), p.bts.length, PREVIEW, 'photos');
    } else {
        btsSection.style.display = 'none';
    }

    // BTS Film (self-hosted clips)
    const clipsGrid = document.getElementById('projClipsGrid');
    const clipsSection = document.getElementById('projClipsSection');
    const videos = p.videos || [];
    if (clipsSection) {
        if (videos.length) {
            clipsGrid.innerHTML = videos.map((v, i) => {
                const ar = (v.w && v.h) ? `${v.w} / ${v.h}` : '16 / 9';
                return `<div class="proj-clip anim" data-anim="fade-up" style="aspect-ratio:${ar}">
                    <video class="proj-clip-video" preload="none" playsinline controls ${v.poster ? `poster="${v.poster}"` : ''}>
                        <source src="${v.src}" type="video/mp4">
                    </video>
                    ${v.label ? `<span class="proj-clip-label">${v.label}</span>` : ''}
                </div>`;
            }).join('');
            applyViewAll(clipsGrid, document.getElementById('projClipsMore'), videos.length, 6, 'clips');
        } else {
            clipsSection.style.display = 'none';
        }
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

    // --- Lightbox ---
    const lightbox = document.getElementById('lightbox');
    const lbContent = document.getElementById('lightboxContent');
    const lbCaption = document.getElementById('lightboxCaption');
    let lbImages = [];
    let lbIdx = 0;

    function openLightbox(images, startIdx, caption) {
        lbImages = images;
        lbIdx = startIdx;
        showLbImage(caption);
        lightbox.classList.add('active');
    }

    function showLbImage(caption) {
        lbContent.innerHTML = `<img src="${lbImages[lbIdx]}" alt="">`;
        lbCaption.textContent = caption || `${lbIdx + 1} / ${lbImages.length}`;
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
    }

    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
    document.getElementById('lbPrev').addEventListener('click', (e) => {
        e.stopPropagation();
        lbIdx = (lbIdx - 1 + lbImages.length) % lbImages.length;
        showLbImage();
    });
    document.getElementById('lbNext').addEventListener('click', (e) => {
        e.stopPropagation();
        lbIdx = (lbIdx + 1) % lbImages.length;
        showLbImage();
    });

    document.addEventListener('keydown', e => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') { lbIdx = (lbIdx - 1 + lbImages.length) % lbImages.length; showLbImage(); }
        if (e.key === 'ArrowRight') { lbIdx = (lbIdx + 1) % lbImages.length; showLbImage(); }
    });

    // Gallery lightbox
    galleryEl.querySelectorAll('.proj-gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const i = parseInt(item.dataset.lbIdx);
            openLightbox(p.gallery, i);
        });
    });

    // BTS lightbox
    btsGrid.querySelectorAll('.proj-bts-item').forEach(item => {
        item.addEventListener('click', () => {
            const i = parseInt(item.dataset.lbIdx);
            const imgs = p.bts.map(b => b.img);
            const label = p.bts[i].label;
            openLightbox(imgs, i, label);
        });
    });
});
