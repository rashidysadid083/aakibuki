import * as THREE from 'three';
import { bands } from './core.js';
import { mulberry32 } from './rng.js';

// ---------- দালান ও দোকানের সামনের অংশ: একটাই ৫১২px atlas (canvas-এ আঁকা), হালকা নিরপেক্ষ রঙ ----------
// atlas-এর রঙ হালকা রাখা, কারণ প্রতিটা দালান/দোকানের আলাদা রঙ আসে ভার্টেক্স-রঙের গুণ থেকে।
const AT = 512;
const RECT = {
  plain: [0, 0, 128, 128], win: [128, 0, 128, 128], balc: [256, 0, 128, 128], ac: [384, 0, 128, 128],
  shut: [0, 128, 128, 128], shop: [128, 128, 128, 128], door: [256, 128, 128, 128], glass: [384, 128, 128, 128],
  awn: [0, 256, 128, 64], crate: [128, 256, 128, 64],
  bb0: [256, 256, 256, 64], bb1: [0, 320, 256, 64], bb2: [256, 320, 256, 64]
};
for (let i = 0; i < 8; i++) RECT['sg' + i] = [(i % 4) * 128, 384 + ((i / 4) | 0) * 64, 128, 64]; // ৮টা বাংলা সাইনবোর্ড
export const CELL = {};
for (const k in RECT) { // প্রতিটা ঘরের UV, কিনারা থেকে দেড় পিক্সেল ভেতরে (পাশের ঘরের রঙ যাতে না মেশে)
  const [x, y, w, h] = RECT[k], e = 1.5;
  CELL[k] = [(x + e) / AT, 1 - (y + h - e) / AT, (x + w - e) / AT, 1 - (y + e) / AT];
}
const SIGNS = [['মিষ্টির দোকান', '#d8453a', '#fff'], ['ফার্মেসি', '#2f8f5a', '#fff'], ['চায়ের স্টল', '#f0c24a', '#4a2a10'], ['ফলের আড়ত', '#e8863a', '#fff'],
  ['কাপড় ঘর', '#7a4fa0', '#fff'], ['বই মহল', '#2f6fa8', '#fff'], ['মাছ বাজার', '#1f7f8f', '#fff'], ['সবজি ঘর', '#5a9a3a', '#fff']];
const FONT = '"Noto Sans Bengali","Hind Siliguri","Kalpurush",sans-serif';

export let facadeMat = null;
export function initFacade() {
  const c = document.createElement('canvas');
  c.width = c.height = AT;
  const g = c.getContext('2d'), rnd = mulberry32(31415);
  const cell = (k, fn) => { const [x, y, w, h] = RECT[k]; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); fn(w, h); g.restore(); };
  const wall = (w, h, col) => { // দেয়ালের জমিন + কাগজের দানা
    g.fillStyle = col || '#f4f1ea'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < w * h / 160; i++) { g.fillStyle = 'rgba(120,110,90,0.07)'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  };
  const windowAt = (x, y, w, h) => {
    g.fillStyle = '#d9d4c8'; g.fillRect(x - 6, y - 8, w + 12, 6); // ওপরের কার্নিশ
    g.fillStyle = '#6a655d'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
    g.fillStyle = '#8ea3b4'; g.fillRect(x, y, w, h);
    g.fillStyle = '#b6c6d2'; g.beginPath(); g.moveTo(x, y + h * 0.55); g.lineTo(x + w * 0.55, y); g.lineTo(x + w * 0.8, y); g.lineTo(x, y + h * 0.8); g.fill();
    g.fillStyle = '#6a655d'; g.fillRect(x + w / 2 - 1.5, y, 3, h); g.fillRect(x, y + h * 0.42, w, 3);
    g.fillStyle = '#cfc9bd'; g.fillRect(x - 6, y + h + 3, w + 12, 6); // নিচের পাটা
  };
  cell('plain', (w, h) => wall(w, h));
  cell('win', (w, h) => { wall(w, h); windowAt(16, 30, 40, 56); windowAt(72, 30, 40, 56); });
  cell('balc', (w, h) => {
    wall(w, h); windowAt(44, 22, 40, 62);
    g.fillStyle = '#cfc9bd'; g.fillRect(0, 104, w, 14); g.fillStyle = '#9d978a'; g.fillRect(0, 104, w, 2); // বারান্দার স্ল্যাব
    g.fillStyle = '#5c574f'; g.fillRect(8, 84, w - 16, 4);
    for (let x = 10; x < w - 8; x += 8) g.fillRect(x, 88, 2, 16);
  });
  cell('ac', (w, h) => {
    wall(w, h); windowAt(14, 30, 46, 56);
    g.fillStyle = '#bfc3c6'; g.fillRect(78, 50, 38, 26); g.strokeStyle = '#8d9296'; g.lineWidth = 2; // এসি-র বাক্স
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(82, 55 + i * 4.5); g.lineTo(112, 55 + i * 4.5); g.stroke(); }
    g.strokeStyle = '#8a857c'; g.beginPath(); g.moveTo(96, 76); g.lineTo(96, 100); g.stroke();
  });
  cell('shut', (w, h) => {
    wall(w, h, '#e8e3d6'); g.fillStyle = '#c9c4b6'; g.fillRect(8, 18, 112, 100);
    g.fillStyle = '#aaa596'; for (let y = 22; y < 118; y += 5) g.fillRect(8, y, 112, 1.5);
    g.fillStyle = '#5c574f'; g.fillRect(58, 108, 12, 5);
  });
  cell('shop', (w, h) => {
    wall(w, h); g.fillStyle = '#4c443b'; g.fillRect(10, 10, 108, 108);
    g.fillStyle = '#b58b57'; g.fillRect(10, 86, 108, 32); g.fillStyle = '#8a6238'; g.fillRect(10, 86, 108, 3);
    const cols = ['#e0524a', '#e8b83a', '#5aa04a', '#4a7ac0', '#d88a3a'];
    for (let r = 0; r < 3; r++) {
      g.fillStyle = '#7a6a55'; g.fillRect(10, 40 + r * 20, 108, 3);
      for (let i = 0; i < 7; i++) { g.fillStyle = cols[(rnd() * 5) | 0]; g.fillRect(16 + i * 15, 28 + r * 20, 11, 12); }
    }
  });
  cell('door', (w, h) => {
    wall(w, h);
    for (let i = 0; i < 2; i++) {
      const x = 14 + i * 58; g.fillStyle = '#4c443b'; g.fillRect(x, 40, 42, 88);
      g.beginPath(); g.ellipse(x + 21, 40, 21, 18, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#8a6a45'; g.fillRect(x + 4, 60, 34, 68);
    }
  });
  cell('glass', (w, h) => {
    wall(w, h, '#e9e5da'); g.fillStyle = '#8ea3b4'; g.fillRect(0, 24, w, 70);
    g.fillStyle = '#b6c6d2'; g.beginPath(); g.moveTo(0, 80); g.lineTo(60, 24); g.lineTo(90, 24); g.lineTo(20, 94); g.lineTo(0, 94); g.fill();
    g.fillStyle = '#6a655d'; for (let x = 0; x < w; x += 32) g.fillRect(x, 24, 3, 70);
    g.fillStyle = '#d3cdbf'; g.fillRect(0, 94, w, 10); g.fillRect(0, 18, w, 6);
  });
  cell('awn', (w, h) => { // ডোরাকাটা চাঁদোয়া, নিচে ঢেউ
    for (let i = 0; i < 8; i++) { g.fillStyle = i & 1 ? '#c9c5b8' : '#ffffff'; g.fillRect(i * 16, 0, 16, 50); g.beginPath(); g.arc(i * 16 + 8, 50, 8, 0, Math.PI); g.fill(); }
  });
  cell('crate', (w, h) => {
    g.fillStyle = '#b98a56'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a6238';
    for (let y = 22; y < h; y += 14) g.fillRect(0, y, w, 3);
    for (let x = 0; x < w; x += 32) g.fillRect(x, 22, 3, h - 22);
    const fr = ['#f0c040', '#e8863a', '#d8453a', '#7ab648'];
    for (let x = 8; x < w; x += 14) { g.fillStyle = fr[(rnd() * 4) | 0]; g.beginPath(); g.arc(x, 12, 7, 0, 6.283); g.fill(); }
  });
  const fitText = (txt, w, h, size) => { // লেখা প্যানেলে আঁটে এমন মাপ বেছে কেন্দ্রে বসায়
    let s = size; g.font = 'bold ' + s + 'px ' + FONT;
    while (g.measureText(txt).width > w - 16 && s > 10) { s -= 2; g.font = 'bold ' + s + 'px ' + FONT; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2);
  };
  const board = (k, txt, bg, fg, size) => cell(k, (w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = fg; fitText(txt, w, h, size);
  });
  board('bb0', 'সেরা দামে সেরা পণ্য', '#f0c24a', '#5a2a10', 30);
  board('bb1', 'ঘরে ঘরে ইন্টারনেট', '#2f8f8a', '#ffffff', 30);
  board('bb2', 'নতুন আয়োজন, নতুন স্বাদ', '#c8453a', '#ffffff', 28);
  SIGNS.forEach(([t, bg, fg], i) => board('sg' + i, t, bg, fg, 26));

  const tex = new THREE.CanvasTexture(c);
  facadeMat = new THREE.MeshToonMaterial({ map: tex, vertexColors: true, gradientMap: bands });
}

// ---------- মডেল বানানো: ত্রিভুজের তালিকা (p অবস্থান, n নরমাল, c রঙ, u UV, k টিন্ট-ফ্ল্যাগ) ----------
export const newT = () => ({ p: [], n: [], c: [], u: [], k: [] });
const W3 = [1, 1, 1];
// চার কোণ a(নিচে-বাঁ) b(নিচে-ডান) c(ওপরে-ডান) d(ওপরে-বাঁ), বাইরে থেকে দেখলে উল্টো-ঘড়ির দিকে
export function quad(T, a, b, c, d, cell, col = W3, k = 0) {
  const u = CELL[cell], P = [a, b, c, d];
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const uv = [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[3]]];
  for (const i of [0, 1, 2, 0, 2, 3]) { T.p.push(...P[i]); T.n.push(nx, ny, nz); T.c.push(col[0], col[1], col[2]); T.u.push(uv[i][0], uv[i][1]); T.k.push(k); }
}
export function tri(T, a, b, c, cell, col = W3, k = 0) {
  const u = CELL[cell], mu = (u[0] + u[2]) / 2, mv = (u[1] + u[3]) / 2;
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  for (const P of [a, b, c]) { T.p.push(...P); T.n.push(nx, ny, nz); T.c.push(col[0], col[1], col[2]); T.u.push(mu, mv); T.k.push(k); }
}
// আয়তাকার বাক্স (নিচের মুখ নেই); cells = { front, back, right, left, top } (না দিলে plain)
export function boxT(T, x0, x1, y0, y1, z0, z1, cells = {}, col = W3, k = 0) {
  const C = n => cells[n] || 'plain';
  quad(T, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], C('front'), col, k);
  quad(T, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], C('back'), col, k);
  quad(T, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], C('right'), col, k);
  quad(T, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], C('left'), col, k);
  quad(T, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], C('top'), col, k);
}
// ৮ কোণা পানির ট্যাংক ইত্যাদির জন্য সিলিন্ডার
export function cylT(T, cx, y0, cz, r, h, seg, col, cell = 'plain') {
  const P = (t, y) => [cx + r * Math.cos(t), y, cz + r * Math.sin(t)];
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * 6.2832, a1 = (i + 1) / seg * 6.2832;
    quad(T, P(a1, y0), P(a0, y0), P(a0, y0 + h), P(a1, y0 + h), cell, col);
    tri(T, [cx, y0 + h, cz], P(a1, y0 + h), P(a0, y0 + h), cell, col);
  }
}

// ---------- InstancedMesh-এর জন্য: কেন্দ্রে আনা জিওমেট্রি + ভেতরের বাক্স-আউটলাইন ----------
// hull = আউটলাইনের বাক্স {x0,x1,y0,y1,z0,z1}; পুরো মডেলের বদলে শুধু বাক্সটা বড় করে আঁকা হয়, তাই আউটলাইন হালকা
export function instDef(T, hull) {
  const n = T.p.length / 3, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { const v = T.p[i * 3 + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
  const mid = mn.map((v, a) => (v + mx[a]) / 2), pos = new Float32Array(T.p);
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) pos[i * 3 + a] -= mid[a];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(T.n), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(T.c), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(T.u), 2));
  const hh = [(hull.x1 - hull.x0) / 2, (hull.y1 - hull.y0) / 2, (hull.z1 - hull.z0) / 2];
  const hc = [(hull.x0 + hull.x1) / 2, (hull.y0 + hull.y1) / 2, (hull.z0 + hull.z1) / 2];
  return {
    geo, half: new THREE.Vector3(...mid.map((v, a) => (mx[a] - mn[a]) / 2)), mat: facadeMat,
    shell: { geo: new THREE.BoxGeometry(2 * hh[0], 2 * hh[1], 2 * hh[2]), half: new THREE.Vector3(...hh), off: { x: hc[0] - mid[0], y: hc[1] - mid[1], z: hc[2] - mid[2] } }
  };
}

// ---------- দোকানের মতো ছোট জিনিস: প্রতি chunk-এ সব এক মেশে জুড়ে (stamp) ----------
export function finishT(T, hull) { // ফেরত: stamp-এর জন্য তৈরি টেমপ্লেট (+ আউটলাইনের বাক্স, থাকলে)
  const out = { p: T.p, n: T.n, c: T.c, u: T.u, k: T.k, hullP: null };
  if (hull) {
    const H = newT(), t = 0.1;
    boxT(H, hull.x0 - t, hull.x1 + t, hull.y0 - t, hull.y1 + t, hull.z0 - t, hull.z1 + t);
    out.hullP = H.p;
  }
  return out;
}
export const newAcc = () => ({ p: [], n: [], c: [], u: [], sp: [] });
export function stamp(acc, T, x, y, z, ry, tint, tint2) {
  const cs = Math.cos(ry), sn = Math.sin(ry), n = T.p.length / 3;
  for (let i = 0; i < n; i++) {
    const lx = T.p[i * 3], ly = T.p[i * 3 + 1], lz = T.p[i * 3 + 2];
    acc.p.push(x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs);
    const nx = T.n[i * 3], nz = T.n[i * 3 + 2];
    acc.n.push(nx * cs + nz * sn, T.n[i * 3 + 1], -nx * sn + nz * cs);
    const k = T.k[i], m = k === 1 ? tint : k === 2 ? tint2 : W3;
    acc.c.push(T.c[i * 3] * m[0], T.c[i * 3 + 1] * m[1], T.c[i * 3 + 2] * m[2]);
    acc.u.push(T.u[i * 2], T.u[i * 2 + 1]);
  }
  if (T.hullP) for (let i = 0; i < T.hullP.length; i += 3) {
    const lx = T.hullP[i], lz = T.hullP[i + 2];
    acc.sp.push(x + lx * cs + lz * sn, y + T.hullP[i + 1], z - lx * sn + lz * cs);
  }
}
// সরাসরি বিশ্বের স্থানাঙ্কে এক টুকরো যোগ (পতাকা, সাইনবোর্ড): T-তে বানিয়ে acc-তে ঢালে
export function pour(acc, T) {
  for (let i = 0; i < T.p.length; i++) acc.p.push(T.p[i]);
  for (let i = 0; i < T.n.length; i++) acc.n.push(T.n[i]);
  for (let i = 0; i < T.c.length; i++) acc.c.push(T.c[i]);
  for (let i = 0; i < T.u.length; i++) acc.u.push(T.u[i]);
}
