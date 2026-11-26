// The traveller you play: third-person movement and follow camera.
import * as THREE from 'three';
import { Human } from '../life/characters.js';
import { clamp } from './util.js';
import { WORLD_R } from '../world/layout.js';
import { turnTowards } from '../life/npc.js';

export class Player {
  constructor(scene, physics, camera) {
    this.physics = physics;
    this.camera = camera;
    this.model = new Human({
      top: '#f2ead8', sleeves: true, longSleeves: true, bottom: '#efe6d2', trousers: true, sash: '#2f6f8f',
      vest: '#2f6f8f', head: 'turban', headColor: '#e08a1e', skin: '#93603f', scale: 1, mustache: true, shoes: '#5a3a22',
    });
    // a cloth shoulder bag
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.22), new THREE.MeshLambertMaterial({ color: '#7a3b1e' }));
    bag.position.set(-0.22, -0.02, 0.0);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.215), new THREE.MeshLambertMaterial({ color: '#5a2a14' }));
    strap.position.set(0, 0.26, 0);
    strap.rotation.z = 0.75;
    this.model.torso.add(strap);
    bag.castShadow = true;
    this.model.torso.add(bag);
    scene.add(this.model.root);
    this.pos = this.model.root.position;
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI / 2;       // camera yaw
    this.pitch = 0.28;
    this.dist = 6.5;
    this.grounded = true;
    this.emote = null;
    this.emoteT = 0;
    this.camPos = new THREE.Vector3();
    this.radius = 0.38;
  }

  spawn(x, z, facing) {
    this.pos.set(x, this.physics.groundAt(x, z), z);
    this.model.root.rotation.y = facing;
    this.yaw = facing + Math.PI;
    this.camPos.set(x - Math.sin(facing) * 6, this.pos.y + 3, z - Math.cos(facing) * 6);
  }

  setEmote(pose, dur = 2.5) { if (!this.mount) { this.emote = pose; this.emoteT = dur; } }

  mountOn(m) {
    this.mount = m;
    m.rider = this;
    this.emote = null;
    this.vel.set(0, 0, 0);
    this.footDist = this.dist;
    this.dist = m.kind === 'horse' ? 8 : 9.5;
  }

  dismount() {
    const m = this.mount;
    if (!m) return;
    m.rider = null;
    m.speed = 0;
    this.mount = null;
    // step off on the left-hand side
    const lx = Math.cos(m.yaw), lz = -Math.sin(m.yaw);
    const side = m.kind === 'horse' ? 1.3 : 1.7;
    const x = m.pos.x + lx * side, z = m.pos.z + lz * side;
    this.pos.set(x, this.physics.groundAt(x, z, m.pos.y + 1), z);
    this.physics.resolve(this.pos, this.radius, this.pos.y + 0.05, this.pos.y + 1.7);
    this.model.root.rotation.set(0, m.yaw, 0);
    this.dist = this.footDist || 6.5;
  }

  update(dt, input, actors, mounts) {
    const sens = 0.0026;
    const looking = Math.abs(input.look.dx) + Math.abs(input.look.dy) > 0;
    if (looking) this.lastLook = 0; else this.lastLook = (this.lastLook || 0) + dt;
    this.yaw -= input.look.dx * sens;
    this.pitch = clamp(this.pitch + input.look.dy * sens, -0.35, 1.25);
    this.dist = clamp(this.dist + input.wheel * 0.6, 2.5, 18);

    if (this.mount) {
      const m = this.mount;
      mounts.ride(m, dt, input, actors);
      m.seat.updateWorldMatrix(true, false);
      m.seat.getWorldPosition(this.pos);
      this.model.root.rotation.set(0, m.yaw, 0);
      this.model.pose = m.kind === 'horse' ? 'ride' : 'sit';
      this.model.rideBounce = Math.abs(m.speed) / 8;
      this.model.speed = 0;
      this.model.update(dt);
      // the camera swings round behind the mount when you ride and leave the mouse alone
      if (Math.abs(m.speed) > 1 && this.lastLook > 0.8) {
        let d = m.yaw + Math.PI - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * Math.min(1, dt * 2.2);
      }
      this.grounded = true;
      this.updateCamera(dt);
      return;
    }

    // movement relative to camera
    let fx = 0, fz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) fz += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) fz -= 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) fx += 1;
    if (input.down('KeyD') || input.down('ArrowRight')) fx -= 1;
    fx -= input.touchMove.x; fz -= input.touchMove.y;
    const mag = Math.min(1, Math.hypot(fx, fz));
    const run = input.down('ShiftLeft') || input.down('ShiftRight') || (input.isTouch && mag > 0.95);
    const speed = (run ? 7.2 : 3.3) * mag;
    // camera forward on ground plane: camera sits at yaw, looks toward -yaw dir
    const cf = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const cr = { x: -cf.z, z: cf.x };
    let mx = 0, mz = 0;
    if (mag > 0.01) {
      const l = Math.hypot(fx, fz);
      mx = (cf.x * fz + cr.x * -fx) / l;
      mz = (cf.z * fz + cr.z * -fx) / l;
    }
    const m = this.model;
    if (mag > 0.01) {
      this.emote = null;
      turnTowards(m.root, Math.atan2(mx, mz), dt, 10);
    }
    const accel = this.grounded ? 14 : 3;
    this.vel.x += (mx * speed - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (mz * speed - this.vel.z) * Math.min(1, dt * accel);

    if (this.grounded && input.hit('Space')) { this.vel.y = 5.2; this.grounded = false; }
    this.vel.y -= 18 * dt;

    // horizontal move with step-up limit
    const feet = this.pos.y;
    const tryMove = (nx, nz) => {
      const g = this.physics.groundAt(nx, nz, feet);
      if (this.grounded && g - feet > 0.6) return false;
      if (!this.grounded && g - feet > 0.3) return false;
      return true;
    };
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (tryMove(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else if (tryMove(nx, this.pos.z)) this.pos.x = nx;
    else if (tryMove(this.pos.x, nz)) this.pos.z = nz;
    this.physics.resolve(this.pos, this.radius, this.pos.y + 0.05, this.pos.y + 1.7);
    // people and animals push you gently aside
    for (const a of actors) {
      const r = a.root.position;
      const dx = this.pos.x - r.x, dz = this.pos.z - r.z;
      const min = this.radius + (a.radius || 0.35);
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6 && Math.abs(r.y - this.pos.y) < 1.6) {
        const d = Math.sqrt(d2);
        this.pos.x = r.x + (dx / d) * min;
        this.pos.z = r.z + (dz / d) * min;
      }
    }
    const rr = Math.hypot(this.pos.x, this.pos.z);
    if (rr > WORLD_R) { this.pos.x *= WORLD_R / rr; this.pos.z *= WORLD_R / rr; }

    // vertical
    const ground = this.physics.groundAt(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= ground) {
      this.pos.y = ground; this.vel.y = 0; this.grounded = true;
    } else if (this.grounded && this.pos.y - ground < 0.55 && this.vel.y <= 0) {
      this.pos.y = ground; this.vel.y = 0; // stick to slopes / steps going down
    } else {
      this.grounded = false;
    }

    // animation
    const hs = Math.hypot(this.vel.x, this.vel.z);
    m.speed = hs;
    if (this.emote) {
      this.emoteT -= dt;
      m.pose = this.emote;
      if (this.emote === 'dance') { m.spin = 0; }
      if (this.emoteT <= 0) this.emote = null;
    } else m.pose = 'idle';
    if (!this.grounded) { m.speed = 0.5; }
    m.update(dt);
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const target = new THREE.Vector3(this.pos.x, this.pos.y + 1.55, this.pos.z);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    // shorten the boom if it would pass through a wall or the ground
    let d = this.dist;
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * this.dist;
      const px = target.x + dir.x * t, py = target.y + dir.y * t, pz = target.z + dir.z * t;
      if (this.physics.blocked(px, pz, py) || py < this.physics.groundAt(px, pz, py) + 0.3) { d = Math.max(1.2, t - 0.6); break; }
    }
    const want = target.clone().addScaledVector(dir, d);
    this.camPos.lerp(want, 1 - Math.exp(-dt * 14));
    const g = this.physics.groundAt(this.camPos.x, this.camPos.z, this.camPos.y) + 0.35;
    if (this.camPos.y < g) this.camPos.y = g;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(target);
  }

  get forward() {
    const y = this.model.root.rotation.y;
    return { x: Math.sin(y), z: Math.cos(y) };
  }
}
