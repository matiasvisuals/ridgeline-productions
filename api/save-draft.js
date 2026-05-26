import { requireAuth } from './_lib/auth.js';
import { setDraftContent } from './_lib/store.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }
    if (!requireAuth(req, res)) return;

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = null; }
    }
    if (!body || typeof body !== 'object' || !body.content) {
        return res.status(400).json({ error: 'invalid_body' });
    }

    // Basic schema sanity check
    const c = body.content;
    if (!c.about || !c.creatives || !c.services || !c.projects) {
        return res.status(400).json({ error: 'missing_required_sections' });
    }

    try {
        await setDraftContent(c);
        return res.status(200).json({ ok: true, savedAt: new Date().toISOString() });
    } catch (err) {
        return res.status(500).json({ error: 'save_failed', message: err.message });
    }
}
