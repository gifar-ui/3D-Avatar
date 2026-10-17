import './style.css';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { AvatarRig } from './avatar.js';
import { CameraDirector } from './camera.js';
import { loadMixamoClip } from './mixamo.js';
import { maskArmpitOutlines } from './outlineFix.js';
import { profile, topics, topicById } from './content.js';
import { Narration } from './narration.js';
import { Backdrop, applyLayout, measureLayout, shotLayout, sideOffset } from './stage.js';
import { cardParallax, detailIn, detailOut, frameIn, homeIn, homeOut, nudgeScroll, panelsIn, panelsOut, placeMarkers, play, setView } from './motion.js';
import { renderChrome, renderNarration, renderSound, renderTopic, setActiveTopic, setSubtitles } from './ui.js';

const MODEL_URL = '/models/avatar_v1.vrm';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

// ---------- renderer / scene ----------
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);

const key = new THREE.DirectionalLight(0xffffff, Math.PI);
key.position.set(1.0, 1.6, 2.0);
scene.add(key);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const groundShadow = makeGroundShadow();   // follows the avatar's feet
scene.add(groundShadow);

function makeGroundShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(54, 72, 160, 0.30)');
  grad.addColorStop(1, 'rgba(54, 72, 160, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.55),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  return mesh;
}

// ---------- page ----------
renderChrome({ profile, topics });
const backdrop = new Backdrop([...document.querySelectorAll('.backdrop__img')], camera);
const viewHome = $('view-home');
const viewDetail = $('view-detail');
let layout = measureLayout(window.innerWidth, window.innerHeight);
applyLayout(layout);

let muted = false;
renderSound(muted);

const narration = new Narration({ onChange: renderNarration });
const parallax = cardParallax([...document.querySelectorAll('.topic-card')]);

// ---------- avatar ----------
let rig = null;
let director = null;
let avatarRoot = null;
let headNode = null;

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

function setProgress(pct, label = 'Memuat avatar…') {
  $('loader-fill').style.transform = `scaleX(${pct / 100})`;
  $('loader-text').textContent = `${label} ${pct}%`;
}

async function init() {
  const gltf = await loader.loadAsync(MODEL_URL, (e) => {
    if (e.total) setProgress(Math.round((e.loaded / e.total) * 90));
  });
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);                 // no-op for VRM 1.0, keeps VRM 0.x facing the camera
  vrm.scene.traverse((o) => (o.frustumCulled = false));
  maskArmpitOutlines(vrm);                  // no dark outline showing through the shirt at the armpits
  scene.add(vrm.scene);
  if (vrm.lookAt) vrm.lookAt.target = camera;   // eyes follow the viewer

  // measure at rest, before any animation touches the bones
  vrm.scene.updateMatrixWorld(true);
  const hipsHeight = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new THREE.Vector3()).y;
  director = new CameraDirector(camera, vrm, (name) => shotLayout(layout, name, director.shots, director.topY));

  setProgress(92, 'Memuat animasi…');
  const [walk, idle] = await Promise.all([
    loadMixamoClip('/animations/walk.fbx', vrm, hipsHeight, 'walk'),
    loadMixamoClip('/animations/idle.fbx', vrm, hipsHeight, 'idle'),
  ]);

  rig = new AvatarRig(vrm, { walk, idle });
  avatarRoot = vrm.scene;
  headNode = vrm.humanoid.getNormalizedBoneNode('head');
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) Object.assign(window, { __rig: rig, __renderer: renderer, __scene: scene, __camera: camera, __director: director, __narration: narration, __gsap: gsap });
  resize();
  setProgress(100);

  // the one orchestrated load moment: the avatar walks in while the header and footer arrive,
  // settles and greets, then the name plate rises and the cards come out of it.
  // A click on a link meanwhile (a hash change) cuts the walk short and goes there.
  const startedHome = !route();
  markActive(route(), { instant: true });
  const frame = play(frameIn(viewHome, { home: startedHome }));
  $('loader').classList.add('is-done');
  if (!reduceMotion) await Promise.race([rig.enter(director.offscreenX(), 0), introSkipped]);
  const skipped = rig.walking;
  if (skipped) {
    rig.place(0);
    frame.progress(1);
  } else {
    rig.smile(1, 2.2);
    rig.nod(0.07);
  }
  state.ready = true;
  if (!route()) {
    markActive(null);
    const reveal = homeIn(viewHome, avatarCentre, { footer: !startedHome, intro: !skipped });
    if (!skipped) reveal.add(nudgeScroll(), '+=0.2');
    play(reveal);
  }
  navigate();
}

let skipIntro;
const introSkipped = new Promise((resolve) => (skipIntro = resolve));

// The avatar's chest on screen in the full-body shot: the cards come out of (and go back into) it.
function avatarCentre() {
  const l = shotLayout(layout, 'full', director.shots, director.topY);
  return { x: l.x * layout.vw, y: (l.y - l.h * 0.12) * layout.vh };
}

init().catch((err) => {
  console.error(err);
  $('loader-text').textContent = 'Gagal memuat avatar. Muat ulang halaman.';
});

// ---------- navigation: #/ = home, #/<topic> = detail ----------
const state = { ready: false, busy: false, switching: false, view: 'home', topic: null, side: 'left' };
const order = [null, ...topics.map((t) => t.id)];
let playTimer = 0;
let navToken = 0;
const SWITCH_SPEED = 1.45;          // m/s: a brisker walk between topics than the intro stroll
const ZOOM_IN = reduceMotion ? 0 : 1.6;    // s, full body → half body (reduced motion: a cut)
const ZOOM_OUT = reduceMotion ? 0 : 1.3;   // s, half body → full body
const SETTLE = reduceMotion ? 0 : 0.4;     // s before a zoom ends: the next view starts arriving
let opening = null;                 // { zoom, abort } from the start of a zoom-in until its panels appear

function route() {
  const id = location.hash.replace(/^#\/?/, '');
  return topicById[id] ? id : null;
}

// Topics alternate sides: About and Projects keep the avatar left, Skills and Journey mirror it right.
const sideOf = (id) => (topics.findIndex((t) => t.id === id) % 2 ? 'right' : 'left');
function setSide(side) {
  state.side = side;
  document.documentElement.dataset.side = side;
}
// World X where the avatar stands for the current side (0 = centre stage, the camera's anchor).
const restX = () => sideOffset(layout, state.side, director.shotWidth('half'));

// Marks the current topic (null = home) in both menus; the markers slide to it.
function markActive(id, markers) {
  setActiveTopic(id);
  placeMarkers(markers);
}

window.addEventListener('hashchange', navigate);

async function navigate() {
  if (!state.ready) return skipIntro();
  const target = route();
  // a topic switch can be cut short by another topic, a zoom-in by going home; anything else waits its turn
  const interrupts = (state.switching && target && state.view === 'detail') || (opening && !target);
  if (state.busy && !interrupts) return;
  if (target === state.topic && (target ? state.view === 'detail' : state.view === 'home')) return;
  const token = ++navToken;
  state.busy = true;
  closeMenu();
  try {
    if (target && state.view === 'home') await openDetail(target);
    else if (target) await switchTopic(target, token);
    else await closeDetail();
  } finally {
    if (token === navToken) state.busy = false;
  }
  if (token === navToken && route() !== state.topic) navigate();   // the hash moved while we were animating
}

async function openDetail(id) {
  const from = document.activeElement;
  state.view = 'detail';
  state.topic = id;
  setSide(sideOf(id));
  document.body.dataset.view = 'detail';
  // after the view switch: on compact screens the trail only now appears, so measure it now and place it
  markActive(id, { instant: layout.mode === 'compact' });
  renderTopic(topicById[id], profile);
  resetScroll();
  const ready = narration.load(topicById[id]);
  // zoom in while the cards lift away; on a mirrored topic the avatar walks over to its spot meanwhile
  const walk = reduceMotion ? rig.place(restX()) : rig.walkTo(restX());
  const zoom = gsap.timeline()
    .add(homeOut(viewHome, avatarCentre), 0)
    .add(director.go('half', ZOOM_IN), 0);
  // the panels arrive as the camera settles, once the avatar stands on its spot
  const settled = new Promise((resolve) => zoom.call(resolve, null, ZOOM_IN - SETTLE));
  const mine = { zoom };
  const aborted = new Promise((resolve) => (mine.abort = resolve));
  opening = mine;
  play(zoom);
  await Promise.race([Promise.all([settled, walk]), aborted]);
  if (opening !== mine) return;          // going home reversed it (reverseOpen)
  opening = null;
  const reveal = play(detailIn(viewDetail));
  startNarration(id, ready);
  await reveal;
  if (from && from !== document.body && state.topic === id) $('topic-title').focus({ preventScroll: true });
}

// Which screen edge (-1 left, +1 right) is nearest to world X; 0 when it stands in the middle.
function nearestEdge(x) {
  const d = x - director.centerX();
  return Math.abs(d) < 0.05 * director.shotWidth('half') ? 0 : Math.sign(d);
}

// Topic to topic: the panels clear, the avatar walks off and back on, arriving on the new topic's side.
// It leaves by the edge nearest to where it stands and enters by the edge nearest to where it will
// stand, so left → right = exit left, enter right; right → right = out and back in on the right.
// Standing in the middle (compact): forward = exit left, enter right; back = the reverse.
async function switchTopic(id, token) {
  const forward = order.indexOf(id) > order.indexOf(state.topic);
  const exitDir = nearestEdge(rig.root.position.x) || (forward ? -1 : 1);
  state.switching = true;
  state.topic = id;
  markActive(id);
  narration.pause();
  clearTimeout(playTimer);
  try {
    const clear = play(panelsOut(viewDetail));
    if (!reduceMotion) {
      await Promise.all([clear, rig.walkTo(director.edgeX(exitDir), { exit: true, speed: SWITCH_SPEED })]);
      if (token !== navToken) return;
    } else {
      await wait(240);
      if (token !== navToken) return;
    }
    // the stage is empty: swap side and content
    setSide(sideOf(id));
    renderTopic(topicById[id], profile);
    resetScroll();
    const ready = narration.load(topicById[id]);
    if (!reduceMotion) {
      const rest = restX();
      const enterDir = nearestEdge(rest) || -exitDir;
      await rig.walkTo(rest, { from: director.edgeX(enterDir), speed: SWITCH_SPEED });
      if (token !== navToken) return;
    } else {
      rig.place(restX());
    }
    const reveal = play(panelsIn(viewDetail, { quick: true }));
    startNarration(id, ready);
    await reveal;
    if (token === navToken) $('topic-title').focus({ preventScroll: true });
  } finally {
    if (token === navToken) state.switching = false;
  }
}

async function closeDetail() {
  if (opening) return reverseOpen();
  const last = state.topic;
  narration.pause();
  clearTimeout(playTimer);
  state.view = 'home';
  state.topic = null;
  markActive(null);
  document.body.dataset.view = 'home';
  // the panels clear, the camera pulls back, and the cards rise in as it settles;
  // a mirrored avatar walks back to centre stage on the way
  const walk = reduceMotion ? rig.place(0) : rig.walkTo(0);
  const zoom = gsap.timeline()
    .add(detailOut(viewDetail), 0)
    .add(director.go('full', ZOOM_OUT), 0.1)
    .add(homeIn(viewHome, avatarCentre), 0.1 + ZOOM_OUT - SETTLE);
  await Promise.all([play(zoom), walk]);
  setSide('left');
  document.querySelector(`.topic-card[data-topic="${last}"]`)?.focus({ preventScroll: true });
}

// Home while the camera is still zooming in (Home link, logo, browser back): the zoom-in plays
// backwards from wherever it is, so the cards come back out of the avatar along the path they took.
async function reverseOpen() {
  const { zoom, abort } = opening;
  opening = null;
  abort();
  clearTimeout(playTimer);
  state.view = 'home';
  state.topic = null;
  markActive(null);
  document.body.dataset.view = 'home';
  setView(viewHome, true);
  const walk = reduceMotion ? rig.place(0) : rig.walkTo(0);
  await Promise.all([zoom.reverse(), walk]);
  setSide('left');
}

// gesture first (random hand), then the narration a beat later; more gestures follow at random while it plays
function startNarration(id, ready) {
  clearTimeout(playTimer);
  rig.setTalking(false);                     // settle the previous topic's state now, so it can't cut the new gesture
  rig.present();
  playTimer = setTimeout(async () => {
    await ready;
    if (state.topic === id && state.view === 'detail') narration.play();
  }, reduceMotion ? 0 : 600);
}

// a new topic starts with the sheet lowered (compact) and the panels at the top
function resetScroll() {
  for (const id of ['detail-sheet', 'topic']) $(id).scrollTop = 0;
}

const CLOSED = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- controls ----------
$('btn-play').addEventListener('click', () => narration.toggle());

const ccBtn = $('player-cc');
ccBtn.addEventListener('click', () => setSubtitles(ccBtn.getAttribute('aria-pressed') !== 'true'));

$('btn-sound').addEventListener('click', () => {
  muted = !muted;
  narration.setMuted(muted);
  renderSound(muted);
});

const greetBtn = $('btn-greet');
greetBtn.addEventListener('click', () => rig?.wave());
// greet is unavailable while the avatar is walking in or mid-gesture
let greetBusy = null;
function syncGreet() {
  const busy = !rig || rig.busy;
  if (busy === greetBusy) return;
  greetBusy = busy;
  greetBtn.setAttribute('aria-disabled', String(busy));
}

// mobile menu
const menuBtn = $('btn-menu');
const menuSheet = $('menu-sheet');
function closeMenu() {
  menuSheet.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
}
menuBtn.addEventListener('click', () => {
  const open = menuSheet.hidden;
  menuSheet.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  if (open) menuSheet.querySelector('a')?.focus();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menuSheet.hidden) {
    closeMenu();
    menuBtn.focus();
  }
});
menuSheet.addEventListener('click', (e) => e.target.closest('a') && closeMenu());

// "Scroll to explore": on wide screens the wheel steps home → topics → home
let wheelLock = 0;
window.addEventListener('wheel', (e) => {
  if (layout.mode !== 'wide' || !state.ready || state.busy || Math.abs(e.deltaY) < 24) return;
  const scroller = e.target.closest?.('.topic');
  if (scroller && scroller.scrollHeight > scroller.clientHeight) return;
  const now = performance.now();
  if (now < wheelLock) return;
  const i = order.indexOf(state.topic) + Math.sign(e.deltaY);
  if (i < 0 || i >= order.length) return;
  wheelLock = now + 2000;
  location.hash = order[i] ? `#/${order[i]}` : '#/';
}, { passive: true });

// ---------- pointer: head follows the cursor, click/tap the avatar to wave ----------
const ndc = new THREE.Vector2();
const headScreen = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

function toNdc(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
}

// p: a point in NDC; the head turns toward it
function lookToward(p) {
  headNode.getWorldPosition(headScreen).project(camera);
  // offset from the head on screen, scaled so a full-screen sweep ≈ ±1
  rig.setPointer(clamp1((p.x - headScreen.x) * 0.8), clamp1((p.y - headScreen.y) * 0.8));
}

const cardPoint = new THREE.Vector2();
function cardNdc(card) {
  const r = card.getBoundingClientRect();
  return cardPoint.set(((r.left + r.width / 2) / window.innerWidth) * 2 - 1, -((r.top + r.height / 2) / window.innerHeight) * 2 + 1);
}

window.addEventListener('pointermove', (e) => {
  toNdc(e);
  const home = state.view === 'home';
  if (home && layout.mode === 'wide') parallax(ndc.x, ndc.y);
  if (!rig || !headNode) return;
  // over a card, the avatar looks at the card itself rather than the cursor
  const card = home && e.target.closest?.('.topic-card');
  lookToward(card ? cardNdc(card) : ndc);
});

// A card coming under the cursor or keyboard focus earns a small smile (never cutting a greeting's).
let glanced = null;
function glance(card) {
  if (card === glanced) return;
  glanced = card;
  if (card && rig && !rig.busy && !rig.smiling && state.view === 'home') rig.smile(0.45, 1.2);
}
const cardList = $('topic-cards');
cardList.addEventListener('pointerover', (e) => glance(e.target.closest('.topic-card')));
cardList.addEventListener('pointerleave', () => (glanced = null));
cardList.addEventListener('focusin', (e) => {
  const card = e.target.closest('.topic-card');
  glance(card);
  if (card && rig && headNode) lookToward(cardNdc(card));
});
cardList.addEventListener('focusout', () => (glanced = null));
document.documentElement.addEventListener('pointerleave', () => {
  rig?.clearPointer();
  parallax(0, 0);
});

canvas.addEventListener('click', (e) => {
  if (!rig || !avatarRoot || state.busy || rig.busy) return;
  toNdc(e);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.intersectObject(avatarRoot, true).length) rig.wave();
});

function clamp1(v) {
  return Math.max(-1, Math.min(1, v));
}

// ---------- resize / loop ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  layout = measureLayout(w, h);
  applyLayout(layout);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  director?.snap();
  placeMarkers({ instant: true });
  // a resize changes where the mirrored spot is; settle there unless mid-walk
  if (rig && state.view === 'detail' && !state.busy && !rig.walking) rig.root.position.x = restX();
}
window.addEventListener('resize', resize);
resize();
document.fonts?.ready.then(() => placeMarkers({ instant: true }));   // link widths change once the fonts load

// One loop for everything: GSAP's ticker updates its tweens (camera, UI) first, then this
// renders the frame, so a camera move is never a frame behind the avatar.
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 1 / 20);
  const mouth = narration.update(dt);
  rig?.setMouth(narration.playing ? mouth ?? CLOSED : null);
  rig?.setTalking(narration.playing);        // random hand gestures while the narration plays
  if (narration.playing) renderNarration(narration);
  rig?.update(dt);
  syncGreet();
  if (director) backdrop.update(director.topY, layout.vw, layout.vh, layout.mode === 'wide');
  if (avatarRoot) groundShadow.position.x = avatarRoot.position.x;
  renderer.render(scene, camera);
});
