// Everyday life: people walking the roads, guards, priests and courtiers.
import { ROAD, PROCESSION, GATES, TEMPLE, PALACE, TANK, R_CITADEL } from '../world/layout.js';
import { terrainHeight } from '../world/terrain.js';
import { Human, Props, randomCitizen, part } from './characters.js';
import { rand, pick } from '../core/util.js';
import { yawTo, turnTowards } from './npc.js';

const CITIZEN_LINES = [
  'Namaskaram! Welcome to Golconda. Mind the carts on the road.',
  'They say this hill was once just a shepherd\'s hill - Golla Konda.',
  'If you clap under the portico by the gate, the guards at the summit can hear it!',
  'The pearls in the Moti Bazaar come all the way from the southern seas.',
  'The Sultan rides out every day to see the walls. Bow low when he passes.',
  'The dancers perform at the Nritya Mandap, north of the bazaar.',
  'I sell ghee in the lower town. Times are good since the Qutb Shahi came.',
  'You can walk up to Bala Hisar - it is a long climb, but the view is worth it.',
  'My son works on the new rampart in the south-east. Hard work, but honest.',
];
const GUARD_LINES = [
  'Halt! ... Ah, a traveller. Enter, and keep the peace inside these walls.',
  'These doors are studded with iron spikes. No war elephant can batter them down.',
  'Fateh Darwaza - the Victory Gate. Pass through, and stay out of trouble.',
];
const PRIEST_LINES = [
  'This shrine to the Mother is older than the fort. The Sultan permits our worship.',
  'Take some prasadam - jaggery and coconut. May the Devi protect you.',
];
const COURT_LINES = [
  'You stand in the Durbar of Bala Hisar. From here one can see all the way to Bhagnagar.',
  'The Sultan holds court here when he climbs the hill. Bring a petition if you have one.',
  'They say a clap at Fateh Darwaza can be heard right here. The architects are clever men.',
];

export class Townsfolk {
  constructor(scene, physics, pop, fort) {
    this.pop = pop;
    this.walkers = [];
    // ---- road walkers ----
    const paths = [ROAD, PROCESSION];
    for (let i = 0; i < 34; i++) {
      const h = randomCitizen();
      const r = Math.random();
      if (r < 0.2) {
        h.pose = 'carryHead';
        const pot = Props.pot(pick(['#a5532c', '#c46a32', '#8a4b22']));
        pot.position.y = 0.2;
        h.attach(pot, 'head');
      } else if (r < 0.32) {
        h.pose = 'carryShoulder';
        const sack = part('sphere', '#c9b48a', 0.25, 0.18, 0.35, 0, 0.05, 0);
        h.attach(sack, 'handL');
      }
      h.basePose = h.pose;
      const path = paths[i % 3 === 2 ? 1 : 0];
      h.path = path;
      h.s = rand(0, path.length);
      h.dir = Math.random() < 0.5 ? 1 : -1;
      h.lat = rand(-2.4, 2.4);
      h.walkSpeed = rand(0.9, 1.35);
      h.wait = 0;
      const p = path.at(h.s);
      pop.add(h, { x: p.x, z: p.z, role: 'citizen', lines: [pick(CITIZEN_LINES), pick(CITIZEN_LINES)] });
      this.walkers.push(h);
    }
    // ---- water carriers between the step tank and houses ----
    this.water = [];
    for (let i = 0; i < 4; i++) {
      const h = new Human({ female: true, top: pick(['#c9472b', '#7b2d4f']), skirt: pick(['#2f6f8f', '#e0a526', '#3d7a4a']), sleeves: true, head: 'veil', headColor: '#e0a526', bangles: true, scale: 0.9 });
      h.pose = 'carryHead';
      const pot = Props.pot('#c46a32');
      pot.position.y = 0.2;
      h.attach(pot, 'head');
      h.basePose = h.pose;
      pop.add(h, { x: TANK.x + rand(-8, 8), z: TANK.z + TANK.d / 2 + 3, role: 'citizen', lines: ['The step tank never runs dry. The engineers bring water up with Persian wheels.', 'Three trips a day, up and down. My neck is as strong as a bullock\'s!'] });
      h.target = null;
      h.wait = rand(0, 4);
      this.water.push(h);
    }
    // ---- guards ----
    this.guards = [];
    const guard = (x, z, yaw, lines = GUARD_LINES) => {
      const h = new Human({ top: '#c9472b', sleeves: true, longSleeves: true, bottom: '#efe6d2', trousers: true, vest: '#7a1c1c', head: 'helmet', beard: true, sash: '#e0a526' });
      h.pose = 'holdStaff';
      h.attach(Props.spear(), 'handR');
      pop.add(h, { x, z, yaw, role: 'guard', lines });
      h.homeYaw = yaw;
      this.guards.push(h);
      return h;
    };
    for (const g of GATES) {
      const { x, z, ux, uz } = g.pos;
      const nx = -uz, nz = ux;
      const outward = nx * x + nz * z > 0 ? 1 : -1;
      for (const s of [-1, 1]) {
        guard(x + ux * s * 3.6 + nx * outward * 5, z + uz * s * 3.6 + nz * outward * 5, yawTo(nx * outward, nz * outward));
        guard(x + ux * s * 3.6 - nx * outward * 5, z + uz * s * 3.6 - nz * outward * 5, yawTo(-nx * outward, -nz * outward));
      }
    }
    for (const s of [-1, 1]) guard(s * 3.2, R_CITADEL + 3, 0, ['Only those with business at court may enter Bala Hisar. ...Very well, go on.']);
    for (const s of [-1, 1]) guard(PALACE.x + s * 4, PALACE.z - 8, Math.PI, ['The royal palace. Admire it from the garden, traveller.']);
    // ---- temple priest and devotees ----
    const priest = new Human({ top: null, bottom: '#f08a24', head: 'bald', beard: true, mustache: true });
    priest.pose = 'talk';
    pop.add(priest, { x: TEMPLE.x + 2.8, z: TEMPLE.z, yaw: Math.PI / 2 * -1, role: 'priest', name: 'Temple Priest', lines: PRIEST_LINES });
    priest.root.position.y = terrainHeight(TEMPLE.x, TEMPLE.z) + 1.1;
    for (let i = 0; i < 3; i++) {
      const d = randomCitizen();
      d.pose = 'namaste';
      const px = TEMPLE.x + 6.5 + i * 0.3, pz = TEMPLE.z - 1.5 + i * 1.5;
      pop.add(d, { x: px, z: pz, yaw: yawTo(TEMPLE.x - px, 0), role: 'citizen', lines: ['I come to pray before every journey.'] });
    }
    // ---- courtiers in the durbar hall ----
    const hallY = fort.hallFloorY;
    for (let i = 0; i < 6; i++) {
      const h = new Human({ top: pick(['#efe3c8', '#e7d9b8', '#e0a526']), sleeves: true, longSleeves: true, robe: pick(['#f2ead8', '#efe3c8']), sash: pick(['#c9472b', '#2f6f8f', '#7b2d4f', '#2a7a3b']), head: 'pagri', headColor: pick(['#c93a2a', '#e0a526', '#2f6f8f', '#f4efe2']), beard: true, jewels: i < 2 });
      h.pose = i % 2 ? 'talk' : 'idle';
      const side = i % 2 ? 1 : -1;
      const px = side * (3 + (i >> 1) * 1.4), pz = -6 + (i >> 1) * 2.2;
      pop.add(h, { x: px, z: pz, yaw: yawTo(-px, -9 - pz), role: 'courtier', lines: COURT_LINES });
      h.root.position.y = hallY;
    }
    this.fort = fort;
  }

  update(dt, king) {
    const tmp = {};
    for (const h of [...this.walkers, ...this.water]) {
      const p = h.root.position;
      if (king && (p.x - king.x) ** 2 + (p.z - king.z) ** 2 < 140) {
        h.speed = 0;
        h.pose = 'bow';
        turnTowards(h.root, yawTo(king.x - p.x, king.z - p.z), dt, 4);
        continue;
      }
      if (h.pose === 'bow') h.pose = h.basePose;
      if (h.wait > 0) { h.wait -= dt; h.speed = 0; continue; }
      if (h.path) {
        h.s += h.dir * h.walkSpeed * dt;
        if (h.s < 0 || h.s > h.path.length) {
          h.dir *= -1;
          h.s = Math.max(0, Math.min(h.path.length, h.s));
          h.wait = rand(1, 6);
        } else if (Math.random() < dt * 0.01) {
          h.wait = rand(2, 6); // stop for a chat
        }
        h.path.at(h.s, tmp);
        const nx = -tmp.dz * h.dir, nz = tmp.dx * h.dir; // keep to one side of the road
        const x = tmp.x + nx * Math.abs(h.lat), z = tmp.z + nz * Math.abs(h.lat);
        const dx = x - p.x, dz = z - p.z;
        if (dx * dx + dz * dz > 1e-6) turnTowards(h.root, yawTo(dx, dz), dt, 5);
        p.x = x; p.z = z;
        h.speed = h.walkSpeed;
        this.pop.ground(h);
      } else {
        // water carriers: tank <-> a random house door
        if (!h.target) {
          const houses = this.fort.houseList.filter((hh) => Math.hypot(hh.x - TANK.x, hh.z - TANK.z) < 70);
          h.target = Math.random() < 0.5 || !houses.length
            ? { x: TANK.x + rand(-10, 10), z: TANK.z + TANK.d / 2 + 2.5 }
            : pick(houses).door;
        }
        if (this.pop.walkTo(h, h.target.x, h.target.z, 1.0, dt, { arrive: 0.6 })) {
          h.target = null;
          h.wait = rand(3, 8);
        }
      }
    }
  }
}
