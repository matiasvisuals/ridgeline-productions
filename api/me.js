import { readSessionCookie, setSessionCookie, SESSION_MAX_AGE } from './_lib/auth.js';

export default async function handler(req, res) {
    const session = readSessionCookie(req);
    if (!session) return res.status(401).json({ authenticated: false });
    // Sliding session: each visit to the portal pushes the expiry out again.
    const now = Math.floor(Date.now() / 1000);
    const exp = now + SESSION_MAX_AGE;
    setSessionCookie(res, { sub: session.sub || 'admin', iat: now, exp });
    return res.status(200).json({ authenticated: true, exp });
}
