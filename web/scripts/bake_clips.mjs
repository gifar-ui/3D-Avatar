// Bakes the Mixamo FBX animations ("Without Skin") into small JSON clips for the web (src/mixamo.js),
// so the page needs no FBXLoader and parses a few KB of numbers instead of a 600 KB FBX.
// Each rotation track already has the Mixamo rest pose taken out (parent rest x key x rest⁻¹), which
// doesn't depend on the avatar; what does (VRM 0.x axis flip, hips height) stays at load time.
// Run from web/: node scripts/bake_clips.mjs   (public/animations/*.fbx -> public/animations/*.json)
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Mixamo rig bone -> VRM humanoid bone.
const RIG_MAP = {
  mixamorigHips: 'hips',
  mixamorigSpine: 'spine',
  mixamorigSpine1: 'chest',
  mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck',
  mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder',
  mixamorigLeftArm: 'leftUpperArm',
  mixamorigLeftForeArm: 'leftLowerArm',
  mixamorigLeftHand: 'leftHand',
  mixamorigRightShoulder: 'rightShoulder',
  mixamorigRightArm: 'rightUpperArm',
  mixamorigRightForeArm: 'rightLowerArm',
  mixamorigRightHand: 'rightHand',
  mixamorigLeftUpLeg: 'leftUpperLeg',
  mixamorigLeftLeg: 'leftLowerLeg',
  mixamorigLeftFoot: 'leftFoot',
  mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg',
  mixamorigRightLeg: 'rightLowerLeg',
  mixamorigRightFoot: 'rightFoot',
  mixamorigRightToeBase: 'rightToes',
};
for (const side of ['Left', 'Right']) {
  const s = side.toLowerCase();
  RIG_MAP[`mixamorig${side}HandThumb1`] = `${s}ThumbMetacarpal`;
  RIG_MAP[`mixamorig${side}HandThumb2`] = `${s}ThumbProximal`;
  RIG_MAP[`mixamorig${side}HandThumb3`] = `${s}ThumbDistal`;
  for (const [mx, vrm] of [['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Pinky', 'Little']]) {
    RIG_MAP[`mixamorig${side}Hand${mx}1`] = `${s}${vrm}Proximal`;
    RIG_MAP[`mixamorig${side}Hand${mx}2`] = `${s}${vrm}Intermediate`;
    RIG_MAP[`mixamorig${side}Hand${mx}3`] = `${s}${vrm}Distal`;
  }
}

const round = (v) => Math.round(v * 1e6) / 1e6;   // 6 decimals: far below a visible difference

function bake(asset) {
  const source = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') ?? asset.animations[0];
  const restInv = new THREE.Quaternion();
  const parentRest = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const tracks = [];
  for (const track of source.tracks) {
    const [rigName, prop] = track.name.split('.');
    const bone = RIG_MAP[rigName];
    const rigNode = asset.getObjectByName(rigName);
    if (!bone || !rigNode) continue;
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      rigNode.getWorldQuaternion(restInv).invert();
      rigNode.parent.getWorldQuaternion(parentRest);
      const values = Array.from(track.values);
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i).premultiply(parentRest).multiply(restInv).toArray(values, i);
      }
      tracks.push({ bone, prop, times: Array.from(track.times, round), values: values.map(round) });
    } else if (track instanceof THREE.VectorKeyframeTrack && bone === 'hips') {
      tracks.push({ bone, prop, times: Array.from(track.times, round), values: Array.from(track.values, round) });
    }
  }
  return { duration: source.duration, hipsHeight: asset.getObjectByName('mixamorigHips').position.y, tracks };
}

for (const name of ['idle', 'walk']) {
  const buf = readFileSync(`public/animations/${name}.fbx`);
  const asset = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const json = JSON.stringify(bake(asset));
  writeFileSync(`public/animations/${name}.json`, json);
  console.log(`${name}.json  ${(json.length / 1024).toFixed(0)} KB (fbx ${(buf.length / 1024).toFixed(0)} KB)`);
}
