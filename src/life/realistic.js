// Realistic humans: glTF bodies driven by retargeted Mixamo clips, plus
// procedural pose layers (sitting, bowing, carrying, hammering, riding...).
import * as THREE from 'three';
import { spawn, ASSETS } from './assets.js';

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const _d = new THREE.Quaternion(), _p = new THREE.Quaternion(), _pi = new THREE.Quaternion(), _r = new THREE.Quaternion();

/** Rotate a bone by `angle` about an axis given in the character's own frame (x left, y up, z forward). */
function turn(body, bone, axis, angle) {
  if (!bone || !angle) return;
  body.root.getWorldQuaternion(_r);
  bone.parent.getWorldQuaternion(_p);
  _d.setFromAxisAngle(axis, angle);
  // world delta = R * d * R^-1 ; local' = P^-1 * worldDelta * P * local
  _d.premultiply(_r).multiply(_r.clone().invert());
  _pi.copy(_p).invert();
  bone.quaternion.premultiply(_p).premultiply(_d).premultiply(_pi);
  bone.updateMatrixWorld(true);
}

// Cloth dyes: recolour the strongly red fabric of the kurta model, leave skin alone.
export const DYES = {
  red: [0.72, 0.05, 0.05], cream: [0.95, 0.9, 0.8], saffron: [1.0, 0.5, 0.1], indigo: [0.16, 0.24, 0.62],
  green: [0.22, 0.45, 0.22], maroon: [0.45, 0.06, 0.14], gold: [1.0, 0.78, 0.3], white: [1, 1, 1], ochre: [0.75, 0.5, 0.2],
};
const COMMON = ['cream', 'white', 'saffron', 'indigo', 'green', 'ochre', 'red', 'cream'];
let dyeIndex = 0;
export const COMMON_DYES = COMMON;
function dye(model, uniform) {
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.onBeforeCompile = (sh) => {
      sh.uniforms.uDye = uniform;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uDye;')
        .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  float sat = (mx - mn) / (mx + 1e-4);
  float cloth = smoothstep(0.75, 0.9, sat) * step(c.g * 6.0, c.r);
  float lum = dot(c, vec3(0.3, 0.55, 0.15)) * 2.6 + mx * 0.35;
  diffuseColor.rgb = mix(c, uDye * clamp(lum, 0.05, 1.0), cloth);
}`);
    };
    o.material.customProgramCacheKey = () => 'dyed';
  });
}

export class RealHuman {
  constructor(kind, opts = {}) {
    this.kind = kind;
    this.body = spawn(kind, opts);
    this.root = this.body.root;
    this.t = Math.random() * 10;
    if (kind === 'man') {
      this.dye = { value: new THREE.Vector3(...DYES[opts.dye || COMMON[dyeIndex++ % COMMON.length]]) };
      dye(this.body.model, this.dye);
    }
  }

  setDye(name) { if (this.dye && DYES[name]) this.dye.value.set(...DYES[name]); }

  update(dt, { speed = 0, pose = 'idle', spin = 0 } = {}) {
    const b = this.body, B = b.bones;
    this.t += dt;
    let clip = 'idle', ts = 1;
    if (this.kind === 'noble') clip = 'idle_noble';
    if (pose === 'dance') clip = 'dance';
    else if (pose === 'talk' || pose === 'sitTalk') clip = (Math.floor(this.t / 5) % 2) ? 'agree' : 'headShake';
    if (speed > 4) { clip = 'run'; ts = speed / 6; }
    else if (speed > 0.08 && !['sit', 'drum', 'sitHammer', 'sitTalk', 'ride', 'clap'].includes(pose)) {
      clip = this.kind === 'noble' ? 'walk_noble' : 'walk';
      ts = Math.max(0.4, speed / 1.35);
    }
    if (pose === 'pull' && speed > 0.05) ts = 0.5;
    b.play(clip, this.fresh ? 0 : 0.35, ts);
    this.fresh = false;
    b.mixer.update(dt);
    b.root.updateMatrixWorld(true);
    // this body was skinned in an A-pose; pull its arms in for still clips
    if (this.kind === 'man') {
      const moving = clip === 'walk' || clip === 'run';
      const f = moving ? (globalThis.__fixW ?? 0.45) : 0.8;
      const fx = moving ? (globalThis.__fixX ?? 0) : 0;
      turn(b, B.LeftArm, AZ, f); turn(b, B.RightArm, AZ, -f);
      if (fx) { turn(b, B.LeftForeArm, AX, fx); turn(b, B.RightForeArm, AX, fx); }
    }
    this.applyPose(pose, B, speed);
  }

  applyPose(pose, B, speed) {
    const b = this.body, t = this.t;
    const seated = ['sit', 'drum', 'sitHammer', 'sitTalk', 'clap'].includes(pose);
    if (seated || pose === 'ride') {
      const spread = pose === 'ride' ? 0.55 : 0.75;
      turn(b, B.LeftUpLeg, AX, -1.45); turn(b, B.RightUpLeg, AX, -1.45);
      turn(b, B.LeftUpLeg, AZ, pose === 'ride' ? -spread * 0.5 : -spread); turn(b, B.RightUpLeg, AZ, pose === 'ride' ? spread * 0.5 : spread);
      turn(b, B.LeftLeg, AX, pose === 'ride' ? 1.35 : 2.4); turn(b, B.RightLeg, AX, pose === 'ride' ? 1.35 : 2.4);
      if (pose !== 'ride') { turn(b, B.LeftLeg, AY, 0.9); turn(b, B.RightLeg, AY, -0.9); }
      // drop the body so it sits on the ground (or the saddle)
      b.root.children[0].position.y = pose === 'ride' ? -0.55 : -0.62;
    } else {
      b.root.children[0].position.y = 0;
    }
    const arms = (lx, lz, rx, rz, ex = 0) => {
      turn(b, B.LeftArm, AX, lx); turn(b, B.LeftArm, AZ, lz);
      turn(b, B.RightArm, AX, rx); turn(b, B.RightArm, AZ, rz);
      if (ex) { turn(b, B.LeftForeArm, AX, ex); turn(b, B.RightForeArm, AX, ex); }
    };
    switch (pose) {
      case 'bow':
        turn(b, B.Spine, AX, 0.35); turn(b, B.Spine1, AX, 0.3); turn(b, B.Head, AX, 0.25);
        arms(-0.6, -0.3, -0.6, 0.3, -1.4);
        break;
      case 'namaste':
        turn(b, B.Spine1, AX, 0.12);
        arms(-0.7, -0.35, -0.7, 0.35, -1.5);
        break;
      case 'carryHead':
        arms(0, 2.5, 0, -2.5); turn(b, B.LeftForeArm, AZ, 1.3); turn(b, B.RightForeArm, AZ, -1.3);
        break;
      case 'carryFront':
        arms(-0.8, -0.15, -0.8, 0.15, -1.0);
        break;
      case 'pull': {
        const k = Math.sin(t * 2.2) * 0.1;
        turn(b, B.Spine, AX, -0.3 + k);
        arms(-1.3 + k, -0.15, -1.3 + k, 0.15, -0.2);
        break;
      }
      case 'hammer':
      case 'sitHammer': {
        const c = (t * 1.7) % 1, lift = c < 0.7 ? c / 0.7 : 1 - (c - 0.7) / 0.3;
        turn(b, B.Spine, AX, 0.35);
        turn(b, B.RightArm, AX, -0.6 - lift * 1.8); turn(b, B.RightForeArm, AX, -0.4 - lift * 0.5);
        turn(b, B.LeftArm, AX, -0.8); turn(b, B.LeftForeArm, AX, -0.6);
        this.hammerHit = c > 0.97;
        break;
      }
      case 'drum': {
        const l = Math.max(0, Math.sin(t * 9)), r = Math.max(0, Math.sin(t * 9 + 2.2));
        turn(b, B.Spine, AX, 0.15);
        arms(-0.6 - l * 0.3, -0.25, -0.6 - r * 0.3, 0.25, -1.0);
        break;
      }
      case 'nagara': {
        const l = Math.max(0, Math.sin(t * 6)), r = Math.max(0, Math.sin(t * 6 + Math.PI));
        arms(-0.5 - l * 0.6, -0.3, -0.5 - r * 0.6, 0.3, -1.0);
        break;
      }
      case 'clap': {
        const k = Math.abs(Math.sin(t * 7));
        arms(-1.0, 0.1 - k * 0.25, -1.0, -0.1 + k * 0.25, -0.8);
        break;
      }
      case 'cheer':
        arms(0, 2.6 + Math.sin(t * 5) * 0.2, 0, -2.6 - Math.sin(t * 5) * 0.2);
        break;
      case 'holdStaff':
      case 'holdHigh':
        turn(b, B.RightArm, AX, -0.3); turn(b, B.RightForeArm, AX, -1.3);
        break;
      case 'fan':
        turn(b, B.RightArm, AX, -1.5 + Math.sin(t * 2.4) * 0.5);
        break;
      case 'trumpet':
        arms(-1.2, -0.35, -1.2, 0.35, -1.0);
        break;
      case 'ride':
        arms(-0.55, -0.1, -0.55, 0.1, -0.8);
        break;
      case 'sit':
        arms(-0.4, 0, -0.4, 0, -0.6);
        break;
    }
    void speed;
  }

  attach(obj, where) {
    const B = this.body.bones;
    const bone = where === 'head' ? B.Head : where === 'handL' ? B.LeftHand : where === 'back' ? B.Spine2 : B.RightHand;
    if (!bone) return obj;
    // bones live inside a scaled model; counter the scale so props keep metres
    const holder = new THREE.Group();
    const ws = new THREE.Vector3();
    bone.getWorldScale(ws);
    holder.scale.setScalar(1 / ws.x);
    bone.add(holder);
    holder.add(obj);
    return obj;
  }
}

export const realisticReady = () => ASSETS.ok;
