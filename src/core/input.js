// Keyboard, mouse (pointer lock) and touch input.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.look = { dx: 0, dy: 0 };
    this.wheel = 0;
    this.touchMove = { x: 0, y: 0 };
    this.canvas = canvas;
    this.locked = false;
    this.enabled = true;
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => (this.locked = document.pointerLockElement === canvas));
    addEventListener('mousemove', (e) => {
      if (this.locked) { this.look.dx += e.movementX; this.look.dy += e.movementY; }
      else if (this.dragging) { this.look.dx += e.movementX * 1.5; this.look.dy += e.movementY * 1.5; }
    });
    canvas.addEventListener('mousedown', (e) => {
      // Dragging always looks around; pointer lock is a bonus where the browser allows it.
      this.dragging = true;
      if (e.button === 0 && this.canLock && !this.locked && this.enabled) this.lock();
    });
    addEventListener('mouseup', () => (this.dragging = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    this.canLock = !matchMedia('(pointer: coarse)').matches;
    this._setupTouch();
  }

  _setupTouch() {
    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    if (!stick) return;
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    if (this.isTouch) document.body.classList.add('touch');
    let stickId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
    const R = 50;
    this.canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && stickId === null) {
          stickId = t.identifier; sx = t.clientX; sy = t.clientY;
          stick.style.left = sx - 60 + 'px'; stick.style.top = sy - 60 + 'px';
          stick.classList.add('on');
        } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = t.clientX - sx, dy = t.clientY - sy;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.touchMove.x = dx / R; this.touchMove.y = dy / R;
        } else if (t.identifier === lookId) {
          this.look.dx += (t.clientX - lx) * 2.2; this.look.dy += (t.clientY - ly) * 2.2;
          lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          stickId = null; this.touchMove.x = this.touchMove.y = 0;
          knob.style.transform = ''; stick.classList.remove('on');
        }
        if (t.identifier === lookId) lookId = null;
      }
    };
    this.canvas.addEventListener('touchend', end);
    this.canvas.addEventListener('touchcancel', end);
    for (const b of document.querySelectorAll('[data-key]')) {
      const code = b.dataset.key;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); this.pressed.add(code); this.keys.add(code); });
      b.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.delete(code); });
    }
  }

  lock() {
    try {
      const r = this.canvas.requestPointerLock?.();
      if (r && r.catch) r.catch(() => {});
    } catch { /* pointer lock unavailable: drag to look instead */ }
  }

  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  endFrame() { this.pressed.clear(); this.look.dx = this.look.dy = 0; this.wheel = 0; }
}
