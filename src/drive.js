import { SURF } from './config.js';
import { GS, keys, fwd } from './state.js';
import { surfaceAt, heightAt } from './terrain.js';
import { collide } from './chunks.js';
import { clamp1, readSteer } from './input.js';
import { collideParked, exitVeh } from './transit.js';

// ---------- গাড়ির চলন ----------
export function drive(dt) {
  const U = GS.veh.userData, sp = U.sp || 1;
  const revHold = GS.btnMode && GS.braking && GS.speed < 0.8; // বাটন-মোডে থেমে ব্রেক ধরলে পেছনে চলে
  const gas = GS.wantExit ? 0 : clamp1(
    ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0) - GS.jy + (GS.btnGas ? 1 : 0) - (revHold ? 0.6 : 0));
  const steer = readSteer();

  GS.speed += (gas * 18 * sp - GS.speed * 1.2) * dt;
  if ((GS.braking || keys.Space || GS.wantExit) && !revHold) GS.speed -= GS.speed * Math.min(1, (GS.wantExit ? 3 : 5) * dt);
  const lim = SURF[surfaceAt(GS.veh.position.x, GS.veh.position.z)] * sp;
  if (Math.abs(GS.speed) > lim) GS.speed += (Math.sign(GS.speed) * lim - GS.speed) * Math.min(1, 3 * dt);
  GS.heading -= steer * (U.turn || 1.8) * clamp1(GS.speed / 4) * dt;

  fwd.set(Math.sin(GS.heading), 0, Math.cos(GS.heading));
  GS.veh.position.addScaledVector(fwd, GS.speed * dt);
  let hit = collide(GS.veh.position, U.r);
  hit = collideParked(GS.veh.position, U.r, GS.veh) || hit;
  if (hit) GS.speed *= 0.5;
  for (const w of U.wheels) w.rotation.x += GS.speed * dt / (w.userData.r || 0.4);
  // জমির উচ্চতা অনুসরণ + সামনে-পেছনের ঢাল ধরে নাক ওঠানামা
  const hl = U.hl;
  const hF = heightAt(GS.veh.position.x + fwd.x * hl, GS.veh.position.z + fwd.z * hl);
  const hB = heightAt(GS.veh.position.x - fwd.x * hl, GS.veh.position.z - fwd.z * hl);
  GS.veh.position.y = (hF + hB) / 2;
  GS.veh.rotation.set(-Math.atan2(hF - hB, 2 * hl), GS.heading, 0);
  if (GS.wantExit && Math.abs(GS.speed) < 3) exitVeh();
}
