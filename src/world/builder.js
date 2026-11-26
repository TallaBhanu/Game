// Static geometry batching: everything that never moves is merged into a
// handful of meshes (one per material) to keep draw calls low.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as TX from '../core/textures.js';

export const MATERIALS = {};
const loader = new THREE.TextureLoader();
const TEX_CACHE = new Map();
/** Loads a CC0 Poly Haven texture set from public/textures/<id>/. */
export function pbrSet(id, repeat = 1) {
  const load = (file, srgb) => {
    const key = id + file;
    let base = TEX_CACHE.get(key);
    if (!base) {
      base = loader.load(`textures/${id}/${file}.jpg`);
      base.wrapS = base.wrapT = THREE.RepeatWrapping;
      base.anisotropy = 8;
      if (srgb) base.colorSpace = THREE.SRGBColorSpace;
      TEX_CACHE.set(key, base);
    }
    const t = base.clone();
    t.repeat.set(repeat, repeat);
    return t;
  };
  return { map: load('diffuse', true), normalMap: load('nor_gl', false), roughnessMap: load('rough', false) };
}

const ALL_SETS = ['japanese_stone_wall', 'medieval_blocks_05', 'rock_boulder_dry', 'plastered_wall_02', 'worn_plaster_wall', 'weathered_brown_planks', 'brown_mud_dry', 'dry_ground_rocks', 'red_laterite_soil_stones'];
/** Loads every texture up front so clones made later already have their image. */
export async function preloadTextures() {
  const jobs = [];
  for (const id of ALL_SETS)
    for (const [file, srgb] of [['diffuse', true], ['nor_gl', false], ['rough', false]]) {
      jobs.push(loader.loadAsync(`textures/${id}/${file}.jpg`).then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        TEX_CACHE.set(id + file, t);
      }).catch((e) => console.warn('texture failed', id, file, e)));
    }
  await Promise.all(jobs);
}

export function initMaterials() {
  const S = (o) => new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...o });
  const pbr = (id, repeat, color = '#ffffff', extra = {}) => S({ ...pbrSet(id, repeat), color, normalScale: new THREE.Vector2(1, 1), ...extra });
  Object.assign(MATERIALS, {
    granite: pbr('japanese_stone_wall', 1.6, '#d8d2c8'),
    graniteWarm: pbr('medieval_blocks_05', 1.2, '#e6dccd'),
    rubble: pbr('rock_boulder_dry', 1, '#b8afa4'),
    plaster: pbr('plastered_wall_02', 0.8, '#f0e4cc'),
    plasterOchre: pbr('plastered_wall_02', 0.8, '#e6c793'),
    plasterRose: pbr('plastered_wall_02', 0.8, '#ecc3aa'),
    plasterWhite: pbr('plastered_wall_02', 0.8, '#fbf7ef'),
    mud: pbr('worn_plaster_wall', 0.8, '#c4946a'),
    wood: pbr('weathered_brown_planks', 1, '#ffffff'),
    woodDark: pbr('weathered_brown_planks', 1, '#6b5040'),
    iron: S({ color: '#3a3a3e', roughness: 0.5, metalness: 0.8 }),
    gold: S({ color: '#e0b84a', roughness: 0.3, metalness: 1.0 }),
    dark: S({ color: '#1e1612', roughness: 1 }),
    thatch: S({ color: '#b8995a', roughness: 1 }),
    tile: S({ color: '#b5583a', roughness: 0.8 }),
    floor: S({ map: TX.floorTiles(), roughness: 0.55 }),
    saffron: S({ color: '#f08a24', side: THREE.DoubleSide, roughness: 0.9 }),
    green: S({ color: '#2a7a3b', side: THREE.DoubleSide, roughness: 0.9 }),
    earth: pbr('brown_mud_dry', 1, '#ffffff'),
    bamboo: S({ color: '#b59a5c', roughness: 0.8 }),
  });
  return MATERIALS;
}

/** Scale a BoxGeometry's UVs so textures tile at a fixed world size. */
export function boxGeo(w, h, d, tile = 4) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // faces: +x, -x, +y, -y, +z, -z (4 verts each)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  return g;
}

/**
 * A wall slab with n pointed-arch openings, in local XY (width along X),
 * extruded along Z and centred. Returns { geo, piers } where piers are the
 * solid x-ranges (for colliders).
 */
export function arcadeGeo(width, height, depth, n, ow, oh, tile = 4) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.lineTo(-width / 2, 0);
  // The holes touch the bottom edge, which triangulation dislikes, so the
  // openings start a hair above 0 and a threshold strip fills the gap.
  const pitch = width / n;
  const piers = [];
  let last = -width / 2;
  for (let i = 0; i < n; i++) {
    const cx = -width / 2 + pitch * (i + 0.5);
    const hole = new THREE.Path();
    const spring = oh - ow * 0.55;
    hole.moveTo(cx - ow / 2, 0.02);
    hole.lineTo(cx + ow / 2, 0.02);
    hole.lineTo(cx + ow / 2, spring);
    // pointed arch made of two circular arcs (radius = 0.8 * ow)
    const r = ow * 0.8;
    const segs = 8;
    // right arc centre at (cx + ow/2 - r, spring)
    const rcx = cx + ow / 2 - r;
    const apexA = Math.acos((cx - rcx) / r);
    for (let k = 1; k <= segs; k++) {
      const a = (apexA * k) / segs;
      hole.lineTo(rcx + Math.cos(a) * r, spring + Math.sin(a) * r);
    }
    const lcx = cx - ow / 2 + r;
    for (let k = segs - 1; k >= 0; k--) {
      const a = Math.PI - (apexA * k) / segs;
      hole.lineTo(lcx + Math.cos(a) * r, spring + Math.sin(a) * r);
    }
    hole.lineTo(cx - ow / 2, 0.02);
    shape.holes.push(hole);
    piers.push([last, cx - ow / 2]);
    last = cx + ow / 2;
  }
  piers.push([last, width / 2]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  geo.translate(0, 0, -depth / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  return { geo, piers };
}

export class StaticBatch {
  constructor() {
    this.groups = new Map();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3(1, 1, 1);
    this._p = new THREE.Vector3();
  }
  add(geo, matKey, x = 0, y = 0, z = 0, rotY = 0, rotX = 0, rotZ = 0, sx = 1, sy = 1, sz = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    this._e.set(rotX, rotY, rotZ, 'YXZ');
    this._q.setFromEuler(this._e);
    this._m.compose(this._p.set(x, y, z), this._q, this._s.set(sx, sy, sz));
    g.applyMatrix4(this._m);
    if (!this.groups.has(matKey)) this.groups.set(matKey, []);
    this.groups.get(matKey).push(g);
    return g;
  }
  box(w, h, d, x, y, z, rotY, matKey, tile = 4) {
    return this.add(boxGeo(w, h, d, tile), matKey, x, y, z, rotY);
  }
  build(scene, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const [key, list] of this.groups) {
      // Merge in chunks to keep each buffer a sane size.
      for (let i = 0; i < list.length; i += 400) {
        const merged = mergeGeometries(list.slice(i, i + 400), false);
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, MATERIALS[key] || MATERIALS.granite);
        mesh.castShadow = cast;
        mesh.receiveShadow = receive;
        scene.add(mesh);
        meshes.push(mesh);
      }
      list.forEach((g) => g.dispose());
    }
    this.groups.clear();
    return meshes;
  }
}
