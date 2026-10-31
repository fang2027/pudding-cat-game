import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

const viewer = document.querySelector('#viewer');
const status = document.querySelector('#status');
const input = document.querySelector('#fileInput');
const hint = document.querySelector('#emptyHint');
const animationSelect = document.querySelector('#animationSelect');
const morphControls = document.querySelector('#morphControls');
const resetExpressions = document.querySelector('#resetExpressions');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e5eef8');
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
camera.position.set(4.2, 2.8, 6.2);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
viewer.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.15, 0);
controls.update();

scene.add(new THREE.HemisphereLight('#ffffff', '#b0bcca', 2.4));
const keyLight = new THREE.DirectionalLight('#ffffff', 3);
keyLight.position.set(3, 7, 5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight('#9dbff6', 1.2);
fillLight.position.set(-5, 3, -4);
scene.add(fillLight);

const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(2.6, 2.7, 0.15, 72),
  new THREE.MeshStandardMaterial({ color: '#f7fafc', roughness: 0.9 })
);
ground.position.y = -0.11;
scene.add(ground);
const grid = new THREE.GridHelper(5.1, 12, '#afc1d4', '#d5e1ed');
grid.position.y = -0.02;
scene.add(grid);

const loader = new GLTFLoader();
const clock = new THREE.Clock();
let currentRoot = null;
let currentMixer = null;
let currentAction = null;
let loadedAnimations = [];
let morphBindings = new Map();

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

function setStat(name, value) {
  document.querySelector(`#${name}`).textContent = String(value);
}

function clearOldModel() {
  if (currentAction) currentAction.stop();
  if (currentMixer) currentMixer.stopAllAction();
  currentAction = null;
  currentMixer = null;
  if (currentRoot) {
    scene.remove(currentRoot);
    // Imported model resources remain owned by the loader/browser for the session.
    // Do not dispose shared textures until their reference counts are established.
  }
  currentRoot = null;
  loadedAnimations = [];
  morphBindings = new Map();
  morphControls.replaceChildren();
  resetExpressions.disabled = true;
}

function buildMorphControls() {
  morphControls.replaceChildren();
  for (const [name, bindings] of morphBindings) {
    const row = document.createElement('div');
    row.className = 'morph-item';
    const label = document.createElement('label');
    const control = document.createElement('input');
    const output = document.createElement('output');
    control.type = 'range';
    control.min = '0';
    control.max = '1';
    control.step = '0.01';
    control.value = '0';
    control.id = `morph-${morphControls.childElementCount}`;
    label.htmlFor = control.id;
    label.textContent = name;
    output.textContent = '0.00';
    control.addEventListener('input', () => {
      const weight = Number(control.value);
      for (const { mesh, index } of bindings) mesh.morphTargetInfluences[index] = weight;
      output.textContent = weight.toFixed(2);
    });
    row.append(label, output, control);
    morphControls.append(row);
  }
  if (!morphBindings.size) {
    const note = document.createElement('p');
    note.className = 'subtle';
    note.textContent = 'GLB 沒有可控制的 Shape Key。請檢查 Blender 匯出設定。';
    morphControls.append(note);
  }
  resetExpressions.disabled = morphBindings.size === 0;
}

function setupAnimations(animations) {
  loadedAnimations = animations;
  animationSelect.replaceChildren();
  animationSelect.disabled = animations.length === 0;
  const none = document.createElement('option');
  none.value = '';
  none.textContent = animations.length ? '不播放動畫' : '目前沒有可播放的動畫';
  animationSelect.append(none);
  animations.forEach((clip, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = clip.name || `Animation ${index + 1}`;
    animationSelect.append(option);
  });
  if (animations.length && currentRoot) currentMixer = new THREE.AnimationMixer(currentRoot);
}

animationSelect.addEventListener('change', () => {
  if (currentAction) currentAction.stop();
  currentAction = null;
  if (animationSelect.value === '' || !currentMixer) return;
  const clip = loadedAnimations[Number(animationSelect.value)];
  if (!clip) return;
  currentAction = currentMixer.clipAction(clip);
  currentAction.reset().play();
});

resetExpressions.addEventListener('click', () => {
  for (const bindings of morphBindings.values()) {
    for (const { mesh, index } of bindings) mesh.morphTargetInfluences[index] = 0;
  }
  for (const slider of morphControls.querySelectorAll('input[type="range"]')) {
    slider.value = '0';
    slider.dispatchEvent(new Event('input'));
  }
});

async function loadGlb(file) {
  if (!file || !file.name.toLowerCase().endsWith('.glb')) {
    setStatus('目前只接受單一 .glb 檔案。請先在 Blender 匯出 GLB。', true);
    return;
  }
  setStatus(`正在載入 ${file.name} …`);
  try {
    const buffer = await file.arrayBuffer();
    const gltf = await new Promise((resolve, reject) => loader.parse(buffer, '', resolve, reject));
    if (!gltf.scene) throw new Error('找不到可顯示的 3D 場景。');
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    if (bounds.isEmpty()) throw new Error('模型內沒有可顯示的網格。');

    clearOldModel();
    currentRoot = gltf.scene;
    const dimensions = bounds.getSize(new THREE.Vector3());
    const scale = 2.65 / Math.max(dimensions.x, dimensions.y, dimensions.z, 0.00001);
    currentRoot.scale.multiplyScalar(scale);
    scene.add(currentRoot);
    const newBounds = new THREE.Box3().setFromObject(currentRoot);
    const center = newBounds.getCenter(new THREE.Vector3());
    currentRoot.position.x -= center.x;
    currentRoot.position.y -= newBounds.min.y;
    currentRoot.position.z -= center.z;

    let meshCount = 0;
    let skinnedCount = 0;
    const boneNames = new Set();
    currentRoot.traverse((node) => {
      if (!node.isMesh) return;
      meshCount += 1;
      if (node.isSkinnedMesh && node.skeleton) {
        skinnedCount += 1;
        node.skeleton.bones.forEach((bone) => boneNames.add(bone.uuid));
      }
      const dictionary = node.morphTargetDictionary || {};
      for (const [name, index] of Object.entries(dictionary)) {
        if (!node.morphTargetInfluences || index >= node.morphTargetInfluences.length) continue;
        if (!morphBindings.has(name)) morphBindings.set(name, []);
        morphBindings.get(name).push({ mesh: node, index });
      }
    });

    setStat('meshCount', meshCount);
    setStat('skinnedCount', skinnedCount);
    setStat('boneCount', boneNames.size);
    setStat('morphCount', morphBindings.size);
    setStat('animationCount', gltf.animations.length);
    document.querySelector('#fileName').textContent = file.name;
    hint.hidden = true;
    buildMorphControls();
    setupAnimations(gltf.animations);
    setStatus(`已載入 ${file.name}。請目視確認模型、材質、骨架姿態與表情；這不代表匯出驗證已全部通過。`);
  } catch (error) {
    console.error('GLB import failed:', error);
    setStatus(`載入失敗：${error.message || '不明錯誤'}`, true);
  }
}

input.addEventListener('change', () => loadGlb(input.files?.[0]));
viewer.addEventListener('dragover', (event) => {
  event.preventDefault();
  viewer.classList.add('dragging');
});
viewer.addEventListener('dragleave', () => viewer.classList.remove('dragging'));
viewer.addEventListener('drop', (event) => {
  event.preventDefault();
  viewer.classList.remove('dragging');
  loadGlb(event.dataTransfer?.files?.[0]);
});

function resize() {
  const { width, height } = viewer.getBoundingClientRect();
  if (width <= 0 || height <= 0) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewer);
resize();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (currentMixer) currentMixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
}
animate();
