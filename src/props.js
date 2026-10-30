import * as THREE from 'three';
import { propMat, inkMat, dummy } from './core.js';

// ---------- গাছ আর বাড়ি: পার্টস জুড়ে একটা জিওমেট্রি (InstancedMesh-এর জন্য) ----------
export function tinted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
export function combine(parts) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const total = parts.reduce((s, p) => s + p.attributes[name].array.length, 0);
    const arr = new Float32Array(total);
    let o = 0;
    for (const p of parts) { arr.set(p.attributes[name].array, o); o += p.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  out.computeBoundingBox();
  const half = new THREE.Vector3(), mid = new THREE.Vector3();
  out.boundingBox.getSize(half).multiplyScalar(0.5);
  out.boundingBox.getCenter(mid);
  out.translate(-mid.x, -mid.y, -mid.z); // কেন্দ্রে আনা হলো, যাতে আউটলাইন সমান হয়ে বাড়ে
  return { geo: out, half, mid };
}

// দোচালা প্রিজম (খড়ের চালের জন্য): মাথা z-অক্ষ বরাবর, ভিত y=0, চূড়া y=h; ফ্ল্যাট-শেডিংয়ের জন্য নন-ইনডেক্সড
export function gable(w, h, d) {
  const a = [-w / 2, 0, -d / 2], b = [w / 2, 0, -d / 2], c = [0, h, -d / 2];
  const e = [w / 2, 0, d / 2], dd = [-w / 2, 0, d / 2], f = [0, h, d / 2];
  const tris = [[b, a, c], [dd, e, f], [b, c, f], [b, f, e], [a, f, c], [a, dd, f], [a, b, e], [a, e, dd]];
  const arr = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => t.forEach((v, j) => arr.set(v, i * 9 + j * 3)));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

// অনেক অংশ জুড়ে একটা জিওমেট্রি, বিশ্বের স্থানাঙ্কেই থাকে (combine-এর মতো কেন্দ্রে আনে না)
export function mergeWorld(parts) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const total = parts.reduce((s, p) => s + p.attributes[name].array.length, 0);
    const arr = new Float32Array(total);
    let o = 0;
    for (const p of parts) { arr.set(p.attributes[name].array, o); o += p.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}

export let TREE, HOUSE, BLD;
export function initProps() {
  TREE = combine([
    tinted(new THREE.CylinderGeometry(0.3, 0.4, 2, 6).translate(0, 1, 0), 0x7a5230),
    tinted(new THREE.ConeGeometry(1.6, 3.5, 7).translate(0, 3.75, 0), 0x4f8a4a)
  ]);
  HOUSE = combine([
    tinted(new THREE.BoxGeometry(4, 2.6, 5).translate(0, 1.3, 0), 0xd8c49a),
    tinted(new THREE.ConeGeometry(3.9, 1.8, 4).rotateY(Math.PI / 4).scale(0.84, 1, 1).translate(0, 3.5, 0), 0x8a4b3a)
  ]);
  // শহরের দুই ধরনের বাড়ি (ওপরে নিচের অংশ এক জিওমেট্রিতে)
  BLD = {
    H: HOUSE,
    A: combine([
      tinted(new THREE.BoxGeometry(5, 9, 5).translate(0, 4.5, 0), 0xd9b99b),
      tinted(new THREE.BoxGeometry(5.5, 0.6, 5.5).translate(0, 9.3, 0), 0x77737c)
    ]),
    B: combine([
      tinted(new THREE.BoxGeometry(5.5, 6, 5).translate(0, 3, 0), 0xe0d28a),
      tinted(new THREE.BoxGeometry(6, 0.6, 5.5).translate(0, 6.3, 0), 0x8f4d42)
    ])
  };

}

// def.mat থাকলে সেই মেটেরিয়াল (না থাকলে propMat); def.shell থাকলে আউটলাইন হবে ওই সহজ বাক্সে (জটিল দালানে হালকা)
export function addProps(parent, def, list, t) {
  if (!list.length) return;
  const sh = def.shell, sgeo = sh ? sh.geo : def.geo, shalf = sh ? sh.half : def.half, so = sh ? sh.off : null;
  const body = new THREE.InstancedMesh(def.geo, def.mat || propMat, list.length);
  const shell = new THREE.InstancedMesh(sgeo, inkMat, list.length);
  list.forEach((p, i) => {
    dummy.position.set(p.x, p.y + def.half.y * p.s, p.z);
    dummy.rotation.y = p.ry;
    dummy.scale.setScalar(p.s);
    dummy.updateMatrix();
    body.setMatrixAt(i, dummy.matrix);
    if (so) { // আউটলাইন-বাক্সের কেন্দ্র মূল জিওমেট্রির কেন্দ্র থেকে সরানো, ঘুরিয়ে বসাই
      const cs = Math.cos(p.ry), sn = Math.sin(p.ry);
      dummy.position.set(p.x + (so.x * cs + so.z * sn) * p.s, p.y + (def.half.y + so.y) * p.s, p.z + (-so.x * sn + so.z * cs) * p.s);
    }
    dummy.scale.set(p.s * (1 + t / shalf.x), p.s * (1 + t / shalf.y), p.s * (1 + t / shalf.z));
    dummy.updateMatrix();
    shell.setMatrixAt(i, dummy.matrix);
  });
  body.castShadow = body.receiveShadow = true;
  body.frustumCulled = shell.frustumCulled = false;
  parent.add(body, shell);
}

// প্রতি chunk-এ নিজস্ব seed দিয়ে গাছ-বাড়ি বসায়, তাই ফিরে এলেও একই জিনিস দেখা যাবে
