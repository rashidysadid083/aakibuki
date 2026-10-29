import * as THREE from 'three';
import { scene, bands, inked } from './core.js';
import { GS } from './state.js';
import { canvasTex } from './textures.js';
import { bsel } from './pm.js';
import { FS, BK } from './flightphys.js';

// ---- পাখি: টিয়া, মাছরাঙা, ময়ূর ----
let EYEG, EYEM;
const BSPEC = {
  parrot: { s: 1, body: 0x58b34a, belly: 0x9bd86a, head: 0x58b34a, wing: 0x3f9a45, tip: 0x2a63b5, beak: 0xe0443a, tail: 0x3f9a45, tailTip: 0xf0d048, bl: 0.5, br: 0.2, hr: 0.17, span1: 0.42, span2: 0.38, chord: 0.3, tailL: 0.7, tailW: 0.14, beakL: 0.13, beakR: 0.06 },
  kingfisher: { s: 1, body: 0x2b72d8, belly: 0xf08a3a, head: 0x2aa6b8, wing: 0x2b72d8, tip: 0x1d4fa0, beak: 0x23232a, tail: 0x2b72d8, bl: 0.38, br: 0.17, hr: 0.2, span1: 0.34, span2: 0.3, chord: 0.24, tailL: 0.22, tailW: 0.12, beakL: 0.34, beakR: 0.055 },
  peacock: { s: 1.2, body: 0x1f6fb8, belly: 0x174f8e, head: 0x1b5fb0, wing: 0xc79a46, tip: 0x2f7f5a, beak: 0xd9c89a, tail: 0x1f6fb8, bl: 0.6, br: 0.24, hr: 0.11, hy: 0.42, hz: 0.62, neck: 1, crest: 1, span1: 0.5, span2: 0.45, chord: 0.36, tailL: 0.3, tailW: 0.16, beakL: 0.1, beakR: 0.04, train: [2.2, 0.9] }
};
function wingGeo(span, chord, taper, sweep, side) { // ডানার অংশ: গোড়ায় চওড়া, ডগা সরু ও পেছনে হেলানো
  const g = new THREE.BoxGeometry(span, 0.03, chord), pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const t = (pa.getX(i) * side + span / 2) / span;
    pa.setZ(i, pa.getZ(i) * (1 - (1 - taper) * t) - sweep * t);
  }
  g.computeVertexNormals();
  return g;
}
function makeTrain(len, hw) { // ময়ূরের পেখম: একটা পাখা-আকৃতির চাদর, চোখ-আঁকা canvas টেক্সচারে
  const N = 10, pos = [0, 0, 0], uv = [0.5, 1], idx = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N * 2 - 1, zf = 0.8 + 0.2 * (1 - s * s), x = s * hw;
    pos.push(x, 0, -len * zf); uv.push(0.5 + x / (2 * hw), 1 - zf);
    if (i < N) idx.push(0, i + 1, i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const tex = canvasTex(128, (c, n) => {
    c.fillStyle = '#2f8f5a'; c.fillRect(0, 0, n, n);
    c.strokeStyle = '#c9a43a'; c.lineWidth = 2;
    for (let i = 0; i <= 12; i++) { c.beginPath(); c.moveTo(n / 2, 0); c.lineTo(i / 12 * n, n); c.stroke(); }
    for (let k = -3; k <= 3; k++) {
      const s = k / 3.4, zf = 0.8 + 0.2 * (1 - s * s), x = (0.5 + s * 0.5) * n, y = (zf - 0.14) * n;
      [['#d9b640', 10, 12], ['#1f5fb0', 7, 9], ['#12203a', 3, 4]].forEach(([col, rx, ry]) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.283); c.fill(); });
    }
  });
  const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ map: tex, gradientMap: bands, side: THREE.DoubleSide }));
  m.castShadow = true; m.frustumCulled = false;
  const ln = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', g.attributes.position), new THREE.LineBasicMaterial({ color: 0x1a1620 }));
  ln.frustumCulled = false;
  m.add(ln);
  m.rotation.x = -0.12;
  return m;
}
function makeBird(kind) {
  const P = BSPEC[kind], g = new THREE.Group(), rig = new THREE.Group();
  g.rotation.order = 'YXZ';
  g.add(rig);
  const put = (m, x, y, z) => { m.position.set(x, y, z); rig.add(m); return m; };
  const ell = (rx, ry, rz, col) => inked(new THREE.SphereGeometry(1, 8, 6).scale(rx, ry, rz), col, 0.025);
  const { bl, br, hr } = P, hy = P.hy !== undefined ? P.hy : br * 0.5, hz = P.hz !== undefined ? P.hz : bl * 0.85;
  put(ell(br, br, bl, P.body), 0, 0, 0);
  put(ell(br * 0.85, br * 0.65, bl * 0.8, P.belly), 0, -br * 0.4, bl * 0.12);
  put(ell(hr, hr, hr * 1.1, P.head), 0, hy, hz);
  if (P.neck) {
    const dy = hy - 0.02, dz = hz - bl * 0.6, len = Math.hypot(dy, dz);
    const nk = inked(new THREE.CylinderGeometry(0.055, 0.09, len, 6), P.head, 0.02);
    nk.rotation.x = Math.atan2(dz, dy);
    put(nk, 0, 0.02 + dy / 2, bl * 0.6 + dz / 2);
  }
  if (P.crest) put(inked(new THREE.ConeGeometry(0.03, 0.16, 5), 0xf0c040, 0.012), 0, hy + hr + 0.05, hz - 0.02);
  put(inked(new THREE.ConeGeometry(P.beakR, P.beakL, 6).rotateX(Math.PI / 2), P.beak, 0.015), 0, hy - hr * 0.1, hz + hr + P.beakL / 2 - 0.03);
  for (const s of [1, -1]) put(new THREE.Mesh(EYEG, EYEM), s * hr * 0.78, hy + hr * 0.2, hz + hr * 0.5);
  const tail = new THREE.Group();
  tail.position.set(0, 0, -bl * 0.9);
  rig.add(tail);
  const tm = inked(new THREE.BoxGeometry(P.tailW, 0.03, P.tailL), P.tail, 0.02);
  tm.position.z = -P.tailL / 2;
  tail.add(tm);
  if (P.tailTip) { const tt = inked(new THREE.BoxGeometry(P.tailW * 1.02, 0.032, 0.14), P.tailTip, 0.02); tt.position.z = -P.tailL + 0.07; tail.add(tt); }
  let train = null;
  if (P.train) { train = new THREE.Group(); train.position.set(0, 0.02, -bl * 0.85); train.add(makeTrain(P.train[0], P.train[1])); rig.add(train); }
  const wings = [], outer = [];
  for (const s of [1, -1]) {
    const pv = new THREE.Group();
    pv.position.set(s * br * 0.8, br * 0.45, bl * 0.15);
    rig.add(pv);
    const w1 = inked(wingGeo(P.span1, P.chord, 0.85, 0.03, s), P.wing, 0.02);
    w1.position.x = s * P.span1 / 2;
    pv.add(w1);
    const ov = new THREE.Group();
    ov.position.x = s * P.span1;
    pv.add(ov);
    const w2 = inked(wingGeo(P.span2, P.chord * 0.85, 0.3, 0.16, s), P.tip, 0.02);
    w2.position.x = s * P.span2 / 2;
    ov.add(w2);
    wings.push(pv); outer.push(ov);
  }
  g.scale.setScalar(P.s);
  g.userData = { rig, wings, outer, tail, train };
  g.visible = false;
  scene.add(g);
  return g;
}
const birds = {};
export const getBird = k => birds[k] || (birds[k] = makeBird(k));
export let birdKind = 'parrot';
let bbtn;

export function initBirds() {
  EYEG = new THREE.SphereGeometry(0.028, 6, 4); EYEM = new THREE.MeshBasicMaterial({ color: 0x15121a });
  try { const b = localStorage.getItem('kb_bird'); if (BSPEC[b]) birdKind = b; } catch (e) {}
  bbtn = [['parrot', '🦜 টিয়া'], ['kingfisher', '🐦 মাছরাঙা'], ['peacock', '🦚 ময়ূর']].map(([k, label]) => {
    const el = document.createElement('button');
    el.className = 'mb'; el.textContent = label;
    el.addEventListener('click', () => setBird(k));
    bsel.appendChild(el);
    return { k, el };
  });
  for (const b of bbtn) b.el.classList.toggle('on', b.k === birdKind);
}

export function setBird(kind) {
  birdKind = kind;
  try { localStorage.setItem('kb_bird', kind); } catch (e) {}
  for (const b of bbtn) b.el.classList.toggle('on', b.k === kind);
  if (GS.pmode !== 'bird' || FS.state === 'fold' || FS.landing) return;
  const to = getBird(kind), from = GS.fobj;
  if (to === from) return;
  to.position.copy(from.position); to.visible = true; from.visible = false;
  GS.fobj = to; GS.focus = to; FS.K = BK[kind];
}
