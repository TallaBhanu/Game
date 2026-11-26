// Static architecture of Golconda c. 1518.
import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { boxGeo, arcadeGeo, StaticBatch, MATERIALS } from './builder.js';
import {
  R_OUTER, R_CITADEL, R_MIDDLE, WALL_H, WALL_T, BASTION_ANGLES, GATES, CONSTRUCTION, ROAD, PROCESSION,
  BAZAAR, DANCE, PALACE, PORTICO, TEMPLE, TANK, WORLD_R, STABLE,
} from './layout.js';
import { rand, rng, pick, clamp, TAU } from '../core/util.js';

function cylGeo(rt, rb, h, n = 16, tile = 4) {
  const g = new THREE.CylinderGeometry(rt, rb, h, n);
  const uv = g.attributes.uv;
  const circ = Math.PI * (rt + rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / tile, (uv.getY(i) * h) / tile);
  return g;
}
const GEO = {
  cyl: (rt, rb, h, n = 16) => cylGeo(rt, rb, h, n),
  dome: (r) => new THREE.SphereGeometry(r, 14, 8, 0, TAU, 0, Math.PI / 2),
  cone: (r, h, n = 12) => new THREE.ConeGeometry(r, h, n),
};

function minGround(x, z, r) {
  let m = Infinity;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    m = Math.min(m, terrainHeight(x + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  return Math.min(m, terrainHeight(x, z));
}

export class Fort {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.batch = new StaticBatch();
    this.torches = []; // {x,y,z}
    this.reserved = []; // circles that random props should avoid {x,z,r}
    this.flags = [];
    this.gatePortals = [];
    this.landmarkSpots = [];
  }

  build() {
    this.outerWall();
    this.middleWall();
    this.citadelWall();
    this.landmarks();
    this.stable();
    this.fatehDarwaza();
    this.banjaraGate();
    this.portico();
    this.balaHisar();
    this.temple();
    this.palace();
    this.tank();
    this.houses();
    this.scenery();
    this.batch.build(this.scene);
    this.buildTorches();
  }

  // ---------------------------------------------------------------- walls --
  wallSegment(ax, az, bx, bz, height = WALL_H, thick = WALL_T, mat = 'granite', merlons = true) {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.5) return;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const rot = Math.atan2(-(bz - az), bx - ax); // local +x along segment
    let g = Infinity, gmax = -Infinity;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const h = terrainHeight(ax + (bx - ax) * t, az + (bz - az) * t);
      g = Math.min(g, h); gmax = Math.max(gmax, h);
    }
    const top = (g + gmax) / 2 + height;
    const bottom = g - 4;
    this.batch.box(len, top - bottom, thick, mx, (top + bottom) / 2, mz, rot, mat);
    // walkway lip and merlons on the outer face
    if (merlons) {
      const n = Math.floor(len / 1.8);
      const dirx = (bx - ax) / len, dirz = (bz - az) / len;
      // outward normal (pointing away from origin)
      let nx = -dirz, nz = dirx;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const px = ax + (bx - ax) * t + nx * (thick / 2 - 0.35);
        const pz = az + (bz - az) * t + nz * (thick / 2 - 0.35);
        this.batch.box(0.9, 1.1, 0.7, px, top + 0.55, pz, rot, mat, 2);
      }
      // inner parapet
      this.batch.box(len, 0.5, 0.4, mx - nx * (thick / 2 - 0.2), top + 0.25, mz - nz * (thick / 2 - 0.2), rot, mat);
    }
    this.physics.addBox(mx, mz, len / 2, thick / 2, rot, top + 1, bottom);
    return top;
  }

  bastion(x, z, r = 6.2, height = WALL_H + 2, mat = 'granite') {
    const g = minGround(x, z, r);
    const top = terrainHeight(x, z) + height;
    const h = top - (g - 4);
    this.batch.add(GEO.cyl(r, r * 1.08, h, 20), mat, x, g - 4 + h / 2, z);
    const n = Math.floor((TAU * r) / 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.batch.box(0.9, 1.2, 0.7, x + Math.cos(a) * (r - 0.3), top + 0.6, z + Math.sin(a) * (r - 0.3), -a + Math.PI / 2, mat, 2);
    }
    this.physics.addCircle(x, z, r, top + 1.2, g - 4);
    return top;
  }

  outerWall() {
    const pts = BASTION_ANGLES.map((a) => ({ a, x: R_OUTER * Math.cos(a), z: R_OUTER * Math.sin(a) }));
    for (let i = 0; i < pts.length; i++) {
      const A = pts[i], B = pts[(i + 1) % pts.length];
      const midA = (A.a + (B.a < A.a ? B.a + TAU : B.a)) / 2;
      const gate = GATES.find((g) => Math.abs(((g.angle - midA + 3 * Math.PI) % TAU) - Math.PI) < 0.05);
      if (gate) {
        const gx = R_OUTER * Math.cos(gate.angle) * Math.cos(Math.PI / 24), gz = R_OUTER * Math.sin(gate.angle) * Math.cos(Math.PI / 24);
        const dx = (B.x - A.x), dz = (B.z - A.z), L = Math.hypot(dx, dz);
        const ux = dx / L, uz = dz / L;
        const gap = 8;
        this.wallSegment(A.x, A.z, gx - ux * gap, gz - uz * gap);
        this.wallSegment(gx + ux * gap, gz + uz * gap, B.x, B.z);
        gate.pos = { x: gx, z: gz, ux, uz };
      } else {
        this.wallSegment(A.x, A.z, B.x, B.z);
      }
    }
    for (const p of pts) this.bastion(p.x, p.z);
    this.reserved.push({ ring: R_OUTER, w: 12 });
    // torches along the inside of the wall near the gates
  }

  citadelWall() {
    const n = 12;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i / n) * TAU + Math.PI / n; // gate (south, +z) sits mid-segment
      pts.push({ x: R_CITADEL * Math.cos(a), z: R_CITADEL * Math.sin(a) });
    }
    for (let i = 0; i < n; i++) {
      const A = pts[i], B = pts[(i + 1) % n];
      const mz = (A.z + B.z) / 2, mx = (A.x + B.x) / 2;
      if (mz > 30 && Math.abs(mx) < 6) {
        // gate segment: leave an opening of 6 m
        const gx = 0, gz = (A.z + B.z) / 2;
        const ux = (B.x - A.x) / Math.hypot(B.x - A.x, B.z - A.z), uz = (B.z - A.z) / Math.hypot(B.x - A.x, B.z - A.z);
        this.wallSegment(A.x, A.z, gx - ux * 3.5, gz - uz * 3.5, 7, 3);
        this.wallSegment(gx + ux * 3.5, gz + uz * 3.5, B.x, B.z, 7, 3);
        const base = terrainHeight(gx, gz);
        const { geo, piers } = arcadeGeo(9, 9, 3.4, 1, 4.6, 6.2);
        const rot = Math.atan2(-uz, ux);
        this.batch.add(geo, 'granite', gx, base - 0.02, gz, rot);
        for (const [x0, x1] of piers) {
          const c = (x0 + x1) / 2;
          this.physics.addBox(gx + ux * c, gz + uz * c, (x1 - x0) / 2, 1.7, rot, base + 9);
        }
        this.bastion(gx - ux * 5.5, gz - uz * 5.5, 2.6, 10);
        this.bastion(gx + ux * 5.5, gz + uz * 5.5, 2.6, 10);
        this.torches.push({ x: gx - ux * 3, y: base + 4, z: gz + 2 }, { x: gx + ux * 3, y: base + 4, z: gz + 2 });
      } else {
        this.wallSegment(A.x, A.z, B.x, B.z, 7, 3);
      }
    }
    for (const p of pts) this.bastion(p.x, p.z, 3.6, 8.5);
  }

  gateway(x, z, ux, uz, name, dims = {}) {
    const base = terrainHeight(x, z);
    const rot = Math.atan2(-uz, ux);
    const { W = 16, H = 15, D = 7, OW = 6, OH = 10, towerR = 5 } = dims;
    const { geo, piers } = arcadeGeo(W, H, D, 1, OW, OH);
    this.batch.add(geo, 'granite', x, base - 0.02, z, rot);
    for (const [x0, x1] of piers) {
      const c = (x0 + x1) / 2;
      this.physics.addBox(x + ux * c, z + uz * c, (x1 - x0) / 2, D / 2, rot, base + H);
    }
    // crenellated top and flanking towers
    for (let i = 0; i < 8; i++) {
      const c = -W / 2 + (i + 0.5) * (W / 8);
      this.batch.box(1.1, 1.3, D + 0.2, x + ux * c, base + H + 0.65, z + uz * c, rot, 'granite', 2);
    }
    for (const s of [-1, 1]) {
      const tx = x + ux * s * (W / 2 + towerR / 2), tz = z + uz * s * (W / 2 + towerR / 2);
      this.bastion(tx, tz, towerR, H + 3);
      this.batch.add(GEO.dome(towerR * 0.48), 'plasterWhite', tx, base + H + 3.2, tz);
      this.batch.add(GEO.cyl(towerR / 2, towerR / 2, 0.4), 'granite', tx, base + H + 3.0, tz);
    }
    // Teak doors standing open, studded with iron spikes against war elephants.
    const nx = -uz, nz = ux; // through-direction
    const inward = nx * x + nz * z > 0 ? -1 : 1;
    for (const s of [-1, 1]) {
      const hx = x + ux * s * (OW / 2), hz = z + uz * s * (OW / 2);
      const open = s * (Math.PI / 2 - 0.25) * inward;
      const doorRot = rot + open;
      const cx = Math.cos(doorRot), sz = -Math.sin(doorRot);
      const dcx = hx - ux * s * (OW / 4) * 0 + (cx * -s * OW / 4), dcz = hz + (sz * -s * OW / 4);
      this.batch.box(OW / 2, OH * 0.72, 0.3, dcx + nx * inward * (D / 2 - 1), base + OH * 0.36, dcz + nz * inward * (D / 2 - 1), doorRot, 'wood', 2);
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 3; c++) {
          const off = (c - 1) * 0.85;
          const px = dcx + nx * inward * (D / 2 - 1) + cx * off, pz = dcz + nz * inward * (D / 2 - 1) + sz * off;
          this.batch.add(GEO.cone(0.09, 0.55, 6), 'iron', px - Math.sin(doorRot) * 0.35 * -inward * s, base + 1.6 + r * 1.4, pz - Math.cos(doorRot) * 0.35 * -inward * s, doorRot, Math.PI / 2 * inward * s, 0);
        }
    }
    this.torches.push(
      { x: x + ux * 3.8 + nx * 4.2, y: base + 4, z: z + uz * 3.8 + nz * 4.2 },
      { x: x - ux * 3.8 + nx * 4.2, y: base + 4, z: z - uz * 3.8 + nz * 4.2 },
      { x: x + ux * 3.8 - nx * 4.2, y: base + 4, z: z + uz * 3.8 - nz * 4.2 },
      { x: x - ux * 3.8 - nx * 4.2, y: base + 4, z: z - uz * 3.8 - nz * 4.2 },
    );
    const f = this.flagPole(x, base + H + 1.3, z, '#2a7a3b', 4);
    void f; void name;
  }

  fatehDarwaza() {
    const g = GATES[0];
    this.gateway(g.pos.x, g.pos.z, g.pos.ux, g.pos.uz, g.name);
  }
  banjaraGate() {
    const g = GATES[1];
    this.gateway(g.pos.x, g.pos.z, g.pos.ux, g.pos.uz, g.name);
  }

  flagPole(x, y, z, color, h = 6) {
    this.batch.add(GEO.cyl(0.07, 0.09, h, 6), 'woodDark', x, y + h / 2, z);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5, 8, 1), MATERIALS[color === '#f08a24' ? 'saffron' : 'green']);
    flag.geometry.translate(1.2, 0, 0);
    flag.position.set(x, y + h - 0.8, z);
    flag.castShadow = true;
    this.scene.add(flag);
    this.flags.push(flag);
    return flag;
  }

  // ---------------------------------------------------------- buildings --
  portico() {
    const { x, z } = PORTICO;
    const base = terrainHeight(x, z);
    const S = 9, H = 7;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const ox = Math.cos(a) * (S / 2), oz = Math.sin(a) * (S / 2);
      const rot = -a + Math.PI / 2;
      const { geo, piers } = arcadeGeo(S + 1, H, 1, 1, i % 2 === 0 ? 5.2 : 4.4, 5);
      this.batch.add(geo, 'plasterWhite', x + ox, base - 0.02, z + oz, rot);
      const ux = Math.cos(rot), uz = -Math.sin(rot);
      for (const [x0, x1] of piers) {
        const c = (x0 + x1) / 2;
        this.physics.addBox(x + ox + ux * c, z + oz + uz * c, (x1 - x0) / 2, 0.5, rot, base + H);
      }
    }
    this.batch.box(S + 2, 0.6, S + 2, x, base + H + 0.3, z, 0, 'plasterWhite');
    this.batch.add(GEO.dome(4.2), 'plasterWhite', x, base + H + 0.6, z);
    this.batch.add(GEO.cone(0.3, 1.2, 8), 'gold', x, base + H + 5.2, z);
    this.reserved.push({ x, z, r: 9 });
  }

  balaHisar() {
    const cx = 0, cz = -4;
    const base = terrainHeight(cx, cz);
    const W = 24, Dp = 16, PH = 1.3;
    // plinth
    this.batch.box(W + 4, PH + 4, Dp + 4, cx, base + PH / 2 - 2, cz, 0, 'graniteWarm');
    this.physics.addPlatform(cx, cz, (W + 4) / 2, (Dp + 4) / 2, 0, base + PH);
    // front steps (ramp collider, stepped visuals)
    const stepsZ = cz + (Dp + 4) / 2 + 1.6;
    for (let i = 0; i < 5; i++) {
      const h = PH * (1 - i / 5);
      this.batch.box(8, h, 0.65, cx, base + h / 2, cz + (Dp + 4) / 2 + 0.32 + i * 0.64, 0, 'graniteWarm', 2);
    }
    this.physics.addPlatform(cx, stepsZ, 4, 1.65, 0, base + PH, base);
    // ground-floor arcade: front & back 5 arches, sides 3
    const y0 = base + PH;
    const H1 = 7.5;
    const walls = [
      { x: cx, z: cz + Dp / 2, rot: 0, w: W, n: 5 },
      { x: cx, z: cz - Dp / 2, rot: 0, w: W, n: 5 },
      { x: cx + W / 2, z: cz, rot: Math.PI / 2, w: Dp, n: 3 },
      { x: cx - W / 2, z: cz, rot: Math.PI / 2, w: Dp, n: 3 },
    ];
    for (const w of walls) {
      const { geo, piers } = arcadeGeo(w.w + 1, H1, 1, w.n, 2.7, 5, 4);
      this.batch.add(geo, 'plasterOchre', w.x, y0 - 0.02, w.z, w.rot);
      const ux = Math.cos(w.rot), uz = -Math.sin(w.rot);
      for (const [a, b] of piers) {
        const c = (a + b) / 2;
        this.physics.addBox(w.x + ux * c, w.z + uz * c, (b - a) / 2, 0.55, w.rot, y0 + H1);
      }
    }
    // floor, ceiling slab, upper storey, parapet, corner chhatris
    this.batch.box(W, 0.1, Dp, cx, y0 + 0.05, cz, 0, 'floor', Dp);
    this.batch.box(W + 1.6, 0.7, Dp + 1.6, cx, y0 + H1 + 0.35, cz, 0, 'plasterOchre');
    const y1 = y0 + H1 + 0.7;
    const W2 = 14, D2 = 9, H2 = 5.5;
    for (const w of [
      { x: cx, z: cz + D2 / 2, rot: 0, w: W2, n: 5 },
      { x: cx, z: cz - D2 / 2, rot: 0, w: W2, n: 5 },
      { x: cx + W2 / 2, z: cz, rot: Math.PI / 2, w: D2, n: 3 },
      { x: cx - W2 / 2, z: cz, rot: Math.PI / 2, w: D2, n: 3 },
    ]) {
      const { geo } = arcadeGeo(w.w + 0.8, H2, 0.8, w.n, 1.7, 3.4, 4);
      this.batch.add(geo, 'plasterWhite', w.x, y1 - 0.02, w.z, w.rot);
    }
    this.batch.box(W2 + 1.2, 0.5, D2 + 1.2, cx, y1 + H2 + 0.25, cz, 0, 'plasterWhite');
    this.batch.add(GEO.dome(3.2), 'plasterWhite', cx, y1 + H2 + 0.5, cz);
    this.batch.add(GEO.cone(0.25, 1.4, 8), 'gold', cx, y1 + H2 + 4.3, cz);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const px = cx + sx * (W / 2 + 0.3), pz = cz + sz * (Dp / 2 + 0.3);
      this.batch.add(GEO.cyl(0.7, 0.8, 4, 8), 'plasterOchre', px, y1 + 2, pz);
      this.batch.add(GEO.dome(0.9), 'plasterWhite', px, y1 + 4, pz);
      this.batch.add(GEO.cone(0.12, 0.6, 6), 'gold', px, y1 + 5.1, pz);
      // parapet
    }
    for (const [ax, az, bx, bz] of [[-1, 1, 1, 1], [-1, -1, 1, -1], [1, -1, 1, 1], [-1, -1, -1, 1]]) {
      const x0 = cx + ax * (W / 2), z0 = cz + az * (Dp / 2), x1 = cx + bx * (W / 2), z1 = cz + bz * (Dp / 2);
      const len = Math.hypot(x1 - x0, z1 - z0);
      this.batch.box(len, 0.9, 0.35, (x0 + x1) / 2, y1 + 0.45, (z0 + z1) / 2, ax === bx ? Math.PI / 2 : 0, 'plasterOchre');
    }
    // throne dais inside
    this.batch.box(5, 0.6, 3, cx, y0 + 0.3, cz - 5, 0, 'graniteWarm');
    this.physics.addPlatform(cx, cz - 5, 2.5, 1.5, 0, y0 + 0.6);
    this.batch.box(1.8, 0.6, 1.2, cx, y0 + 0.9, cz - 5.6, 0, 'gold');
    this.batch.box(1.8, 1.6, 0.25, cx, y0 + 1.6, cz - 6.15, 0, 'gold');
    this.batch.box(1.8, 0.15, 1.2, cx, y0 + 1.25, cz - 5.6, 0, 'tile');
    this.flagPole(cx, y1 + H2 + 0.6, cz + 4, '#2a7a3b', 7);
    this.hallFloorY = y0;
    this.torches.push({ x: cx - 4.5, y: y0 + 2.2, z: cz + Dp / 2 + 1 }, { x: cx + 4.5, y: y0 + 2.2, z: cz + Dp / 2 + 1 });
    this.reserved.push({ x: cx, z: cz, r: 18 });
  }

  temple() {
    const { x, z } = TEMPLE;
    const base = terrainHeight(x, z);
    this.batch.box(9, 1.6, 6.5, x, base + 0.3, z, 0, 'granite', 2);
    this.physics.addPlatform(x, z, 4.5, 3.25, 0, base + 1.1);
    // sanctum (west part) + stepped shikhara
    const sx = x - 1.8;
    this.batch.box(4, 3.4, 4, sx, base + 1.1 + 1.7, z, 0, 'granite', 2);
    this.physics.addBox(sx, z, 2, 2, 0, base + 6);
    let y = base + 4.5, s = 4.4;
    for (let i = 0; i < 6; i++) {
      this.batch.box(s, 0.75, s, sx, y + 0.37, z, 0, 'granite', 2);
      y += 0.75; s *= 0.8;
    }
    this.batch.add(new THREE.SphereGeometry(0.9, 10, 6), 'granite', sx, y + 0.4, z, 0, 0, 0, 1, 0.6, 1);
    this.batch.add(GEO.cone(0.22, 0.9, 8), 'gold', sx, y + 1.2, z);
    this.batch.box(0.9, 1.9, 0.1, sx + 2.01, base + 2.1, z, Math.PI / 2, 'dark');
    // mandapa: 4 pillars and a slab roof
    for (const [px, pz] of [[1.2, 1.6], [1.2, -1.6], [3.6, 1.6], [3.6, -1.6]]) {
      this.batch.box(0.4, 2.8, 0.4, x + px, base + 1.1 + 1.4, z + pz, 0, 'granite', 2);
      this.physics.addCircle(x + px, z + pz, 0.3, base + 4);
    }
    this.batch.box(3.6, 0.4, 4.2, x + 2.4, base + 4.1, z, 0, 'granite', 2);
    this.flagPole(sx, y + 1.3, z, '#f08a24', 3);
    this.torches.push({ x: x + 4, y: base + 2.4, z: z + 2.3 });
    this.reserved.push({ x, z, r: 7 });
  }

  palace() {
    const { x, z } = PALACE;
    const base = terrainHeight(x, z);
    // main block facing north (toward the hill)
    const W = 26, D = 12, H = 6.5;
    this.batch.box(W + 2, 1.2 + 3, D + 2, x, base + 0.6 - 1.5, z, 0, 'graniteWarm');
    const fz = z - D / 2;
    const { geo } = arcadeGeo(W, H, 1, 7, 2.4, 4.6);
    this.batch.add(geo, 'plasterRose', x, base + 1.2, fz, 0);
    this.batch.box(W, H, 1, x, base + 1.2 + H / 2, z + D / 2, 0, 'plasterRose');
    this.batch.box(1, H, D, x - W / 2, base + 1.2 + H / 2, z, 0, 'plasterRose');
    this.batch.box(1, H, D, x + W / 2, base + 1.2 + H / 2, z, 0, 'plasterRose');
    this.batch.box(W - 1, 0.2, D - 1, x, base + 1.3, z, 0, 'floor', 4);
    this.batch.box(W + 1, 0.6, D + 1, x, base + 1.2 + H + 0.3, z, 0, 'plasterWhite');
    // upper pavilion
    const { geo: g2 } = arcadeGeo(12, 4, 0.8, 5, 1.6, 2.9);
    this.batch.add(g2, 'plasterWhite', x, base + 1.8 + H, fz + 3, 0);
    this.batch.box(12, 4, 0.8, x, base + 1.8 + H + 2, z + 2, 0, 'plasterWhite');
    this.batch.box(0.8, 4, 6, x - 6, base + 1.8 + H + 2, fz + 6, 0, 'plasterWhite');
    this.batch.box(0.8, 4, 6, x + 6, base + 1.8 + H + 2, fz + 6, 0, 'plasterWhite');
    this.batch.box(13, 0.4, 7, x, base + 1.8 + H + 4.2, fz + 5.5, 0, 'plasterWhite');
    for (const sx of [-1, 1]) {
      this.batch.add(GEO.dome(1.6), 'plasterWhite', x + sx * 4, base + 1.8 + H + 4.4, fz + 5.5);
      this.batch.add(GEO.cyl(0.8, 0.9, 9, 8), 'plasterRose', x + sx * (W / 2), base + 1.2 + 4.5, fz);
      this.batch.add(GEO.dome(1.0), 'plasterWhite', x + sx * (W / 2), base + 1.2 + 9, fz);
    }
    this.physics.addBox(x, z, W / 2 + 1, D / 2 + 1, 0, base + 20);
    // garden forecourt: low wall and fountain
    const gz = fz - 9;
    this.batch.box(W + 6, 0.8, 0.5, x, base + 0.4, gz - 7, 0, 'plasterRose');
    this.batch.add(GEO.cyl(2.2, 2.4, 0.7, 16), 'granite', x, base + 0.35, gz);
    this.batch.add(GEO.cyl(0.25, 0.3, 1.6, 8), 'granite', x, base + 1.0, gz);
    this.physics.addCircle(x, gz, 2.4, base + 0.75);
    this.fountain = { x, y: base + 1.8, z: gz };
    this.torches.push({ x: x - 3, y: base + 3.2, z: fz - 1 }, { x: x + 3, y: base + 3.2, z: fz - 1 });
    this.flagPole(x, base + 1.8 + H + 4.4, fz + 5.5, '#2a7a3b', 5);
    this.reserved.push({ x, z, r: 22 }, { x, z: gz, r: 10 });
  }

  tank() {
    const { x, z, w, d } = TANK;
    const base = terrainHeight(x, z);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 4, d - 4),
      new THREE.MeshStandardMaterial({ color: '#3f6f72', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, base - 1.6, z);
    this.scene.add(water);
    this.water = water;
    // stepped sides going down
    for (let i = 0; i < 4; i++) {
      const ww = w - i * 1.2, dd = d - i * 1.2, y = base - 0.45 * i;
      for (const [ox, oz, bw, bd] of [[0, dd / 2, ww, 0.6], [0, -dd / 2, ww, 0.6], [ww / 2, 0, 0.6, dd], [-ww / 2, 0, 0.6, dd]])
        this.batch.box(bw, 0.45, bd, x + ox, y - 0.22, z + oz, 0, 'granite', 2);
    }
    this.batch.box(w - 4, 0.2, d - 4, x, base - 2.2, z, 0, 'rubble');
    // parapet with gap for steps
    this.batch.box(w + 1, 0.8, 0.5, x, base + 0.4, z - d / 2 - 0.4, 0, 'granite', 2);
    this.batch.box(0.5, 0.8, d + 1, x - w / 2 - 0.4, base + 0.4, z, 0, 'granite', 2);
    this.batch.box(0.5, 0.8, d + 1, x + w / 2 + 0.4, base + 0.4, z, 0, 'granite', 2);
    this.physics.addBox(x, z, w / 2 + 0.6, d / 2 + 0.6, 0, base + 0.8, base - 10);
    this.reserved.push({ x, z, r: 18 });
  }


  // ------------------------------------------------- middle wall + gate --
  middleWall() {
    const n = 20, step = TAU / n;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = step / 2 + i * step;
      pts.push({ x: R_MIDDLE * Math.cos(a), z: R_MIDDLE * Math.sin(a) });
    }
    for (let i = 0; i < n; i++) {
      const A = pts[i], B = pts[(i + 1) % n];
      const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
      if (mx > 0 && Math.abs(mz) < 1) {
        const L = Math.hypot(B.x - A.x, B.z - A.z), ux = (B.x - A.x) / L, uz = (B.z - A.z) / L;
        this.wallSegment(A.x, A.z, mx - ux * 7, mz - uz * 7, 8, 3.5);
        this.wallSegment(mx + ux * 7, mz + uz * 7, B.x, B.z, 8, 3.5);
        // Bala Hisar Darwaza: the ornate gate of the inner fort
        this.gateway(mx, mz, ux, uz, 'Bala Hisar Darwaza', { W: 11, H: 11, D: 5, OW: 4.6, OH: 7.4, towerR: 3.4 });
        const base = terrainHeight(mx, mz);
        const rot = Math.atan2(-uz, ux);
        // carved panel above the arch (the famous lion-and-peacock reliefs)
        this.batch.box(5.2, 2.2, 0.3, mx + 2.65, base + 8.9, mz, rot + Math.PI / 2 * 0, 'plasterWhite', 2);
        this.batch.add(GEO.cyl(0.55, 0.55, 0.2, 12), 'gold', mx + 2.85, base + 8.9, mz, 0, 0, Math.PI / 2);
        this.gatePortals.push({ x: mx, z: mz });
      } else {
        this.wallSegment(A.x, A.z, B.x, B.z, 8, 3.5);
      }
    }
    for (const p of pts) this.bastion(p.x, p.z, 4.4, 10);
  }

  roadSpot(s, outer, dist) {
    const p = ROAD.at(s);
    let nx = -p.dz, nz = p.dx;
    const out = nx * p.x + nz * p.z > 0;
    if (out !== outer) { nx = -nx; nz = -nz; }
    const x = p.x + nx * dist, z = p.z + nz * dist;
    return { x, z, rot: Math.atan2(-nx, -nz), tx: p.dx, tz: p.dz, nx, nz };
  }

  building(x, z, rot, w, d, h, mat, { arches = 0, roofDome = false, vault = false } = {}) {
    const g = minGround(x, z, Math.max(w, d) / 2);
    const top = terrainHeight(x, z) + h;
    const H = top - g + 1;
    this.batch.box(w, H, d, x, g - 1 + H / 2, z, rot, mat);
    const fx = Math.sin(rot), fz = Math.cos(rot), cx = Math.cos(rot), cz = -Math.sin(rot);
    if (arches) {
      const gf = terrainHeight(x + fx * (d / 2), z + fz * (d / 2));
      const { geo } = arcadeGeo(w, Math.min(h * 0.75, 7), 0.6, arches, Math.min(2.4, (w / arches) * 0.55), Math.min(h * 0.55, 4.6));
      this.batch.add(geo, mat, x + fx * (d / 2 + 0.3), gf - 0.3, z + fz * (d / 2 + 0.3), rot);
      for (let i = 0; i < arches; i++) {
        const o = -w / 2 + (i + 0.5) * (w / arches);
        this.batch.box((w / arches) * 0.5, Math.min(h * 0.55, 4.6) * 0.9, 0.1, x + fx * (d / 2 + 0.01) + cx * o, gf + Math.min(h * 0.55, 4.6) * 0.42, z + fz * (d / 2 + 0.01) + cz * o, rot, 'dark');
      }
    }
    // parapet
    for (const sd of [1, -1]) {
      this.batch.box(w + 0.3, 0.7, 0.35, x + fx * sd * (d / 2), top + 0.35, z + fz * sd * (d / 2), rot, mat);
      this.batch.box(0.35, 0.7, d, x + cx * sd * (w / 2), top + 0.35, z + cz * sd * (w / 2), rot, mat);
    }
    if (vault) {
      const v = new THREE.CylinderGeometry(d / 2, d / 2, w, 14, 1, false, 0, Math.PI);
      this.batch.add(v, mat, x, top, z, rot, 0, Math.PI / 2);
    }
    if (roofDome) this.batch.add(GEO.dome(Math.min(w, d) * 0.32), 'plasterWhite', x, top, z);
    this.physics.addBox(x, z, w / 2 + 0.3, d / 2 + 0.3, rot, top + 1);
    this.reserved.push({ x, z, r: Math.max(w, d) * 0.62 });
    return top;
  }

  landmarks() {
    const s0 = ROAD.cum[7]; // start of the climb, just past the portico
    // Habshi Kamans: tall arches spanning the road where the climb begins
    for (const ds of [26, 36]) {
      const p = ROAD.at(s0 + ds);
      const nx = -p.dz, nz = p.dx;
      const rot = Math.atan2(-nz, nx);
      const base = terrainHeight(p.x, p.z) - 0.5;
      const { geo, piers } = arcadeGeo(16, 11, 2.2, 1, 7.4, 8.2);
      this.batch.add(geo, 'granite', p.x, base, p.z, rot);
      for (const [a, b] of piers) {
        const c = (a + b) / 2;
        this.physics.addBox(p.x + nx * c, p.z + nz * c, (b - a) / 2, 1.1, rot, base + 11);
      }
      this.batch.box(16.6, 0.8, 2.6, p.x, base + 11.4, p.z, rot, 'granite');
      this.reserved.push({ x: p.x + nx * 7, z: p.z + nz * 7, r: 3 }, { x: p.x - nx * 7, z: p.z - nz * 7, r: 3 });
    }
    // Granaries (two long vaulted stores)
    for (const k of [0, 1]) {
      const sp = this.roadSpot(s0 + 70 + k * 16, true, 11);
      this.building(sp.x, sp.z, sp.rot, 13, 7, 5.5, 'graniteWarm', { vault: true, arches: 2 });
    }
    // Silah Khana: the three-storey armoury
    {
      const sp = this.roadSpot(s0 + 125, true, 12);
      this.building(sp.x, sp.z, sp.rot, 16, 9, 12, 'plasterOchre', { arches: 5 });
      this.batch.box(16, 0.4, 0.8, sp.x + Math.sin(sp.rot) * 4.9, terrainHeight(sp.x, sp.z) + 8.2, sp.z + Math.cos(sp.rot) * 4.9, sp.rot, 'plasterWhite');
      this.landmarkSpots.push({ name: 'Silah Khana', ...sp });
    }
    // Ramdas Bandikhana: a small, grim stone cell
    {
      const sp = this.roadSpot(s0 + 200, false, 9);
      this.building(sp.x, sp.z, sp.rot, 6, 5, 3.6, 'granite', { arches: 1 });
    }
    // The Ibrahim (Taramati) Mosque, with two minarets
    {
      const sp = this.roadSpot(s0 + 300, true, 14);
      const top = this.building(sp.x, sp.z, sp.rot, 14, 9, 7.5, 'plasterWhite', { arches: 3 });
      const fx = Math.sin(sp.rot), fz = Math.cos(sp.rot), cx = Math.cos(sp.rot), cz = -Math.sin(sp.rot);
      for (const sd of [-1, 1]) {
        const mx = sp.x + cx * sd * 7.6 + fx * 4.6, mz = sp.z + cz * sd * 7.6 + fz * 4.6;
        const g = minGround(mx, mz, 1);
        this.batch.add(GEO.cyl(0.75, 0.9, top - g + 6, 10), 'plasterWhite', mx, (top + 6 + g) / 2, mz);
        this.batch.add(GEO.cyl(1.05, 1.05, 0.3, 10), 'plasterWhite', mx, top + 3.2, mz);
        this.batch.add(GEO.dome(0.85), 'plasterWhite', mx, top + 6, mz);
        this.batch.add(GEO.cone(0.12, 0.8, 6), 'gold', mx, top + 7.1, mz);
        this.physics.addCircle(mx, mz, 0.9, top + 7);
      }
      this.batch.add(GEO.dome(3.0), 'plasterWhite', sp.x, top, sp.z);
      this.landmarkSpots.push({ name: 'Ibrahim Mosque', ...sp });
    }
  }

  // ---------------------------------------------- caravanserai & stables --
  stable() {
    const { x, z } = STABLE;
    const base = terrainHeight(x, z);
    const W = 44, D = 30;
    this.horseSpots = [];
    this.cartSpots = [];
    // arcaded cells on the south and west sides, open courtyard, entrance to the road (north)
    const sides = [
      { cx: x, cz: z + D / 2, rot: 0, w: W, n: 9 },
      { cx: x - W / 2, cz: z, rot: Math.PI / 2, w: D, n: 6 },
      { cx: x + W / 2, cz: z, rot: Math.PI / 2, w: D, n: 6 },
    ];
    for (const sd of sides) {
      const { geo, piers } = arcadeGeo(sd.w, 4.6, 0.8, sd.n, 2.6, 3.6);
      this.batch.add(geo, 'graniteWarm', sd.cx, base - 0.02, sd.cz, sd.rot);
      const ux = Math.cos(sd.rot), uz = -Math.sin(sd.rot);
      for (const [a, b] of piers) {
        const c = (a + b) / 2;
        this.physics.addBox(sd.cx + ux * c, sd.cz + uz * c, (b - a) / 2, 0.45, sd.rot, base + 4.6);
      }
      // back wall + roof of the cells
      const ox = -Math.sin(sd.rot) * (sd.cz > z || sd.cx > x ? 1 : -1), oz = -Math.cos(sd.rot) * (sd.cz > z || sd.cx > x ? 1 : -1);
      void ox; void oz;
    }
    const roof = (cx, cz, w, d) => this.batch.box(w, 0.5, d, cx, base + 4.85, cz, 0, 'graniteWarm');
    roof(x, z + D / 2 + 2, W + 1, 4.8);
    roof(x - W / 2 - 2, z, 4.8, D);
    roof(x + W / 2 + 2, z, 4.8, D);
    this.batch.box(W + 8, 4.6, 0.8, x, base + 2.3, z + D / 2 + 4.2, 0, 'graniteWarm');
    this.batch.box(0.8, 4.6, D, x - W / 2 - 4.2, base + 2.3, z, 0, 'graniteWarm');
    this.batch.box(0.8, 4.6, D, x + W / 2 + 4.2, base + 2.3, z, 0, 'graniteWarm');
    this.physics.addBox(x, z + D / 2 + 4.2, W / 2 + 4, 0.4, 0, base + 5);
    this.physics.addBox(x - W / 2 - 4.2, z, 0.4, D / 2, 0, base + 5);
    this.physics.addBox(x + W / 2 + 4.2, z, 0.4, D / 2, 0, base + 5);
    // north wall with a big entrance arch toward the road
    for (const sd of [-1, 1]) {
      this.batch.box(W / 2 - 4, 4.6, 0.8, x + sd * (W / 4 + 2), base + 2.3, z - D / 2, 0, 'graniteWarm');
      this.physics.addBox(x + sd * (W / 4 + 2), z - D / 2, W / 4 - 2, 0.4, 0, base + 5);
    }
    const { geo } = arcadeGeo(8, 7, 1.4, 1, 5, 5.6);
    this.batch.add(geo, 'graniteWarm', x, base - 0.02, z - D / 2, 0);
    this.batch.add(GEO.dome(1.6), 'plasterWhite', x, base + 7, z - D / 2);
    // water troughs, hay, hitching rails
    this.batch.box(6, 0.8, 1.2, x - 8, base + 0.4, z + 2, 0, 'granite', 2);
    this.physics.addBox(x - 8, z + 2, 3, 0.6, 0, base + 0.8);
    for (let i = 0; i < 6; i++) this.batch.add(GEO.cyl(0.9, 1.1, 1.2, 10), 'thatch', x + 12 + (i % 3) * 2.2, base + 0.6 + Math.floor(i / 3) * 1.1, z + 9);
    this.physics.addCircle(x + 14, z + 9, 3.2, base + 2.2);
    for (const rx of [-14, 2]) {
      this.batch.box(10, 0.15, 0.15, x + rx + 5, base + 1.1, z - 6, 0, 'woodDark');
      for (const px of [0, 5, 10]) this.batch.box(0.15, 1.2, 0.15, x + rx + px, base + 0.6, z - 6, 0, 'woodDark');
    }
    for (let i = 0; i < 4; i++) this.horseSpots.push({ x: x - 13 + i * 4.5, z: z - 4, yaw: Math.PI });
    this.horseSpots.push({ x: x - 10, z: z - D / 2 - 7, yaw: -Math.PI / 2 });
    this.cartSpots.push({ x: x + 12, z: z + 1, yaw: Math.PI / 2 });
    this.cartSpots.push({ x: x + 24, z: z - D / 2 - 8, yaw: -Math.PI / 2 });
    this.torches.push({ x: x - 4, y: base + 4, z: z - D / 2 - 1 }, { x: x + 4, y: base + 4, z: z - D / 2 - 1 });
    this.reserved.push({ x, z, r: 30 });
  }

  // ---------------------------------------------------------- the town ---
  isFree(x, z, r) {
    const rr = Math.hypot(x, z);
    if (rr > R_OUTER - 10 - r || rr < R_CITADEL + 8 + r) return false;
    if (Math.abs(rr - R_MIDDLE) < 9 + r) return false;
    if (ROAD.distance(x, z) < 7 + r || PROCESSION.distance(x, z) < 6.5 + r) return false;
    if (x > BAZAAR.x0 - 14 && x < BAZAAR.x1 + 14 && Math.abs(z) < 22 + r) return false;
    if (Math.hypot(x - DANCE.x, z - DANCE.z) < 22 + r) return false;
    const cm = CONSTRUCTION.mid;
    if (Math.hypot(x - (cm.x + CONSTRUCTION.inward.x * 20), z - (cm.z + CONSTRUCTION.inward.z * 20)) < 40 + r) return false;
    for (const c of this.reserved) if (c.x !== undefined && Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
    return true;
  }

  houses() {
    const mats = ['plaster', 'plasterOchre', 'plasterWhite', 'plasterRose', 'mud'];
    let placed = 0, tries = 0;
    this.houseList = [];
    while (placed < 95 && tries < 4000) {
      tries++;
      const a = rand(0, TAU), r = rand(R_CITADEL + 18, R_OUTER - 14);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const w = rand(5, 9), d = rand(4.5, 8);
      if (!this.isFree(x, z, Math.max(w, d) * 0.62)) continue;
      // face the nearest path
      const rot = Math.atan2(x, z) + pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]) + rand(-0.15, 0.15);
      const g = minGround(x, z, Math.max(w, d) / 2);
      const top = terrainHeight(x, z) + rand(3.2, 5.5);
      // slopes above 3 m look silly
      if (terrainHeight(x, z) - g > 3) continue;
      const m = pick(mats);
      const h = top - g + 1;
      this.batch.box(w, h, d, x, g - 1 + h / 2, z, rot, m);
      const c = Math.cos(rot), s = -Math.sin(rot);
      // parapet
      this.batch.box(w + 0.2, 0.5, 0.25, x + (-s) * (d / 2) * -1 * 0, top + 0.25, z, rot, m);
      for (const sd of [1, -1]) {
        const px = x + Math.sin(rot) * sd * (d / 2), pz = z + Math.cos(rot) * sd * (d / 2);
        this.batch.box(w + 0.2, 0.55, 0.25, px, top + 0.27, pz, rot, m);
        const qx = x + c * sd * (w / 2), qz = z + s * sd * (w / 2);
        this.batch.box(0.25, 0.55, d, qx, top + 0.27, qz, rot, m);
      }
      // door + windows on the front (+local z)
      const fx = Math.sin(rot), fz = Math.cos(rot);
      const gd = terrainHeight(x + fx * (d / 2), z + fz * (d / 2));
      this.batch.box(1.1, 2.1, 0.12, x + fx * (d / 2 + 0.02), gd + 1.05, z + fz * (d / 2 + 0.02), rot, 'woodDark');
      for (const sd of [-1, 1]) {
        this.batch.box(0.6, 0.7, 0.1, x + fx * (d / 2 + 0.02) + c * sd * (w / 3.2), gd + 2.3, z + fz * (d / 2 + 0.02) + s * sd * (w / 3.2), rot, 'dark');
      }
      if (rng() < 0.3) {
        // a little rooftop room or a cloth awning
        this.batch.box(w * 0.4, 2.2, d * 0.45, x - c * w * 0.2, top + 1.1, z - s * w * 0.2, rot, m);
      }
      this.physics.addBox(x, z, w / 2, d / 2, rot, top + 0.6);
      this.reserved.push({ x, z, r: Math.max(w, d) * 0.6 });
      this.houseList.push({ x, z, rot, w, d, top, door: { x: x + fx * (d / 2 + 1.2), z: z + fz * (d / 2 + 1.2) } });
      placed++;
    }
    // Outside the walls: a scattering of thatched village huts.
    for (let i = 0, n = 0; i < 1500 && n < 46; i++) {
      const a = rand(0, TAU), r = rand(R_OUTER + 25, WORLD_R - 25);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (ROAD.distance(x, z) < 10 || PROCESSION.distance(x, z) < 8 || Math.abs(Math.atan2(z, x)) < 0.12) continue;
      const cm = CONSTRUCTION.mid;
      if (Math.hypot(x - cm.x, z - cm.z) < 50 || Math.hypot(x - STABLE.x, z - STABLE.z) < 34) continue;
      if (this.reserved.some((c) => c.x !== undefined && Math.hypot(x - c.x, z - c.z) < c.r + 4)) continue;
      const g = minGround(x, z, 2.5);
      this.batch.add(GEO.cyl(2.4, 2.5, 2.6, 10), 'mud', x, g + 1.2, z);
      this.batch.add(GEO.cone(3.1, 2.6, 10), 'thatch', x, g + 3.7, z);
      this.physics.addCircle(x, z, 2.5, g + 4);
      this.reserved.push({ x, z, r: 4 });
      n++;
    }
  }

  scenery() {
    // ---- granite boulders: the Deccan's signature, heaped on the hill ----
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const p = rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      v.multiplyScalar(1 + (Math.sin(v.x * 4.1 + v.z * 2.3) + Math.cos(v.y * 3.7)) * 0.08);
      v.y *= 0.8;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    rockGeo.computeVertexNormals();
    const rocks = [];
    const tryRock = (x, z, s) => {
      if (ROAD.distance(x, z) < 4 + s || PROCESSION.distance(x, z) < 4 + s) return false;
      const rr = Math.hypot(x, z);
      if (Math.abs(rr - R_OUTER) < 9 + s || Math.abs(rr - R_CITADEL) < 5 + s) return false;
      if (rr < 30) return false;
      for (const c of this.reserved) if (c.x !== undefined && Math.hypot(x - c.x, z - c.z) < c.r + s) return false;
      if (x > BAZAAR.x0 - 16 && x < BAZAAR.x1 + 16 && Math.abs(z) < 24) return false;
      if (Math.hypot(x - DANCE.x, z - DANCE.z) < 22) return false;
      if (Math.hypot(x - STABLE.x, z - STABLE.z) < 34) return false;
      if (Math.abs(rr - R_MIDDLE) < 8 + s) return false;
      const cm = CONSTRUCTION.mid;
      if (Math.hypot(x - (cm.x + CONSTRUCTION.inward.x * 20), z - (cm.z + CONSTRUCTION.inward.z * 20)) < 38) return false;
      rocks.push({ x, z, s });
      if (s > 1.2) this.physics.addCircle(x, z, s * 0.9, terrainHeight(x, z) + s * 1.4);
      return true;
    };
    for (let i = 0, n = 0; i < 4000 && n < 340; i++) {
      const a = rand(0, TAU);
      const r = rng() < 0.6 ? rand(30, 113) : rand(R_OUTER + 12, WORLD_R + 20);
      const s = r < 115 ? rand(0.6, 3.2) : rand(0.6, 4.2);
      if (tryRock(Math.cos(a) * r, Math.sin(a) * r, s)) n++;
      // cluster companions
      if (rng() < 0.4 && rocks.length) {
        const b = rocks[rocks.length - 1];
        tryRock(b.x + rand(-3, 3) * b.s * 0.6, b.z + rand(-3, 3) * b.s * 0.6, b.s * rand(0.4, 0.8));
      }
    }
    // a couple of the famous balancing-rock stacks outside the walls
    for (const [x, z] of [[300, -110], [-230, 140], [60, -290], [-180, -240], [300, 150], [-330, -20], [140, 330]]) {
      rocks.push({ x, z, s: 4.5 }, { x: x + 0.8, z: z - 0.3, s: 3.0, lift: 6.5 }, { x: x - 0.4, z: z + 0.5, s: 2.0, lift: 10.6 });
      this.physics.addCircle(x, z, 4.4, terrainHeight(x, z) + 14);
    }
    const rockMesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), rocks.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    rocks.forEach((r, i) => {
      const y = terrainHeight(r.x, r.z) + (r.lift ?? r.s * 0.35);
      q.setFromEuler(e.set(rand(-0.2, 0.2), rand(0, TAU), rand(-0.2, 0.2)));
      m.compose(new THREE.Vector3(r.x, y, r.z), q, new THREE.Vector3(r.s * rand(1, 1.4), r.s * rand(0.8, 1.1), r.s * rand(0.9, 1.3)));
      rockMesh.setMatrixAt(i, m);
      col.set(pick(['#8f877d', '#9a8d80', '#857c72', '#a3968a', '#8a7f76'])).multiplyScalar(rand(0.9, 1.1));
      rockMesh.setColorAt(i, col);
    });
    rockMesh.castShadow = rockMesh.receiveShadow = true;
    this.scene.add(rockMesh);

    // ---- trees: neem, tamarind and banyan-ish canopies ----
    const trees = [];
    for (let i = 0, n = 0; i < 6000 && n < 300; i++) {
      const a = rand(0, TAU), r = rng() < 0.45 ? rand(R_CITADEL + 10, R_OUTER - 10) : rand(R_OUTER + 10, WORLD_R + 30);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (terrainHeight(x, z) > 30) continue;
      if (r < R_OUTER && !this.isFree(x, z, 2.5)) continue;
      if (r >= R_OUTER && (ROAD.distance(x, z) < 6 || PROCESSION.distance(x, z) < 5 || Math.abs(r - R_OUTER) < 12)) continue;
      if (Math.hypot(x - STABLE.x, z - STABLE.z) < 34) continue;
      { const cm = CONSTRUCTION.mid; if (Math.hypot(x - cm.x, z - cm.z) < 45) continue; }
      if (r >= R_OUTER && this.reserved.some((c) => c.x !== undefined && Math.hypot(x - c.x, z - c.z) < c.r + 2)) continue;
      trees.push({ x, z, s: rand(0.8, 1.5), kind: rng() < 0.15 ? 'palm' : 'broad' });
      this.reserved.push({ x, z, r: 2.5 });
      n++;
    }
    // a few shade trees around the bazaar and dance court
    for (const [x, z] of [[126, 18], [172, -16], [104, -66], [140, -86], [118, 24], [168, 20]]) trees.push({ x, z, s: 1.5, kind: 'broad' });
    const broad = trees.filter((t) => t.kind === 'broad');
    const palms = trees.filter((t) => t.kind === 'palm');
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: '#5b4330' }), trees.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), broad.length * 3);
    const fronds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 3.2, 4), new THREE.MeshLambertMaterial({ color: '#4f7a2a', side: THREE.DoubleSide }), palms.length * 7);
    let ci = 0, fi = 0;
    trees.forEach((t, i) => {
      const y = terrainHeight(t.x, t.z) - 0.2;
      const th = t.kind === 'palm' ? 8 * t.s : 3.2 * t.s;
      m.compose(new THREE.Vector3(t.x, y, t.z), q.identity(), new THREE.Vector3(t.s * (t.kind === 'palm' ? 0.6 : 1), th, t.s * (t.kind === 'palm' ? 0.6 : 1)));
      trunks.setMatrixAt(i, m);
      this.physics.addCircle(t.x, t.z, 0.45 * t.s, y + th);
      if (t.kind === 'broad') {
        for (let k = 0; k < 3; k++) {
          const ox = rand(-1.2, 1.2) * t.s, oz = rand(-1.2, 1.2) * t.s;
          const cs = t.s * rand(1.6, 2.4);
          m.compose(new THREE.Vector3(t.x + ox, y + th + cs * 0.55 + k * 0.4, t.z + oz), q.setFromEuler(e.set(0, rand(0, 3), 0)), new THREE.Vector3(cs, cs * 0.75, cs));
          canopies.setMatrixAt(ci, m);
          col.set(pick(['#4f6f2c', '#5d7d32', '#466628', '#6b8a3a'])).multiplyScalar(rand(0.85, 1.1));
          canopies.setColorAt(ci++, col);
        }
      } else {
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * TAU;
          q.setFromEuler(e.set(Math.PI / 2 - 0.5, a, 0, 'YXZ'));
          m.compose(new THREE.Vector3(t.x + Math.sin(a) * 1.2, y + th, t.z + Math.cos(a) * 1.2), q, new THREE.Vector3(0.6, 1, 0.12));
          fronds.setMatrixAt(fi++, m);
        }
      }
    });
    for (const im of [trunks, canopies, fronds]) { im.castShadow = true; im.receiveShadow = true; this.scene.add(im); }
    this.trees = trees;
  }

  buildTorches() {
    this.torchGroup = new THREE.Group();
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ff8a2a', toneMapped: false });
    const flameGeo = new THREE.ConeGeometry(0.1, 0.34, 6);
    const flames = new THREE.InstancedMesh(flameGeo, flameMat, this.torches.length);
    const poles = new StaticBatch();
    const m = new THREE.Matrix4();
    this.torches.forEach((t, i) => {
      const g = terrainHeight(t.x, t.z);
      if (t.y - g > 3.5) {
        // wall bracket torch
        poles.add(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 5), 'iron', t.x, t.y - 0.4, t.z);
      } else {
        t.y = g + 2.4;
        poles.add(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 5), 'woodDark', t.x, g + 1.2, t.z);
      }
      poles.add(new THREE.CylinderGeometry(0.14, 0.08, 0.25, 6), 'iron', t.x, t.y, t.z);
      m.makeTranslation(t.x, t.y + 0.3, t.z);
      flames.setMatrixAt(i, m);
    });
    poles.build(this.scene);
    this.scene.add(flames);
    this.flames = flames;
    this.flameMat = flameMat;
  }

  update(dt, t, night) {
    for (const f of this.flags) {
      const p = f.geometry.attributes.position;
      if (!f.userData.base) f.userData.base = p.array.slice();
      const b = f.userData.base;
      for (let i = 0; i < p.count; i++) {
        const x = b[i * 3];
        p.setZ(i, Math.sin(x * 2.2 - t * 5 + f.position.x) * 0.15 * x * 0.5);
      }
      p.needsUpdate = true;
    }
    if (this.flames) {
      this.flames.visible = night > 0.05;
      const f = 0.85 + Math.sin(t * 17) * 0.08 + Math.sin(t * 31) * 0.07;
      this.flameMat.color.setRGB(1.6, 0.55 * f + 0.15, 0.08 * f);
    }
    void clamp;
  }
}
