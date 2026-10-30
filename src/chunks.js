import * as THREE from 'three';
import { scene, bands } from './core.js';
import { CS, CSEG, STEP, WATER, FEAT } from './config.js';
import { mulberry32, SEED } from './rng.js';
import { simplex } from './noise.js';
import { heightAt, surfaceAt, nearestRoad, NR, roadYaw, zoneAt } from './terrain.js';
import { addProps, TREE, BLD } from './props.js';
import { roadStrip, addLamps } from './roads.js';
import { washTexture } from './textures.js';
import { GS } from './state.js';
import { villageExtras, villageDecorate } from './village.js';
import { isBazaar, bazaarLayout, bazaarDecorate } from './bazaar.js';
import { TOWER } from './town.js';

const PADDY = new THREE.Color(0xc4cf72);

// সবচেয়ে কাছের রাস্তার দিকে মুখ ঘোরানোর কোণ (এইমাত্র surfaceAt/nearestRoad ডাকার পর NR ঠিক থাকে)
function faceRoad(x, z) {
  const rx = NR.axis === 'z' ? NR.cross : x, rz = NR.axis === 'z' ? z : NR.cross;
  return Math.atan2(rx - x, rz - z);
}

// প্রতি chunk-এ নিজস্ব seed দিয়ে গাছ-বাড়ি বসায়, তাই ফিরে এলেও একই জিনিস দেখা যাবে
function layout(cx, cz) {
  const r = mulberry32(((cx * 73856093) ^ (cz * 19349663) ^ SEED) >>> 0);
  const x0 = cx * CS, z0 = cz * CS;
  const zone = zoneAt(x0 + CS / 2, z0 + CS / 2);
  let kind = zone > 0.5 ? 'town' : zone > 0.05 ? 'village' : 'rural';
  if (FEAT.bazaar && isBazaar(cx, cz)) kind = 'bazaar'; // ৪খ: মোড়ের বাজার
  const newTown = FEAT.town && kind === 'town'; // ৪গ: বাস্তব মাপের বহুতল দালান
  const cap = { town: 8, village: 5, rural: 0, bazaar: 0 }[kind];
  const gap = newTown ? 9.2 : kind === 'town' ? 8.5 : 7.5;
  const buildings = [], trees = [], cols = [];
  for (let i = 0; i < 30 && buildings.length < cap; i++) {
    const x = x0 + r() * CS, z = z0 + r() * CS, a = r(), b = r();
    if (surfaceAt(x, z) !== 'grass' || NR.d < (newTown ? 9 : 7) || NR.d > (newTown ? 19 : 17)) continue; // বহুতলের কিনারা যেন ফুটপাত না ঢাকে
    if (buildings.some(o => Math.hypot(o.x - x, o.z - z) < gap)) continue;
    const ry = newTown ? faceRoad(x, z) : roadYaw(NR.axis, NR.idx, NR.t) + (a - 0.5) * 0.2; // শহরে সামনের দিক রাস্তামুখী
    const s = newTown ? 1 : kind === 'town' ? 0.9 + b * 0.5 : 0.9 + b * 0.25; // বহুতলে মাপ বদলায় না, নইলে জানালার মাপ বিগড়ায়
    const o = newTown ? 3.5 : 2.5;
    const y = Math.min(heightAt(x - o, z - o), heightAt(x + o, z - o), heightAt(x - o, z + o), heightAt(x + o, z + o)) - 0.1;
    const u = (a * 977) % 1;
    const type = newTown ? (u < 0.4 ? 'A' : u < 0.62 ? 'B' : 'D') : kind === 'town' ? (a > 0.5 ? 'A' : 'B') : u < 0.65 ? 'C' : 'H'; // গ্রামে বেশিরভাগ চালা ঘর
    buildings.push({ x, z, y, s, type, ry });
    cols.push(newTown ? { x, z, r: TOWER[type].r, hh: TOWER[type].hh } : { x, z, r: (type === 'H' ? 3.3 : type === 'C' ? 3.1 : 3.5) * s });
  }
  const tries = { town: 4, village: 10, rural: 14, bazaar: 0 }[kind];
  for (let i = 0; i < tries; i++) {
    const x = x0 + r() * CS, z = z0 + r() * CS, s = 0.8 + r() * 0.7, ry = r() * 6.283;
    if (surfaceAt(x, z) !== 'grass' || NR.d < 5.5) continue;
    if (buildings.some(o => Math.hypot(o.x - x, o.z - z) < (newTown ? 7.5 : 6))) continue;
    trees.push({ x, z, y: heightAt(x, z), ry, s });
    cols.push({ x, z, r: 0.6 * s });
  }
  const ex = kind === 'bazaar' ? bazaarLayout(cx, cz, cols) : kind === 'town' || !FEAT.village ? null : villageExtras(r, kind, x0, z0, buildings, trees, cols); // ৪খ বাজার / ৪ক পুকুর, ধানক্ষেত, বট, কলা, বাঁশ
  return { kind, buildings, trees, cols, ex };
}

// শহরের দুই ধরনের বাড়ি (ওপরে নিচের অংশ এক জিওমেট্রিতে)

function decorate(mesh, cx, cz) {
  const L = layout(cx, cz);
  for (const type of ['H', 'C', 'A', 'B', 'D']) addProps(mesh, BLD[type], L.buildings.filter(b => b.type === type), 0.1);
  addProps(mesh, TREE, L.trees, 0.08);
  if (L.ex) (L.kind === 'bazaar' ? bazaarDecorate : villageDecorate)(mesh, L.ex);
  const rs = roadStrip(cx, cz);
  rs.meshes.forEach(m => mesh.add(m));
  addLamps(mesh, rs.lamps);
  mesh.userData.cols = L.cols.concat(rs.lamps.map(p => ({ x: p.x, z: p.z, r: 0.25 })));
}

// যেকোনো বিন্দু p আর ব্যাসার্ধ rad নিয়ে আশপাশের chunk-এর বস্তু থেকে ঠেলে বাইরে সরায়; ধাক্কা লাগলে true
// h = মাটি থেকে নিজের উচ্চতা (উড়ানে); বস্তুর উচ্চতা (hh, না থাকলে ৬) ছাড়ালে ধাক্কা লাগে না
export function collide(p, rad, h = 0) {
  let hit = false;
  const cx = Math.floor(p.x / CS), cz = Math.floor(p.z / CS);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ch = chunks.get((cx + dx) + ',' + (cz + dz));
      if (!ch || !ch.userData.cols) continue;
      for (const c of ch.userData.cols) {
        if (h > (c.hh === undefined ? 6 : c.hh)) continue;
        const ox = p.x - c.x, oz = p.z - c.z;
        const d = Math.hypot(ox, oz), min = c.r + rad;
        if (d < min && d > 0.001) {
          p.x = c.x + ox / d * min;
          p.z = c.z + oz / d * min;
          hit = true;
        }
      }
    }
  }
  return hit;
}


let RAD = 3;
export const chunks = new Map();
export let chunkMat;
const lowC = new THREE.Color(0x8fb56a), highC = new THREE.Color(0xc9a85c), tmpC = new THREE.Color();

export function initWorld() {
  chunkMat = new THREE.MeshToonMaterial({ map: washTexture(), vertexColors: true, gradientMap: bands });
}

function buildChunk(cx, cz) {
  const n = CSEG + 1, m = n + 2; // চারপাশে এক সারি বাড়তি উচ্চতা, যাতে সীমানার নরমালে ফাঁক না পড়ে
  const gx = cx * CS - STEP, gz = cz * CS - STEP;
  const H = new Float32Array(m * m);
  for (let j = 0; j < m; j++)
    for (let i = 0; i < m; i++) H[j * m + i] = heightAt(gx + i * STEP, gz + j * STEP);

  const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3);
  const col = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
  let k = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++, k++) {
      const a = (j + 1) * m + (i + 1), h = H[a];
      const wx = cx * CS + i * STEP, wz = cz * CS + j * STEP;
      pos[k * 3] = wx; pos[k * 3 + 1] = h; pos[k * 3 + 2] = wz;
      const nx = H[a - 1] - H[a + 1], nz = H[a - m] - H[a + m], ny = 2 * STEP;
      const len = Math.hypot(nx, ny, nz);
      nor[k * 3] = nx / len; nor[k * 3 + 1] = ny / len; nor[k * 3 + 2] = nz / len;
      tmpC.copy(lowC).lerp(highC, THREE.MathUtils.clamp((h - 2) / 12, 0, 1));
      tmpC.lerp(PADDY, (simplex(wx * 0.05 + 11, wz * 0.05) * 0.5 + 0.5) * 0.55); // ধানক্ষেতের ছোপ
      if (h <= WATER + 0.05) tmpC.set(0x6fa8c4);
      else { nearestRoad(wx, wz); if (NR.d < 3.2) tmpC.set(0xc2b08a); }
      col[k * 3] = tmpC.r; col[k * 3 + 1] = tmpC.g; col[k * 3 + 2] = tmpC.b;
      uv[k * 2] = wx * 0.15; uv[k * 2 + 1] = wz * 0.15;
    }
  }
  const idx = new Uint16Array(CSEG * CSEG * 6);
  let q = 0;
  for (let j = 0; j < CSEG; j++) {
    for (let i = 0; i < CSEG; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b;
      idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(geo, chunkMat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  chunks.set(cx + ',' + cz, mesh);
  decorate(mesh, cx, cz);
}


let curCx = null, curCz = null, queue = [];
// মান বদলালে chunk-এর ব্যাসার্ধ ঠিক করে আর chunk তালিকা নতুন করে হিসাব করায়
export function setStreamRadius(r) { RAD = r; curCx = null; }
export function streamChunks() {
  const cx = Math.floor(GS.focus.position.x / CS), cz = Math.floor(GS.focus.position.z / CS);
  if (cx !== curCx || cz !== curCz) {
    curCx = cx; curCz = cz;
    queue = [];
    for (let dz = -RAD; dz <= RAD; dz++)
      for (let dx = -RAD; dx <= RAD; dx++)
        if (!chunks.has((cx + dx) + ',' + (cz + dz))) queue.push([cx + dx, cz + dz, dx * dx + dz * dz]);
    queue.sort((p, r) => r[2] - p[2]); // সবচেয়ে কাছেরটা শেষে, pop() সেটাই নেবে
    for (const [key, mesh] of chunks) {
      const [kx, kz] = key.split(',').map(Number);
      if (Math.abs(kx - cx) > RAD + 1 || Math.abs(kz - cz) > RAD + 1) {
        scene.remove(mesh); mesh.geometry.dispose();
        mesh.children.forEach(o => { if (o.dispose) o.dispose(); if (o.userData.own) o.geometry.dispose(); });
        chunks.delete(key);
      }
    }
  }
  if (queue.length) { const [qx, qz] = queue.pop(); buildChunk(qx, qz); } // প্রতি ফ্রেমে সর্বোচ্চ ১টা
}


// শুরুতে আশপাশের ৯টা chunk একসাথে
export function prebuildChunks() {
  for (let i = 0; i < 9; i++) streamChunks();
}
