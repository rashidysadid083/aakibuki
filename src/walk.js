import { GS, keys, fwd } from './state.js';
import { surfaceAt, heightAt } from './terrain.js';
import { collide } from './chunks.js';
import { hero } from './people.js';
import { clamp1, readSteer } from './input.js';
import { collideParked } from './transit.js';

export function walk(dt) {
  const back = GS.btnMode && GS.braking ? 0.6 : 0; // বাটন-মোডে ব্রেক বাটন = পিছিয়ে হাঁটা
  const gas = clamp1(((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0) - GS.jy + (GS.btnGas ? 1 : 0) - back);
  const steer = readSteer();
  const target = gas > 0 ? gas * 4.4 : gas * 2;
  GS.hSpeed += (target - GS.hSpeed) * Math.min(1, 9 * dt);
  GS.hHead -= steer * 2.4 * dt; // দাঁড়িয়ে থেকেও ঘোরা যায়
  const wet = surfaceAt(hero.position.x, hero.position.z) === 'water' ? 0.5 : 1;
  fwd.set(Math.sin(GS.hHead), 0, Math.cos(GS.hHead));
  hero.position.addScaledVector(fwd, GS.hSpeed * wet * dt);
  collide(hero.position, 0.4);
  collideParked(hero.position, 0.4, null);
  GS.hPh += Math.abs(GS.hSpeed) * dt * 2.4;
  const sw = Math.sin(GS.hPh) * Math.min(1, Math.abs(GS.hSpeed) / 2), U = hero.userData;
  U.legs[0].rotation.x = sw * 0.8; U.legs[1].rotation.x = -sw * 0.8;
  U.arms[0].rotation.x = -sw * 0.7; U.arms[1].rotation.x = sw * 0.7;
  hero.position.y = heightAt(hero.position.x, hero.position.z) + Math.abs(sw) * 0.05;
  hero.rotation.y = GS.hHead;
}

// দাঁড়িয়ে থাকা গাড়ির সাথে ধাক্কা (বৃত্ত-দূরত্ব)
