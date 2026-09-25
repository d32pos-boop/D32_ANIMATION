#!/usr/bin/env node
// Renders the D32 motion pieces. Headless Chromium draws each frame (with
// sub-frame motion blur) and ffmpeg encodes the PNG stream plus the
// soundtrack, which is synthesised offline by the same page.
//
//   node render.mjs                         the reel → ../D32_Motion_Reel.mp4
//   node render.mjs --page sting.html --out ../D32_Logo_Sting.mp4
//   node render.mjs --page sting.html --size 1080x1920 --out ../D32_Logo_Sting_Vertical.mp4
//   node render.mjs --page mark.html --query words=1 --out ../D32_Hit_The_Mark.mp4
//   node render.mjs --stills 0.5,2.5 --out dir
//   node render.mjs --from 2 --to 4 --out clip.mp4
//
// Options: --page index.html  --size 1920x1080  --query k=v&k=v  --fps 60  --samples 12
//          --workers 4  --crf 16  --no-audio
//          --ffmpeg /path/to/ffmpeg   (or env FFMPEG; defaults to `ffmpeg`)
//
// A page is renderable when, opened with ?capture, it sets window.ready and
// provides window.DURATION, window.renderAt(t, samples) → PNG data URL and
// window.renderAudioWav() → base64 WAV.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const k = argv.indexOf(`--${name}`);
  return k < 0 ? def : argv[k + 1];
};
const flag = name => argv.includes(`--${name}`);
const fps = Number(opt('fps', 60));
const samples = Number(opt('samples', 12));
const nWorkers = Number(opt('workers', 4));
const crf = Number(opt('crf', 16));
const ffmpeg = opt('ffmpeg', process.env.FFMPEG || 'ffmpeg');
const stills = opt('stills', null);
const pageFile = opt('page', 'index.html');
const [width, height] = opt('size', '1920x1080').split('x').map(Number);
const query = opt('query', '');

// ── static server for the page and its fonts ──────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.join(here, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(here) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/${pageFile}?capture&w=${width}&h=${height}${query ? `&${query}` : ''}`;

const browser = await chromium.launch({
  args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text'],
});
async function worker() {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e));
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  await page.goto(url);
  await page.waitForFunction('window.ready === true');
  return page;
}
async function frame(page, t) {
  const data = await page.evaluate(([t, s]) => window.renderAt(t, s), [t, samples]);
  return Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
}

try {
  if (stills) {
    const out = opt('out', path.join(here, 'stills'));
    fs.mkdirSync(out, { recursive: true });
    const page = await worker();
    for (const s of stills.split(',').map(Number)) {
      const file = path.join(out, `t${s.toFixed(3).padStart(7, '0')}.png`);
      fs.writeFileSync(file, await frame(page, s));
      console.log(file);
    }
  } else {
    const duration = await (await worker()).evaluate(() => window.DURATION);
    const from = Number(opt('from', 0)), to = Number(opt('to', duration));
    const out = path.resolve(opt('out', path.join(here, '..', 'D32_Motion_Reel.mp4')));
    const pages = await Promise.all(Array.from({ length: nWorkers }, worker));

    let wav = null;
    if (!flag('no-audio')) {
      wav = `${out}.wav`;
      fs.writeFileSync(wav, Buffer.from(await pages[0].evaluate(() => window.renderAudioWav()), 'base64'));
    }
    const ff = spawn(ffmpeg, [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      ...(wav ? ['-ss', String(from), '-t', String(to - from), '-i', wav] : []),
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(crf),
      '-profile:v', 'high', '-g', String(fps * 2),
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      ...(wav ? ['-c:a', 'aac', '-b:a', '256k'] : []),
      '-movflags', '+faststart', out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });

    const N = Math.round((to - from) * fps);
    const pending = new Map();
    let next = 0, written = 0, flushing = false;
    const t0 = Date.now();
    const flush = async () => {
      if (flushing) return;
      flushing = true;
      while (pending.has(written)) {
        const b = pending.get(written);
        pending.delete(written);
        written++;
        if (!ff.stdin.write(b)) await once(ff.stdin, 'drain');
        if (written % 60 === 0 || written === N) {
          const el = (Date.now() - t0) / 1000;
          process.stdout.write(`\rframes ${written}/${N}  ${(written / el).toFixed(1)} fps  eta ${((N - written) / (written / el)).toFixed(0)}s   `);
        }
      }
      flushing = false;
    };
    await Promise.all(pages.map(async page => {
      for (let k = next++; k < N; k = next++) {
        pending.set(k, await frame(page, from + k / fps));
        await flush();
      }
    }));
    ff.stdin.end();
    const [code] = await once(ff, 'close');
    if (wav) fs.rmSync(wav);
    console.log(`\n${code === 0 ? 'wrote' : 'ffmpeg failed:'} ${out}`);
  }
} finally {
  await browser.close();
  server.close();
}
