#!/usr/bin/env node
/* Wire media into data/content.json using the vision-verified sort:
   - gallery (Stills) <- editorial photos; if a project has NO editorial in the
     drop, keep its original Stills gallery (from the backup) so it isn't empty.
   - bts <- behind-the-scenes photos.
   - videos <- transcoded clips (unchanged from the prior pass). */

import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = '/Users/matiasvizuals/Desktop/RIDGELINE';
const content = JSON.parse(readFileSync(`${ROOT}/data/content.json`, 'utf8'));
const backup = JSON.parse(readFileSync(`${ROOT}/data/content.json.bak`, 'utf8'));
const manifest = JSON.parse(readFileSync('/tmp/media-manifest.json', 'utf8'));
const images = JSON.parse(readFileSync('/tmp/media-images.json', 'utf8'));

function videoEntries(id, vids) {
    return vids.map((_, i) => {
        const n = String(i + 1).padStart(3, '0');
        return { src: `/media/${id}/video/${n}.mp4`, poster: `/media/${id}/video/${n}.jpg`, label: '' };
    });
}

for (const [id, rec] of Object.entries(manifest)) {
    let p = content.projects[id];
    const isNew = rec.isNew || !p;
    const img = images[id] || { stills: [], bts: [] };
    const orig = backup.projects[id];

    if (isNew && !p) {
        p = content.projects[id] = {
            client: rec.client || '', title: rec.title || id,
            type: 'Commercial / Product', year: '2026',
            vimeo: '', vimeoHash: '', thumb: '',
            description: `Behind the scenes with ${rec.client || 'the team'} on ${rec.title || 'this project'}.`,
            credits: [], gallery: [], bts: [], videos: [],
        };
    }

    // Stills: editorial photos, else fall back to the project's original gallery.
    if (img.stills.length) p.gallery = img.stills.slice();
    else if (orig && Array.isArray(orig.gallery)) p.gallery = orig.gallery.slice();
    else p.gallery = [];

    // Behind the scenes: BTS photos, else original bts.
    if (img.bts.length) p.bts = img.bts.map(im => ({ label: '', img: im }));
    else if (orig && Array.isArray(orig.bts)) p.bts = orig.bts.slice();
    else p.bts = [];

    // Videos
    if (rec.video && rec.video.length) p.videos = videoEntries(id, rec.video);

    // New-project hero poster: a clean editorial still if we have one.
    if (isNew) p.thumb = img.stills[0] || img.bts[0] || p.thumb;

    console.log(`${id}: stills=${p.gallery.length} bts=${p.bts.length} videos=${(p.videos || []).length}${isNew ? '  (NEW)' : ''}${!img.stills.length && orig ? '  [kept original stills]' : ''}`);
}

writeFileSync(`${ROOT}/data/content.json`, JSON.stringify(content, null, 2) + '\n');
console.log('\nWrote data/content.json');
