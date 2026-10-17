<!-- tools/blender/README.md - owns usage and conventions for the pinned asset pipeline. -->
# Blender asset pipeline foundation

Run from the repository root. Blender's bundled Python runs every `bpy` script;
host validation uses isolated `python3 -I` and the standard library only.
The supported binary is exactly **Blender 4.5.14 LTS**:

```bash
BLENDER=/home/tobias/Apps/blender-4.5.14-linux-x64/blender
"$BLENDER" -b --python-exit-code 1 --python tools/blender/kit_v0.py
python3 -I tools/blender/validate_glb.py assets/kit-v0
python3 -I tools/blender/test_pipeline.py
```

Each `bpy` entry point calls `common.assert_blender_version()`, which prints the
running version and asserts `bpy.app.version == (4, 5, 14)`. A version mismatch or
uncaught script failure exits non-zero even without `--python-exit-code 1`.
Use that flag anyway so failures before the common runner also propagate.
Script arguments belong after Blender's standalone `--`.

## Shared scene and golden poses

```bash
"$BLENDER" -b --python-exit-code 1 --python tools/blender/common.py -- \
  --pose example-wall --output assets/kit-v0/qa/example-wall.png
"$BLENDER" -b --python-exit-code 1 --python tools/blender/check_blender.py
```

`common.py` provides scene reset, argument parsing, EEVEE configuration,
mesh/UV/colour construction, base materials, camera placement, rendering and GLB
export. Running it directly renders an authored 1 m cube at a shared pose.
`check_blender.py` checks axis conversion, the camera basis, vertical FOV, legacy
viewport dimensions and deterministic settings, then renders twice and requires
identical PNG SHA-256 hashes. Its evidence is `assets/kit-v0/qa/checks.json`.

`load_poses()` reads the existing **`tests/goldens/poses.json` without editing it**.
Its current shape is a name-keyed object:

```json
{
  "example-wall": {
    "position": [0, 1.7, 6], "yaw": 0, "pitch": 0,
    "width": 640, "height": 360
  }
}
```

The loader accepts `pos` as an alias for `position`, optional `fov` in degrees
(vertical, default 60), and retains additional fields such as `mode`.
Yaw and pitch are **radians with Three's intrinsic `YXZ` convention**, matching
the existing Playwright harness. Positive Three yaw is different from the sim's
clockwise compass azimuth. Blender's own Euler-order labels also differ; the
helper constructs the camera basis explicitly.

`apply_pose(camera, pose)` renders at 1024x768 by default. Passing `size=None`
honours a pose's legacy `width`/`height`; an explicit size overrides them.
The checked-in pose file currently contains only `example-wall`; the named
castle/weapon poses in DESIGN 7.6 can be consumed when another lane adds them.

EEVEE uses `BLENDER_EEVEE_NEXT`, verified from the running engine RNA enum.
Settings: seed 1, frame 1, one render sample, no temporal reprojection, motion
blur, dithering, real-time shadows, ray tracing or denoising. Standard/sRGB
output uses neutral exposure and gamma. All stamp flags are disabled to keep
Date/RenderTime PNG metadata from breaking deterministic hashes. There is one warm sun toward Blender
`(1,-2,3)`, energy 1.25, and a hemisphere ambient term with sky
`(0.52,0.65,0.82)` and ground `(0.24,0.20,0.15)`. DESIGN 7.2 specifies the light
types but not numeric biome values, so these are documented placeholder defaults.
Kit colours bake simple face lighting; reference previews use diffuse shading
plus a normal-weighted ambient term because an EEVEE background alone does not
illuminate diffuse meshes. These are asset inspection frames, separate from the
browser's SwiftShader regression goldens and likeness gates.

## Kit v0

`kit_v0.py` produces `assets/kit-v0/<block>.glb`, a shared original 512px grayscale
atlas, `manifest.json`, and `thumbs/<block>.png` at **256x256**. Each GLB embeds
its texture and has one named mesh with positions, flat normals, UVs and baked
vertex colour. The original procedural motifs use 128px tiles and 8px gutters;
the production 2048px atlas and final authored skins remain a later phase.

| IDs | Keys | Geometry |
|---|---|---|
| 0 | air | Fully transparent 12-triangle preview proxy; labelled thumbnail |
| 1–4 | stone, tower, gate, wood | 1 m cubes, 12 triangles each |
| 5 | floor | Walkway slab at cell top Y=1; 0.18 m thick, 12 triangles |
| 6 | stairs | Two 0.5 m steps rising north, 20 triangles |
| 7 | ladder | Two rails and five rungs on north face, 84 triangles |
| 8 | door | One 1 m half-panel of a two-cell pair, 12 triangles |
| 9 | roof | North-rising wedge, 8 triangles |
| 10–13 | magazine, palace, mount, foundation | 1 m cubes, 12 triangles each |

All fourteen entries from DESIGN 2.2 are present, including air. Runtime air
cells should emit no geometry; the invisible proxy satisfies a uniform asset
inspection contract. `floor` is the walkway cell and `mount` is the weapon
support cell; neither introduces another block ID. Eight magazine cells compose
the 2x2x2 prefab. Doors require two cells. Roof ridge/corner variants, damage
meshes, NPCs and articulated weapons are outside this placeholder kit.

## Reference turntables

```bash
"$BLENDER" -b --python-exit-code 1 --python tools/blender/turntable.py -- \
  assets-ripped/meshes/Buildings/palast_z0.obj assets-ripped/turntables

"$BLENDER" -b --python-exit-code 1 --python tools/blender/turntable.py -- \
  --inventory assets-ripped/meshes

"$BLENDER" -b --python-exit-code 1 --python tools/blender/turntable.py -- \
  assets-ripped/meshes/Objects/Kanone_Gestell.obj assets-ripped/turntables \
  --part assets-ripped/meshes/Objects/Kanone_Drehkranz.obj \
  --part assets-ripped/meshes/Objects/Kanone_Rohr.obj --name Kanone \
  --pose example-wall
```

Input is Y-up OBJ with its adjacent MTL and referenced texture files. They are
read as data; the script never executes input files. All imported meshes live in
a `ReferenceOnly` collection and are tagged against export. Ripped input renders
are restricted to **`assets-ripped/turntables/`**. Nothing from those inputs is
copied into `assets/`; the kit generator does not read them.

The strip is **4096x768**, in front / left / back / top order, with orthographic
1024x768 panels. Front looks toward game -Z, left looks from -X, back from -Z,
and top from +Y. All four panels for an object share one metres-per-pixel value
and a yellow 1 m reference cube, moved beside the object in each view. The
camera uses vertical sensor fit so its recorded orthographic height is exact.
Different assets are fitted independently; compare their JSON metres-per-pixel
values when comparing sizes across strips. Panels remain under `.frames/`.

Each `<name>.json` records source hashes, Y-up bounds, width/height/depth in
metres, triangle counts, scale and timings. `--scale` explicitly sets metres
per OBJ unit (default 1); meshes are never normalized. Original source units
have **not been independently calibrated**. Multipart weapons retain their OBJ
origins; no original animation or hierarchy is inferred.

`--inventory` discovers intact `_z0` building variants and weapon parts, excluding
highlight/LOD/damage variants and shadow directories. It renders palast,
MauerKlein, MauerGross, TurmKlein, TurmGross, Burgtor, Kanone and Katapult when
present, and writes measured `INVENTORY.md`. All eight were available for this
run, so no placeholder fallback was needed. `--pose` adds a fifth, separate
1024x768 frame at the exact shared pose without recentering the source model.

## Export and validation conventions

- **Units/axes:** one Blender unit = one metre; author Z-up and export glTF +Y-up.
  Game/glTF north is -Z and east is +X. Game `(x,y,z)` maps to Blender `(x,-z,y)`.
- **Cell anchor:** origin at bottom centre, game bounds `[-0.5,0,-0.5]` to
  `[0.5,1,0.5]`. Thin objects stay inside that cell. Transform rotations are baked
  by the exporter; unit scale must remain 1.
- **Names:** exact palette key, lowercase `<block>.glb`; one mesh named `<block>`.
  Later damage variants use `<block>_z0.glb` through `<block>_z3.glb` per DESIGN
  2.4: z0 intact, z1–z3 increasingly damaged. Destroyed cells disappear. The
  unsuffixed v0 file is the intact placeholder, not a separate damage state.
- **Materials:** `KHR_materials_unlit`, base-colour texture multiplied by vertex
  colours; suitable for using the base colour in a Lambert renderer. No normal,
  metal/roughness, occlusion or emissive maps. Textures are embedded PNGs, with
  linear magnification and trilinear mip filtering. Air uses alpha zero.
- **Compression:** no Draco, gltfpack, mesh quantization or animation. Export uses
  selection, applies modifiers, and excludes cameras and lights. Option names
  are checked against the pinned glTF operator RNA. `export_image_format=AUTO`
  preserves the authored PNG; 4.5.14 does not offer a `PNG` enum value.

`validate_glb.py` checks the GLB header/chunk extents, embedded buffers, every
primitive's POSITION/NORMAL/TEXCOORD_0, accessor bounds and finite data, unit
normals, triangle indices/budget, base-only materials and absence of Draco. It
computes bounds from vertex bytes through the node hierarchy, so false accessor
bounds or an accidental 100x node scale fail. Default bounds are the cell above,
with a strict **<200 triangle** limit. It can validate another envelope:

```bash
python3 -I tools/blender/validate_glb.py assets/kit-v0 --json
python3 -I tools/blender/validate_glb.py assets/kit-v0/door.glb \
  --min -0.5 0 -0.5 --max 0.5 1 0.5 --max-triangles 96
```

`test_pipeline.py` includes corrupt/truncated headers, missing UVs, hidden Draco,
buffer overruns, non-finite normals, misleading bounds, transformed scale and
unsupported materials. Its generated-kit check also verifies exact palette,
per-tile UV ranges, vertex-colour alpha, unlit materials and thumbnail sizes.
This catches the Blender CustomData pitfall where adding a colour attribute
invalidates a previously retained UV-layer handle. Fill buffers and reacquire
layers when assigning data. Operators here use `bpy.context.temp_override`.

Headless EEVEE on this machine prints `EGL_BAD_MATCH` warnings while falling back
to a working software context. Successful PNG writes and repeat checks verify
the render path; these Blender frames do not certify browser SwiftShader.

## Kit v1: original authored skins and cannon

```bash
/home/tobias/Apps/blender-4.5.14-linux-x64/blender -b --python-exit-code 1 \
  --python tools/blender/kit_v1.py
python3 -I tools/blender/verify_kit_v1.py
node --test tests/unit/rules-cleanroom.test.js
/home/tobias/Apps/blender-4.5.14-linux-x64/blender -b --python-exit-code 1 \
  --python tools/blender/compare_v1.py
```

`kit_v1.py` has no reference-art inputs. It builds all geometry from metric
primitives and runs `kit_v1_textures.py` to paint deterministic texels with
host Python, Pillow and NumPy. It writes **only `assets/kit-v1/`**; kit v0 stays
available. `--no-render` skips thumbnails for geometry development. All bpy
entry points enforce Blender 4.5.14. The standalone acceptance checker imports
`validate_glb.py` and validates every exported GLB, including actual transformed
vertex bounds, 96-triangle block budgets, the 1.4 m high / 2.6 m long cannon,
the 1.75 m humanoid and articulation names.

The fourteen IDs/keys and existing manifest fields are retained. Each block has
an intact `<key>.glb` and `_z1`, `_z2`, `_z3` files. The unsuffixed file is z0;
there is no redundant `_z0` copy. Cubes lose a chipped corner in z1 and actual
half-cell masonry chunks in z2/z3. Thin panels and wedges have increasingly
clipped corners; ladders lose rungs. All variants have procedural branching
cracks and 0.9/0.8/0.7 vertex tint. Air remains an invisible inspection proxy.
Damage selection remains the renderer integration owner's responsibility.

The shared atlas is **4096x4096, 256px tiles, 8px edge gutters**, with 240px of
paint per tile. This increases the v0 atlas resolution to preserve the requested
256px face sets. Each type/state occupies four tiles: side, north/front, top,
bottom. Their indices and variant filenames are manifest metadata. The floor's
top is walkway flagstone and its underside is timber. Gates and magazines have
north-facing iron-bound timber details. Tower bands and palace window/ivy
motifs use original painted linework. Red roofs use overlapping scallop tiles.

Block GLBs have **two UV channels**: `TEXCOORD_0` addresses the shared atlas
consumed by `src/render/assets.js`; `TEXCOORD_1` addresses an embedded compact
1024x256 face strip. The glTF material selects channel 1. This keeps standalone
GLB previews correct without embedding a 4096px atlas 56 times. The strips are
also saved in `textures/`. Materials retain v0's base-only, unlit + baked-colour
contract. Cannon and person use their own 512px and 256px atlases respectively.

The cannon node tree is `Base -> Yaw -> Pitch -> barrel/Muzzle`, with `Sight`
under `Yaw`; the other named meshes are `frame` and `turntable`. Yaw is 0.16 m
above ground. Pitch is at the trunnion **(0, 1.07, -0.15)** in game metres;
the neutral muzzle is **(0, 1.07, -1.60)**. Forward is -Z, elevation rotates
around local +X and the renderer supplies its existing negative-Y yaw rotation.
The carriage, wheels and axle move with Yaw; the barrel and trunnions move with
Pitch. The `person` placeholder is unrigged, red crew tunic, relaxed A-pose.

`render_v1.py` uses CPU Cycles (8 samples, deterministic seed, no denoising)
because EEVEE's EGL context stalls in this restricted worker. It preserves
`common.py`'s warm sun, explicit normal-weighted hemisphere, neutral Standard
sRGB output and no realtime shadows. These are inspection renders, not browser
SwiftShader goldens. `thumbs/contact-sheet.png` shows the 16 intact assets;
`thumbs/damage-contact-sheet.png` shows the four states for all fourteen IDs.

Reference evidence is a separate process: **`compare_v1.py` never exports a
mesh and writes only `assets-ripped/compare-v1/`**. It imports original OBJ/MTL
data into tagged ReferenceOnly collections and imports the already-generated
authored GLBs for the other panel. Each 1536x656 strip has the original on the
left and the authored result on the right. Building context and 1 m skins are
fitted independently and labelled accordingly; the cannon uses one 4.1 m
orthographic height for both panels. The original cannon's barrel and turntable
placement is a preview-only inference because the ripped parts have separate
origins and no recovered hierarchy. No matching humanoid or air mesh exists;
their reference panels explicitly state that absence. `renders.json` records
source hashes, bounds, camera scales and timings. `--only cannon stone tower
palace` is useful during review and preserves other existing index records;
run without `--only` to generate the full index from scratch.

## Kit v1 weapon expansion

`kit_v1_weapons.py` independently authors ten weapons in pinned Blender 4.5.14.
Generation reads no reference art, leaves the existing cannon and block textures
alone, and merges weapon entries into the latest manifest. Every weapon has three
named meshes (`frame`, `turntable`, `arm` or `barrel`), the existing
`Base -> Yaw -> Pitch -> Muzzle` rig and a `Sight` under `Yaw`, an embedded 512px
procedural wood/iron/rope/canvas atlas, and fewer than 1,500 exported triangles.
Dimensions in the manifest are `[width, height, depth]` in game metres.

```bash
/home/tobias/Apps/blender-4.5.14-linux-x64/blender -b -t 6 --python-exit-code 1 \
  --python tools/blender/kit_v1_weapons.py
python3 -I tools/blender/kit_v1_weapons.py --validate
python3 -I tools/blender/verify_kit_v1.py
node --test tests/unit/rules-cleanroom.test.js
/home/tobias/Apps/blender-4.5.14-linux-x64/blender -b -t 6 --python-exit-code 1 \
  --python tools/blender/kit_v1_weapons.py -- --study
/home/tobias/Apps/blender-4.5.14-linux-x64/blender -b -t 6 --python-exit-code 1 \
  --python tools/blender/kit_v1_weapons.py -- --compare
```

`--only catapult ballista` restricts generation or comparison; `--no-render`
skips thumbnails. The production contact sheet is
`assets/kit-v1/thumbs/weapons-contact-sheet.png`. The isolated `--study` and
`--compare` modes import tagged ReferenceOnly data, never export meshes, and
write only under `assets-ripped/compare-v1/weapons/`. Comparisons use the same
orthographic metre scale on both sides and include a 1 m yellow cube. Part
origins have no surviving hierarchy: preview joint placements are explicitly
inferred. The zeppelin is the requested 12 m versus the original roughly 14 m
envelope; the rocket is the requested tube rack versus one original housing.
CPU Cycles renders are inspection evidence, separate from SwiftShader goldens.

**Pivot correction:** three r186 interprets `extras.pivot` as a numeric array.
Prose there produces NaN transforms. New weapons export `[0, 0, 0]` at the
existing `Pitch` joint, with its zero-offset moving mesh first among children
(r186 clears that child's translation). Joint coordinates live in `pivot_m`
and node translations; prose lives in `joint_description`. The weapon validator
checks raw GLTFLoader output before the renderer's compatibility repair, then
checks 40 aim poses through the actual renderer. It also calls `validate_glb.py`
for byte-level geometry, material, bounds, UV and triangle-budget validation.
