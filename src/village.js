import * as THREE from 'three';
import { WATER, CS } from './config.js';
import { mulberry32 } from './rng.js';
import { heightAt, surfaceAt, NR, railDist } from './terrain.js';
import { propMat } from './core.js';
import { tinted, combine, gable, mergeWorld, addProps, BLD } from './props.js';

// ---------- ৪ক গ্রাম: চালা ঘর, বট গাছ, কলা বাগান, বাঁশঝাড়, পুকুর, ধানক্ষেত ----------
export const KIT = {};

export function initVillage() {
  const box = (w, h, d, x, y, z, hex) => tinted(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex);

  // চালা ঘর: মাটির দেয়াল, খড়ের দোচালা, দরজা-জানালা (BLD-তে জুড়ে দিই, বাকি বাড়ির মতো InstancedMesh)
  BLD.C = combine([
    box(3.6, 2.0, 4.4, 0, 1.0, 0, 0xc9a574),
    tinted(gable(4.6, 1.9, 5.4).translate(0, 2.0, 0), 0xb8903f),
    box(0.9, 1.4, 0.1, 0.8, 0.7, 2.22, 0x5a3d26),
    box(0.55, 0.5, 0.1, -0.9, 1.25, 2.22, 0x5a3d26)
  ]);

  // বট গাছ: মোটা কাণ্ড, চার-পাঁচটা সবুজ গুচ্ছ, ঝুরি
  const ico = (r, x, y, z, hex) => tinted(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), hex);
  const banyan = [
    tinted(new THREE.CylinderGeometry(0.7, 1.1, 3.4, 7).translate(0, 1.7, 0), 0x6b4a2c),
    ico(2.5, 0, 4.3, 0, 0x3f7d3a), ico(2.0, -2.0, 3.8, 0.7, 0x4f9145),
    ico(2.1, 1.9, 4.0, -0.6, 0x356f35), ico(1.6, 0.3, 5.6, -0.2, 0x5aa04c)
  ];
  for (const [x, z] of [[-2.2, 0.4], [2.1, -0.3], [-0.8, -2.0], [1.0, 2.0]]) banyan.push(tinted(new THREE.CylinderGeometry(0.05, 0.08, 2.4, 5).translate(x, 2.4, z), 0x6b4a2c));
  KIT.BANYAN = combine(banyan);

  // কলা গাছের ঝাড়: তিনটা কাণ্ড, প্রতিটায় চারটা লম্বা পাতা
  const banana = [];
  [[0, 0, 2.5, 0xa6b85a], [0.55, 0.3, 2.1, 0x9aae50], [-0.5, 0.35, 2.9, 0xa6b85a]].forEach(([x, z, h, c], i) => {
    banana.push(tinted(new THREE.CylinderGeometry(0.1, 0.15, h, 5).translate(x, h / 2, z), c));
    for (let k = 0; k < 4; k++) banana.push(tinted(new THREE.BoxGeometry(0.55, 0.03, 2.0).translate(0, 0, 1.0).rotateX(-0.25).rotateY(k * 1.57 + i * 0.9).translate(x, h, z), k & 1 ? 0x5faa48 : 0x6fba52));
  });
  KIT.BANANA = combine(banana);

  // বাঁশঝাড়: ৯টা হেলানো বাঁশ, মাথায় পাতার গুচ্ছ
  const bamboo = [], br = mulberry32(55);
  for (let i = 0; i < 9; i++) {
    const a = br() * 6.283, d = br() * 0.7, h = 5.0 + br() * 0.9, lean = 0.1 + br() * 0.12;
    const px = Math.cos(a) * d, pz = Math.sin(a) * d;
    bamboo.push(tinted(new THREE.CylinderGeometry(0.045, 0.07, h, 5).translate(0, h / 2, 0).rotateZ(-lean).rotateY(-a).translate(px, 0, pz), i & 1 ? 0x9fb84a : 0x88a63f));
    const tx = px + Math.sin(lean) * h * Math.cos(a), ty = h * Math.cos(lean), tz = pz + Math.sin(lean) * h * Math.sin(a);
    bamboo.push(tinted(new THREE.ConeGeometry(0.55, 1.4, 5).translate(tx, ty - 0.5, tz), i & 1 ? 0x5f9a3a : 0x73ad45));
  }
  KIT.BAMBOO = combine(bamboo);
}

// ---------- জায়গা বাছাই ----------
const FLAT = [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const fl = { lo: 0, hi: 0, nd: 0 };
// (x,z)-কে ঘিরে rx×rz মাপে জমি প্রায় সমতল আর পানি নয় কিনা; ফল fl-এ (সর্বনিম্ন/সর্বোচ্চ উচ্চতা, রাস্তার ন্যূনতম দূরত্ব)
function flatAt(x, z, rx, rz, tol) {
  let lo = 1e9, hi = -1e9, nd = 1e9;
  for (const [a, b] of FLAT) {
    const h = heightAt(x + a * rx, z + b * rz);
    if (h <= WATER + 0.05) return false;
    nd = Math.min(nd, NR.d);
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
  if (hi - lo > tol) return false;
  fl.lo = lo; fl.hi = hi; fl.nd = nd;
  return true;
}

// chunk-এর ভেতরে, কিনারা থেকে m দূরে একটা বিন্দু
const spot = (r, x0, z0, m) => [x0 + m + r() * (CS - 2 * m), z0 + m + r() * (CS - 2 * m)];

// layout-এর শেষে ডাকা হয় (আগের r() ক্রম বদলায় না): গ্রাম ও মাঠের chunk-এ অতিরিক্ত জিনিস বসায়
export function villageExtras(r, kind, x0, z0, buildings, trees, cols) {
  const vil = kind === 'village';
  const occ = buildings.map(b => ({ x: b.x, z: b.z, r: 3.6 * b.s })).concat(trees.map(t => ({ x: t.x, z: t.z, r: t.s })));
  // occ: গোল (r) বা আয়তাকার (rx, rz) দখল-করা জায়গা। free = গোল প্রার্থী, freeRect = আয়তাকার প্রার্থী
  const gap = (o, x, z) => o.rx === undefined ? Math.hypot(o.x - x, o.z - z) - o.r : Math.hypot(Math.max(Math.abs(o.x - x) - o.rx, 0), Math.max(Math.abs(o.z - z) - o.rz, 0));
  const free = (x, z, rad) => railDist(x, z) > rad + 8 && occ.every(o => gap(o, x, z) > rad); // রেললাইন থেকেও দূরে
  const freeRect = (x, z, rx, rz) => railDist(x, z) > Math.max(rx, rz) + 8 && occ.every(o => o.rx === undefined
    ? Math.hypot(Math.max(Math.abs(o.x - x) - rx, 0), Math.max(Math.abs(o.z - z) - rz, 0)) > o.r + 0.5
    : Math.abs(o.x - x) > rx + o.rx + 1 || Math.abs(o.z - z) > rz + o.rz + 1);
  const out = { ponds: [], plots: [], banyans: [], bananas: [], bamboos: [] };

  // পুকুর (সমতল জায়গায় ইটের পাড় ঘেরা, ভেতরে নিচু জল)
  if (r() < (vil ? 0.5 : 0.4)) for (let t = 0; t < 6; t++) {
    const a = 3.2 + r() * 1.8, b = 2.6 + r() * 1.4, rr = Math.max(a, b) + 1;
    const [x, z] = spot(r, x0, z0, rr + 1);
    if (!free(x, z, rr) || !flatAt(x, z, rr, rr, 0.6) || fl.nd < 5.2) continue;
    out.ponds.push({ x, z, a, b, lo: fl.lo, hi: fl.hi });
    occ.push({ x, z, r: rr });
    cols.push({ x, z, r: (a + b) / 2 + 0.5, hh: 0.5 }); // ওপর দিয়ে উড়ে যাওয়া যায়
    break;
  }

  // ধানক্ষেত (আইল ঘেরা, সারিতে সবুজ)
  const want = vil ? 1 + (r() < 0.5 ? 1 : 0) : 2 + (r() < 0.6 ? 1 : 0), tries = vil ? 6 : 10;
  for (let t = 0; t < tries && out.plots.length < want; t++) {
    const lg = 5 + r() * 2.5, sh = 3.5 + r() * 1.5, sw = r() < 0.5;
    const rx = sw ? sh : lg, rz = sw ? lg : sh;
    const [x, z] = spot(r, x0, z0, Math.max(rx, rz) + 1);
    if (!freeRect(x, z, rx, rz) || !flatAt(x, z, rx, rz, 0.8) || fl.nd < 6.2) continue;
    out.plots.push({ x, z, rx, rz, lo: fl.lo, hi: fl.hi });
    occ.push({ x, z, rx, rz });
  }

  // বট গাছ
  if (r() < (vil ? 0.4 : 0.3)) for (let t = 0; t < 5; t++) {
    const [x, z] = spot(r, x0, z0, 4);
    if (surfaceAt(x, z) !== 'grass' || NR.d < 7 || NR.d > 26 || !free(x, z, 3.0)) continue;
    const s = 0.85 + r() * 0.25;
    out.banyans.push({ x, z, y: heightAt(x, z), ry: r() * 6.283, s });
    occ.push({ x, z, r: 3.2 });
    cols.push({ x, z, r: 1.3 * s, hh: 8 });
    break;
  }

  // কলা বাগান (শুধু গ্রামে): ৩-৪টা ঝাড় কাছাকাছি
  if (vil && r() < 0.6) for (let t = 0; t < 5; t++) {
    const [x, z] = spot(r, x0, z0, 4);
    if (surfaceAt(x, z) !== 'grass' || NR.d < 7 || NR.d > 26 || !free(x, z, 3.0)) continue;
    const n = 3 + (r() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const cx = x + (r() - 0.5) * 4, cz = z + (r() - 0.5) * 4;
      if (surfaceAt(cx, cz) !== 'grass' || NR.d < 5.5) continue;
      const s = 0.9 + r() * 0.3;
      out.bananas.push({ x: cx, z: cz, y: heightAt(cx, cz), ry: r() * 6.283, s });
      cols.push({ x: cx, z: cz, r: 0.8 * s });
    }
    occ.push({ x, z, r: 3.0 });
    break;
  }

  // বাঁশঝাড়
  if (r() < (vil ? 0.55 : 0.35)) for (let t = 0; t < 5; t++) {
    const [x, z] = spot(r, x0, z0, 4);
    if (surfaceAt(x, z) !== 'grass' || NR.d < 7 || NR.d > 26 || !free(x, z, 2.4)) continue;
    const s = 0.9 + r() * 0.3;
    out.bamboos.push({ x, z, y: heightAt(x, z), ry: r() * 6.283, s });
    occ.push({ x, z, r: 2.6 });
    cols.push({ x, z, r: 1.3 * s, hh: 8 });
    break;
  }
  return out;
}

// ---------- আঁকা: ধানক্ষেত আর পুকুর এক মেশে (সমতল, আউটলাইন ছাড়া); বাকিগুলো InstancedMesh ----------
const BUND = 0x8a6a45, RICE = [0x8cc04a, 0x7db43f], BANK = 0xa38558, WATERC = 0x6fb0cc, LILY = 0x5a9a4a;
function paddyParts(p, out) {
  const yb = p.lo - 0.25, hb = p.hi + 0.28 - yb, hi = p.hi + 0.1 - yb, bw = 0.45, n = 7;
  const bx = (w, h, d, x, z, hex) => out.push(tinted(new THREE.BoxGeometry(w, h, d).translate(p.x + x, yb + h / 2, p.z + z), hex));
  bx(2 * p.rx, hb, bw, 0, p.rz - bw / 2, BUND);
  bx(2 * p.rx, hb, bw, 0, -p.rz + bw / 2, BUND);
  bx(bw, hb, 2 * p.rz - 2 * bw, p.rx - bw / 2, 0, BUND);
  bx(bw, hb, 2 * p.rz - 2 * bw, -p.rx + bw / 2, 0, BUND);
  const iw = 2 * p.rx - 2 * bw, row = (2 * p.rz - 2 * bw) / n;
  for (let i = 0; i < n; i++) bx(iw, hi, row, 0, -p.rz + bw + row * (i + 0.5), RICE[i & 1]);
}
function pondParts(p, out) {
  const yb = p.lo - 0.25, topB = p.hi + 0.22, topW = p.hi + 0.12;
  const cyl = (rx, rz, top, hex) => out.push(tinted(new THREE.CylinderGeometry(1, 1, top - yb, 14).scale(rx, 1, rz).translate(p.x, yb + (top - yb) / 2, p.z), hex));
  cyl(p.a + 0.7, p.b + 0.7, topB, BANK);
  cyl(p.a, p.b, topW, WATERC);
  for (const [dx, dz] of [[-0.35, 0.2], [0.3, -0.35], [0.05, 0.45]]) out.push(tinted(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 7).translate(p.x + dx * p.a, topW + 0.02, p.z + dz * p.b), LILY));
}

export function villageDecorate(mesh, ex) {
  addProps(mesh, KIT.BANYAN, ex.banyans, 0.1);
  addProps(mesh, KIT.BANANA, ex.bananas, 0.06);
  addProps(mesh, KIT.BAMBOO, ex.bamboos, 0.05);
  if (!ex.ponds.length && !ex.plots.length) return;
  const parts = [];
  ex.plots.forEach(p => paddyParts(p, parts));
  ex.ponds.forEach(p => pondParts(p, parts));
  const m = new THREE.Mesh(mergeWorld(parts), propMat);
  m.receiveShadow = true;
  m.userData.own = true; // chunk সরলে এই জিওমেট্রি ছাড়া হয়
  mesh.add(m);
}
