import fs from 'node:fs';
import path from 'node:path';
import { photoSlug, PHOTO_EXT } from './photo-slug.mjs';
import { PHOTO_META } from '../data/photos';

/*
  photos.ts — build-time discovery for the /design Photography section.

  Same contract as resumes.ts: drop an image into public/Assets/Photography and it
  shows up on the next build, no code edit. Run `npm run photos` to generate its
  web-sized derivatives (scripts/optimize-photos.mjs); until then the original
  is served as a fallback.

  Each photo's real orientation is read here (EXIF-aware), so the masonry tile
  gets its final aspect in the HTML. That matters: the client-side aspect probe
  (classifyMasonry in design.astro) would otherwise download every photo up front.
*/

export type PhotoAspect = 'landscape' | 'square' | 'portrait';

export interface Photo {
  /** Grid-tile image (800px WebP, else the original). */
  thumb: string;
  /** Lightbox image (2000px WebP, else the original). */
  full: string;
  width: number;
  height: number;
  aspect: PhotoAspect;
  /** False when the header couldn't be read — the client probe then sets the aspect. */
  measured: boolean;
  /** From src/data/photos.ts; absent for a photo with no metadata entry yet. */
  title?: string;
  location?: string;
  alt: string;
  filename: string;
}

const ROOT = path.join(process.cwd(), 'public', 'Assets', 'Photography');
const PUBLIC_BASE = '/Assets/Photography';

// Same thresholds as classifyMasonry() in design.astro.
const aspectOf = (w: number, h: number): PhotoAspect => {
  const r = w && h ? w / h : 0.75;
  return r >= 1.2 ? 'landscape' : r <= 0.83 ? 'portrait' : 'square';
};

const derivative = (dir: 'thumb' | 'large', filename: string): string | null => {
  const rel = `web/${dir}/${photoSlug(filename)}.webp`;
  return fs.existsSync(path.join(ROOT, rel)) ? `${PUBLIC_BASE}/${rel}` : null;
};

/* Spread landscapes evenly through the portraits so no masonry column ends up
   all-wide or all-tall (filenames would otherwise group them). */
function interleave(photos: Photo[]): Photo[] {
  const wide = photos.filter((p) => p.aspect === 'landscape');
  const rest = photos.filter((p) => p.aspect !== 'landscape');
  const [few, many] = wide.length <= rest.length ? [wide, rest] : [rest, wide];
  if (!few.length) return many;
  const out: Photo[] = [];
  const step = (many.length + few.length) / few.length;
  let next = step / 2;
  let fi = 0;
  let mi = 0;
  for (let i = 0; i < photos.length; i++) {
    if (fi < few.length && (i >= next || mi >= many.length)) {
      out.push(few[fi++]);
      next += step;
    } else {
      out.push(many[mi++]);
    }
  }
  return out;
}

export async function getPhotos(): Promise<Photo[]> {
  let files: string[];
  try {
    files = fs
      .readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isFile() && PHOTO_EXT.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return []; // folder missing — no section content rather than a build crash
  }

  // sharp reads only the header here (cheap). It's a devDependency; if it's ever
  // unavailable, tiles fall back to the client-side aspect probe.
  type Sharp = typeof import('sharp');
  let sharp: Sharp | null = null;
  try {
    // sharp is CommonJS (`export =`): the callable is `default` under ESM interop.
    const mod = (await import('sharp')) as unknown as { default?: Sharp };
    sharp = mod.default ?? (mod as unknown as Sharp);
  } catch {
    sharp = null;
  }

  const photos = await Promise.all(
    files.map(async (filename, i): Promise<Photo> => {
      const original = `${PUBLIC_BASE}/${encodeURIComponent(filename)}`;
      let width = 0;
      let height = 0;
      if (sharp) {
        try {
          const m = await sharp(path.join(ROOT, filename)).metadata();
          // EXIF orientations 5–8 are rotated 90°: the browser shows them swapped.
          const turned = (m.orientation ?? 1) >= 5;
          width = (turned ? m.height : m.width) ?? 0;
          height = (turned ? m.width : m.height) ?? 0;
        } catch {
          /* unreadable header — leave 0×0, the client probe decides */
        }
      }
      const meta = PHOTO_META[filename];
      return {
        thumb: derivative('thumb', filename) ?? original,
        full: derivative('large', filename) ?? original,
        width,
        height,
        aspect: aspectOf(width, height),
        measured: width > 0 && height > 0,
        title: meta?.title,
        location: meta?.location,
        alt: meta ? `${meta.title}, ${meta.location}` : `Photograph ${i + 1}`,
        filename,
      };
    })
  );

  return interleave(photos);
}
