/*
  freeze-gifs.ts — pause animated GIFs at their first frame under reduced motion.

  A GIF can't be paused with CSS/JS once it's decoding, so instead we swap the
  <img> source to a pre-rendered still of frame 0 while reduced motion is active,
  and swap the animated GIF back when it's off. Only the image content changes —
  size, layout, and any CSS/JS entrance transform on the element stay exactly as
  they were, so the "reveal" motion the design relies on is untouched.

  Markup contract (see index.astro / Nav.astro):
    <img src="/…/foo.gif" data-freeze="/…/foo-static.png" … />
  The initial `src` is captured as the animated source on first run.

  Reduced motion here means prefersReducedMotion() — the OS media query, the
  site's corner toggle (html[data-sim-reduced]), or mobile (which forces it).
*/
import { prefersReducedMotion } from './reduced-motion';

function apply() {
  const reduced = prefersReducedMotion();
  document.querySelectorAll<HTMLImageElement>('img[data-freeze]').forEach((img) => {
    // Remember the animated source once, so we can restore it when the toggle
    // flips back off.
    if (!img.dataset.animSrc) img.dataset.animSrc = img.getAttribute('src') ?? '';
    const still = img.dataset.freeze ?? '';
    const animated = img.dataset.animSrc;
    const want = reduced ? still : animated;
    // Only touch src on an actual change — reassigning the animated GIF would
    // restart it from frame 0 needlessly.
    if (want && img.getAttribute('src') !== want) img.setAttribute('src', want);
  });
}

let wired = false;

/** Idempotent: safe to call from any page's setup. Binds the site-wide swap
 *  once (window persists across View Transitions) and runs an initial pass. */
export function mountFreezeGifs() {
  if (!wired) {
    wired = true;
    // Re-assert after each navigation (the nav — and its logo — re-renders per
    // swap) and whenever the reduced-motion preference changes live.
    // eslint-disable-next-line no-restricted-syntax -- bound-once global; the apply() below is the catch-up (docs/routing-and-lifecycle.md §6 exceptions)
    document.addEventListener('astro:page-load', apply);
    window.addEventListener('motionpreferencechange', apply);
  }
  apply();
}
