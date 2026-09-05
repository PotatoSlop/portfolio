/* ===== Motion tokens =====
   JS mirror of the CSS motion tokens in styles/tokens.css. Keep these in sync:
   if you change a duration/ease here, change it there too (and vice-versa) so
   CSS-driven and Motion-driven animation share one visual language.

   Durations are in SECONDS (Motion's unit), matching the CSS `--duration-*`
   values. Eases are cubic-bezier control-point arrays, the form Motion's
   `ease` option accepts. */

/** Cross-fade / transform durations, seconds. Mirrors --duration-* in tokens.css. */
export const durations = {
  fast: 0.25,
  medium: 0.3,
  smooth: 0.35,
  slow: 0.5,
  xslow: 1,
} as const;

/** cubic-bezier control points. Mirrors --ease-* in tokens.css. */
export const eases = {
  bouncy: [0.4, 1.1, 0.6, 1],
  smooth: [0.4, 1, 0.6, 1],
  aggressive: [0.4, 2, 0.6, 1],
  logoHover: [0.075, 0.82, 0.165, 1],
} as const;

/** Base stagger step between siblings, seconds. Mirrors --wave-delay-base. */
export const staggerBase = 0.25;

/** Spring presets for gesture / cursor-chip work.
   Passed as `{ type: 'spring', ...springs.snappy }` to Motion's animate(). */
export const springs = {
  snappy: { stiffness: 400, damping: 32 },
  soft: { stiffness: 180, damping: 26 },
  overshoot: { stiffness: 320, damping: 18 },
} as const;
