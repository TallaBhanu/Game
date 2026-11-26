// Procedural canvas textures so the game ships with no image assets.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

function speckle(ctx, w, h, r, n, alpha) {
  for (let i = 0; i < n; i++) {
    const v = Math.floor(r() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

/** Dressed granite ashlar masonry, as on the Golconda curtain walls. */
export function granite(seed = 7, tones = ['#9a9286', '#a89f92', '#8c857a', '#b3a99a', '#968b7e']) {
  const r = mulberry32(seed);
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = '#6d665d';
  ctx.fillRect(0, 0, 512, 512);
  const rowH = 64;
  for (let y = 0; y < 512; y += rowH) {
    let x = -r() * 80;
    while (x < 512) {
      const w = 70 + r() * 90;
      ctx.fillStyle = tones[Math.floor(r() * tones.length)];
      ctx.fillRect(x + 3, y + 3, w - 6, rowH - 6);
      // subtle face shading
      const g = ctx.createLinearGradient(0, y, 0, y + rowH);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = g;
      ctx.fillRect(x + 3, y + 3, w - 6, rowH - 6);
      x += w;
    }
  }
  speckle(ctx, 512, 512, r, 9000, 0.35);
  return toTex(c);
}

/** Lime plaster (chunam) for houses. */
export function plaster(base = '#e9dcc3', seed = 3) {
  const r = mulberry32(seed);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(120,90,60,${0.03 + r() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(r() * 256, r() * 256, 10 + r() * 40, 6 + r() * 30, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, 256, 256, r, 3000, 0.15);
  // a weathered stain at the base
  const g = ctx.createLinearGradient(0, 180, 0, 256);
  g.addColorStop(0, 'rgba(110,80,50,0)');
  g.addColorStop(1, 'rgba(110,80,50,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 180, 256, 76);
  return toTex(c);
}

export function wood(seed = 5) {
  const r = mulberry32(seed);
  const [c, ctx] = canvas(128, 256);
  ctx.fillStyle = '#6b4526';
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(${40 + r() * 40},${20 + r() * 20},10,${0.3 + r() * 0.3})`;
    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath();
    const x = r() * 128;
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + r() * 10 - 5, 80, x + r() * 10 - 5, 170, x + r() * 6 - 3, 256);
    ctx.stroke();
  }
  return toTex(c);
}

/** Striped cotton canopy cloth for market stalls. */
export function stripes(a, b, n = 8) {
  const [c, ctx] = canvas(128, 128);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect((i * 128) / n, 0, 128 / n + 1, 128);
  }
  ctx.fillStyle = 'rgba(255,220,120,0.6)';
  for (let x = 0; x < 128; x += 8) ctx.fillRect(x, 120, 4, 8);
  return toTex(c);
}

/** Block-printed (kalamkari-like) cloth. */
export function printedCloth(bg, fg, seed = 1) {
  const r = mulberry32(seed);
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = fg;
  for (let y = 8; y < 128; y += 22)
    for (let x = 8; x < 128; x += 22) {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 1.5, a, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 124, 124);
  speckle(ctx, 128, 128, r, 300, 0.2);
  return toTex(c);
}

/** Terracotta tiles / dusty floor for the dance platform. */
export function floorTiles() {
  const [c, ctx] = canvas(256, 256);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#d8c7a4' : '#b8a27c';
      ctx.fillRect(x * 32, y * 32, 32, 32);
    }
  ctx.strokeStyle = '#7a1f1f';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90);
  }
  ctx.lineWidth = 2;
  ctx.stroke();
  return toTex(c);
}
