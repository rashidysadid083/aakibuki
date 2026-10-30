import { BLD } from './props.js';
import { newT, quad, boxT, cylT, instDef } from './facade.js';

// ---------- ৪গ শহর: বহুতল দালান (প্রতি তলা ৩.১ মিটার, বাস্তব মাপ) ----------
// A: ৫ তলার আবাসিক (বারান্দা), B: ৮ তলার অফিস (কাচের সারি), D: ৩ তলা নিচে দোকানসহ পুরনো ধাঁচ
export const FH = 3.1;
export const TOWER = { // মাপ + কলিশনের গোল ব্যাসার্ধ r + কলিশনের উচ্চতা hh (বিমান/পাখির জন্য)
  A: { w: 7.0, d: 7.0, floors: 5, r: 4.8 },
  B: { w: 8.0, d: 7.0, floors: 8, r: 5.0 },
  D: { w: 6.4, d: 7.0, floors: 3, r: 4.6 }
};
for (const k in TOWER) TOWER[k].hh = TOWER[k].floors * FH + 3.4;

const hash = (a, b, c, d) => (Math.imul(a * 73 + b * 131 + c * 17 + d * 257, 2654435761) >>> 0) / 4294967296;

function tower(type, o) {
  const { w, d, floors } = TOWER[type], H = floors * FH, hw = w / 2, hd = d / 2, T = newT();
  const col = o.tint, dark = col.map(v => v * 0.72), mid = col.map(v => v * 0.92);
  // বাইরের দিক ধরে পয়েন্ট: side 0:+z, 1:+x, 2:-z, 3:-x; u বাঁ থেকে ডানে (বাইরে থেকে দেখলে), y উচ্চতা
  const pt = (side, u, y) => side === 0 ? [-hw + u, y, hd] : side === 1 ? [hw, y, hd - u] : side === 2 ? [hw - u, y, -hd] : [-hw, y, -hd + u];
  const width = side => side & 1 ? d : w;
  const wall = (side, u0, u1, y0, y1, cell, c) => quad(T, pt(side, u0, y0), pt(side, u1, y0), pt(side, u1, y1), pt(side, u0, y1), cell, c);
  const attach = (side, uc, hf, y0, y1, depth, c) => { // দেয়ালের গায়ে লাগানো বাক্স (বারান্দার স্ল্যাব, এসি)
    const zc = side === 1 ? hd - uc : side === 3 ? -hd + uc : 0, xc = side === 0 ? -hw + uc : side === 2 ? hw - uc : 0;
    if (side === 0) boxT(T, xc - hf, xc + hf, y0, y1, hd, hd + depth, {}, c);
    else if (side === 2) boxT(T, xc - hf, xc + hf, y0, y1, -hd - depth, -hd, {}, c);
    else if (side === 1) boxT(T, hw, hw + depth, y0, y1, zc - hf, zc + hf, {}, c);
    else boxT(T, -hw - depth, -hw, y0, y1, zc - hf, zc + hf, {}, c);
  };
  for (let side = 0; side < 4; side++) {
    wall(side, 0, width(side), -1.2, 0, 'plain', dark); // মাটির নিচের অংশ (ঢালে ফাঁক ঢাকে)
    const bays = Math.max(2, Math.round(width(side) / 3.4)), bw = width(side) / bays;
    for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
      const h = hash(f, b, side, o.seed);
      let cell;
      if (f === 0) cell = type === 'D' ? (side === 0 ? (b & 1 ? 'shut' : 'shop') : (h < 0.5 ? 'shut' : 'win')) : (side === 0 ? 'door' : h < 0.5 ? 'win' : 'shut');
      else cell = o.pool[(h * o.pool.length) | 0];
      wall(side, b * bw, (b + 1) * bw, f * FH, (f + 1) * FH, cell, col);
      if (f > 0 && cell === 'balc') attach(side, (b + 0.5) * bw, bw * 0.4, f * FH, f * FH + 0.14, 0.9, mid);
      if (f > 0 && cell === 'ac') attach(side, (b + 0.75) * bw, 0.3, f * FH + FH * 0.46, f * FH + FH * 0.66, 0.45, [0.82, 0.84, 0.86]);
    }
  }
  // ছাদ + আলসে
  quad(T, [-hw, H, hd], [hw, H, hd], [hw, H, -hd], [-hw, H, -hd], 'plain', dark);
  const pa = 0.5, pt2 = 0.25;
  boxT(T, -hw, hw, H, H + pa, hd - pt2, hd, {}, mid); boxT(T, -hw, hw, H, H + pa, -hd, -hd + pt2, {}, mid);
  boxT(T, -hw, -hw + pt2, H, H + pa, -hd + pt2, hd - pt2, {}, mid); boxT(T, hw - pt2, hw, H, H + pa, -hd + pt2, hd - pt2, {}, mid);
  const R = H + pa;
  // ছাদের ওপর: ট্যাংক (পায়ার ওপর), সিঁড়িঘর, বিলবোর্ড, এসি-র বাক্স
  const tank = (x, z) => {
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) boxT(T, x + dx - 0.06, x + dx + 0.06, R, R + 0.8, z + dz - 0.06, z + dz + 0.06, {}, [0.4, 0.4, 0.42]);
    cylT(T, x, R + 0.8, z, 0.95, 1.5, 8, [0.36, 0.52, 0.7]);
  };
  tank(-hw + 1.7, -hd + 1.9);
  if (o.stair) boxT(T, hw - 3.2, hw - 0.8, R, R + 2.5, -hd + 0.8, -hd + 3.0, { front: 'door' }, mid);
  if (o.bb) {
    const bw2 = w * 0.78, x0 = -bw2 / 2, z1 = hd - 0.5;
    for (const px of [x0 + 0.4, -x0 - 0.4]) boxT(T, px - 0.08, px + 0.08, R, R + 3.0, z1 - 0.2, z1 - 0.04, {}, [0.4, 0.4, 0.42]);
    boxT(T, x0, -x0, R + 1.2, R + 1.2 + bw2 / 4, z1 - 0.2, z1, { front: o.bb, back: 'plain' }, W(1));
  }
  if (o.sign) boxT(T, -w * 0.38, w * 0.38, FH - 0.7, FH - 0.1, hd, hd + 0.1, { front: o.sign }, W(1));
  boxT(T, -hw + 0.6, -hw + 1.5, R, R + 0.6, hd - 1.4, hd - 0.7, {}, [0.78, 0.8, 0.82]); // ছাদের এসি-কনডেন্সার
  return instDef(T, { x0: -hw, x1: hw, y0: -1.2, y1: R, z0: -hd, z1: hd });
}
const W = v => [v, v, v];

export function initTown() {
  BLD.A = tower('A', { tint: [0.97, 0.86, 0.68], pool: ['win', 'balc', 'balc', 'ac', 'win'], seed: 1, stair: true });
  BLD.B = tower('B', { tint: [0.76, 0.84, 0.93], pool: ['glass', 'glass', 'win', 'ac'], seed: 2, bb: 'bb0' });
  BLD.D = tower('D', { tint: [0.96, 0.72, 0.66], pool: ['win', 'balc', 'win'], seed: 3, bb: 'bb2', sign: 'sg1' });
}
