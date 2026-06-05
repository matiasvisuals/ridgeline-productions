import { requireAuth } from './_lib/auth.js';
import { clearDraftContent } from './_lib/store.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }
    if (!requireAuth(req, res)) return;

    try {
        await clearDraftContent();
        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: 'discard_failed', message: err.message });
    }
}
