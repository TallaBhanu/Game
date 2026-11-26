import * as THREE from 'three';

export const yawTo = (dx, dz) => Math.atan2(dx, dz);

export function turnTowards(obj, yaw, dt, rate = 6) {
  let d = yaw - obj.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  obj.rotation.y += d * Math.min(1, dt * rate);
}

/** Registry of every animated actor so the game can cull, bow, collide, talk. */
export class Population {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.actors = [];
  }
  add(actor, { x = 0, z = 0, yaw = 0, role = 'citizen', lines = null, name = null, talk = true } = {}) {
    actor.role = role;
    actor.lines = lines;
    actor.name = name;
    actor.talkable = talk;
    actor.root.position.set(x, this.physics.groundAt(x, z), z);
    actor.root.rotation.y = yaw;
    this.scene.add(actor.root);
    this.actors.push(actor);
    return actor;
  }
  ground(actor) {
    const p = actor.root.position;
    p.y = this.physics.groundAt(p.x, p.z, p.y + 0.5);
  }
  /** Moves an actor toward (x,z). Returns true once there. */
  walkTo(actor, x, z, speed, dt, { ground = true, arrive = 0.25 } = {}) {
    const p = actor.root.position;
    const dx = x - p.x, dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) { actor.speed = 0; return true; }
    const step = Math.min(d, speed * dt);
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    actor.speed = speed;
    turnTowards(actor.root, yawTo(dx, dz), dt, 7);
    if (ground) this.ground(actor);
    return false;
  }
  update(dt, camPos) {
    for (const a of this.actors) {
      const p = a.root.position;
      const d2 = (p.x - camPos.x) ** 2 + (p.z - camPos.z) ** 2;
      const vis = d2 < 150 * 150;
      a.root.visible = vis;
      // animation is cheap-ish but skip when far away
      if (vis && (d2 < 90 * 90 || (a._skip = !a._skip))) a.update(d2 < 90 * 90 ? dt : dt * 2);
    }
  }
}
export const _v = new THREE.Vector3();
