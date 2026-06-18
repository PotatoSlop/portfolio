# Dylan Chen — Portfolio Rebuild · Project Context

This file is the durable context for the portfolio rebuild. Read it at the start
of every session. The detailed phased checklist lives in `PLAN.md`.

## What this is
A rebuild of my personal portfolio (`dylanchen.me`). It replaces the old vanilla
HTML/CSS/JS site — whose projects page used four dropdowns (Engineering / Design /
Photography / Programming) — with a structured, project-centered Astro site.

## Goals
- Project-centered portfolio that shows cross-functional range and flexibility.
- Primary audience right now: **hardware / consumer-electronics** roles (may shift).
- Make a visitor immediately sure they're still on my site even as the visual
  style transforms between sections (anchoring).

## Stack (decided — don't relitigate without reason)
- Astro + React islands + TypeScript
- R3F + drei for interactive 3D (e.g. the Nob teardown)
- Astro View Transitions for the sketch→render cross-fades
- Content Collections via the loader API; schema in `src/content.config.ts`
- Static build → GitHub Pages, custom domain via `CNAME` (`dylanchen.me`)
- Keep existing EmailJS for the contact form (no new third-party APIs)

## Architecture / flow
- **Landing** = sketchbook (doodle) style. Three drag-and-drop "doors":
  Engineering, Design, Software. Also a direct link to the Playground, and it
  teases the hardware flagship (don't hide it behind a door).
- **Discipline pages** = "rendered" pages. One shared skeleton, swappable theme
  tokens per discipline. THREE themes maximum; theme by discipline, never by
  project. Each has a hero/star project + a grid; projects open to deep-dives.
- **Suggested-projects** links must cross disciplines on purpose — that's what
  carries the cross-functional story inside a segmented structure.
- **Breadcrumbs + a persistent anchor** (name + amber identity tick) on every
  page (e.g. Sketchbook / Engineering / Nob).
- **Playground** = the sketch-layer: a raw gallery of ALL projects in the neutral
  doodle aesthetic (the unrendered origin). (Photo gallery DEFERRED — see data model.)

## Data model (the keystone — `src/content.config.ts`)
- One MDX file per project. Frontmatter = queryable metadata; MDX body = the
  optional case study (rich — embed islands here). Light projects stay light.
- `disciplines[]` is non-empty: every project belongs to ≥1 of the three.
  Cross-functional projects list several (that's how they surface in multiple
  discipline views without duplicating the file).
- `subTags` from a fixed enum; `hero`, `order`, and `related` (validated
  references, pointed across disciplines).
- Photos/gallery are DEFERRED out of this repo: the gallery system becomes its
  own standalone repo + demo (linked as a project later), not an embedded
  portfolio module. No `src/data/photos.ts` this phase.

## Design system
- Shared skeleton — layout grid, type scale, spacing, motion timing,
  breadcrumb/anchor — is IDENTICAL across themes. Only tokens swap.
- Theme directions: engineering = machined-studio / blueprint (charcoal, mono,
  dimension callouts); software = editor/terminal (mono, caret/syntax accents);
  design = editorial/gallery (whitespace, color, print-like type).
- The amber identity tick + name ride through every theme (anchoring).

## Working principles (these override convenience)
1. Lock the data model before building anything that reads from it.
2. Ship ONE full vertical slice (Engineering → Nob deep-dive) before going wide.
3. Three themes, ever.
4. Don't let new project pages jump ahead of the proven skeleton.
5. Case study "where applicable" — never force a heavy template on a light project.

## Status
- Phase 0.1 (data model) IN PROGRESS. Schema is being drafted in `SCHEMA.md`
  (paper spec); no Astro project or `src/` exists yet — the repo is still the
  old vanilla HTML/CSS/JS site on the `refactor/astro-rebuild` branch.
- Next: finish the schema spec + tag the project inventory (0.2), then Phase 1
  (scaffold Astro, convert `SCHEMA.md` → `src/content.config.ts` Zod collection).
  See `PLAN.md` for the full phased checklist and ship gates.

## Conventions
- Work on the `refactor/astro-rebuild` branch, never `main` (the live fallback).
- TypeScript strict. Keep React islands minimal — Astro renders static by default.
- Do NOT reintroduce the four-dropdown projects page.
- Vet any new dependency before adding it; ask before large additions.

## How to help me
- Move in SMALL steps. State the goal of a step and what "done" looks like
  before doing it, and pause for confirmation before structural changes.
- One step at a time — don't run ahead to later phases unprompted.
