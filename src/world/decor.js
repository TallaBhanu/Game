// Small details that make the world feel lived in: market goods, pots by
// doorways, barrels at the caravanserai and cannons on the bastions.
import { ENV, scatter, place } from './env.js';
import { terrainHeight } from './terrain.js';
import { BASTION_ANGLES, R_OUTER, WALL_H, STABLE } from './layout.js';
import { rand, rng, pick, TAU } from '../core/util.js';

export function decorate(scene, physics, fort, bazaar) {
  if (!ENV.ceramic_pot) return;
  const fit = (n, size) => size / Math.max(ENV[n].size.x, ENV[n].size.y, ENV[n].size.z);
  const groups = {};
  const add = (n, x, z, size, { y = null, rotY = rand(0, TAU) } = {}) => {
    if (!ENV[n]) return;
    (groups[n] ||= []).push({ x, z, y: y ?? physics.groundAt(x, z), rotY, scale: fit(n, size) });
  };

  // ---- market stalls ----
  for (const st of bazaar.stalls) {
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), ax = Math.cos(st.yaw), az = -Math.sin(st.yaw);
    const g = terrainHeight(st.x, st.z);
    const front = (o, d) => [st.x + fx * d + ax * o, st.z + fz * d + az * o];
    const counterY = g + 1.2;
    const kind = st.def.kind;
    // goods on the ground in front of every stall
    for (let k = 0; k < 3; k++) {
      const [x, z] = front(-1.8 + k * 1.8 + rand(-0.3, 0.3), 2.2 + rand(0, 0.4));
      add(pick(['wooden_crate_01', 'ceramic_pot', 'planter_pot_clay', 'wooden_bucket_01']), x, z, rand(0.45, 0.7));
    }
    if (kind === 'fruit') {
      for (let k = 0; k < 4; k++) { const [x, z] = front(-1.4 + k * 0.9, 1.0); add(k % 2 ? 'bananas' : 'food_pomegranate_01', x, z, k % 2 ? 0.4 : 0.25, { y: counterY + 0.02 }); }
    } else if (kind === 'copper') {
      for (let k = 0; k < 5; k++) { const [x, z] = front(-1.6 + k * 0.8, 1.0); add(pick(['brass_pot_01', 'brass_pot_02', 'brass_vase_01']), x, z, rand(0.3, 0.45), { y: counterY }); }
    } else if (kind === 'spices') {
      for (let k = 0; k < 2; k++) { const [x, z] = front(-2.6 + k * 5.2, 1.6); add('wooden_barrels_01', x, z, 0.9); }
    } else if (kind === 'pearls' || kind === 'diamonds') {
      const [x, z] = front(1.7, 1.0); add('brass_vase_01', x, z, 0.35, { y: counterY });
    }
    // a hanging lantern under each canopy
    if (ENV.brass_diya_lantern) {
      const [x, z] = front(0, 1.2);
      place(scene, 'brass_diya_lantern', x, g + 2.35, z, 0, fit('brass_diya_lantern', 0.35));
    }
  }

  // ---- pots, buckets and crates by the house doors ----
  for (const h of fort.houseList) {
    if (rng() < 0.45) continue;
    const dx = h.door.x - h.x, dz = h.door.z - h.z, l = Math.hypot(dx, dz);
    const sx = -dz / l, sz = dx / l;
    const side = rng() < 0.5 ? 1 : -1;
    const x = h.door.x - (dx / l) * 0.6 + sx * side * 1.2, z = h.door.z - (dz / l) * 0.6 + sz * side * 1.2;
    add(pick(['ceramic_pot', 'planter_pot_clay', 'wooden_bucket_01', 'ceramic_pot']), x, z, rand(0.45, 0.65));
    if (rng() < 0.4) add('wooden_crate_01', x + sx * side * 0.8, z + sz * side * 0.8, 0.55);
  }

  // ---- the caravanserai: barrels, crates, water pots ----
  for (let i = 0; i < 6; i++) add('wooden_barrels_01', STABLE.x + 16 + (i % 3) * 1.6, STABLE.z - 9 + Math.floor(i / 3) * 1.6, 1.0);
  for (let i = 0; i < 6; i++) add(pick(['wooden_crate_01', 'ceramic_pot', 'wooden_bucket_01']), STABLE.x - 18 + rand(-2, 2), STABLE.z + 10 + rand(-2, 2), rand(0.5, 0.8));
  if (ENV.wooden_lantern_01) for (const sx of [-4, 4]) place(scene, 'wooden_lantern_01', STABLE.x + sx, terrainHeight(STABLE.x, STABLE.z) + 3.2, STABLE.z - 16.2, 0, fit('wooden_lantern_01', 0.5));

  // ---- bronze cannons on every third bastion of the outer wall ----
  if (ENV.cannon_01) {
    const c = ENV.cannon_01;
    const alongX = c.size.x >= c.size.z;
    BASTION_ANGLES.forEach((a, i) => {
      if (i % 3) return;
      const r = R_OUTER - 1.2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const top = terrainHeight(Math.cos(a) * R_OUTER, Math.sin(a) * R_OUTER) + WALL_H + 2;
      add('cannon_01', x, z, 3.2, { y: top, rotY: alongX ? -a : Math.PI / 2 - a });
      physics.addPlatform(Math.cos(a) * R_OUTER, Math.sin(a) * R_OUTER, 4, 4, 0, top);
    });
  }

  for (const [n, items] of Object.entries(groups)) scatter(scene, n, items, { shadow: n === 'cannon_01' || n === 'wooden_barrels_01', far: n === 'cannon_01' ? 300 : 90 });
}
