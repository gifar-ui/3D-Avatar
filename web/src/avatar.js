import * as THREE from 'three';

// Animation for a VRM 1.0 avatar, layered every frame:
//   1. body clips   - Mixamo walk / idle via AnimationMixer (cross-faded)
//   2. gestures     - present (either hand, open palm; repeats at random while talking), wave, nod
//   3. attention    - head/neck follow the pointer (not while talking), or glance around
//   4. face         - blink, friendly smile, vowel mouth shapes

const VOWELS = ['aa', 'ih', 'ou', 'ee', 'oh'];

// Friendly face built from VRoid's per-feature shape keys (the "happy" preset
// squints the eyes shut, so it isn't used). `warm` is the resting smile with
// eyes open; `beam` is a brighter open smile for greetings.
const WARM = { Fcl_MTH_Fun: 0.5, Fcl_BRW_Fun: 0.45 };
const BEAM = { Fcl_MTH_Joy: 0.45, Fcl_BRW_Joy: 0.45, Fcl_EYE_Joy: 0.2 };
const FACE_MORPHS = [...new Set([...Object.keys(WARM), ...Object.keys(BEAM)])];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const smootherstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
const rand = (a, b) => a + Math.random() * (b - a);

// "Present" pose: one hand raised in front at chest height, palm open and up.
// Solved for a hand ~27 cm out, 23 cm forward of the body (left-side values;
// mirrored for the right arm). `tw` turns the palm up about the forearm axis.
const PRESENT = { ua: [-0.5, 0.4, -0.82], la: [0, -1.35, -0.6], tw: -1.0 };
// hold is random in [min, max] s; release = how fast a raised hand drops when the audio stops
const PRESENT_TIMING = { rise: 0.6, hold: [1.2, 2.8], fall: 0.8, release: 0.4 };
// While talking: a present gesture every so often, timed at random so it doesn't read as a loop.
const TALK = {
  gap: [1.4, 4.2],       // pause after a gesture ends before the next one may start (s)
  switchSide: 0.65,      // chance the next gesture uses the other hand
  nod: 0.4,              // chance a repeat gesture also nods (the opening one always does)
};
// Wave: arm up (overlapping with the first swings), ~3 swings at ~2 Hz, arm down.
const WAVE_TIMING = { rise: 0.45, fall: 0.6, length: 2.6 };
const WAVE = {
  upperArm: [-0.1, 0.4, 0.8], // elbow beside the chest (right-arm values)
  lean: 0.1,                  // forearm leans out from vertical (radians)
  swing: 0.2,                 // forearm swing about the elbow
  wrist: 0.26,                // wrist follow-through, lagging the forearm
  freq: 12.5,                 // rad/s (~2 waves per second)
};
// Open hand: straight fingers, slightly fanned (index toward the thumb side).
const FAN = { Index: 0.12, Middle: 0.03, Ring: -0.06, Little: -0.15 };

const _q = new THREE.Quaternion();
const _twist = new THREE.Quaternion();
const _e = new THREE.Euler();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const setFromEuler = (x, y, z) => _q.setFromEuler(_e.set(x, y, z));
const _m = new THREE.Matrix4();
const _pq = new THREE.Quaternion();
const _fq = new THREE.Quaternion();
const _hq = new THREE.Quaternion();
const _rq = new THREE.Quaternion();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _vx = new THREE.Vector3();
const _vy = new THREE.Vector3();
const _vz = new THREE.Vector3();

export class AvatarRig {
  constructor(vrm, clips) {
    this.vrm = vrm;
    this.root = vrm.scene;
    const get = (n) => vrm.humanoid.getNormalizedBoneNode(n);
    this.bone = (n) => get(n);
    this.b = {};
    for (const n of ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
      'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand']) this.b[n] = get(n);
    this.fingers = [];
    for (const side of ['left', 'right']) {
      for (const f of ['Index', 'Middle', 'Ring', 'Little']) {
        for (const seg of ['Proximal', 'Intermediate', 'Distal']) {
          const node = get(`${side}${f}${seg}`);
          if (node) this.fingers.push({ node, m: side === 'left' ? 1 : -1, f, seg });
        }
      }
    }
    this.rightThumb = ['Metacarpal', 'Proximal', 'Distal'].map((s) => get(`rightThumb${s}`)).filter(Boolean);

    // body clips
    this.mixer = new THREE.AnimationMixer(this.root);
    this.walk = this.mixer.clipAction(clips.walk);
    this.idle = this.mixer.clipAction(clips.idle);
    this.walk.play();
    this.idle.play();
    this.walkW = 0;
    this.walkTarget = 0;
    this.travel = null;          // { toX, speed, resolve }

    this.time = 0;
    // attention
    this.pointer = null;
    this.pointerAt = -99;
    this.look = { yaw: 0, pitch: 0 };
    this.glance = { yaw: 0, pitch: 0 };
    this.nextGlanceAt = rand(3, 6);
    // gestures
    this.gesture = null;
    this.nodPulse = null;
    this.talking = false;
    this.nextTalkAt = null;        // time of the next talking gesture; set once the previous one ends
    this.lastSide = null;
    // face
    this.nextBlink = rand(1, 3);
    this.blinkStart = -1;
    this.warm = 0;
    this.beam = 0;
    this.beamTarget = 0;
    this.beamUntil = 0;
    this.blinkW = 0;
    this.morphs = [];             // [{ influences, index: {name: i} }] for meshes with face shape keys
    this.root.traverse((o) => {
      const dict = o.morphTargetDictionary;
      if (!dict || !FACE_MORPHS.some((n) => n in dict)) return;
      this.morphs.push({ influences: o.morphTargetInfluences, index: dict });
    });
    this.mouth = Object.fromEntries(VOWELS.map((v) => [v, 0]));
    this.vowelQueue = [];
  }

  // ---------- public API ----------

  // Walk in from `fromX` to `toX` (world X), then turn to face the camera.
  enter(fromX, toX = 0, speed = 0.92) {
    return this.walkTo(toX, { from: fromX, speed });
  }

  // Walk to world X `toX`, then turn to face the camera.
  //   from: start there already mid-stride, facing the walk (for entering from off-screen)
  //   exit: keep full pace through the mark and don't turn (for leaving the frame); the
  //         stride carries on, so a following walkTo({ from }) continues seamlessly
  // A new walk replaces one in progress; the old promise resolves (false) so its caller can bail.
  walkTo(toX, { from, exit = false, speed = 0.92 } = {}) {
    this.travel?.resolve(false);
    this.travel = null;
    const x = from ?? this.root.position.x;
    const dir = Math.sign(toX - x) || 1;
    if (from !== undefined) {
      this.root.position.x = from;
      this.root.rotation.y = dir * Math.PI / 2;
      this.springsReset = true;
      if (this.walkW < 0.5) this.walk.time = 0;
      this.walkW = this.walkTarget = 1;
    } else if (Math.abs(toX - x) < 0.01) {
      this.root.position.x = toX;
      return Promise.resolve(true);
    } else {
      this.walkTarget = 1;
    }
    this.walk.timeScale = speed / 0.92;  // the clip's stride matches ~0.92 m/s; keep the feet in step
    return new Promise((resolve) => (this.travel = { toX, dir, speed, exit, resolve }));
  }

  // Stand at world X right away, facing the camera (reduced motion, resize).
  place(x) {
    this.travel?.resolve(false);
    this.travel = null;
    this.root.position.x = x;
    this.root.rotation.y = 0;
    this.walkW = this.walkTarget = 0;
    this.springsReset = true;
  }

  get walking() {
    return this.travel !== null;
  }

  // One-shot: raise one hand with an open palm, hold for a random while, lower.
  // side: 'left' | 'right'; by default picked at random, leaning toward the other hand than last time.
  present({ side, nod = true } = {}) {
    if (this.walking) return;
    if (!side) {
      const other = this.lastSide === 'left' ? 'right' : 'left';
      side = this.lastSide && Math.random() > TALK.switchSide ? this.lastSide : other;
      if (!this.lastSide) side = Math.random() < 0.5 ? 'left' : 'right';
    }
    this.lastSide = side;
    const { rise, hold, fall } = PRESENT_TIMING;
    const held = rand(hold[0], hold[1]);
    this.gesture = { name: 'present', start: this.time, length: rise + held + fall, hold: held, side, nodded: !nod };
    this.smile(1, rise + held);
  }
  // While on, present gestures repeat at random times and with either hand.
  // Turning it off (audio paused, stopped or ended) lowers a raised hand right away.
  setTalking(on) {
    if (on === this.talking) return;
    this.talking = on;
    this.nextTalkAt = null;
    const g = this.gesture;
    if (!on && g?.name === 'present' && !g.release) {
      const k = this.time - g.start;
      g.release = { k, w: this.#presentWeight(g, k) };
      g.length = k + PRESENT_TIMING.release;
    }
  }

  setPointer(x, y) {
    this.pointer = { x, y };
    this.pointerAt = this.time;
  }
  clearPointer() {
    this.pointer = null;
  }
  // Walking in or mid-gesture: viewer-triggered gestures wait until this is false.
  get busy() {
    return this.walking || this.gesture !== null;
  }
  // Returns false (and does nothing) while busy, so repeated clicks can't restart the wave.
  wave() {
    if (this.busy) return false;
    this.gesture = { name: 'wave', start: this.time, length: WAVE_TIMING.length };
    this.smile(1, WAVE_TIMING.length + 0.4);
    return true;
  }
  nod(strength = 0.12) {
    this.nodPulse = { start: this.time, length: 0.9, strength };
  }
  // True while a smile() is still held (greeting, gesture): a lighter smile shouldn't cut it short.
  get smiling() {
    return this.time < this.beamUntil;
  }
  // Brighter, open smile for a while (greetings); the warm resting smile stays underneath.
  smile(amount = 1, seconds = 2.5) {
    this.beamTarget = clamp(amount, 0, 1);
    this.beamUntil = this.time + seconds;
  }
  // Per-frame mouth weights {aa, ih, ou, ee, oh} from LipSync, or null to release the mouth.
  setMouth(weights) {
    this.lipTarget = weights;
  }
  sayVowel(vowel, duration = 0.45) {
    this.vowelQueue = [{ vowel, until: this.time + duration }];
  }
  sayVowels(vowels, each = 0.32) {
    let t = this.time;
    this.vowelQueue = vowels.map((vowel) => ({ vowel, until: (t += each) }));
  }

  // ---------- frame ----------
  update(dt) {
    this.time += dt;
    const t = this.time;

    this.#locomotion(dt);
    this.walk.setEffectiveWeight(this.walkW);
    this.idle.setEffectiveWeight(1 - this.walkW);
    this.mixer.update(dt);

    const standing = 1 - this.walkW;
    this.#gesture(t);
    this.#attention(t, dt, standing);
    this.#face(t, dt);
    this.vrm.update(dt);
    // a jump in place (entering from the other edge already turned the other way, or a placement)
    // would read to the hair and the tie as a violent jerk and fling them; they start from rest instead
    if (this.springsReset) {
      this.springsReset = false;
      this.vrm.springBoneManager?.reset();
    }
    this.#friendlyFace();
  }

  // ---------- layers ----------
  #locomotion(dt) {
    const tr = this.travel;
    if (!tr) {
      this.walkW = lerp(this.walkW, 0, damp(dt, 5));
      return;
    }
    const x = this.root.position.x;
    const remaining = (tr.toX - x) * tr.dir;
    if (tr.exit) {
      // leaving the frame: full pace, still facing the walk, done once past the mark
      this.walkTarget = 1;
      this.walkW = lerp(this.walkW, 1, damp(dt, 4));
      this.root.position.x += tr.dir * tr.speed * this.walkW * dt;
      this.root.rotation.y = lerp(this.root.rotation.y, tr.dir * Math.PI / 2, damp(dt, 8));
      if (remaining <= 0) {
        this.travel = null;
        tr.resolve(true);
      }
      return;
    }
    // start slowing ~one stride before the mark, then turn to the camera
    if (remaining < 0.26) this.walkTarget = 0;
    this.walkW = lerp(this.walkW, this.walkTarget, damp(dt, 4));
    this.root.position.x += tr.dir * tr.speed * this.walkW * dt;
    if (this.walkW < 0.35) this.root.position.x = lerp(this.root.position.x, tr.toX, damp(dt, 3));
    const yawGoal = this.walkTarget ? tr.dir * Math.PI / 2 : 0;
    this.root.rotation.y = lerp(this.root.rotation.y, yawGoal, damp(dt, this.walkTarget ? 8 : 3.2));
    if (this.walkW < 0.02 && Math.abs(this.root.rotation.y) < 0.01 && Math.abs(tr.toX - this.root.position.x) < 0.005) {
      this.root.position.x = tr.toX;
      this.root.rotation.y = 0;
      this.walkW = 0;
      this.travel = null;
      tr.resolve(true);
    }
  }

  #gesture(t) {
    this.#talkGestures(t);
    const g = this.gesture;
    if (!g) return;
    const k = t - g.start;
    if (k > g.length) {
      this.gesture = null;
      return;
    }
    if (g.name === 'present') this.#present(g, k);
    else if (g.name === 'wave') this.#wave(g, k);
  }

  // Talking: after each gesture ends, wait a random gap, then present again (if still talking).
  #talkGestures(t) {
    if (!this.talking || this.walking) return;
    if (this.gesture) {
      this.nextTalkAt = null;
      return;
    }
    if (this.nextTalkAt === null) this.nextTalkAt = t + rand(TALK.gap[0], TALK.gap[1]);
    else if (t >= this.nextTalkAt) {
      this.nextTalkAt = null;
      this.present({ nod: Math.random() < TALK.nod });
    }
  }

  #presentWeight(g, k) {
    const { rise, release } = PRESENT_TIMING;
    if (g.release) return g.release.w * (1 - smoothstep(g.release.k, g.release.k + release, k));
    return smoothstep(0, rise, k) * (1 - smoothstep(rise + g.hold, g.length, k));
  }

  #present(g, k) {
    const { rise } = PRESENT_TIMING;
    const w = this.#presentWeight(g, k);
    if (!g.nodded && !g.release && k >= rise) {
      g.nodded = true;
      this.nod(0.07);
    }
    // gentle drift while held so the pose isn't frozen
    const drift = Math.sin(k * 2.0) * 0.05 * smoothstep(rise, rise + 0.4, k);
    const m = g.side === 'left' ? 1 : -1;           // values are left-side; mirror for the right arm
    const s = g.side;
    const { ua, la, tw } = PRESENT;
    this.b[`${s}UpperArm`].quaternion.slerp(setFromEuler(ua[0] + drift * 0.5, m * ua[1], m * ua[2]), w);
    // bend, then twist about the forearm's own axis so the palm opens upward
    // (a mirrored rotation keeps its X component and flips Y/Z, hence no `m` on the twist)
    setFromEuler(0, m * (la[1] + drift), m * la[2]).multiply(_twist.setFromAxisAngle(X_AXIS, tw));
    this.b[`${s}LowerArm`].quaternion.slerp(_q, w);
    this.b[`${s}Hand`].quaternion.slerp(setFromEuler(-0.1, m * -0.15, m * 0.05), w);
    for (const f of this.fingers) if (f.m === m) f.node.quaternion.slerp(setFromEuler(0, 0, -f.m * 0.1), w);
    // turn the chest slightly toward the open hand, tilt the head a little
    this.b.chest?.quaternion.multiply(setFromEuler(0, 0.06 * m * w, 0));
    this.b.head.quaternion.multiply(setFromEuler(0, 0, 0.04 * m * w));
  }

  // Friendly wave with an open palm facing the viewer. The forearm and hand are
  // oriented in world space (palm toward the avatar's front, fingers up), then
  // converted to local rotations; the swing pivots at the elbow and the wrist
  // follows a beat later, so the hand flaps loosely instead of moving as a board.
  #wave(g, k) {
    const { rise, fall } = WAVE_TIMING;
    const w = smootherstep(0, rise, k) * (1 - smootherstep(g.length - fall, g.length, k));
    // swings start while the arm is still rising and fade as it comes down
    const env = smoothstep(rise * 0.4, rise + 0.25, k) * (1 - smoothstep(g.length - fall - 0.5, g.length - fall * 0.3, k));
    const ph = (k - rise * 0.4) * WAVE.freq;
    const swing = Math.sin(ph) * WAVE.swing * env;
    const wrist = Math.sin(ph - 1.1) * WAVE.wrist * env;
    // the first swing overshoots a little on the way up (anticipation/overshoot)
    const settle = Math.sin(clamp(k / rise, 0, 1) * Math.PI) * 0.12;

    // body: lean slightly into the wave, small sway with the swings
    this.b.chest?.quaternion.multiply(setFromEuler(0, -0.05 * w, Math.sin(ph) * 0.012 * env));
    this.b.head.quaternion.multiply(setFromEuler(Math.sin(ph * 0.5) * 0.015 * w, 0, 0.08 * w));

    // upper arm: elbow beside the chest; counter-moves a touch against the swing
    const ua = WAVE.upperArm;
    this.b.rightUpperArm.quaternion.slerp(setFromEuler(ua[0], ua[1], ua[2] - swing * 0.18 + settle * 0.5), w);

    // world frame of the avatar
    this.root.getWorldQuaternion(_rq);
    _fwd.set(0, 0, 1).applyQuaternion(_rq);          // toward the viewer
    _up.set(0, 1, 0).applyQuaternion(_rq);

    // forearm: points up, leaning out (rotation about the forward axis tips it toward
    // the avatar's right), palm (local -Y at rest) faces forward
    _dir.copy(_up).applyAxisAngle(_fwd, WAVE.lean + settle + swing);
    this.#orientRightLimb(_fq, _dir, _fwd);
    const fore = this.b.rightLowerArm;
    fore.parent.getWorldQuaternion(_pq);
    fore.quaternion.slerp(_pq.invert().multiply(_fq), w);

    // hand: same frame, rotated further by the lagging wrist
    _dir.copy(_up).applyAxisAngle(_fwd, WAVE.lean + settle + swing + wrist);
    this.#orientRightLimb(_hq, _dir, _fwd);
    fore.getWorldQuaternion(_pq);
    this.b.rightHand.quaternion.slerp(_pq.invert().multiply(_hq), w);

    // open hand: fingers straight and slightly fanned, thumb relaxed open
    for (const f of this.fingers) {
      if (f.m !== -1) continue;
      const fan = f.seg === 'Proximal' ? FAN[f.f] : 0;
      f.node.quaternion.slerp(setFromEuler(0, fan, f.seg === 'Proximal' ? 0 : 0.05), w);
    }
    for (const t of this.rightThumb) t.quaternion.slerp(_q.identity(), w);
  }

  // Right arm segments rest along -X with the palm facing -Y and the thumb +Z.
  // Build the world rotation that sends -X -> dir and -Y -> palm (orthogonalized).
  #orientRightLimb(out, dir, palm) {
    _vx.copy(dir).negate();
    _vy.copy(palm).addScaledVector(dir, -palm.dot(dir)).normalize().negate();
    _vz.crossVectors(_vx, _vy);
    _m.makeBasis(_vx, _vy, _vz);
    return out.setFromRotationMatrix(_m);
  }

  #attention(t, dt, standing) {
    if (t >= this.nextGlanceAt) {
      const away = Math.random() < 0.45 && !this.gesture;
      this.glance = away ? { yaw: rand(-0.45, 0.45), pitch: rand(-0.12, 0.08) } : { yaw: 0, pitch: 0 };
      this.nextGlanceAt = t + (away ? rand(1.2, 2.5) : rand(3, 6));
    }
    if (t >= this.beamUntil) this.beamTarget = 0;

    // while talking the head ignores the cursor: it stays on the viewer with only small glances
    const follow = !this.talking && this.pointer && t - this.pointerAt < 4;
    const g = this.talking ? 0.35 : 1;
    const want = follow
      ? { yaw: clamp(this.pointer.x * 0.55, -0.6, 0.6), pitch: clamp(-this.pointer.y * 0.3, -0.25, 0.3) }
      : { yaw: this.glance.yaw * g, pitch: this.glance.pitch * g };
    const rate = follow ? 6 : 2.5;
    this.look.yaw = lerp(this.look.yaw, want.yaw * standing, damp(dt, rate));
    this.look.pitch = lerp(this.look.pitch, want.pitch * standing, damp(dt, rate));

    let nod = 0;
    if (this.nodPulse) {
      const p = this.nodPulse;
      const k = (t - p.start) / p.length;
      if (k >= 1) this.nodPulse = null;
      else nod = Math.sin(k * Math.PI * 2) * p.strength * Math.sin(k * Math.PI);
    }
    this.b.neck.quaternion.multiply(setFromEuler(this.look.pitch * 0.4, this.look.yaw * 0.4, 0));
    // a slight, friendly head tilt while standing
    this.b.head.quaternion.multiply(setFromEuler(this.look.pitch * 0.6 + nod, this.look.yaw * 0.6, 0.045 * standing));
  }

  #face(t, dt) {
    const em = this.vrm.expressionManager;
    if (!em) return;
    if (this.blinkStart < 0 && t >= this.nextBlink) this.blinkStart = t;
    let blink = 0;
    if (this.blinkStart >= 0) {
      const k = (t - this.blinkStart) / 0.16;
      blink = k < 0.4 ? k / 0.4 : Math.max(0, 1 - (k - 0.4) / 0.6);
      if (k >= 1) {
        this.blinkStart = -1;
        this.nextBlink = t + (Math.random() < 0.15 ? 0.12 : rand(2, 5.5));
      }
    }
    this.blinkW = blink;
    em.setValue('blink', blink);
    while (this.vowelQueue.length && this.vowelQueue[0].until <= t) this.vowelQueue.shift();
    const active = this.vowelQueue[0]?.vowel;
    const lip = this.lipTarget;                 // detailed lip-sync weights, when audio is speaking
    for (const v of VOWELS) {
      const target = lip ? (lip[v] ?? 0) : (v === active ? 1 : 0);
      // fast attack, slightly slower release: crisp consonant closures without jitter
      const rate = lip ? (target > this.mouth[v] ? 38 : 26) : 18;
      this.mouth[v] = lerp(this.mouth[v], target, damp(dt, rate));
      em.setValue(v, this.mouth[v]);
    }
    this.warm = lerp(this.warm, 1, damp(dt, 1.5));
    this.beam = lerp(this.beam, this.beamTarget, damp(dt, 4));
  }

  // Runs after vrm.update(): these shape keys aren't bound to VRM expressions,
  // so they're written directly. Speaking and blinking take priority.
  #friendlyFace() {
    const talking = Math.min(1, VOWELS.reduce((s, v) => s + this.mouth[v], 0));
    const mouthKeep = 1 - talking * 0.75;
    const values = {};
    for (const [name, v] of Object.entries(WARM)) values[name] = v * this.warm * (1 - this.beam);
    for (const [name, v] of Object.entries(BEAM)) values[name] = (values[name] ?? 0) + v * this.beam;
    values.Fcl_MTH_Fun *= mouthKeep;
    values.Fcl_MTH_Joy *= mouthKeep;
    values.Fcl_EYE_Joy *= 1 - this.blinkW;
    for (const { influences, index } of this.morphs) {
      for (const [name, v] of Object.entries(values)) {
        const i = index[name];
        if (i !== undefined) influences[i] = v;
      }
    }
  }
}
