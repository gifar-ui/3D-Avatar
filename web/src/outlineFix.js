import * as THREE from 'three';

// When an arm is raised, the inside of the shirt sleeve sinks into the torso and
// its dark MToon outline (an inflated back-face hull) shows through as a "hole"
// at the armpit. This fades the shirt outline to zero width in a small zone around
// each armpit using MToon's outline-width mask texture; the rest of the shirt keeps
// its outline.
// Zone (bind/T-pose space, relative to each upper-arm joint): the root of the
// sleeve, from slightly inside the joint out along the arm, below `top`.
const ZONE = { inner: -0.04, outer: 0.06, below: 0.06, top: 0.03, front: 0.12, feather: 0.025 };

export function maskArmpitOutlines(vrm, { zone = ZONE, size = 1024, test = /Tops/ } = {}) {
  const centers = [];
  const meshes = [];
  vrm.scene.traverse((o) => {
    if (o.isSkinnedMesh && [].concat(o.material).some((m) => test.test(m.name))) meshes.push(o);
  });

  for (const mesh of meshes) {
    const { skeleton, geometry } = mesh;
    const bindPos = (bone) => {
      const i = skeleton.bones.indexOf(bone);
      return new THREE.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert());
    };
    const zones = ['left', 'right'].map((side) => bindPos(vrm.humanoid.getRawBoneNode(`${side}UpperArm`)));
    centers.push(...zones);
    const f = zone.feather;
    const inBox = (lo, hi, x) => THREE.MathUtils.smoothstep(x, lo - f, lo) * (1 - THREE.MathUtils.smoothstep(x, hi, hi + f));

    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    if (!uv) continue;
    const v = new THREE.Vector3();
    const weight = new Float32Array(pos.count);   // 1 = full outline, 0 = none
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
      let keep = 1;
      for (const z of zones) {
        const out = (v.x - z.x) * Math.sign(z.x);          // + = toward the hand
        const inside = inBox(zone.inner, zone.outer, out)
          * inBox(z.y - zone.below, z.y + zone.top, v.y)
          * inBox(z.z - zone.front, z.z + zone.front, v.z);
        keep = Math.min(keep, 1 - inside);
      }
      weight[i] = keep;
    }

    // paint the mask in UV space (white = keep outline)
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, size, size);
    const index = geometry.index;
    const tri = index ? (k) => index.getX(k) : (k) => k;
    const count = index ? index.count : pos.count;
    for (let k = 0; k < count; k += 3) {
      const a = tri(k), b = tri(k + 1), c = tri(k + 2);
      const w = (weight[a] + weight[b] + weight[c]) / 3;
      if (w > 0.995) continue;
      const shade = Math.round(w * 255);
      g.fillStyle = g.strokeStyle = `rgb(${shade},${shade},${shade})`;
      g.beginPath();
      g.moveTo(uv.getX(a) * size, uv.getY(a) * size);
      g.lineTo(uv.getX(b) * size, uv.getY(b) * size);
      g.lineTo(uv.getX(c) * size, uv.getY(c) * size);
      g.closePath();
      g.fill();
      g.stroke();                                  // cover seams between triangles
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;                             // glTF UV convention
    tex.colorSpace = THREE.NoColorSpace;

    for (const m of [].concat(mesh.material)) {
      if (!m.isOutline || !test.test(m.name)) continue;
      m.outlineWidthMultiplyTexture = tex;
      // where the width is ~0 the hull coincides with the shirt; keep it behind
      m.polygonOffset = true;
      m.polygonOffsetFactor = 1;
      m.polygonOffsetUnits = 1;
      m.needsUpdate = true;
    }
  }
  return { meshes: meshes.length, centers };
}
