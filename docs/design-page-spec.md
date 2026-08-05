# Design discipline page — spec & migration plan

Source of truth for porting the standalone prototype
(`public/prototypes/scroll-rows.html`) into the real Astro app
(`src/pages/design.astro`). The prototype is fully working; this doc captures
every decision so the migration is mechanical.

---

## 1. Concept

The site's thesis is **branching disciplines** — each discipline sub-page wears a
distinct, contrasting visual style. The design page is the **editorial / gallery**
one: warm cream paper, deco display type, a dark-navy motif, amber identity accent.
Its internal contrast (studio row vs. editorial case studies vs. dense masonry vs.
navy grid) is fractal to the site's cross-discipline contrast.

Photography does **not** live here — it belongs in the playground (capture, not
design). Exception: design-adjacent shots (3D-print product photos, staged poster
mockups) can appear as work documentation.

---

## 2. Page structure (top → bottom)

| # | Section | Treatment |
|---|---------|-----------|
| — | Hero | Big left-aligned `DESIGN` (deco), breadcrumb, caption, Featured/Recent toggle, full-width linked feature card |
| 01 | 3D models | Horizontal drift row (drifts ◀), studio look. Click → model viewer |
| 02 | UI / UX | Horizontal drift row (drifts ▶, opposite dir). Click → full case study |
| 03 | 2D / posters | 4-col masonry, columns alternate scroll ▲/▼. Click → zoom modal |
| 04 | All work | Master grid, tag-filtered, bold **navy** block. "View all" from each zone scrolls here + applies that tag |

- **Game assets** is a **tag**, not a section — it surfaces across 3D/2D and has one
  filtered view in the master grid.
- Each zone's "view all" → scrolls to the master grid and auto-applies its tag
  (the keystone that unifies curated showcase with comprehensive browse in one SPA page).

---

## 3. Visual system

- **Paper** `#f3efe6` (cream). Master-grid section is a bold **navy** block `#0e1a30`.
- **Ink** = dark navy `#16233a` (carries the navy motif through body text; not black).
  Muted `#6c7183`.
- **Accent** = amber, two-tone: `--accent #F5A045` (site identity `--color-primary`,
  bright — on navy + fills) and `--accent-deep #b5611b` (readable amber for small
  text on cream; bright amber fails contrast there). Terracotta `#c8553d`
  (`--theme-accent` in `styles/themes/design.css`) is the swap if keeping the page
  independent from the global amber.
- **Fonts**: display (titles, logo) = **Dela Gothic One** (modernist-Asian deco;
  local *Chinese Rocks RG* is the eventual `--font-title`; `Zen Dots`/`RocknRoll One`
  are loaded alternates). All small UI text = **Archivo @600**. Rule: only two
  families — deco or body. (Big Shoulders was retired — too thin.)
- **Selection**: `::selection` = amber on navy ink.
- **Cards**: big, squarish (`5px` radius). Hover = drop shadow + inner `scale()` in a
  fixed frame (no translate). Same on masonry + grid tiles.
- **Icons**: Iconify (`iconify-icon`, mdi set).

### Chrome = floating islands
No nav bar, no divider. Shared island look: translucent cream, blur, 1px border,
5px radius, soft shadow.
- **Top nav**: logo island pinned top-left; `Home · About · Contact` centered.
  Top-**right** is reserved for the `PullTabs` component (disciplines live there, not
  the top nav). Nav hover = border-amber (matches chips). Logo hover = **navy** fill
  sweep (bottom-up) + text→cream; small amber square is the identity tick.
- **Scroll rail**: center-right island, numbers-only `01–04` (clickable), active →
  deep amber, thin progress line, symmetric 14px padding, ticks at true section
  positions (none active in hero).
- **Corner toggles** (bottom-right, fixed): reduced-motion (eye open/closed) +
  dark-mode stub (moon) — the site-wide home for both.

---

## 4. Interaction mechanics

### Scroll-responsive drift (not scroll-jacked)
Rows drift at an ambient speed; scroll **velocity** boosts it. Opposite directions
on the two rows = parallax energy. Masonry columns alternate up/down.
- Constants: `AMBIENT` (idle px/s), `SCROLL_GAIN 2.6` (covers whole cards; ~2.0 if
  too fast), `SMOOTH 0.12`, `HOVER_SLOW 0.34` (hovered rows stay alive),
  `HOVER_RAMP 0.06` (gentle ease-down on hover).
- **Seamless loop**: children duplicated once; wrap period = the first CLONE's offset
  (`children[count].offsetLeft`), NOT `scrollWidth/2` (off by ~half a gap → visible hitch).
- Animate `transform: translate3d` only (GPU), throttle via rAF.

### Master grid + filter
Stub tiles carry `data-tags`; chips filter (all / 3d / uiux / 2d / game-asset).
Active chip = amber fill; hover = amber border. Section must be `justify-content:
flex-start` (centering re-shifts the title when filtering changes content height).

### Hero Featured/Recent toggle
Segmented control swaps the highlighted hero project; the feature card is an `<a>`
whose `href` swaps to that project's interactive feature (model viewer / case study).

---

## 5. Load / reveal animation system

**Order**: nav + logo + rail present immediately → breadcrumb, caption, toggle,
feature come in (≈150ms) → `DESIGN` color block fills (≈700ms). Section titles and
grid containers reveal on scroll-into-view.

- **Color-block reveal** (`wrapCharsReveal`): each char = overflow-hidden cell + a
  color-block `.br-cover` (covers spaces too, so the block is contiguous) + an
  opacity-gated `.br-glyph`. `brBlock` keyframe: cover **crops in from the bottom**
  (`translateY 101%→0`), holds (42→54%), then exits the top (`→ -110%`); glyph flips
  visible at 42% (while covered) so it starts truly blank. Left→right per-char
  stagger `calc(var(--i)*45ms)`. Colors: amber for `DESIGN` + `All work`, navy for
  the other section titles.
- **Featured card**: `boxReveal` = N vertical `.br-strip`s doing `brBlock`; content
  wrapped in `.hf-inner` (opacity-gated), cleaned up ~1450ms so toggling doesn't
  re-run it.
- **Breadcrumb / caption / toggle**: `.crop-lr` — clip-path wipe left→right, no block.
- **Grid containers** (drift rows, masonry, master grid): `.crop-tb` — clip-path
  wipe top→bottom, no block.
- **Reduced motion**: reveal everything immediately; drop the loop-stitching clones
  (`.is-clone` → display:none) leaving originals in native scroll.

### ⚠️ Gotcha (bites in real browsers, not just preview)
A `clip-path`-clipped element reports **0 intersection** to `IntersectionObserver` →
`.in` never fires → clipped forever. **Observe the unclipped parent section**, not the
clipped child.

---

## 6. Data model (content collections)

One schema across categories so adding work = drop a file, no layout edits:

```ts
{
  title: string,
  category: '3d' | 'uiux' | '2d',
  tags: string[],            // e.g. ['game-asset','pixel','lowpoly']
  media: { image | video + poster },   // reuse the video-poster/cover pattern
  aspect?: string,
  year?: number,
  tools?: string[],
  featured?: boolean,        // landing spread + Featured hero pick
  recent?: boolean,          // Recent hero pick
  caseStudy?: reference,     // UI/UX only → full case-study route
}
```
- Landing rows render `featured` subset; each sub-view / master grid renders the full
  `category` set. Arcade view = `tags.includes('game-asset')` across everything.
- 3D: start with turntable **video posters** (cheap, reuse poster pattern), promote
  individual pieces to live model-viewer later.

---

## 7. Migration plan (prototype → Astro)

1. **Theme**: fold the palette/fonts into `styles/themes/design.css` +
   `styles/tokens.css` (Dela Gothic, Archivo, amber two-tone, navy ink).
2. **Content**: add a `design` (or extend `projects`) collection with the §6 schema;
   author a few real entries.
3. **Components** (`src/components/design/`): `HeroProject.astro` (toggle + linked
   card), `MarqueeRow.astro` (3D/UIUX), `MasonryGrid.astro`, `FilterGrid.astro` (chips +
   tiles), `ScrollRail.astro`, `SettingsToggles.astro` (now lifted into Base as
   site-wide chrome). Nav/pull-tabs already exist.
4. **Motion** (`src/lib/motion/`): add reusable primitives —
   `carousel.ts` (scroll-responsive infinite loop),
   `design-reveal.ts` (`wrapCharsReveal` + `boxReveal`),
   `crop-reveal.ts` (crop-lr / crop-tb with the parent-observe fix),
   `scroll-rail.ts`. Mirror durations into `tokens.ts`. Honor `prefersReducedMotion()`.
5. **Page**: rebuild `src/pages/design.astro` from these, wrapped in `Base` with
   `theme="design"` + `PullTabs`. Verify ClientRouter (`astro:page-load` /
   `astro:before-swap`) mounts/destroys each behavior — reuse the video-poster
   still-poster fix for card videos on SPA nav.
6. Scoped-style caveat: an ancestor `[data-theme]` selector needs `:global()`
   (see the astro-scoped-ancestor-global note).

Prototype stays as the visual reference until parity is reached.
