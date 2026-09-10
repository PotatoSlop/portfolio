/*
  design-model-viewer — the interactive 3D model modal for the /design page.
  Reintroduces the GLB viewer from the previous deployed site. A `category: '3d'`
  card with a wired `.glb` (see src/lib/design-links.ts → kind 'model') carries
  `data-card-action="model"` + `data-glb`; clicking/activating it opens the shared
  DesignModal overlay and renders the model with orbit controls.

  three.js (+ GLTFLoader/OrbitControls/RoomEnvironment) is dynamically imported so
  its bundle only loads once a visitor actually opens a model — the /design page
  itself stays light.

  Lifecycle: mountDesignModelViewer() wires the delegated openers + modal chrome
  and returns a teardown that closes any open viewer and unbinds everything. It is
  idempotent per call and safe to run on every astro:page-load (see lifecycle.ts).
*/
import { prefersReducedMotion } from './reduced-motion';

export function mountDesignModelViewer(): () => void {
  const modalEl = document.getElementById('design-modal');
  if (!modalEl) return () => {};
  // Explicitly non-null local so the nested open/close closures below don't
  // re-widen it back to HTMLElement | null.
  const modal: HTMLElement = modalEl;

  const dialog = modal.querySelector<HTMLElement>('.dmodal__dialog')!;
  const stage = modal.querySelector<HTMLElement>('[data-dmodal-stage]')!;
  const status = modal.querySelector<HTMLElement>('[data-dmodal-status]')!;
  const titleEl = modal.querySelector<HTMLElement>('#dmodal-title')!;

  // Per-open teardown for the live three.js scene (raf + GPU resources). null when
  // the modal is closed.
  let disposeScene: (() => void) | null = null;
  // The card that opened the modal — focus returns here on close.
  let opener: HTMLElement | null = null;
  let loadToken = 0; // guards against a slow load resolving after close/re-open

  const setStatus = (text: string | null) => {
    if (text == null) {
      status.toggleAttribute('data-hidden', true);
    } else {
      status.textContent = text;
      status.toggleAttribute('data-hidden', false);
    }
  };

  /* ---- open / close ---- */
  function open(glb: string, title: string, from: HTMLElement) {
    opener = from;
    titleEl.textContent = title;
    setStatus('Loading model…');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    // Next frame so the un-hide paints before the open transition runs.
    requestAnimationFrame(() => modal.classList.add('is-open'));
    document.documentElement.style.overflow = 'hidden';
    dialog.focus?.();
    // Surface ANY failure (a rejected dynamic import, a bad GLB) instead of
    // letting the promise reject unhandled and stick on "Loading model…".
    loadModel(glb).catch((err) => {
      console.error('[design-model-viewer] failed to load', glb, err);
      if (!modal.hidden) setStatus('Could not load model.');
    });
  }

  function close() {
    if (modal.hidden) return;
    loadToken++; // invalidate any in-flight load
    disposeScene?.();
    disposeScene = null;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    // Wait out the close transition before fully hiding, so it animates.
    const finish = () => {
      modal.hidden = true;
      dialog.removeEventListener('transitionend', finish);
    };
    if (prefersReducedMotion()) finish();
    else dialog.addEventListener('transitionend', finish);
    opener?.focus?.();
    opener = null;
  }

  /* ---- three.js scene ---- */
  async function loadModel(glb: string) {
    const token = ++loadToken;
    const [THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/environments/RoomEnvironment.js'),
    ]);
    if (token !== loadToken) return; // closed / re-opened while importing

    const w = () => stage.clientWidth || 1;
    const h = () => stage.clientHeight || 1;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w(), h());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Image-based lighting so PBR metals/roughness read correctly, plus a light
    // key/rim rig for shaping. Mirrors the about-page pencil setup.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-0.8, 1.0, 0.9);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe7ff, 0.7);
    rim.position.set(0.6, 0.8, -0.9);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const camera = new THREE.PerspectiveCamera(45, w() / h(), 0.01, 1000);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.1;
    controls.autoRotate = !prefersReducedMotion();
    controls.autoRotateSpeed = 1.1;

    // Provisional disposer if teardown lands before the model resolves.
    disposeScene = () => {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      envRT.dispose();
      pmrem.dispose();
      controls.dispose();
    };

    let gltf: { scene: import('three').Group };
    try {
      const loader = new GLTFLoader();
      gltf = await new Promise((resolve, reject) => loader.load(glb, resolve, undefined, reject));
    } catch {
      if (token === loadToken) setStatus('Could not load model.');
      return;
    }
    if (token !== loadToken) {
      // Closed while the GLB was downloading — release what we built.
      disposeScene?.();
      disposeScene = null;
      return;
    }

    const model = gltf.scene;
    scene.add(model);

    // Frame the model: centre it at the origin and pull the camera back to a
    // distance that fits its bounding sphere in the vertical FOV (with margin).
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center); // recentre on origin

    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (radius / Math.sin(fov / 2)) * 1.3;
    camera.position.set(dist * 0.6, dist * 0.35, dist * 0.85);
    camera.near = Math.max(dist / 100, 0.001);
    camera.far = dist * 100;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();

    setStatus(null);

    /* ---- animate + resize ---- */
    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    };
    // Skip the persistent rAF entirely under reduced motion (autoRotate off); still
    // re-render on user interaction so orbit/zoom respond.
    if (controls.autoRotate) {
      render();
    } else {
      const onChange = () => renderer.render(scene, camera);
      controls.addEventListener('change', onChange);
      renderer.render(scene, camera);
    }

    const onResize = () => {
      camera.aspect = w() / h();
      camera.updateProjectionMatrix();
      renderer.setSize(w(), h());
      renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(stage);

    // Full disposer: stop the loop, free every GPU resource, drop the canvas.
    disposeScene = () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        const mesh = obj as import('three').Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material as import('three').Material | import('three').Material[];
          (Array.isArray(mat) ? mat : [mat]).forEach((m) => m?.dispose());
        }
      });
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }

  /* ---- delegated openers + modal chrome ---- */
  function resolveModelCard(target: EventTarget | null): HTMLElement | null {
    const el = target as HTMLElement | null;
    return el?.closest?.<HTMLElement>('[data-card-action="model"]') ?? null;
  }
  function openFromCard(card: HTMLElement, ev: Event) {
    const glb = card.dataset.glb;
    if (!glb) return;
    ev.preventDefault();
    const title = card.querySelector('.d-label b, .g-label')?.textContent?.trim() || '3D model';
    open(glb, title, card);
  }
  // Open on a TAP (pointer down→up on the same card, minimal travel) rather than a
  // native `click`. In the drift rows the card is moving, so a press+release often
  // lands mousedown and mouseup on different elements → the browser fires NO click
  // and the modal never opened (it worked in the static "All work" grid, and with
  // devtools open because that throttles the drift). A tap check is immune to that
  // and still lets a real scrub (travel > TAP_SLOP) fall through to the carousel.
  const TAP_SLOP = 10; // px of travel still counted as a tap, not a scrub
  let downCard: HTMLElement | null = null;
  let downX = 0;
  let downY = 0;
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    downCard = resolveModelCard(e.target);
    downX = e.clientX;
    downY = e.clientY;
  };
  const onPointerUp = (e: PointerEvent) => {
    const card = downCard;
    downCard = null;
    if (!card) return;
    // Tap, not a drag-scrub. We DON'T check e.target here: the carousel captures the
    // pointer to the drift track, so pointerup's target is the track, not the card —
    // the travel distance is the reliable tap test.
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > TAP_SLOP) return;
    if (!modal.hidden) return; // already open — ignore
    openFromCard(card, e);
  };
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !modal.hidden) {
      close();
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = resolveModelCard(e.target);
    if (card) openFromCard(card, e);
  };
  const onCloseClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement)?.closest('[data-dmodal-close]')) close();
  };

  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('keydown', onKeydown);
  modal.addEventListener('click', onCloseClick);

  return () => {
    close();
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('keydown', onKeydown);
    modal.removeEventListener('click', onCloseClick);
    // Ensure the scroll lock never leaks past teardown.
    document.documentElement.style.overflow = '';
  };
}
