import * as THREE from 'three';
import { WATER, SP } from './config.js';
import { mulberry32, SEED } from './rng.js';
import { simplex } from './noise.js';

function baseHeight(x, z) { return simplex(x * 0.006, z * 0.006) * 1.0 + simplex(x * 0.02, z * 0.02) * 0.3; }
function rawHeight(x, z) {
  let h = baseHeight(x, z);
  const hill = THREE.MathUtils.smoothstep(simplex(x * 0.0025 + 900, z * 0.0025 - 400), 0.45, 0.8);
  if (hill > 0) h += hill * (5 + (simplex(x * 0.012, z * 0.012) * 0.5 + 0.5) * 10);
  const pond = THREE.MathUtils.smoothstep(simplex(x * 0.015 + 300, z * 0.015 + 700), 0.5, 0.75);
  return h - pond * 7;
}

const RP = new Map();
function roadParams(axis, i) {
  const key = (i + 5000) * 2 + (axis === 'z' ? 0 : 1);
  let q = RP.get(key);
  if (!q) {
    const r = mulberry32(((i * 92821) ^ (axis === 'z' ? 7 : 13) ^ SEED) >>> 0);
    q = i === 0 ? { off: 0, p1: 0, p2: 0, a1: 28, a2: 7 } // শূন্য নম্বর রাস্তা শুরুর বিন্দু দিয়ে যায়
      : { off: (r() - 0.5) * 70, p1: r() * 6.283, p2: r() * 6.283, a1: 18 + r() * 22, a2: 4 + r() * 6 };
    RP.set(key, q);
  }
  return q;
}
// axis 'z': রাস্তা x = f(z); axis 'x': রাস্তা z = f(x); t = চলার দিকের স্থানাঙ্ক
export function roadCoord(axis, i, t) {
  const q = roadParams(axis, i);
  return i * SP + q.off + Math.sin(t * 0.011 + q.p1) * q.a1 + Math.sin(t * 0.029 + q.p2) * q.a2;
}
export const NR = { d: 1e9, axis: 'z', idx: 0, cross: 0, t: 0 };
const NR2 = { d: 0, idx: 0, cross: 0 };
export function distAxis(axis, x, z) { // এক দিকের রাস্তাগুলোর মধ্যে সবচেয়ে কাছেরটা (ফল NR2-তে)
  const c = axis === 'z' ? x : z, t = axis === 'z' ? z : x, k = Math.round(c / SP);
  let best = 1e9, bi = k, bc = 0;
  for (let i = k - 1; i <= k + 1; i++) {
    const rc = roadCoord(axis, i, t), d = Math.abs(c - rc);
    if (d < best) { best = d; bi = i; bc = rc; }
  }
  NR2.d = best; NR2.idx = bi; NR2.cross = bc;
  return best;
}
export function nearestRoad(x, z) { // সব রাস্তার মধ্যে সবচেয়ে কাছেরটা (ফল NR-এ)
  const dz = distAxis('z', x, z), iz = NR2.idx, cz = NR2.cross;
  const dx = distAxis('x', x, z);
  if (dz <= dx) { NR.d = dz; NR.axis = 'z'; NR.idx = iz; NR.cross = cz; NR.t = z; }
  else { NR.d = dx; NR.axis = 'x'; NR.idx = NR2.idx; NR.cross = NR2.cross; NR.t = x; }
}
export function roadYaw(axis, i, t) { // রাস্তার দিকে মুখ ঘোরানোর কোণ
  const s = (roadCoord(axis, i, t + 1) - roadCoord(axis, i, t - 1)) / 2;
  return axis === 'z' ? Math.atan2(s, 1) : Math.atan2(1, s);
}

// রাস্তার কাছে জমি সমতল করে দেওয়া, নিচু জায়গায় পানি
// ---------- ৪ঘ: হাইওয়ে-রাস্তা আর রেললাইন ----------
// হাইওয়ে: কিছু রাস্তা (প্রায় ৪০%, শূন্য নম্বর নয়) পুরোটাই হাইওয়ে-শ্রেণির; যেখানে এলাকা-মান ০.৩-এর নিচে (মোড় থেকে দূরে) সেখানেই হাইওয়ের চেহারা
export const HWY_Z = 0.3;
export const isHwyRoad = (axis, i) => i !== 0 && mulberry32(((i * 51787) ^ (axis === 'z' ? 3 : 5) ^ SEED ^ 0x4119) >>> 0)() < 0.4;
// রেললাইন: x-দিকে চলা, প্রতি রাস্তা-সারির ঠিক মাঝখানে (z = (j+0.5)*SP), ঢেউ খেলানো, প্রায় ৪০% সারিতে
export const railOn = j => mulberry32(((j * 48271) ^ SEED ^ 0x7a11) >>> 0)() < 0.4;
export const railZ = (j, x) => (j + 0.5) * SP + Math.sin(x * 0.007 + j * 2.3) * 12;
export function railDist(x, z) { // সবচেয়ে কাছের রেললাইন থেকে দূরত্ব (নেই হলে 1e9); সারি নম্বর RAIL_J-তে
  const j = Math.round(z / SP - 0.5);
  if (!railOn(j)) return 1e9;
  RAIL_J.j = j;
  return Math.abs(z - railZ(j, x));
}
export const RAIL_J = { j: 0 };

export function heightAt(x, z) {
  nearestRoad(x, z);
  const h = rawHeight(x, z);
  let out;
  if (NR.d >= 32) out = Math.max(h, WATER);
  else {
    const t = THREE.MathUtils.smoothstep(NR.d, 5, 32); // রাস্তা সবসময় সমতল-স্তরে, টিলা পাশে ধীরে ওঠে
    const rc = NR.axis === 'z' ? baseHeight(NR.cross, z) : baseHeight(x, NR.cross);
    out = Math.max(THREE.MathUtils.lerp(Math.max(rc, WATER + 0.8), h, t), WATER);
  }
  const dr = railDist(x, z); // রেললাইনের নিচেও জমি সমতল; রাস্তার সাথে মিলনে একই baseHeight, তাই ক্রসিং সমান
  if (dr < 22) {
    const rb = Math.max(baseHeight(x, railZ(RAIL_J.j, x)), WATER + 0.8);
    out = Math.max(THREE.MathUtils.lerp(rb, out, THREE.MathUtils.smoothstep(dr, 3, 22)), WATER);
  }
  return out;
}
export function surfaceAt(x, z) {
  if (heightAt(x, z) <= WATER + 0.05) return 'water';
  return NR.d < 3.2 ? 'road' : 'grass';
}

export function zoneAt(x, z) { // মোড়ের কাছে শহর/গ্রাম; শুরুর মোড় সবসময় গ্রাম
  const i = Math.round(x / SP), j = Math.round(z / SP);
  const dn = Math.hypot(x - i * SP, z - j * SP);
  const big = (i === 0 && j === 0) ? 0 : mulberry32(((i * 92821) ^ (j * 68917) ^ SEED) >>> 0)();
  return (big > 0.45 ? 1 : 0.55) - dn / 120 + simplex(x * 0.01, z * 0.01) * 0.25;
}
