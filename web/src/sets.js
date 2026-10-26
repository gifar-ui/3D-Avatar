import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Baked 3D backdrops ("sets") built in blender/bg_sets_v001.blend. Each set is three meshes:
//   *_LitBig / *_LitDetail  vertex colours × a baked lightmap (walls/floor, and props)
//   *_Emit                  vertex colours only (sky, screens, glowing rings)
// Everything is unlit: the lighting is in the lightmaps, so a set costs 3 draw calls and no lights.
// The set shares the avatar's world: origin = where the avatar stands, +Z toward the camera.

const LM_SCALE = 2.5;          // lightmaps store irradiance / 2.5, sRGB-encoded
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const textures = new THREE.TextureLoader();

function lightmap(url) {
  return textures.loadAsync(url).then((t) => {
    t.flipY = false;               // glTF UV convention
    t.colorSpace = THREE.SRGBColorSpace;
    t.channel = 0;                 // the meshes carry a single UV set: the lightmap's
    return t;
  });
}

const smooth = (t) => t * t * (3 - 2 * t);

// The set stage: a second, opaque WebGL canvas under the washes and the avatar's canvas, so every
// layer above it stays as it was. A set never moves, so this canvas is redrawn only when the
// camera, the canvas size or the set changes; between camera moves it costs nothing.
// Changing sets crossfades in 3D: the outgoing set is drawn into a texture and faded out over the
// incoming one, both following the camera, so the stage is never empty.
export class SetStage {
  constructor(canvas, camera) {
    this.camera = camera;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor('#F2F4F9');
    this.scene = new THREE.Scene();          // the set on stage
    this.outgoing = new THREE.Scene();       // the set fading out during a change
    this.sets = new Map();                   // name → Promise<Group>, ready to draw
    this.shown = null;                       // name of the set on stage
    this.fade = null;                        // { start, duration } (ms) while crossfading
    this.target = null;                      // the outgoing set's frame during a crossfade
    this.overlay = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }),
    );
    this.overlay.frustumCulled = false;
    this.overlayScene = new THREE.Scene().add(this.overlay);
    this.screen = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.size = new THREE.Vector2();
    this.dirty = true;
    this.view = new Float64Array(32);        // camera matrices at the last draw
  }

  // Loads a set and puts its textures and shaders on the GPU up front, so its first frame on
  // stage doesn't stall.
  load(name) {
    if (!this.sets.has(name)) {
      this.sets.set(name, loadSet(name).then(async (set) => {
        set.traverse((o) => o.material?.lightMap && this.renderer.initTexture(o.material.lightMap));
        await this.renderer.compileAsync(set, this.camera, this.scene);
        return set;
      }));
    }
    return this.sets.get(name);
  }

  // Puts a loaded set on stage, crossfading from the current one over `seconds` (0 = cut).
  async show(name, seconds = 0) {
    const set = await this.load(name);
    const current = this.scene.children[0];
    if (current === set) return;
    this.outgoing.clear();
    if (current && seconds > 0) {
      this.outgoing.add(current);            // re-parents it out of the stage scene
      this.fade = { start: performance.now(), duration: seconds * 1000 };
    } else {
      this.scene.clear();
      this.fade = null;
    }
    this.scene.add(set);
    this.shown = name;
    this.dirty = true;
  }

  setSize(w, h, dpr) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.dirty = true;
  }

  render() {
    if (!this.shown) return;
    const cam = this.camera;
    cam.updateMatrixWorld();
    const v = this.view;
    let moved = false;
    for (let i = 0; i < 16; i++) {
      const a = cam.matrixWorld.elements[i];
      const b = cam.projectionMatrix.elements[i];
      if (v[i] !== a || v[16 + i] !== b) moved = true;
      v[i] = a;
      v[16 + i] = b;
    }
    if (!moved && !this.dirty && !this.fade) return;
    const r = this.renderer;
    const k = this.fade ? Math.min(1, (performance.now() - this.fade.start) / this.fade.duration) : 1;
    if (k >= 1) {
      if (this.fade) {
        this.fade = null;
        this.outgoing.clear();
      }
      r.render(this.scene, cam);
    } else {
      r.getDrawingBufferSize(this.size);
      if (!this.target) {
        // sRGB 8-bit: full precision where it shows, and supported on every WebGL2 device
        this.target = new THREE.WebGLRenderTarget(this.size.x, this.size.y, { samples: 4, colorSpace: THREE.SRGBColorSpace });
        this.overlay.material.map = this.target.texture;
        this.overlay.material.needsUpdate = true;
      } else if (this.target.width !== this.size.x || this.target.height !== this.size.y) {
        this.target.setSize(this.size.x, this.size.y);
      }
      r.setRenderTarget(this.target);
      r.render(this.outgoing, cam);
      r.setRenderTarget(null);
      r.render(this.scene, cam);
      this.overlay.material.opacity = 1 - smooth(k);
      r.autoClear = false;
      r.render(this.overlayScene, this.screen);
      r.autoClear = true;
    }
    this.dirty = false;
  }
}

export async function loadSet(name, base = '/sets') {
  const dir = `${base}/${name}`;
  const [gltf, big, detail] = await Promise.all([
    loader.loadAsync(`${dir}/set.glb`),
    lightmap(`${dir}/lm_big.webp`),
    lightmap(`${dir}/lm_detail.webp`),
  ]);
  const set = gltf.scene;
  set.name = `set:${name}`;
  set.traverse((o) => {
    if (!o.isMesh) return;
    const map = /LitBig/.test(o.name) ? big : /LitDetail/.test(o.name) ? detail : null;
    // MeshBasicMaterial adds lightMap × intensity / π to the diffuse term
    o.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      ...(map ? { lightMap: map, lightMapIntensity: Math.PI * LM_SCALE } : {}),
    });
    o.matrixAutoUpdate = false;
    o.updateMatrix();
  });
  return set;
}
