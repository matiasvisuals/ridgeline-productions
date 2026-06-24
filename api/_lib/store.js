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
const PUBLISHED_KEY = 'content:published';

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
    // Fast path: the last published content is cached in Redis on publish, so the
    // live site reflects edits immediately — no waiting for the Vercel rebuild
    // that serves the new static file. Falls back to the build-time snapshot.
    try {
        const kv = await getKv();
        if (kv) {
            const cached = await kv.get(PUBLISHED_KEY);
            if (cached) return cached;
        }
    } catch { /* fall through to the static snapshot */ }

    // Fallback: load via a STATIC require so Vercel's file tracer bundles
    // data/content.json into the serverless function. A runtime process.cwd()
    // readFile is not traced, so the file is missing in prod. The require'd JSON
    // is the build-time snapshot — the committed published content. Deep-copied
    // so callers can't mutate the cached module object.
    const data = require('../../data/content.json');
    return JSON.parse(JSON.stringify(data));
}

// Cache the just-published content for instant reads by the live site.
export async function setPublishedContent(content) {
    const kv = await getKv();
    if (!kv) return; // no Redis → site falls back to the static file after deploy
    await kv.set(PUBLISHED_KEY, content);
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
