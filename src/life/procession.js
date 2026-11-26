// The Sultan's procession: heralds, kettle-drums, banners, the royal
// elephant, spearmen, the Sultan beneath his parasol, nobles and servants.
import { PROCESSION, PROCESSION_STOPS, CONSTRUCTION, BALA_HISAR } from '../world/layout.js';
import { Human, Elephant, Props } from './characters.js';
import { pick } from '../core/util.js';
import { yawTo, turnTowards } from './npc.js';

const GUARD_LINES = [
  'Make way! Make way for Sultan Quli Qutb-ul-Mulk!',
  'Keep your distance from the Sultan, stranger.',
  'We march with him from Bhagnagar to the summit and back, every day the walls rise.',
];
const KING_LINES = [
  'Ah, a traveller. Look around you - Golconda grows stronger with every stone.',
  'The Kakatiyas built this hill fort of mud. I shall leave it in granite, for a hundred generations.',
  'Our diamonds and pearls will be known in every court from Persia to Portugal. Mark my words.',
  'Visit the dance court tonight. Even a Sultan needs his music.',
];
const NOBLE_LINES = [
  'His Majesty inspects the rampart himself. Nothing escapes his eye.',
  'I am the Peshwa of the treasury. Every one of these stones is paid for in gold huns.',
];

export class Procession {
  constructor(scene, pop, audio) {
    this.pop = pop;
    this.audio = audio;
    this.path = PROCESSION;
    this.s = 40;
    this.speed = 0;
    this.maxSpeed = 1.1;
    this.stopIdx = 0;
    while (this.stopIdx < PROCESSION_STOPS.length && PROCESSION_STOPS[this.stopIdx].s < this.s) this.stopIdx++;
    this.pause = 0;
    this.members = [];
    this.beatT = 0;
    this.status = 'marching';

    const guard = () => {
      const h = new Human({ top: '#c9472b', sleeves: true, longSleeves: true, bottom: '#efe6d2', trousers: true, vest: '#7a1c1c', head: 'helmet', beard: true, sash: '#e0a526' });
      h.pose = 'holdStaff';
      h.attach(Props.spear(), 'handR');
      return h;
    };
    const add = (actor, back, lat, extra = {}) => {
      this.pop.add(actor, { role: extra.role || 'guard', lines: extra.lines || GUARD_LINES, name: extra.name, talk: extra.talk ?? true });
      this.members.push({ actor, back, lat, pose: actor.pose });
      return actor;
    };
    // heralds with long brass horns
    for (const lat of [-1, 1]) {
      const h = new Human({ top: '#e0a526', sleeves: true, bottom: '#efe6d2', trousers: true, head: 'pagri', headColor: '#c93a2a' });
      h.pose = 'trumpet';
      h.attach(Props.horn(), 'handR');
      add(h, 0, lat * 1.1, { role: 'herald' });
    }
    // kettle drummers
    this.drummers = [];
    for (const lat of [-1, 1]) {
      const h = new Human({ top: '#7a1c1c', sleeves: true, bottom: '#efe6d2', trousers: true, head: 'pagri', headColor: '#e0a526' });
      h.pose = 'nagara';
      const d = Props.nagaraDrum();
      d.position.set(0, 0.0, 0.32);
      h.torso.add(d);
      add(h, -3, lat * 1.1, { role: 'drummer' });
      this.drummers.push(h);
    }
    // banners
    for (const lat of [-1, 1]) {
      const h = new Human({ top: '#2a7a3b', sleeves: true, bottom: '#efe6d2', trousers: true, head: 'pagri', headColor: '#f4efe2' });
      h.pose = 'holdHigh';
      h.attach(Props.flag(lat < 0 ? '#2a7a3b' : '#e0a526'), 'handR');
      add(h, -6.5, lat * 1.4, { role: 'banner' });
    }
    // royal elephant with mahout
    this.elephant = new Elephant({ royal: true });
    const mahout = new Human({ top: null, bottom: '#efe6d2', head: 'turban', headColor: '#c93a2a', pose: 'sit' });
    if (this.elephant.real) mahout.root.position.set(0, this.elephant.backY + 0.05, 1.05);
    else mahout.root.position.set(0, 3.35, 1.4);
    mahout.pose = 'ride';
    this.elephant.body.add(mahout.root);
    this.mahout = mahout;
    this.pop.add(this.elephant, { role: 'elephant', talk: false });
    this.members.push({ actor: this.elephant, back: -11.5, lat: 0 });
    // spearmen
    for (let i = 0; i < 4; i++) add(guard(), -16 - (i >> 1) * 1.8, (i % 2 ? 1 : -1) * 1.7);
    // the Sultan
    this.king = new Human({
      scale: 1.04, top: '#f3e3b0', sleeves: true, longSleeves: true, robe: '#f6edd2', sash: '#2a7a3b',
      head: 'royal', headColor: '#f4efe2', beard: true, jewels: true, shoes: '#9c1b25', skin: '#a06a45',
    });
    this.king.pose = 'idle';
    add(this.king, -20.5, 0, { role: 'king', lines: KING_LINES, name: 'Sultan Quli Qutb-ul-Mulk' });
    const parasolBearer = new Human({ top: '#f2ead8', sleeves: true, bottom: '#efe6d2', head: 'turban', headColor: '#e2b13c' });
    parasolBearer.pose = 'holdHigh';
    const ps = Props.parasol('#c4161c');
    parasolBearer.attach(ps, 'handR');
    add(parasolBearer, -21.4, 0.25, { role: 'servant', lines: ['I hold the royal chhatri. The sun must never touch His Majesty.'] });
    for (const lat of [-1, 1]) {
      const h = new Human({ top: '#f2ead8', sleeves: true, bottom: '#efe6d2', head: 'turban', headColor: '#f4efe2' });
      h.pose = 'fan';
      h.attach(Props.chamara(), 'handR');
      add(h, -20.8, lat * 1.05, { role: 'servant', lines: ['The yak-tail fan keeps the flies from the Sultan.'] });
    }
    // nobles
    for (let i = 0; i < 3; i++) {
      const h = new Human({ top: pick(['#e7d9b8', '#e0a526', '#efe3c8']), sleeves: true, longSleeves: true, robe: pick(['#efe3c8', '#e7d9b8', '#f2ead8']), sash: pick(['#c9472b', '#2f6f8f', '#7b2d4f']), head: 'pagri', headColor: pick(['#c93a2a', '#e0a526', '#2f6f8f']), beard: true, jewels: i === 1 });
      h.pose = 'idle';
      add(h, -24 - (i === 1 ? 0.6 : 0), (i - 1) * 1.5, { role: 'noble', lines: NOBLE_LINES });
    }
    // rear guard
    for (let i = 0; i < 4; i++) add(guard(), -27.5 - (i >> 1) * 1.8, (i % 2 ? 1 : -1) * 1.5);
    // servants with gifts
    for (const lat of [-0.8, 0.8]) {
      const h = new Human({ top: null, bottom: '#efe6d2', head: 'turban' });
      h.pose = 'carryFront';
      const tray = Props.tray(lat < 0 ? '#e2b13c' : '#f0f0f0');
      tray.position.set(0, -0.05, 0.1);
      h.attach(tray, 'handL');
      add(h, -31.5, lat, { role: 'servant', lines: ['Gifts for the workers - sweets and betel leaves.'] });
    }
  }

  get kingPos() { return this.king.root.position; }

  update(dt) {
    // ---- leader motion with stops ----
    const stop = PROCESSION_STOPS[this.stopIdx];
    let target = this.maxSpeed;
    if (this.pause > 0) {
      this.pause -= dt;
      target = 0;
      if (this.pause <= 0) {
        this.stopIdx = (this.stopIdx + 1) % PROCESSION_STOPS.length;
        this.status = 'marching';
      }
    } else if (stop && this.s + 0 >= stop.s - 0.05 && this.s <= stop.s + 1 && this.stopIdx >= 0) {
      this.pause = stop.dur;
      this.status = stop.label;
      this.s = stop.s;
      target = 0;
    } else if (stop) {
      const remaining = stop.s - this.s;
      if (remaining > 0 && remaining < 3) target = Math.max(0.25, this.maxSpeed * (remaining / 3));
    }
    this.speed += (target - this.speed) * Math.min(1, dt * 1.5);
    this.s += this.speed * dt;
    if (this.s >= this.path.length) {
      this.s -= this.path.length;
    }
    // the king's group stops at the *king's* position, so shift by his offset
    const L = this.path.length;
    const pt = {};
    for (const m of this.members) {
      let s = this.s + m.back + 20.5; // king is the reference
      s = ((s % L) + L) % L;
      this.path.at(s, pt);
      const nx = -pt.dz, nz = pt.dx;
      const a = m.actor;
      const r = a.root.position;
      const x = pt.x + nx * m.lat, z = pt.z + nz * m.lat;
      r.x = x; r.z = z;
      this.pop.ground(a);
      a.speed = this.speed;
      const yaw = yawTo(pt.dx, pt.dz);
      turnTowards(a.root, yaw, dt, 3);
    }
    if (this.pause > 0) {
      // face what the Sultan is looking at
      let look = null;
      if (this.status.includes('walls')) look = CONSTRUCTION.mid;
      else if (this.status.includes('Bala')) look = { x: BALA_HISAR.x, z: BALA_HISAR.z - 10 };
      if (look) {
        const kp = this.king.root.position;
        turnTowards(this.king.root, yawTo(look.x - kp.x, look.z - kp.z), dt, 2);
        this.king.pose = 'talk';
      }
      for (const m of this.members) if (m.actor.role === 'noble') m.actor.pose = 'namaste';
    } else {
      this.king.pose = 'idle';
      for (const m of this.members) if (m.actor.role === 'noble') m.actor.pose = 'idle';
    }
    this.mahout.update(dt);

    // kettle drums: DHUM . dhum . DHUM dhum dhum .
    this.beatT += dt;
    const beat = 0.42;
    if (this.beatT > beat) {
      this.beatT -= beat;
      this.beatN = ((this.beatN || 0) + 1) % 8;
      const pattern = [1, 0, 0.6, 0, 1, 0.6, 0.6, 0];
      const v = pattern[this.beatN];
      if (v && this.audio) this.audio.nagara(this.drummers[this.beatN % 2].root.position, v);
      if (this.beatN === 0 && this.audio && Math.random() < 0.25) this.audio.horn(this.members[0].actor.root.position);
    }
  }
}
