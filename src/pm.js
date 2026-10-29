import { cam } from './core.js';
import { GS } from './state.js';
import { hero } from './people.js';

// ---------- মোড বদলের মূল: কোন মোডে আছি, বোতামের লেখা, ক্যামেরার ফোকাস ----------
export const mbtn = []; // মোড-বোতাম (modes.js ভরে)
export let engEl, engFill, bsel, bellB, brakeB, gasB;
export function initPM() {
  engEl = document.getElementById('eng');
  engFill = engEl.firstChild;
  bsel = document.getElementById('bsel');
  bellB = document.getElementById('bell');
  brakeB = document.getElementById('brake');
  gasB = document.getElementById('gas');
}

export const flying = () => GS.pmode === 'plane' || GS.pmode === 'bird';

export function setPM(n) {
  GS.pmode = n;
  GS.focus = n === 'drive' ? GS.veh : n === 'walk' ? hero : GS.fobj;
  for (const b of mbtn) b.el.classList.toggle('on', b.pm === n);
  const fl = flying();
  if (!fl) { GS.airH = 0; if (cam.fov !== 60) { cam.fov = 60; cam.updateProjectionMatrix(); } }
  bsel.classList.toggle('show', n === 'bird');
  engEl.style.display = fl ? 'block' : 'none';
  bellB.textContent = fl ? (n === 'plane' ? 'বুস্ট' : 'ঝাপট') : 'ঘণ্টা';
  brakeB.textContent = fl ? 'ডুব' : 'ব্রেক';
  gasB.textContent = fl ? 'ওঠো' : 'গ্যাস';
  GS.actTxt = null;
}
