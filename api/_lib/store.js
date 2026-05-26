// Read/write the content store.
// - Published content: fetched from the deployed /data/content.json at runtime.
//   (This is the file Vercel serves as a static asset; using fetch keeps the
//   function bundle small and works in both vercel dev and production.)
// - Draft content: stored in Vercel KV under a single key.

const DRAFT_KEY = 'content:draft';

let kvClient = null;
async function getKv() {
    if (kvClient !== null) return kvClient;
    try {
        const mod = await import('@vercel/kv');
        kvClient = mod.kv;
    } catch {
        kvClient = false;
    }
    return kvClient || null;
}

function baseUrl() {
    // Prefer the VERCEL_URL (deployment) when available; fall back to localhost for vercel dev.
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
    return 'http://localhost:3000';
}

export async function getPublishedContent() {
    const url = `${baseUrl()}/data/content.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`failed_to_fetch_published_content:${res.status}`);
    return res.json();
}

export async function getDraftContent() {
    const kv = await getKv();
    if (!kv) return null;
    const draft = await kv.get(DRAFT_KEY);
    return draft || null;
}

export async function setDraftContent(content) {
    const kv = await getKv();
    if (!kv) throw new Error('kv_not_configured');
    await kv.set(DRAFT_KEY, content);
}

export async function clearDraftContent() {
    const kv = await getKv();
    if (!kv) return;
    await kv.del(DRAFT_KEY);
}
