// Level of detail for people: the nearest actors are drawn with realistic
// skinned bodies from a small pool; everyone further away keeps the light
// procedural body. Props (stones, pots, spears) stay on the actor.
import { RealHuman, COMMON_DYES } from './realistic.js';
import { ASSETS } from './assets.js';

const POOL = { man: 28, woman: 16 };
const RANGE = 55;

export function kindOf(actor) {
  const o = actor.opts || {};
  if (o.female) return 'woman';
  return 'man';
}

let idSeq = 0;
function dyeFor(actor) {
  switch (actor.role) {
    case 'king': return 'gold';
    case 'noble': case 'courtier': return actor._id % 2 ? 'maroon' : 'cream';
    case 'guard': case 'herald': case 'drummer': case 'banner': return 'red';
    case 'servant': return 'white';
    case 'worker': case 'mason': return actor._id % 3 ? 'cream' : 'ochre';
    case 'priest': return 'saffron';
    default: return COMMON_DYES[actor._id % COMMON_DYES.length];
  }
}

export class Crowd {
  constructor(scene, pop) {
    this.pop = pop;
    this.scene = scene;
    this.free = {};
    this.active = new Map(); // actor -> RealHuman
    this.timer = 0;
    this.extra = []; // actors not in the population (cart drivers, riders, mahout)
    if (!ASSETS.ok) return;
    for (const [k, n] of Object.entries(POOL)) {
      this.free[k] = [];
      for (let i = 0; i < n; i++) {
        const h = new RealHuman(k);
        h.root.visible = false;
        scene.add(h.root);
        this.free[k].push(h);
      }
    }
  }

  release(actor) {
    const h = this.active.get(actor);
    if (!h) return;
    h.root.visible = false;
    this.free[h.kind].push(h);
    this.active.delete(actor);
    actor.setBodyVisible?.(true);
  }

  update(dt, cam) {
    if (!ASSETS.ok) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.3;
      const near = [];
      for (const a of [...this.pop.actors, ...this.extra]) {
        if (!a.setBodyVisible || a.noReal) continue;
        const p = a.worldPos ? a.worldPos() : a.root.position;
        const d2 = (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2;
        if (d2 < RANGE * RANGE) near.push([d2, a]);
      }
      near.sort((x, y) => x[0] - y[0]);
      const want = new Set();
      const budget = { ...POOL };
      for (const [, a] of near) {
        const k = kindOf(a);
        if (budget[k] > 0) { budget[k]--; want.add(a); }
      }
      for (const a of [...this.active.keys()]) if (!want.has(a)) this.release(a);
      for (const a of want) {
        if (this.active.has(a)) continue;
        const h = this.free[kindOf(a)].pop();
        if (!h) continue;
        this.active.set(a, h);
        a._id ??= idSeq++;
        if (h.kind === 'man') h.setDye(dyeFor(a));
        h.root.visible = true;
        h.fresh = true;
        a.setBodyVisible(false);
      }
    }
    for (const [a, h] of this.active) {
      if (!a.root.visible && !a.forceReal) { h.root.visible = false; continue; }
      h.root.visible = true;
      a.root.updateMatrixWorld(true);
      a.root.getWorldPosition(h.root.position);
      a.root.getWorldQuaternion(h.root.quaternion);
      h.root.scale.setScalar(a.root.scale.x);
      h.update(dt, { speed: a.speed, pose: a.pose, spin: a.spin });
    }
  }
}
