#!/usr/bin/env node
/* Optimize the IMAGES AND BTS drop into web-ready assets under /media,
   and emit a manifest mapping each project to its stills / bts / video files.
   Images: resized (max 1800px long edge) + JPEG q70 via macOS `sips`.
   Videos: not transcoded here (needs ffmpeg) — just inventoried for later. */

import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const SRC = '/Users/matiasvizuals/Downloads/IMAGES AND BTS';
const ROOT = '/Users/matiasvizuals/Desktop/RIDGELINE';
const MEDIA = join(ROOT, 'media');

// folder name -> { id, isNew, client, title }
const MAP = {
    'GX 550':                       { id: 'lexus-gx' },
    'HOKA Carbon x2':               { id: 'hoka-carbon' },
    'HOKA Transport GTX':           { id: 'hoka-transport' },
    'Leaving a Tread':              { id: 'wtb-tread' },
    'LIV Avow':                     { id: 'liv-avow' },
    'rabbit Cadence Kit':           { id: 'rabbit-cadence' },
    'rabbit High Country':          { id: 'rabbit-highcountry' },
    'Recon + Taillight':            { id: 'giant-recon' },
    'Reveal Fire Pro':              { id: 'seek-thermal' },
    'WTB CZR Wheels':               { id: 'wtb-czr' },
    'Giant Helmets':                { id: 'giant-helmets', isNew: true, client: 'Giant Bicycles', title: 'Helmets' },
    'Giant Shoes':                  { id: 'giant-shoes',   isNew: true, client: 'Giant Bicycles', title: 'Shoes' },
};

const IMG_EXT = new Set(['.jpg', '.jpeg', '.png']);
const VID_EXT = new Set(['.mov', '.mp4', '.m4v', '.webm']);

// Recurse; an image/video is "bts" if any ancestor folder name contains "bts".
function walk(dir, isBts, buckets) {
    for (const entry of readdirSync(dir)) {
        if (entry.startsWith('.')) continue;
        const full = join(dir, entry);
        const st = statSync(full);
        const bts = isBts || /bts/i.test(entry);
        if (st.isDirectory()) { walk(full, bts, buckets); continue; }
        const ext = extname(entry).toLowerCase();
        if (IMG_EXT.has(ext)) buckets[bts ? 'bts' : 'stills'].push(full);
        else if (VID_EXT.has(ext)) buckets.video.push({ path: full, bts });
    }
}

const manifest = {};

for (const [folder, info] of Object.entries(MAP)) {
    const srcDir = join(SRC, folder);
    if (!existsSync(srcDir)) { console.log(`! missing: ${folder}`); continue; }

    const buckets = { stills: [], bts: [], video: [] };
    walk(srcDir, false, buckets);

    const outBase = join(MEDIA, info.id);
    const rec = { id: info.id, isNew: !!info.isNew, client: info.client, title: info.title, stills: [], bts: [], video: [] };

    for (const kind of ['stills', 'bts']) {
        const files = buckets[kind].sort((a, b) => basename(a).localeCompare(basename(b), undefined, { numeric: true }));
        if (!files.length) continue;
        const outDir = join(outBase, kind);
        mkdirSync(outDir, { recursive: true });
        files.forEach((src, i) => {
            const num = String(i + 1).padStart(3, '0');
            const outName = `${num}.jpg`;
            const outPath = join(outDir, outName);
            try {
                execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', '-Z', '1800', src, '--out', outPath], { stdio: 'ignore' });
                rec[kind].push(`/media/${info.id}/${kind}/${outName}`);
            } catch (e) {
                console.log(`  ! sips failed: ${basename(src)}`);
            }
        });
        console.log(`${info.id} ${kind}: ${rec[kind].length} images`);
    }

    // Videos: just record source paths for the ffmpeg pass.
    rec.video = buckets.video
        .sort((a, b) => basename(a.path).localeCompare(basename(b.path), undefined, { numeric: true }));
    if (rec.video.length) console.log(`${info.id} video: ${rec.video.length} source clips (await transcode)`);

    manifest[info.id] = rec;
}

writeFileSync('/tmp/media-manifest.json', JSON.stringify(manifest, null, 2));
console.log('\nManifest written to /tmp/media-manifest.json');
