import { GS, parked } from './state.js';
import { hero } from './people.js';
import { mbtn, setPM, flying } from './pm.js';
import { nearVeh, enterVeh, exitVeh, callVeh } from './transit.js';
import { drive } from './drive.js';
import { walk } from './walk.js';
import { fly, flyGo, startLanding, FCAM, FOLD_CAM } from './fly.js';
import { FS } from './flightphys.js';
import { toggleLamp, lampTick } from './daynight.js';

// ---------- মোড সিস্টেম: গাড়ি / হাঁটা / কাগজের বিমান / পাখি (নতুন মোড PM আর MB-তে জোড়ো) ----------
const HERO_CAM = [5, 2.7, 1.6, 2.5, 1.3];
export const PM = {
  drive: { update: drive, focus: () => GS.veh, cam: () => GS.veh.userData.cam,
    go() { if (GS.pmode === 'drive') return; if (flying()) { startLanding('drive'); return; } enterVeh(nearVeh() || callVeh()); } },
  walk: { update: walk, focus: () => hero, cam: () => HERO_CAM,
    go() { if (GS.pmode === 'walk') return; if (flying()) startLanding(); else exitVeh(); } },
  plane: { update: fly, focus: () => GS.fobj, cam: () => FS.state === 'fold' ? FOLD_CAM : FCAM, go() { flyGo('plane'); } },
  bird: { update: fly, focus: () => GS.fobj, cam: () => FCAM, go() { flyGo('bird'); } }
};
const MB = [['walk', '🚶 হাঁটা'], ['drive', '🚙 গাড়ি'], ['plane', '✈ বিমান'], ['bird', '🦜 পাখি']];

let uiT = 0, actBtn;
function actPress() {
  if (flying()) startLanding();
  else if (GS.pmode === 'drive') exitVeh();
  else { const c = nearVeh(); if (c) enterVeh(c); }
}
export function uiTick(dt) { // বোতামের লেখা আর দূরের দাঁড়ানো গাড়ি লুকানো, প্রতি ০.১৫ সেকেন্ডে
  uiT -= dt;
  if (uiT > 0) return;
  uiT = 0.15;
  lampTick();
  const t = flying() ? (FS.state === 'fold' ? '' : FS.landing ? 'নামছি…' : 'নামো') : GS.pmode === 'drive' ? (GS.wantExit ? 'থামছি…' : 'নামো') : (nearVeh() ? 'ঢোকো' : '');
  if (t !== GS.actTxt) { GS.actTxt = t; actBtn.textContent = t; actBtn.classList.toggle('show', !!t); }
  for (const g of parked) g.visible = Math.hypot(g.position.x - GS.focus.position.x, g.position.z - GS.focus.position.z) < 135;
}

export function initModes() {
  mbtn.push(...MB.map(([pm, label]) => {
    const el = document.createElement('button');
    el.className = 'mb'; el.textContent = label;
    el.addEventListener('click', () => PM[pm].go());
    document.getElementById('modes').appendChild(el);
    return { pm, el };
  }));
  actBtn = document.getElementById('act');
  actBtn.addEventListener('click', actPress);
  addEventListener('keydown', e => { if (e.code === 'KeyE') actPress(); });
  const lampBtn = document.createElement('button');
  lampBtn.className = 'mb'; lampBtn.textContent = '💡';
  lampBtn.addEventListener('click', () => { lampBtn.classList.toggle('on', toggleLamp()); lampTick(); });
  document.getElementById('modes').appendChild(lampBtn);
  setPM('drive');
}
