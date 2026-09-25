/* ============================================================================
 *  D32 — LOGO STING · sting.js
 *
 *  A 3-second ident built on the mark's double reading: the lavender shape is
 *  an arrow, and it is also the side of the pushed "2" cube. The arrow flies
 *  in tip-first and sticks; the D and 3 unfold from its tip (both tiles have a
 *  corner exactly there); the 2 slams onto its open end, and a quick tilt
 *  proves the arrow was a cube all along.
 *
 *  Resolution-independent: D32Sting.setup(width, height), then renderFrame.
 *  Every frame is a pure function of time, like the reel.
 * ========================================================================== */
(function (root) {
  'use strict';

  const FPS = 60, DURATION = 3, SHUTTER = 0.5;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const INK = '#040404', PERI = '#8B91E3', LAV = '#EDEAF6';
  const SHADE = '#5E63AE';

  // ───────────────────────────────────────────────────────────────── math ──
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = u => u * u * (3 - 2 * u);
  const E = {
    outQuad: u => u * (2 - u),
    outCubic: u => 1 - (1 - u) ** 3,
    inQuart: u => u ** 4,
    outExpo: u => (u >= 1 ? 1 : 1 - 2 ** (-10 * u)),
    inOutCubic: u => (u < 0.5 ? 4 * u ** 3 : 1 - 4 * (1 - u) ** 3),
    outBack: u => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2,
  };
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
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };

  // slits in face-local units on a 30×30 face, straight from the SVG
  const G = {
    three: [[0, 20, 8, 10], [0, 20, 20, 22]],
    two: [[0, 20, 8, 10], [10, 30, 20, 22]],
    D: [[20, 22, 10, 15.3], [20, 22, 14.7, 20]],
  };

  // ──────────────────────────────────────────────────────────── timeline ──
  const T = {
    fly0: 0.04, hit: 0.36,          // arrow flight → it sticks
    bloomD: 0.40, bloom3: 0.47,     // D and 3 unfold from the tip
    plate0: 0.60, land: 0.80,       // the 2 caps the open end
    tilt0: 0.86, tilt1: 1.38,       // parallax: the arrow is a cube
    word0: 1.02,                    // wordmark
    glint0: 1.42, glint1: 1.95,     // light runs down the arrow
  };
  const HITS = [[T.hit, 7, 4, 0.012], [T.land, 12, 7, 0.03]]; // t, shake px, chroma px, punch

  // ─────────────────────────────────────────────────────── layout / view ──
  let W = 1920, H = 1080, pool = {};
  function setup(w, h) { W = w; H = h; pool = {}; }

  // logo + wordmark as one centred group; portrait gets a larger mark
  function layout() {
    const portrait = H > W;
    const S = portrait ? (0.52 * W) / 75 : (0.37 * H) / 75;
    const word = Math.round(portrait ? 0.062 * W : 0.05 * H);
    const gap = word * 1.15;
    const group = 75 * S + gap + word;
    const cy = H / 2 - group / 2 + (75 * S) / 2;
    return { S, word, cy, wordY: cy + (75 * S) / 2 + gap + word / 2 };
  }
  // far enough along the depth axis that the arrow starts off-frame
  const farZ = S => 2 * (Math.max(W, H) / (2 * S) + 24);

  function cameraAt(t) {
    const L = layout();
    let shake = 0, punch = 0;
    for (const [th, sk, , pc] of HITS) {
      const x = t - th;
      if (x < 0 || x > 1.5) continue;
      shake += sk * Math.exp(-10 * x);
      punch += pc * (1 - Math.exp(-70 * x)) * Math.exp(-7 * x);
    }
    const tilt = Math.sin(Math.PI * seg(t, T.tilt0, T.tilt1)) ** 2;
    // arrow close-up → full lockup; the close-up keeps the D (52.5 units left
    // of the arrow's centre) inside a narrow frame
    const pull = E.inOutCubic(seg(t, 0.52, 1.25));
    const close = Math.min(1.5, (Math.min(W, H) / 2 - 60) / (52.5 * L.S));
    return {
      fx: lerp(45, 30, pull), fy: lerp(45, 30, pull), fz: 15,
      S: L.S * lerp(close, 1, pull) * lerp(0.965, 1, E.outCubic(seg(t, 0, DURATION))) * (1 + punch),
      blend: 0.55 * tilt, yaw: 30 * DEG, pitch: 22 * DEG,
      roll: shake * 0.0006 * noise(t * 33, 13),
      ox: shake * noise(t * 40, 5), oy: shake * noise(t * 40, 9),
      cx: W / 2, cy: L.cy, L,
    };
  }

  // the reel's projection: the mark's 45° oblique view blended with a true
  // orthographic tilt; focus (30,30,15) is the mark's visual centre, (45,45,15)
  // the arrow's
  function makeView(c) {
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), s = c.blend;
    const r0 = [lerp(1, cy, s), 0, lerp(0.5, -sy, s)];
    const r1 = [lerp(0, sy * sp, s), lerp(1, cp, s), lerp(0.5, cy * sp, s)];
    let n = [r0[1] * r1[2] - r0[2] * r1[1], r0[2] * r1[0] - r0[0] * r1[2], r0[0] * r1[1] - r0[1] * r1[0]];
    if (n[2] < 0) n = n.map(q => -q);
    const cr = Math.cos(c.roll), sr = Math.sin(c.roll), S = c.S;
    const a = [0, 1, 2].map(k => S * (cr * r0[k] - sr * r1[k]));
    const b = [0, 1, 2].map(k => S * (sr * r0[k] + cr * r1[k]));
    const ox = c.cx + c.ox - (a[0] * c.fx + a[1] * c.fy + a[2] * c.fz);
    const oy = c.cy + c.oy - (b[0] * c.fx + b[1] * c.fy + b[2] * c.fz);
    const p = (x, y, z) => [a[0] * x + a[1] * y + a[2] * z + ox, b[0] * x + b[1] * y + b[2] * z + oy];
    return { a, b, ox, oy, n, S, p, cam: c };
  }

  // ─────────────────────────────────────────────────────────── drawing ──
  function poly(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
  }
  function fillPoly(ctx, color, pts, seal) {
    ctx.beginPath();
    poly(ctx, pts);
    ctx.fillStyle = color;
    ctx.fill();
    if (seal) { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke(); }
  }
  // a square face [x, x+w] × [y, y+w] at depth z, with slits scaled to it
  function face(ctx, v, x, y, w, z, color, slits, slitColor = PERI) {
    fillPoly(ctx, color, [v.p(x, y, z), v.p(x + w, y, z), v.p(x + w, y + w, z), v.p(x, y + w, z)], !slits);
    if (!slits) return;
    const k = w / 30, e = 0.7 / v.S;
    for (const s of slits) {
      const x0 = x + (s[0] <= 0 ? -e : s[0] * k), x1 = x + (s[1] >= 30 ? w + e : s[1] * k);
      const y0 = y + s[2] * k, y1 = y + s[3] * k;
      fillPoly(ctx, slitColor, [v.p(x0, y0, z), v.p(x1, y0, z), v.p(x1, y1, z), v.p(x0, y1, z)]);
    }
  }
  // the side faces of a box: lit top/left (the lavender "arrow"), shade right/bottom
  function sides(ctx, v, x, y, w, z0, z1, lit, shade) {
    if (z1 - z0 < 0.001) return;
    const n = v.n, x1 = x + w, y1 = y + w;
    if (n[0] < -1e-5) fillPoly(ctx, lit, [v.p(x, y, z0), v.p(x, y1, z0), v.p(x, y1, z1), v.p(x, y, z1)], true);
    if (n[0] > 1e-5) fillPoly(ctx, shade, [v.p(x1, y, z0), v.p(x1, y1, z0), v.p(x1, y1, z1), v.p(x1, y, z1)], true);
    if (n[1] < -1e-5) fillPoly(ctx, lit, [v.p(x, y, z0), v.p(x1, y, z0), v.p(x1, y, z1), v.p(x, y, z1)], true);
    if (n[1] > 1e-5) fillPoly(ctx, shade, [v.p(x, y1, z0), v.p(x1, y1, z0), v.p(x1, y1, z1), v.p(x, y1, z1)], true);
  }

  // target rings where the arrow sticks, one shock square when the 2 lands
  function drawRings(ctx, t, v) {
    const ring = (cx, cy, age, life, r0, r1, a, w) => {
      if (age < 0 || age > life) return;
      const u = E.outCubic(age / life), half = (r0 + (r1 - r0) * u) * v.S;
      ctx.strokeStyle = rgba(LAV, a * (1 - u));
      ctx.lineWidth = 1.5 + w * (1 - u);
      ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
    };
    const [x, y] = v.p(30, 30, 0);
    for (let k = 0; k < 3; k++) ring(x, y, t - T.hit - k * 0.05, 0.55, 3, 21 + k * 12, 0.85, 4);
    const [cx, cy] = v.p(37.5, 37.5, 0);
    ring(cx, cy, t - T.land, 0.7, 40, 95, 0.7, 7);
  }

  // D and 3 unfold out of the arrow's tip: each tile has a corner at (30, 30)
  function drawTiles(ctx, t, v) {
    const sD = t < T.bloomD ? 0 : E.outBack(seg(t, T.bloomD, T.bloomD + 0.26));
    const s3 = t < T.bloom3 ? 0 : E.outBack(seg(t, T.bloom3, T.bloom3 + 0.26));
    if (sD > 0.001) face(ctx, v, 30 - 30 * sD, 30, 30 * sD, 0, INK, G.D);
    if (s3 > 0.001) face(ctx, v, 30, 30 - 30 * s3, 30 * s3, 0, INK, G.three);
  }

  // the arrow: the 2 cube's open sides travelling tip-first along its own
  // depth axis. It sticks, wobbles, then the 2 plate caps it.
  function drawCube(ctx, t, v) {
    if (t < T.fly0) return;
    const far = farZ(v.cam.L.S);
    const x = seg(t, T.fly0, T.hit);
    const zoff = t < T.hit ? far * (1 - (0.7 * x + 0.3 * E.outQuad(x))) : 0;
    const landed = t >= T.land, dl = t - T.land;
    const squash = landed ? 6 * Math.exp(-8 * dl) * Math.sin(TAU * 3.2 * dl) : 0;
    const z0 = zoff, z1 = zoff + 30 - squash;
    const wx = t - T.hit;
    const theta = wx > 0 ? 11 * DEG * Math.exp(-7 * wx) * Math.sin(TAU * 8.5 * wx) * (1 - smooth(seg(wx, 0.18, 0.4))) : 0;
    const [tx, ty] = v.p(30, 30, z0);
    ctx.save();
    if (theta) { ctx.translate(tx, ty); ctx.rotate(theta); ctx.translate(-tx, -ty); }
    sides(ctx, v, 30, 30, 30, z0, z1, LAV, SHADE);
    if (landed) face(ctx, v, 30, 30, 30, z1, INK, G.two);
    ctx.restore();
    if (!landed && t >= T.plate0) {
      const zp = 30 + (far - 30) * (1 - E.inQuart(seg(t, T.plate0, T.land)));
      face(ctx, v, 30, 30, 30, zp, INK, G.two);
    }
  }

  function drawWord(ctx, t, v) {
    const u = seg(t, T.word0, T.word0 + 0.42);
    if (u <= 0) return;
    const L = v.cam.L;
    ctx.save();
    ctx.globalAlpha = E.outCubic(u);
    ctx.font = `700 ${L.word}px "Space Grotesk", "Helvetica Neue", Arial, sans-serif`;
    ctx.letterSpacing = `${Math.round(L.word * 0.32)}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    // letter-spacing trails the last glyph; nudge by half of it to stay centred
    ctx.fillText('D32', W / 2 + L.word * 0.16, L.wordY + 0.4 * L.word * (1 - E.outExpo(u)));
    ctx.restore();
  }

  // a band of light runs down the mark along the arrow's axis
  function drawGlint(ctx, t, v) {
    const u = seg(t, T.glint0, T.glint1);
    if (u <= 0 || u >= 1) return;
    ctx.save();
    ctx.beginPath();
    poly(ctx, [v.p(0, 30, 0), v.p(30, 30, 0), v.p(30, 60, 0), v.p(0, 60, 0)]);
    poly(ctx, [v.p(30, 0, 0), v.p(60, 0, 0), v.p(60, 30, 0), v.p(30, 30, 0)]);
    poly(ctx, [v.p(30, 30, 0), v.p(60, 30, 0), v.p(60, 30, 30), v.p(60, 60, 30), v.p(30, 60, 30), v.p(30, 60, 0)]);
    ctx.clip();
    const d = lerp(-20, 95, E.inOutCubic(u)), w = 16;
    const [ax, ay] = v.p(d - w, d - w, 0), [bx, by] = v.p(d + w, d + w, 0);
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawWorld(ctx, t) {
    const v = makeView(cameraAt(t));
    ctx.fillStyle = PERI;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    drawRings(ctx, t, v);
    drawTiles(ctx, t, v);
    drawCube(ctx, t, v);
    drawGlint(ctx, t, v);
    drawWord(ctx, t, v);
  }

  // ──────────────────────────────────────────────────────────────── post ──
  function buf(name) {
    if (!pool[name]) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      pool[name] = c;
    }
    return pool[name];
  }
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
      const sc = 1 + (k * amt) / (Math.max(W, H) / 2);
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

  function renderFrame(ctx, t, opt = {}) {
    const n = opt.samples ?? 16;
    ctx.save();
    if (n <= 1) drawWorld(ctx, t);
    else {
      const sub = buf('sub'), sc = sub.getContext('2d');
      for (let k = 0; k < n; k++) {
        sc.save();
        drawWorld(sc, t + ((k + 0.5) / n - 0.5) * (SHUTTER / FPS));
        sc.restore();
        ctx.globalAlpha = 1 / (k + 1);
        ctx.drawImage(sub, 0, 0);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    let ca = 0;
    for (const [th, , c] of HITS) if (t >= th) ca += c * Math.exp(-12 * (t - th));
    if (ca > 0.35) chroma(ctx, ca);
  }

  root.D32Sting = { FPS, DURATION, T, setup, renderFrame };
})(typeof window !== 'undefined' ? window : globalThis);
