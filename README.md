# 03 — Ice Phoenix

A feathered 3D phoenix built from ~140 individually posed feather meshes (Three.js r149, bundled in `assets/`, works offline from `file://`).

## What's in it
- **Wings:** a real arm skeleton (shoulder → elbow → wrist → hand) drives 10 primaries, 9 secondaries and 3 rows of coverts per wing. Each feather bends against the flap velocity and flutters on its own phase, so motion travels outward along the wing.
- **Ice feather shader:** blue-white-violet gradient, central shaft, barbs, fresnel rim, glowing edges and twinkling frost glints.
- **Tail:** 7 long ribbon feathers simulated with verlet physics (lag, sway, swing wide on turns).
- **Body:** layered torso/chest/neck/head, plumage, 5-feather crest, golden ice beak, glowing eyes, rotating ice gem on the breast.
- **Ice crystals:** instanced faceted shards shed from the tail and burst out on a frost nova. Sparkle particles shed from the wings.
- **Bloom:** self-contained 8-bit bloom pipeline (no extra libraries, works on any GPU).

## Run
Open `index.html`. **Click** = frost nova + power wingbeat. **F** / double-click = fullscreen.
Optional: `?scale=1.6` changes bird size.

## Movement
Head position is a damped spring toward the pointer (small offset). The bird turns to face its velocity, banks into turns, sweeps its wings back and beats faster at speed. When the mouse stops (0.7 s) it hovers in a slow figure-eight with a majestic wingbeat; tail and crest keep moving.

## 15-second preview
`preview/ice_phoenix_preview.mp4` — rendered frame-by-frame from the real page (`?demo`): 0–3 s materialise + idle, 3–7 s figure-eight, 7–11 s fast sweeps + frost nova (~9.2 s), 11–15 s spiral dash, second nova (~12.9 s), settle.
In a normal browser you can also use `?demo` (live) or `?demo&record` (downloads a .webm).

## Verification (what was actually run)
Headless Chromium + SwiftShader WebGL2: page loads, no console/page errors, renders on pure black, frames inspected at idle / sweep / nova. Not tested on real GPU hardware, Safari or Firefox, or with a physical mouse.

## Status note (added when this folder was checked)
`preview/` is currently empty: `ice_phoenix_preview.mp4` described above is not in the folder, and the headless-Chromium verification above was not re-run. Treat both as unconfirmed until the video is present and the page has been opened in a real browser.
