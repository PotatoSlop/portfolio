# User Flow & Route Map (Phase 1 prep)

The new navigation, before any code. This defines the Astro `src/pages/`
structure and what links to what. Replaces the old four-dropdown `projects.html`.

Two visual layers (CLAUDE.md): **sketchbook** (landing + playground = neutral
doodle, the "unrendered origin") and **rendered** (discipline pages + deep-dives,
themed per discipline). A sketch→render View Transition crosses between them.

## Routes

| Route | Layer | Purpose |
|---|---|---|
| `/` | sketchbook | Landing. 3 drag-drop doors + Playground link + Nob tease. |
| `/engineering` | rendered (eng theme) | Discipline page: hero + project grid. |
| `/design` | rendered (design theme) | Discipline page: hero + grid. |
| `/software` | rendered (software theme) | Discipline page: hero + grid. |
| `/projects/[id]` | rendered (inherits discipline theme) | Deep-dive template (from content collection). |
| `/playground` | sketchbook | Raw gallery of ALL projects + folded-in photo gallery. |

That's the whole surface. No `/about` or `/contact` decision yet — see open
questions; the old `about.html` / `contact.html` still exist to port.

## Flow diagram

```
                          ┌─────────────────────────────┐
                          │   /  (sketchbook landing)    │
                          │  persistent anchor: NAME ▍   │
                          └──────────────┬──────────────┘
        drag door  ┌──────────────┬──────┴───────┬───────────────┐  direct
   (sketch→render) │              │              │               │  links
                   ▼              ▼              ▼               ▼
            /engineering      /design       /software      /playground
           (eng theme)    (design theme)  (sw theme)     (sketch layer)
                   │              │              │               │
        hero+grid  │   hero+grid  │   hero+grid  │   all cards   │
                   ▼              ▼              ▼    + photos    ▼
              ┌────────────────────────────────────┐      (browse-for-
              │      /projects/[id]  (deep-dive)    │       pleasure)
              │  Overview/Process/Gallery/Outcome   │
              │  + suggested-projects (CROSS-disc) ─┼──► another /projects/[id]
              └────────────────────────────────────┘     in a DIFFERENT discipline

   Nob tease on landing ───────────────────────────────► /projects/nob (skip the door)
```

## Per-route detail

### `/` — sketchbook landing
- Three drag-and-drop "doors": **Engineering / Design / Software** (port
  `landing-page.js` drag logic → React island).
- Direct **"browse the sketchbook"** link → `/playground` (don't gate it behind a door).
- **Tease the hardware flagship (Nob)** with a direct path to `/projects/nob` —
  don't hide the flagship behind a door.
- Persistent anchor (name + amber identity tick) — present here and everywhere.

### `/engineering` `/design` `/software` — discipline pages (rendered)
- IDENTICAL skeleton; only theme tokens swap (engineering = machined/blueprint,
  software = editor/terminal, design = editorial/gallery).
- **Hero** = the discipline's star project, then a **grid** of all projects
  tagged with that discipline.
- Breadcrumb: `Sketchbook / <Discipline>`.

### `/projects/[id]` — deep-dive
- Generated from the project content collection (one MDX per project).
- Sections all optional (light projects stay light): **Overview / Process /
  Gallery / Outcome**. `links` (repo/live/download) render as CTAs.
- **Suggested-projects** reads `related[]` and MUST surface cross-discipline
  links — this is what carries the cross-functional story.
- Breadcrumb: `Sketchbook / <Discipline> / <Project>`.
- Inherits the theme of the discipline you arrived from.

### `/playground` — sketch layer
- Raw, all-projects gallery in the neutral doodle aesthetic (the unrendered origin).
- Optional filters; **default = show everything**.
- Folds in the photo gallery (`photo-gallery` project, photos by `location`).
- Reachable directly from the landing.

## Which projects surface where (from INVENTORY.md)

A project appears in every discipline grid it's tagged with (multi-discipline =
multi-appearance, no file duplication).

| Project | eng | design | software | hero? |
|---|:--:|:--:|:--:|---|
| nob | ✅ | | ✅ | **eng hero** |
| automated-pill-dispenser | ✅ | | | |
| peacemaker | | ✅ | | design hero? (TBD) |
| low-poly-boat | | ✅ | ✅ | |
| color-match | | ✅ | ✅ | |
| portfolioslop | | | ✅ | software hero? (TBD) |
| photo-gallery | | | ✅ | |
| *(Phase 5: macropad, led-cosplay, club-web, gamedev, uiux)* | … | … | … | |

## Cross-cutting rules (every rendered page)
- **Persistent anchor**: name + amber identity tick rides through every theme
  (the anchoring promise — visitor always knows it's still your site).
- **Breadcrumbs** accurate at every depth (Sketchbook / Engineering / Nob).
- **Sketch→render View Transition** when entering a discipline from the landing.

## Open questions (don't block scaffolding)
1. **Design & Software heroes** — eng hero is locked (Nob). Pick a design hero
   (Peacemaker?) and software hero (Portfolioslop? photo-gallery?) later.
2. **About / Contact** — keep as standalone routes (`/about`, `/contact`,
   porting the existing pages) or fold into the landing/footer? Old EmailJS
   contact form ports as-is (no API change).
3. **Playground filters** — which axes (discipline, subTag, location)? Default
   shows all regardless.
