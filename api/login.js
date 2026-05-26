import { setSessionCookie, timingSafeEqualStr } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return res.status(500).json({ error: 'admin_password_not_configured' });

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const submitted = body?.password || '';

    if (!timingSafeEqualStr(submitted, adminPassword)) {
        // Small artificial delay to slow brute force
        await new Promise(r => setTimeout(r, 400));
        return res.status(401).json({ error: 'invalid_password' });
    }

    const now = Math.floor(Date.now() / 1000);
    setSessionCookie(res, { sub: 'admin', iat: now, exp: now + 60 * 60 * 8 });
    return res.status(200).json({ ok: true });
}
