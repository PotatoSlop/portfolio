import { prefersReducedMotion } from './reduced-motion';

const AMBIENT = 26; // idle drift, px/s
const SCROLL_GAIN = 2.6; // scroll-velocity → drift boost (~2.0 if too fast)
const SMOOTH = 0.12; // scroll-velocity smoothing
const HOVER_SLOW = 0.34; // ambient multiplier while hovering a row
const HOVER_RAMP = 0.06; // ease toward the hover target
const DRAG_THRESHOLD = 3; // px of travel before a drag suppresses the click

interface Drifter {
  track: HTMLElement;
  axis: 'x' | 'y';
  dir: number;
  count: number;
  offset: number;
  size: number;
  maxScroll: number; // bounded grab-scrub range: offset clamps to [-maxScroll, 0]
  hoverFactor: number;
  targetHover: number;
  dragging: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

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

// Reduced mode: drag-to-scroll a natively-scrolling row-viewport.
function enableDragScroll(vp: HTMLElement): () => void {
  const unblock = blockPageSwipe(vp);
  let active = false;
  let lastX = 0;
  let moved = false;
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active = true;
    lastX = e.clientX;
    moved = false;
    try {
      vp.setPointerCapture(e.pointerId);
    } catch {}
    vp.style.cursor = 'grabbing';
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
    vp.style.cursor = 'grab';
    if (moved) swallowNextClick(vp);
  };
  vp.style.cursor = 'grab';
  vp.addEventListener('pointerdown', down);
  vp.addEventListener('pointermove', move);
  vp.addEventListener('pointerup', up);
  vp.addEventListener('pointercancel', up);
  return () => {
    unblock();
    vp.removeEventListener('pointerdown', down);
    vp.removeEventListener('pointermove', move);
    vp.removeEventListener('pointerup', up);
    vp.removeEventListener('pointercancel', up);
    vp.style.cursor = '';
  };
}

export function mountDriftRows(root: ParentNode = document): () => void {
  // Reduced motion: no clones, no loop — rows are native horizontal scroll (CSS),
  // still grab-scrubbable so the work is reachable.
  if (prefersReducedMotion()) {
    const viewports = Array.from(root.querySelectorAll<HTMLElement>('.row-viewport'));
    const cleanups = viewports.map((vp) => enableDragScroll(vp));
    return () => cleanups.forEach((c) => c());
  }

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
      maxScroll: 0,
      hoverFactor: 1,
      targetHover: 1,
      dragging: false,
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

  // ----- Grab-to-scrub (animated mode): drag freezes ambient + moves offset 1:1.
  // Horizontal rows only — vertical (masonry) columns leave the drag to the page
  // scroll, and several share one parent, so scrubbing them makes no sense. -----
  let dragState: { d: Drifter; lastX: number; moved: boolean; lo: number; hi: number } | null = null;
  for (const d of drifters) {
    if (d.axis !== 'x') continue;
    const zone = d.track.parentElement as HTMLElement | null;
    if (!zone) continue;
    zone.style.cursor = 'grab';
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Bounded scrub range, no snap on grab: the range is [-maxScroll, 0], but
      // if the ambient loop had drifted past that (into the seam region), extend
      // the lower bound to the current offset so grabbing never jumps. Rows whose
      // content fits (maxScroll 0) freeze in place.
      const lo = d.maxScroll > 0 ? Math.min(-d.maxScroll, d.offset) : d.offset;
      const hi = d.maxScroll > 0 ? 0 : d.offset;
      dragState = { d, lastX: e.clientX, moved: false, lo, hi };
      d.dragging = true;
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {}
      zone.style.cursor = 'grabbing';
    };
    zone.addEventListener('pointerdown', down);
    const unblock = blockPageSwipe(zone);
    cleanups.push(() => {
      unblock();
      zone.removeEventListener('pointerdown', down);
      zone.style.cursor = '';
    });
  }
  const onMove = (e: PointerEvent) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.lastX;
    dragState.lastX = e.clientX;
    if (Math.abs(dx) > DRAG_THRESHOLD) dragState.moved = true;
    // Horizontal rows: pointer dx → offset 1:1, clamped to the (jump-free)
    // bounded range so the swipe truncates at the content ends, no infinite loop.
    dragState.d.offset = clamp(dragState.d.offset + dx, dragState.lo, dragState.hi);
  };
  const onUp = () => {
    if (!dragState) return;
    const { d, moved } = dragState;
    d.dragging = false;
    const zone = d.track.parentElement as HTMLElement | null;
    if (zone) zone.style.cursor = 'grab';
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

  // Loop period = the first clone's offset (exact, includes one gap). Also the
  // bounded grab range: the ORIGINALS' extent minus the viewport (so a grab
  // scrubs the real content once and stops, like the reduced-mode native scroll).
  const measure = () =>
    drifters.forEach((d) => {
      const first = d.track.children[0] as HTMLElement | undefined;
      const clone = d.track.children[d.count] as HTMLElement | undefined;
      const lastOrig = d.track.children[d.count - 1] as HTMLElement | undefined;
      const container = d.track.parentElement as HTMLElement | null;
      if (!first || !clone) return void (d.size = 0);
      d.size = d.axis === 'x' ? clone.offsetLeft - first.offsetLeft : clone.offsetTop - first.offsetTop;
      const content = lastOrig
        ? d.axis === 'x'
          ? lastOrig.offsetLeft + lastOrig.offsetWidth - first.offsetLeft
          : lastOrig.offsetTop + lastOrig.offsetHeight - first.offsetTop
        : 0;
      const viewport = container ? (d.axis === 'x' ? container.clientWidth : container.clientHeight) : 0;
      d.maxScroll = Math.max(0, content - viewport);
    });
  measure();
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
        // Ambient infinite loop (wraps on the period). A grabbed row skips this
        // entirely — its offset stays where the bounded drag left it.
        d.hoverFactor += (d.targetHover - d.hoverFactor) * HOVER_RAMP;
        const speed = (AMBIENT * d.hoverFactor + smoothVel * SCROLL_GAIN) * d.dir;
        d.offset -= speed * dt;
        if (d.size > 0) d.offset = (((d.offset % d.size) + d.size) % d.size) - d.size;
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
      d.track.querySelectorAll('.is-clone').forEach((n) => n.remove());
      d.track.style.transform = '';
    });
  };
}
