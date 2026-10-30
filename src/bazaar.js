import * as THREE from 'three';
import { CS, SP } from './config.js';
import { mulberry32, SEED } from './rng.js';
import { roadCoord, distAxis, nearestRoad, NR, heightAt, surfaceAt } from './terrain.js';
import { inkMat } from './core.js';
import { facadeMat, newT, quad, tri, boxT, finishT, newAcc, stamp, pour } from './facade.js';

// ---------- ৪খ বাজার: মোড়ের কাছের কয়েকটা chunk-এ রাস্তার দুই ধারে দোকানের সারি ----------
// প্রতি chunk-এর সব জিনিস (দোকান, স্টল, শামিয়ানা, পতাকা) একটা মেশে (সাথে একটা আউটলাইন-মেশ), তাই draw call মাত্র ২টা।
const W = v => [v, v, v];
const TINTS = [[1, 0.45, 0.38], [1, 0.78, 0.3], [0.4, 0.78, 0.7], [0.45, 0.65, 0.95], [0.88, 0.5, 0.75], [0.55, 0.8, 0.4], [1, 0.62, 0.3]];
const SW = 4.4, SD = 4.6, G1 = 3.3, UF = 3.0, PARA = 0.35; // দোকানের চওড়া, গভীরতা, নিচতলা/ওপরতলার উচ্চতা, আলসে
const STEP = 4.8, LAT = 8.8, LAT_S = 5.95; // সারির ফাঁক, রাস্তার মাঝ থেকে দোকানের দূরত্ব, স্টলের দূরত্ব
const SHOP = {};
let TENT, STALL;

export function isBazaar(cx, cz) { // মোড়ের গ্রিড-বিন্দুর ৬০ মিটারের মধ্যের chunk, প্রায় ৬০% মোড়ে বাজার; শুরুর মোড় গ্রাম থাকে
  const mx = cx * CS + CS / 2, mz = cz * CS + CS / 2, i = Math.round(mx / SP), j = Math.round(mz / SP);
  if (i === 0 && j === 0) return false;
  if (Math.hypot(mx - i * SP, mz - j * SP) > 60) return false;
  return mulberry32(((i * 92821) ^ (j * 68917) ^ SEED ^ 0x5bd1) >>> 0)() < 0.6;
}

function shopTemplate(floors, closed) {
  const T = newT(), hw = SW / 2, hd = SD / 2, H = G1 + (floors - 1) * UF, S = -0.7, c = W(1);
  quad(T, [-hw, S, hd], [hw, S, hd], [hw, 0, hd], [-hw, 0, hd], 'plain', c, 1); // মাটির নিচের অংশ
  quad(T, [-hw, 0, hd], [hw, 0, hd], [hw, 2.45, hd], [-hw, 2.45, hd], closed ? 'shut' : 'shop', c, 1); // দোকানের মুখ
  quad(T, [-hw, 2.45, hd], [hw, 2.45, hd], [hw, G1, hd], [-hw, G1, hd], 'plain', c, 1);
  if (floors > 1) quad(T, [-hw, G1, hd], [hw, G1, hd], [hw, H, hd], [-hw, H, hd], 'win', c, 1);
  quad(T, [hw, S, -hd], [-hw, S, -hd], [-hw, H, -hd], [hw, H, -hd], 'plain', c, 1);
  quad(T, [hw, S, hd], [hw, S, -hd], [hw, H, -hd], [hw, H, hd], 'plain', c, 1);
  quad(T, [-hw, S, -hd], [-hw, S, hd], [-hw, H, hd], [-hw, H, -hd], 'plain', c, 1);
  quad(T, [-hw, H, hd], [hw, H, hd], [hw, H, -hd], [-hw, H, -hd], 'plain', [0.62, 0.6, 0.58]); // ছাদ
  const p = 0.18, pc = W(0.9);
  boxT(T, -hw, hw, H, H + PARA, hd - p, hd, {}, pc, 1); boxT(T, -hw, hw, H, H + PARA, -hd, -hd + p, {}, pc, 1);
  boxT(T, -hw, -hw + p, H, H + PARA, -hd + p, hd - p, {}, pc, 1); boxT(T, hw - p, hw, H, H + PARA, -hd + p, hd - p, {}, pc, 1);
  // ডোরাকাটা চাঁদোয়া (ঢালু) + ঝুলন্ত পাড়
  quad(T, [-hw + 0.1, 2.25, hd + 1.1], [hw - 0.1, 2.25, hd + 1.1], [hw - 0.1, 2.75, hd], [-hw + 0.1, 2.75, hd], 'awn', W(1), 2);
  quad(T, [-hw + 0.1, 2.0, hd + 1.1], [hw - 0.1, 2.0, hd + 1.1], [hw - 0.1, 2.25, hd + 1.1], [-hw + 0.1, 2.25, hd + 1.1], 'awn', W(1), 2);
  return finishT(T, { x0: -hw, x1: hw, y0: S, y1: H + PARA, z0: -hd, z1: hd });
}
function tentTemplate() { // শামিয়ানা: চার খুঁটি, ডোরাকাটা চাঁদোয়া, নিচে টেবিলে সবজি
  const T = newT(), g = 2.6, rg = 3.7, bx = 2.4, bz = 2.2, rx = 1.0, wood = [0.45, 0.32, 0.2];
  for (const [x, z] of [[-2.1, -1.9], [2.1, -1.9], [-2.1, 1.9], [2.1, 1.9]]) boxT(T, x - 0.05, x + 0.05, 0, g, z - 0.05, z + 0.05, {}, wood);
  quad(T, [-bx, g, bz], [bx, g, bz], [rx, rg, 0], [-rx, rg, 0], 'awn', W(1), 1);
  quad(T, [bx, g, -bz], [-bx, g, -bz], [-rx, rg, 0], [rx, rg, 0], 'awn', W(1), 1);
  tri(T, [-bx, g, -bz], [-bx, g, bz], [-rx, rg, 0], 'awn', W(1), 1);
  tri(T, [bx, g, bz], [bx, g, -bz], [rx, rg, 0], 'awn', W(1), 1);
  quad(T, [-bx, g - 0.25, bz], [bx, g - 0.25, bz], [bx, g, bz], [-bx, g, bz], 'awn', W(1), 1);
  quad(T, [bx, g - 0.25, -bz], [-bx, g - 0.25, -bz], [-bx, g, -bz], [bx, g, -bz], 'awn', W(1), 1);
  quad(T, [-bx, g - 0.25, -bz], [-bx, g - 0.25, bz], [-bx, g, bz], [-bx, g, -bz], 'awn', W(1), 1);
  quad(T, [bx, g - 0.25, bz], [bx, g - 0.25, -bz], [bx, g, -bz], [bx, g, bz], 'awn', W(1), 1);
  boxT(T, -1.4, 1.4, 0, 0.85, -0.6, 0.6, { front: 'crate', back: 'crate', right: 'crate', left: 'crate' }, W(1));
  boxT(T, -1.1, -0.5, 0.85, 1.2, -0.3, 0.3, {}, [0.4, 0.7, 0.3]); boxT(T, -0.35, 0.25, 0.85, 1.15, -0.3, 0.3, {}, [0.9, 0.5, 0.2]); boxT(T, 0.5, 1.1, 0.85, 1.2, -0.3, 0.3, {}, [0.85, 0.25, 0.25]);
  return finishT(T, null);
}
function stallTemplate(v) { // ফলের স্টল: টেবিল, রঙিন ফলের স্তূপ, ছাতার মতো চাঁদোয়া
  const T = newT(), fr = [[0.95, 0.78, 0.2], [0.9, 0.35, 0.2], [0.45, 0.72, 0.3], [0.85, 0.2, 0.25], [0.95, 0.6, 0.15]], wood = [0.45, 0.32, 0.2];
  boxT(T, -1.1, 1.1, 0, 0.85, -0.55, 0.55, { front: 'crate' }, W(1));
  for (let i = 0; i < 5; i++) { const x = -0.9 + i * 0.45, c = fr[(i + v) % 5]; boxT(T, x - 0.18, x + 0.18, 0.85, 1.15, -0.2, 0.2, {}, c); }
  for (const [x, z, h] of [[-1.2, -0.55, 2.25], [1.2, -0.55, 2.25], [-1.2, 0.9, 1.85], [1.2, 0.9, 1.85]]) boxT(T, x - 0.04, x + 0.04, 0, h, z - 0.04, z + 0.04, {}, wood);
  quad(T, [-1.3, 1.85, 0.9], [1.3, 1.85, 0.9], [1.3, 2.25, -0.6], [-1.3, 2.25, -0.6], 'awn', W(1), 2);
  return finishT(T, null);
}
export function initBazaar() {
  for (const fl of [1, 2]) for (const cl of [0, 1]) SHOP[fl + '' + cl] = shopTemplate(fl, !!cl);
  TENT = tentTemplate();
  STALL = [0, 1, 2].map(stallTemplate);
}

// ---------- জায়গা: রাস্তা ধরে প্রতি ৪.৮ মিটারে একটা খোপ, দুই ধারে ----------
function slotInfo(axis, i, k, side) { // খোপের ধরন chunk-এর ওপর নির্ভর করে না, তাই সীমানার দুই পাশে মিলে যায়
  const r = mulberry32(((i * 73856093) ^ (k * 19349663) ^ (side > 0 ? 1013 : 2027) ^ (axis === 'z' ? 7 : 13) ^ SEED) >>> 0);
  const a = r(), tint = (r() * 7) | 0;
  return { type: a < 0.1 ? 'gap' : a < 0.19 ? 'tent' : 'shop', tint, tint2: (tint + 1 + ((r() * 5) | 0)) % 7, floors: r() < 0.3 ? 2 : 1, closed: r() < 0.2, sign: (r() * 8) | 0, stall: r() < 0.45, fruit: (r() * 3) | 0 };
}
function slotAt(axis, i, k) { // খোপের জায়গা: রাস্তার মাঝের বিন্দু (rx,rz) আর আড়াআড়ি দিক (Px,Pz)
  const t = k * STEP, c = roadCoord(axis, i, t);
  const sl = (roadCoord(axis, i, t + 1) - roadCoord(axis, i, t - 1)) / 2, n = Math.hypot(1, sl);
  const Tx = axis === 'z' ? sl / n : 1 / n, Tz = axis === 'z' ? 1 / n : sl / n;
  return { c, rx: axis === 'z' ? c : t, rz: axis === 'z' ? t : c, Px: Tz, Pz: -Tx };
}
export function bazaarLayout(cx, cz, cols) {
  const x0 = cx * CS, z0 = cz * CS, out = { shops: [], stalls: [], tents: [], garlands: [] };
  const inChunk = (x, z) => x >= x0 && x < x0 + CS && z >= z0 && z < z0 + CS;
  for (const axis of ['z', 'x']) {
    const other = axis === 'z' ? 'x' : 'z', lo = axis === 'z' ? x0 : z0, t0 = axis === 'z' ? z0 : x0;
    for (let i = Math.floor((lo - 110) / SP); i <= Math.ceil((lo + CS + 110) / SP); i++) {
      for (let k = Math.floor((t0 - 12) / STEP); k <= Math.ceil((t0 + CS + 12) / STEP); k++) {
        const { c, rx, rz, Px, Pz } = slotAt(axis, i, k), prev = slotAt(axis, i, k - 1);
        if (c < lo - 12 || c > lo + CS + 12) continue;
        const farR = distAxis(other, rx, rz) >= 13.5; // মোড়ের কাছে পতাকা নয়
        const infos = [slotInfo(axis, i, k, 1), slotInfo(axis, i, k, -1)];
        for (let q = 0; q < 2; q++) {
          const side = q ? -1 : 1, s = infos[q];
          if (s.type === 'gap') continue;
          const px = rx + side * Px * LAT, pz = rz + side * Pz * LAT;
          if (Math.hypot(px - (prev.rx + side * prev.Px * LAT), pz - (prev.rz + side * prev.Pz * LAT)) < 4.2) continue; // বাঁকের ভেতর দিকে গা ঘেঁষা হলে বাদ
          if (distAxis(other, px, pz) < 13.5) continue; // মোড়ের কাছে দোকান নয়: দুই রাস্তার সারি যেন না ঠোকে (দোকানের নিজের জায়গা ধরে মাপা)
          const sx = rx + side * Px * LAT_S, sz = rz + side * Pz * LAT_S;
          const inS = inChunk(px, pz), inT = s.type === 'shop' && s.stall && inChunk(sx, sz);
          if (!inS && !inT) continue;
          nearestRoad(px, pz);
          if (NR.d < 6.4) continue; // অন্য রাস্তা কাছে
          if (surfaceAt(px, pz) === 'water') continue;
          const ry = Math.atan2(-side * Px, -side * Pz); // রাস্তার দিকে মুখ
          if (inS) {
            const y = heightAt(px, pz) - 0.05;
            if (s.type === 'tent') { out.tents.push({ x: px, y, z: pz, ry, tint: s.tint }); cols.push({ x: px, z: pz, r: 2.6, hh: 3.8 }); }
            else { out.shops.push({ x: px, y, z: pz, ry, floors: s.floors, closed: s.closed, tint: s.tint, tint2: s.tint2, sign: s.sign }); cols.push({ x: px, z: pz, r: 2.7, hh: s.floors === 2 ? 7.9 : 4.9 }); }
          }
          if (inT) { out.stalls.push({ x: sx, y: heightAt(sx, sz), z: sz, ry, v: s.fruit, tint: s.tint2 }); cols.push({ x: sx, z: sz, r: 1.3, hh: 2.4 }); }
        }
        if (farR && k % 4 === 0 && infos[0].type !== 'gap' && infos[1].type !== 'gap' && inChunk(rx, rz)) { // পতাকার মালা: রাস্তা পেরিয়ে
          const ax = rx - Px * 5, az = rz - Pz * 5, bx = rx + Px * 5, bz = rz + Pz * 5;
          out.garlands.push({ x0: ax, z0: az, x1: bx, z1: bz, gy0: heightAt(ax, az), gy1: heightAt(bx, bz) });
        }
      }
    }
  }
  return out;
}

// ---------- আঁকা ----------
function signAt(acc, s, H) { // ছাদের আলসের ওপর বাংলা সাইনবোর্ড (২:১ মাপ, লেখা চ্যাপ্টা হয় না)
  const T = newT(), hd = SD / 2, b = H + PARA;
  boxT(T, -1.3, 1.3, b, b + 1.3, hd - 0.4, hd - 0.3, { front: 'sg' + s.sign, back: 'plain' }, W(1));
  for (const x of [-1.0, 1.0]) boxT(T, x - 0.04, x + 0.04, H, b + 0.1, hd - 0.38, hd - 0.32, {}, [0.4, 0.4, 0.42]);
  stamp(acc, finishT(T, null), s.x, s.y, s.z, s.ry, W(1), W(1));
}
const FLAG = [[0.9, 0.25, 0.2], [0.95, 0.8, 0.2], [0.3, 0.65, 0.35], [0.3, 0.5, 0.85], [0.9, 0.45, 0.7]];
function garland(acc, g) {
  const T = newT(), N = 13, sag = 1.0, y0 = g.gy0 + 5.0, y1 = g.gy1 + 5.0;
  const P = s => [g.x0 + (g.x1 - g.x0) * s, y0 + (y1 - y0) * s - sag * 4 * s * (1 - s), g.z0 + (g.z1 - g.z0) * s];
  boxT(T, g.x0 - 0.07, g.x0 + 0.07, g.gy0, y0 + 0.3, g.z0 - 0.07, g.z0 + 0.07, {}, [0.55, 0.45, 0.25]); // বাঁশের খুঁটি
  boxT(T, g.x1 - 0.07, g.x1 + 0.07, g.gy1, y1 + 0.3, g.z1 - 0.07, g.z1 + 0.07, {}, [0.55, 0.45, 0.25]);
  for (let i = 0; i < N; i++) {
    const a = P(i / N), b = P((i + 1) / N), s0 = P((i + 0.12) / N), s1 = P((i + 0.88) / N), m = P((i + 0.5) / N), tip = [m[0], m[1] - 0.6, m[2]], rope = [0.25, 0.2, 0.15];
    quad(T, a, b, [b[0], b[1] + 0.05, b[2]], [a[0], a[1] + 0.05, a[2]], 'plain', rope); // দড়ি, দুই দিকেই দেখা যায়
    quad(T, b, a, [a[0], a[1] + 0.05, a[2]], [b[0], b[1] + 0.05, b[2]], 'plain', rope);
    tri(T, s0, s1, tip, 'plain', FLAG[i % 5]); tri(T, s1, s0, tip, 'plain', FLAG[i % 5]); // ত্রিকোণা পতাকা
  }
  pour(acc, T);
}

export function bazaarDecorate(mesh, ex) {
  if (!ex.shops.length && !ex.stalls.length && !ex.tents.length && !ex.garlands.length) return;
  const acc = newAcc();
  for (const s of ex.shops) {
    stamp(acc, SHOP[s.floors + '' + (s.closed ? 1 : 0)], s.x, s.y, s.z, s.ry, TINTS[s.tint], TINTS[s.tint2]);
    signAt(acc, s, G1 + (s.floors - 1) * UF);
  }
  for (const s of ex.tents) stamp(acc, TENT, s.x, s.y, s.z, s.ry, TINTS[s.tint], W(1));
  for (const s of ex.stalls) stamp(acc, STALL[s.v], s.x, s.y, s.z, s.ry, W(1), TINTS[s.tint]);
  for (const g of ex.garlands) garland(acc, g);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(acc.p), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(acc.n), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(acc.c), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(acc.u), 2));
  const body = new THREE.Mesh(geo, facadeMat);
  body.castShadow = body.receiveShadow = true;
  body.userData.own = true; // chunk সরলে জিওমেট্রি ছাড়া হয়
  mesh.add(body);
  if (acc.sp.length) {
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(acc.sp), 3));
    const shell = new THREE.Mesh(sg, inkMat);
    shell.userData.own = true;
    mesh.add(shell);
  }
}
