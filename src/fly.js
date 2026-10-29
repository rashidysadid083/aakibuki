import { cam } from './core.js';
import { WATER } from './config.js';
import { GS, keys, fwd } from './state.js';
import { heightAt } from './terrain.js';
import { collide } from './chunks.js';
import { hero } from './people.js';
import { clamp1, readSteer } from './input.js';
import { setPM, flying, engFill } from './pm.js';
import { collideParked, exitVeh, enterVeh, nearVeh, callVeh } from './transit.js';
import { FS, PK, BK, flyStep } from './flightphys.js';
import { paperPlane, foldPlane } from './paperplane.js';
import { getBird, birdKind } from './birds.js';

export const FCAM = [8, 3, 2.5, 7, 0], FOLD_CAM = [3.4, 1.3, 1.2, 1, 0.8];

// ---- ওড়া, ওঠা, নামা ----
export function takeFlight(kind) {
  if (GS.pmode === 'drive') { GS.speed = 0; GS.wantExit = false; exitVeh(); } // গাড়ি থেমে যায়, তারপর চরিত্র নামে
  const to = kind === 'plane' ? paperPlane : getBird(birdKind), K = kind === 'plane' ? PK : BK[birdKind];
  if (flying()) { // বিমান থেকে পাখি বা উল্টোটা: জায়গা ও দিক একই থাকে
    if (FS.state === 'fold' || FS.landing) return;
    to.position.copy(GS.fobj.position); GS.fobj.visible = false; to.visible = true;
    GS.fobj = to; FS.K = K; FS.fa = 0; FS.tk = 0;
    setPM(kind);
    return;
  }
  Object.assign(FS, { yaw: GS.hHead, roll: 0, sIn: 0, en: 1, tired: false, landing: false, after: null, touch: 0, assist: 0, ph: 0, fa: 0, tk: 0, K });
  GS.fobj = to;
  if (kind === 'plane') {
    FS.state = 'fold'; FS.fold = 0; FS.pitch = 0; FS.v = 0;
    foldPlane(0);
  } else {
    FS.state = 'fly'; FS.pitch = 0.3; FS.v = K.vc * 0.8;
    to.position.set(hero.position.x, hero.position.y + 1.3, hero.position.z);
    hero.visible = false;
  }
  to.visible = true;
  setPM(kind);
}
export function flyGo(kind) { if (GS.pmode === kind) startLanding(); else takeFlight(kind); }
export function startLanding(after) {
  if (!flying()) return;
  if (FS.state === 'fold') { cancelFold(after); return; }
  FS.landing = true; FS.after = after || null;
}
function resetHeroPose() { const U = hero.userData; U.arms[0].rotation.x = U.arms[1].rotation.x = 0; }
function cancelFold(after) {
  paperPlane.visible = false; hero.visible = true; resetHeroPose();
  setPM('walk');
  if (after === 'drive') enterVeh(nearVeh() || callVeh());
}
function finishLanding() {
  const o = GS.fobj, p = o.position, after = FS.after;
  hero.position.set(p.x, heightAt(p.x, p.z), p.z);
  GS.hHead = FS.yaw; GS.hSpeed = 0; hero.visible = true; o.visible = false;
  FS.landing = false; FS.after = null;
  setPM('walk');
  if (after === 'drive') enterVeh(nearVeh() || callVeh());
}
function foldTick(dt) { // বিমান ভাঁজ হচ্ছে: চরিত্রের সামনে, তারপর ছুড়ে দেয়
  const S = FS, o = GS.fobj, U = hero.userData;
  S.fold = Math.min(1, S.fold + dt / 1.7);
  fwd.set(Math.sin(S.yaw), 0, Math.cos(S.yaw));
  o.position.set(hero.position.x + fwd.x, hero.position.y + 1.45 + Math.sin(S.fold * 6.28) * 0.04, hero.position.z + fwd.z);
  o.rotation.set(0, S.yaw, 0);
  foldPlane(S.fold);
  U.arms[0].rotation.x = U.arms[1].rotation.x = -1.2;
  U.legs[0].rotation.x = U.legs[1].rotation.x = 0;
  GS.airH = 1.5;
  if (S.fold >= 1) { hero.visible = false; resetHeroPose(); S.state = 'fly'; S.v = S.K.vc * 1.35; S.pitch = 0.3; S.assist = 1.1; }
}
function birdAnim(dt, flapping, pushing) {
  const S = FS, K = S.K, U = GS.fobj.userData;
  S.ph += dt * K.fr * (pushing ? 1.35 : 1) * (flapping ? 1 : 0.2);
  S.fa += ((flapping ? (pushing ? 1 : 0.65) : 0) - S.fa) * Math.min(1, 8 * dt);
  S.tk += ((S.pitch < -0.45 && S.v > K.vc * 1.15 ? 1 : 0) - S.tk) * Math.min(1, 6 * dt); // ডাইভে ডানা গুটিয়ে যায়
  const a = 0.16 * (1 - S.fa) * (1 - S.tk) + Math.sin(S.ph) * K.amp * S.fa;
  const a2 = Math.sin(S.ph - 0.9) * K.amp * 0.55 * S.fa - 0.1 * S.tk;
  for (let i = 0; i < 2; i++) {
    const s = i ? -1 : 1;
    U.wings[i].rotation.set(0, s * S.tk * 1.1, s * a);
    U.outer[i].rotation.set(0, s * S.tk * 0.7, s * a2);
  }
  U.rig.position.y = Math.sin(S.ph * 2) * 0.03 * S.fa;
  if (U.train) U.train.rotation.y = -S.sIn * 0.3 + Math.sin(S.ph * 0.5) * 0.05;
}
export function fly(dt) {
  const S = FS, o = GS.fobj, K = S.K, p = o.position;
  if (S.state === 'fold') { foldTick(dt); return; }
  const pIn = clamp1(-GS.jy + ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0) + (GS.btnGas ? 0.5 : 0) - (GS.braking ? 0.7 : 0)); // ওপরে ঠেললে নাক ওঠে
  const gy = heightAt(p.x, p.z), water = gy <= WATER + 0.05;
  const r = flyStep(dt, p, gy, water, pIn, readSteer(), !!(GS.boostHeld || keys.ShiftLeft || keys.ShiftRight || keys.KeyB));
  const h = p.y - gy;
  GS.airH = h;
  if (h < 6 && collide(p, K.r)) S.v *= 0.75; // গাছ-ঘরের কাছে নিচু দিয়ে উড়লে ধাক্কা
  if (h < 2.5) collideParked(p, K.r, null);
  if (r.landed) { finishLanding(); return; }
  fwd.set(Math.sin(S.yaw), 0, Math.cos(S.yaw));
  if (K.flapper) birdAnim(dt, r.flapping, r.pushing);
  else S.ph += dt;
  o.rotation.set(-S.pitch, S.yaw, S.roll + (K.flapper ? 0 : Math.sin(S.ph * 3) * 0.03));
  FCAM[0] = K.cd + Math.max(0, S.v - K.vc) * 0.12;
  FCAM[1] = K.ch;
  FCAM[4] = Math.max(-2.5, Math.min(4, Math.sin(S.pitch) * 7));
  const fT = 60 + Math.max(-2, Math.min(12, (S.v - K.vc) * 0.7)); // গতি বাড়লে দৃষ্টিকোণ একটু চওড়া
  if (Math.abs(cam.fov - fT) > 0.1) { cam.fov += (fT - cam.fov) * Math.min(1, 4 * dt); cam.updateProjectionMatrix(); }
  const eb = Math.round(S.en * 40) + (S.tired ? 100 : 0);
  if (eb !== S.enBar) { S.enBar = eb; engFill.style.width = Math.round(S.en * 100) + '%'; engFill.style.background = S.tired ? '#999' : '#d9503f'; }
}
