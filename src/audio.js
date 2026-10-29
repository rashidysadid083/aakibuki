import { GS } from './state.js';
import { mulberry32 } from './rng.js';
import { zoneAt } from './terrain.js';
import { tod } from './daynight.js';

// ---------- শব্দ: এলাকা-ভেদে লোকসুর (সিনথেসাইজড) আর রিকশার ঘণ্টা, কোনো অডিও ফাইল নেই ----------
const STYLES = {
  village: { tonic: 146.83, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 62, voice: 'ektara', drone: 0.05, perc: 0 },    // গ্রাম: একতারা
  rural: { tonic: 130.81, scale: [0, 2, 4, 7, 9], bpm: 54, voice: 'flute', drone: 0.06, perc: 0 },              // মাঠ-নদী: ভাটিয়ালির বাঁশি
  town: { tonic: 164.81, scale: [0, 1, 4, 5, 7, 8, 11], bpm: 96, voice: 'harmonium', drone: 0.04, perc: 1 }   // শহর: হারমোনিয়াম + ঢোল
};
let AC = null, master = null, droneG = null, noiseBuf = null;
export let soundOn = true, vol = 0.4;
const droneO = [];
let area = 'village', areaT = 0, deg = 0, beat = 0, nextBeat = 0;
let mr;

// সেটিং-প্যানেল থেকে শব্দের মাত্রা বদল / সংরক্ষিত মান ফেরানো
export function setVolume(v) {
  vol = v;
  soundOn = vol > 0;
  if (master) master.gain.setTargetAtTime(soundOn ? vol : 0, AC.currentTime, 0.05);
}
export function restoreVolume(v) { vol = v; }
export function muteIfZero() { if (vol <= 0) soundOn = false; }

function initAudio() {
  try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  AC = new Ctx();
  master = AC.createGain();
  master.gain.value = soundOn ? vol : 0;
  master.connect(AC.destination);
  droneG = AC.createGain(); droneG.gain.value = 0; droneG.connect(master);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.connect(droneG);
  for (const m of [1, 1.5, 2]) { // সা-পা-সা তানপুরার মতো টানা সুর
    const o = AC.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = 146.83 * m; o.detune.value = (m - 1) * 3;
    o.connect(lp); o.start(); droneO.push([o, m]);
  }
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  nextBeat = AC.currentTime + 0.3;
}

export function initSound() {
  mr = mulberry32(2026);
  addEventListener('pointerdown', initAudio);
  addEventListener('keydown', initAudio);
  document.getElementById('snd').addEventListener('click', e => {
    soundOn = !soundOn;
    e.target.textContent = soundOn ? '🔊' : '🔇';
    if (master) master.gain.setTargetAtTime(soundOn ? vol : 0, AC.currentTime, 0.1);
  });

  setInterval(schedule, 150);
}

function note(f, t, dur, voice) {
  const o = AC.createOscillator(), g = AC.createGain(), flt = AC.createBiquadFilter();
  flt.type = 'lowpass'; o.connect(flt); flt.connect(g); g.connect(master);
  let peak = 0.3, a = 0.01, d = dur;
  if (voice === 'ektara') { // একতারার টুং: তীক্ষ্ণ শুরু, লম্বা ক্ষয়
    o.type = 'triangle'; flt.frequency.value = 2400;
    o.frequency.setValueAtTime(f * 1.03, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    d = 1.4;
  } else if (voice === 'flute') { // বাঁশি: নরম শুরু, কাঁপুনি
    o.type = 'sine'; flt.frequency.value = 3000; o.frequency.value = f; a = 0.12; peak = 0.28;
    const l = AC.createOscillator(), lg = AC.createGain();
    l.frequency.value = 5.5; lg.gain.value = f * 0.012; l.connect(lg); lg.connect(o.frequency);
    l.start(t); l.stop(t + a + d + 0.1);
  } else { // হারমোনিয়াম
    o.type = 'sawtooth'; flt.frequency.value = 1400; o.frequency.value = f; a = 0.03; peak = 0.14;
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  o.start(t); o.stop(t + a + d + 0.1);
}
function drum(t, kind) {
  const g = AC.createGain(); g.connect(master);
  if (kind === 0) { // ঢোলের ধপ
    const o = AC.createOscillator();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); o.start(t); o.stop(t + 0.25);
  } else { // খটখট
    const s = AC.createBufferSource(), f = AC.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 3200;
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    s.connect(f); f.connect(g); s.start(t); s.stop(t + 0.1);
  }
}
function schedule() { // সামনের ০.৪ সেকেন্ডের নোট আগেই সাজিয়ে রাখে
  if (!AC || AC.state !== 'running') return;
  const st = STYLES[area], spb = 60 / st.bpm, night = tod > 0.65 && tod < 0.95;
  droneO.forEach(([o, m]) => o.frequency.setTargetAtTime(st.tonic * m, AC.currentTime, 0.8));
  droneG.gain.setTargetAtTime(st.drone, AC.currentTime, 0.8);
  while (nextBeat < AC.currentTime + 0.4) {
    const t = nextBeat;
    if (st.perc && !night) {
      if (beat % 4 === 0) drum(t, 0);
      if (beat % 4 === 2 || beat % 8 === 5) drum(t, 1);
    }
    if (mr() < (night ? 0.45 : 0.7)) { // স্কেলের ওপর হাঁটা, মাঝে মাঝে সা-তে ফেরা
      deg = Math.max(-2, Math.min(st.scale.length + 1, deg + Math.round((mr() - 0.5) * 4)));
      if (beat % 8 === 7) deg = 0;
      const n = st.scale.length, oct = Math.floor(deg / n), idx = ((deg % n) + n) % n;
      note(st.tonic * 2 * Math.pow(2, (st.scale[idx] + 12 * oct) / 12), t, spb * (1 + mr()), st.voice);
    }
    nextBeat += spb * (st.perc ? 0.5 : 1);
    beat++;
  }
}
export function areaTick(dt) {
  areaT -= dt;
  if (areaT > 0) return;
  areaT = 0.5;
  const z = zoneAt(GS.focus.position.x, GS.focus.position.z);
  area = z > 0.5 ? 'town' : z > 0.05 ? 'village' : 'rural';
}
export function bell() { // রিকশার ঘণ্টা: ক্রিং-ক্রিং
  initAudio();
  if (!AC) return;
  const t = AC.currentTime;
  for (let k = 0; k < 2; k++) {
    [2093, 3136, 4180].forEach((f, i) => {
      const o = AC.createOscillator(), g = AC.createGain(), t0 = t + k * 0.16;
      o.type = 'sine'; o.frequency.value = f * (1 + 0.003 * i);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22 / (i + 1), t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.75);
    });
  }
}
