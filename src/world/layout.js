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
export const WORLD_R = 300;      // walkable world limit
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

// Wall segment (between bastions at 52.5 and 67.5 deg) still being raised.
export const CONSTRUCTION_ANGLE = deg(60);
export const CONSTRUCTION = (() => {
  const a0 = deg(52.5), a1 = deg(67.5);
  const p0 = polar(R_OUTER, a0), p1 = polar(R_OUTER, a1);
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
    { x: 235, z: 0 },
    { x: 190, z: 0 },
    { x: 150, z: 0 },
    { x: 118, z: 0 },
  ];
  const turns = 0.75 * Math.PI * 2;
  const N = 48;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const a = -t * turns;
    const r = 118 + (44 - 118) * t;
    pts.push(polar(r, a));
  }
  pts.push({ x: 0, z: 39 });
  pts.push({ x: 0, z: 14 });
  return new Path(pts);
})();

// The spot at the top of the road where the Bala Hisar gate stands.
export const CITADEL_GATE = { x: 0, z: R_CITADEL, angle: Math.PI / 2 };

export const BAZAAR = { x0: 128, x1: 172, z: 0, halfWidth: 9 };
export const DANCE = { x: 122, z: -72, size: 14 };
export const PALACE = { x: -26, z: 128 };
export const BALA_HISAR = { x: 0, z: 0 };
export const PORTICO = { x: 176, z: 0 };
export const TEMPLE = { x: -22, z: -16 };
export const TANK = { x: -95, z: -70, w: 26, d: 18 };

// Places where the terrain is levelled.
export const FLATS = [
  { x: 150, z: 0, r: 34 },             // bazaar
  { x: 190, z: 0, r: 20 },             // gate
  { x: DANCE.x, z: DANCE.z, r: 18 },
  { x: PALACE.x, z: PALACE.z, r: 22 },
  { x: CONSTRUCTION.mid.x + CONSTRUCTION.inward.x * 14, z: CONSTRUCTION.mid.z + CONSTRUCTION.inward.z * 14, r: 30 },
  { x: 0, z: 0, r: 30 },               // summit plateau
  { x: TANK.x, z: TANK.z, r: 22 },
];

// The Sultan's procession loop: palace -> inspect the construction ->
// through the bazaar -> up to Bala Hisar -> back down -> palace.
const viewPt = {
  x: CONSTRUCTION.mid.x + CONSTRUCTION.inward.x * 34,
  z: CONSTRUCTION.mid.z + CONSTRUCTION.inward.z * 34,
};
export const PROCESSION_STOPS = [];
export const PROCESSION = (() => {
  const roadStart = 3; // index of {118,0} in ROAD
  const up = ROAD.pts.slice(roadStart); // all the way to the hall steps
  const pts = [
    { x: PALACE.x + 4, z: PALACE.z - 14 },
    { x: 20, z: 134 },
    { x: 50, z: 128 },
    viewPt,
    { x: 112, z: 92 },
    { x: 138, z: 42 },
    { x: 146, z: 8 },
    { x: 150, z: 0 },
    ...up,
  ];
  const topIdx = pts.length - 1;
  const down = up.slice(0, -1).reverse();
  pts.push(...down, { x: 104, z: 40 }, { x: 70, z: 100 }, { x: 30, z: 126 }, { x: PALACE.x + 4, z: PALACE.z - 14 });
  const path = new Path(pts);
  PROCESSION_STOPS.push(
    { s: path.cum[3], dur: 26, label: 'inspects the rising walls' },
    { s: path.cum[topIdx], dur: 30, label: 'holds court at Bala Hisar' },
    { s: path.length - 0.01, dur: 18, label: 'rests at the palace' },
  );
  return path;
})();
export const PROCESSION_VIEW = viewPt;

// Named zones shown on the HUD when you enter them (checked in order).
export const ZONES = [
  { name: 'Bala Hisar', sub: 'The summit citadel', x: 0, z: 0, r: R_CITADEL + 2 },
  { name: 'Fateh Darwaza', sub: 'The Victory Gate', x: 188, z: 0, r: 16 },
  { name: 'The Clapping Portico', sub: 'Clap here - it carries to the summit', x: PORTICO.x, z: PORTICO.z, r: 7 },
  { name: 'Moti Bazaar', sub: 'Pearls, spices and diamonds', x: 150, z: 0, r: 26 },
  { name: 'Nritya Mandap', sub: 'The dance court', x: DANCE.x, z: DANCE.z, r: 20 },
  { name: 'The New Rampart', sub: 'Masons raising the granite wall', x: viewPt.x + CONSTRUCTION.inward.x * -18, z: viewPt.z + CONSTRUCTION.inward.z * -18, r: 34 },
  { name: 'Royal Palace', sub: 'Residence of the Sultan', x: PALACE.x, z: PALACE.z, r: 20 },
  { name: 'Mahakali Shrine', sub: 'An old Kakatiya-era temple', x: TEMPLE.x, z: TEMPLE.z, r: 8 },
  { name: 'Step Tank', sub: 'Water for the fort', x: TANK.x, z: TANK.z, r: 20 },
  { name: 'Golconda', sub: 'Within the walls', x: 0, z: 0, r: R_OUTER - 4 },
  { name: 'The Deccan Plain', sub: 'Outside the fort', x: 0, z: 0, r: 99999 },
];
