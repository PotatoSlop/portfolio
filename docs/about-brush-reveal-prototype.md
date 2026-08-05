# About page — brush-reveal interaction (prototype spec)

> **⚠️ TEMPORARY — DELETE AFTER IMPLEMENTATION.**
> This document **and** the prototype file [`public/prototypes/about-brush-reveal.html`](../public/prototypes/about-brush-reveal.html)
> are throwaway design scaffolding. Once the interaction is ported into the real
> about page and merged, **delete both files**:
> - `docs/about-brush-reveal-prototype.md` (this file)
> - `public/prototypes/about-brush-reveal.html`
>
> They exist only to pin down the mechanic and its edge cases before touching
> production code. They are not wired into the app and must not ship.

---

## What this replaces

The current about page ([`src/pages/about.astro`](../src/pages/about.astro)) uses a
scroll-triggered **flip** between two states — a "sketch" persona (doodle portrait +
"It Starts with a Sketch") and a "real" persona (photo + "About Me"). This prototype
explores replacing that scroll-flip with a **themed, direct-manipulation reveal**: the
visitor "draws" the real photo in over the sketch (or erases back) with a 3D pen/eraser
tool, fitting the site's hand-drawn / sketchbook identity.

## Core interaction

- A circular portrait shows a **sketch** state by default. Dragging with the **pen**
  reveals the **real** photo underneath along the brush stroke; the **eraser** wipes
  it back to the sketch. This is a live raster mask, not a crossfade.
- The **caption** is *not* masked (masked running text is unreadable). Instead it
  **switches state** once the circle passes **50% revealed**, with a short opacity
  crossfade. This keeps the text legible while still tracking the gesture.
- A floating **3D tool** (pen / eraser, three.js) follows the cursor as the affordance;
  the OS cursor is hidden over the stage. A **brush-radius ring** marks the exact paint
  point and size.

### Debug aids currently in the prototype (remove on port)

- The two image states sit on **blue (sketch)** and **red (real)** backgrounds, and the
  captions use blue / red ink, purely to make the mask boundary and state obvious while
  iterating. Replace with the real doodle asset, photo, and normal type colors.

## Behaviour details / decisions locked in

| Concern | Decision |
| --- | --- |
| Draw gesture | **Mouse-down-and-hold to paint**, release to stop. Painting is gated on `e.buttons` every move (not a latched flag) so a missed `pointerup` can't leave it stuck "on". A **lone click** also stamps a dot. |
| Draw region | The mask/coordinate space spans the **full page width × section height**, so a stroke that starts just outside the centered content still registers. `pointerdown` is on `window` with a guard that lets toolbar/buttons/links keep their own clicks. |
| Brush size | Radius, from a small minimum up to a **max of the full circle radius**; default sits at the middle (half-radius). A live **`%` readout** on the size control (percent of max) replaces any radius preview. |
| Auto-complete | Hidden **15% band**: on release, ≥85% revealed with the pen snaps to 100%; ≤15% remaining with the eraser snaps to 0%. Direction-aware (keyed to the active tool) so small strokes don't snap the wrong way. Uses a snapshot fade so already-drawn pixels don't flicker. |
| Toggle | A plain **uniform crossfade** (`crossfadeTo`) between the two states, ~200ms. It's the accessible / touch fallback and always works via keyboard. The threshold sampler is paused during it so the caption switch can't fight the fade. |
| Image drag | Portrait `<img>`s are `pointer-events: none` + `draggable="false"` + non-selectable, and `pointerdown` calls `preventDefault()`, so native image-drag never steals the gesture. |
| Z-order | toolbar `z-index: 30`, brush ring `35`, 3D tool `40` (ring behind tool, both above the toolbar). |

## Implementation mechanic (how the reveal works)

- One offscreen **mask canvas** in stage coordinates (`white/opaque = revealed`).
  The pen stamps circles with `source-over`; the eraser with `destination-out`.
- The mask is applied to the "real" layer via CSS `mask-image` from
  `maskCanvas.toDataURL()` (throttled to ~16fps), with `mask-size` / `mask-position`
  mapping the layer's box into the stage-sized mask.
- **Cost note:** regenerating the mask data URL each stroke is heavier than a plain
  crossfade — acceptable here, but profile it on the real page. If it janks, options are
  (a) keep the reveal to the image only (as now) rather than expanding it, or (b) move
  the mask to an actual overlaid `<canvas>` composited with the photo instead of a CSS
  mask data URL.
- Caption switch reads coverage by sampling a downscaled copy of the mask inside the
  circle (`getImageData` on a 40×40 buffer), throttled in the rAF loop.

## Porting checklist (into `src/pages/about.astro` + motion toolkit)

- [ ] Strip all debug tints (blue/red backgrounds, colored ink) and the prototype's
      inline `<style>` / `<script>`; use the real doodle asset + `irlHeadshot.jpg`.
- [ ] Respect the project's **routing/lifecycle contract** — idempotent mount on
      `astro:page-load`, full teardown on `astro:before-swap` (remove `window`
      listeners, cancel rAF, dispose the three.js renderer). See
      [`docs/routing-and-lifecycle.md`](./routing-and-lifecycle.md).
- [ ] Wire the two reduced-motion signals: OS `prefers-reduced-motion` **and** the
      site's `html[data-sim-reduced]` toggle. Under reduced motion, skip the brush and
      make the toggle the primary control.
- [ ] Mobile / touch (`pointer: coarse`) already degrades to the toggle; confirm against
      the site's mobile-forces-reduced-motion behavior.
- [ ] Move the three.js tool + mask logic into `src/lib/motion/` as a mountable module
      consistent with the existing motion library, not an inline script.
- [ ] Decide whether the reveal replaces the scroll-flip entirely or coexists.
- [ ] Accessibility: keep the keyboard-focusable state toggle; ensure the portrait has a
      meaningful `alt` and the decorative canvases stay `aria-hidden`.

## Open questions for later polish (not blocking)

- Align the 3D tool's *tip* precisely to the cursor (currently approximate; fine because
  the OS cursor is hidden and the ring marks the true point).
- Toggle button restyle: reduce to text with a bottom color-fill effect.
- Whether auto-complete should trigger live at the 85%/15% crossing mid-drag instead of
  on release (current = on release, least jarring).
