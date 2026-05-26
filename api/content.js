import { getPublishedContent, getDraftContent } from './_lib/store.js';
import { readSessionCookie } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'method_not_allowed' });
    }
    try {
        const wantDraft = String(req.query.draft || '') === '1';
        if (wantDraft) {
            // Draft access requires auth.
            const session = readSessionCookie(req);
            if (!session) return res.status(401).json({ error: 'unauthorized' });
            const draft = await getDraftContent();
            const published = await getPublishedContent();
            return res.status(200).json({ source: draft ? 'draft' : 'published', content: draft || published });
        }
        const published = await getPublishedContent();
        return res.status(200).json({ source: 'published', content: published });
    } catch (err) {
        return res.status(500).json({ error: 'content_read_failed', message: err.message });
    }
}
