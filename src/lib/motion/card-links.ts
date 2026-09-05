/* ===== Card-body link stub (MVP) =====
   The in-page case-study modal (see case-overlay.ts) is disabled for the MVP.
   In its place, the whole card body acts as a link: clicking it opens the
   project's repo — or the GitHub profile as a default — in a new tab. The
   target lives on each card's `data-case-href` (computed in ProjectCard.astro).

   Interaction contract mirrors the old overlay so nothing else changes:
   - Clicking the card body opens the link; `[data-stop]` targets (the Repo
     button, cross-discipline links) are excluded so they act on their own.
   - Enter / Space on the focused card opens it too (keyboard parity).

   Returns a teardown fn (remove on `astro:before-swap`); no-ops if there are
   no `[data-case]` cards on the page. */

/**
 * Wire every `[data-case]` card so its body opens `data-case-href` in a new tab.
 */
export function mountCardLinks(): () => void {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-case]'));

  const openHref = (card: HTMLElement) => {
    const href = card.dataset.caseHref;
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  const perCard = cards.map((card) => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-stop]')) return;
      openHref(card);
    };
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === 'Enter' || e.key === ' ') &&
        !(e.target as HTMLElement).closest('[data-stop], a')
      ) {
        e.preventDefault();
        openHref(card);
      }
    };
    card.addEventListener('click', onClick);
    card.addEventListener('keydown', onKey);
    return () => {
      card.removeEventListener('click', onClick);
      card.removeEventListener('keydown', onKey);
    };
  });

  return () => perCard.forEach((fn) => fn());
}
