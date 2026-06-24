// Edge gate: the public site is held behind coming-soon.html until the client's
// account is settled. Anyone who unlocks with the admin password (via /api/unlock,
// which sets the rdgl_unlock cookie) is let straight through to the real site, so
// they can preview the edits they make in /admin. Lifting the gate = delete this
// file (and the redirect is gone). Assets, /admin and /api are excluded via the
// matcher so the dashboard and the holding page itself keep working.
import { rewrite, next } from '@vercel/edge';

export const config = {
    matcher: ['/((?!api|admin|brand|fonts|media|coming-soon|favicon|robots|sitemap).*)'],
};

export default function middleware(request) {
    const token = process.env.SITE_UNLOCK_TOKEN || '';
    const cookie = request.headers.get('cookie') || '';
    const unlocked = token && cookie.split(';').some(c => c.trim() === `rdgl_unlock=${token}`);
    if (unlocked) return next();
    // Serve the holding page in place (keeps the original URL — no redirect).
    return rewrite(new URL('/coming-soon.html', request.url));
}
