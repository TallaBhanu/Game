import * as THREE from 'three';
import { clamp, smoothstep, fbm, lerp } from '../core/util.js';
import { HILL_H, FLATS, ROAD, PROCESSION, WORLD_R, BAZAAR } from './layout.js';
import { pbrSet } from './builder.js';

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

export function slopeAt(x, z) {
  const e = 1.2;
  const sx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const sz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return Math.hypot(sx, sz) / (2 * e);
}

/** How grassy the ground is at (x, z), 0..0.75. Shared by the terrain tint and the grass tufts. */
export function grassWeight(x, z) {
  const slope = slopeAt(x, z);
  const h = terrainHeight(x, z);
  const dr = Math.min(ROAD.distance(x, z), PROCESSION.distance(x, z));
  const road = 1 - smoothstep(2.4, 4.6, dr);
  const rock = clamp(smoothstep(0.32, 0.7, slope) + smoothstep(32, 56, h) * 0.6, 0, 1);
  return clamp(fbm(x * 0.015 + 5, z * 0.015) * 1.8, 0, 0.75) * (1 - smoothstep(0.2, 0.5, slope)) * (1 - road) * (1 - rock);
}

/** Builds the ground: a height field shaded by blending four real soil/rock textures. */
export function buildTerrain(scene) {
  const size = WORLD_R * 2 + 160;
  const seg = 420;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const tint = new Float32Array(pos.count * 3);
  const splat = new Float32Array(pos.count * 4);
  const grassTint = new THREE.Color('#9aa25a');
  const c = new THREE.Color();
  const white = new THREE.Color(1, 1, 1);
  const grassW = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const e = 1.2;
    const sx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
    const sz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
    const slope = Math.hypot(sx, sz) / (2 * e);
    const dr = Math.min(ROAD.distance(x, z), PROCESSION.distance(x, z));
    let road = 1 - smoothstep(2.4, 4.6, dr);
    if (x > BAZAAR.x0 - 8 && x < BAZAAR.x1 + 6 && Math.abs(z) < BAZAAR.halfWidth + 4) road = Math.max(road, 0.85);
    const rock = clamp(smoothstep(0.32, 0.7, slope) + smoothstep(32, 56, h) * 0.6, 0, 1) * (1 - road);
    const red = clamp(0.25 + fbm(x * 0.012 + 40, z * 0.012 - 7) * 1.6, 0, 0.8) * (1 - rock) * (1 - road);
    const soil = Math.max(0, 1 - rock - red - road);
    const sum = soil + red + rock + road || 1;
    splat.set([soil / sum, red / sum, rock / sum, road / sum], i * 4);
    const g = clamp(fbm(x * 0.015 + 5, z * 0.015) * 1.8, 0, 0.75) * (1 - smoothstep(0.2, 0.5, slope)) * (1 - road) * (1 - rock);
    grassW[i] = g;
    c.copy(white).lerp(grassTint, g * 0.8);
    const jitter = 0.9 + 0.1 * fbm(x * 0.3, z * 0.3, 2);
    tint[i * 3] = c.r * jitter; tint[i * 3 + 1] = c.g * jitter; tint[i * 3 + 2] = c.b * jitter;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(tint, 3));
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  geo.computeVertexNormals();
  const sets = ['dry_ground_rocks', 'red_laterite_soil_stones', 'rock_boulder_dry', 'brown_mud_dry'].map((id) => pbrSet(id, 1));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sets.forEach((st, k) => { sh.uniforms['tD' + k] = { value: st.map }; sh.uniforms['tN' + k] = { value: st.normalMap }; });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tD0, tD1, tD2, tD3, tN0, tN1, tN2, tN3;
varying vec4 vSplat;
varying vec3 vWP;
vec3 splatTex(sampler2D a, sampler2D b, sampler2D c, sampler2D d, vec2 uv) {
  return texture2D(a, uv).rgb * vSplat.x + texture2D(b, uv).rgb * vSplat.y * 0.85 + texture2D(c, uv).rgb * vSplat.z * 0.62 + texture2D(d, uv).rgb * vSplat.w;
}`)
      .replace('#include <map_fragment>', `
vec2 uvA = vWP.xz / 3.5;
vec2 uvB = vWP.xz / 23.0;
vec3 texA = splatTex(tD0, tD1, tD2, tD3, uvA);
vec3 texB = splatTex(tD0, tD1, tD2, tD3, uvB);
diffuseColor.rgb *= mix(texA, texB, 0.35) * 1.15;`)
      .replace('#include <normal_fragment_maps>', `
vec3 nT = splatTex(tN0, tN1, tN2, tN3, uvA) * 2.0 - 1.0;
nT.xy *= 0.9;
// tangent frame of a y-up height field (u along +x, v along +z), in view space
vec3 Nw = normalize(normal);
vec3 Tv = mat3(viewMatrix) * vec3(1.0, 0.0, 0.0);
Tv = normalize(Tv - Nw * dot(Nw, Tv));
vec3 Bv = cross(Tv, Nw);
normal = normalize(mat3(Tv, Bv, Nw) * nT);`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);
  mesh.userData.grassW = grassW;
  return mesh;
}
