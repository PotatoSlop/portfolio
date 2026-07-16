import { animate, stagger } from 'motion';
import type {
  DOMKeyframesDefinition,
  AnimationOptions,
  AnimationSequence,
  SequenceOptions,
} from 'motion';
import { prefersReducedMotion } from './reduced-motion';
import { durations, eases, staggerBase } from './tokens';

type Target = Element | string | NodeListOf<Element> | Element[];

function resolve(target: Target): Element[] {
  if (typeof target === 'string') return Array.from(document.querySelectorAll(target));
  if (target instanceof Element) return [target];
  return Array.from(target);
}

/** First value of each keyframe track — the armed "from" state. */
function firstFrame(kf: DOMKeyframesDefinition): DOMKeyframesDefinition {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(kf)) out[k] = Array.isArray(v) ? v[0] : v;
  return out as DOMKeyframesDefinition;
}
/** Last value of each keyframe track — the resting "to" state. */
function lastFrame(kf: DOMKeyframesDefinition): DOMKeyframesDefinition {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(kf)) out[k] = Array.isArray(v) ? v[v.length - 1] : v;
  return out as DOMKeyframesDefinition;
}

export type EntranceOptions = AnimationOptions & {
  /** Per-sibling stagger step, seconds. Only meaningful for multi-element targets. */
  each?: number;
};

/**
 * Play an entrance animation immediately (on load), not on scroll — the
 * on-load counterpart to reveal(). Arms the "from" state synchronously to avoid
 * a flash of the resting state, gates reduced motion (snaps straight to the
 * final state), and staggers across multiple elements.
 *
 *   entrance('.eng-hero__char',
 *     { transform: ['translateY(82px)', 'none'], opacity: [0, 1] },
 *     { duration: durations.slow, ease: eases.smooth, each: 0.055 });
 *
 * Returns the Motion animation (or null under reduced motion / empty target).
 */
export function entrance(
  target: Target,
  keyframes: DOMKeyframesDefinition,
  options: EntranceOptions = {},
) {
  const { each = staggerBase / 4, duration = durations.slow, ease = eases.smooth, ...rest } = options;
  const els = resolve(target);
  if (!els.length) return null;

  if (prefersReducedMotion()) {
    animate(els, lastFrame(keyframes), { duration: 0 });
    return null;
  }

  animate(els, firstFrame(keyframes), { duration: 0 });
  return animate(els, keyframes, {
    duration,
    ease,
    ...(els.length > 1 ? { delay: stagger(each) } : {}),
    ...rest,
  });
}

/**
 * Run an ordered choreography of segments via Motion's sequence form. Each
 * segment is `[target, keyframes, segmentOptions?]`; use `at` in a segment's
 * options ('<', '+0.1', absolute time) to overlap or offset steps.
 *
 * Under reduced motion, snaps every segment to its final frame with no timeline.
 *
 *   sequence([
 *     ['.crop', { transform: ['translateY(100%)', 'none'] }],
 *     ['.chevron', { opacity: [0, 1] }, { at: '-0.2' }],
 *   ], { duration: durations.slow, ease: eases.smooth });
 */
export function sequence(segments: AnimationSequence, options: SequenceOptions = {}) {
  if (prefersReducedMotion()) {
    for (const seg of segments) {
      if (!Array.isArray(seg)) continue;
      const [target, keyframes] = seg as [Target, DOMKeyframesDefinition];
      const els = resolve(target);
      if (els.length) animate(els, lastFrame(keyframes), { duration: 0 });
    }
    return null;
  }
  return animate(segments, options);
}
