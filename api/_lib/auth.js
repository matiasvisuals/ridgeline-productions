// Tiny HMAC-signed cookie session — no DB user table, just a shared password gate.
import crypto from 'node:crypto';

const COOKIE_NAME = 'rdgl_admin';
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h

function b64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64');
}

function getSecret() {
    const s = process.env.SESSION_SECRET;
    if (!s) throw new Error('SESSION_SECRET env var is not set');
    return s;
}

export function sign(payload) {
    const body = b64url(JSON.stringify(payload));
    const sig = b64url(crypto.createHmac('sha256', getSecret()).update(body).digest());
    return `${body}.${sig}`;
}

export function verify(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [body, sig] = token.split('.');
    const expected = b64url(crypto.createHmac('sha256', getSecret()).update(body).digest());
    if (sig !== expected) return null;
    try {
        const payload = JSON.parse(b64urlDecode(body).toString('utf8'));
        if (payload.exp && Date.now() / 1000 > payload.exp) return null;
        return payload;
    } catch { return null; }
}

export function readSessionCookie(req) {
    const cookie = req.headers.cookie || '';
    const match = cookie.split(';').map(s => s.trim()).find(c => c.startsWith(COOKIE_NAME + '='));
    if (!match) return null;
    return verify(decodeURIComponent(match.slice(COOKIE_NAME.length + 1)));
}

export function setSessionCookie(res, payload) {
    const token = sign(payload);
    const cookie = [
        `${COOKIE_NAME}=${encodeURIComponent(token)}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
        `Max-Age=${MAX_AGE_SECONDS}`,
        process.env.VERCEL_ENV === 'production' ? 'Secure' : null,
    ].filter(Boolean).join('; ');
    res.setHeader('Set-Cookie', cookie);
}

export function clearSessionCookie(res) {
    const cookie = [
        `${COOKIE_NAME}=`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
        `Max-Age=0`,
        process.env.VERCEL_ENV === 'production' ? 'Secure' : null,
    ].filter(Boolean).join('; ');
    res.setHeader('Set-Cookie', cookie);
}

export function requireAuth(req, res) {
    const session = readSessionCookie(req);
    if (!session) {
        res.status(401).json({ error: 'unauthorized' });
        return null;
    }
    return session;
}

// Constant-time compare to avoid timing attacks on the password check.
export function timingSafeEqualStr(a, b) {
    const ab = Buffer.from(a || '', 'utf8');
    const bb = Buffer.from(b || '', 'utf8');
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
