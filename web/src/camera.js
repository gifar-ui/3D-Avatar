import * as THREE from 'three';
import { gsap } from 'gsap';

// Frames the avatar for a named shot ("full" / "half") and tweens between shots.
// Each shot is measured from the avatar's bones, so it adapts to the model.
// Where the shot sits on screen comes from `layoutFn(name)`, which returns the shot's
// centre (x, y), height (h) and max width (w) as fractions of the viewport.
// A move blends between the two shots' live poses, so a resize mid-move re-frames both ends.

export class CameraDirector {
  constructor(camera, vrm, layoutFn) {
    this.camera = camera;
    this.layoutFn = layoutFn;
    this.target = new THREE.Vector3();
    this.shotName = 'full';
    this.move = null;                      // { from, to, k } while a GSAP tween runs

    vrm.scene.updateMatrixWorld(true);
    const y = (name) => vrm.humanoid.getNormalizedBoneNode(name).getWorldPosition(new THREE.Vector3()).y;
    const head = y('head');
    const hips = y('hips');
    this.topY = head + 0.26;               // head bone sits at the skull base; add the hair

    this.shots = {
      full: { bottom: -0.04, top: this.topY + 0.04, width: 0.75 },
      half: { bottom: hips - 0.07, top: this.topY + 0.05, width: 0.62 },   // cut at the belt
    };
  }

  pose(name) {
    const cam = this.camera;
    const s = this.shots[name];
    const l = this.layoutFn(name);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const height = s.top - s.bottom;
    const dist = Math.max(
      height / l.h / 2 / tanV,
      s.width / l.w / 2 / (tanV * cam.aspect),
    );
    const visH = 2 * dist * tanV;
    const visW = visH * cam.aspect;
    const centerY = (s.top + s.bottom) / 2;
    const target = new THREE.Vector3((0.5 - l.x) * visW, centerY - (0.5 - l.y) * visH, 0);
    const position = target.clone().add(new THREE.Vector3(0, 0, dist));
    return { position, target };
  }

  // Visible width (m) at the avatar's depth for a shot.
  shotWidth(name) {
    const p = this.pose(name);
    return 2 * (p.position.z - p.target.z) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
  }

  // World X just outside the left edge of the full-body shot (walk-in start).
  offscreenX() {
    return this.pose('full').target.x - this.shotWidth('full') / 2 - 0.45;
  }

  // World X at the middle of the current shot.
  centerX() {
    return this.pose(this.shotName).target.x;
  }

  // World X just outside the current shot's left (dir -1) or right (dir +1) edge.
  edgeX(dir) {
    return this.pose(this.shotName).target.x + dir * (this.shotWidth(this.shotName) / 2 + 0.45);
  }

  // Jump to the current shot (load, resize); mid-move, re-frame the move instead.
  snap() {
    if (this.move) return this.#frame();
    const p = this.pose(this.shotName);
    this.camera.position.copy(p.position);
    this.target.copy(p.target);
    this.camera.lookAt(this.target);
  }

  // Returns the GSAP tween, so it can be awaited or nested in a timeline. Played backwards to its
  // start (a cancelled move), it hands the shot back to where the move began.
  go(name, duration = 1.6) {
    const move = { from: this.shotName, to: name, k: 0 };
    this.shotName = name;
    this.move = move;
    return gsap.to(move, {
      k: 1,
      duration,
      ease: 'power2.inOut',                // cubic in-out
      onUpdate: () => this.move === move && this.#frame(),
      onComplete: () => this.move === move && (this.move = null),
      onReverseComplete: () => {
        if (this.move !== move) return;
        this.shotName = move.from;
        this.move = null;
      },
    });
  }

  #frame() {
    const { from, to, k } = this.move;
    const a = this.pose(from);
    const b = this.pose(to);
    this.camera.position.lerpVectors(a.position, b.position, k);
    this.target.lerpVectors(a.target, b.target, k);
    this.camera.lookAt(this.target);
  }
}
