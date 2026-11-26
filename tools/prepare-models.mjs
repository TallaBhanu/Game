// Prepares downloaded glTF models for the browser:
//  - strips Sketchfab's "_NN" suffixes from node names so every Mixamo rig
//    shares bone names (lets one animation drive every character)
//  - keeps only the animations we use, renamed
//  - simplifies meshes, shrinks textures, welds/dedups
// usage: node tools/prepare-models.mjs <in.glb> <out.glb> <ratio> <maxTex> [keep=Old:New,...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, prune, textureCompress, resample, quantize, metalRough } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [inp, out, ratioS, maxTexS, keepS = ''] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot();
for (const n of root.listNodes()) {
  const name = n.getName();
  if (/^mixamorig/.test(name) || /_\d+$/.test(name)) n.setName(name.replace(/_\d+$/, ''));
}
const keep = Object.fromEntries(keepS.split(',').filter(Boolean).map((p) => p.split(':')));
if (keepS) {
  for (const a of root.listAnimations()) {
    if (keep[a.getName()]) a.setName(keep[a.getName()]);
    else a.dispose();
  }
}
// facial blend shapes are useless at game distance and block simplification
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) for (const t of p.listTargets()) { p.removeTarget(t); t.dispose(); }
for (const m of root.listMeshes()) m.setWeights([]);
for (const a of root.listAnimations()) for (const c of a.listChannels()) if (c.getTargetPath() === 'weights') { c.getSampler()?.dispose(); c.dispose(); }
await MeshoptSimplifier.ready;
const ratio = parseFloat(ratioS);
const tasks = [metalRough(), dedup(), weld()];
if (ratio < 1) tasks.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01, lockBorder: false }));
tasks.push(resample(), prune());
const maxTex = parseInt(maxTexS, 10);
if (maxTex > 0) tasks.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxTex, maxTex], quality: 80 }));
tasks.push(quantize());
await doc.transform(...tasks);
// keep PNGs that carry alpha as png (textureCompress turned them into jpeg only where safe? enforce)
await io.write(out, doc);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
console.log(out, 'tris', Math.round(tris), 'anims', root.listAnimations().map((a) => a.getName()).join(','));
