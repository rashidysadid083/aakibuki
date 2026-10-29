import { mulberry32 } from './rng.js';

// ---------- কাগজের দানা আর ছেঁড়া বর্ডার: ছবি-ওভারলে, shader নয় ----------
export function initPaperOverlays() {
  const pr = mulberry32(777);
  const gc = document.createElement('canvas');
  gc.width = gc.height = 256;
  const g = gc.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const dark = pr() < 0.5, o = i * 4;
    img.data[o] = dark ? 70 : 255; img.data[o + 1] = dark ? 55 : 250; img.data[o + 2] = dark ? 40 : 235;
    img.data[o + 3] = pr() < 0.35 ? Math.floor(pr() * (dark ? 34 : 40)) : 0;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(255,250,235,0.10)';
  for (let i = 0; i < 90; i++) { // কাগজের তন্তু
    const x = pr() * 256, y = pr() * 256, a = pr() * 6.28, l = 4 + pr() * 10;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const grain = document.createElement('div');
  grain.style.cssText = 'position:fixed;inset:0;z-index:4;pointer-events:none;background-image:url(' + gc.toDataURL() + ')';
  document.body.appendChild(grain);

  const bc = document.createElement('canvas');
  bc.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:5;pointer-events:none';
  document.body.appendChild(bc);
  function tear() {
    const W = bc.width = innerWidth, H = bc.height = innerHeight, c = bc.getContext('2d');
    const r = mulberry32(4242), step = 6, nx = Math.ceil(W / step), ny = Math.ceil(H / step);
    const edge = n => { // এলোমেলো গভীরতার সীমানা
      const out = []; let o = 0;
      for (let i = 0; i <= n; i++) {
        o = Math.max(-6, Math.min(9, (o + (r() - 0.5) * 5) * 0.92));
        out.push(9 + o + (r() - 0.5) * 3);
      }
      return out;
    };
    const top = edge(nx), bot = edge(nx), lef = edge(ny), rig = edge(ny);
    c.beginPath();
    c.rect(0, 0, W, H);
    for (let i = 0; i <= nx; i++) c.lineTo(Math.min(W, i * step), top[i]);
    for (let j = 0; j <= ny; j++) c.lineTo(W - rig[j], Math.min(H, j * step));
    for (let i = nx; i >= 0; i--) c.lineTo(Math.min(W, i * step), H - bot[i]);
    for (let j = ny; j >= 0; j--) c.lineTo(lef[j], Math.min(H, j * step));
    c.closePath();
    c.shadowColor = 'rgba(60,45,25,0.5)';
    c.shadowBlur = 5;
    c.fillStyle = '#eadfc4';
    c.fill('evenodd');
  }
  tear();
  addEventListener('resize', tear);
}
