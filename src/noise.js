import { mulberry32, SEED } from './rng.js';

// ---------- 2D simplex noise ----------
const perm = new Uint8Array(512);
export function initNoise() {
  const rnd = mulberry32(SEED);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const SK = 0.5 * (Math.sqrt(3) - 1), UK = (3 - Math.sqrt(3)) / 6;

export function simplex(x, y) {
  const s = (x + y) * SK;
  const i = Math.floor(x + s), j = Math.floor(y + s);
  const t = (i + j) * UK;
  const x0 = x - (i - t), y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
  const xs = [x0, x0 - i1 + UK, x0 - 1 + 2 * UK];
  const ys = [y0, y0 - j1 + UK, y0 - 1 + 2 * UK];
  const ii = i & 255, jj = j & 255;
  const hs = [perm[ii + perm[jj]], perm[ii + i1 + perm[jj + j1]], perm[ii + 1 + perm[jj + 1]]];
  let sum = 0;
  for (let k = 0; k < 3; k++) {
    let w = 0.5 - xs[k] * xs[k] - ys[k] * ys[k];
    if (w > 0) {
      w *= w;
      const g = GRAD[hs[k] & 7];
      sum += w * w * (g[0] * xs[k] + g[1] * ys[k]);
    }
  }
  return 70 * sum;
}
