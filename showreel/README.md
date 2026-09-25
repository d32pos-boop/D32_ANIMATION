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

## Logo sting

A 3-second intro/outro ident: [`../D32_Logo_Sting.mp4`](../D32_Logo_Sting.mp4) (1920×1080) and [`../D32_Logo_Sting_Vertical.mp4`](../D32_Logo_Sting_Vertical.mp4) (1080×1920), both 60 fps with sound. It plays on the lavender shape's double reading: it is an arrow, and it is the side of the "2" cube.

| Time | What happens |
| --- | --- |
| 0.00–0.36s | The arrow flies in tip-first and sticks, wobbling like it hit a target. |
| 0.40–0.47s | The D and 3 unfold out of its tip. Both tiles have a corner exactly there. |
| 0.60–0.80s | The 2 slams onto the arrow's open end, and the arrow turns out to be a cube. |
| 0.86–1.38s | A quick tilt shows it is really 3D, then it snaps back flat. |
| 1.0–3.0s | The wordmark and a glint down the arrow, then a hold. |

The logo is complete at 0.8s, so the sting can be trimmed anywhere after about 2s. The sound is a sonic logo. D, 3 and 2 are played as scale degrees 1, 3 and 2 of D major (D, F#, E), then resolve into a Dadd9 chord. The arrow's twang vibrates at the same 8.5 Hz as its wobble on screen.

Source: `sting.js`, `sting-audio.js`, `sting.html`.

## Hit the Mark

A 5-second ident built on three ideas, each one already present in the logo's geometry:

- [`../D32_Hit_The_Mark.mp4`](../D32_Hit_The_Mark.mp4) (1920×1080) and [`../D32_Hit_The_Mark_Vertical.mp4`](../D32_Hit_The_Mark_Vertical.mp4) (1080×1920) carry the captions "HIT THE MARK", "GROW" and "THINK OUTSIDE THE BOX".
- `…_Clean` versions of both skip the captions and go straight to the wordmark.

| Time | Idea | What happens |
| --- | --- | --- |
| 0.0–0.75s | Hit the mark | A square target draws onto the logo's grid. Its outer ring is the 2×2 box of cells and its crosshair the lines between them. The arrowhead flies in and sticks dead centre, at the one point where the D, 3 and 2 meet. |
| 1.0–1.75s | Growth | The logo is a scaled copy of itself anchored at the arrow's tip, so it grows out of the hit in steps. |
| 1.75–2.6s | Outside the box | At full size the D and 3 fill the box exactly. The 2 cube punches the box's corner off and lands outside it, then a tilt shows it standing out in 3D. |
| 3.0–5.0s | | Wordmark, glint, hold. |

The sound follows the same story: a scope locks on, then the arrow thwacks into the target. The growth climbs D, F#, A, D, one note per step. On the breakout the chord becomes Dadd9, whose E is the note outside the triad's box.

Source: `mark.js`, `mark-audio.js`, `mark.html` (`?words=1` for captions).

## How it's made

- `engine.js` is a deterministic 2.5D renderer. Each frame is a pure function of time. It has:
  - a parallel projection that blends the logo's own oblique projection with a true orbit
  - painter's-order height-field rendering
  - motion blur from sub-frames averaged over a 180° shutter
  - chromatic aberration, shake and HUD
- `audio.js` holds the soundtrack: drums, bass, pads, plucks and sound design, synthesised with an `OfflineAudioContext` and read from the same cue list as the picture, so every hit lands on its frame. It runs at 120 BPM in A minor.
- `render.mjs` drives headless Chromium frame by frame and pipes lossless PNGs to ffmpeg (H.264, BT.709 tagged so the brand colours hold). It renders any page that follows its capture protocol, at any size.

## Render it

Requirements:
- Node 18+
- Playwright with Chromium
- an ffmpeg build with `libx264`

```sh
node showreel/render.mjs --ffmpeg /path/to/ffmpeg                  # the reel
node showreel/render.mjs --page sting.html --out D32_Logo_Sting.mp4
node showreel/render.mjs --page sting.html --size 1080x1920 --out D32_Logo_Sting_Vertical.mp4
node showreel/render.mjs --page mark.html --query words=1 --out D32_Hit_The_Mark.mp4
node showreel/render.mjs --stills 3.2,7.6,16.5 --out /tmp/stills   # frames to check
node showreel/render.mjs --from 6 --to 10 --out /tmp/clip.mp4      # a section
```

Options: `--page index.html`, `--size 1920x1080`, `--query words=1`, `--samples 16` (motion-blur samples), `--workers 4`, `--crf 16`, `--no-audio`.

## Preview live

Serve this folder, for example with `npx serve showreel`, and open `index.html`. Click to play with sound, press space to pause, and use ← / → to scrub a frame at a time (hold shift to move 15 frames). `sting.html` and `mark.html` play the stings on click; add `?w=1080&h=1920` for the vertical cut and, on `mark.html`, `?words=1` for the captions.

Fonts: JetBrains Mono and Space Grotesk, under the SIL Open Font License (see `fonts/`).
