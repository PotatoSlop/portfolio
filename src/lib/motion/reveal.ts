import { animate, inView } from 'motion';
import type { DOMKeyframesDefinition, AnimationOptions } from 'motion';
import { prefersReducedMotion } from './reduced-motion';

type Target = Element | string | NodeListOf<Element> | Element[];

export type RevealOptions = AnimationOptions & {
  /** Portion of the element that must be visible to trigger (Motion `amount`). */
  amount?: number | 'some' | 'all';
  /** Viewport margin string, e.g. '0px 0px -8% 0px' (Motion `margin`). */
  margin?: string;
  /** Re-trigger every time the element re-enters. Default: reveal once. */
  repeat?: boolean;
  /**
   * Element to WATCH for viewport entry, when it differs from the element(s)
   * being animated. Essential when the animated element is transformed off its
   * layout position (e.g. armed with translateY(100%)): its transformed box is
   * what IntersectionObserver sees, so it would never scroll into view. Watch a
   * stationary ancestor/container instead. Defaults to the animated target.
   */
  observe?: Element | string;
};

// Converts all types of Target element to animate into an Element Array
function resolve(target: Target): Element[] {
  if (typeof target === 'string') return Array.from(document.querySelectorAll(target));
  if (target instanceof Element) return [target];
  return Array.from(target);
}

/** First value of each keyframe track — the "from" (armed hidden) state. */
function firstFrame(kf: DOMKeyframesDefinition): DOMKeyframesDefinition {
  return mapFrame(kf, (v) => (Array.isArray(v) ? v[0] : v));
}
/** Last value of each keyframe track — the resting "to" state. */
function lastFrame(kf: DOMKeyframesDefinition): DOMKeyframesDefinition {
  return mapFrame(kf, (v) => (Array.isArray(v) ? v[v.length - 1] : v));
}
function mapFrame(kf: DOMKeyframesDefinition, pick: (v: unknown) => unknown,): DOMKeyframesDefinition {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(kf)) out[k] = pick(v);
  return out as DOMKeyframesDefinition;
}

/**
 * Reveal `target` when it scrolls into view.
 *
 *   reveal('.eng-feature', { transform: ['translateY(100%)', 'translateY(0)'] },
 *          { duration: 0.8, ease: eases.smooth, amount: 0.2 });
 *
 * - Arms the initial (from) state synchronously so there's no flash of the
 *   resting state before the trigger fires.
 * - Under reduced motion, snaps straight to the final state and never observes.
 * - Reveals once by default; pass `repeat: true` to re-run on every re-entry.
 *
 * Returns a stop() to cancel observation early.
 */
export function reveal(target: Target, keyframes: DOMKeyframesDefinition, options: RevealOptions = {},): () => void {
  const { amount = 0.2, margin, repeat = false, observe, ...transition } = options;
  const elements = resolve(target);
  if (!elements.length) return () => {};

  if (prefersReducedMotion()) {
    for (const element of elements) animate(element, lastFrame(keyframes), { duration: 0 });
    return () => {};
  }

  // Arm hidden start state immediately.
  const from = firstFrame(keyframes);
  for (const element of elements) animate(element, from, { duration: 0 });

  // Watch a stationary element when the animated target is transformed off its
  // layout box (see `observe`); otherwise watch the target itself.
  const watch = (observe ?? target) as never;
  const play = () => {
    for (const element of elements) animate(element, keyframes, transition);
  };
  const arm = () => {
    for (const element of elements) animate(element, from, { duration: 0 });
  };

  let stop = () => {};
  stop = inView(
    watch,
    () => {
      play();
      if (!repeat) stop();
      // When repeating, re-arm on leave so the next entry animates in again.
      return repeat ? arm : undefined;
    },
    { amount, margin: margin as never },
  );
  return stop;
}
