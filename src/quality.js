import { renderer, curAA, makeRenderer, scene, sun } from './core.js';
import { GS } from './state.js';
import { setStreamRadius } from './chunks.js';
import { actors } from './actors.js';

// ---------- মান: নিম্ন / মধ্যম / উচ্চ, আর FPS দেখে স্বয়ংক্রিয় বদল ----------
const TIERS = [
  { name: 'নিম্ন', aa: false, pr: 1.0, shadow: 0, rad: 2, fog: [28, 78], actors: 5 },
  { name: 'মধ্যম', aa: true, pr: 1.25, shadow: 512, rad: 2, fog: [30, 78], actors: 8 },
  { name: 'উচ্চ', aa: true, pr: 1.6, shadow: 1024, rad: 3, fog: [40, 115], actors: 11 }
];
const MODES = ['auto', 'low', 'mid', 'high'];
let mode = 'auto', tier = 2;
export let startTier, qualBtn;
function qualLabel() { qualBtn.textContent = 'মান: ' + (mode === 'auto' ? 'স্বয়ংক্রিয় · ' : '') + TIERS[tier].name; }

export function initQuality() {
  try { mode = localStorage.getItem('kb_mode') || 'auto'; } catch (e) {}
  if (MODES.indexOf(mode) < 0) mode = 'auto';
  startTier = mode === 'auto' ? 2 : MODES.indexOf(mode) - 1;
  qualBtn = document.getElementById('qual');
  qualBtn.addEventListener('click', () => {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    try { localStorage.setItem('kb_mode', mode); } catch (e) {}
    if (mode !== 'auto') applyTier(MODES.indexOf(mode) - 1); else qualLabel();
    qWarm = 4;
  });
}

export function applyTier(k) {
  const t = TIERS[k];
  tier = k;
  if (curAA !== t.aa) makeRenderer(t.aa);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, t.pr));
  renderer.setSize(innerWidth, innerHeight);
  const sh = t.shadow > 0;
  renderer.shadowMap.enabled = sh;
  sun.castShadow = sh;
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  if (sh) sun.shadow.mapSize.set(t.shadow, t.shadow);
  setStreamRadius(t.rad); // chunk তালিকা নতুন করে হিসাব হবে
  scene.fog.near = t.fog[0]; scene.fog.far = t.fog[1];
  GS.actorLimit = t.actors;
  actors.forEach((a, i) => { a.obj.visible = i < t.actors; });
  qualLabel();
}

let qAcc = 0, qFrames = 0, qLow = 0, qHigh = 0, qWarm = 4, noUpUntil = 0;
export function autoQuality(dt, now) {
  if (mode !== 'auto' || (qWarm -= dt) > 0) return;
  qAcc += dt; qFrames++;
  if (qAcc < 2) return;
  const fps = qFrames / qAcc;
  qAcc = 0; qFrames = 0;
  if (fps < 40) { qLow++; qHigh = 0; } else if (fps > 56) { qHigh++; qLow = 0; } else { qLow = qHigh = 0; }
  if (qLow >= 2 && tier > 0) { applyTier(tier - 1); noUpUntil = now + 60000; qLow = 0; qWarm = 4; }
  else if (qHigh >= 6 && tier < 2 && now > noUpUntil) { applyTier(tier + 1); qHigh = 0; qWarm = 4; }
}
