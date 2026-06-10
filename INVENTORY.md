# Project Inventory (Phase 0.2)

Every existing + incoming project, tagged against [SCHEMA.md](SCHEMA.md). This is
the validation pass: if a project doesn't fit the schema, that's a schema bug to
fix in SCHEMA.md — see **Schema findings** at the bottom (there are some).

Source of truth for the OLD site: `projects.html` (4 dropdowns) + `gallery.js`.
This becomes one MDX file per project in Phase 1.

## Existing projects

| id | title | status | disciplines | subTags | hero | glb | external link | proposed related[] (cross-discipline) |
|---|---|---|---|---|---|---|---|---|
| `nob` | Nob | wip | engineering, **software** | hardware, firmware, 3d | ✅ | yes (teardown) | github.com/PotatoSlop/Nob | `peacemaker` (design/3d ↔ enclosure), `portfolioslop` (software) |
| `automated-pill-dispenser` | Automated Pill Dispenser | shipped | engineering | hardware, firmware | — | — | github.com/PotatoSlop/Automated-Pill-Dispenser | `nob` is same-discipline ⚠️ — needs a real cross-link (see findings) |
| `low-poly-boat` | Low-Poly Boat Asset | shipped | design, **software** | 3d, gamedev | — | `boat.glb` | Unity Asset Store (download) | `color-match` (software/gamedev), `peacemaker` (design) |
| `peacemaker` | Peacemaker | wip | design | 3d, illustration | — | `WIPMecha.glb` | — | `nob` (engineering ↔ hard-surface modeling), `color-match` (software) |
| `color-match` | Color Match | wip | software, **design** | gamedev | — | — | github.com/PotatoSlop/color-match | `low-poly-boat` (design/3d), `peacemaker` (design) |
| `portfolioslop` | Portfolioslop (this site) | shipped | software | webdev | — | — | github.com/PotatoSlop/Portfolioslop | `nob` (engineering), `peacemaker` (design) |

**Engineering hero = `nob`** (the hardware flagship, per PLAN 0.2). It's the one
that gets the R3F teardown deep-dive in Phase 3.

### Cross-functional reclassifications (vs. the old 4 dropdowns)
- **Nob** was Engineering-only → now **engineering + software** (Wi-Fi/BT firmware + macro logic). This is the cross-functional flagship.
- **Color Match** was Programming-only → now **software + design** (game *design* + Godot dev).
- **Low-Poly Boat** was Design-only → now **design + software** (it's a game-engine asset).
- **Photography** is gone as a top-level category (see below).

## Photos → folded into one software project

The old "Photography" dropdown is **not** a discipline. Per CLAUDE.md, the 22
photos become a typed module (`src/data/photos.ts`) owned by one `software`/`webdev`
project, organized by **`location`**. Locations present:

> Taiwan (Jiufen, Taipei), New York (Queens, Manhattan, Brooklyn), Boston,
> Seattle, Tokyo (Shibuya, Asakusa), Singapore

✅ **Decided:** photos are owned by a **standalone `photo-gallery` project**
(`software` / `webdev`) — "the gallery system." Portfolioslop stays about site
architecture; the gallery is its own project.

| id | title | status | disciplines | subTags | external link |
|---|---|---|---|---|---|
| `photo-gallery` | Photo Gallery | shipped | software | webdev | — |

> Note: `gallery.js` has a data bug — three photos use `orientation:
> 'portrait-short-gallery'` but the renderer only matches `'portrait-short'`,
> so they silently never render. Worth fixing when porting (not now).

## Incoming projects (Phase 5 — stubs only, not built yet)

| id | title | disciplines | subTags |
|---|---|---|---|
| `macropad` | Mechanical macropad (OLED + rotary) | engineering, design | hardware, firmware, 3d |
| `led-cosplay` | LED 3D-printed cosplay parts | engineering, design, software | hardware, 3d, firmware |
| `club-web-project` | Full-stack club web project | software | webdev |
| `gamedev-tba` | Additional game-dev project(s) | software, design | gamedev |
| `uiux-case-study` | UI/UX case study | design | uiux |

These (esp. `macropad` and `led-cosplay`) are the **real cross-functional
connectors** that strengthen the `related[]` web — see finding #3.

---

## Schema findings (the point of this step)

The schema mostly held, but contact with real projects surfaced gaps:

1. **✅ FIXED — No external-link field.** Almost every current project is
   primarily a *card + outbound link* (GitHub repo, Unity Asset Store download).
   Added an optional `links` object `{ repo?, live?, download? }` to SCHEMA.md.

2. **🟡 Per-model viewer config.** The old viewer used `data-lighting-preset`
   ("boat", "mecha") per GLB. R3F deep-dives may need per-model camera/lighting
   hints. Likely a sub-field under `media`/`glb`, or just hardcoded per
   deep-dive. **Park it** unless it blocks the Nob teardown.

3. **🟡 Cross-discipline `related[]` is thin with current content.** Existing
   projects cluster (2 eng, 2 design/3d, 2 software), so several honest
   cross-links don't exist yet (e.g. `pill-dispenser` has no natural
   cross-discipline sibling). Not a schema bug — a *content* gap that the
   Phase 5 projects (macropad, led-cosplay) fill. Don't force weak links now.

4. **✅ FIXED — `cover` was required but stubs won't have art.** Made `cover`
   optional in SCHEMA.md so frontmatter-only WIP stubs validate.

**Status: data model LOCKED.** Findings #1 and #4 folded into SCHEMA.md; #2 and
#3 parked (not schema bugs). Phase 0.2 complete.
