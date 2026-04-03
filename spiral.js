/* ============================================
   RIDGELINE — Spiral Intro Animation
   Ported from React to vanilla JS
   ============================================ */

(function () {
    // Skip intro if already seen this session
    if (sessionStorage.getItem('ridgeline-intro-seen')) {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.remove();
        document.body.classList.add('loaded');
        return;
    }

    // Prevent scrolling during intro
    document.body.style.overflow = 'hidden';

    const canvas = document.getElementById('spiralCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ─── Vector helpers ───
    class Vec2 {
        constructor(x, y) { this.x = x; this.y = y; }
    }
    class Vec3 {
        constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    }

    // ─── Constants ───
    const CHANGE_TIME = 0.32;
    const CAM_Z = -400;
    const CAM_TRAVEL = 3400;
    const DOT_Y_OFF = 28;
    const VIEW_ZOOM = 100;
    const NUM_STARS = 5000;
    const TRAIL_LEN = 80;

    // ─── Sizing ───
    let W, H, SIZE;
    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        SIZE = Math.max(W, H);
        const dpr = window.devicePixelRatio || 1;
        canvas.width = SIZE * dpr;
        canvas.height = SIZE * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // ─── Math utilities ───
    function ease(p, g) {
        return p < 0.5 ? 0.5 * Math.pow(2 * p, g) : 1 - 0.5 * Math.pow(2 * (1 - p), g);
    }
    function easeOutElastic(x) {
        const c = (2 * Math.PI) / 4.5;
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        return Math.pow(2, -8 * x) * Math.sin((x * 8 - 0.75) * c) + 1;
    }
    function map(v, a, b, c, d) { return c + (d - c) * ((v - a) / (b - a)); }
    function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
    function lerp(a, b, t) { return a * (1 - t) + b * t; }

    function spiralPath(p) {
        p = clamp(1.2 * p, 0, 1);
        p = ease(p, 1.8);
        const turns = 6;
        const theta = 2 * Math.PI * turns * Math.sqrt(p);
        const r = 170 * Math.sqrt(p);
        return new Vec2(r * Math.cos(theta), r * Math.sin(theta) + DOT_Y_OFF);
    }

    function projectDot(pos, sizeFactor, time) {
        const t2 = clamp(map(time, CHANGE_TIME, 1, 0, 1), 0, 1);
        const camZ = CAM_Z + ease(Math.pow(t2, 1.2), 1.8) * CAM_TRAVEL;
        if (pos.z > camZ) {
            const depth = pos.z - camZ;
            const x = VIEW_ZOOM * pos.x / depth;
            const y = VIEW_ZOOM * pos.y / depth;
            const sw = 400 * sizeFactor / depth;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(sw / 2, 0.3), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ─── Star class ───
    function Star() {
        this.angle = Math.random() * Math.PI * 2;
        this.dist = 30 * Math.random() + 15;
        this.rotDir = Math.random() > 0.5 ? 1 : -1;
        this.expRate = 1.2 + Math.random() * 0.8;
        this.finalScale = 0.7 + Math.random() * 0.6;
        this.dx = this.dist * Math.cos(this.angle);
        this.dy = this.dist * Math.sin(this.angle);
        this.spiralLoc = (1 - Math.pow(1 - Math.random(), 3)) / 1.3;
        this.z = lerp(
            (0.5 * CAM_Z) + Math.random() * (CAM_TRAVEL),
            CAM_TRAVEL / 2,
            0.3 * this.spiralLoc
        );
        this.swFactor = Math.pow(Math.random(), 2);
    }

    Star.prototype.render = function (p, time) {
        const sp = spiralPath(this.spiralLoc);
        const q = p - this.spiralLoc;
        if (q <= 0) return;

        const dp = clamp(4 * q, 0, 1);
        const linE = dp, elE = easeOutElastic(dp), powE = dp * dp;
        let easing;
        if (dp < 0.3) easing = lerp(linE, powE, dp / 0.3);
        else if (dp < 0.7) easing = lerp(powE, elE, (dp - 0.3) / 0.4);
        else easing = elE;

        let sx, sy;
        if (dp < 0.3) {
            sx = lerp(sp.x, sp.x + this.dx * 0.3, easing / 0.3);
            sy = lerp(sp.y, sp.y + this.dy * 0.3, easing / 0.3);
        } else if (dp < 0.7) {
            const mp = (dp - 0.3) / 0.4;
            const curve = Math.sin(mp * Math.PI) * this.rotDir * 1.5;
            const bx = sp.x + this.dx * 0.3, by = sp.y + this.dy * 0.3;
            const tx = sp.x + this.dx * 0.7, ty = sp.y + this.dy * 0.7;
            sx = lerp(bx, tx, mp) + (-this.dy * 0.4 * curve) * mp;
            sy = lerp(by, ty, mp) + (this.dx * 0.4 * curve) * mp;
        } else {
            const fp = (dp - 0.7) / 0.3;
            const bx = sp.x + this.dx * 0.7, by = sp.y + this.dy * 0.7;
            const td = this.dist * this.expRate * 1.5;
            const sa = this.angle + 1.2 * this.rotDir * fp * Math.PI;
            sx = lerp(bx, sp.x + td * Math.cos(sa), fp);
            sy = lerp(by, sp.y + td * Math.sin(sa), fp);
        }

        const vx = (this.z - CAM_Z) * sx / VIEW_ZOOM;
        const vy = (this.z - CAM_Z) * sy / VIEW_ZOOM;

        let sm = 1;
        if (dp < 0.6) sm = 1 + dp * 0.2;
        else { const t = (dp - 0.6) / 0.4; sm = 1.2 * (1 - t) + this.finalScale * t; }

        projectDot(new Vec3(vx, vy, this.z), 8.5 * this.swFactor * sm, time);
    };

    // ─── Create stars (seeded) ───
    const stars = [];
    (function () {
        let seed = 1234;
        const origRandom = Math.random;
        Math.random = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        for (let i = 0; i < NUM_STARS; i++) stars.push(new Star());
        Math.random = origRandom;
    })();

    // ─── Render ───
    let time = 0;

    function render() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.save();
        ctx.translate(SIZE / 2, SIZE / 2);

        const t1 = clamp(map(time, 0, CHANGE_TIME + 0.25, 0, 1), 0, 1);
        const t2 = clamp(map(time, CHANGE_TIME, 1, 0, 1), 0, 1);

        ctx.rotate(-Math.PI * ease(t2, 2.7));

        // Trail
        for (let i = 0; i < TRAIL_LEN; i++) {
            const f = map(i, 0, TRAIL_LEN, 1.1, 0.1);
            const sw = (1.3 * (1 - t1) + 3 * Math.sin(Math.PI * t1)) * f;
            ctx.fillStyle = '#fff';
            const pt = t1 - 0.00015 * i;
            const pos = spiralPath(pt);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, Math.max(sw / 2, 0.2), 0, Math.PI * 2);
            ctx.fill();
        }

        // Stars
        ctx.fillStyle = '#fff';
        for (const s of stars) s.render(t1, time);

        // Start dot
        if (time > CHANGE_TIME) {
            const dy = CAM_Z * DOT_Y_OFF / VIEW_ZOOM;
            projectDot(new Vec3(0, dy, CAM_TRAVEL), 2.5, time);
        }

        ctx.restore();
    }

    // ─── GSAP timeline ───
    const tl = gsap.timeline({ repeat: -1 });
    tl.to({ v: 0 }, {
        v: 1,
        duration: 15,
        ease: 'none',
        onUpdate: function () {
            time = this.progress();
            render();
        }
    });

    // ─── Enter button ───
    const enterBtn = document.getElementById('splashEnter');
    if (enterBtn) {
        setTimeout(() => {
            enterBtn.style.opacity = '1';
            enterBtn.style.transform = 'translateY(0)';
        }, 2500);

        enterBtn.addEventListener('click', () => {
            sessionStorage.setItem('ridgeline-intro-seen', '1');
            const splash = document.getElementById('splashScreen');
            if (splash) {
                splash.style.opacity = '0';
                splash.style.transition = 'opacity 1s cubic-bezier(0.16, 1, 0.3, 1)';
                setTimeout(() => {
                    splash.remove();
                    document.body.style.overflow = '';
                    document.body.classList.add('loaded');
                    tl.kill();
                }, 1000);
            }
        });
    }
})();
