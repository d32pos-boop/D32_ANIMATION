/* ============================================================================
 *  D32 — LOGO STING · sting-audio.js
 *
 *  A sonic logo locked to the sting's timeline (D32Sting.T): the arrow's
 *  whoosh, the thwack and twang as it sticks (the twang vibrates at the same
 *  8.5 Hz as the picture's wobble), then D, 3 and 2 sounded as scale degrees
 *  1–3–2 of D major (D, F#, E) resolving into a Dadd9 chord: D32 as a chord.
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
    const T = root.D32Sting.T, D = root.D32Sting.DURATION;
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
    // the arrow sticks: a woody thwack, then the shaft twangs at the wobble rate
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
      depth.gain.exponentialRampToValueAtTime(f * 0.002, t + 0.5);
      lfo.connect(depth).connect(o.frequency);
      const lp = filt('lowpass', 2400, 2);
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.5);
      const g = ac.createGain(); env(g.gain, t, 0.002, 0.2, 0.6);
      o.connect(lp).connect(g).connect(pan(-0.1)).connect(bus);
      send(g, 0.2);
    }
    function pluck(t, f, v = 0.5, p = 0) {
      const out = ac.createGain(); out.gain.value = v;
      out.connect(pan(p)).connect(bus);
      send(out, 0.35);
      for (const [m, a, d] of [[1, 1, 0.9], [2.0, 0.3, 0.35], [4.0, 0.28, 0.1]]) {
        const g = ac.createGain(); env(g.gain, t, 0.002, a, d);
        osc('sine', f * m, t, d + 0.1).connect(g).connect(out);
      }
      const c = ac.createGain(); env(c.gain, t, 0.0005, 0.12 * v, 0.01);
      noise(t, 0.02).connect(filt('bandpass', 5000, 2)).connect(c).connect(pan(p)).connect(bus);
    }
    function thunk(t) {
      const o = osc('sine', 90, t, 2.2);
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 0.55);
      const g = ac.createGain(); env(g.gain, t, 0.003, 0.95, 1.2);
      const sh = ac.createWaveShaper(); sh.curve = SAT;
      o.connect(sh).connect(g).connect(bus);
      const lp = filt('lowpass', 7000);
      lp.frequency.setValueAtTime(7000, t);
      lp.frequency.exponentialRampToValueAtTime(240, t + 0.3);
      const gn = ac.createGain(); env(gn.gain, t, 0.001, 0.55, 0.3);
      noise(t, 0.5).connect(lp).connect(gn).connect(bus);
      send(gn, 0.4);
      const c = ac.createGain(); env(c.gain, t, 0.0005, 0.3, 0.02);
      noise(t, 0.04).connect(filt('highpass', 3000)).connect(c).connect(bus);
    }
    function chord(t0, notes, v = 0.3, rel = 1.9) {
      const lp = filt('lowpass', 900, 0.5);
      lp.frequency.setValueAtTime(900, t0);
      lp.frequency.exponentialRampToValueAtTime(3200, t0 + 0.4);
      lp.frequency.exponentialRampToValueAtTime(1200, t0 + rel);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + rel);
      lp.connect(g).connect(bus);
      send(g, 0.5);
      notes.forEach((nm, k) => {
        for (const det of [-7, 7]) {
          const o = osc('sawtooth', hz(nm), t0, rel + 0.05);
          o.detune.value = det + (k % 2 ? 2 : -2);
          const og = ac.createGain(); og.gain.value = 0.05;
          o.connect(og).connect(pan(det < 0 ? -0.5 : 0.5)).connect(lp);
        }
      });
    }
    function chime(t, notes, v = 0.14) {
      notes.forEach((nm, k) => {
        const f = hz(nm), p = (k - (notes.length - 1) / 2) * 0.4;
        for (const [m, a, d] of [[1, 1, 1.5], [2.0, 0.35, 0.9], [3.01, 0.16, 0.6], [4.2, 0.1, 0.35]]) {
          const g = ac.createGain(); env(g.gain, t + k * 0.035, 0.003, a * v, d);
          osc('sine', f * m, t + k * 0.035, d + 0.1).connect(g).connect(pan(p)).connect(bus);
          send(g, 0.5);
        }
      });
    }
    function shimmer(t0, dur, v = 0.08) {
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
    whoosh(T.fly0, T.hit - T.fly0, { from: 700, to: 6000, v: 0.45, p0: 0.8, p1: 0 });
    thwack(T.hit);
    twang(T.hit);
    pluck(T.bloomD, hz('D5'), 0.42, -0.45);      // D  → degree 1
    pluck(T.bloom3, hz('F#5'), 0.42, 0.45);      // 3  → degree 3
    whoosh(T.plate0, T.land - T.plate0, { from: 400, to: 3500, v: 0.4, p0: 0.6, p1: 0 });
    thunk(T.land);
    pluck(T.land, hz('E5'), 0.5, 0);             // 2  → degree 2
    const bass = osc('sine', hz('D2'), T.land, 2.0);
    const bg = ac.createGain(); env(bg.gain, T.land, 0.005, 0.5, 1.6);
    bass.connect(bg).connect(bus);
    whoosh(T.tilt0, T.tilt1 - T.tilt0, { from: 300, to: 1800, v: 0.12, p0: -0.7, p1: 0.7, q: 0.8 });
    chord(T.word0 - 0.05, ['D4', 'F#4', 'A4', 'E5'], 0.3, 1.9);   // Dadd9: D, 3rd, 2nd
    shimmer(T.glint0, T.glint1 - T.glint0 + 0.3);
    chime(T.glint0 + 0.1, ['D6', 'A6'], 0.12);

    master.gain.setValueAtTime(0.9, 0);
    master.gain.setValueAtTime(0.9, D - 0.45);
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

  root.D32StingAudio = { render, renderWavBase64 };
})(window);
