# Portfolio Refactor — Plan of Attack

Target stack: **Astro + React islands + TypeScript**, R3F + drei for 3D, Astro View Transitions for the sketch→render cross-fades, deployed to GitHub Pages (keep `dylanchen.me` CNAME).

## How to use this
- `[ ]` = todo, `[x]` = done. Work top-down; don't skip the ship gates.
- Four principles that override convenience when they conflict:
  1. **Lock the data model before building anything that reads from it.**
  2. **Ship one full vertical slice before going wide.** A deployed slice beats a perfect half-built site.
  3. **Three themes, ever.** Theme by discipline, never by project.
  4. **Don't let new project pages jump ahead of the proven skeleton.**

---

## Phase 0 — Foundations & prep

### 0.0 Branch & safety net
- [ ] Create a working branch off `main` (e.g. `git checkout -b refactor/astro-rebuild`)
- [ ] Confirm `main` still builds/deploys untouched as your live fallback
- [ ] Push the branch to origin so work is backed up

### 0.1 Lock the content/data model (the keystone)
- [ ] Draft the project schema (one record per project):
  - `id`, `title`, `status` (shipped / WIP)
  - `disciplines[]` — one or more of: engineering, design, software
  - `subTags[]` — e.g. hardware, firmware, 3d, illustration, uiux, webdev, gamedev
  - `hero` (bool — eligible for a discipline hero slot)
  - `media` (cover image, model GLB path, gallery images)
  - case-study fields (overview, process, outcome) — all optional
  - `related[]` — ids of cross-category suggested projects
- [ ] Write the rule down: **every project has ≥1 discipline; cross-functional projects get multiple**
- [ ] Decide the location axis for photos (you already have `location` — reuse it)

### 0.2 Project inventory
- [ ] List every existing + incoming project, assign disciplines + subTags
- [ ] Mark the hardware flagship for the Engineering hero (Nob)
- [ ] For each, note `related[]` that deliberately **cross categories** (e.g. Nob → firmware + industrial design)

### 0.3 Asset prep (runs in parallel — doesn't block code)
- [ ] Export Nob from SolidWorks → STEP → GLB with named/separable parts
- [ ] Decimate the GLB + bake normals so it's web-weight; verify part names survive
- [ ] Collect case-study content/images for Nob (and Pill Dispenser if doing it early)

### 0.4 Learning spikes (off the critical path)
- [ ] Throwaway Astro + React + TS sandbox — get comfortable with islands & content collections
- [ ] Separate tiny R3F + drei sandbox — load a GLB, orbit, animate one part

**Ship gate:** schema is written down, inventory is tagged, Nob GLB loads in the R3F sandbox.

---

## Phase 1 — Stack setup

- [ ] Scaffold Astro project in the branch, add TypeScript
- [ ] Add the React integration (`@astrojs/react`)
- [ ] Define the Phase 0 schema as a content collection (Zod)
- [ ] Port CSS variables from `style.css` → global design tokens
- [ ] Create the per-theme token files (engineering / design / software) as token overrides only
- [ ] Enable View Transitions (`<ViewTransitions />`)
- [ ] Confirm `astro build` → GitHub Pages deploy works end-to-end (with CNAME) before building real pages

---

## Phase 2 — Refactor existing infrastructure

### 2.1 Keep & port
- [ ] Drag-drop landing logic (`landing-page.js`) → React island
- [ ] 3D viewer (`viewer3d.js`, Three.js) → R3F island
- [ ] Contact form + validation (`contact.js`, EmailJS) → island (no API changes)
- [ ] About-page scroll animation (`about.js`) → component/island
- [ ] Nav, hamburger, theme-switch (`hamburger-menu.js`, `page-effects.js`) → shared layout
- [ ] Photo data (`gallery.js`) → content data

### 2.2 Cut / replace
- [ ] Remove the four-dropdown `projects.html` structure
- [ ] Remove `projects.js` dropdown logic (replaced by tag-driven discipline pages + Playground)
- [ ] Retire the single arbitrarily-sorted gallery (replace with tag/location grouping)

### 2.3 Reframe
- [ ] Demote photography from top-level → a Programming project (the gallery system)
- [ ] Plan the same gallery to double as Playground browse content

---

## Phase 3 — Vertical slice (one full path, deployed)

Build the whole pipeline on the **Engineering/hardware** path only.

### 3.1 Shared skeleton (used by every page later)
- [ ] Layout shell: persistent anchor bar (name + identity tick), breadcrumb component
- [ ] Type scale, spacing rhythm, motion timing — defined once
- [ ] Project deep-dive template (Overview / Process / Gallery / Outcome — all optional sections)
- [ ] Suggested-projects component (reads `related[]`, renders cross-category links)

### 3.2 Engineering theme (skin #1)
- [ ] Engineering token set (charcoal studio, blueprint grid, dimension/mono accents)

### 3.3 Wire the path
- [ ] Landing: 3 drag-drop doors (Engineering / Design / Software)
- [ ] Landing: direct "browse the sketchbook" link → Playground stub
- [ ] Landing: tease the hardware flagship (don't hide it behind a door)
- [ ] Sketch→render View Transition on entering a discipline
- [ ] Engineering page: hero = hardware flagship + project grid (Engineering-tagged)
- [ ] Nob case study: R3F teardown — story mode (scroll explode) → explore mode handoff
- [ ] Nob mobile teardown treatment (bottom caption, no leader lines)
- [ ] Cross-category suggested projects on the Nob page
- [ ] Breadcrumbs correct at every stage (Sketchbook / Engineering / Nob)

**Ship gate:** this path is deployed and clickable on `dylanchen.me`'s preview/branch build. You now have a real portfolio.

---

## Phase 4 — Go wide

### 4.1 Remaining themes (skin swaps only)
- [ ] Software theme (compiled/editor feel — mono, caret/syntax accents)
- [ ] Design theme (editorial/gallery — whitespace, color, print-like type)
- [ ] Verify the skeleton is unchanged across all three (tokens only)

### 4.2 Port remaining projects
- [ ] Move existing projects into the content collection
- [ ] Full case studies for the deep ones; keep light projects light (card + a few images)

### 4.3 Playground (the sketch-layer)
- [ ] Raw all-projects gallery in the neutral sketch aesthetic
- [ ] Optional filters, default to showing everything
- [ ] Fold in the photo gallery as browse-for-pleasure content
- [ ] Reachable directly from the landing

**Ship gate:** all three disciplines + Playground live; every current project has a home.

---

## Phase 5 — New content (hardware first)

- [ ] Mechanical macropad (OLED + rotary) — hardware + firmware + enclosure design tags
- [ ] LED 3D-printed cosplay parts — electronics + design + open-source LED code tags
- [ ] Full-stack club web project — software (+ teamwork signal)
- [ ] Additional game-dev projects — software + design
- [ ] UI/UX case study — design (formatted to the deep-dive template)
- [ ] Update each new project's `related[]` to cross categories

---

## Phase 6 — Polish & finalize

- [ ] Refine each theme's distinctiveness + the sketch→render transitions
- [ ] Dedicated mobile pass (esp. teardown + drag-drop on touch)
- [ ] Accessibility: visible focus, `prefers-reduced-motion`, alt text, keyboard nav
- [ ] Performance: GLB optimization, lazy/responsive images, island hydration only where needed
- [ ] Per-project SEO/meta + social cards (recruiters open cold links)
- [ ] Cross-browser + deep-link behavior (landing straight on a project page)
- [ ] Final QA on the connective tissue: suggested-projects actually crosses categories
- [ ] Merge branch → `main`, deploy, confirm `dylanchen.me` live

---

## Parking lot (decide later, don't block on these)
- [ ] Whether the Software/Game-dev split needs its own in-page segmentation
- [ ] Whether to add a separate experiments/process layer to the Playground (only if content accrues)
- [ ] Subject-level photo tagging beyond location
