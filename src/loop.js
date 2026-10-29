import * as THREE from 'three';
import { renderer, cam, sun, scene } from './core.js';
import { GS, fwd } from './state.js';
import { heightAt } from './terrain.js';
import { chunks, streamChunks } from './chunks.js';
import { updateActors } from './actors.js';
import { doorTick } from './transit.js';
import { advanceTime, sunOff } from './daynight.js';
import { autoQuality } from './quality.js';
import { areaTick } from './audio.js';
import { PM, uiTick } from './modes.js';

// ---------- মূল লুপ + FPS ----------
const camP = [8, 4.5, 2.5, 4, 1]; // ক্যামেরার বর্তমান মাপ, মোড বদলালে মসৃণভাবে বদলায়
const camGoal = new THREE.Vector3(), look = new THREE.Vector3();
let fpsEl, last, frames = 0, acc = 0, worst = 0;

export function initLoop() {
  fpsEl = document.getElementById('fps');
  last = performance.now();
}

export function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  PM[GS.pmode].update(dt);
  uiTick(dt);
  doorTick(dt);
  streamChunks();
  updateActors(dt);
  advanceTime(dt);
  autoQuality(dt, now);
  areaTick(dt);

  // সূর্য গাড়ির সাথে সরে, যাতে ছায়া সবসময় গাড়ির আশেপাশে থাকে
  sun.position.set(GS.focus.position.x + sunOff.x, sunOff.y, GS.focus.position.z + 20);
  sun.target.position.set(GS.focus.position.x, GS.focus.position.y - GS.airH, GS.focus.position.z);

  // পেছন থেকে অনুসরণকারী ক্যামেরা
  const cv = PM[GS.pmode].cam(), fp = GS.focus.position; // [দূরত্ব, উচ্চতা, মাটি থেকে সর্বনিম্ন, সামনে তাকানো, তাকানোর উচ্চতা]
  for (let i = 0; i < 5; i++) camP[i] += (cv[i] - camP[i]) * (1 - Math.exp(-4 * dt));
  camGoal.copy(fp).addScaledVector(fwd, -camP[0]);
  camGoal.y = Math.max(fp.y + camP[1], heightAt(camGoal.x, camGoal.z) + camP[2]);
  cam.position.lerp(camGoal, 1 - Math.exp(-5 * dt));
  look.copy(fp).addScaledVector(fwd, camP[3]).y += camP[4];
  cam.lookAt(look);

  renderer.render(scene, cam);

  frames++; acc += dt; worst = Math.max(worst, dt);
  if (acc >= 0.5) {
    fpsEl.textContent = Math.round(frames / acc) + ' FPS · সবচেয়ে ধীর ফ্রেম ' + Math.round(worst * 1000) + 'ms · chunk ' + chunks.size;
    frames = 0; acc = 0; worst = 0;
  }
}
