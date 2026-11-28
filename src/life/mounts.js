// Horses and bullock carts you can ride, plus traffic on the roads.
import * as THREE from 'three';
import { Human, part, mat, draftBull } from './characters.js';
import { MATERIALS } from '../world/builder.js';
import { ROAD, R_OUTER, PALACE, BAZAAR, TANK } from '../world/layout.js';
import { clamp, lerp, rand, pick } from '../core/util.js';
import { turnTowards, yawTo } from './npc.js';
import { spawn, ASSETS } from './assets.js';

const COATS = ['#8a5a36', '#5a3a24', '#d8cfc0', '#3a2a20', '#a8774a', '#f2ece2'];

class Mount {
  constructor(kind) {
    this.kind = kind;
    this.root = new THREE.Group();
    this.yaw = 0;
    this.speed = 0;
    this.pitch = 0;
    this.rider = null;    // the player, when ridden
    this.npc = null;      // an NPC driver/rider
    this.seat = new THREE.Object3D();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.body.add(this.seat);
  }
  get pos() { return this.root.position; }
  place(physics, x, z, yaw) {
    this.root.position.set(x, physics.groundAt(x, z), z);
    this.yaw = yaw;
    this.root.rotation.y = yaw;
  }
  /** Shared movement: speed along heading with slope + collision handling. */
  drive(dt, physics, others) {
    const p = this.root.position;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const nx = p.x + fx * this.speed * dt, nz = p.z + fz * this.speed * dt;
    const gNow = p.y;
    const g = physics.groundAt(nx, nz, gNow);
    if (g - gNow > 0.75) { this.speed *= -0.2; return; }
    p.x = nx; p.z = nz;
    const before = { x: p.x, z: p.z };
    physics.resolve(p, this.radius, gNow + 0.3, gNow + 2.2);
    if (Math.hypot(p.x - before.x, p.z - before.z) > 0.01) this.speed *= 0.9;
    for (const a of others) {
      if (a === this) continue;
      const r = a.root.position;
      const dx = p.x - r.x, dz = p.z - r.z;
      const min = this.radius + (a.radius || 0.35) * 0.8;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6 && Math.abs(r.y - p.y) < 2) {
        const d = Math.sqrt(d2);
        p.x = r.x + (dx / d) * min; p.z = r.z + (dz / d) * min;
        this.speed *= 0.85;
      }
    }
    const rr = Math.hypot(p.x, p.z);
    if (rr > 468) { p.x *= 468 / rr; p.z *= 468 / rr; this.speed *= 0.5; }
    p.y = physics.groundAt(p.x, p.z, gNow + 0.3);
    // pitch to the slope
    const L = this.length / 2;
    const hf = physics.groundAt(p.x + fx * L, p.z + fz * L, p.y + 1);
    const hb = physics.groundAt(p.x - fx * L, p.z - fz * L, p.y + 1);
    this.pitch = lerp(this.pitch, Math.atan2(hb - hf, L * 2), Math.min(1, dt * 6));
    this.root.rotation.set(0, this.yaw, 0);
    this.body.rotation.x = this.pitch;
  }
}

export class Horse extends Mount {
  constructor(gltf, coat) {
    super('horse');
    this.radius = 0.85;
    this.length = 2.4;
    this.maxSpeed = 15;
    this.label = 'horse';
    if (ASSETS.horse) {
      this.real = spawn('horse', { tint: coat === '#f2ece2' || coat === '#d8cfc0' ? null : null });
      this.body.add(this.real.root);
      this.real.play('idle', 0);
      this.real.mixer.update(Math.random() * 5);
    } else if (gltf) {
      const src = gltf.scene.getObjectByProperty('type', 'Mesh');
      if (!src.geometry.attributes.normal) src.geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(src.geometry, new THREE.MeshStandardMaterial({ vertexColors: true, color: coat, roughness: 0.55, metalness: 0, flatShading: true }));
      mesh.name = src.name;
      mesh.morphTargetInfluences = src.morphTargetInfluences.slice();
      mesh.morphTargetDictionary = src.morphTargetDictionary;
      mesh.scale.setScalar(0.0118);
      mesh.castShadow = true;
      this.body.add(mesh);
      this.mixer = new THREE.AnimationMixer(mesh);
      this.action = this.mixer.clipAction(gltf.animations[0]);
      this.action.play();
      this.action.time = rand(0, this.action.getClip().duration);
    } else {
      part('sphere', coat, 0.45, 0.55, 1.1, 0, 1.4, 0, this.body);
    }
    // saddle and a woven saddle-cloth
    const sy = this.real ? 1.52 : 1.73, sz = this.real ? 0.05 : -0.12;
    this.saddle = new THREE.Group();
    this.body.add(this.saddle);
    part('rbox', '#4a2614', 0.42, 0.12, 0.56, 0, sy, sz, this.saddle, mat('#4a2614', { roughness: 0.45 }));
    part('rbox', '#4a2614', 0.3, 0.1, 0.08, 0, sy + 0.1, sz + 0.26, this.saddle, mat('#4a2614', { roughness: 0.45 }));
    const cloth = part('rbox', pick(['#9c1b25', '#2f6f8f', '#2a7a3b', '#7a1c4f']), 0.82, 0.04, 0.78, 0, sy - 0.07, sz, this.saddle);
    cloth.rotation.x = 0.03;
    for (const s of [-1, 1]) part('rbox', '#e0b84a', 0.02, 0.32, 0.6, s * 0.41, sy - 0.22, sz, this.saddle, mat('#e0b84a', { roughness: 0.4, metalness: 0.6 }));
    this.seat.position.set(0, sy + 0.04, sz);
  }
  update(dt) {
    if (this.real) {
      const s = Math.abs(this.speed);
      if (s < 0.3) this.real.play('idle', 0.4);
      else if (s < 7.5) this.real.play('trot', 0.3, clamp(s / 4.2, 0.35, 1.5));
      else this.real.play('gallop', 0.3, clamp(s / 12, 0.7, 1.4));
      this.real.mixer.update(dt);
      // the saddle rides the horse's back
      const bob = s < 0.3 ? 0 : Math.abs(Math.sin(this.real.mixer.time * (s < 7.5 ? 6.5 : 9))) * (s < 7.5 ? 0.06 : 0.1);
      this.saddle.position.y = bob; this.seat.position.y = (this.seatBase ??= this.seat.position.y) + bob;
      return;
    }
    if (this.mixer) {
      const s = Math.abs(this.speed);
      this.action.timeScale = s < 0.2 ? 0 : clamp(0.35 + s / 11, 0.35, 1.35);
      this.mixer.update(dt);
    }
  }
}

function wheel(radius) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 6, 22), MATERIALS.woodDark);
  rim.castShadow = true;
  g.add(rim);
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, radius * 2, 5), MATERIALS.wood);
    sp.rotation.z = (i / 8) * Math.PI;
    g.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 10), MATERIALS.woodDark);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

export class BullockCart extends Mount {
  constructor({ canopy = true, load = null } = {}) {
    super('cart');
    this.radius = 1.5;
    this.length = 4.6;
    this.maxSpeed = 3.4;
    this.label = 'bullock cart';
    const B = this.body;
    // bed
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 2.2), MATERIALS.wood);
    bed.position.set(0, 1.0, -1.0);
    bed.castShadow = bed.receiveShadow = true;
    B.add(bed);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 2.2), MATERIALS.wood);
      rail.position.set(s * 0.74, 1.2, -1.0);
      B.add(rail);
    }
    // shaft / yoke to the oxen
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.8, 6), MATERIALS.wood);
    shaft.rotation.x = Math.PI / 2 - 0.12;
    shaft.position.set(0, 1.05, 0.9);
    B.add(shaft);
    const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), MATERIALS.woodDark);
    yoke.rotation.z = Math.PI / 2;
    yoke.position.set(0, 1.25, 2.15);
    B.add(yoke);
    this.wheels = [];
    for (const s of [-1, 1]) {
      const w = wheel(0.62);
      w.position.set(s * 0.88, 0.62, -1.0);
      w.rotation.y = Math.PI / 2;
      B.add(w);
      this.wheels.push(w);
    }
    if (canopy) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.9, 12, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: '#c9a86a', side: THREE.DoubleSide, roughness: 1 }));
      c.rotation.x = Math.PI / 2;
      c.rotation.y = Math.PI / 2;
      c.position.set(0, 1.35, -1.3);
      c.castShadow = true;
      B.add(c);
    }
    if (load === 'stone') part('rbox', '#9b9284', 1.1, 0.6, 1.3, 0, 1.37, -1.1, B, MATERIALS.granite);
    if (load === 'sacks') for (let i = 0; i < 4; i++) part('sphere', '#c9b48a', 0.3, 0.24, 0.42, (i % 2 ? 0.3 : -0.3), 1.3 + (i > 1 ? 0.3 : 0), -1.2 + (i % 2) * 0.2, B);
    this.oxen = [draftBull(pick(['#ece6da', '#d9d0c0', '#bfb5a5'])), draftBull(pick(['#ece6da', '#d9d0c0', '#8a7a6a']))];
    this.oxen.forEach((o, i) => { o.root.position.set(i ? -0.5 : 0.5, 0, o.real ? 2.55 : 2.3); B.add(o.root); });
    this.seat.position.set(0, 1.08, 0.2);
  }
  update(dt) {
    for (const w of this.wheels) w.rotation.x -= (this.speed / 0.62) * dt;
    for (const o of this.oxen) { o.speed = Math.abs(this.speed) * 0.9; o.update(dt); }
  }
}

export class Mounts {
  constructor(scene, physics, pop, audio, fort, gltf) {
    this.scene = scene;
    this.physics = physics;
    this.audio = audio;
    this.list = [];
    this.traffic = [];
    this.drivers = [];
    const addHorse = (x, z, yaw) => {
      const h = new Horse(gltf, pick(COATS));
      h.place(physics, x, z, yaw);
      scene.add(h.root);
      this.list.push(h);
      return h;
    };
    const addCart = (x, z, yaw, opts) => {
      const c = new BullockCart(opts);
      c.place(physics, x, z, yaw);
      scene.add(c.root);
      this.list.push(c);
      return c;
    };
    for (const s of fort.horseSpots) addHorse(s.x, s.z, s.yaw);
    addHorse(PALACE.x + 10, PALACE.z - 24, 0);
    addHorse(PALACE.x - 8, PALACE.z - 26, 0.4);
    addHorse(132, 18, Math.PI / 2);
    this.playerHorse = addHorse(440, 3, -Math.PI / 2);
    for (const s of fort.cartSpots) addCart(s.x, s.z, s.yaw, { load: 'sacks' });
    addCart(BAZAAR.x1 + 4, 14, Math.PI, { load: 'sacks' });
    addCart(TANK.x + 18, TANK.z + 6, 0.5, {});

    // ---- traffic: carts on the Bhagnagar road, horsemen patrolling outside the walls
    const driver = (pose) => {
      const h = new Human({ top: pick(['#f2ead8', null, '#e0a526']), bottom: '#efe6d2', head: 'turban', headColor: pick(['#f4efe2', '#e2b13c', '#c93a2a']) });
      h.pose = pose;
      scene.add(h.root);
      this.drivers.push(h);
      return h;
    };
    const roadEnd = ROAD.cum[4]; // up to the bazaar
    for (let i = 0; i < 3; i++) {
      const c = addCart(0, 0, 0, { load: i === 1 ? 'stone' : 'sacks', canopy: i !== 1 });
      c.npc = driver('sit');
      c.route = { kind: 'road', s: rand(10, roadEnd - 10), dir: i % 2 ? 1 : -1, end: roadEnd, lat: 2.6 };
      this.traffic.push(c);
    }
    for (let i = 0; i < 3; i++) {
      const h = addHorse(0, 0, 0);
      const rider = driver('ride');
      rider.opts.head = 'helmet';
      h.npc = rider;
      h.route = { kind: 'ring', a: (i / 3) * Math.PI * 2, r: R_OUTER + 24 + i * 6, speed: rand(4.5, 7) };
      this.traffic.push(h);
    }
    this.hoofT = 0;
  }

  nearest(p, maxD = 3.4) {
    let best = null, bd = maxD;
    for (const m of this.list) {
      if (m.npc || m.rider) continue;
      const d = Math.hypot(m.pos.x - p.x, m.pos.z - p.z);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  update(dt, camPos, others, player) {
    const tmp = {};
    for (const m of this.traffic) {
      const p = m.pos;
      if (m.route.kind === 'road') {
        const r = m.route;
        // stop if the player blocks the way
        let block = false;
        if (player) {
          const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
          const dx = player.x - p.x, dz = player.z - p.z;
          const ahead = dx * fx + dz * fz;
          block = ahead > 0 && ahead < 5 && Math.abs(dx * fz - dz * fx) < 1.6;
        }
        const sp = block ? 0 : 2.2;
        m.speed = lerp(m.speed, sp, Math.min(1, dt * 2));
        r.s += r.dir * m.speed * dt;
        if (r.s < 2 || r.s > r.end) { r.dir *= -1; r.s = clamp(r.s, 2, r.end); }
        ROAD.at(r.s, tmp);
        const nx = -tmp.dz * r.dir, nz = tmp.dx * r.dir;
        const x = tmp.x + nx * r.lat, z = tmp.z + nz * r.lat;
        const want = yawTo(x - p.x, z - p.z);
        if (Math.hypot(x - p.x, z - p.z) > 0.01) { const o = { rotation: { y: m.yaw } }; turnTowards(o, want, dt, 3); m.yaw = o.rotation.y; }
        p.x = x; p.z = z;
        p.y = this.physics.groundAt(x, z, p.y + 0.4);
        m.root.rotation.y = m.yaw;
      } else {
        const r = m.route;
        r.a += (r.speed / r.r) * dt;
        const x = Math.cos(r.a) * r.r, z = Math.sin(r.a) * r.r;
        m.yaw = yawTo(-Math.sin(r.a), Math.cos(r.a));
        p.set(x, this.physics.groundAt(x, z), z);
        m.speed = r.speed;
        m.root.rotation.y = m.yaw;
      }
    }
    for (const m of this.list) {
      const d2 = (m.pos.x - camPos.x) ** 2 + (m.pos.z - camPos.z) ** 2;
      m.root.visible = d2 < 220 * 220;
      if (m.root.visible) m.update(dt);
      if (m.npc) {
        m.seat.updateWorldMatrix(true, false);
        m.seat.getWorldPosition(m.npc.root.position);
        m.npc.root.rotation.y = m.yaw;
        m.npc.rideBounce = m.speed / 6;
        m.npc.root.visible = m.root.visible;
        if (m.root.visible) m.npc.update(dt);
      }
    }
    void others;
  }

  /** Called each frame while the player rides `m`. */
  ride(m, dt, input, others) {
    let throttle = 0, steer = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) throttle += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) throttle -= 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) steer += 1;
    if (input.down('KeyD') || input.down('ArrowRight')) steer -= 1;
    throttle -= input.touchMove.y; steer -= input.touchMove.x;
    throttle = clamp(throttle, -1, 1); steer = clamp(steer, -1, 1);
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    let target;
    if (m.kind === 'horse') target = throttle > 0 ? (sprint ? m.maxSpeed : 6.5) * throttle : throttle < 0 ? -1.6 : 0;
    else target = throttle > 0 ? m.maxSpeed * throttle : throttle < 0 ? -1.2 : 0;
    const accel = m.kind === 'horse' ? (target > m.speed ? 3.2 : 6) : 1.5;
    m.speed += clamp(target - m.speed, -accel * dt, accel * dt);
    const turnRate = m.kind === 'horse' ? 2.2 - Math.min(1.2, Math.abs(m.speed) * 0.07) : 0.9;
    m.yaw += steer * turnRate * dt * (Math.abs(m.speed) > 0.1 || m.kind === 'horse' ? 1 : 0.3) * (m.speed < -0.05 ? -1 : 1);
    m.drive(dt, this.physics, others);
    // hoof beats / wheel creak
    this.hoofT += dt * Math.abs(m.speed) * (m.kind === 'horse' ? 0.55 : 0.5);
    if (this.hoofT > 1) {
      this.hoofT = 0;
      if (m.kind === 'horse') this.audio?.hoof(Math.abs(m.speed) / m.maxSpeed);
      else this.audio?.creak();
    }
  }
}
