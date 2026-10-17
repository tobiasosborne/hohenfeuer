<!-- Owns pass-2 visual evidence, per-iteration metrics, camera/material/effect decisions and verification. -->
# Look loop pass 2 — cannon, stone, ground and effects

2026-10-17. Tracking: **castle-game-iyt**. Selected result: **iteration 5**, after five measured changes.

On the fixed ten pass-1 reference pairs, whole-frame 8 px blurred MAE falls **28.062 → 26.044 / 255** (-2.018, **7.19%**). The shipped cannon uses the low, offset breech framing; stone faces are warmer and more readable without whitening sunlit parapets; ground grain is finer; flash, wake and impact dust are shorter and smaller, with pooled ballistic stone chips. These coarse unregistered metrics do not assert matched geometry or native effect timing.

## Evidence

| Comparison | Original / before / after | Selected reference pair sheet |
|---|---|---|
| weapons | [three columns](../assets-ripped/look-loop/pass2/before-after-weapons.png) | [iteration 5](../assets-ripped/look-loop/pass2/iteration-5/weapons-sheet.png) |
| environment | [three columns](../assets-ripped/look-loop/pass2/before-after-environment.png) | [iteration 5](../assets-ripped/look-loop/pass2/iteration-5/environment-sheet.png) |
| effects | [three columns](../assets-ripped/look-loop/pass2/before-after-effects.png) | [iteration 5](../assets-ripped/look-loop/pass2/iteration-5/effects-sheet.png) |

[Fixed stone-mask overlays](../assets-ripped/look-loop/pass2/stone-masks.png); [impact lifetime comparison](../assets-ripped/look-loop/pass2/impact-lifetime.png); [camera projection measurements](../assets-ripped/look-loop/pass2/cannon-framing.json). Each iteration archives native PNGs, poses, source/reference SHA-256 values, renderer budgets, metrics and three comparison sheets. Reference-bearing artifacts remain under `assets-ripped/`.

## Method

`tests/render-look-pass2.mjs` runs Pillow/numpy only through **python3 -I**. Both native 1024×768 RGB images receive `ImageFilter.GaussianBlur(8)` before arithmetic mean absolute RGB error. No thumbnail is used numerically; each pose has equal weight in the aggregate. Reference pairs and the whole/sky/ground bands are unchanged from pass 1.

| Region | Half-open coordinates | Meaning |
|---|---|---|
| Whole | 0,0–1024,768 | Includes HUD; unchanged HUD differences dilute the scene effect |
| Sky | 270,112–800,280 | Positional band; buildings/ground fill it in enclosed/downward views |
| Ground | 16,360–990,548 | Positional band; can contain gun, walls and tiles |
| Stone-mask | Rectangles in every metrics.json | Conservative hand-marked **reference** stone regions; same coordinates applied to both images |

The stone masks were visually audited before the first material measurement: initial draft rectangles included grass in the 05x and impact frames. Those were corrected, then iterations 0 and 1 were recomputed with the same final mask schema used for 2–5. The preliminary 24.634 aggregate is discarded; the audited baseline is **32.096**. The masks are fixed across iterations and are not semantic segmentation of the current render: the changed camera can move the gun or a parapet top across a reference wall. Thus this is masked positional MAE, not a material-only score. The overlays expose that limitation.

| Pose | Fixed original PNG |
|---|---|
| tb1-spawn | 119-forest-towers-close.png |
| tb1-first-shot | 055-cannon-projectile.png |
| rampart-north | 049-cannon-default-aim.png |
| weapon-view-cannon | 049-cannon-default-aim.png |
| courtyard-palace | 074-forest-overview-south.png |
| crew-at-cannon | 119-forest-towers-close.png |
| cannon-sight | 049-cannon-default-aim.png |
| muzzle-flash | 054-cannon-muzzle-smoke.png |
| smoke-trail | 055-cannon-projectile.png |
| impact-dust | 170-no-rebuild-first-strike.png |

The legacy `weapon-view-cannon` and `rampart-north` poses remain unchanged for comparability, including their no-HUD harness and legacy 2° gun elevation. **`cannon-sight` and the 05x pairs use the real gameplay rig** and calibrated ballistic elevation. New weapon GLBs were discovered but are excluded from the metric baseline. The overview and first-person castle layouts are not registered. Original 170 is a post-strike still; original 184 is native Scrap demolition and supplies no cannon dust/timing evidence. Supplemental impact captures at ticks 376 and 451 show persistence/clearance but are excluded from the fixed ten-pose mean.

## Iterations

| Iteration | Change | Whole | Sky | Ground | Stone-mask | Whole delta vs previous |
|---|---|---:|---:|---:|---:|---:|
| 0 | Current baseline; ten decoded frames exactly equal pass-1 iteration 5 | 28.062 | 33.780 | 30.487 | 32.096 | — |
| 1 | Exact camera proposal: right +0.35 m, up +0.40 m, back +0.35 m | 29.059 | 31.232 | 37.695 | 27.583 | +0.997 |
| 2 | Eye another +0.20 m; initial atlas grade, red tiles, finer/narrower ground, smaller shorter FX and debris | 29.661 | 30.419 | 36.841 | 41.565 | +0.602 |
| 3 | Filter the grade signal; reduce face gain to 0.8 and top gain to 0.28 | 27.534 | 29.774 | 31.901 | 28.169 | -2.127 |
| 4 | Darker forest turf; preserve incoming non-cannon authored sights | 26.694 | 30.639 | 27.398 | 27.074 | -0.840 |
| 5 | Selected: plain wall/mount/foundation gain 0.35; top gain 0.15; tower-face gain remains 0.8 | 26.044 | 30.454 | 26.172 | 25.428 | -0.650 |

| Region | Before | Selected after | Delta | Improvement |
|---|---:|---:|---:|---:|
| whole | 28.062 | 26.044 | -2.018 | 7.19% |
| sky | 33.780 | 30.454 | -3.326 | 9.85% |
| ground | 30.487 | 26.172 | -4.315 | 14.15% |
| stone-mask | 32.096 | 25.428 | -6.668 | 20.78% |

Each cell below is **whole / sky / ground / stone-mask**, on the 0–255 scale. Adjacent columns give the before/after values for every iteration; JSON retains RGB means and mask pixel counts.

| Pose | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| tb1-spawn | 36.45 / 37.43 / 48.69 / 31.20 | 36.45 / 37.43 / 48.69 / 31.20 | 30.02 / 27.10 / 39.28 / 16.89 | 30.05 / 28.00 / 38.64 / 14.17 | 30.05 / 28.00 / 38.64 / 14.17 | 30.05 / 28.00 / 38.64 / 14.17 |
| tb1-first-shot | 23.33 / 35.64 / 26.99 / 45.74 | 25.93 / 29.93 / 43.28 / 29.84 | 24.44 / 30.98 / 35.81 / 57.45 | 22.95 / 30.98 / 30.86 / 35.51 | 21.15 / 30.98 / 22.84 / 32.56 | 20.90 / 30.98 / 21.97 / 28.95 |
| rampart-north | 31.27 / 31.48 / 32.37 / 24.01 | 31.27 / 31.48 / 32.37 / 24.01 | 40.03 / 31.48 / 43.84 / 67.83 | 35.50 / 31.48 / 36.67 / 36.90 | 33.88 / 31.48 / 28.06 / 35.02 | 31.55 / 31.48 / 26.70 / 29.93 |
| weapon-view-cannon | 31.43 / 24.84 / 23.79 / 16.16 | 31.43 / 24.84 / 23.79 / 16.16 | 37.64 / 24.84 / 30.48 / 29.56 | 34.45 / 24.84 / 27.83 / 24.55 | 33.58 / 24.84 / 23.96 / 26.23 | 31.73 / 24.84 / 21.05 / 18.09 |
| courtyard-palace | 32.23 / 28.90 / 39.13 / 39.61 | 32.23 / 28.90 / 39.13 / 39.61 | 25.60 / 25.89 / 23.78 / 12.84 | 26.25 / 23.94 / 26.88 / 21.57 | 26.29 / 23.96 / 26.88 / 21.57 | 27.18 / 24.19 / 28.81 / 23.49 |
| crew-at-cannon | 29.94 / 29.91 / 30.05 / 39.92 | 29.94 / 29.91 / 30.05 / 39.92 | 34.17 / 34.76 / 38.58 / 20.07 | 30.39 / 34.67 / 26.71 / 17.38 | 33.44 / 44.70 / 27.44 / 17.38 | 33.87 / 44.69 / 28.50 / 28.32 |
| cannon-sight | 23.14 / 32.95 / 26.86 / 21.36 | 25.86 / 25.70 / 44.45 / 23.55 | 24.73 / 25.68 / 37.82 / 55.76 | 23.18 / 25.68 / 32.84 / 33.44 | 21.19 / 25.68 / 24.38 / 31.48 | 20.89 / 25.68 / 23.45 / 27.77 |
| muzzle-flash | 26.34 / 51.82 / 27.80 / 45.42 | 29.10 / 39.62 / 48.96 / 29.91 | 26.20 / 40.28 / 36.89 / 57.77 | 24.71 / 40.28 / 31.93 / 35.81 | 22.61 / 40.28 / 23.24 / 32.93 | 22.35 / 40.28 / 22.37 / 29.31 |
| smoke-trail | 25.30 / 40.01 / 26.99 / 45.74 | 27.20 / 39.69 / 44.03 / 29.84 | 24.65 / 31.94 / 35.81 / 57.45 | 23.16 / 31.94 / 30.86 / 35.51 | 21.23 / 31.94 / 22.77 / 32.56 | 20.97 / 31.94 / 21.90 / 28.95 |
| impact-dust | 21.17 / 24.81 / 22.20 / 11.79 | 21.17 / 24.81 / 22.20 / 11.79 | 29.14 / 31.24 / 46.12 / 40.03 | 24.69 / 25.93 / 35.78 / 26.84 | 23.52 / 24.53 / 35.78 / 26.84 | 20.95 / 22.46 / 28.32 / 25.31 |

| Pose | Final whole-frame delta | Final stone-mask delta |
|---|---:|---:|
| tb1-spawn | -6.402 | -17.026 |
| tb1-first-shot | -2.435 | -16.792 |
| rampart-north | +0.274 | +5.921 |
| weapon-view-cannon | +0.305 | +1.929 |
| courtyard-palace | -5.052 | -16.122 |
| crew-at-cannon | +3.932 | -11.601 |
| cannon-sight | -2.255 | +6.406 |
| muzzle-flash | -3.985 | -16.116 |
| smoke-trail | -4.330 | -16.792 |
| impact-dust | -0.222 | +13.515 |

Whole-frame regressions remain: `rampart-north` (+0.274), `weapon-view-cannon` (+0.305), `crew-at-cannon` (+3.932). The crew pose points its “sky” band into ground that is sandy in the original but green in our layout; darkening grass helps the cannon views while worsening this unregistered band. Impact composition also differs greatly. These regressions are retained, not removed by changing reference pairs.

## Implementation

**Camera.** `TUNING.ruler` now uses right **0.35 m**, up **1.85 m**, back **2.35 m**, pitch **−4°**, FOV **50°**. Iteration 1 applies the captured pass-1 proposal exactly; iteration 2 adds 0.20 m eye height to put the mouth below the horizon. At TB1 tick 254 the camera is **[110.1544513, 8.85, 127.8786838]**. The rendered muzzle centre is **[437.323, 380.743] px**, flat horizon **326.416 px**: **54.328 px below** and **74.677 px left of centre**. The rendered cannon Sight and live pivot rig differ by only **1.42e−14 m**. The barrel occupies the lower-middle frame; no mesh scaling, ballistic elevation or projectile collision origin changes were used. Cardinal-yaw tests cover handedness and explicit Sight precedence. Pose-file coordinates were synchronised for Blender consumers; `camera: rig` still controls actual captures.

The kit loader tags weapon identity, so only the cannon gets this calibrated Sight. New non-cannon GLBs retain their authored sights even when they contain a mesh named `barrel`. Main still supplies a pivot rather than each authored sight to the gameplay rig; per-weapon wiring remains **castle-game-hoq**, narrowed to that remaining integration. No main/plugin/sim or GLB file was edited by this session.

**Stone and roofs.** `block-palette.js` grades our authored atlas in memory, using manifest tile indices including damage variants. Neutral limestone is separated from coloured oak, ivy and glazing. A filtered luminance signal lifts faces without doubling high-frequency grain; recessed mortar/cracks remain dark. Final lift gains: tower and architectural faces **0.8**, plain stone/mount/foundation **0.35**, horizontal tops **0.15**. Small red/yellow offsets warm the limestone. Red clay uses **R×1.13, G×0.96, B×0.94** on the roof’s red texels. Source textures/GLBs remain untouched; there is no reference-pixel input. The regular timber belts and repeated block outlines remain visible and need authored geometry/paint variation later.

**Ground.** World-continuous texture repeat **6 → 2.5 m**, with stronger fine grain at nearly unchanged texture mean. Forest grass becomes **#3f4e24 / #4b592c**; sand remains **#9f9378**. The 10 m linear sandy skirt becomes a smooth roughly **0.6–5 m** verge with a small world-anchored irregular edge. Field and horizon share UV scale. Collision heights, plot flattening and all world/sim data remain unchanged.

**Effects.** Deterministic fixed-step sprites retain the bounded 160-sprite pool. Flash cores: **2.1 / 1.15 m → 0.75 / 0.38 m**, lifetimes **0.10 / 0.065 s → 0.075 / 0.045 s**. Muzzle smoke: **7 → 5** lobes, **1.8–2.4 s → 0.8–1.3 s**, alpha **0.65 → 0.45**. Wake samples: **0.9 → 0.28 m**, lifetime **2 → 0.85 s**, alpha **0.55 → 0.30**; at 30 Hz that reduces a single wake from about 60 live samples to about 26. Impact puffs: **12 → 10** rising lobes plus four shallow lateral lobes; initial size **1.4–2.4 → 0.6–1.3 m**, life **2.2–3.2 → 1.2–2.0 s**, initial alpha **0.8 → 0.65**.

Each impact adds **18 independently authored low-poly chips**, about **0.08–0.18 m across**, lifetime **0.65–1.35 s**, gravity **9.8 m/s²**, a short expiry shrink, and no simulation collision. One InstancedMesh holds up to **96 chips**. Tests cover deterministic reuse, bounded allocation, motion and expiry. These are art timings, not measured native timing. Wakes still emit per tick because main provides only positions: projectile-ID/spacing-based sampling remains in **castle-game-m7d**.

## Validation and concurrency

`npm test`: **362 passed, 0 failed**, 669.128 s ([log](../tests/evidence/13-look-unit.txt)). `node --test tests/render-look-materials.mjs tests/render-environment.mjs tests/unit/ui-camera.test.js`: **19 passed** ([log](../tests/evidence/13-look-render-green.txt)). Failing-first evidence is in `13-look-camera-red.txt`, `13-look-materials-red.txt`, `13-look-debris-red.txt`, and `13-look-weapon-sight-red.txt`.

`npm run test:browser`: **passed**, SwiftShader, live ticks, TB1 tick 307, defeat overlay, no console errors ([log](../tests/evidence/13-look-browser.txt)). A concurrent menu refactor changed bare-URL boot to the title screen, so the smoke test now explicitly opens `?play=1`; no UI implementation was changed here. `npm run build`: **passed**, with the existing bundle-size advisory ([log](../tests/evidence/13-look-build.txt)). The projection check passed ([log](../tests/evidence/13-look-camera-projection.txt)).

Early shared-workspace edits briefly produced missing sim/menu exports. The initial baseline golden command failed; the fresh baseline capture then reproduced all ten pass-1 frames exactly, decoded pixel for pixel. Source guards flagged concurrent changes during iterations 0, 1 and 3; their archived captures and metric inputs remain available. Iterations **2, 4 and 5** completed with unchanged source and cannon/atlas hashes and no page errors. Final exact verification also guards all source JS, pose JSON, and authored asset hashes, so mid-run changes cannot be accepted silently.

No git command was run. All work stays in the shared workspace for the orchestrator. The final material loop only hoists constant gain selection after iteration 5; final golden pixels are checked against that archive.
