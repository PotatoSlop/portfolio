const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the user has asked for reduced motion. Safe during SSR (returns false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}


export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media_query_list = window.matchMedia(QUERY);
  const handler = (e: MediaQueryListEvent) => cb(e.matches);
  media_query_list.addEventListener('change', handler);
  return () => media_query_list.removeEventListener('change', handler);
}

// Takes in an animation function and a fallback function and chooses between the two dep. on reduce motion setting state
export function guard(animate: () => void, fallback?: () => void): void {
  if (prefersReducedMotion()) {
    fallback?.();
    return;
  }
  animate();
}
