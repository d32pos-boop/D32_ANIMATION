/* ============================================================================
 *  FILE CABINET · cabinet.js
 *
 *  An interactive drawer of hanging files for a landing page. Click a folder
 *  and it springs up out of the drawer, its papers slide out above it, and the
 *  folders around it lean away to make room. Hover lifts a folder, the drawer
 *  drifts with the mouse, and a soft paper sound plays on open and close.
 *
 *  Usage:
 *    <div id="cabinet"></div>
 *    <script src="cabinet.js"></script>
 *    <script>Cabinet.mount(document.getElementById('cabinet'), { label: "sam's secret files" });</script>
 *
 *  Pass `rows` to use your own folders (see DEFAULT_ROWS for the format). A
 *  folder with an `href` shows an "Open file" link when it is up.
 * ========================================================================== */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  // Back to front. f = folder (tab: l / c / r), d = divider (black tab).
  const DEFAULT_ROWS = [
    { n: 94, name: 'oil lamp', tab: 'c' }, { n: 95, name: 'oats', tab: 'r' },
    { letter: 'O', count: '010', x: 98 },
    { n: 96, name: 'pants', tab: 'c' }, { n: 97, name: 'plane', tab: 'r' },
    { n: 98, name: 'plant 003', tab: 'c' }, { n: 99, name: 'pomelo', tab: 'r' },
    { n: 100, name: 'phisher', tab: 'c' }, { n: 101, name: 'palo alto', tab: 'r' },
    { n: 102, name: 'pencile', tab: 'c' }, { n: 103, name: 'photos', tab: 'r' },
    { n: 104, name: 'quiet', tab: 'l' },
    { letter: 'P', count: '012', x: 332 },
    { n: 105, name: 'queen', tab: 'r' }, { n: 106, name: 'questions', tab: 'c' },
    { n: 107, name: 'quizz', tab: 'r' }, { n: 108, name: 'quit', tab: 'c' },
    { letter: 'Q', count: '005', x: 516 },
    { n: 109, name: 'raccoon', tab: 'c' }, { n: 111, name: 'rizz', tab: 'r' },
    { n: 112, name: 'rum', tab: 'l' },
    { n: 113, name: 'generic guy', tab: 'r' }, { n: 114, name: 'rain', tab: 'c' },
    { n: 115, name: 'rug', tab: 'r' },
    { letter: 'R', count: '002', x: 157 },
    { n: 116, name: 'ruby', tab: 'c' }, { n: 117, name: 'sider', tab: 'r' },
    { n: 118, name: 'sony', tab: 'c' }, { n: 119, name: 'sun', tab: 'r' },
    { n: 120, name: 'seller', tab: 'c' }, { n: 121, name: 'sims', tab: 'r' },
    { n: 122, name: 'slides', tab: 'c' }, { n: 123, name: 'simpsons', tab: 'r' },
    { n: 124, name: 'sir', tab: 'c' },
    { letter: 'S', count: '002', x: 35 },
  ];
  const TABS = { l: [80, 285], c: [300, 555], r: [545, 765] };

  // stage geometry (a 1080-wide drawing, like the artwork)
  const W = 1080, TOP = 200, H = 1080 + TOP;   // TOP leaves room for folders to rise
  const FW = 840;                              // folder width at the front
  const BODY = 780;                            // folder body depth (hidden in the drawer)
  const LIFT = 205;                            // how far an opened folder rises
  const HOVER = 11;

  const css = `
  .cab { position: relative; width: 100%; aspect-ratio: ${W} / ${H}; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
  .cab svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; display: block; }
  .cab .row { cursor: pointer; outline: none; }
  .cab .body { fill: var(--cab-bg, #DEDEDE); stroke: var(--cab-ink, #111); stroke-width: 1.5; stroke-linejoin: round; }
  .cab .row.focus .body { stroke-width: 2.5; }
  .cab .tabtext { font: 400 18px/1 var(--cab-font); fill: var(--cab-ink, #111); }
  .cab .divtab { fill: var(--cab-ink, #111); }
  .cab .divtext { font: 400 18px/1 var(--cab-font); fill: var(--cab-bg, #DEDEDE); }
  .cab .face-name { font: 500 46px/1 var(--cab-font); fill: var(--cab-ink, #111); letter-spacing: -.02em; }
  .cab .face-meta { font: 500 13px/1 var(--cab-mono); fill: #555; letter-spacing: .08em; }
  .cab .pill { fill: none; stroke: var(--cab-ink, #111); stroke-width: 1.5; }
  .cab .pill-text { font: 500 16px/1 var(--cab-font); fill: var(--cab-ink, #111); }
  .cab .link:hover .pill { fill: var(--cab-yellow, #F6F07A); }
  .cab .sheet { fill: #FBFBF8; stroke: var(--cab-ink, #111); stroke-width: 1.3; }
  .cab .sheet-no { font: 500 11px/1 var(--cab-mono); fill: #666; letter-spacing: .1em; }
  .cab .sheet-title { font: 500 19px/1 var(--cab-font); fill: var(--cab-ink, #111); }
  .cab .bar { fill: #CFCFCB; }
  .cab .redact { fill: var(--cab-ink, #111); }
  .cab .note { fill: var(--cab-yellow, #F6F07A); stroke: var(--cab-ink, #111); stroke-width: 1.2; }
  .cab .note-text { font: 400 26px/1 var(--cab-hand); fill: var(--cab-ink, #111); }
  .cab .front { fill: var(--cab-bg, #DEDEDE); stroke: var(--cab-ink, #111); stroke-width: 1.5; stroke-linejoin: round; }
  .cab .label { cursor: pointer; }
  .cab .label rect { fill: var(--cab-yellow, #F6F07A); stroke: var(--cab-ink, #111); stroke-width: 1.5; }
  .cab .label text { font: 400 19px/1 var(--cab-font); fill: var(--cab-ink, #111); }
  .cab .hint { font: 400 15px/1 var(--cab-mono); fill: #777; letter-spacing: .06em; }
  .cab .sound { position: absolute; right: 1.5%; bottom: 1.5%; font: 500 12px/1 var(--cab-mono); letter-spacing: .06em;
    color: var(--cab-ink, #111); background: transparent; border: 1px solid currentColor; border-radius: 999px; padding: 6px 10px; cursor: pointer; opacity: .55; }
  .cab .sound:hover, .cab .sound:focus-visible { opacity: 1; }
  `;

  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const text = (str, attrs, parent) => { const t = el('text', attrs, parent); t.textContent = str; return t; };
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // a folder: rounded body with a tab whose sides slope in an S-curve
  function folderPath(a, b) {
    return `M0,${BODY} V48 Q0,38 10,38 H${a} C${a + 12},38 ${a + 8},0 ${a + 22},0 H${b - 22} C${b - 8},0 ${b - 12},38 ${b},38 H${FW - 10} Q${FW},38 ${FW},48 V${BODY} Z`;
  }
  function tabPath(a, b) {
    return `M${a},38 C${a + 12},38 ${a + 8},0 ${a + 22},0 H${b - 22} C${b - 8},0 ${b - 12},38 ${b},38 Z`;
  }

  // critically-ish damped spring: a little overshoot, settles fast
  function Spring(k = 210, c = 21) { return { x: 0, v: 0, to: 0, k, c }; }
  function step(s, dt) {
    const n = Math.ceil(dt / 0.004), h = dt / n;
    for (let i = 0; i < n; i++) { s.v += (s.k * (s.to - s.x) - s.c * s.v) * h; s.x += s.v * h; }
    return Math.abs(s.v) > 0.01 || Math.abs(s.to - s.x) > 0.01;
  }

  // ── sound: filtered noise, like a folder dragged against its neighbours ──
  function Sound() {
    let ac = null, noise = null, on = true;
    const ensure = () => {
      if (ac) return ac;
      const C = root.AudioContext || root.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noise.getChannelData(0); const R = rng(3);
      for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
      return ac;
    };
    function swish(dur, f0, f1, v, delay = 0) {
      if (!on || !ensure()) return;
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime + delay;
      const s = ac.createBufferSource(); s.buffer = noise;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bp).connect(g).connect(ac.destination);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    }
    function tap(v = 0.12, f = 180, delay = 0) {
      if (!on || !ensure()) return;
      const t = ac.currentTime + delay;
      const o = ac.createOscillator(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.08);
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.15);
    }
    return {
      open() { swish(0.22, 1400, 3600, 0.22); swish(0.16, 3000, 5200, 0.08, 0.12); swish(0.14, 3200, 5600, 0.06, 0.2); },
      close() { swish(0.16, 3200, 1200, 0.16); tap(0.14, 150, 0.12); },
      riffle(i) { swish(0.05, 2400 + i * 40, 3800, 0.05, 0); },
      get on() { return on; }, set on(v) { on = v; },
    };
  }

  function mount(host, opts = {}) {
    const rows = opts.rows || DEFAULT_ROWS;
    const reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.getElementById('cab-style')) {
      const st = document.createElement('style'); st.id = 'cab-style'; st.textContent = css; document.head.appendChild(st);
    }
    host.classList.add('cab');
    host.style.setProperty('--cab-font', opts.font || '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif');
    host.style.setProperty('--cab-mono', opts.mono || '"IBM Plex Mono", ui-monospace, Menlo, monospace');
    host.style.setProperty('--cab-hand', opts.hand || '"Caveat", "Comic Sans MS", cursive');
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': opts.label || 'File cabinet' }, host);
    const sound = Sound();

    const hint = text(opts.hint || 'pick a file — any file', { class: 'hint', x: W / 2, y: TOP - 40, 'text-anchor': 'middle' }, svg);
    const stack = el('g', {}, svg);

    const N = rows.length;
    const R = [];
    rows.forEach((row, i) => {
      const t = i / (N - 1);
      const r = {
        i, row, t, s: 0.862 + 0.138 * t, y: TOP + 133 + i * 19.6,
        lift: Spring(), hover: Spring(260, 24), room: Spring(170, 20), intro: Spring(150, 14),
        sheets: [], open: false,
      };
      const g = el('g', { class: 'row', tabindex: 0, role: 'button' }, stack);
      r.g = g;
      const divider = !!row.letter;
      const [a, b] = divider ? [row.x, row.x + 175] : TABS[row.tab];
      g.setAttribute('aria-label', divider ? `Section ${row.letter}` : `File ${row.n}, ${row.name}`);
      g.setAttribute('aria-expanded', 'false');

      // papers live inside the folder: drawn first, so the body hides them until they rise
      const papers = el('g', {}, g);
      if (!divider) {
        const rnd = rng(row.n * 7919);
        const count = 3;
        for (let k = 0; k < count; k++) {
          const sx = 150 + k * 205 + (rnd() - 0.5) * 30, rot = (rnd() - 0.5) * 6;
          const sg = el('g', {}, papers);
          const inner = el('g', { transform: `rotate(${rot.toFixed(2)} 120 150)` }, sg);
          el('rect', { class: 'sheet', x: 0, y: 0, width: 240, height: 300, rx: 3 }, inner);
          text(`NO. ${row.n}-${k + 1}`, { class: 'sheet-no', x: 18, y: 28 }, inner);
          text(k === 0 ? row.name : ['notes', 'evidence', 'misc.', 'receipts', 'drafts'][Math.floor(rnd() * 5)], { class: 'sheet-title', x: 18, y: 56 }, inner);
          for (let l = 0; l < 7; l++) {
            const w = 140 + rnd() * 70, y = 80 + l * 17;
            el('rect', { class: rnd() < 0.18 ? 'redact' : 'bar', x: 18, y, width: w.toFixed(0), height: 7, rx: 1.5 }, inner);
          }
          if (k === count - 1) {            // on the top sheet, so nothing covers it
            const ng = el('g', { transform: `translate(148 -16) rotate(${(4 + rnd() * 4).toFixed(1)})` }, inner);
            el('rect', { class: 'note', x: 0, y: 0, width: 78, height: 72, rx: 2 }, ng);
            text(['shh.', 'burn', 'later', 'no!!', 'hmm'][Math.floor(rnd() * 5)], { class: 'note-text', x: 12, y: 44 }, ng);
          }
          const sp = Spring(170, 17);
          sp.x = sp.to = 0;
          r.sheets.push({ g: sg, sx, sp });
        }
      }
      el('path', { class: 'body', d: folderPath(a, b), 'vector-effect': 'non-scaling-stroke' }, g);
      if (divider) {
        el('path', { class: 'divtab', d: tabPath(a, b) }, g);
        text(row.letter, { class: 'divtext', x: a + 34, y: 26 }, g);
        text(row.count, { class: 'divtext', x: b - 30, y: 26, 'text-anchor': 'end' }, g);
      } else {
        text(String(row.n), { class: 'tabtext', x: a + 32, y: 26 }, g);
        text(row.name, { class: 'tabtext', x: b - 28, y: 26, 'text-anchor': 'end' }, g);
        // the face you see once the folder is up
        const face = el('g', { opacity: 0 }, g);
        text(row.name, { class: 'face-name', x: 40, y: 106 }, face);
        const sec = (row.name[0] || '').toUpperCase();
        text(`FILE NO. ${row.n}  ·  SECTION ${sec}  ·  3 DOCS`, { class: 'face-meta', x: 42, y: 136 }, face);
        const link = el(row.href ? 'a' : 'g', row.href ? { href: row.href, class: 'link' } : { class: 'link' }, face);
        el('rect', { class: 'pill', x: 640, y: 72, width: 160, height: 42, rx: 21 }, link);
        text(row.href ? 'Open file ↗' : 'Put back  ↓', { class: 'pill-text', x: 720, y: 99, 'text-anchor': 'middle' }, link);
        r.face = face;
      }
      r.papers = papers;
      R.push(r);
    });

    // the drawer front sits on top of everything
    const front = el('g', {}, svg);
    el('path', { class: 'front', d: `M47,${TOP + 922} H1033 V${TOP + 940} H47 Z M47,${TOP + 940} L75,${H + 20} H1005 L1033,${TOP + 940}`, 'vector-effect': 'non-scaling-stroke' }, front);
    el('path', { class: 'front', d: `M47,${TOP + 940} L75,${H + 20} M1033,${TOP + 940} L1005,${H + 20}`, fill: 'none' }, front);
    const label = el('g', { class: 'label', tabindex: 0, role: 'button', 'aria-label': 'Riffle the files' }, front);
    const lw = Math.max(190, (opts.label || "sam's secret files").length * 10.2 + 30);
    el('rect', { x: W / 2 - lw / 2, y: TOP + 975, width: lw, height: 37, rx: 8 }, label);
    text(opts.label || "sam's secret files", { x: W / 2, y: TOP + 1000, 'text-anchor': 'middle' }, label);
    const frontSpring = Spring(200, 22);

    const btn = document.createElement('button');
    btn.className = 'sound'; btn.type = 'button';
    const setBtn = () => { btn.textContent = sound.on ? 'SOUND ON' : 'SOUND OFF'; btn.setAttribute('aria-pressed', String(sound.on)); };
    setBtn();
    btn.addEventListener('click', () => { sound.on = !sound.on; setBtn(); });
    if (opts.sound === false) { sound.on = false; setBtn(); }
    if (opts.soundButton !== false) host.appendChild(btn);

    // ── state ──
    let openRow = null, mx = 0, mxS = Spring(60, 14), running = false, last = 0, touched = false;
    const hintS = Spring(120, 20); hintS.x = hintS.to = 1;

    function setRoom() {
      R.forEach(r => {
        if (!openRow) { r.room.to = 0; return; }
        const d = r.i - openRow.i;
        r.room.to = d > 0 ? 9 * Math.exp(-(d - 1) / 2.5) : d < 0 ? -5 * Math.exp((d + 1) / 2.5) : 0;
      });
    }
    function open(r) {
      if (openRow === r) { close(); return; }
      if (openRow) shut(openRow, true);
      openRow = r; r.open = true;
      r.lift.to = LIFT;
      r.g.setAttribute('aria-expanded', 'true');
      r.sheets.forEach((sh, k) => setTimeout(() => { if (r.open) sh.sp.to = -(200 + [10, 26, 4][k % 3]); }, 110 + k * 70));
      if (!touched) { touched = true; hintS.to = 0; }
      setRoom(); sound.open(); kick();
    }
    function shut(r, quiet) {
      r.open = false; r.lift.to = 0;
      r.g.setAttribute('aria-expanded', 'false');
      r.sheets.forEach(sh => { sh.sp.to = 0; });
      if (!quiet) sound.close();
    }
    function close() { if (!openRow) return; shut(openRow); openRow = null; setRoom(); kick(); }

    R.forEach(r => {
      r.g.addEventListener('click', e => {
        if (e.target.closest && e.target.closest('a')) return;      // let real links navigate
        e.stopPropagation(); open(r);
      });
      r.g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(r); } });
      r.g.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { r.hover.to = HOVER; kick(); } });
      r.g.addEventListener('pointerleave', () => { r.hover.to = 0; kick(); });
      r.g.addEventListener('focus', () => {
        if (!r.g.matches(':focus-visible')) return;              // keyboard focus only
        r.g.classList.add('focus'); r.hover.to = HOVER; kick();
      });
      r.g.addEventListener('blur', () => { r.g.classList.remove('focus'); r.hover.to = 0; kick(); });
    });
    svg.addEventListener('click', () => close());
    host.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    host.addEventListener('pointermove', e => {
      const b = host.getBoundingClientRect();
      mxS.to = ((e.clientX - b.left) / b.width - 0.5) * 2; kick();
    });
    host.addEventListener('pointerleave', () => { mxS.to = 0; kick(); });

    // riffle: a wave through the drawer, back to front (intro, and the label)
    function riffle(delay0 = 0) {
      R.forEach((r, k) => setTimeout(() => {
        r.intro.v = -260 - 40 * Math.random();
        if (k % 3 === 0) sound.riffle(k);
        kick();
      }, delay0 + k * 22));
      frontSpring.v = 40; kick();
    }
    label.addEventListener('click', e => { e.stopPropagation(); close(); riffle(); });
    label.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(); riffle(); } });

    function render() {
      const p = mxS.x;
      R.forEach(r => {
        const dy = -(r.lift.x + r.hover.x) + r.room.x + r.intro.x;
        const px = p * (r.s - 0.86) / 0.14 * 9;
        r.g.setAttribute('transform', `translate(${(W / 2 - (FW / 2) * r.s + px).toFixed(2)} ${(r.y + dy).toFixed(2)}) scale(${r.s.toFixed(4)})`);
        r.sheets.forEach(sh => sh.g.setAttribute('transform', `translate(${sh.sx.toFixed(1)} ${(60 + sh.sp.x).toFixed(2)})`));
        if (r.face) r.face.setAttribute('opacity', Math.max(0, Math.min(1, r.lift.x / LIFT * 1.4 - 0.3)).toFixed(3));
      });
      front.setAttribute('transform', `translate(${(p * 12).toFixed(2)} ${frontSpring.x.toFixed(2)})`);
      hint.setAttribute('opacity', (0.9 * hintS.x).toFixed(3));
    }
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016); last = now;
      let busy = false;
      const springs = [mxS, frontSpring, hintS];
      R.forEach(r => { springs.push(r.lift, r.hover, r.room, r.intro); r.sheets.forEach(sh => springs.push(sh.sp)); });
      for (const s of springs) {
        if (reduced) { s.x = s.to; s.v = 0; } else if (step(s, dt)) busy = true;
      }
      render();
      if (busy) requestAnimationFrame(frame); else running = false;
    }
    function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }

    // intro: the drawer settles, then a riffle runs through the files
    if (!reduced && opts.intro !== false) {
      frontSpring.x = 30; R.forEach(r => { r.intro.x = 24; r.intro.v = 0; });
      setTimeout(() => riffle(0), 250);
    }
    render(); kick();

    return {
      open: n => { const r = R.find(r => r.row.n === n); if (r) open(r); },
      close, riffle: () => riffle(),
      setSound: v => { sound.on = !!v; setBtn(); },
    };
  }

  root.Cabinet = { mount, DEFAULT_ROWS };
})(window);
