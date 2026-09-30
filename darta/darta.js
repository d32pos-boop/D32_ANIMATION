/* ============================================================================
 *  DARTA — LOGO MOTION · darta.js
 *
 *  Five directions for the Darta mark (Frame 1 (6).svg), a compliance tool
 *  for personal-data (PII) law, so every direction is about protecting,
 *  redacting, ordering or clarifying data, told calmly. The emblem is a
 *  pill cut into four leaves by a thin cross; every leaf is a 9×4 rectangle
 *  with two opposite corners rounded at r = 4, so the four inner corners
 *  carve a four-pointed star around the centre dot. The leaves are rebuilt
 *  here as parametric shapes that match the SVG exactly at rest, so their
 *  gaps, corners and positions can move; the wordmark uses the SVG's own
 *  letter paths.
 *
 *  Every frame is a pure function of time. Springs are critically- or
 *  lightly-underdamped (SwiftUI-style response / damping), blur is real
 *  Gaussian focus, and motion blur averages sub-frames over a 180° shutter.
 * ========================================================================== */
(function (root) {
  'use strict';

  const FPS = 60, DURATION = 5, SHUTTER = 0.5;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const TEAL = '#2C7D81';

  // ─────────────────────────────────────────────── the mark (viewBox 40×10) ──
  const LETTERS = [
    'M20.0359 7.54479V1.94479H21.8879C22.2746 1.94479 22.6372 2.01812 22.9759 2.16479C23.3146 2.30879 23.6119 2.51012 23.8679 2.76879C24.1239 3.02479 24.3239 3.32212 24.4679 3.66079C24.6146 3.99679 24.6879 4.35812 24.6879 4.74479C24.6879 5.13146 24.6146 5.49412 24.4679 5.83279C24.3239 6.16879 24.1239 6.46612 23.8679 6.72479C23.6119 6.98079 23.3146 7.18212 22.9759 7.32879C22.6372 7.47279 22.2746 7.54479 21.8879 7.54479H20.0359ZM20.7879 6.79279H21.8879C22.1706 6.79279 22.4346 6.74079 22.6799 6.63679C22.9279 6.53012 23.1466 6.38346 23.3359 6.19679C23.5252 6.00746 23.6719 5.78879 23.7759 5.54079C23.8826 5.29279 23.9359 5.02746 23.9359 4.74479C23.9359 4.46212 23.8826 4.19812 23.7759 3.95279C23.6719 3.70479 23.5252 3.48612 23.3359 3.29679C23.1466 3.10746 22.9279 2.96079 22.6799 2.85679C22.4346 2.75012 22.1706 2.69679 21.8879 2.69679H20.7879V6.79279Z',
    'M28.489 3.54479H29.241V7.54479H28.489L28.457 6.91679C28.3343 7.13546 28.1676 7.31279 27.957 7.44879C27.749 7.58212 27.501 7.64879 27.213 7.64879C26.9196 7.64879 26.6436 7.59412 26.385 7.48479C26.129 7.37279 25.9023 7.21946 25.705 7.02479C25.5103 6.82746 25.3583 6.60079 25.249 6.34479C25.1396 6.08612 25.085 5.80879 25.085 5.51279C25.085 5.22746 25.1383 4.95946 25.245 4.70879C25.3516 4.45546 25.4996 4.23412 25.689 4.04479C25.881 3.85279 26.101 3.70346 26.349 3.59679C26.5996 3.48746 26.869 3.43279 27.157 3.43279C27.4583 3.43279 27.7236 3.50346 27.953 3.64479C28.185 3.78346 28.3743 3.96346 28.521 4.18479L28.489 3.54479ZM27.197 6.92079C27.445 6.92079 27.661 6.85946 27.845 6.73679C28.0316 6.61412 28.1756 6.44879 28.277 6.24079C28.3783 6.03012 28.429 5.79812 28.429 5.54479C28.429 5.28612 28.377 5.05279 28.273 4.84479C28.1716 4.63679 28.029 4.47146 27.845 4.34879C27.661 4.22612 27.445 4.16479 27.197 4.16479C26.949 4.16479 26.7223 4.22746 26.517 4.35279C26.3143 4.47546 26.153 4.64212 26.033 4.85279C25.913 5.06079 25.853 5.29146 25.853 5.54479C25.853 5.80079 25.9143 6.03279 26.037 6.24079C26.1623 6.44879 26.3263 6.61412 26.529 6.73679C26.7316 6.85946 26.9543 6.92079 27.197 6.92079Z',
    'M30.0437 7.54479V3.54479H30.7957V4.00879C30.9344 3.83012 31.109 3.69012 31.3197 3.58879C31.5304 3.48479 31.757 3.43279 31.9997 3.43279C32.1517 3.43279 32.2997 3.45279 32.4437 3.49279L32.1437 4.24879C32.037 4.21146 31.9317 4.19279 31.8277 4.19279C31.6384 4.19279 31.465 4.23946 31.3077 4.33279C31.153 4.42346 31.029 4.54746 30.9357 4.70479C30.8424 4.85946 30.7957 5.03279 30.7957 5.22479V7.54479H30.0437Z',
    'M35.0966 4.29679H34.2206V7.54479H33.4686V4.29679H32.8086V3.54479H33.4686V2.28879H34.2206V3.54479H35.0966V4.29679Z',
    'M38.8718 3.54479H39.6238V7.54479H38.8718L38.8398 6.91679C38.7171 7.13546 38.5504 7.31279 38.3398 7.44879C38.1318 7.58212 37.8838 7.64879 37.5958 7.64879C37.3024 7.64879 37.0264 7.59412 36.7678 7.48479C36.5118 7.37279 36.2851 7.21946 36.0878 7.02479C35.8931 6.82746 35.7411 6.60079 35.6318 6.34479C35.5224 6.08612 35.4678 5.80879 35.4678 5.51279C35.4678 5.22746 35.5211 4.95946 35.6278 4.70879C35.7344 4.45546 35.8824 4.23412 36.0718 4.04479C36.2638 3.85279 36.4838 3.70346 36.7318 3.59679C36.9824 3.48746 37.2518 3.43279 37.5398 3.43279C37.8411 3.43279 38.1064 3.50346 38.3358 3.64479C38.5678 3.78346 38.7571 3.96346 38.9038 4.18479L38.8718 3.54479ZM37.5798 6.92079C37.8278 6.92079 38.0438 6.85946 38.2278 6.73679C38.4144 6.61412 38.5584 6.44879 38.6598 6.24079C38.7611 6.03012 38.8118 5.79812 38.8118 5.54479C38.8118 5.28612 38.7598 5.05279 38.6558 4.84479C38.5544 4.63679 38.4118 4.47146 38.2278 4.34879C38.0438 4.22612 37.8278 4.16479 37.5798 4.16479C37.3318 4.16479 37.1051 4.22746 36.8998 4.35279C36.6971 4.47546 36.5358 4.64212 36.4158 4.85279C36.2958 5.06079 36.2358 5.29146 36.2358 5.54479C36.2358 5.80079 36.2971 6.03279 36.4198 6.24079C36.5451 6.44879 36.7091 6.61412 36.9118 6.73679C37.1144 6.85946 37.3371 6.92079 37.5798 6.92079Z',
  ];
  // leaves: bounds and which corners carry the r = 4 arcs (outer rim, inner star)
  const LEAF = {
    TL: { x0: 0.0276, y0: 0.2443, x1: 9.0276, y1: 4.243, outer: 'tl', inner: 'br', dir: [-1, -1] },
    TR: { x0: 10, y0: 0.2184, x1: 19, y1: 4.2184, outer: 'tr', inner: 'bl', dir: [1, -1] },
    BR: { x0: 10, y0: 5.2184, x1: 19, y1: 9.2171, outer: 'br', inner: 'tl', dir: [1, 1] },
    BL: { x0: 0, y0: 5.2184, x1: 9, y1: 9.2171, outer: 'bl', inner: 'tr', dir: [-1, 1] },
  };
  const KEYS = ['TL', 'TR', 'BR', 'BL'];
  const DOT = { x: 9.5, y: 4.7184, r: 1.5 };
  const EC = { x: 9.5, y: 4.7178 };          // emblem centre
  const LC = { x: 19.81, y: 4.7178 };        // lockup centre (whole logo)

  // ───────────────────────────────────────────────────────────── math ──
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = u => ((ax * u + bx) * u + cx) * u, Y = u => ((ay * u + by) * u + cy) * u;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, u = x;
      for (let i = 0; i < 36; i++) { u = (lo + hi) / 2; if (X(u) < x) lo = u; else hi = u; }
      return Y(u);
    };
  }
  const E = {
    out: bezier(0.16, 1, 0.3, 1),         // long, feather-soft landing
    inOut: bezier(0.65, 0, 0.35, 1),
    glide: bezier(0.5, 0, 0.1, 1),        // eased start, very soft arrival
    sine: u => -(Math.cos(Math.PI * u) - 1) / 2,
    outCubic: u => 1 - (1 - u) ** 3,
  };
  // SwiftUI-style spring: response = undamped period (s), damping fraction ζ
  function spring(t, response = 0.55, damping = 0.825) {
    if (t <= 0) return 0;
    const w = TAU / response;
    if (damping >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const wd = w * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
  }
  const bump = (u, d) => (u <= 0 || u >= d ? 0 : Math.sin((Math.PI * u) / d) ** 2);
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ─────────────────────────────────────────────────────────── geometry ──
  // SVG path → subpaths of points (absolute and relative M L H V C Z)
  function flatten(d, steps = 14) {
    const tok = d.match(/[MLHVCZmlhvcz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g);
    const out = [];
    let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', k = 0;
    const num = () => Number(tok[k++]);
    while (k < tok.length) {
      if (/[a-z]/i.test(tok[k])) cmd = tok[k++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      if (C === 'Z') {
        if (cur) out.push(cur);
        cur = null; x = sx; y = sy;
        continue;
      }
      if (C === 'M') {
        if (cur) out.push(cur);
        x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num();
        sx = x; sy = y; cur = [[x, y]];
        cmd = rel ? 'l' : 'L';
      } else if (C === 'L') { x = (rel ? x : 0) + num(); y = (rel ? y : 0) + num(); cur.push([x, y]); }
      else if (C === 'H') { x = (rel ? x : 0) + num(); cur.push([x, y]); }
      else if (C === 'V') { y = (rel ? y : 0) + num(); cur.push([x, y]); }
      else if (C === 'C') {
        const ox = rel ? x : 0, oy = rel ? y : 0;
        const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num(), x3 = ox + num(), y3 = oy + num();
        for (let i = 1; i <= steps; i++) {
          const u = i / steps, v = 1 - u;
          cur.push([
            v * v * v * x + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3,
            v * v * v * y + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3,
          ]);
        }
        x = x3; y = y3;
      }
    }
    if (cur) out.push(cur);
    return out;
  }
  // rectangle with per-corner circular radii, clockwise from the top-left
  function roundRect(x0, y0, x1, y1, r, n = 30) {
    const pts = [];
    const arc = (cx, cy, rad, a0, cornerX, cornerY) => {
      if (rad < 1e-4) { pts.push([cornerX, cornerY]); return; }
      for (let i = 0; i <= n; i++) {
        const a = a0 + (i / n) * (Math.PI / 2);
        pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
      }
    };
    arc(x0 + r.tl, y0 + r.tl, r.tl, Math.PI, x0, y0);
    arc(x1 - r.tr, y0 + r.tr, r.tr, 1.5 * Math.PI, x1, y0);
    arc(x1 - r.br, y1 - r.br, r.br, 0, x1, y1);
    arc(x0 + r.bl, y1 - r.bl, r.bl, 0.5 * Math.PI, x0, y1);
    return pts;
  }
  // a leaf with its rim radius, star radius and an offset (for opening the cross)
  function leaf(key, { rOut = 4, rIn = 4, dx = 0, dy = 0 } = {}) {
    const p = LEAF[key], r = { tl: 0, tr: 0, br: 0, bl: 0 };
    r[p.outer] = rOut; r[p.inner] = rIn;
    return roundRect(p.x0 + dx, p.y0 + dy, p.x1 + dx, p.y1 + dy, r);
  }
  function circle(cx, cy, r, n = 120) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([cx + r * Math.cos((i / n) * TAU), cy + r * Math.sin((i / n) * TAU)]);
    return pts;
  }
  function toPath(polys) {
    const p = new Path2D();
    for (const poly of polys) {
      p.moveTo(poly[0][0], poly[0][1]);
      for (let i = 1; i < poly.length; i++) p.lineTo(poly[i][0], poly[i][1]);
      p.closePath();
    }
    return p;
  }
  const polyLength = poly => {
    let L = 0;
    for (let i = 1; i <= poly.length; i++) {
      const a = poly[i - 1], b = poly[i % poly.length];
      L += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return L;
  };

  const LEAF_POLY = Object.fromEntries(KEYS.map(k => [k, leaf(k)]));
  const LEAF_PATH = Object.fromEntries(KEYS.map(k => [k, toPath([LEAF_POLY[k]])]));
  const DOT_POLY = circle(DOT.x, DOT.y, DOT.r);
  const DOT_PATH = toPath([DOT_POLY]);
  const LETTER_POLYS = LETTERS.map(d => flatten(d));
  const LETTER_PATH = LETTERS.map(d => new Path2D(d));
  const LETTER_BOX = LETTER_POLYS.map(polys => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const poly of polys) for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  });
  const ALL_EMBLEM = (() => { const p = new Path2D(); for (const k of KEYS) p.addPath(LEAF_PATH[k]); p.addPath(DOT_PATH); return p; })();
  const ALL_WORD = (() => { const p = new Path2D(); for (const l of LETTER_PATH) p.addPath(l); return p; })();

  // ──────────────────────────────────────────────────────────── layout ──
  let W = 1920, H = 1080, OPT = 1, pool = {};
  function setup(w, h, opt = 1) { W = w; H = h; OPT = opt; pool = {}; }
  function layout() {
    const portrait = H > W;
    const S = portrait ? (0.8 * W) / 39.62 : Math.min((0.4 * W) / 39.62, (0.22 * H) / 9);
    return {
      S,
      ox: W / 2 - S * LC.x, oy: H / 2 - S * LC.y,       // lockup origin on screen
      ex: W / 2 + S * (EC.x - LC.x),                    // emblem centre, lockup
    };
  }
  // put emblem-space coordinates on screen with the emblem centre at (cx, cy)
  const emblemXf = (ctx, cx, cy, s) => ctx.setTransform(s, 0, 0, s, cx - s * EC.x, cy - s * EC.y);
  const lockXf = (ctx, L) => ctx.setTransform(L.S, 0, 0, L.S, L.ox, L.oy);

  function buf(name) {
    if (!pool[name]) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      pool[name] = c;
    }
    return pool[name];
  }
  // a fixed ±1-level dither: keeps big soft gradients from banding in H.264
  let DITHER = null;
  function dither(ctx, amount = 0.05) {
    if (!DITHER) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d'), img = g.createImageData(256, 256), R = rng(7);
      for (let i = 0; i < 256 * 256; i++) {
        const v = 128 + (R() - 0.5) * 64;
        img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = v;
        img.data[4 * i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      DITHER = c;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount;
    ctx.fillStyle = ctx.createPattern(DITHER, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // Near black, an overlay dither multiplies to nothing, so the dark scene gets
  // additive grain instead: 0…amp levels of fixed noise, which H.264 keeps
  // where it would otherwise flatten a faint glow into visible rings.
  let GRAIN = null;
  function grain(ctx, amp = 3) {
    if (!GRAIN) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d'), img = g.createImageData(256, 256), R = rng(9);
      for (let i = 0; i < 256 * 256; i++) {
        img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = Math.floor(R() * (amp + 1));
        img.data[4 * i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      GRAIN = c;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function letters(ctx, L, state, color = TEAL) {
    for (let i = 0; i < LETTER_PATH.length; i++) {
      const s = state(i);
      if (!s || s.a <= 0.002) continue;
      const b = LETTER_BOX[i];
      ctx.save();
      lockXf(ctx, L);
      ctx.translate(b.cx + (s.dx || 0), b.cy + (s.dy || 0));
      if (s.scale) ctx.scale(s.scale, s.scale);
      ctx.translate(-b.cx, -b.cy);
      ctx.globalAlpha = s.a;
      if (s.blur > 0.15) ctx.filter = `blur(${s.blur}px)`;
      ctx.fillStyle = color;
      ctx.fill(LETTER_PATH[i]);
      ctx.restore();
    }
  }

  // ═════════════════════════════════════════════ 1 · SAFEGUARD (dark) ══
  // The data comes first: a point of light. The four leaves close in around
  // it like a vault and the light is held inside, seen only through the star
  // and the cross. The emblem glides aside and the name rises.
  function halo(ctx, cx, cy, s, r, a) {
    if (a <= 0.002) return;
    ctx.save();
    emblemXf(ctx, cx, cy, s);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(DOT.x, DOT.y, 0, DOT.x, DOT.y, r);
    g.addColorStop(0, `rgba(214,252,248,${0.9 * a})`);
    g.addColorStop(0.18, `rgba(120,218,211,${0.55 * a})`);
    g.addColorStop(0.4, `rgba(60,160,162,${0.3 * a})`);
    g.addColorStop(0.6, `rgba(44,125,129,${0.14 * a})`);
    g.addColorStop(0.8, `rgba(44,125,129,${0.045 * a})`);
    g.addColorStop(1, 'rgba(44,125,129,0)');
    ctx.fillStyle = g;
    ctx.fillRect(DOT.x - r, DOT.y - r, 2 * r, 2 * r);
    ctx.restore();
  }
  function safeguard(ctx, t) {
    const L = layout();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050607';                 // + grain averages back to #060708
    ctx.fillRect(0, 0, W, H);
    const g = E.glide(seg(t, 1.78, 2.78));
    const s = L.S * lerp(1.22, 1, g), cx = lerp(W / 2, L.ex, g), cy = H / 2;
    const closed = E.inOut(seg(t, 0.62, 1.6));
    // (1 − x²)² falloff: it meets the black with zero slope, so it has no visible rim
    const amb = ctx.createRadialGradient(cx, cy, 0, cx, cy, 0.7 * H);
    const ambA = 0.1 * E.outCubic(seg(t, 0.1, 1.2)) * (1 - 0.4 * seg(t, 2.2, 3.4));
    for (let k = 0; k <= 8; k++) amb.addColorStop(k / 8, `rgba(44,125,129,${ambA * (1 - (k / 8) ** 2) ** 2})`);
    ctx.fillStyle = amb;
    ctx.fillRect(0, 0, W, H);
    // the light: open and bright, then held inside the leaves
    const breathe = 1 + 0.06 * Math.sin(TAU * 0.8 * t);
    halo(ctx, cx, cy, s, lerp(10, 4.6, closed) * breathe, E.outCubic(seg(t, 0.1, 0.6)) * lerp(1, 0.6, closed) * (1 - 0.55 * E.inOut(seg(t, 2.2, 3.8))));
    KEYS.forEach((k, i) => {
      const u = t - (0.6 + 0.065 * i);
      if (u <= 0) return;
      const p = spring(u, 1.05, 0.9);
      const sc = lerp(1.5, 1, p), rot = 12 * DEG * (1 - spring(u, 1.15, 0.92));
      const blur = 20 * (1 - E.out(seg(u, 0, 0.75)));
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, cx, cy);
      ctx.rotate(rot);
      ctx.scale(s * sc, s * sc);
      ctx.translate(-EC.x, -EC.y);
      ctx.globalAlpha = E.outCubic(seg(u, 0, 0.55));
      if (blur > 0.15) ctx.filter = `blur(${blur}px)`;
      ctx.fillStyle = TEAL;
      ctx.fill(LEAF_PATH[k]);
      ctx.restore();
    });
    // the core: luminous at first, settling into the solid dot as it is enclosed
    const ds = spring(t - 0.12, 0.6, 0.72);
    if (ds > 0.001) {
      const c = E.inOut(seg(t, 0.9, 1.9));
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, cx, cy);
      ctx.scale(s * ds, s * ds);
      ctx.translate(-DOT.x, -DOT.y);
      ctx.fillStyle = `rgb(${Math.round(lerp(222, 44, c))},${Math.round(lerp(252, 125, c))},${Math.round(lerp(249, 129, c))})`;
      ctx.fill(DOT_PATH);
      ctx.restore();
    }
    letters(ctx, L, i => {
      const u = t - (1.98 + 0.06 * i);
      if (u <= 0) return null;
      return { dy: 1.1 * (1 - spring(u, 0.8, 0.93)), a: E.outCubic(seg(u, 0, 0.5)), blur: 8 * (1 - E.out(seg(u, 0, 0.55))) };
    });
    sheen(ctx, L, t, 3.4, 4.25, 0.26);
  }

  // ════════════════════════════════════════════════ 2 · REDACT (white) ══
  // Two lines of a document are redacted, marker stroke by marker stroke;
  // the strokes reshape into the leaves and open the star; the dot sets in
  // the middle; a last stroke covers the name and lifts to reveal it.
  function redact(ctx, t) {
    const L = layout();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
    lockXf(ctx, L);
    const morph = E.inOut(seg(t, 1.02, 1.7));
    const SWEEP = { TL: [0.14, 0.66], TR: [0.32, 0.84], BL: [0.5, 1.02], BR: [0.68, 1.2] };
    for (const k of KEYS) {
      const u = E.out(seg(t, SWEEP[k][0], SWEEP[k][1]));
      if (u <= 0) continue;
      const p = LEAF[k], h = p.y1 - p.y0, w = (p.x1 - p.x0) * u;
      const cap = Math.min(h / 2, w / 2);
      const r = {};
      for (const c of ['tl', 'tr', 'br', 'bl']) r[c] = Math.min(lerp(cap, c === p.outer || c === p.inner ? 4 : 0, morph), w);
      ctx.fillStyle = TEAL;
      ctx.fill(toPath([roundRect(p.x0, p.y0, p.x0 + w, p.y1, r)]));
    }
    const ds = spring(t - 1.34, 0.5, 0.7);
    if (ds > 0.001) {
      ctx.save();
      ctx.translate(DOT.x, DOT.y);
      ctx.scale(ds, ds);
      ctx.translate(-DOT.x, -DOT.y);
      ctx.fillStyle = TEAL;
      ctx.fill(DOT_PATH);
      ctx.restore();
    }
    // the name sits under a redaction stroke that lifts away to the right
    const x0 = 19.95, x1 = 39.95, y0 = 1.55, y1 = 8.05;
    const cover = E.out(seg(t, 1.55, 2.08)), lift = E.inOut(seg(t, 2.22, 2.85));
    if (lift > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 - 1, y0 - 1, (x1 - x0 + 2) * lift + 0.001, y1 - y0 + 2);
      ctx.clip();
      ctx.fillStyle = TEAL;
      ctx.fill(ALL_WORD);
      ctx.restore();
    }
    const bx0 = lerp(x0, x1, lift), bx1 = lerp(x0, x1, cover);
    if (bx1 - bx0 > 0.01) {
      const rr = Math.min((y1 - y0) / 2, (bx1 - bx0) / 2);
      ctx.fillStyle = TEAL;
      ctx.fill(toPath([roundRect(bx0, y0, bx1, y1, { tl: rr, tr: rr, br: rr, bl: rr })]));
    }
  }

  // a soft band of light across the finished logo
  function sheen(ctx, L, t, t0, t1, peak, color = '255,255,255') {
    const u = seg(t, t0, t1);
    if (u <= 0 || u >= 1) return;
    ctx.save();
    lockXf(ctx, L);
    const all = new Path2D();
    all.addPath(ALL_EMBLEM);
    all.addPath(ALL_WORD);
    ctx.clip(all);
    const d = lerp(-12, 52, E.inOut(u)), w = 7;
    const g = ctx.createLinearGradient(d - w, 0, d + w, 10);
    g.addColorStop(0, `rgba(${color},0)`);
    g.addColorStop(0.5, `rgba(${color},${peak})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(-2, -2, 44, 14);
    ctx.restore();
  }

  // ═══════════════════════════════════════ 3 · CONSTRUCT (light grey) ══
  // Built on rules. The geometry draws itself like a precision tool: guides, the r = 4
  // circles every curve comes from, outlines; fills flow in; letters are
  // penned then filled. Built in place, no glide.
  function strokePoly(ctx, poly, u, closed = true) {
    if (u <= 0) return;
    const L0 = polyLength(poly);
    ctx.setLineDash([L0 * u, L0 + 1]);
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    if (closed) ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // start a closed outline at its point furthest along a direction
  function rotateTo(poly, dir) {
    let best = 0, bv = -Infinity;
    poly.forEach(([x, y], i) => { const v = x * dir[0] + y * dir[1]; if (v > bv) { bv = v; best = i; } });
    return poly.slice(best).concat(poly.slice(0, best));
  }
  const CIRCLES = [
    [5.0289, 0.2443], [14, 0.2184], [13.9987, 9.2171], [5.0013, 9.2171],   // the star
    [4.0264, 4.243], [15, 4.2184], [15.0013, 5.2184], [3.9987, 5.2184],   // the rim
  ];
  function construct(ctx, t) {
    const L = layout();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#F5F5F7';
    ctx.fillRect(0, 0, W, H);
    lockXf(ctx, L);
    const px = 1 / L.S;
    // dot grid, like a design tool's canvas
    const ga = 0.11 * E.outCubic(seg(t, 0, 0.5)) * (1 - E.inOut(seg(t, 2.45, 3.3)));
    if (ga > 0.002) {
      ctx.fillStyle = `rgba(28,28,30,${ga})`;
      const x0 = Math.floor(-L.ox / L.S), x1 = Math.ceil((W - L.ox) / L.S), y0 = Math.floor(-L.oy / L.S), y1 = Math.ceil((H - L.oy) / L.S);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ctx.fillRect(x - 1.1 * px, y - 1.1 * px, 2.2 * px, 2.2 * px);
    }
    const guideA = 1 - E.inOut(seg(t, 1.75, 2.35));
    ctx.lineCap = 'round';
    // guides along the cross
    if (guideA > 0) {
      ctx.strokeStyle = `rgba(72,72,74,${0.6 * guideA})`;
      ctx.lineWidth = 1.25 * px;
      const uh = E.out(seg(t, 0.1, 0.75)), uv = E.out(seg(t, 0.2, 0.85));
      ctx.beginPath();
      ctx.moveTo(EC.x - 13 * uh, DOT.y); ctx.lineTo(EC.x + 33 * uh, DOT.y);
      ctx.moveTo(EC.x, DOT.y - 6.5 * uv); ctx.lineTo(EC.x, DOT.y + 6.5 * uv);
      ctx.stroke();
      // the r = 4 circles and the dot's circle
      ctx.strokeStyle = `rgba(72,72,74,${0.5 * guideA})`;
      CIRCLES.forEach(([x, y], i) => {
        const u = E.inOut(seg(t, 0.34 + 0.055 * i, 0.9 + 0.055 * i));
        if (u <= 0) return;
        ctx.beginPath();
        ctx.arc(x, y, 4, -Math.PI / 2, -Math.PI / 2 + TAU * u);
        ctx.stroke();
      });
      const ud = E.inOut(seg(t, 0.62, 1.1));
      if (ud > 0) { ctx.beginPath(); ctx.arc(DOT.x, DOT.y, DOT.r, -Math.PI / 2, -Math.PI / 2 + TAU * ud); ctx.stroke(); }
    }
    // outlines trace the leaves from their outer ends
    const outlineA = 1 - seg(t, 1.9, 2.3);
    ctx.strokeStyle = `rgba(44,125,129,${outlineA})`;
    ctx.lineWidth = 1.8 * px;
    KEYS.forEach((k, i) => strokePoly(ctx, rotateTo(LEAF_POLY[k], [LEAF[k].dir[0], 0.01]), E.inOut(seg(t, 0.72 + 0.06 * i, 1.32 + 0.06 * i))));
    // fills flow in from the rim toward the star
    KEYS.forEach((k, i) => {
      const u = E.inOut(seg(t, 1.22 + 0.06 * i, 1.72 + 0.06 * i));
      if (u <= 0) return;
      const p = LEAF[k];
      ctx.save();
      ctx.beginPath();
      if (p.dir[0] < 0) ctx.rect(p.x0 - 0.5, p.y0 - 0.5, (p.x1 - p.x0 + 1) * u, p.y1 - p.y0 + 1);
      else ctx.rect(p.x1 + 0.5 - (p.x1 - p.x0 + 1) * u, p.y0 - 0.5, (p.x1 - p.x0 + 1) * u, p.y1 - p.y0 + 1);
      ctx.clip();
      ctx.fillStyle = TEAL;
      ctx.fill(LEAF_PATH[k]);
      ctx.restore();
    });
    const ds = spring(t - 1.58, 0.45, 0.72);
    if (ds > 0.001) {
      ctx.save();
      ctx.translate(DOT.x, DOT.y);
      ctx.scale(lerp(0.4, 1, ds), lerp(0.4, 1, ds));
      ctx.translate(-DOT.x, -DOT.y);
      ctx.globalAlpha = clamp(ds * 1.5);
      ctx.fillStyle = TEAL;
      ctx.fill(DOT_PATH);
      ctx.restore();
    }
    // the name: penned, then filled
    LETTER_POLYS.forEach((polys, i) => {
      const u = E.inOut(seg(t, 1.05 + 0.09 * i, 1.65 + 0.09 * i));
      const f = E.outCubic(seg(t, 1.78 + 0.07 * i, 2.1 + 0.07 * i));
      if (u > 0 && f < 1) {
        ctx.strokeStyle = `rgba(44,125,129,${1 - f})`;
        ctx.lineWidth = 1.5 * px;
        for (const poly of polys) strokePoly(ctx, poly, u);
      }
      if (f > 0) {
        ctx.save();
        ctx.globalAlpha = f;
        ctx.fillStyle = TEAL;
        ctx.fill(LETTER_PATH[i]);
        ctx.restore();
      }
    });
  }

  // ═══════════════════════════════════ 4 · PRIVACY GLASS (luminous) ══
  // Private by design, clear in the end. A frosted glass pill forms over a
  // soft moving light; it splits along the
  // cross, the star opens, teal floods out from the centre, a droplet
  // settles into the dot; the glass dissolves into the flat mark.
  function glassBg(ctx, t, blur = 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (blur) ctx.filter = `blur(${blur}px)`;
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#F7FBFB');
    base.addColorStop(1, '#E7F2F2');
    ctx.fillStyle = base;
    ctx.fillRect(-60, -60, W + 120, H + 120);
    // (1 − x²)² falloff: as much light as a linear blob, but with no rim
    const blob = (x, y, r, rgb, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      for (let k = 0; k <= 8; k++) g.addColorStop(k / 8, `rgba(${rgb},${a * (1 - (k / 8) ** 2) ** 2})`);
      ctx.fillStyle = g;
      ctx.fillRect(-60, -60, W + 120, H + 120);
    };
    const m = Math.min(W, H);
    blob(W * (0.34 + 0.05 * Math.sin(t * 0.7)), H * (0.44 + 0.06 * Math.cos(t * 0.55)), 0.7 * m, '44,125,129', 0.2);
    blob(W * (0.68 + 0.05 * Math.cos(t * 0.6)), H * (0.6 + 0.05 * Math.sin(t * 0.8)), 0.62 * m, '130,222,212', 0.42);
    blob(W * (0.3 + 0.04 * Math.cos(t * 0.45)), H * (0.8 + 0.04 * Math.sin(t * 0.6)), 0.5 * m, '168,236,228', 0.3);
    blob(W * (0.52 + 0.04 * Math.sin(t * 0.5 + 1)), H * (0.16 + 0.04 * Math.cos(t * 0.65)), 0.55 * m, '255,255,255', 0.85);
    ctx.restore();
  }
  function stadium(x0, y0, x1, y1) {
    const r = (y1 - y0) / 2;
    return roundRect(x0, y0, x1, y1, { tl: r, tr: r, br: r, bl: r });
  }
  function glass(ctx, t, path, alpha, sx) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    // soft shadow cast from an off-screen copy
    ctx.save();
    const m = ctx.getTransform();
    ctx.shadowColor = 'rgba(16,58,60,0.2)';
    ctx.shadowBlur = 42;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 18 + 10000 * m.d;
    ctx.translate(0, -10000);
    ctx.fillStyle = '#000';
    ctx.fill(path);
    ctx.restore();
    // frosted backdrop
    ctx.save();
    ctx.clip(path);
    glassBg(ctx, t, 26);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill(path);
    const top = ctx.createLinearGradient(0, 0, 0, 10);
    top.addColorStop(0, 'rgba(255,255,255,0.42)');
    top.addColorStop(0.55, 'rgba(255,255,255,0)');
    ctx.fillStyle = top;
    ctx.fill(path);
    const rim = ctx.createLinearGradient(0, 0, 19, 10);
    rim.addColorStop(0, 'rgba(255,255,255,0.95)');
    rim.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    rim.addColorStop(1, 'rgba(255,255,255,0.7)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.6 / sx;
    ctx.stroke(path);
    ctx.restore();
  }
  function glassScene(ctx, t) {
    const L = layout();
    glassBg(ctx, t);
    const g = E.glide(seg(t, 2.05, 3.05));
    const s = L.S * lerp(1.22, 1, g), cx = lerp(W / 2, L.ex, g), cy = H / 2;
    const form = spring(t - 0.18, 0.9, 0.88);
    const split = E.inOut(seg(t, 1.0, 1.62));
    const flood = E.inOut(seg(t, 1.25, 2.15));
    const glassOut = 1 - E.inOut(seg(t, 2.15, 2.7));
    ctx.save();
    // the whole emblem breathes in from slightly smaller and soft
    const k = lerp(0.9, 1, form);
    ctx.setTransform(s * k, 0, 0, s * k, cx - s * k * EC.x, cy - s * k * EC.y);
    const blur = 10 * (1 - E.out(seg(t, 0.18, 0.9)));
    if (split <= 0) {
      const pill = toPath([stadium(0.5, 0.7178, 18.5, 8.7178)]);
      ctx.save();
      if (blur > 0.15) ctx.filter = `blur(${blur}px)`;
      glass(ctx, t, pill, E.outCubic(seg(t, 0.18, 0.7)), s * k);
      ctx.restore();
    } else {
      // the pill cracks along the cross; the leaves part and the star opens
      const leaves = new Path2D();
      const polys = KEYS.map(key => {
        const d = LEAF[key].dir;
        return leaf(key, { rIn: 4 * split, dx: -d[0] * 0.5 * (1 - split), dy: -d[1] * 0.5 * (1 - split) });
      });
      for (const poly of polys) leaves.addPath(toPath([poly]));
      if (glassOut > 0) glass(ctx, t, leaves, glassOut, s * k);
      // teal floods out from the centre, feathered
      if (flood > 0) {
        ctx.save();
        ctx.clip(leaves);
        const R = 13.5 * flood;
        const fg = ctx.createRadialGradient(EC.x, EC.y, Math.max(0, R - 2.2), EC.x, EC.y, R + 0.001);
        fg.addColorStop(0, 'rgba(44,125,129,1)');
        fg.addColorStop(1, 'rgba(44,125,129,0)');
        ctx.fillStyle = flood >= 1 ? TEAL : fg;
        if (flood < 1) {
          ctx.fillRect(-1, -1, 21, 12);
          ctx.beginPath();
          ctx.arc(EC.x, EC.y, Math.max(0, R - 2.2), 0, TAU);
          ctx.fillStyle = TEAL;
          ctx.fill();
        } else ctx.fill(leaves);
        ctx.restore();
      }
      // a glint runs down the crack as it opens
      const crack = bump(t - 0.98, 0.5);
      if (crack > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * crack})`;
        ctx.lineWidth = 1.2 / (s * k);
        ctx.beginPath();
        ctx.moveTo(0.5, DOT.y); ctx.lineTo(18.5, DOT.y);
        ctx.moveTo(EC.x, 0.7); ctx.lineTo(EC.x, 8.7);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
    // a droplet settles into the centre and becomes the dot
    const du = t - 1.42;
    if (du > 0) {
      const drop = spring(du, 0.62, 0.64), gloss = 1 - E.inOut(seg(t, 2.1, 2.7));
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, cx, cy + s * -3.6 * (1 - drop));
      const ds = s * lerp(0.55, 1, clamp(drop * 1.2));
      ctx.scale(ds, ds);
      ctx.translate(-DOT.x, -DOT.y);
      ctx.globalAlpha = clamp(du / 0.12);
      ctx.shadowColor = `rgba(16,58,60,${0.25 * gloss})`;
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = TEAL;
      ctx.fill(DOT_PATH);
      ctx.shadowColor = 'transparent';
      if (gloss > 0) {
        const hl = ctx.createRadialGradient(DOT.x - 0.5, DOT.y - 0.55, 0, DOT.x - 0.5, DOT.y - 0.55, 1.1);
        hl.addColorStop(0, `rgba(255,255,255,${0.75 * gloss})`);
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl;
        ctx.fill(DOT_PATH);
      }
      ctx.restore();
    }
    // the name comes out of the frost
    letters(ctx, L, i => {
      const u = t - (2.2 + 0.045 * i);
      if (u <= 0) return null;
      const p = E.out(seg(u, 0, 0.8));
      return { a: E.outCubic(seg(u, 0, 0.5)), blur: 16 * (1 - p), scale: lerp(1.05, 1, p) };
    });
    dither(ctx, 0.06);
  }

  // ════════════════════════════════════ 5 · CONVERGE (reversed, 3D) ══
  // Scattered data brought into one ordered place. White on the brand
  // teal: the leaves glide in from depth with real
  // perspective and depth-of-field, the dot arrives from the front, the
  // plane settles square to camera, and the name slides out from behind.
  function project(pts, xf) {
    // xf: piece centre pc, offset (ox, oy, oz), rotations rx, ry about pc,
    // then a global ry about the emblem centre; perspective with distance D
    const out = [];
    const { pc, ox, oy, oz, rx, ry, gry, D, s, cx, cy } = xf;
    const cX = Math.cos(rx), sX = Math.sin(rx), cY = Math.cos(ry), sY = Math.sin(ry), cG = Math.cos(gry), sG = Math.sin(gry);
    for (const [x, y] of pts) {
      let X = x - pc[0], Y = y - pc[1], Z = 0;
      let Y1 = Y * cX - Z * sX, Z1 = Y * sX + Z * cX;               // rx
      let X2 = X * cY + Z1 * sY, Z2 = -X * sY + Z1 * cY;             // ry
      X2 += pc[0] - EC.x + ox; Y1 += pc[1] - EC.y + oy; Z2 += oz;
      const X3 = X2 * cG + Z2 * sG, Z3 = -X2 * sG + Z2 * cG;         // global ry
      const f = (s * D) / (D + Z3);
      out.push([cx + X3 * f, cy + Y1 * f]);
    }
    return out;
  }
  function converge(ctx, t) {
    const L = layout();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // a smoothstep from #34898D at the centre to #246B6E in the corners, so
    // the vignette has no ring where a linear ramp would stop
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
    for (let k = 0; k <= 8; k++) {
      const x = k / 8, m = x * x * (3 - 2 * x);
      bg.addColorStop(x, `rgb(${lerp(52, 36, m)},${lerp(137, 107, m)},${lerp(141, 110, m)})`);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const g = E.glide(seg(t, 1.8, 2.8));
    const s = L.S * lerp(1.18, 1, g), cx = lerp(W / 2, L.ex, g), cy = H / 2;
    const gry = 18 * DEG * (1 - E.inOut(seg(t, 0.2, 1.75)));
    const order = { TL: 0, BR: 1, TR: 2, BL: 3 };
    const shadow = (a, depth) => {
      ctx.shadowColor = `rgba(6,40,42,${0.3 * a})`;
      ctx.shadowBlur = 24 + depth * 0.6;
      ctx.shadowOffsetY = 12 + depth * 0.25;
    };
    for (const k of KEYS) {
      const u = t - (0.22 + 0.085 * order[k]);
      if (u <= 0) continue;
      const q = spring(u, 1.1, 0.9), a = E.outCubic(seg(u, 0, 0.55));
      const p = LEAF[k], d = p.dir;
      const xf = {
        pc: [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2],
        ox: d[0] * 7 * (1 - q), oy: d[1] * 4.5 * (1 - q), oz: 40 * (1 - q),
        rx: -d[1] * 24 * DEG * (1 - q), ry: d[0] * 30 * DEG * (1 - q), gry, D: 70, s, cx, cy,
      };
      const depth = Math.abs(xf.oz);
      ctx.save();
      ctx.globalAlpha = a;
      const blur = depth * 0.3;
      if (blur > 0.2) ctx.filter = `blur(${blur}px)`;
      shadow(a, depth);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill(toPath([project(LEAF_POLY[k], xf)]));
      ctx.restore();
    }
    // the dot arrives from in front of the plane
    const du = t - 0.98;
    if (du > 0) {
      const q = spring(du, 0.85, 0.8), oz = -26 * (1 - q);
      const xf = { pc: [DOT.x, DOT.y], ox: 0, oy: 0, oz, rx: 0, ry: 0, gry, D: 70, s, cx, cy };
      ctx.save();
      ctx.globalAlpha = E.outCubic(seg(du, 0, 0.35));
      const blur = Math.abs(oz) * 0.45;
      if (blur > 0.2) ctx.filter = `blur(${blur}px)`;
      shadow(1, Math.abs(oz));
      ctx.fillStyle = '#FFFFFF';
      ctx.fill(toPath([project(DOT_POLY, xf)]));
      ctx.restore();
    }
    // the name slides out from behind the emblem's right edge
    const slide = E.glide(seg(t, 1.86, 2.9));
    if (slide > 0) {
      ctx.save();
      const edge = cx + s * (19.35 - EC.x);
      ctx.beginPath();
      ctx.rect(edge, 0, W - edge, H);
      ctx.clip();
      ctx.shadowColor = 'rgba(6,40,42,0.26)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 10;
      letters(ctx, L, () => ({ dx: -10 * (1 - slide), a: 1 }), '#FFFFFF');
      ctx.restore();
    }
    dither(ctx, 0.05);
  }

  const SCENES = { 1: safeguard, 2: redact, 3: construct, 4: glassScene, 5: converge };
  const NAMES = { 1: 'Safeguard', 2: 'Redact', 3: 'Construct', 4: 'Privacy Glass', 5: 'Converge' };

  function renderFrame(ctx, t, opt = {}) {
    const n = opt.samples ?? 12, scene = SCENES[OPT];
    ctx.save();
    if (n <= 1) scene(ctx, t);
    else {
      const sub = buf('sub'), sc = sub.getContext('2d');
      for (let k = 0; k < n; k++) {
        sc.save();
        scene(sc, t + ((k + 0.5) / n - 0.5) * (SHUTTER / FPS));
        sc.restore();
        ctx.globalAlpha = 1 / (k + 1);
        ctx.drawImage(sub, 0, 0);
      }
      ctx.globalAlpha = 1;
    }
    if (OPT === 1) grain(ctx, 3);             // once per frame, after the blur
    ctx.restore();
  }

  root.Darta = { FPS, DURATION, NAMES, setup, renderFrame, get option() { return OPT; } };
})(typeof window !== 'undefined' ? window : globalThis);
