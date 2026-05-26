// Read/write the content store.
// - Published content: fetched from the deployed /data/content.json at runtime.
//   (This is the file Vercel serves as a static asset; using fetch keeps the
//   function bundle small and works in both vercel dev and production.)
// - Draft content: stored in Upstash Redis (connected via Vercel Marketplace).
//   Auto-injected env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.
//   Falls back to KV_REST_API_URL / KV_REST_API_TOKEN for legacy Vercel KV installs.

const DRAFT_KEY = 'content:draft';

let redisClient = null;
async function getKv() {
    if (redisClient !== null) return redisClient;
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
        redisClient = false;
        return null;
    }
    try {
        const mod = await import('@upstash/redis');
        redisClient = new mod.Redis({ url, token });
    } catch (err) {
        console.error('[store] failed to init redis client:', err.message);
        redisClient = false;
    }
    return redisClient || null;
}

export async function getPublishedContent() {
    // Read the bundled data/content.json from disk. Works in both vercel dev
    // and production serverless runtime — process.cwd() is the project root.
    // (We can't fetch our own /data/content.json over HTTP because the internal
    // VERCEL_URL is gated by Vercel's deployment protection / SSO.)
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const path = join(process.cwd(), 'data', 'content.json');
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
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
