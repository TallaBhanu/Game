// Very small 2.5D physics: the world is a height field plus walkable
// platforms, and obstacles are boxes / circles on the ground plane.
import { terrainHeight } from '../world/terrain.js';

const CELL = 16;

export class Physics {
  constructor() {
    this.colliders = [];
    this.platforms = [];
    this.grid = new Map();
    this.pgrid = new Map();
  }

  _insert(grid, obj, x, z, r) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const k = i * 4096 + j;
        let list = grid.get(k);
        if (!list) grid.set(k, (list = []));
        list.push(obj);
      }
  }

  _query(grid, x, z) {
    return grid.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL)) || EMPTY;
  }

  /** Oriented box obstacle. rot = rotation about Y (radians). top = height of its top (world y). */
  addBox(cx, cz, hx, hz, rot = 0, top = Infinity, bottom = -Infinity) {
    const b = { type: 'box', cx, cz, hx, hz, c: Math.cos(rot), s: Math.sin(rot), top, bottom };
    this.colliders.push(b);
    this._insert(this.grid, b, cx, cz, Math.hypot(hx, hz));
    return b;
  }

  addCircle(x, z, r, top = Infinity, bottom = -Infinity) {
    const c = { type: 'circle', cx: x, cz: z, r, top, bottom };
    this.colliders.push(c);
    this._insert(this.grid, c, x, z, r);
    return c;
  }

  /**
   * Walkable surface. Height is y0 at local z=-hz and y1 at local z=+hz,
   * which lets the same primitive describe floors and ramps.
   */
  addPlatform(cx, cz, hx, hz, rot, y0, y1 = y0) {
    const p = { cx, cz, hx, hz, c: Math.cos(rot), s: Math.sin(rot), y0, y1 };
    this.platforms.push(p);
    this._insert(this.pgrid, p, cx, cz, Math.hypot(hx, hz));
    return p;
  }

  groundAt(x, z, feetY = Infinity) {
    let h = terrainHeight(x, z);
    const list = this._query(this.pgrid, x, z);
    for (const p of list) {
      const dx = x - p.cx, dz = z - p.cz;
      // rotate into local space (inverse rotation)
      const lx = dx * p.c - dz * p.s;
      const lz = dx * p.s + dz * p.c;
      if (Math.abs(lx) <= p.hx && Math.abs(lz) <= p.hz) {
        const t = (lz + p.hz) / (2 * p.hz);
        const y = p.y0 + (p.y1 - p.y0) * t;
        if (y > h && y <= feetY + 0.75) h = y;
      }
    }
    return h;
  }

  /** Push a circle at pos (x, z) of radius r out of all obstacles. Mutates pos. */
  resolve(pos, r, feetY = 0, headY = feetY + 1.7) {
    for (let iter = 0; iter < 2; iter++) {
      const list = this._query(this.grid, pos.x, pos.z);
      for (const o of list) {
        if (feetY >= o.top - 0.05 || headY <= o.bottom) continue;
        if (o.type === 'circle') {
          const dx = pos.x - o.cx, dz = pos.z - o.cz;
          const d = Math.hypot(dx, dz), min = o.r + r;
          if (d < min && d > 1e-6) {
            pos.x = o.cx + (dx / d) * min;
            pos.z = o.cz + (dz / d) * min;
          }
        } else {
          const dx = pos.x - o.cx, dz = pos.z - o.cz;
          const lx = dx * o.c - dz * o.s;
          const lz = dx * o.s + dz * o.c;
          const qx = Math.max(-o.hx, Math.min(o.hx, lx));
          const qz = Math.max(-o.hz, Math.min(o.hz, lz));
          let ex = lx - qx, ez = lz - qz;
          let d = Math.hypot(ex, ez);
          let nlx, nlz;
          if (d > 1e-6) {
            if (d >= r) continue;
            const push = r - d;
            nlx = lx + (ex / d) * push;
            nlz = lz + (ez / d) * push;
          } else {
            // inside: push out along the shallowest axis
            const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
            if (px < pz) { nlx = Math.sign(lx || 1) * (o.hx + r); nlz = lz; }
            else { nlx = lx; nlz = Math.sign(lz || 1) * (o.hz + r); }
          }
          // back to world
          pos.x = o.cx + nlx * o.c + nlz * o.s;
          pos.z = o.cz - nlx * o.s + nlz * o.c;
        }
      }
    }
    return pos;
  }

  /** True if point is inside any obstacle (used for camera). */
  blocked(x, z, y) {
    const list = this._query(this.grid, x, z);
    for (const o of list) {
      if (y >= o.top || y <= o.bottom) continue;
      const dx = x - o.cx, dz = z - o.cz;
      if (o.type === 'circle') { if (dx * dx + dz * dz < o.r * o.r) return true; }
      else {
        const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
        if (Math.abs(lx) < o.hx && Math.abs(lz) < o.hz) return true;
      }
    }
    return false;
  }
}
const EMPTY = [];
