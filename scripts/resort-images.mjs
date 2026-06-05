#!/usr/bin/env node
/* Re-sort photos using the vision-verified editorial allowlist:
   editorial -> stills (gallery), everything else -> bts.
   Dedupes by basename (Giant Shoes duplicates IMAGES/ in BTS/IMAGES/), and
   regenerates ONLY media/<id>/stills and /bts — videos are left untouched. */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const SRC = '/Users/matiasvizuals/Downloads/IMAGES AND BTS';
const ROOT = '/Users/matiasvizuals/Desktop/RIDGELINE';
const MEDIA = join(ROOT, 'media');
const EDITORIAL = new Set(JSON.parse(readFileSync('/tmp/classify/editorial.json', 'utf8')));

const MAP = {
    'GX 550': 'lexus-gx', 'HOKA Carbon x2': 'hoka-carbon', 'HOKA Transport GTX': 'hoka-transport',
    'Leaving a Tread': 'wtb-tread', 'LIV Avow': 'liv-avow', 'rabbit Cadence Kit': 'rabbit-cadence',
    'rabbit High Country': 'rabbit-highcountry', 'Recon + Taillight': 'giant-recon',
    'Reveal Fire Pro': 'seek-thermal', 'WTB CZR Wheels': 'wtb-czr',
    'Giant Helmets': 'giant-helmets', 'Giant Shoes': 'giant-shoes',
};
const IMG_EXT = new Set(['.jpg', '.jpeg', '.png']);

function collect(dir, out) {
    for (const e of readdirSync(dir)) {
        if (e.startsWith('.')) continue;
        const full = join(dir, e);
        if (statSync(full).isDirectory()) collect(full, out);
        else if (IMG_EXT.has(extname(e).toLowerCase())) out.push(full);
    }
}

const images = {};
for (const [folder, id] of Object.entries(MAP)) {
    const srcDir = join(SRC, folder);
    const all = [];
    try { collect(srcDir, all); } catch { continue; }

    // Dedupe by basename; if any duplicate is editorial, keep that copy.
    const byBase = new Map();
    for (const p of all) {
        const b = basename(p);
        if (!byBase.has(b)) byBase.set(b, []);
        byBase.get(b).push(p);
    }
    const reps = [];
    for (const paths of byBase.values()) reps.push(paths.find(p => EDITORIAL.has(p)) || paths[0]);

    const buckets = { stills: [], bts: [] };
    for (const p of reps) (EDITORIAL.has(p) ? buckets.stills : buckets.bts).push(p);
    const sortFn = (a, b) => basename(a).localeCompare(basename(b), undefined, { numeric: true });
    buckets.stills.sort(sortFn); buckets.bts.sort(sortFn);

    const rec = { stills: [], bts: [] };
    for (const kind of ['stills', 'bts']) {
        const outDir = join(MEDIA, id, kind);
        rmSync(outDir, { recursive: true, force: true });
        if (!buckets[kind].length) continue;
        mkdirSync(outDir, { recursive: true });
        buckets[kind].forEach((src, i) => {
            const num = String(i + 1).padStart(3, '0');
            const out = join(outDir, `${num}.jpg`);
            try {
                execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', '-Z', '1800', src, '--out', out], { stdio: 'ignore' });
                rec[kind].push(`/media/${id}/${kind}/${num}.jpg`);
            } catch { /* skip */ }
        });
    }
    images[id] = rec;
    console.log(`${id}: stills=${rec.stills.length} bts=${rec.bts.length}`);
}

writeFileSync('/tmp/media-images.json', JSON.stringify(images, null, 2));
console.log('\nWrote /tmp/media-images.json');
