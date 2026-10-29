import * as THREE from 'three';
import { scene, bands } from './core.js';

// ---- কাগজের বিমান: একটা চৌকো কাগজ ভাঁজ হয়ে বিমান হয় (৪টা শীর্ষবিন্দু নড়ে, নতুন জিওমেট্রি নয়) ----
const PL = 2.0, PWD = 0.85;
function makePaperPlane() {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const wg = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array([0, 0, PL / 2, PWD, 0, PL / 2, PWD, 0, -PL / 2, 0, 0, -PL / 2]), 3);
  wg.setAttribute('position', pos);
  wg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  wg.setIndex([0, 1, 2, 0, 2, 3]);
  const wm = new THREE.MeshToonMaterial({ color: 0xfbf7ea, gradientMap: bands, side: THREE.DoubleSide });
  const lm = new THREE.LineBasicMaterial({ color: 0x1a1620 });
  const wings = [1, -1].map(side => {
    const pv = new THREE.Group();
    pv.scale.x = side; // ডান ডানা বাঁ ডানার আয়না
    const m = new THREE.Mesh(wg, wm);
    m.castShadow = true; m.frustumCulled = false;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', pos); // একই শীর্ষবিন্দু, তাই কালির রেখাও ভাঁজের সাথে নড়ে
    const ln = new THREE.LineLoop(lg, lm);
    ln.frustumCulled = false;
    pv.add(m, ln);
    g.add(pv);
    return pv;
  });
  const kg = new THREE.BufferGeometry();
  kg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, PL * 0.47, 0, -0.32, -PL * 0.42, 0, 0, -PL / 2]), 3));
  kg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0]), 3));
  const keel = new THREE.Mesh(kg, new THREE.MeshToonMaterial({ color: 0xd9503f, gradientMap: bands, side: THREE.DoubleSide }));
  keel.castShadow = true; keel.frustumCulled = false;
  const kl = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', kg.attributes.position), lm);
  kl.frustumCulled = false;
  keel.add(kl);
  g.add(keel);
  g.scale.setScalar(1.3);
  g.userData = { pos, wings, keel };
  g.visible = false;
  scene.add(g);
  return g;
}
export let paperPlane;
export function initPaperPlane() {
  paperPlane = makePaperPlane();
  foldPlane(1);
}
export function foldPlane(f) { // f: 0 (সমতল কাগজ) → 1 (বিমান): কোণ ভাঁজ → মাঝখানে ভাঁজ → ডানা নামানো
  const ss = THREE.MathUtils.smoothstep, s1 = ss(f, 0, 0.35), s2 = ss(f, 0.35, 0.65), s3 = ss(f, 0.65, 1);
  const P = paperPlane.userData;
  P.pos.setX(1, PWD * (1 - s1));
  P.pos.needsUpdate = true;
  const A = THREE.MathUtils.lerp(s2 * Math.PI / 2, 0.16, s3);
  P.wings[0].rotation.z = A; P.wings[1].rotation.z = -A;
  P.keel.visible = s3 > 0.02;
  P.keel.scale.y = Math.max(0.01, s3);
}
