import * as THREE from 'three';
import { PAPER } from './config.js';

// ---------- রেন্ডারার, দৃশ্য, ক্যামেরা ----------
export let renderer = null, curAA = null;
export function makeRenderer(aa) { // MSAA চালু/বন্ধ করতে নতুন রেন্ডারার লাগে
  if (renderer) { renderer.forceContextLoss(); renderer.dispose(); renderer.domElement.remove(); }
  renderer = new THREE.WebGLRenderer({ antialias: aa, powerPreference: 'high-performance' });
  document.body.insertBefore(renderer.domElement, document.body.firstChild);
  curAA = aa;
}


export let scene, cam, hemi, sun, bands, inkMat, propMat, dummy;
export function initCore() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  scene.fog = new THREE.Fog(PAPER, 40, 115);

  cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 140);
  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  });

  hemi = new THREE.HemisphereLight(0xfff3d6, 0x8a9a6a, 0.75);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 150 });
  scene.add(sun, sun.target);
  bands = new THREE.DataTexture(new Uint8Array([100, 175, 255]), 3, 1, THREE.LuminanceFormat);
  bands.minFilter = bands.magFilter = THREE.NearestFilter;
  bands.needsUpdate = true;

  inkMat = new THREE.MeshBasicMaterial({ color: 0x1a1620, side: THREE.BackSide });
  propMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: bands });
  dummy = new THREE.Object3D();
}

// জিওমেট্রি + রঙ থেকে কালি-আঁকা মেশ বানায়: ভেতরে টুন, পেছনে বড় করা উল্টো-হাল
export function inked(geo, color, thick = 0.05) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color, gradientMap: bands }));
  mesh.castShadow = mesh.receiveShadow = true;
  geo.computeBoundingBox();
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  const shell = new THREE.Mesh(geo, inkMat);
  shell.scale.set(1 + 2 * thick / size.x, 1 + 2 * thick / size.y, 1 + 2 * thick / size.z);
  mesh.add(shell);
  return mesh;
}
