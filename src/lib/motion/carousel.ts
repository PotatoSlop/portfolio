import { prefersReducedMotion } from './reduced-motion';
import { mountQueue } from './mobile-queue';

/* carousel.ts — scroll-responsive infinite carousel rows (design page), the
   engine behind MarqueeRow / MasonryGrid. Mounted via mountCarousels().

   Rows drift at an ambient speed; scroll VELOCITY boosts it (not scroll-jacked).
   ("Drift" throughout = that ambient auto-motion.) Seamless infinite loop by
   duplicating children enough times that the content spans the viewport PLUS one
   period, then wrapping on the first clone's offset — NOT scrollWidth/2, which is
   off by ~half a gap and shows a hitch each loop.

   ANIMATED mode is fully seamless: the ambient drift AND a grab-scrub both wrap
   on the period, so grabbing loops infinitely in either direction just like the
   idle drift (no truncation at the content ends).

   REDUCED mode stops the auto-scroll and becomes a native, FINITE horizontal
   scroll (CSS overflow-x: auto → a real scrollbar under the row). To avoid a jump
   when the toggle flips, we hand the current visual position across: the row is
   rotated so the card at the left edge becomes the first child, then scrollLeft
   is set to the sub-card remainder. Scrolling right then reveals the remaining
   unique cards ONCE and stops — every card reachable, nothing repeated. The
   reverse toggle hands scrollLeft back so animated resumes in place.

   MOBILE (<=768px) drops both: no drift, no scrollbar — a discrete one-card pager
   stepped by a pair of chevrons pinned to the card's mid-left / mid-right
   (mountPager). The page remounts on the breakpoint change so the right mode is
   always live.

   Mount on `astro:page-load`, call the returned destroy() on
   `astro:before-swap` so ClientRouter navigations don't leak rAF loops. */

const AMBIENT = 26; // idle drift, px/s
const SCROLL_GAIN = 2.6; // scroll-velocity → drift boost (~2.0 if too fast)
const SMOOTH = 0.12; // scroll-velocity smoothing
const HOVER_SLOW = 0.34; // ambient multiplier while hovering a row
const HOVER_RAMP = 0.06; // ease toward the hover target
const DRAG_THRESHOLD = 3; // px of travel before a drag suppresses the click
const FLING_MAX = 2600; // cap on release velocity, px/s (a fast flick can't launch)
const FLING_TAU = 0.32; // momentum decay time-constant, s (~1s to settle)
const FLING_MIN = 6; // below this the fling is done, hand back to ambient (px/s)
const VEL_SMOOTH = 0.3; // blend of instantaneous pointer velocity into the tracked one
const FLING_HOLD_MS = 90; // released after pausing this long → no fling (grab-and-place)

interface Drifter {
  track: HTMLElement;
  axis: 'x' | 'y';
  dir: number;
  count: number;
  offset: number;
  size: number; // loop period (one set's extent, incl. one gap)
  hoverFactor: number;
  targetHover: number;
  dragging: boolean;
  flingVel: number; // residual release velocity, decays into ambient (px/s of offset)
}

// Positive modulo into [0, size): how far the set has scrolled from its start.
const wrap = (v: number, size: number) => ((v % size) + size) % size;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Below this width the rows abandon drift entirely for a discrete one-card pager
// (chevrons, no auto-scroll, no scrollbar) — see mountPager.
const MOBILE_Q = '(max-width: 768px)';
const isMobile = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(MOBILE_Q).matches;

// After a real drag, swallow the click the browser fires on the card link so a
// scrub doesn't navigate.
function swallowNextClick(el: HTMLElement): void {
  const swallow = (ev: Event) => {
    ev.preventDefault();
    ev.stopPropagation();
  };
  el.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => el.removeEventListener('click', swallow, true), 0);
}

// Rows own horizontal gestures, so keep Base's touch swipe-to-navigate (between
// disciplines) from also firing when a swipe starts on a row.
function blockPageSwipe(el: HTMLElement): () => void {
  const stop = (e: Event) => e.stopPropagation();
  el.addEventListener('touchstart', stop, { passive: true });
  return () => el.removeEventListener('touchstart', stop);
}

// Reduced mode: drag-to-scroll a natively-scrolling row-viewport. The gesture
// lives on the TRACK (card-height box) not the viewport, so the grab area
// doesn't spill into the viewport's top/bottom bleed padding.
function enableDragScroll(vp: HTMLElement): () => void {
  const grab = (vp.querySelector('.row-track') as HTMLElement | null) ?? vp;
  const unblock = blockPageSwipe(grab);
  let active = false;
  let lastX = 0;
  let moved = false;
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active = true;
    lastX = e.clientX;
    moved = false;
    try {
      grab.setPointerCapture(e.pointerId);
    } catch {}
    grab.style.cursor = 'grabbing';
  };
  const move = (e: PointerEvent) => {
    if (!active) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    if (Math.abs(dx) > DRAG_THRESHOLD) moved = true;
    vp.scrollLeft -= dx;
  };
  const up = () => {
    if (!active) return;
    active = false;
    grab.style.cursor = 'grab';
    if (moved) swallowNextClick(grab);
  };
  grab.style.cursor = 'grab';
  grab.addEventListener('pointerdown', down);
  grab.addEventListener('pointermove', move);
  grab.addEventListener('pointerup', up);
  grab.addEventListener('pointercancel', up);
  return () => {
    unblock();
    grab.removeEventListener('pointerdown', down);
    grab.removeEventListener('pointermove', move);
    grab.removeEventListener('pointerup', up);
    grab.removeEventListener('pointercancel', up);
    grab.style.cursor = '';
  };
}

// ----- Reduced motion: native finite scroll, truncated at the current position.
function mountReduced(root: ParentNode): () => void {
  const viewports = Array.from(root.querySelectorAll<HTMLElement>('.row-viewport'));
  const cleanups = viewports.map((vp) => {
    const track = vp.querySelector<HTMLElement>('.row-track');
    if (track) {
      // Drop any clones / transform a prior animated mount left behind — reduced
      // mode scrolls the originals only.
      track.querySelectorAll('.is-clone').forEach((n) => n.remove());
      track.style.transform = '';
      // Rotate so the card that was at the visual left edge before the toggle
      // becomes the first child. Native scroll then walks the remaining unique
      // cards once (finite) instead of looping.
      const index = Number(vp.dataset.redIndex) || 0;
      const kids = Array.from(track.children) as HTMLElement[];
      if (index > 0 && index < kids.length) {
        for (let i = 0; i < index; i++) track.appendChild(kids[i]);
      }
    }
    const frac = Number(vp.dataset.redFrac) || 0;
    delete vp.dataset.redIndex;
    delete vp.dataset.redFrac;
    const stopDrag = enableDragScroll(vp);
    // Preserve the exact pixel position so the toggle doesn't jump. Set now and
    // again next frame (once overflow-x: auto has taken layout effect).
    vp.scrollLeft = frac;
    requestAnimationFrame(() => (vp.scrollLeft = frac));
    return () => {
      // Hand the current scroll position back so animated mode can resume in
      // place (the DOM order is preserved across the toggle).
      vp.dataset.animScroll = String(vp.scrollLeft);
      stopDrag();
    };
  });
  return () => cleanups.forEach((c) => c());
}

// Record which original sits at the row's left edge (+ the sub-card remainder)
// so a following reduced mount can rotate to it and land pixel-for-pixel.
function recordRed(d: Drifter): void {
  const vp = d.track.parentElement as HTMLElement | null;
  if (!vp) return;
  const first = d.track.children[0] as HTMLElement | undefined;
  if (d.size <= 0 || !first) {
    vp.dataset.redIndex = '0';
    vp.dataset.redFrac = '0';
    return;
  }
  const firstStart = d.axis === 'x' ? first.offsetLeft : first.offsetTop;
  const scrolled = wrap(-d.offset, d.size); // [0, size)
  let index = 0;
  for (let i = 0; i < d.count; i++) {
    const c = d.track.children[i] as HTMLElement | undefined;
    if (!c) break;
    const start = (d.axis === 'x' ? c.offsetLeft : c.offsetTop) - firstStart;
    if (start <= scrolled + 0.5) index = i;
    else break;
  }
  const sel = d.track.children[index] as HTMLElement;
  const selStart = (d.axis === 'x' ? sel.offsetLeft : sel.offsetTop) - firstStart;
  vp.dataset.redIndex = String(index);
  vp.dataset.redFrac = String(Math.max(0, scrolled - selStart));
}

// ----- Animated: ambient drift + scroll-velocity boost + seamless grab-scrub.
function mountAnimated(root: ParentNode): () => void {
  const tracks = Array.from(root.querySelectorAll<HTMLElement>('[data-drift]'));
  if (!tracks.length) return () => {};

  const drifters: Drifter[] = tracks.map((track) => {
    const axis = (track.dataset.drift as 'x' | 'y') || 'x';
    const originals = Array.from(track.children) as HTMLElement[];
    const count = originals.length;
    const container = track.parentElement as HTMLElement | null;

    const appendSet = () =>
      originals.forEach((n) => {
        const clone = n.cloneNode(true) as HTMLElement;
        clone.classList.add('is-clone');
        track.appendChild(clone);
      });

    // The loop wraps on ONE set's period, so the content must span the viewport
    // PLUS one period — otherwise, when a set is narrower than the container, the
    // wrap seam lands mid-viewport (a gap you can watch relink). Duplicate once
    // for the tail, then keep adding whole sets until it's wide enough.
    appendSet();
    const first = track.children[0] as HTMLElement | undefined;
    const clone = track.children[count] as HTMLElement | undefined;
    const period =
      first && clone
        ? axis === 'x'
          ? clone.offsetLeft - first.offsetLeft
          : clone.offsetTop - first.offsetTop
        : 0;
    const containerExtent = () =>
      container ? (axis === 'x' ? container.clientWidth : container.clientHeight) : 0;
    const trackExtent = () => (axis === 'x' ? track.scrollWidth : track.scrollHeight);
    let guard = 0;
    while (period > 0 && trackExtent() < containerExtent() + period && guard < 24) {
      appendSet();
      guard++;
    }

    return {
      track,
      axis,
      dir: Number(track.dataset.dir) || 1,
      count,
      offset: 0,
      size: 0,
      hoverFactor: 1,
      targetHover: 1,
      dragging: false,
      flingVel: 0,
    };
  });

  const cleanups: Array<() => void> = [];
  for (const d of drifters) {
    const zone = d.track.parentElement;
    if (!zone) continue;
    const enter = () => (d.targetHover = HOVER_SLOW);
    const leave = () => (d.targetHover = 1);
    zone.addEventListener('pointerenter', enter);
    zone.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      zone.removeEventListener('pointerenter', enter);
      zone.removeEventListener('pointerleave', leave);
    });
  }

  // ----- Grab-to-scrub: a drag freezes the ambient drift and moves the offset
  // 1:1, wrapping on the period so it loops infinitely in either direction (same
  // seamless loop as the idle drift, no truncation). Horizontal rows only —
  // vertical (masonry) columns leave the drag to page scroll. -----
  // The gesture lives on the TRACK (card-height box), not the viewport, so the
  // grab area doesn't reach into the viewport's top/bottom bleed padding.
  let dragState:
    | { d: Drifter; lastX: number; moved: boolean; vel: number; lastT: number }
    | null = null;
  for (const d of drifters) {
    if (d.axis !== 'x') continue;
    const grab = d.track;
    grab.style.cursor = 'grab';
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragState = { d, lastX: e.clientX, moved: false, vel: 0, lastT: e.timeStamp };
      d.dragging = true;
      d.flingVel = 0; // a fresh grab cancels any in-flight momentum
      try {
        grab.setPointerCapture(e.pointerId);
      } catch {}
      grab.style.cursor = 'grabbing';
    };
    grab.addEventListener('pointerdown', down);
    const unblock = blockPageSwipe(grab);
    cleanups.push(() => {
      unblock();
      grab.removeEventListener('pointerdown', down);
      grab.style.cursor = '';
    });
  }
  const onMove = (e: PointerEvent) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.lastX;
    dragState.lastX = e.clientX;
    if (Math.abs(dx) > DRAG_THRESHOLD) dragState.moved = true;
    // Track pointer velocity (px/s), smoothed, for the release fling.
    const dtv = (e.timeStamp - dragState.lastT) / 1000;
    dragState.lastT = e.timeStamp;
    if (dtv > 0) dragState.vel += (dx / dtv - dragState.vel) * VEL_SMOOTH;
    const d = dragState.d;
    d.offset += dx;
    if (d.size > 0) d.offset = wrap(d.offset, d.size) - d.size;
  };
  const onUp = (e: PointerEvent) => {
    if (!dragState) return;
    const { d, moved, vel, lastT } = dragState;
    d.dragging = false;
    // Fling only if the pointer was still moving at release — a grab-and-hold
    // (paused before letting go) places the row without launching it.
    const heldStill = e.timeStamp - lastT > FLING_HOLD_MS;
    d.flingVel = moved && !heldStill ? clamp(vel, -FLING_MAX, FLING_MAX) : 0;
    d.track.style.cursor = 'grab';
    if (moved) swallowNextClick(d.track);
    dragState = null;
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
  cleanups.push(() => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
  });

  // Loop period = the first clone's offset (exact, includes one gap).
  const measure = () =>
    drifters.forEach((d) => {
      const first = d.track.children[0] as HTMLElement | undefined;
      const clone = d.track.children[d.count] as HTMLElement | undefined;
      if (!first || !clone) return void (d.size = 0);
      d.size =
        d.axis === 'x' ? clone.offsetLeft - first.offsetLeft : clone.offsetTop - first.offsetTop;
    });
  measure();

  // Seamless return from reduced mode: resume at the handed-back scroll position.
  for (const d of drifters) {
    const vp = d.track.parentElement as HTMLElement | null;
    const animScroll = vp ? Number(vp.dataset.animScroll) : NaN;
    if (vp) delete vp.dataset.animScroll;
    if (d.size > 0 && Number.isFinite(animScroll) && animScroll) {
      d.offset = wrap(-animScroll, d.size) - d.size;
    }
    // Apply the starting transform now so there's no one-frame flash at 0.
    d.track.style.transform =
      d.axis === 'x' ? `translate3d(${d.offset}px,0,0)` : `translate3d(0,${d.offset}px,0)`;
  }

  const onResize = () => measure();
  window.addEventListener('resize', onResize);

  let lastY = window.scrollY;
  let smoothVel = 0;
  let prevT = performance.now();
  let raf = 0;

  const frame = (t: number) => {
    const dt = Math.min(0.05, (t - prevT) / 1000);
    prevT = t;
    const y = window.scrollY;
    const rawVel = (y - lastY) / (dt || 0.016);
    lastY = y;
    smoothVel += (rawVel - smoothVel) * SMOOTH;

    for (const d of drifters) {
      if (!d.dragging) {
        // Release momentum: glide with the fling velocity, decaying toward zero
        // so it eases back into the ambient drift instead of stopping dead.
        if (Math.abs(d.flingVel) > FLING_MIN) {
          d.offset += d.flingVel * dt;
          d.flingVel *= Math.exp(-dt / FLING_TAU);
        } else {
          d.flingVel = 0;
        }
        // Ambient infinite loop (wraps on the period). A grabbed row skips this
        // entirely — its offset stays where the grab-scrub left it.
        d.hoverFactor += (d.targetHover - d.hoverFactor) * HOVER_RAMP;
        const speed = (AMBIENT * d.hoverFactor + smoothVel * SCROLL_GAIN) * d.dir;
        d.offset -= speed * dt;
        if (d.size > 0) d.offset = wrap(d.offset, d.size) - d.size;
      }
      d.track.style.transform =
        d.axis === 'x' ? `translate3d(${d.offset}px,0,0)` : `translate3d(0,${d.offset}px,0)`;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    cleanups.forEach((c) => c());
    drifters.forEach((d) => {
      recordRed(d); // capture left-edge position BEFORE tearing the clones down
      d.track.querySelectorAll('.is-clone').forEach((n) => n.remove());
      d.track.style.transform = '';
    });
  };
}

export function mountCarousels(root: ParentNode = document): () => void {
  // Mobile (01/02): a fundamentally different structure — a FIFO card queue, not
  // the drift with a media query. See src/lib/motion/mobile-queue.ts. (2D/03 is a
  // static full stack, handled in CSS.)
  if (isMobile()) return mountQueue(root);
  return prefersReducedMotion() ? mountReduced(root) : mountAnimated(root);
}
