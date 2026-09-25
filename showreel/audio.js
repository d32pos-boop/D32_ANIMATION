/* ============================================================================
 *  D32 — MOTION REEL · audio.js
 *
 *  The soundtrack is synthesised, not sampled: an OfflineAudioContext renders
 *  drums, bass, pads, plucks and sound design against the exact cue times the
 *  picture uses (D32.cues()), so every hit lands on its frame. 120 BPM,
 *  A minor: Am7 → Fmaj7 → Cmaj7 → Gadd9 → Am9 → E7 → Am.
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
    const cues = root.D32.cues();
    const D = cues.duration, B = 60 / cues.bpm;
    const ac = new OfflineAudioContext(2, Math.ceil(SR * D), SR);
    const R = rng(32);

    // ── shared resources ────────────────────────────────────────────────
    const noiseBuf = ac.createBuffer(2, SR * 2, SR);
    for (let c = 0; c < 2; c++) {
      const d = noiseBuf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
    }
    const ir = ac.createBuffer(2, Math.floor(SR * 2.8), SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        const x = i / SR;
        lp += 0.35 * ((R() * 2 - 1) - lp);                  // darken the tail a little
        d[i] = lp * Math.exp(-x * 2.6) * (x < 0.012 ? x / 0.012 : 1);
      }
    }
    const SAT = new Float32Array(1024).map((_, i) => Math.tanh(2.2 * (i / 511.5 - 1)) / Math.tanh(2.2));

    // ── buses ───────────────────────────────────────────────────────────
    const master = ac.createGain();
    const glue = ac.createDynamicsCompressor();
    glue.threshold.value = -12; glue.knee.value = 8; glue.ratio.value = 3.5;
    glue.attack.value = 0.004; glue.release.value = 0.18;
    master.connect(glue).connect(ac.destination);

    const reverb = ac.createConvolver();
    reverb.normalize = true;
    reverb.buffer = ir;
    const revRet = ac.createGain();
    revRet.gain.value = 0.55;
    reverb.connect(revRet).connect(master);

    const drumLP = ac.createBiquadFilter();
    drumLP.type = 'lowpass'; drumLP.frequency.value = 18000; drumLP.Q.value = 0.8;
    const drums = ac.createGain();
    drums.gain.value = 0.9;
    drums.connect(drumLP).connect(master);

    const duck = ac.createGain();
    const music = ac.createGain();
    music.gain.value = 0.8;
    music.connect(duck).connect(master);

    const fx = ac.createGain();
    fx.gain.value = 0.85;
    fx.connect(master);

    const ducks = [];
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

    // ── instruments ─────────────────────────────────────────────────────
    function kick(t, v = 1) {
      const o = osc('sine', 160, t, 0.6);
      o.frequency.setValueAtTime(165, t);
      o.frequency.exponentialRampToValueAtTime(56, t + 0.07);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.4);
      const sh = ac.createWaveShaper(); sh.curve = SAT;
      const g = ac.createGain(); env(g.gain, t, 0.002, 0.95 * v, 0.45);
      o.connect(sh).connect(g).connect(drums);
      const c = ac.createGain(); env(c.gain, t, 0.0005, 0.22 * v, 0.014);
      noise(t, 0.03).connect(filt('highpass', 3500)).connect(c).connect(drums);
      ducks.push([t, v]);
    }
    function clap(t, v = 1) {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      for (const d of [0, 0.011, 0.022]) {
        g.gain.setValueAtTime(0.75 * v, t + d);
        g.gain.exponentialRampToValueAtTime(0.08 * v, t + d + 0.009);
      }
      g.gain.setValueAtTime(0.55 * v, t + 0.033);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
      noise(t, 0.35).connect(filt('bandpass', 1500, 0.9)).connect(g).connect(drums);
      send(g, 0.3);
    }
    function hat(t, v = 0.5, open = false, p = 0) {
      const g = ac.createGain(); env(g.gain, t, 0.001, 0.32 * v, open ? 0.2 : 0.04);
      noise(t, open ? 0.3 : 0.08).connect(filt('highpass', 7800)).connect(g).connect(pan(p)).connect(drums);
    }
    function snare(t, v = 1) {
      const o = osc('triangle', 230, t, 0.2);
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
      const go = ac.createGain(); env(go.gain, t, 0.001, 0.45 * v, 0.09);
      o.connect(go).connect(drums);
      const gn = ac.createGain(); env(gn.gain, t, 0.001, 0.6 * v, 0.15);
      noise(t, 0.22).connect(filt('highpass', 1400)).connect(gn).connect(drums);
      send(gn, 0.18);
    }
    function bass(t, f, dur, v = 1, boom = false) {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5 * v, t + 0.008);
      if (boom) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      else {
        g.gain.setValueAtTime(0.5 * v, t + Math.max(0.01, dur - 0.05));
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
      }
      const lp = filt('lowpass', 700);
      osc('sine', f, t, dur + 0.05).connect(g);
      const h = ac.createGain(); h.gain.value = 0.22;
      osc('triangle', f * 2, t, dur + 0.05).connect(h).connect(g);
      g.connect(lp).connect(music);
    }
    function pad(t0, t1, notes, v = 0.5, cut0 = 1400, cut1 = 1400, rel = 0.6, fade = false) {
      const lp = filt('lowpass', cut0, 0.6);
      lp.frequency.setValueAtTime(cut0, t0);
      lp.frequency.exponentialRampToValueAtTime(cut1, t1);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + (fade ? 0.01 : 0.2));
      if (fade) g.gain.exponentialRampToValueAtTime(v * 0.12, t1);   // struck, then decaying
      else g.gain.setValueAtTime(v, t1);
      g.gain.linearRampToValueAtTime(0.0001, t1 + rel);
      lp.connect(g).connect(music);
      send(g, 0.4);
      notes.forEach((nm, k) => {
        for (const det of [-8, 8]) {
          const o = osc('sawtooth', hz(nm), t0, t1 - t0 + rel + 0.05);
          o.detune.value = det + (k % 2 ? 3 : -3);
          const og = ac.createGain(); og.gain.value = 0.05;
          o.connect(og).connect(pan(det < 0 ? -0.55 : 0.55)).connect(lp);
        }
      });
    }
    function pluck(t, f, v = 0.6, p = 0, bus = music) {
      const out = ac.createGain(); out.gain.value = v;
      out.connect(pan(p)).connect(bus);
      send(out, 0.3);
      for (const [m, a, d] of [[1, 1, 0.55], [2.0, 0.28, 0.25], [4.0, 0.3, 0.09]]) {
        const g = ac.createGain(); env(g.gain, t, 0.002, a, d);
        osc('sine', f * m, t, d + 0.1).connect(g).connect(out);
      }
    }
    function impact(t, power = 1) {
      const o = osc('sine', 90, t, 3);
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.3 + 0.35 * power);
      const g = ac.createGain(); env(g.gain, t, 0.003, 0.85 * Math.min(1.25, power), 0.45 + 0.9 * power);
      o.connect(g).connect(fx);
      const lp = filt('lowpass', 9000);
      lp.frequency.setValueAtTime(9000, t);
      lp.frequency.exponentialRampToValueAtTime(260, t + 0.35);
      const gn = ac.createGain(); env(gn.gain, t, 0.001, 0.55 * Math.min(1.3, power), 0.25 + 0.3 * power);
      noise(t, 1.2).connect(lp).connect(gn).connect(fx);
      send(gn, 0.45 * power);
    }
    function whoosh(t0, dur, { from = 400, to = 4000, v = 0.4, shape = 'in', p0 = -0.5, p1 = 0.5, q = 1.3 } = {}) {
      const bp = filt('bandpass', from, q);
      bp.frequency.setValueAtTime(from, t0);
      bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      if (shape === 'in') {
        g.gain.exponentialRampToValueAtTime(v, t0 + dur);
        g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.04);
      } else {
        g.gain.linearRampToValueAtTime(v, t0 + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      }
      const pn = ac.createStereoPanner();
      pn.pan.setValueAtTime(p0, t0);
      pn.pan.linearRampToValueAtTime(p1, t0 + dur);
      noise(t0, dur + 0.1).connect(bp).connect(g).connect(pn).connect(fx);
      send(g, 0.25);
    }
    function blade(t, v = 0.5) {
      const bp = filt('bandpass', 9000, 2.5);
      bp.frequency.setValueAtTime(10000, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + 0.07);
      const g = ac.createGain(); env(g.gain, t, 0.001, v, 0.075);
      noise(t, 0.12).connect(bp).connect(g).connect(fx);
      const tg = ac.createGain(); env(tg.gain, t, 0.001, 0.06 * v, 0.12);
      osc('sine', 3520, t, 0.2).connect(tg).connect(fx);
      send(g, 0.2);
    }
    function slide(t, dur = 0.16, v = 0.35) {
      const o = osc('triangle', 500, t, dur + 0.1);
      o.frequency.setValueAtTime(520, t);
      o.frequency.exponentialRampToValueAtTime(1500, t + dur);
      const g = ac.createGain(); env(g.gain, t, 0.01, 0.35 * v, dur);
      o.connect(filt('lowpass', 3000)).connect(g).connect(fx);
      whoosh(t, dur, { from: 1800, to: 7000, v: 0.3 * v / 0.35, shape: 'out', p0: -0.3, p1: 0.3 });
    }
    function blip(t, f, v = 0.2, d = 0.045, p = 0) {
      const g = ac.createGain(); env(g.gain, t, 0.001, v, d);
      osc('sine', f, t, d + 0.05).connect(g).connect(pan(p)).connect(fx);
      send(g, 0.15);
    }
    function beep(t, f, dur = 0.09, v = 0.2) {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.004);
      g.gain.setValueAtTime(v, t + dur - 0.01);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc('sine', f, t, dur + 0.02).connect(g).connect(fx);
      send(g, 0.25);
    }
    function clack(t, v = 0.5, pitch = 1, p = 0) {
      const o = osc('sine', 1700 * pitch, t, 0.08);
      o.frequency.setValueAtTime(1700 * pitch, t);
      o.frequency.exponentialRampToValueAtTime(700 * pitch, t + 0.03);
      const g = ac.createGain(); env(g.gain, t, 0.0008, 0.5 * v, 0.035);
      o.connect(g).connect(pan(p)).connect(fx);
      const gn = ac.createGain(); env(gn.gain, t, 0.0005, 0.25 * v, 0.012);
      noise(t, 0.03).connect(filt('bandpass', 4000, 1.5)).connect(gn).connect(pan(p)).connect(fx);
    }
    function thunk(t, v = 1) {
      const o = osc('sine', 200, t, 0.5);
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(62, t + 0.12);
      const g = ac.createGain(); env(g.gain, t, 0.001, 0.8 * v, 0.3);
      const sh = ac.createWaveShaper(); sh.curve = SAT;
      o.connect(sh).connect(g).connect(fx);
      clack(t, 0.7 * v, 0.6);
      send(g, 0.2);
    }
    function crash(t, v = 0.4, d = 2.2) {
      const g = ac.createGain(); env(g.gain, t, 0.002, v, d);
      noise(t, d + 0.2).connect(filt('highpass', 4200)).connect(g).connect(fx);
      send(g, 0.5);
    }
    function riser(t0, t1, v = 0.35) {
      const bp = filt('bandpass', 300, 0.9);
      bp.frequency.setValueAtTime(300, t0);
      bp.frequency.exponentialRampToValueAtTime(7000, t1);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t1);
      g.gain.linearRampToValueAtTime(0.0001, t1 + 0.02);
      noise(t0, t1 - t0).connect(bp).connect(g).connect(fx);
      const o = osc('sawtooth', 110, t0, t1 - t0 + 0.03);
      o.frequency.setValueAtTime(110, t0);
      o.frequency.exponentialRampToValueAtTime(880, t1);
      const lp = filt('lowpass', 500);
      lp.frequency.setValueAtTime(500, t0);
      lp.frequency.exponentialRampToValueAtTime(5000, t1);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.28 * v, t1);
      og.gain.linearRampToValueAtTime(0.0001, t1 + 0.02);
      o.connect(lp).connect(og).connect(fx);
      send(g, 0.3);
    }
    function chime(t, notes, v = 0.3) {
      notes.forEach((nm, k) => {
        const f = hz(nm), p = (k - (notes.length - 1) / 2) * 0.35;
        for (const [m, a, d] of [[1, 1, 2.2], [2.0, 0.35, 1.2], [3.01, 0.18, 0.8], [4.2, 0.12, 0.45]]) {
          const g = ac.createGain(); env(g.gain, t + k * 0.03, 0.003, a * v, d);
          osc('sine', f * m, t + k * 0.03, d + 0.1).connect(g).connect(pan(p)).connect(fx);
          send(g, 0.5);
        }
      });
    }
    function dataBurst(t, v = 0.12) {
      for (let k = 0; k < 6; k++) blip(t + k * 0.018, 1800 + R() * 3000, v, 0.018, R() * 1.2 - 0.6);
    }

    // ── score ───────────────────────────────────────────────────────────
    const PENTA = ['A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7'];

    // 01 COUNTDOWN — film-leader beeps, one per glyph, a higher one on "go"
    for (let k = 0; k < 7; k++) blip(0.12 + k * 0.0625, 2600 + (k % 3) * 400, 0.07, 0.02, -0.6 + k * 0.2);
    whoosh(0.05, 0.45, { from: 150, to: 1200, v: 0.12, q: 0.8 });
    whoosh(0.3, 0.2, { from: 500, to: 6000, v: 0.4, p0: 0.6, p1: 0 });
    impact(0.5, 1.0); beep(0.5, hz('A5'));
    blade(0.5625); blade(0.595, 0.35);
    slide(1.0); impact(1.0, 0.4); beep(1.0, hz('A5'));
    slide(1.5); impact(1.5, 0.4); beep(1.5, hz('A5'));
    for (let t = 0.75; t < 1.99; t += B / 2) blip(t, 2200, 0.05, 0.015, 0.3);
    whoosh(1.7, 0.3, { from: 200, to: 5000, v: 0.3, q: 0.8, p0: -0.2, p1: 0.2 });

    // 02 ASSEMBLE
    beep(2.0, hz('A6'), 0.22, 0.2);
    impact(2.0, 0.6);
    whoosh(2.0, 0.6, { from: 5000, to: 250, v: 0.35, shape: 'out', p0: 0, p1: 0 });
    whoosh(2.05, 0.2, { from: 600, to: 5000, v: 0.25, p0: 0.5, p1: 0.1 });
    thunk(2.25, 0.6); clack(2.25, 0.5, 1.2, 0.2);
    whoosh(2.3, 0.2, { from: 500, to: 6000, v: 0.35, p0: 0.6, p1: 0.2 });
    thunk(2.5, 1.0); impact(2.5, 0.75);
    for (const t of [2.0, 2.5, 3.0, 3.5]) kick(t);
    for (const t of [2.25, 2.75, 3.25, 3.75]) { hat(t, 0.6, false, 0.25); bass(t, hz('A1'), 0.2); }
    clap(3.5, 0.8);
    for (const t of [2.97, 3.05]) blip(t, hz('E6'), 0.07, 0.03, 0.2);   // focus lock
    blip(3.12, hz('A6'), 0.06, 0.05, 0.2);
    pad(2.0, 4.0, ['A3', 'C4', 'E4', 'G4'], 0.45, 900, 1800);

    // 03 CONSTRUCT — the drums go under water while the blueprint draws
    drumLP.frequency.setValueAtTime(18000, 3.99);
    drumLP.frequency.exponentialRampToValueAtTime(650, 4.06);
    drumLP.frequency.setValueAtTime(650, 5.4);
    drumLP.frequency.exponentialRampToValueAtTime(18000, 5.99);
    whoosh(4.0, 0.36, { from: 3000, to: 9000, v: 0.3, shape: 'out', p0: 0, p1: 0, q: 2 });
    blip(4.0, 1760, 0.12, 0.3);
    kick(4.0, 0.9); kick(5.0, 0.8); kick(5.5, 0.7); kick(5.75, 0.6);
    for (let t = 4.0; t < 5.99; t += B / 4) hat(t, 0.25 + ((t * 4) % 2 < 1 ? 0 : 0.12), false, R() * 0.6 - 0.3);
    for (let k = 0; k < 14; k++) blip(4.04 + k * 0.04, 3200 + R() * 1800, 0.045, 0.012, R() * 1.6 - 0.8);
    for (let k = 0; k < 11; k++) blip(4.5 + k * 0.025, hz(PENTA[k % PENTA.length]), 0.07, 0.05, -0.5 + k * 0.1);
    for (const [k, t] of [4.5, 4.625, 4.75].entries()) blip(t, hz(['E5', 'A5', 'C6'][k]), 0.09, 0.08, -0.7);
    for (const t of [4.75, 5.0, 5.25, 5.5]) { blip(t, hz('E6'), 0.1, 0.06, 0.4); clack(t, 0.25, 1.6, 0.4); }
    pad(4.0, 6.0, ['F3', 'A3', 'C4', 'E4'], 0.3, 500, 2600);
    bass(4.0, hz('F1'), 1.95, 0.45);
    riser(5.0, 6.0, 0.3);

    // 04 DIMENSION — the cubes are keys: D = root, 3 = third, 2 = fifth
    impact(6.0, 0.7); crash(6.0, 0.28, 1.6);
    const chordAt = t => (t < 8 ? { D: 'C5', T: 'E5', Z: 'G5' } : { D: 'G4', T: 'B4', Z: 'D5' });
    pluck(6.25, hz('C5'), 0.5, -0.4); thunk(6.25, 0.35);
    pluck(6.5, hz('E5'), 0.5, 0.4); thunk(6.5, 0.35);
    for (const k of cues.keys) pluck(k.t, hz(chordAt(k.t)[k.cube]), 0.35 + k.amp / 70, k.cube === 'D' ? -0.45 : k.cube === 'T' ? 0.45 : 0);
    for (let t = 6.0; t < 9.99; t += B) kick(t);
    for (const t of [6.5, 7.5, 8.5, 9.5]) clap(t);
    for (let t = 6.0; t < 9.99; t += B / 4) {
      const s = Math.round((t - 6) / (B / 4)) % 4;
      hat(t, [0.35, 0.18, 0.7, 0.18][s], s === 2, s % 2 ? 0.3 : -0.3);
    }
    for (let t = 6.25; t < 10; t += B) bass(t, hz(t < 8 ? 'C2' : 'G1'), 0.2);
    pad(6.0, 8.0, ['C4', 'E4', 'G4', 'B4'], 0.42, 1200, 2400);
    pad(8.0, 10.0, ['G3', 'B3', 'D4', 'A4'], 0.42, 1600, 3200);
    const ARP = { c: ['C5', 'G5', 'E5', 'B5'], g: ['G4', 'D5', 'B4', 'A5'] };
    for (let t = 7.0, k = 0; t < 9.45; t += B / 4, k++) {
      const n = (t < 8 ? ARP.c : ARP.g)[k % 4];
      pluck(t, hz(n) * 2, 0.07, k % 2 ? 0.6 : -0.6);
    }
    whoosh(6.9, 1.0, { from: 300, to: 2500, v: 0.14, shape: 'out', p0: -0.8, p1: 0.8, q: 0.7 });
    whoosh(7.9, 1.0, { from: 2500, to: 400, v: 0.12, shape: 'out', p0: 0.8, p1: -0.6, q: 0.7 });
    whoosh(9.45, 0.55, { from: 300, to: 5000, v: 0.3, p0: -0.6, p1: 0 });

    // 05 SYSTEM — the lock, then the field blooms as a rising arpeggio
    impact(10.0, 0.5);
    whoosh(10.12, 0.6, { from: 4000, to: 300, v: 0.3, shape: 'out', p0: 0, p1: 0 });
    const blooms = new Map();
    for (const t of cues.clacks) blooms.set(t.toFixed(4), (blooms.get(t.toFixed(4)) || 0) + 1);
    [...blooms.entries()].sort((a, b) => a[0] - b[0]).forEach(([t, n], k) => {
      pluck(Number(t), hz(PENTA[Math.min(k, PENTA.length - 1)]), 0.12 + 0.05 * Math.sqrt(n), (k % 2 ? 1 : -1) * 0.35, fx);
      clack(Number(t), 0.12 * Math.sqrt(n), 1.4 + k * 0.08, (k % 2 ? -1 : 1) * 0.3);
    });
    for (let t = 10.0; t < 11.99; t += B) kick(t);
    for (const t of [10.5, 11.5]) clap(t);
    for (let t = 10.0; t < 11.99; t += B / 4) {
      const s = Math.round((t - 10) / (B / 4)) % 4;
      hat(t, [0.35, 0.18, 0.7, 0.18][s], s === 2, s % 2 ? 0.3 : -0.3);
    }
    for (let t = 10.25; t < 12; t += B) bass(t, hz('A1'), 0.2);
    pad(10.0, 12.0, ['A3', 'C4', 'E4', 'B4'], 0.42, 1800, 2800);
    whoosh(10.75, 0.7, { from: 600, to: 3000, v: 0.2, shape: 'out', p0: -0.9, p1: 0.9, q: 0.9 });
    whoosh(11.5, 0.55, { from: 400, to: 8000, v: 0.4, p0: 0, p1: 0, q: 0.7 });
    impact(11.5, 0.35);

    // 06 RESOLVE — snare roll on every drum hit of the cube, silence, impact
    kick(12.0); kick(12.5);
    cues.build.forEach((b, k) => snare(b.t, 0.35 + k * 0.05));
    for (const b of cues.build) clack(b.t, 0.2, 0.8, 0);
    riser(12.0, 13.72, 0.4);
    pad(12.0, 13.66, ['E3', 'G#3', 'B3', 'D4'], 0.42, 400, 5000, 0.06);
    bass(12.0, hz('E1'), 1.66, 0.8);
    // the gap: the room empties
    revRet.gain.setValueAtTime(0.55, 13.7);
    revRet.gain.linearRampToValueAtTime(0.05, 13.8);
    revRet.gain.setValueAtTime(0.05, 13.99);
    revRet.gain.linearRampToValueAtTime(0.6, 14.0);
    whoosh(13.84, 0.16, { from: 8000, to: 400, v: 0.25, p0: 0, p1: 0, q: 0.6 });
    // the hit
    kick(14.0, 1.25); impact(14.0, 1.6); crash(14.0, 0.45, 3.2); thunk(14.0, 1.0);
    pad(14.0, 17.2, ['A3', 'C4', 'E4', 'A4'], 0.55, 3600, 700, 0.8, true);
    bass(14.0, hz('A1'), 2.2, 0.9, true);
    for (const [k, n] of ['A4', 'C5', 'E5', 'A5'].entries()) pluck(14.0 + k * 0.012, hz(n), 0.3, -0.45 + k * 0.3, fx);
    // iris closes into the icon, locks, name appears
    whoosh(15.5, 0.55, { from: 2600, to: 500, v: 0.18, p0: 0.5, p1: -0.5, q: 4 });
    clack(16.05, 0.6, 0.9); blip(16.05, hz('A6'), 0.08, 0.1);
    chime(16.15, ['A5', 'E6', 'A6'], 0.16);
    const tails = [2.0, 4.0, 6.0, 10.0, 12.0];
    for (const t of tails) dataBurst(t + 0.02);

    // sidechain: music breathes around every kick
    duck.gain.setValueAtTime(1, 0);
    for (const [t, v] of ducks.sort((a, b) => a[0] - b[0])) {
      duck.gain.setValueAtTime(1, t);
      duck.gain.linearRampToValueAtTime(1 - 0.55 * Math.min(1, v), t + 0.012);
      duck.gain.linearRampToValueAtTime(1, t + 0.22);
    }
    master.gain.setValueAtTime(0.8, 0);
    master.gain.setValueAtTime(0.8, 17.0);
    master.gain.linearRampToValueAtTime(0.0001, D);

    const out = await ac.startRendering();
    // normalise to -1 dBFS
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

  root.D32Audio = { render, renderWavBase64 };
})(window);
