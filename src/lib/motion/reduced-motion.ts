const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the user has manually toggled reduced motion via the corner toggle
 *  (`html[data-sim-reduced]`), independent of the OS media query. */
export function manualReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.simReduced === '1';
}

/** True when reduced motion is requested — by the OS media query OR the site's
 *  own corner toggle. Safe during SSR (returns false). */
export function prefersReducedMotion(): boolean {
  if (manualReducedMotion()) return true;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}
