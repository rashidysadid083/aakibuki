import * as THREE from 'three';
import { mulberry32 } from './rng.js';

// ---------- জমি (সমতল, জলরঙের দাগ-টেক্সচার) ----------
export function washTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4ec';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 40},${130 + Math.random() * 40},70,0.18)`;
    g.beginPath();
    g.arc(Math.random() * 128, Math.random() * 128, 8 + Math.random() * 20, 0, 6.283);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  return t;
}

export function canvasTex(n, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// রাস্তার পাঁচ ধরনের টেক্সচার (canvas-এ আঁকা)
export function createRoadTextures() {
const trnd = mulberry32(777);
const dots = (g, n, count, cols, max) => { for (let i = 0; i < count; i++) { g.fillStyle = cols[(trnd() * cols.length) | 0]; g.fillRect(trnd() * n, trnd() * n, 1 + trnd() * max, 1 + trnd() * max); } };
return {
  dirt: canvasTex(128, (g, n) => { // মাটির পথ: দানা + গাড়ির চাকার দাগ
    g.fillStyle = '#cdb68c'; g.fillRect(0, 0, n, n);
    dots(g, n, 450, ['#b79f74', '#dccaa0', '#c2aa7e'], 2.5);
    g.fillStyle = 'rgba(90,70,40,.16)'; g.fillRect(n * .15, 0, n * .1, n); g.fillRect(n * .75, 0, n * .1, n);
  }),
  brick: canvasTex(256, (g, n) => { // ইটের ঝালাই: ±৪৫° বাঁকা ইট
    g.fillStyle = '#6e5a4c'; g.fillRect(0, 0, n, n);
    for (let y = -16; y < n + 16; y += 16) for (let x = -16; x < n + 16; x += 16) {
      g.save(); g.translate(x + 8, y + 8); g.rotate(((x + y) / 16) & 1 ? Math.PI / 4 : -Math.PI / 4);
      g.fillStyle = 'hsl(' + (8 + trnd() * 10) + ',' + (45 + trnd() * 15) + '%,' + (38 + trnd() * 12) + '%)';
      g.fillRect(-10, -3.5, 20, 7); g.restore();
    }
  }),
  slab: canvasTex(256, (g, n) => { // সাদা চকচকে পাথরের স্ল্যাব
    g.fillStyle = '#ecebe6'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) & 1 ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.04)'; g.fillRect(i * 128, j * 128, 128, 128); }
    g.fillStyle = '#c4c2ba'; g.fillRect(0, 0, n, 2); g.fillRect(0, 126, n, 3); g.fillRect(0, 0, 2, n); g.fillRect(126, 0, 3, n);
    const gr = g.createLinearGradient(0, 0, n, n); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.2)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
  }),
  asphalt: canvasTex(256, (g, n) => { // কালো পিচ: দানা, মোজাইকের মতো প্যাচ, ফাটা দাগ
    g.fillStyle = '#3b3b42'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 7; i++) { g.fillStyle = i & 1 ? '#45454d' : '#323238'; g.fillRect(8 + trnd() * (n - 100), 8 + trnd() * (n - 100), 40 + trnd() * 50, 30 + trnd() * 50); }
    dots(g, n, 1400, ['#55555d', '#2b2b30', '#4a4a52'], 1.8);
    g.strokeStyle = '#25252a'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); let x = 20 + trnd() * (n - 40), y = 20 + trnd() * (n - 40); g.moveTo(x, y); for (let k = 0; k < 4; k++) g.lineTo(x += trnd() * 24 - 12, y += trnd() * 24 - 4); g.stroke(); }
  }),
  walk: canvasTex(128, (g, n) => { // ফুটপাতের টাইল
    g.fillStyle = '#cfc8ba'; g.fillRect(0, 0, n, n);
    g.fillStyle = '#b4ad9f'; g.fillRect(0, 0, n, 2); g.fillRect(0, 64, n, 2); g.fillRect(0, 0, 2, n); g.fillRect(64, 0, 2, n);
    dots(g, n, 120, ['#c2baab', '#d8d1c3'], 2);
  })
};
}
