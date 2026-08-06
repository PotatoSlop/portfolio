/*
  lifecycle.ts — the ONE primitive for wiring page/component client behavior so it
  initializes identically no matter how the page was reached (full load, refresh,
  direct URL, or a client-side ClientRouter navigation via a link / pull-tab /
  `navigate()`). This is the enforced form of docs/routing-and-lifecycle.md.

  Why this exists
  ---------------
  Astro's <ClientRouter /> turns same-origin navigations into a client swap: the
  body is replaced but the document is NOT reloaded, so a bundled module's
  top-level code runs once and never again. The supported per-navigation hook is
  `astro:page-load`. BUT on a *first* SPA entry into a page, that page's bundled
  module is only inserted during the swap and — because ESM executes deferred — can
  evaluate AFTER `astro:page-load` has already fired. A plain

      document.addEventListener('astro:page-load', mount)

  therefore silently misses that first navigation, so the behavior never mounts
  until the next visit or a hard refresh. That is the "works when I refresh /
  arrive via a full reload, but not when I navigate in" dual-state bug (e.g. the
  discipline projects gallery not loading when reached by a pull-tab or the navbar,
  while the home-page drag-drop — a full `window.location` reload — always worked).

  The fix is always the same three moves: register on `astro:page-load`, tear down
  on `astro:before-swap`, and run ONE catch-up immediately in case page-load
  already fired. Hand-rolling that per script means every new behavior is a chance
  to forget the catch-up. `onPageReady` encapsulates it once.

  Usage
  -----
    // With teardown (rAF loops / observers / window+document listeners MUST be
    // returned so they don't leak across navigations):
    onPageReady('.eng-gallery', () => mountProjectsGallery());

    // Without teardown (only rebinds listeners to nodes inside the swapped body,
    // which are discarded on the next swap):
    onPageReady('.chip[data-filter]', () => initFilterGrid());

    // Genuinely global (no page-specific root): pass null.
    onPageReady(null, () => initSettingsToggles());
*/

export interface PageBehavior {
  /** True while the behavior is mounted for the current page. */
  readonly active: boolean;
  /** Tear down then mount again (no-op if the root is absent). Handy for a
   *  behavior that must also rebuild on a custom event, e.g. a motion-preference
   *  or colour-scheme change. */
  remount(): void;
  /** Detach the lifecycle listeners entirely and tear down if mounted. Rarely
   *  needed — behaviors normally live for the whole session. */
  dispose(): void;
}

/**
 * Wire a mount/teardown pair to the ClientRouter lifecycle with a built-in
 * first-entry catch-up and idempotency guard.
 *
 * @param root  A CSS selector that must be present for the behavior to mount, so
 *              the shared listeners no-op on pages the behavior doesn't belong to.
 *              Pass `null` for genuinely page-agnostic behaviors.
 * @param mount Setup run on each page where `root` matches. It may return a
 *              teardown `() => void`; that teardown runs on `astro:before-swap`
 *              (and must cancel every rAF, disconnect every observer, and remove
 *              every window/document listener it added).
 */
export function onPageReady(
  root: string | null,
  mount: () => (() => void) | void | null
): PageBehavior {
  let destroy: (() => void) | null = null;
  let active = false;

  const start = () => {
    if (active) return; // already mounted for this page — catch-up + page-load is one mount
    if (root && !document.querySelector(root)) return; // not on a page this behavior owns
    active = true;
    const teardown = mount();
    destroy = typeof teardown === 'function' ? teardown : null;
  };

  const stop = () => {
    if (!active) return;
    active = false;
    destroy?.();
    destroy = null;
  };

  document.addEventListener('astro:page-load', start);
  document.addEventListener('astro:before-swap', stop);

  // Catch-up: if this module evaluated *after* astro:page-load already fired on a
  // first SPA entry, mount now. The `active` guard makes the later page-load a
  // no-op, so this never double-mounts.
  start();

  return {
    get active() {
      return active;
    },
    remount() {
      stop();
      start();
    },
    dispose() {
      document.removeEventListener('astro:page-load', start);
      document.removeEventListener('astro:before-swap', stop);
      stop();
    },
  };
}
