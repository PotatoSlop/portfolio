/* Mobile FIFO card queue — the horizontal category rows (01 3D, 02 UI/UX) at
   mobile width.

   This is deliberately a SEPARATE infrastructure from the desktop drift, not the
   drift behind a media query. At mobile size exactly one card is visible (the
   FRONT of the queue); a pair of bare amber chevrons live in their own control
   layer (`.queue-nav`), and advancing rotates the queue — the current front card
   is moved to the BACK (`track.appendChild`), so it's true first-in-first-out.
   Nothing here touches the drift's `.row-track` transform, so resizing out of the
   desktop drift can never leave the card or the chevrons misaligned.

   The card DOM order is snapshotted at mount and restored on teardown, so a live
   breakpoint switch back to desktop hands the drift its cards in canonical order.

   Mounted by mountCarousels() when the viewport is mobile; torn down on
   astro:before-swap / breakpoint change like every other page behavior
   (see docs/routing-and-lifecycle.md). 2D (section 03) is NOT a queue — it stays
   a static, full-height stack showing every card, handled purely in CSS
   (MasonryGrid.astro), so it isn't touched here. */

// Tabler chevron-left / chevron-right (@iconify-json/tabler), matching the icon
// pack used elsewhere on the site (see SettingsToggles.astro). Inlined as raw
// SVG because this markup is injected client-side and can't use <Icon>.
const CHEVRON = (d: 'l' | 'r') =>
  `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${
    d === 'l' ? 'm15 6l-6 6l6 6' : 'm9 6l6 6l-6 6'
  }"/></svg>`;

function setupQueue(vp: HTMLElement): () => void {
  const track = vp.querySelector<HTMLElement>('.row-track');
  if (!track) return () => {};

  // Scrub any drift leftovers (clones + transform) so the queue starts clean and
  // can't inherit a stale translate from a prior desktop-drift mount.
  track.querySelectorAll('.is-clone').forEach((n) => n.remove());
  track.style.transform = '';

  // Snapshot the canonical order so teardown can restore it (rotation permutes
  // the DOM, and the desktop drift expects the authored order).
  const order = Array.from(track.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );
  if (order.length === 0) return () => {};

  vp.classList.add('is-queue'); // CSS shows only the first child (queue front)

  // Rotate the queue: next → current front goes to the back; prev → current back
  // comes to the front. CSS always renders `.d-card:first-child`.
  const rotate = (dir: number) => {
    if (dir > 0) {
      const front = track.firstElementChild;
      if (front) track.appendChild(front);
    } else {
      const back = track.lastElementChild;
      if (back) track.insertBefore(back, track.firstElementChild);
    }
  };

  const nav = document.createElement('div');
  nav.className = 'queue-nav';
  const mk = (dir: number, side: 'prev' | 'next', label: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `queue-nav__btn queue-nav__btn--${side}`;
    b.setAttribute('aria-label', label);
    b.innerHTML = CHEVRON(side === 'prev' ? 'l' : 'r');
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      rotate(dir);
    });
    return b;
  };
  // A single-card row has nothing to page — leave the chevrons off.
  if (order.length > 1) nav.append(mk(-1, 'prev', 'Previous card'), mk(1, 'next', 'Next card'));
  vp.appendChild(nav);

  return () => {
    nav.remove();
    vp.classList.remove('is-queue');
    // Restore the authored order (rotation may have permuted it).
    order.forEach((c) => track.appendChild(c));
  };
}

export function mountQueue(root: ParentNode = document): () => void {
  const cleanups = Array.from(root.querySelectorAll<HTMLElement>('.row-viewport')).map(setupQueue);
  return () => cleanups.forEach((c) => c());
}
