/*
  optimize-photos.mjs — web-sized derivatives for the /design Photography section.

  The originals in public/Assets/Photography are camera exports (up to ~11 MB each,
  ~80 MB total), far too heavy to stream into a 4-column masonry. This writes two
  WebP derivatives per photo, auto-rotated from EXIF:

    public/Assets/Photography/web/thumb/<slug>.webp   800px long edge  (grid tiles)
    public/Assets/Photography/web/large/<slug>.webp   2000px long edge (lightbox)

  src/lib/photos.ts serves these when they exist and falls back to the original
  otherwise, so a newly dropped photo still shows up before this has been re-run.

  Usage:  npm run photos          (only builds missing / outdated derivatives)
          npm run photos -- --force
*/
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { photoSlug, PHOTO_EXT } from '../src/lib/photo-slug.mjs';

const ROOT = path.join(process.cwd(), 'public', 'Assets', 'Photography');
const OUT = path.join(ROOT, 'web');
const SIZES = [
  { dir: 'thumb', edge: 800, quality: 78 },
  { dir: 'large', edge: 2000, quality: 82 },
];
const force = process.argv.includes('--force');

const files = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isFile() && PHOTO_EXT.test(d.name))
  .map((d) => d.name);

for (const { dir } of SIZES) fs.mkdirSync(path.join(OUT, dir), { recursive: true });

let made = 0;
let skipped = 0;
for (const name of files) {
  const src = path.join(ROOT, name);
  const srcTime = fs.statSync(src).mtimeMs;
  for (const { dir, edge, quality } of SIZES) {
    const dest = path.join(OUT, dir, `${photoSlug(name)}.webp`);
    if (!force && fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= srcTime) {
      skipped++;
      continue;
    }
    await sharp(src)
      .rotate() // bake in EXIF orientation
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toFile(dest);
    made++;
  }
}

// Remove derivatives whose original is gone.
const live = new Set(files.map((f) => `${photoSlug(f)}.webp`));
let removed = 0;
for (const { dir } of SIZES) {
  for (const f of fs.readdirSync(path.join(OUT, dir))) {
    if (!live.has(f)) {
      fs.rmSync(path.join(OUT, dir, f));
      removed++;
    }
  }
}

console.log(`photos: ${files.length} originals → ${made} written, ${skipped} up to date, ${removed} stale removed`);
