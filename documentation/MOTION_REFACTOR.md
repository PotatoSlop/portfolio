# Styles Refactor — Animation & Motion

Moving all site motion off native CSS `@keyframes` + hand-rolled `IntersectionObserver`/`requestAnimationFrame` onto the **Motion** library (`npm i motion`, vanilla-TS API), behind a small shared toolkit in `src/lib/motion/`.

## How to use this
- `[ ]` = todo, `[x]` = done. Work top-down; each phase is independently shippable and reversible.
- Principles that override convenience when they conflict:
  1. **Abstract a behavior the moment it appears in ≥2 places; keep it inline when it's genuinely one-off.** The shared value is the *triggering + gating + arming*, not a fixed visual — keyframes stay per-call.
  2. **Astro View Transitions stay.** `<ClientRouter/>`, `::view-transition-*`, `transition:persist`, `data-slide`, swipe-nav are route-change concerns Motion doesn't own. Out of scope.
  3. **Never regress the reduced-motion gate.** Every JS animation routes through `guard()` / `prefersReducedMotion()`; the CSS kill-switch in `styles/utilities/accessibility.css` still covers the CSS side.
  4. **Don't migrate trivial ambient loops.** CSS `@keyframes` is lighter for infinite/hover-only effects — leave them.

## Why Motion (not `transition:animate`)
Astro's `transition:animate` is route-scoped and declarative — it animates page swaps, nothing else. The overwhelming majority of this site's motion is interactive, continuous, scroll-linked, or canvas-driven, which `transition:animate` structurally can't express. Motion is a general-purpose engine (`animate`, `scroll`, `inView`, `stagger`, `spring`, gestures, `motionValue`) that works in plain `.astro` `<script>` and React islands. So: migrate keyframes/observers/rAF → Motion; leave route transitions on Astro's View Transitions API.

---

## Shared toolkit — `src/lib/motion/`

| File | Role | Replaces |
|---|---|---|
| `tokens.ts` | JS mirror of CSS motion tokens (`styles/tokens.css`): durations (seconds), cubic-bezier ease arrays, spring/stagger presets. Keep in sync with CSS. | scattered magic numbers |
| `reduced-motion.ts` | `prefersReducedMotion()`, `onReducedMotionChange()`, `guard()` | ~8 duplicated media-query checks |
| `reveal.ts` | `reveal()` / `revealStagger()` on Motion `inView`; arms initial state, gates reduced motion, once-by-default, `observe` option to watch a stationary element | IntersectionObserver + class-toggle + load `@keyframes` |
| `sequence.ts` *(Phase 2)* | ordered entrance choreography via `animate()` sequences + `stagger()` | rAF intros, nth-child delay hacks |
| `scroll-link.ts` *(Phase 3)* | scroll-progress binding via Motion `scroll()` | rAF-throttled scroll loops |
| `pointer-follow.ts` *(Phase 4)* | spring-following `motionValue()` for pointer/gesture | hand-rolled pointer lerps |

**Rule for `reveal()`:** `inView` watches the element's *transformed* box. If the animated element is armed off its layout position (e.g. `translateY(100%)`), watch a **stationary ancestor** via the `observe` option instead, or it never enters the viewport during normal scroll. (This is why the original `IntersectionObserver` observed `.eng-feature-crop`, not the child.)

---

## Phase 0 — Foundation (no visible change) — DONE
- [x] `npm i motion` (+ `@astrojs/check`, `typescript` dev deps for `astro check`)
- [x] `tokens.ts` — durations/eases/springs mirroring `styles/tokens.css`
- [x] `reduced-motion.ts` — `prefersReducedMotion()`, `onReducedMotionChange()`, `guard()`
- [x] `reveal.ts` — `reveal()` + `revealStagger()`
- [x] `astro check` clean (0 errors)

## Phase 1 — Reveal-on-scroll / on-load — DONE
Highest leverage, lowest risk. Kills both `IntersectionObserver` blocks.
- [x] `engineering.astro` feature-crop reveal → `reveal('.eng-feature-crop .eng-feature', …, { observe: '.eng-feature-crop', … })`; deleted dead `.js-armed` CSS
- [x] `Base.astro` footer→nav recolor → raw `inView` enter/leave (two-way token toggle, not a tween — kept inline, not through `reveal()`)
- [ ] `pageFadeIn` / `navDrop` / form `slideIn` / `errorSlide` load fades → `reveal()` on `astro:page-load`

**Method map:** `inView()`, `animate()`, `stagger()`.

## Phase 2 — Entrance choreography / stagger
Build `sequence.ts` first; **Wordmark glyph intro is the reference implementation** — do it carefully.
- [x] `sequence.ts` — `entrance()` (on-load counterpart to `reveal()`, arms + gates + staggers) and `sequence()` (Motion timeline form, reduced-motion snaps each segment to final)
- [x] `Wordmark.astro` per-glyph rise + arrow → per-glyph `animate()` on the SVG `y` attribute with `springs.snappy` + manual stagger loop (tspans don't honor CSS transforms, and each glyph has its own rest `y`, so `entrance()`'s single-keyframe-set form doesn't fit — kept inline). Arrow `<g>` rises on `transform`/`opacity`. Completion via `Promise.all(.finished)` restores CSS layout (removes `y` overrides) and flags the ink hit-mask stale. Kept `document.fonts.ready` await + all mask/fit machinery. Verified: intro settles, `y` cleared, `__engInkAt` still resolves glyphs.
- [ ] `PullTabs.astro` `tabFlyInRight` → `revealStagger` / staggered `animate` (drops nth-child delay hack)
- [ ] `engineering.astro` intro `cropRise` + chevron → `sequence()`; leave `gridRipple` (`@property --eng-ripple`) as CSS unless it needs JS coordination
- [ ] `index.astro` typewriter reveal + title/gif overshoot → `animate()` timeline, overshoot via `springs.overshoot` (typewriter char loop stays JS)
- [ ] **Leave as CSS:** role-chip `wave`/`shake` (ambient infinite loops)

**Method map:** `animate()` (sequence form), `stagger()`, `springs.*`.

## Phase 3 — Scroll-linked progress
Where position is *bound* to scroll offset, not just triggered by it.
- [ ] `scroll-link.ts` — wraps Motion `scroll()`, callback with 0–1 progress (rAF-batched, passive)
- [ ] `about.astro` timeline SVG spine draw → `scroll()` bound to `strokeDashoffset`/`pathLength`; dots + items → `reveal()`. Deletes rAF lerp + `getPointAtLength` binary search (path geometry stays; only the driver changes)
- [ ] `Scrollbar.astro` thumb position → `scroll()` mapping progress → `y`; keep `ResizeObserver`/`MutationObserver` for content-size; drag stays pointer-based (Phase 4)

**Method map:** `scroll()`, `transform()` for range remap.

## Phase 4 — Pointer-follow, gesture & continuous physics
- [ ] `pointer-follow.ts` — `motionValue()` x/y driven through `spring()` toward pointer; subscribe into CSS transforms or canvas state
- [ ] Footer cursor blob (`cursor.css` + `Base.astro`) → `followPointer` (delete mousemove + CSS-transition combo)
- [ ] `PullTabs.astro` magnet snap → `followPointer` + Motion `press()`/drag; commit→`navigate()` stays inline (routing, not animation)
- [ ] `DotLines.astro` parallax drift → keep canvas render loop, replace manual cursor lerp with `followPointer` spring read inside `frame`; grid warp / trail stay custom canvas
- [ ] `about.astro` headshot 3D flip → `animate()` on `rotateY` with spring; scroll-lock state machine stays inline

**Method map:** `motionValue()`, `animate(value, target, { type: 'spring' })`, `press()`, `frame`.

## Phase 5 — Cleanup & verification
- [ ] Delete now-dead `@keyframes` (`cropRise`, `slideIn`, `errorSlide`, `tabFlyInRight`, `pageFadeIn`, `navDrop`, `cardSlideIn` if unused) and their `animation:` uses
- [ ] **Leave in place:** `<ClientRouter/>`, all `::view-transition-*`, `transition:persist` curtain, `data-slide`/swipe nav
- [ ] **Leave as CSS:** `spin`, `blinkingCursor`, wave/shake chips, simple hover `transform`/`color` transitions
- [ ] Re-audit every migrated effect routes through `guard()` / `useReducedMotion()` — the biggest regression risk in the whole plan

---

## Verification notes
- Verify in the browser preview via `preview_start` (port 4399, see launch.json). Run `astro check` after each phase.
- **Offscreen-preview freeze:** when the preview pane is backgrounded (`visibilityState: "hidden"`), Motion flushes style writes on a frame loop that's *paused*, and programmatic scroll/`scrollIntoView` don't take effect — so Motion animations can't be observed. Verify motion via geometry in a foreground tab, or confirm the intended behavior in a normal browser window.
- The engineering intro sets `overflow: clip` as a scroll-lock that releases when the intro finishes; a frozen preview never finishes it, so the page can't scroll there.

## Lessons / gotchas
- **Motion can't animate SVG geometry attributes on `<text>`/`<tspan>`.** `animate(el, { y: [...] })` writes the CSS `y` geometry property, which `<rect>`/`<svg>` honor but `<text>`/`<tspan>` ignore — so it silently snaps to the end (glyph sits clipped, then appears). Animate a plain number via `animate(from, to, { onUpdate })` and `setAttribute('y', …)` yourself (what the Wordmark intro does). Real elements (`<g>`, HTML) animate `transform`/`opacity` fine.
- **Can't observe a <3s animation with reload-then-eval.** Each browser eval is a separate round-trip with seconds of real latency, so the intro finishes before a follow-up poll runs — you'll see all-final-state and wrongly conclude it snapped. Verify motion in ONE self-contained eval (temporarily expose a re-run hook + record samples inline), or check only the settled end-state.
- **Watch stationary, animate transformed** — see the `reveal()` rule above. Applies to every future reveal whose target is armed off-layout.
- **Footer→nav `-95%` margin** — the recolor triggers only when the footer's top reaches the top ~5% of the viewport; at normal page height it may never fire. Pre-existing (identical for plain IO and Motion) — confirm intent before "fixing".
- **`inView` types** — `margin` is a template-literal type (cast needed), the callback receives the element directly, and `AnimationOptions` is a union (use `type` intersection, not `interface extends`).
