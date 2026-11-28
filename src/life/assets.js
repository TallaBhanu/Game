// Loads the realistic glTF models (CC-BY, Sketchfab; three.js examples) and
// hands out animated clones.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export const ASSETS = { clips: {}, ok: false };

// Some static hosts will not serve .glb; the same bytes are also published
// with a .wasm extension (served as plain binary), which GLTFLoader reads fine.
async function load(name) {
  const order = location.pathname.includes('/_f/') || /claudeusercontent|claude\.ai/.test(location.hostname) ? ['wasm', 'glb'] : ['glb', 'wasm'];
  for (const ext of order) {
    try { return await loader.loadAsync(`models/${name}.${ext}`); } catch (e) { if (ext === order[1]) console.warn('model failed', name, e); }
  }
  return null;
}

// Real-world heights (m) and the direction each model faces after loading.
const SPEC = {
  man: { height: 1.72 }, woman: { height: 1.6 },
  horse: { height: 2.35 }, elephant: { height: 3.1 }, bull: { height: 1.55, yaw: -Math.PI / 2 },
  donkey: { height: 1.45, yaw: -Math.PI / 2 }, camel: { height: 2.2, yaw: Math.PI },
};

export async function loadAssets(onProgress) {
  const names = [...Object.keys(SPEC), 'anims.0', 'anims.1', 'anims.2'];
  let done = 0;
  const res = await Promise.all(names.map(async (n) => { const g = await load(n); onProgress?.(++done / names.length); return [n, g]; }));
  for (const [n, g] of res) {
    if (!g) continue;
    if (n.startsWith('anims')) {
      g.scene.updateMatrixWorld(true);
      const rest = restPose(g.scene);
      for (const c of g.animations) {
        // shared Mixamo clips: drop translations so they fit any body size
        c.tracks = c.tracks.filter((t) => !t.name.endsWith('.position') && !t.name.endsWith('.scale'));
        c.userData = { rest };
        ASSETS.clips[c.name] = c;
      }
      continue;
    }
    g.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g.scene, true);
    const size = box.getSize(new THREE.Vector3());
    g.userData = { box, size, scale: SPEC[n].height / size.y, yaw: SPEC[n].yaw || 0 };
    g.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // skinned bounds are unreliable once animated
        const m = o.material;
        if (m && m.isMeshStandardMaterial) { m.envMapIntensity = 0.8; if (m.metalness > 0.5) m.metalness = 0.2; }
      }
    });
    for (const c of g.animations) {
      // in-place: drop root motion on the hips/root so the game moves the actor
      c.tracks = c.tracks.filter((t) => !(/(Hips|root|Root|rootJoint|CG|Pelvis|pelvis)[^.]*\.position$/.test(t.name)));
    }
    ASSETS[n] = g;
  }
  ASSETS.ok = !!(ASSETS.man && ASSETS.horse);
  return ASSETS;
}

const _q = new THREE.Quaternion();
/** Rest local rotation and parent world rotation of every node, keyed by name. */
function restPose(scene) {
  const out = {};
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.name) return;
    const pw = new THREE.Quaternion();
    if (o.parent) o.parent.getWorldQuaternion(pw);
    out[o.name] = { r: o.quaternion.clone(), pw };
  });
  return out;
}

/**
 * Rest pose from the skin's bind matrices (the T-pose the mesh was skinned
 * in). Sketchfab exports often leave bones posed in the first animation
 * frame, so the node transforms cannot be trusted as the rest pose.
 */
function bindPose(scene) {
  scene.updateMatrixWorld(true);
  let skinned = null;
  scene.traverse((o) => { if (!skinned && o.isSkinnedMesh) skinned = o; });
  if (!skinned) return restPose(scene);
  const out = restPose(scene);
  const { bones, boneInverses } = skinned.skeleton;
  const meshQ = new THREE.Quaternion();
  skinned.getWorldQuaternion(meshQ);
  const bindQ = new Map();
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  bones.forEach((b, i) => {
    const q = new THREE.Quaternion();
    m.copy(boneInverses[i]).invert().decompose(pos, q, sc);
    bindQ.set(b, meshQ.clone().multiply(q)); // world-frame bind rotation
  });
  for (const b of bones) {
    const W = bindQ.get(b);
    let pw;
    if (bindQ.has(b.parent)) pw = bindQ.get(b.parent).clone();
    else { pw = new THREE.Quaternion(); b.parent.getWorldQuaternion(pw); }
    out[b.name] = { r: pw.clone().invert().multiply(W), pw };
  }
  return out;
}

/**
 * Retarget a clip authored on one Mixamo body to another whose bones have
 * different rest orientations: each key is turned into a world-space delta
 * from the source rest pose and re-applied on top of the target rest pose.
 */
const RETARGET_CACHE = new Map();
function retarget(clip, dstRest, key) {
  const ck = clip.uuid + key;
  if (RETARGET_CACHE.has(ck)) return RETARGET_CACHE.get(ck);
  const src = clip.userData.rest;
  const tracks = [];
  const a = new THREE.Quaternion(), b = new THREE.Quaternion(), qs = new THREE.Quaternion();
  for (const t of clip.tracks) {
    if (!t.name.endsWith('.quaternion')) continue;
    const bone = t.name.slice(0, -'.quaternion'.length);
    const S = src[bone], D = dstRest[bone];
    if (!S || !D) continue;
    // q_t = inv(Pd) * Ps * q_s * inv(r_s) * inv(Ps) * Pd * r_d
    const PsInv = S.pw.clone().invert(), PdInv = D.pw.clone().invert(), rsInv = S.r.clone().invert();
    const v = t.values.slice();
    for (let i = 0; i < v.length; i += 4) {
      qs.fromArray(v, i);
      a.copy(PdInv).multiply(S.pw).multiply(qs).multiply(rsInv).multiply(PsInv).multiply(D.pw).multiply(D.r);
      a.toArray(v, i);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(t.name, t.times, v));
  }
  void b; void _q;
  const out = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  RETARGET_CACHE.set(ck, out);
  return out;
}

/**
 * A positioned, animated clone. Returns { root, model, mixer, play(name, fade), bones }.
 * root: put this where the actor stands (feet at y=0, facing +z).
 */
export function spawn(name, { tint = null, heightJitter = 0 } = {}) {
  const g = ASSETS[name];
  if (!g) return null;
  const model = SkeletonUtils.clone(g.scene);
  const root = new THREE.Group();
  const s = g.userData.scale * (1 + heightJitter);
  model.scale.setScalar(s);
  const { box } = g.userData;
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  const holder = new THREE.Group();
  holder.rotation.y = g.userData.yaw;
  holder.add(model);
  root.add(holder);
  if (tint) {
    model.traverse((o) => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); }
    });
  }
  const mixer = new THREE.AnimationMixer(model);
  const own = Object.fromEntries(g.animations.map((a) => [a.name, a]));
  if (!g.userData.rest) g.userData.rest = bindPose(g.scene);
  const actions = {};
  let current = null;
  const play = (clipName, fade = 0.3, timeScale = 1) => {
    let clip = own[clipName];
    if (!clip && ASSETS.clips[clipName]) clip = retarget(ASSETS.clips[clipName], g.userData.rest, name);
    if (!clip) return null;
    let a = actions[clipName];
    if (!a) a = actions[clipName] = mixer.clipAction(clip);
    a.timeScale = timeScale;
    if (current === a) return a;
    a.reset().fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = a;
    return a;
  };
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name.replace(/^mixamorig/, '')] = o; });
  return { root, model, mixer, play, bones, actions, name, get current() { return current; } };
}
