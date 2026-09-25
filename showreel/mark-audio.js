/* ============================================================================
 *  D32 — HIT THE MARK · mark-audio.js
 *
 *  Locked to D32Mark.T. A scope locks on in three beeps, the arrow whooshes
 *  in and thwacks dead centre, then the growth climbs a D major arpeggio
 *  (D, F#, A, D) one note per step. The box cracks, the 2 lands, and the
 *  chord that blooms is Dadd9: its E is the note outside the triad's box.
 * ========================================================================== */
(function (root) {
  'use strict';
  const SR = 48000;

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hz(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    const pc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * 2 ** (((Number(m[3]) + 1) * 12 + pc - 69) / 12);
  }

  async function render() {
    const T = root.D32Mark.T, D = root.D32Mark.DURATION, words = root.D32Mark.words;
    const ac = new OfflineAudioContext(2, Math.ceil(SR * D), SR);
    const R = rng(32);

    const noiseBuf = ac.createBuffer(2, SR * 2, SR);
    for (let c = 0; c < 2; c++) {
      const d = noiseBuf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
    }
    const ir = ac.createBuffer(2, Math.floor(SR * 2.4), SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        const x = i / SR;
        lp += 0.35 * ((R() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-x * 2.8) * (x < 0.01 ? x / 0.01 : 1);
      }
    }
    const SAT = new Float32Array(1024).map((_, i) => Math.tanh(2.2 * (i / 511.5 - 1)) / Math.tanh(2.2));

    // ── buses ───────────────────────────────────────────────────────────
    const master = ac.createGain();
    const glue = ac.createDynamicsCompressor();
    glue.threshold.value = -12; glue.knee.value = 8; glue.ratio.value = 3;
    glue.attack.value = 0.003; glue.release.value = 0.2;
    master.connect(glue).connect(ac.destination);
    const reverb = ac.createConvolver();
    reverb.buffer = ir;
    const revRet = ac.createGain();
    revRet.gain.value = 0.5;
    reverb.connect(revRet).connect(master);
    const bus = ac.createGain();
    bus.connect(master);

    const send = (node, amt) => { const g = ac.createGain(); g.gain.value = amt; node.connect(g).connect(reverb); };
    const pan = v => { const p = ac.createStereoPanner(); p.pan.value = v; return p; };
    const filt = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const env = (param, t, a, peak, decay) => {
      param.setValueAtTime(0.0001, t);
      param.linearRampToValueAtTime(peak, t + a);
      param.exponentialRampToValueAtTime(0.0001, t + a + decay);
    };
    const osc = (type, f, t, dur) => {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.start(t);
      o.stop(t + dur);
      return o;
    };
    const noise = (t, dur) => {
      const s = ac.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      s.start(t, R() * 1.5);
      s.stop(t + dur + 0.05);
      return s;
    };

    // ── sounds ──────────────────────────────────────────────────────────
    function blip(t, f, v = 0.12, d = 0.06, p = 0) {
      const g = ac.createGain(); env(g.gain, t, 0.002, v, d);
      osc('sine', f, t, d + 0.05).connect(g).connect(pan(p)).connect(bus);
      send(g, 0.2);
    }
    function whoosh(t0, dur, { from = 500, to = 5000, v = 0.4, p0 = 0.7, p1 = 0, q = 1.2 } = {}) {
      const bp = filt('bandpass', from, q);
      bp.frequency.setValueAtTime(from, t0);
      bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + dur);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.03);
      const pn = ac.createStereoPanner();
      pn.pan.setValueAtTime(p0, t0);
      pn.pan.linearRampToValueAtTime(p1, t0 + dur);
      noise(t0, dur + 0.1).connect(bp).connect(g).connect(pn).connect(bus);
      send(g, 0.2);
    }
    function thwack(t) {
      const gn = ac.createGain(); env(gn.gain, t, 0.0005, 0.7, 0.03);
      noise(t, 0.06).connect(filt('bandpass', 2600, 1.4)).connect(gn).connect(bus);
      const o = osc('sine', 150, t, 0.3);
      o.frequency.setValueAtTime(170, t);
      o.frequency.exponentialRampToValueAtTime(62, t + 0.1);
      const g = ac.createGain(); env(g.gain, t, 0.001, 0.8, 0.16);
      const sh = ac.createWaveShaper(); sh.curve = SAT;
      o.connect(sh).connect(g).connect(bus);
      send(gn, 0.25);
    }
    function twang(t, f = hz('A2')) {
      const o = osc('sawtooth', f, t, 0.9);
      const lfo = osc('sine', 8.5, t, 0.9);
      const depth = ac.createGain();
      depth.gain.setValueAtTime(f * 0.06, t);
      depth.gain.exponentialRampToValueAtTime(f * 0.002, t + 0.45);
      lfo.connect(depth).connect(o.frequency);
      const lp = filt('lowpass', 2400, 2);
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.45);
      const g = ac.createGain(); env(g.gain, t, 0.002, 0.18, 0.5);
      o.connect(lp).connect(g).connect(pan(-0.1)).connect(bus);
      send(g, 0.2);
    }
    function pluck(t, f, v = 0.5, p = 0) {
      const out = ac.createGain(); out.gain.value = v;
      out.connect(pan(p)).connect(bus);
      send(out, 0.35);
      for (const [m, a, d] of [[1, 1, 0.8], [2.0, 0.3, 0.3], [4.0, 0.25, 0.09]]) {
        const g = ac.createGain(); env(g.gain, t, 0.002, a, d);
        osc('sine', f * m, t, d + 0.1).connect(g).connect(out);
      }
      const c = ac.createGain(); env(c.gain, t, 0.0005, 0.12 * v, 0.01);
      noise(t, 0.02).connect(filt('bandpass', 5000, 2)).connect(c).connect(pan(p)).connect(bus);
    }
    function clack(t, v = 0.3, pitch = 1, p = 0) {
      const o = osc('sine', 1700 * pitch, t, 0.08);
      o.frequency.setValueAtTime(1700 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(700 * pitch, t + 0.03);
      const g = ac.createGain(); env(g.gain, t, 0.0008, 0.5 * v, 0.035);
      o.connect(g).connect(pan(p)).connect(bus);
    }
    // the box snapping: a dry crack with a few bright chips in it
    function crack(t) {
      const g = ac.createGain(); env(g.gain, t, 0.0005, 0.6, 0.09);
      noise(t, 0.15).connect(filt('highpass', 2500)).connect(g).connect(bus);
      send(g, 0.35);
      for (let k = 0; k < 6; k++) {
        const tk = t + 0.004 + R() * 0.06;
        blip(tk, 2800 + R() * 3200, 0.05, 0.03, R() * 1.4 - 0.7);
      }
      const o = osc('sine', 220, t, 0.2);
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
      const go = ac.createGain(); env(go.gain, t, 0.001, 0.35, 0.1);
      o.connect(go).connect(bus);
    }
    function thunk(t) {
      const o = osc('sine', 90, t, 2.4);
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 0.55);
      const g = ac.createGain(); env(g.gain, t, 0.003, 0.95, 1.3);
      const sh = ac.createWaveShaper(); sh.curve = SAT;
      o.connect(sh).connect(g).connect(bus);
      const lp = filt('lowpass', 7000);
      lp.frequency.setValueAtTime(7000, t);
      lp.frequency.exponentialRampToValueAtTime(240, t + 0.3);
      const gn = ac.createGain(); env(gn.gain, t, 0.001, 0.55, 0.3);
      noise(t, 0.5).connect(lp).connect(gn).connect(bus);
      send(gn, 0.4);
    }
    function riser(t0, t1, v = 0.18) {
      const bp = filt('bandpass', 400, 0.9);
      bp.frequency.setValueAtTime(400, t0);
      bp.frequency.exponentialRampToValueAtTime(6000, t1);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t1);
      g.gain.linearRampToValueAtTime(0.0001, t1 + 0.02);
      noise(t0, t1 - t0).connect(bp).connect(g).connect(bus);
    }
    function chord(t0, notes, v = 0.3, rel = 2.4) {
      const lp = filt('lowpass', 900, 0.5);
      lp.frequency.setValueAtTime(900, t0);
      lp.frequency.exponentialRampToValueAtTime(3400, t0 + 0.35);
      lp.frequency.exponentialRampToValueAtTime(1100, t0 + rel);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + rel);
      lp.connect(g).connect(bus);
      send(g, 0.5);
      notes.forEach((nm, k) => {
        for (const det of [-7, 7]) {
          const o = osc('sawtooth', hz(nm), t0, rel + 0.05);
          o.detune.value = det + (k % 2 ? 2 : -2);
          const og = ac.createGain(); og.gain.value = 0.045;
          o.connect(og).connect(pan(det < 0 ? -0.5 : 0.5)).connect(lp);
        }
      });
    }
    function chime(t, notes, v = 0.12) {
      notes.forEach((nm, k) => {
        const f = hz(nm), p = (k - (notes.length - 1) / 2) * 0.4;
        for (const [m, a, d] of [[1, 1, 1.4], [2.0, 0.35, 0.8], [3.01, 0.16, 0.5], [4.2, 0.1, 0.3]]) {
          const g = ac.createGain(); env(g.gain, t + k * 0.035, 0.003, a * v, d);
          osc('sine', f * m, t + k * 0.035, d + 0.1).connect(g).connect(pan(p)).connect(bus);
          send(g, 0.5);
        }
      });
    }
    function shimmer(t0, dur, v = 0.07) {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const bp = filt('bandpass', 6000, 3);
      bp.frequency.setValueAtTime(4000, t0);
      bp.frequency.exponentialRampToValueAtTime(11000, t0 + dur);
      const pn = ac.createStereoPanner();
      pn.pan.setValueAtTime(-0.6, t0);
      pn.pan.linearRampToValueAtTime(0.6, t0 + dur);
      noise(t0, dur).connect(bp).connect(g).connect(pn).connect(bus);
      send(g, 0.4);
    }

    // ── score ───────────────────────────────────────────────────────────
    // aim: the scope locks on
    blip(0.125, hz('A6'), 0.07, 0.05, -0.3);
    blip(T.aim + 0.2, hz('A6'), 0.08, 0.05, 0);
    blip(T.aim + 0.32, hz('A6'), 0.09, 0.05, 0.3);
    blip(T.aim + 0.4, hz('E7'), 0.09, 0.04);
    blip(T.aim + 0.44, hz('E7'), 0.09, 0.08);
    // hit the mark
    whoosh(T.fly0, T.hit - T.fly0, { from: 700, to: 6000, v: 0.45, p0: 0.8, p1: 0 });
    thwack(T.hit);
    twang(T.hit);
    // growth: one rising note per step
    clack(T.pop, 0.35, 1.1, -0.4); clack(T.pop + 0.0625, 0.35, 1.25, 0.4);
    pluck(T.pop, hz('D4'), 0.45, -0.2);
    pluck(T.grow1, hz('F#4'), 0.48, 0.2);
    pluck(T.grow2, hz('A4'), 0.5, -0.1);
    pluck(T.push, hz('D5'), 0.55, 0.1);
    riser(T.grow1, T.land, 0.16);
    // outside the box
    crack(T.push + 0.02);
    whoosh(T.land - 0.2, 0.2, { from: 400, to: 3500, v: 0.35, p0: 0.6, p1: 0 });
    thunk(T.land);
    pluck(T.land, hz('E5'), 0.5, 0);
    chord(T.land, ['D3', 'A3', 'D4', 'F#4', 'E5'], 0.3, 2.6);   // Dadd9
    const bass = osc('sine', hz('D2'), T.land, 2.4);
    const bg = ac.createGain(); env(bg.gain, T.land, 0.005, 0.45, 2.0);
    bass.connect(bg).connect(bus);
    whoosh(T.tilt0, T.tilt1 - T.tilt0, { from: 300, to: 1800, v: 0.1, p0: -0.7, p1: 0.7, q: 0.8 });
    // captions tick in as they resolve
    if (words) for (const [t0] of root.D32Mark.CAPTIONS) for (let k = 0; k < 4; k++) blip(t0 + k * 0.045, 3000 + k * 400, 0.035, 0.015, 0.2);
    shimmer(T.glint0, T.glint1 - T.glint0 + 0.3);
    chime(T.glint0 + 0.08, ['D6', 'A6'], 0.1);

    master.gain.setValueAtTime(0.9, 0);
    master.gain.setValueAtTime(0.9, D - 0.6);
    master.gain.linearRampToValueAtTime(0.0001, D);

    const out = await ac.startRendering();
    let peak = 0;
    for (let c = 0; c < out.numberOfChannels; c++) {
      const d = out.getChannelData(c);
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    }
    const k = peak > 0 ? 0.891 / peak : 1;
    for (let c = 0; c < out.numberOfChannels; c++) {
      const d = out.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] *= k;
    }
    return out;
  }

  function wav16(buf) {
    const n = buf.length, ch = buf.numberOfChannels, bytes = 44 + n * ch * 2;
    const dv = new DataView(new ArrayBuffer(bytes));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); str(8, 'WAVE');
    str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true);
    dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
    str(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const data = [...Array(ch).keys()].map(c => buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < ch; c++) {
        const x = Math.max(-1, Math.min(1, data[c][i]));
        dv.setInt16(o, x < 0 ? x * 32768 : x * 32767, true);
        o += 2;
      }
    }
    return new Uint8Array(dv.buffer);
  }

  async function renderWavBase64() {
    const bytes = wav16(await render());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  root.D32MarkAudio = { render, renderWavBase64 };
})(window);
