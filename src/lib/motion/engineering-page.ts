/*
  engineering-page.ts — client behaviour for EngineeringPage.astro (/engineering).
  mountEngineeringPage() wires everything and returns ONE teardown (called on
  astro:before-swap via onPageReady): light-up title masks for the DotLines
  trails, featured ride-up reveal + boomerang hover-scrub, GIF / video covers,
  the rotary-switch index (knob, rows, step keys, mobile dropdown) and the
  synthesised detent click. mountTuner() is lab-only (sound tuning panel).
*/
import { mountHoverGifs } from './hover-gif';
import { mountVideoScrub } from './video-scrub';
import { reveal } from './reveal';
import { eases } from './tokens';
import { DETENT_DEFAULTS, DETENT_PRESETS, type DetentKey, type DetentParams } from './detent-params';

type Item = { no: string; title: string; kind: string; period: string; status: string; overview: string; tech: string[]; repo: string; featured: boolean };
type InkWin = Window & { __engInkAt?: (x: number, y: number) => Element | null };

/* ---- light-up title: per-glyph alpha masks for the DotLines trails ---- */
function mountInk(word: HTMLElement): () => void {
  const chars = [...word.querySelectorAll<HTMLElement>('.eng-ch')];
  const THRESHOLD = 90;
  type Mask = { el: HTMLElement; pad: number; w: number; h: number; a: Uint8ClampedArray };
  let masks: Mask[] = [];
  let rects: DOMRect[] = [];
  let rectsDirty = true;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const build = () => {
    if (!ctx) return;
    const cs = getComputedStyle(word);
    const pad = Math.ceil(parseFloat(cs.fontSize) * 0.12);
    masks = chars.map((el) => {
      const r = el.getBoundingClientRect();
      const w = Math.ceil(r.width) + pad * 2;
      const h = Math.ceil(r.height) + pad * 2;
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      (ctx as CanvasRenderingContext2D & { fontStretch?: string }).fontStretch = 'expanded';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      const m = ctx.measureText(el.textContent ?? '');
      ctx.clearRect(0, 0, w, h);
      ctx.fillText(el.textContent ?? '', pad, pad + m.fontBoundingBoxAscent);
      const img = ctx.getImageData(0, 0, w, h).data;
      const a = new Uint8ClampedArray(w * h);
      for (let k = 0; k < w * h; k++) a[k] = img[k * 4 + 3];
      return { el, pad, w, h, a };
    });
    rectsDirty = true;
  };
  const inkAt = (x: number, y: number): Element | null => {
    if (!masks.length) return null;
    if (rectsDirty) { rects = chars.map((c) => c.getBoundingClientRect()); rectsDirty = false; }
    let best: Element | null = null;
    let bestA = 0;
    masks.forEach((m, i) => {
      const lx = Math.round(x - (rects[i].left - m.pad));
      const ly = Math.round(y - (rects[i].top - m.pad));
      if (lx < 0 || ly < 0 || lx >= m.w || ly >= m.h) return;
      const a = m.a[ly * m.w + lx];
      if (a > bestA) { bestA = a; best = m.el; }
    });
    return bestA >= THRESHOLD ? best : null;
  };
  const ac = new AbortController();
  window.addEventListener('scroll', () => (rectsDirty = true), { passive: true, signal: ac.signal });
  window.addEventListener('resize', build, { signal: ac.signal });
  (document.fonts?.ready ?? Promise.resolve()).then(() => { if (!ac.signal.aborted) build(); });
  window.setTimeout(() => { if (!ac.signal.aborted) build(); }, 1400);
  const w = window as InkWin;
  w.__engInkAt = inkAt;
  return () => {
    ac.abort();
    if (w.__engInkAt === inkAt) delete w.__engInkAt;
    chars.forEach((c) => (c.style.color = ''));
  };
}

/* ---- GIF thumbnails: hold frame 0 at rest, play on hover ----
   A GIF can't be paused, so the visible <img> becomes a still of frame 0 (a
   fresh decode drawn to a canvas at load = frame 0). The animated file is on
   the cover's data-hover-gif, so hover-gif.ts plays it from frame 0. */
function freezeGifCovers(root: HTMLElement): () => void {
  let alive = true;
  const urls: string[] = [];
  root.querySelectorAll<HTMLImageElement>('img[data-gif-still]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    const probe = new Image();
    probe.onload = () => {
      if (!alive) return;
      const c = document.createElement('canvas');
      c.width = probe.naturalWidth;
      c.height = probe.naturalHeight;
      c.getContext('2d')?.drawImage(probe, 0, 0);
      c.toBlob((blob) => {
        if (!blob || !alive) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        img.src = url;
        img.dataset.frozen = '';
      });
    };
    probe.src = src;
  });
  return () => { alive = false; urls.forEach((u) => URL.revokeObjectURL(u)); };
}

/* ---- detent click: synthesised in the browser (Web Audio), no audio file ----
   Two voices, both ~10–80ms, started at the same instant:
     CLICK  white-noise burst → band-pass filter → gain envelope (fast attack,
            exponential decay). The band-pass centre sets how bright/metallic
            the tick is; Q sets noisy (low) vs pitched/ringy (high).
     THUMP  sine oscillator sweeping start → end Hz → gain envelope.
   Both sum into a master gain. The SAME graph (detentVoice) plays live and is
   rendered offline for the waveform in the sound dialog, so the picture is the
   actual sound. Defaults, slider ranges and presets live in detent-params.ts.
   The live AudioContext is created lazily on the first interaction (autoplay). */
const SOUND_KEY = 'eng-detent-sound'; // mute preference (persisted)

// Sound settings are session-only by design: module memory, so they survive
// client-side navigations but reset on a full reload. No storage.
let sessionParams: DetentParams | null = null;
let sessionPreset = 0; // index into DETENT_PRESETS the current settings are based on

/** White noise, generated once per audio context. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Seconds of audio one click lasts (longest voice + a little tail). */
export function detentLength(p: DetentParams): number {
  const click = Math.max(p.clickDecay, p.clickAttack + 1) / 1000;
  const thump = p.thumpGain > 0 ? Math.max(p.thumpDecay / 1000, 0.004) : 0;
  return Math.max(click, thump) + 0.01;
}

/** Build one click into `ctx`, starting at time `t`, routed to `dest`. */
function detentVoice(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, p: DetentParams, t: number) {
  // Exponential ramps can't reach 0, so levels are clamped to a tiny floor.
  const lvl = (v: number) => Math.max(0.0001, v);
  const out = ctx.createGain();
  out.gain.value = p.master;
  out.connect(dest);

  // CLICK: noise → band-pass → envelope
  const atk = p.clickAttack / 1000;
  const dec = Math.max(p.clickDecay / 1000, atk + 0.001);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = p.clickFreq;
  bp.Q.value = p.clickQ;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(lvl(p.clickGain), t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + dec + 0.01);

  // THUMP: sine sweep → envelope
  if (p.thumpGain > 0) {
    const tdec = Math.max(p.thumpDecay / 1000, 0.004);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(Math.max(1, p.thumpStart), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, p.thumpEnd), t + tdec);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(lvl(p.thumpGain), t + 0.002);
    og.gain.exponentialRampToValueAtTime(0.0001, t + tdec);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + tdec + 0.01);
  }
}

/** Render one click offline → its samples (for the waveform). */
const WAVE_RATE = 22050; // offline render rate for the waveform
export async function renderDetent(p: DetentParams, sampleRate = WAVE_RATE): Promise<Float32Array> {
  const len = Math.max(1, Math.ceil(detentLength(p) * sampleRate));
  const off = new OfflineAudioContext(1, len, sampleRate);
  detentVoice(off, off.destination, noiseBuffer(off), p, 0);
  const buf = await off.startRendering();
  return buf.getChannelData(0);
}

export function createDetentSound(button: HTMLButtonElement | null) {
  let muted = false;
  try { muted = localStorage.getItem(SOUND_KEY) === 'off'; } catch {}
  let params: DetentParams = { ...(sessionParams ?? DETENT_DEFAULTS) };
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  const paint = () => {
    button?.setAttribute('aria-pressed', String(muted));
    button?.setAttribute('aria-label', muted ? 'Unmute detent clicks' : 'Mute detent clicks');
  };
  paint();
  const toggle = () => {
    muted = !muted;
    try { localStorage.setItem(SOUND_KEY, muted ? 'off' : 'on'); } catch {}
    paint();
    if (!muted) tick();
  };
  button?.addEventListener('click', toggle);

  function tick(force = false) {
    if (muted && !force) return;
    try {
      ctx ??= new AudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      noise ??= noiseBuffer(ctx);
      detentVoice(ctx, ctx.destination, noise, params, ctx.currentTime);
    } catch {
      /* no audio — silent fallback */
    }
  }
  return {
    tick,
    get params() { return params; },
    set(key: DetentKey, value: number) { params = { ...params, [key]: value }; sessionParams = params; },
    setAll(next: DetentParams) { params = { ...next }; sessionParams = params; },
    reset() { params = { ...DETENT_DEFAULTS }; sessionParams = null; sessionPreset = 0; },
    destroy() {
      button?.removeEventListener('click', toggle);
      void ctx?.close();
    },
  };
}
export type DetentSound = ReturnType<typeof createDetentSound>;

/** Wire every input[data-param] slider in the panel to the sound; returns a re-sync. */
function bindSliders(panel: HTMLElement, sound: DetentSound, sig: { signal: AbortSignal }, onChange?: () => void) {
  const inputs = [...panel.querySelectorAll<HTMLInputElement>('input[data-param]')];
  const out = (k: string) => panel.querySelector<HTMLElement>('[data-out="' + k + '"]');
  const fmt = (inp: HTMLInputElement, v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2)) + (inp.dataset.unit ?? '');
  const sync = () =>
    inputs.forEach((inp) => {
      const k = inp.dataset.param as DetentKey;
      inp.value = String(sound.params[k]);
      const o = out(k);
      if (o) o.textContent = fmt(inp, sound.params[k]);
    });
  sync();
  let last = 0;
  inputs.forEach((inp) =>
    inp.addEventListener('input', () => {
      const k = inp.dataset.param as DetentKey;
      const v = Number(inp.value);
      sound.set(k, v);
      const o = out(k);
      if (o) o.textContent = fmt(inp, v);
      onChange?.();
      const now = performance.now();
      if (now - last > 70) { last = now; sound.tick(true); } // audition while dragging
    }, sig)
  );
  return sync;
}

/* ---- lab-only tuner panel (.lab-tune) ---- */
export function mountTuner(sound: DetentSound): () => void {
  const panel = document.querySelector<HTMLElement>('.lab-tune');
  const open = document.querySelector<HTMLButtonElement>('[data-tune-toggle]');
  if (!panel || !open) return () => {};
  const ac = new AbortController();
  const sig = { signal: ac.signal };
  const sync = bindSliders(panel, sound, sig);
  open.addEventListener('click', () => {
    const show = Boolean(panel.hidden);
    if (show) sync();
    panel.hidden = !show;
    open.setAttribute('aria-expanded', String(show));
  }, sig);
  panel.querySelector('[data-tune-play]')?.addEventListener('click', () => sound.tick(true), sig);
  panel.querySelector('[data-tune-reset]')?.addEventListener('click', () => { sound.reset(); sync(); sound.tick(true); }, sig);
  panel.querySelector('[data-tune-copy]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    void navigator.clipboard?.writeText(JSON.stringify(sound.params, null, 2)).then(() => {
      btn.textContent = 'Copied';
      window.setTimeout(() => (btn.textContent = 'Copy'), 1200);
    });
  }, sig);
  return () => ac.abort();
}

/* ---- waveform: draws one rendered click into a canvas ----
   Min/max per pixel column (an oscilloscope-style envelope), amber on the dark
   screen, with a faint zero line. Renders are coalesced: while one is in
   flight, further requests just mark it dirty and re-run once it lands. */
function mountWave(canvas: HTMLCanvasElement, durEl: HTMLElement | null, peakEl: HTMLElement | null, getParams: () => DetentParams) {
  let busy = false;
  let dirty = false;
  let alive = true;
  const draw = (data: Float32Array) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const g = canvas.getContext('2d');
    if (!g) return;
    const cs = getComputedStyle(canvas);
    const ink = cs.getPropertyValue('--wave-ink').trim() || '#f5a045';
    const grid = cs.getPropertyValue('--wave-grid').trim() || 'rgba(255,255,255,0.12)';
    g.clearRect(0, 0, w, h);
    // grid: zero line + quarter ticks
    g.fillStyle = grid;
    g.fillRect(0, Math.floor(h / 2), w, Math.max(1, dpr));
    for (let q = 1; q < 4; q++) g.fillRect(Math.round((w * q) / 4), 0, Math.max(1, dpr), h);
    let peak = 0;
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
    // Time window: crop the near-silent exponential tail. The view ends where the
    // signal last exceeds 2% of its peak (≈ −34 dB), plus 8% padding, so the
    // audible part fills the screen at any settings.
    const floor = peak * 0.02;
    let end = data.length;
    for (let i = data.length - 1; i > 0; i--) { if (Math.abs(data[i]) > floor) { end = i + 1; break; } }
    end = Math.min(data.length, Math.max(8, Math.ceil(end * 1.08)));
    // Each trace fills the screen height (shape is the point); loudness is the dB readout.
    const scale = (h / 2 - 2 * dpr) / Math.max(peak, 0.002);
    g.fillStyle = ink;
    const per = end / w;
    for (let x = 0; x < w; x++) {
      let lo = 0;
      let hi = 0;
      const a = Math.floor(x * per);
      const b = Math.min(end, Math.max(a + 1, Math.floor((x + 1) * per)));
      for (let i = a; i < b; i++) { const v = data[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      const y0 = h / 2 - hi * scale;
      const y1 = h / 2 - lo * scale;
      g.fillRect(x, y0, 1, Math.max(dpr, y1 - y0));
    }
    if (durEl) durEl.textContent = ((end / WAVE_RATE) * 1000).toFixed(end / WAVE_RATE < 0.01 ? 1 : 0) + ' ms';
    if (peakEl) peakEl.textContent = 'Peak ' + (peak > 0 ? (20 * Math.log10(peak)).toFixed(1) : '−∞') + ' dB';
  };
  const request = async () => {
    if (!alive) return;
    if (busy) { dirty = true; return; }
    busy = true;
    try {
      do {
        dirty = false;
        const p = { ...getParams() };
        const data = await renderDetent(p);
        if (alive) draw(data);
      } while (dirty && alive);
    } catch {
      /* OfflineAudioContext unavailable — leave the graph blank */
    } finally {
      busy = false;
    }
  };
  const ro = new ResizeObserver(() => void request());
  ro.observe(canvas);
  return {
    request,
    destroy() { alive = false; ro.disconnect(); },
  };
}

/* ---- in-page sound dialog (the sliders key next to mute) ----
   Waveform + presets + sliders. Non-modal so the knob stays usable while it's
   open. Esc / outside click / × closes. Nothing here is saved. */
export function mountSoundConfig(root: HTMLElement, sound: DetentSound): () => void {
  const btn = root.querySelector<HTMLButtonElement>('.eng-fun');
  const dlg = root.querySelector<HTMLElement>('.eng-cfg');
  if (!btn || !dlg) return () => {};
  const ac = new AbortController();
  const sig = { signal: ac.signal };
  const canvas = dlg.querySelector<HTMLCanvasElement>('.eng-cfg__wave canvas');
  const wave = canvas
    ? mountWave(canvas, dlg.querySelector<HTMLElement>('[data-cfg-dur]'), dlg.querySelector<HTMLElement>('[data-cfg-peak]'), () => sound.params)
    : null;
  const same = (a: DetentParams, b: DetentParams) => (Object.keys(a) as DetentKey[]).every((k) => Math.abs(a[k] - b[k]) < 1e-9);
  const markActive = () => {
    const edited = !same(DETENT_PRESETS[sessionPreset].params, sound.params);
    dlg.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => {
      const on = Number(b.dataset.preset) === sessionPreset;
      b.setAttribute('aria-pressed', String(on));
      b.toggleAttribute('data-edited', on && edited);
    });
  };
  const changed = () => { markActive(); if (!dlg.hidden) void wave?.request(); };
  const sync = bindSliders(dlg, sound, sig, changed);
  const apply = (p: DetentParams) => { sound.setAll(p); sync(); changed(); sound.tick(true); };

  const setOpen = (open: boolean) => {
    dlg.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) { sync(); changed(); dlg.querySelector<HTMLElement>('[data-cfg-close]')?.focus({ preventScroll: true }); }
  };
  btn.addEventListener('click', () => setOpen(Boolean(dlg.hidden)), sig);
  dlg.querySelector('[data-cfg-close]')?.addEventListener('click', () => { setOpen(false); btn.focus(); }, sig);
  dlg.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); btn.focus(); } }, sig);
  document.addEventListener('pointerdown', (e) => {
    if (dlg.hidden) return;
    const t = e.target as Node;
    if (!dlg.contains(t) && !btn.contains(t) && !root.querySelector('.eng-knob')?.contains(t)) setOpen(false);
  }, sig);
  dlg.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('[data-preset], [data-cfg-reset], [data-cfg-play]');
    if (!t) return;
    if (t.dataset.preset) { sessionPreset = Number(t.dataset.preset); apply(DETENT_PRESETS[sessionPreset].params); }
    else if ('cfgReset' in t.dataset) apply(DETENT_PRESETS[sessionPreset].params); // back to the CURRENT preset
    else if ('cfgPlay' in t.dataset) sound.tick(true);
  }, sig);
  return () => { ac.abort(); wave?.destroy(); dlg.hidden = true; };
}

export function mountEngineeringPage(): () => void {
  const root = document.querySelector<HTMLElement>('.eng-page');
  if (!root) return () => {};
  const ac = new AbortController();
  const sig = { signal: ac.signal };
  const disposers: Array<() => void> = [() => ac.abort()];

  const word = root.querySelector<HTMLElement>('.eng-word');
  if (word) disposers.push(mountInk(word));

  // Featured: rides up from its crop on scroll-in (same as /engineering), then
  // hover-scrubs the boomerang.
  if (root.querySelector('.eng-feat__crop')) {
    disposers.push(
      reveal('.eng-feat__crop .eng-feat__media', { transform: ['translateY(100%)', 'translateY(0)'], opacity: [0.25, 1] }, {
        observe: '.eng-feat__crop', delay: 0.05, duration: 0.8, ease: eases.smooth, amount: 0.2, margin: '0px 0px -8% 0px',
      })
    );
  }
  const featMedia = root.querySelector<HTMLElement>('.eng-feat__media');
  const fv = featMedia?.querySelector<HTMLVideoElement>('.js-feat-video');
  if (featMedia && fv) {
    const h = mountVideoScrub(featMedia, fv);
    if (h) disposers.push(() => h.destroy());
  }
  disposers.push(freezeGifCovers(root));
  disposers.push(mountHoverGifs(root));
  root.querySelectorAll<HTMLElement>('.eng-slide').forEach((slide) => {
    const v = slide.querySelector<HTMLVideoElement>('.js-slide-video');
    if (!v) return;
    const h = mountVideoScrub(slide, v);
    if (h) disposers.push(() => h.destroy());
  });

  const items: Item[] = JSON.parse(root.dataset.items || '[]');
  const M = items.length;
  const knobEl = root.querySelector<SVGSVGElement>('.eng-knob');
  if (!M || !knobEl) return () => disposers.forEach((d) => d());
  const knob: SVGSVGElement = knobEl;

  const sound = createDetentSound(root.querySelector<HTMLButtonElement>('.eng-mute'));
  disposers.push(() => sound.destroy());
  // Lab tuner hook: expose the live sound + announce it (no-op in production).
  (root as HTMLElement & { __detentSound?: DetentSound }).__detentSound = sound;
  window.dispatchEvent(new CustomEvent('eng:detent-sound', { detail: sound }));
  disposers.push(mountSoundConfig(root, sound));

  const rot = knob.querySelector<SVGGElement>('.k-rot')!;
  const rim = rot.querySelector<SVGCircleElement>('.k-rim')!;
  const CX = Number(rim.getAttribute('cx'));
  const CY = Number(rim.getAttribute('cy'));
  const traces = [...knob.querySelectorAll<SVGPathElement>('.k-trace')];
  const ticks = [...knob.querySelectorAll<SVGLineElement>('.k-tick')];
  const angles = traces.map((p) => {
    const d = p.getAttribute('d')!.match(/-?[\d.]+/g)!.map(Number);
    return (Math.atan2(d[1] - CY, d[0] - CX) * 180) / Math.PI;
  });
  const rows = [...root.querySelectorAll<HTMLButtonElement>('.eng-row')];
  const stage = root.querySelector<HTMLElement>('.eng-stage')!;
  const slides = [...stage.querySelectorAll<HTMLAnchorElement>('.eng-slide')];
  const capEl = root.querySelector<HTMLElement>('.eng-cap')!;
  const bar = root.querySelector<HTMLElement>('.eng-bar')!;
  const mobile = window.matchMedia('(max-width: 768px)');
  let sel = 0;
  let shown = 0;

  // Instant swap: no transition between covers.
  function showSlide(i: number) {
    if (i === shown) return;
    const from = slides[shown];
    const to = slides[i];
    shown = i;
    from.classList.remove('is-on');
    from.setAttribute('aria-hidden', 'true');
    from.tabIndex = -1;
    to.classList.add('is-on');
    to.removeAttribute('aria-hidden');
    to.tabIndex = 0;
  }

  function setCaption(i: number) {
    const p = items[i];
    const q = (s: string) => capEl.querySelector<HTMLElement>(s)!;
    q('.js-no').textContent = `No. ${p.no}`;
    q('.js-status').textContent = p.status;
    q('.js-kind').textContent = p.featured ? `${p.kind} · Featured` : p.kind;
    q('.js-title').textContent = p.title;
    q('.js-desc').textContent = p.overview;
    q('.js-tech').textContent = p.tech.join(' · ');
    q('.js-period').textContent = p.period;
    bar.querySelector('.js-pos')!.textContent = p.no;
    (bar.querySelector('.js-repo') as HTMLAnchorElement).href = p.repo;
  }

  function select(i: number, { focusRow = false, snap = true, click = true, keepRow = null as HTMLElement | null } = {}) {
    const next = Math.max(0, Math.min(M - 1, i));
    const changed = next !== sel;
    // Mobile: keep the tapped row where it is while the dropdown above closes.
    const anchorTop = keepRow && mobile.matches ? keepRow.getBoundingClientRect().top : null;
    sel = next;
    rot.classList.toggle('is-snap', snap);
    rot.style.transform = `rotate(${angles[sel]}deg)`;
    traces.forEach((t, k) => t.classList.toggle('on', k === sel));
    ticks.forEach((t, k) => t.classList.toggle('on', k === sel));
    knob.setAttribute('aria-valuenow', String(sel + 1));
    knob.setAttribute('aria-valuetext', items[sel].title);
    rows.forEach((r, k) => {
      r.setAttribute('aria-pressed', String(k === sel));
      r.setAttribute('aria-expanded', String(k === sel));
      r.tabIndex = k === sel ? 0 : -1;
      r.parentElement?.classList.toggle('is-on', k === sel);
    });
    // html has scroll-behavior: smooth site-wide; this correction must be instant.
    if (anchorTop !== null && keepRow) {
      const delta = keepRow.getBoundingClientRect().top - anchorTop;
      if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, behavior: 'instant' });
    }
    if (focusRow) rows[sel]?.focus({ preventScroll: mobile.matches });
    setCaption(sel);
    showSlide(sel);
    if (changed && click) sound.tick();
  }

  // ---- knob: drag (snaps to nearest position, a click per detent), wheel, keys ----
  let dragging = false;
  const pointerAngle = (e: PointerEvent) => {
    const r = knob.getBoundingClientRect();
    const vb = knob.viewBox.baseVal;
    return (Math.atan2(e.clientY - (r.top + CY * (r.height / vb.height)), e.clientX - (r.left + CX * (r.width / vb.width))) * 180) / Math.PI;
  };
  const lo = Math.min(...angles) - 14;
  const hi = Math.max(...angles) + 14;
  knob.addEventListener('pointerdown', (e) => {
    dragging = true;
    knob.setPointerCapture(e.pointerId);
    knob.classList.add('is-dragging');
  }, sig);
  knob.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const a = Math.max(lo, Math.min(hi, pointerAngle(e)));
    let best = 0;
    angles.forEach((x, k) => { if (Math.abs(x - a) < Math.abs(angles[best] - a)) best = k; });
    if (best !== sel) select(best, { snap: false });
    rot.classList.remove('is-snap');
    rot.style.transform = `rotate(${a}deg)`;
  }, sig);
  const end = () => {
    if (!dragging) return;
    dragging = false;
    knob.classList.remove('is-dragging');
    select(sel, { click: false });
  };
  knob.addEventListener('pointerup', end, sig);
  knob.addEventListener('pointercancel', end, sig);
  let wheel = 0;
  knob.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheel += e.deltaY;
    if (Math.abs(wheel) >= 40) { select(sel + Math.sign(wheel)); wheel = 0; }
  }, { passive: false, signal: ac.signal });
  knob.addEventListener('keydown', (e) => {
    const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
    if (step) { e.preventDefault(); select(sel + step); }
  }, sig);

  // ---- rows: click/keys select. Hover is plain feedback (CSS), never a preview. ----
  const list = root.querySelector<HTMLElement>('.eng-rows')!;
  list.addEventListener('click', (e) => {
    const r = (e.target as Element).closest<HTMLButtonElement>('.eng-row');
    if (r) select(+(r.dataset.i ?? 0), { keepRow: r });
  }, sig);
  list.addEventListener('keydown', (e) => {
    if (!(e.target as Element).closest('.eng-row')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); select(sel + 1, { focusRow: true }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); select(sel - 1, { focusRow: true }); }
  }, sig);
  bar.querySelectorAll<HTMLElement>('[data-step]').forEach((b) =>
    b.addEventListener('click', () => select(sel + Number(b.dataset.step)), sig)
  );

  select(0, { snap: false, click: false });
  return () => disposers.forEach((d) => d());
}
