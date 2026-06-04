#!/usr/bin/env node
/* Transcode the BTS source clips listed in the media manifest into web-sized
   mp4 (H.264, long edge ≤1280, faststart) + a poster jpg, under
   /media/<id>/video/NNN.mp4. Uses the bundled static ffmpeg. */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = '/Users/matiasvizuals/Desktop/RIDGELINE';
const FF = join(ROOT, 'scripts/bin/ffmpeg');
const MEDIA = join(ROOT, 'media');
const manifest = JSON.parse(readFileSync('/tmp/media-manifest.json', 'utf8'));

const VF = 'scale=w=1280:h=1280:force_original_aspect_ratio=decrease:force_divisible_by=2';
let done = 0, failed = 0, total = 0;
for (const rec of Object.values(manifest)) total += (rec.video || []).length;
console.log(`Transcoding ${total} clips…\n`);

for (const [id, rec] of Object.entries(manifest)) {
    const vids = rec.video || [];
    if (!vids.length) continue;
    const outDir = join(MEDIA, id, 'video');
    mkdirSync(outDir, { recursive: true });

    vids.forEach((v, i) => {
        const num = String(i + 1).padStart(3, '0');
        const mp4 = join(outDir, `${num}.mp4`);
        const jpg = join(outDir, `${num}.jpg`);
        const src = v.path;
        if (existsSync(mp4)) { done++; return; } // resume-friendly
        try {
            execFileSync(FF, [
                '-y', '-i', src,
                '-vf', VF,
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '24',
                '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                '-c:a', 'aac', '-b:a', '128k',
                mp4,
            ], { stdio: 'ignore' });
            // Poster frame (fall back to first frame if seek past end)
            try {
                execFileSync(FF, ['-y', '-ss', '0.5', '-i', mp4, '-frames:v', '1', '-q:v', '4', jpg], { stdio: 'ignore' });
            } catch {
                execFileSync(FF, ['-y', '-i', mp4, '-frames:v', '1', '-q:v', '4', jpg], { stdio: 'ignore' });
            }
            done++;
            console.log(`✓ ${id}/${num}.mp4  (${done + failed}/${total})  ${basename(src)}`);
        } catch (e) {
            failed++;
            console.log(`✗ FAILED ${id} ${basename(src)} — ${e.message.split('\n')[0]}`);
        }
    });
}

console.log(`\nDone. ${done} transcoded, ${failed} failed.`);
