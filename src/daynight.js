import * as THREE from 'three';
import { scene, hemi, sun } from './core.js';
import { streetMat } from './roads.js';
import { headMat, tailMat } from './vehicles.js';

// ---------- দিন-রাত: ভোর, দুপুর, সন্ধ্যা, রাতের চার কী-ফ্রেমের মাঝে মসৃণ বদল ----------
const KEYS = [
  { sky: 0xf0c8a4, hemi: 0xffe6c4, hi: 0.6, sun: 0xffb27a, si: 0.6 },
  { sky: 0xeadfc4, hemi: 0xfff3d6, hi: 0.75, sun: 0xffffff, si: 0.8 },
  { sky: 0xe8a07a, hemi: 0xffcfa0, hi: 0.55, sun: 0xff8f5c, si: 0.55 },
  { sky: 0x2f3858, hemi: 0x8a9cdc, hi: 0.7, sun: 0x8fa6e0, si: 0.35 }
].map(k => ({ ...k, sky: new THREE.Color(k.sky), hemi: new THREE.Color(k.hemi), sun: new THREE.Color(k.sun) }));
const NAMES = ['ভোর', 'দুপুর', 'সন্ধ্যা', 'রাত'];
export const sunOff = { x: 30, y: 50 };
let clockBtn;
export let tod = 0.2;
let lastName = '', DAY_SECONDS = 160;

export function initDayNight() {
  clockBtn = document.getElementById('clock');
  clockBtn.addEventListener('click', () => { tod = ((Math.floor(tod * 4 + 1e-6) + 1) % 4) / 4; });
}

export function advanceTime(dt) {
  tod = (tod + dt / DAY_SECONDS) % 1;
  const u = tod * 4, i = Math.floor(u) % 4, j = (i + 1) % 4;
  let f = u - Math.floor(u);
  f = f * f * (3 - 2 * f);
  const A = KEYS[i], B = KEYS[j];
  scene.background.copy(A.sky).lerp(B.sky, f);
  scene.fog.color.copy(scene.background);
  hemi.color.copy(A.hemi).lerp(B.hemi, f);
  hemi.intensity = A.hi + (B.hi - A.hi) * f;
  sun.color.copy(A.sun).lerp(B.sun, f);
  sun.intensity = A.si + (B.si - A.si) * f;
  const a = tod * Math.PI * 2;
  sunOff.x = Math.cos(a) * 40;
  sunOff.y = 14 + 36 * Math.abs(Math.sin(a));
  const nm = NAMES[Math.round(u) % 4];
  if (nm !== lastName) { clockBtn.textContent = nm; lastName = nm; }
}


let lampManual = false, lampOn = false, lampNight = false; // হেডলাইট-টেইললাইট: রাতে নিজে জ্বলে, বাটনে হাতেও জ্বালানো যায়
export function lampTick() {
  const nt = tod > 0.62 && tod < 0.97;
  if (nt !== lampNight) { lampNight = nt; streetMat.color.set(nt ? 0xfff0a8 : 0x8a8470); }
  const on = lampManual || (tod > 0.62 && tod < 0.97);
  if (on === lampOn) return;
  lampOn = on;
  headMat.color.set(on ? 0xfff0a8 : 0x8a8470);
  tailMat.color.set(on ? 0xff2a1a : 0x6a1d18);
}
export function toggleLamp() { lampManual = !lampManual; return lampManual; }
