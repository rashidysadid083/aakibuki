import * as THREE from 'three';
import { CS, SP } from './config.js';
import { mulberry32, SEED } from './rng.js';
import { roadCoord, distAxis, zoneAt, heightAt, isHwyRoad, HWY_Z, railOn, railZ, railDist } from './terrain.js';
import { facadeMat, newT, quad, boxT, newAcc, stamp, pour, finishT } from './facade.js';

// ---------- ৪ঘ হাইওয়ে ----------
// হাইওয়ে-শ্রেণির রাস্তা মোড় থেকে দূরে (এলাকা-মান < ০.৩) হাইওয়ের চেহারা পায়: সাদা-হলুদ দাগ (roads.js), গার্ডরেল, দুই ধারে গাছের সারি, মাঝে মাঝে ওভারব্রিজ।
// রেললাইন আলাদা: x-দিকে চলে, রাস্তা-সারির মাঝখানে (terrain.js); রাস্তা পেরোনোর জায়গায় ক্রসিং-সাইন।
// এক chunk-এর সব জিনিস একটা মেশে (facade atlas-এর plain ঘর + ভার্টেক্স রঙ), তাই draw call মাত্র ১টা; গাছ আলাদা InstancedMesh (চলতি TREE)।
const GUARD_O = 4.6, TREE_O = 8.4, BLK = 300; // গার্ডরেল/গাছের সারির আড়াআড়ি দূরত্ব, সেতুর ব্লক (মিটার)
const hash3 = (a, b, c) => (Math.imul((a * 73 + b * 131 + c * 17) ^ SEED, 2654435761) >>> 0) / 4294967296;

function bridgeT(axis, i, b) { // এই ব্লকে সেতু থাকলে তার দূরত্ব-স্থানাঙ্ক (প্রায় ৮০%), নইলে null
  const r = mulberry32(((i * 92821) ^ (b * 68917) ^ (axis === 'z' ? 11 : 17) ^ SEED) >>> 0);
  if (r() > 0.8) return null;
  return b * BLK + 90 + r() * 120;
}

// রাস্তার একটা বিন্দুর অবস্থান + আড়াআড়ি দিক (bazaar.js-এর slotAt-এর মতো)
function frame(axis, i, t) {
  const c = roadCoord(axis, i, t), sl = (roadCoord(axis, i, t + 1) - roadCoord(axis, i, t - 1)) / 2, n = Math.hypot(1, sl);
  const Tx = axis === 'z' ? sl / n : 1 / n, Tz = axis === 'z' ? 1 / n : sl / n;
  return { rx: axis === 'z' ? c : t, rz: axis === 'z' ? t : c, Tx, Tz, Px: Tz, Pz: -Tx };
}

export function hwyLayout(cx, cz, cols, trees) {
  const x0 = cx * CS, z0 = cz * CS;
  const out = { hasHwy: false, guard: [], posts: [], bridges: [], tracks: [], crossings: [] };
  const inChunk = (x, z) => x >= x0 && x < x0 + CS && z >= z0 && z < z0 + CS;
  for (const axis of ['z', 'x']) {
    const other = axis === 'z' ? 'x' : 'z', lo = axis === 'z' ? x0 : z0, t0 = axis === 'z' ? z0 : x0;
    for (let i = Math.floor((lo - 110) / SP); i <= Math.ceil((lo + CS + 110) / SP); i++) {
      if (!isHwyRoad(axis, i)) continue;
      // ক) গার্ডরেল আর গাছের সারি: roads.js-এর মতো ২ মিটারের টুকরো, প্রতিটা টুকরো একটা chunk-এর
      for (let t = t0; t < t0 + CS; t += 2) {
        const ca = roadCoord(axis, i, t), cb = roadCoord(axis, i, t + 2), cm = (ca + cb) / 2;
        if (cm < lo || cm >= lo + CS) continue;
        const xa = axis === 'z' ? ca : t, za = axis === 'z' ? t : ca, xb = axis === 'z' ? cb : t + 2, zb = axis === 'z' ? t + 2 : cb;
        if (zoneAt((xa + xb) / 2, (za + zb) / 2) >= HWY_Z) continue;
        out.hasHwy = true;
        const n = Math.round(t / 2), tb = bridgeT(axis, i, Math.floor(t / BLK)), dB = tb === null ? 1e9 : Math.abs(t - tb);
        const rd = railDist((xa + xb) / 2, (za + zb) / 2), od = distAxis(other, (xa + xb) / 2, (za + zb) / 2); // রেল আর কাটাকাটি রাস্তার দূরত্ব
        const gap = ((n % 22) + 22) % 22 < 3 || dB < 8 || rd < 10 || od < 10; // ফাঁক: গাড়ি/মানুষ বেরোতে পারে; সেতু, রেল আর মোড়ের কাছেও নেই
        const ya = heightAt(xa, za), yb = heightAt(xb, zb);
        const at = (o, x, y, z) => axis === 'z' ? [x + o, y, z] : [x, y, z + o];
        if (!gap) for (const s of [1, -1]) {
          out.guard.push([at(s * GUARD_O, xa, ya, za), at(s * GUARD_O, xb, yb, zb)]);
          if (n % 2 === 0) { const p = at(s * GUARD_O, xa, ya, za); out.posts.push({ x: p[0], y: p[1], z: p[2] }); cols.push({ x: p[0], z: p[2], r: 0.4, hh: 1.2 }); }
        }
        if (n % 4 === 1 && dB > 14 && rd > 12 && od > 13) for (const s of [1, -1]) { // দুই ধারে গাছের সারি
          const h = hash3(n, i, s + 7), o = s * (TREE_O + (h - 0.5) * 1.6), x = axis === 'z' ? xa + o : xa, z = axis === 'z' ? za : za + o, sc = 1 + h * 0.35;
          trees.push({ x, z, y: heightAt(x, z), ry: h * 6.283, s: sc });
          cols.push({ x, z, r: 0.6 * sc });
        }
      }
      // খ) ওভারব্রিজ: ৩০০ মিটারের ব্লকে প্রায় অর্ধেকে একটা; আড়াআড়ি দিকে ১৩ মিটার ডেক + দুই ধারে ১২ মিটার সিঁড়ি
      for (let b = Math.floor(t0 / BLK) - 1; b <= Math.floor((t0 + CS) / BLK) + 1; b++) {
        const tb = bridgeT(axis, i, b);
        if (tb === null || tb < t0 || tb >= t0 + CS) continue;
        const f = frame(axis, i, tb), c = axis === 'z' ? f.rx : f.rz;
        if (c < lo || c >= lo + CS || zoneAt(f.rx, f.rz) >= HWY_Z || railDist(f.rx, f.rz) < 30 || distAxis(other, f.rx, f.rz) < 40) continue;
        const y0 = heightAt(f.rx, f.rz), foot = s => THREE.MathUtils.clamp(heightAt(f.rx + s * f.Px * 18.6, f.rz + s * f.Pz * 18.6) - y0, -2.5, 4.4);
        out.bridges.push({ x: f.rx, y: y0, z: f.rz, ry: Math.atan2(-f.Pz, f.Px), eP: foot(1), eN: foot(-1) });
        for (const s of [1, -1]) cols.push({ x: f.rx + s * f.Px * 5.6, z: f.rz + s * f.Pz * 5.6, r: 0.9, hh: 6 });
      }
    }
  }
  // গ) রেললাইন: এই chunk-এর z-পাল্লায় পড়া সারিগুলো, ২ মিটারের টুকরোয়
  for (let j = Math.round((z0 - 14) / SP - 0.5); j <= Math.round((z0 + CS + 14) / SP - 0.5); j++) {
    if (!railOn(j)) continue;
    const nodes = [];
    for (let x = x0; x <= x0 + CS; x += 2) { const z = railZ(j, x); nodes.push({ x, z, y: heightAt(x, z) }); }
    const segs = [];
    for (let k = 0; k < nodes.length - 1; k++) { const zm = (nodes[k].z + nodes[k + 1].z) / 2; if (zm >= z0 && zm < z0 + CS) segs.push([nodes[k], nodes[k + 1]]); }
    if (segs.length) out.tracks.push(segs);
    // ঘ) রেল ক্রসিং: প্রতিটা উত্তর-দক্ষিণ রাস্তার (axis z) সাথে মিলন; লাইন আর রাস্তার ছেদ কয়েক ধাপে বের করা
    for (let i = Math.floor((x0 - 110) / SP); i <= Math.ceil((x0 + CS + 110) / SP); i++) {
      let x = i * SP;
      for (let q = 0; q < 5; q++) x = roadCoord('z', i, railZ(j, x));
      const z = railZ(j, x);
      if (!inChunk(x, z)) continue;
      const f = frame('z', i, z), y = heightAt(x, z);
      out.crossings.push({ x, y, z, Tx: f.Tx, Tz: f.Tz, Px: f.Px, Pz: f.Pz });
      for (const a of [3.8, -3.8]) for (const s of [3.9, -3.9]) cols.push({ x: x + f.Tx * a + f.Px * s, z: z + f.Tz * a + f.Pz * s, r: 0.25, hh: 3 });
    }
  }
  return out;
}

// ---------- আঁকা ----------
const CON = [0.74, 0.72, 0.68], DK = [0.6, 0.58, 0.55], GRN = [0.3, 0.55, 0.42], STEEL = [0.5, 0.52, 0.56];
function bridgeLocal(eP, eN) { // স্থানীয় x = সেতুর দৈর্ঘ্য (রাস্তার আড়াআড়ি), z = প্রস্থ, y = মাটি থেকে ওপরে
  const T = newT(), D0 = 5.0, D1 = 5.3, HL = 6.6, HW = 1.1, RL = 12;
  boxT(T, -HL, HL, D0, D1, -HW, HW, {}, CON); // ডেক
  for (const x of [-5.6, 5.6]) for (const z of [-0.65, 0.65]) boxT(T, x - 0.3, x + 0.3, -1.2, D0, z - 0.3, z + 0.3, {}, CON); // চার খুঁটি
  for (const z of [-1.0, 1.0]) { // রেলিং
    boxT(T, -HL, HL, D1 + 0.95, D1 + 1.05, z - 0.04, z + 0.04, {}, GRN);
    boxT(T, -HL, HL, D1 + 0.5, D1 + 0.58, z - 0.03, z + 0.03, {}, GRN);
    for (let x = -HL + 0.3; x <= HL; x += 1.6) boxT(T, x - 0.04, x + 0.04, D1, D1 + 1.0, z - 0.04, z + 0.04, {}, GRN);
  }
  for (const [side, e] of [[1, eP], [-1, eN]]) { // দুই দিকের সিঁড়ি-ঢাল (ধাপের দাগ 'shut' ঘরের আড়াআড়ি রেখা)
    const xN = side * HL, xF = side * (HL + RL), zA = side * -HW, zB = side * HW;
    quad(T, [xN, D1, zA], [xN, D1, zB], [xF, e, zB], [xF, e, zA], 'shut', DK);
    for (const z of [-HW, HW]) { // পাশের পাড়, দুই মুখেই আঁকা
      const a = [xN, D1 - 0.25, z], b = [xF, e - 0.25, z], c = [xF, e, z], d = [xN, D1, z];
      quad(T, a, b, c, d, 'plain', CON); quad(T, b, a, d, c, 'plain', CON);
    }
    boxT(T, side * (HL + RL / 2) - 0.3, side * (HL + RL / 2) + 0.3, Math.min(e, D1) - 0.6, (D1 + e) / 2 - 0.3, -0.5, 0.5, {}, CON); // মাঝের খুঁটি
  }
  return finishT(T, null);
}
function crossbuckLocal() { // রেল ক্রসিং-এর খুঁটি: সাদা X-বোর্ড আর লাল বাতি, সামনে +z
  const T = newT(), W = [0.96, 0.96, 0.94], RED = [0.85, 0.15, 0.12];
  boxT(T, -0.05, 0.05, 0, 2.6, -0.05, 0.05, {}, [0.9, 0.9, 0.88]);
  for (const th of [0.6, -0.6]) { // দুটো ঘোরানো বোর্ড; সামনে-পেছনে দুই মুখ
    const hx = 0.62, hy = 0.09, cs = Math.cos(th), sn = Math.sin(th), P = (x, y, z) => [x * cs - y * sn, 2.3 + x * sn + y * cs, z];
    quad(T, P(-hx, -hy, 0.07), P(hx, -hy, 0.07), P(hx, hy, 0.07), P(-hx, hy, 0.07), 'plain', W);
    quad(T, P(hx, -hy, -0.07), P(-hx, -hy, -0.07), P(-hx, hy, -0.07), P(hx, hy, -0.07), 'plain', W);
  }
  boxT(T, -0.3, -0.1, 1.55, 1.75, 0.0, 0.14, {}, RED); boxT(T, 0.1, 0.3, 1.55, 1.75, 0.0, 0.14, {}, RED);
  return finishT(T, null);
}
let XBUCK = null;

function addTrack(T, segs) {
  const BAL = [0.6, 0.55, 0.5], SLP = [0.42, 0.3, 0.2];
  for (const [A, B] of segs) {
    const ya = A.y + 0.06, yb = B.y + 0.06, xa = A.x, xb = B.x, za = A.z, zb = B.z;
    quad(T, [xa, ya + 0.16, za - 1.75], [xa, ya + 0.16, za + 1.75], [xb, yb + 0.16, zb + 1.75], [xb, yb + 0.16, zb - 1.75], 'plain', BAL); // গিট্টির ওপর
    quad(T, [xa, ya + 0.16, za - 1.75], [xb, yb + 0.16, zb - 1.75], [xb, yb - 0.12, zb - 2.4], [xa, ya - 0.12, za - 2.4], 'plain', BAL); // দুই ঢাল
    quad(T, [xa, ya - 0.12, za + 2.4], [xb, yb - 0.12, zb + 2.4], [xb, yb + 0.16, zb + 1.75], [xa, ya + 0.16, za + 1.75], 'plain', BAL);
    for (const zc of [-0.72, 0.72]) { // দুই রেল: মাথা + দুই পাশ
      const l = zc - 0.05, r = zc + 0.05;
      quad(T, [xa, ya + 0.4, za + l], [xa, ya + 0.4, za + r], [xb, yb + 0.4, zb + r], [xb, yb + 0.4, zb + l], 'plain', STEEL);
      quad(T, [xb, yb + 0.26, zb + l], [xa, ya + 0.26, za + l], [xa, ya + 0.4, za + l], [xb, yb + 0.4, zb + l], 'plain', STEEL);
      quad(T, [xa, ya + 0.26, za + r], [xb, yb + 0.26, zb + r], [xb, yb + 0.4, zb + r], [xa, ya + 0.4, za + r], 'plain', STEEL);
    }
    for (const f of [0.25, 0.75]) { // স্লিপার
      const x = xa + (xb - xa) * f, y = ya + (yb - ya) * f, z = za + (zb - za) * f;
      boxT(T, x - 0.11, x + 0.11, y + 0.16, y + 0.26, z - 1.15, z + 1.15, {}, SLP);
    }
  }
}

export function hwyDecorate(mesh, ex) {
  if (!ex.guard.length && !ex.posts.length && !ex.bridges.length && !ex.tracks.length && !ex.crossings.length) return;
  const T = newT(), acc = newAcc(), GR = [0.78, 0.8, 0.82];
  for (const [A, B] of ex.guard) { // গার্ডরেল: দুই মুখ দেখা যায় এমন পাতলা ফিতা
    const a0 = [A[0], A[1] + 0.5, A[2]], b0 = [B[0], B[1] + 0.5, B[2]], b1 = [B[0], B[1] + 0.85, B[2]], a1 = [A[0], A[1] + 0.85, A[2]];
    quad(T, a0, b0, b1, a1, 'plain', GR); quad(T, b0, a0, a1, b1, 'plain', GR);
  }
  for (const p of ex.posts) boxT(T, p.x - 0.06, p.x + 0.06, p.y, p.y + 0.9, p.z - 0.06, p.z + 0.06, {}, [0.45, 0.45, 0.48]);
  for (const segs of ex.tracks) addTrack(T, segs);
  pour(acc, T);
  for (const b of ex.bridges) stamp(acc, bridgeLocal(b.eP, b.eN), b.x, b.y, b.z, b.ry, [1, 1, 1], [1, 1, 1]);
  if (ex.crossings.length) {
    XBUCK = XBUCK || crossbuckLocal();
    for (const c of ex.crossings) for (const a of [3.8, -3.8]) for (const s of [3.9, -3.9]) // রেল-লাইনের দুই পাশে, রাস্তার দুই কিনারায়; সামনের মুখ চালকের দিকে
      stamp(acc, XBUCK, c.x + c.Tx * a + c.Px * s, c.y, c.z + c.Tz * a + c.Pz * s, Math.atan2(c.Tx * Math.sign(a), c.Tz * Math.sign(a)), [1, 1, 1], [1, 1, 1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(acc.p), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(acc.n), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(acc.c), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(acc.u), 2));
  const body = new THREE.Mesh(geo, facadeMat);
  body.receiveShadow = true;
  body.userData.own = true; // chunk সরলে জিওমেট্রি ছাড়া হয়
  mesh.add(body);
}
