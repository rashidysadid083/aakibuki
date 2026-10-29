import * as THREE from 'three';
import { bands, inkMat, propMat, scene } from './core.js';
import { tinted, combine } from './props.js';
import { GS, parked } from './state.js';

// ---------- গাড়ি জেনারেটর: একটা ফাংশন, মাপ-রঙ বদলে নানা মডেল; অংশগুলো merge করা (draw call কম) ----------
export let glassMat, headMat, tailMat, car;
const PAL = [0xd9503f, 0x3b6ea5, 0xe0b13a, 0x5a8a4a, 0x8a4f9a, 0xd9d2c0];
// W চওড়া, L লম্বা, wr চাকার ব্যাসার্ধ, yb/hb খোলের উচ্চতা, cz/cl/ch কেবিন, wz চাকার সারি, r ধাক্কার বৃত্ত
const MODELS = {
  jeep:  { W: 1.75, L: 3.7, wr: .42, yb: .75, hb: .5, cz: -.35, cl: 2, ch: .8, col: 0xd9503f, roof: 0xf0c24a, rows: 2, wz: [1.15, -1.15], r: 1.1, sp: 1, turn: 1.8, cam: [8, 4.5, 2.5, 4, 1] },
  car:   { W: 1.75, L: 4.1, wr: .36, yb: .62, hb: .5, cz: -.2, cl: 2.1, ch: .62, col: 0x3b6ea5, roof: 0x2f4f78, rows: 2, wz: [1.3, -1.3], r: 1.2, sp: 1, turn: 1.9, cam: [8.5, 4.6, 2.5, 4, 1] },
  truck: { W: 2.1, L: 6.4, wr: .5, yb: .95, hb: .6, cz: 2.1, cl: 1.6, ch: .95, col: 0xe0b13a, roof: 0xb58a20, rows: 1, wz: [2.2, -1, -2.3], cargo: [2.1, 1.1, 3.7, -1.25, 0x3b6ea5], r: 2, sp: .85, turn: 1.5, cam: [10, 5.5, 3, 4.5, 1.3] },
  bus:   { W: 2.4, L: 7.6, wr: .5, yb: 1.05, hb: .8, cz: 0, cl: 7, ch: 1.2, col: 0xd9763a, roof: 0x3d5a80, rows: 6, wz: [2.5, -2.5], r: 2.6, sp: .8, turn: 1.4, cam: [11, 6, 3, 5, 1.5] },
  cng:   { W: 1.4, L: 2.6, wr: .3, yb: .58, hb: .5, cz: -.25, cl: 1.5, ch: .75, col: 0x4f9a5a, roof: 0xf0c24a, rows: 1, w3: 1, wz: [.95, -.8], r: 1.4, sp: .9, turn: 2.1, cam: [8.5, 4.6, 2.5, 4, 1] }
};
const bxg = (w, h, d, x, y, z, hex) => tinted(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);
function partMesh(parts, mat, thick, shadow) { // অনেক অংশ জুড়ে একটা মেশ (+ ইচ্ছে হলে কালির আউটলাইন)
  const c = combine(parts), m = new THREE.Mesh(c.geo, mat);
  m.position.copy(c.mid);
  m.castShadow = !!shadow;
  if (thick) {
    const sh = new THREE.Mesh(c.geo, inkMat);
    sh.scale.set(1 + thick / c.half.x, 1 + thick / c.half.y, 1 + thick / c.half.z);
    m.add(sh);
  }
  return m;
}
function wheelMesh(r) { // টায়ার + রিম একসাথে
  const m = partMesh([
    tinted(new THREE.CylinderGeometry(r, r, 0.28, 12).rotateZ(Math.PI / 2), 0x2b2b30),
    tinted(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.32, 10).rotateZ(Math.PI / 2), 0xcfcfd6)], propMat, 0, false);
  m.userData.r = r;
  return m;
}
export function makeVehicle(kind, col) {
  const M = MODELS[kind], g = new THREE.Group();
  const C = col || (kind === 'car' ? PAL[(Math.random() * PAL.length) | 0] : M.col);
  const W = M.W, hw = W / 2, top = M.yb + M.hb / 2, zf = M.cz + M.cl / 2, zb = M.cz - M.cl / 2, cw = W * 0.92, roof = M.roof;
  const B = [], I = [], G = [], H = [], T = [];
  g.rotation.order = 'YXZ';
  B.push(bxg(W, M.hb, M.L, 0, M.yb, 0, C)); // চেসিস
  for (const s of [1, -1]) {
    B.push(bxg(W * 0.96, 0.16, 0.14, 0, M.yb - M.hb / 2 + 0.12, s * (M.L / 2 + 0.05), 0x77737c)); // বাম্পার
    B.push(bxg(0.1, 0.12, 0.05, s * (hw + 0.12), top + 0.38, zf - 0.2, 0x2a2a30)); // সাইড মিরর
    H.push(bxg(0.3, 0.16, 0.06, s * (hw - 0.3), M.yb + 0.05, M.L / 2 + 0.02, 0xffffff)); // হেডলাইট
    T.push(bxg(0.26, 0.14, 0.06, s * (hw - 0.28), M.yb + 0.05, -M.L / 2 - 0.02, 0xffffff)); // টেইললাইট
  }
  const wp = [];
  M.wz.forEach((z, i) => { if (M.w3 && i === 0) wp.push([0, z]); else wp.push([hw - 0.1, z], [-hw + 0.1, z]); });
  const wheels = wp.map(([x, z]) => {
    const w = wheelMesh(M.wr);
    w.position.set(x, M.wr, z);
    g.add(w);
    if (x) B.push(bxg(0.06, M.wr * 1.4, M.wr * 2.4, Math.sign(x) * (hw + 0.005), M.wr + 0.1, z, 0x26262c)); // চাকার খোল
    return w;
  });
  if (M.cargo) { const [a, b, c, z, k] = M.cargo; B.push(bxg(a, b, c, 0, top + b / 2, z, k)); }
  // কেবিন: ছাদ + থাম, মাঝে কাচ; ভেতরটা ফাঁপা তাই সিট দেখা যায়
  B.push(bxg(cw, 0.1, M.cl, 0, top + M.ch, M.cz, roof));
  const n = Math.max(1, Math.round(M.cl / 1.9));
  for (let i = 0; i <= n; i++) for (const s of [1, -1]) B.push(bxg(0.09, M.ch, 0.09, s * (cw / 2 - 0.045), top + M.ch / 2, zb + 0.045 + (M.cl - 0.09) * i / n, roof));
  G.push(bxg(cw - 0.06, M.ch * 0.8, M.cl - 0.12, 0, top + M.ch * 0.5, M.cz, 0x000000));
  G.push(bxg(cw - 0.24, M.ch * 0.8, M.cl - 0.06, 0, top + M.ch * 0.5, M.cz, 0x000000));
  const step = M.cl > 6 ? 1.15 : 0.85;
  for (let i = 0; i < M.rows; i++) for (const s of [1, -1]) {
    const z = zf - 0.7 - i * step;
    I.push(bxg(0.42, 0.18, 0.45, s * W * 0.2, top + 0.14, z, 0x6a4a3a), bxg(0.42, 0.5, 0.1, s * W * 0.2, top + 0.45, z - 0.22, 0x6a4a3a));
  }
  I.push(bxg(W * 0.8, 0.22, 0.22, 0, top + 0.16, zf - 0.14, 0x3a3a42)); // ড্যাশবোর্ড
  I.push(tinted(new THREE.TorusGeometry(0.16, 0.025, 5, 10).rotateX(-1.1).translate(-W * 0.2, top + 0.6, zf - 0.34), 0x222222)); // স্টিয়ারিং
  // দরজা: বাঁ দিকেরটা কবজায় ঘোরে (নামার সময় খোলে), ডান দিকেরটা খোলের সাথে
  const zd = zf - 0.25, door = new THREE.Group();
  door.position.set(hw + 0.03, M.yb, zd);
  door.add(partMesh([bxg(0.06, M.hb * 0.9, 0.9, 0, 0, -0.45, C), bxg(0.1, 0.05, 0.18, 0.04, M.hb * 0.2, -0.75, 0x2a2a2a)], propMat, 0, false));
  B.push(bxg(0.06, M.hb * 0.9, 0.9, -(hw + 0.03), M.yb, zd - 0.45, C), bxg(0.1, 0.05, 0.18, -(hw + 0.07), M.yb + M.hb * 0.2, zd - 0.75, 0x2a2a2a));
  g.add(partMesh(B, propMat, 0.05, true), partMesh(I, propMat, 0, false), partMesh(G, glassMat, 0, false), partMesh(H, headMat, 0, false), partMesh(T, tailMat, 0, false), door);
  g.userData = { wheels, hl: M.L / 2, kind, r: M.r, sp: M.sp, turn: M.turn, cam: M.cam, door, da: 0, dt: 0, hw, dz: zd - 0.45 };
  return g;
}


export function initVehicles() {
  glassMat = new THREE.MeshToonMaterial({ color: 0x1d2a3a, transparent: true, opacity: 0.5, depthWrite: false, gradientMap: bands });
  headMat = new THREE.MeshBasicMaterial({ color: 0x8a8470 });
  tailMat = new THREE.MeshBasicMaterial({ color: 0x6a1d18 });
  car = makeVehicle('jeep');
  scene.add(car);
  GS.veh = GS.focus = car; // veh = এখন যে গাড়ি চালাচ্ছ; focus = ক্যামেরা, chunk আর শব্দ যার পিছু নেয়
  parked.push(car);
}
