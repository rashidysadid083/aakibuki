import { scene } from './core.js';
import { SP } from './config.js';
import { GS, fwd, parked } from './state.js';
import { roadCoord, heightAt } from './terrain.js';
import { makeVehicle } from './vehicles.js';
import { makePerson } from './people.js';

// ---------- চলন্ত গাড়ি আর মানুষ: রাস্তা ধরে চলে, দূরে গেলে গাড়ির সামনে নতুন করে বসে ----------
const makeBus = () => makeVehicle('bus'), makeCng = () => makeVehicle('cng');
export const actors = [];
export function respawn(a, first) {
  a.axis = Math.random() < 0.5 ? 'z' : 'x';
  const c = a.axis === 'z' ? GS.focus.position.x : GS.focus.position.z, tc = a.axis === 'z' ? GS.focus.position.z : GS.focus.position.x;
  const k = Math.round(c / SP), near = c / SP - k > 0 ? 1 : -1;
  a.idx = Math.random() < 0.6 ? k : k + near; // গাড়ির কাছের রাস্তাগুলো থেকেই বেছে নেয়
  const fw = Math.sign(a.axis === 'z' ? fwd.z : fwd.x) || 1;
  const off = first ? (Math.random() - 0.5) * 220 : (Math.random() < 0.7 ? fw : -fw) * (90 + Math.random() * 40);
  a.t = tc + (Math.abs(off) < 20 ? off + 40 : off);
  a.dir = Math.random() < 0.5 ? 1 : -1;
  a.cruise = a.speed = a.v0 + Math.random() * (a.v1 - a.v0);
  a.hold = 0;
  a.lane = a.walk ? (Math.random() < 0.5 ? -1 : 1) * (4.6 + Math.random() * 1.2) : 1.6; // বাঁ দিক দিয়ে চলা
}
export function makeActor(obj, r, walk, v0, v1) {
  scene.add(obj);
  return { obj, r, walk, v0, v1, z: 0, x: 0, dir: 1, speed: 0, cruise: 0, hold: 0, lane: 0, ph: Math.random() * 6.28 };
}
function addActor(obj, r, walk, v0, v1) {
  const a = makeActor(obj, r, walk, v0, v1);
  actors.push(a);
  respawn(a, true);
}
export function updateActors(dt) {
  for (let ai = 0; ai < Math.min(actors.length, GS.actorLimit); ai++) {
    const a = actors[ai];
    a.t += a.dir * a.speed * dt;
    const c = roadCoord(a.axis, a.idx, a.t);
    const sl = (roadCoord(a.axis, a.idx, a.t + 1) - roadCoord(a.axis, a.idx, a.t - 1)) / 2, n = Math.hypot(1, sl);
    const Tx = a.axis === 'z' ? sl / n : 1 / n, Tz = a.axis === 'z' ? 1 / n : sl / n; // +t দিকের একক ভেক্টর
    const off = a.walk ? a.lane : a.lane * a.dir;
    a.x = (a.axis === 'z' ? c : a.t) + Tz * off;
    a.z = (a.axis === 'z' ? a.t : c) - Tx * off;
    const Fx = Tx * a.dir, Fz = Tz * a.dir, hl = a.obj.userData.hl;
    let y = 0, pitch = 0;
    if (hl > 0) { // নিজের গাড়ির মতো সামনে-পেছনের ঢাল ধরে কাত
      const hF = heightAt(a.x + Fx * hl, a.z + Fz * hl), hB = heightAt(a.x - Fx * hl, a.z - Fz * hl);
      y = (hF + hB) / 2; pitch = -Math.atan2(hF - hB, 2 * hl);
      for (const w of a.obj.userData.wheels) w.rotation.x += a.speed * dt / w.userData.r;
    } else {
      const sw = Math.sin(a.ph + a.t * 4.5);
      y = heightAt(a.x, a.z) + Math.abs(sw) * 0.05;
      a.obj.userData.legs[0].rotation.x = sw * 0.7;
      a.obj.userData.legs[1].rotation.x = -sw * 0.7;
    }
    if (hl > 0) { // সামনের লেনে বাধা (তোমার গাড়ি/চরিত্র, দাঁড়ানো গাড়ি, অন্য এনপিসি) থাকলে ব্রেক
      let gap = 1e9, kind = 0;
      const test = (ox, oz, r, k) => {
        const dx = ox - a.x, dz = oz - a.z, al = dx * Fx + dz * Fz;
        if (al <= 0 || Math.abs(dx * Fz - dz * Fx) > 1.5 + r * 0.5) return;
        const g = al - a.r - r;
        if (g < gap) { gap = g; kind = k; }
      };
      if (GS.airH < 3) test(GS.focus.position.x, GS.focus.position.z, GS.pmode === 'drive' ? GS.veh.userData.r : 0.4, 1);
      for (const g of parked) test(g.position.x, g.position.z, g.userData.r, 1);
      for (let k = 0; k < Math.min(actors.length, GS.actorLimit); k++) if (actors[k] !== a) test(actors[k].x, actors[k].z, actors[k].r, 2);
      const stopD = 2.5 + a.speed * 0.9;
      const free = kind === 2 && a.hold > 10; // দুই এনপিসি আটকে গেলে ১০ সেকেন্ড পর ছাড়ে
      const want = gap < stopD && !free ? a.cruise * Math.max(0, (gap - 1) / (stopD - 1)) : a.cruise;
      a.speed += (want - a.speed) * Math.min(1, (want < a.speed ? 6 : 1.5) * dt);
      if (gap < 0.8 && !free) a.speed = 0;
      a.hold = a.speed < 0.3 && gap < stopD ? a.hold + dt : 0;
    }
    a.obj.position.set(a.x, y, a.z);
    a.obj.rotation.set(pitch, Math.atan2(Fx, Fz), 0);
    const fp = GS.focus.position, fr = GS.pmode === 'drive' ? GS.veh.userData.r : 0.4;
    const ox = fp.x - a.x, oz = fp.z - a.z, d = Math.hypot(ox, oz), min = a.r + fr;
    if (GS.airH < 3 && d < min && d > 0.001) {
      fp.x = a.x + ox / d * min;
      fp.z = a.z + oz / d * min;
      if (GS.pmode === 'drive') GS.speed *= 0.5;
    }
    if (d > 190) respawn(a, false);
  }
}
const shirts = [0xb5473a, 0x3b6ea5, 0xe0b13a, 0x5a8a4a, 0x8a4f9a, 0xd9d2c0];

export function initActors() {
  let pi = 0;
  for (const m of ['bus', 'p', 'cng', 'car', 'p', 'truck', 'cng', 'p', 'car', 'p', 'p']) { // কম মানেও সব ধরন দেখা যাবে
    if (m === 'bus') addActor(makeBus(), 2.6, false, 5, 7);
    else if (m === 'cng') addActor(makeCng(), 1.4, false, 6, 8.5);
    else if (m === 'car') addActor(makeVehicle('car'), 1.2, false, 7, 10);
    else if (m === 'truck') addActor(makeVehicle('truck'), 2, false, 4.5, 6.5);
    else addActor(makePerson(shirts[pi++ % shirts.length]), 0.5, true, 1.2, 1.8);
  }
}
