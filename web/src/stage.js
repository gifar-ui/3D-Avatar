import * as THREE from 'three';

// Layout of the page around the 3D avatar.
//
// Wide screens reproduce the reference composition: a 1440×720 "frame" scaled to the
// viewport (k). Boxes and positions scale with k; text scales with ks, which is clamped
// so it never gets too small to read. Narrow or tall screens use the compact layout.

const DESIGN_W = 1440;
const DESIGN_H = 720;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function measureLayout(vw, vh) {
  const wide = vw >= 1200 && vw / vh >= 1.25;
  const k = clamp(Math.min(vw / DESIGN_W, vh / DESIGN_H), 0.83, 1.3);
  const fw = DESIGN_W * k;
  const fh = DESIGN_H * k;
  return {
    mode: wide ? 'wide' : 'compact',
    vw, vh, k, ks: clamp(k, 0.92, 1.2),
    fw, fh, fx: (vw - fw) / 2, fy: Math.max(0, (vh - fh) / 2),
  };
}

export function applyLayout(L) {
  const root = document.documentElement;
  root.dataset.layout = L.mode;
  const s = root.style;
  s.setProperty('--k', L.k.toFixed(4));
  s.setProperty('--ks', L.ks.toFixed(4));
  s.setProperty('--fx', `${L.fx.toFixed(1)}px`);
  s.setProperty('--fy', `${L.fy.toFixed(1)}px`);
}

// Half-body detail, wide layout: where the avatar stands on the 1440-wide frame.
//   left  (About, Projects):  AVATAR · content
//   right (Skills, Journey):  content · AVATAR
// Either way the pair sits about centred, with ≈120 px between the avatar's arms and the content.
// The camera always frames the left spot; the right spot is reached by moving the avatar
// in the world, so switching sides never jumps the camera or the backdrop.
export const HALF_X = { left: 0.33, right: 0.66 };

// World X offset of the avatar's resting spot for a side, given the half shot's visible width (m).
export function sideOffset(L, side, visibleWidth) {
  if (L.mode !== 'wide' || side !== 'right') return 0;
  return ((HALF_X.right - HALF_X.left) * L.fw / L.vw) * visibleWidth;
}

// Where a camera shot sits on screen (fractions of the viewport), found by pinning
// the top of the hair and the shot's base (feet, or the half-body cut) to anchors.
export function shotLayout(L, name, shots, topY) {
  const s = shots[name];
  let x, headFrac, baseFrac, baseY;
  if (L.mode === 'wide') {
    const fx = (f) => (L.fx + f * L.fw) / L.vw;
    const fy = (f) => (L.fy + f * L.fh) / L.vh;
    if (name === 'full') { x = fx(0.5); headFrac = fy(0.111); baseFrac = fy(0.889); baseY = 0; }
    else { x = fx(HALF_X.left); headFrac = fy(0.12); baseFrac = fy(1.0); baseY = s.bottom; }
  } else {
    x = 0.5;
    if (name === 'full') {
      headFrac = Math.max(0.1, 88 / L.vh);                // no hero text above: the avatar can be larger
      baseFrac = Math.min(0.72, (L.vh - 272) / L.vh);     // feet just above the name plate
      baseY = 0;
      // the backdrop scales with the avatar; keep its ring inside the screen width,
      // as on desktop, and spend part of the spare height lifting the avatar off the cards
      const maxH = (0.96 * L.vw) / RING_PER_AVATAR / L.vh;
      const spare = baseFrac - headFrac - maxH;
      if (spare > 0) {
        baseFrac -= spare * 0.15;
        headFrac = baseFrac - maxH;
      }
    } else {
      headFrac = Math.max(0.15, 120 / L.vh);
      baseFrac = 0.56;
      baseY = s.bottom;
    }
  }
  const m = (baseFrac - headFrac) / (topY - baseY);     // viewport fraction per metre
  const top = headFrac - (s.top - topY) * m;
  const bottom = baseFrac + (baseY - s.bottom) * m;
  return { x, y: (top + bottom) / 2, h: bottom - top, w: 0.95 };
}

// Keeps background-avatar.png's podium under the avatar's resting spot (world origin)
// and scales it with the avatar, so the backdrop moves with the camera like a set.
const IMG_W = 1536;
const IMG_H = 1024;
const PODIUM = { x: 768, y: 765 };      // podium centre in the image (px)
const CHAR_PX = 572;                    // avatar height the image was composed for
const RING_PX = 782;                    // diameter of the image's large ring
const RING_PER_AVATAR = RING_PX / CHAR_PX;

export class Backdrop {
  constructor(imgs, camera) {
    this.imgs = imgs;                    // the sharp image and its pre-blurred copy, moved together
    this.camera = camera;
    this.v = new THREE.Vector3();
    this.last = '';
  }

  // cover: scale/clamp so the image always fills the viewport (wide layout). Otherwise the
  // image stays locked to the avatar, so it sits in the ring on any screen shape; the
  // .backdrop gradient shows past the image's feathered edges.
  update(topY, vw, vh, cover = true) {
    const toPx = (y) => {
      this.v.set(0, y, 0).project(this.camera);
      return { x: (this.v.x + 1) / 2 * vw, y: (1 - this.v.y) / 2 * vh };
    };
    const feet = toPx(0);
    const head = toPx(topY);
    const charH = Math.max(1, feet.y - head.y);
    let s = charH / CHAR_PX;
    let left, top;
    if (cover) {
      s = Math.max(s, Math.max(vw / IMG_W, vh / IMG_H) * 1.01);
      left = clamp(feet.x - PODIUM.x * s, vw - IMG_W * s, 0);
      top = clamp(feet.y - PODIUM.y * s, vh - IMG_H * s, 0);
    } else {
      left = feet.x - PODIUM.x * s;
      top = feet.y - PODIUM.y * s;
    }
    const t = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
    if (t !== this.last) {
      for (const img of this.imgs) img.style.transform = t;
      this.last = t;
    }
  }
}
