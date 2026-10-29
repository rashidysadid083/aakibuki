// ---------- আকাশ: ওড়ার হিসাব (বিমান ও পাখি, কোনো রেন্ডারিং নির্ভরতা নেই) ----------
// FLY-PHYS-BEGIN
export const FS = { state: 'fly', K: null, yaw: 0, pitch: 0, roll: 0, v: 0, en: 1, tired: false, landing: false, after: null, touch: 0, assist: 0, ph: 0, fa: 0, tk: 0, sIn: 0, fold: 0, enBar: -1 };
// vc = স্বাভাবিক গতি, vmin = এর নিচে নাক ঝুঁকে যায়, bm = বুস্টের গুণক, pm/pd = নাক ওঠা/নামার সীমা, g = ঢালে গতি বাড়া-কমা, cd/ch = ক্যামেরার দূরত্ব/উচ্চতা
export const PK = { vc: 13, vmin: 7, vmax: 24, bm: 1.7, turn: 1.5, bank: 0.95, pm: 0.55, pd: 0.9, sink: 0.8, g: 9, r: 0.7, clear: 0.45, ceil: 60, flapper: false, cd: 8, ch: 3 };
export const BB = { vmin: 6, bm: 1.45, bank: 0.85, g: 9, r: 0.5, clear: 0.5, ceil: 60, flapper: true, cd: 6, ch: 2.4 };
export const BK = {
  parrot: { ...BB, vc: 15, vmax: 28, turn: 2.0, pm: 0.55, pd: 0.9, sink: 1.1, fr: 9, amp: 0.9, cd: 5.5, ch: 2.2 },
  kingfisher: { ...BB, vc: 14, vmax: 34, turn: 2.5, pm: 0.5, pd: 1.1, sink: 1.0, g: 12, fr: 14, amp: 0.8, cd: 5, ch: 2, r: 0.4 },
  peacock: { ...BB, vc: 10, vmin: 4.5, vmax: 18, turn: 1.4, pm: 0.4, pd: 0.7, sink: 0.6, fr: 5, amp: 0.7, cd: 8.5, ch: 3, r: 0.8 }
};
// এক ধাপের উড়ান: গতি/নাক/মোড় হিসাব করে p (অবস্থান) সরায়। বিমান গ্লাইড করে ধীরে নামে; ঢালে গতি বাড়ে, ওঠায় কমে।
export function flyStep(dt, p, gy, water, pIn, sIn, boostIn) {
  const S = FS, K = S.K, h = p.y - gy;
  if (S.landing) { pIn = 0; sIn = 0; boostIn = false; }
  if (S.assist > 0) { S.assist -= dt; pIn = Math.max(pIn, 0.8); } // হাত থেকে ছোড়ার ধাক্কা
  if (h > K.ceil - 8) pIn = Math.min(pIn, -Math.min(1, (h - K.ceil + 8) / 8) * 0.8); // উচ্চতার সীমা: নরম করে নামিয়ে আনে
  if (S.tired && S.en > 0.3) S.tired = false;
  const can = !S.tired && S.en > 0;
  const pushing = boostIn && can;
  const flapping = K.flapper && can && !S.landing && (pushing || pIn > 0.2 || S.v < K.vc * 0.8);
  const use = pushing ? (K.flapper ? 0.3 : 0.35) : flapping ? 0.06 : 0;
  S.en = Math.max(0, Math.min(1, S.en + (use ? -use : (K.flapper ? 0.18 : 0.14)) * dt));
  if (S.en <= 0) S.tired = true;
  let vT = pushing ? K.vc * K.bm : K.vc;
  if (S.landing) vT = K.vmin + 3;
  const stall = S.v < K.vmin && !flapping && !S.landing, sP = Math.sin(S.pitch);
  const gr = flapping && sP > 0 ? K.g * 0.3 : K.g;
  S.v += ((vT - S.v) * (pushing ? 1.1 : 0.5) - sP * gr) * dt;
  S.v = Math.max(K.vmin * 0.6, Math.min(K.vmax, S.v));
  let pT = pIn * (pIn > 0 ? K.pm : K.pd);
  if (S.landing) pT = h > 10 ? -0.3 : 0.08;
  if (stall) pT = Math.min(pT, -0.45);
  S.pitch += (pT - S.pitch) * (1 - Math.exp(-3 * dt));
  S.yaw -= sIn * K.turn * Math.max(0.5, Math.min(1.4, S.v / K.vc)) * dt;
  S.roll += (sIn * K.bank - S.roll) * (1 - Math.exp(-4 * dt));
  S.sIn += (sIn - S.sIn) * (1 - Math.exp(-5 * dt));
  const cp = Math.cos(S.pitch);
  p.x += Math.sin(S.yaw) * cp * S.v * dt;
  p.z += Math.cos(S.yaw) * cp * S.v * dt;
  const sink = K.sink * Math.max(0.6, Math.min(2.2, K.vc / Math.max(S.v, 3))) * (flapping ? 0.15 : 1);
  let vy = S.v * Math.sin(S.pitch) - sink;
  if (S.landing) vy = -(h > 10 ? 6 : 2.6);
  p.y += vy * dt;
  const minY = gy + K.clear + (water ? 0.7 : 0);
  if (p.y <= minY + 0.02) {
    p.y = minY;
    if (!water) S.touch += dt; // মাটি ঘেঁষে চলতে থাকলে নিজেই নেমে পড়ে
    S.pitch = Math.max(S.pitch, 0);
    S.v *= 1 - 0.6 * dt;
  } else S.touch = 0;
  return { pushing, flapping, landed: S.touch > 0.6 || (S.landing && p.y <= minY + 0.3) };
}
// FLY-PHYS-END
