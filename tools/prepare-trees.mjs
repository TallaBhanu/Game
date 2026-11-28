// Turns a Poly Haven tree (millions of leaf triangles) into a game-ready one:
// the trunk and branches are simplified, and the foliage is rebuilt as a few
// hundred alpha-tested cards that show the tree's own leaf atlas.
// usage: node tools/prepare-trees.mjs <in.gltf> <leaves_alpha.jpg> <out.glb> <cards> <barkTris>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, prune, textureCompress, quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { MeshoptSimplifier as Sloppy } from 'meshopt-new';
import sharp from 'sharp';
import fs from 'node:fs';

const [inp, alphaPath, out, cardsS, barkS] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot();
let rnd = 12345;
const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

let leafPrim = null, mesh = null;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  if (/leaves|leaf/i.test(p.getMaterial()?.getName() || '')) { leafPrim = p; mesh = m; }
}
if (!leafPrim) throw new Error('no leaves');
const leafMat = leafPrim.getMaterial();
const pos = leafPrim.getAttribute('POSITION').getArray();
const uv = leafPrim.getAttribute('TEXCOORD_0').getArray();
const idx = leafPrim.getIndices()?.getArray() || Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
const nTri = idx.length / 3;
// world size of the whole leaf atlas, from world area / uv area of real leaves
let wa = 0, ua = 0, cx = 0, cy = 0, cz = 0, minY = 1e9, maxY = -1e9;
const tri = (i) => [idx[i * 3], idx[i * 3 + 1], idx[i * 3 + 2]];
for (let t = 0; t < nTri; t += Math.max(1, Math.floor(nTri / 20000))) {
  const [a, b, c] = tri(t);
  const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
  const e1 = [pos[b * 3] - ax, pos[b * 3 + 1] - ay, pos[b * 3 + 2] - az], e2 = [pos[c * 3] - ax, pos[c * 3 + 1] - ay, pos[c * 3 + 2] - az];
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  wa += Math.hypot(...cr) / 2;
  const u1 = [uv[b * 2] - uv[a * 2], uv[b * 2 + 1] - uv[a * 2 + 1]], u2 = [uv[c * 2] - uv[a * 2], uv[c * 2 + 1] - uv[a * 2 + 1]];
  ua += Math.abs(u1[0] * u2[1] - u1[1] * u2[0]) / 2;
}
for (let i = 0; i < pos.length; i += 3) { cx += pos[i]; cy += pos[i + 1]; cz += pos[i + 2]; minY = Math.min(minY, pos[i + 1]); maxY = Math.max(maxY, pos[i + 1]); }
const nv = pos.length / 3; cx /= nv; cy /= nv; cz /= nv;
const cards = parseInt(cardsS, 10);
const waAll = wa * (nTri / Math.ceil(nTri / Math.max(1, Math.floor(nTri / 20000)) ) || 1);
const atlasSize = Math.max(Math.sqrt(wa / Math.max(ua, 1e-6)) * 0.9, Math.sqrt((waAll * 1.3) / (cards * 0.35)));
const P = [], N = [], UV = [], I = [];
for (let k = 0; k < cards; k++) {
  const t = Math.floor(rand() * nTri);
  const [a, b, c] = tri(t);
  const p = [0, 1, 2].map((j) => (pos[a * 3 + j] + pos[b * 3 + j] + pos[c * 3 + j]) / 3);
  let n = [p[0] - cx, (p[1] - cy) * 0.6 + 0.4 * (maxY - minY) * 0.5, p[2] - cz];
  const nl = Math.hypot(...n) || 1; n = n.map((v) => v / nl);
  // card plane: random orientation around a mostly-outward normal
  const r = [rand() - 0.5, rand() - 0.5, rand() - 0.5];
  let tA = [n[1] * r[2] - n[2] * r[1], n[2] * r[0] - n[0] * r[2], n[0] * r[1] - n[1] * r[0]];
  const tl = Math.hypot(...tA) || 1; tA = tA.map((v) => v / tl);
  let tB = [n[1] * tA[2] - n[2] * tA[1], n[2] * tA[0] - n[0] * tA[2], n[0] * tA[1] - n[1] * tA[0]];
  // tilt the card so it is not flat to the outward normal
  const tilt = (rand() - 0.5) * 1.2;
  const pn = [n[0] * Math.cos(tilt) + tB[0] * Math.sin(tilt), n[1] * Math.cos(tilt) + tB[1] * Math.sin(tilt), n[2] * Math.cos(tilt) + tB[2] * Math.sin(tilt)];
  tB = [pn[1] * tA[2] - pn[2] * tA[1], pn[2] * tA[0] - pn[0] * tA[2], pn[0] * tA[1] - pn[1] * tA[0]];
  const s = atlasSize * (0.75 + rand() * 0.5) / 2;
  const base = P.length / 3;
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    P.push(p[0] + (tA[0] * u + tB[0] * v) * s, p[1] + (tA[1] * u + tB[1] * v) * s, p[2] + (tA[2] * u + tB[2] * v) * s);
    N.push(...n);
    UV.push((u + 1) / 2, (1 - v) / 2);
  }
  I.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
// leaf texture with alpha
const diffTex = leafMat.getBaseColorTexture();
const diffBuf = Buffer.from(diffTex.getImage());
const { width, height } = await sharp(diffBuf).metadata();
const alpha = await sharp(fs.readFileSync(alphaPath)).resize(width, height).extractChannel(0).raw().toBuffer();
const rgb = await sharp(diffBuf).removeAlpha().raw().toBuffer();
const px = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i++) { px[i * 4] = rgb[i * 3]; px[i * 4 + 1] = rgb[i * 3 + 1]; px[i * 4 + 2] = rgb[i * 3 + 2]; px[i * 4 + 3] = alpha[i]; }
const rgba = await sharp(px, { raw: { width, height, channels: 4 } }).resize(512, 512).webp({ quality: 85, alphaQuality: 90 }).toBuffer();
if ((await sharp(rgba).metadata()).channels !== 4) throw new Error('leaf texture lost its alpha');
mesh.removePrimitive(leafPrim);
leafPrim.dispose();
await MeshoptSimplifier.ready;
let barkTris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) barkTris += (p.getIndices()?.getCount() ?? 0) / 3;
const ratio = Math.min(1, parseInt(barkS, 10) / Math.max(1, barkTris));
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 1, lockBorder: false }));
// many small branch tubes resist normal simplification: finish with the sloppy simplifier
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  const ia = p.getIndices(), pa = p.getAttribute('POSITION');
  if (!ia || !pa) continue;
  const want = Math.floor((parseInt(barkS, 10) / Math.max(1, root.listMeshes().reduce((n, mm) => n + mm.listPrimitives().length, 0))) * 3);
  if (ia.getCount() <= want) continue;
  const posArr = new Float32Array(pa.getArray());
  await Sloppy.ready;
  const [out] = Sloppy.simplifySloppy(new Uint32Array(ia.getArray()), posArr, 3, null, want, 1);
  ia.setArray(new Uint32Array(out));
}
await doc.transform(dedup(), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 80 }));
const newMat = doc.createMaterial('leaves_cards').setAlphaMode('MASK').setAlphaCutoff(0.45)
  .setDoubleSided(true).setRoughnessFactor(0.85).setMetallicFactor(0);
newMat.setBaseColorTexture(null);
const buf = root.listBuffers()[0];
const acc = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buf);
const cardPrim = doc.createPrimitive()
  .setAttribute('POSITION', acc(new Float32Array(P), 'VEC3'))
  .setAttribute('NORMAL', acc(new Float32Array(N), 'VEC3'))
  .setAttribute('TEXCOORD_0', acc(new Float32Array(UV), 'VEC2'))
  .setIndices(acc(new Uint32Array(I), 'SCALAR'))
  .setMaterial(newMat);
const leafTex = doc.createTexture('leaves').setImage(new Uint8Array(rgba)).setMimeType('image/webp');
newMat.setBaseColorTexture(leafTex);
mesh.addPrimitive(cardPrim);
await doc.transform(quantize());
await io.write(out, doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
console.log(out, 'tris', Math.round(tris), 'atlas m', atlasSize.toFixed(2), 'height', (maxY - minY).toFixed(1));
