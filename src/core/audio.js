// Procedural Web Audio: tabla + drone + sarangi at the dance court, kettle
// drums for the procession, chisels at the rampart, bazaar murmur, birds,
// and the famous clap echo at Fateh Darwaza.

const TEENTAL = ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'ta', 'ta', 'dhin', 'dhin', 'dha'];
// Raga Yaman-ish scale (relative to Sa) in semitones
const SCALE = [0, 2, 4, 6, 7, 9, 11, 12, 14];

export class Audio {
  constructor() {
    this.ctx = null;
    this.sources = [];
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.enabled = true;
    this.lastClink = 0;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // reverb-ish echo bus
    this.echo = ctx.createDelay(2.0);
    this.echo.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2500;
    this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo);
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    lp.connect(wet); wet.connect(this.master);
    this._setupLoops();
    this.nextBeat = ctx.currentTime + 0.2;
    this.beat = 0;
    this.nextNote = ctx.currentTime + 0.5;
    this.note = 4;
  }

  setMuted(m) {
    this.enabled = !m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.1);
  }

  addSource(type, pos) { this.sources.push({ type, pos }); }

  // ---- spatial helpers ----
  _spatial(pos, maxD = 60) {
    const L = this.listener;
    const dx = pos.x - L.x, dz = pos.z - L.z, dy = (pos.y ?? L.y) - L.y;
    const d = Math.hypot(dx, dy, dz);
    const g = Math.max(0, 1 - d / maxD);
    // pan: angle of source relative to where the camera looks
    const ang = Math.atan2(dx, dz) - L.yaw;
    const pan = Math.max(-1, Math.min(1, -Math.sin(ang)));
    return { gain: g * g, pan };
  }

  _out(pos, maxD, gainMul = 1) {
    const ctx = this.ctx;
    const { gain, pan } = this._spatial(pos, maxD);
    if (gain < 0.002) return null;
    const g = ctx.createGain();
    g.gain.value = gain * gainMul;
    let node = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(this.master);
    } else g.connect(this.master);
    return node;
  }

  _noiseBurst(dest, t, dur, freq, q = 1, type = 'bandpass', vol = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  _tone(dest, t, type, f0, f1, dur, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---- one-shot effects ----
  clink(pos) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastClink < 0.07) return;
    this.lastClink = now;
    const out = this._out(pos, 45, 0.5);
    if (!out) return;
    const f = 2300 + Math.random() * 1400;
    this._tone(out, now, 'triangle', f, f * 0.98, 0.18, 0.5);
    this._tone(out, now, 'sine', f * 1.51, f * 1.5, 0.1, 0.25);
    this._noiseBurst(out, now, 0.03, 4000, 2, 'highpass', 0.6);
  }

  nagara(pos, v = 1) {
    if (!this.ctx) return;
    const out = this._out(pos, 110, 1.1 * v);
    if (!out) return;
    const t = this.ctx.currentTime;
    this._tone(out, t, 'sine', 95, 42, 0.7, 0.9);
    this._tone(out, t, 'triangle', 180, 90, 0.15, 0.25);
    this._noiseBurst(out, t, 0.12, 300, 1, 'lowpass', 0.5);
  }

  horn(pos) {
    if (!this.ctx) return;
    const out = this._out(pos, 160, 0.35);
    if (!out) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    lp.connect(out);
    for (const [st, f, dur] of [[0, 233, 0.6], [0.65, 311, 1.4]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.97, t + st);
      o.frequency.linearRampToValueAtTime(f, t + st + 0.12);
      const vib = ctx.createOscillator(); vib.frequency.value = 5.5;
      const vg = ctx.createGain(); vg.gain.value = 3;
      vib.connect(vg); vg.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + st);
      g.gain.linearRampToValueAtTime(0.5, t + st + 0.08);
      g.gain.setValueAtTime(0.5, t + st + dur - 0.2);
      g.gain.linearRampToValueAtTime(0.0001, t + st + dur);
      o.connect(g); g.connect(lp);
      o.start(t + st); o.stop(t + st + dur + 0.05);
      vib.start(t + st); vib.stop(t + st + dur + 0.05);
    }
  }

  applause(pos) {
    if (!this.ctx) return;
    const out = this._out(pos, 50, 0.6);
    if (!out) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 70; i++) this._noiseBurst(out, t + Math.random() * 2.2, 0.04, 1800 + Math.random() * 1500, 1.5, 'bandpass', 0.4 + Math.random() * 0.4);
  }

  /** Player clap. With echo=true (under the portico) it rings and returns from the summit. */
  clap(echo = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.value = 0.9;
    g.connect(this.master);
    this._noiseBurst(g, t, 0.06, 1500, 0.8, 'bandpass', 1);
    if (echo) {
      g.connect(this.echo);
      // the faint answer from Bala Hisar, a moment later
      for (const [d, v] of [[1.1, 0.3], [1.45, 0.15], [1.8, 0.07]]) this._noiseBurst(this.master, t + d, 0.09, 1100, 0.7, 'bandpass', v);
    }
  }

  hoof(v = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = v > 0.6 ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const tt = t + i * (v > 0.6 ? 0.07 : 0.16);
      this._tone(this.master, tt, 'sine', 150, 70, 0.09, 0.22);
      this._noiseBurst(this.master, tt, 0.05, 700, 1, 'bandpass', 0.18);
    }
  }

  creak() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._tone(this.master, t, 'sawtooth', 210 + Math.random() * 60, 180, 0.25, 0.025);
    this._noiseBurst(this.master, t, 0.2, 300, 0.7, 'lowpass', 0.12);
  }

  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => this._tone(this.master, t + i * 0.09, 'sine', f, f, 0.6, 0.12));
  }

  coin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._tone(this.master, t, 'square', 1800, 1800, 0.08, 0.05);
    this._tone(this.master, t + 0.07, 'square', 2400, 2400, 0.15, 0.05);
  }

  // ---- continuous loops ----
  _setupLoops() {
    const ctx = this.ctx;
    // market murmur: band-limited noise, slowly modulated
    const mk = ctx.createBufferSource();
    mk.buffer = this.noise; mk.loop = true;
    const mf = ctx.createBiquadFilter(); mf.type = 'bandpass'; mf.frequency.value = 520; mf.Q.value = 0.8;
    const mf2 = ctx.createBiquadFilter(); mf2.type = 'peaking'; mf2.frequency.value = 1100; mf2.gain.value = 6;
    this.marketGain = ctx.createGain(); this.marketGain.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7;
    const lg = ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(mf.frequency); lfo.start();
    mk.connect(mf); mf.connect(mf2); mf2.connect(this.marketGain); this.marketGain.connect(this.master);
    mk.start();
    // wind
    const wn = ctx.createBufferSource();
    wn.buffer = this.noise; wn.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.05;
    wn.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master);
    wn.start(); wn.playbackRate.value = 0.5;
    // tanpura-like drone for the dance court
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);
    const droneLP = ctx.createBiquadFilter(); droneLP.type = 'lowpass'; droneLP.frequency.value = 900;
    const droneG = ctx.createGain(); droneG.gain.value = 0.07;
    droneLP.connect(droneG); droneG.connect(this.musicGain);
    for (const f of [130.8, 196, 261.6, 130.4]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(droneLP); o.start();
    }
    // sarangi voice
    this.sarangi = ctx.createOscillator();
    this.sarangi.type = 'sawtooth';
    this.sarangi.frequency.value = 261.6 * 2 ** (4 / 12);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vg = ctx.createGain(); vg.gain.value = 4;
    vib.connect(vg); vg.connect(this.sarangi.frequency); vib.start();
    const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1100; sf.Q.value = 1.2;
    this.sarangiGain = ctx.createGain(); this.sarangiGain.gain.value = 0.0;
    this.sarangi.connect(sf); sf.connect(this.sarangiGain); this.sarangiGain.connect(this.musicGain);
    this.sarangi.start();
  }

  _tablaHit(t, bol, vol) {
    const dest = this.musicGain;
    if (bol === 'dha' || bol === 'dhin') this._tone(dest, t, 'sine', 120, 75, 0.45, 0.55 * vol); // bayan (bass)
    if (bol === 'dha' || bol === 'ta') this._tone(dest, t, 'sine', 520, 500, 0.25, 0.3 * vol); // dayan ring
    if (bol === 'dhin' || bol === 'tin') this._tone(dest, t, 'sine', 690, 680, 0.35, 0.25 * vol);
    this._noiseBurst(dest, t, 0.025, 3000, 1, 'bandpass', 0.25 * vol);
  }

  update(dt, listener, ambience) {
    this.listener = listener;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    let music = 0, market = 0;
    for (const s of this.sources) {
      const { gain } = this._spatial(s.pos, s.type === 'music' ? 75 : 55);
      if (s.type === 'music') music = Math.max(music, gain);
      if (s.type === 'market') market = Math.max(market, gain);
    }
    this.musicGain.gain.setTargetAtTime(music * 1.1, now, 0.3);
    this.marketGain.gain.setTargetAtTime(market * 0.22, now, 0.3);
    this.windGain.gain.setTargetAtTime(0.03 + Math.min(0.12, Math.max(0, listener.y - 20) * 0.003), now, 0.5);

    // tabla: teental at ~ 150 bpm (matras)
    if (music > 0.002) {
      const matra = 60 / 150;
      while (this.nextBeat < now + 0.15) {
        const bol = TEENTAL[this.beat % 16];
        const sam = this.beat % 16 === 0 ? 1.3 : 1;
        this._tablaHit(this.nextBeat, bol, sam);
        if (Math.random() < 0.35) this._tablaHit(this.nextBeat + matra / 2, Math.random() < 0.5 ? 'ta' : 'tin', 0.5);
        this.nextBeat += matra;
        this.beat++;
      }
      // sarangi melody: a gentle random walk through the scale
      if (this.nextNote < now) {
        this.note = Math.max(0, Math.min(SCALE.length - 1, this.note + Math.floor(Math.random() * 3) - 1));
        const f = 261.6 * 2 ** (SCALE[this.note] / 12);
        this.sarangi.frequency.setTargetAtTime(f, now, 0.06);
        this.sarangiGain.gain.setTargetAtTime(0.05 + Math.random() * 0.03, now, 0.1);
        this.nextNote = now + [0.4, 0.8, 0.8, 1.2, 1.6][Math.floor(Math.random() * 5)];
      }
    } else {
      this.nextBeat = now + 0.1;
    }

    // birds by day, crickets by night
    if (Math.random() < dt * (ambience.night > 0.5 ? 3 : 0.6)) {
      const t = now;
      if (ambience.night > 0.5) {
        for (let i = 0; i < 6; i++) this._tone(this.master, t + i * 0.05, 'square', 4200, 4200, 0.025, 0.006);
      } else {
        const f = 2500 + Math.random() * 1800;
        for (let i = 0; i < 3; i++) this._tone(this.master, t + i * 0.12, 'sine', f, f * 1.3, 0.09, 0.025);
      }
    }
  }
}
