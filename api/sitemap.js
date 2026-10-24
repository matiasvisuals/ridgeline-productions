// /sitemap.xml (rewritten here in vercel.json). Built from the published
// content, so a project added in the portal shows up after Publish.
import { getPublishedContent } from './_lib/store.js';

const SITE = 'https://ridgelineproductions.com';

export default async function handler(req, res) {
    let ids = [];
    try {
        const content = await getPublishedContent();
        ids = Object.keys((content && content.projects) || {});
    } catch { /* still list the main pages */ }

    const today = new Date().toISOString().slice(0, 10);
    const urls = [
        { loc: `${SITE}/`, priority: '1.0' },
        { loc: `${SITE}/work`, priority: '0.8' },
        ...ids.map(id => ({ loc: `${SITE}/work/${encodeURIComponent(id)}`, priority: '0.7' })),
    ];
    const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n') +
        '\n</urlset>\n';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
    res.status(200).send(body);
}
