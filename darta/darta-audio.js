/* ============================================================================
 *  DARTA — LOGO MOTION · darta-audio.js
 *
 *  Quiet, warm sound for a serious product: air, soft bells, a felt-tip
 *  marker, glass and a low pad, never an impact. All five directions sit in
 *  D major so the brand keeps one sonic identity whichever is chosen. Each
 *  score reads its timings from the same numbers as the picture in
 *  darta.js, and is rendered offline so every cue lands on its frame.
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
    const OPT = root.Darta.option, D = root.Darta.DURATION;
    const ac = new OfflineAudioContext(2, Math.ceil(SR * D), SR);
    const R = rng(11 + OPT);

    const noiseBuf = ac.createBuffer(2, SR * 2, SR);
    for (let c = 0; c < 2; c++) {
      const d = noiseBuf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
    }
    // a long, dark, smooth room
    const ir = ac.createBuffer(2, Math.floor(SR * 3.4), SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        const x = i / SR;
        lp += 0.22 * ((R() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-x * 2.1) * (x < 0.02 ? x / 0.02 : 1);
      }
    }

    // ── buses ───────────────────────────────────────────────────────────
    const master = ac.createGain();
    const glue = ac.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2;
    glue.attack.value = 0.01; glue.release.value = 0.3;
    master.connect(glue).connect(ac.destination);
    const reverb = ac.createConvolver();
    reverb.buffer = ir;
    const wet = ac.createGain();
    wet.gain.value = 0.6;
    reverb.connect(wet).connect(master);
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

    // ── the palette ─────────────────────────────────────────────────────
    function bell(t, f, v = 0.1, d = 1.6, p = 0, rev = 0.55) {
      const out = ac.createGain(); out.gain.value = v;
      out.connect(pan(p)).connect(bus);
      send(out, rev);
      for (const [m, a, dd] of [[1, 1, d], [2.0, 0.28, d * 0.55], [3.01, 0.12, d * 0.35], [4.2, 0.06, d * 0.2]]) {
        const g = ac.createGain(); env(g.gain, t, 0.004, a, dd);
        osc('sine', f * m, t, dd + 0.1).connect(g).connect(out);
      }
    }
    function pluck(t, f, v = 0.12, p = 0) {
      const out = ac.createGain(); out.gain.value = v;
      out.connect(pan(p)).connect(bus);
      send(out, 0.4);
      for (const [m, a, d] of [[1, 1, 0.5], [2, 0.22, 0.18]]) {
        const g = ac.createGain(); env(g.gain, t, 0.003, a, d);
        osc('sine', f * m, t, d + 0.1).connect(g).connect(out);
      }
    }
    // swelling air: sin² envelope over the duration, a band sweeping f0 → f1
    function air(t0, dur, { f0 = 500, f1 = 1600, v = 0.08, p0 = 0, p1 = 0, q = 0.9, peakAt = 0.5 } = {}) {
      const bp = filt('bandpass', f0, q);
      bp.frequency.setValueAtTime(f0, t0);
      bp.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + dur * peakAt);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      const pn = ac.createStereoPanner();
      pn.pan.setValueAtTime(p0, t0);
      pn.pan.linearRampToValueAtTime(p1, t0 + dur);
      noise(t0, dur + 0.05).connect(bp).connect(g).connect(pn).connect(bus);
      send(g, 0.35);
    }
    function pad(t0, t1, notes, { v = 0.1, attack = 0.5, cut0 = 500, cut1 = 1800 } = {}) {
      const lp = filt('lowpass', cut0, 0.5);
      lp.frequency.setValueAtTime(cut0, t0);
      lp.frequency.exponentialRampToValueAtTime(cut1, t0 + attack + 0.6);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t1);
      lp.connect(g).connect(bus);
      send(g, 0.5);
      notes.forEach((nm, k) => {
        for (const det of [-5, 5]) {
          const o = osc('triangle', hz(nm), t0, t1 - t0 + 0.05);
          o.detune.value = det + (k % 2 ? 1.5 : -1.5);
          const og = ac.createGain(); og.gain.value = 0.16;
          o.connect(og).connect(pan(det < 0 ? -0.4 : 0.4)).connect(lp);
        }
      });
    }
    function thud(t, v = 0.12, f = 92) {
      const o = osc('sine', f, t, 0.5);
      o.frequency.setValueAtTime(f * 1.3, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.16);
      const g = ac.createGain(); env(g.gain, t, 0.006, v, 0.28);
      o.connect(g).connect(bus);
    }
    function tick(t, v = 0.05, f = 3200, p = 0) {
      const g = ac.createGain(); env(g.gain, t, 0.0008, v, 0.02);
      noise(t, 0.04).connect(filt('bandpass', f, 2.5)).connect(g).connect(pan(p)).connect(bus);
      const tg = ac.createGain(); env(tg.gain, t, 0.001, v * 0.35, 0.03);
      osc('sine', f * 0.62, t, 0.08).connect(tg).connect(pan(p)).connect(bus);
      send(g, 0.2);
    }
    // a felt-tip marker drawn across paper
    function marker(t0, dur, v = 0.07, p0 = -0.3, p1 = 0.3) {
      const bp = filt('bandpass', 3600, 1.1);
      bp.frequency.setValueAtTime(3600, t0);
      bp.frequency.exponentialRampToValueAtTime(2300, t0 + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(v * 0.35, t0 + dur * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      const pn = ac.createStereoPanner();
      pn.pan.setValueAtTime(p0, t0);
      pn.pan.linearRampToValueAtTime(p1, t0 + dur);
      noise(t0, dur).connect(bp).connect(g).connect(pn).connect(bus);
      const body = ac.createGain();
      body.gain.setValueAtTime(0.0001, t0);
      body.gain.linearRampToValueAtTime(v * 0.5, t0 + 0.03);
      body.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      noise(t0, dur).connect(filt('lowpass', 700)).connect(body).connect(pn);
      send(g, 0.15);
    }
    // glass: soft inharmonic partials
    function glass(t, f = 1760, v = 0.07, d = 1.4, p = 0) {
      const out = ac.createGain(); out.gain.value = v;
      out.connect(pan(p)).connect(bus);
      send(out, 0.6);
      for (const [m, a, dd] of [[1, 1, d], [2.32, 0.45, d * 0.6], [4.25, 0.22, d * 0.35], [6.63, 0.1, d * 0.2]]) {
        const g = ac.createGain(); env(g.gain, t, 0.002, a, dd);
        osc('sine', f * m, t, dd + 0.1).connect(g).connect(out);
      }
    }
    function droplet(t, v = 0.1) {
      const o = osc('sine', 480, t, 0.2);
      o.frequency.setValueAtTime(480, t);
      o.frequency.exponentialRampToValueAtTime(1350, t + 0.045);
      const g = ac.createGain(); env(g.gain, t, 0.002, v, 0.07);
      o.connect(g).connect(bus);
      send(g, 0.5);
    }
    function sub(t0, t1, f, v = 0.1) {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + (t1 - t0) * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc('sine', f, t0, t1 - t0 + 0.05).connect(g).connect(bus);
      const h = ac.createGain(); h.gain.value = 0.25;
      osc('sine', f * 2, t0, t1 - t0 + 0.05).connect(h).connect(g);
    }

    // ── scores ──────────────────────────────────────────────────────────
    const SCORES = {
      1() { // Safeguard: a point of light, enclosed
        bell(0.12, hz('D6'), 0.05, 2.2, 0, 0.8);
        air(0.1, 1.2, { f0: 5000, f1: 9000, v: 0.025, q: 0.7 });
        sub(0.1, 4.8, hz('D2'), 0.055);
        [[-0.5, 0], [0.5, 1], [0.5, 2], [-0.5, 3]].forEach(([p, i]) =>
          air(0.6 + 0.065 * i, 0.72, { f0: 380, f1: 1400, v: 0.07, p0: p * 1.4, p1: p * 0.5, peakAt: 0.72 }));
        thud(1.22, 0.075, 86);
        pad(1.1, 5.0, ['D3', 'A3', 'E4', 'F#4'], { v: 0.09, attack: 0.6, cut0: 420, cut1: 1600 });
        air(1.95, 0.8, { f0: 1500, f1: 3200, v: 0.03, p0: -0.4, p1: 0.4 });
        bell(2.12, hz('A5'), 0.04, 1.6, -0.2);
        bell(2.24, hz('D6'), 0.035, 1.8, 0.2);
        air(3.4, 0.9, { f0: 6000, f1: 10000, v: 0.018, p0: -0.5, p1: 0.5 });
      },
      2() { // Redact: marker strokes, a set dot, the name revealed
        marker(0.14, 0.5, 0.075, -0.55, -0.1);
        marker(0.32, 0.5, 0.07, 0.1, 0.55);
        marker(0.5, 0.5, 0.075, -0.55, -0.1);
        marker(0.68, 0.5, 0.07, 0.1, 0.55);
        const gl = osc('sine', hz('A3'), 1.02, 0.75);
        gl.frequency.setValueAtTime(hz('A3'), 1.02);
        gl.frequency.exponentialRampToValueAtTime(hz('D4'), 1.7);
        const gg = ac.createGain();
        gg.gain.setValueAtTime(0.0001, 1.02);
        gg.gain.linearRampToValueAtTime(0.035, 1.35);
        gg.gain.linearRampToValueAtTime(0.0001, 1.75);
        gl.connect(gg).connect(bus);
        send(gg, 0.5);
        pluck(1.34, hz('D5'), 0.1);
        tick(1.34, 0.04, 2400);
        marker(1.55, 0.55, 0.08, 0.0, 0.6);
        air(2.22, 0.63, { f0: 900, f1: 2600, v: 0.04, p0: -0.1, p1: 0.6 });
        pad(2.35, 5.0, ['D3', 'A3', 'D4', 'F#4'], { v: 0.08, attack: 0.35, cut0: 700, cut1: 2200 });
        bell(2.5, hz('D5'), 0.05, 1.8, -0.2);
        bell(2.56, hz('A5'), 0.045, 1.8, 0.2);
        bell(2.62, hz('F#6'), 0.03, 1.6, 0);
      },
      3() { // Construct: guides, compass, fills, penned letters
        tick(0.1, 0.035, 2800, -0.3);
        tick(0.2, 0.035, 2800, 0.3);
        const ru = osc('sine', hz('D4'), 0.1, 0.9);
        ru.frequency.setValueAtTime(hz('D4'), 0.1);
        ru.frequency.exponentialRampToValueAtTime(hz('A4'), 0.95);
        const rg = ac.createGain();
        rg.gain.setValueAtTime(0.0001, 0.1);
        rg.gain.linearRampToValueAtTime(0.022, 0.5);
        rg.gain.linearRampToValueAtTime(0.0001, 1.0);
        ru.connect(rg).connect(bus);
        send(rg, 0.5);
        ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6'].forEach((n, i) => pluck(0.34 + 0.055 * i, hz(n), 0.04, -0.6 + i * 0.17));
        [0, 1, 2, 3].forEach(i => thud(1.36 + 0.06 * i, 0.05, 110));
        pad(1.22, 5.0, ['D3', 'A3', 'D4', 'E4'], { v: 0.08, attack: 0.55, cut0: 450, cut1: 1700 });
        pluck(1.58, hz('D5'), 0.09);
        for (let i = 0; i < 5; i++) tick(1.05 + 0.09 * i, 0.022, 3600, 0.1 + i * 0.1);
        bell(2.2, hz('D5'), 0.045, 1.8, -0.2);
        bell(2.26, hz('A5'), 0.04, 1.8, 0.2);
      },
      4() { // Privacy Glass: frost, a clean split, colour flooding in, a droplet
        air(0.18, 1.0, { f0: 6000, f1: 11000, v: 0.03, q: 0.6, p0: -0.3, p1: 0.3 });
        glass(0.3, 1320, 0.045, 1.8, -0.1);
        glass(0.99, 2210, 0.05, 1.1, 0.15);
        tick(0.99, 0.025, 5200);
        air(1.0, 0.62, { f0: 800, f1: 2200, v: 0.03, p0: -0.4, p1: 0.4 });
        pad(1.25, 5.0, ['D3', 'A3', 'C#4', 'F#4'], { v: 0.085, attack: 0.8, cut0: 380, cut1: 2400 });
        droplet(1.42, 0.09);
        droplet(1.6, 0.035);
        air(2.05, 1.0, { f0: 500, f1: 1400, v: 0.035, p0: 0.2, p1: -0.3 });
        air(2.2, 0.8, { f0: 5000, f1: 9000, v: 0.02, p0: 0.3, p1: 0.6 });
        bell(2.6, hz('F#5'), 0.045, 1.8, -0.15);
        bell(2.66, hz('D6'), 0.04, 1.8, 0.15);
      },
      5() { // Converge: pieces arriving from depth, a lock, the name sliding out
        pad(0.3, 5.0, ['D2', 'A2', 'D3', 'F#3'], { v: 0.09, attack: 1.2, cut0: 300, cut1: 1300 });
        [[-0.6, 0], [0.6, 1], [0.6, 2], [-0.6, 3]].forEach(([p, i]) =>
          air(0.22 + 0.085 * i, 0.85, { f0: 300, f1: 1500, v: 0.065, p0: p, p1: p * 0.3, peakAt: 0.78 }));
        air(0.98, 0.42, { f0: 1800, f1: 700, v: 0.035, peakAt: 0.8 });
        thud(1.2, 0.055, 100);
        tick(1.2, 0.03, 2600);
        pluck(1.36, hz('A5'), 0.06);
        air(1.86, 1.0, { f0: 600, f1: 2000, v: 0.04, p0: -0.2, p1: 0.6 });
        bell(2.6, hz('D5'), 0.04, 2.0, -0.2);
        bell(2.66, hz('A5'), 0.035, 2.0, 0.1);
        bell(2.72, hz('F#6'), 0.022, 1.8, 0.3);
      },
    };
    SCORES[OPT]();

    master.gain.setValueAtTime(1, 0);
    master.gain.setValueAtTime(1, D - 0.6);
    master.gain.linearRampToValueAtTime(0.0001, D);

    const out = await ac.startRendering();
    // Match the options by loudness, not peak, so none wins by being louder:
    // BS.1770 K-weighted, gated, to −16 LUFS, with peaks kept under −1.5 dBFS.
    const k = Math.min(10 ** ((-16 - lufs(out)) / 20), 0.84 / peakOf(out));
    for (let c = 0; c < out.numberOfChannels; c++) {
      const d = out.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] *= k;
    }
    return out;
  }

  function peakOf(buf) {
    let peak = 1e-9;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    }
    return peak;
  }
  // integrated loudness (ITU-R BS.1770-4) at 48 kHz: K-weighting, 400 ms blocks, both gates
  function lufs(buf) {
    const n = buf.length, hop = SR / 10, win = SR * 0.4, sq = [];
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const x = buf.getChannelData(c), y = new Float64Array(n);
      let [a1, a2, b1, b2] = [0, 0, 0, 0], [c1, c2, d1, d2] = [0, 0, 0, 0];
      for (let i = 0; i < n; i++) {
        const s1 = 1.53512485958697 * x[i] - 2.69169618940638 * b1 + 1.19839281085285 * b2 + 1.69065929318241 * a1 - 0.73248077421585 * a2;
        b2 = b1; b1 = x[i]; a2 = a1; a1 = s1;
        const s2 = s1 - 2 * d1 + d2 + 1.99004745483398 * c1 - 0.99007225036621 * c2;
        d2 = d1; d1 = s1; c2 = c1; c1 = s2;
        y[i] = s2 * s2;
      }
      sq.push(y);
    }
    const blocks = [];
    for (let s = 0; s + win <= n; s += hop) {
      let z = 0;
      for (const y of sq) { let m = 0; for (let i = s; i < s + win; i++) m += y[i]; z += m / win; }
      blocks.push(z);
    }
    const L = z => -0.691 + 10 * Math.log10(z);
    const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
    const abs = blocks.filter(z => L(z) > -70);
    const rel = L(mean(abs)) - 10;
    return L(mean(abs.filter(z => L(z) > rel)));
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

  root.DartaAudio = { render, renderWavBase64 };
})(window);
