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
  schema: z.object({
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
      // The card's RESTING FRAME — an ABSOLUTE PUBLIC PATH to a still image
      // (e.g. /Assets/software/walk-louder.jpg), served verbatim from public/. Optional
      // so WIP stubs validate. On a video card (`posterVideo` set) this same
      // still is the <video poster>, so the tile always paints real content
      // instantly — including after an SPA (ClientRouter) hop, where a bare
      // <video> would otherwise sit blank. See docs/asset-conventions.md.
      cover: z.string().optional(),
      // Optional hover-scrub "boomerang" clip (forward footage + its own reverse
      // in one file). ABSOLUTE PUBLIC PATH (e.g. /Assets/engineering/foo.mp4) —
      // video has no astro:assets import, so it lives in public/ and is served
      // verbatim. When set, the card upgrades from a static image to the
      // hover-scrubbed <video>, using `cover` as its poster still.
      posterVideo: z.string().optional(),
      // Optional hover-to-play animated GIF (a short looping gameplay/demo clip).
      // ABSOLUTE PUBLIC PATH (e.g. /Assets/software/foo-hover.gif). The card keeps
      // `cover` as its resting still; on hover/focus the GIF fades in over it from
      // frame 0 and fades out on leave (src/lib/motion/hover-gif.ts). Requires
      // `cover`; never plays under reduced motion. Encode it at the tile's 16:9.
      hoverGif: z.string().optional(),
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

// Design discipline gallery — a SEPARATE collection from the locked `projects`
// model (see docs/design-page-spec.md). One schema across categories so adding
// work = drop a file, no layout edits.
const DESIGN_CATEGORIES = ['3d', 'uiux', '2d'] as const;

const design = defineCollection({
  // .mdx too: a case study's body composes the template blocks
  // (src/components/case-study/blocks.ts) — plain .md entries stay as they are.
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/design' }),
  schema: z.object({
      title: z.string(),
      category: z.enum(DESIGN_CATEGORIES),
      // Cross-cutting tags (e.g. 'game-asset','pixel','lowpoly') — 'game-asset'
      // is a tag, never its own category.
      tags: z.array(z.string()).default([]),
      year: z.number().optional(),
      tools: z.array(z.string()).default([]),
      // Landing spread + Featured hero pick; Recent hero pick.
      featured: z.boolean().default(false),
      recent: z.boolean().default(false),
      // Resting still — ABSOLUTE PUBLIC PATH (e.g. /Assets/design/3d/boat.png),
      // served verbatim from public/. Same raw-path convention as projects.
      cover: z.string().optional(),
      posterVideo: z.string().optional(),
      // Pixel-art / animated-GIF pieces bypass the image pipeline (which resizes
      // and de-animates them, blurring the pixels). `sprite` is a raw PUBLIC path
      // served verbatim with nearest-neighbour scaling; `spriteStatic` is the
      // freeze-frame still shown under reduced motion when `sprite` is a GIF
      // (see src/lib/motion/freeze-gifs.ts, data-freeze).
      sprite: z.string().optional(),
      spriteStatic: z.string().optional(),
      // Per-cover framing overrides for the gallery tiles (cover/sprite <img>):
      //   coverFit      → object-fit ('cover' fills + crops, 'contain' letterboxes)
      //   coverPosition → object-position (e.g. 'center top' to keep the top of a
      //                   portrait render and crop the bottom instead)
      coverFit: z.enum(['cover', 'contain']).optional(),
      coverPosition: z.string().optional(),
      // Where the card's click goes — model viewer, case study, or zoom.
      href: z.string().optional(),
      order: z.number().default(0),

      // ---- Interaction wiring (resolved in src/lib/design-links.ts) ----
      // 3D pieces: PUBLIC path to a .glb (e.g. /Assets/models/boat.glb). When set
      // on a `category: '3d'` entry, the card opens the interactive model viewer
      // modal instead of following `href`. Absent → the card is a non-navigating
      // stub (see the 'stub' tag / badge).
      glb: z.string().optional(),
      // Flip to true once a case study has been WRITTEN (the entry's .mdx body).
      // true routes the card to /design/<id> (any category; a 3D piece with a
      // `glb` keeps opening its viewer). For UI/UX, false (the default) keeps the
      // card WIP-gated: a "case study in progress" state that does NOT navigate.
      caseStudy: z.boolean().default(false),
      // Unfinished study: the /design/<id> page and the card link exist ONLY in
      // `astro dev` (a "Draft" pill marks the page). Production builds skip the
      // page and keep the card gated, so a half-written study can't ship.
      draft: z.boolean().default(false),
      // Work-in-progress lock: /design/<id> renders the shared "case study in
      // progress" stub (hero only, no cover / glance / body) in EVERY build,
      // and the card links to that stub. The .mdx body is kept but never
      // rendered. Remove the flag to publish. Takes precedence over `draft`.
      wip: z.boolean().default(false),
      // Template layout: 'ux' (text-led, sticky contents) or 'visual' (image-led,
      // art on mats). Defaults by category: uiux → ux, 2d/3d → visual.
      caseLayout: z.enum(['ux', 'visual']).optional(),

      // ---- Case-study hero (read only by the /design/<id> template) ----
      // `summary` is the hero lede. Eyebrow defaults to "<Category> case study · <year>".
      summary: z.string().optional(),
      eyebrow: z.string().optional(),
      // Meta grid, in this order: role · timeline · team · tools, then `facts`.
      role: z.string().optional(),
      timeline: z.string().optional(),
      team: z.string().optional(),
      facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
      // Hero buttons (repo, live site, Figma…). The first `primary` is solid.
      links: z
        .array(z.object({ label: z.string(), href: z.string(), primary: z.boolean().default(false) }))
        .default([]),
      // "At a glance" cards under the cover — typically Problem / Approach / Outcome.
      glance: z.array(z.object({ label: z.string(), text: z.string() })).default([]),
      coverCaption: z.string().optional(),
      // Extra imagery appended after the study body — PUBLIC paths, in order.
      gallery: z.array(z.string()).default([]),
    }),
});

export const collections = { projects, design };
