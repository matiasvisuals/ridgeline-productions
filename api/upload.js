// Client-upload handshake for Vercel Blob. The admin browser calls
// `upload(..., { handleUploadUrl: '/api/upload' })`; this route authorizes the
// logged-in admin and mints a one-time, scoped client token so the file streams
// straight to Blob storage (bypassing the serverless request-body size limit).
import { handleUpload } from '@vercel/blob/client';
import { readSessionCookie } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    // Gate on the same admin session the rest of the dashboard uses.
    if (!readSessionCookie(req)) {
        return res.status(401).json({ error: 'unauthorized' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }

    try {
        const jsonResponse = await handleUpload({
            body,
            request: req,
            onBeforeGenerateToken: async () => ({
                allowedContentTypes: [
                    'video/mp4', 'video/webm', 'video/quicktime',
                    'image/jpeg', 'image/png', 'image/webp',
                ],
                addRandomSuffix: true,
                maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB ceiling
            }),
            // Nothing to persist server-side — the URL is saved into content.json
            // by the dashboard when the upload resolves.
            onUploadCompleted: async () => {},
        });
        return res.status(200).json(jsonResponse);
    } catch (err) {
        return res.status(400).json({ error: 'upload_failed', message: err.message });
    }
}
