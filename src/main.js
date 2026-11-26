import * as THREE from 'three';
import { Physics } from './core/physics.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Hud, PLACES } from './core/hud.js';
import { Player } from './core/player.js';
import { initMaterials } from './world/builder.js';
import { buildTerrain } from './world/terrain.js';
import { Fort } from './world/fort.js';
import { Sky } from './world/sky.js';
import { ZONES, PORTICO, BAZAAR, DANCE, CONSTRUCTION, TEMPLE, PROCESSION_VIEW } from './world/layout.js';
import { Population } from './life/npc.js';
import { Construction } from './life/construction.js';
import { Procession } from './life/procession.js';
import { DanceCourt } from './life/dance.js';
import { Bazaar } from './life/bazaar.js';
import { Townsfolk } from './life/townsfolk.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2500);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const input = new Input(canvas);
const audio = new Audio();
const hud = new Hud();
const state = { coins: 60, inventory: [], zone: null, danceTime: 0, constructionTime: 0, lastProcAlert: -999, lineIdx: new Map(), talking: null };
let world;

function buildWorld() {
  initMaterials();
  const physics = new Physics();
  buildTerrain(scene);
  const fort = new Fort(scene, physics);
  const pop = new Population(scene, physics);
  // the dance court and bazaar add torches, so they must exist before fort.build() lights them
  fort.outerWall();
  fort.citadelWall();
  fort.fatehDarwaza();
  fort.banjaraGate();
  fort.portico();
  fort.balaHisar();
  fort.temple();
  fort.palace();
  fort.tank();
  const dance = new DanceCourt(scene, physics, pop, audio, fort);
  const bazaar = new Bazaar(scene, physics, pop, audio, fort);
  fort.houses();
  fort.scenery();
  fort.batch.build(scene);
  fort.buildTorches();
  const construction = new Construction(scene, physics, pop, audio);
  const procession = new Procession(scene, pop, audio);
  const town = new Townsfolk(scene, physics, pop, fort);
  const sky = new Sky(scene, renderer);
  const player = new Player(scene, physics, camera);
  player.spawn(224, 0.5, -Math.PI / 2);
  hud.buildMapImage(fort);
  // a handful of warm lights for night time in the busiest places
  const lights = [];
  for (const [x, z] of [[150, 0], [DANCE.x, DANCE.z], [PORTICO.x, 0], [0, 10]]) {
    const l = new THREE.PointLight('#ffb060', 0, 38, 1.6);
    l.position.set(x, physics.groundAt(x, z) + 4, z);
    scene.add(l);
    lights.push(l);
  }
  world = { physics, fort, pop, construction, procession, dance, bazaar, town, sky, player, lights };
}

// ------------------------------------------------------------ helpers --
function addItem(item) {
  const have = state.inventory.find((i) => i.id === item.id);
  if (have) have.qty++;
  else state.inventory.push({ id: item.id, name: item.name, qty: 1 });
  hud.renderJournal(state.inventory);
}

function openShop(stall) {
  stall.haggled ??= new Set();
  const refresh = () => hud.shop(stall, state.coins, buy, haggle);
  const buy = (i) => {
    const it = stall.def.items[i];
    if (state.coins < it.price) return;
    state.coins -= it.price;
    addItem(it);
    audio.coin();
    stall.lastLine = `${it.name}? An excellent choice. May it bring you fortune!`;
    if (stall.def.kind === 'pearls') hud.complete('pearls', audio);
    if (stall.def.kind === 'spices') hud.complete('spices', audio);
    refresh();
  };
  const haggle = (i) => {
    const it = stall.def.items[i];
    stall.haggled.add(i);
    if (Math.random() < 0.6) {
      const old = it.price;
      it.price = Math.max(1, Math.round(it.price * 0.7));
      stall.lastLine = `Arre, you drive a hard bargain! Fine - ${it.price} huns instead of ${old}. Only for you.`;
    } else {
      it.price = Math.round(it.price * 1.1 + 0.5);
      stall.lastLine = 'Haggle with me? For that insult the price goes UP. Take it or leave it.';
    }
    refresh();
  };
  stall.lastLine = stall.def.greet;
  state.shopActions = { buy: (i) => i < stall.def.items.length && buy(i), haggle: (i) => i < stall.def.items.length && !stall.haggled.has(i) && haggle(i) };
  refresh();
}

function talkTo(actor) {
  const { player } = world;
  if (actor.stall) {
    const stall = world.bazaar.stalls.find((s) => s.vendor === actor);
    return openShop(stall);
  }
  const lines = actor.lines || ['...'];
  const i = state.lineIdx.get(actor) ?? 0;
  state.lineIdx.set(actor, (i + 1) % lines.length);
  const name = actor.name || ({ worker: 'Stone porter', mason: 'Mason', guard: 'Guard', herald: 'Herald', drummer: 'Kettle-drummer', banner: 'Standard bearer', servant: 'Royal servant', noble: 'Noble', citizen: 'Townsperson', shopper: 'Shopper', dancer: 'Dancer', musician: 'Musician', audience: 'Spectator', water: 'Water bearer', courtier: 'Courtier', priest: 'Priest' }[actor.role] || 'Stranger');
  let text = lines[i];
  if (actor.role === 'king' && player.greeted) text = 'You have good manners, traveller. ' + text;
  hud.say(name, text);
  state.talking = actor;
  // they turn to face you
  const p = player.pos, r = actor.root.position;
  if (!['king', 'herald', 'drummer', 'banner', 'guard', 'servant', 'noble', 'dancer'].includes(actor.role) || actor.role === 'guard') {
    actor.root.rotation.y = Math.atan2(p.x - r.x, p.z - r.z);
  }
}

function nearestTalkable() {
  const { player, pop } = world;
  let best = null, bd = 2.9;
  const f = player.forward;
  for (const a of pop.actors) {
    if (!a.talkable) continue;
    const r = a.root.position;
    const dx = r.x - player.pos.x, dz = r.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (Math.abs(r.y - player.pos.y) > 2.5) continue;
    const facing = (dx * f.x + dz * f.z) / (d || 1);
    const score = d - facing * 0.8;
    if (score < bd) { bd = score; best = a; }
  }
  return best;
}

function zoneAt(x, z) {
  for (const zz of ZONES) if (Math.hypot(x - zz.x, z - zz.z) < zz.r) return zz;
  return ZONES[ZONES.length - 1];
}

function travel(place) {
  const { player } = world;
  player.spawn(place.spawn.x, place.spawn.z, Math.atan2(place.x - place.spawn.x, place.z - place.spawn.z));
  hud.toast(`You make your way to <b>${place.name}</b>.`);
}

// --------------------------------------------------------------- loop --
const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  const W = world;
  const { player, sky, pop } = W;
  const panelOpen = hud.open === 'journal' || hud.open === 'map' || hud.open === 'help';

  // ---- input ----
  if (input.hit('KeyJ')) hud.toggleJournal();
  if (input.hit('KeyM')) hud.showMap({ x: player.pos.x, z: player.pos.z }, W.procession.kingPos, travel);
  if (input.hit('KeyH')) {
    const h = document.getElementById('help');
    const show = hud.open !== 'help';
    hud.close();
    h.classList.remove('show');
    if (show) { h.classList.add('show'); hud.open = 'help'; }
  }
  if (input.hit('Escape')) { hud.close(); document.getElementById('help').classList.remove('show'); }
  if (input.hit('KeyN')) { audio.setMuted(audio.enabled); hud.toast(audio.enabled ? 'Sound on' : 'Sound off'); }
  if (input.hit('KeyT')) { sky.hour = (sky.hour + 2) % 24; hud.toast(`Two hours pass… <b>${sky.timeLabel}</b>`); }
  const inPortico = Math.hypot(player.pos.x - PORTICO.x, player.pos.z - PORTICO.z) < 5;
  if (input.hit('KeyC') || input.hit('Digit3')) {
    player.setEmote('clap', 1.2);
    audio.clap(inPortico);
    if (inPortico) {
      setTimeout(() => hud.toast('Your clap rings around the dome… and a moment later a faint answer drifts down from <b>Bala Hisar</b>, a kilometre above.'), 1200);
      hud.complete('clap', audio);
    }
  }
  if (hud.open === 'shop' && state.shopActions) {
    for (let i = 0; i < 4; i++) if (input.hit('Digit' + (i + 1))) {
      if (input.down('ShiftLeft') || input.down('ShiftRight')) state.shopActions.haggle(i); else state.shopActions.buy(i);
      input.pressed.delete('Digit' + (i + 1));
    }
  }
  if (input.hit('Digit1') || input.hit('KeyB')) {
    player.setEmote('namaste', 2.2);
    const kp = W.procession.kingPos;
    if (Math.hypot(kp.x - player.pos.x, kp.z - player.pos.z) < 9) {
      player.greeted = true;
      hud.complete('greet', audio);
      hud.say('Sultan Quli Qutb-ul-Mulk', 'The Sultan inclines his head. "May Golconda be kind to you, traveller."');
    }
  }
  if (input.hit('Digit2')) player.setEmote('dance', 5);

  if (input.hit('KeyE') || input.hit('Enter')) {
    if (hud.open === 'dialog' && state.talking) {
      const a = state.talking;
      const d = Math.hypot(a.root.position.x - player.pos.x, a.root.position.z - player.pos.z);
      if (d < 4) talkTo(a); else hud.close();
    } else if (hud.open === 'shop') {
      hud.close();
    } else {
      const a = nearestTalkable();
      if (a) talkTo(a);
    }
  }
  // close conversations when walking away
  if ((hud.open === 'dialog' || hud.open === 'shop') && state.talking) {
    const a = state.talking.root.position;
    if (Math.hypot(a.x - player.pos.x, a.z - player.pos.z) > 5) { hud.close(); state.talking = null; }
  }
  if (hud.open === 'shop' && !state.talking) {
    // shop opened via vendor; track vendor for distance
  }

  input.enabled = !panelOpen;
  // ---- simulation ----
  player.update(dt, input, pop.actors);
  input.enabled = true;
  W.construction.update(dt, elapsed, player.pos);
  W.procession.update(dt);
  W.dance.update(dt);
  const king = W.procession.kingPos;
  W.bazaar.update(dt, elapsed, king);
  W.town.update(dt, king);
  pop.update(dt, camera.position);
  sky.update(dt, player.pos);
  W.fort.update(dt, elapsed, sky.night);
  for (const l of W.lights) l.intensity = sky.night * 60 * (0.9 + Math.sin(elapsed * 13 + l.position.x) * 0.1);
  audio.update(dt, { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: player.yaw + Math.PI }, { night: sky.night });

  // ---- world events / journal ----
  const zone = zoneAt(player.pos.x, player.pos.z);
  if (zone !== state.zone) {
    if (state.zone && zone.name !== 'Golconda' || (zone.name === 'Golconda' && state.zone?.name === 'The Deccan Plain')) hud.showBanner(zone.name, zone.sub);
    if (!state.zone) hud.showBanner(zone.name, zone.sub);
    state.zone = zone;
    if (zone.name === 'Fateh Darwaza' || (zone.name !== 'The Deccan Plain' && Math.hypot(player.pos.x, player.pos.z) < 185)) hud.complete('gate', audio);
    if (zone.name === 'Moti Bazaar') hud.complete('bazaar', audio);
    if (zone.name === 'Mahakali Shrine') hud.complete('temple', audio);
  }
  if (Math.hypot(player.pos.x, player.pos.z + 4) < 13 && player.pos.y > W.fort.hallFloorY - 0.2) hud.complete('summit', audio);
  if (Math.hypot(player.pos.x - DANCE.x, player.pos.z - DANCE.z) < 16) {
    state.danceTime += dt;
    if (state.danceTime > 12) hud.complete('dance', audio);
  }
  const cm = CONSTRUCTION.mid;
  if (Math.hypot(player.pos.x - (cm.x + CONSTRUCTION.inward.x * 14), player.pos.z - (cm.z + CONSTRUCTION.inward.z * 14)) < 30) {
    state.constructionTime += dt;
    if (state.constructionTime > 10) hud.complete('construction', audio);
  }
  const kd = Math.hypot(king.x - player.pos.x, king.z - player.pos.z);
  if (kd < 75 && elapsed - state.lastProcAlert > 120) {
    state.lastProcAlert = elapsed;
    hud.toast('Drums! <b>The Sultan\'s procession</b> approaches. Bow (1) as he passes.', 'royal');
  }
  if (kd < 22) hud.complete('procession', audio);

  // ---- prompt ----
  if (!hud.open) {
    const a = nearestTalkable();
    if (a) hud.setPrompt(`<b>[E]</b> ${a.stall ? 'Trade with' : 'Talk to'} ${a.name || ({ worker: 'the porter', mason: 'the mason', guard: 'the guard', citizen: 'the townsperson', shopper: 'the shopper', dancer: 'the dancer', musician: 'the musician', audience: 'the spectator', noble: 'the noble', courtier: 'the courtier', servant: 'the servant', herald: 'the herald', drummer: 'the drummer', banner: 'the standard bearer', water: 'the water bearer', priest: 'the priest' }[a.role] || 'them')}`);
    else if (inPortico) hud.setPrompt('<b>[C]</b> Clap beneath the dome');
    else hud.setPrompt('');
  } else hud.setPrompt('');

  hud.setStatus(state.coins, sky.timeLabel);
  hud.drawMini({ x: player.pos.x, z: player.pos.z, facing: player.model.root.rotation.y }, player.yaw, king);
  input.endFrame();
  renderer.render(scene, camera);
  window.__calls = renderer.info.render.calls;
}

// -------------------------------------------------------------- start --
const startBtn = document.getElementById('start');
setTimeout(() => {
  const t0 = performance.now();
  buildWorld();
  console.log(`world built in ${Math.round(performance.now() - t0)} ms, ${world.pop.actors.length} actors`);
  renderer.compile(scene, camera);
  startBtn.disabled = false;
  startBtn.textContent = 'Enter Golconda';
  frame();
}, 30);
startBtn.addEventListener('click', () => {
  document.getElementById('intro').classList.add('hide');
  audio.start();
  if (input.canLock) canvas.requestPointerLock?.();
  setTimeout(() => hud.toast('Walk west through <b>Fateh Darwaza</b>. Press <b>J</b> for your journal, <b>M</b> for the map.'), 1200);
});
window.__game = () => world;
void BAZAAR; void TEMPLE; void PROCESSION_VIEW; void PLACES;
