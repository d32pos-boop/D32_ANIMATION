/* ============================================================================
 *  D32 — MOTION REEL · engine.js
 *
 *  The D32 mark is a drawing of a 3D object: three 30-unit cells on a 15-unit
 *  module grid, with the "2" cell pushed one cube-depth toward the viewer and
 *  drawn in 45° oblique projection (the light shape is that cube's sides).
 *
 *  This engine rebuilds the mark as real geometry — cubes set into a wall of
 *  cells — and choreographs it to a 120 BPM grid. Every frame is a pure
 *  function of time, so renders are deterministic and frame-exact, and true
 *  motion blur is produced by averaging sub-frames across a 180° shutter.
 * ========================================================================== */
(function (root) {
  'use strict';

  // ──────────────────────────────────────────────────────────────── setup ──
  const W = 1920, H = 1080, FPS = 60;
  const BPM = 120, BEAT = 60 / BPM, DURATION = 18;
  const CELL = 30;                 // one logo cell
  const MOD = 15;                  // the module: the wall is built from these
  const SHUTTER = 0.5;             // 180° shutter
  const TAU = Math.PI * 2, DEG = Math.PI / 180;

  const INK = '#040404', PERI = '#8B91E3', LAV = '#EDEAF6';
  const PAL = {
    // lit / shade colour the logo cubes' sides; wallLit / wallShade keep the
    // wall's relief tonal so only the mark carries the full lavender bevel
    day:   { key: 'day',   wall: PERI, glyph: INK, slit: PERI, lit: LAV,  shade: '#5E63AE', wallLit: '#B4B7EC', wallShade: '#6B70B4', hud: INK },
    night: { key: 'night', wall: INK,  glyph: LAV, slit: INK,  lit: PERI, shade: '#363B86', wallLit: '#34375A', wallShade: '#16172A', hud: LAV },
    // the end card's page: the icon's black tiles meet its edges, so it sits on lavender, not black
    paper: { key: 'paper', wall: LAV,  glyph: INK, slit: LAV,  lit: PERI, shade: '#5E63AE', wallLit: '#FFFFFF', wallShade: '#C9C6DA', hud: INK },
  };

  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  for (const p of Object.values(PAL)) {
    // raised pins brighten with height so waves read as light
    const a = hex(p.wall), b = hex(p.wallLit);
    p.tint = Array.from({ length: 33 }, (_, k) => {
      const u = (k / 32) * 0.55;
      return `rgb(${Math.round(a[0] + (b[0] - a[0]) * u)},${Math.round(a[1] + (b[1] - a[1]) * u)},${Math.round(a[2] + (b[2] - a[2]) * u)})`;
    });
  }

  // ───────────────────────────────────────────────────────────────── math ──
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const mix = (a, b, u) => (Array.isArray(a) ? a.map((x, k) => lerp(x, b[k], u)) : lerp(a, b, u));

  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = u => ((ax * u + bx) * u + cx) * u;
    const Y = u => ((ay * u + by) * u + cy) * u;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, u = x;
      for (let i = 0; i < 32; i++) { u = (lo + hi) / 2; if (X(u) < x) lo = u; else hi = u; }
      return Y(u);
    };
  }

  const E = {
    lin: u => u,
    inQuad: u => u * u,
    outQuad: u => u * (2 - u),
    inCubic: u => u * u * u,
    outCubic: u => 1 - (1 - u) ** 3,
    inOutCubic: u => (u < 0.5 ? 4 * u ** 3 : 1 - 4 * (1 - u) ** 3),
    inQuart: u => u ** 4,
    outQuart: u => 1 - (1 - u) ** 4,
    inOutQuart: u => (u < 0.5 ? 8 * u ** 4 : 1 - 8 * (1 - u) ** 4),
    outQuint: u => 1 - (1 - u) ** 5,
    inExpo: u => (u <= 0 ? 0 : 2 ** (10 * u - 10)),
    outExpo: u => (u >= 1 ? 1 : 1 - 2 ** (-10 * u)),
    inOutExpo: u => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 2 ** (20 * u - 10) / 2 : (2 - 2 ** (-20 * u + 10)) / 2),
    inOutSine: u => -(Math.cos(Math.PI * u) - 1) / 2,
    outBack: u => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2,
    snap: bezier(0.75, 0, 0.1, 1),
  };

  // keyframe track: [[t, value, easeIntoThisKey?], ...]
  function track(keys, def = E.inOutCubic) {
    return t => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let k = 1; k < keys.length; k++) {
        if (t < keys[k][0]) {
          const [t0, v0] = keys[k - 1], [t1, v1, e] = keys[k];
          return mix(v0, v1, (e || def)((t - t0) / (t1 - t0)));
        }
      }
      return keys[keys.length - 1][1];
    };
  }

  function hash(a, b = 0, c = 0) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x1b873593);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise(x, seed) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // motion primitives (all closed-form so any frame can be rendered alone)
  const slamIn = (t, t0, t1, from, e = E.inQuart) => (t >= t1 ? 0 : from * (1 - e(seg(t, t0, t1))));
  const hop = (t, t0, amp, f = 3.2, d = 9) => {
    const x = t - t0;
    return x <= 0 ? 0 : amp * Math.exp(-d * x) * Math.abs(Math.sin(Math.PI * f * x));
  };
  const wobble = (t, t0, amp, f = 2.6, d = 7) => {
    const x = t - t0;
    return x <= 0 ? 0 : amp * Math.exp(-d * x) * Math.sin(TAU * f * x);
  };
  const pump = (t, t0, up = 0.06, down = 0.3) => {
    const x = t - t0;
    if (x <= 0) return 0;
    if (x < up) return E.outCubic(x / up);
    return 1 - E.inOutCubic(clamp((x - up) / down));
  };
  const settle = (t, t0, f = 2.2, d = 6.5) => {
    const x = t - t0;
    return x <= 0 ? 0 : 1 - Math.exp(-d * x) * Math.cos(TAU * f * x);
  };

  // ───────────────────────────────────────────────────────────── glyphs ──
  // Slits in cell-local units [x0, x1, y0, y1] on a 30×30 face, taken
  // straight from the SVG. Every glyph is a solid square with 2-unit cuts.
  const G = {
    solid: [[0, 0, 8, 10], [0, 0, 20, 22]],
    three: [[0, 20, 8, 10], [0, 20, 20, 22]],
    two:   [[0, 20, 8, 10], [10, 30, 20, 22]],
    D:     [[20, 22, 10, 15.3], [20, 22, 14.7, 20]],
  };
  const morph = (A, B, ux, uy = ux) =>
    A.map((r, k) => [lerp(r[0], B[k][0], ux), lerp(r[1], B[k][1], ux), lerp(r[2], B[k][2], uy), lerp(r[3], B[k][3], uy)]);

  // countdown tile: solid → cut "3" → slide into "2" → collapse into "D"
  function glyphD(t) {
    if (t < 0.5625) return G.solid;
    if (t < 0.95) {
      const u1 = E.outExpo(seg(t, 0.5625, 0.70)), u2 = E.outExpo(seg(t, 0.595, 0.735));
      return [morph([G.solid[0]], [G.three[0]], u1)[0], morph([G.solid[1]], [G.three[1]], u2)[0]];
    }
    if (t < 1.45) return morph(G.three, G.two, E.outExpo(seg(t, 1.0, 1.17)));
    return morph(G.two, G.D, E.outExpo(seg(t, 1.5, 1.62)), E.inOutCubic(seg(t, 1.56, 1.73)));
  }

  // ─────────────────────────────────────────────────────── choreography ──
  // DIMENSION: the cells play like keys (time, cube, amplitude)
  const KEYS = [
    [7.0, 'Z', 30], [7.5, 'D', 24], [8.0, 'T', 24], [8.25, 'Z', 18],
    [8.5, 'D', 24], [8.75, 'T', 18], [9.0, 'Z', 34], [9.125, 'D', 12], [9.25, 'T', 12],
  ];
  const keyPumps = (t, who) => {
    let s = 0;
    for (const [tk, w, a] of KEYS) if (w === who) s += a * pump(t, tk, 0.07, 0.34);
    return s;
  };

  // RESOLVE build-up: the pushed cube drums 8ths → 16ths → 32nds
  const BUILD = [];
  [12.0, 12.25, 12.5, 12.75].forEach((tk, k) => BUILD.push([tk, 8 + k * 2, 0.06, 0.2]));
  [13.0, 13.125, 13.25, 13.375].forEach((tk, k) => BUILD.push([tk, 15 + k * 2, 0.04, 0.1]));
  [13.5, 13.5625, 13.625, 13.6875].forEach((tk, k) => BUILD.push([tk, 22 + k * 2, 0.025, 0.05]));
  const buildPumps = t => {
    let s = 0;
    for (const [tk, a, up, dn] of BUILD) s += a * pump(t, tk, up, dn);
    return s;
  };

  // DIMENSION: D and 3 pop out of the wall to full cubes, then sink back
  function dimLift(t, t0, tEnd = 9.45) {
    if (t < t0) return 0;
    if (t < tEnd) return 30 * settle(t, t0, 2.4, 7);
    return 30 * (1 - E.inQuart(seg(t, tEnd, tEnd + 0.2))) + hop(t, tEnd + 0.2, 4);
  }
  // the gap before the final hit: everything lifts, holds its breath, slams
  const gapLift = (t, amp) =>
    t < 13.7 || t >= 14.0 ? 0 : amp * E.outExpo(seg(t, 13.7, 13.84)) * (1 - E.inQuad(seg(t, 13.965, 14.0)));

  // Each logo cube is [base, ext]: `base` moves the whole 30-deep cube
  // (arrivals, lifts, launches); `ext` lengthens its extrusion from the wall
  // (pumps), so a pumping cube stays attached like a piston.
  function zD(t) {
    if (t < 0.3) return null;
    return [
      slamIn(t, 0.30, 0.50, 150) + hop(t, 0.50, 5)
        + (t < 2.0 ? 16 * E.outCubic(seg(t, 1.72, 1.97)) * (1 - E.inQuad(seg(t, 1.97, 2.0))) : 0)
        + hop(t, 2.0, 3) + dimLift(t, 6.25) + gapLift(t, 46) + hop(t, 14.0, 6),
      6 * pump(t, 1.0, 0.04, 0.2) + 6 * pump(t, 1.5, 0.04, 0.2) + keyPumps(t, 'D'),
    ];
  }
  function zT(t) {
    if (t < 2.02) return null;
    return [
      slamIn(t, 2.05, 2.25, 170) + hop(t, 2.25, 4) + dimLift(t, 6.5) + gapLift(t, 46) + hop(t, 14.0, 6),
      keyPumps(t, 'T'),
    ];
  }
  function zZ(t) {
    if (t < 2.28) return null;
    return [
      30 + slamIn(t, 2.30, 2.50, 200) - wobble(t, 2.50, 9, 2.6, 6) + gapLift(t, 34) - wobble(t, 14.0, 12, 2.4, 5.5),
      keyPumps(t, 'Z') + buildPumps(t),
    ];
  }

  // SYSTEM: the mark tiles the wall on a 3-cell lattice
  const FIELD_R = 7;
  function fieldTimes(a, b) {
    const d = Math.hypot(a, b);
    return {
      tin: 10.125 + Math.max(1, Math.round(d * 1.5)) * (BEAT / 8),        // 32nd-note cascade
      tw: 10.75 + (a + b + 9) * 0.042,                                     // diagonal wave
      tout: 11.5 + d * 0.05,                                               // launch outward
    };
  }
  function fieldLogo(a, b, t) {
    const { tin, tw, tout } = fieldTimes(a, b);
    if (t < tin || t > tout + 0.45) return null;
    const grow = dt => E.outBack(seg(t, tin + dt, tin + dt + 0.3));
    const launch = 540 * E.inCubic(seg(t, tout, tout + 0.4));
    return {
      D: [launch, 22 * pump(t, tw + 0.03, 0.07, 0.3)], sD: grow(0),
      T: [launch * 1.04, 22 * pump(t, tw + 0.05, 0.07, 0.3)], sT: grow(0.035),
      Z: [30 * grow(0.09) + launch * 1.08, 36 * pump(t, tw, 0.07, 0.3)], sZ: grow(0.07),
    };
  }
  // the central logo joins the SYSTEM wave with everyone else
  const centralWave = (t, who) => {
    const { tw } = fieldTimes(0, 0);
    return who === 'Z' ? 36 * pump(t, tw, 0.07, 0.3) : 22 * pump(t, tw + (who === 'D' ? 0.03 : 0.05), 0.07, 0.3);
  };

  // wall ripples: [t, x, y, amp, speed, width, decay]
  const RIPPLES = [
    [2.25, 45, 15, 5, 240, 20, 1.8],
    [2.50, 45, 45, 9, 260, 24, 1.5],
    [6.00, 45, 45, 8, 300, 26, 1.5],
    [14.0, 45, 45, 26, 360, 34, 1.0],
  ];
  for (let k = 0; k < 5; k++) RIPPLES.push([7.0 + k * BEAT, 30, 30, 22, 300, 36, 1.0]);
  for (const [tk, a] of BUILD) RIPPLES.push([tk, 45, 45, a * 0.8, 320, 26, 1.8]);

  function wallH(i, j, t) {
    const cx = i * MOD + MOD / 2, cy = j * MOD + MOD / 2;
    let h = 0;
    for (let k = 0; k < RIPPLES.length; k++) {
      const R = RIPPLES[k], age = t - R[0];
      if (age <= 0 || age > 3.2) continue;
      const r = Math.hypot(cx - R[1], cy - R[2]) - R[4] * age;
      h += R[3] * Math.exp(-R[6] * age) * Math.exp(-(r * r) / (R[5] * R[5]));
    }
    // DIMENSION: a radial swell flows out of the mark between the kick rings
    const we = seg(t, 7.7, 8.2) * (1 - seg(t, 9.0, 9.5));
    if (we > 0) {
      const r = Math.hypot(cx - 30, cy - 30);
      const s = Math.sin(TAU * (r / 170 - (t - 7.7) * 1.25));
      if (s > 0) h += we * 24 * s * s * Math.exp(-r / 900);
    }
    // calm zone: pins right next to the mark stay down
    const dx = Math.max(0 - cx, 0, cx - 60), dy = Math.max(0 - cy, 0, cy - 60);
    const near = cx < 30 && cy < 30 ? Math.min(30 - cx, 30 - cy) : Math.hypot(dx, dy);
    h *= clamp((near - 6) / 24);
    return Math.max(0, h - 0.8); // ease cells out of the wall instead of popping
  }

  // ─────────────────────────────────────────────────────────────── camera ──
  const CAM = {
    S: track([
      [0.00, 15.2], [1.72, 16.6, E.inOutSine], [1.98, 19.2, E.inCubic], [2.62, 7.0, E.outExpo],
      [4.00, 7.3, E.inOutSine], [6.00, 8.2, E.inOutSine], [6.9, 6.6], [7.9, 5.6], [8.9, 3.9],
      [9.45, 4.6], [10.0, 7.0, E.inOutCubic], [10.12, 7.0, E.lin], [10.66, 2.2, E.outExpo], [12.0, 2.9, E.inOutSine],
      [13.72, 7.8, E.inQuad], [13.99, 8.3, E.lin], [14.0, 6.8, E.lin], [14.7, 7.2, E.outCubic],
      [18.0, 7.3, E.lin],
    ]),
    F: track([
      [0.00, [15, 45, 0]], [1.98, [15, 45, 0]], [2.62, [30, 30, 15], E.outExpo],
      [16.0, [30, 30, 15]], [16.7, [30, 37, 15], E.inOutCubic], [18.0, [30, 37.6, 15], E.lin],
    ]),
    blend: track([[6.0, 0], [6.9, 1, E.inOutCubic], [9.45, 1], [10.0, 0, E.inOutCubic]]),
    yaw: track([[6.0, -33 * DEG], [6.9, -12 * DEG], [7.9, 42 * DEG], [8.9, 16 * DEG], [9.45, -36 * DEG], [10.0, -33 * DEG]]),
    pitch: track([[6.0, 33 * DEG], [6.9, 28 * DEG], [7.9, 15 * DEG], [8.9, 60 * DEG], [9.45, 36 * DEG], [10.0, 33 * DEG]]),
    roll: track([
      [6.9, 0], [7.9, -6 * DEG], [8.9, 5 * DEG], [10.0, 0], [12.0, 0],
      [13.72, 7 * DEG, E.inCubic], [13.99, 8 * DEG, E.lin], [14.0, 0, E.lin],
    ]),
  };

  // impacts: [t, shake px, chroma px, punch-zoom, flash]
  const HITS = [
    [0.50, 18, 10, 0.05, 0.05],
    [0.5625, 3, 3, 0, 0],
    [1.00, 7, 5, 0.025, 0],
    [1.50, 7, 5, 0.025, 0],
    [2.00, 10, 7, 0, 0.05],
    [2.25, 8, 4, 0.02, 0],
    [2.50, 16, 9, 0.035, 0.07],
    [4.00, 0, 5, 0, 0],
    [6.00, 8, 7, 0.03, 0.06],
    [6.25, 4, 0, 0.012, 0],
    [6.50, 4, 0, 0.012, 0],
    [10.0, 0, 5, 0, 0],
    [11.5, 6, 6, 0, 0],
    [14.0, 28, 16, 0.06, 0.28],
  ];
  function hitSum(t, k, decay) {
    let s = 0;
    for (const h of HITS) {
      const x = t - h[0];
      if (x >= 0 && x < 2.5) s += h[k] * Math.exp(-decay * x);
    }
    return s;
  }

  function cameraAt(t) {
    const [fx, fy, fz] = CAM.F(t);
    const shake = hitSum(t, 1, 9);
    let punch = 0;
    for (const h of HITS) {
      const x = t - h[0];
      if (x >= 0 && x < 2) punch += h[3] * (1 - Math.exp(-70 * x)) * Math.exp(-7 * x);
    }
    return {
      fx, fy, fz,
      S: CAM.S(t) * (1 + punch),
      blend: CAM.blend(t), yaw: CAM.yaw(t), pitch: CAM.pitch(t),
      roll: CAM.roll(t) + shake * 0.0007 * noise(t * 31, 37),
      kx: 0.5, ky: 0.5,
      ox: shake * noise(t * 38, 11), oy: shake * noise(t * 38, 23),
    };
  }

  // A 2×3 parallel projection that blends the mark's own 45° oblique
  // projection with a true orthographic orbit (yaw / pitch), then rolls and
  // scales it onto the screen.
  function makeView(c) {
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), s = c.blend;
    const r0 = [lerp(1, cy, s), 0, lerp(c.kx, -sy, s)];
    const r1 = [lerp(0, sy * sp, s), lerp(1, cp, s), lerp(c.ky, cy * sp, s)];
    let n = [r0[1] * r1[2] - r0[2] * r1[1], r0[2] * r1[0] - r0[0] * r1[2], r0[0] * r1[1] - r0[1] * r1[0]];
    if (n[2] < 0) n = n.map(q => -q);
    const nl = Math.hypot(n[0], n[1], n[2]);
    n = n.map(q => q / nl);
    const cr = Math.cos(c.roll), sr = Math.sin(c.roll), S = c.S;
    const a = [0, 1, 2].map(k => S * (cr * r0[k] - sr * r1[k]));
    const b = [0, 1, 2].map(k => S * (sr * r0[k] + cr * r1[k]));
    const ox = W / 2 + c.ox - (a[0] * c.fx + a[1] * c.fy + a[2] * c.fz);
    const oy = H / 2 + c.oy - (b[0] * c.fx + b[1] * c.fy + b[2] * c.fz);
    return {
      a, b, ox, oy, n, S, cam: c,
      px: (x, y, z) => a[0] * x + a[1] * y + a[2] * z + ox,
      py: (x, y, z) => b[0] * x + b[1] * y + b[2] * z + oy,
      p: (x, y, z) => [a[0] * x + a[1] * y + a[2] * z + ox, b[0] * x + b[1] * y + b[2] * z + oy],
    };
  }

  // wall-plane (z = 0) cells that can reach the screen
  function cellRange(v, margin = 2, size = MOD) {
    const [a0, a1] = v.a, [b0, b1] = v.b, det = a0 * b1 - a1 * b0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [X, Y] of [[-60, -60], [W + 60, -60], [W + 60, H + 60], [-60, H + 60]]) {
      const dx = X - v.ox, dy = Y - v.oy;
      const x = (b1 * dx - a1 * dy) / det, y = (-b0 * dx + a0 * dy) / det;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return {
      i0: Math.floor(x0 / size) - margin, i1: Math.floor(x1 / size) + margin,
      j0: Math.floor(y0 / size) - margin, j1: Math.floor(y1 / size) + margin,
    };
  }

  // ──────────────────────────────────────────────────────────── columns ──
  // A column is a box with footprint [x, x+s] × [y, y+s] rising from z0 to
  // z1. Logo cubes are 30 wide; the wall is 15-unit modules.
  function columnsAt(t, v) {
    const cols = [];
    const occ = new Set();
    const key = (i, j) => (i + 4096) * 8192 + (j + 4096);
    const cube = (i, j, bz, slits, sc = 1, more = 0) => {
      if (bz == null) return;
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) occ.add(key(2 * i + di, 2 * j + dj));
      if (sc <= 0.001) return;
      const w = CELL * sc, o = (CELL - w) / 2, [base, ext] = bz;
      cols.push({
        x: i * CELL + o, y: j * CELL + o, s: w,
        z0: Math.max(0, base - w), z1: Math.max(0, base + ext + more), glyph: true, slits,
      });
    };

    const inSystem = t >= 10.0 && t < 12.2;
    cube(0, 1, zD(t), glyphD(t), 1, inSystem ? centralWave(t, 'D') : 0);
    cube(1, 0, zT(t), G.three, 1, inSystem ? centralWave(t, 'T') : 0);
    cube(1, 1, zZ(t), G.two, 1, inSystem ? centralWave(t, 'Z') : 0);

    const r = cellRange(v, 2);
    if (inSystem) {
      const a0 = Math.floor(r.i0 / 6) - 3, a1 = Math.ceil(r.i1 / 6) + 1;
      const b0 = Math.floor(r.j0 / 6) - 3, b1 = Math.ceil(r.j1 / 6) + 1;
      for (let b = Math.max(b0, -FIELD_R); b <= Math.min(b1, FIELD_R); b++) {
        for (let a = Math.max(a0, -FIELD_R); a <= Math.min(a1, FIELD_R); a++) {
          if (a === 0 && b === 0) continue;
          const L = fieldLogo(a, b, t);
          if (!L) continue;
          cube(3 * a, 3 * b + 1, L.D, G.D, L.sD);
          cube(3 * a + 1, 3 * b, L.T, G.three, L.sT);
          cube(3 * a + 1, 3 * b + 1, L.Z, G.two, L.sZ);
        }
      }
    }

    for (let j = r.j0; j <= r.j1; j++) {
      for (let i = r.i0; i <= r.i1; i++) {
        if (occ.has(key(i, j))) continue;
        const h = wallH(i, j, t);
        if (h > 0.01) cols.push({ x: i * MOD, y: j * MOD, s: MOD, z0: 0, z1: h });
      }
    }

    // painter's order for a height field under parallel projection:
    // far → near along the view direction's footprint on the wall
    const nx = v.n[0], ny = v.n[1];
    for (const c of cols) c.k = nx * (c.x + c.s / 2) + ny * (c.y + c.s / 2);  // centre of footprint
    cols.sort((A, B) => A.k - B.k);
    return cols;
  }

  function quad(ctx, color, p, seal) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (seal) { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function drawColumn(ctx, v, c, pal) {
    const x0 = c.x, y0 = c.y, x1 = x0 + c.s, y1 = y0 + c.s, z0 = c.z0, z1 = c.z1;
    const [A0, A1, A2] = v.a, [B0, B1, B2] = v.b, ox = v.ox, oy = v.oy, n = v.n;
    const P = (x, y, z, out) => { out.push(A0 * x + A1 * y + A2 * z + ox, B0 * x + B1 * y + B2 * z + oy); return out; };
    const Q = (pts) => pts.reduce((o, q) => P(q[0], q[1], q[2], o), []);
    if (z1 - z0 > 0.001) {
      // seal seams with a hairline stroke only once a side is thick enough to own it
      const seal = (z1 - z0) * Math.hypot(A2, B2) > 2;
      const lit = c.glyph ? pal.lit : pal.wallLit, shade = c.glyph ? pal.shade : pal.wallShade;
      if (n[0] < -1e-5) quad(ctx, lit, Q([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]), seal);
      if (n[0] > 1e-5) quad(ctx, shade, Q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]), seal);
      if (n[1] < -1e-5) quad(ctx, lit, Q([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]), seal);
      if (n[1] > 1e-5) quad(ctx, shade, Q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]), seal);
    }
    const face = c.glyph ? pal.glyph : pal.tint[Math.min(32, Math.round((z1 / 34) * 32))];
    quad(ctx, face, Q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]), !c.glyph);
    if (c.slits) {
      const e = 0.7 / v.S, k = c.s / CELL; // bleed open slits past the edge so no hairline closes them
      for (const s of c.slits) {
        if (s[1] - s[0] < 0.02 || s[3] - s[2] < 0.02) continue;
        const sx0 = x0 + (s[0] <= 0 ? -e : s[0] * k), sx1 = x0 + (s[1] >= CELL ? c.s + e : s[1] * k);
        const sy0 = y0 + s[2] * k, sy1 = y0 + s[3] * k;
        quad(ctx, pal.slit, Q([[sx0, sy0, z1], [sx1, sy0, z1], [sx1, sy1, z1], [sx0, sy1, z1]]), false);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────── looks ──
  // Each frame is one or more "looks" (palette + render mode) under clips,
  // which is how every transition wipe in the piece is built.
  function poly(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
  }
  const DAY = { pal: PAL.day, mode: 'solid' };
  const NIGHT = { pal: PAL.night, mode: 'solid' };
  const BLUE = { pal: PAL.night, mode: 'blueprint' };
  const PAPER = { pal: PAL.paper, mode: 'solid' };

  function frameSquare(v, k) {
    const c = v.p(37.5, 37.5, 0);
    return [[0, 0], [75, 0], [75, 75], [0, 75]].map(([x, y]) => {
      const q = v.p(x, y, 0);
      return [c[0] + (q[0] - c[0]) * k, c[1] + (q[1] - c[1]) * k];
    });
  }

  function looksAt(t, v) {
    if (t < 2.0) return [NIGHT];
    if (t < 2.42) {
      const d = lerp(-60, W + H + 60, E.inOutCubic(seg(t, 2.0, 2.42)));
      return [
        { ...NIGHT, clip: c => poly(c, [[d + 10, -10], [W + H + 99, -10], [W + H + 99, H + 10], [d - H - 10, H + 10]]) },
        { ...DAY, clip: c => poly(c, [[-H - 99, -10], [d + 10, -10], [d - H - 10, H + 10], [-H - 99, H + 10]]),
          edge: c => { c.beginPath(); c.moveTo(d + 10, -10); c.lineTo(d - H - 10, H + 10); } },
      ];
    }
    if (t < 4.0) return [DAY];
    if (t < 4.36) {
      const y = lerp(-8, H + 8, E.inOutCubic(seg(t, 4.0, 4.36)));
      return [
        { ...DAY, clip: c => c.rect(-10, y, W + 20, H + 20) },
        { ...BLUE, clip: c => c.rect(-10, -10, W + 20, y + 10), edge: c => { c.beginPath(); c.moveTo(-10, y); c.lineTo(W + 10, y); } },
      ];
    }
    if (t < 6.0) return [BLUE];
    if (t < 6.42) {
      const [cx, cy] = v.p(45, 45, 30), r = 1600 * E.outExpo(seg(t, 6.0, 6.42)) ** 1.4;
      const sq = [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]];
      return [
        { ...BLUE, clip: c => { c.rect(-10, -10, W + 20, H + 20); poly(c, sq.slice().reverse()); } },
        { ...DAY, clip: c => poly(c, sq), edge: c => { c.beginPath(); poly(c, sq); } },
      ];
    }
    if (t >= 13.75 && t < 14.0) return [NIGHT];
    if (t < 15.5) return [DAY];
    const sq = frameSquare(v, lerp(3.4, 1, E.inOutExpo(seg(t, 15.5, 16.05))));
    return [
      { ...PAPER, clip: c => { c.rect(-10, -10, W + 20, H + 20); poly(c, sq.slice().reverse()); } },
      { ...DAY, clip: c => poly(c, sq) },
    ];
  }

  // ──────────────────────────────────────────────────────────── decals ──
  // film-leader countdown: crosshair, square gate and a sweep once per beat
  function drawLeader(ctx, t, v) {
    const fade = 1 - seg(t, 1.98, 2.25);
    const grow = E.outExpo(seg(t, 0.02, 0.5));
    if (fade <= 0 || grow <= 0) return;
    const [cx, cy] = v.p(15, 45, 0), S = v.S;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = rgba(PERI, 0.38);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - W * grow, cy); ctx.lineTo(cx + W * grow, cy);
    ctx.moveTo(cx, cy - H * grow); ctx.lineTo(cx, cy + H * grow);
    ctx.stroke();
    const half = 25 * S * E.outExpo(seg(t, 0.12, 0.6));
    if (half > 1) {
      ctx.strokeStyle = rgba(PERI, 0.55);
      ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
      // ticks along the gate
      ctx.beginPath();
      for (let k = -4; k <= 4; k++) {
        const o = (k / 4) * half, L = k % 2 ? 8 : 16;
        ctx.moveTo(cx + o, cy - half); ctx.lineTo(cx + o, cy - half + L);
        ctx.moveTo(cx + o, cy + half); ctx.lineTo(cx + o, cy + half - L);
        ctx.moveTo(cx - half, cy + o); ctx.lineTo(cx - half + L, cy + o);
        ctx.moveTo(cx + half, cy + o); ctx.lineTo(cx + half - L, cy + o);
      }
      ctx.stroke();
      if (t > 0.5) {
        const ph = ((t - 0.5) / BEAT) % 1, a0 = -Math.PI / 2, a1 = a0 + ph * TAU;
        ctx.save();
        ctx.beginPath(); ctx.rect(cx - half, cy - half, half * 2, half * 2); ctx.clip();
        ctx.fillStyle = rgba(PERI, 0.13);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, half * 1.5, a0, a1); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = rgba(PERI, 0.7); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a1) * half * 1.5, cy + Math.sin(a1) * half * 1.5); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // shockwave squares on the countdown hits
  function drawShock(ctx, t, v) {
    for (const [t0, x, y, z, max] of [[0.5, 15, 45, 0, 60], [1.0, 15, 45, 0, 40], [1.5, 15, 45, 0, 40], [2.5, 60, 60, 30, 70], [14.0, 60, 60, 30, 110]]) {
      const age = t - t0;
      if (age < 0 || age > 0.6) continue;
      const u = E.outCubic(age / 0.6), [cx, cy] = v.p(x, y, z), r = (16 + max * u) * v.S;
      ctx.strokeStyle = rgba(t0 === 2.5 || t0 === 14.0 ? LAV : PERI, 0.85 * (1 - u));
      ctx.lineWidth = 2 + 8 * (1 - u);
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  // build-up tunnel: the 75×75 icon frame fires outward on every drum hit
  function drawTunnel(ctx, t, v) {
    if (t < 12.0 || t > 14.4) return;
    const [cx, cy] = v.p(37.5, 37.5, 0);
    for (const [tk, a] of BUILD) {
      const age = t - tk, life = 0.75;
      if (age < 0 || age > life) continue;
      const u = E.outCubic(age / life), half = (40 + 150 * u) * v.S;
      ctx.strokeStyle = rgba(LAV, (1 - u) * (0.45 + a / 60));
      ctx.lineWidth = 1.5 + 5 * (1 - u) * (a / 28);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(v.cam.roll);
      ctx.strokeRect(-half, -half, half * 2, half * 2);
      ctx.restore();
    }
  }

  // square debris on the two biggest impacts
  function drawDebris(ctx, t, v, pal) {
    for (const [t0, count, seed] of [[2.5, 18, 3], [14.0, 46, 7]]) {
      const age = t - t0;
      if (age < 0 || age > 1.1) continue;
      const [cx, cy] = v.p(45, 45, 30);
      for (let k = 0; k < count; k++) {
        const ang = hash(k, seed, 1) * TAU, spd = lerp(500, 1700, hash(k, seed, 2) ** 1.5);
        const travel = spd * (1 - Math.exp(-3.4 * age)) / 3.4;
        const x = cx + Math.cos(ang) * travel, y = cy + Math.sin(ang) * travel + 260 * age * age;
        const life = lerp(0.5, 1.1, hash(k, seed, 3)), f = 1 - age / life;
        if (f <= 0) continue;
        const s = lerp(5, 17, hash(k, seed, 4)) * f;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(hash(k, seed, 5) * TAU + age * lerp(-9, 9, hash(k, seed, 6)));
        ctx.fillStyle = hash(k, seed, 7) < 0.55 ? pal.lit : pal.glyph;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
  }

  // ─────────────────────────────────────────────────────────── blueprint ──
  function segLine(ctx, v, p, q, u = 1) {
    if (u <= 0) return;
    const [x0, y0] = v.p(...p), [x1, y1] = v.p(...q);
    ctx.moveTo(x0, y0);
    ctx.lineTo(lerp(x0, x1, u), lerp(y0, y1, u));
  }
  function text(ctx, str, x, y, { size = 17, weight = 500, align = 'left', base = 'middle', color, spacing = 2, family = 'JetBrains Mono', halo } = {}) {
    ctx.font = `${weight} ${size}px "${family}"`;
    ctx.letterSpacing = `${spacing}px`;
    ctx.textAlign = align;
    ctx.textBaseline = base;
    if (halo) {
      ctx.save();
      ctx.strokeStyle = halo;
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
      ctx.restore();
    }
    if (color) ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawBlueprint(ctx, t, v) {
    const T0 = 4.0;
    const r = cellRange(v, 1);
    // module grid, growing outward from the mark's centre
    ctx.lineWidth = 1;
    for (const axis of [0, 1]) {
      const k0 = axis ? r.j0 : r.i0, k1 = axis ? r.j1 + 1 : r.i1 + 1;
      for (let k = k0; k <= k1; k++) {
        const c = k * 15, dist = Math.abs(c - 37.5) / 15;
        const u = E.outCubic(seg(t, T0 + 0.03 + dist * 0.03, T0 + 0.55 + dist * 0.03));
        if (u <= 0) continue;
        const inFrame = c >= 0 && c <= 75;
        ctx.strokeStyle = rgba(PERI, inFrame ? (k % 2 === 0 ? 0.5 : 0.3) : 0.16);
        ctx.beginPath();
        if (axis === 0) segLine(ctx, v, [c, 37.5, 0], [c, 37.5 - 900, 0], u), segLine(ctx, v, [c, 37.5, 0], [c, 37.5 + 900, 0], u);
        else segLine(ctx, v, [37.5, c, 0], [37.5 - 900, c, 0], u), segLine(ctx, v, [37.5, c, 0], [37.5 + 900, c, 0], u);
        ctx.stroke();
      }
    }
    // 45° construction lines: the direction the cube is pushed
    const uDiag = E.outCubic(seg(t, T0 + 0.35, T0 + 0.9));
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = rgba(PERI, 0.55);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [x, y] of [[30, 30], [60, 30], [30, 60]]) {
      segLine(ctx, v, [x, y, 0], [x, y, 200], uDiag);
      segLine(ctx, v, [x, y, 0], [x, y, -200], uDiag);
    }
    ctx.stroke();
    ctx.restore();

    // wireframes of the three cells
    const lav = rgba(LAV, 0.95);
    const edgeU = k => E.outCubic(seg(t, T0 + 0.1 + k * 0.022, T0 + 0.42 + k * 0.022));
    ctx.lineWidth = 2;
    ctx.strokeStyle = lav;
    let ek = 0;
    const square = (x, y, z) => {
      ctx.beginPath();
      segLine(ctx, v, [x, y, z], [x + 30, y, z], edgeU(ek++));
      segLine(ctx, v, [x + 30, y, z], [x + 30, y + 30, z], edgeU(ek++));
      segLine(ctx, v, [x + 30, y + 30, z], [x, y + 30, z], edgeU(ek++));
      segLine(ctx, v, [x, y + 30, z], [x, y, z], edgeU(ek++));
      ctx.stroke();
    };
    const slits = (x, y, z, set, u) => {
      if (u <= 0) return;
      for (const s of set) {
        const w = (s[1] - s[0]) * u;
        ctx.beginPath();
        poly(ctx, [v.p(x + s[0], y + s[2], z), v.p(x + s[0] + w, y + s[2], z), v.p(x + s[0] + w, y + s[3], z), v.p(x + s[0], y + s[3], z)]);
        ctx.stroke();
      }
    };
    square(0, 30, 0);
    square(30, 0, 0);
    // the pushed cube: visible edges solid, hidden edges dashed
    const V = [[30, 30, 0], [60, 30, 0], [60, 60, 0], [30, 60, 0], [30, 30, 30], [60, 30, 30], [60, 60, 30], [30, 60, 30]];
    const EDGES = [[0, 1, 't', 'k'], [1, 2, 'r', 'k'], [2, 3, 'b', 'k'], [3, 0, 'l', 'k'], [4, 5, 't', 'f'], [5, 6, 'r', 'f'], [6, 7, 'b', 'f'], [7, 4, 'l', 'f'], [0, 4, 't', 'l'], [1, 5, 't', 'r'], [2, 6, 'r', 'b'], [3, 7, 'b', 'l']];
    const n = v.n, vis = { f: n[2] > 0, k: false, l: n[0] < 0, r: n[0] > 0, t: n[1] < 0, b: n[1] > 0 };
    for (const [p, q, f1, f2] of EDGES) {
      const seen = vis[f1] || vis[f2];
      ctx.save();
      if (!seen) { ctx.setLineDash([7, 7]); ctx.strokeStyle = rgba(LAV, 0.5); ctx.lineWidth = 1.5; }
      ctx.beginPath();
      segLine(ctx, v, V[p], V[q], edgeU(ek++));
      ctx.stroke();
      ctx.restore();
    }
    const uS = E.outExpo(seg(t, T0 + 0.5, T0 + 0.85));
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = lav;
    slits(0, 30, 0, G.D, uS);
    slits(30, 0, 0, G.three, uS);
    slits(30, 30, 30, G.two, uS);

    // nodes
    const nodes = [[30, 30, 0], [60, 30, 0], [30, 60, 0], [30, 30, 30], [60, 30, 30], [30, 60, 30], [60, 60, 30], [0, 30, 0], [0, 60, 0], [30, 0, 0], [60, 0, 0]];
    nodes.forEach((p, k) => {
      const u = E.outBack(seg(t, T0 + 0.5 + k * 0.025, T0 + 0.72 + k * 0.025));
      if (u <= 0) return;
      const [x, y] = v.p(...p), s = 7 * u;
      ctx.fillStyle = PERI;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.strokeStyle = LAV; ctx.lineWidth = 1.5;
      ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    });

    // dimensions
    const dim = (p, q, label, t0, off = [0, -18], align = 'center') => {
      const u = E.outExpo(seg(t, t0, t0 + 0.35));
      if (u <= 0) return;
      const [x0, y0] = v.p(...p), [x1, y1] = v.p(...q);
      const mx = lerp(x0, x1, 0.5), my = lerp(y0, y1, 0.5);
      const ax = lerp(mx, x0, u), ay = lerp(my, y0, u), bx = lerp(mx, x1, u), by = lerp(my, y1, u);
      const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L * 7, ny = (x1 - x0) / L * 7;
      ctx.strokeStyle = LAV; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.moveTo(ax - nx, ay - ny); ctx.lineTo(ax + nx, ay + ny);
      ctx.moveTo(bx - nx, by - ny); ctx.lineTo(bx + nx, by + ny);
      ctx.stroke();
      ctx.globalAlpha = seg(t, t0 + 0.08, t0 + 0.25);
      text(ctx, label, mx + off[0], my + off[1], { size: 20, weight: 700, align, color: LAV });
      ctx.globalAlpha = 1;
    };
    dim([30, -7, 0], [60, -7, 0], '30', T0 + 0.75);
    dim([-7, 30, 0], [-7, 60, 0], '30', T0 + 1.0, [-16, 0], 'right');
    dim([64, 26, 0], [64, 26, 30], '30', T0 + 1.25, [22, -8], 'left');
    dim([0, 82, 0], [15, 82, 0], '15', T0 + 1.5, [0, 20]);
    // the 45° push
    const ua = E.outExpo(seg(t, T0 + 1.25, T0 + 1.6));
    if (ua > 0) {
      const [cx, cy] = v.p(30, 30, 0), R = 12 * v.S;
      ctx.strokeStyle = LAV; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, (Math.PI / 4) * ua); ctx.stroke();
      ctx.globalAlpha = seg(t, T0 + 1.35, T0 + 1.55);
      text(ctx, '45°', cx + R * 1.12, cy + R * 0.26, { size: 19, weight: 700, color: LAV });
      ctx.globalAlpha = 1;
    }
    // callout on a slit
    const uc = E.outExpo(seg(t, T0 + 1.5, T0 + 1.85));
    if (uc > 0) {
      const [sx, sy] = v.p(50, 9, 0), ex = sx + 150 * uc, ey = sy - 70 * uc;
      ctx.strokeStyle = LAV; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(ex + 40 * uc, ey); ctx.stroke();
      ctx.fillStyle = LAV; ctx.fillRect(sx - 3, sy - 3, 6, 6);
      ctx.globalAlpha = seg(t, T0 + 1.6, T0 + 1.8);
      text(ctx, 'CUT 2', ex + 50, ey, { size: 19, weight: 700, color: LAV });
      ctx.globalAlpha = 1;
    }

    // palette chips (screen space)
    const chips = [[PERI, '#8B91E3'], [INK, '#040404'], [LAV, '#EDEAF6']];
    chips.forEach(([col, label], k) => {
      const u = E.outExpo(seg(t, T0 + 0.5 + k * 0.125, T0 + 0.95 + k * 0.125));
      if (u <= 0) return;
      const x = 118 - 60 * (1 - u), y = 470 + k * 50;
      ctx.globalAlpha = u;
      ctx.fillStyle = col; ctx.fillRect(x, y - 15, 30, 30);
      ctx.strokeStyle = rgba(LAV, 0.8); ctx.lineWidth = 1.5; ctx.strokeRect(x, y - 15, 30, 30);
      text(ctx, label, x + 48, y + 1, { size: 19, color: LAV });
      ctx.globalAlpha = 1;
    });
  }

  // the first hold: brackets lock onto the 75×75 artboard like autofocus
  function drawFocus(ctx, t, v, pal) {
    if (t < 2.95 || t > 3.95) return;
    const u = E.outExpo(seg(t, 2.97, 3.3)), out = seg(t, 3.7, 3.92);
    const blink = t < 3.12 ? (Math.floor((t - 2.97) / 0.04) % 2 ? 0.25 : 1) : 1;
    const sq = frameSquare(v, lerp(1.3, 1.07, u));
    ctx.save();
    ctx.globalAlpha = blink * (1 - out) * Math.min(1, u * 3);
    ctx.strokeStyle = pal.glyph;
    ctx.lineWidth = 2.5;
    const L = 26;
    ctx.beginPath();
    sq.forEach((p, k) => {
      const a = sq[(k + 3) % 4], b = sq[(k + 1) % 4];
      const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
      ctx.moveTo(p[0] + (a[0] - p[0]) / da * L, p[1] + (a[1] - p[1]) / da * L);
      ctx.lineTo(p[0], p[1]);
      ctx.lineTo(p[0] + (b[0] - p[0]) / db * L, p[1] + (b[1] - p[1]) / db * L);
    });
    ctx.stroke();
    const n = Math.floor(seg(t, 3.12, 3.3) * 7.99);
    text(ctx, '75 × 75'.slice(0, n), sq[0][0], sq[0][1] - 22, { size: 16, weight: 700, spacing: 2, color: pal.glyph });
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────── scene ──
  function drawScene(ctx, t, v, look) {
    const pal = look.pal;
    ctx.fillStyle = pal.wall;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    if (look.mode === 'blueprint') { drawBlueprint(ctx, t, v); return; }
    if (t < 2.3) drawLeader(ctx, t, v);
    drawShock(ctx, t, v);
    const cols = columnsAt(t, v);
    for (const c of cols) drawColumn(ctx, v, c, pal);
    drawTunnel(ctx, t, v);
    drawDebris(ctx, t, v, pal);
    drawFocus(ctx, t, v, pal);
  }

  function drawWorld(ctx, t) {
    const v = makeView(cameraAt(t));
    const looks = looksAt(t, v);
    for (const lk of looks) {
      ctx.save();
      if (lk.clip) { ctx.beginPath(); lk.clip(ctx); ctx.clip(); }
      drawScene(ctx, t, v, lk);
      ctx.restore();
    }
    for (const lk of looks) {
      if (!lk.edge) continue;
      ctx.save();
      lk.edge(ctx);
      ctx.strokeStyle = LAV;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ───────────────────────────────────────────────────────────────── HUD ──
  const CHAPTERS = [[0, '01', 'COUNTDOWN'], [2, '02', 'ASSEMBLE'], [4, '03', 'CONSTRUCT'], [6, '04', 'DIMENSION'], [10, '05', 'SYSTEM'], [12, '06', 'RESOLVE']];
  const NOISE_CH = '/\\<>+=-_*#0123456789ABCDEFXZ';
  function scramble(str, t, t0, dur = 0.4, seed = 0) {
    const u = seg(t, t0, t0 + dur);
    if (u >= 1) return str;
    const n = str.length, edge = Math.floor(u * (n + 5)) - 5, frame = Math.floor(t * 30);
    let out = '';
    for (let k = 0; k < n; k++) {
      if (str[k] === ' ' || k <= edge) out += str[k];
      else if (k <= edge + 5) out += NOISE_CH[Math.floor(hash(k, frame, seed) * NOISE_CH.length)];
      else out += ' ';
    }
    return out;
  }
  function hud(ctx, t, pal, v) {
    const color = pal.hud, halo = pal.wall;
    const M = 56, u = E.outExpo(seg(t, 0.04, 0.6)), L = 30 * u;
    ctx.fillStyle = color;
    // corner marks
    for (const [x, y, sx, sy] of [[M, M, 1, 1], [W - M, M, -1, 1], [W - M, H - M, -1, -1], [M, H - M, 1, -1]]) {
      ctx.fillRect(x, y, sx * L, sy * 2);
      ctx.fillRect(x, y, sx * 2, sy * L);
    }
    if (u <= 0.05) return;
    const ty = M + 30, by = H - M - 28;
    // brand
    const brand = 'D32', sub = '/  MOTION REEL';
    const nb = Math.floor(seg(t, 0.12, 0.3) * (brand.length + 0.99)), ns = Math.floor(seg(t, 0.2, 0.55) * (sub.length + 0.99));
    text(ctx, brand.slice(0, nb), M + 14, ty, { size: 22, weight: 700, spacing: 3, color, halo });
    text(ctx, sub.slice(0, ns), M + 86, ty, { size: 19, weight: 500, spacing: 3, color, halo });
    // chapter
    let ch = CHAPTERS[0];
    for (const c of CHAPTERS) if (t >= c[0]) ch = c;
    const label = `${ch[1]}  ${ch[2]}`;
    text(ctx, scramble(label, t, Math.max(ch[0], 0.15), 0.42, ch[0] * 7), W - M - 14, ty, { size: 19, weight: 700, spacing: 3, align: 'right', color, halo });
    // timecode
    const f = Math.floor(t * FPS + 1e-6), ss = Math.floor(f / FPS), ff = f % FPS;
    const tc = `TC 00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
    text(ctx, tc.slice(0, Math.floor(seg(t, 0.25, 0.6) * (tc.length + 0.99))), M + 14, by, { size: 18, spacing: 2, color, halo });
    // beat counter
    const beat = Math.floor(t / BEAT + 1e-6) % 4;
    const bu = seg(t, 0.3, 0.6);
    text(ctx, '120 BPM'.slice(0, Math.floor(bu * 7.99)), W - M - 14, by, { size: 18, spacing: 2, align: 'right', color, halo });
    for (let k = 0; k < 4; k++) {
      const x = W - M - 14 - 132 - (3 - k) * 22, y = by - 7;
      if (bu < (k + 1) / 5) continue;
      if (k === beat) ctx.fillRect(x, y, 13, 13);
      else { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.75, y + 0.75, 11.5, 11.5); }
    }
    // end card wordmark
    const we = seg(t, 16.15, 16.75);
    if (we > 0) {
      const [cx] = v.p(37.5, 75, 0), yb = v.py(37.5, 75, 0);
      ctx.globalAlpha = E.outCubic(we);
      text(ctx, 'D32', cx + 7, yb + 74 + 14 * (1 - E.outExpo(we)), { size: 46, weight: 700, family: 'Space Grotesk', align: 'center', spacing: 14, color });
      ctx.globalAlpha = 1;
    }
  }
  function drawHUD(ctx, t) {
    const v = makeView(cameraAt(t));
    for (const lk of looksAt(t, v)) {
      ctx.save();
      if (lk.clip) { ctx.beginPath(); lk.clip(ctx); ctx.clip(); }
      hud(ctx, t, lk.pal, v);
      ctx.restore();
    }
  }

  // ──────────────────────────────────────────────────────────────── post ──
  const pool = {};
  function buf(name) {
    if (!pool[name]) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      pool[name] = c;
    }
    return pool[name];
  }
  // lens-style chromatic split: R and G channels scaled up around the centre
  function chroma(ctx, amt) {
    const src = buf('ca_src'), s = src.getContext('2d');
    s.globalCompositeOperation = 'copy';
    s.drawImage(ctx.canvas, 0, 0);
    const ch = buf('ca_ch'), c = ch.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = 'copy';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const [col, k] of [['#ff0000', 2], ['#00ff00', 1], ['#0000ff', 0]]) {
      const sc = 1 + (k * amt) / (W / 2);
      c.globalCompositeOperation = 'copy';
      c.setTransform(sc, 0, 0, sc, (W / 2) * (1 - sc), (H / 2) * (1 - sc));
      c.drawImage(src, 0, 0);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = col;
      c.fillRect(0, 0, W, H);
      ctx.drawImage(ch, 0, 0);
    }
    ctx.restore();
  }
  function post(ctx, t) {
    const ca = hitSum(t, 2, 12);
    if (ca > 0.35) chroma(ctx, ca);
    const fl = hitSum(t, 4, 16);
    if (fl > 0.004) {
      ctx.fillStyle = rgba(LAV, Math.min(0.6, fl));
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ─────────────────────────────────────────────────────────────── frame ──
  function renderFrame(ctx, t, opt = {}) {
    const n = opt.samples ?? 12;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    if (n <= 1) drawWorld(ctx, t);
    else {
      const sub = buf('sub'), sc = sub.getContext('2d');
      for (let k = 0; k < n; k++) {
        const tk = t + ((k + 0.5) / n - 0.5) * (SHUTTER / FPS);
        sc.save();
        drawWorld(sc, tk);
        sc.restore();
        ctx.globalAlpha = 1 / (k + 1);
        ctx.drawImage(sub, 0, 0);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    post(ctx, t);
    drawHUD(ctx, t);
  }

  // ──────────────────────────────────────────────────────── sound cues ──
  // Everything the soundtrack needs to lock to the picture comes from here.
  function cues() {
    const clacks = [];
    for (let b = -FIELD_R; b <= FIELD_R; b++) for (let a = -FIELD_R; a <= FIELD_R; a++) {
      if (!a && !b) continue;
      const d = Math.hypot(a, b);
      if (d > 6.2) continue;
      clacks.push(fieldTimes(a, b).tin);
    }
    return {
      bpm: BPM, duration: DURATION,
      hits: HITS.map(h => ({ t: h[0], power: h[1] / 18 })),
      keys: KEYS.map(k => ({ t: k[0], cube: k[1], amp: k[2] })),
      build: BUILD.map(b => ({ t: b[0], amp: b[1] })),
      clacks: clacks.sort((p, q) => p - q),
    };
  }

  root.D32 = { W, H, FPS, BPM, BEAT, DURATION, renderFrame, cues, PAL, _debug: { cameraAt, makeView, looksAt } };
})(typeof window !== 'undefined' ? window : globalThis);
