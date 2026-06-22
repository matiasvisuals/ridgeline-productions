/* ============================================
   PAGE TRANSITIONS
   ============================================ */

(function () {
    const COVER_DURATION = 700;
    const overlay = document.getElementById('pageTransition');
    if (!overlay) return;

    // --- Reset transition state when restored from back/forward cache ---
    // Without this, hitting the browser Back button restores the page while
    // body.page-exiting still has all content at opacity:0 (and the overlay
    // may still be covering) → the page appears blank.
    window.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        document.body.classList.remove('page-exiting');
        overlay.classList.remove('active', 'slide-up', 'slide-down', 'covering', 'revealing', 'from-bottom', 'from-top');
        sessionStorage.removeItem('pt-active');
        sessionStorage.removeItem('pt-direction');
    });

    // --- Detect if we're arriving from a transition ---
    const arriving = sessionStorage.getItem('pt-active');
    const direction = sessionStorage.getItem('pt-direction') || 'up';

    if (arriving) {
        sessionStorage.removeItem('pt-active');
        sessionStorage.removeItem('pt-direction');

        // Overlay is covering the screen — set up the covering state instantly
        overlay.classList.add('covering', direction === 'up' ? 'from-bottom' : 'from-top');
        // Force reflow
        overlay.offsetHeight;

        // Slight delay then reveal (let the page render first)
        setTimeout(() => {
            overlay.classList.add('revealing');
            overlay.addEventListener('transitionend', function handler(e) {
                if (e.target !== overlay) return;
                overlay.classList.remove('covering', 'revealing', 'from-bottom', 'from-top');
                overlay.removeEventListener('transitionend', handler);
            });
        }, 80);
    }

    // --- Intercept project card clicks (homepage/work → project) ---
    document.querySelectorAll('a.work-card, a.reel-card').forEach(card => {
        card.addEventListener('click', function (e) {
            e.preventDefault();
            triggerTransition(this.href, 'up');
        });
    });

    // --- Intercept project nav links (project → project) ---
    document.querySelectorAll('.proj-nav-link').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            triggerTransition(this.href, 'up');
        });
    });

    // --- Intercept logo click (project → homepage) ---
    document.querySelectorAll('.nav-logo, .nav-logo-link').forEach(logo => {
        logo.addEventListener('click', function (e) {
            const href = logo.getAttribute('href');
            if (href && href.includes('index.html')) {
                e.preventDefault();
                triggerTransition(logo.href, 'down');
            }
        });
    });

    // --- Intercept nav links on project/work page back to index ---
    if (document.body.classList.contains('project-page') || document.body.classList.contains('work-page')) {
        document.querySelectorAll('.nav-links a, .mobile-link').forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('index.html')) {
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    triggerTransition(link.href, 'down');
                });
            }
        });
    }

    function triggerTransition(href, dir) {
        if (overlay.classList.contains('active')) return;
        dir = dir || 'up';

        // Kill GSAP ScrollTriggers to prevent glitches during exit
        if (typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.getAll().forEach(st => st.kill());
        }

        // Fade out page content
        document.body.classList.add('page-exiting');

        // Start curtain after a brief content fade
        setTimeout(() => {
            overlay.classList.add('active', dir === 'up' ? 'slide-up' : 'slide-down');
        }, 120);

        sessionStorage.setItem('pt-active', '1');
        sessionStorage.setItem('pt-direction', dir);

        // Navigate once curtain has covered
        setTimeout(() => {
            window.location.href = href;
        }, 120 + COVER_DURATION);
    }
})();
