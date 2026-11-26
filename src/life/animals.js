// Working animals around the fort: camels at the caravanserai, donkeys
// carrying sacks, and Deccani bulls grazing on the plain.
import * as THREE from 'three';
import { spawn, ASSETS } from './assets.js';
import { STABLE, CONSTRUCTION, TANK, R_OUTER } from '../world/layout.js';
import { part } from './characters.js';
import { rand } from '../core/util.js';
import { turnTowards, yawTo } from './npc.js';

export class Animals {
  constructor(scene, physics) {
    this.physics = physics;
    this.list = [];
    if (!ASSETS.ok) return;
    const add = (kind, home, radius, { speed = 0.9, loadSacks = false, still = false } = {}) => {
      const a = spawn(kind);
      if (!a) return;
      a.play('idle', 0);
      a.mixer.update(rand(0, 4));
      const x = home.x + rand(-radius, radius), z = home.z + rand(-radius, radius);
      a.root.position.set(x, physics.groundAt(x, z), z);
      a.root.rotation.y = rand(0, Math.PI * 2);
      scene.add(a.root);
      if (loadSacks) for (const s of [-1, 1]) part('sphere', '#c9b48a', 0.22, 0.28, 0.38, s * 0.3, 1.05, 0, a.root);
      this.list.push({ a, home, radius, speed, still, target: null, wait: rand(0, 8), kind, radiusC: kind === 'camel' ? 1.1 : 0.7 });
    };
    // camels resting in the caravanserai courtyard and one by the road
    for (let i = 0; i < 3; i++) add('camel', { x: STABLE.x - 4, z: STABLE.z + 4 }, 6, { speed: 0.8 });
    add('camel', { x: STABLE.x + 30, z: STABLE.z - 22 }, 4, { still: true });
    // donkeys hauling sacks between the Naya Qila works and town
    const site = { x: CONSTRUCTION.mid.x + CONSTRUCTION.inward.x * 30, z: CONSTRUCTION.mid.z + CONSTRUCTION.inward.z * 30 };
    for (let i = 0; i < 3; i++) add('donkey', site, 10, { loadSacks: true, speed: 1.0 });
    for (let i = 0; i < 2; i++) add('donkey', { x: TANK.x + 6, z: TANK.z + 16 }, 8, { loadSacks: i === 0 });
    // bulls grazing on the plain outside the walls
    for (let i = 0; i < 6; i++) {
      const ang = rand(0, Math.PI * 2), r = rand(R_OUTER + 45, R_OUTER + 160);
      add('bull', { x: Math.cos(ang) * r, z: Math.sin(ang) * r }, 14, { speed: 0.5 });
    }
  }

  update(dt, cam) {
    for (const m of this.list) {
      const p = m.a.root.position;
      const d2 = (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2;
      m.a.root.visible = d2 < 180 * 180;
      if (!m.a.root.visible) continue;
      if (m.still) { m.a.play('idle'); m.a.mixer.update(dt); continue; }
      if (m.wait > 0) {
        m.wait -= dt;
        m.a.play('idle', 0.5);
      } else {
        if (!m.target) m.target = { x: m.home.x + rand(-m.radius, m.radius), z: m.home.z + rand(-m.radius, m.radius) };
        const dx = m.target.x - p.x, dz = m.target.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.5) { m.target = null; m.wait = rand(4, 14); }
        else {
          const step = Math.min(d, m.speed * dt);
          const nx = p.x + (dx / d) * step, nz = p.z + (dz / d) * step;
          if (this.physics.blocked(nx, nz, p.y + 0.5)) { m.target = null; m.wait = rand(1, 3); }
          else { p.x = nx; p.z = nz; }
          turnTowards(m.a.root, yawTo(dx, dz), dt, 2);
          p.y = this.physics.groundAt(p.x, p.z, p.y + 0.5);
          m.a.play('walk', 0.4, m.speed / 1.0);
        }
      }
      m.a.mixer.update(dt);
    }
  }
}
void THREE;
