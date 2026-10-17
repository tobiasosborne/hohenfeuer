<!-- Owns the measured first forest look loop, reference sheets, renderer decisions, verification and next-pass proposals. -->
# Look loop pass 1 — Hohenfeuer and the original

2026-10-17. Tracking: **castle-game-8uj**. Selected result: **iteration 5**.

Across the same ten reference pairs, 8 px blurred whole-frame MAE fell from **39.890 to 28.062 / 255** (−11.828, **29.65%**). The positional sky band fell **50.070 → 33.780** (−16.290); ground band **43.174 → 30.487** (−12.687). The central scene rectangle, excluding most HUD, fell **47.279 → 31.884** (−15.395). Every pair improved in whole-frame MAE. These are coarse palette/composition measurements, not a claim of matched geometry or a passed 3D likeness gate.

Five measured render iterations followed the baseline. Iteration 2 regressed after cloud enlargement; iterations 3–5 corrected it and improved the total. The last two whole-frame gains were 0.221 and 1.001. Work stops at the requested five-pass bound, not at a claim of complete convergence. Iteration 1 remains best in the aggregate sky band; iteration 3 is marginally best in the ground band. Iteration 5 has the best scene and whole-frame scores and the most useful overall visual result.

## Visual evidence

Each iteration directory contains native 1024×768 PNGs, `poses.json`, `sources.json`, `metrics.json`, and ImageMagick `weapons-sheet.png`, `environment-sheet.png`, `effects-sheet.png`. All these reference-bearing artifacts stay under ignored `assets-ripped/look-loop/pass1/`.

| Comparison | Before | Selected after | Original / before / after |
|---|---|---|---|
| Cannon, actual sight, flight | [iteration 0](../assets-ripped/look-loop/pass1/iteration-0/weapons-sheet.png) | [iteration 5](../assets-ripped/look-loop/pass1/iteration-5/weapons-sheet.png) | [three-column sheet](../assets-ripped/look-loop/pass1/before-after-weapons.png) |
| Rampart, palace, crew, close stone | [iteration 0](../assets-ripped/look-loop/pass1/iteration-0/environment-sheet.png) | [iteration 5](../assets-ripped/look-loop/pass1/iteration-5/environment-sheet.png) | [three-column sheet](../assets-ripped/look-loop/pass1/before-after-environment.png) |
| Flash, smoke, dust | [iteration 0](../assets-ripped/look-loop/pass1/iteration-0/effects-sheet.png) | [iteration 5](../assets-ripped/look-loop/pass1/iteration-5/effects-sheet.png) | [three-column sheet](../assets-ripped/look-loop/pass1/before-after-effects.png) |

Each iteration was visually inspected using its sheets and full-size poses. The lighting correction is the largest useful improvement: mortar and stone remain visible in shade, red tiles no longer disappear into near-black walls, and the ground is less saturated green. Clouds now have distinct crowns and shaded undersides. Forest proxies give the horizon depth, but remain simpler than the original's textured trees and irregular rocks.

The cannon framing remains a substantial mismatch. [A separately captured camera proposal](../assets-ripped/look-loop/pass1/cannon-camera-proposal.png), with [exact coordinates](../assets-ripped/look-loop/pass1/cannon-camera-proposal.json), moves the eye +0.35 m right, +0.40 m up and +0.35 m back, retaining FOV 50° and pitch −4°. Its barrel position is considerably closer to original 049. This is a debug preview, **not shipped gameplay framing**, and is excluded from the aggregate metrics. The live camera currently receives only the weapon pivot and azimuth from `main.js`, so changing the GLB `Sight` alone cannot fix it. `main.js` and the player camera belong to the parallel TB3 lane.

## Method and comparability

`tests/render-look.mjs` orchestrates **python3 -I + Pillow/numpy** and ImageMagick. RGB frames are blurred at native resolution with `ImageFilter.GaussianBlur(8)`; absolute differences and arithmetic mean RGB are then taken over these fixed half-open rectangles:

| Band | x0, y0, x1, y1 | Interpretation |
|---|---|---|
| sky | 270, 112, 800, 280 | Positional upper scene band, avoiding most HUD |
| ground | 16, 360, 990, 548 | Positional lower scene band, above the console |
| scene | 16, 112, 990, 548 | Central 3D region, mostly free of HUD |
| whole | 0, 0, 1024, 768 | Whole native frame, including unchanged HUD |

“Sky” and “ground” are **rectangular bands, not semantic masks**. Buildings fill the upper band in enclosed palace poses, and the cannon intersects it in weapon views. Native overview references cannot be registered to first-person voxel layouts. The legacy `dev/render.html` cannon/rampart frames also have no HUD. Thus whole-frame MAE is useful as a consistent coarse trend, not a silhouette score, material-only error, or hard likeness threshold. Montage thumbnails are resized for viewing; metrics never use those thumbnails.

Reference pairs are fixed across all six measurements:

| Our pose | Original lossless PNG | Reason / limitation |
|---|---|---|
| tb1-spawn | 119-forest-towers-close.png | Close stone and timber reference; different composition, no literal sky comparison |
| tb1-first-shot | 055-cannon-projectile.png | Weapon-view flight and smoke |
| rampart-north | 049-cannon-default-aim.png | Valley, sky and foreground battlement; our legacy pose has no gun in foreground |
| weapon-view-cannon | 049-cannon-default-aim.png | Existing fixed-camera cannon benchmark; its barrel elevation is only 2°, unlike gameplay |
| courtyard-palace | 074-forest-overview-south.png | Roof red and sunlit castle palette, not equivalent camera layout |
| crew-at-cannon | 119-forest-towers-close.png | Gun, wall walk and nearby stone |
| cannon-sight | 049-cannon-default-aim.png | New real gameplay rig at TB1 tick 254, before firing |
| muzzle-flash | 054-cannon-muzzle-smoke.png | New TB1 tick 255; the original capture is later in the launch, so flash phase differs |
| smoke-trail | 055-cannon-projectile.png | New TB1 tick 265; visibility/timing are qualitative |
| impact-dust | 170-no-rebuild-first-strike.png | New TB2 tick 352, free camera [246,22,120]; reference is post-strike, not phase-aligned dust |

Source checksums are recorded in [reference-sha256.json](../assets-ripped/look-loop/pass1/reference-sha256.json). The original catalogue/report changed during this session: **184 is `184-wall-demolition.mp4`, native Scrap demolition, not a verified projectile collapse**. Its [one-second contact sheet](../assets-ripped/look-loop/pass1/video-reference/impact-contact-sheet.png) is qualitative demolition evidence only and is excluded from all numeric metrics. No cannon-impact timing, dust colour or damage physics is inferred from it. The initial stale “verified destruction” label was not retained.

Baseline capture found a pre-existing `crew-at-cannon` mismatch of 2,480 thresholded pixels (0.315%). Iteration 0 uses the actual current frame from that run, rather than mixing an older crew golden with current sim state. The four new poses were captured before renderer changes. TB3 later added two more poses; they are preserved and regression-tested, but excluded from the fixed ten-pair likeness mean.

## Iterations

| Iteration | Change and reason | Sky MAE | Ground MAE | Scene MAE | Whole MAE |
|---|---|---:|---:|---:|---:|
| 0 | Baseline, current sim and four additional fixed-tick poses | 50.070 | 43.174 | 47.279 | 39.890 |
| 1 | Correct sRGB sky encoding; three cloud bands; neutral warm ambient; olive grass and textured turf; consistent sun/fog; design sight pitch | 32.043 | 33.122 | 33.576 | 30.859 |
| 2 | Muzzle attachment correction, layered smoke/dust and barrel normals; larger clouds overshot the upper band | 35.136 | 33.226 | 34.107 | 31.414 |
| 3 | Lower cloud ceiling; 2048×512 sky; brighter neutral ambient; darker terrain; initial forest/ridge proxies | 34.495 | 30.440 | 32.795 | 29.284 |
| 4 | Smaller trees and ridges with procedural needle/rock paint; remove toy-sized skyline | 34.402 | 30.607 | 32.422 | 29.063 |
| 5 | Darker blue sky/fog, darker rock palette and subtle internal cloud texture; selected overall result | 33.780 | 30.487 | 31.884 | 28.062 |

Per-pose MAE below is **sky / ground / whole**, all on the 0–255 scale. Full precision, scene-band values and reference RGB means are also in each archived `metrics.json`.

| Pose | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| tb1-spawn | 79.63 / 91.07 / 64.35 | 46.08 / 59.04 / 42.78 | 46.08 / 59.04 / 42.78 | 37.43 / 48.69 / 36.45 | 37.43 / 48.69 / 36.45 | 37.43 / 48.69 / 36.45 |
| tb1-first-shot | 46.48 / 29.93 / 30.44 | 24.89 / 26.34 / 24.15 | 27.34 / 26.37 / 24.46 | 35.52 / 26.99 / 24.42 | 35.21 / 26.99 / 23.88 | 35.64 / 26.99 / 23.33 |
| rampart-north | 42.83 / 31.70 / 39.78 | 36.11 / 36.72 / 35.62 | 31.55 / 36.72 / 35.51 | 31.72 / 32.18 / 33.32 | 31.80 / 33.17 / 33.28 | 31.48 / 32.37 / 31.27 |
| weapon-view-cannon | 46.08 / 31.49 / 46.26 | 28.48 / 27.36 / 38.40 | 29.88 / 27.27 / 38.52 | 27.25 / 23.50 / 34.46 | 27.82 / 24.18 / 34.23 | 24.84 / 23.79 / 31.43 |
| courtyard-palace | 73.42 / 80.25 / 57.14 | 37.90 / 48.81 / 37.47 | 37.89 / 48.81 / 37.17 | 28.71 / 39.13 / 32.33 | 28.79 / 39.13 / 32.42 | 28.90 / 39.13 / 32.23 |
| crew-at-cannon | 32.30 / 54.75 / 43.09 | 29.42 / 33.77 / 31.92 | 29.39 / 33.77 / 31.75 | 29.53 / 30.05 / 29.73 | 29.43 / 30.05 / 30.32 | 29.91 / 30.05 / 29.94 |
| cannon-sight | 54.51 / 29.08 / 32.94 | 37.84 / 26.33 / 26.87 | 38.39 / 26.34 / 27.19 | 37.35 / 26.86 / 25.11 | 35.55 / 26.86 / 24.44 | 32.95 / 26.86 / 23.14 |
| muzzle-flash | 51.42 / 30.34 / 32.02 | 31.48 / 27.05 / 26.10 | 48.84 / 27.10 / 28.44 | 52.22 / 27.80 / 27.70 | 52.54 / 27.80 / 27.40 | 51.82 / 27.80 / 26.34 |
| smoke-trail | 46.34 / 29.93 / 30.41 | 24.72 / 26.34 / 24.12 | 37.10 / 26.37 / 26.53 | 40.41 / 26.99 / 26.47 | 40.65 / 26.99 / 26.07 | 40.01 / 26.99 / 25.30 |
| impact-dust | 27.68 / 23.21 / 22.46 | 23.51 / 19.46 / 21.17 | 24.91 / 20.48 / 21.80 | 24.80 / 22.20 / 22.84 | 24.81 / 22.20 / 22.14 | 24.81 / 22.20 / 21.17 |

Two band-level regressions remain relative to baseline: `rampart-north` ground **31.702 → 32.367**, and `muzzle-flash` sky **51.423 → 51.821**. More visible scenery and a now-visible early muzzle flash do not necessarily reduce an unregistered rectangle difference. Neither is hidden by changing the reference pairing.

Mean RGB for every pose and iteration follows. Each cell contains **sky ; ground ; whole**, rounded to integer RGB solely for compact reporting; archived JSON retains three decimals. Reference means are constant for a given pair and included in the JSON.

| Pose | Iteration | Sky RGB | Ground RGB | Whole RGB |
|---|---:|---|---|---|
| tb1-spawn | 0 | 30, 33, 29 | 30, 29, 24 | 47, 47, 40 |
| tb1-spawn | 1 | 74, 71, 60 | 70, 61, 49 | 74, 70, 59 |
| tb1-spawn | 2 | 74, 71, 60 | 70, 61, 49 | 74, 70, 59 |
| tb1-spawn | 3 | 88, 84, 70 | 83, 72, 57 | 83, 78, 65 |
| tb1-spawn | 4 | 88, 84, 70 | 83, 72, 57 | 83, 78, 65 |
| tb1-spawn | 5 | 88, 84, 70 | 83, 72, 57 | 83, 78, 65 |
| tb1-first-shot | 0 | 144, 164, 191 | 55, 51, 37 | 93, 104, 106 |
| tb1-first-shot | 1 | 120, 140, 157 | 78, 71, 56 | 97, 103, 100 |
| tb1-first-shot | 2 | 125, 141, 154 | 78, 71, 56 | 98, 103, 99 |
| tb1-first-shot | 3 | 130, 143, 150 | 85, 77, 62 | 96, 102, 96 |
| tb1-first-shot | 4 | 134, 147, 159 | 85, 77, 62 | 97, 103, 99 |
| tb1-first-shot | 5 | 129, 141, 155 | 85, 77, 62 | 95, 100, 97 |
| rampart-north | 0 | 156, 177, 207 | 86, 113, 58 | 98, 117, 115 |
| rampart-north | 1 | 137, 155, 170 | 107, 112, 67 | 106, 116, 108 |
| rampart-north | 2 | 140, 155, 169 | 107, 112, 67 | 107, 117, 108 |
| rampart-north | 3 | 131, 150, 168 | 99, 107, 66 | 105, 115, 107 |
| rampart-north | 4 | 130, 150, 168 | 101, 108, 67 | 104, 115, 108 |
| rampart-north | 5 | 124, 141, 163 | 100, 107, 66 | 100, 110, 104 |
| weapon-view-cannon | 0 | 158, 180, 211 | 59, 70, 39 | 95, 108, 113 |
| weapon-view-cannon | 1 | 128, 150, 170 | 80, 79, 52 | 103, 109, 105 |
| weapon-view-cannon | 2 | 133, 151, 167 | 80, 79, 52 | 102, 108, 104 |
| weapon-view-cannon | 3 | 140, 156, 169 | 80, 79, 54 | 102, 107, 103 |
| weapon-view-cannon | 4 | 140, 157, 171 | 81, 80, 55 | 102, 107, 104 |
| weapon-view-cannon | 5 | 134, 149, 167 | 81, 80, 54 | 97, 102, 101 |
| courtyard-palace | 0 | 34, 35, 30 | 46, 42, 36 | 60, 59, 54 |
| courtyard-palace | 1 | 78, 72, 61 | 85, 73, 62 | 86, 79, 69 |
| courtyard-palace | 2 | 78, 72, 61 | 85, 73, 62 | 85, 78, 68 |
| courtyard-palace | 3 | 93, 85, 71 | 97, 84, 70 | 95, 86, 74 |
| courtyard-palace | 4 | 92, 85, 71 | 97, 84, 70 | 95, 86, 74 |
| courtyard-palace | 5 | 92, 85, 71 | 97, 84, 70 | 94, 85, 74 |
| crew-at-cannon | 0 | 109, 130, 67 | 75, 69, 54 | 90, 97, 79 |
| crew-at-cannon | 1 | 124, 126, 78 | 105, 95, 79 | 103, 103, 86 |
| crew-at-cannon | 2 | 124, 126, 78 | 105, 95, 79 | 102, 103, 86 |
| crew-at-cannon | 3 | 116, 120, 76 | 113, 103, 87 | 104, 104, 85 |
| crew-at-cannon | 4 | 116, 120, 76 | 113, 103, 87 | 104, 104, 87 |
| crew-at-cannon | 5 | 115, 119, 75 | 113, 103, 87 | 102, 102, 86 |
| cannon-sight | 0 | 144, 164, 191 | 55, 51, 37 | 94, 104, 106 |
| cannon-sight | 1 | 120, 140, 157 | 78, 71, 56 | 98, 104, 100 |
| cannon-sight | 2 | 122, 139, 153 | 78, 71, 56 | 97, 103, 99 |
| cannon-sight | 3 | 127, 141, 150 | 85, 77, 62 | 96, 101, 96 |
| cannon-sight | 4 | 131, 146, 158 | 85, 77, 62 | 96, 102, 98 |
| cannon-sight | 5 | 126, 139, 154 | 85, 77, 62 | 94, 99, 96 |
| muzzle-flash | 0 | 143, 163, 190 | 55, 51, 37 | 93, 104, 106 |
| muzzle-flash | 1 | 119, 139, 156 | 78, 71, 56 | 97, 103, 100 |
| muzzle-flash | 2 | 165, 174, 178 | 78, 71, 56 | 103, 108, 103 |
| muzzle-flash | 3 | 166, 174, 173 | 85, 77, 62 | 102, 106, 100 |
| muzzle-flash | 4 | 169, 177, 180 | 85, 77, 62 | 102, 107, 102 |
| muzzle-flash | 5 | 166, 173, 177 | 85, 77, 62 | 100, 104, 101 |
| smoke-trail | 0 | 144, 164, 191 | 55, 51, 37 | 93, 104, 106 |
| smoke-trail | 1 | 120, 140, 157 | 78, 71, 56 | 97, 103, 100 |
| smoke-trail | 2 | 147, 158, 164 | 78, 71, 56 | 102, 106, 101 |
| smoke-trail | 3 | 150, 158, 159 | 85, 77, 62 | 101, 105, 98 |
| smoke-trail | 4 | 154, 162, 166 | 85, 77, 62 | 102, 106, 101 |
| smoke-trail | 5 | 151, 158, 164 | 85, 77, 62 | 100, 104, 99 |
| impact-dust | 0 | 72, 69, 45 | 63, 60, 48 | 74, 79, 57 |
| impact-dust | 1 | 98, 84, 62 | 91, 86, 73 | 91, 89, 70 |
| impact-dust | 2 | 99, 86, 65 | 93, 88, 74 | 91, 90, 70 |
| impact-dust | 3 | 104, 91, 69 | 101, 95, 81 | 95, 93, 75 |
| impact-dust | 4 | 104, 91, 69 | 101, 95, 81 | 94, 93, 75 |
| impact-dust | 5 | 104, 91, 69 | 101, 95, 81 | 93, 92, 74 |

## Implementation and visual decisions

- `src/render/sky.js`: the old implementation took linear `THREE.Color` channels and wrote them as sRGB bytes, then declared the texture sRGB again. The new sky paints byte-space endpoints directly; a test checks exact requested endpoints. Three seeded layers use independent scalloped lobes, shaded undersides and small-scale detail. Final zenith **#314f7b**, horizon **#6984a4**. The dome follows the full camera position, avoiding a height-dependent horizon join. Clouds remain static; there is no wall-clock animation in captures.
- `src/render/renderer.js`: forest hemisphere **4.8**, sky **#e4e9ef**, ground **#c2b8a6**; sun **2.2**, **#fff1db**. Lighting preserves Lambert, sRGB output, no tone mapping, no antialiasing and no real-time shadow maps. Forest fog is **#6984a4**, linear **160–850 m**. `test-scene.js` now uses the same **[-0.5,1,-0.75]** sun direction as gameplay so the baked visibility and actual light agree. The native absolute sun vector was not measured; consistency and observed material contrast drove this choice.
- `src/render/terrain-view.js`: olive forest colours **#535f2e / #626b39**, plot ground **#9f9378**, plus an independently generated 256² grayscale turf texture repeating every **6 m**. Field and skirt share world UVs, bilinear sampling and mipmaps. Brighter lighting is counterbalanced by darker terrain tints. Heights, collision data and plot flattening are unchanged.
- `src/render/forest-backdrop.js`: at most **320** seeded instanced conifers, keeping trunk centres at least **12 m** beyond plot bounds, plus a distant four-ring rock silhouette outside the map footprint. Texture paint is seeded arithmetic noise, not source imagery. These are cosmetic proxies, with no colliders or sim changes. Geometry/material/texture disposal is included. Better authored rock and tree assets are still needed.
- `src/render/fx.js`: resolve the closest model `Muzzle` attachment within 3 m of a fire event's collision origin, so the flash is no longer hidden inside the cannon. Two short additive cores last **0.065 / 0.10 s**, followed by seven normal-blend smoke lobes. White-gray trails last **2 s**. Twelve warm-gray impact lobes expand sideways/upward over **2.2–3.2 s**. Fixed `dt`, seeded jitter and the existing bounded **160-sprite pool** retain deterministic lifetime/reuse behaviour. These are art timings, not measured native timings.
- `src/render/weapon-view.js`: crease-aware barrel normals reduce the lathe's faceted shading and the sight helper now defaults to the design's **−4°**, rather than −2°. Gun geometry proportions, gameplay collision and ballistic elevation remain intact. The separate camera proposal is the next meaningful framing fix; deforming the gun to compensate for an unwired sight would conceal the actual cause.

No `src/ui`, `people-view.js`, `ghost-view.js`, sim/player/main, Blender generator, or kit atlas file was edited by this lane. Atlas regeneration was unnecessary: lighting was responsible for most of the dark stone/roof appearance. The new sky, terrain, prop and FX textures are independently generated in code. No ripped vertex, UV or texel data enters shipped assets.

## Validation and reproduction

- `npm test`: **289 passed, 0 failed**, 792.971 s. [Full log](../tests/evidence/12-look-unit.txt).
- `npm run test:browser`: passed on SwiftShader, including live tick advance, TB1 flight at tick 307, surrender overlay and no console errors. [Log](../tests/evidence/12-look-browser.txt).
- `npm run build`: passed. Vite reports the existing large-bundle advisory; it is not a build failure. [Log](../tests/evidence/12-look-build.txt).
- `node --test tests/render-environment.mjs`: **6 passed**, including colour, world UVs, sight pitch, deterministic FX reuse/expiry, visible muzzle attachment and clear seeded tree placement. Failing-first logs: [environment](../tests/evidence/12-look-environment-red.txt), [muzzle](../tests/evidence/12-look-fx-red.txt), [props](../tests/evidence/12-look-props-red.txt). [Final green log](../tests/evidence/12-look-environment-green.txt).
- `npm run goldens`: all **15 poses, 0 thresholded pixels differ**. [Log](../tests/evidence/12-look-final-goldens.txt).
- `node tests/render-stability.mjs`: **two fresh runs × 15 poses = 30 captures, every decoded RGBA pixel identical**. This is stricter than pixelmatch's threshold 0.1. Both HUD-only goldens and both parallel TB3 goldens pass. Peak observed budget: **88 draw calls / 133,350 triangles**, below 250 / 300,000. [Log](../tests/evidence/12-look-stability.txt), [machine report](../test-results/render-stability.json). These are draw budgets, not a hardware FPS claim.

Concurrent editing caused ordinary Vite HMR navigation interruptions during this session. After the first complete exact-pixel check, the TB3 lane changed only its built-pose camera from [111.5,8.6,127.5] to [111.5,8.6,125.5], yaw −2.9, pitch −0.18, with `showRuler: false`. Its resulting 353,976-pixel mismatch was legitimate; only that PNG was deleted and recaptured, and final verification was repeated. The final exact verifier also hashes every source JS file and the poses file and rejects any change during its two runs. Final `npm run goldens` was run with `CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=3600000` to prevent a mid-capture reload; the exact-pixel verifier explicitly closes its server watcher before opening any page. Neither changes the SwiftShader launch flags, scene clock, pixels or comparison tolerances. The baseline and intermediate capture logs are retained in `tests/evidence/12-look-*.txt`.

Reproduce the chosen result without overwriting archived baselines:

```bash
npm test
npm run test:browser
npm run build
node --test tests/render-environment.mjs
CHOKIDAR_USEPOLLING=1 CHOKIDAR_INTERVAL=3600000 npm run goldens
node tests/render-stability.mjs
node tests/render-look.mjs 5 --archived
```

For a future visual change, delete only its legitimately affected golden PNGs, run `npm run goldens`, then use a **new** iteration index in `tests/render-look.mjs`. `--archived` recomputes sheets/metrics from existing snapshots and does not replace them with current goldens.

## Prioritised next work

| Priority | Owner / issue | Remaining difference | Concrete next fix |
|---|---|---|---|
| 1 | Main/player integration + render, **castle-game-hoq** | The gameplay barrel dominates the centre; original 049 has it lower and left. The legacy harness also uses the wrong elevation for this comparison. | Pass `weaponViews.get(w.id).nodes.sight.getWorldPosition(...)` into `rig.update`'s weapon `sight`; calibrate kit-local offset against the captured camera proposal, keep −4°/50°, then add a proper sight-driven harness pose. Do not alter ballistic elevation or shrink the gun to fix the camera. |
| 2 | Kit/asset lane, **castle-game-ryk** | Rock skyline remains triangular, groves sparse and conifers geometric. | Replace the proxies with independently painted irregular rocky masses and fuller needle/leaf meshes, with restrained distant haze. Retain world scale, plot clearance and the draw/triangle budgets. |
| 3 | Kit/asset lane, **castle-game-ryk** | Stone/wood are too regular; timber belts repeat per cell; cannon lacks soft painted metal highlights; original roof edges and stone have richer wear. | Vary ashlar tone and mortar erosion, add contextual belt variants, coarser irregular oak grain and independently painted longitudinal barrel highlights; then regenerate only affected authored atlas regions/GLBs consistently. Keep current filenames and clean-room provenance. |
| 4 | Render lane, **castle-game-m7d** | Cloud ellipses are still readable and the sky lacks the original's painted internal billows. | Add coherent multi-scale shape/detail to cloud paint, broader grey undersides, separate distant wisps, and tick-driven slow layer motion with fixed golden phase. Measure dedicated clear-sky patches alongside these positional bands. |
| 5 | Render/main integration, **castle-game-m7d** | Smoke is sampled per tick; flash/impact phase differs from the reference; dust lacks grounded fragments. | Supply projectile ID and previous position for spacing-based continuous wakes, add independently authored debris and shallow ground dust, and capture phase-matched native launch/impact bursts. Do not calibrate cannon dust from Scrap demolition video 184. |
| 6 | Render lane, **castle-game-m7d** | Tree and weapon contact shadows are missing; sprite effects do not yet use the design's larger instanced pool. | Add deterministic blob shadows and batch the FX pool as camera-facing instances, retaining fixed-step lifetime and exact-pixel regression coverage. |

Handoff: final visual state is iteration 5; use `research/12` plus beads for the next pass. People animation remains owned by its separate lane. The four added effect/sight poses and both incoming TB3 poses are preserved. **No git command was run**, as explicitly requested; committing/pushing belongs to the orchestrator. `bd dolt push` was attempted but this database has no `origin` remote; the issue updates and follow-ups are stored locally in beads.
