import { requireAuth } from './_lib/auth.js';
import { getDraftContent, clearDraftContent, setPublishedContent } from './_lib/store.js';
import { putFile } from './_lib/github.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }
    if (!requireAuth(req, res)) return;

    try {
        const draft = await getDraftContent();
        if (!draft) {
            return res.status(400).json({ error: 'no_draft_to_publish' });
        }
        // Cache the published content first so the live site updates instantly
        // (the GitHub commit below still runs as the durable source of truth and
        // triggers a redeploy, but the site no longer has to wait for it).
        await setPublishedContent(draft);

        const json = JSON.stringify(draft, null, 2) + '\n';
        const result = await putFile('data/content.json', json, 'chore(content): publish from admin dashboard');
        await clearDraftContent();
        return res.status(200).json({
            ok: true,
            commit: result?.commit?.sha || null,
            url: result?.commit?.html_url || null,
        });
    } catch (err) {
        return res.status(500).json({ error: 'publish_failed', message: err.message });
    }
}
