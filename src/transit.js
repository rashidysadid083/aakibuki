import { scene } from './core.js';
import { GS, parked } from './state.js';
import { heightAt } from './terrain.js';
import { hero } from './people.js';
import { actors, makeActor, respawn } from './actors.js';
import { makeVehicle, car } from './vehicles.js';
import { setPM } from './pm.js';

// দাঁড়িয়ে থাকা গাড়ির সাথে ধাক্কা (বৃত্ত-দূরত্ব)
export function collideParked(p, rad, self) {
  let hit = false;
  for (const g of parked) {
    if (g === self) continue;
    const ox = p.x - g.position.x, oz = p.z - g.position.z, d = Math.hypot(ox, oz), min = g.userData.r + rad;
    if (d < min && d > 0.001) { p.x = g.position.x + ox / d * min; p.z = g.position.z + oz / d * min; hit = true; }
  }
  return hit;
}
function trimParked() { // বেশি গাড়ি জমলে সবচেয়ে পুরনোটা সরিয়ে মেমরি ছাড়ে (প্রথম গাড়ি থাকে)
  while (parked.length > 5) {
    const i = parked.findIndex(g => g !== car);
    if (i < 0) break;
    const g = parked.splice(i, 1)[0];
    scene.remove(g);
    g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
  }
}

// হাঁটা অবস্থায় কাছের গাড়ি খোঁজে: দাঁড়ানো গাড়ি বা পথের এনপিসি গাড়ি

// হাঁটা অবস্থায় কাছের গাড়ি খোঁজে: দাঁড়ানো গাড়ি বা পথের এনপিসি গাড়ি
export function nearVeh() {
  const px = hero.position.x, pz = hero.position.z;
  let best = null, bd = 2.8;
  for (const g of parked) {
    const d = Math.hypot(g.position.x - px, g.position.z - pz) - g.userData.r;
    if (d < bd) { bd = d; best = { g, actor: null }; }
  }
  for (let i = 0; i < Math.min(actors.length, GS.actorLimit); i++) {
    const a = actors[i];
    if (a.walk) continue;
    const d = Math.hypot(a.x - px, a.z - pz) - a.r;
    if (d < bd) { bd = d; best = { g: a.obj, actor: a }; }
  }
  return best;
}


export function exitVeh() {
  if (GS.pmode !== 'drive') return;
  if (Math.abs(GS.speed) >= 3) { GS.wantExit = true; return; } // আগে ধীর হবে, তারপর নামবে
  GS.wantExit = false;
  GS.speed = 0;
  const U = GS.veh.userData, side = U.hw + 0.8, sn = Math.sin(GS.heading), cs = Math.cos(GS.heading);
  hero.position.set(GS.veh.position.x + cs * side + sn * U.dz, 0, GS.veh.position.z - sn * side + cs * U.dz); // বাঁ দরজা দিয়ে নামে
  hero.position.y = heightAt(hero.position.x, hero.position.z);
  GS.hHead = GS.heading; GS.hSpeed = 0;
  pokeDoor(GS.veh);
  parked.push(GS.veh);
  trimParked();
  hero.visible = true;
  setPM('walk');
}
export function enterVeh(c) {
  if (c.actor) { // পথের গাড়ি নিলে তার জায়গায় নতুন একটা এনপিসি গাড়ি আসে
    const o = c.actor, i = actors.indexOf(o);
    const na = makeActor(makeVehicle(o.obj.userData.kind), o.r, false, o.v0, o.v1);
    actors[i] = na; respawn(na, false); na.obj.visible = true;
    GS.speed = o.speed;
  } else { parked.splice(parked.indexOf(c.g), 1); GS.speed = 0; }
  GS.veh = c.g;
  pokeDoor(GS.veh);
  GS.heading = GS.veh.rotation.y;
  hero.visible = false;
  GS.wantExit = false;
  setPM('drive');
}
export function callVeh() { // কাছে গাড়ি না থাকলে শেষ চালানো গাড়িটা তোমার পাশে চলে আসে
  const g = parked.includes(GS.veh) ? GS.veh : car, U = g.userData, side = U.r + 1.4;
  g.position.x = hero.position.x + Math.cos(GS.hHead) * side + Math.sin(GS.hHead) * 1.5;
  g.position.z = hero.position.z - Math.sin(GS.hHead) * side + Math.cos(GS.hHead) * 1.5;
  g.position.y = heightAt(g.position.x, g.position.z);
  g.rotation.set(0, GS.hHead, 0);
  return { g, actor: null };
}


const dooring = new Set(); // দরজা খোলা-বন্ধের অ্যানিমেশন
function pokeDoor(g) { g.userData.dt = 1.4; dooring.add(g); }
export function doorTick(dt) {
  for (const g of dooring) {
    const U = g.userData;
    U.dt -= dt;
    U.da += ((U.dt > 0 ? 1 : 0) - U.da) * Math.min(1, 9 * dt);
    U.door.rotation.y = -1.15 * U.da;
    if (U.dt <= 0 && U.da < 0.02) { U.door.rotation.y = 0; U.da = 0; dooring.delete(g); }
  }
}
