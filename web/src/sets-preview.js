import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { AvatarRig } from './avatar.js';
import { CameraDirector } from './camera.js';
import { loadMixamo, retargetMixamoClip } from './mixamo.js';
import { measureLayout, shotLayout, sideOffset } from './stage.js';
import { loadSet } from './sets.js';

// Review page for the baked 3D sets, framed exactly like the site (same camera, shots and layout).
//   ?set=home|skills   ?shot=full|half   ?side=left|right
// Defaults: home = full body at centre stage; skills = half body on the right (its detail layout).

const params = new URLSearchParams(location.search);
const setName = params.get('set') ?? 'home';
const shot = params.get('shot') ?? (setName === 'home' ? 'full' : 'half');
const side = params.get('side') ?? (setName === 'home' ? 'left' : 'right');

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#F2F4F9');
const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
// the avatar keeps its own real-time lights, as on the site; the set is unlit
const key = new THREE.DirectionalLight(0xffffff, Math.PI);
key.position.set(1.0, 1.6, 2.0);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

const status = document.getElementById('status');
let layout = measureLayout(window.innerWidth, window.innerHeight);
let director = null;
let rig = null;

const vrmLoader = new GLTFLoader();
vrmLoader.register((parser) => new VRMLoaderPlugin(parser));

async function init() {
  const t0 = performance.now();
  const clips = { idle: loadMixamo('/animations/idle.json'), walk: loadMixamo('/animations/walk.json') };
  const [gltf, set] = await Promise.all([vrmLoader.loadAsync('/models/avatar_v1.vrm'), loadSet(setName)]);
  scene.add(set);
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  vrm.scene.traverse((o) => (o.frustumCulled = false));
  scene.add(vrm.scene);
  vrm.scene.updateMatrixWorld(true);
  const hipsHeight = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new THREE.Vector3()).y;
  director = new CameraDirector(camera, vrm, (name) => shotLayout(layout, name, director.shots, director.topY));
  director.shotName = shot;
  const [walk, idle] = await Promise.all(['walk', 'idle'].map(async (n) => retargetMixamoClip(await clips[n], vrm, hipsHeight, n)));
  rig = new AvatarRig(vrm, { walk, idle });
  resize();
  const ms = Math.round(performance.now() - t0);
  status.textContent = `${setName} · ${shot} · ${side} — loaded in ${ms} ms`;
  Object.assign(window, { __renderer: renderer, __rig: rig, __director: director, __ready: true });
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  layout = measureLayout(w, h);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!director) return;
  director.snap();
  rig.place(shot === 'half' ? sideOffset(layout, side, director.shotWidth('half')) : 0);
}
window.addEventListener('resize', resize);

const timer = new THREE.Timer();
renderer.setAnimationLoop((t) => {
  timer.update(t);
  rig?.update(Math.min(timer.getDelta(), 1 / 20));
  renderer.render(scene, camera);
});

init().catch((err) => {
  console.error(err);
  status.textContent = `Failed: ${err.message}`;
});
