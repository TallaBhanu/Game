// The new rampart: masons, a timber shear-leg crane, an earth ramp, porters
// with stones on their heads and a bullock team hauling granite.
import * as THREE from 'three';
import { CONSTRUCTION, WALL_H, WALL_T } from '../world/layout.js';
import { terrainHeight } from '../world/terrain.js';
import { granite } from '../core/textures.js';
import { MATERIALS, boxGeo } from '../world/builder.js';
import { Human, Ox, Props, part } from './characters.js';
import { rand, pick, clamp, lerp } from '../core/util.js';
import { yawTo, turnTowards } from './npc.js';

const COLS = 30, ROWS = 12;

const WORKER_LINES = [
  ['Heave! Each of these stones weighs more than a bullock.', 'The Sultan wants the wall finished before the monsoon.'],
  ['We cut the granite from the hill itself - there is no shortage of rock here.', 'Mind your head, friend. Stones fall.'],
  ['My grandfather built the old mud walls for the Kakatiya kings. Now I build them in stone.', 'Three annas a day and a meal of jowar roti. Not bad.'],
  ['The lime mortar is mixed with jaggery and egg white - it sets harder than the rock.', 'Out of the way! Stone coming up the ramp!'],
];
const OVERSEER_LINES = [
  'I am Mir Jumla\'s overseer for this stretch. Twelve courses high, four gaz thick - by royal order.',
  'When it is done, an elephant could not shake this wall. That is why the gates bear iron spikes, too.',
  'The Sultan himself comes to inspect our work. Make sure you bow when the procession passes.',
];

export class Construction {
  constructor(scene, physics, pop, audio) {
    this.scene = scene;
    this.physics = physics;
    this.pop = pop;
    this.audio = audio;
    const C = CONSTRUCTION;
    this.u = C.dir;
    this.n = C.inward;
    this.o = C.mid;
    let g = Infinity;
    for (let i = 0; i <= 10; i++) g = Math.min(g, terrainHeight(C.p0.x + (C.p1.x - C.p0.x) * (i / 10), C.p0.z + (C.p1.z - C.p0.z) * (i / 10)));
    this.base = g - 0.4;
    this.rot = Math.atan2(-this.u.z, this.u.x);
    this.bl = C.len / COLS;
    this.ch = (WALL_H + 0.6) / ROWS;
    this.placed = Math.floor(COLS * 5.4);
    this.placedByPlayerWatch = 0;
    this.animating = []; // {i, t}
    this.completeTimer = 0;
    this.build();
  }

  /** world position from local (u along wall, n inward, y) */
  W(u, n, y = null) {
    const x = this.o.x + this.u.x * u + this.n.x * n;
    const z = this.o.z + this.u.z * u + this.n.z * n;
    return { x, z, y: y ?? terrainHeight(x, z) };
  }

  blockPos(i) {
    const row = Math.floor(i / COLS), col = i % COLS;
    // alternate rows are offset by half a block, like real ashlar bond
    const u = -CONSTRUCTION.len / 2 + (col + 0.5) * this.bl;
    return { u, row, col, y: this.base + (row + 0.5) * this.ch };
  }

  build() {
    const tex = granite(21);
    tex.repeat.set(0.4, 0.2);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const geo = new THREE.BoxGeometry(this.bl * 0.97, this.ch * 0.94, WALL_T);
    this.blocks = new THREE.InstancedMesh(geo, mat, COLS * ROWS);
    this.blocks.castShadow = this.blocks.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.rot);
    const c = new THREE.Color();
    for (let i = 0; i < COLS * ROWS; i++) {
      const b = this.blockPos(i);
      const p = this.W(b.u, 0);
      m.compose(new THREE.Vector3(p.x, b.y, p.z), q, new THREE.Vector3(1, 1, 1));
      this.blocks.setMatrixAt(i, m);
      c.setHSL(0.08, 0.1, rand(0.78, 0.95));
      this.blocks.setColorAt(i, c);
    }
    this.blocks.count = this.placed;
    this.scene.add(this.blocks);
    this._q = q;
    // foundation trench below the blocks
    const found = new THREE.Mesh(boxGeo(CONSTRUCTION.len, 4, WALL_T + 0.6), MATERIALS.rubble);
    const fp = this.W(0, 0);
    found.position.set(fp.x, this.base - 2, fp.z);
    found.rotation.y = this.rot;
    this.scene.add(found);

    this.collider = this.physics.addBox(this.o.x, this.o.z, CONSTRUCTION.len / 2, WALL_T / 2, this.rot, this.topY(), this.base - 5);

    // ---- earth ramp up to the wall (walkable!) ----
    const rampU = -11, rampLen = 24, rampW = 5, rampTop = this.base + 6.2;
    this.ramp = { u: rampU, len: rampLen, top: rampTop };
    const rampGeo = new THREE.BoxGeometry(rampW, 1, rampLen, 1, 1, 8);
    const rp = rampGeo.attributes.position;
    const groundFar = terrainHeight(this.W(rampU, WALL_T / 2 + rampLen).x, this.W(rampU, WALL_T / 2 + rampLen).z);
    for (let i = 0; i < rp.count; i++) {
      const lz = rp.getZ(i); // +z toward wall
      const t = (lz + rampLen / 2) / rampLen;
      rp.setY(i, rp.getY(i) > 0 ? lerp(groundFar - 0.2, rampTop, t) : this.base - 1);
    }
    rampGeo.computeVertexNormals();
    const rampMesh = new THREE.Mesh(rampGeo, MATERIALS.earth);
    const rc = this.W(rampU, WALL_T / 2 + rampLen / 2);
    const rampRot = Math.atan2(-this.n.x, -this.n.z);
    rampMesh.position.set(rc.x, 0, rc.z);
    rampMesh.rotation.y = rampRot;
    rampMesh.receiveShadow = rampMesh.castShadow = true;
    this.scene.add(rampMesh);
    this.physics.addPlatform(rc.x, rc.z, rampW / 2, rampLen / 2, rampRot, groundFar - 0.2, rampTop);
    // a timber deck at the top of the ramp
    const deck = new THREE.Mesh(boxGeo(rampW + 1, 0.2, 2.2, 2), MATERIALS.wood);
    const dp = this.W(rampU, WALL_T / 2 + 0.9);
    deck.position.set(dp.x, rampTop + 0.05, dp.z);
    deck.rotation.y = this.rot;
    this.scene.add(deck);
    this.physics.addPlatform(dp.x, dp.z, (rampW + 1) / 2, 1.1, this.rot, rampTop + 0.15);
    this.stackAtTop = new THREE.Group();
    this.scene.add(this.stackAtTop);

    // ---- bamboo scaffolding on the inner face ----
    const poles = [];
    for (let u = -CONSTRUCTION.len / 2 + 1; u < CONSTRUCTION.len / 2; u += 3.2) {
      poles.push({ u, n: WALL_T / 2 + 1.0, vert: true });
      poles.push({ u, n: WALL_T / 2 + 2.4, vert: true });
    }
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.07, 1, 5);
    const pm = new THREE.InstancedMesh(poleGeo, MATERIALS.bamboo, poles.length + 40 * 6);
    let k = 0;
    const m4 = new THREE.Matrix4();
    for (const p of poles) {
      const w = this.W(p.u, p.n);
      m4.compose(new THREE.Vector3(w.x, this.base + 6, w.z), new THREE.Quaternion(), new THREE.Vector3(1, 13, 1));
      pm.setMatrixAt(k++, m4);
    }
    const hq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.rot, Math.PI / 2, 'YXZ'));
    for (let lvl = 1; lvl <= 5; lvl++)
      for (const nn of [WALL_T / 2 + 1.0, WALL_T / 2 + 2.4])
        for (let seg = 0; seg < 3; seg++) {
          const u = -CONSTRUCTION.len / 2 + (seg + 0.5) * (CONSTRUCTION.len / 3);
          const w = this.W(u, nn);
          m4.compose(new THREE.Vector3(w.x, this.base + lvl * 2.1, w.z), hq, new THREE.Vector3(1, CONSTRUCTION.len / 3, 1));
          pm.setMatrixAt(k++, m4);
        }
    pm.count = k;
    pm.castShadow = true;
    this.scene.add(pm);

    // ---- piles of rough and dressed stone ----
    const pile = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const p = this.W(rampU + rand(-4, 4), WALL_T / 2 + rampLen + rand(1, 5));
      const s = rand(0.5, 1.0);
      const b = part('box', '#9b9284', this.bl * 0.9 * s, this.ch * 0.9, 1.2 * s, p.x, p.y + this.ch * 0.45 + (i > 16 ? this.ch * 0.9 : 0), p.z, pile, MATERIALS.granite);
      b.rotation.y = this.rot + rand(-0.3, 0.3);
      b.receiveShadow = true;
    }
    this.pileTop = this.W(rampU, WALL_T / 2 + rampLen + 1);
    // dressing yard to the right with rough boulders
    this.yard = this.W(10, 22);
    for (let i = 0; i < 9; i++) {
      const p = this.W(10 + rand(-6, 6), 22 + rand(-4, 4));
      const s = rand(0.6, 1.3);
      const b = part('sphere', '#968b7e', s, s * 0.7, s * 1.1, p.x, p.y + s * 0.4, p.z, pile);
      b.rotation.y = rand(0, 3);
    }
    this.scene.add(pile);

    // ---- the shear-leg crane ----
    this.crane = new THREE.Group();
    const legs = new THREE.Group();
    this.crane.add(legs);
    for (const s of [-1, 1]) {
      const l = part('cyl', '#7a5a35', 0.14, 15, 0.14, s * 2.2, 7.2, 0, legs, MATERIALS.wood);
      l.rotation.z = -s * 0.14;
    }
    part('box', '#7a5a35', 1.4, 0.35, 0.35, 0, 14.6, 0, legs, MATERIALS.wood);
    part('cyl', '#5a4025', 0.3, 0.6, 0.3, 0, 14.4, 0, legs).rotation.z = Math.PI / 2;
    this.craneLegs = legs;
    this.rope = part('cyl', '#c9b48a', 0.03, 1, 0.03, 0, 0, 0, this.crane);
    this.hookStone = part('box', '#9b9284', this.bl * 0.95, this.ch * 0.92, WALL_T * 0.95, 0, 0, 0, this.crane, MATERIALS.granite);
    this.backRope = part('cyl', '#c9b48a', 0.03, 1, 0.03, 0, 0, 0, this.crane);
    this.scene.add(this.crane);
    this.craneU = this.blockPos(this.placed).u;
    this.craneT = 0;

    this.spawnWorkers(rampTop);
  }

  topY() {
    const rowsFull = Math.floor(this.placed / COLS);
    const partial = this.placed % COLS > 0 ? 1 : 0;
    return this.base + (rowsFull + partial) * this.ch;
  }

  spawnWorkers(rampTop) {
    const pop = this.pop;
    const worker = (extra = {}) =>
      new Human({ top: null, bottom: pick(['#efe6d2', '#e8dcc0', '#d9c9a5']), head: pick(['turban', 'turban', 'bald']), headColor: pick(['#f4efe2', '#e2b13c', '#c93a2a', '#e8e0cf']), ...extra });
    this.carriers = [];
    for (let i = 0; i < 7; i++) {
      const h = worker();
      const stone = Props.stoneBlock(0.5, 0.28, 0.4);
      stone.position.y = 0.24;
      h.attach(stone, 'head');
      h.stone = stone;
      h.loopT = i / 7;
      const p = this.W(this.ramp.u + rand(-1.5, 1.5), 10);
      pop.add(h, { x: p.x, z: p.z, role: 'worker', lines: pick(WORKER_LINES) });
      this.carriers.push(h);
    }
    // crane rope pullers (stand behind the crane)
    this.pullers = [];
    for (let i = 0; i < 4; i++) {
      const h = worker();
      h.pose = 'pull';
      pop.add(h, { role: 'worker', lines: pick(WORKER_LINES) });
      h.slot = i;
      this.pullers.push(h);
    }
    // masons working on top of the wall
    this.masons = [];
    for (let i = 0; i < 3; i++) {
      const h = worker({ head: 'turban' });
      h.pose = 'hammer';
      h.attach(Props.hammer(), 'handR');
      pop.add(h, { role: 'mason', lines: pick(WORKER_LINES) });
      h.slot = i;
      this.masons.push(h);
    }
    // stone dressers in the yard
    this.dressers = [];
    for (let i = 0; i < 3; i++) {
      const h = worker();
      h.pose = 'sitHammer';
      h.attach(Props.hammer(), 'handR');
      const p = this.W(6 + i * 3.5, 18 + (i % 2) * 2);
      pop.add(h, { x: p.x, z: p.z, yaw: rand(0, 6), role: 'mason', lines: pick(WORKER_LINES) });
      const b = part('box', '#9b9284', 1.0, 0.6, 0.7, 0, 0, 0, null, MATERIALS.granite);
      const bp = this.W(6 + i * 3.5 + Math.sin(h.root.rotation.y) * 0, 18 + (i % 2) * 2);
      b.position.set(bp.x + Math.sin(h.root.rotation.y) * 0.9, bp.y + 0.3, bp.z + Math.cos(h.root.rotation.y) * 0.9);
      b.rotation.y = h.root.rotation.y;
      this.scene.add(b);
      this.dressers.push(h);
    }
    // two men levering a boulder
    const lp = this.W(16, 26);
    this.leverStone = part('sphere', '#968b7e', 1.3, 0.95, 1.5, lp.x, lp.y + 0.8, lp.z, this.scene);
    this.levers = [];
    for (let i = 0; i < 2; i++) {
      const h = worker();
      h.pose = 'pull';
      const a = i === 0 ? 0.4 : -0.4;
      const x = lp.x + Math.sin(this.rot + Math.PI / 2 + a) * 3.2, z = lp.z + Math.cos(this.rot + Math.PI / 2 + a) * 3.2;
      pop.add(h, { x, z, yaw: yawTo(lp.x - x, lp.z - z), role: 'worker', lines: pick(WORKER_LINES) });
      const pole = part('cyl', '#7a5a35', 0.06, 3.4, 0.06, 0, 0, 0, null, MATERIALS.wood);
      pole.position.set((x + lp.x) / 2, lp.y + 0.9, (z + lp.z) / 2);
      pole.lookAt(lp.x, lp.y + 0.3, lp.z);
      pole.rotateX(Math.PI / 2);
      this.scene.add(pole);
      this.levers.push(h);
    }
    // overseer
    const op = this.W(-2, 16);
    this.overseer = new Human({ top: '#f2ead8', sleeves: true, longSleeves: true, robe: '#efe3c8', sash: '#c9472b', head: 'pagri', headColor: '#c93a2a', beard: true });
    this.overseer.pose = 'talk';
    const staff = part('cyl', '#5a3d22', 0.025, 1.6, 0.025, 0, -0.1, 0);
    this.overseer.attach(staff, 'handR');
    pop.add(this.overseer, { x: op.x, z: op.z, yaw: yawTo(-this.n.x, -this.n.z), role: 'overseer', lines: OVERSEER_LINES, name: 'The Overseer' });
    // water bearer
    this.waterGirl = new Human({ female: true, top: '#c9472b', skirt: '#e0a526', sleeves: true, head: 'veil', headColor: '#e0a526', bangles: true, scale: 0.9 });
    this.waterGirl.pose = 'carryHead';
    const pot = Props.pot('#b8673a');
    pot.position.y = 0.2;
    this.waterGirl.attach(pot, 'head');
    const wp = this.W(0, 26);
    pop.add(this.waterGirl, { x: wp.x, z: wp.z, role: 'water', lines: ['Water for the workers! It is hot work under this sun.', 'I carry water from the step tank, up and down all day.'] });
    this.waterTarget = null;
    // ox team
    this.oxGroup = new THREE.Group();
    const ox1 = new Ox('#ece6da'), ox2 = new Ox('#d9d0c0');
    ox1.root.position.x = 0.55; ox2.root.position.x = -0.55;
    this.oxGroup.add(ox1.root, ox2.root);
    this.oxen = [ox1, ox2];
    part('cyl', '#6b4a2a', 0.05, 1.6, 0.05, 0, 1.25, 0.95, this.oxGroup).rotation.z = Math.PI / 2;
    this.sledge = new THREE.Group();
    part('box', '#6b4a2a', 1.4, 0.15, 2.2, 0, 0.2, -2.2, this.sledge, MATERIALS.wood);
    this.sledgeStone = part('box', '#9b9284', 1.6, 0.9, 1.3, 0, 0.75, -2.2, this.sledge, MATERIALS.granite);
    for (const s of [-1, 1]) part('cyl', '#c9b48a', 0.02, 2.4, 0.02, s * 0.5, 0.9, -0.8, this.sledge).rotation.x = Math.PI / 2 - 0.15;
    this.oxGroup.add(this.sledge);
    this.scene.add(this.oxGroup);
    this.oxDriver = worker({ top: '#e0a526' });
    this.oxDriver.pose = 'holdStaff';
    this.oxDriver.attach(part('cyl', '#5a3d22', 0.02, 1.8, 0.02, 0, 0.05, 0.3), 'handR').rotation.x = 1.5;
    pop.add(this.oxDriver, { role: 'worker', lines: ['Hai! Hai! Move, Nandi!', 'These two can haul a stone that forty men could not.'] });
    this.oxT = 0;
    this.oxA = this.W(18, 40);
    this.oxB = this.W(12, 8);
  }

  placeBlock() {
    if (this.placed >= COLS * ROWS) return;
    this.animating.push({ i: this.placed, t: 0 });
    this.placed++;
    this.blocks.count = this.placed;
    this.collider.top = this.topY();
    this.justPlaced = true;
  }

  update(dt, time, playerPos) {
    const pop = this.pop;
    this.justPlaced = false;
    // animate freshly placed blocks dropping into place
    const m = new THREE.Matrix4();
    for (let k = this.animating.length - 1; k >= 0; k--) {
      const a = this.animating[k];
      a.t += dt / 0.7;
      const b = this.blockPos(a.i);
      const p = this.W(b.u, 0);
      const drop = Math.max(0, 1 - a.t);
      m.compose(new THREE.Vector3(p.x, b.y + drop * drop * 1.5, p.z), this._q, new THREE.Vector3(1, 1, 1));
      this.blocks.setMatrixAt(a.i, m);
      this.blocks.instanceMatrix.needsUpdate = true;
      if (a.t >= 1) this.animating.splice(k, 1);
    }
    if (this.placed >= COLS * ROWS) {
      this.completeTimer += dt;
      const far = Math.hypot(playerPos.x - this.o.x, playerPos.z - this.o.z) > 120;
      if (this.completeTimer > 90 && far) {
        // a new day, a new stretch: start again from the stepped base
        this.placed = Math.floor(COLS * 5.4);
        this.blocks.count = this.placed;
        this.collider.top = this.topY();
        this.completeTimer = 0;
      }
    }
    const frontier = this.blockPos(Math.min(this.placed, COLS * ROWS - 1));
    const topY = this.base + frontier.row * this.ch;

    // ---- crane cycle: 0-0.45 hoist, 0.45-0.65 swing, 0.65-0.85 lower, 0.85-1 return
    this.craneU += clamp(frontier.u - this.craneU, -dt * 1.5, dt * 1.5);
    const CYCLE = 9;
    const prevT = this.craneT;
    this.craneT = (this.craneT + dt / CYCLE) % 1;
    const ct = this.craneT;
    if (prevT < 0.85 && ct >= 0.85) this.placeBlock();
    const cb = this.W(this.craneU, WALL_T / 2 + 4.2);
    this.crane.position.set(cb.x, cb.y, cb.z);
    this.crane.rotation.y = this.rot;
    // lean toward the wall during swing
    let lean = 0;
    if (ct > 0.45 && ct < 0.65) lean = (ct - 0.45) / 0.2;
    else if (ct >= 0.65 && ct < 0.85) lean = 1;
    else if (ct >= 0.85) lean = 1 - (ct - 0.85) / 0.15;
    lean = lean * lean * (3 - 2 * lean);
    this.craneLegs.rotation.x = -0.12 - lean * 0.22;
    const tipZ = Math.sin(0.12 + lean * 0.22) * 14.6 * 1; // horizontal reach toward wall (-z local)
    const tipY = Math.cos(0.12 + lean * 0.22) * 14.6;
    const groundLocal = 0.5;
    const wallTopLocal = topY - cb.y + this.ch * 0.5 + 0.1;
    let hookY;
    if (ct < 0.45) hookY = lerp(groundLocal, wallTopLocal + 1.6, ct / 0.45);
    else if (ct < 0.65) hookY = wallTopLocal + 1.6;
    else if (ct < 0.85) hookY = lerp(wallTopLocal + 1.6, wallTopLocal, (ct - 0.65) / 0.2);
    else hookY = lerp(wallTopLocal + 1.0, groundLocal + 1, (ct - 0.85) / 0.15);
    const hookZ = -tipZ; // local -z points toward wall? (crane local +z is along -n... see below)
    // crane local axes: x along wall, z = inward. Tip leans toward wall => negative z.
    this.hookStone.visible = ct < 0.85;
    this.hookStone.position.set(0, hookY, hookZ);
    const ropeLen = tipY - hookY - 0.4;
    this.rope.scale.set(0.035, Math.max(0.1, ropeLen), 0.035);
    this.rope.position.set(0, hookY + 0.4 + ropeLen / 2, hookZ);
    // haul rope to the pullers
    const pullAnchor = { z: 9, y: 1.1 };
    const dz = pullAnchor.z - hookZ, dy = pullAnchor.y - tipY;
    const L = Math.hypot(dz, dy);
    this.backRope.scale.set(0.035, L, 0.035);
    this.backRope.position.set(0, (tipY + pullAnchor.y) / 2, (hookZ + pullAnchor.z) / 2);
    this.backRope.rotation.x = Math.atan2(dz, dy);
    const hauling = ct < 0.45;
    for (const h of this.pullers) {
      const w = this.W(this.craneU + (h.slot % 2 ? 0.5 : -0.5), WALL_T / 2 + 4.2 + 8 + h.slot * 1.1);
      const back = hauling ? (ct / 0.45) * 1.2 : 0;
      const tw = this.W(this.craneU + (h.slot % 2 ? 0.5 : -0.5), WALL_T / 2 + 4.2 + 8 + h.slot * 1.1 + back);
      h.root.position.set(tw.x, tw.y, tw.z);
      h.speed = hauling ? 0.4 : 0;
      h.pose = hauling ? 'pull' : 'idle';
      h.root.rotation.y = yawTo(-this.n.x, -this.n.z);
      void w;
    }

    // ---- masons on top of the wall near the frontier ----
    this.masons.forEach((h, i) => {
      const u = clamp(frontier.u - 2 - i * 2.4, -CONSTRUCTION.len / 2 + 1, CONSTRUCTION.len / 2 - 1);
      const p = this.W(u, (i - 1) * 0.9);
      const behind = frontier.col - 2 - i * 1.5;
      const y = this.base + Math.max(1, frontier.row + (behind > 0 ? 1 : 0)) * this.ch;
      const r = h.root.position;
      r.x += (p.x - r.x) * Math.min(1, dt * 2);
      r.z += (p.z - r.z) * Math.min(1, dt * 2);
      r.y += (y - r.y) * Math.min(1, dt * 3);
      h.root.rotation.y = yawTo(this.u.x, this.u.z);
      if (h.hammerHit && Math.random() < 0.6) this.audio?.clink(r);
    });
    for (const h of this.dressers) if (h.hammerHit && Math.random() < 0.5) this.audio?.clink(h.root.position);

    // ---- porters: pile -> up the ramp -> deck -> back ----
    const LOOP = 40;
    for (const h of this.carriers) {
      h.loopT = (h.loopT + dt / LOOP) % 1;
      const t = h.loopT;
      const side = (this.carriers.indexOf(h) % 2 ? 0.8 : -0.8);
      let n, carrying;
      if (t < 0.45) { n = lerp(WALL_T / 2 + this.ramp.len + 1.5, WALL_T / 2 + 1.0, t / 0.45); carrying = true; }
      else if (t < 0.52) { n = WALL_T / 2 + 1.0; carrying = t < 0.48; }
      else if (t < 0.95) { n = lerp(WALL_T / 2 + 1.0, WALL_T / 2 + this.ramp.len + 1.5, (t - 0.52) / 0.43); carrying = false; }
      else { n = WALL_T / 2 + this.ramp.len + 1.5; carrying = t > 0.98; }
      if (h.wasCarrying && !carrying && t > 0.45 && t < 0.6) {
        // a stone delivered helps the masons
        if (Math.random() < 0.55) this.placeBlock();
      }
      h.wasCarrying = carrying;
      h.stone.visible = carrying;
      h.pose = carrying ? 'carryHead' : 'idle';
      const p = this.W(this.ramp.u + side, n);
      const r = h.root.position;
      const dx = p.x - r.x, dz = p.z - r.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.02) turnTowards(h.root, yawTo(dx, dz), dt, 6);
      h.speed = d / dt > 0.2 ? 1.0 : 0;
      r.x = p.x; r.z = p.z;
      r.y = this.physics.groundAt(r.x, r.z, r.y + 0.5);
    }

    // ---- lever team rocks the boulder ----
    const rock = Math.sin(time * 1.6);
    this.leverStone.rotation.z = rock * 0.06;
    this.levers.forEach((h, i) => (h.speed = 0, h.torso.rotation.x = -0.3 + rock * (i ? -0.15 : 0.15)));

    // ---- ox team: haul a block from the quarry edge to the crane, return empty
    const OXC = 70;
    this.oxT = (this.oxT + dt / OXC) % 1;
    const ot = this.oxT;
    let f, loaded;
    if (ot < 0.45) { f = ot / 0.45; loaded = true; }
    else if (ot < 0.5) { f = 1; loaded = true; }
    else if (ot < 0.95) { f = 1 - (ot - 0.5) / 0.45; loaded = false; }
    else { f = 0; loaded = false; }
    const ox = lerp(this.oxA.x, this.oxB.x, f), oz = lerp(this.oxA.z, this.oxB.z, f);
    const moving = (ot < 0.45) || (ot > 0.5 && ot < 0.95);
    const dirSign = ot < 0.5 ? 1 : -1;
    const yaw = yawTo((this.oxB.x - this.oxA.x) * dirSign, (this.oxB.z - this.oxA.z) * dirSign);
    this.oxGroup.position.set(ox, terrainHeight(ox, oz), oz);
    turnTowards(this.oxGroup, yaw, dt, 1.5);
    this.sledgeStone.visible = loaded;
    for (const o of this.oxen) { o.speed = moving ? 0.9 : 0; o.update(dt); }
    const dsx = Math.sin(this.oxGroup.rotation.y), dsz = Math.cos(this.oxGroup.rotation.y);
    const dr = this.oxDriver.root.position;
    dr.set(ox + dsz * 1.6, 0, oz - dsx * 1.6);
    this.oxDriver.root.rotation.y = this.oxGroup.rotation.y;
    this.oxDriver.speed = moving ? 0.9 : 0;
    pop.ground(this.oxDriver);

    // ---- water bearer wanders between workers ----
    const wg = this.waterGirl;
    if (!this.waterTarget || this.waterWait > 0) {
      this.waterWait = (this.waterWait || 0) - dt;
      wg.speed = 0;
      if (this.waterWait <= 0) {
        const tgt = pick([...this.dressers, this.overseer, ...this.levers]);
        const tp = tgt.root.position;
        this.waterTarget = { x: tp.x + rand(-1.5, 1.5), z: tp.z + rand(-1.5, 1.5) };
        this.waterWait = 0;
      }
    } else if (pop.walkTo(wg, this.waterTarget.x, this.waterTarget.z, 1.1, dt, { arrive: 1.2 })) {
      this.waterWait = rand(4, 9);
      this.waterTarget = null;
    }

    // overseer faces the player when nearby, else the wall
    const ov = this.overseer.root.position;
    if (Math.hypot(playerPos.x - ov.x, playerPos.z - ov.z) < 6) turnTowards(this.overseer.root, yawTo(playerPos.x - ov.x, playerPos.z - ov.z), dt, 4);
    else turnTowards(this.overseer.root, yawTo(-this.n.x, -this.n.z), dt, 2);
  }

  get progress() { return this.placed / (COLS * ROWS); }
}
