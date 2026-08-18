// Procedurally generated dance music. A lookahead scheduler builds the track
// from kick / hats / clap / bass / stabs / lead in 8-bar sections that cycle
// GROOVE -> BUILD -> DROP -> COOLDOWN. Every 32 bars the club switches GENRE
// (new BPM, bass pattern, lead voice). Exposes a beat clock + analyser data
// so the lights, LED wall and dancers all move to the same grid.

const NAME_A = ['Neon', 'Midnight', 'Chrome', 'Laser', 'Velvet', 'Quantum', 'Feral', 'Hyper', 'Liquid', 'Zero'];
const NAME_B = ['Pulse', 'Dreams', 'Protocol', 'Bloom', 'Mirage', 'Voltage', 'Cascade', 'Halo', 'Signal', 'Gravity'];

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PAD_CHORDS = [[45, 52, 57, 60], [41, 48, 55, 60]];

export const SECTION_NAMES = ['GROOVE', 'BUILDING…', '⚡ THE DROP ⚡', 'COOLDOWN'];

const GENRES = [
  {
    name: 'TECHNO', bpm: 126, leadWave: 'square', root: 33, stab: true,
    bass: [0, null, 0, null, 7, null, 0, null, 10, null, 7, null, 0, null, 12, null],
    lead: [0, 3, 7, 10, 12, 10, 7, 3], lead16: false, hat16: false, acid: false,
  },
  {
    name: 'ACID', bpm: 132, leadWave: 'sawtooth', root: 31, stab: false,
    bass: [0, 0, null, 12, 0, null, 10, 0, null, 0, 13, null, 0, 7, null, 3],
    lead: [0, 3, 7, 10, 15, 10, 7, 3], lead16: false, hat16: false, acid: true,
  },
  {
    name: 'HOUSE', bpm: 122, leadWave: 'triangle', root: 33, stab: true,
    bass: [0, null, null, 0, null, null, 7, null, 0, null, null, 5, null, null, 7, null],
    lead: [0, 7, 12, 7, 3, 10, 7, 0], lead16: false, hat16: false, acid: false, openHat: true,
  },
  {
    name: 'TRANCE', bpm: 138, leadWave: 'sawtooth', root: 33, stab: false,
    bass: [0, null, 0, 0, null, 0, 0, null, 0, null, 0, 0, null, 0, 0, null],
    lead: [0, 7, 12, 7, 3, 10, 15, 10], lead16: true, hat16: false, acid: false, padAlways: true,
  },
  {
    name: 'HARDSTYLE', bpm: 146, leadWave: 'square', root: 30, stab: false,
    bass: [0, null, 0, null, 0, null, 0, null, 3, null, 3, null, -2, null, -2, null],
    lead: [0, 0, 12, 0, 10, 0, 7, 0], lead16: false, hat16: true, acid: false, hardKick: true,
  },
  {
    name: 'DUBSTEP', bpm: 140, leadWave: 'square', root: 28, stab: false, halfTime: true,
    bass: [0, null, null, null, 0, 0, null, 3, null, null, -2, null, 0, null, 5, null],
    lead: [0, 0, 3, 0, 5, 3, 0, -2], lead16: false, hat16: false, acid: false, wobble: true,
  },
  {
    name: 'DRUM&BASS', bpm: 174, leadWave: 'triangle', root: 31, stab: false, breakbeat: true,
    bass: [0, null, null, null, null, null, 0, null, null, null, 7, null, null, null, null, null],
    lead: [0, 7, 12, 15, 12, 7, 3, 0], lead16: false, hat16: true, acid: false,
  },
  {
    name: 'SYNTHWAVE', bpm: 112, leadWave: 'sawtooth', root: 33, stab: true,
    bass: [0, null, 0, null, 0, null, 0, null, 5, null, 5, null, 3, null, 3, null],
    lead: [0, 3, 7, 12, 15, 12, 7, 3], lead16: true, hat16: false, acid: false, padAlways: true, openHat: true,
  },
];

export class Music {
  constructor() {
    this.genre = GENRES[0];
    this.bpm = this.genre.bpm;
    this.started = false;
    this.beat = 0;
    this.bar = 0;
    this.section = 0;
    this.kickPulse = 0;
    this.trackName = this.genName();
    this.onSection = null; // (sectionIndex) => {}
    this.onTrack = null;   // (label) => {}
    this._kickTimes = [];
    this._risersDone = new Set();
  }

  genName() {
    return NAME_A[(Math.random() * NAME_A.length) | 0] + ' ' + NAME_B[(Math.random() * NAME_B.length) | 0];
  }

  get trackLabel() { return `${this.genre.name} • ${this.trackName}`; }

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    // spatial muffle: lowpass driven by which room the camera is in
    this.spatial = ctx.createBiquadFilter();
    this.spatial.type = 'lowpass';
    this.spatial.frequency.value = 18000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.75;
    this._spectrum = new Uint8Array(this.analyser.frequencyBinCount);

    this.master.connect(this.spatial);
    this.spatial.connect(comp);
    comp.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    // shared noise buffer for hats / claps / risers
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.t0 = ctx.currentTime + 0.1;
    this._nextTime = this.t0;
    this._stepIdx = 0;
    this._lastNow = this.t0;
    this._timer = setInterval(() => this._schedule(), 25);
  }

  setMuted(m) {
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  // 0 = on the dance floor, 1 = fully muffled (through walls / on the roof)
  setSpace(m) {
    if (!this.spatial) return;
    const f = 18000 * Math.pow(500 / 18000, m);
    this.spatial.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.18);
  }

  get stepDur() { return 60 / this.bpm / 4; }

  _schedule() {
    const ahead = this.ctx.currentTime + 0.14;
    while (this._nextTime < ahead) {
      this._step(this._stepIdx, this._nextTime);
      this._stepIdx++;
      this._nextTime += this.stepDur; // reads current bpm, so genre switches take effect
    }
  }

  _step(step, t) {
    const pos = step % 16;               // 16th within the bar
    const bar = Math.floor(step / 16);
    const section = Math.floor(bar / 8) % 4;
    const barInSection = bar % 8;
    const g = this.genre;

    // genre + track change every 32 bars, on the bar line
    if (pos === 0 && bar > 0 && bar % 32 === 0 && this._lastTrackBar !== bar) {
      this._lastTrackBar = bar;
      let next = g;
      while (next === g) next = GENRES[(Math.random() * GENRES.length) | 0];
      this.genre = next;
      this.bpm = next.bpm;
      this.trackName = this.genName();
      this.onTrack && this.onTrack(this.trackLabel);
    }

    // ---- drums ----
    const hasKick = section !== 3;
    if (hasKick) {
      if (g.halfTime) { if (pos === 0 || pos === 10) this._kick(t, 1, true); }
      else if (g.breakbeat) { if (pos === 0 || pos === 10) this._kick(t, 0.95); }
      else if (pos % 4 === 0) this._kick(t, 1, g.hardKick);
    }
    // build-up roll in the final bar before the drop
    if (section === 1 && barInSection === 7 && pos >= 8 && pos % 2 === 0) this._kick(t, 0.7);
    if (pos % 4 === 2) this._hat(t, 0.5, g.openHat ? 0.16 : 0.06);
    if ((g.hat16 && section >= 1) || (section === 2 && pos % 2 === 1)) {
      if (pos % 2 === 1) this._hat(t, 0.2, 0.05);
    }
    if (section !== 3) {
      if (g.halfTime) { if (pos === 8) this._clap(t, 0.55); }
      else if (g.breakbeat) { if (pos === 4 || pos === 12) this._clap(t, 0.45); }
      else if (pos === 4 || pos === 12) this._clap(t, section === 2 ? 0.5 : 0.32);
    }

    // ---- bass ----
    const bn = this.genre.bass[pos];
    if (bn !== null && section !== 3) this._bass(t, midi(g.root + bn), section === 2 ? 0.4 : 0.3, 1, g.acid, g.wobble);
    if (bn !== null && section === 3 && pos % 8 === 0) this._bass(t, midi(g.root + bn), 0.16, 0.4, false);

    // ---- lead on the drop ----
    if (section === 2 && (g.lead16 || pos % 2 === 0)) {
      const idx = g.lead16 ? (pos + bar * 16) % 8 : (pos / 2 + bar * 8) % 8;
      this._lead(t, midi(g.root + 24 + g.lead[idx]), g.lead16 ? 0.09 : 0.12, g.leadWave);
    }

    // ---- stab every other bar in groove ----
    if (g.stab && section === 0 && pos === 0 && bar % 2 === 0) this._stab(t, [57, 60, 64, 67], 0.14);

    // ---- pads in build + cooldown (trance: always) ----
    if ((section === 1 || section === 3 || g.padAlways) && pos === 0) {
      this._pad(t, PAD_CHORDS[bar % 2], 16 * this.stepDur, section === 3 ? 0.08 : 0.045);
    }

    // ---- riser across the whole build section ----
    if (section === 1 && barInSection === 0 && pos === 0 && !this._risersDone.has(bar)) {
      this._risersDone.add(bar);
      this._riser(t, 8 * 16 * this.stepDur);
    }
  }

  // ---------- instruments ----------
  _env(t, a, peak, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(this.master);
    return g;
  }

  _kick(t, vol = 1, hard = false) {
    const o = this.ctx.createOscillator();
    o.type = hard ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(hard ? 220 : 150, t);
    o.frequency.exponentialRampToValueAtTime(hard ? 38 : 42, t + (hard ? 0.16 : 0.11));
    const g = this._env(t, 0.002, 0.85 * vol, hard ? 0.34 : 0.26);
    o.connect(g);
    o.start(t); o.stop(t + 0.38);
    this._kickTimes.push(t);
  }

  _hat(t, vol, dur = 0.06) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 8000;
    const g = this._env(t, 0.001, vol, dur);
    s.connect(f); f.connect(g);
    s.start(t); s.stop(t + dur + 0.02);
  }

  _clap(t, vol) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    [0, 0.012, 0.025].forEach((dt) => {
      g.gain.setValueAtTime(vol, t + dt);
      g.gain.exponentialRampToValueAtTime(vol * 0.3, t + dt + 0.01);
    });
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    g.connect(this.master);
    s.connect(f); f.connect(g);
    s.start(t); s.stop(t + 0.25);
  }

  _bass(t, freq, vol, durMul = 1, acid = false, wobble = false) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = acid ? 14 : wobble ? 9 : 6;
    if (wobble) {
      // filter LFO — the classic dubstep growl
      f.frequency.value = 620;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = (this.bpm / 60) * 2;
      const lg = this.ctx.createGain();
      lg.gain.value = 480;
      lfo.connect(lg); lg.connect(f.frequency);
      lfo.start(t); lfo.stop(t + 0.55 * durMul);
    } else {
      f.frequency.setValueAtTime(acid ? 2400 : 900, t);
      f.frequency.exponentialRampToValueAtTime(acid ? 220 : 180, t + 0.14 * durMul);
    }
    const g = this._env(t, 0.004, vol, (wobble ? 0.45 : 0.16) * durMul);
    o.connect(f); f.connect(g);
    o.start(t); o.stop(t + (wobble ? 0.55 : 0.2) * durMul);
  }

  _lead(t, freq, vol, wave = 'square') {
    const o = this.ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    const o2 = this.ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = freq * 1.005;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 3200;
    const g = this._env(t, 0.005, vol, 0.14);
    o.connect(f); o2.connect(f); f.connect(g);
    o.start(t); o.stop(t + 0.16);
    o2.start(t); o2.stop(t + 0.16);
  }

  _stab(t, notes, vol) {
    for (const n of notes) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1600;
      const g = this._env(t, 0.005, vol / notes.length, 0.22);
      o.connect(f); f.connect(g);
      o.start(t); o.stop(t + 0.25);
    }
  }

  _pad(t, notes, dur, vol) {
    for (const n of notes) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = (Math.random() - 0.5) * 12;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 750;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol / notes.length, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0, t + dur);
      g.connect(this.master);
      o.connect(f); f.connect(g);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  _riser(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(5200, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + dur);
    g.gain.setValueAtTime(0, t + dur + 0.01);
    g.connect(this.master);
    s.connect(f); f.connect(g);
    s.start(t); s.stop(t + dur + 0.1);
  }

  // ---------- per-frame clock ----------
  update() {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    if (now > this.t0) {
      // incremental clock so BPM changes don't break beat continuity
      this.beat += (now - Math.max(this._lastNow, this.t0)) / (60 / this.bpm);
    }
    this._lastNow = now;
    this.bar = Math.floor(this.beat / 4);
    const section = Math.floor(this.bar / 8) % 4;
    if (section !== this.section) {
      this.section = section;
      this.onSection && this.onSection(section);
    }
    // decay pulse from the most recent kick that has actually played
    while (this._kickTimes.length && this._kickTimes[0] < now - 0.6) this._kickTimes.shift();
    let last = -1;
    for (const kt of this._kickTimes) if (kt <= now) last = kt;
    this.kickPulse = last >= 0 ? Math.max(0, 1 - (now - last) * 5) : 0;
  }

  spectrum() {
    if (!this.started) return null;
    this.analyser.getByteFrequencyData(this._spectrum);
    return this._spectrum;
  }

  get isDrop() { return this.started && this.section === 2; }
}
