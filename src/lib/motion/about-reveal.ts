/* ===== About — brush-reveal interaction =====
   Ported from the throwaway prototype (public/prototypes/about-brush-reveal.html
   + docs/about-brush-reveal-prototype.md). The visitor "draws" the real photo in
   over a sketch portrait with a SINGLE pencil whose direction is a `mode`: `reveal`
   paints the photo in, `hide` wipes it back to the sketch. Reaching either terminal
   (fully revealed / fully sketch) auto-arms the opposite direction; right-click / D
   / the tool button flip it manually. The floating 3D pencil flips end-over-end —
   sharp tip down to draw, its own eraser nub down to erase — to signal the mode.
   The caption switches state once the circle passes ~50% revealed.

   Follows docs/routing-and-lifecycle.md: everything is a mount()/teardown() pair.
   `mountAboutReveal()` returns a teardown that cancels every rAF, disposes the
   three.js renderer, and removes every window/document listener it added.

   three.js is dynamically imported so its bundle only loads on /about, and only
   on the full-motion, fine-pointer path (the 2D reveal works without it). */

import { prefersReducedMotion } from './reduced-motion';

/* The pencil model (served from /public). pencil.glb is a whole-scene export; we
   pull out the `Cylinder` node, which is the pencil complete with its own eraser
   nub + metal ferrule (so the one mesh covers both draw and erase). glTF keeps the
   Principled-BSDF PBR (metalness/roughness) and embeds the wood textures. */
const MODEL_URL = '/Assets/models/pencil.glb';
const PENCIL_NODE = 'Cylinder';

/* Pencil 3D tuning. Scale, pivot (the sharp tip), and orientation are otherwise
   DERIVED from the mesh geometry (see prepareTool), so there are no eyeballed
   Euler angles.
   - `size`   : on-screen px of the model's largest dimension.
   - `baseDir`: rest direction the body points, in screen+depth space [x right,
                y down, z OUT of the page toward the viewer]. A dominant +z tilts
                the body up out of the page for a three-quarter read; x/y give the
                lean. The contact end (sharp tip in reveal, eraser nub in hide)
                stays pinned at the cursor.
   - `swing`  : how far the body leans away from the direction of travel (0–1). */
const PENCIL_TUNING = {
  size: 190,
  baseDir: [0.26, -0.52, 0.7] as [number, number, number],
  swing: 0.6,
};

export function mountAboutReveal(): () => void {
  const stage = document.querySelector<HTMLElement>('.about-stage');
  if (!stage) return () => {};

  const reduced = prefersReducedMotion();
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // Reduced motion / touch: no brush, no 3D. The toggle is the primary control
  // and the resting state is the real photo so the bio + resume are visible.
  if (reduced || isTouch) return mountReducedPath(stage);

  return mountFullPath(stage);
}

/* --------------------------------------------------------------------------
   Reduced-motion / touch path — toggle-only crossfade, no canvas mask, no WebGL.
   -------------------------------------------------------------------------- */
function mountReducedPath(stage: HTMLElement): () => void {
  const realLayer = stage.querySelector<HTMLElement>('.about-layer-real');
  const capSketch = stage.querySelector<HTMLElement>('#about-cap-sketch');
  const capReal = stage.querySelector<HTMLElement>('#about-cap-real');
  const btnToggle = stage.querySelector<HTMLButtonElement>('#about-toggle');

  // Rest on the real state (photo + About Me) — the important content.
  let showingReal = true;
  const apply = () => {
    if (realLayer) realLayer.style.opacity = showingReal ? '1' : '0';
    capReal?.classList.toggle('is-active', showingReal);
    capSketch?.classList.toggle('is-active', !showingReal);
    if (btnToggle) {
      btnToggle.classList.toggle('is-real', showingReal);
      btnToggle.setAttribute('aria-label', showingReal ? 'Show sketch' : 'Show real photo');
    }
  };
  // .about-reduced-fallback hides the draw chrome via CSS regardless of viewport
  // width (a large touch tablet is reduced here but misses the ≤768px media rule).
  stage.classList.add('is-ready', 'is-reduced', 'about-reduced-fallback');
  if (realLayer) realLayer.style.maskImage = realLayer.style.webkitMaskImage = 'none';
  apply();

  const onToggle = () => {
    showingReal = !showingReal;
    apply();
  };
  btnToggle?.addEventListener('click', onToggle);

  return () => {
    btnToggle?.removeEventListener('click', onToggle);
    stage.classList.remove('is-ready', 'is-reduced', 'about-reduced-fallback');
  };
}

/* --------------------------------------------------------------------------
   Full path — raster-mask reveal + three.js cursor tool.
   -------------------------------------------------------------------------- */
function mountFullPath(stage: HTMLElement): () => void {
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const headshot = stage.querySelector<HTMLElement>('.headshot')!;
  const realLayer = stage.querySelector<HTMLElement>('.about-layer-real')!;
  const brushRing = stage.querySelector<HTMLElement>('.brush-ring')!;
  const hint = stage.querySelector<HTMLElement>('.about-hint');
  const capSketch = stage.querySelector<HTMLElement>('#about-cap-sketch')!;
  const capReal = stage.querySelector<HTMLElement>('#about-cap-real')!;
  const btnToggle = stage.querySelector<HTMLButtonElement>('#about-toggle')!;
  const sizeSlider = stage.querySelector<HTMLInputElement>('#about-size')!;
  const sizePct = stage.querySelector<HTMLElement>('#about-size-pct')!;
  const btnPen = stage.querySelector<HTMLButtonElement>('#about-tool-pen')!;
  const btnEraser = stage.querySelector<HTMLButtonElement>('#about-tool-eraser')!;
  const btnReset = stage.querySelector<HTMLButtonElement>('#about-reset')!;
  const toolLayer = stage.querySelector<HTMLElement>('#about-tool-layer')!;
  const cssTool = stage.querySelector<HTMLElement>('#about-css-tool')!;
  const maskedEls = Array.from(stage.querySelectorAll<HTMLElement>('[data-mask]'));

  // These three are `position: fixed` and must map to the VIEWPORT, but `main`
  // carries a `pageFadeIn` transform that makes it the containing block for fixed
  // descendants (offsetting them by main's box). Reparent them to <body> so their
  // fixed coords are true viewport coords. Teardown removes them.
  document.body.appendChild(brushRing);
  document.body.appendChild(toolLayer);
  document.body.appendChild(cssTool);

  const maskCanvas = document.createElement('canvas');
  const mctx = maskCanvas.getContext('2d')!;

  // One pencil whose brush DIRECTION is `mode`: `reveal` paints the real photo in
  // (source-over); `hide` wipes it back to the sketch (destination-out). The tool is
  // explicitly PICKED UP from the toolbar — click the pen icon (reveal) or the eraser
  // icon (hide). `armed` is whether a tool is currently in hand; the interaction
  // starts with NEITHER selected. Right-click / Esc DROP the tool (back to no tool).
  // There is no manual flip: within a stroke you never swap, and reaching a terminal
  // (fully revealed / fully sketch) auto-swaps the direction for the next stroke.
  let armed = false;
  let mode: 'reveal' | 'hide' = 'reveal';
  let brush = 40; // radius, CSS px
  let maxBrush = 80;
  let drawing = false;
  let didPaint = false;
  let last: [number, number] | null = null;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let imgRegion = { ox: 0, oy: 0, w: 0, h: 0 };
  let maskDirty = true;
  let suppressSample = false;
  let captionState: 'sketch' | 'real' = 'sketch';

  // Pick-up state. `pickup` is the eased 0..1 scale of the 3D pencil (0 when the
  // cursor is off the drawing stage, so it shrinks into the cursor); driven by the
  // animate loop. `flipTarget` (0 reveal, 1 hide) drives the end-over-end flip.
  let pickup = 0;
  let pickupTarget = 0;
  let flipTarget = 0;
  let setPickupTarget: (v: number) => void = () => {};

  // The mask/draw region spans the full page width and the section's height, so
  // a stroke starting just outside the centred grid still registers.
  function computeCanvasBox() {
    const r = stage.getBoundingClientRect();
    return {
      left: 0,
      top: r.top,
      width: window.innerWidth,
      height: r.height,
      right: window.innerWidth,
      bottom: r.top + r.height,
    };
  }
  let stageBox = computeCanvasBox();

  function sizeCanvases() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    stageBox = computeCanvasBox();
    const prev = document.createElement('canvas');
    prev.width = maskCanvas.width;
    prev.height = maskCanvas.height;
    if (prev.width) prev.getContext('2d')!.drawImage(maskCanvas, 0, 0);

    maskCanvas.width = Math.round(stageBox.width * dpr);
    maskCanvas.height = Math.round(stageBox.height * dpr);
    if (prev.width) mctx.drawImage(prev, 0, 0, maskCanvas.width, maskCanvas.height);

    updateGeometry();
    maskDirty = true;
  }

  function updateGeometry() {
    const sw = stageBox.width;
    const sh = stageBox.height;
    const b = headshot.getBoundingClientRect();
    imgRegion = { ox: b.left - stageBox.left, oy: b.top - stageBox.top, w: b.width, h: b.height };

    // brush max = the full circle radius; default sits at half-radius.
    const radius = b.width / 2;
    maxBrush = Math.max(30, radius);
    sizeSlider.min = String(Math.max(6, Math.round(radius * 0.09)));
    sizeSlider.max = String(Math.round(maxBrush));
    brush = Math.round(radius / 2);
    sizeSlider.value = String(brush);
    updateRingSize();
    updateSizePct();

    maskedEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      const ox = r.left - stageBox.left;
      const oy = r.top - stageBox.top;
      el.style.webkitMaskSize = el.style.maskSize = `${sw}px ${sh}px`;
      el.style.webkitMaskPosition = el.style.maskPosition = `${-ox}px ${-oy}px`;
    });
  }

  function applyMask() {
    const val = `url(${maskCanvas.toDataURL()})`;
    maskedEls.forEach((el) => {
      el.style.webkitMaskImage = el.style.maskImage = val;
    });
  }

  /* ---- brush ---- */
  function stampSegment(x0: number, y0: number, x1: number, y1: number) {
    const r = brush * dpr;
    mctx.globalCompositeOperation = mode === 'reveal' ? 'source-over' : 'destination-out';
    mctx.fillStyle = '#fff';
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.round(dist / (r * 0.35)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      mctx.beginPath();
      mctx.arc(x, y, r, 0, Math.PI * 2);
      mctx.fill();
    }
    maskDirty = true;
  }

  function updateRingSize() {
    const d = brush * 2;
    brushRing.style.width = brushRing.style.height = `${d}px`;
  }
  function moveRing(clientX: number, clientY: number, show: boolean) {
    brushRing.style.left = `${clientX}px`;
    brushRing.style.top = `${clientY}px`;
    // Toggle the shrink/grow transition (see .brush-ring in about.css) rather than
    // hard display:none, so hiding eases the ring down to nothing like the 3D tool.
    brushRing.classList.toggle('is-shown', show);
  }
  function overStage(clientX: number, clientY: number) {
    return (
      clientX >= stageBox.left &&
      clientX <= stageBox.right &&
      clientY >= stageBox.top &&
      clientY <= stageBox.bottom
    );
  }

  /* ---- caption threshold switch ---- */
  const sc = document.createElement('canvas');
  sc.width = 40;
  sc.height = 40;
  const sctx = sc.getContext('2d')!;
  function computeCoverage() {
    const { ox, oy, w, h } = imgRegion;
    if (!w) return 0;
    sctx.clearRect(0, 0, 40, 40);
    sctx.drawImage(maskCanvas, ox * dpr, oy * dpr, w * dpr, h * dpr, 0, 0, 40, 40);
    const d = sctx.getImageData(0, 0, 40, 40).data;
    let on = 0;
    let total = 0;
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 40; x++) {
        const dx = x - 19.5;
        const dy = y - 19.5;
        if (dx * dx + dy * dy > 20 * 20) continue; // circle only
        total++;
        if (d[(y * 40 + x) * 4 + 3] > 40) on++;
      }
    return total ? on / total : 0;
  }
  function sampleAndSwitch() {
    setCaption(computeCoverage() > 0.5 ? 'real' : 'sketch');
  }

  // Within 15% of fully revealed / hidden, snap the rest with a quick crossfade so
  // the user doesn't have to cover every last pixel. Reaching a terminal state arms
  // the OPPOSITE direction for the next stroke. If the stroke already covered the
  // whole circle (past the snap band), there's nothing to animate — just flip.
  function maybeAutoComplete() {
    const frac = computeCoverage();
    if (mode === 'reveal') {
      if (frac >= 0.999) setMode('hide');
      else if (frac >= 0.85) autoComplete(1);
    } else {
      if (frac <= 0.001) setMode('reveal');
      else if (frac <= 0.15) autoComplete(0);
    }
  }
  function autoComplete(target: 0 | 1) {
    const w = maskCanvas.width;
    const h = maskCanvas.height;
    const dur = prefersReduced ? 0 : 200;
    const t0 = performance.now();
    const snap = document.createElement('canvas');
    snap.width = w;
    snap.height = h;
    snap.getContext('2d')!.drawImage(maskCanvas, 0, 0);
    suppressSample = true;
    setCaption(target === 1 ? 'real' : 'sketch');
    const step = (now: number) => {
      const p = dur === 0 ? 1 : Math.min(1, (now - t0) / dur);
      mctx.globalCompositeOperation = 'source-over';
      mctx.clearRect(0, 0, w, h);
      if (target === 1) {
        mctx.globalAlpha = 1;
        mctx.drawImage(snap, 0, 0);
        mctx.fillStyle = '#fff';
        mctx.globalAlpha = p;
        mctx.fillRect(0, 0, w, h);
        mctx.globalAlpha = 1;
      } else {
        mctx.globalAlpha = 1 - p;
        mctx.drawImage(snap, 0, 0);
        mctx.globalAlpha = 1;
      }
      maskDirty = true;
      if (p < 1) autoRaf = requestAnimationFrame(step);
      else {
        if (target === 1) {
          mctx.fillStyle = '#fff';
          mctx.fillRect(0, 0, w, h);
        } else mctx.clearRect(0, 0, w, h);
        maskDirty = true;
        suppressSample = false;
        autoRaf = 0;
        // Terminal reached → arm the reverse: fully revealed rubs back (hide),
        // fully sketch draws again (reveal).
        setMode(target === 1 ? 'hide' : 'reveal');
      }
    };
    autoRaf = requestAnimationFrame(step);
  }
  function setCaption(state: 'sketch' | 'real') {
    if (state === captionState) return;
    captionState = state;
    capReal.classList.toggle('is-active', state === 'real');
    capSketch.classList.toggle('is-active', state === 'sketch');
    // Icon-only chevron toggle: flip it (is-real → point back to the sketch) and
    // relabel for AT rather than swapping visible text.
    btnToggle.classList.toggle('is-real', state === 'real');
    btnToggle.setAttribute('aria-label', state === 'real' ? 'Show sketch' : 'Show real photo');
  }

  /* ---- pointer (click + drag) ---- */
  function toStage(clientX: number, clientY: number): [number, number] {
    return [(clientX - stageBox.left) * dpr, (clientY - stageBox.top) * dpr];
  }
  function paintAt(e: PointerEvent) {
    const [x, y] = toStage(e.clientX, e.clientY);
    const p0 = last || [x, y];
    stampSegment(p0[0], p0[1], x, y);
    didPaint = true;
    last = [x, y];
  }
  function onDown(e: PointerEvent) {
    if (e.button !== 0) return; // left button only
    if (!armed) return; // no tool in hand → clicking the portrait does nothing
    const t = e.target as HTMLElement;
    if (t.closest && t.closest('.about-toolbar, a, button, input, [role="toolbar"]')) return;
    e.preventDefault();
    stageBox = computeCanvasBox();
    drawing = true;
    didPaint = false;
    last = null;
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    paintAt(e);
  }
  function onMove(e: PointerEvent) {
    // The pencil + ring are shown only while the cursor is over the drawing stage;
    // moving off eases them away (pickup → 0). The mode is unchanged — leaving is no
    // longer a cancel.
    const over = overStage(e.clientX, e.clientY);
    // Over the interactive chrome (toolbar / resume button) neither the pencil nor
    // the ring belong — you're operating a control, not drawing. The one exception
    // is the brush-size slider: hide the pencil but KEEP the ring so its radius
    // previews the brush as you drag.
    const el = e.target as HTMLElement;
    const overBrush = !!(el.closest && el.closest('.brush-size'));
    // Over the navbar the pencil is HIDDEN but NOT dropped — pickupTarget 0 eases its
    // scale to 0 (mode/armed state untouched), so it pops back when you leave the nav.
    const overChrome =
      overBrush || !!(el.closest && el.closest('.about-toolbar, .resume-btn, nav'));
    // The pencil only shows when a tool is armed AND the cursor is over the drawing
    // area (and not over chrome). Unarmed → it stays put away. The OS cursor is
    // hidden EXACTLY when the tool is shown (`tool-shown`) — never otherwise — so an
    // unarmed visitor (or one over the toolbar/nav) always keeps a real pointer.
    const showTool = armed && !overChrome && over;
    pickupTarget = showTool ? 1 : 0;
    setPickupTarget(pickupTarget);
    stage.classList.toggle('tool-shown', showTool);
    // Derive "pressed" from e.buttons every move (not a latched flag) so a missed
    // pointerup can't leave us stuck drawing.
    const pressing = (e.buttons & 1) === 1;
    moveTool(e.clientX, e.clientY, pressing && drawing);
    moveRing(e.clientX, e.clientY, overBrush || (armed && over && !overChrome));
    if (!pressing) {
      drawing = false;
      last = null;
      return;
    }
    if (!drawing) return;
    paintAt(e);
  }
  function onUp() {
    if (drawing && didPaint) maybeAutoComplete();
    drawing = false;
    last = null;
  }
  // Right-click over the stage DROPS the tool (back to no tool selected). Esc does the
  // same (see onKey). Right-clicking the chrome is left alone (native menu).
  function onContextMenu(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest && t.closest('.about-toolbar, a, button, input')) return;
    if (!armed) return;
    e.preventDefault();
    dropTool();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && armed) dropTool();
  }

  /* ---- toolbar / tool selection ---- */
  // Sync the two toolbar icons to the current armed/mode state: at most one carries
  // the amber "selected" fill, and neither does when no tool is in hand.
  function reflectTool() {
    const penOn = armed && mode === 'reveal';
    const eraserOn = armed && mode === 'hide';
    btnPen.classList.toggle('is-active', penOn);
    btnEraser.classList.toggle('is-active', eraserOn);
    btnPen.setAttribute('aria-pressed', String(penOn));
    btnEraser.setAttribute('aria-pressed', String(eraserOn));
  }
  // Set the brush DIRECTION (used by the draw compositing + the 3D flip). Called both
  // by explicit toolbar selection and by the automated terminal swap. Keeps the 3D
  // pencil's end-over-end flip (flipTarget) and the toolbar icons in sync.
  function setMode(next: 'reveal' | 'hide') {
    mode = next;
    flipTarget = next === 'hide' ? 1 : 0;
    reflectTool();
    updateHint(true);
  }
  // Pick a tool up from the toolbar. Arms the interaction and points the pencil.
  function selectTool(next: 'reveal' | 'hide') {
    armed = true;
    setMode(next);
  }
  // Put the tool down: no tool selected, pencil eases away, drawing stops.
  function dropTool() {
    if (!armed) return;
    armed = false;
    drawing = false;
    last = null;
    pickupTarget = 0;
    setPickupTarget(0);
    // Tool is put down → it's no longer standing in for the pointer, so give the OS
    // cursor back at once (don't wait for the next pointer move). Also clears the
    // CSS-fallback emoji if that path is active.
    stage.classList.remove('tool-shown');
    cssTool.style.display = 'none';
    reflectTool();
    hint?.classList.remove('show');
  }
  // The controls tooltip tracks the current mode (Draw/Erase) and re-punches
  // (restarts its CSS entrance animation) whenever the mode flips.
  const hintAction = stage.querySelector<HTMLElement>('#about-hint-action');
  function updateHint(punch = false) {
    if (!hint) return;
    if (hintAction) hintAction.textContent = mode === 'hide' ? 'Erase' : 'Draw';
    if (punch) {
      hint.classList.remove('show');
      void hint.offsetWidth; // reflow → replay the punch entrance
    }
    hint.classList.add('show');
  }
  const onSelectPen = () => selectTool('reveal');
  const onSelectEraser = () => selectTool('hide');
  function updateSizePct() {
    sizePct.textContent = `${Math.round((brush / maxBrush) * 100)}%`;
    // Paint the slider's filled portion to match the thumb position (which spans
    // the slider's own min..max, not 0..maxBrush).
    const lo = +sizeSlider.min || 0;
    const hi = +sizeSlider.max || 100;
    const fill = hi > lo ? ((brush - lo) / (hi - lo)) * 100 : 50;
    sizeSlider.style.setProperty('--fill', `${Math.max(0, Math.min(100, fill))}%`);
  }
  const onSize = () => {
    brush = +sizeSlider.value;
    updateRingSize();
    updateSizePct();
  };
  const onReset = () => {
    mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskDirty = true;
    // Blank sketch → nothing to erase; if a tool is in hand, make it the pen. Leave
    // the unarmed state alone (reset shouldn't silently pick a tool up).
    if (armed) setMode('reveal');
  };

  let toggleState = 0;
  const onToggle = () => {
    toggleState = toggleState ? 0 : 1;
    crossfadeTo(toggleState as 0 | 1);
  };
  // A plain uniform crossfade between the two states (fills the whole mask at a
  // ramping alpha) — the accessible / keyboard fallback, not a directional wipe.
  function crossfadeTo(target: 0 | 1) {
    const w = maskCanvas.width;
    const h = maskCanvas.height;
    const dur = prefersReduced ? 0 : 200;
    const t0 = performance.now();
    const from = target === 1 ? 0 : 1;
    const to = target === 1 ? 1 : 0;
    suppressSample = true;
    setCaption(target === 1 ? 'real' : 'sketch');
    const step = (now: number) => {
      const p = dur === 0 ? 1 : Math.min(1, (now - t0) / dur);
      const a = from + (to - from) * p;
      mctx.globalCompositeOperation = 'source-over';
      mctx.clearRect(0, 0, w, h);
      mctx.fillStyle = `rgba(255,255,255,${a})`;
      mctx.fillRect(0, 0, w, h);
      maskDirty = true;
      if (p < 1) toggleRaf = requestAnimationFrame(step);
      else {
        suppressSample = false;
        toggleRaf = 0;
        setMode(target === 1 ? 'hide' : 'reveal');
      }
    };
    toggleRaf = requestAnimationFrame(step);
  }

  /* ---- render loop ---- */
  let lastMaskApply = 0;
  let lastSample = 0;
  function loop(now: number) {
    if (maskDirty && now - lastMaskApply > 60) {
      applyMask();
      maskDirty = false;
      lastMaskApply = now;
    }
    if (!suppressSample && now - lastSample > 90) {
      sampleAndSwitch();
      lastSample = now;
    }
    loopRaf = requestAnimationFrame(loop);
  }

  /* ---- listeners ---- */
  const onResize = () => {
    sizeCanvases();
    applyMask();
  };
  const onScroll = () => {
    stageBox = computeCanvasBox();
  };
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, { passive: true });
  stage.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKey);
  btnPen.addEventListener('click', onSelectPen);
  btnEraser.addEventListener('click', onSelectEraser);
  sizeSlider.addEventListener('input', onSize);
  btnReset.addEventListener('click', onReset);
  btnToggle.addEventListener('click', onToggle);

  /* ---- boot (empty mask — starts fully sketch, no seam) ---- */
  stage.classList.add('is-ready');
  realLayer.style.opacity = '1';
  let loopRaf = 0;
  let toggleRaf = 0;
  let autoRaf = 0;
  let hintTimer1: ReturnType<typeof setTimeout> | undefined;
  const boot = () => {
    sizeCanvases();
    applyMask();
    loopRaf = requestAnimationFrame(loop);
    // Controls tooltip punches in shortly after mount; thereafter setMode drives it.
    hintTimer1 = setTimeout(() => updateHint(true), 700);
  };
  const bootRaf = requestAnimationFrame(() => requestAnimationFrame(boot));

  /* ---- three.js floating tool (glTF). CSS fallback on failure. ---- */
  let moveTool: (x: number, y: number, press: boolean) => void = () => {};
  let disposeThree: () => void = () => {};
  let torndown = false; // set by teardown; async initTool bails / self-disposes
  initTool();

  async function initTool() {
    try {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { RoomEnvironment } = await import(
        'three/examples/jsm/environments/RoomEnvironment.js'
      );
      if (torndown) return;

      let W = window.innerWidth;
      let H = window.innerHeight;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      toolLayer.appendChild(renderer.domElement);
      // Minimal disposer in case teardown lands mid-load (before the animate loop
      // exists); replaced by the full disposer once everything is wired.
      disposeThree = () => {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };

      // Orthographic, screen-space: (0,0) top-left, +y down — same space as the
      // DOM pointer coords, so a tool at (clientX, clientY) sits under the cursor.
      // Very wide near/far so a tool tilted deep into the page (pen -z body) never
      // clips against the frustum on either side.
      const cam = new THREE.OrthographicCamera(0, W, 0, H, -100000, 100000);
      cam.position.z = 1000; // orthographic: distance doesn't change size
      const scene = new THREE.Scene();

      // Image-based lighting: the metal ferrule is real PBR (metalness ~0.72) and a
      // metal with nothing to reflect renders black — so give the scene a neutral
      // room environment for the metals to mirror. The directional rig below still
      // does the directional shaping on top.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;

      // Contrast-forward rig ON TOP of a (deliberately low) env-map fill. Low ambient
      // + hemisphere + env keep the SHADOW side dark so the light/shadow terminator
      // reads as a defined edge; a single dominant KEY (angle kept from before) does
      // the shaping, a gentle FRONT fill just keeps the near faces from crushing to
      // black, and a soft RIM catches the far edges. Screen+depth space. To trade
      // contrast ↔ flatness: raise/lower ambient+front (fill) against key (shape).
      // HARD rig for the pencil: a strong grazing key with almost no fill so the
      // flat-shaded hex facets step into distinct light/mid/shadow bands. Low
      // ambient/hemisphere keeps the shadow side dark for a defined terminator.
      const ambient = new THREE.AmbientLight(0xffffff, 0.12);
      scene.add(ambient);
      const hemi = new THREE.HemisphereLight(0xffffff, 0x8b93a0, 0.14);
      scene.add(hemi);
      const front = new THREE.DirectionalLight(0xffffff, 0.3);
      front.position.set(0.12, -0.28, 1.0); // camera-forward — soft fill on the visible faces
      scene.add(front);
      const key = new THREE.DirectionalLight(0xffffff, 2.6); // dominant shaping light
      key.position.set(-0.95, -0.6, 0.36); // grazing upper-left — steps the hex facets apart
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xdfe7ff, 0.95);
      rim.position.set(0.5, 0.85, -0.7); // lower-right, behind — edge light
      scene.add(rim);

      const loader = new GLTFLoader();
      const gltf = await new Promise<{ scene: import('three').Group }>((resolve, reject) =>
        loader.load(MODEL_URL, (g) => resolve(g), undefined, reject)
      );
      if (torndown) {
        disposeThree();
        return;
      }

      // Pull the pencil node (which carries its own eraser nub + ferrule) out of the
      // shared scene and wrap it in a fresh identity Group. The wrapper (not the
      // node) is what prepareTool scales and re-pivots, so the node's own baked
      // transform is preserved as geometry.
      const src = gltf.scene;
      src.updateMatrixWorld(true);
      const penNode = src.getObjectByName(PENCIL_NODE);
      if (!penNode) throw new Error('pencil node not found in GLB');
      const penRaw = new THREE.Group();
      penRaw.add(penNode);

      // Tune the PBR materials for our rig (see tuneMaterials).
      tuneMaterials(penRaw, 'pen');

      const pencil = prepareTool(THREE, penRaw, PENCIL_TUNING);
      scene.add(pencil.root);

      const cur = new THREE.Vector2(W / 2, H / 2);
      const target = new THREE.Vector2(W / 2, H / 2);
      let pressing = false;
      moveTool = (x, y, press) => {
        target.set(x, y);
        pressing = !!press;
        cssTool.style.display = 'none';
      };
      // Expose the pickup driver so the drop handlers (below) can toggle it.
      setPickupTarget = (v: number) => {
        pickupTarget = v;
      };

      // Reused scratch objects (no per-frame allocation).
      const q = new THREE.Quaternion();
      const qBase = new THREE.Quaternion();
      const qFlip = new THREE.Quaternion();
      const smoothDir = new THREE.Vector3(...PENCIL_TUNING.baseDir).normalize();
      const desired = new THREE.Vector3();
      const vel = new THREE.Vector2();
      // Flip scratch: the tumble axis (in the screen plane, ⟂ to the lean) and the
      // moving pinned contact point that keeps whichever end is "down" at the cursor.
      const flipAxis = new THREE.Vector3();
      const pinLocal = new THREE.Vector3();
      const pinWorld = new THREE.Vector3();
      const VIEW_Z = new THREE.Vector3(0, 0, 1);
      let flipAmount = 0; // eased 0 (reveal/tip down) → 1 (hide/eraser down)

      let toolRaf = 0;
      const animateTool = () => {
        // Chase gap = recent movement. It shrinks to ~0 when the pointer rests, so
        // the pencil settles back to baseDir; it grows while moving, tilting the body
        // away from travel ("dragging a pencil by its tip").
        vel.set(target.x - cur.x, target.y - cur.y);
        cur.lerp(target, 0.35);

        // Pick-up: ease the pencil's scale toward 0 (cursor off-stage) or 1 (on it).
        // Scaling is about the contact end at the cursor, so it shrinks into / pops
        // out of the cursor. Shrinking is slower than the pop-out so it lingers as it
        // fades — the brush ring's CSS transition mirrors this split (see about.css).
        const pickupEase = pickupTarget < pickup ? 0.09 : 0.2;
        pickup += (pickupTarget - pickup) * pickupEase;
        if (pickup < 0.001) pickup = 0;
        pencil.root.visible = pickup > 0.001;

        // Ease the flip 0 (reveal / tip down) → 1 (hide / eraser down).
        flipAmount += (flipTarget - flipAmount) * 0.18;

        const speed = vel.length();
        // Lean the rest direction away from travel — this is the pivot at the cursor.
        desired.set(PENCIL_TUNING.baseDir[0], PENCIL_TUNING.baseDir[1], PENCIL_TUNING.baseDir[2]);
        if (speed > 0.5) {
          const infl = Math.min(1, speed / 45) * PENCIL_TUNING.swing;
          desired.x -= (vel.x / speed) * infl;
          desired.y -= (vel.y / speed) * infl;
        }
        if (pressing) desired.z *= 0.8; // press: rock the body down toward the page
        desired.normalize();
        smoothDir.lerp(desired, 0.18).normalize();

        // Base aim: body axis (tip→eraser) along the lean, sharp tip at the cursor.
        qBase.setFromUnitVectors(pencil.bodyAxis, smoothDir);
        // Flip: rotate flipAmount·180° about a screen-plane axis ⟂ to the lean, so the
        // pencil tumbles end-over-end (tip down → eraser down) in place.
        flipAxis.copy(smoothDir).cross(VIEW_Z);
        if (flipAxis.lengthSq() < 1e-6) flipAxis.set(1, 0, 0);
        flipAxis.normalize();
        qFlip.setFromAxisAngle(flipAxis, flipAmount * Math.PI);
        q.multiplyQuaternions(qFlip, qBase);

        // Keep the "down" end pinned at the cursor: the pinned point slides tip→eraser
        // (0→length along the body) as the flip progresses. The world offset is scaled
        // by pickup so it stays glued while the pencil shrinks/grows.
        pinLocal.copy(pencil.bodyAxis).multiplyScalar(flipAmount * pencil.length);
        pinWorld.copy(pinLocal).applyQuaternion(q).multiplyScalar(pickup);

        pencil.root.quaternion.copy(q);
        pencil.root.position.set(
          cur.x - pinWorld.x,
          // A little hop at mid-flip (sin peaks at flipAmount = 0.5) sells the tumble.
          cur.y - pinWorld.y - Math.sin(flipAmount * Math.PI) * pencil.length * 0.12 * pickup,
          -pinWorld.z
        );
        pencil.root.scale.setScalar(pickup);

        renderer.render(scene, cam);
        toolRaf = requestAnimationFrame(animateTool);
      };
      animateTool();

      const onToolResize = () => {
        W = window.innerWidth;
        H = window.innerHeight;
        renderer.setSize(W, H);
        cam.right = W;
        cam.bottom = H;
        cam.updateProjectionMatrix();
      };
      window.addEventListener('resize', onToolResize);

      disposeThree = () => {
        cancelAnimationFrame(toolRaf);
        window.removeEventListener('resize', onToolResize);
        scene.traverse((obj) => {
          const mesh = obj as import('three').Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => disposeMaterial(m));
          else if (mat) disposeMaterial(mat);
        });
        envRT.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    } catch (err) {
      console.warn('three.js / glTF unavailable — CSS tool fallback', err);
      // The emoji stands in for the pointer, so it appears EXACTLY when the tool is
      // shown (armed + over the stage), mirroring `.tool-shown` (which also hides the
      // OS cursor). Unarmed / over chrome → no emoji, real cursor.
      moveTool = (x, y) => {
        const shown = stage.classList.contains('tool-shown');
        cssTool.style.display = shown ? 'block' : 'none';
        if (!shown) return;
        cssTool.style.left = `${x}px`;
        cssTool.style.top = `${y}px`;
        cssTool.textContent = mode === 'hide' ? '🧽' : '✏️';
      };
    }
  }

  /* Auto-fit the loaded pencil and pivot it on its sharp tip.
     - Scales the model so its largest dimension = `size` px.
     - Finds the tip (the sharp end of the long axis) and shifts the mesh so the tip
       sits at the returned group's origin (which the animator pins to the cursor).
     - Returns `bodyAxis` (unit, tip → eraser end) and `length` (tip→eraser in the
       scaled space) so the animator can aim it and flip it end-over-end.
     All derived from geometry — no per-model orientation constants to eyeball. */
  function prepareTool(
    THREE: typeof import('three'),
    raw: import('three').Group,
    tune: { size: number }
  ) {
    raw.updateMatrixWorld(true);
    const pts: import('three').Vector3[] = [];
    const tmp = new THREE.Vector3();
    raw.traverse((o) => {
      const mesh = o as import('three').Mesh;
      const geo = mesh.geometry;
      if (!geo || !geo.attributes || !geo.attributes.position) return;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        tmp.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        pts.push(tmp.clone());
      }
    });

    const box = new THREE.Box3();
    if (pts.length) box.setFromPoints(pts);
    else box.setFromObject(raw);
    const dim = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const comps = [dim.x, dim.y, dim.z];
    const maxDim = Math.max(comps[0], comps[1], comps[2]) || 1;
    const s = tune.size / maxDim;

    // Longest axis = the pencil's length.
    const ai = comps[0] >= comps[1] ? (comps[0] >= comps[2] ? 0 : 2) : comps[1] >= comps[2] ? 1 : 2;
    const axisDir = new THREE.Vector3(ai === 0 ? 1 : 0, ai === 1 ? 1 : 0, ai === 2 ? 1 : 0);
    const halfLen = comps[ai] / 2;

    // Pivot on the sharp tip; bodyAxis points from the tip toward the eraser end.
    // Fallbacks (no vertices) keep a sane default.
    let pivotPoint = center.clone().addScaledVector(axisDir, halfLen);
    let bodyAxis = axisDir.clone().multiplyScalar(-1);
    if (pts.length) {
      // The sharp end = the end whose vertices sit closest to the axis (a cone).
      const band = 0.18 * comps[ai];
      let rMin = 0;
      let nMin = 0;
      let rMax = 0;
      let nMax = 0;
      const d = new THREE.Vector3();
      for (const p of pts) {
        d.copy(p).sub(center);
        const t = d.dot(axisDir);
        const perp = Math.hypot(...([0, 1, 2].filter((k) => k !== ai).map((k) => d.getComponent(k))));
        if (t <= -halfLen + band) {
          rMin += perp;
          nMin++;
        } else if (t >= halfLen - band) {
          rMax += perp;
          nMax++;
        }
      }
      const avgMin = nMin ? rMin / nMin : 1;
      const avgMax = nMax ? rMax / nMax : 1;
      const tipIsMax = avgMax < avgMin;
      pivotPoint = center.clone().addScaledVector(axisDir, tipIsMax ? halfLen : -halfLen);
      bodyAxis = axisDir.clone().multiplyScalar(tipIsMax ? -1 : 1);
    }

    raw.scale.multiplyScalar(s);
    raw.position.copy(pivotPoint).multiplyScalar(-s); // pivot (tip) → origin
    const root = new THREE.Group();
    root.add(raw);
    // bodyAxis: tip → eraser; length: the full tip→eraser span in the scaled space.
    return { root, bodyAxis: bodyAxis.normalize(), length: comps[ai] * s };
  }

  // Tune the glTF PBR (MeshStandardMaterial) materials for our rig. glTF carries the
  // real Principled-BSDF values + embedded wood textures, so most of it is already
  // right — we only nudge:
  //  - envMapIntensity up a touch so the room reflection reads on every surface;
  //  - the "metal" ferrule: lower roughness + full metalness for a crisp, bright
  //    reflection (it reflects the scene.environment set in initTool), and a light
  //    silver tint so it doesn't go too dark.
  function tuneMaterials(model: import('three').Object3D, kind: 'pen' | 'eraser') {
    model.traverse((o) => {
      const mesh = o as import('three').Mesh;
      if (!mesh.material) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const mat = m as unknown as {
          name?: string;
          metalness?: number;
          roughness?: number;
          envMapIntensity?: number;
          flatShading?: boolean;
          needsUpdate?: boolean;
          color?: { set: (c: number) => void };
        };
        // Low general env contribution so the environment doesn't flatten the shadow
        // side (contrast) or gloss up the matte parts.
        if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.4;

        // Rubber eraser: the block came in glossy/reflective. Rubber is a matte
        // dielectric — kill the metalness, push roughness right up and drop the env
        // reflection so it reads as dry rubber, not plastic. Force SMOOTH shading:
        // the 'eraser' material is shared with the pencil's eraser-nub, and the pen
        // pass below flat-shades it (hard faceted edges) — we want the eraser tool
        // soft, so undo that here (this pass runs after the pen pass).
        if (kind === 'eraser') {
          if (typeof mat.metalness === 'number') mat.metalness = 0;
          if (typeof mat.roughness === 'number') mat.roughness = 0.95;
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.05;
          mat.flatShading = false;
          mat.needsUpdate = true;
          continue;
        }

        const name = mat.name || '';
        // The pencil's own eraser nub (shared 'eraser'/'rubber' material) — matte
        // rubber. (Previously fixed by a second pass over the standalone block; now
        // that the block is gone, catch it by name here.)
        if (/eraser|rubber/i.test(name)) {
          if (typeof mat.metalness === 'number') mat.metalness = 0;
          if (typeof mat.roughness === 'number') mat.roughness = 0.95;
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.05;
          mat.flatShading = false;
          mat.needsUpdate = true;
          continue;
        }
        if (/metal|ferrule|steel|chrome|alumin/i.test(name)) {
          if (typeof mat.metalness === 'number') mat.metalness = 0.95;
          if (typeof mat.roughness === 'number') mat.roughness = 0.3;
          mat.color?.set(0xd7dce2); // light silver tint
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 1.3; // metal needs reflection
        } else if (/oak|polished/i.test(name)) {
          // Bare sharpened-wood cone ("Polished Oak Wood", textured grain) — matte,
          // and left SMOOTH-shaded so the round cone doesn't turn into hard facets.
          // NOTE: must stay ahead of the painted-body branch — the body material is
          // confusingly named "pencil wood", so a plain /wood/ test would grab it too.
          // The GLB leaves metalnessFactor at the glTF default (1.0) and ships a
          // metallic-roughness texture, so the cone was catching env reflections and
          // reading glossy. Force it dielectric + uniformly rough and DROP the baked
          // gloss maps (metalnessMap/roughnessMap) so a stray dark texel can't reflect;
          // the grain reads from the base-colour + normal maps, which we keep.
          const pm = mat as typeof mat & {
            metalnessMap?: unknown;
            roughnessMap?: unknown;
          };
          if (typeof pm.metalness === 'number') pm.metalness = 0;
          if (typeof pm.roughness === 'number') pm.roughness = 0.97;
          pm.metalnessMap = null;
          pm.roughnessMap = null;
          pm.needsUpdate = true;
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.03;
        } else {
          // The painted hex body ("pencil wood") + graphite tip. The GLB ships smooth
          // normals around the barrel, so light wraps it as one soft gradient and it
          // reads ROUND. flatShading recomputes per-face normals, so each hex facet
          // becomes one flat band — the distinct light/mid/shadow bands that show the
          // real hexagonal contour. Matte + low env keeps the bands as flat colour
          // steps rather than a glossy sweep that would blend them back together.
          mat.flatShading = true;
          mat.needsUpdate = true;
          if (typeof mat.roughness === 'number') mat.roughness = 0.72;
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.08;
        }
      }
    });
  }

  function disposeMaterial(m: import('three').Material) {
    const anyMat = m as unknown as Record<string, { dispose?: () => void } | undefined>;
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
      anyMat[key]?.dispose?.();
    }
    m.dispose();
  }

  /* ---- teardown ---- */
  return () => {
    torndown = true;
    cancelAnimationFrame(bootRaf);
    cancelAnimationFrame(loopRaf);
    if (toggleRaf) cancelAnimationFrame(toggleRaf);
    if (autoRaf) cancelAnimationFrame(autoRaf);
    clearTimeout(hintTimer1);
    disposeThree();
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll);
    stage.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKey);
    btnPen.removeEventListener('click', onSelectPen);
    btnEraser.removeEventListener('click', onSelectEraser);
    sizeSlider.removeEventListener('input', onSize);
    btnReset.removeEventListener('click', onReset);
    btnToggle.removeEventListener('click', onToggle);
    brushRing.remove();
    toolLayer.remove();
    cssTool.remove();
    stage.classList.remove('is-ready', 'tool-shown');
  };
}
