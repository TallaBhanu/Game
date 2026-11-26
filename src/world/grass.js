// Dry Deccan grass: instanced tufts in culled chunks, swaying in the wind.
import * as THREE from 'three';
import { terrainHeight, grassWeight } from './terrain.js';
import { WORLD_R, BAZAAR } from './layout.js';
import { mulberry32 } from '../core/util.js';

const CHUNK = 40;

function tuftGeometry() {
  const pos = [], col = [];
  const blades = 7;
  const r = mulberry32(9);
  const base = new THREE.Color('#5d5a2a'), tip = new THREE.Color('#d9c98a');
  for (let i = 0; i < blades; i++) {
    const a = r() * Math.PI * 2, lean = 0.15 + r() * 0.35, h = 0.35 + r() * 0.45, w = 0.035 + r() * 0.02;
    const ox = (r() - 0.5) * 0.25, oz = (r() - 0.5) * 0.25;
    const cx = Math.cos(a), sz = Math.sin(a);
    const px = -sz * w, pz = cx * w; // blade width direction
    const tx = ox + cx * lean * h, tz = oz + sz * lean * h;
    // two triangles: a tapering blade
    const p0 = [ox - px, 0, oz - pz], p1 = [ox + px, 0, oz + pz];
    const p2 = [ox + cx * lean * h * 0.5 + px * 0.6, h * 0.55, oz + sz * lean * h * 0.5 + pz * 0.6];
    const p3 = [ox + cx * lean * h * 0.5 - px * 0.6, h * 0.55, oz + sz * lean * h * 0.5 - pz * 0.6];
    const p4 = [tx, h, tz];
    pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3, ...p3, ...p2, ...p4);
    const cAt = (y) => base.clone().lerp(tip, y / h);
    for (const p of [p0, p1, p2, p0, p2, p3, p3, p2, p4]) { const c = cAt(p[1]); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // grass looks best lit from above
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3);
  n.needsUpdate = true;
  return g;
}

export class Grass {
  constructor(scene, physics, density = 1) {
    this.uniforms = { uTime: { value: 0 } };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uniforms.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
float sway = sin(uTime * 1.6 + ip.x * 0.21 + ip.z * 0.17) * 0.6 + sin(uTime * 2.7 + ip.x * 0.5) * 0.25;
transformed.x += sway * 0.12 * position.y * position.y * 4.0;
transformed.z += sway * 0.06 * position.y * position.y * 4.0;`);
    };
    const geo = tuftGeometry();
    const r = mulberry32(77);
    const chunks = new Map();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    const N = Math.round(140000 * density);
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * (WORLD_R + 30);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const g = grassWeight(x, z);
      if (r() > g * 1.6 + 0.04) continue;
      if (x > BAZAAR.x0 - 10 && x < BAZAAR.x1 + 8 && Math.abs(z) < BAZAAR.halfWidth + 5) continue;
      const y = terrainHeight(x, z);
      if (physics.blocked(x, z, y + 0.3) || physics.groundAt(x, z, y + 5) > y + 0.05) continue;
      const k = Math.floor(x / CHUNK) * 1000 + Math.floor(z / CHUNK);
      if (!chunks.has(k)) chunks.set(k, []);
      chunks.get(k).push({ x, y, z, s: 0.7 + r() * 0.8, rot: r() * 6.28, c: r() });
    }
    this.chunks = [];
    for (const list of chunks.values()) {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, i) => {
        q.setFromEuler(e.set(0, t.rot, 0));
        m.compose(new THREE.Vector3(t.x, t.y - 0.02, t.z), q, new THREE.Vector3(t.s, t.s * (0.8 + t.c * 0.5), t.s));
        im.setMatrixAt(i, m);
        col.setHSL(0.13 + t.c * 0.07, 0.35 + t.c * 0.2, 0.55 + t.c * 0.25);
        im.setColorAt(i, col);
      });
      im.computeBoundingSphere();
      im.receiveShadow = true;
      im.castShadow = false;
      scene.add(im);
      this.chunks.push(im);
    }
  }
  update(dt, camPos) {
    this.uniforms.uTime.value += dt;
    for (const c of this.chunks) {
      const s = c.boundingSphere.center;
      c.visible = (s.x - camPos.x) ** 2 + (s.z - camPos.z) ** 2 < 130 * 130;
    }
  }
}
