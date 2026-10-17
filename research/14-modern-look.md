<!-- Owns the modern style implementation, comparison evidence, deterministic checks and period-preset handoff. -->
# Modern look, style B

2026-10-17. Tracking: **castle-game-uo7.2**. Tobias's current direction is to explore a modern preset while preserving classic as the default. The optional period-2001 preset remains **castle-game-uo7.1**, open. This supersedes the look direction in DESIGN 7 for the new preset only.

## Selection and ownership

`src/render/styles.js` registers `classic` and `modern`. Use `?style=modern` on a match or the render harness; call `window.__hohenfeuer.setStyle('classic' | 'modern')` during play. The renderer also accepts `style` at construction. The debug hook exposes the current `style` and effective `gpuExtras` values. Unknown URL/saved values fall back to classic; an unknown runtime name throws without changing the scene.

Boot reads `style` from the `hohenfeuer.options` localStorage object. The URL takes precedence. `golden=1` ignores saved style and defaults to classic unless the URL explicitly selects modern. GPU extras are forcibly off if either the renderer's golden argument or the page URL specifies golden mode, even when the caller requests extras. UI code is owned by another session: the Options selector should save this field and call the debug setter. The existing options sanitizer needs that owner's style field integration; no UI files were edited here. `main.js` only imports the selection helper and passes the style/golden boot arguments.

A scene material controller retains original material objects, caches modern replacements, and rebinds new chunk meshes when the dirty queue replaces them. Switching back restores the exact classic material objects, lights, background, fog and tone mapping. It releases modern materials and their lookup textures without disposing shared atlases or geometries. The chunk geometry, indices, AO calculation, sun DDA, dirty ordering and remesh budget are unchanged. No camera or simulation changes enter the preset.

## Shaders

**Blocks and weapons.** A custom `ShaderMaterial` addresses each authored atlas face tile through its existing UVs, constraining sampling to the tile's gutter. Existing vertex colours carry the mesher's per-vertex AO, baked sun visibility and authored colour. A nearest-filtered tile metadata texture derives damage quartiles from the kit manifest's intact/damaged tile lists, so deterministic crack/soot decals strengthen with damage state. Existing broken geometry and damage paint remain. No new per-cell attribute or remeshing path is required. Kit-v0/fallback lack damage-tile metadata and retain their existing baked damage tint. Hemisphere ambient plus a wrapped directional sun replaces Lambert response; stone has zero specular. Weapons receive a restrained 0.08 neutral-dark iron mask and a broad highlight, keeping coloured wood matte. Modern uses ACES filmic tone mapping; classic retains NoToneMapping.

**Terrain.** World-space grass/sand/rock splatting blends slope and elevation. A smooth irregular sand verge follows up to four castle plot rectangles. Seeded existing ground grain supplies fine detail; low-frequency procedural variation breaks up large areas. Normals come from the original heightfield, with no normal map, displacement or changed collision height. Field and horizon skirt share coordinates.

**Sky and atmosphere.** The existing dome geometry receives a gradient shader, two independent three-octave cloud strata, a warm sun disc/halo and horizon haze. Cloud phase is simulation tick divided by the contract's tick rate. Custom world materials integrate exponential height density analytically along the camera-to-fragment ray. Untouched people materials use the scene's matching exponential distance fog; their rendering remains the other session's responsibility.

**Burning blocks.** One bounded InstancedMesh holds up to 256 crossed flame cards, populated in stable castle/cell order from public plot burning bits. Rising procedural emissive noise uses only simulation ticks. Same-tick renders are pixel-identical; advancing ticks changes the flame image; extinguished/dead cells disappear. No wall clock, random stream, sim mutation or chunk dirtiness is introduced.

**Water.** `createWaterView()` is an explicit empty dry-map stub. `src/world/terrain.js` and the current biome contracts expose neither water cells nor a water level. Low terrain is not reinterpreted as water. A future river/moat map needs an explicit mask and elevation before a water surface shader can be attached.

**Optional GPU extras.** `TUNING.render.gpuExtras` defaults false. Modern can enable one 2048×2048 PCF directional shadow map, sprite depth fade, eight-tap SSAO-lite and a low-strength bloom. The implementation uses the pinned three **0.186.1** `EffectComposer`, `RenderPass`, `ShaderPass`, `UnrealBloomPass` and `OutputPass`, with no dependencies added. A shared opaque depth prepass feeds particle fade and AO. The stock SSAOPass was inspected: it creates random kernels and does extra normal renders, so the lighter deterministic depth taps are implemented through ShaderPass instead. The 2048 map and passes have a SwiftShader compile/compatibility smoke test, but golden frames never run them. This is not a hardware performance certification.

## Visual evidence and measurement

![Classic | modern | original comparison sheet](../assets-ripped/look-loop/modern/comparison-sheet.png)

Individual full-resolution sheets: [rampart](../assets-ripped/look-loop/modern/rampart-north-sheet.png), [weapon](../assets-ripped/look-loop/modern/weapon-view-cannon-sheet.png), [courtyard](../assets-ripped/look-loop/modern/courtyard-palace-sheet.png), [impact](../assets-ripped/look-loop/modern/impact-dust-sheet.png).

The four modern pose records copy the corresponding classic cameras and ticks, changing only their URL to request modern and golden mode. Original references remain the pass-2 pairings: 049 for rampart and weapon, 074 for courtyard, and 170 for impact. They are unregistered composition comparisons; 170 is a post-strike still, not a phase-matched dust sequence. Python runs with `-I`; both native 1024×768 RGB images receive Gaussian blur radius 8 before mean absolute RGB error on the 0–255 scale. Reference files and sheets stay under `assets-ripped/`, never in shipped assets. No original pixels enter shaders or authored textures.

The exact verifier records source/asset SHA-256 values, compares decoded RGBA bytes without pixelmatch's antialias exclusions, and rejects changing sources. Final paired verification uses a temporary frozen copy of src/assets/dev and the selected poses, with isolated Vite caching; both presets use the same paused scene before a fresh page repeats the run. This avoids concurrent simulation edits and baseline deletion races. The copy was hash-checked against the workspace before/after creation; its location and hashes are recorded in `tests/evidence/14-modern-snapshot.json`. Classic baseline drift is reported separately from same-build two-run determinism; modern capture cannot overwrite any classic golden.

## Blurred reference error and exact repeats

| Pose | Classic MAE / 255 | Modern MAE / 255 | Modern minus classic |
|---|---:|---:|---:|
| rampart-north | 31.548 | 63.396 | +31.848 |
| weapon-view-cannon | 31.734 | 62.476 | +30.742 |
| courtyard-palace | 27.160 | 35.948 | +8.788 |
| impact-dust | 20.988 | 43.088 | +22.100 |
| Four-pose mean | 27.857 | 51.227 | +23.370 |

Modern is deliberately further from the originals. The broad daylight gradient, lighter atmospheric perspective, different turf and more directional stone lighting are a separate look choice, not an attempt to improve the period likeness score. This four-pose mean must not be compared directly to research/13's ten-pose aggregate. [Raw metrics](../assets-ripped/look-loop/modern/metrics.json).

All four **modern baseline comparisons are exactly 0 decoded pixels in both fresh runs**. Every paired classic screenshot is also exactly equal to its first-run image. The two render-only classic poses match their copied baselines at 0 pixels. With the latest captured simulation repair wave, courtyard has 100 differing pixels and impact 26,791 against their older classic baselines; the latter includes different damage/build state. Its switch-back rendering is stable across both runs. This is retained in the report's `baseline-drift` status rather than hidden by an antialias tolerance. The separately reported `modernStatus` is passed. [Capture/source record](../assets-ripped/look-loop/modern/capture.json), [two-run log](../tests/evidence/14-modern-goldens-current.txt).

The source snapshot is `/tmp/hohenfeuer-modern-qa-aby3yyvy`. The render implementation is the final one. Subsequent live edits to AI building/controller, NPC jobs and tuning are listed explicitly in the capture record; the render tuning group was checked and remains identical. Those simulation edits require integration recaptures independently of this preset. Only the four new modern baseline PNGs were copied back from this build. Comparison sheets were visually inspected at their native layout; original captures remain reference-only.

## Performance

Measured at **1024×768, DPR 1, SwiftShader**, GPU extras off, on an Intel Core i7-1365U. Each pose uses the same paused scene and retained geometry for both presets: classic / modern / modern / classic batches, five warm frames then fifteen readback-completed frames per batch, thirty samples per preset. The table reports the median of all thirty samples. This separate run follows the first full suite and precedes the last parallel simulation repair wave; it supersedes the heavily contended timing samples bundled with screenshot capture. The final render implementation is unchanged on the extras-off path. A later diagnostic timing attempt on the frozen build was stopped when competing work produced 321–1,539 ms frame samples in its first pose, making a useful speed comparison impossible; that partial log remains `14-modern-performance-frozen.txt`. The host was shared (one-minute load 9.71 → 11.15), so this is a software-renderer comparison, not a certified Iris Xe 60 fps result.

| Pose | Classic calls | Modern calls | Triangles, both | Classic median ms | Modern median ms | Increase |
|---|---:|---:|---:|---:|---:|---:|
| rampart-north | 19 | 19 | 95,088 | 66.50 | 93.65 | 40.8% |
| weapon-view-cannon | 24 | 24 | 103,176 | 73.80 | 109.20 | 48.0% |
| courtyard-palace | 16 | 16 | 118,942 | 110.10 | 161.80 | 47.0% |
| impact-dust | 56 | 56 | 121,620 | 104.50 | 157.35 | 50.6% |

All four pass the **250 calls / 300,000 triangles** budgets. A later live integration capture, after simulation repairs, raises impact to **57 calls / 121,664 triangles**, still well inside those budgets; the table retains the earlier quiet timing run rather than mixing its frame times with a different scene state. The modern cost is shader work, with zero added draws or triangles in these non-burning poses. An active fire batch adds one draw and at most 1,024 triangles. Hardware frame-time validation remains the existing **castle-game-ko3.2** follow-up. The remesh path was not changed or retuned. Its unchanged SHA-256 values are `ba80daba59ee9c59fcb67872f1965c4d3f4f19151f44a903ce6182d87f80b099` (`chunks.js`) and `378c1b57ce21c190b304d3c96e508a6ddf935e39e3ee61c144288bfbfdf229bd` (`mesher.js`). [Raw counterbalanced samples](../assets-ripped/look-loop/modern/performance.json).

## Period preset follow-up

`castle-game-uo7.1` remains open. It would add a distinct `period` registry entry, a vertex-lit block factory, fixed 1024×768 render target with nearest upscale, deliberate DX7-style mip bias and ordered 16-bit colour dithering. Its Options choice and golden poses belong to that preset. It should reuse the reversible bindings and explicit tick source, preserve the classic default, and avoid enabling modern GPU extras. Geometry/atlas authorship improvements (repeated timber belts, triangular ridges, sparse conifers) and the remaining camera/FX integration from research/12 and /13 are independent of the preset registry.

## Validation and shared-workspace limits

The focused render suite passes **38 tests**: registry/default/URL/storage policy, golden GPU override, real GLB-to-LUT damage quartiles, material disposal, fixed-cap fire, unchanged chunk/mesher tests, prior palette/environment checks. Failing-first logs are `14-modern-red.txt`, `14-modern-shaders-red.txt` and `14-modern-atlas-origin-red.txt` and `14-modern-gpu-reentry-red.txt` under `tests/evidence/`. The atlas test caught a real orientation mismatch: manifest tiles count from the bottom while exported glTF UVs address the image from the top. The lookup now flips rows, and every vertex in all four authored stone damage GLBs is checked against its expected quartile.

The browser shader test passes with **no console/page errors**, covers kit v1, kit v0 and the no-kit fallback, proves geometry identity and zero dirty-queue change across switching, and compares classic → modern → classic screenshots byte for byte, including a gameplay impact with transparent dust, debris, people and the HUD, without changing the simulation hash. Its burning fixture proves same-tick image equality, changed pixels at a later tick and removal on extinguishing. A separate non-golden GPU probe compiles the shadow/depth/AO/bloom path and verifies the single shadow map is 2048 pixels wide. A GPU → classic → GPU round trip also proves identical pixels and a fresh depth binding. The failing-first re-entry check exposed r186 retaining patched sprite uniforms; leaving GPU mode now releases those cached programs while preserving reusable material/texture objects. Explicitly requesting extras while the page still has `golden=1` cannot bypass the off switch. Evidence: [shader report](../tests/evidence/14-modern-browser.json), [focused tests](../tests/evidence/14-modern-targeted.txt).

`npm test` finally passes **408 tests, 0 failures** in 603.702 s ([full log](../tests/evidence/14-modern-unit-settled.txt)). Earlier runs caught other sessions midway through their changes: generated-castle support/path failures (fixed; all five rechecks pass), and a sweep test whose script did not exist yet (fixed; both rechecks pass). Those failed logs remain as evidence, not as the final result.

`npm run test:browser` passes: live ticks, TB1 first shot at tick 307 and defeat overlay, SwiftShader, no errors. `npm run build` passes with the existing bundle-size advisory. The extended shader test also proves a byte-identical classic → modern → classic round trip in the gameplay impact pose, including dust, debris, people and HUD, with unchanged `sim.hash()`.

`npm run goldens` passes all **25 poses** ([final log](../tests/evidence/14-modern-npm-goldens-final.txt)). All **18 original classic poses** and the **four modern poses** print **0 differing pixels**. The three newly added parallel-session poses are within the repository tolerance: feel-recoil 26 px, impact-view 149 px, npc-markers 491 px. Those are outside this preset's requested four poses.

**Exact baseline reconciliation remains tracked as castle-game-hyr.** The UI owner regenerated classic baselines during this session, resolving the original large HUD/recoil mismatches. This lane did not delete or overwrite an existing classic PNG; the ordinary golden script can create a file after its owner deletes it. The latest frozen comparison exposes subsequent simulation drift of 100 courtyard pixels and 26,791 impact pixels against the copied classic baselines; both captured classic repeats still agree exactly. The last ordinary all-pose command passed before these further edits. A later live check identified the changed gameplay pixels, so its earlier success is not presented as a claim that a continuously edited workspace stays green. `capture.json` deliberately retains `baseline-drift` and a separate passing `modernStatus`. Three live capture attempts were rejected on changing source/pose files or deletion races; final modern evidence uses the hash-checked frozen build instead of relaxing those guards.

Beads changes remain local because `bd dolt push` reports that no origin remote is configured. The final renderer implementation and handoff are in this report and Beads; the shared `HANDOFF.md`, UI, people and simulation files were outside the assigned ownership. No git command was run.

## Reproduction

```sh
node --test tests/unit/render-styles.test.js tests/unit/render-mesher.test.js tests/unit/render-chunks.test.js tests/render-look-materials.mjs tests/render-environment.mjs
node tests/render-modern.mjs
node tests/render-style-goldens.mjs --update-modern
node tests/render-style-goldens.mjs
node tests/render-style-goldens.mjs --modern-only --paired --no-perf
node tests/render-style-performance.mjs
npm test
npm run test:browser
npm run goldens
npm run build
```

`--update-modern` only writes the four modern baseline PNGs. Existing classic PNGs are protected. No git command was run, as the user explicitly prohibited it; the shared workspace is the review/handoff destination.
