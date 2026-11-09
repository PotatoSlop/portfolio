/*
  hover-gif.ts — play an animated GIF over a card's still cover, only while the
  card is hovered (or keyboard-focused).

  A GIF can't be paused or rewound from JS, so "plays on hover" means the
  animated layer only exists while the card is engaged, and every engagement must
  start from frame 0. Re-assigning the same GIF URL doesn't reliably restart it
  (browsers share one animation timeline per cached image), so each GIF is
  fetched ONCE into a Blob and every hover mints a fresh object URL for it — a
  distinct image resource that always starts at frame 0, with no re-download.
  The URL is revoked as soon as its layer is removed.

  Progressive enhancement (docs/routing-and-lifecycle.md §4): the cover <img> is
  never touched and is always visible underneath. The GIF layer is injected on
  hover, fades in only once its first frame has decoded, and fades out + removes
  itself on leave — so a slow fetch or a JS failure just means the still keeps
  showing. Skipped entirely under reduced motion (OS query, the corner toggle, or
  mobile — see prefersReducedMotion()) and for touch pointers.

  Markup contract (see pages/software.astro):
    <a data-hover-gif="/Assets/…/foo-hover.gif">        ← trigger (hover/focus)
      <div data-hover-gif-host> <img src={cover} /> </div>  ← layer goes here
    </a>
  The injected layer is <img class="hover-gif">; `.is-playing` fades it in.
*/
import { prefersReducedMotion } from './reduced-motion';

const LAYER_CLASS = 'hover-gif';
const PLAYING_CLASS = 'is-playing';
/** Removal fallback when `transitionend` never fires (transitions disabled,
 *  backgrounded tab). Comfortably longer than the CSS fade. */
const FADE_FALLBACK_MS = 600;

// Fetched GIF bytes, keyed by URL. Module-level on purpose: it's plain data (no
// DOM), so it safely outlives ClientRouter swaps and saves a refetch when the
// visitor comes back to the page.
const blobs = new Map<string, Promise<Blob | null>>();

function loadBlob(src: string): Promise<Blob | null> {
  let pending = blobs.get(src);
  if (!pending) {
    pending = fetch(src)
      .then((res) => (res.ok ? res.blob() : null))
      .catch(() => null)
      .then((blob) => {
        if (!blob) blobs.delete(src); // let a later hover retry a failed fetch
        return blob;
      });
    blobs.set(src, pending);
  }
  return pending;
}

interface Layer {
  img: HTMLImageElement;
  url: string;
}

function mountCard(trigger: HTMLElement, src: string): () => void {
  const host = trigger.querySelector<HTMLElement>('[data-hover-gif-host]') ?? trigger;

  let hovered = false;
  let focused = false;
  let current: Layer | null = null; // the layer that is (or is about to be) playing
  const fading = new Set<Layer>(); // layers mid fade-out, removed on transitionend
  let token = 0; // bumps on every engage/disengage; stale async shows bail out

  const removeLayer = (layer: Layer) => {
    fading.delete(layer);
    layer.img.remove();
    URL.revokeObjectURL(layer.url);
  };

  const fadeOut = (layer: Layer) => {
    fading.add(layer);
    layer.img.classList.remove(PLAYING_CLASS);
    const done = () => {
      if (fading.has(layer)) removeLayer(layer);
    };
    layer.img.addEventListener('transitionend', done, { once: true });
    window.setTimeout(done, FADE_FALLBACK_MS);
  };

  const show = async () => {
    if (current || prefersReducedMotion()) return; // already playing → don't restart
    const t = ++token;
    const blob = await loadBlob(src);
    if (t !== token || !blob || !trigger.isConnected) return;

    const url = URL.createObjectURL(blob);
    const img = document.createElement('img');
    img.className = LAYER_CLASS;
    img.alt = '';
    img.decoding = 'async';
    img.setAttribute('aria-hidden', 'true');
    img.draggable = false;
    img.src = url;
    const layer: Layer = { img, url };
    current = layer;
    host.append(img);

    try {
      await img.decode();
    } catch {
      // Decode can reject on some engines for animated images; the layer still
      // paints once loaded, so fall through and fade it in anyway.
    }
    if (current !== layer) return; // disengaged while decoding — hide() owns it now
    // Next frame, so the opacity transition runs from the inserted 0 state.
    requestAnimationFrame(() => {
      if (current === layer) img.classList.add(PLAYING_CLASS);
    });
  };

  const hide = () => {
    token++; // cancel any show still awaiting its blob
    if (!current) return;
    const layer = current;
    current = null;
    fadeOut(layer);
  };

  const sync = () => (hovered || focused ? void show() : hide());

  const onEnter = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return; // a tap is a click-through, not a hover
    hovered = true;
    sync();
  };
  const onLeave = () => {
    hovered = false;
    sync();
  };
  // Keyboard parity, matching the card's :focus-visible lift. A mouse click also
  // focuses the link, but that isn't :focus-visible, so it can't restart a GIF
  // that hover is already playing.
  const onFocusIn = () => {
    focused = trigger.matches(':focus-visible');
    sync();
  };
  const onFocusOut = () => {
    focused = false;
    sync();
  };
  // The corner toggle can switch reduced motion on while a card is hovered.
  const onMotionChange = () => {
    if (prefersReducedMotion()) hide();
    else sync();
  };

  trigger.addEventListener('pointerenter', onEnter);
  trigger.addEventListener('pointerleave', onLeave);
  trigger.addEventListener('focusin', onFocusIn);
  trigger.addEventListener('focusout', onFocusOut);
  window.addEventListener('motionpreferencechange', onMotionChange);

  return () => {
    trigger.removeEventListener('pointerenter', onEnter);
    trigger.removeEventListener('pointerleave', onLeave);
    trigger.removeEventListener('focusin', onFocusIn);
    trigger.removeEventListener('focusout', onFocusOut);
    window.removeEventListener('motionpreferencechange', onMotionChange);
    token++;
    if (current) removeLayer(current);
    current = null;
    fading.forEach(removeLayer);
  };
}

/**
 * Wire hover-to-play GIF layers on every `[data-hover-gif]` trigger inside `root`.
 *
 * The GIFs are not fetched at page load. They warm the first time a (non-touch)
 * pointer enters `root`, so by the time the visitor settles on a card its clip is
 * usually already in memory and plays without a loading gap.
 *
 * Returns a teardown that removes all listeners, injected layers, and object URLs.
 */
export function mountHoverGifs(root: HTMLElement): () => void {
  const teardowns: Array<() => void> = [];
  const sources: string[] = [];
  root.querySelectorAll<HTMLElement>('[data-hover-gif]').forEach((trigger) => {
    const src = trigger.dataset.hoverGif;
    if (!src) return;
    sources.push(src);
    teardowns.push(mountCard(trigger, src));
  });

  const warm = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || prefersReducedMotion()) return;
    root.removeEventListener('pointerenter', warm);
    sources.forEach((src) => void loadBlob(src));
  };
  if (sources.length) root.addEventListener('pointerenter', warm);

  return () => {
    root.removeEventListener('pointerenter', warm);
    teardowns.forEach((fn) => fn());
  };
}
