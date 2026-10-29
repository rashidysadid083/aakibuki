import { GS, keys } from './state.js';
import { flying } from './pm.js';
import { bell } from './audio.js';

// ---------- ইনপুট: কিবোর্ড + টাচ জয়স্টিক ----------
let activeId = null, joy, knob;
function moveKnob(e) {
  const r = joy.getBoundingClientRect();
  let x = (e.clientX - r.left - 70) / 70, y = (e.clientY - r.top - 70) / 70;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  GS.jx = Math.abs(x) < 0.08 ? 0 : x;
  GS.jy = Math.abs(y) < 0.08 ? 0 : y;
  knob.style.transform = `translate(${x * 50}px,${y * 50}px)`;
}

export function initInput() {
  addEventListener('keydown', e => keys[e.code] = 1);
  addEventListener('keyup', e => keys[e.code] = 0);

  joy = document.getElementById('joy');
  knob = document.getElementById('knob');
  joy.addEventListener('pointerdown', e => { activeId = e.pointerId; joy.setPointerCapture(activeId); moveKnob(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === activeId) moveKnob(e); });
  const release = e => { if (e.pointerId === activeId) { activeId = null; GS.jx = GS.jy = 0; knob.style.transform = ''; } };
  joy.addEventListener('pointerup', release);
  joy.addEventListener('pointercancel', release);
}

export const clamp1 = v => Math.max(-1, Math.min(1, v));
export function readSteer() {
  return clamp1(((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0) + GS.jx + (GS.btnR ? 1 : 0) - (GS.btnL ? 1 : 0));
}

// ---------- ব্রেক ও ঘণ্টার টাচ বোতাম ----------
function hold(id, on, off) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); on(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off);
}

// ব্রেক, ঘণ্টা আর (বাটন-মোডের) গ্যাস-বাঁ-ডান বোতাম
export function initButtons() {
  hold('brake', () => { GS.braking = true; }, () => { GS.braking = false; });
  hold('bell', () => { if (flying()) GS.boostHeld = true; else bell(); }, () => { GS.boostHeld = false; });
  addEventListener('keydown', e => { if (e.code === 'KeyB' && !flying()) bell(); });
  hold('gas', () => { GS.btnGas = true; }, () => { GS.btnGas = false; });
  hold('left', () => { GS.btnL = true; }, () => { GS.btnL = false; });
  hold('right', () => { GS.btnR = true; }, () => { GS.btnR = false; });
}
