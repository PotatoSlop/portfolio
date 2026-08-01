/* ===== Case-study overlay =====
   SPA-style "expand" from a project card into a fullscreen case-study / 3D
   preview stub. The card's media FLIPs into the overlay frame: the fullscreen
   frame is mapped back onto the card's media rect, then animated to identity so
   it appears to grow in place — the same shared-element move a real Astro view
   transition into `/engineering/[slug]` will eventually give.

   Interaction contract (matches the card model):
   - Clicking the card body opens the case study; `[data-stop]` targets (the Repo
     button, cross-discipline links) are excluded so they never trigger it.
   - Technologies travel from the card's `data-tech` into the overlay's "Built
     with" list — tech lives in the case study, never on the card.
   - Esc, the backdrop, and the Back button close it; focus returns to the card. */

import { animate } from 'motion';
import { durations, eases } from './tokens';
import { prefersReducedMotion } from './reduced-motion';

/**
 * Mount the shared `#caseov` overlay and wire every `[data-case]` card to open
 * it. Returns a teardown fn (remove on `astro:before-swap`). No-ops if the
 * overlay markup isn't present.
 */
export function mountCaseOverlay(): () => void {
  const overlay = document.getElementById('caseov');
  const frame = overlay?.querySelector<HTMLElement>('[data-caseov-frame]');
  const ovTitle = overlay?.querySelector<HTMLElement>('[data-caseov-title]');
  const ovGlyph = overlay?.querySelector<HTMLElement>('[data-caseov-glyph]');
  const ovSpec = overlay?.querySelector<HTMLElement>('[data-caseov-spec]');
  const ovTech = overlay?.querySelector<HTMLElement>('[data-caseov-tech]');
  const closeBtn = overlay?.querySelector<HTMLElement>('[data-caseov-close]');
  if (!overlay || !frame || !ovTitle || !ovGlyph || !ovSpec || !ovTech || !closeBtn) {
    return () => {};
  }

  let sourceMedia: HTMLElement | null = null;

  // Map the fullscreen frame back onto a card-media rect (FLIP "first" state).
  const flipFrom = (rect: DOMRect) =>
    `translate(${rect.left}px, ${rect.top}px) scale(${rect.width / innerWidth}, ${rect.height / innerHeight})`;

  const open = (card: HTMLElement) => {
    const media = card.querySelector<HTMLElement>('[data-media]');
    if (!media) return;
    sourceMedia = media;

    const title = card.dataset.title ?? 'Project';
    ovTitle.textContent = title;
    ovGlyph.textContent = title.charAt(0);

    // Tech (case-study only) injected from the card's data-tech; hidden if none.
    const tech = (card.dataset.tech || '').split('|').filter(Boolean);
    ovTech.replaceChildren(
      ...tech.map((t) => {
        const li = document.createElement('li');
        li.textContent = t;
        return li;
      })
    );
    ovSpec.hidden = tech.length === 0;

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (prefersReducedMotion()) {
      frame.style.transform = 'none';
      return;
    }
    frame.style.transformOrigin = 'top left';
    frame.style.transform = flipFrom(media.getBoundingClientRect());
    animate(
      frame,
      { transform: 'translate(0px, 0px) scale(1, 1)' },
      { duration: durations.slow, ease: eases.smooth }
    );
  };

  const close = () => {
    document.body.style.overflow = '';
    const finish = () => {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      frame.style.transform = '';
      sourceMedia?.closest<HTMLElement>('[data-case]')?.focus();
      sourceMedia = null;
    };
    if (prefersReducedMotion() || !sourceMedia) {
      finish();
      return;
    }
    animate(frame, { transform: flipFrom(sourceMedia.getBoundingClientRect()) }, {
      duration: durations.smooth,
      ease: eases.smooth,
    }).then(finish);
  };

  // Per-card open triggers (body = case study; [data-stop] excluded).
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-case]'));
  const perCard = cards.map((card) => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-stop]')) return;
      open(card);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('[data-stop], a')) {
        e.preventDefault();
        open(card);
      }
    };
    card.addEventListener('click', onClick);
    card.addEventListener('keydown', onKey);
    return () => {
      card.removeEventListener('click', onClick);
      card.removeEventListener('keydown', onKey);
    };
  });

  const onBackdrop = (e: MouseEvent) => {
    if (e.target === overlay) close();
  };
  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
  };
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onEsc);

  return () => {
    perCard.forEach((fn) => fn());
    closeBtn.removeEventListener('click', close);
    overlay.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onEsc);
    document.body.style.overflow = '';
  };
}
