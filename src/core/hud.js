// DOM heads-up display: location banner, prompts, dialogue, shop,
// journal, minimap and the full map with fast travel.
import { terrainHeight } from '../world/terrain.js';
import { STABLE, R_MIDDLE, ROAD, PROCESSION, R_OUTER, R_CITADEL, BAZAAR, DANCE, PALACE, TEMPLE, TANK, PORTICO, CONSTRUCTION, WORLD_R, BASTION_ANGLES } from '../world/layout.js';

const $ = (id) => document.getElementById(id);
export const releaseMouse = () => document.pointerLockElement && document.exitPointerLock();

export const OBJECTIVES = [
  { id: 'gate', text: 'Enter Golconda through Fateh Darwaza' },
  { id: 'ride', text: 'Ride a horse through Fateh Darwaza' },
  { id: 'cart', text: 'Drive a bullock cart (F)' },
  { id: 'clap', text: 'Clap beneath the portico at Bala Hisar Darwaza (C)' },
  { id: 'bazaar', text: 'Wander through the Moti Bazaar' },
  { id: 'pearls', text: 'Buy pearls from a pearl merchant' },
  { id: 'spices', text: 'Buy spices for the road' },
  { id: 'dance', text: 'Watch a performance at the Nritya Mandap' },
  { id: 'construction', text: 'Watch the masons at the Naya Qila works' },
  { id: 'procession', text: 'Witness the Sultan\'s procession' },
  { id: 'greet', text: 'Greet the Sultan with a namaste (1) when he is near' },
  { id: 'temple', text: 'Visit the Mahakali shrine on the hill' },
  { id: 'summit', text: 'Climb to the Durbar Hall of Bala Hisar' },
];

export const PLACES = [
  { name: 'Fateh Darwaza', x: 205, z: 0, icon: 'gate', above: true, spawn: { x: 200, z: 2 } },
  { name: 'Caravanserai', x: STABLE.x, z: STABLE.z, icon: 'horse', spawn: { x: STABLE.x, z: STABLE.z - 22 } },
  { name: 'Moti Bazaar', x: 150, z: 0, icon: 'bazaar', spawn: { x: 150, z: 2 } },
  { name: 'Nritya Mandap', x: DANCE.x, z: DANCE.z, icon: 'dance', spawn: { x: DANCE.x, z: DANCE.z + 15 } },
  { name: 'Naya Qila Works', x: CONSTRUCTION.mid.x + CONSTRUCTION.inward.x * 12, z: CONSTRUCTION.mid.z + CONSTRUCTION.inward.z * 12, icon: 'build', spawn: { x: CONSTRUCTION.mid.x + CONSTRUCTION.inward.x * 36, z: CONSTRUCTION.mid.z + CONSTRUCTION.inward.z * 36 } },
  { name: 'Royal Palace', x: PALACE.x, z: PALACE.z, icon: 'palace', spawn: { x: PALACE.x, z: PALACE.z - 22 } },
  { name: 'Bala Hisar', x: 0, z: -4, icon: 'crown', spawn: { x: 0, z: 20 } },
  { name: 'Mahakali Shrine', x: TEMPLE.x, z: TEMPLE.z, icon: 'temple', above: true, spawn: { x: TEMPLE.x + 9, z: TEMPLE.z } },
  { name: 'Step Tank', x: TANK.x, z: TANK.z, icon: 'water', spawn: { x: TANK.x, z: TANK.z + 14 } },
];

const ICONS = { horse: '♞', gate: '⛩', bazaar: '◆', dance: '♪', build: '⚒', palace: '◈', crown: '♛', temple: '▲', water: '≈' };

export class Hud {
  constructor() {
    this.banner = $('banner');
    this.prompt = $('prompt');
    this.dialog = $('dialog');
    this.toasts = $('toasts');
    this.coinsEl = $('coins');
    this.timeEl = $('time');
    this.journal = $('journal');
    this.mapPanel = $('mapPanel');
    this.mini = $('minimap');
    this.miniCtx = this.mini.getContext('2d');
    this.done = new Set();
    this.bannerTimer = 0;
    this.open = null; // 'dialog' | 'shop' | 'journal' | 'map'
    this.renderJournal();
  }

  // ------------------------------------------------------------ texts ---
  showBanner(name, sub) {
    this.banner.innerHTML = `<div class="b-name">${name}</div><div class="b-sub">${sub || ''}</div>`;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
  }
  setPrompt(text) {
    if (this._prompt === text) return;
    this._prompt = text;
    this.prompt.innerHTML = text || '';
    this.prompt.style.opacity = text ? 1 : 0;
  }
  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = text;
    this.toasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 5000);
  }
  setStatus(coins, time) {
    this.coinsEl.textContent = `${coins} huns`;
    this.timeEl.textContent = time;
  }

  complete(id, audio) {
    if (this.done.has(id)) return false;
    const o = OBJECTIVES.find((x) => x.id === id);
    if (!o) return false;
    this.done.add(id);
    this.toast(`<b>Journal</b> · ${o.text} <span class="tick">✓</span>`, 'journal');
    audio?.chime();
    this.renderJournal();
    if (this.done.size === OBJECTIVES.length) {
      setTimeout(() => this.toast('<b>You have seen Golconda as it was in 1518.</b> Wander on, traveller - the walls keep rising.', 'big'), 1500);
    }
    return true;
  }

  renderJournal(inventory = this._inv || []) {
    this._inv = inventory;
    const list = OBJECTIVES.map((o) => `<li class="${this.done.has(o.id) ? 'done' : ''}"><span class="box">${this.done.has(o.id) ? '✓' : ''}</span>${o.text}</li>`).join('');
    const inv = inventory.length
      ? inventory.map((i) => `<li>${i.name}${i.qty > 1 ? ` × ${i.qty}` : ''}</li>`).join('')
      : '<li class="muted">Nothing yet. The bazaar is just inside the gate.</li>';
    $('journalBody').innerHTML = `
      <h3>Things to see <span class="count">${this.done.size}/${OBJECTIVES.length}</span></h3><ul class="obj">${list}</ul>
      <h3>Your satchel</h3><ul class="inv">${inv}</ul>`;
  }

  // ---------------------------------------------------------- dialogue ---
  say(name, text, extra = '') {
    this.open = 'dialog';
    this.dialog.innerHTML = `<div class="d-name">${name}</div><div class="d-text">${text}</div>${extra}<div class="d-hint">[E] continue · [Esc] close</div>`;
    this.dialog.classList.add('show');
  }
  close() {
    this.dialog.classList.remove('show');
    this.journal.classList.remove('show');
    this.mapPanel.classList.remove('show');
    this.open = null;
  }

  shop(stall, coins, onBuy, onHaggle) {
    this.open = 'shop';
    releaseMouse();
    const def = stall.def;
    const rows = def.items.map((it, i) => `
      <div class="item">
        <span class="i-name"><kbd>${i + 1}</kbd> ${it.name}</span>
        <span class="i-price">${it.price} huns</span>
        <button data-buy="${i}" ${coins < it.price ? 'disabled' : ''}>Buy</button>
        <button data-haggle="${i}" class="ghost" ${stall.haggled?.has(i) ? 'disabled' : ''}>Haggle</button>
      </div>`).join('');
    this.dialog.innerHTML = `<div class="d-name">${def.name}</div><div class="d-text">${stall.lastLine || def.greet}</div>
      <div class="shop">${rows}</div><div class="d-hint">You carry ${coins} huns · [1-${def.items.length}] buy · [Shift+number] haggle · [Esc] leave</div>`;
    this.dialog.classList.add('show');
    this.dialog.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => onBuy(+b.dataset.buy)));
    this.dialog.querySelectorAll('[data-haggle]').forEach((b) => (b.onclick = () => onHaggle(+b.dataset.haggle)));
  }

  toggleJournal() {
    if (this.open === 'journal') return this.close();
    this.close();
    this.open = 'journal';
    releaseMouse();
    this.journal.classList.add('show');
  }

  // --------------------------------------------------------------- map ---
  buildMapImage(fort) {
    const S = WORLD_R * 2 + 40; // metres covered
    const px = 2; // pixels per metre
    const c = document.createElement('canvas');
    c.width = c.height = S * px;
    const ctx = c.getContext('2d');
    const half = S / 2;
    const step = 4;
    for (let z = -half; z < half; z += step)
      for (let x = -half; x < half; x += step) {
        const h = terrainHeight(x, z);
        const l = 30 + h * 0.6;
        ctx.fillStyle = Math.hypot(x, z) > WORLD_R ? '#3b3226' : `hsl(${28 - h * 0.1}, ${32 - h * 0.25}%, ${l}%)`;
        ctx.fillRect((x + half) * px, (z + half) * px, step * px + 1, step * px + 1);
      }
    const P = (x, z) => [(x + half) * px, (z + half) * px];
    const line = (path, w, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = w * px; ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      path.pts.forEach((p, i) => (i ? ctx.lineTo(...P(p.x, p.z)) : ctx.moveTo(...P(p.x, p.z))));
      ctx.stroke();
    };
    line(PROCESSION, 3, '#d9bf8f');
    line(ROAD, 4, '#e8d3a6');
    // walls
    ctx.strokeStyle = '#2b2622';
    ctx.lineWidth = 4 * px;
    ctx.beginPath();
    BASTION_ANGLES.forEach((a, i) => {
      const p = P(R_OUTER * Math.cos(a), R_OUTER * Math.sin(a));
      i ? ctx.lineTo(...p) : ctx.moveTo(...p);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(...P(0, 0), R_MIDDLE * px, 0, Math.PI * 2);
    ctx.lineWidth = 3.5 * px;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(...P(0, 0), R_CITADEL * px, 0, Math.PI * 2);
    ctx.lineWidth = 3 * px;
    ctx.stroke();
    // construction gap in a different tone
    ctx.strokeStyle = '#c98a3a';
    ctx.lineWidth = 4 * px;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(...P(CONSTRUCTION.p0.x, CONSTRUCTION.p0.z)); ctx.lineTo(...P(CONSTRUCTION.p1.x, CONSTRUCTION.p1.z)); ctx.stroke();
    ctx.setLineDash([]);
    // houses
    ctx.fillStyle = '#e9dcc0';
    for (const h of fort.houseList) {
      ctx.save();
      ctx.translate(...P(h.x, h.z));
      ctx.rotate(-h.rot);
      ctx.fillRect((-h.w / 2) * px, (-h.d / 2) * px, h.w * px, h.d * px);
      ctx.restore();
    }
    // landmarks
    ctx.fillStyle = '#f0e0b8';
    ctx.fillRect(...P(-13, -12), 26 * px, 16 * px);
    ctx.fillStyle = '#d9b48a';
    ctx.fillRect(...P(BAZAAR.x0, -BAZAAR.halfWidth - 2), (BAZAAR.x1 - BAZAAR.x0) * px, (BAZAAR.halfWidth * 2 + 4) * px);
    ctx.fillStyle = '#e8c7a0';
    ctx.fillRect(...P(DANCE.x - 7, DANCE.z - 7), 14 * px, 14 * px);
    ctx.fillStyle = '#e3b9a0';
    ctx.fillRect(...P(PALACE.x - 13, PALACE.z - 6), 26 * px, 12 * px);
    ctx.fillStyle = '#c9a77a';
    ctx.fillRect(...P(STABLE.x - 24, STABLE.z - 16), 48 * px, 34 * px);
    ctx.fillStyle = '#4f7f86';
    ctx.fillRect(...P(TANK.x - TANK.w / 2, TANK.z - TANK.d / 2), TANK.w * px, TANK.d * px);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(...P(PORTICO.x, PORTICO.z), 4 * px, 0, 7); ctx.fill();
    for (const t of fort.trees) {
      ctx.fillStyle = 'rgba(60,90,40,0.75)';
      ctx.beginPath(); ctx.arc(...P(t.x, t.z), 2.2 * t.s * px, 0, 7); ctx.fill();
    }
    this.mapImg = c;
    this.mapPx = px;
    this.mapHalf = half;
  }

  drawMini(player, camYaw, king) {
    const ctx = this.miniCtx;
    const W = this.mini.width, R = W / 2;
    const scale = 1.15; // px per metre on the minimap
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#3b3226'; ctx.fillRect(0, 0, W, W);
    ctx.translate(R, R);
    ctx.rotate(camYaw);
    const k = scale / this.mapPx;
    ctx.drawImage(this.mapImg, -(player.x + this.mapHalf) * scale, -(player.z + this.mapHalf) * scale, this.mapImg.width * k, this.mapImg.height * k);
    // place icons
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of PLACES) {
      const x = (p.x - player.x) * scale, y = (p.z - player.z) * scale;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-camYaw);
      ctx.fillStyle = 'rgba(20,14,8,0.75)'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#f3d27a'; ctx.fillText(ICONS[p.icon], 0, 1);
      ctx.restore();
    }
    if (king) {
      const x = (king.x - player.x) * scale, y = (king.z - player.z) * scale;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-camYaw);
      ctx.fillStyle = '#9c1b25'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = '#f3d27a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText('♛', 0, 1);
      ctx.restore();
    }
    ctx.restore();
    // player arrow (always pointing up = facing relative to camera)
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(camYaw - player.facing + Math.PI);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1b1410'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // north marker
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(camYaw);
    ctx.fillStyle = '#f3d27a'; ctx.font = 'bold 12px serif';
    ctx.fillText('N', 0, -(R - 12));
    ctx.restore();
  }

  showMap(player, king, onTravel) {
    if (this.open === 'map') return this.close();
    this.close();
    this.open = 'map';
    releaseMouse();
    const cv = $('bigmap');
    const size = Math.min(innerWidth - 40, innerHeight - 120, 720);
    cv.width = cv.height = size * devicePixelRatio;
    cv.style.width = cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    const s = cv.width / this.mapImg.width;
    ctx.drawImage(this.mapImg, 0, 0, cv.width, cv.height);
    const toC = (x, z) => [(x + this.mapHalf) * this.mapPx * s, (z + this.mapHalf) * this.mapPx * s];
    ctx.textAlign = 'center';
    const fs = 13 * devicePixelRatio;
    ctx.font = `600 ${fs}px Georgia, serif`;
    const hits = [];
    for (const p of PLACES) {
      const [x, y] = toC(p.x, p.z);
      ctx.fillStyle = 'rgba(20,14,8,0.8)'; ctx.beginPath(); ctx.arc(x, y, fs, 0, 7); ctx.fill();
      ctx.fillStyle = '#f3d27a'; ctx.fillText(ICONS[p.icon], x, y + fs * 0.35);
      const ly = p.above ? y - fs * 1.5 : y + fs * 2.2;
      ctx.fillStyle = '#1b1410'; ctx.fillText(p.name, x + 1, ly + 1);
      ctx.fillStyle = '#fff6df'; ctx.fillText(p.name, x, ly);
      hits.push({ x: x / devicePixelRatio, y: y / devicePixelRatio, p });
    }
    const [kx, ky] = toC(king.x, king.z);
    ctx.fillStyle = '#9c1b25'; ctx.beginPath(); ctx.arc(kx, ky, fs * 0.9, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText('♛', kx, ky + fs * 0.35);
    const [px, py] = toC(player.x, player.z);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, fs * 0.6, 0, 7); ctx.fill(); ctx.stroke();
    cv.onclick = (e) => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const hit = hits.find((h) => Math.hypot(h.x - mx, h.y - my) < 26);
      if (hit) { onTravel(hit.p); this.close(); }
    };
    this.mapPanel.classList.add('show');
  }
}
