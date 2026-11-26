import * as THREE from 'three';
import { clamp, smoothstep, fbm, lerp } from '../core/util.js';
import { HILL_H, FLATS, ROAD, PROCESSION, WORLD_R, BAZAAR } from './layout.js';

function rawHeight(x, z) {
  const r = Math.hypot(x, z);
  const t = clamp((r - 16) / 108, 0, 1);
  const s = t * t * (3 - 2 * t);
  const ang = Math.atan2(z, x);
  // The hill: a granite dome with an irregular, lumpy profile.
  let h = HILL_H * (1 - s);
  h *= 1 + 0.1 * Math.sin(ang * 3 + 1.3) * s * (1 - s) * 4;
  h += fbm(x * 0.025, z * 0.025) * 3.2 * (1 - s * 0.6);
  // Rolling Deccan plain around it.
  h += fbm(x * 0.006 + 11, z * 0.006 - 4) * 5 * smoothstep(150, 260, r);
  h += fbm(x * 0.05 + 3, z * 0.05 + 9, 2) * 0.35;
  return h;
}

for (const f of FLATS) f.h = rawHeight(f.x, f.z);

/** Height of the natural ground at (x, z). */
export function terrainHeight(x, z) {
  let h = rawHeight(x, z);
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r) {
      const w = 1 - smoothstep(f.r * 0.55, f.r, d);
      h = lerp(h, f.h, w);
    }
  }
  // Roads are gently cut into the slope so they read as paths.
  return h;
}

/** Builds the coloured ground mesh. */
export function buildTerrain(scene) {
  const size = WORLD_R * 2 + 80;
  const seg = 300;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const soil = new THREE.Color('#a8673f');
  const dry = new THREE.Color('#b79a5d');
  const grass = new THREE.Color('#7d8a42');
  const rock = new THREE.Color('#8f877c');
  const road = new THREE.Color('#c9a77a');
  const plaza = new THREE.Color('#d3bb92');
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // slope estimate
    const e = 1.2;
    const sx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
    const sz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
    const slope = Math.hypot(sx, sz) / (2 * e);
    const n = fbm(x * 0.04, z * 0.04);
    c.copy(soil).lerp(dry, clamp(0.5 + n, 0, 1));
    c.lerp(grass, clamp(fbm(x * 0.015 + 5, z * 0.015) * 1.6, 0, 0.7) * (1 - smoothstep(0.2, 0.5, slope)));
    c.lerp(rock, smoothstep(0.35, 0.75, slope) * 0.85 + smoothstep(30, 55, h) * 0.35);
    const dr = Math.min(ROAD.distance(x, z), PROCESSION.distance(x, z));
    c.lerp(road, (1 - smoothstep(2.2, 4.2, dr)) * 0.85);
    if (x > BAZAAR.x0 - 8 && x < BAZAAR.x1 + 6 && Math.abs(z) < BAZAAR.halfWidth + 4) c.lerp(plaza, 0.7);
    const jitter = 0.92 + 0.08 * fbm(x * 0.3, z * 0.3, 2);
    colors[i * 3] = c.r * jitter;
    colors[i * 3 + 1] = c.g * jitter;
    colors[i * 3 + 2] = c.b * jitter;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}
