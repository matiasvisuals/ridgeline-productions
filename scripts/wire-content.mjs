#!/usr/bin/env node
/* Merge the optimized media manifest into data/content.json:
   - gallery  <- stills
   - bts      <- bts photos ({label, img})
   - videos   <- transcoded clips ({src, poster, label})
   Existing projects keep their hero (thumb/vimeo/credits/copy); new projects
   (Giant Helmets, Giant Shoes) are scaffolded for the team to refine. */

import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = '/Users/matiasvizuals/Desktop/RIDGELINE';
const content = JSON.parse(readFileSync(`${ROOT}/data/content.json`, 'utf8'));
const manifest = JSON.parse(readFileSync('/tmp/media-manifest.json', 'utf8'));

function videoEntries(id, vids) {
    return vids.map((_, i) => {
        const num = String(i + 1).padStart(3, '0');
        return { src: `/media/${id}/video/${num}.mp4`, poster: `/media/${id}/video/${num}.jpg`, label: '' };
    });
}

for (const [id, rec] of Object.entries(manifest)) {
    let p = content.projects[id];
    const isNew = rec.isNew || !p;

    if (isNew && !p) {
        p = content.projects[id] = {
            client: rec.client || '',
            title: rec.title || id,
            type: 'Commercial / Product',
            year: '2026',
            vimeo: '',
            vimeoHash: '',
            thumb: rec.stills[0] || rec.bts[0] || '',
            description: `Behind the scenes with ${rec.client || 'the team'} on ${rec.title || 'this project'}.`,
            credits: [],
            gallery: [],
            bts: [],
            videos: [],
        };
    }

    // Wire media
    p.gallery = rec.stills.slice();
    p.bts = rec.bts.map(img => ({ label: '', img }));
    if (rec.video && rec.video.length) p.videos = videoEntries(id, rec.video);

    console.log(`${id}: gallery=${p.gallery.length} bts=${p.bts.length} videos=${(p.videos || []).length}${isNew ? '  (NEW)' : ''}`);
}

writeFileSync(`${ROOT}/data/content.json`, JSON.stringify(content, null, 2) + '\n');
console.log('\nWrote data/content.json');
