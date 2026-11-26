// Moti Bazaar: stalls of pearls, spices, diamonds, cloth, bangles and fruit
// lining the road just inside Fateh Darwaza, with haggling shoppers.
import * as THREE from 'three';
import { BAZAAR } from '../world/layout.js';
import { terrainHeight } from '../world/terrain.js';
import { MATERIALS, StaticBatch } from '../world/builder.js';
import { stripes, printedCloth } from '../core/textures.js';
import { Human, Props, part, randomCitizen } from './characters.js';
import { rand, pick, TAU } from '../core/util.js';
import { yawTo, turnTowards } from './npc.js';

export const STALLS = [
  {
    kind: 'pearls', name: 'Pearl merchant', canopy: ['#f4efe2', '#2f6f8f'],
    greet: 'Pearls from the Gulf and the Mannar coast, drilled and strung right here in Golconda!',
    items: [
      { id: 'pearl-string', name: 'String of pearls', price: 14 },
      { id: 'pearl-earring', name: 'Pearl ear-drops', price: 8 },
      { id: 'black-pearl', name: 'A rare black pearl', price: 30 },
    ],
  },
  {
    kind: 'spices', name: 'Spice seller', canopy: ['#e0a526', '#c9472b'],
    greet: 'Pepper from Malabar, cardamom, turmeric, cloves! Smell that - you will not find better.',
    items: [
      { id: 'pepper', name: 'Black pepper (1 ser)', price: 4 },
      { id: 'cardamom', name: 'Green cardamom', price: 6 },
      { id: 'turmeric', name: 'Turmeric root', price: 2 },
      { id: 'saffron', name: 'Kashmiri saffron', price: 18 },
    ],
  },
  {
    kind: 'diamonds', name: 'Diamond trader', canopy: ['#7b2d4f', '#e0a526'],
    greet: 'From the Kollur mines on the Krishna. The finest diamonds in the world pass through Golconda.',
    items: [
      { id: 'diamond-small', name: 'Small rough diamond', price: 25 },
      { id: 'diamond-cut', name: 'Table-cut diamond', price: 60 },
    ],
  },
  {
    kind: 'spices', name: 'Masala woman', canopy: ['#3d7a4a', '#e0a526'], female: true,
    greet: 'Chilli? No, no - chilli has not reached us yet. But I have long pepper, cumin and asafoetida!',
    items: [
      { id: 'cumin', name: 'Cumin seeds', price: 2 },
      { id: 'hing', name: 'Asafoetida (hing)', price: 5 },
      { id: 'tamarind', name: 'Tamarind', price: 1 },
    ],
  },
  {
    kind: 'cloth', name: 'Kalamkari weaver', canopy: ['#2f6f8f', '#f4efe2'],
    greet: 'Hand-painted cotton from Machilipatnam. The Portuguese buy it by the shipload.',
    items: [
      { id: 'kalamkari', name: 'Kalamkari cloth', price: 9 },
      { id: 'turban-cloth', name: 'Muslin turban cloth', price: 5 },
    ],
  },
  {
    kind: 'pearls', name: 'Pearl stringer', canopy: ['#efe3c8', '#7b2d4f'], female: true,
    greet: 'I sort pearls by size with brass sieves. Small ones for the nose ring, big ones for the Sultan.',
    items: [
      { id: 'seed-pearls', name: 'Seed pearls', price: 5 },
      { id: 'pearl-nath', name: 'Pearl nose-ring', price: 12 },
    ],
  },
  {
    kind: 'bangles', name: 'Bangle seller', canopy: ['#b5294e', '#f2c14e'], female: true,
    greet: 'Lac bangles, glass bangles, bangles set with stones. Your hand, please!',
    items: [
      { id: 'lac-bangles', name: 'Lac bangles', price: 3 },
      { id: 'stone-bangle', name: 'Stone-set bangle', price: 10 },
    ],
  },
  {
    kind: 'fruit', name: 'Fruit seller', canopy: ['#3d7a4a', '#f4efe2'],
    greet: 'Mangoes from Banganapalle, sweet as jaggery. Bananas, jackfruit, custard apple!',
    items: [
      { id: 'mango', name: 'Mangoes', price: 1 },
      { id: 'jackfruit', name: 'Jackfruit', price: 2 },
    ],
  },
  {
    kind: 'copper', name: 'Coppersmith', canopy: ['#d96a2b', '#5a3d22'],
    greet: 'Water pots, lamps, plates - beaten by hand. A lota for the road?',
    items: [
      { id: 'lota', name: 'Copper lota', price: 4 },
      { id: 'diya', name: 'Brass oil lamp', price: 3 },
    ],
  },
  {
    kind: 'spices', name: 'Attar & betel seller', canopy: ['#5b3a8a', '#e0a526'],
    greet: 'Rose attar, khus attar, and paan with areca nut and cardamom. Freshen your mouth, sahib!',
    items: [
      { id: 'attar', name: 'Rose attar', price: 7 },
      { id: 'paan', name: 'Betel paan', price: 1 },
    ],
  },
];

const SHOPPER_LINES = [
  'Twelve huns for that? I could buy a horse for twelve huns!',
  'The pearl merchants here are the best in the Deccan - and the cleverest.',
  'They say the Sultan himself buys his diamonds from that stall.',
  'I traded two sacks of rice for this cloth. A fair bargain, I think.',
  'Have you seen the new walls? My cousin carries stones there.',
  'Persian traders came last week with horses. The whole bazaar went mad.',
];

export class Bazaar {
  constructor(scene, physics, pop, audio, fort) {
    this.pop = pop;
    this.stalls = [];
    const b = new StaticBatch();
    const n = STALLS.length;
    const perSide = Math.ceil(n / 2);
    const span = (BAZAAR.x1 - BAZAAR.x0) / perSide;
    const coneGeo = new THREE.ConeGeometry(0.35, 0.45, 10);
    const pearlGeo = new THREE.SphereGeometry(0.035, 6, 5);
    const pearlMat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.15, metalness: 0.2, emissive: '#222' });
    const diamondMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.0, metalness: 0.6, emissive: '#557', flatShading: true });
    this.sparkles = [];
    STALLS.forEach((def, i) => {
      const side = i % 2 ? 1 : -1; // +z south side faces north
      const x = BAZAAR.x0 + span * (Math.floor(i / 2) + 0.5);
      const z = side * BAZAAR.halfWidth;
      const g = terrainHeight(x, z);
      const yaw = side > 0 ? Math.PI : 0; // face the road
      const W = 4.4, D = 3;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      // raised platform (otla), posts, back wall, canopy
      b.box(W, 0.5, D, x, g + 0.25, z, yaw, 'granite', 2);
      b.box(W, 2.6, 0.2, x - fx * D / 2, g + 1.8, z - fz * D / 2, yaw, 'plasterOchre');
      for (const s of [-1, 1]) for (const fb of [-1, 1]) {
        const px = x + Math.cos(yaw) * s * (W / 2 - 0.1) + fx * fb * (D / 2 - 0.1);
        const pz = z - Math.sin(yaw) * s * (W / 2 - 0.1) + fz * fb * (D / 2 - 0.1);
        b.add(new THREE.CylinderGeometry(0.06, 0.07, 3.0, 6), 'wood', px, g + 1.5 + (fb > 0 ? -0.0 : 0.2), pz);
      }
      // counter at the front
      b.box(W - 0.6, 0.7, 0.6, x + fx * (D / 2 - 0.5), g + 0.85, z + fz * (D / 2 - 0.5), yaw, 'wood', 2);
      physics.addBox(x, z, W / 2, D / 2, yaw, g + 3);
      const canopy = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.8, D + 1.4), new THREE.MeshLambertMaterial({ map: stripes(def.canopy[0], def.canopy[1]), side: THREE.DoubleSide }));
      canopy.position.set(x + fx * 0.4, g + 3.1, z + fz * 0.4);
      canopy.rotation.set(-Math.PI / 2 + 0.22, 0, 0, 'YXZ');
      canopy.rotation.y = yaw;
      canopy.castShadow = true;
      scene.add(canopy);
      // goods on the counter
      const cy = g + 1.2;
      const cx = x + fx * (D / 2 - 0.5), cz = z + fz * (D / 2 - 0.5);
      const along = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      const goods = new THREE.Group();
      scene.add(goods);
      if (def.kind === 'spices') {
        const cols = ['#e3a21a', '#8a4b1c', '#6b3d1e', '#c0471f', '#d9b23a', '#3d5a2a'];
        for (let k = 0; k < 6; k++) {
          const o = -1.6 + k * 0.64;
          const tray = part('cyl', '#6b4a2a', 0.3, 0.06, 0.3, cx + along.x * o, cy - 0.12, cz + along.z * o, goods, MATERIALS.wood);
          void tray;
          const c = new THREE.Mesh(coneGeo, new THREE.MeshLambertMaterial({ color: cols[k] }));
          c.position.set(cx + along.x * o, cy + 0.12, cz + along.z * o);
          c.scale.set(0.7, 0.9, 0.7);
          c.castShadow = true;
          goods.add(c);
        }
        // sacks on the ground
        for (let k = 0; k < 3; k++) {
          const sx = x + fx * (D / 2 + 0.6) + along.x * (k - 1) * 1.2, sz = z + fz * (D / 2 + 0.6) + along.z * (k - 1) * 1.2;
          part('cyl', '#c9b48a', 0.32, 0.6, 0.32, sx, terrainHeight(sx, sz) + 0.3, sz, goods);
          part('hemi', ['#e3a21a', '#6b3d1e', '#8a4b1c'][k], 0.3, 0.12, 0.3, sx, terrainHeight(sx, sz) + 0.6, sz, goods);
        }
      } else if (def.kind === 'pearls') {
        const im = new THREE.InstancedMesh(pearlGeo, pearlMat, 260);
        const mm = new THREE.Matrix4();
        let k = 0;
        // trays of loose pearls
        for (let t = 0; t < 3; t++) {
          const o = -1.2 + t * 1.2;
          part('cyl', '#c9a13e', 0.32, 0.04, 0.32, cx + along.x * o, cy - 0.13, cz + along.z * o, goods, MATERIALS.gold);
          for (let q = 0; q < 40; q++) {
            const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * 0.27;
            mm.makeTranslation(cx + along.x * o + Math.cos(a) * rr, cy - 0.08 + Math.random() * 0.03, cz + along.z * o + Math.sin(a) * rr);
            im.setMatrixAt(k++, mm);
          }
        }
        // strings hanging from the canopy rail
        for (let s = 0; s < 7; s++) {
          const o = -1.6 + s * 0.53;
          for (let q = 0; q < 20; q++) {
            const yy = g + 2.75 - q * 0.05;
            mm.makeTranslation(cx + along.x * o, yy, cz + along.z * o);
            if (k < 260) im.setMatrixAt(k++, mm);
          }
        }
        im.count = k;
        goods.add(im);
      } else if (def.kind === 'diamonds') {
        part('box', '#2a1e3a', 1.6, 0.05, 0.5, cx, cy - 0.12, cz, goods).rotation.y = yaw;
        for (let q = 0; q < 14; q++) {
          const o = rand(-0.7, 0.7);
          const d = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.03, 0.07)), diamondMat);
          d.position.set(cx + along.x * o + fx * rand(-0.15, 0.15), cy - 0.05, cz + along.z * o + fz * rand(-0.15, 0.15));
          goods.add(d);
          this.sparkles.push(d);
        }
        // a locked chest and a guard
        part('box', '#5a3d22', 0.9, 0.6, 0.6, x - fx * 0.6 + along.x * 1.3, g + 0.8, z - fz * 0.6 + along.z * 1.3, goods, MATERIALS.wood);
      } else if (def.kind === 'cloth') {
        const tex = [printedCloth('#b5294e', '#1b1410', 2), printedCloth('#e0c08a', '#7a1c1c', 3), printedCloth('#2f6f8f', '#f2e6c8', 4)];
        for (let q = 0; q < 3; q++) {
          const o = -1.3 + q * 1.3;
          const c = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.9), new THREE.MeshLambertMaterial({ map: tex[q], side: THREE.DoubleSide }));
          c.position.set(x + along.x * o - fx * 0.6, g + 1.7, z + along.z * o - fz * 0.6);
          c.rotation.y = yaw;
          goods.add(c);
        }
        for (let q = 0; q < 4; q++) part('box', pick(['#b5294e', '#e0c08a', '#2f6f8f', '#3d7a4a']), 0.7, 0.12, 0.45, cx + along.x * (-1.2 + q * 0.8), cy - 0.08 + 0.0, cz + along.z * (-1.2 + q * 0.8), goods).rotation.y = yaw;
      } else if (def.kind === 'bangles') {
        for (let q = 0; q < 6; q++)
          for (let s = 0; s < 6; s++) {
            const ring = part('torus', pick(['#b5294e', '#e0a526', '#2f6f8f', '#3d7a4a', '#f2c14e']), 0.06, 0.06, 0.06, cx + along.x * (-1.4 + q * 0.55), cy - 0.05 + s * 0.035, cz + along.z * (-1.4 + q * 0.55), goods);
            ring.rotation.x = Math.PI / 2;
          }
      } else if (def.kind === 'fruit') {
        for (let q = 0; q < 4; q++) {
          const o = -1.3 + q * 0.85;
          const basket = Props.basket(['#f2a516', '#e8c252', '#7a9a2a', '#f2a516'][q]);
          basket.position.set(cx + along.x * o, cy - 0.15, cz + along.z * o);
          goods.add(basket);
        }
        part('box', '#d9c25a', 0.25, 0.8, 0.25, x - fx * 0.8, g + 2.2, z - fz * 0.8, goods); // bananas hanging
      } else if (def.kind === 'copper') {
        for (let q = 0; q < 6; q++) {
          const pot = Props.pot('#c46a32');
          pot.position.set(cx + along.x * (-1.5 + q * 0.6), cy - 0.15, cz + along.z * (-1.5 + q * 0.6));
          pot.scale.setScalar(rand(0.8, 1.1));
          goods.add(pot);
        }
      }

      // vendor sitting behind the counter
      const female = !!def.female;
      const vendor = female
        ? new Human({ female: true, top: pick(['#e0a526', '#7b2d4f']), skirt: pick(['#c9472b', '#3d7a4a', '#2f6f8f']), sleeves: true, head: 'veil', headColor: '#e0a526', bangles: true })
        : new Human({ top: pick(['#f2ead8', '#e7d9b8']), sleeves: true, bottom: '#efe6d2', head: pick(['pagri', 'turban', 'cap']), headColor: pick(['#c93a2a', '#e0a526', '#f4efe2']), beard: Math.random() < 0.6 });
      vendor.pose = 'sitTalk';
      const vx = x - fx * 0.4, vz = z - fz * 0.4;
      pop.add(vendor, { x: vx, z: vz, yaw, role: 'vendor', name: def.name, lines: [def.greet] });
      vendor.root.position.y = g + 0.5;
      vendor.stall = def;
      fort.torches.push({ x: x + fx * (D / 2 + 0.3) + along.x * 2.3, y: g + 2.4, z: z + fz * (D / 2 + 0.3) + along.z * 2.3 });
      this.stalls.push({ def, x, z, yaw, vendor, front: { x: x + fx * (D / 2 + 1.3), z: z + fz * (D / 2 + 1.3) } });
    });
    b.build(scene);

    // ---- shoppers ----
    this.shoppers = [];
    for (let i = 0; i < 24; i++) {
      const h = randomCitizen();
      if (Math.random() < 0.3) {
        h.pose = 'carryHead';
        const bk = Props.basket(pick(['#e2b13c', '#f2a516', '#7a9a2a']));
        bk.position.y = 0.2;
        h.attach(bk, 'head');
      }
      h.basePose = h.pose;
      const st = pick(this.stalls);
      pop.add(h, { x: st.front.x + rand(-2, 2), z: rand(-4, 4), role: 'shopper', lines: [pick(SHOPPER_LINES), pick(SHOPPER_LINES)] });
      h.state = 'walk';
      h.target = this.randomTarget();
      h.wait = rand(0, 5);
      this.shoppers.push(h);
    }
    // two pairs of hagglers who stay put
    for (let i = 0; i < 2; i++) {
      const st = this.stalls[i * 3 + 1];
      const a = randomCitizen(), c = randomCitizen();
      a.pose = c.pose = 'talk';
      const p = st.front;
      pop.add(a, { x: p.x - 0.8, z: p.z, yaw: Math.PI / 2, role: 'shopper', lines: ['Ten! Not a dam more!', 'You call this a pearl? It is a grain of rice!'] });
      pop.add(c, { x: p.x + 0.8, z: p.z, yaw: -Math.PI / 2, role: 'shopper', lines: ['Fifteen, and I am robbing my own children.', 'Go to the next stall then. They will cheat you twice!'] });
    }
    audio?.addSource('market', { x: (BAZAAR.x0 + BAZAAR.x1) / 2, y: 1, z: 0 });
  }

  randomTarget() {
    if (Math.random() < 0.65) {
      const st = pick(this.stalls);
      return { x: st.front.x + rand(-1.2, 1.2), z: st.front.z + rand(-0.4, 0.4), stall: st };
    }
    return { x: rand(BAZAAR.x0 - 6, BAZAAR.x1 + 4), z: rand(-4.5, 4.5) };
  }

  update(dt, t, king) {
    for (const d of this.sparkles) d.rotation.y += dt * 2;
    for (const h of this.shoppers) {
      const p = h.root.position;
      // bow when the Sultan passes close by
      if (king && (p.x - king.x) ** 2 + (p.z - king.z) ** 2 < 120) {
        h.speed = 0;
        h.pose = 'bow';
        turnTowards(h.root, yawTo(king.x - p.x, king.z - p.z), dt, 4);
        continue;
      }
      if (h.pose === 'bow') h.pose = h.basePose;
      if (h.wait > 0) {
        h.wait -= dt;
        h.speed = 0;
        if (h.target?.stall) {
          const v = h.target.stall.vendor.root.position;
          turnTowards(h.root, yawTo(v.x - p.x, v.z - p.z), dt, 4);
          if (h.basePose !== 'carryHead') h.pose = 'talk';
        }
        if (h.wait <= 0) { h.target = this.randomTarget(); h.pose = h.basePose; }
        continue;
      }
      if (this.pop.walkTo(h, h.target.x, h.target.z, 1.15, dt)) h.wait = h.target.stall ? rand(4, 10) : rand(1, 3);
    }
  }
}
