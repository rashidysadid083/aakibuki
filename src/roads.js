import * as THREE from 'three';
import { bands, dummy } from './core.js';
import { createRoadTextures } from './textures.js';
import { heightAt, distAxis, roadCoord, zoneAt } from './terrain.js';
import { CS, SP } from './config.js';
import { tinted, combine, addProps } from './props.js';

// ---------- রাস্তা: ৪ ধরন + ফুটপাত, কার্ব, জেব্রা, স্পিড ব্রেকার, বাতিস্তম্ভ ----------
const mkRoad = (map, off) => new THREE.MeshToonMaterial({ map, vertexColors: true, gradientMap: bands, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off });
const ONE = new THREE.Color(1, 1, 1), EDGE_C = new THREE.Color(0x3b3229), WHITE = new THREE.Color(0xf4f0e6), YEL = new THREE.Color(0xe0b13a), CURB = new THREE.Color(0x8d887e);
function roadType(x, z) { const q = zoneAt(x, z); return q > 0.85 ? 'slab' : q > 0.5 ? 'asphalt' : q > 0.3 ? 'brick' : 'dirt'; }

export let ROADM, LAMP, lampGeo, streetMat;
export function initRoads() {
  const TEX = createRoadTextures();
  ROADM = { dirt: mkRoad(TEX.dirt, -2), brick: mkRoad(TEX.brick, -2), slab: mkRoad(TEX.slab, -2), asphalt: mkRoad(TEX.asphalt, -2), walk: mkRoad(TEX.walk, -3), paint: mkRoad(null, -5) };
  LAMP = combine([tinted(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6).translate(0, 2.1, 0), 0x3a3a42)]);
  lampGeo = new THREE.SphereGeometry(0.3, 6, 5);
  streetMat = new THREE.MeshBasicMaterial({ color: 0x8a8470 }); // রাতে জ্বলে (lampTick)
}
export function addLamps(parent, list) {
  if (!list.length) return;
  addProps(parent, LAMP, list, 0.04);
  const h = new THREE.InstancedMesh(lampGeo, streetMat, list.length);
  list.forEach((p, i) => { dummy.position.set(p.x, p.y + 4.3, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); h.setMatrixAt(i, dummy.matrix); });
  h.frustumCulled = false;
  parent.add(h);
}

// প্রতি chunk-এ ২ একক করে ফিতা; এলাকা (zoneAt) অনুযায়ী ধরন বদলায়, ধরন ধরে আলাদা মেশ

export function roadStrip(cx, cz) {
  const x0 = cx * CS, z0 = cz * CS, seg = 2, G = {}, lamps = [];
  for (const k in ROADM) G[k] = { v: [], c: [], u: [] };
  const add = (axis, idx) => {
    const t0 = axis === 'z' ? z0 : x0, c0 = axis === 'z' ? x0 : z0;
    for (let t = t0; t < t0 + CS; t += seg) {
      const ca = roadCoord(axis, idx, t), cb = roadCoord(axis, idx, t + seg), cm = (ca + cb) / 2;
      if (cm < c0 || cm >= c0 + CS) continue; // প্রতিটা টুকরো মাত্র একটা chunk-এর
      const xa = axis === 'z' ? ca : t, za = axis === 'z' ? t : ca;
      const xb = axis === 'z' ? cb : t + seg, zb = axis === 'z' ? t + seg : cb;
      const ya = heightAt(xa, za) + 0.08, yb = heightAt(xb, zb) + 0.08;
      const other = distAxis(axis === 'z' ? 'x' : 'z', (xa + xb) / 2, (za + zb) / 2); // মোড়ের দূরত্ব
      const ty = roadType((xa + xb) / 2, (za + zb) / 2), urban = ty !== 'dirt', ta = axis === 'z' ? za : xa, tb = axis === 'z' ? zb : xb;
      const P = (o, dy, e) => axis === 'z' ? [(e ? xb : xa) + o, (e ? yb : ya) + dy, e ? zb : za] : [e ? xb : xa, (e ? yb : ya) + dy, (e ? zb : za) + o];
      const quad = (k, A, B, D, E, c, u1, u2) => {
        const g = G[k];
        for (const [p, u, tt] of [[A, u1, ta], [D, u1, tb], [B, u2, ta], [B, u2, ta], [D, u1, tb], [E, u2, tb]]) { g.v.push(p[0], p[1], p[2]); g.c.push(c.r, c.g, c.b); g.u.push(u, tt / 6); }
      };
      const band = (k, o1, o2, c, dy) => quad(k, P(o1, dy, 0), P(o2, dy, 0), P(o1, dy, 1), P(o2, dy, 1), c, o1 / 6, o2 / 6);
      const wall = (k, o, d0, d1, c) => quad(k, P(o, d0, 0), P(o, d1, 0), P(o, d0, 1), P(o, d1, 1), c, 0, 0.1);
      band(ty, -3.2, 3.2, ONE, 0);
      if (other > 3.8) {
        if (!urban) { band('paint', -3.2, -2.9, EDGE_C, 0.03); band('paint', 2.9, 3.2, EDGE_C, 0.03); }
        else if (other > 5) for (const s of [1, -1]) { band('walk', s * 3.2, s * 4.8, ONE, 0.16); wall('paint', s * 3.2, 0, 0.16, CURB); } // ফুটপাত + কার্ব
      }
      if (ty === 'asphalt' && other > 5 && ((ta / seg) | 0) % 2 === 0) band('paint', -0.1, 0.1, WHITE, 0.03); // লেন-মার্কিং
      if (urban && other > 8 && other < 10) for (let k = -3; k < 3; k++) band('paint', k + 0.1, k + 0.9, WHITE, 0.04); // জেব্রা ক্রসিং
      if (urban && other > 13 && other < 15) band('paint', -3.2, 3.2, YEL, 0.09); // স্পিড ব্রেকার
      const n11 = Math.round(ta / seg);
      if (urban && other > 7 && n11 % 11 === 0) { const q = P((Math.abs(n11 / 11) % 2 ? 1 : -1) * 5.2, 0, 0); lamps.push({ x: q[0], y: q[1] + 0.1, z: q[2], ry: 0, s: 1 }); } // বাতিস্তম্ভ
    }
  };
  for (const axis of ['z', 'x']) {
    const lo = axis === 'z' ? x0 : z0;
    for (let i = Math.floor((lo - 110) / SP); i <= Math.ceil((lo + CS + 110) / SP); i++) add(axis, i);
  }
  const meshes = [];
  for (const k in G) {
    const g = G[k];
    if (!g.v.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.v), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.c), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.u), 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, ROADM[k]);
    m.receiveShadow = true;
    m.userData.own = true;
    meshes.push(m);
  }
  return { meshes, lamps };
}
