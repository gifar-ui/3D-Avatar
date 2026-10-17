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

const fbxLoader = new FBXLoader();

// Load a Mixamo FBX ("Without Skin") and retarget it to the VRM's normalized bones.
// `hipsHeight` is the VRM hips height at rest, measured before any pose is applied.
export async function loadMixamoClip(url, vrm, hipsHeight, name) {
  const asset = await fbxLoader.loadAsync(url);
  const source = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') ?? asset.animations[0];
  const motionHipsHeight = asset.getObjectByName('mixamorigHips').position.y;
  const hipsScale = hipsHeight / motionHipsHeight;
  const isVrm0 = vrm.meta?.metaVersion === '0';

  const restInv = new THREE.Quaternion();
  const parentRest = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const tracks = [];

  for (const track of source.tracks) {
    const [rigName, prop] = track.name.split('.');
    const boneName = RIG_MAP[rigName];
    const node = boneName && vrm.humanoid.getNormalizedBoneNode(boneName);
    const rigNode = asset.getObjectByName(rigName);
    if (!node || !rigNode) continue;

    rigNode.getWorldQuaternion(restInv).invert();
    rigNode.parent.getWorldQuaternion(parentRest);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i).premultiply(parentRest).multiply(restInv).toArray(values, i);
      }
      if (isVrm0) for (let i = 0; i < values.length; i += 2) values[i] = -values[i];
      tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.${prop}`, track.times, values));
    } else if (track instanceof THREE.VectorKeyframeTrack && boneName === 'hips') {
      const values = track.values.map((v, i) => (isVrm0 && i % 3 !== 1 ? -v : v) * hipsScale);
      tracks.push(new THREE.VectorKeyframeTrack(`${node.name}.${prop}`, track.times, values));
    }
  }
  return new THREE.AnimationClip(name, source.duration, tracks);
}
