import { prefersReducedMotion } from './reduced-motion';

/* Design-page load / reveal choreography (ported from the prototype).
   - Hero title + section titles: colour-block reveal (block crops in from the
     bottom, holds, exits the top revealing each glyph; L→R stagger).
   - Feature card: box reveal (vertical strips doing the same block motion).
   - Breadcrumb / caption / toggle: crop-lr wipe.
   - Grid containers (.crop-tb): crop-tb wipe on scroll-into-view.

   GOTCHA: a clip-path'd element reports 0 intersection to IntersectionObserver,
   so the .crop-tb reveal observes the element's UNCLIPPED parent, not itself.

   Mount on astro:page-load, call the returned destroy() on astro:before-swap. */

// The colour-block reveal sweeps in amber across the board: navy blocks vanished
// against the dark navy page in dark mode (and amber reads better on cream too).
const AMBER = '#F5A045';

// Wrap each character in an overflow-hidden cell holding a colour-block cover
// and an opacity-gated glyph, so the block can crop over then off a blank glyph.
function wrapCharsReveal(el: HTMLElement, color: string): void {
  el.style.setProperty('--br-color', color);
  const txt = el.textContent ?? '';
  el.textContent = '';
  el.classList.add('br');
  let i = 0;
  for (const ch of txt) {
    const cell = document.createElement('span');
    cell.className = 'br-ch';
    cell.style.setProperty('--i', String(i++));
    const cover = document.createElement('span');
    cover.className = 'br-cover';
    cell.appendChild(cover);
    const glyph = document.createElement('span');
    glyph.className = 'br-glyph';
    glyph.textContent = ch === ' ' ? ' ' : ch;
    cell.appendChild(glyph);
    el.appendChild(cell);
  }
}

// Overlay a non-text element with N vertical strips that block-reveal L→R.
function boxReveal(el: HTMLElement, color: string, n: number): void {
  el.style.setProperty('--br-color', color);
  const ov = document.createElement('div');
  ov.className = 'br-box';
  for (let k = 0; k < n; k++) {
    const s = document.createElement('span');
    s.className = 'br-strip';
    s.style.setProperty('--i', String(k));
    ov.appendChild(s);
  }
  el.appendChild(ov);
}

const reveal = (el: HTMLElement | null) => {
  if (!el) return;
  el.classList.remove('pre-anim');
  el.classList.add('br--go');
};

export function mountDesignReveal(root: ParentNode = document): () => void {
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s);
  const heroTitle = q('.hero-title');
  const crumb = q('.hero-crumb');
  const sub = q('.hero-sub');
  const toggle = q('.hero-cycler');
  const feature = q('.hero-feature');
  const cropTbEls = Array.from(root.querySelectorAll<HTMLElement>('.crop-tb'));
  const secTitleSpec: Array<[string, string]> = [
    ['#s-3d .dp-head h2', AMBER],
    ['#s-uiux .dp-head h2', AMBER],
    ['#s-2d .dp-head h2', AMBER],
    ['#s-grid .dp-head h2', AMBER],
  ];

  // Reduced motion (OS pref OR the corner toggle): reveal everything at once.
  if (prefersReducedMotion()) {
    [crumb, sub, toggle, ...cropTbEls].forEach((e) => e?.classList.add('in'));
    [heroTitle, feature].forEach((e) => e?.classList.remove('pre-anim'));
    return () => {};
  }

  // Hero + section titles → block reveal (glyphs start blank).
  if (heroTitle) {
    wrapCharsReveal(heroTitle, AMBER);
    heroTitle.classList.remove('pre-anim'); // now hidden by the blank glyphs
  }
  if (feature) {
    boxReveal(feature, AMBER, 12);
    feature.classList.remove('pre-anim');
    const hfInner = feature.querySelector<HTMLElement>('.hf-inner');
    if (hfInner) hfInner.style.opacity = '0';
  }
  secTitleSpec.forEach(([sel, col]) => {
    const el = q(sel);
    if (el) wrapCharsReveal(el, col);
  });

  const observers: IntersectionObserver[] = [];
  const timers: number[] = [];

  // Section titles ripple when scrolled into view.
  const ioTitle = new IntersectionObserver(
    (entries, o) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('br--go');
          o.unobserve(e.target);
        }
      }),
    { threshold: 0.35 }
  );
  secTitleSpec.forEach(([sel]) => {
    const el = q(sel);
    if (el) ioTitle.observe(el);
  });
  observers.push(ioTitle);

  // Grid containers crop-in top→bottom — observe the UNCLIPPED parent (see gotcha).
  cropTbEls.forEach((el) => {
    const host = el.parentElement;
    if (!host) return;
    const o = new IntersectionObserver(
      (entries, ob) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('in');
            ob.disconnect();
          }
        }),
      { threshold: 0.05 }
    );
    o.observe(host);
    observers.push(o);
  });

  // Hero timeline: caption group + feature come in first (~150ms), then the
  // DESIGN colour block fills (~700ms); clean up the feature strips after. The
  // ~150ms lead gives the initial (clipped/covered) state time to paint, so we
  // don't need an rAF gate — which also keeps the reveal from stalling if the
  // page first loads in a backgrounded tab (rAF throttled, setTimeout not).
  // Caption group wipes in top→bottom (breadcrumb → subtitle → toggle) so the
  // three crop-lr lines cascade rather than snap in together. The feature card's
  // box reveal rides in with the breadcrumb.
  timers.push(
    window.setTimeout(() => {
      crumb?.classList.add('in');
      reveal(feature);
    }, 150)
  );
  timers.push(window.setTimeout(() => sub?.classList.add('in'), 270));
  timers.push(window.setTimeout(() => toggle?.classList.add('in'), 390));
  timers.push(window.setTimeout(() => reveal(heroTitle), 700));
  timers.push(
    window.setTimeout(() => {
      feature?.classList.remove('br--go');
      feature?.querySelector('.br-box')?.remove();
      const hfInner = feature?.querySelector<HTMLElement>('.hf-inner');
      if (hfInner) hfInner.style.opacity = '';
    }, 1450)
  );

  return () => {
    timers.forEach((t) => clearTimeout(t));
    observers.forEach((o) => o.disconnect());
  };
}
