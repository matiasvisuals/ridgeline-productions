// Read/write the content store.
// - Published content: fetched from the deployed /data/content.json at runtime.
//   (This is the file Vercel serves as a static asset; using fetch keeps the
//   function bundle small and works in both vercel dev and production.)
// - Draft content: stored in Upstash Redis (connected via Vercel Marketplace).
//   Auto-injected env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.
//   Falls back to KV_REST_API_URL / KV_REST_API_TOKEN for legacy Vercel KV installs.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

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
    // Load the published content via a STATIC require so Vercel's file tracer
    // bundles data/content.json into the serverless function. A runtime
    // process.cwd() readFile is not traced, so the file is missing in prod and
    // the admin loads nothing. The require'd JSON is the build-time snapshot,
    // which is exactly the "published" content. Return a deep copy so callers
    // can't mutate the cached module object.
    const data = require('../../data/content.json');
    return JSON.parse(JSON.stringify(data));
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
