// The map of Golconda as it might have looked c. 1518, when Sultan Quli
// Qutb-ul-Mulk began turning the old Kakatiya mud fort of "Golla Konda"
// (Shepherd's Hill) into a granite citadel.
//
// Units are metres. +X is east, -Z is north. The granite hill sits at the
// origin, the outer wall rings it, and Fateh Darwaza (the Victory Gate)
// faces east towards the road from Bhagnagar.

import { Path } from '../core/util.js';

export const HILL_H = 60;
export const R_OUTER = 190;      // outer curtain wall radius
export const R_CITADEL = 40;     // Bala Hisar inner wall radius
export const R_MIDDLE = 122;     // middle wall around the foot of the hill
export const WORLD_R = 470;      // walkable world limit (room to ride)
export const WALL_H = 10;
export const WALL_T = 4;

const deg = (d) => (d * Math.PI) / 180;
const polar = (r, a) => ({ x: r * Math.cos(a), z: r * Math.sin(a) });

// Bastions every 15 degrees, offset so that 0 deg (east) and 180 deg (west)
// fall in the middle of a wall segment - that is where the gates go.
export const BASTION_ANGLES = [];
for (let i = 0; i < 24; i++) BASTION_ANGLES.push(deg(7.5 + i * 15));

export const GATES = [
  { name: 'Fateh Darwaza', angle: 0, main: true },
  { name: 'Banjara Darwaza', angle: Math.PI, main: false },
];

// The fort itself is complete. Outside it, to the north-east, masons are
// raising the first stretch of a new outer enclosure (the Naya Qila works).
export const R_NAYA = 238;
export const CONSTRUCTION_ANGLE = deg(-32);
export const CONSTRUCTION = (() => {
  const a0 = deg(-38.5), a1 = deg(-25.5);
  const p0 = polar(R_NAYA, a0), p1 = polar(R_NAYA, a1);
  const mid = { x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2 };
  const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  const dir = { x: (p1.x - p0.x) / len, z: (p1.z - p0.z) / len };
  const inward = { x: -mid.x / Math.hypot(mid.x, mid.z), z: -mid.z / Math.hypot(mid.x, mid.z) };
  return { p0, p1, mid, len, dir, inward };
})();

// Main road: Fateh Darwaza -> bazaar -> foot of the hill -> winding up
// the hill anticlockwise (north, west, south) -> Bala Hisar gate.
export const ROAD = (() => {
  const pts = [
    { x: WORLD_R + 10, z: 0 },
    { x: 330, z: 4 },
    { x: 235, z: 0 },
    { x: 190, z: 0 },
    { x: 150, z: 0 },
    { x: R_MIDDLE, z: 0 },      // Bala Hisar Darwaza
    { x: R_MIDDLE - 9, z: 0 },  // under the clapping portico
    { x: R_MIDDLE - 10, z: -10 },
  ];
  const turns = 0.75 * Math.PI * 2;
  const N = 48;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const a = -(0.15 + t * (turns - 0.15));
    const r = 113 + (44 - 113) * t;
    pts.push(polar(r, a));
  }
  pts.push({ x: 0, z: 39 });
  pts.push({ x: 0, z: 14 });
  return new Path(pts);
})();

// The spot at the top of the road where the Bala Hisar gate stands.
export const CITADEL_GATE = { x: 0, z: R_CITADEL, angle: Math.PI / 2 };

export const BAZAAR = { x0: 136, x1: 176, z: 0, halfWidth: 9 };
export const DANCE = { x: 128, z: -78, size: 14 };
export const PALACE = { x: 70, z: 50 };        // royal palaces + Rani Mahal at the foot of the hill
export const NAGINA_BAGH = { x: 96, z: -16 };  // the royal garden just inside Bala Hisar Darwaza
export const BAOLI = { x: 86, z: 15 };         // Badi Baoli, the great stepwell beside the steps
export const STEPS = { x0: 104, x1: 44, z: 0, w: 4.5 }; // the ~380 steps up to Bala Hisar
export const BALA_HISAR = { x: 0, z: 0 };
export const BALA_HISAR_GATE = { x: R_MIDDLE, z: 0 };
export const PORTICO = { x: R_MIDDLE - 9, z: 0 }; // the clapping portico behind Bala Hisar Darwaza
export const TEMPLE = { x: -22, z: -16 };
export const TANK = { x: -140, z: -84, w: 26, d: 18 };
export const STABLE = { x: 250, z: 22 };   // caravanserai and stables outside Fateh Darwaza

// Places where the terrain is levelled.
const STABLE_X = 250;
export const FLATS = [
  { x: 154, z: 0, r: 34 },             // bazaar
  { x: STABLE_X, z: 22, r: 26 },       // stables
  { x: 190, z: 0, r: 20 },             // gate
  { x: DANCE.x, z: DANCE.z, r: 18 },
  { x: PALACE.x, z: PALACE.z, r: 26 },
  { x: NAGINA_BAGH.x, z: NAGINA_BAGH.z, r: 12 },
  { x: CONSTRUCTION.mid.x + CONSTRUCTION.inward.x * 14, z: CONSTRUCTION.mid.z + CONSTRUCTION.inward.z * 14, r: 30 },
  { x: 0, z: 0, r: 30 },               // summit plateau
  { x: TANK.x, z: TANK.z, r: 22 },
];

// The Sultan's procession loop: palace -> round the hill -> through the
// bazaar and out of Fateh Darwaza to inspect the Naya Qila works -> back in,
// through Bala Hisar Darwaza and up to the summit -> down -> palace.
const viewPt = {
  x: CONSTRUCTION.mid.x + CONSTRUCTION.inward.x * 34,
  z: CONSTRUCTION.mid.z + CONSTRUCTION.inward.z * 34,
};
export const PROCESSION_STOPS = [];
export const PROCESSION = (() => {
  const up = ROAD.pts.slice(6); // from under the portico to the hall steps
  const toGate = [{ x: PALACE.x + 2, z: PALACE.z - 16 }, { x: 96, z: 18 }, { x: 108, z: 6 }];
  const out = [{ x: R_MIDDLE - 9, z: 0 }, { x: R_MIDDLE, z: 0 }, { x: 150, z: 0 }, { x: 200, z: 0 }, { x: 226, z: -12 }, { x: 222, z: -60 }, viewPt];
  const back = [{ x: 222, z: -60 }, { x: 226, z: -12 }, { x: 200, z: 0 }, { x: 150, z: 0 }, { x: R_MIDDLE, z: 0 }];
  const pts = [...toGate, ...out];
  const viewIdx = pts.length - 1;
  pts.push(...back, ...up);
  const topIdx = pts.length - 1;
  pts.push(...up.slice(0, -1).reverse(), ...toGate.slice(0, -1).reverse());
  const path = new Path(pts);
  PROCESSION_STOPS.push(
    { s: path.cum[viewIdx], dur: 26, label: 'inspects the rising walls' },
    { s: path.cum[topIdx], dur: 30, label: 'holds court at Bala Hisar' },
    { s: path.length - 0.01, dur: 18, label: 'rests at the palace' },
  );
  return path;
})();
export const PROCESSION_VIEW = viewPt;

// Named zones shown on the HUD when you enter them (checked in order).
export const ZONES = [
  { name: 'Bala Hisar', sub: 'The summit citadel', x: 0, z: 0, r: R_CITADEL + 2 },
  { name: 'The Clapping Portico', sub: 'Clap here - it carries to the summit', x: PORTICO.x, z: PORTICO.z, r: 6 },
  { name: 'Bala Hisar Darwaza', sub: 'Gate of the inner fort', x: R_MIDDLE + 4, z: 0, r: 9 },
  { name: 'Fateh Darwaza', sub: 'The Victory Gate', x: 188, z: 0, r: 16 },
  { name: 'Moti Bazaar', sub: 'Pearls, spices and diamonds', x: 156, z: 0, r: 24 },
  { name: 'Caravanserai', sub: 'Stables and travellers\' rest', x: STABLE_X, z: 22, r: 22 },
  { name: 'Nritya Mandap', sub: 'The dance court', x: DANCE.x, z: DANCE.z, r: 20 },
  { name: 'Naya Qila Works', sub: 'Masons raising the new outer wall', x: viewPt.x + CONSTRUCTION.inward.x * -18, z: viewPt.z + CONSTRUCTION.inward.z * -18, r: 34 },
  { name: 'Royal Palaces & Rani Mahal', sub: 'The Sultan\'s residence and the zenana', x: PALACE.x, z: PALACE.z, r: 22 },
  { name: 'Nagina Bagh', sub: 'Garden of the royal ladies', x: NAGINA_BAGH.x, z: NAGINA_BAGH.z, r: 9 },
  { name: 'Badi Baoli', sub: 'The great stepwell', x: BAOLI.x, z: BAOLI.z, r: 8 },
  { name: 'The 380 Steps', sub: 'The stair to Bala Hisar', x: (STEPS.x0 + STEPS.x1) / 2, z: 0, r: 26 },
  { name: 'Mahakali Shrine', sub: 'An old Kakatiya-era temple', x: TEMPLE.x, z: TEMPLE.z, r: 8 },
  { name: 'Step Tank', sub: 'Water for the fort', x: TANK.x, z: TANK.z, r: 20 },
  { name: 'Golconda', sub: 'The inner fort', x: 0, z: 0, r: R_MIDDLE - 3 },
  { name: 'Golconda', sub: 'Within the walls', x: 0, z: 0, r: R_OUTER - 4 },
  { name: 'The Deccan Plain', sub: 'Outside the fort', x: 0, z: 0, r: 99999 },
];
