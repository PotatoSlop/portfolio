/*
  projects-gallery.ts — the shared lifecycle for a discipline "projects" section
  built from the components/projects/ kit: a feature ProjectCard inside a
  `.feature-crop`, a ProjectAccordion of the rest, and the one shared CaseOverlay.
  One mount() wires every behaviour and returns a single teardown, so each page's
  <script> is three lines instead of the ~100 this used to be inline.

  Behaviours (each guards on its own elements, so a page missing a piece is fine):
    1. Feature card rides up from its crop on scroll-in; its shadow settles after.
    2. Pointer-driven accordion expansion (panels expand under the cursor).
    3. Hero clip hover-scrub, the trailing "View Project" chip, and the FLIP
       case-study overlay.

  Idempotent + fully torn down (rAF / observers / listeners / timers) per
  docs/routing-and-lifecycle.md — safe to mount on `astro:page-load` and destroy
  on `astro:before-swap`.
*/
import { reveal } from './reveal';
import { eases } from './tokens';
import { mountVideoScrub, type VideoScrubHandle } from './video-scrub';
import { mountChipTrail } from './cursor-chip';
import { mountCaseOverlay } from './case-overlay';

export function mountProjectsGallery(root: ParentNode = document): () => void {
  const disposers: Array<() => void> = [];
  const timers: number[] = [];
  let videoScrub: VideoScrubHandle | null = null;

  // 1. Hero feature rides up from below its crop on first scroll into view.
  if (root.querySelector('.feature-crop')) {
    disposers.push(
      reveal(
        '.feature-crop .feat',
        {
          transform: ['translateY(100%)', 'translateY(0)'],
          opacity: [0.25, 1],
        },
        {
          observe: '.feature-crop',
          delay: 0.05,
          duration: 0.8,
          ease: eases.smooth,
          amount: 0.2,
          margin: '0px 0px -8% 0px',
        }
      )
    );

    // Card shadow settles in only AFTER the crop reveal (0.05 + 0.8s) is done,
    // so it never frames the card while it's still riding up through the crop.
    disposers.push(
      reveal(
        '.feature-crop',
        {
          boxShadow: [
            '0 6px 22px -6px rgba(30, 30, 20, 0)',
            '0 6px 22px -6px rgba(30, 30, 20, 0.22)',
          ],
        },
        {
          delay: 0.9,
          duration: 0.4,
          ease: eases.smooth,
          amount: 0.2,
          margin: '0px 0px -8% 0px',
        }
      )
    );
  }

  const acc = root.querySelector<HTMLElement>('.acc');
  const panels = acc ? [...acc.querySelectorAll<HTMLElement>('.acc__panel')] : [];

  // 2. Pointer-driven accordion expansion (mouse). CSS :hover can't drive this
  // reliably: expanding a panel reflows its siblings under the cursor, and
  // :hover re-evaluates against whatever sits under the cursor AFTER the reflow
  // — which fires with no pointer movement at all, and passes through the 4px
  // inter-panel gaps where every panel momentarily equalises. The net effect was
  // that sweeping right off an expanded panel cascaded straight to the last one,
  // leaving the middle panels unreachable. Gating the active panel on real
  // pointermove fixes it: a reflow under a still cursor emits no event, so the
  // active panel only changes when the user actually moves. Keyboard is handled
  // separately by :focus-within in CSS; touch/column layout doesn't use this.
  if (acc && panels.length > 1 && window.matchMedia('(hover: hover)').matches) {
    let active: HTMLElement | null = null;
    const setActive = (panel: HTMLElement | null) => {
      if (panel === active) return;
      active?.classList.remove('is-active');
      active = panel;
      active?.classList.add('is-active');
      acc.classList.toggle('is-interacting', !!active);
    };
    // Hit-test the panels' CURRENT rects. Over a gap → keep the current panel
    // (don't clear), so crossing a gutter never flashes the default layout.
    const panelAt = (x: number, y: number) => {
      for (const p of panels) {
        const r = p.getBoundingClientRect();
        if (x >= r.left && x < r.right && y >= r.top && y <= r.bottom) return p;
      }
      return null;
    };
    const onMove = (e: PointerEvent) => {
      const hit = panelAt(e.clientX, e.clientY);
      if (hit) setActive(hit);
    };
    const onLeave = () => setActive(null);
    acc.addEventListener('pointermove', onMove);
    acc.addEventListener('pointerleave', onLeave);
    disposers.push(() => {
      acc.removeEventListener('pointermove', onMove);
      acc.removeEventListener('pointerleave', onLeave);
      setActive(null);
    });
  }

  // 3. Hover-scrubbed hero clip: the whole feature card drives playback.
  const feature = root.querySelector<HTMLElement>('.feat');
  const video = feature?.querySelector<HTMLVideoElement>('[data-scrub-video]');
  if (feature && video) {
    videoScrub = mountVideoScrub(feature, video);
  }

  // Trailing "View Project" chip + SPA case-study overlay (both query the page).
  const destroyChip = mountChipTrail();
  const destroyOverlay = mountCaseOverlay();

  return () => {
    for (const d of disposers) d();
    for (const t of timers) window.clearTimeout(t);
    videoScrub?.destroy();
    videoScrub = null;
    destroyChip?.();
    destroyOverlay?.();
  };
}
