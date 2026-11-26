// Builds public/models/anims.glb: a skeleton + shared Mixamo clips, no meshes.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, resample } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [out, ...ins] = process.argv.slice(2);
const docs = [];
for (const spec of ins) {
  const [file, keepS] = spec.split('@');
  const keep = Object.fromEntries(keepS.split(',').map((p) => p.split(':')));
  const doc = await io.read(file);
  const r = doc.getRoot();
  for (const n of r.listNodes()) n.setName(n.getName().replace(/_\d+$/, ''));
  for (const a of r.listAnimations()) { if (keep[a.getName()]) a.setName(keep[a.getName()]); else a.dispose(); }
  for (const a of r.listAnimations()) for (const c of a.listChannels()) {
    const n = c.getTargetNode();
    // keep only rotations (and the hips' height) so clips fit any Mixamo body
    if (c.getTargetPath() === 'translation' && !/Hips$/.test(n?.getName() || '')) { c.getSampler()?.dispose(); c.dispose(); }
    if (c.getTargetPath() === 'scale' || c.getTargetPath() === 'weights') { c.getSampler()?.dispose(); c.dispose(); }
  }
  for (const n of r.listNodes()) n.setMesh(null).setSkin(null);
  for (const m of r.listMeshes()) m.dispose();
  for (const s of r.listSkins()) s.dispose();
  await doc.transform(resample(), prune({ keepLeaves: true }));
  await io.write(`${out}.${docs.length}.glb`, doc);
  docs.push(`${out}.${docs.length}.glb`);
}
console.log(docs.join(' '));
