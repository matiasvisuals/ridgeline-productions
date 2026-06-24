// Unlock the public-site gate. Takes the SAME password as the admin dashboard
// (ADMIN_PASSWORD); on success it sets the rdgl_unlock cookie that the Edge
// middleware checks, so the client can view the live site to verify their edits.
import { timingSafeEqualStr } from './_lib/auth.js';

const COOKIE = 'rdgl_unlock';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    const token = process.env.SITE_UNLOCK_TOKEN;
    if (!adminPassword || !token) return res.status(500).json({ error: 'gate_not_configured' });

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const submitted = body?.password || '';

    if (!timingSafeEqualStr(submitted, adminPassword)) {
        await new Promise(r => setTimeout(r, 400)); // slow brute force
        return res.status(401).json({ error: 'invalid_password' });
    }

    const cookie = [
        `${COOKIE}=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${MAX_AGE}`,
        process.env.VERCEL_ENV === 'production' ? 'Secure' : null,
    ].filter(Boolean).join('; ');
    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ ok: true });
}
