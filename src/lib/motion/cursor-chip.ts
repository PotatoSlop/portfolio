/* ===== Pointer follow =====
   Runs on Motion's shared frame loop
   (`frame.update` / `cancelFrame`) instead of a hand-managed requestAnimationFrame.

   The chip trails the pointer with DISTANCE-PROPORTIONAL velocity (exponential
   smoothing): each frame it closes a fixed fraction of the remaining gap, so it
   moves fast when far behind (responsive to quick flicks) and eases into a
   slight lag as it catches up — without a spring's overshoot/momentum. The
   fraction is dt-corrected so the feel is identical at any refresh rate. */

import { frame, cancelFrame } from 'motion';
import { prefersReducedMotion } from './reduced-motion';

/** Follow time-constant, seconds. Smaller = snappier / less lag. The chip
    closes ~63% of the remaining gap every TAU seconds. */
const TAU = 0.06;
/** Below this gap the chip is snapped to the target (avoids sub-pixel crawl). */
const SNAP_EPS = 0.5;

/** Clamp `v` to [lo, hi]; if the range is inverted (chip larger than the card
    on this axis) fall back to the range midpoint so the chip stays centred. */
const clamp = (v: number, lo: number, hi: number) =>
  hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));

interface ChipState {
  chip: HTMLElement;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

const paint = (s: ChipState) => {
  s.chip.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
};

/**
 * Wire the trailing "View Project" chip on every `[data-case]` card: the chip
 * (a `[data-chip]` child) follows the pointer with a slight distance-based lag,
 * snaps in on enter, and hides (`is-chip-off`) while the pointer is over a `[data-stop]`
 * control (the Repo button) so the two never collide. No-ops on touch / coarse
 * pointers. Returns a teardown fn.
 */
export function mountChipTrail(): () => void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  const reduced = prefersReducedMotion();
  const states: ChipState[] = [];
  const cleanups: Array<() => void> = [];

  document.querySelectorAll<HTMLElement>('[data-case]').forEach((card) => {
    const chip = card.querySelector<HTMLElement>('[data-chip]');
    if (!chip) return;

    const s: ChipState = { chip, x: 0, y: 0, tx: 0, ty: 0 };
    states.push(s);

    const local = (e: PointerEvent) => {
      const r = card.getBoundingClientRect();
      // Keep the chip's bounding box inside the card. It's centred on (px, py)
      // via translate(-50%, -50%), so clamp the centre by the chip's half-size
      // — the chip can never spill past the hover container's edges.
      const halfW = chip.offsetWidth / 2;
      const halfH = chip.offsetHeight / 2;
      return {
        px: clamp(e.clientX - r.left, halfW, r.width - halfW),
        py: clamp(e.clientY - r.top, halfH, r.height - halfH),
      };
    };

    const onEnter = (e: PointerEvent) => {
      const { px, py } = local(e);
      // Snap target AND chip to the entry point so it doesn't fly in.
      s.tx = s.x = px;
      s.ty = s.y = py;
      paint(s);
      card.classList.add('is-chip');
    };
    const onMove = (e: PointerEvent) => {
      const { px, py } = local(e);
      s.tx = px;
      s.ty = py;
      if (reduced) {
        // No lag under reduced motion — pin the chip to the pointer.
        s.x = px;
        s.y = py;
        paint(s);
      }
      card.classList.toggle('is-chip-off', !!(e.target as HTMLElement).closest('[data-stop]'));
    };
    const onLeave = () => card.classList.remove('is-chip', 'is-chip-off');

    card.addEventListener('pointerenter', onEnter);
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);

    cleanups.push(() => {
      card.removeEventListener('pointerenter', onEnter);
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
      card.classList.remove('is-chip', 'is-chip-off');
    });
  });

  if (states.length === 0) return () => {};

  // Constant-velocity pursuit. Reduced motion pins the chip in onMove, so the
  // loop is only needed for the animated path.
  const tick = ({ delta }: { delta: number }) => {
    // Fraction of the remaining gap to close this frame (dt-corrected). Clamped
    // to 1 so a long frame — e.g. the first tick after a hidden tab — snaps
    // rather than overshoots.
    const alpha = Math.min(1, 1 - Math.exp(-(delta / 1000) / TAU));
    for (const s of states) {
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      if (Math.abs(dx) < SNAP_EPS && Math.abs(dy) < SNAP_EPS) {
        if (s.x !== s.tx || s.y !== s.ty) {
          s.x = s.tx;
          s.y = s.ty;
          paint(s);
        }
        continue;
      }
      s.x += dx * alpha;
      s.y += dy * alpha;
      paint(s);
    }
  };

  if (!reduced) frame.update(tick, true);

  return () => {
    if (!reduced) cancelFrame(tick);
    cleanups.forEach((fn) => fn());
  };
}
