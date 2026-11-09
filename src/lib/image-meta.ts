import path from 'node:path';

/*
  image-meta.ts — build-time facts about a public image: its displayed size
  (EXIF-aware) and the average colour of its outer edge.

  Used where a layout must take an image's OWN shape instead of cropping it to a
  fixed frame (the /design featured card): the box gets `aspect-ratio: w / h`,
  and any leftover space is painted in the edge colour so it reads as part of
  the image, not as a letterbox bar.

  sharp is a devDependency; if it can't read the file, a neutral 16:10 cream
  fallback keeps the build going.
*/

export interface ImageMeta {
  width: number;
  height: number;
  /** Average colour of the image's outer ring, e.g. '#ebe5d7'. */
  edge: string;
}

const FALLBACK: ImageMeta = { width: 16, height: 10, edge: '#e9e3d6' };
const cache = new Map<string, Promise<ImageMeta>>();

async function read(publicPath: string): Promise<ImageMeta> {
  try {
    type Sharp = typeof import('sharp');
    const mod = (await import('sharp')) as unknown as { default?: Sharp };
    const sharp = mod.default ?? (mod as unknown as Sharp);
    const file = path.join(process.cwd(), 'public', decodeURIComponent(publicPath.replace(/^\//, '')));
    const m = await sharp(file).metadata();
    const turned = (m.orientation ?? 1) >= 5; // EXIF 5–8 display rotated 90°
    const width = (turned ? m.height : m.width) ?? FALLBACK.width;
    const height = (turned ? m.width : m.height) ?? FALLBACK.height;

    // Average the outer 2px ring of a 40×40 thumbnail.
    const N = 40;
    const { data } = await sharp(file).rotate().removeAlpha().resize(N, N, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (x > 1 && x < N - 2 && y > 1 && y < N - 2) continue;
        const i = (y * N + x) * 3;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
    return { width, height, edge: `#${hex(r)}${hex(g)}${hex(b)}` };
  } catch {
    return FALLBACK;
  }
}

export function imageMeta(publicPath: string | undefined): Promise<ImageMeta> {
  if (!publicPath) return Promise.resolve(FALLBACK);
  let p = cache.get(publicPath);
  if (!p) cache.set(publicPath, (p = read(publicPath)));
  return p;
}
