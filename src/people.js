import * as THREE from 'three';
import { scene, inked } from './core.js';

export function makePerson(shirt) {
  const g = new THREE.Group();
  const legs = [-0.11, 0.11].map(x => { // কোমরে কবজা, তাই পা দুলবে
    const l = inked(new THREE.CylinderGeometry(0.09, 0.08, 0.62, 6).translate(0, -0.31, 0), 0x3a3a46, 0.03);
    l.position.set(x, 0.66, 0);
    g.add(l);
    return l;
  });
  const torso = inked(new THREE.CylinderGeometry(0.26, 0.3, 0.8, 6), shirt, 0.04); torso.position.y = 1.08;
  const head = inked(new THREE.SphereGeometry(0.2, 8, 6), 0xc89a76, 0.04); head.position.y = 1.7;
  g.add(torso, head);
  g.userData = { legs, hl: 0 };
  return g;
}


function makeHero() { // ছোট চরিত্র: টুপি, হাত-পা দোলে, কালির আউটলাইন
  const g = makePerson(0xe0b13a);
  const arms = [-0.34, 0.34].map(x => {
    const a = inked(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 6).translate(0, -0.27, 0), 0xc89a76, 0.03);
    a.position.set(x, 1.4, 0);
    g.add(a);
    return a;
  });
  const cap = inked(new THREE.CylinderGeometry(0.2, 0.23, 0.13, 8), 0xd9503f, 0.03);
  cap.position.y = 1.88;
  g.add(cap);
  g.userData.arms = arms;
  g.scale.setScalar(0.85);
  g.visible = false;
  return g;
}

export let hero;
export function initHero() {
  hero = makeHero();
  scene.add(hero);
}
