import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { lightingPresets, DEFAULT_PRESET } from './lighting-presets.js';

const viewButtons = document.querySelectorAll('.view-3d-button');
const modal = document.getElementById('modal-3d-viewer');
const closeModalButton = document.getElementById('modal-close-button');
const canvasContainer = document.getElementById('model-canvas-container');

let scene, camera, renderer, controls, model;
let animationFrameId; // To control the animation loop

// Map preset string -> THREE constant for tone mapping.
const TONE_MAPPING = {
  'NoToneMapping': THREE.NoToneMapping,
  'Linear': THREE.LinearToneMapping,
  'Cineon': THREE.CineonToneMapping,
  'Reinhard': THREE.ReinhardToneMapping,
  'ACESFilmic': THREE.ACESFilmicToneMapping,
};

viewButtons.forEach(button => { // Modal-based 3D preview
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const modelUrl = button.dataset.modelUrl;
    const presetName = button.dataset.lightingPreset || DEFAULT_PRESET;
    openModal(modelUrl, presetName);
  });
});

closeModalButton.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

function openModal(modelUrl, presetName) {
  modal.classList.add('active');
  document.body.classList.add('no-scroll');
  const preset = lightingPresets[presetName] || lightingPresets[DEFAULT_PRESET];
  if (!preset) {
    console.error(`[viewer3d] Unknown lighting preset "${presetName}" and no DEFAULT_PRESET fallback resolved.`);
    return;
  }
  console.log(`[viewer3d] Using lighting preset "${presetName}"`);
  init3DScene(modelUrl, preset);
}

function closeModal() {
  modal.classList.remove('active');
  document.body.classList.remove('no-scroll');
  destroy3DScene(); // Clean up scene for memory
}

/**
 * Construct a THREE light from a preset light config object.
 * See lighting-presets.js for the supported config shape.
 */
function createLight(config) {
  switch (config.type) {
    case 'ambient':
      return new THREE.AmbientLight(config.color, config.intensity);

    case 'hemisphere': {
      const light = new THREE.HemisphereLight(config.skyColor, config.groundColor, config.intensity);
      if (config.position) light.position.set(...config.position);
      return light;
    }

    case 'directional': {
      const light = new THREE.DirectionalLight(config.color, config.intensity);
      if (config.position) light.position.set(...config.position);
      return light;
    }

    default:
      console.warn(`[viewer3d] Unknown light type "${config.type}" in preset config`);
      return null;
  }
}

function init3DScene(modelUrl, preset) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(preset.background);

  const containerRect = canvasContainer.getBoundingClientRect();
  camera = new THREE.PerspectiveCamera(50, containerRect.width / containerRect.height, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(containerRect.width, containerRect.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = TONE_MAPPING[preset.toneMapping] ?? THREE.LinearToneMapping;
  renderer.toneMappingExposure = preset.toneMappingExposure ?? 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasContainer.appendChild(renderer.domElement);

  // Optional environment map. Some presets (e.g. boat) don't want one
  // because their materials are stylised, not PBR-realistic.
  if (preset.useEnvironment) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();
    console.log('[viewer3d] RoomEnvironment applied. scene.environment =', scene.environment);
  }

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 1;
  controls.maxDistance = 500;

  // Build the lighting rig from the preset's light list.
  preset.lights.forEach((cfg) => {
    const light = createLight(cfg);
    if (light) scene.add(light);
  });

  const loader = new GLTFLoader();
  loader.load(modelUrl, (gltf) => {
    model = gltf.scene;

    // Apply preset envMapIntensity to every PBR material on the model.
    // Skipped if the preset disables env entirely, since the value would
    // have no effect.
    if (preset.useEnvironment) {
      let pbrMaterialCount = 0;
      model.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((m) => {
            if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
              m.envMapIntensity = preset.envMapIntensity ?? 1.0;
              m.needsUpdate = true;
              pbrMaterialCount++;
            }
          });
        }
      });
      console.log(`[viewer3d] Tuned envMapIntensity on ${pbrMaterialCount} PBR materials`);
    }

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5; // Zoom padding

    camera.position.set(center.x, center.y, center.z + cameraZ);
    controls.target.copy(center); // Point controls at the model's center

    scene.add(model);
  }, undefined, (error) => {
    console.error('An error occurred while loading model:', error);
  });

  animate();
  window.addEventListener('resize', onWindowResize);
}


function animate() {
  animationFrameId = requestAnimationFrame(animate);
  controls.update(); // Only required if enableDamping is true
  renderer.render(scene, camera);
}

function destroy3DScene() {
  if (!scene) return;

  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('resize', onWindowResize);

  // Dispose model geometry and materials
  scene.traverse((object) => {
    if (object.isMesh) {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    }
  });

  // Dispose the PMREM-generated environment texture so it doesn't leak
  // GPU memory across modal opens. (Only present if the preset opted in.)
  if (scene.environment) {
    scene.environment.dispose();
    scene.environment = null;
  }

  renderer.dispose();
  canvasContainer.removeChild(renderer.domElement);

  scene = null;
  camera = null;
  renderer = null;
  controls = null;
}

function onWindowResize() {
  const containerRect = canvasContainer.getBoundingClientRect();
  camera.aspect = containerRect.width / containerRect.height;
  camera.updateProjectionMatrix();
  renderer.setSize(containerRect.width, containerRect.height);
}
