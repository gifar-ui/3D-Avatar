import * as THREE from 'three';

// Mixamo animations, baked to JSON by scripts/bake_clips.mjs: per VRM humanoid bone, rotation keys
// with the Mixamo rest pose already taken out, and the hips' position keys. Needs no VRM, so it can
// start while the model downloads.
export async function loadMixamo(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

// Retarget a baked Mixamo clip to the VRM's normalized bones.
// `hipsHeight` is the VRM hips height at rest, measured before any pose is applied.
export function retargetMixamoClip(baked, vrm, hipsHeight, name) {
  const hipsScale = hipsHeight / baked.hipsHeight;
  const isVrm0 = vrm.meta?.metaVersion === '0';
  const tracks = [];
  for (const { bone, prop, times, values } of baked.tracks) {
    const node = vrm.humanoid.getNormalizedBoneNode(bone);
    if (!node) continue;
    if (prop === 'quaternion') {
      const q = Float32Array.from(values);
      if (isVrm0) for (let i = 0; i < q.length; i += 2) q[i] = -q[i];
      tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.${prop}`, times, q));
    } else {
      const v = Float32Array.from(values, (x, i) => (isVrm0 && i % 3 !== 1 ? -x : x) * hipsScale);
      tracks.push(new THREE.VectorKeyframeTrack(`${node.name}.${prop}`, times, v));
    }
  }
  return new THREE.AnimationClip(name, baked.duration, tracks);
}
