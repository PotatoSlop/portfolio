import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const viewButtons = document.querySelectorAll('.view-3d-button');
const modal = document.getElementById('modal-3d-viewer');
const closeModalButton = document.getElementById('modal-close-button');
const canvasContainer = document.getElementById('model-canvas-container');

let scene, camera, renderer, controls, model;
let animationFrameId; // To control the animation loop

const backgroundColor = 0xf0f0f0;
const ambientLightColor = 0xfff0d9;
const keyLightColor = 0xffffff;

viewButtons.forEach(button => { //Modal Based 3D preview
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const modelUrl = button.dataset.modelUrl;
    openModal(modelUrl);
  });
});

closeModalButton.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

function openModal(modelUrl) {
  modal.classList.add('active');
  document.body.classList.add('no-scroll');
  init3DScene(modelUrl);
}

function closeModal() {
  modal.classList.remove('active');
  document.body.classList.remove('no-scroll');
  destroy3DScene(); // Clean up scene for memory
}

function init3DScene(modelUrl) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(backgroundColor); 

  const containerRect = canvasContainer.getBoundingClientRect();
  camera = new THREE.PerspectiveCamera(50, containerRect.width / containerRect.height, 0.1, 1000);
  camera.position.set(0, 0, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(containerRect.width, containerRect.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;
  canvasContainer.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 1;
  controls.maxDistance = 500;

  const ambientLight = new THREE.AmbientLight(ambientLightColor, 0.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(keyLightColor, 1);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  const loader = new GLTFLoader();
  loader.load(modelUrl, (gltf) => {
    model = gltf.scene;
    
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5; // Zoom for Padding 
    
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

  // Destroys of model geometry and materials
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