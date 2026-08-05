# Routing & client-lifecycle contract

**Source of truth for how client-side JavaScript and page assets must be wired so a
page renders _identically_ no matter how it was reached.**

This exists because we kept shipping "dual-state" bugs: a page looks/behaves one way
on a full browser load (or direct URL / refresh) and a different way after an
in-app navigation (clicking a link, a project card, a discipline pull-tab). That is
never acceptable. The entry path must be invisible to the result.

If you are adding or touching any client behavior on a page, follow this doc. If a
change can't satisfy it, the change is wrong — fix the approach, not the symptom.

---

## 1. Why dual states happen (the Astro ClientRouter model)

We use Astro's `<ClientRouter />` (View Transitions), enabled once in
`src/layouts/Base.astro`. It turns same-origin navigations into a client swap: the
new page's `<head>` and `<body>` replace the current ones, `<html>` attributes are
updated, and **the full document is _not_ reloaded**. That single fact is the source
of every dual-state bug, because of how scripts run:

| Thing | On first load (full load / refresh / direct URL) | On in-app navigation (SPA swap) |
|---|---|---|
| Bundled `<script>` module top-level code | runs once | **does NOT run again** (module already evaluated) |
| `DOMContentLoaded`, `window` `load` | fires | **never fires again** |
| `astro:page-load` | fires | **fires every time** |
| `astro:before-swap` | — | fires before the old DOM is torn out |
| The DOM itself | server HTML, pristine | **replaced** with fresh server HTML (mutations from the old page are gone) |

So any DOM setup that lives at module top level or on `DOMContentLoaded` runs on the
first load and **silently never runs again** after an SPA navigation. That is the
classic "element didn't load when I clicked in, but works on refresh" bug (or the
reverse). It is 100% avoidable.

There is no supported way to make module top-level code re-run per navigation, and we
do not want one. The fix is always to move the work into the lifecycle events below.

---

## 2. The rule

> **All page/component client behavior is a `mount()` / `teardown()` pair driven by
> `astro:page-load` and `astro:before-swap`. Never initialize page content at module
> top level, on `DOMContentLoaded`, or on `window.load`.**

Four properties every mount must have:

1. **Lifecycle-driven** — set up inside an `astro:page-load` listener; return/keep a
   teardown and call it from `astro:before-swap`.
2. **Idempotent & self-contained** — running it fresh on pristine server HTML must
   produce the exact same result every time. It must not depend on any state left
   behind by a previous page.
3. **Cleans up its own mutations** — if mount injects nodes, wraps text, clones cards,
   adds inline styles, or adds "revealed/open" classes, teardown must restore the
   original DOM (or simply rely on the swap discarding it — see §3.2). Otherwise the
   next page double-applies or inherits stale nodes.
4. **Never gates content visibility on JS succeeding** — see §4.

---

## 3. Patterns (do this)

### 3.1 A page or component script

```astro
<script>
  import { mountThing } from '../lib/motion/thing';

  let destroy: (() => void) | null = null;

  document.addEventListener('astro:page-load', () => {
    // Guard: this page's root may not be present after navigating elsewhere.
    if (!document.querySelector('.thing-root')) return;
    destroy = mountThing();
  });

  document.addEventListener('astro:before-swap', () => {
    destroy?.();
    destroy = null;
  });
</script>
```

`mountThing()` returns a `() => void` that cancels every `requestAnimationFrame`,
disconnects every `IntersectionObserver`/`ResizeObserver`, removes every listener it
added to `window`/`document`, and removes any nodes it injected. This is the exact
shape already used by `src/lib/motion/carousel.ts`, `design-reveal.ts`,
`case-overlay.ts`, etc. — copy it.

### 3.2 DOM the mount injected or mutated

The body is replaced on swap, so injected nodes _inside the swapped tree_ vanish for
free. But you still tear down because:

- rAF loops / observers / `window`/`document` listeners are **not** DOM and leak
  across navigations if you don't cancel them.
- If your teardown runs and re-runs on the **same** persisted element (§3.5), stale
  nodes accumulate.

Rule of thumb: if `mount` did it, `teardown` undoes it. Don't rely on the swap alone.

### 3.3 Reveal-on-scroll / entrance animations

Use `IntersectionObserver` created in `mount`, disconnected in teardown. Because
`astro:page-load` fires _after_ the new DOM is in place, an element already in the
viewport will still trigger the observer (it fires once with `isIntersecting: true`
on observe). Never wrap reveal setup in a one-shot `DOMContentLoaded`.

### 3.4 Media / assets (`<video>`, `<img>`)

Assets must render from **declarative HTML attributes**, not from a JS `load` /
`loadeddata` / seek that may have already fired (or never fires again) after a swap:

- Video first frame: use `<video poster="…" preload="metadata">`. Do **not** paint the
  first frame by seeking in JS on `loadeddata` — after an SPA swap that event won't
  re-fire and the element renders blank.
- Images: rely on `src`/`srcset`/`loading`. Don't build `<img>` via `innerHTML` in a
  top-level script (that's the `projects.js`/`gallery.js` legacy anti-pattern).

### 3.5 `transition:persist` elements

Elements marked `transition:persist` (e.g. the nav curtain in `Base.astro`) survive
the swap. Their setup must be **bound once and guarded** so it doesn't re-bind each
navigation, and they must update themselves per page (read the new route/theme on
`astro:page-load`) rather than assuming first-load state.

### 3.6 Genuinely global, once-only listeners

Listeners on `window`/`document` that are page-agnostic (e.g. the custom scrollbar
drag in `Scrollbar.astro`) may be bound once at module top level **only if** they
query their targets fresh on each event and hold no per-page state. Everything
per-page still rebuilds on `astro:page-load`. When in doubt, prefer the mount/teardown
pattern.

---

## 4. Content is visible by default (progressive enhancement)

Entrance/reveal animations must **enhance** already-visible content, not be the only
thing that makes it visible. If an element is `opacity: 0` / `clip-path` / hidden in
CSS and only JS removes that, then any hiccup in the JS path (an error, a missed
event, a backgrounded tab throttling rAF) leaves the content **permanently invisible**
— and that failure often correlates with entry path, which is exactly the dual-state
bug.

Requirements:

- The hidden-until-revealed state must have a **non-JS escape hatch**: a
  `@media (prefers-reduced-motion: reduce)` (and our manual `[data-sim-reduced]`) rule
  that shows everything at full opacity with no clip. We already do this in
  `styles/components/design-reveal.css`; every new reveal must too.
- Prefer animating _from_ a visible state (e.g. translate + fade from 0.25 → 1 opacity)
  over hard `opacity: 0` where practical.
- Never hard-hide content behind a `setTimeout`/rAF with no fallback.

---

## 5. Checklist before you commit client behavior

- [ ] No DOM work at module top level. No `DOMContentLoaded` / `window.load` for page
      content.
- [ ] Setup runs in `astro:page-load`; teardown in `astro:before-swap`.
- [ ] Teardown cancels every rAF, disconnects every observer, removes every
      `window`/`document` listener, and removes/reverts every node it injected.
- [ ] Re-running mount on fresh HTML yields an identical result (idempotent, no
      dependence on prior-page state).
- [ ] Any hidden-until-revealed content has a reduced-motion / no-JS CSS fallback that
      shows it.
- [ ] Media renders from declarative attributes (`poster`, `src`), not from a
      possibly-already-fired JS load/seek.
- [ ] Verified BOTH ways: hard refresh on the page URL **and** navigate into it from
      another page — they must look and behave identically.

---

## 6. Current audit & fixes

A full lifecycle audit was run against §1–§4. Summary of what it found and what was
changed.

### Root cause of the reported "different view when navigated in"

On both priority pages, load-critical content is hidden by CSS and revealed **only**
by a per-page module registering an `astro:page-load` handler:

- Design hero — `.pre-anim { opacity: 0 }` / `.crop-lr` / `.crop-tb` / blank `.br-glyph`
  (`styles/components/design-reveal.css`), revealed by `mountDesignReveal()`
  (`src/lib/motion/design-reveal.ts`).
- Engineering wordmark — `.eng-wordmark { opacity: 0 }` under normal motion
  (`src/components/Wordmark.astro`), revealed only when `runIntro()` adds `.intro-ready`.

On a full load the page's bundled module is in the initial HTML and runs before
`astro:page-load`. On a **first SPA entry** the module evaluates around the
`astro:page-load` dispatch and can miss it, so the reveal never runs and the content
stays hidden — while the rest of the page renders. That is the divergence.

### Fixes applied

- **Design page** (`src/pages/design.astro`) — reworked init into an idempotent
  `mount()` guarded by a `mounted` flag, registered on `astro:page-load`, torn down
  on `astro:before-swap`, **and invoked once directly as a catch-up** so a missed
  first-entry `page-load` still initializes. `remountDrift` now keys off `mounted`.
- **Wordmark** (`src/components/Wordmark.astro`) — same idempotent `mount()` +
  catch-up pattern; **`reduced` is now re-read inside `setup()`** every mount instead
  of being captured once at module scope (the cached value was frozen on the
  first-ever page and went stale after navigation / the reduced-motion toggle); the
  once-bound `resize`/`scroll` listeners now guard on `svg?.isConnected` so they never
  touch a detached node.
- **Base footer effect** (`src/layouts/Base.astro`) — the per-navigation `inView`
  observer is now stored and stopped on `astro:before-swap`, and the footer nav-theme
  vars are explicitly restored there (inView's `stop()` does not fire the leave
  callback), fixing both an observer leak and nav colors bleeding into the next page.

### Deliberately NOT changed (verified safe)

- Char-wrap / accordion / feature-card classes that mount mutates but teardown
  doesn't restore: harmless because the full `<body>` swap discards that DOM. Only
  rAF loops, observers, and `window`/`document` listeners survive a swap and must be
  torn down (they are).
- Media first-frame: `ProjectCard.astro` already renders the cover as
  `<video poster>` and `video-scrub.ts` avoids a forced seek, so frames paint on both
  paths. **Caveat:** a `posterVideo` project with no `cover` has no poster and would
  paint blank on an SPA hop — give such entries a `cover` (or a fallback poster).
- `transition:persist` `#nav-curtain` is reset per `page-load` in `Base.astro` — the
  correct pattern; left as is.

### Legacy (not wired into the SPA)

`projects.js` / `viewer3d.js` / `lighting-presets.js` are loaded only by the
standalone `projects.html` prototype and are full of top-level DOM work +
`DOMContentLoaded` (§1/§2 violations). They are dead code for the ClientRouter site.
**Do not port them in as-is** — rewrite to the §3 mount/teardown pattern first.
