import { readSessionCookie } from './_lib/auth.js';

export default async function handler(req, res) {
    const session = readSessionCookie(req);
    if (!session) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, exp: session.exp });
}
