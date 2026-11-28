// Photo-scanned environment models (Poly Haven, CC0): trees, granite
// boulders, shrubs and props, drawn with GPU instancing in spatial chunks.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export const ENV = {};
export const ENV_NAMES = [
  'island_tree_01', 'island_tree_02', 'jacaranda_tree', 'tree_small_02',
  'namaqualand_boulder_02', 'namaqualand_boulder_03', 'namaqualand_boulder_04', 'namaqualand_boulder_05', 'rock_07', 'rock_09',
  'shrub_02', 'shrub_03', 'shrub_04',
  'brass_pot_01', 'brass_pot_02', 'ceramic_pot', 'planter_pot_clay', 'wooden_crate_01', 'wooden_bucket_01', 'wooden_barrels_01',
  'bananas', 'food_pomegranate_01', 'wooden_lantern_01', 'brass_diya_lantern', 'brass_vase_01', 'cannon_01',
];
export const wind = { value: 0 };

async function load(name) {
  const order = location.pathname.includes('/_f/') || /claudeusercontent|claude\.ai/.test(location.hostname) ? ['wasm', 'glb'] : ['glb', 'wasm'];
  for (const ext of order) {
    try { return await loader.loadAsync(`models/env/${name}.${ext}`); } catch { /* try the next */ }
  }
  console.warn('env model failed', name);
  return null;
}

function addWind(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 wp = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
#else
vec3 wp = vec3(0.0);
#endif
float h = max(position.y, 0.0);
float sw = sin(uWind * 1.3 + wp.x * 0.11 + wp.z * 0.07 + position.x * 0.8) * 0.5 + sin(uWind * 2.9 + position.z * 1.7) * 0.25;
transformed.x += sw * 0.04 * h;
transformed.z += sw * 0.03 * h;`);
  };
  mat.customProgramCacheKey = () => 'wind';
}

export async function loadEnv() {
  await Promise.all(ENV_NAMES.map(async (n) => {
    const g = await load(n);
    if (!g) return;
    g.scene.updateMatrixWorld(true);
    const parts = [];
    const box = new THREE.Box3();
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      // quantized (int16) attributes cannot hold baked transforms: expand to float first
      const geo = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(o.geometry.attributes)) {
        const f = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
        geo.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
      }
      if (o.geometry.index) geo.setIndex(o.geometry.index.clone());
      geo.applyMatrix4(o.matrixWorld);
      geo.computeBoundingBox();
      box.union(geo.boundingBox);
      const mat = o.material.clone();
      if (mat.alphaTest > 0 || mat.transparent || mat.alphaMode === 'MASK') {
        mat.transparent = false;
        mat.alphaTest = Math.max(mat.alphaTest, 0.45);
        mat.side = THREE.DoubleSide;
        addWind(mat);
        mat.userData.leaves = true;
      }
      if (mat.metalness > 0.6 && !/brass|cannon|lantern|vase/.test(n)) mat.metalness = 0.1;
      if (/boulder|rock_0/.test(n)) {
        // Golconda's granite is grey-pink, not sandstone brown: desaturate the scan
        mat.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
float lg = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lg) * vec3(1.04, 0.98, 0.95), 0.7) * 1.08;`);
        };
        mat.customProgramCacheKey = () => 'granite';
      }
      parts.push({ geo, mat });
    });
    const size = box.getSize(new THREE.Vector3());
    ENV[n] = { parts, box, size, height: size.y, radius: Math.max(size.x, size.z) / 2 };
  }));
  return ENV;
}

const CHUNK = 80;
/**
 * Draw many copies of an environment model. items: [{x, y, z, rotY, scale}].
 * Instances are grouped by 80 m chunks so off-screen chunks are culled.
 */
const CULLED = [];
/** Hide chunks beyond their draw distance (called every frame). */
export function updateEnv(cam) {
  for (const c of CULLED) {
    const s = c.boundingSphere.center;
    c.visible = (s.x - cam.x) ** 2 + (s.z - cam.z) ** 2 < c.userData.far2;
  }
}

export function scatter(scene, name, items, { shadow = true, receive = true, far = 400 } = {}) {
  const e = ENV[name];
  if (!e || !items.length) return [];
  const chunks = new Map();
  for (const it of items) {
    const k = Math.floor(it.x / CHUNK) * 1000 + Math.floor(it.z / CHUNK);
    if (!chunks.has(k)) chunks.set(k, []);
    chunks.get(k).push(it);
  }
  const meshes = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), eul = new THREE.Euler();
  for (const list of chunks.values()) {
    for (const part of e.parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
      list.forEach((it, i) => {
        q.setFromEuler(eul.set(it.rotX || 0, it.rotY || 0, it.rotZ || 0));
        const sc = it.scale || 1;
        m.compose(p.set(it.x, it.y, it.z), q, s.set(sc * (it.sx || 1), sc * (it.sy || 1), sc * (it.sz || 1)));
        im.setMatrixAt(i, m);
      });
      im.computeBoundingSphere();
      im.userData.far2 = (far + CHUNK) ** 2;
      CULLED.push(im);
      im.castShadow = shadow;
      im.receiveShadow = receive;
      scene.add(im);
      meshes.push(im);
    }
  }
  return meshes;
}

/** A single static copy (for props placed one at a time). */
export function place(parent, name, x, y, z, rotY = 0, scale = 1) {
  const e = ENV[name];
  if (!e) return null;
  const g = new THREE.Group();
  for (const part of e.parts) {
    const mesh = new THREE.Mesh(part.geo, part.mat);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  g.scale.setScalar(scale);
  parent.add(g);
  return g;
}
