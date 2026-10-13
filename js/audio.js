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
      g.connect(this.master);
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
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + o.decay + 0.05);
    }

    shot(s) {
      if (!this.ready) return;
      const t = this.ctx.currentTime + 0.005;
      this.noise(t, { type: 'highpass', freq: s.crack, q: 0.4, decay: 0.045, gain: s.gain * 0.9 });
      this.noise(t, { type: 'lowpass', freq: s.body, freqEnd: s.body * 0.25, q: 0.9, decay: s.decay, gain: s.gain, echo: s.echo });
      this.tone(t, { freq: s.thump, freqEnd: 32, decay: 0.2, gain: s.gain * 0.85 });
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

    rise() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      this.noise(t, { type: 'bandpass', freq: 500, freqEnd: 900, q: 1.5, decay: 0.5, gain: 0.08 });
    }

    win() {
      if (!this.ready) return;
      const t = this.ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.11, { type: 'triangle', freq: f, decay: 0.35, gain: 0.12 }));
    }
  }

  SR.sound = new Sound();
})();
