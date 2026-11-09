import { prefersReducedMotion } from './reduced-motion';

const AMBER = '#F5A045';

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

/*
  Design page reveals.
    Hero (DesignHero)    — a load timeline. Every hero element declares its beat
                           as `data-reveal-at="<ms>"`; the title gets the block-
                           letter reveal on its beat, everything else gets `.in`
                           (crop-lr wipe / fade-in). Timing lives in the markup.
    Featured card        — below the fold, so its strip reveal + countdown bar
                           wipe fire on scroll-into-view, not on load.
    Section titles, grids — scroll-triggered, as before.
*/
export function mountDesignReveal(root: ParentNode = document): () => void {
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s);
  const heroTitle = q('.dh-title');
  const beats = Array.from(root.querySelectorAll<HTMLElement>('.dh [data-reveal-at]')).filter((el) => el !== heroTitle);
  const featSection = q('#dp-featured');
  const toggle = q('.feat-cycler');
  const feature = q('.feat-card');
  const cropTbEls = Array.from(root.querySelectorAll<HTMLElement>('.crop-tb'));
  const at = (el: HTMLElement | null) => Number(el?.dataset.revealAt ?? 0);
  const secTitleSpec: Array<[string, string]> = [
    ['#s-3d .dp-head h2', AMBER],
    ['#s-uiux .dp-head h2', AMBER],
    ['#s-photo .dp-head h2', AMBER],
    ['#s-grid .dp-head h2', AMBER],
  ];

  // Reduced motion
  if (prefersReducedMotion()) {
    [...beats, toggle, ...cropTbEls].forEach((e) => e?.classList.add('in'));
    [heroTitle, feature].forEach((e) => e?.classList.remove('pre-anim'));
    return () => {};
  }

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

  // Section titles ripple
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

  // Hero load timeline — setTimeout, not rAF (rAF throttles in background tabs,
  // which would leave the hero blank).
  if (heroTitle) timers.push(window.setTimeout(() => reveal(heroTitle), at(heroTitle)));
  beats.forEach((el) => timers.push(window.setTimeout(() => el.classList.add('in'), at(el))));

  // Featured card — strip reveal when it scrolls in. The countdown bar is a
  // crop-lr (clip-path), and a clipped node reports 0 intersection, so observe
  // the unclipped section instead (the crop-tb deadlock gotcha).
  if (featSection && feature) {
    const ioFeat = new IntersectionObserver(
      (entries, o) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        o.disconnect();
        toggle?.classList.add('in');
        reveal(feature);
        timers.push(
          window.setTimeout(() => {
            feature.classList.remove('br--go');
            feature.querySelector('.br-box')?.remove();
            const hfInner = feature.querySelector<HTMLElement>('.hf-inner');
            if (hfInner) hfInner.style.opacity = '';
          }, 1300)
        );
      },
      { threshold: 0.2 }
    );
    ioFeat.observe(featSection);
    observers.push(ioFeat);
  }

  return () => {
    timers.forEach((t) => clearTimeout(t));
    observers.forEach((o) => o.disconnect());
  };
}
