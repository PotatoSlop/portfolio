# Content / Data Model — the keystone (Phase 0.1)

This is the **locked** project schema. Everything downstream reads from it:
discipline grids, the Nob deep-dive, suggested-projects, the Playground. Change a
field here only with a deliberate reason — once Phase 1 pages consume it, a change
ripples through all of them (Principle #1: lock the data model first).

Phase 1 converts this spec verbatim into `src/content.config.ts` as a Zod content
collection (loader API). Until then, this markdown IS the source of truth.

---

## The project record (one MDX file per project)

Frontmatter = queryable metadata. MDX body = the optional rich case study
(embed islands here). Light projects stay frontmatter-only — no forced template.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | slug | yes | Derived from filename; stable, lowercase-kebab. |
| `title` | string | yes | Display name. |
| `status` | `"shipped" \| "wip"` | yes | |
| `disciplines` | `Discipline[]` | yes, **min 1** | One or more of the three. Multiple = cross-functional; the file surfaces in multiple discipline views without duplication. |
| `subTags` | `SubTag[]` | no (default `[]`) | From the fixed enum below. |
| `hero` | boolean | no (default `false`) | Eligible for a discipline hero slot. |
| `order` | number | no (default `0`) | Sort within a discipline grid (lower = earlier). |
| `cover` | image | no | Card / grid cover image. Optional so frontmatter-only WIP stubs validate; shipped projects should have one (placeholder otherwise). |
| `glb` | string (path) | no | GLB model path for R3F deep-dives (e.g. Nob). |
| `gallery` | image[] | no (default `[]`) | Case-study gallery images. |
| `links` | object | no | `{ repo?, live?, download? }` — outbound CTAs (GitHub repo, live demo, asset-store download). Most light projects are primarily a card + one of these, so this is effectively required for them in practice. |
| `overview` | string | no | Short summary line. Rich version lives in MDX body. |
| `process` | string | no | Short summary line. |
| `outcome` | string | no | Short summary line. |
| `related` | reference[] | no (default `[]`) | Validated refs to other project `id`s. **Must cross disciplines on purpose** — this carries the cross-functional story inside a segmented structure. |

### Enums

```
Discipline = "engineering" | "design" | "software"   // exactly these three, ever

SubTag = "hardware" | "firmware" | "3d" | "illustration"
       | "uiux" | "webdev" | "gamedev"               // fixed set; extend deliberately
```

---

## The rules (write these down — they ARE the model)

1. **Every project has ≥1 discipline.** A project with no discipline cannot exist
   — it would have no home page.
2. **Cross-functional projects list several disciplines.** That is the *only*
   mechanism for a project to appear in multiple discipline views. Do not
   duplicate files to achieve cross-listing.
3. **`related[]` must cross disciplines on purpose.** A suggested-projects link
   that stays inside one discipline wastes the slot. Example: Nob (engineering)
   → a firmware/software project AND an industrial-design project.
4. **Three disciplines, ever.** Theme by discipline, never by project.

---

## Photos / gallery — DEFERRED out of the portfolio (revised)

Revised decision: every project Dylan claims is a **standalone GitHub repo**, so
the "gallery system" must not be an embedded portfolio-only artifact masquerading
as a project. It becomes its **own repo + deployed demo** (the demo using the
photography), linked from the portfolio like any other project (repo + live URL)
once it exists. Out of scope this phase.

Consequently: **no `src/data/photos.ts`** and no photo data port now; `gallery.js`
is left untouched. The photo set + `location` organization travel with the future
standalone gallery repo. (Known heads-up for that future port: `gallery.js` has a
bug — three photos use `orientation: 'portrait-short-gallery'` but the renderer
only matches `'portrait-short'`, so they never render.)

---

## Draft Zod (Phase 1 target — for reference, do not create yet)

```ts
// src/content.config.ts  — written in Phase 1, not now
import { defineCollection, reference, z } from "astro:content";

const DISCIPLINES = ["engineering", "design", "software"] as const;
const SUBTAGS = ["hardware", "firmware", "3d", "illustration",
                 "uiux", "webdev", "gamedev"] as const;

const projects = defineCollection({
  // loader: glob({ pattern: "**/*.mdx", base: "./src/content/projects" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    status: z.enum(["shipped", "wip"]),
    disciplines: z.array(z.enum(DISCIPLINES)).min(1),
    subTags: z.array(z.enum(SUBTAGS)).default([]),
    hero: z.boolean().default(false),
    order: z.number().default(0),
    cover: image().optional(),
    glb: z.string().optional(),
    gallery: z.array(image()).default([]),
    links: z.object({
      repo: z.string().url().optional(),
      live: z.string().url().optional(),
      download: z.string().url().optional(),
    }).optional(),
    overview: z.string().optional(),
    process: z.string().optional(),
    outcome: z.string().optional(),
    related: z.array(reference("projects")).default([]),
  }),
});

export const collections = { projects };
```

---

## 0.1 ship-gate checklist

- [x] Schema drafted (this file)
- [x] Discipline rule written down (≥1 discipline per project)
- [x] Photos/gallery DEFERRED — the gallery system becomes its own repo + demo,
      linked as a project later; not part of the portfolio data model.
- [x] Validated against real projects in 0.2 (see INVENTORY.md). Surfaced gaps,
      now fixed here: added `links`, made `cover` optional for stubs.

**Data model is LOCKED.** Changes from here need a deliberate reason.
