// Procedural low-poly people and animals with simple joint animation.
import * as THREE from 'three';
import { rand, pick } from '../core/util.js';

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 12, 9),
  hemi: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  skirt: new THREE.CylinderGeometry(0.55, 1, 1, 14, 1, true),
  cone: new THREE.ConeGeometry(1, 1, 10),
  torus: new THREE.TorusGeometry(1, 0.18, 6, 16),
};
const MATS = new Map();
export function mat(color, opts) {
  const key = color + (opts ? JSON.stringify(opts) : '');
  let m = MATS.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, ...(opts || {}) });
    MATS.set(key, m);
  }
  return m;
}
const skirtMat = new Map();
function doubleMat(color) {
  let m = skirtMat.get(color);
  if (!m) skirtMat.set(color, (m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })));
  return m;
}

export function part(geo, color, sx, sy, sz, x = 0, y = 0, z = 0, parent, material) {
  const m = new THREE.Mesh(GEO[geo] || geo, material || mat(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
const pivot = (parent, x, y, z) => {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
};

export const SKINS = ['#8d5a3b', '#7a4a2e', '#a06a45', '#6b3f25', '#b07a52', '#93603f'];
export const CLOTH = ['#f2ead8', '#e7d9b8', '#c9472b', '#e0a526', '#2f6f8f', '#7b2d4f', '#3d7a4a', '#d96a2b', '#efe3c8', '#5b3a8a'];
const HAIR = '#1b1410';

/**
 * opts: skin, top (null = bare chest), sleeves, bottom, robe, skirt, sash,
 * head: 'turban' | 'pagri' | 'royal' | 'cap' | 'hair' | 'veil' | 'helmet' | 'bald',
 * headColor, beard, scale, female, jewels
 */
export class Human {
  constructor(opts = {}) {
    this.opts = opts;
    const skin = opts.skin || pick(SKINS);
    const top = opts.top === undefined ? pick(CLOTH) : opts.top;
    const bottom = opts.bottom || '#efe6d2';
    const s = opts.scale || rand(0.93, 1.05);
    this.root = new THREE.Group();
    this.root.scale.setScalar(s);
    this.body = pivot(this.root, 0, 0.95, 0);
    const B = this.body;

    part('box', bottom, 0.32, 0.18, 0.2, 0, 0, 0, B);
    this.legs = [];
    for (const side of [1, -1]) {
      const hip = pivot(B, side * 0.09, -0.04, 0);
      part('box', bottom, 0.14, 0.46, 0.15, 0, -0.22, 0, hip);
      const knee = pivot(hip, 0, -0.45, 0);
      part('box', opts.trousers ? bottom : skin, 0.11, 0.46, 0.12, 0, -0.22, 0, knee);
      part('box', opts.shoes || '#3b2a1c', 0.11, 0.06, 0.23, 0, -0.47, 0.05, knee);
      this.legs.push({ hip, knee, side });
    }

    this.torso = pivot(B, 0, 0.08, 0);
    const T = this.torso;
    part('box', top || skin, 0.34, 0.5, 0.2, 0, 0.24, 0, T);
    if (opts.female) part('box', top || skin, 0.3, 0.12, 0.08, 0, 0.32, 0.1, T);
    if (opts.sash) part('box', opts.sash, 0.36, 0.08, 0.22, 0, 0.0, 0, T);
    if (opts.vest) part('box', opts.vest, 0.36, 0.3, 0.215, 0, 0.32, 0, T);
    if (opts.jewels) {
      const n = part('torus', '#e8c252', 0.11, 0.11, 0.11, 0, 0.42, 0.06, T, mat('#e8c252', { emissive: '#3a2a00' }));
      n.rotation.x = Math.PI / 2 - 0.25;
      part('sphere', '#c22', 0.025, 0.025, 0.025, 0, 0.34, 0.12, T, mat('#d22', { emissive: '#400' }));
    }
    part('cyl', skin, 0.05, 0.1, 0.05, 0, 0.52, 0, T);
    this.head = pivot(T, 0, 0.56, 0);
    const H = this.head;
    part('sphere', skin, 0.115, 0.13, 0.12, 0, 0.11, 0, H);
    part('box', skin, 0.03, 0.04, 0.04, 0, 0.1, 0.12, H);
    if (opts.beard) part('box', HAIR, 0.16, 0.08, 0.06, 0, 0.02, 0.09, H);
    if (opts.mustache !== false && !opts.female && !opts.child) part('box', HAIR, 0.09, 0.015, 0.02, 0, 0.065, 0.125, H);
    this._headwear(H, opts.head || 'turban', opts.headColor || pick(['#f4efe2', '#e2b13c', '#c93a2a', '#e8e0cf', '#d2691e']));

    this.arms = [];
    const sleeve = opts.sleeves ? top || skin : skin;
    for (const side of [1, -1]) {
      const sh = pivot(T, side * 0.215, 0.46, 0);
      part('box', sleeve, 0.095, 0.31, 0.1, 0, -0.14, 0, sh);
      const el = pivot(sh, 0, -0.29, 0);
      part('box', opts.sleeves && opts.longSleeves ? sleeve : skin, 0.085, 0.27, 0.09, 0, -0.13, 0, el);
      const hand = pivot(el, 0, -0.29, 0);
      part('box', skin, 0.08, 0.08, 0.06, 0, 0.01, 0, hand);
      if (opts.bangles) part('cyl', '#e8c252', 0.05, 0.03, 0.05, 0, 0.04, 0, hand);
      this.arms.push({ sh, el, hand, side });
    }
    this.handL = this.arms[0].hand;
    this.handR = this.arms[1].hand;

    if (opts.robe) {
      this.skirt = part('skirt', opts.robe, 0.34, 0.8, 0.34, 0, -0.4, 0, B, doubleMat(opts.robe));
    } else if (opts.skirt) {
      this.skirt = part('skirt', opts.skirt, 0.36, 0.86, 0.36, 0, -0.43, 0, B, doubleMat(opts.skirt));
    }
    if (this.skirt) { this._skirtBase = this.skirt.scale.clone(); this._skirtY = this.skirt.position.y; }
    if (opts.dupatta) {
      const d = part('box', opts.dupatta, 0.38, 0.6, 0.03, 0, 0.18, -0.12, T);
      d.rotation.x = 0.1;
    }

    this.pose = opts.pose || 'idle';
    this.speed = 0;
    this.t = rand(0, 10);
    this.phase = rand(0, 6);
    this.spin = 0;
    this.radius = 0.35;
  }

  _headwear(H, kind, color) {
    switch (kind) {
      case 'turban':
        part('sphere', color, 0.135, 0.09, 0.14, 0, 0.19, 0, H);
        part('sphere', color, 0.05, 0.05, 0.05, 0, 0.25, 0.05, H);
        break;
      case 'pagri': {
        part('cyl', color, 0.14, 0.13, 0.145, 0, 0.21, 0, H);
        part('sphere', color, 0.14, 0.06, 0.145, 0, 0.275, 0, H);
        break;
      }
      case 'royal': {
        part('cyl', color, 0.155, 0.16, 0.16, 0, 0.22, 0, H);
        part('sphere', color, 0.16, 0.08, 0.165, 0, 0.3, 0, H);
        part('sphere', '#e8c252', 0.04, 0.05, 0.03, 0, 0.24, 0.155, H, mat('#e8c252', { emissive: '#4a3000' }));
        part('sphere', '#2bb673', 0.025, 0.03, 0.02, 0, 0.24, 0.18, H, mat('#2bb673', { emissive: '#0a4020' }));
        const plume = part('cone', '#ffffff', 0.025, 0.22, 0.025, 0.03, 0.42, 0.06, H);
        plume.rotation.z = -0.35;
        break;
      }
      case 'cap':
        part('hemi', color, 0.12, 0.09, 0.125, 0, 0.17, 0, H);
        break;
      case 'helmet':
        part('hemi', '#8a8f96', 0.13, 0.12, 0.135, 0, 0.15, 0, H, mat('#8a8f96'));
        part('cone', '#8a8f96', 0.02, 0.1, 0.02, 0, 0.32, 0, H);
        break;
      case 'hair':
        part('sphere', HAIR, 0.122, 0.12, 0.125, 0, 0.13, -0.015, H);
        part('sphere', HAIR, 0.06, 0.06, 0.06, 0, 0.12, -0.14, H);
        if (this.opts.flowers !== false) part('sphere', '#fff7e0', 0.065, 0.02, 0.065, 0, 0.12, -0.15, H);
        break;
      case 'veil': {
        part('sphere', HAIR, 0.122, 0.12, 0.125, 0, 0.13, -0.015, H);
        const v = part('box', color, 0.28, 0.42, 0.25, 0, 0.0, -0.04, H, doubleMat(color));
        v.scale.set(0.28, 0.42, 0.25);
        part('hemi', color, 0.14, 0.12, 0.14, 0, 0.14, -0.01, H);
        break;
      }
      case 'bald':
        part('box', HAIR, 0.03, 0.08, 0.03, 0, 0.24, -0.08, H); // shikha tuft
        break;
    }
  }

  attach(obj, where = 'handR') {
    const target = where === 'head' ? this.head : where === 'back' ? this.torso : this[where];
    target.add(obj);
    return obj;
  }

  setJoint(j, x = 0, y = 0, z = 0) { j.rotation.set(x, y, z); }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const sp = this.speed;
    this.phase += dt * (2.2 + sp * 1.9);
    const ph = this.phase;
    const B = this.body;
    B.position.y = 0.95;
    B.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.head.rotation.set(0, Math.sin(t * 0.4 + this.phase) * 0.15, 0);
    for (const a of this.arms) { a.sh.rotation.set(0, 0, a.side * 0.08); a.el.rotation.set(-0.1, 0, 0); }
    const seated = this.pose === 'sit' || this.pose === 'drum' || this.pose === 'sitHammer' || this.pose === 'sitTalk';

    // ---- legs ----
    if (this.skirt && this.pose !== 'dance') {
      // seated women tuck the skirt under; standing ones let it hang
      if (seated) { this.skirt.scale.set(0.5, 0.32, 0.55); this.skirt.position.set(0, -0.12, 0.12); }
      else if (this._skirtBase) { this.skirt.scale.copy(this._skirtBase); this.skirt.position.y = this._skirtY; this.skirt.position.z = 0; }
    }
    if (seated) {
      B.position.y = 0.3;
      for (const l of this.legs) {
        l.hip.rotation.set(-1.45, 0, l.side * 0.75);
        l.knee.rotation.set(2.4, 0, 0);
      }
    } else if (sp > 0.05) {
      const amp = Math.min(1, sp / 1.6) * (this.pose === 'pull' ? 0.35 : 0.6);
      for (const l of this.legs) {
        const s = Math.sin(ph + (l.side > 0 ? 0 : Math.PI));
        l.hip.rotation.set(-s * amp, 0, 0);
        l.knee.rotation.set(Math.max(0, s) * amp * 1.4 + 0.05, 0, 0);
      }
      B.position.y = 0.95 + Math.abs(Math.cos(ph)) * 0.035 * Math.min(1, sp);
    } else {
      for (const l of this.legs) { l.hip.rotation.set(0, 0, l.side * 0.03); l.knee.rotation.set(0.02, 0, 0); }
    }

    // ---- upper body ----
    const [L, R] = this.arms; // L side=+1, R side=-1
    switch (this.pose) {
      case 'carryHead':
        for (const a of this.arms) { a.sh.rotation.set(-0.15, 0, a.side * 2.65); a.el.rotation.set(0, 0, a.side * 1.1); }
        break;
      case 'carryShoulder':
        L.sh.rotation.set(-0.2, 0, 2.6); L.el.rotation.set(0, 0, 1.3);
        if (sp > 0.05) R.sh.rotation.x = -Math.sin(ph) * 0.4;
        break;
      case 'carryFront':
        for (const a of this.arms) { a.sh.rotation.set(-0.7, 0, -a.side * 0.12); a.el.rotation.set(-0.9, 0, 0); }
        break;
      case 'pull': {
        const k = Math.sin(t * 2.2 + this.phase) * 0.12;
        this.torso.rotation.x = -0.32 + k * 0.5;
        for (const a of this.arms) { a.sh.rotation.set(-1.25 + k, 0, -a.side * 0.18); a.el.rotation.set(-0.15, 0, 0); }
        if (sp < 0.05) { this.legs[0].hip.rotation.x = -0.45; this.legs[1].hip.rotation.x = 0.3; this.legs[0].knee.rotation.x = 0.3; }
        break;
      }
      case 'hammer':
      case 'sitHammer': {
        const c = (t * 1.7 + this.phase) % 1;
        const lift = c < 0.7 ? c / 0.7 : 1 - (c - 0.7) / 0.3;
        this.torso.rotation.x = this.pose === 'hammer' ? 0.45 : 0.35;
        R.sh.rotation.set(-0.6 - lift * 1.9, 0, -0.15);
        R.el.rotation.set(-0.5 - lift * 0.6, 0, 0);
        L.sh.rotation.set(-0.9, 0, 0.1); L.el.rotation.set(-0.5, 0, 0);
        this.hammerHit = c > 0.97;
        break;
      }
      case 'dance': {
        const k = Math.sin(t * 3 + this.phase);
        this.spinVel = this.spinVel ?? 0;
        L.sh.rotation.set(-0.2, 0, 2.1 + k * 0.5); L.el.rotation.set(0, 0, 0.9 + k * 0.3);
        R.sh.rotation.set(-0.3, 0, -1.2 - k * 0.4); R.el.rotation.set(-0.6, 0, -0.4);
        this.torso.rotation.z = k * 0.08;
        this.head.rotation.set(0, 0, Math.sin(t * 6) * 0.12);
        const stomp = Math.sin(t * 9 + this.phase);
        this.legs[0].hip.rotation.x = Math.max(0, stomp) * -0.35;
        this.legs[1].hip.rotation.x = Math.max(0, -stomp) * -0.35;
        this.legs[0].knee.rotation.x = Math.max(0, stomp) * 0.6;
        this.legs[1].knee.rotation.x = Math.max(0, -stomp) * 0.6;
        if (this.skirt) {
          const flare = 1 + Math.min(1, Math.abs(this.spin) / 6) * 0.9;
          this.skirt.scale.set(0.36 * flare, 0.86 / Math.sqrt(flare), 0.36 * flare);
          this.skirt.position.y = -0.43 + (0.86 - 0.86 / Math.sqrt(flare)) / 2;
        }
        break;
      }
      case 'drum': {
        const a = Math.sin(t * 9 + this.phase), b = Math.sin(t * 9 + this.phase + 2.2);
        L.sh.rotation.set(-0.7 - Math.max(0, a) * 0.3, 0, 0.25); L.el.rotation.set(-0.9, 0, 0);
        R.sh.rotation.set(-0.7 - Math.max(0, b) * 0.3, 0, -0.25); R.el.rotation.set(-0.9, 0, 0);
        this.torso.rotation.x = 0.15;
        this.head.rotation.x = Math.sin(t * 4.5) * 0.08;
        break;
      }
      case 'bow':
        this.torso.rotation.x = 0.55;
        this.head.rotation.x = 0.2;
        for (const a of this.arms) { a.sh.rotation.set(-0.75, 0, -a.side * 0.38); a.el.rotation.set(-1.35, 0, 0); }
        break;
      case 'namaste':
        this.torso.rotation.x = 0.12;
        for (const a of this.arms) { a.sh.rotation.set(-0.55, 0, -a.side * 0.38); a.el.rotation.set(-1.5, 0, 0); }
        break;
      case 'talk':
      case 'sitTalk': {
        const k = Math.sin(t * 2.6 + this.phase);
        R.sh.rotation.set(-0.5 + k * 0.3, 0, -0.2); R.el.rotation.set(-1.0 + k * 0.3, 0, 0);
        L.sh.rotation.set(-0.2 - Math.max(0, -k) * 0.4, 0, 0.15); L.el.rotation.set(-0.6, 0, 0);
        this.head.rotation.y = Math.sin(t * 0.9 + this.phase) * 0.35;
        this.head.rotation.z = Math.sin(t * 3.1) * 0.06;
        break;
      }
      case 'cheer': {
        const k = Math.sin(t * 5 + this.phase);
        for (const a of this.arms) { a.sh.rotation.set(-0.2, 0, a.side * (2.6 + k * 0.25 * a.side)); a.el.rotation.set(0, 0, a.side * 0.2); }
        break;
      }
      case 'holdStaff':
        R.sh.rotation.set(-0.25, 0, -0.1); R.el.rotation.set(-1.25, 0, 0);
        if (sp > 0.05) L.sh.rotation.x = Math.sin(ph) * 0.4;
        break;
      case 'holdHigh':
        R.sh.rotation.set(-0.25, 0, -0.05); R.el.rotation.set(-1.45, 0, 0);
        L.sh.rotation.set(-0.35, 0, 0.3); L.el.rotation.set(-1.6, 0, -0.6);
        break;
      case 'fan': {
        const k = Math.sin(t * 2.4 + this.phase);
        R.sh.rotation.set(-1.6 + k * 0.5, 0, -0.4); R.el.rotation.set(-0.4, 0, 0);
        break;
      }
      case 'trumpet':
        for (const a of this.arms) { a.sh.rotation.set(-1.2, 0, -a.side * 0.35); a.el.rotation.set(-1.1, 0, 0); }
        this.head.rotation.x = -0.15;
        break;
      case 'nagara': {
        const a = Math.sin(t * 6 + this.phase);
        L.sh.rotation.set(-0.6 - Math.max(0, a) * 0.6, 0, 0.3); L.el.rotation.set(-1.0, 0, 0);
        R.sh.rotation.set(-0.6 - Math.max(0, -a) * 0.6, 0, -0.3); R.el.rotation.set(-1.0, 0, 0);
        break;
      }
      case 'sit':
        for (const a of this.arms) { a.sh.rotation.set(-0.45, 0, a.side * 0.1); a.el.rotation.set(-0.7, 0, 0); }
        break;
      case 'clap': {
        const k = Math.abs(Math.sin(t * 7));
        for (const a of this.arms) { a.sh.rotation.set(-1.0, 0, -a.side * (0.2 + k * 0.25)); a.el.rotation.set(-0.8, 0, 0); }
        break;
      }
      default:
        if (sp > 0.05) {
          const amp = Math.min(1, sp / 1.6) * 0.55;
          for (const a of this.arms) a.sh.rotation.x = Math.sin(ph + (a.side > 0 ? Math.PI : 0)) * amp;
        } else {
          this.torso.rotation.x = Math.sin(t * 1.3 + this.phase) * 0.015;
        }
    }
  }
}

// ---------------------------------------------------------------- props ----
export const Props = {
  stoneBlock(w = 0.5, h = 0.3, d = 0.4) { return part('box', '#9b9284', w, h, d, 0, h / 2, 0); },
  pot(color = '#a5532c') {
    const g = new THREE.Group();
    part('sphere', color, 0.16, 0.15, 0.16, 0, 0.14, 0, g);
    part('cyl', color, 0.07, 0.08, 0.07, 0, 0.29, 0, g);
    return g;
  },
  basket(fill = '#e2b13c') {
    const g = new THREE.Group();
    part('cyl', '#8a6a3a', 0.28, 0.12, 0.28, 0, 0.06, 0, g);
    part('hemi', fill, 0.25, 0.1, 0.25, 0, 0.12, 0, g);
    return g;
  },
  spear() {
    const g = new THREE.Group();
    g.rotation.x = 1.5; // held upright by a hand whose forearm points forward
    part('cyl', '#5a3d22', 0.018, 2.3, 0.018, 0, 0.55, 0, g);
    part('cone', '#c8ccd2', 0.04, 0.22, 0.04, 0, 1.8, 0, g, mat('#c8ccd2', { emissive: '#222' }));
    part('sphere', '#c22', 0.04, 0.04, 0.04, 0, 1.65, 0, g);
    return g;
  },
  hammer() {
    const g = new THREE.Group();
    part('cyl', '#5a3d22', 0.015, 0.35, 0.015, 0, -0.1, 0.05, g).rotation.x = Math.PI / 2;
    part('box', '#555', 0.08, 0.07, 0.12, 0, -0.1, 0.22, g);
    return g;
  },
  parasol(color = '#c4161c') {
    const g = new THREE.Group();
    g.rotation.x = 1.62;
    part('cyl', '#e8c252', 0.02, 3.0, 0.02, 0, 1.2, 0, g);
    part('cone', color, 1.15, 0.55, 1.15, 0, 2.85, 0, g, doubleMat(color));
    part('cyl', '#e8c252', 1.16, 0.12, 1.16, 0, 2.58, 0, g, mat('#e8c252', { emissive: '#3a2800' }));
    part('sphere', '#e8c252', 0.08, 0.12, 0.08, 0, 3.15, 0, g);
    return g;
  },
  chamara() {
    const g = new THREE.Group();
    g.rotation.x = 1.4;
    part('cyl', '#e8c252', 0.015, 0.7, 0.015, 0, 0.2, 0, g);
    part('cone', '#ffffff', 0.12, 0.5, 0.12, 0, 0.75, 0, g);
    return g;
  },
  flag(color = '#2a7a3b') {
    const g = new THREE.Group();
    g.rotation.x = 1.62;
    part('cyl', '#5a3d22', 0.02, 3.6, 0.02, 0, 1.2, 0, g);
    const f = part('box', color, 0.02, 0.6, 0.9, 0, 2.6, -0.45, g);
    part('box', '#e8c252', 0.022, 0.08, 0.9, 0, 2.3, -0.45, g);
    g.userData.cloth = f;
    return g;
  },
  horn() {
    const g = new THREE.Group();
    const h = part('cone', '#d9b44a', 0.08, 0.8, 0.08, 0, 0.0, 0.35, g, mat('#d9b44a', { emissive: '#2a1d00' }));
    h.rotation.x = -Math.PI / 2 - 0.3;
    return g;
  },
  nagaraDrum() {
    const g = new THREE.Group();
    part('sphere', '#7a4a22', 0.24, 0.18, 0.24, 0, 0, 0, g);
    part('cyl', '#e6dcc2', 0.24, 0.02, 0.24, 0, 0.12, 0, g);
    return g;
  },
  dholak() {
    const g = new THREE.Group();
    const d = part('cyl', '#8a4b22', 0.14, 0.5, 0.14, 0, 0, 0, g);
    d.rotation.z = Math.PI / 2;
    return g;
  },
  tray(color = '#e8c252') {
    const g = new THREE.Group();
    part('cyl', '#c9a13e', 0.25, 0.03, 0.25, 0, 0, 0, g, mat('#c9a13e', { emissive: '#2a1d00' }));
    part('hemi', color, 0.15, 0.08, 0.15, 0, 0.01, 0, g);
    return g;
  },
};

// --------------------------------------------------------------- animals ---
export class Elephant {
  constructor({ royal = true } = {}) {
    this.root = new THREE.Group();
    const g = new THREE.Group();
    this.body = g;
    this.root.add(g);
    const grey = '#6f6b68';
    part('sphere', grey, 1.05, 1.15, 1.75, 0, 2.55, 0, g);
    this.headG = new THREE.Group();
    this.headG.position.set(0, 3.0, 1.75);
    g.add(this.headG);
    part('sphere', grey, 0.8, 0.85, 0.75, 0, 0.1, 0.2, this.headG);
    for (const s of [1, -1]) {
      const ear = part('sphere', '#6a6562', 0.08, 0.75, 0.6, s * 0.75, 0.0, 0.0, this.headG);
      ear.rotation.y = s * 0.5;
      const tusk = part('cone', '#f3ead6', 0.06, 0.7, 0.06, s * 0.28, -0.55, 0.7, this.headG);
      tusk.rotation.x = 1.9;
      part('sphere', '#111', 0.05, 0.05, 0.05, s * 0.45, 0.25, 0.65, this.headG);
    }
    // trunk chain
    this.trunk = [];
    let parent = this.headG;
    let y = -0.2, z = 0.8;
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, y, z);
      parent.add(seg);
      const r = 0.22 - i * 0.025;
      part('cyl', grey, r, 0.42, r, 0, -0.2, 0, seg);
      this.trunk.push(seg);
      parent = seg;
      y = -0.38; z = 0;
    }
    this.legs = [];
    for (const [x, zz] of [[0.6, 1.0], [-0.6, 1.0], [0.6, -1.0], [-0.6, -1.0]]) {
      const hip = new THREE.Group();
      hip.position.set(x, 2.0, zz);
      g.add(hip);
      part('cyl', grey, 0.34, 2.0, 0.34, 0, -1.0, 0, hip);
      part('cyl', '#d8d0c0', 0.36, 0.08, 0.36, 0, -1.95, 0, hip);
      if (royal) part('cyl', '#e8c252', 0.36, 0.1, 0.36, 0, -1.6, 0, hip, mat('#e8c252', { emissive: '#3a2800' }));
      this.legs.push(hip);
    }
    const tail = part('cyl', grey, 0.04, 0.9, 0.04, 0, 2.3, -1.8, g);
    tail.rotation.x = 0.3;
    if (royal) {
      // caparison and howdah
      for (const s of [1, -1]) {
        const c = part('box', '#9c1b25', 0.05, 1.3, 2.4, s * 1.0, 2.55, 0, g);
        c.rotation.z = s * 0.12;
        part('box', '#e8c252', 0.06, 0.12, 2.42, s * 1.07, 1.95, 0, g, mat('#e8c252', { emissive: '#3a2800' }));
      }
      part('box', '#9c1b25', 1.9, 0.08, 2.5, 0, 3.62, 0, g);
      const hw = new THREE.Group();
      hw.position.set(0, 3.7, -0.2);
      g.add(hw);
      part('box', '#d9a62e', 1.4, 0.6, 1.5, 0, 0.3, 0, hw, mat('#d9a62e', { emissive: '#2a1b00' }));
      for (const [x, zz] of [[0.6, 0.65], [-0.6, 0.65], [0.6, -0.65], [-0.6, -0.65]])
        part('cyl', '#e8c252', 0.04, 1.2, 0.04, x, 1.2, zz, hw);
      part('hemi', '#e8c252', 0.85, 0.6, 0.9, 0, 1.8, 0, hw, mat('#e8c252', { emissive: '#3a2800' }));
      part('cone', '#e8c252', 0.08, 0.4, 0.08, 0, 2.55, 0, hw);
      // forehead plate
      part('box', '#e8c252', 0.5, 0.6, 0.05, 0, 0.3, 0.92, this.headG, mat('#e8c252', { emissive: '#3a2800' }));
    }
    this.speed = 0;
    this.phase = 0;
    this.t = 0;
    this.radius = 1.6;
  }
  update(dt) {
    this.t += dt;
    this.phase += dt * this.speed * 1.6;
    const amp = Math.min(1, this.speed) * 0.3;
    this.legs.forEach((l, i) => {
      const off = [0, Math.PI, Math.PI, 0][i];
      l.rotation.x = Math.sin(this.phase + off) * amp;
    });
    this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.06;
    this.trunk.forEach((s, i) => {
      s.rotation.x = 0.12 + Math.sin(this.t * 1.3 - i * 0.5) * 0.09;
      s.rotation.z = Math.sin(this.t * 0.9 - i * 0.6) * 0.07;
    });
    this.headG.rotation.y = Math.sin(this.t * 0.5) * 0.08;
  }
}

export class Ox {
  constructor(color = '#e8e2d6') {
    this.root = new THREE.Group();
    const g = this.body = new THREE.Group();
    this.root.add(g);
    part('box', color, 0.7, 0.75, 1.7, 0, 1.15, 0, g);
    part('sphere', color, 0.3, 0.32, 0.32, 0, 1.6, 0.45, g); // hump
    const head = new THREE.Group();
    head.position.set(0, 1.3, 0.95);
    g.add(head);
    part('box', color, 0.38, 0.4, 0.55, 0, 0, 0.15, head);
    for (const s of [1, -1]) {
      const h = part('cone', '#3a2f25', 0.05, 0.4, 0.05, s * 0.18, 0.32, 0.0, head);
      h.rotation.z = -s * 0.4;
    }
    part('box', '#c9472b', 0.72, 0.2, 0.1, 0, 0.9, 0.85, g); // decorated harness
    this.legs = [];
    for (const [x, z] of [[0.25, 0.65], [-0.25, 0.65], [0.25, -0.65], [-0.25, -0.65]]) {
      const hip = new THREE.Group();
      hip.position.set(x, 0.85, z);
      g.add(hip);
      part('box', color, 0.15, 0.85, 0.15, 0, -0.42, 0, hip);
      this.legs.push(hip);
    }
    this.speed = 0; this.phase = 0;
  }
  update(dt) {
    this.phase += dt * this.speed * 4;
    const amp = Math.min(1, this.speed) * 0.45;
    this.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.phase + [0, Math.PI, Math.PI, 0][i]) * amp));
  }
}

/** Random townsperson. */
export function randomCitizen() {
  const female = Math.random() < 0.45;
  if (female) {
    const sari = pick(['#c9472b', '#e0a526', '#2f6f8f', '#7b2d4f', '#3d7a4a', '#d96a2b', '#b5294e', '#5b3a8a']);
    return new Human({
      female: true, top: pick(['#e0a526', '#7b2d4f', '#2f6f8f', '#c9472b']), skirt: sari, sleeves: true,
      head: Math.random() < 0.6 ? 'veil' : 'hair', headColor: sari, bangles: true, scale: rand(0.86, 0.96),
    });
  }
  const rich = Math.random() < 0.3;
  return new Human({
    top: rich ? pick(['#f2ead8', '#e7d9b8', '#e0a526']) : Math.random() < 0.4 ? null : pick(CLOTH),
    sleeves: rich, longSleeves: rich, robe: rich ? pick(['#f2ead8', '#efe3c8', '#e7d9b8']) : null,
    sash: rich ? pick(['#c9472b', '#2a7a3b', '#e0a526']) : null,
    bottom: pick(['#f2ead8', '#efe6d2', '#e0d4b8']), head: pick(['turban', 'turban', 'pagri', 'cap']),
    beard: Math.random() < 0.4,
  });
}
