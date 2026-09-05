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

  // Reduced motion
  if (prefersReducedMotion()) {
    [crumb, sub, toggle, ...cropTbEls].forEach((e) => e?.classList.add('in'));
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
