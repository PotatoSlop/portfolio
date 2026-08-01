import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Locked data model — see SCHEMA.md. Change only with a deliberate reason.
const DISCIPLINES = ['engineering', 'design', 'software'] as const;
const SUBTAGS = [
  'hardware',
  'firmware',
  '3d',
  'illustration',
  'uiux',
  'webdev',
  'gamedev',
] as const;

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      status: z.enum(['shipped', 'wip']),
      // Concrete project timeline, shown as the card's eyebrow ("2025 – Present").
      // `ended` omitted = still active → renders as "Present". Supersedes `status`
      // for display; `status` is kept for any non-display logic.
      started: z.string(),
      ended: z.string().optional(),
      // Descriptive tech stack. NEVER shown on the card — travels to the case
      // study overlay's "Built with" spec list (injected from data-tech).
      tech: z.array(z.string()).default([]),
      // Non-empty: every project belongs to ≥1 discipline. Multiple = cross-functional.
      disciplines: z.array(z.enum(DISCIPLINES)).min(1),
      subTags: z.array(z.enum(SUBTAGS)).default([]),
      hero: z.boolean().default(false),
      order: z.number().default(0),
      // The card's RESTING FRAME — a still image resolved through the image
      // pipeline (astro:assets): optimized, hashed, format-converted. Path is
      // relative to the .mdx file; optional so WIP stubs validate. On a video
      // card (`posterVideo` set) this same still is the <video poster>, so the
      // tile always paints real content instantly — including after an SPA
      // (ClientRouter) hop, where a bare <video> would otherwise sit blank.
      cover: image().optional(),
      // Optional hover-scrub "boomerang" clip (forward footage + its own reverse
      // in one file). ABSOLUTE PUBLIC PATH (e.g. /Assets/engineering/foo.mp4) —
      // video has no astro:assets import, so it lives in public/ and is served
      // verbatim. When set, the card upgrades from a static image to the
      // hover-scrubbed <video>, using `cover` as its poster still.
      posterVideo: z.string().optional(),
      // Per-project framing inside the tile mask. The tile is a fixed frame
      // (overflow clipped); the cover is laid at the tile's top-left at full
      // tile width, then moved by EXACT PIXELS and zoomed from that corner:
      //   coverX → px right (negative = left)
      //   coverY → px down  (negative = up)
      //   coverScale → zoom multiplier (1 = image spans the tile width)
      coverX: z.number().default(0),
      coverY: z.number().default(0),
      coverScale: z.number().default(1),
      glb: z.string().optional(),
      gallery: z.array(z.string()).default([]),
      // Outbound CTAs — most light projects are primarily a card + one of these.
      links: z
        .object({
          repo: z.string().url().optional(),
          live: z.string().url().optional(),
          download: z.string().url().optional(),
        })
        .optional(),
      overview: z.string().optional(),
      process: z.string().optional(),
      outcome: z.string().optional(),
      // Validated refs; point these ACROSS disciplines on purpose.
      related: z.array(reference('projects')).default([]),
    }),
});

export const collections = { projects };
