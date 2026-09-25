/* ============================================================================
 *  D32 — HIT THE MARK · mark.js
 *
 *  A 5-second ident on three ideas, all told with the mark's own geometry.
 *
 *  Hit the mark   A square target sits on the logo's grid. Its outer ring is
 *                 the 2×2 box of cells and its crosshair the lines between
 *                 them. The arrowhead flies in and sticks dead centre, at the
 *                 one point where the D, the 3 and the 2 meet.
 *  Growth         The mark is a scaled copy of itself anchored at the arrow's
 *                 tip, so it grows out of the hit in steps.
 *  Outside the    At full size the D and 3 fill the box exactly, and the 2
 *  box            cube breaks out through its corner.
 *
 *  ?words=1 adds the three lines as captions before the wordmark.
 *  Resolution-independent; every frame is a pure function of time.
 * ========================================================================== */
(function (root) {
  'use strict';

  const FPS = 60, DURATION = 5, SHUTTER = 0.5;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const INK = '#040404', PERI = '#8B91E3', LAV = '#EDEAF6', SHADE = '#5E63AE';

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

  const G = {
    three: [[0, 20, 8, 10], [0, 20, 20, 22]],
    two: [[0, 20, 8, 10], [10, 30, 20, 22]],
    D: [[20, 22, 10, 15.3], [20, 22, 14.7, 20]],
  };

  // ──────────────────────────────────────────────── timeline (120 BPM) ──
  const T = {
    aim: 0.05,               // the target draws on, ring by ring
    fly0: 0.5, hit: 0.75,    // the arrowhead flies in → dead centre
    pop: 1.0,                // the D and 3 appear at the tip
    grow1: 1.25, grow2: 1.5, // growth steps
    push: 1.75,              // the last step breaks the box
    land: 2.0,               // the 2 caps the cube, outside the box
    tilt0: 2.06, tilt1: 2.6, // a tilt shows it really stands out
    word: 3.0, glint0: 3.05, glint1: 3.6,
  };
  // growth scales about the tip; at K2 the arrow's arms just touch the box
  const K0 = 0.4, K1 = 0.53, K2 = 0.66;
  const CAPTIONS = [[T.hit, 'HIT THE MARK'], [T.grow1, 'GROW'], [T.land, 'THINK OUTSIDE THE BOX']];
  const HITS = [[T.hit, 9, 4, 0.04], [T.push, 5, 3, 0.01], [T.land, 12, 7, 0.03]]; // t, shake px, chroma px, punch

  const scaleAt = t => K0
    + (K1 - K0) * E.outBack(seg(t, T.grow1, T.grow1 + 0.18))
    + (K2 - K1) * E.outBack(seg(t, T.grow2, T.grow2 + 0.18))
    + (1 - K2) * E.outBack(seg(t, T.push, T.push + 0.2));

  // ─────────────────────────────────────────────────────── layout / view ──
  let W = 1920, H = 1080, words = false, pool = {};
  function setup(w, h, opts = {}) { W = w; H = h; words = !!opts.words; pool = {}; }

  function layout() {
    const portrait = H > W;
    const S = portrait ? (0.56 * W) / 75 : (0.42 * H) / 75;
    const word = Math.round(portrait ? 0.066 * W : 0.052 * H);
    const gap = word * 1.1;
    const group = 75 * S + gap + word;
    const cy = H / 2 - group / 2 + (75 * S) / 2;
    return { S, word, cap: Math.round(word * 0.68), cy, wordY: cy + (75 * S) / 2 + gap + word / 2 };
  }
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
    const settle = E.inOutCubic(seg(t, 1.5, 2.2)); // from the target's centre to the mark's
    // open close on the target; ease back while the mark outgrows the box
    const close = lerp(1.3, 1.38, E.outCubic(seg(t, 0, T.hit)));
    return {
      fx: 30, fy: 30, fz: 15 * settle,
      S: L.S * lerp(close, 1, E.inOutCubic(seg(t, 1.2, 2.15))) * (1 + punch),
      blend: 0.5 * Math.sin(Math.PI * seg(t, T.tilt0, T.tilt1)) ** 2, yaw: 30 * DEG, pitch: 22 * DEG,
      roll: shake * 0.0006 * noise(t * 33, 13),
      ox: shake * noise(t * 40, 5), oy: shake * noise(t * 40, 9),
      cx: W / 2, cy: L.cy, L,
    };
  }

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
    const p = (x, y, z = 0) => [a[0] * x + a[1] * y + a[2] * z + ox, b[0] * x + b[1] * y + b[2] * z + oy];
    return { a, b, n, S, p, cam: c };
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
  function face(ctx, v, x, y, w, z, color, slits) {
    fillPoly(ctx, color, [v.p(x, y, z), v.p(x + w, y, z), v.p(x + w, y + w, z), v.p(x, y + w, z)], !slits);
    if (!slits) return;
    const k = w / 30, e = 0.7 / v.S;
    for (const s of slits) {
      const x0 = x + (s[0] <= 0 ? -e : s[0] * k), x1 = x + (s[1] >= 30 ? w + e : s[1] * k);
      const y0 = y + s[2] * k, y1 = y + s[3] * k;
      fillPoly(ctx, PERI, [v.p(x0, y0, z), v.p(x1, y0, z), v.p(x1, y1, z), v.p(x0, y1, z)]);
    }
  }
  function sides(ctx, v, x, y, w, z0, z1) {
    if (z1 - z0 < 0.001) return;
    const n = v.n, x1 = x + w, y1 = y + w;
    if (n[0] < -1e-5) fillPoly(ctx, LAV, [v.p(x, y, z0), v.p(x, y1, z0), v.p(x, y1, z1), v.p(x, y, z1)], true);
    if (n[0] > 1e-5) fillPoly(ctx, SHADE, [v.p(x1, y, z0), v.p(x1, y1, z0), v.p(x1, y1, z1), v.p(x1, y, z1)], true);
    if (n[1] < -1e-5) fillPoly(ctx, LAV, [v.p(x, y, z0), v.p(x1, y, z0), v.p(x1, y, z1), v.p(x, y, z1)], true);
    if (n[1] > 1e-5) fillPoly(ctx, SHADE, [v.p(x, y1, z0), v.p(x1, y1, z0), v.p(x1, y1, z1), v.p(x, y1, z1)], true);
  }
  // a stroke of constant world width along the wall plane
  function line(ctx, v, x0, y0, x1, y1, width, color, u = 1) {
    if (u <= 0) return;
    const [ax, ay] = v.p(x0, y0), [bx, by] = v.p(x1, y1);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(lerp(ax, bx, u), lerp(ay, by, u));
    ctx.strokeStyle = color;
    ctx.lineWidth = width * v.S;
    ctx.lineCap = 'square';
    ctx.stroke();
  }

  // The target: crosshair, inner rings and the box, all on the logo's grid.
  function drawTarget(ctx, t, v) {
    const fadeInner = 1 - seg(t, T.grow1, T.push);
    const hitPulse = t > T.hit ? Math.exp(-9 * (t - T.hit)) : 0;
    // crosshair grows out from the mark, like a scope
    const uc = E.outExpo(seg(t, T.aim, T.aim + 0.3)), a = 0.55 * fadeInner;
    if (a > 0) {
      line(ctx, v, 30, 30, -15, 30, 0.35, rgba(INK, a), uc);
      line(ctx, v, 30, 30, 75, 30, 0.35, rgba(INK, a), uc);
      line(ctx, v, 30, 30, 30, -15, 0.35, rgba(INK, a), uc);
      line(ctx, v, 30, 30, 30, 75, 0.35, rgba(INK, a), uc);
    }
    // inner rings snap in on 16ths and flash when the arrow lands
    for (const [k, half, t0] of [[0, 20, T.aim + 0.2], [1, 10, T.aim + 0.32]]) {
      const u = E.outBack(seg(t, t0, t0 + 0.16));
      if (u <= 0 || fadeInner <= 0) continue;
      const h = half * u * (1 + 0.08 * hitPulse);
      ctx.save();
      ctx.globalAlpha = fadeInner;
      ctx.beginPath();
      poly(ctx, [v.p(30 - h, 30 - h), v.p(30 + h, 30 - h), v.p(30 + h, 30 + h), v.p(30 - h, 30 + h)]);
      ctx.strokeStyle = hitPulse > 0.05 ? LAV : INK;
      ctx.lineWidth = (0.55 - k * 0.1) * v.S;
      ctx.stroke();
      ctx.restore();
    }
    // bullseye
    const ub = E.outBack(seg(t, T.aim + 0.4, T.aim + 0.52)), gone = 1 - seg(t, T.pop, T.pop + 0.1);
    if (ub > 0 && gone > 0) {
      const h = 2.6 * ub;
      ctx.save();
      ctx.globalAlpha = gone;
      fillPoly(ctx, INK, [v.p(30 - h, 30 - h), v.p(30 + h, 30 - h), v.p(30 + h, 30 + h), v.p(30 - h, 30 + h)]);
      ctx.restore();
    }
  }

  // The box: the 2×2 cells' outline. Its bottom-right corner is punched out
  // when the cube breaks through; the rest falls away.
  function drawBox(ctx, t, v) {
    const ub = E.outExpo(seg(t, T.aim + 0.08, T.aim + 0.36));
    const away = E.inOutCubic(seg(t, 2.15, 2.6));
    if (ub <= 0 || away >= 1) return;
    const w = 1.05, col = rgba(INK, 1 - away), drift = 14 * away;
    const broken = t >= T.push + 0.02;
    // the three sides that stay drift outward and fade
    line(ctx, v, -drift, -drift, 60 + drift, -drift, w, col, ub);          // top
    line(ctx, v, -drift, -drift, -drift, 60 + drift, w, col, ub);          // left
    line(ctx, v, 60 + drift, -drift, 60 + drift, broken ? 30 : 60, w, col, ub);   // right, upper
    line(ctx, v, -drift, 60 + drift, broken ? 30 : 60, 60 + drift, w, col, ub);   // bottom, left
    if (!broken) {
      line(ctx, v, 60, 30, 60, 60, w, col, ub);
      line(ctx, v, 30, 60, 60, 60, w, col, ub);
      return;
    }
    // the punched-out corner flies off along the push, spinning
    const x = t - T.push - 0.02, fly = E.outCubic(seg(x, 0, 0.7));
    if (fly >= 1) return;
    const [cx, cy] = v.p(60 + 58 * fly, 60 + 52 * fly, 0);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(fly * 1.5);
    ctx.globalAlpha = 1 - fly;
    ctx.strokeStyle = INK;
    ctx.lineWidth = w * v.S;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(0, -30 * v.S);
    ctx.lineTo(0, 0);
    ctx.lineTo(-30 * v.S, 0);
    ctx.stroke();
    ctx.restore();
    // chips of the box
    for (let k = 0; k < 22; k++) {
      const ang = Math.PI / 4 + (hash(k, 4) - 0.5) * 2.2, spd = lerp(20, 80, hash(k, 5));
      const d = spd * E.outCubic(seg(x, 0, 0.6)), life = lerp(0.3, 0.6, hash(k, 6));
      if (x > life) continue;
      const [px, py] = v.p(60 + Math.cos(ang) * d, 60 + Math.sin(ang) * d, 0);
      const s = lerp(0.6, 1.6, hash(k, 7)) * v.S * (1 - x / life);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(hash(k, 8) * TAU + x * 8);
      ctx.fillStyle = INK;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  // shock squares: one where the arrow lands, one per growth step
  function drawPulses(ctx, t, v) {
    const ring = (age, life, r0, r1, a, w) => {
      if (age < 0 || age > life) return;
      const u = E.outCubic(age / life), h = r0 + (r1 - r0) * u;
      ctx.beginPath();
      poly(ctx, [v.p(30 - h, 30 - h), v.p(30 + h, 30 - h), v.p(30 + h, 30 + h), v.p(30 - h, 30 + h)]);
      ctx.strokeStyle = rgba(LAV, a * (1 - u));
      ctx.lineWidth = (0.3 + w * (1 - u)) * v.S;
      ctx.stroke();
    };
    for (let k = 0; k < 3; k++) ring(t - T.hit - k * 0.05, 0.5, 2, 16 + k * 10, 0.9, 0.7);
    ring(t - T.grow1, 0.5, 12, 40, 0.6, 0.5);
    ring(t - T.grow2, 0.5, 16, 46, 0.6, 0.5);
    ring(t - T.land, 0.7, 36, 80, 0.7, 0.9);
  }

  // D and 3: scaled about the tip, so they grow out of the hit
  function drawTiles(ctx, t, v, k) {
    const pD = E.outBack(seg(t, T.pop, T.pop + 0.2)), p3 = E.outBack(seg(t, T.pop + 0.0625, T.pop + 0.2625));
    const sD = 30 * k * pD, s3 = 30 * k * p3;
    if (sD > 0.01) face(ctx, v, 30 - sD, 30, sD, 0, INK, G.D);
    if (s3 > 0.01) face(ctx, v, 30, 30 - s3, s3, 0, INK, G.three);
  }

  // the arrowhead: the 2 cube's open sides, flying tip-first along its depth
  // axis, then growing with everything else until the 2 caps it
  function drawCube(ctx, t, v, k) {
    if (t < T.fly0) return;
    const far = farZ(v.cam.L.S);
    const x = seg(t, T.fly0, T.hit);
    const zoff = t < T.hit ? far * (1 - (0.7 * x + 0.3 * E.outQuad(x))) : 0;
    const w = 30 * k, landed = t >= T.land, dl = t - T.land;
    const squash = landed ? 5 * Math.exp(-8 * dl) * Math.sin(TAU * 3.2 * dl) : 0;
    const z0 = zoff, z1 = zoff + w - squash;
    const wx = t - T.hit;
    const theta = wx > 0 ? 12 * DEG * Math.exp(-7 * wx) * Math.sin(TAU * 8.5 * wx) * (1 - smooth(seg(wx, 0.16, 0.36))) : 0;
    const [tx, ty] = v.p(30, 30, z0);
    ctx.save();
    if (theta) { ctx.translate(tx, ty); ctx.rotate(theta); ctx.translate(-tx, -ty); }
    sides(ctx, v, 30, 30, w, z0, z1);
    if (landed) face(ctx, v, 30, 30, w, z1, INK, G.two);
    ctx.restore();
    if (!landed && t >= T.land - 0.2) {
      const zp = w + (far - w) * (1 - E.inQuart(seg(t, T.land - 0.2, T.land)));
      face(ctx, v, 30, 30, w, zp, INK, G.two);
    }
  }

  function drawGlint(ctx, t, v) {
    const u = seg(t, T.glint0, T.glint1);
    if (u <= 0 || u >= 1) return;
    ctx.save();
    ctx.beginPath();
    poly(ctx, [v.p(0, 30), v.p(30, 30), v.p(30, 60), v.p(0, 60)]);
    poly(ctx, [v.p(30, 0), v.p(60, 0), v.p(60, 30), v.p(30, 30)]);
    poly(ctx, [v.p(30, 30, 0), v.p(60, 30, 0), v.p(60, 30, 30), v.p(60, 60, 30), v.p(30, 60, 30), v.p(30, 60, 0)]);
    ctx.clip();
    const d = lerp(-20, 95, E.inOutCubic(u)), bw = 16;
    const [ax, ay] = v.p(d - bw, d - bw), [bx, by] = v.p(d + bw, d + bw);
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // captions resolve like the reel's HUD; the wordmark takes the last slot
  const NOISE_CH = '/\\<>+=-_*#0123456789ABCDEFXZ';
  function scramble(str, t, t0, dur) {
    const u = seg(t, t0, t0 + dur);
    if (u >= 1) return str;
    const n = str.length, edge = Math.floor(u * (n + 4)) - 4, f = Math.floor(t * 30);
    let out = '';
    for (let k = 0; k < n; k++) {
      if (str[k] === ' ' || k <= edge) out += str[k];
      else if (k <= edge + 4) out += NOISE_CH[Math.floor(hash(k, f, n) * NOISE_CH.length)];
      else out += ' ';
    }
    return out;
  }
  function drawType(ctx, t, v) {
    const L = v.cam.L, wordAt = words ? T.word : 2.4;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    if (words && t >= CAPTIONS[0][0] && t < wordAt) {
      let c = CAPTIONS[0];
      for (const q of CAPTIONS) if (t >= q[0]) c = q;
      const out = seg(t, wordAt - 0.12, wordAt);
      ctx.globalAlpha = 1 - out;
      ctx.font = `700 ${L.cap}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.letterSpacing = `${Math.round(L.cap * 0.22)}px`;
      ctx.fillText(scramble(c[1], t, c[0], 0.22), W / 2 + L.cap * 0.11, L.wordY);
    }
    const u = seg(t, wordAt, wordAt + 0.42);
    if (u > 0) {
      ctx.globalAlpha = E.outCubic(u);
      ctx.font = `700 ${L.word}px "Space Grotesk", "Helvetica Neue", Arial, sans-serif`;
      ctx.letterSpacing = `${Math.round(L.word * 0.32)}px`;
      ctx.fillText('D32', W / 2 + L.word * 0.16, L.wordY + 0.4 * L.word * (1 - E.outExpo(u)));
    }
    ctx.restore();
  }

  function drawWorld(ctx, t) {
    const v = makeView(cameraAt(t)), k = scaleAt(t);
    ctx.fillStyle = PERI;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    drawTarget(ctx, t, v);
    drawBox(ctx, t, v);
    drawPulses(ctx, t, v);
    drawTiles(ctx, t, v, k);
    drawCube(ctx, t, v, k);
    drawGlint(ctx, t, v);
    drawType(ctx, t, v);
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

  root.D32Mark = { FPS, DURATION, T, CAPTIONS, setup, renderFrame, get words() { return words; } };
})(typeof window !== 'undefined' ? window : globalThis);
