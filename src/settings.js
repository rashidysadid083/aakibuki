import { GS } from './state.js';
import { vol, setVolume, restoreVolume, muteIfZero } from './audio.js';
import { qualBtn } from './quality.js';

// ---------- সেটিং: শব্দের মাত্রা, নিয়ন্ত্রণের ধরন (জয়স্টিক / বাটন), মান ----------
let panel, volEl, pq;
function saveSet() { try { localStorage.setItem('kb_vol', vol); localStorage.setItem('kb_ctrl', GS.btnMode ? 'btn' : 'joy'); } catch (e) {} }
function showCtrl() {
  document.body.classList.toggle('btnmode', GS.btnMode);
  document.getElementById('cj').classList.toggle('on', !GS.btnMode);
  document.getElementById('cb').classList.toggle('on', GS.btnMode);
  GS.jx = GS.jy = 0; GS.btnGas = GS.btnL = GS.btnR = false; // মোড বদলালে আটকে থাকা ইনপুট ছাড়ে
}
function qualText() { return qualBtn.textContent.replace('মান: ', ''); }

export function initSettings() {
  try {
    const v = localStorage.getItem('kb_vol');
    if (v !== null) restoreVolume(Math.max(0, Math.min(0.8, +v)));
    GS.btnMode = localStorage.getItem('kb_ctrl') === 'btn';
  } catch (e) {}
  muteIfZero();

  panel = document.getElementById('panel'); volEl = document.getElementById('vol'); pq = document.getElementById('pq');
  volEl.value = Math.round(vol / 0.8 * 100);
  document.getElementById('set').addEventListener('click', () => { pq.textContent = qualText(); panel.classList.toggle('open'); });
  document.getElementById('pclose').addEventListener('click', () => panel.classList.remove('open'));
  document.getElementById('cj').addEventListener('click', () => { GS.btnMode = false; showCtrl(); saveSet(); });
  document.getElementById('cb').addEventListener('click', () => { GS.btnMode = true; showCtrl(); saveSet(); });
  pq.addEventListener('click', () => { qualBtn.click(); pq.textContent = qualText(); });
  volEl.addEventListener('input', () => {
    setVolume(volEl.value / 100 * 0.8);
    saveSet();
  });
  showCtrl();
}
