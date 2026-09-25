# D32 — Motion Reel

An 18-second, 1920×1080 / 60 fps motion piece for the D32 mark, with a synthesised soundtrack. The render is [`../D32_Motion_Reel.mp4`](../D32_Motion_Reel.mp4).

## The idea

The mark is a flat drawing of a 3D object. Three 30-unit cells sit on a 15-unit module grid, and the "2" cell is pushed one cube-depth toward the viewer in 45° oblique projection. The light shape in the logo is that cube's side faces. The reel rebuilds the mark as real geometry: cubes set into a wall of 15-unit pins. Every shot comes from that system.

| Time | Chapter | What happens |
| --- | --- | --- |
| 0–2s | 01 Countdown | Film-leader countdown. One tile slams in, its slits cut a **3**, slide into a **2**, then collapse into the **D**. |
| 2–4s | 02 Assemble | 45° wipe. The 3 and 2 cubes piston in from the viewer, the wall ripples, and focus locks on the 75×75 artboard. |
| 4–6s | 03 Construct | Blueprint pass: module grid, 45° push lines, dimensions, slit callout, palette. |
| 6–10s | 04 Dimension | Orbiting camera. The cubes play like keys over a rippling pin wall, then lock back into the flat mark. |
| 10–12s | 05 System | The mark blooms across the wall as a pattern, a wave rolls through, and the field launches away. |
| 12–18s | 06 Resolve | Snare-roll build, a silent gap, the final hit, then an iris into the icon on lavender. |

## How it's made

- `engine.js` is a deterministic 2.5D renderer. Each frame is a pure function of time. It has:
  - a parallel projection that blends the logo's own oblique projection with a true orbit
  - painter's-order height-field rendering
  - motion blur from sub-frames averaged over a 180° shutter
  - chromatic aberration, shake and HUD
- `audio.js` holds the soundtrack: drums, bass, pads, plucks and sound design, synthesised with an `OfflineAudioContext` and read from the same cue list as the picture, so every hit lands on its frame. It runs at 120 BPM in A minor.
- `render.mjs` drives headless Chromium frame by frame and pipes lossless PNGs to ffmpeg (H.264, BT.709 tagged so the brand colours hold).

## Render it

Requirements:
- Node 18+
- Playwright with Chromium
- an ffmpeg build with `libx264`

```sh
node showreel/render.mjs --ffmpeg /path/to/ffmpeg                  # full render
node showreel/render.mjs --stills 3.2,7.6,16.5 --out /tmp/stills   # frames to check
node showreel/render.mjs --from 6 --to 10 --out /tmp/clip.mp4      # a section
```

Options: `--samples 16` (motion-blur samples), `--workers 4`, `--crf 16`, `--no-audio`.

## Preview live

Serve this folder, for example with `npx serve showreel`, and open `index.html`. Click to play with sound, press space to pause, and use ← / → to scrub a frame at a time (hold shift to move 15 frames).

Fonts: JetBrains Mono and Space Grotesk, under the SIL Open Font License (see `fonts/`).
