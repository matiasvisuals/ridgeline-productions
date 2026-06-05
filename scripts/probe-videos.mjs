#!/usr/bin/env node
/* Probe each transcoded clip's display dimensions and write w/h onto every
   video entry in data/content.json, so the project page can render each clip
   at its true aspect ratio (vertical clips stay vertical). */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '/Users/matiasvizuals/Desktop/RIDGELINE';
const FF = join(ROOT, 'scripts/bin/ffmpeg');
const content = JSON.parse(readFileSync(`${ROOT}/data/content.json`, 'utf8'));

function dims(absPath) {
    let out = '';
    try {
        execFileSync(FF, ['-hide_banner', '-i', absPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
        out = (e.stderr || '').toString(); // ffmpeg -i exits non-zero but prints to stderr
    }
    const vLine = out.split('\n').find(l => /Video:/.test(l)) || '';
    const m = vLine.match(/(\d{2,5})x(\d{2,5})/);
    if (!m) return null;
    let w = parseInt(m[1], 10), h = parseInt(m[2], 10);
    // If a rotation side-data flips orientation, swap.
    if (/rotation of -?(90|270)(\.0+)? degrees/.test(out)) [w, h] = [h, w];
    return { w, h };
}

let patched = 0, portrait = 0;
for (const p of Object.values(content.projects)) {
    if (!Array.isArray(p.videos)) continue;
    for (const v of p.videos) {
        const abs = join(ROOT, v.src.replace(/^\//, ''));
        if (!existsSync(abs)) continue;
        const d = dims(abs);
        if (d) { v.w = d.w; v.h = d.h; patched++; if (d.h > d.w) portrait++; }
    }
}

writeFileSync(`${ROOT}/data/content.json`, JSON.stringify(content, null, 2) + '\n');
console.log(`Patched ${patched} clips with dimensions (${portrait} portrait, ${patched - portrait} landscape).`);
