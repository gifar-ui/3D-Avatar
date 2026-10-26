import * as THREE from 'three';
import { VRMSpringBoneJoint } from '@pixiv/three-vrm';

// The tie swings. The VRoid tie has no bones of its own (it is skinned to the chest, the belly and
// the hips, so it lies on the shirt whatever the torso does), so at load it gets a chain: the knot
// stays on the chest, and the blade below it hangs from four bones that run down its middle,
// simulated as VRM spring bones like the hair.
// A spring pulls each bone back toward a fixed direction from its parent, which for the tie would
// be "as at rest, from the upper chest": when the idle pose bends the back, a tie held that way
// stands off the belly. So every frame the chain's rest directions are aimed at where the original
// tie lies now (its middle line, skinned with the original weights), and the spring only adds the
// swing around that. Like the hair it is simulated in world space, so it has inertia: it trails
// when he sets off, swings out when he turns or stops, and settles back onto the shirt.
// A spring alone has no body to lie on and no limit: turning on the spot flung the blade up over
// the collar, and walking off it trailed back into the chest (the sphere colliders don't follow the
// shirt). So after each simulation step the blade is held to the shirt the way cloth would hold it:
// it may swing sideways along the shirt up to MAX_SWING, lift off it no more than MAX_LIFT (with
// more, every stride's bob floated the end of the blade off the shirt) and never sink into it, and
// bend no more than MAX_BEND between segments (each segment held on its own zig-zagged the blade);
// where it hits a limit it stops there (no bounce). The arm colliders keep it out of the arms.
// Done on the rest pose, before any animation (main.js init). Returns { update(seconds) }, called
// every frame before the rig updates, and { hold() }, after it (or null: no tie).

const KNOT_BELOW = 0.025;     // m below the top of the blade (where the knot ends) the chain starts
const BONES = 4;              // joints down the blade; the last one carries the tip
const SPRING = {
  hitRadius: 0,               // it lies on the shirt, at the colliders' surface: a radius held it 1–2 cm off
  stiffness: 0.85,            // back toward lying on the shirt: as the hair (0.7–0.95), so it moves like it
  gravityPower: 0.1,          // a little sag; more would pull it off the shirt where the torso leans
  gravityDir: new THREE.Vector3(0, -1, 0),
  dragForce: 0.35,            // how quickly a swing dies down (the hair: 0.4)
};
const COLLIDE_WITH = /UpperChest|Spine|Chest|UpperArm|LowerArm|Hand/;   // the body it rests on, the arms it swings past
const BREEZE = 0.06;          // rad: how far the slow drift turns the blade to the side
const MAX_SWING = THREE.MathUtils.degToRad(30);   // how far the blade may swing sideways, along the shirt
const MAX_LIFT = THREE.MathUtils.degToRad(6);     // and how far it may lift off the shirt (a walk barely lifts a tie)
const MAX_BEND = THREE.MathUtils.degToRad(20);    // how sharply one segment may turn from the one above
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const v = new THREE.Vector3();
const u = new THREE.Vector3();
const m = new THREE.Matrix4();
const head = new THREE.Vector3();
const tail = new THREE.Vector3();
const aim = new THREE.Vector3();
const out = new THREE.Vector3();
const q = new THREE.Quaternion();
const r = new THREE.Quaternion();
const above = new THREE.Vector3();
const across = new THREE.Vector3();
const ONE = new THREE.Quaternion();

export function addTieSpring(vrm) {
  let mesh = null;
  vrm.scene.traverse((o) => {
    if (o.isSkinnedMesh && [].concat(o.material).some((m) => /Accessory_Tie/.test(m.name))) mesh = o;
  });
  const chest = vrm.humanoid.getRawBoneNode('upperChest') ?? vrm.humanoid.getRawBoneNode('chest');
  if (!mesh || !chest) return null;

  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const world = (i) => v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);

  // The blade is the narrow part under the knot: find where the vertex rows stop being the knot
  // (many vertices per row) and become the blade (a few per row)
  const rows = new Map();
  let bottom = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = world(i).y;
    bottom = Math.min(bottom, y);
    const key = Math.round(y * 100);
    rows.set(key, (rows.get(key) ?? 0) + 1);
  }
  const keys = [...rows.keys()].sort((a, b) => b - a);
  const typical = [...rows.values()].sort((a, b) => a - b)[Math.floor(rows.size / 2)];
  const knotRow = keys.find((k, i) => rows.get(k) <= typical && keys.slice(i).every((kk) => rows.get(kk) <= typical));
  const top = knotRow / 100 - KNOT_BELOW;

  // The chain's joints down the middle of the blade, evenly spaced from under the knot to the tip
  const heights = Array.from({ length: BONES + 1 }, (_, i) => top - ((top - bottom) * i) / BONES);
  const centre = (y, band) => {
    const c = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(world(i).y - y) > band) continue;
      c.add(v);
      n++;
    }
    return n ? c.divideScalar(n).setY(y) : null;
  };
  // How the original tie is skinned along its middle line: the weights of the vertices around each
  // joint, averaged (indices into the original skeleton)
  const skin = mesh.skeleton;
  const index = geo.attributes.skinIndex;
  const weight = geo.attributes.skinWeight;
  const skinAround = (y, band) => {
    const sum = new Map();
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(world(i).y - y) > band) continue;
      for (let k = 0; k < 4; k++) {
        const w = weight.getComponent(i, k);
        if (w > 0) sum.set(index.getComponent(i, k), (sum.get(index.getComponent(i, k)) ?? 0) + w);
      }
    }
    const total = [...sum.values()].reduce((a, b) => a + b, 0);
    return [...sum].map(([b, w]) => ({ bone: skin.bones[b], inverse: skin.boneInverses[b], w: w / total }));
  };

  chest.updateWorldMatrix(true, false);
  const bones = [];
  const line = [];             // per joint: its rest position (bind, world) and the original skinning there
  let parent = chest;
  for (const y of heights) {
    const at = centre(y, 0.025) ?? centre(y, 0.06);
    line.push({ at: at.clone(), skin: skinAround(y, 0.025).length ? skinAround(y, 0.025) : skinAround(y, 0.06) });
    const bone = new THREE.Bone();
    bone.name = `J_Sec_Tie_${bones.length + 1}`;
    parent.add(bone);
    parent.updateWorldMatrix(true, false);
    bone.position.copy(parent.worldToLocal(at.clone()));
    bone.updateWorldMatrix(false, false);
    bones.push(bone);
    parent = bone;
  }

  // The blade's vertices move to the chain: each blends between the two joints it lies between
  // (all of the last joint below it); the knot keeps its own weights
  const first = skin.bones.length;
  for (let i = 0; i < pos.count; i++) {
    const y = world(i).y;
    if (y > top) continue;
    const s = Math.min(BONES - 1, Math.floor(((top - y) / (top - bottom)) * BONES));
    const f = THREE.MathUtils.clamp((heights[s] - y) / (heights[s] - heights[s + 1]), 0, 1);
    const last = s === BONES - 1;
    index.setXYZW(i, first + s, first + Math.min(s + 1, BONES - 1), 0, 0);
    weight.setXYZW(i, last ? 1 : 1 - f, last ? 0 : f, 0, 0);
  }
  index.needsUpdate = weight.needsUpdate = true;
  const inverses = bones.map((b) => b.matrixWorld.clone().invert());
  mesh.bind(new THREE.Skeleton([...skin.bones, ...bones], [...skin.boneInverses, ...inverses]), mesh.bindMatrix);

  // the spring: one joint per bone, each swinging its child (the last bone is only the tip). In world
  // space like the hair (avatar.js resets the springs when he is placed somewhere at once)
  const sbm = vrm.springBoneManager;
  const groups = sbm.colliderGroups.filter((g) => g.colliders.some((c) => COLLIDE_WITH.test(c.parent?.name ?? '')));
  const joints = [];
  for (let i = 0; i < BONES; i++) {
    const joint = new VRMSpringBoneJoint(bones[i], bones[i + 1], { ...SPRING, gravityDir: SPRING.gravityDir.clone() }, groups);
    sbm.addJoint(joint);
    joints.push(joint);
  }
  sbm.setInitState();

  // Each frame: where the original tie's middle line is now (skinned with the original weights,
  // from the bones as last posed), and each joint's rest direction aimed down it, in its parent's
  // frame. Standing still the body barely moves, and the tie with it, so a slow drift turns the
  // blade a little to the side and back, as from the air in the room: two out-of-step swells, a
  // few seconds each (never toward or off the shirt). Reduced motion: no drift.
  // The rest direction lives in the joint's _initialLocalRotation/_initialLocalMatrix (three-vrm
  // 3.5: the stiffness pulls toward parent x initial local rotation x bone axis).
  const now = line.map(() => new THREE.Vector3());
  const side = new THREE.Vector3();
  const front = new THREE.Vector3();
  const dir = new THREE.Vector3();
  // keeps `d` within the swing and the lift allowed from `aim` (`off`: off the shirt); true if it had to
  const onShirt = (d, aim, off) => {
    across.crossVectors(aim, off);
    const ahead = d.dot(aim);
    const lift = Math.atan2(d.dot(off), ahead);
    const sway = Math.atan2(d.dot(across), ahead);
    const lift2 = THREE.MathUtils.clamp(lift, 0, MAX_LIFT);
    const sway2 = THREE.MathUtils.clamp(sway, -MAX_SWING, MAX_SWING);
    if (lift2 === lift && sway2 === sway) return false;
    d.copy(aim).addScaledVector(across, Math.tan(sway2)).addScaledVector(off, Math.tan(lift2)).normalize();
    return true;
  };
  // turns `d` back toward `from` until it is at most `max` (rad) from it; true if it had to
  const limit = (d, from, max) => {
    const angle = d.angleTo(from);
    if (angle <= max) return false;
    q.setFromUnitVectors(from, d);
    d.copy(from).applyQuaternion(r.slerpQuaternions(ONE, q, max / angle));
    return true;
  };
  const lineNow = () => {
    for (let i = 0; i < line.length; i++) {
      now[i].set(0, 0, 0);
      for (const s of line[i].skin) {
        now[i].addScaledVector(u.copy(line[i].at).applyMatrix4(m.multiplyMatrices(s.bone.matrixWorld, s.inverse)), s.w);
      }
    }
    side.setFromMatrixColumn(vrm.scene.matrixWorld, 0).normalize();    // his right-left
    front.setFromMatrixColumn(vrm.scene.matrixWorld, 2).normalize();   // the way he faces (VRM 1.0: +Z)
  };
  // hold() measures the line on the frame's final pose; nothing moves the body between it and the
  // next frame's update(), so update() reuses it (it measures only before the first hold)
  let measured = false;
  return {
    update(t) {
      if (!measured) lineNow();
      const drift = reduceMotion ? 0 : BREEZE * (Math.sin(t * 1.1) + 0.5 * Math.sin(t * 2.3 + 1.7)) / 1.5;
      for (let i = 0; i < joints.length; i++) {
        const j = joints[i];
        dir.subVectors(now[i + 1], now[i]).normalize();
        dir.addScaledVector(side, Math.tan(drift)).normalize();
        dir.transformDirection(m.copy(j.bone.parent.matrixWorld).invert());
        j._initialLocalRotation.setFromUnitVectors(j._boneAxis, dir);
        j._initialLocalMatrix.compose(j.bone.position, j._initialLocalRotation, j.bone.scale);
      }
    },

    // After the simulation step, top of the blade first: each segment's direction is measured from
    // the original tie's at that point, sideways along the shirt and up off it, and held within the
    // limits; a held segment's spring state is moved with it and stopped, as a hit would stop it.
    // Same pose maths as the spring's own (three-vrm 3.5).
    hold() {
      lineNow();
      measured = true;
      for (let i = 0; i < joints.length; i++) {
        const j = joints[i];
        const bone = j.bone;
        bone.updateWorldMatrix(false, false);
        head.setFromMatrixPosition(bone.matrixWorld);
        tail.copy(j.child.position).applyMatrix4(bone.matrixWorld);
        const length = tail.distanceTo(head);
        dir.subVectors(tail, head).normalize();
        aim.subVectors(now[i + 1], now[i]).normalize();
        out.copy(front).addScaledVector(aim, -front.dot(aim)).normalize();   // off the shirt, across the blade
        let held = onShirt(dir, aim, out);
        if (i > 0 && limit(dir, above, MAX_BEND)) held = onShirt(dir, aim, out) || true;
        above.copy(dir);
        if (!held) continue;
        tail.copy(head).addScaledVector(dir, length);
        u.copy(tail).applyMatrix4(m.multiplyMatrices(bone.parent.matrixWorld, j._initialLocalMatrix).invert()).normalize();
        bone.quaternion.setFromUnitVectors(j._boneAxis, u).premultiply(j._initialLocalRotation);
        bone.updateMatrix();
        bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld, bone.matrix);
        j._currentTail.copy(tail);
        j._prevTail.copy(tail);
      }
    },
  };
}
