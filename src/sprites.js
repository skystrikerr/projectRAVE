import * as THREE from 'three';

const measurer = document.createElement('canvas').getContext('2d');

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Speech bubble sprite. Returns a THREE.Sprite sized in world units.
export function makeBubble(text, accent = '#ff2bd6') {
  const font = '600 30px "Segoe UI", system-ui, sans-serif';
  measurer.font = font;
  const tw = Math.min(measurer.measureText(text).width, 560);
  const pad = 20;
  const w = Math.ceil(tw + pad * 2);
  const h = 64;

  const c = document.createElement('canvas');
  c.width = w; c.height = h + 14; // extra room for the tail
  const ctx = c.getContext('2d');
  ctx.font = font;

  roundRect(ctx, 2, 2, w - 4, h - 4, 16);
  ctx.fillStyle = 'rgba(8, 6, 24, 0.92)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = accent;
  ctx.stroke();
  // tail
  ctx.beginPath();
  ctx.moveTo(w / 2 - 9, h - 3);
  ctx.lineTo(w / 2, h + 12);
  ctx.lineTo(w / 2 + 9, h - 3);
  ctx.fillStyle = accent;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 - 1, w - pad);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.renderOrder = 20;
  const scale = 1 / 60;
  spr.scale.set(c.width * scale, c.height * scale, 1);
  spr.center.set(0.5, 0);
  return spr;
}

// Small always-on name tag.
export function makeNametag(name, accent = '#ff2bd6') {
  const font = '800 34px "Segoe UI", system-ui, sans-serif';
  measurer.font = font;
  const w = Math.ceil(measurer.measureText(name).width + 30);
  const h = 48;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.fillStyle = accent;
  ctx.fillText(name, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9 });
  const spr = new THREE.Sprite(mat);
  const scale = 1 / 85;
  spr.scale.set(w * scale, h * scale, 1);
  return spr;
}

export function disposeSprite(spr) {
  if (!spr) return;
  spr.material.map?.dispose();
  spr.material.dispose();
  spr.removeFromParent();
}
