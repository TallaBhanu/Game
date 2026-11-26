// Nritya Mandap: a raised court where dancers perform to drums and strings.
import * as THREE from 'three';
import { DANCE } from '../world/layout.js';
import { terrainHeight } from '../world/terrain.js';
import { MATERIALS, StaticBatch, boxGeo } from '../world/builder.js';
import { stripes, printedCloth } from '../core/textures.js';
import { Human, Props, part, randomCitizen } from './characters.js';
import { rand, pick, TAU } from '../core/util.js';
import { yawTo } from './npc.js';

const DANCER_LINES = [
  'We dance the old temple stories - Krishna and the gopis, Shiva\'s tandava.',
  'Watch the chakkar - the spins! My guru could turn a hundred times without falling.',
  'The ghungroo on my ankles have a hundred and one bells each.',
];
const MUSIC_LINES = [
  'Ta dhin dhin ta... the rhythm is sixteen beats. Can you feel it?',
  'This sarangi has forty strings. Only three are played, the rest sing along by themselves.',
  'Sit, listen. The raga changes with the hour of the day.',
];

export class DanceCourt {
  constructor(scene, physics, pop, audio, fort) {
    this.pop = pop;
    this.audio = audio;
    const { x, z, size } = DANCE;
    const base = terrainHeight(x, z);
    this.base = base;
    this.center = { x, z };
    const top = base + 0.5;
    this.top = top;
    const b = new StaticBatch();
    // platform: stone plinth with tiled floor
    b.box(size + 1, 1.5, size + 1, x, base - 0.25, z, 0, 'graniteWarm', 2);
    b.box(size, 0.05, size, x, top + 0.02, z, 0, 'floor', size);
    physics.addPlatform(x, z, (size + 1) / 2, (size + 1) / 2, 0, top);
    // carved pillars and a cloth canopy (shamiana)
    const ps = size / 2 - 0.4;
    for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, -1], [0, 1], [1, 0], [-1, 0]]) {
      const cx = x + px * ps, cz = z + pz * ps;
      b.add(new THREE.CylinderGeometry(0.28, 0.32, 4.6, 10), 'plasterWhite', cx, top + 2.3, cz);
      b.box(0.8, 0.35, 0.8, cx, top + 0.17, cz, 0, 'plasterOchre', 1);
      b.box(0.8, 0.35, 0.8, cx, top + 4.6, cz, 0, 'plasterOchre', 1);
      physics.addCircle(cx, cz, 0.35, top + 5);
      fort.torches.push({ x: cx + px * 0.7, y: top + 2.6, z: cz + pz * 0.7 });
    }
    b.build(scene);
    const cloth = new THREE.Mesh(
      new THREE.ConeGeometry(size * 0.78, 2.2, 4, 1, true),
      new THREE.MeshLambertMaterial({ map: stripes('#b5294e', '#e0a526', 12), side: THREE.DoubleSide }),
    );
    cloth.position.set(x, top + 5.9, z);
    cloth.rotation.y = Math.PI / 4;
    cloth.castShadow = true;
    scene.add(cloth);
    // marigold garlands hanging between pillars
    const garland = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 5, 4), new THREE.MeshLambertMaterial({ color: '#f28c1b' }), 8 * 18);
    const m = new THREE.Matrix4();
    let k = 0;
    const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      for (let j = 0; j < 36; j++) {
        const t = j / 35;
        const sag = Math.sin(((t * 2) % 1) * Math.PI) * 0.6;
        m.makeTranslation(x + (ax + (bx - ax) * t) * ps, top + 4.4 - sag, z + (az + (bz - az) * t) * ps);
        garland.setMatrixAt(k++, m);
      }
    }
    scene.add(garland);
    // carpets for the audience
    const rug = new THREE.MeshLambertMaterial({ map: printedCloth('#8a1c1c', '#e0a526', 4) });
    for (const [ox, oz, w, d, r] of [[0, size / 2 + 4, 10, 3.4, 0], [-size / 2 - 3.5, 2, 3, 8, 0], [size / 2 + 3.5, 2, 3, 8, 0]]) {
      const rm = new THREE.Mesh(boxGeo(w, 0.04, d, 2), rug);
      rm.position.set(x + ox, terrainHeight(x + ox, z + oz) + 0.03, z + oz);
      rm.rotation.y = r;
      rm.receiveShadow = true;
      scene.add(rm);
    }

    // ---- performers ----
    this.dancers = [];
    const dancerColors = [['#b5294e', '#e0a526'], ['#2f6f8f', '#f2c14e'], ['#3d7a4a', '#e05a2b']];
    for (let i = 0; i < 3; i++) {
      const [skirt, top2] = dancerColors[i];
      const d = new Human({ female: true, skirt, top: top2, sleeves: true, head: 'hair', bangles: true, jewels: true, scale: 0.94, dupatta: skirt });
      d.pose = 'dance';
      pop.add(d, { x, z, role: 'dancer', lines: DANCER_LINES, name: i === 0 ? 'Lead Dancer' : null });
      d.root.position.y = top;
      d.slot = i;
      this.dancers.push(d);
    }
    // musicians at the north edge facing south
    this.musicians = [];
    const mus = [
      { pose: 'drum', prop: 'dholak' },
      { pose: 'drum', prop: 'tabla' },
      { pose: 'sitTalk', prop: null },
      { pose: 'clap', prop: null },
    ];
    mus.forEach((mm, i) => {
      const h = new Human({ top: pick(['#f2ead8', '#e7d9b8']), sleeves: true, bottom: '#efe6d2', head: 'pagri', headColor: pick(['#c93a2a', '#e0a526', '#f4efe2']), beard: i % 2 === 0 });
      h.pose = mm.pose;
      const px = x - 3 + i * 2, pz = z - size / 2 + 1.6;
      pop.add(h, { x: px, z: pz, yaw: 0, role: 'musician', lines: MUSIC_LINES });
      h.root.position.y = top;
      if (mm.prop === 'dholak') { const dd = Props.dholak(); dd.position.set(0, 0.42, 0.42); h.root.add(dd); }
      if (mm.prop === 'tabla') {
        part('cyl', '#5a3a22', 0.12, 0.25, 0.12, -0.15, 0.35, 0.42, h.root);
        part('cyl', '#8a5a2a', 0.1, 0.22, 0.1, 0.15, 0.33, 0.42, h.root);
      }
      this.musicians.push(h);
    });
    // audience
    this.audience = [];
    const seat = (px, pz) => {
      const h = randomCitizen();
      h.pose = Math.random() < 0.3 ? 'clap' : 'sit';
      pop.add(h, { x: px, z: pz, yaw: yawTo(x - px, z - pz), role: 'audience', lines: ['Shh! The best part is coming.', 'I come here every evening after closing my shop.', 'Wah! Wah! Did you see that spin?'] });
      h.root.position.y = terrainHeight(px, pz) + 0.03;
      h.basePose = h.pose;
      this.audience.push(h);
    };
    for (let i = 0; i < 9; i++) seat(x - 4.5 + i * 1.1 + rand(-0.15, 0.15), z + size / 2 + 3.2 + (i % 2) * 1.1);
    for (let i = 0; i < 4; i++) seat(x - size / 2 - 3.5 + rand(-0.4, 0.4), z - 1 + i * 1.6);
    for (let i = 0; i < 4; i++) seat(x + size / 2 + 3.5 + rand(-0.4, 0.4), z - 1 + i * 1.6);
    // a noble on a cushioned seat
    const noble = new Human({ top: '#efe3c8', sleeves: true, longSleeves: true, robe: '#f2ead8', sash: '#7b2d4f', head: 'pagri', headColor: '#7b2d4f', beard: true, jewels: true });
    noble.pose = 'sit';
    part('box', '#7b2d4f', 1.2, 0.3, 1.0, x, terrainHeight(x, z + size / 2 + 6.5) + 0.15, z + size / 2 + 6.5, scene);
    pop.add(noble, { x, z: z + size / 2 + 6.5, yaw: Math.PI, role: 'noble', lines: ['I am the Kotwal of the fort. Even I take an evening off for such dancing.'] });
    noble.root.position.y += 0.3;
    this.t = 0;
    audio?.addSource('music', { x, y: top + 1, z });
  }

  update(dt) {
    this.t += dt;
    const { x, z } = this.center;
    const T = this.t;
    const cyc = T % 16;
    this.dancers.forEach((d, i) => {
      const r = d.root.position;
      if (i === 0) {
        // lead: still centre, spin bursts (chakkar)
        let spin = 0;
        if (cyc > 3 && cyc < 7) spin = Math.sin(((cyc - 3) / 4) * Math.PI) * 10;
        if (cyc > 11 && cyc < 13.5) spin = Math.sin(((cyc - 11) / 2.5) * Math.PI) * 12;
        d.spin = spin;
        d.root.rotation.y += spin * dt;
        if (spin < 0.5) d.root.rotation.y += (Math.PI - d.root.rotation.y % TAU) * 0; // keep heading
        r.x = x + Math.sin(T * 0.4) * 0.6; r.z = z + 0.5;
      } else {
        const a = T * 0.35 + (i === 1 ? 0 : Math.PI);
        r.x = x + Math.cos(a) * 3.2;
        r.z = z + Math.sin(a) * 2.6;
        let spin = cyc > 8 && cyc < 10 ? Math.sin(((cyc - 8) / 2) * Math.PI) * 9 : 0;
        d.spin = spin;
        if (spin > 0.5) d.root.rotation.y += spin * dt;
        else d.root.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)) + Math.sin(T * 2) * 0.4;
      }
      d.speed = 0;
      r.y = this.top;
    });
    // audience claps after a spin finishes
    const applause = (cyc > 7 && cyc < 9) || (cyc > 13.5 && cyc < 15);
    for (const a of this.audience) a.pose = applause ? 'clap' : a.basePose;
    if (applause && !this._clapped) { this._clapped = true; this.audio?.applause({ x, y: this.top, z }); }
    if (!applause) this._clapped = false;
  }
}
