/* ============================================
   RIDGELINE PRODUCTIONS — Cinematic Experience
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {

    // Wait for data-loader (if present) to hydrate dynamic content from /data/content.json
    // before reading philosophy text, stat counts, service descriptions, etc.
    if (window.contentReady) {
        try { await window.contentReady; } catch (e) { /* fall back to static HTML */ }
    }

    // Load trigger
    const transitionDelay = sessionStorage.getItem('pt-active') ? 600 : 100;
    setTimeout(() => document.body.classList.add('loaded'), transitionDelay);

    // Hero video — lazy load iframe
    const heroIframe = document.getElementById('heroIframe');
    if (heroIframe && heroIframe.dataset.src) {
        heroIframe.onload = () => heroIframe.classList.add('loaded');
        heroIframe.src = heroIframe.dataset.src;
    }

    // ─── Client logo marquee — local SVGs + simple-icons + text fallback ───
    const logoTrack = document.getElementById('clientLogoTrack');
    const logoData = document.getElementById('clientLogoData');
    if (logoTrack && logoData) {
        let clients = [];
        try { clients = JSON.parse(logoData.getAttribute('data-clients')) || []; }
        catch (e) { clients = []; }

        const buildSet = () => clients.map(c => {
            const safeName = (c.name || '').replace(/"/g, '&quot;');
            const classes = ['client-logo'];
            if (c.invert) classes.push('client-logo--invert');
            if (!c.src) classes.push('client-logo--text');

            const scaleStyle = (c.scale && c.scale !== 1)
                ? ` style="--logo-scale:${c.scale}"`
                : '';

            const imgTag = c.src
                ? `<img src="${c.src}" alt="${safeName}" class="client-logo-img" ` +
                  `loading="lazy" ` +
                  `onerror="this.parentElement.classList.add('client-logo--text');this.remove();">`
                : '';

            return `<span class="${classes.join(' ')}"${scaleStyle} data-name="${safeName}">` +
                   imgTag +
                   `<span class="client-logo-text">${safeName}</span>` +
                   `</span>`;
        }).join('');

        // Two copies for seamless loop
        logoTrack.innerHTML = buildSet() + buildSet();

        // ─── Auto-drift + click-and-hold drag to explore all clients ───
        const marquee = logoTrack.closest('.client-marquee');
        if (marquee) {
            let half = 0;
            const measure = () => { half = logoTrack.scrollWidth / 2; };
            measure();
            window.addEventListener('resize', measure);
            window.addEventListener('load', measure);

            const SPEED = 0.5;            // px/frame auto-drift
            let pos = 0;                  // float scroll position (sub-pixel safe)
            let dragging = false;
            let paused = false;           // brief pause after the user lets go
            let lastX = 0, resumeTimer;

            const loop = () => {
                if (!dragging && !paused) pos += SPEED;
                if (half > 0) { pos %= half; if (pos < 0) pos += half; } // seamless wrap (two identical copies)
                marquee.scrollLeft = pos;
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);

            // One path for mouse, touch and pen
            marquee.addEventListener('pointerdown', (e) => {
                dragging = true;
                lastX = e.clientX;
                marquee.classList.add('is-grabbing');
                try { marquee.setPointerCapture(e.pointerId); } catch (_) {}
                clearTimeout(resumeTimer);
            });
            marquee.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                pos -= (e.clientX - lastX);
                lastX = e.clientX;
            });
            const endDrag = (e) => {
                if (!dragging) return;
                dragging = false;
                marquee.classList.remove('is-grabbing');
                try { marquee.releasePointerCapture(e.pointerId); } catch (_) {}
                paused = true;
                clearTimeout(resumeTimer);
                resumeTimer = setTimeout(() => { paused = false; }, 1500);
            };
            marquee.addEventListener('pointerup', endDrag);
            marquee.addEventListener('pointercancel', endDrag);
        }
    }

    // ─── Logo morph: full white wordmark on hero → R badge in the nav island ───
    const header = document.getElementById('header');
    const heroLogo = document.getElementById('heroLogo');
    const heroLogoImg = document.getElementById('heroLogoImg');
    const heroBadge = document.getElementById('heroBadge');
    const heroWrap = document.querySelector('.hero-video-wrap');
    const heroBottom = document.querySelector('.hero-center-cta');
    let logoReady = false;

    if (heroLogo) {
        // If the URL has a hash (e.g. arriving at index.html#work via page
        // transition) the browser scrolls to the fragment *after* DOMContentLoaded.
        // Treat that case as "already scrolled" so we don't play the big reveal
        // and flash the wordmark over the destination section.
        const arrivingScrolled = window.scrollY > 10 || !!location.hash;

        const applyScrolledState = () => {
            logoReady = true;
            heroLogo.style.animation = 'none';
            heroLogo.style.opacity = '0';
            heroLogo.style.filter = 'none';
            heroLogo.style.transform = 'translateX(-50%)';
            if (heroBadge) {
                heroBadge.style.opacity = '1';
                heroBadge.style.transform = 'translate(-50%, 0) scale(1)';
                heroBadge.style.pointerEvents = 'auto';
            }
        };

        if (arrivingScrolled) {
            applyScrolledState();
        } else {
            heroLogo.addEventListener('animationend', () => {
                logoReady = true;
                heroLogo.style.animation = 'none';
                heroLogo.style.opacity = '1';
                heroLogo.style.filter = 'none';
                heroLogo.style.transform = 'translateX(-50%)';
                updateMorph();
            });

            // Safety: re-check after a frame and a tick in case the browser
            // scrolls to a fragment shortly after DOMContentLoaded.
            const recheck = () => {
                if (!logoReady && window.scrollY > 10) {
                    applyScrolledState();
                    updateMorph();
                }
            };
            requestAnimationFrame(recheck);
            setTimeout(recheck, 60);
        }
    }

    let vh = window.innerHeight;
    let vw = window.innerWidth;
    let MORPH_END = vh * 0.5;
    const NAV_HEIGHT = 52;
    const TARGET_HEIGHT = 22;

    window.addEventListener('resize', () => {
        vh = window.innerHeight;
        vw = window.innerWidth;
        MORPH_END = vh * 0.5;
        updateMorph();
    });

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function updateMorph() {
        const y = window.scrollY;
        const rawProgress = Math.min(Math.max(y / MORPH_END, 0), 1);
        const progress = easeInOutCubic(rawProgress);

        header.classList.toggle('scrolled', rawProgress > 0.3);
        header.classList.toggle('nav-revealed', rawProgress > 0.5);

        if (heroWrap) heroWrap.style.transform = `translateY(${y * 0.2}px)`;
        if (heroBottom) heroBottom.style.opacity = Math.max(1 - rawProgress * 4, 0);

        // Fixed quote button
        const fixedBtn = document.getElementById('fixedQuoteBtn');
        if (fixedBtn) fixedBtn.classList.toggle('visible', rawProgress > 0.6);

        if (!logoReady || !heroLogo) return;

        // Actual rendered dims of the full-logo container
        const startWidth = heroLogo.offsetWidth;
        const naturalRatio = heroLogoImg.naturalHeight / heroLogoImg.naturalWidth;
        const fullHeight = startWidth * naturalRatio;
        const targetScale = TARGET_HEIGHT / fullHeight;
        const halfH = fullHeight / 2;

        // Start: hero CSS top 3vh; End: vertical center of the nav island
        const cssTop = (3 / 100) * vh;
        const startCenter = cssTop + halfH;
        const headerPadTop = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.6;
        const targetCenter = headerPadTop + NAV_HEIGHT / 2;

        const scale = 1 + (targetScale - 1) * progress;
        const currentCenter = startCenter + (targetCenter - startCenter) * progress;
        const currentTop = currentCenter - halfH;

        heroLogo.style.top = `${currentTop}px`;
        heroLogo.style.transform = `translateX(-50%) scale(${scale})`;
        // Cross-fade: full wordmark fades out by ~60%, badge takes over from ~40% onward
        const fullOpacity = Math.max(0, 1 - rawProgress * 1.7);
        heroLogo.style.opacity = fullOpacity;
        heroLogo.style.pointerEvents = 'none';

        // Badge: rides the same center path, lands in the nav island at native 22px
        if (heroBadge) {
            const BADGE_SIZE = TARGET_HEIGHT;
            const badgeTop = currentCenter - BADGE_SIZE / 2;
            // Slight scale-down "settle" so the badge feels like it lands
            const badgeScale = 1.6 - 0.6 * progress;
            const badgeOpacity = Math.max(0, Math.min(1, (rawProgress - 0.4) * 2.2));
            heroBadge.style.top = `${badgeTop}px`;
            heroBadge.style.transform = `translate(-50%, 0) scale(${badgeScale})`;
            heroBadge.style.opacity = badgeOpacity;
            heroBadge.style.pointerEvents = rawProgress > 0.7 ? 'auto' : 'none';
        }
    }

    window.addEventListener('scroll', updateMorph, { passive: true });
    updateMorph();

    if (heroLogo) {
        heroLogo.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    if (heroBadge) {
        heroBadge.style.cursor = 'pointer';
        heroBadge.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const navLogoLink = document.getElementById('navLogoLink');
    if (navLogoLink) {
        navLogoLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ─── Contact headline word rotator ───
    const wordRotator = document.getElementById('wordRotator');
    if (wordRotator) {
        const words = ['extraordinary', 'cinematic', 'unforgettable', 'iconic', 'timeless', 'breathtaking', 'epic', 'bold', 'striking', 'powerful'];
        const current = wordRotator.querySelector('.wr-word');

        const meter = document.createElement('span');
        meter.setAttribute('aria-hidden', 'true');
        meter.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;';
        wordRotator.appendChild(meter);

        const measure = (text) => {
            meter.textContent = text;
            return meter.getBoundingClientRect().width;
        };

        const setWidth = () => {
            wordRotator.style.width = measure(current.textContent) + 'px';
        };
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(setWidth);
        }
        setWidth();
        window.addEventListener('resize', setWidth);

        let idx = 0;
        let cycling = false;
        const cycle = () => {
            if (cycling) return;
            cycling = true;
            idx = (idx + 1) % words.length;
            const next = words[idx];

            wordRotator.style.width = measure(next) + 'px';
            current.classList.add('wr-out');

            setTimeout(() => {
                current.textContent = next;
                current.style.transition = 'none';
                current.classList.remove('wr-out');
                current.classList.add('wr-in');
                void current.offsetWidth;
                current.style.transition = '';
                current.classList.remove('wr-in');
                cycling = false;
            }, 340);
        };

        // Only run when visible
        const contactSection = document.getElementById('contact');
        if (contactSection) {
            let timer = null;
            const obs = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting && !timer) {
                        timer = setInterval(cycle, 1600);
                    } else if (!e.isIntersecting && timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                });
            }, { threshold: 0.2 });
            obs.observe(contactSection);
        }
    }

    // ─── Mobile menu ───
    const menuBtn = document.getElementById('menuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    menuBtn.addEventListener('click', () => {
        menuBtn.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a:not(.mobile-link--quote)').forEach(a => a.addEventListener('click', () => {
        menuBtn.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
    }));

    // ─── GSAP Stacking Cards ───
    gsap.registerPlugin(ScrollTrigger);

    const reelCards = gsap.utils.toArray('.reel-stack > .reel-card');
    const progressBar = document.getElementById('reelProgressBar');
    const totalCards = reelCards.length;

    // Inject dim overlay into each card (cheaper than animating filter)
    reelCards.forEach(card => {
        if (!card.classList.contains('reel-card--cta')) {
            const dim = document.createElement('div');
            dim.className = 'reel-card-dim';
            card.appendChild(dim);
        }
    });

    reelCards.forEach((card, i) => {
        const isCta = card.classList.contains('reel-card--cta');
        const dim = card.querySelector('.reel-card-dim');

        // When the NEXT card starts covering this one, scale it down and darken
        if (i < totalCards - 1) {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: card,
                    start: 'bottom 90%',
                    end: 'bottom 20%',
                    scrub: 0.5,
                }
            });

            tl.to(card, { scale: 0.93, ease: 'none' }, 0);
            if (dim) tl.to(dim, { opacity: 0.7, ease: 'none' }, 0);
        }

        // Parallax on images — subtle vertical shift
        if (!isCta) {
            const img = card.querySelector('.reel-card-img img');
            if (img) {
                gsap.set(img, { scale: 1.15 });
                gsap.to(img, {
                    y: -40,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: card,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: true,
                    }
                });
            }
        }

        // Active state — reveal text info
        ScrollTrigger.create({
            trigger: card,
            start: 'top 50%',
            end: 'bottom 30%',
            onEnter: () => setActive(i),
            onEnterBack: () => setActive(i),
        });
    });

    function setActive(idx) {
        reelCards.forEach(c => c.classList.remove('is-active'));
        reelCards[idx].classList.add('is-active');
        if (progressBar) {
            progressBar.style.width = `${((idx + 1) / totalCards) * 100}%`;
        }
    }

    // Activate first card on load
    setTimeout(() => {
        if (!document.querySelector('.reel-card.is-active') && reelCards.length) {
            reelCards[0].classList.add('is-active');
        }
    }, 400);


    // ─── Scroll animations (for non-reel elements) ───
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const siblings = [...entry.target.parentElement.querySelectorAll('.anim')];
                const idx = siblings.indexOf(entry.target);
                entry.target.style.transitionDelay = `${idx * 0.08}s`;
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.anim').forEach(el => observer.observe(el));

    // ─── Stat counter animation ───
    const statNums = document.querySelectorAll('.stat-num');
    const statObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.dataset.count);
                let current = 0;
                const duration = 1500;
                const start = performance.now();

                function tick(now) {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    current = Math.round(eased * target);
                    el.textContent = current;
                    if (progress < 1) requestAnimationFrame(tick);
                }
                requestAnimationFrame(tick);
                // Trigger bar animation on the parent .stat
                el.closest('.stat').classList.add('stat-visible');
                statObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });
    statNums.forEach(el => statObserver.observe(el));

    // ─── GSAP section reveals ───
    gsap.utils.toArray('.section, .showreels').forEach(section => {
        gsap.from(section, {
            scrollTrigger: {
                trigger: section,
                start: 'top 85%',
                once: true,
            },
            opacity: 0,
            y: 60,
            duration: 1,
            ease: 'power3.out',
        });
    });

    // Reel header
    const reelHeader = document.querySelector('.reel-header');
    if (reelHeader) {
        gsap.from('.reel-heading', {
            scrollTrigger: {
                trigger: reelHeader,
                start: 'top 80%',
                once: true,
            },
            y: 80,
            opacity: 0,
            duration: 1.2,
            ease: 'power3.out',
        });
        gsap.from('.reel-header .section-label', {
            scrollTrigger: {
                trigger: reelHeader,
                start: 'top 80%',
                once: true,
            },
            y: 30,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
        });
    }

    // ─── Scroll parallax ───
    const globeText = document.querySelector('.globe-text');
    if (globeText) {
        gsap.to(globeText, {
            y: -50,
            ease: 'none',
            scrollTrigger: {
                trigger: '.section--globe',
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
            }
        });
    }

    const aboutLeft = document.querySelector('.about-left');
    const aboutRight = document.querySelector('.about-right');
    if (aboutLeft && aboutRight) {
        gsap.to(aboutLeft, {
            y: -40,
            ease: 'none',
            scrollTrigger: {
                trigger: '.about-grid',
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
            }
        });
        gsap.to(aboutRight, {
            y: 30,
            ease: 'none',
            scrollTrigger: {
                trigger: '.about-grid',
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
            }
        });
    }

    // Showreel parallax on images
    document.querySelectorAll('.showreel').forEach(reel => {
        const img = reel.querySelector('img');
        if (img) {
            gsap.set(img, { scale: 1.15 });
            gsap.to(img, {
                y: -30,
                ease: 'none',
                scrollTrigger: {
                    trigger: reel,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true,
                }
            });
        }
    });

    // ─── Smooth anchor scroll ───
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(a.getAttribute('href'));
            if (target) window.scrollTo({ top: target.offsetTop - 64, behavior: 'smooth' });
        });
    });

    // ─── Showreel lightbox ───
    const lightbox = document.getElementById('lightbox');
    const lightboxContent = document.getElementById('lightboxContent');

    function openLightboxVideo(vimeoId, thumbSrc, hash) {
        const hParam = hash ? `&h=${hash}` : '';
        lightboxContent.innerHTML = `
            <iframe src="https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0${hParam}"
                allow="autoplay; fullscreen" allowfullscreen
                style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;z-index:1;"></iframe>
            ${thumbSrc ? `<img src="${thumbSrc}" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;border-radius:4px;">` : ''}
        `;
        lightbox.classList.add('active');
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        setTimeout(() => { lightboxContent.innerHTML = ''; }, 300);
    }

    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

    document.querySelectorAll('.showreel').forEach(reel => {
        reel.addEventListener('click', () => {
            const vimeoId = reel.dataset.vimeo;
            const hash = reel.dataset.h || null;
            const img = reel.querySelector('img');
            if (vimeoId) openLightboxVideo(vimeoId, img ? img.src : null, hash);
        });
    });

    // ─── Contact form (Web3Forms → info@ridgelineproductions.com) ───
    const WEB3FORMS_ACCESS_KEY = 'YOUR_WEB3FORMS_ACCESS_KEY';
    const form = document.getElementById('contactForm');
    if (form) {
        const btn = form.querySelector('.form-btn');
        const statusEl = document.getElementById('formStatus');
        const DEFAULT_LABEL = 'Send Message →';
        const setStatus = (msg, kind) => {
            if (!statusEl) return;
            statusEl.textContent = msg || '';
            statusEl.className = 'form-status' + (kind ? ' is-' + kind : '');
        };
        form.addEventListener('submit', async e => {
            e.preventDefault();
            setStatus('');
            btn.disabled = true;
            btn.textContent = 'Sending…';
            try {
                const fd = new FormData(form);
                fd.append('access_key', WEB3FORMS_ACCESS_KEY);
                fd.append('subject', 'New inquiry — Ridgeline Productions');
                fd.append('from_name', 'Ridgeline Productions Website');
                const res = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: { Accept: 'application/json' },
                    body: fd,
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success) {
                    form.reset();
                    btn.textContent = 'Sent!';
                    setStatus("Thanks — we'll be in touch soon.", 'success');
                    setTimeout(() => { btn.textContent = DEFAULT_LABEL; btn.disabled = false; }, 3000);
                } else {
                    throw new Error(data.message || 'send_failed');
                }
            } catch (err) {
                btn.textContent = DEFAULT_LABEL;
                btn.disabled = false;
                setStatus('Something went wrong. Please email info@ridgelineproductions.com directly.', 'error');
            }
        });
    }

    // ─── Reveal Lines (About headline) ───
    const revealLines = document.querySelectorAll('.reveal-line-inner');
    if (revealLines.length) {
        gsap.to(revealLines, {
            y: 0,
            duration: 1.2,
            ease: 'power4.out',
            stagger: 0.18,
            scrollTrigger: {
                trigger: '.about-headline',
                start: 'top 80%',
                once: true,
            }
        });
    }

    // ─── Stats scale entrance ───
    document.querySelectorAll('.stat').forEach((stat, i) => {
        gsap.from(stat, {
            scale: 0.5,
            opacity: 0,
            duration: 0.8,
            delay: i * 0.12,
            ease: 'back.out(1.7)',
            scrollTrigger: {
                trigger: '.about-stats',
                start: 'top 85%',
                once: true,
            }
        });
    });

    // ─── Service accordion ───
    document.querySelectorAll('.service-item').forEach(item => {
        const header = item.querySelector('.service-header');
        const reveal = item.querySelector('.service-reveal');
        const inner = item.querySelector('.service-reveal-inner');

        header.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Close all other items
            document.querySelectorAll('.service-item.active').forEach(other => {
                if (other !== item) {
                    other.classList.remove('active');
                    other.querySelector('.service-reveal').style.height = '0px';
                }
            });

            if (isActive) {
                item.classList.remove('active');
                reveal.style.height = '0px';
            } else {
                item.classList.add('active');
                reveal.style.height = inner.offsetHeight + 'px';
            }
        });
    });

    // ─── Service scroll reveal (staggered) ───
    const svcItems = document.querySelectorAll('.service-item');
    const svcObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const items = [...svcItems];
                const idx = items.indexOf(entry.target);
                setTimeout(() => entry.target.classList.add('svc-visible'), idx * 120);
                svcObs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    svcItems.forEach(item => svcObs.observe(item));

    // ─── Contact glow follow (smooth lerp) ───
    const contactSection = document.querySelector('.section--contact');
    const contactGlow = document.getElementById('contactGlow');
    if (contactSection && contactGlow) {
        let glowTarget = { x: 0, y: 0 };
        let glowCurrent = { x: 0, y: 0 };
        let glowActive = false;

        contactSection.addEventListener('mousemove', (e) => {
            const rect = contactSection.getBoundingClientRect();
            glowTarget.x = e.clientX - rect.left;
            glowTarget.y = e.clientY - rect.top;
            if (!glowActive) {
                glowActive = true;
                glowCurrent.x = glowTarget.x;
                glowCurrent.y = glowTarget.y;
                tickGlow();
            }
        });
        contactSection.addEventListener('mouseleave', () => { glowActive = false; });

        function tickGlow() {
            if (!glowActive) return;
            glowCurrent.x += (glowTarget.x - glowCurrent.x) * 0.08;
            glowCurrent.y += (glowTarget.y - glowCurrent.y) * 0.08;
            contactGlow.style.left = glowCurrent.x + 'px';
            contactGlow.style.top = glowCurrent.y + 'px';
            requestAnimationFrame(tickGlow);
        }
    }

    // ─── Contact section parallax ───
    const contactLeft = document.querySelector('.contact-left');
    const contactRight = document.querySelector('.contact-right');
    if (contactLeft && contactRight) {
        gsap.to(contactLeft, {
            y: -20,
            ease: 'none',
            scrollTrigger: {
                trigger: '.contact-grid',
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
            }
        });
        gsap.to(contactRight, {
            y: -50,
            ease: 'none',
            scrollTrigger: {
                trigger: '.contact-grid',
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
            }
        });
    }

    // ─── Philosophy — scroll-driven word highlight ───
    const philText = document.getElementById('philosophyText');
    if (philText) {
        const raw = philText.innerHTML.trim();
        // Split text into words, preserving em dashes
        const words = raw.split(/\s+/);
        philText.innerHTML = words.map(w => {
            const isDash = w === '—';
            return `<span class="word${isDash ? ' dash-word' : ''}">${w}</span>`;
        }).join(' ');

        const wordEls = philText.querySelectorAll('.word');

        ScrollTrigger.create({
            trigger: '.section--philosophy',
            start: 'top 60%',
            end: 'center center',
            scrub: true,
            onUpdate: (self) => {
                const count = Math.ceil(self.progress * wordEls.length);
                wordEls.forEach((w, i) => {
                    w.classList.toggle('active', i < count);
                });
            }
        });
    }

    // ─── Contact headline reveal ───
    const contactReveals = document.querySelectorAll('.contact-reveal');
    if (contactReveals.length) {
        gsap.to(contactReveals, {
            y: 0,
            duration: 1.2,
            ease: 'power4.out',
            stagger: 0.18,
            scrollTrigger: {
                trigger: '.contact-headline-big',
                start: 'top 85%',
                once: true,
            }
        });
    }

    // ─── Cobe Globe ───
    const globeCanvas = document.getElementById('cobeGlobe');
    const globeSection = document.getElementById('globe-section');
    if (globeCanvas && globeSection && typeof COBE !== 'undefined') {
        let globeInited = false;

        function initGlobe() {
            if (globeInited) return;
            const wrap = globeCanvas.parentElement;
            const width = wrap.offsetWidth;
            if (width === 0) return;
            globeInited = true;

            wrap.style.height = width + 'px';

            let phi = 0;
            let pointerDown = false;
            let pointerX = 0;
            let dragVelocity = 0;
            const autoSpeed = 0.003;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            globeCanvas.addEventListener('pointerdown', (e) => {
                pointerDown = true;
                pointerX = e.clientX;
                globeCanvas.setPointerCapture(e.pointerId);
            });
            globeCanvas.addEventListener('pointermove', (e) => {
                if (!pointerDown) return;
                const dx = e.clientX - pointerX;
                pointerX = e.clientX;
                dragVelocity = dx * 0.005;
                phi += dragVelocity;
            });
            globeCanvas.addEventListener('pointerup', (e) => {
                pointerDown = false;
                globeCanvas.releasePointerCapture(e.pointerId);
            });

            COBE(globeCanvas, {
                devicePixelRatio: dpr,
                width: width * dpr,
                height: width * dpr,
                phi: 0,
                theta: 0.15,
                dark: 1,
                diffuse: 2,
                mapSamples: 16000,
                mapBrightness: 3,
                baseColor: [0.15, 0.15, 0.15],
                markerColor: [0.784, 0.729, 0.635],
                glowColor: [0.08, 0.08, 0.08],
                markers: [
                    { location: [34.4208, -119.6982], size: 0.06 },
                    { location: [35.6762, 139.6503], size: 0.03 },
                    { location: [48.8566, 2.3522], size: 0.03 },
                    { location: [-33.8688, 151.2093], size: 0.03 },
                    { location: [40.7128, -74.006], size: 0.03 },
                    { location: [-22.9068, -43.1729], size: 0.03 },
                ],
                onRender: (state) => {
                    state.phi = phi;
                    if (!pointerDown) {
                        dragVelocity *= 0.92;
                        phi += Math.abs(dragVelocity) > 0.0005 ? dragVelocity : autoSpeed;
                    }
                },
            });

            globeCanvas.style.opacity = '1';
        }

        const globeObs = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) initGlobe();
        }, { rootMargin: '300px' });

        globeObs.observe(globeSection);
    }

    // ─── WebGL Mesh Gradient — scroll-driven opacity ───
    initMeshGradient();

    const meshCanvas = document.getElementById('meshGradient');
    const philSection = document.querySelector('.section--philosophy');
    if (meshCanvas && philSection) {
        ScrollTrigger.create({
            trigger: philSection,
            start: 'top 80%',
            end: 'bottom 20%',
            scrub: true,
            onUpdate: (self) => {
                // Bell curve — peaks at 0.5, fades at edges
                const p = self.progress;
                const fade = Math.sin(p * Math.PI);
                meshCanvas.style.opacity = fade;
            }
        });
    }
});

function initMeshGradient() {
    const canvas = document.getElementById('meshGradient');
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return;

    const vert = `
        attribute vec2 pos;
        varying vec2 vUv;
        void main() {
            vUv = pos * 0.5 + 0.5;
            gl_Position = vec4(pos, 0.0, 1.0);
        }
    `;

    const frag = `
        precision mediump float;
        uniform float time;
        uniform vec2 res;
        varying vec2 vUv;

        vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }

        float snoise(vec2 v){
            const vec4 C = vec4(0.211324865405187,0.366025403784439,
                               -0.577350269189626,0.024390243902439);
            vec2 i = floor(v + dot(v, C.yy));
            vec2 x0 = v - i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod(i, 289.0);
            vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
            vec3 m = max(0.5 - vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)), 0.0);
            m = m*m; m = m*m;
            vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x_) - 0.5;
            vec3 ox = floor(x_ + 0.5);
            vec3 a0 = x_ - ox;
            m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
            vec3 g;
            g.x = a0.x * x0.x + h.x * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }

        void main() {
            vec2 uv = vUv;
            float ar = res.x / res.y;
            vec2 st = vec2(uv.x * ar, uv.y);
            float t = time * 0.12;

            float n1 = snoise(st * 1.8 + t * 0.4) * 0.5;
            float n2 = snoise(st * 2.5 - t * 0.3 + 50.0) * 0.35;
            float n3 = snoise(st * 4.0 + t * 0.2 + 100.0) * 0.15;
            float noise = n1 + n2 + n3;

            vec3 c1 = vec3(0.03, 0.03, 0.03);
            vec3 c2 = vec3(0.12, 0.11, 0.10);
            vec3 c3 = vec3(0.18, 0.16, 0.14);
            vec3 accent = vec3(0.784, 0.729, 0.635);

            vec3 col = mix(c1, c2, smoothstep(-0.4, 0.3, noise));
            col = mix(col, c3, smoothstep(0.1, 0.6, noise));
            col += accent * smoothstep(0.15, 0.55, noise) * 0.15;

            float vig = 1.0 - pow(length((uv - 0.5) * 1.2), 2.5);
            vig = smoothstep(-0.1, 1.0, vig);

            col *= 0.7 + vig * 0.3;

            gl_FragColor = vec4(col, 1.0);
        }
    `;

    function compile(src, type) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(vert, gl.VERTEX_SHADER));
    gl.attachShader(prog, compile(frag, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(prog, 'time');
    const resLoc = gl.getUniformLocation(prog, 'res');

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio, 1.5);
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    resize();
    window.addEventListener('resize', resize);

    let running = false;
    function draw(t) {
        if (!running) return;
        gl.uniform1f(timeLoc, t * 0.001);
        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(draw);
    }

    // Only animate when gradient is visible (opacity > 0)
    const phil = document.querySelector('.section--philosophy');
    if (phil) {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting && !running) {
                    running = true;
                    requestAnimationFrame(draw);
                } else if (!e.isIntersecting) {
                    running = false;
                }
            });
        }, { rootMargin: '100% 0px' });
        obs.observe(phil);
    }
}
