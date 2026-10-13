// Synthetische Geräusche mit der Web Audio API (keine Sounddateien nötig).
(function () {
  'use strict';
  const SR = (window.SR = window.SR || {});

  class Sound {
    constructor() {
      this.ctx = null;
    }

    // Muss aus einem Klick heraus aufgerufen werden (Browser-Regel für Audio).
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 5;
      comp.attack.value = 0.002;
      comp.release.value = 0.2;
      comp.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(comp);

      // Echo über das offene Gelände
      this.echoIn = ctx.createGain();
      this.echoIn.gain.value = 0.3;
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.38;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      this.echoIn.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(this.master);

      const len = Math.floor(ctx.sampleRate * 1.5);
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }

    get ready() {
      return !!this.ctx && this.ctx.state !== 'closed';
    }

    noise(t, o) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = o.type || 'bandpass';
      f.frequency.setValueAtTime(o.freq, t);
      if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.decay);
      f.Q.value = o.q == null ? 0.8 : o.q;
      const g = ctx.createGain();
      const atk = o.attack || 0.0015;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.gain, t + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + atk + o.decay);
      src.connect(f);
      f.connect(g);
      g.connect(this.dest || this.master);
      if (o.echo) {
        const e = ctx.createGain();
        e.gain.value = o.echo;
        g.connect(e);
        e.connect(this.echoIn);
      }
      src.start(t, Math.random() * 1.0, atk + o.decay + 0.05);
    }

    tone(t, o) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t);
      if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack || 0.002));
      g.gain.exponentialRampToValueAtTime(0.0001, t + (o.attack || 0.002) + o.decay);
      osc.connect(g);
      g.connect(this.dest || this.master);
      osc.start(t);
      osc.stop(t + o.decay + 0.05);
    }

    shot(s) {
      if (!this.ready) return;
      const t = this.ctx.currentTime + 0.005 + (this.delay || 0);
      this.noise(t, { type: 'highpass', freq: s.crack, q: 0.4, decay: 0.045, gain: s.gain * 0.9 });
      this.noise(t, { type: 'lowpass', freq: s.body, freqEnd: s.body * 0.25, q: 0.9, decay: s.decay, gain: s.gain, echo: s.echo });
      this.tone(t, { freq: s.thump, freqEnd: 32, decay: 0.2, gain: s.gain * 0.85 });
    }

    // Ein Geräusch aus der Welt: Lautstärke nach Entfernung, Richtung links/rechts (pan -1..1), verzögert durch den Schall
    positional(dist, pan, fn) {
      if (!this.ready) return;
      const ctx = this.ctx;
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0.05, Math.min(1, 14 / (dist + 8)));
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = Math.max(900, 9000 - dist * 55);
      const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      gain.connect(lp);
      if (pn) {
        pn.pan.value = Math.max(-1, Math.min(1, pan));
        lp.connect(pn);
        pn.connect(this.master);
      } else lp.connect(this.master);
      const saved = this.dest;
      this.dest = gain;
      this.delay = Math.min(0.7, dist / 340);
      try {
        fn();
      } finally {
        this.dest = saved;
        this.delay = 0;
      }
    }

    enemyShot(s, dist, pan) {
      this.positional(dist, pan, () => this.shot(s));
    }

    // Bogen: Sehne schnellt, Pfeil zischt
    bowShot(dist, pan) {
      if (!this.ready) return;
      const f = () => {
        const t = this.ctx.currentTime + 0.003 + (this.delay || 0);
        this.tone(t, { type: 'triangle', freq: 190, freqEnd: 95, decay: 0.16, gain: 0.3 });
        this.noise(t, { type: 'bandpass', freq: 1900, freqEnd: 700, q: 1.4, decay: 0.2, gain: 0.16 });
      };
      if (dist == null) f();
      else this.positional(dist, pan, f);
    }

    bowDraw() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.noise(t, { type: 'bandpass', freq: 380, freqEnd: 620, q: 3, decay: 0.6, gain: 0.05, attack: 0.15 });
    }

    arrowHit(dist) {
      if (!this.ready) return;
      const t = this.ctx.currentTime + (dist || 0) / 340;
      this.noise(t, { type: 'lowpass', freq: 600, q: 1, decay: 0.07, gain: 0.45 });
      this.tone(t, { type: 'triangle', freq: 150, freqEnd: 90, decay: 0.1, gain: 0.2 });
    }

    // Spieler getroffen: dumpfer Schlag
    hurt() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.tone(t, { type: 'sine', freq: 130, freqEnd: 50, decay: 0.28, gain: 0.5 });
      this.noise(t, { type: 'lowpass', freq: 700, q: 1, decay: 0.15, gain: 0.35 });
    }

    // Spieler ist gefallen
    down() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.tone(t, { type: 'sawtooth', freq: 220, freqEnd: 40, decay: 0.9, gain: 0.18 });
      this.noise(t, { type: 'lowpass', freq: 300, freqEnd: 90, q: 1, decay: 0.8, gain: 0.4 });
    }

    // Energiegewehr: hoher Pfeifton, der schnell abfällt
    laser() {
      if (!this.ready) return;
      const t = this.ctx.currentTime + 0.003;
      this.tone(t, { type: 'sawtooth', freq: 2400, freqEnd: 260, decay: 0.15, gain: 0.08 });
      this.tone(t, { type: 'sine', freq: 1100, freqEnd: 140, decay: 0.22, gain: 0.22 });
      this.noise(t, { type: 'highpass', freq: 4500, q: 0.6, decay: 0.035, gain: 0.12, echo: 0.15 });
    }

    click(delay, freq, gain) {
      if (!this.ready) return;
      const t = this.ctx.currentTime + (delay || 0);
      this.noise(t, { type: 'bandpass', freq: freq || 3200, q: 4, decay: 0.025, gain: gain || 0.35 });
    }

    pickup() {
      this.click(0, 2600, 0.3);
      this.click(0.09, 1800, 0.35);
    }

    bolt() {
      this.click(0.2, 2200, 0.4);
      this.click(0.38, 1500, 0.45);
      this.click(0.6, 1700, 0.45);
      this.click(0.78, 2600, 0.4);
    }

    // Pumpgun repetieren: zurück – vor
    pump() {
      this.click(0.13, 1300, 0.45);
      this.click(0.29, 900, 0.55);
      this.click(0.47, 1500, 0.55);
    }

    cylinder() {
      this.click(0.05, 4200, 0.15);
    }

    // Treffergeräusche kommen bei weit entfernten Scheiben etwas später an (Schallgeschwindigkeit).
    hitBody(dist) {
      if (!this.ready) return;
      const t = this.ctx.currentTime + dist / 340;
      this.noise(t, { type: 'bandpass', freq: 750, q: 2.2, decay: 0.07, gain: 0.5 });
    }

    hitHead(dist) {
      if (!this.ready) return;
      const t = this.ctx.currentTime + dist / 340;
      this.tone(t, { freq: 1320, decay: 0.55, gain: 0.22 });
      this.tone(t, { freq: 1980, decay: 0.35, gain: 0.1 });
      this.noise(t, { type: 'bandpass', freq: 900, q: 2, decay: 0.05, gain: 0.4 });
    }

    fall(dist) {
      if (!this.ready) return;
      const t = this.ctx.currentTime + dist / 340;
      this.noise(t, { type: 'lowpass', freq: 380, q: 0.7, decay: 0.3, gain: 0.55 });
    }

    // Rascheln beim Hinlegen (tiefer) und Aufstehen (heller)
    prone(down) {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.noise(t, { type: 'bandpass', freq: down ? 420 : 650, freqEnd: down ? 220 : 900, q: 1.2, decay: 0.35, gain: 0.25 });
      this.noise(t + (down ? 0.32 : 0.05), { type: 'lowpass', freq: 260, q: 0.8, decay: 0.15, gain: down ? 0.4 : 0.15 });
    }

    rise() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.noise(t, { type: 'bandpass', freq: 500, freqEnd: 900, q: 1.5, decay: 0.5, gain: 0.08 });
    }

    // ---------- Skin-Automat ----------
    spinTicks(duration) {
      if (!this.ready) return;
      const t0 = this.ctx.currentTime;
      let t = 0;
      let gap = 0.05;
      while (t < duration) {
        this.noise(t0 + t, { type: 'bandpass', freq: 2600, q: 5, decay: 0.012, gain: 0.12 });
        t += gap;
        gap *= 1.045;
      }
    }

    reelStop() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.noise(t, { type: 'lowpass', freq: 500, q: 1, decay: 0.08, gain: 0.45 });
      this.tone(t, { type: 'square', freq: 180, freqEnd: 120, decay: 0.06, gain: 0.05 });
    }

    coins() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 6; i++) this.tone(t + i * 0.07, { type: 'triangle', freq: 1800 + (i % 2) * 500, decay: 0.12, gain: 0.08 });
    }

    jackpot() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(t + i * 0.09, { type: 'triangle', freq: f, decay: 0.5, gain: 0.12 }));
      this.coins();
    }

    win() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.11, { type: 'triangle', freq: f, decay: 0.35, gain: 0.12 }));
    }
  }

  SR.sound = new Sound();
})();
