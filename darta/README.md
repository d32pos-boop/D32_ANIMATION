# Darta: Logo Motion

Five 5-second logo animations for the Darta mark (`../Frame 1 (6).svg`). Darta is a compliance tool for personal-data (PII) law, so each direction shows one thing the product does for data: it protects it, redacts it, puts rules around it, keeps it transparent, or brings it into order. The motion stays calm throughout. It uses well-damped springs (only the centre dot is allowed a small settle), real focus blur and a 180° motion-blur shutter.

Each option renders at 1920×1080, 60 fps, with sound:

| # | File | Background | What happens | What it says |
| --- | --- | --- | --- | --- |
| 1 | [`Darta_1_Safeguard.mp4`](../Darta_1_Safeguard.mp4) | Near-black | A point of light appears. The four leaves close around it like a vault, and the light stays inside, glowing through the star-shaped gaps. | Integrity and confidentiality: the data is sealed in (GDPR Art. 5(1)(f)). |
| 2 | [`Darta_2_Redact.mp4`](../Darta_2_Redact.mp4) | White | Marker strokes redact two lines of text. The bars reshape into the leaves and the dot sets in the centre. A last bar over the name lifts away to reveal "Darta". | Data minimisation: remove what isn't needed (Art. 5(1)(c)). |
| 3 | [`Darta_3_Construct.mp4`](../Darta_3_Construct.mp4) | Light grey | Construction circles and guides draw the geometry. Teal outlines follow them, the shapes fill from the rim, and the letters are penned, then filled. | Data protection by design: the rules come first (Art. 25). |
| 4 | [`Darta_4_Privacy_Glass.mp4`](../Darta_4_Privacy_Glass.mp4) | Luminous | A frosted-glass pill forms and splits cleanly into the four leaves. Colour floods in, the glass clears, and a droplet settles as the dot. | Transparency: private, yet clear (Art. 12). |
| 5 | [`Darta_5_Converge.mp4`](../Darta_5_Converge.mp4) | Teal | The four leaves arrive from depth in 3D and lock together. The dot comes forward into place, and the name slides out from behind the emblem. | Records of processing: scattered data, brought into one ordered place (Art. 30). |

Every option has the full logo in place by about 3 seconds and then holds, so each can be trimmed or held longer. Safeguard adds one slow light pass across the lockup at 3.4 seconds.

## Sound

All five scores are in D major, so whichever option is chosen, the brand keeps one sonic identity. None of them uses an impact. They use air swells, soft bells, a warm pad, and one sound specific to the story: felt-tip marker strokes for Redact, compass plucks and ruler ticks for Construct, glass and a droplet for Privacy Glass. Every cue reads the same timings as the picture.

The five are matched by loudness, not by peak, so no option sounds better just because it is louder. Each is measured with BS.1770 K-weighting and gating to −16 LUFS integrated, with peaks held under −1.5 dBFS.

## Rendering

```sh
node ../showreel/render.mjs --root . --query opt=3 --samples 16 --out ../Darta_3_Construct.mp4
node ../showreel/render.mjs --root . --query opt=3 --size 1080x1920 --out ../Darta_3_Construct_Vertical.mp4
```

Open `index.html?opt=1` … `?opt=5` in a browser for a live preview. Click to play it with sound.

Source:
- `darta.js`: the five scenes. The leaves are rebuilt as parametric rounded rectangles that match the SVG exactly at rest. The wordmark uses the SVG's own letter paths.
- `darta-audio.js`: the scores.
- `index.html`: the page `render.mjs` captures.
