<!-- Owns the original ISO container specifications, rip evidence and asset inventory. -->
# Ballerburg: Castle Siege — ISO formats and reference asset rip

Date: 2026-10-17. Scope: the English CD tree in `downloads/en-iso/iso/`.
Everything below was read as data. No CD executable or DLL was run, loaded as a
library, emulated, or run through Wine. Native Python, Pillow, binutils, FFmpeg and
Blender were the only processing tools. Outputs are reference-only, not game assets
to ship. No git commands or changes to the application, tests/, documentation,
package files, HANDOFF, or the Beads database were made: the task's narrower write
scope takes precedence over the general session workflow. `bd prime` and CLAUDE.md
were read. `docs/DESIGN.md` was absent at the initial read; it was not needed to
decode the independent binary data.

## Result and navigation

The CPR container and its compression, all 51 TEX packs, all 112 SKS containers,
all 482 7DO and 133 6DO files are decoded. Geometry is exported as OBJ+MTL and JSON.
There are 257 castle templates with 9,153 placement records, 74 scenario records,
28 terrain sets, and 464 particle animation frames. Build prices, building defence,
footprints, construction times, weapon reloads and base firing costs were recovered
as static data from the executable. Geometry hierarchy, runtime weapon articulation,
some renderer state, and several scenario/map fields remain unassigned.

Start with `assets-ripped/thumbs/contact-sheet.png`, `assets-ripped/meshes/Buildings/`,
`assets-ripped/meshes/Objects/`, `assets-ripped/data/gameplay.json`,
`assets-ripped/data/scenarios/`, and `assets-ripped/data/layouts/`.
The complete named mesh inventory is appended below. Each source member retains
its internal path under `assets-ripped/Main/`; no guessed mesh filenames were used.
TEX has numeric internal IDs, not embedded filenames; those IDs name its images.

## Method and provenance

Hypotheses were tested on several members before the production readers were written:

1. Header/entropy examination found a plain CPR directory, embedded BMP/TGA in TEX,
   and JPEG signatures behind an SK10 frame table. The first 65,536-byte entropy
   samples were CPR 7.8642, snow buildings TEX 6.8530, snow ground TEX 4.8266,
   Level25 TEX 6.4273 bits/byte. High CPR entropy alone did not identify the codec.
2. The directory chain was verified to terminate exactly at byte 152,585,952.
   The existing [Cantero CPR format notes](https://gist.github.com/javiercantero/e1042ca2cbb072599c98028c207689fe)
   corroborated the linked directory arithmetic used in other Ascaron games.
   That reader does not decompress these flag-2 members. No third-party source
   code was copied into this project.
3. Zlib probes at candidate CPR offsets failed. A particle frame exposed nine-bit
   literal tokens (`82 50 a1 22 ...` decodes as `ATTR...` LSB first).
   The installer contained independent `zlb\x1a` zlib streams. Its Archiver.dll
   was decompressed as bytes, then disassembled with objdump. Static code at
   Archiver.dll VA `0x10007a84–0x10007c72` established the distance and length coding.
   No original machine code was executed. The resulting independent Python LZ
   parser passed text, WAV, image, terrain and geometry checks, then all members.
4. Chunk hypotheses were checked against every 7DO and 6DO, including exact EOF,
   index bounds, UV/normal counts and material coverage. The 6DO BSP tree was
   checked on all three files using it, not merely the easier shadow files.
5. Synthetic malformed-input tests cover traversal, truncated packets, invalid LZ
   matches, invalid mesh indices, bad material runs and oversized TEX spans.
   The complete pipeline was rerun against its existing output successfully.

Checksums identify this particular release; the executable's PE timestamp is
2002-08-27, although the game is the 2001 title. Static table addresses below are
only verified for that executable. `decode_data.py` rejects a different SHA256.

## CPR V0.9 — complete container and compression specification

All integer fields are little endian. File prefix at offset 0 is 32 bytes:
ASCII `ASCARON_ARCHIVE V0.9`, followed by NUL padding to 32 bytes.
The first directory begins at `D=0x20`.

| Relative offset | Type | Meaning |
|---|---|---|
| D+0 | u32 | Allocated directory span, including this 16-byte header; observed 4096 |
| D+4 | u32 | Used directory span, including header |
| D+8 | u32 | Number of records in this directory |
| D+12 | u32 | Payload-region length following the allocated directory |
| D+16 onward | records | Exactly the declared number of entries |

The next directory is at `D + allocated_span + payload_region_length`.
Stop when this equals EOF, not when the skip field happens to be zero.
There are 26 directory blocks. Entries are variable length:

| Relative offset | Type | Meaning |
|---|---|---|
| E+0 | u32 | Absolute file offset of stored member |
| E+4 | u32 | Stored member size, NOT decompressed size |
| E+8 | u32 | 1 = verbatim; 2 = chunked compression |
| E+12 | NUL-terminated CP1252 bytes | Internal Windows path |

After the terminator the next entry starts immediately, without alignment.
Payload starts are 32-byte aligned in this archive; padding is not part of a member.
There are 431 verbatim and 1,951 compressed members. Extractor rejects traversal,
absolute/drive paths, duplicate names, escaping output symlinks and invalid extents.

Flag-2 member format: `u32 total_output_size`, then repeat
`u32 packet_size; byte packet[packet_size]` until the stored member ends.
Each decoded packet is at most 6656 bytes in this corpus, and every member's sum
must equal `total_output_size`.
Packet header is:

| Packet offset | Type | Meaning |
|---|---|---|
| 0 | u32 | Packet output byte count |
| 4 | u32 | Method flags; 1 for compressed LZ |
| 8 | u32 | Eight low-to-high nibbles encoding distance-width increments |
| 12 | bytes | Bitstream, least-significant bit first |

For flags bit 31 set, payload is stored bytes; if bit 30 is also set XOR each
stored byte with `0x35`. The corpus contains 14,422 method-1 LZ packets and 1,545
stored/XOR packets with flags `0xc0000000`; all decoded successfully. Both methods
have a maximum output size of 6656 bytes here. Unknown compressed methods are
rejected rather than guessed. There is no zlib/Deflate, DXT, S3TC or Huffman tree
inside the CPR codec. The XOR branch is simple byte obfuscation.

For table nibbles `d[0..7]`, define `w[i]=sum(d[0:i+1])`,
`base[0]=0`, `base[i]=base[i-1]+2**w[i-1]`.
Read tokens until the packet's output size is reached:

* Tag bit 0: read 8 bits and emit that literal byte.
* Tag bit 1: read 3-bit selector `i`, then `w[i]` bits `v`.
  Back-reference distance is `base[i]+v+1`.
  Start length at 2. Read a 2-bit integer and add it. If it is all ones,
  read 3 bits and add; continue with increasing widths until a non-all-ones value.
  Copy `length` bytes from `distance` bytes behind current output, allowing overlap.

History resets for each packet. The encoder pads bitstreams to DWORD boundaries;
unused trailing pad bits/bytes are not output. Lengths and references are checked.
Example first member: offset `0x1020`, stored length `0x7aa4`, total decoded length
`0x10749`; first packet length `0xd30`, output `0x1a00`, method 1, table `0x21121221`.

## TEX — complete pack framing, standard image payloads

At file offset 0: u32 with top byte 1 and low 24 bits image count (all observed
counts fit in one byte). Beginning at offset 4, repeat the following, unpadded:

| Record offset | Type | Meaning |
|---|---|---|
| 0 | u32 | Image kind: 1 BMP, 2 TGA |
| 4 | u32 | Embedded image byte length |
| 8 | u32 | Renderer flags; preserved exactly, bit meanings not fully assigned |
| 12 | u32 | Renderer color-key value, preserved; interpretation not fully assigned |
| 16 | u32 | Texture ID used by mesh material tables |
| 20 | bytes | Complete standard BMP/TGA file |

The next record begins at `record+20+image_length`. Every pack ends exactly after
its final image. All 2,155 embedded images decode with Pillow. BMPs/TGAs are
converted without resampling, preserving alpha where present. No custom 16-bit or
DXT decoder is necessary for this disc. PNG conversion delegates standard BMP/TGA
bit-depth/palette handling to Pillow. Original image bytes remain alongside manifests.
Renderer color-key/blending flags are not baked into the PNGs.

| Pack family | Texture IDs | Notes |
|---|---|---|
| Waffen | 500–550 | 51 weapon textures |
| GebaeudeSet_{Grass,Wueste,Schnee,Vulkan,Alien} | 1500–1558 | 59 images per theme; shared geometry |
| BodenSet_* | 1980–1989 | 10 ground images per theme |
| Level00–Level27 | 1000 upward | Level-specific terrain texture tiles |
| b_* | 1960 upward | Stage/backdrop images; 3 or 4 per pack |
| Schatten | 1970 | Shadow texture |
| Wolken | 1950–1952 | Clouds |

Grass/forest is the default OBJ material set. Four additional building exports
live in `assets-ripped/variants/{Wueste,Schnee,Vulkan,Alien}/` (202 files each).
There is a fifth Alien texture theme beyond the four requested environments.

## 7DO — complete geometry framing

Offset 0 is `u32 submesh_count`, NOT a version or magic value. Then aligned chunks:
`u32 tag; u32 payload_size; payload; padding to next 4-byte boundary`.
`payload_size` excludes both header and padding. A file ends with tag `0xffffffff`,
size 0. All 482 files contain exactly their declared number of submeshes.

| Tag | Payload | Meaning |
|---|---|---|
| 8 | u32[] | File-wide texture-ID table, including initial slot 0 |
| 9 | float32[6] | Bounding minimum XYZ followed by XYZ extent; optional per batch |
| 2 | float32[][3] | Vertex positions, at most 256 per batch |
| 4 | float32[][3] | Matching per-vertex unit normals |
| 3 | float32[][2] | Matching per-vertex UV coordinates |
| 22 | float32[][3] | Direction coordinates for environment/reflection mapping; shader inference |
| 16 | empty | Untextured batch marker |
| 15 | u32 | Packed material color, normally 0xffffffff; retained |
| 6 | uint8[][3] | Triangle vertex indices, no index-count prefix |
| 7 | uint8[][2] | `(texture_table_slot, triangle_run_length)` pairs |
| 10 | empty | Finish current submesh |
| 23 | 16 bytes | Unassigned extra state, preserved as hex (seven occurrences) |
| 0xffffffff | empty | End of file |

Run lengths cover exactly the triangle list and reference the file-wide texture
table. Materials are NOT vertex indices and the first material-table value is NOT
the count. Shared vertices have already been split where normals/UVs differ.

Native model Y points downward. JSON preserves original coordinates and winding.
OBJ reflects Y (`x,-y,z`), transforms normals the same way, retains triangle order,
and changes texture V to `1-v`. In original coordinates face cross-products point
opposite the stored normals; the reflection makes the exported winding agree.
All fixed UVs and normals are preserved, not regenerated.

There are 95 type-22 batches. Most repeat diffuse triangles, sometimes with a
different vertex ordering or partitioning. The OBJ exporter compares triangle
positions rounded to 1e-5 and omits only duplicate reflection triangles by default.
It preserves 222 unique such triangles (diamant 200, magierturm_ruine 16,
waffenausbau 6); these have direction vectors but no invented static UVs. JSON
always retains all passes. `--include-effects` exports all original triangles.
This is a view-dependent material effect, not skeletal animation.

## 6DO — complete geometry framing, partially assigned renderer state

The older format has chunks `u32 tag; u32 span; bytes[span-4]`.
Unlike 7DO, span includes its own four-byte size field but excludes the tag.
Next chunk is `start+4+span`; there is NO inter-chunk alignment. EOF is a single
u32 `0x81111111` without a length. Every one of the 133 files has this sequence:

| Tag | Payload |
|---|---|
| 0x80000001 | 335-byte serialized header; begins `36 64 6f 01 00 01 00 65` (`6do...`) |
| 0x80000002 | Positions in SIMD groups: float32 X[4], Y[4], Z[4], repeated |
| 0x80000003 | Normals in the same layout, or empty |
| 0x80000004 | Four bytes, usually -1; unassigned state |
| 0x80000005 | Compact polygon command stream, possibly empty |
| 0x80000006 | Serialized BSP tree, or empty |
| 0x80000008 | Four bytes, usually -1; unassigned state |
| 0x80000007 | Empty in this corpus |
| 0x80000009 | int32 texture IDs followed by -1 |
| 0x8000000a | 1024 bytes of auxiliary data, mostly -1; preserved |

Position storage includes unused capacity and SIMD padding; it is not ordinary
interleaved XYZ. The JSON preserves both the complete native arrays and the polygon
records. OBJ expands corners where per-polygon UVs require it. Records are triangle
strips: triangles `(0,1,2),(2,1,3),(2,3,4),(4,3,5),...`, not fans. The original
records remain in JSON. Missing normals are calculated. An initial fan hypothesis
produced crossed faces in the palace shadow/icicles; visual QA caught this, and
strip decoding was implemented, tested, and the affected assets re-rendered.

Compact stream records begin with `u8 length`, then that many bytes. An 8-byte
control payload is `u16 120; u8 maximum_local_index; u8 flags; u32 saved_pointer`.
After each group, the next group's vertex base advances by the preceding maximum
index plus one, rounded up to a multiple of four. High control bits are flags,
not part of the vertex count (necessary for Eiszapfen1–3).

A polygon payload begins with `u32 flags; u32 saved_next_pointer`.
Flags bytes are command 4, render flags, texture-table slot, corner-count/flags.
Corner count is the low three bits of the last byte (3–7). Indices are `u16[count]`,
padded to a 4-byte boundary. If render flags bit 1 is set, `float32 UV[count][2]`
follows. Otherwise the polygon is untextured. Saved pointers are inert provenance,
never addresses dereferenced by the parser.

The three BSP streams are Kompass (19 nodes/25 polygons), StreakExplo (22/23) and
ExploStreak (105/136). A node is 44 bytes: saved child pointers at +0,+4;
eight floats at +8 (plane/bounds semantics partially assigned); polygon-list
pointer at +40. If nonzero, a sequence of length-prefixed polygons follows until
its saved next pointer is zero. BSP polygon indices are u32 rather than u16;
UVs and trailing unassigned fields follow. Serialize the non-null left subtree,
then right subtree. The recovered topology consumes all three streams exactly.
This is spatial BSP topology, not an animation or object-parent hierarchy.

## SKS / SK10 — complete JPEG animation framing

| Offset | Type | Meaning |
|---|---|---|
| 0 | char[4] | `SK10` |
| 4,8 | u32,u32 | Width,height; 80x80 or 128x128 |
| 12 | u32 | Frame count (15 for all files) |
| 16 | u32 | 15; likely frame rate, not independently timed |
| 20,24,28 | u32 | Reserved zero values |
| 32 | (u32 offset,u32 size)[count] | Absolute JPEG frame ranges |
| 32+8*count | u32 | File end offset |
| 36+8*count | u32 | Additional opaque word (often 0x780c2f0a), not JPEG length |
| 40+8*count | bytes | Concatenated complete JPEGs |

Every range is contiguous; every JPEG decodes to the header dimensions; every
end offset equals EOF. These are portrait animation loops, not skeletal meshes.
Extracted to `assets-ripped/sks/{0640,1024}/<original_stem>/0000.jpg...0014.jpg`.

## Castle, scenario, level, particle and table formats

### Castle template `Data/Plateaus/plateau.N`

Little-endian u32 placement words, terminated by `0xffffffff`. `0xfffffffe` is a
deleted/skipped record understood by the game. Bits in a placement word:

| Bits | Meaning |
|---|---|
| 0–1 | Orientation code 0–3; rotation sign/zero direction not established |
| 4–8 | Second local grid coordinate (`grid_z` in JSON) |
| 10–14 | First local grid coordinate (`grid_x` in JSON) |
| 16–21 | Entity/building type 0–63; English name at phrase index type+8 |
| All other bits | Preserved as `unused_bits`; no unsupported interpretation |

Confirmed by Ballerburg.exe VA `0x480ece–0x480f5a`, which extracts these masks and
calls the placement routine. Templates range -1 through 255. World origin, terrain
plateau height, world scale and final wall-connection variant are assigned at
runtime; the JSON gives exact template placements, not a guessed assembled castle.
The accompanying 32x32-grid PNGs provide a visual index.

### Campaign `.odn`

74 binary scenario records, 292 or 324 bytes; unassigned bytes are preserved in hex.
Confirmed record loading at VA `0x40dbd5` and template lookup at `0x40dc8b`.
Byte 0 is level index, byte 1 environment/theme selector; four-byte slot arrays
begin at 2,6,10,14. Four u32 values at +20 are starting-gold candidates (numeric
values preserved; field identification inferred). Four u8 template IDs at +172
select `plateau.N`; 255 denotes no layout. Scenario JSON links these to the level
and template assets. Slot role/AI/owner fields and remaining mission conditions
are not fully decoded. The game has special mode overrides, so a template selection
is not proof of the final runtime castle in every mode.

### Level files

| Extension | Exact storage | Interpretation and output |
|---|---|---|
| .pln | u32 16384; int16 heights[128*128]; u16 tile_words[128*128] | Terrain height and tile planes; JSON + 16-bit PNG + preview |
| .tre | u8 layers[3][64][64] | Three tree-density/selection weight maps; JSON + PNGs |
| .alp | u8[128][128] | Alpha/attenuation plane; role not fully assigned; PNG |
| .hmm | u8[64][64] | Mask, commonly 0/128; role not fully assigned; PNG |
| .him | 6144 bytes | Color table/sky data; 8x256 RGB preview is a hypothesis, raw retained |

PLN plane order is confirmed by the two 0x8000-byte reads at VA `0x43729b` and
`0x4372ab`; the engine negates the signed height samples. A tile word's low byte
indexes a texture tile and its high byte selects a UV transform (VA `0x48080a`).
The last tile row/column can contain `0xcdcd` debug fill and must not be treated as
a valid tile. The 28 TEX terrain packs reuse IDs starting at 1000. Texture-atlas
coordinates/rotation and world-scale conventions are not fully reconstructed.

TRE interpretation is confirmed by the three 4096-byte planes consumed at
VA `0x4013f0–0x401538`: weighted sampling creates vegetation positions at runtime.
There are 252 `Images/Trees/LevelXX_A_B.tga` billboard images (28*3*3), not tree
mesh files. A two-triangle reference quad was authored only to preview an extracted
tree texture; it is clearly labeled reconstructed, excluded from the 615 mesh count.

### Remaining inner formats

* `.pda`: Maya-style text particle frames. Lines `ATTRIBUTES`, attribute names,
  `TYPES`, `V R R R` (optionally another R), `NUMBER_OF_PARTICLES: N`, `BEGIN DATA`,
  followed by N whitespace-delimited rows. V consumes XYZ, R consumes one scalar.
  Attributes are position, spriteScaleX/Y, opacity or opacityPP, optionally spriteNumPP.
  All 464 frames in 11 numbered sequences are also parsed to JSON. Timing is not stored.
* `ml_phrasen.dat` / `ml_tooltips.dat`: CP1252 NUL-terminated string pools.
  Their `...pointer.dat` companions are u32 absolute byte offsets into each pool.
  Every pointer lands on a string boundary. JSON keeps offsets and IDs; text dumps
  replace NUL with newline. The full language pools are reproduced below.
* `Shading00.dat`–`Shading27.dat`: plain ASCII numeric tables, nine rows of 32
  integers (eight groups of four per row). Raw values and JSON are preserved;
  channel/row semantics are not fully assigned. Verbatim tables are below.
* `sinelist.dat`: 4096 little-endian signed int16 samples with amplitude 4096.
  Every sample equals rounded `4096*sin(2*pi*i/4096)` (maximum rounding error <0.5).
* `Plateauerhellung.raw`: 144 bytes; a symmetric 12x12 u8 illumination kernel
  preview is exported. `Gradients.raw`: 1536 bytes; probable gradient/color tables,
  not enough evidence to assign dimensions/channels. Raw bytes are retained.
* BMP/TGA/JPEG/WAV are standard image/audio formats, unwrapped after CPR decoding.
  No scripting-language gameplay file or skeletal-animation file was found.
  `flagge_frame00...11.7do` stores explicit flag geometry frames; weapon pieces such
  as Gestell/Balken/Drehkranz are separate models, without serialized joint hierarchy.

## Installer, video and other CD formats

MinInst.exe and MaxInst.exe are Inno Setup 2.0.18 PE self-extractors. The parser reads
their bytes only. There are 243 independent `zlb\x1a` + standard zlib streams in
each installer. The last `Inno Setup Setup Data (2.0.18)` marker begins a 64-byte
version header, followed by u32 CRC32 of the next eight bytes, u32 compressed
metadata length (excluding per-block CRCs), and u32 uncompressed length. Metadata
uses chunks of up to 4096 compressed bytes, each preceded by its u32 CRC32.

Decompressed metadata contains length-prefixed CP1252 `{app}\...` destination names.
For this version the validated file-entry suffix has fifteen zero bytes,
u32 values 4 and 5 at +15/+19, stream ordinal at +32 and byte 2 at +44.
The extractor validates complete ordinal coverage 1–242 before using these names.
This is a narrow observed-version reader, not a general Inno implementation.
Stream 0 is an unnamed PE payload preserved as `_unnamed/member_0000.bin`;
its filename/purpose is not asserted. DLLs/executables in the output remain inert data.

Videos are standard Bink revision i (`BIKi`); the two selected videos fully decoded
with FFmpeg, as did `Sound/Menue.mp3`. Five PNG look-reference frames per video are
sampled at 10%,30%,50%,70%,90% of duration. They are representative key moments,
not claimed independently decodable codec I-frames (FFmpeg reports no useful
key-frame flag here). Decode logs and full ffprobe metadata accompany them.
No full movie transcoding was saved.

Other CD material comprises standard PE executables/DLLs, four Microsoft Cabinet
archives (DirectX support), ICO, autorun INF, README text and the manual PDF.
Those are identified, not executed or exhaustively unpacked because they do not
contain the requested game art. `directx/runme.dat` is auxiliary installer data.

## Validation and remaining uncertainty

The 17 Blender views include twelve requested building/weapon mesh samples,
two additional building themes, an older-format icicle, an older-format palace
shadow, and a reconstructed tree billboard. OBJ materials were imported from MTL.
Camera-facing/studio render choices are preview settings, not original game lighting.
The palace, wall, tower, house, treasury, windmill base, catapult frame, cannon barrel,
trebuchet frame, ballista frame, Hellfire frame and zeppelin balloon were inspected
for geometry and UV continuity. These are per-piece assets; windmill blades and
weapon moving pieces are intentionally separate files.

Remaining limits, with bytes preserved rather than guessed:

* Runtime skeleton/articulation and weapon assembly transforms are not in these
  mesh files; their logic lives elsewhere in the engine. Geometry and separate
  flags' frame meshes are available, but no complete firing animation is claimed.
* Dynamic material IDs 0,2,3 and compass IDs 80,81 have no resolved static texture.
  0 commonly denotes untextured geometry. Other file-backed materials were resolved,
  including light-map ID 1599 and special-effect IDs from the executable table.
* Type-22 material direction vectors, renderer blend/color-key flags, seven tag-23
  chunks, 6DO serialized header fields and extra BSP fields remain partially assigned.
* Scenario conditions, exact map mask/sky meaning, atlas UV transforms, orientation
  zero/sign, global placement scale, and some gameplay modifiers need further work.
* No numeric ballistic trajectory/damage formula is claimed. Static costs/reloads
  are exact table reads, but values are not a complete simulation specification.

Hex evidence for unassigned structures is appended below. The raw archive extraction
and JSON mean these uncertainties do not require repeating the compression work.

## Re-run from scratch

Run from repository root. Required native tools: Python 3.12, Pillow 10.2.0,
FFmpeg/ffprobe, and Blender 4.5.14 at the path shown. All Python invocations use `-I`;
`-B` additionally avoids import caches. Use a new output directory for a clean rip,
or the existing directory for an idempotent rerun. No installer execution is needed.

```bash
python3 -I -B scripts/rip/test_rip.py
python3 -I -B scripts/rip/rip_all.py downloads/en-iso/iso assets-ripped --render
python3 -I -B scripts/rip/make_report.py assets-ripped research/08-iso-formats-and-rip.md
```

Individual stages:

```bash
python3 -I -B scripts/rip/unpack_cpr.py downloads/en-iso/iso/Data/Main.cpr assets-ripped/Main
python3 -I -B scripts/rip/unpack_tex.py downloads/en-iso/iso/Graphics assets-ripped/tex
python3 -I -B scripts/rip/tex2png.py assets-ripped/tex assets-ripped/textures
python3 -I -B scripts/rip/tex2png.py assets-ripped/Main assets-ripped/images
python3 -I -B scripts/rip/unpack_sks.py downloads/en-iso/iso/Videos assets-ripped/sks
python3 -I -B scripts/rip/decode_data.py assets-ripped/Main assets-ripped/data
python3 -I -B scripts/rip/mesh2obj.py assets-ripped/Main/Objects assets-ripped/meshes
python3 -I -B scripts/rip/mesh2obj.py assets-ripped/Main/Objects/Buildings assets-ripped/variants/Schnee --theme Schnee
python3 -I -B scripts/rip/unpack_installer.py downloads/en-iso/iso/MinInst.exe assets-ripped/installers/MinInst
python3 -I -B scripts/rip/reference_media.py downloads/en-iso/iso assets-ripped/video-frames
python3 -I -B scripts/rip/verify_outputs.py assets-ripped
/home/tobias/Apps/blender-4.5.14-linux-x64/blender -b -t 4 --python scripts/rip/render_thumbs.py -- --extras
python3 -I -B scripts/rip/verify_outputs.py assets-ripped
```

The full driver also creates Wueste/Vulkan/Alien variants and reads MaxInst.
Every extractor accepts an input path and output directory. The single-image
converter instead accepts an output PNG path when its input is a file.
Manifest hashes verify raw members; the final verifier checks OBJ face counts and
all vertex/normal/UV indices. Exports never become imports into src/ automatically.

## Source identity

- Main.cpr: `d9344578a8a99961da9824030c43fb1940920228c77fb8a44617279669c9f0c5`
- Ballerburg.exe: `1856b61fb8654aaefcc3f8e2b16918999e9f3fc325b08ad761dd0079dac01c9a`

## Asset categories and output counts

| Category | Count | Output |
|---|---:|---|
| CPR .6do | 133 | `assets-ripped/Main/Objects; meshes/` |
| CPR .7do | 482 | `assets-ripped/Main/Objects; meshes/` |
| CPR .alp | 28 | `assets-ripped/Main/Level; data/levels/` |
| CPR .bmp | 31 | `assets-ripped/Main/Images; images/` |
| CPR .dat | 33 | `assets-ripped/Main/Data; data/` |
| CPR .him | 28 | `assets-ripped/Main/Level; data/levels/` |
| CPR .hmm | 28 | `assets-ripped/Main/Level; data/levels/` |
| CPR .jpg | 231 | `assets-ripped/Main/Images; images/` |
| CPR .odn | 74 | `assets-ripped/Main/Data/Kampagne; data/scenarios/` |
| CPR .pda | 464 | `assets-ripped/Main/Particles; data/particles/` |
| CPR .plateau | 257 | `assets-ripped/Main/Data/Plateaus; data/layouts/` |
| CPR .pln | 28 | `assets-ripped/Main/Level; data/levels/` |
| CPR .raw | 2 | `assets-ripped/Main/Images/Special` |
| CPR .tga | 428 | `assets-ripped/Main/Images; images/` |
| CPR .tre | 28 | `assets-ripped/Main/Level; data/levels/` |
| CPR .wav | 107 | `assets-ripped/Main/Sound` |
| TEX packs | 51 | `assets-ripped/tex/` |
| TEX embedded images / PNGs | 2155 | `assets-ripped/tex/; textures/` |
| CPR image PNGs | 690 | `assets-ripped/images/` |
| SKS containers | 112 | `assets-ripped/sks/` |
| SKS JPEG frames | 1680 | `assets-ripped/sks/` |
| Tree billboard images (included in CPR images) | 252 | `assets-ripped/images/Images/Trees/` |
| Additional themed building OBJ+MTL+JSON variants | 808 | `assets-ripped/variants/` |
| Installer members per installer | 243 | `assets-ripped/installers/MinInst; installers/MaxInst` |
| Video reference frames | 10 | `assets-ripped/video-frames/` |
| Original meshes exported | 615 | `assets-ripped/meshes/` |
| Original Bink videos | 15 | `downloads/en-iso/iso/Videos/`; two probed, ten selected frames in output |
| Original MP3 files | 647 | `downloads/en-iso/iso/Sound/`; Menue.mp3 fully decode-checked |
| Original PE executable / DLL files | 9 / 7 | Original CD tree; never executed |
| DirectX Cabinet archives | 4 | `downloads/en-iso/iso/directx/`; identified only |
| Manual PDF / README TXT / autorun INF / ICO / auxiliary DAT | 1 each | Original CD tree; retained |

The CPR produces **200,406,977 bytes** from **2,382 members**. Original mesh files contain **130,189 triangles** after 6DO polygon triangulation; default OBJ exports contain **121,863 triangles** after removal of duplicate reflection passes. There are no zero-triangle mesh exports. Theme variants are not counted as new original meshes.

| Mesh category | Files |
|---|---:|
| Buehnen | 9 |
| Buildings | 202 |
| BuildingsHighlight | 116 |
| GroundPlanes | 18 |
| LightObjects | 9 |
| LightObjectsAlien | 9 |
| Misc | 10 |
| Objects | 103 |
| ObjectsHighlight | 43 |
| Shadows | 93 |
| Wolken | 3 |

## Gameplay table values

These are numeric table values, not numbers inferred from screenshots. Table addresses and encoding are listed in `data/gameplay.json`. A dash in the source name means a reserved/unused type. Weapon footprints and prices are retained even for those slots.

| ID | English name | Build gold | Footprint | Build seconds | Defence | Reload seconds | Base shot gold | Without workshop (base ×1.5, truncated) | Powder coefficient |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | Small wall | 100 | 1 | 10 | 40 | — | — | — | — |
| 1 | Small wall | 100 | 1 | 10 | 40 | — | — | — | — |
| 2 | Small wall | 100 | 1 | 10 | 40 | — | — | — | — |
| 3 | Small wall | 100 | 1 | 10 | 40 | — | — | — | — |
| 4 | Small wall | 100 | 1 | 10 | 40 | — | — | — | — |
| 5 | Small wall | 100 | 1 | 10 | 40 | — | — | — | — |
| 6 | Big wall | 100 | 1 | 15 | 60 | — | — | — | — |
| 7 | Big wall | 100 | 1 | 15 | 60 | — | — | — | — |
| 8 | Big wall | 100 | 1 | 15 | 60 | — | — | — | — |
| 9 | Big wall | 100 | 1 | 15 | 60 | — | — | — | — |
| 10 | Big wall | 100 | 1 | 15 | 60 | — | — | — | — |
| 11 | Big wall | 100 | 1 | 15 | 60 | — | — | — | — |
| 12 | Small tower | 500 | 1 | 18 | 72 | — | — | — | — |
| 13 | Big tower | 500 | 1 | 24 | 96 | — | — | — | — |
| 14 | Giant tower | 1200 | 2 | 24 | 128 | — | — | — | — |
| 15 | Gatehouse | 150 | 2 | 0 | 96 | — | — | — | — |
| 16 | - | 0 | 1 | 0 | 8 | — | — | — | — |
| 17 | Super weapon | 5000 | 3 | 90 | 96 | — | — | — | — |
| 18 | Farmhouse | 500 | 2 | 9 | 12 | — | — | — | — |
| 19 | Inn | 500 | 2 | 15 | 20 | — | — | — | — |
| 20 | Mason's Yard | 700 | 2 | 15 | 24 | — | — | — | — |
| 21 | Ammo workshop | 600 | 2 | 18 | 24 | — | — | — | — |
| 22 | Smithy | 700 | 2 | 24 | 24 | — | — | — | — |
| 23 | - | 1200 | 2 | 60 | 48 | — | — | — | — |
| 24 | Treasury | 300 | 2 | 15 | 48 | — | — | — | — |
| 25 | Windmill | 300 | 4 | 30 | 24 | — | — | — | — |
| 26 | Superbrain | 900 | 2 | 32 | 32 | — | — | — | — |
| 27 | Mage tower | 900 | 4 | 32 | 64 | — | — | — | — |
| 28 | Idol | 700 | 2 | 15 | 24 | — | — | — | — |
| 29 | Palace | 2000 | 4 | 50 | 200 | — | — | — | — |
| 30 | Trampoline | 0 | 4 | 0 | 12 | — | — | — | — |
| 31 | Ground weapon | 0 | 3 | 0 | 60 | — | — | — | — |
| 32 | Ground weapon | 0 | 3 | 0 | 96 | — | — | — | — |
| 33 | Zeppelin | 0 | 4 | 0 | 12 | — | — | — | — |
| 34 | Catapult | 600 | 3 | — | — | 18 | 35 | 52 | 0 |
| 35 | Fire catapult | 750 | 3 | — | — | 24 | 100 | 150 | 0 |
| 36 | Long John | 600 | 3 | — | — | 18 | 90 | 135 | 0 |
| 37 | Hot Helga | 750 | 3 | — | — | 24 | 150 | 225 | 0 |
| 38 | Trebuchet | 850 | 3 | — | — | 18 | 150 | 225 | 0 |
| 39 | - | 1500 | 3 | — | — | 14 | 10 | 15 | 0 |
| 40 | - | 1500 | 3 | — | — | 14 | 10 | 15 | 0 |
| 41 | - | 1500 | 3 | — | — | 14 | 10 | 15 | 0 |
| 42 | - | 1500 | 3 | — | — | 14 | 10 | 15 | 0 |
| 43 | Ballista | 400 | 1 | — | — | 15 | 15 | 22 | 0 |
| 44 | Fire ballista | 400 | 1 | — | — | 15 | 100 | 150 | 0 |
| 45 | Arcaballista | 850 | 3 | — | — | 18 | 200 | 300 | 0 |
| 46 | Cannon | 750 | 1 | — | — | 22 | 60 | 90 | 1 |
| 47 | Double cannon | 750 | 1 | — | — | 22 | 100 | 150 | 2 |
| 48 | Quad launcher | 800 | 1 | — | — | 30 | 300 | 450 | 1 |
| 49 | Fat Freda | 850 | 3 | — | — | 22 | 150 | 225 | 1 |
| 50 | Hellfire | 850 | 3 | — | — | 22 | 220 | 330 | 5 |
| 51 | Rocket launcher | 800 | 1 | — | — | 30 | 100 | 150 | 1 |
| 52 | Zeppelin | 700 | 4 | — | — | 1 | 150 | 225 | 0 |
| 53 | Transport balloon | 0 | 4 | — | — | 1 | 0 | 0 | 0 |

Evidence: build-price and defence-table reads at VA 0x403913/0x403927; footprint reads at 0x403c9d; construction-time reads at 0x406aa2; reload reads at 0x406c88 and 0x453151; shot-cost reads at 0x4248cc and 0x4531fa. HUD workshop adjustment at 0x45323b–0x45325e multiplies by 15 and divides by 10. This explains the English catapult value 52 from base 35. Powder and upgrades can add costs, so these base numbers do not override every dynamic rule.

## Scenario/layout links

| Scenario | Bytes | Level | Theme byte | Layout IDs for four slots | Gold candidates |
|---|---:|---:|---:|---|---|
| Lv0_0_1.odn | 324 | 8 | 0 | [0, 0, 0, 0] | [2000, 2000, 2000, 2000] |
| Lv1_1_1.odn | 324 | 0 | 0 | [0, 255, 255, 1] | [5000, 0, 0, 500] |
| Lv1_2_1.odn | 324 | 2 | 2 | [255, 3, 2, 255] | [0, 750, 1500, 0] |
| Lv1_3_1.odn | 324 | 5 | 0 | [4, 255, 5, 255] | [1000, 0, 400, 0] |
| Lv1_4_1.odn | 324 | 1 | 0 | [6, 255, 255, 7] | [500, 0, 0, 500] |
| Lv1_4_2.odn | 292 | 3 | 1 | [255, 6, 7, 255] | [0, 2000, 1500, 0] |
| Lv1_5_1.odn | 324 | 15 | 0 | [8, 255, 9, 255] | [600, 0, 250, 0] |
| Lv1_6_1.odn | 324 | 19 | 3 | [10, 255, 255, 11] | [300, 0, 0, 700] |
| Lv1_7_1.odn | 324 | 0 | 3 | [255, 12, 13, 14] | [0, 100, 700, 500] |
| Lv1_8_1.odn | 324 | 12 | 0 | [15, 16, 18, 17] | [1000, 500, 300, 300] |
| Lv2_1_1.odn | 324 | 8 | 0 | [19, 255, 255, 20] | [800, 0, 0, 300] |
| Lv2_1_2.odn | 324 | 8 | 0 | [19, 255, 255, 20] | [300, 0, 0, 200] |
| Lv2_2_1.odn | 324 | 12 | 1 | [23, 21, 24, 22] | [700, 800, 5000, 100] |
| Lv2_3_1.odn | 324 | 9 | 0 | [27, 25, 26, 255] | [500, 500, 500, 0] |
| Lv2_3_2.odn | 292 | 10 | 0 | [55, 56, 255, 57] | [500, 500, 0, 500] |
| Lv2_4_1.odn | 324 | 14 | 3 | [28, 29, 30, 31] | [500, 500, 500, 300] |
| Lv2_4_2.odn | 324 | 14 | 3 | [28, 29, 30, 31] | [500, 500, 500, 500] |
| Lv2_5_1.odn | 324 | 17 | 0 | [32, 255, 255, 33] | [400, 0, 0, 800] |
| Lv2_5_2.odn | 324 | 17 | 0 | [32, 255, 255, 33] | [700, 0, 0, 500] |
| Lv2_6_1.odn | 324 | 18 | 0 | [34, 35, 36, 255] | [600, 500, 500, 0] |
| Lv2_6_2.odn | 324 | 18 | 0 | [34, 35, 36, 255] | [500, 500, 500, 0] |
| Lv2_7_1.odn | 324 | 21 | 0 | [37, 255, 255, 38] | [300, 0, 0, 400] |
| Lv2_8_1.odn | 324 | 26 | 3 | [40, 41, 42, 39] | [500, 500, 500, 500] |
| Lv2_8_2.odn | 292 | 26 | 0 | [72, 73, 74, 71] | [650, 600, 600, 600] |
| Lv3_1_1.odn | 324 | 17 | 0 | [43, 44, 45, 255] | [500, 200, 400, 0] |
| Lv3_2_1.odn | 324 | 3 | 0 | [46, 47, 49, 48] | [600, 400, 400, 600] |
| Lv3_2_2.odn | 324 | 3 | 0 | [46, 255, 255, 48] | [500, 0, 0, 300] |
| Lv3_3_1.odn | 324 | 15 | 1 | [51, 53, 52, 50] | [700, 300, 300, 500] |
| Lv3_3_2.odn | 324 | 14 | 2 | [105, 106, 104, 255] | [3000, 1200, 1200, 1000] |
| Lv3_4_1.odn | 324 | 16 | 3 | [255, 55, 54, 56] | [0, 400, 400, 300] |
| Lv3_5_1.odn | 324 | 26 | 0 | [57, 58, 255, 255] | [400, 500, 0, 0] |
| Lv3_5_2.odn | 324 | 26 | 0 | [57, 58, 255, 255] | [300, 500, 0, 0] |
| Lv3_6_1.odn | 324 | 25 | 0 | [59, 255, 60, 61] | [1500, 0, 300, 200] |
| Lv3_7_1.odn | 324 | 21 | 0 | [65, 255, 255, 66] | [1000, 0, 0, 1000] |
| Lv3_8_1.odn | 324 | 24 | 0 | [62, 255, 62, 64] | [700, 0, 500, 500] |
| Lv3_9_1.odn | 324 | 24 | 0 | [62, 255, 62, 64] | [700, 0, 500, 500] |
| Lv4_1_1.odn | 324 | 10 | 0 | [67, 255, 68, 69] | [800, 0, 500, 500] |
| Lv4_1_2.odn | 324 | 4 | 0 | [67, 255, 68, 69] | [1000, 0, 500, 500] |
| Lv4_2_1.odn | 324 | 4 | 0 | [70, 255, 71, 72] | [1000, 0, 500, 500] |
| Lv4_3_1.odn | 324 | 15 | 0 | [73, 255, 74, 75] | [300, 0, 700, 700] |
| Lv4_4_1.odn | 324 | 23 | 1 | [77, 76, 255, 255] | [200, 700, 0, 0] |
| Lv4_5_1.odn | 324 | 22 | 1 | [255, 79, 255, 78] | [0, 200, 0, 1000] |
| Lv4_5_2.odn | 324 | 22 | 1 | [255, 79, 255, 78] | [0, 200, 0, 1000] |
| Lv4_6_1.odn | 324 | 21 | 2 | [80, 255, 81, 82] | [1500, 0, 1800, 1500] |
| Lv4_6_2.odn | 324 | 21 | 2 | [80, 255, 81, 82] | [500, 0, 1200, 500] |
| Lv4_7_1.odn | 324 | 26 | 2 | [83, 84, 85, 255] | [500, 500, 1200, 0] |
| Lv4_8_1.odn | 324 | 24 | 2 | [86, 82, 88, 80] | [500, 500, 1500, 500] |
| Lv5_10_1.odn | 324 | 0 | 0 | [0, 255, 255, 1] | [5000, 0, 0, 500] |
| Lv5_11_1.odn | 324 | 21 | 0 | [180, 180, 180, 180] | [3000, 1500, 1500, 1500] |
| Lv5_12_1.odn | 324 | 18 | 0 | [140, 140, 140, 140] | [5000, 10000, 10000, 10000] |
| Lv5_13_1.odn | 324 | 27 | 0 | [215, 180, 180, 212] | [500, 0, 0, 500] |
| Lv5_1_1.odn | 324 | 18 | 0 | [253, 255, 255, 253] | [5000, 0, 0, 500] |
| Lv5_1_2.odn | 324 | 8 | 0 | [253, 255, 255, 253] | [500, 0, 0, 500] |
| Lv5_2_1.odn | 324 | 0 | 0 | [167, 255, 255, 170] | [500, 500, 500, 500] |
| Lv5_3_1.odn | 324 | 0 | 0 | [168, 255, 170, 170] | [1000, 500, 500, 500] |
| Lv5_4_1.odn | 324 | 0 | 0 | [173, 255, 171, 171] | [750, 500, 500, 500] |
| Lv5_5_1.odn | 324 | 0 | 0 | [167, 255, 255, 170] | [500, 500, 500, 500] |
| Lv5_6_1.odn | 324 | 0 | 0 | [168, 255, 170, 170] | [1000, 500, 500, 500] |
| Lv5_7_1.odn | 324 | 0 | 0 | [169, 170, 170, 170] | [2000, 500, 500, 500] |
| Lv5_8_1.odn | 324 | 0 | 0 | [254, 255, 255, 154] | [500, 0, 0, 500] |
| Lv5_9_1.odn | 324 | 21 | 0 | [250, 255, 255, 250] | [0, 0, 0, 0] |
| Lv6_1_1.odn | 324 | 0 | 0 | [150, 255, 151, 255] | [50000, 0, 500, 0] |
| Lv6_1_2.odn | 324 | 2 | 0 | [253, 253, 253, 253] | [1000, 1000, 1000, 1000] |
| Lv6_2_1.odn | 324 | 0 | 0 | [153, 255, 255, 152] | [50000, 0, 0, 500] |
| Lv6_3_1.odn | 324 | 0 | 0 | [154, 156, 155, 157] | [50000, 500, 500, 500] |
| Lv7_1_1.odn | 324 | 0 | 0 | [0, 0, 0, 0] | [0, 0, 0, 0] |
| Lv7_1_2.odn | 324 | 7 | 0 | [220, 2, 1, 3] | [200, 5000, 5000, 5000] |
| Lv7_2_1.odn | 324 | 0 | 0 | [0, 0, 0, 0] | [0, 0, 0, 0] |
| Lv7_3_1.odn | 324 | 0 | 0 | [0, 0, 0, 0] | [1500, 1500, 1500, 1500] |
| Lv7_4_1.odn | 324 | 0 | 0 | [0, 0, 0, 0] | [500, 500, 500, 500] |
| Lv8_1_1.odn | 324 | 0 | 0 | [0, 0, 0, 0] | [0, 0, 0, 0] |
| Lv8_2_1.odn | 324 | 0 | 0 | [0, 0, 0, 0] | [1500, 1500, 1500, 1500] |
| Lv8_3_1.odn | 324 | 0 | 0 | [0, 0, 0, 0] | [1500, 1500, 1500, 1500] |
| Lv8_4_1.odn | 324 | 0 | 0 | [0, 0, 0, 0] | [500, 500, 500, 500] |

## Media verification

| Input | Streams | Duration | Sample times |
|---|---|---:|---|
| Intro.bik | binkvideo, binkaudio_rdft | 171.266667 s | 17.127, 51.380, 85.633, 119.887, 154.140 |
| Hoellenorgel.bik | binkvideo, binkaudio_rdft | 10.000000 s | 1.000, 3.000, 5.000, 7.000, 9.000 |
| Menue.mp3 | mp3 | 180.105750 s |  |

## Every original named mesh

Paths below are relative to `Main/Objects/`; matching OBJ/MTL/JSON paths are under `meshes/` with the same relative name. Triangle column is default OBJ count; source column includes renderer reflection passes. Texture filenames name decoded PNGs. `dynamic:N` means the numeric reference is preserved but not mapped.

| Internal name | OBJ triangles | Source triangles | Texture PNGs |
|---|---:|---:|---|
| `Buehnen/b_a_01.6do` | 80 | 80 | b_a_01/1960.png, b_a_01/1961.png, b_a_01/1962.png |
| `Buehnen/b_ga_01.6do` | 80 | 80 | b_ga_01/1960.png, b_ga_01/1961.png, b_ga_01/1962.png |
| `Buehnen/b_s_01.6do` | 80 | 80 | b_s_01/1960.png, b_s_01/1961.png, b_s_01/1962.png |
| `Buehnen/b_s_02.6do` | 80 | 80 | b_s_02/1960.png, b_s_02/1961.png, b_s_02/1962.png |
| `Buehnen/b_s_03.6do` | 80 | 80 | b_s_03/1960.png, b_s_03/1961.png, b_s_03/1962.png |
| `Buehnen/b_v_01.6do` | 80 | 80 | b_v_01/1960.png, b_v_01/1961.png, b_v_01/1962.png |
| `Buehnen/b_wi_01.6do` | 80 | 80 | b_wi_01/1960.png, b_wi_01/1961.png, b_wi_01/1962.png, b_wi_01/1963.png |
| `Buehnen/b_wi_02.6do` | 80 | 80 | b_wi_02/1960.png, b_wi_02/1961.png, b_wi_02/1962.png |
| `Buehnen/b_wi_03.6do` | 80 | 80 | b_wi_03/1960.png, b_wi_03/1961.png, b_wi_03/1962.png |
| `Buildings/Burgtor_z0.7DO` | 496 | 496 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1537.png |
| `Buildings/Burgtor_z0_lp.7DO` | 147 | 147 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1537.png |
| `Buildings/Burgtor_z1.7DO` | 690 | 690 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1538.png |
| `Buildings/Burgtor_z1_lp.7DO` | 169 | 169 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1538.png |
| `Buildings/Burgtor_z2.7DO` | 554 | 554 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1537.png |
| `Buildings/Burgtor_z2_lp.7DO` | 178 | 178 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1537.png |
| `Buildings/Burgtor_z3.7DO` | 269 | 269 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1502.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png |
| `Buildings/Burgtor_z3_lp.7DO` | 142 | 142 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/Kneipe_ruine.7DO` | 342 | 342 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1549.png |
| `Buildings/Kneipe_z0.7DO` | 213 | 213 | GebaeudeSet_Grass/1525.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1549.png |
| `Buildings/LavaKrater.7DO` | 27 | 27 | GebaeudeSet_Grass/1557.png |
| `Buildings/MauerGross_0_z0.7DO` | 146 | 146 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerGross_0_z0_lp.7DO` | 90 | 90 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_0_z1.7DO` | 194 | 194 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1502.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1538.png |
| `Buildings/MauerGross_0_z1_lp.7DO` | 138 | 138 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1502.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_0_z2.7DO` | 111 | 111 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_0_z2_lp.7DO` | 92 | 92 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_0_z3.7DO` | 60 | 60 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_0_z3_lp.7DO` | 52 | 52 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_1_z0.7DO` | 134 | 134 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerGross_1_z0_lp.7DO` | 62 | 62 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_1_z1.7DO` | 158 | 158 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerGross_1_z1_lp.7DO` | 64 | 64 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_1_z2.7DO` | 66 | 66 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png |
| `Buildings/MauerGross_1_z2_lp.7DO` | 53 | 53 | GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_1_z3.7DO` | 59 | 59 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_1_z3_lp.7DO` | 35 | 35 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_2a_z0.7DO` | 122 | 122 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerGross_2a_z0_lp.7DO` | 42 | 42 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_2a_z1.7DO` | 164 | 164 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1538.png |
| `Buildings/MauerGross_2a_z1_lp.7DO` | 46 | 46 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_2a_z2.7DO` | 86 | 86 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_2a_z2_lp.7DO` | 48 | 48 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_2a_z3.7DO` | 96 | 96 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png |
| `Buildings/MauerGross_2a_z3_lp.7DO` | 32 | 32 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_2b_z0.7DO` | 146 | 146 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerGross_2b_z0_lp.7DO` | 60 | 60 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_2b_z1.7DO` | 179 | 179 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerGross_2b_z1_lp.7DO` | 64 | 64 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_2b_z2.7DO` | 94 | 94 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_2b_z2_lp.7DO` | 48 | 48 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_2b_z3.7DO` | 107 | 107 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_2b_z3_lp.7DO` | 32 | 32 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_3_z0.7DO` | 142 | 142 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerGross_3_z0_lp.7DO` | 54 | 54 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_3_z1.7DO` | 199 | 199 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerGross_3_z1_lp.7DO` | 62 | 62 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_3_z2.7DO` | 86 | 86 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_3_z2_lp.7DO` | 38 | 38 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_3_z3.7DO` | 86 | 86 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_3_z3_lp.7DO` | 26 | 26 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_4_z0.7DO` | 162 | 162 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerGross_4_z0_lp.7DO` | 66 | 66 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_4_z1.7DO` | 222 | 222 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1538.png |
| `Buildings/MauerGross_4_z1_lp.7DO` | 74 | 74 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_4_z2.7DO` | 86 | 86 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_4_z2_lp.7DO` | 38 | 38 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerGross_4_z3.7DO` | 86 | 86 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerGross_4_z3_lp.7DO` | 26 | 26 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_0_Z1.7DO` | 202 | 202 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerKlein_0_z0.7DO` | 154 | 154 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerKlein_0_z0_lp.7DO` | 66 | 66 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_0_z1_lp.7DO` | 122 | 122 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_0_z2.7DO` | 110 | 110 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_0_z2_lp.7DO` | 100 | 100 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_0_z3.7DO` | 82 | 82 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_0_z3_lp.7DO` | 60 | 60 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_1_z0.7DO` | 138 | 138 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerKlein_1_z0_lp.7DO` | 50 | 50 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_1_z1.7DO` | 152 | 152 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerKlein_1_z1_lp.7DO` | 68 | 68 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_1_z2.7DO` | 81 | 81 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_1_z2_lp.7DO` | 53 | 53 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_1_z3.7DO` | 70 | 70 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_1_z3_lp.7DO` | 35 | 35 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_2a_z0.7DO` | 122 | 122 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerKlein_2a_z0_lp.7DO` | 34 | 34 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_2a_z1.7DO` | 174 | 174 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1538.png |
| `Buildings/MauerKlein_2a_z1_lp.7DO` | 46 | 46 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_2a_z2.7DO` | 89 | 89 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_2a_z2_lp.7DO` | 38 | 38 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_2a_z3.7DO` | 88 | 88 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_2a_z3_lp.7DO` | 26 | 26 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_2b_z0.7DO` | 148 | 148 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerKlein_2b_z0_lp.7DO` | 60 | 60 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_2b_z1.7DO` | 184 | 184 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerKlein_2b_z1_lp.7DO` | 64 | 64 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_2b_z2.7DO` | 126 | 126 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_2b_z2_lp.7DO` | 48 | 48 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_2b_z3.7DO` | 89 | 89 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_2b_z3_lp.7DO` | 32 | 32 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_3_z0_lp.7DO` | 46 | 46 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_3_z1_lp.7DO` | 58 | 58 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_3_z2_lp.7DO` | 38 | 38 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_3_z3_lp.7DO` | 26 | 26 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_4_z0.7DO` | 162 | 162 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/MauerKlein_4_z0_lp.7DO` | 58 | 58 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_4_z1.7DO` | 201 | 201 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1538.png |
| `Buildings/MauerKlein_4_z1_lp.7DO` | 70 | 70 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_4_z2.7DO` | 89 | 89 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_4_z2_lp.7DO` | 38 | 38 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/MauerKlein_4_z3.7DO` | 88 | 88 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/MauerKlein_4_z3_lp.7DO` | 26 | 26 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/Mauerklein_3_z0.7DO` | 142 | 142 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/Mauerklein_3_z1.7DO` | 181 | 181 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1538.png |
| `Buildings/Mauerklein_3_z2.7DO` | 89 | 89 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/Mauerklein_3_z3.7DO` | 88 | 88 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/Ruine_1x1_1_lp.7DO` | 87 | 87 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1534.png |
| `Buildings/Ruine_1x1_2_lp.7DO` | 73 | 73 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1534.png |
| `Buildings/Ruine_2x2_1_lp.7DO` | 161 | 161 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1537.png |
| `Buildings/Ruine_2x2_2_lp.7DO` | 150 | 150 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1537.png |
| `Buildings/Superwaffe.7DO` | 2952 | 2952 | GebaeudeSet_Grass/1509.png, GebaeudeSet_Grass/1510.png, GebaeudeSet_Grass/1514.png, GebaeudeSet_Grass/1554.png, GebaeudeSet_Grass/1555.png |
| `Buildings/TurmGross_z0.7DO` | 242 | 242 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/TurmGross_z0_lp.7DO` | 86 | 86 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/TurmGross_z1.7DO` | 274 | 274 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1502.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1538.png |
| `Buildings/TurmGross_z1_lp.7DO` | 116 | 116 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/TurmGross_z2.7DO` | 272 | 272 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1502.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png |
| `Buildings/TurmGross_z2_lp.7DO` | 120 | 120 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/TurmGross_z3.7DO` | 86 | 86 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `Buildings/TurmGross_z3_lp.7DO` | 52 | 52 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1539.png |
| `Buildings/TurmKlein_z0.7DO` | 242 | 242 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `Buildings/TurmKlein_z0_lp.7DO` | 86 | 86 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1539.png |
| `Buildings/TurmKlein_z1.7DO` | 298 | 298 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1502.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1538.png |
| `Buildings/TurmKlein_z1_lp.7DO` | 136 | 136 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/TurmKlein_z2.7DO` | 292 | 292 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png |
| `Buildings/TurmKlein_z2_lp.7DO` | 128 | 128 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/TurmKlein_z3.7DO` | 89 | 89 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png |
| `Buildings/TurmKlein_z3_lp.7DO` | 52 | 52 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1539.png |
| `Buildings/bauernhaus_ruine.7DO` | 240 | 240 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1537.png |
| `Buildings/bauernhaus_z0.7DO` | 123 | 123 | GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1536.png, GebaeudeSet_Grass/1537.png |
| `Buildings/bauernhaus_z1.7DO` | 99 | 99 | GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1536.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1538.png |
| `Buildings/bauernhaus_z2.7DO` | 177 | 177 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1536.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1538.png |
| `Buildings/bauernhaus_z3.7DO` | 227 | 227 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1536.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1538.png |
| `Buildings/diamant.7DO` | 200 | 200 | GebaeudeSet_Grass/1550.png, GebaeudeSet_Grass/1558.png |
| `Buildings/erfinder_ruine.7DO` | 320 | 320 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1530.png, GebaeudeSet_Grass/1532.png, GebaeudeSet_Grass/1534.png |
| `Buildings/erfinder_z0.7DO` | 149 | 149 | GebaeudeSet_Grass/1528.png, GebaeudeSet_Grass/1529.png, GebaeudeSet_Grass/1530.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png |
| `Buildings/erfinder_z1.7DO` | 184 | 184 | GebaeudeSet_Grass/1528.png, GebaeudeSet_Grass/1529.png, GebaeudeSet_Grass/1530.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png, GebaeudeSet_Grass/1538.png |
| `Buildings/erfinder_z2.7DO` | 275 | 275 | GebaeudeSet_Grass/1528.png, GebaeudeSet_Grass/1529.png, GebaeudeSet_Grass/1530.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png |
| `Buildings/erfinder_z3.7DO` | 213 | 213 | GebaeudeSet_Grass/1528.png, GebaeudeSet_Grass/1529.png, GebaeudeSet_Grass/1530.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png |
| `Buildings/flagge_frame00.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame01.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame02.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame03.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame04.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame05.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame06.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame07.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame08.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame09.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/flagge_frame10.7do` | 73 | 73 | Waffen/501.png, GebaeudeSet_Grass/1527.png |
| `Buildings/kneipe_z1.7DO` | 101 | 101 | GebaeudeSet_Grass/1525.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1549.png |
| `Buildings/kneipe_z2.7DO` | 157 | 157 | GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1538.png |
| `Buildings/kneipe_z3.7DO` | 210 | 210 | GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1538.png |
| `Buildings/magierturm_ruine.7DO` | 765 | 765 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1543.png, GebaeudeSet_Grass/1544.png, GebaeudeSet_Grass/1550.png |
| `Buildings/magierturm_z0.7DO` | 666 | 666 | GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1543.png, GebaeudeSet_Grass/1544.png, GebaeudeSet_Grass/1549.png |
| `Buildings/magierturm_z1.7DO` | 683 | 683 | GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1543.png, GebaeudeSet_Grass/1544.png, GebaeudeSet_Grass/1549.png |
| `Buildings/magierturm_z2.7DO` | 704 | 704 | GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1543.png, GebaeudeSet_Grass/1544.png, GebaeudeSet_Grass/1549.png |
| `Buildings/magierturm_z3.7DO` | 690 | 690 | GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1543.png, GebaeudeSet_Grass/1544.png, GebaeudeSet_Grass/1549.png |
| `Buildings/palast_ruine.7DO` | 788 | 788 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1549.png |
| `Buildings/palast_z0.7DO` | 740 | 740 | GebaeudeSet_Grass/1517.png, GebaeudeSet_Grass/1518.png, GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1520.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1549.png |
| `Buildings/palast_z1.7DO` | 754 | 754 | GebaeudeSet_Grass/1517.png, GebaeudeSet_Grass/1518.png, GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1520.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1549.png |
| `Buildings/palast_z2.7DO` | 922 | 922 | GebaeudeSet_Grass/1517.png, GebaeudeSet_Grass/1518.png, GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1520.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1549.png |
| `Buildings/palast_z3.7DO` | 882 | 882 | GebaeudeSet_Grass/1516.png, GebaeudeSet_Grass/1517.png, GebaeudeSet_Grass/1518.png, GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1520.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1549.png |
| `Buildings/palast_z4.7DO` | 567 | 567 | GebaeudeSet_Grass/1516.png, GebaeudeSet_Grass/1517.png, GebaeudeSet_Grass/1518.png, GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1520.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1549.png |
| `Buildings/pulverfabrik_ruine.7DO` | 341 | 341 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1515.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1532.png, GebaeudeSet_Grass/1534.png |
| `Buildings/pulverfabrik_z0.7DO` | 181 | 181 | GebaeudeSet_Grass/1515.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png |
| `Buildings/pulverfabrik_z1.7DO` | 203 | 203 | GebaeudeSet_Grass/1515.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png, GebaeudeSet_Grass/1538.png |
| `Buildings/pulverfabrik_z2.7DO` | 243 | 243 | GebaeudeSet_Grass/1515.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png |
| `Buildings/pulverfabrik_z3.7DO` | 261 | 261 | GebaeudeSet_Grass/1515.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png |
| `Buildings/schatzkammer_ruine.7DO` | 426 | 426 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1521.png, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1556.png |
| `Buildings/schatzkammer_z0.7DO` | 29 | 29 | GebaeudeSet_Grass/1521.png, GebaeudeSet_Grass/1522.png, GebaeudeSet_Grass/1556.png |
| `Buildings/schatzkammer_z1.7DO` | 43 | 43 | GebaeudeSet_Grass/1521.png, GebaeudeSet_Grass/1522.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1556.png |
| `Buildings/schatzkammer_z2.7DO` | 118 | 118 | GebaeudeSet_Grass/1521.png, GebaeudeSet_Grass/1522.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1556.png |
| `Buildings/schatzkammer_z3.7DO` | 158 | 158 | GebaeudeSet_Grass/1521.png, GebaeudeSet_Grass/1522.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1556.png |
| `Buildings/schmiede_ruine.7DO` | 376 | 376 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1511.png, GebaeudeSet_Grass/1513.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1553.png |
| `Buildings/schmiede_z0.7DO` | 198 | 198 | GebaeudeSet_Grass/1511.png, GebaeudeSet_Grass/1512.png, GebaeudeSet_Grass/1513.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1553.png |
| `Buildings/schmiede_z1.7DO` | 182 | 182 | GebaeudeSet_Grass/1511.png, GebaeudeSet_Grass/1512.png, GebaeudeSet_Grass/1513.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1538.png |
| `Buildings/schmiede_z2.7DO` | 260 | 260 | GebaeudeSet_Grass/1511.png, GebaeudeSet_Grass/1512.png, GebaeudeSet_Grass/1513.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png |
| `Buildings/schmiede_z3.7DO` | 280 | 280 | GebaeudeSet_Grass/1511.png, GebaeudeSet_Grass/1512.png, GebaeudeSet_Grass/1513.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png |
| `Buildings/statue_ruine.7DO` | 176 | 176 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1551.png, GebaeudeSet_Grass/1552.png |
| `Buildings/statue_z0.7DO` | 900 | 900 | GebaeudeSet_Grass/1551.png, GebaeudeSet_Grass/1552.png |
| `Buildings/statue_z1.7DO` | 922 | 922 | GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1551.png, GebaeudeSet_Grass/1552.png |
| `Buildings/statue_z2.7DO` | 904 | 904 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1551.png, GebaeudeSet_Grass/1552.png |
| `Buildings/statue_z3.7DO` | 371 | 371 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1551.png, GebaeudeSet_Grass/1552.png |
| `Buildings/steinmetz_z0.7DO` | 176 | 176 | GebaeudeSet_Grass/1541.png, GebaeudeSet_Grass/1545.png, GebaeudeSet_Grass/1546.png, GebaeudeSet_Grass/1547.png, GebaeudeSet_Grass/1548.png |
| `Buildings/steinmetz_z1.7DO` | 181 | 181 | GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1541.png, GebaeudeSet_Grass/1545.png, GebaeudeSet_Grass/1546.png, GebaeudeSet_Grass/1547.png, GebaeudeSet_Grass/1548.png |
| `Buildings/steinmetz_z2.7DO` | 232 | 232 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1541.png, GebaeudeSet_Grass/1545.png, GebaeudeSet_Grass/1546.png, GebaeudeSet_Grass/1547.png, GebaeudeSet_Grass/1548.png |
| `Buildings/steinmetz_z3.7DO` | 121 | 121 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png, GebaeudeSet_Grass/1541.png, GebaeudeSet_Grass/1545.png, GebaeudeSet_Grass/1546.png |
| `Buildings/waffen_Ruine.7DO` | 190 | 190 | GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1540.png |
| `Buildings/windmuehle_ruine.7DO` | 462 | 462 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1506.png, GebaeudeSet_Grass/1507.png, GebaeudeSet_Grass/1534.png |
| `Buildings/windmuehle_spitze_z0.7DO` | 42 | 42 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1527.png |
| `Buildings/windmuehle_spitze_z1.7DO` | 56 | 56 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1538.png |
| `Buildings/windmuehle_spitze_z2.7DO` | 56 | 56 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1538.png |
| `Buildings/windmuehle_spitze_z3.7DO` | 56 | 56 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1538.png |
| `Buildings/windmuehle_z0.7DO` | 28 | 28 | GebaeudeSet_Grass/1506.png, GebaeudeSet_Grass/1534.png |
| `Buildings/windmuehle_z1.7DO` | 36 | 36 | GebaeudeSet_Grass/1506.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png |
| `Buildings/windmuehle_z2.7DO` | 198 | 198 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1506.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png |
| `Buildings/windmuehle_z3.7DO` | 173 | 173 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1506.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1538.png |
| `Buildings/windrad_z0.7DO` | 146 | 146 | GebaeudeSet_Grass/1507.png |
| `Buildings/windrad_z1.7DO` | 146 | 146 | GebaeudeSet_Grass/1507.png |
| `Buildings/windrad_z2.7DO` | 120 | 120 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1507.png |
| `Buildings/windrad_z3.7DO` | 55 | 55 | GebaeudeSet_Grass/1507.png |
| `BuildingsHighlight/Bauernhaus_z0_hl.7DO` | 121 | 121 | GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1536.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/Bauernhaus_z1_hl.7DO` | 82 | 82 | GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1536.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/Bauernhaus_z2_hl.7DO` | 132 | 132 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1536.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/Bauernhaus_z3_hl.7DO` | 181 | 181 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1536.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/Burgtor_z0_hl.7DO` | 540 | 540 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/Burgtor_z1_hl.7DO` | 540 | 540 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/Burgtor_z2_hl.7DO` | 470 | 470 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/Burgtor_z3_hl.7DO` | 202 | 202 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/Kneipe_z0_hl.7DO` | 237 | 237 | dynamic:0, dynamic:2, GebaeudeSet_Grass/1525.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/Kneipe_z1_hl.7DO` | 87 | 87 | dynamic:3, GebaeudeSet_Grass/1525.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1537.png, GebaeudeSet_Grass/1549.png |
| `BuildingsHighlight/Kneipe_z2_hl.7DO` | 123 | 123 | dynamic:0, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/Kneipe_z3_hl.7DO` | 177 | 177 | dynamic:2, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1535.png, GebaeudeSet_Grass/1537.png |
| `BuildingsHighlight/MagierHuette_z0_hl.7DO` | 666 | 666 | GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1543.png, GebaeudeSet_Grass/1544.png, GebaeudeSet_Grass/1549.png |
| `BuildingsHighlight/MagierHuette_z1_hl.7DO` | 666 | 666 | GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1543.png, GebaeudeSet_Grass/1544.png, GebaeudeSet_Grass/1549.png |
| `BuildingsHighlight/MagierHuette_z2_hl.7DO` | 666 | 666 | GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1543.png, GebaeudeSet_Grass/1544.png, GebaeudeSet_Grass/1549.png |
| `BuildingsHighlight/MagierHuette_z3_hl.7DO` | 627 | 627 | GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1523.png, GebaeudeSet_Grass/1524.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1543.png, GebaeudeSet_Grass/1544.png, GebaeudeSet_Grass/1549.png |
| `BuildingsHighlight/MauerGross_0_z0_hl.7DO` | 146 | 146 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_0_z1_hl.7DO` | 146 | 146 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_0_z2_hl.7DO` | 86 | 86 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_0_z3_hl.7DO` | 52 | 52 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_1_z0_hl.7DO` | 134 | 134 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_1_z1_hl.7DO` | 134 | 134 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_1_z2_hl.7DO` | 52 | 52 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_1_z3_hl.7DO` | 48 | 48 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_2a_z0_hl.7DO` | 122 | 122 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_2a_z1_hl.7DO` | 122 | 122 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_2a_z2_hl.7DO` | 58 | 58 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_2a_z3_hl.7DO` | 62 | 62 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_2b_z0_hl.7DO` | 146 | 146 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_2b_z1_hl.7DO` | 146 | 146 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_2b_z2_hl.7DO` | 66 | 66 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_2b_z3_hl.7DO` | 80 | 80 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_3_z0_hl.7DO` | 142 | 142 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_3_z1_hl.7DO` | 142 | 142 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_3_z2_hl.7DO` | 58 | 58 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_3_z3_hl.7DO` | 62 | 62 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_4_z0_hl.7DO` | 162 | 162 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_4_z1_hl.7DO` | 162 | 162 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerGross_4_z2._hl.7DO` | 58 | 58 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_4_z2_hl.7DO` | 86 | 86 | GebaeudeSet_Grass/1501.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerGross_4_z3_hl.7DO` | 62 | 62 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_0_Z1_hl.7DO` | 154 | 154 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_0_z0_hl.7DO` | 154 | 154 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_0_z2_hl.7DO` | 78 | 78 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_0_z3_hl.7DO` | 66 | 66 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_1_z0_hl.7DO` | 138 | 138 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_1_z1_hl.7DO` | 138 | 138 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_1_z2_hl.7DO` | 66 | 66 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_1_z3_hl.7DO` | 58 | 58 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_2a_z0_hl.7DO` | 122 | 122 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_2a_z1_hl.7DO` | 122 | 122 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_2a_z2_hl.7DO` | 58 | 58 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_2a_z3_hl.7DO` | 62 | 62 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_2b_z0_hl.7DO` | 148 | 148 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_2b_z1_hl.7DO` | 150 | 150 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_2b_z2_hl.7DO` | 94 | 94 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_2b_z3_hl.7DO` | 66 | 66 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_4_z0_hl.7DO` | 162 | 162 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_4_z1_hl.7DO` | 162 | 162 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/MauerKlein_4_z2_hl.7DO` | 58 | 58 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/MauerKlein_4_z3_hl.7DO` | 62 | 62 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/Mauerklein_3_z0_hl.7DO` | 142 | 142 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/Mauerklein_3_z1_hl.7DO` | 142 | 142 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/Mauerklein_3_z2_hl.7DO` | 58 | 58 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/Mauerklein_3_z3_hl.7DO` | 62 | 62 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/Superwaffe_hl.7DO` | 2952 | 2952 | GebaeudeSet_Grass/1509.png, GebaeudeSet_Grass/1510.png, GebaeudeSet_Grass/1514.png, GebaeudeSet_Grass/1554.png, GebaeudeSet_Grass/1555.png |
| `BuildingsHighlight/TurmGross_z0_hl.7DO` | 242 | 242 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/TurmGross_z1_hl.7DO` | 242 | 242 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/TurmGross_z2_hl.7DO` | 218 | 218 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/TurmGross_z3_hl.7DO` | 58 | 58 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/TurmKlein_z0_hl.7DO` | 242 | 242 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/TurmKlein_z1_hl.7DO` | 242 | 242 | GebaeudeSet_Grass/1500.png, GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png |
| `BuildingsHighlight/TurmKlein_z2_hl.7DO` | 220 | 220 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/TurmKlein_z3_hl.7DO` | 60 | 60 | GebaeudeSet_Grass/1504.png, GebaeudeSet_Grass/1508.png |
| `BuildingsHighlight/UniversalGenie_z0_hl.7DO` | 149 | 149 | GebaeudeSet_Grass/1528.png, GebaeudeSet_Grass/1529.png, GebaeudeSet_Grass/1530.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png |
| `BuildingsHighlight/UniversalGenie_z1_hl.7DO` | 148 | 148 | GebaeudeSet_Grass/1528.png, GebaeudeSet_Grass/1529.png, GebaeudeSet_Grass/1530.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png |
| `BuildingsHighlight/UniversalGenie_z2_hl.7DO` | 234 | 234 | GebaeudeSet_Grass/1528.png, GebaeudeSet_Grass/1529.png, GebaeudeSet_Grass/1530.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png, GebaeudeSet_Grass/1534.png |
| `BuildingsHighlight/UniversalGenie_z3_hl.7DO` | 205 | 205 | GebaeudeSet_Grass/1528.png, GebaeudeSet_Grass/1529.png, GebaeudeSet_Grass/1530.png, GebaeudeSet_Grass/1531.png, GebaeudeSet_Grass/1532.png, GebaeudeSet_Grass/1534.png |
| `BuildingsHighlight/diamant_hl.7DO` | 200 | 200 | dynamic:0 |
| `BuildingsHighlight/palast_z0_hl.7DO` | 740 | 740 | GebaeudeSet_Grass/1517.png, GebaeudeSet_Grass/1518.png, GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1520.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1549.png |
| `BuildingsHighlight/palast_z1_hl.7DO` | 742 | 742 | GebaeudeSet_Grass/1517.png, GebaeudeSet_Grass/1518.png, GebaeudeSet_Grass/1519.png, GebaeudeSet_Grass/1520.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1549.png |
| `BuildingsHighlight/palast_z2_hl.7DO` | 854 | 854 | dynamic:0 |
| `BuildingsHighlight/palast_z3_hl.7DO` | 801 | 801 | dynamic:0 |
| `BuildingsHighlight/palast_z4_hl.7DO` | 512 | 512 | dynamic:0 |
| `BuildingsHighlight/pulverfabrik_z0_hl.7DO` | 181 | 181 | dynamic:0 |
| `BuildingsHighlight/pulverfabrik_z1_hl.7DO` | 181 | 181 | dynamic:0 |
| `BuildingsHighlight/pulverfabrik_z2_hl.7DO` | 209 | 209 | dynamic:0 |
| `BuildingsHighlight/pulverfabrik_z3_hl.7DO` | 234 | 234 | dynamic:0 |
| `BuildingsHighlight/schatzkammer_z0_hl.7DO` | 29 | 29 | dynamic:0 |
| `BuildingsHighlight/schatzkammer_z1_hl.7DO` | 29 | 29 | dynamic:0 |
| `BuildingsHighlight/schatzkammer_z2_hl.7DO` | 86 | 86 | dynamic:0 |
| `BuildingsHighlight/schatzkammer_z3_hl.7DO` | 120 | 120 | dynamic:0 |
| `BuildingsHighlight/schmiede_z0_hl.7DO` | 200 | 200 | dynamic:0 |
| `BuildingsHighlight/schmiede_z1_hl.7DO` | 149 | 149 | dynamic:0 |
| `BuildingsHighlight/schmiede_z2_hl.7DO` | 200 | 200 | dynamic:0 |
| `BuildingsHighlight/schmiede_z3_hl.7DO` | 249 | 249 | dynamic:0 |
| `BuildingsHighlight/statue_z0_hl.7DO` | 900 | 900 | GebaeudeSet_Grass/1551.png, GebaeudeSet_Grass/1552.png |
| `BuildingsHighlight/statue_z1_hl.7DO` | 900 | 900 | GebaeudeSet_Grass/1551.png, GebaeudeSet_Grass/1552.png |
| `BuildingsHighlight/statue_z2_hl.7DO` | 871 | 871 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1551.png, GebaeudeSet_Grass/1552.png |
| `BuildingsHighlight/statue_z3_hl.7DO` | 333 | 333 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1551.png, GebaeudeSet_Grass/1552.png |
| `BuildingsHighlight/steinmetz_z0_hl.7DO` | 176 | 176 | dynamic:0 |
| `BuildingsHighlight/steinmetz_z1_hl.7DO` | 176 | 176 | GebaeudeSet_Grass/1541.png, GebaeudeSet_Grass/1545.png, GebaeudeSet_Grass/1546.png, GebaeudeSet_Grass/1547.png, GebaeudeSet_Grass/1548.png |
| `BuildingsHighlight/steinmetz_z2_hl.7DO` | 204 | 204 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1541.png, GebaeudeSet_Grass/1545.png, GebaeudeSet_Grass/1546.png, GebaeudeSet_Grass/1547.png, GebaeudeSet_Grass/1548.png |
| `BuildingsHighlight/steinmetz_z3_hl.7DO` | 84 | 84 | GebaeudeSet_Grass/1534.png, GebaeudeSet_Grass/1541.png, GebaeudeSet_Grass/1545.png, GebaeudeSet_Grass/1546.png |
| `BuildingsHighlight/windmuehle_spitze_z0_hl.7DO` | 42 | 42 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1527.png |
| `BuildingsHighlight/windmuehle_spitze_z1_hl.7DO` | 42 | 42 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1527.png |
| `BuildingsHighlight/windmuehle_spitze_z2_hl.7DO` | 46 | 46 | GebaeudeSet_Grass/1538.png |
| `BuildingsHighlight/windmuehle_spitze_z3_hl.7DO` | 46 | 46 | GebaeudeSet_Grass/1538.png |
| `BuildingsHighlight/windmuehle_z0_hl.7DO` | 28 | 28 | GebaeudeSet_Grass/1506.png, GebaeudeSet_Grass/1534.png |
| `BuildingsHighlight/windmuehle_z1_hl.7DO` | 28 | 28 | GebaeudeSet_Grass/1506.png, GebaeudeSet_Grass/1534.png |
| `BuildingsHighlight/windmuehle_z2_hl.7DO` | 146 | 146 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1506.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1534.png |
| `BuildingsHighlight/windmuehle_z3_hl.7DO` | 134 | 134 | GebaeudeSet_Grass/1505.png, GebaeudeSet_Grass/1506.png, GebaeudeSet_Grass/1527.png, GebaeudeSet_Grass/1533.png, GebaeudeSet_Grass/1534.png |
| `BuildingsHighlight/windrad_z0_hl.7DO` | 146 | 146 | GebaeudeSet_Grass/1507.png |
| `BuildingsHighlight/windrad_z1_hl.7DO` | 146 | 146 | GebaeudeSet_Grass/1507.png |
| `BuildingsHighlight/windrad_z2_hl.7DO` | 120 | 120 | GebaeudeSet_Grass/1503.png, GebaeudeSet_Grass/1507.png |
| `BuildingsHighlight/windrad_z3_hl.7DO` | 55 | 55 | GebaeudeSet_Grass/1507.png |
| `GroundPlanes/Hoellenorgel_groundplane.7do` | 24 | 24 | BodenSet_Grass/1980.png, BodenSet_Grass/1982.png, BodenSet_Grass/1983.png |
| `GroundPlanes/Kneipe_groundplane.7do` | 18 | 18 | BodenSet_Grass/1982.png, BodenSet_Grass/1983.png, BodenSet_Grass/1984.png |
| `GroundPlanes/Lavafeld_groundplane.7do` | 2 | 2 | BodenSet_Grass/1985.png |
| `GroundPlanes/Ruine1_groundplane.7do` | 2 | 2 | BodenSet_Grass/1989.png |
| `GroundPlanes/Ruine2_groundplane.7do` | 2 | 2 | BodenSet_Grass/1989.png |
| `GroundPlanes/Ruine3_groundplane.7do` | 2 | 2 | BodenSet_Grass/1989.png |
| `GroundPlanes/Trebuchet_groundplane.7do` | 24 | 24 | BodenSet_Grass/1980.png, BodenSet_Grass/1982.png, BodenSet_Grass/1983.png |
| `GroundPlanes/bauernhaus_groundplane.7do` | 18 | 18 | BodenSet_Grass/1980.png, BodenSet_Grass/1981.png, BodenSet_Grass/1982.png |
| `GroundPlanes/erfinder_groundplane.7do` | 18 | 18 | BodenSet_Grass/1980.png, BodenSet_Grass/1981.png, BodenSet_Grass/1982.png |
| `GroundPlanes/magierturm_groundplane.7do` | 18 | 18 | BodenSet_Grass/1982.png, BodenSet_Grass/1983.png, BodenSet_Grass/1984.png |
| `GroundPlanes/palast_groundplane.7do` | 18 | 18 | BodenSet_Grass/1986.png, BodenSet_Grass/1987.png, BodenSet_Grass/1988.png |
| `GroundPlanes/pulverfabrik_groundplane.7do` | 18 | 18 | BodenSet_Grass/1981.png, BodenSet_Grass/1982.png, BodenSet_Grass/1984.png |
| `GroundPlanes/schatzkammer_groundplane.7do` | 18 | 18 | BodenSet_Grass/1980.png, BodenSet_Grass/1981.png, BodenSet_Grass/1982.png |
| `GroundPlanes/schmiede_groundplane.7do` | 18 | 18 | BodenSet_Grass/1982.png, BodenSet_Grass/1983.png, BodenSet_Grass/1984.png |
| `GroundPlanes/statue_groundplane.7do` | 18 | 18 | BodenSet_Grass/1980.png, BodenSet_Grass/1981.png, BodenSet_Grass/1982.png |
| `GroundPlanes/steinmetz_groundplane.7do` | 18 | 18 | BodenSet_Grass/1980.png, BodenSet_Grass/1981.png, BodenSet_Grass/1982.png |
| `GroundPlanes/superwaffe_groundplane.7do` | 18 | 18 | BodenSet_Grass/1986.png, BodenSet_Grass/1987.png, BodenSet_Grass/1988.png |
| `GroundPlanes/windmuehle_groundplane.7do` | 18 | 18 | BodenSet_Grass/1982.png, BodenSet_Grass/1983.png, BodenSet_Grass/1984.png |
| `LightObjects/Burgtor_beleuchtung.6do` | 60 | 60 | Images/Special/Beleuchtung.png |
| `LightObjects/bauernhaus_beleuchtung.6do` | 101 | 101 | Images/Special/Beleuchtung.png |
| `LightObjects/erfinder_beleuchtung.6do` | 50 | 50 | Images/Special/Beleuchtung.png |
| `LightObjects/kneipe_beleuchtung.6do` | 100 | 100 | Images/Special/Beleuchtung.png |
| `LightObjects/magierturm_beleuchtung.6do` | 60 | 60 | Images/Special/Beleuchtung.png |
| `LightObjects/palast_beleuchtung.6do` | 130 | 130 | Images/Special/Beleuchtung.png |
| `LightObjects/pulverfabrik_beleuchtung.6do` | 120 | 120 | Images/Special/Beleuchtung.png |
| `LightObjects/schmiede_beleuchtung.6do` | 90 | 90 | Images/Special/Beleuchtung.png |
| `LightObjects/steinmetz_beleuchtung.6do` | 70 | 70 | Images/Special/Beleuchtung.png |
| `LightObjectsAlien/Bauernhaus_beleuchtung.6do` | 305 | 305 | Images/Special/Beleuchtung.png |
| `LightObjectsAlien/Burgtor_beleuchtung.6do` | 60 | 60 | Images/Special/Beleuchtung.png |
| `LightObjectsAlien/Erfinder_beleuchtung.6do` | 182 | 182 | Images/Special/Beleuchtung.png |
| `LightObjectsAlien/Kneipe_beleuchtung.6do` | 296 | 296 | Images/Special/Beleuchtung.png |
| `LightObjectsAlien/Palast_beleuchtung.6do` | 468 | 468 | Images/Special/Beleuchtung.png |
| `LightObjectsAlien/Pulverfabrik_beleuchtung.6do` | 432 | 432 | Images/Special/Beleuchtung.png |
| `LightObjectsAlien/Schmiede_beleuchtung.6do` | 198 | 198 | Images/Special/Beleuchtung.png |
| `LightObjectsAlien/Steinmetz_beleuchtung.6do` | 360 | 360 | Images/Special/Beleuchtung.png |
| `LightObjectsAlien/magierturm_beleuchtung.6do` | 360 | 360 | Images/Special/Beleuchtung.png |
| `Misc/Eiszapfen1.6do` | 126 | 126 | Images/Special/Eiszapfen.png |
| `Misc/Eiszapfen2.6do` | 126 | 126 | Images/Special/Eiszapfen.png |
| `Misc/Eiszapfen3.6do` | 126 | 126 | Images/Special/Eiszapfen.png |
| `Misc/ExploStreak.6do` | 184 | 184 | Images/PartikelTextures/ExploStreak.png |
| `Misc/Kompass.6do` | 25 | 25 | dynamic:80, dynamic:81 |
| `Misc/Schatten.6do` | 2 | 2 | dynamic:0 |
| `Misc/SchildTreffer1.6do` | 120 | 120 | Images/Special/SchildTreffer2.png |
| `Misc/SchildTreffer2.6do` | 120 | 120 | Images/Special/SchildTreffer1.png |
| `Misc/StreakExplo.6do` | 46 | 46 | Images/PartikelTextures/StreakExplo.png |
| `Misc/blitz.6do` | 512 | 512 | Images/Special/blitz_tex.png |
| `Objects/AtlantischeBallista_Drehkranz.7DO` | 90 | 90 | Waffen/500.png |
| `Objects/AtlantischeBallista_Grundkoerper.7DO` | 652 | 652 | Waffen/500.png, Waffen/501.png, Waffen/503.png |
| `Objects/AtlantischeBallista_Rad1.7DO` | 200 | 200 | Waffen/500.png, Waffen/501.png, Waffen/506.png |
| `Objects/AtlantischeBallista_Rad2.7DO` | 200 | 200 | Waffen/500.png, Waffen/501.png, Waffen/506.png |
| `Objects/AtlantischeBallista_Rad3.7DO` | 200 | 200 | Waffen/500.png, Waffen/501.png, Waffen/506.png |
| `Objects/AtlantischeBallista_Rad4.7DO` | 200 | 200 | Waffen/500.png, Waffen/501.png, Waffen/506.png |
| `Objects/AtlantischeBallista_Schiene.7DO` | 52 | 52 | Waffen/500.png |
| `Objects/AtlantischeBallista_Schlitten.7DO` | 144 | 144 | Waffen/500.png |
| `Objects/Ballista_Drehkreuz.7DO` | 304 | 608 | Waffen/500.png, Waffen/507.png, Waffen/522.png |
| `Objects/Ballista_Gestell.7DO` | 332 | 332 | Waffen/500.png, Waffen/501.png, Waffen/505.png, Waffen/506.png |
| `Objects/Ballista_haken.7DO` | 145 | 290 | Waffen/500.png, Waffen/522.png |
| `Objects/Ballista_schlitten.7DO` | 743 | 743 | Waffen/500.png, Waffen/501.png, Waffen/502.png, Waffen/503.png, Waffen/504.png |
| `Objects/DickeLuise_Drehrad.7DO` | 104 | 208 | Waffen/509.png, Waffen/522.png, Waffen/528.png |
| `Objects/DickeLuise_Gestell.7DO` | 210 | 210 | Waffen/501.png, Waffen/509.png, Waffen/528.png |
| `Objects/DickeLuise_Rohr.7DO` | 694 | 1388 | Waffen/514.png, Waffen/522.png, Waffen/528.png |
| `Objects/Doppelkanone_Gestell.7DO` | 213 | 213 | Waffen/501.png, Waffen/515.png |
| `Objects/Doppelkanone_Rohr.7DO` | 1494 | 2334 | Waffen/510.png, Waffen/514.png, Waffen/522.png, Waffen/528.png |
| `Objects/FeuerBallista_Drehkreuz.7DO` | 304 | 608 | Waffen/500.png, Waffen/507.png, Waffen/522.png |
| `Objects/FeuerBallista_Gestell.7DO` | 332 | 332 | Waffen/500.png, Waffen/501.png, Waffen/505.png, Waffen/506.png |
| `Objects/FeuerBallista_Haken.7DO` | 145 | 290 | Waffen/500.png, Waffen/522.png |
| `Objects/FeuerBallista_Schlitten.7DO` | 743 | 743 | Waffen/500.png, Waffen/501.png, Waffen/502.png, Waffen/503.png, Waffen/504.png, Waffen/511.png |
| `Objects/Feuerkatapult_Balken.7DO` | 264 | 264 | Waffen/500.png, Waffen/501.png |
| `Objects/Feuerkatapult_Drehachse.7DO` | 16 | 32 | Waffen/500.png, Waffen/522.png |
| `Objects/Feuerkatapult_Drehkranz.7DO` | 128 | 240 | Waffen/500.png, Waffen/503.png, Waffen/522.png |
| `Objects/Feuerkatapult_Gestell.7DO` | 252 | 252 | Waffen/501.png, Waffen/512.png, Waffen/515.png |
| `Objects/FlammenTopf.7DO` | 324 | 324 | Waffen/525.png |
| `Objects/HeisseGina_Balken.7DO` | 256 | 256 | Waffen/501.png, Waffen/528.png |
| `Objects/HeisseGina_Drehkranz.7DO` | 208 | 400 | Waffen/503.png, Waffen/522.png, Waffen/528.png |
| `Objects/HeisseGina_Gestell.7DO` | 390 | 390 | Waffen/501.png, Waffen/512.png, Waffen/513.png, Waffen/528.png |
| `Objects/HeisseGina_Kasten1.7DO` | 220 | 436 | Waffen/513.png, Waffen/522.png, Waffen/528.png |
| `Objects/HeisseGina_Kasten2.7DO` | 218 | 434 | Waffen/513.png, Waffen/522.png, Waffen/528.png |
| `Objects/Hoellenorgel_Gestell.7DO` | 722 | 722 | Waffen/501.png, Waffen/505.png, Waffen/509.png, Waffen/512.png, Waffen/528.png |
| `Objects/Hoellenorgel_Kanone.7DO` | 182 | 364 | Waffen/514.png, Waffen/522.png, Waffen/528.png |
| `Objects/Hoellenorgel_Raeder.7DO` | 682 | 682 | Waffen/501.png, Waffen/528.png |
| `Objects/Kanone_Drehkranz.7DO` | 200 | 400 | Waffen/522.png, Waffen/528.png |
| `Objects/Kanone_Gestell.7DO` | 210 | 210 | Waffen/501.png, Waffen/528.png |
| `Objects/Kanone_Rohr.7DO` | 366 | 732 | Waffen/522.png, Waffen/528.png |
| `Objects/Katapult_Balken.7DO` | 264 | 264 | Waffen/500.png, Waffen/501.png |
| `Objects/Katapult_Drehachse.7DO` | 16 | 16 | Waffen/500.png |
| `Objects/Katapult_Drehkranz.7DO` | 128 | 240 | Waffen/500.png, Waffen/503.png, Waffen/522.png |
| `Objects/Katapult_Gestell.7DO` | 252 | 252 | Waffen/501.png, Waffen/512.png |
| `Objects/LangerFritz_Balken.7DO` | 1179 | 2292 | Waffen/501.png, Waffen/522.png, Waffen/528.png |
| `Objects/LangerFritz_Drehkranz.7DO` | 188 | 360 | Waffen/503.png, Waffen/522.png, Waffen/528.png |
| `Objects/LangerFritz_Gestell.7DO` | 390 | 390 | Waffen/501.png, Waffen/528.png |
| `Objects/MuendungsFeuer.7DO` | 20 | 20 | Waffen/523.png, Waffen/524.png |
| `Objects/Mun_AtlantischeBallista.7do` | 26 | 26 | Waffen/521.png, Waffen/522.png |
| `Objects/Mun_Ballista.7do` | 32 | 32 | Waffen/522.png, Waffen/523.png, Waffen/524.png |
| `Objects/Mun_DickeLuise.7do` | 168 | 168 | Waffen/513.png |
| `Objects/Mun_DoppelKanone.7do` | 168 | 168 | Waffen/513.png |
| `Objects/Mun_FeuerKatapult.7do` | 64 | 64 | Waffen/525.png |
| `Objects/Mun_Feuerballista.7do` | 104 | 104 | dynamic:0, Waffen/512.png |
| `Objects/Mun_HeisseGina.7do` | 64 | 64 | Waffen/525.png |
| `Objects/Mun_Hoellenorgel.7do` | 168 | 168 | Waffen/513.png |
| `Objects/Mun_Kanone.7do` | 168 | 168 | Waffen/513.png |
| `Objects/Mun_Katapult.7do` | 64 | 64 | Waffen/525.png |
| `Objects/Mun_KatapultEis.7do` | 64 | 64 | Waffen/525.png |
| `Objects/Mun_KatapultVulkan.7do` | 64 | 64 | Waffen/525.png |
| `Objects/Mun_KatapultWald.7do` | 64 | 64 | Waffen/525.png |
| `Objects/Mun_KatapultWueste.7do` | 64 | 64 | Waffen/525.png |
| `Objects/Mun_LangerFritz.7do` | 64 | 64 | Waffen/525.png |
| `Objects/Mun_Moerser.7do` | 168 | 168 | Waffen/513.png |
| `Objects/Mun_Raketenwerfer.7do` | 42 | 42 | dynamic:0, Waffen/523.png |
| `Objects/Mun_Superwaffe.7do` | 168 | 168 | Waffen/513.png |
| `Objects/Mun_Trebuchet.7do` | 64 | 64 | Waffen/525.png |
| `Objects/Mun_Zeppelin.7do` | 168 | 168 | Waffen/513.png |
| `Objects/Rakete.7DO` | 127 | 127 | Waffen/501.png, Waffen/528.png |
| `Objects/RaketeMKII.7DO` | 560 | 560 | Waffen/501.png, Waffen/528.png |
| `Objects/RaketenwerferMKII_Drehkranz.7DO` | 32 | 32 | Waffen/528.png |
| `Objects/RaketenwerferMKII_Gefaess.7DO` | 124 | 124 | Waffen/501.png, Waffen/505.png |
| `Objects/RaketenwerferMKII_Plattform.7DO` | 236 | 236 | Waffen/509.png, Waffen/528.png, Waffen/538.png |
| `Objects/Raketenwerfer_Drehkranz.7DO` | 158 | 316 | Waffen/522.png, Waffen/528.png |
| `Objects/Raketenwerfer_Gefaess.7DO` | 714 | 714 | Waffen/501.png, Waffen/505.png, Waffen/528.png |
| `Objects/Raketenwerfer_Gestell.7DO` | 340 | 340 | Waffen/501.png, Waffen/502.png, Waffen/512.png, Waffen/528.png |
| `Objects/Trebuchet_Balken.7DO` | 531 | 902 | Waffen/501.png, Waffen/522.png, Waffen/528.png |
| `Objects/Trebuchet_Drehkranz.7DO` | 204 | 392 | Waffen/503.png, Waffen/522.png, Waffen/528.png |
| `Objects/Trebuchet_Gestell.7DO` | 597 | 597 | Waffen/501.png, Waffen/505.png, Waffen/512.png, Waffen/528.png, Waffen/538.png |
| `Objects/Trebuchet_Kiste.7DO` | 156 | 156 | Waffen/512.png, Waffen/537.png, Waffen/538.png |
| `Objects/Zeppelin_Ballon.7DO` | 319 | 319 | Waffen/501.png, Waffen/518.png, Waffen/521.png |
| `Objects/Zeppelin_Gondel.7DO` | 325 | 325 | dynamic:0, Waffen/501.png, Waffen/512.png, Waffen/528.png, Waffen/537.png |
| `Objects/Zeppelin_HoehenruderL.7DO` | 12 | 12 | Waffen/518.png |
| `Objects/Zeppelin_HoehenruderR.7DO` | 12 | 12 | Waffen/518.png |
| `Objects/Zeppelin_Propeller.7DO` | 126 | 126 | Waffen/520.png |
| `Objects/Zeppelin_PropellerL.7DO` | 4 | 4 | Waffen/520.png |
| `Objects/Zeppelin_PropellerR.7DO` | 4 | 4 | Waffen/520.png |
| `Objects/Zeppelin_SeitenruderO.7DO` | 12 | 12 | Waffen/518.png |
| `Objects/Zeppelin_SeitenruderU.7DO` | 12 | 12 | Waffen/518.png |
| `Objects/atlantischeballista_geschoss.7DO` | 120 | 120 | Waffen/501.png, Waffen/528.png |
| `Objects/ballista_geschoss.7DO` | 128 | 128 | Waffen/501.png, Waffen/528.png |
| `Objects/buch.7DO` | 44 | 44 | Waffen/530.png, Waffen/531.png, Waffen/532.png, Waffen/533.png |
| `Objects/effekt0.7DO` | 62 | 62 | Waffen/534.png |
| `Objects/effekt1.7DO` | 61 | 61 | Waffen/534.png |
| `Objects/effekt2.7DO` | 61 | 61 | Waffen/534.png |
| `Objects/feuerschutz.7DO` | 308 | 308 | Waffen/528.png, Waffen/544.png, Waffen/549.png |
| `Objects/genereller_zauber.7DO` | 64 | 64 | Waffen/540.png, Waffen/550.png |
| `Objects/gezielter_zauber.7DO` | 57 | 57 | Waffen/501.png, Waffen/536.png, Waffen/539.png |
| `Objects/kanonenkugel.7DO` | 80 | 80 | Waffen/528.png |
| `Objects/koeniglicher_zauber.7DO` | 312 | 312 | Waffen/529.png, Waffen/533.png |
| `Objects/mauerausbau.7DO` | 472 | 472 | Waffen/542.png, Waffen/546.png, Waffen/547.png, Waffen/548.png |
| `Objects/schatzkiste.7DO` | 130 | 130 | Waffen/521.png, Waffen/526.png, Waffen/527.png |
| `Objects/splitterschutz.7DO` | 308 | 308 | Waffen/528.png, Waffen/544.png, Waffen/545.png |
| `Objects/stein1.7DO` | 140 | 140 | Waffen/516.png |
| `Objects/waffenausbau.7DO` | 998 | 1558 | Waffen/501.png, Waffen/522.png, Waffen/528.png, Waffen/541.png, Waffen/542.png |
| `Objects/zielgenauigkeit.7DO` | 257 | 257 | Waffen/501.png, Waffen/528.png, Waffen/539.png |
| `ObjectsHighlight/Ballista_Drehkreuz_hl.7DO` | 304 | 304 | Waffen/500.png, Waffen/507.png |
| `ObjectsHighlight/Ballista_Gestell_hl.7DO` | 332 | 332 | Waffen/500.png, Waffen/501.png, Waffen/505.png, Waffen/506.png |
| `ObjectsHighlight/Ballista_haken_hl.7DO` | 145 | 145 | Waffen/500.png |
| `ObjectsHighlight/Ballista_schlitten_hl.7DO` | 743 | 743 | Waffen/500.png, Waffen/501.png, Waffen/502.png, Waffen/503.png, Waffen/504.png |
| `ObjectsHighlight/DickeLuise_Drehrad_hl.7DO` | 104 | 104 | Waffen/509.png, Waffen/528.png |
| `ObjectsHighlight/DickeLuise_Gestell_hl.7DO` | 210 | 210 | Waffen/501.png, Waffen/509.png, Waffen/528.png |
| `ObjectsHighlight/DickeLuise_Rohr_hl.7DO` | 694 | 694 | Waffen/514.png, Waffen/528.png |
| `ObjectsHighlight/Doppelkanone_Gestell_hl.7DO` | 213 | 213 | Waffen/501.png, Waffen/515.png |
| `ObjectsHighlight/Doppelkanone_Rohr_hl.7DO` | 1494 | 2334 | Waffen/510.png, Waffen/514.png, Waffen/522.png, Waffen/528.png |
| `ObjectsHighlight/FeuerBallista_Drehkreuz_hl.7DO` | 304 | 304 | Waffen/500.png, Waffen/507.png |
| `ObjectsHighlight/FeuerBallista_Gestell_hl.7DO` | 332 | 332 | Waffen/500.png, Waffen/501.png, Waffen/505.png, Waffen/506.png |
| `ObjectsHighlight/FeuerBallista_Haken_hl.7DO` | 145 | 145 | Waffen/500.png |
| `ObjectsHighlight/FeuerBallista_Schlitten_hl.7DO` | 743 | 743 | Waffen/500.png, Waffen/501.png, Waffen/502.png, Waffen/503.png, Waffen/504.png, Waffen/511.png |
| `ObjectsHighlight/Feuerkatapult_Balken_hl.7DO` | 264 | 264 | Waffen/500.png, Waffen/501.png |
| `ObjectsHighlight/Feuerkatapult_Drehachse_hl.7DO` | 16 | 16 | Waffen/500.png |
| `ObjectsHighlight/Feuerkatapult_Drehkranz_hl.7DO` | 128 | 240 | Waffen/500.png, Waffen/503.png, Waffen/522.png |
| `ObjectsHighlight/Feuerkatapult_Gestell_hl.7DO` | 252 | 252 | Waffen/501.png, Waffen/512.png |
| `ObjectsHighlight/HeisseGina_Balken_hl.7DO` | 256 | 256 | Waffen/501.png, Waffen/528.png |
| `ObjectsHighlight/HeisseGina_Drehkranz_hl.7DO` | 208 | 400 | Waffen/503.png, Waffen/522.png, Waffen/528.png |
| `ObjectsHighlight/HeisseGina_Gestell_hl.7DO` | 360 | 360 | Waffen/501.png, Waffen/512.png, Waffen/513.png |
| `ObjectsHighlight/HeisseGina_Kasten1_hl.7DO` | 220 | 220 | Waffen/513.png, Waffen/528.png |
| `ObjectsHighlight/HeisseGina_Kasten2_hl.7DO` | 218 | 218 | Waffen/513.png, Waffen/528.png |
| `ObjectsHighlight/Hoellenorgel_Gestell_hl.7DO` | 722 | 722 | Waffen/501.png, Waffen/505.png, Waffen/509.png, Waffen/512.png, Waffen/528.png |
| `ObjectsHighlight/Hoellenorgel_Kanone_hl.7DO` | 182 | 182 | Waffen/514.png, Waffen/528.png |
| `ObjectsHighlight/Hoellenorgel_Raeder_hl.7DO` | 682 | 682 | Waffen/501.png, Waffen/528.png |
| `ObjectsHighlight/Kanone_Drehkranz_hl.7DO` | 200 | 200 | Waffen/528.png |
| `ObjectsHighlight/Kanone_Gestell_hl.7DO` | 210 | 210 | Waffen/501.png, Waffen/528.png |
| `ObjectsHighlight/Kanone_Rohr_hl.7DO` | 366 | 366 | Waffen/528.png |
| `ObjectsHighlight/Katapult_Balken_hl.7DO` | 264 | 264 | Waffen/500.png, Waffen/501.png |
| `ObjectsHighlight/Katapult_Drehachse_hl.7DO` | 16 | 16 | Waffen/500.png |
| `ObjectsHighlight/Katapult_Drehkranz_hl.7DO` | 128 | 240 | Waffen/500.png, Waffen/503.png, Waffen/522.png |
| `ObjectsHighlight/Katapult_Gestell_hl.7DO` | 252 | 252 | Waffen/501.png, Waffen/512.png, Waffen/515.png |
| `ObjectsHighlight/LangerFritz_Balken_hl.7DO` | 1179 | 1179 | Waffen/501.png, Waffen/528.png |
| `ObjectsHighlight/LangerFritz_Drehkranz_hl.7DO` | 188 | 360 | Waffen/503.png, Waffen/522.png, Waffen/528.png |
| `ObjectsHighlight/LangerFritz_Gestell_hl.7DO` | 390 | 390 | Waffen/501.png, Waffen/528.png |
| `ObjectsHighlight/Rakete_hl.7DO` | 127 | 127 | Waffen/501.png, Waffen/528.png |
| `ObjectsHighlight/Raketenwerfer_Drehkranz_hl.7DO` | 158 | 158 | Waffen/528.png |
| `ObjectsHighlight/Raketenwerfer_Gefaess_hl.7DO` | 714 | 714 | Waffen/501.png, Waffen/505.png, Waffen/528.png |
| `ObjectsHighlight/Raketenwerfer_Gestell_hl.7DO` | 340 | 340 | dynamic:0, Waffen/501.png, Waffen/512.png, Waffen/528.png |
| `ObjectsHighlight/Trebuchet_Balken_hl.7DO` | 531 | 531 | Waffen/501.png, Waffen/528.png |
| `ObjectsHighlight/Trebuchet_Drehkranz_hl.7DO` | 204 | 392 | Waffen/503.png, Waffen/522.png, Waffen/528.png |
| `ObjectsHighlight/Trebuchet_Gestell_hl.7DO` | 567 | 567 | Waffen/501.png, Waffen/505.png, Waffen/512.png, Waffen/528.png |
| `ObjectsHighlight/Trebuchet_Kiste_hl.7DO` | 156 | 156 | Waffen/512.png, Waffen/537.png, Waffen/538.png |
| `Shadows/AtlantischeBallista_Grundkoerper.6do` | 144 | 144 | dynamic:0 |
| `Shadows/AtlantischeBallista_Rad1.6do` | 2 | 2 | Schatten/1970.png |
| `Shadows/Burgtor_z0.6do` | 28 | 28 | dynamic:0 |
| `Shadows/Burgtor_z2.6do` | 50 | 50 | dynamic:0 |
| `Shadows/Burgtor_z3.6do` | 48 | 48 | dynamic:0 |
| `Shadows/DickeLuise_Drehrad.6do` | 62 | 62 | dynamic:0 |
| `Shadows/DickeLuise_Gestell.6do` | 114 | 114 | dynamic:0 |
| `Shadows/DickeLuise_Rohr.6do` | 120 | 120 | dynamic:0 |
| `Shadows/HeisseGina_Balken.6do` | 126 | 126 | dynamic:0 |
| `Shadows/HeisseGina_Drehkranz.6do` | 120 | 120 | dynamic:0 |
| `Shadows/HeisseGina_Gestell.6do` | 132 | 132 | dynamic:0 |
| `Shadows/HeisseGina_Kasten1.6do` | 60 | 60 | dynamic:0 |
| `Shadows/Katapult_Balken.6do` | 110 | 110 | dynamic:0 |
| `Shadows/Katapult_Drehachse.6do` | 8 | 8 | dynamic:0 |
| `Shadows/Katapult_Drehkranz.6do` | 64 | 64 | dynamic:0 |
| `Shadows/Katapult_Gestell.6do` | 108 | 108 | dynamic:0 |
| `Shadows/LangerFritz_Balken.6do` | 275 | 275 | dynamic:0 |
| `Shadows/LangerFritz_Drehkranz.6do` | 100 | 100 | dynamic:0 |
| `Shadows/LangerFritz_Gestell.6do` | 216 | 216 | dynamic:0 |
| `Shadows/MauerGross_0_z0.6do` | 118 | 118 | dynamic:0 |
| `Shadows/MauerGross_0_z2.6do` | 36 | 36 | dynamic:0 |
| `Shadows/MauerGross_0_z3.6do` | 20 | 20 | dynamic:0 |
| `Shadows/MauerGross_1_z0.6do` | 110 | 110 | dynamic:0 |
| `Shadows/MauerGross_1_z2.6do` | 28 | 28 | dynamic:0 |
| `Shadows/MauerGross_1_z3.6do` | 16 | 16 | dynamic:0 |
| `Shadows/MauerGross_2b_z0.6do` | 93 | 93 | dynamic:0 |
| `Shadows/MauerGross_2b_z2.6do` | 32 | 32 | dynamic:0 |
| `Shadows/MauerGross_2b_z3.6do` | 22 | 22 | dynamic:0 |
| `Shadows/MauerGross_4_z0.6do` | 86 | 86 | dynamic:0 |
| `Shadows/MauerGross_4_z2.6do` | 28 | 28 | dynamic:0 |
| `Shadows/MauerGross_4_z3.6do` | 20 | 20 | dynamic:0 |
| `Shadows/MauerKlein_0_z0.6do` | 50 | 50 | dynamic:0 |
| `Shadows/MauerKlein_0_z2.6do` | 44 | 44 | dynamic:0 |
| `Shadows/MauerKlein_0_z3.6do` | 44 | 44 | dynamic:0 |
| `Shadows/MauerKlein_1_z0.6do` | 92 | 92 | dynamic:0 |
| `Shadows/MauerKlein_1_z2.6do` | 36 | 36 | dynamic:0 |
| `Shadows/MauerKlein_1_z3.6do` | 24 | 24 | dynamic:0 |
| `Shadows/MauerKlein_2b_z0.6do` | 106 | 106 | dynamic:0 |
| `Shadows/MauerKlein_2b_z2.6do` | 33 | 33 | dynamic:0 |
| `Shadows/MauerKlein_2b_z3.6do` | 23 | 23 | dynamic:0 |
| `Shadows/MauerKlein_4_z0.6do` | 86 | 86 | dynamic:0 |
| `Shadows/MauerKlein_4_z2.6do` | 28 | 28 | dynamic:0 |
| `Shadows/MauerKlein_4_z3.6do` | 20 | 20 | dynamic:0 |
| `Shadows/Trebuchet_Balken.6do` | 74 | 74 | dynamic:0 |
| `Shadows/Trebuchet_Drehkranz.6do` | 200 | 200 | dynamic:0 |
| `Shadows/Trebuchet_Gestell.6do` | 182 | 182 | dynamic:0 |
| `Shadows/Trebuchet_Kiste.6do` | 12 | 12 | dynamic:0 |
| `Shadows/TurmGross_z0.6do` | 122 | 122 | dynamic:0 |
| `Shadows/TurmGross_z2.6do` | 100 | 100 | dynamic:0 |
| `Shadows/TurmGross_z3.6do` | 36 | 36 | dynamic:0 |
| `Shadows/TurmKlein_z0.6do` | 122 | 122 | dynamic:0 |
| `Shadows/TurmKlein_z2.6do` | 98 | 98 | dynamic:0 |
| `Shadows/TurmKlein_z3.6do` | 34 | 34 | dynamic:0 |
| `Shadows/bauernhaus_z0.6do` | 22 | 22 | dynamic:0 |
| `Shadows/bauernhaus_z2.6do` | 26 | 26 | dynamic:0 |
| `Shadows/bauernhaus_z3.6do` | 30 | 30 | dynamic:0 |
| `Shadows/erfinder_z0.6do` | 102 | 102 | dynamic:0 |
| `Shadows/erfinder_z2.6do` | 78 | 78 | dynamic:0 |
| `Shadows/erfinder_z3.6do` | 46 | 46 | dynamic:0 |
| `Shadows/hoellenorgel_gestell.6do` | 136 | 136 | dynamic:0 |
| `Shadows/hoellenorgel_kanone.6do` | 53 | 53 | dynamic:0 |
| `Shadows/hoellenorgel_raeder.6do` | 76 | 76 | dynamic:0 |
| `Shadows/kneipe_z0.6do` | 30 | 30 | dynamic:0 |
| `Shadows/kneipe_z2.6do` | 26 | 26 | dynamic:0 |
| `Shadows/kneipe_z3.6do` | 18 | 18 | dynamic:0 |
| `Shadows/magierturm_z0.6do` | 260 | 260 | dynamic:0 |
| `Shadows/magierturm_z2.6do` | 258 | 258 | dynamic:0 |
| `Shadows/magierturm_z3.6do` | 258 | 258 | dynamic:0 |
| `Shadows/palast_z0.6do` | 230 | 230 | dynamic:0 |
| `Shadows/palast_z3.6do` | 237 | 237 | dynamic:0 |
| `Shadows/palast_z4.6do` | 122 | 122 | dynamic:0 |
| `Shadows/pulverfabrik_z0.6do` | 114 | 114 | dynamic:0 |
| `Shadows/pulverfabrik_z2.6do` | 114 | 114 | dynamic:0 |
| `Shadows/pulverfabrik_z3.6do` | 110 | 110 | dynamic:0 |
| `Shadows/schatzkammer_z0.6do` | 28 | 28 | dynamic:0 |
| `Shadows/schatzkammer_z2.6do` | 28 | 28 | dynamic:0 |
| `Shadows/schatzkammer_z3.6do` | 36 | 36 | dynamic:0 |
| `Shadows/schmiede_z0.6do` | 70 | 70 | dynamic:0 |
| `Shadows/schmiede_z2.6do` | 80 | 80 | dynamic:0 |
| `Shadows/schmiede_z3.6do` | 56 | 56 | dynamic:0 |
| `Shadows/statue_z0.6do` | 68 | 68 | dynamic:0 |
| `Shadows/statue_z2.6do` | 76 | 76 | dynamic:0 |
| `Shadows/statue_z3.6do` | 94 | 94 | dynamic:0 |
| `Shadows/steinmetz_z0.6do` | 44 | 44 | dynamic:0 |
| `Shadows/steinmetz_z2.6do` | 36 | 36 | dynamic:0 |
| `Shadows/steinmetz_z3.6do` | 12 | 12 | dynamic:0 |
| `Shadows/superwaffe.6do` | 186 | 186 | dynamic:0 |
| `Shadows/windmuehle_z0.6do` | 66 | 66 | dynamic:0 |
| `Shadows/windmuehle_z2.6do` | 98 | 98 | dynamic:0 |
| `Shadows/windmuehle_z3.6do` | 112 | 112 | dynamic:0 |
| `Shadows/windrad_z0.6do` | 40 | 40 | dynamic:0 |
| `Shadows/windrad_z2.6do` | 46 | 46 | dynamic:0 |
| `Shadows/windrad_z3.6do` | 22 | 22 | dynamic:0 |
| `Wolken/wolkenlayer01_01.6do` | 1254 | 1254 | Wolken/1952.png |
| `Wolken/wolkenlayer01_02.6do` | 1254 | 1254 | Wolken/1950.png, Wolken/1952.png |
| `Wolken/wolkenlayer01_03.6do` | 1254 | 1254 | Wolken/1950.png, Wolken/1951.png |

## Unassigned-field hex evidence

6DO packed header, first 96 bytes: `Main/Objects/Buehnen/b_a_01.6do`, file offset 0x8.

```text
00000008  36 64 6f 01 00 01 00 65 00 00 00 00 00 00 00 00
00000018  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00000028  00 00 00 00 00 00 00 00 00 00 00 00 40 9a 44 00
00000038  00 00 00 00 00 00 00 00 00 00 00 00 40 9a 44 00
00000048  00 00 00 00 00 00 00 00 00 00 00 00 40 9a 44 00
00000058  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

Scenario, first 96 bytes: `Main/Data/Kampagne/Lv1_1_1.odn`, file offset 0x0.

```text
00000000  00 00 00 00 00 02 00 00 00 00 00 01 02 02 00 01
00000010  02 03 00 00 88 13 00 00 00 00 00 00 00 00 00 00
00000020  f4 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00000030  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
00000040  00 00 00 00 00 00 00 01 00 00 00 01 32 00 00 1e
00000050  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
```

Gradients.raw, first 64 bytes: `Main/Images/Special/Gradients.raw`, file offset 0x0.

```text
00000000  cc 1b 1b cd 1c 1b cd 1d 1b cd 1e 1c cd 1e 1c ce
00000010  1f 1c ce 20 1c cf 21 1d cf 21 1e cf 23 1e d0 24
00000020  1e d1 25 1f d1 26 1f d1 27 1f d2 27 1f d2 28 1f
00000030  d3 2a 21 d3 2c 21 d4 2d 21 d4 2e 22 d5 2f 22 d6
```

Sky/color data, first 64 bytes: `Main/Level/Level00.him`, file offset 0x0.

```text
00000000  1d 34 52 25 3d 5e 33 4e 71 42 5f 85 4d 6c 94 53
00000010  72 9a 86 99 b1 c9 cd d1 1d 34 52 25 3d 5e 33 4e
00000020  71 42 5f 85 4d 6c 94 53 72 9a 86 99 b1 c9 cd d1
00000030  1d 34 52 25 3d 5e 33 4e 71 42 5f 85 4d 6c 94 53
```

## Verbatim text/table evidence

The source game files remain byte-for-byte in Main/. String pools below are decoded as CP1252 with NUL displayed as `\0`; other text is unchanged. These are original extracted game data, not instructions to execute.

### ml_phrasen.dat

```text
Female\0
Male\0
Fred\0
Draco\0
Fritz\0
Greg\0
Siegfried\0
Vlad\0
Small wall\0
Small wall\0
Small wall\0
Small wall\0
Small wall\0
Small wall\0
Big wall\0
Big wall\0
Big wall\0
Big wall\0
Big wall\0
Big wall\0
Small tower\0
Big tower\0
Giant tower\0
Gatehouse\0
-\0
Super weapon\0
Farmhouse\0
Inn\0
Mason's Yard\0
Ammo workshop\0
Smithy\0
-\0
Treasury\0
Windmill\0
Superbrain\0
Mage tower\0
Idol\0
Palace\0
Trampoline\0
Ground weapon\0
Ground weapon\0
Zeppelin\0
Catapult\0
Fire catapult\0
Long John\0
Hot Helga\0
Trebuchet\0
-\0
-\0
-\0
-\0
Ballista\0
Fire ballista\0
Arcaballista\0
Cannon\0
Double cannon\0
Quad launcher\0
Fat Freda\0
Hellfire\0
Rocket launcher\0
Zeppelin\0
Transport balloon\0
-\0
-\0
-\0
-\0
-\0
-\0
-\0
-\0
-\0
-\0
Rocks\0
Fire bomb\0
Rocks\0
Wildfire bomb\0
Rocks\0
-\0
-\0
-\0
-\0
Spear\0
Burning spear\0
Burning spears\0
Cannonball\0
Cannonballs\0
Warhead\0
Grenade\0
Cannonballs\0
Rocket\0
200 lb Bomb\0
Super weapon\0
-\0
-\0
-\0
-\0
Warhead\0
Loading...\0
with\0
-\0
Farmers\0
Gold stored\0
Empty\0
the Noble\0
the Serious\0
the General\0
the Prof\0
the Daredevil\0
the Coward\0
Forest\0
Desert\0
Ice\0
Volcano\0
Recovery\0
Research\0
-\0
-\0
-\0
-\0
-\0
-\0
-\0
-\0
-\0
-\0
Shot\0
Gold\0
Tax rate\0
Palace\0
Walls\0
Treasury\0
Farmhouse\0
Inn\0
Mason's Yard\0
Ammo Workshop\0
Smithy\0
Windmill\0
Superbrain\0
Mage Tower\0
Auto-repair\0
Status\0
Auto-rep\0
Reloading\0
Sound settings\0
John\0
Carl\0
George\0
Max\0
Maurice\0
Bill\0
Siegfried\0
Hank\0
Thomas\0
Boris\0
Daniel\0
Torsten\0
Bastian\0
Ingo\0
Joerg\0
Mark\0
Options\0
Support\0
Mission\0
Magic\0
Research\0
Auto-repair\0
Build weapons\0
Build structure\0
Weapon view\0
Castle view\0
Impact view\0
Reset\0
$b is ready.\0
$b has caught fire!\0
$b has been destroyed.\0
The treasury has been destroyed. You've lost $v gold coins.\0
$s has started researching. $e\0
$s has finished researching $e.\0
$s has started building a super weapon!\0
Your mage is ready again.\0
Your mage has finished researching a new spell.\0
Your superbrain has researched $e.\0
The structural integrity of your PALACE is below 25%!!\0
Your coffers are full. You should build a treasury.\0
$s ($c): $t\0
$s grants you $k gold coins.\0
$s has just annihilated $o.\0
$s has surrendered.\0
$s has just ordered a spell.\0
The battle is over.\0
Zeppelin\0
Wall upgrade\0
Accuracy\0
Double cannon\0
Super weapon\0
Fragment Shield\0
Firewall\0
-\0
Fire ballista\0
Quad launcher\0
Long John\0
Arcaballista\0
Hot Helga\0
Trebuchet\0
Fat Freda\0
Hellfire\0
Add Weapon I\0
Add Weapon II\0
Add Weapon III\0
Add Weapon IV\0
Reloading weapon\0
Positioning weapon.\0
Cease-fire is still active.\0
No firing allowed by night.\0
Weapon is not rainproof.\0
Not enough gold.\0
Scrap\0
Repair\0
Mission\0
Stats\0
Auto-repair\0
Research\0
Magic\0
Weapon view\0
Palace\0
Walls & towers\0
Farmhouse & Mason's Yard\0
Other buildings\0
Weapons\0
Smithy\0
Ammo workshop\0
Superbrain\0
Mage Tower\0
Treasury\0
Windmill\0
Weapons\0
-\0
Min. gold reserve\0
Ready\0
Back\0
HRH the Princess has gone shopping.\0
Exit\0
Load bomb\0
Battle stats\0
Shots:\0
Direct hits:\0
Accuracy:\0
Damage:\0
Tax income:\0
Cash:\0
Value of castle:\0
Ammo costs:\0
Resarch costs:\0
Mage costs:\0
Current pop.:\0
Losses:\0
Gametime:\0
Overall score:\0
No pay load\0
Loaded\0
Return flight\0
Target view\0
In-flight view\0
Overall\0
Farmers\0
Structures\0
Research\0
Mage\0
Weapons\0
N\0
E\0
S\0
W\0
Costs\0
Available\0
Main Menu\0
Try again\0
Continue\0
Cancel\0
Tutorial\0
Forest 1\0
Forest 2\0
Forest 3\0
Forest 4\0
Forest 5\0
Forest 6\0
Desert 1\0
Desert 2\0
Desert 3\0
Desert 4\0
Desert 5\0
Desert 6\0
Snow 1\0
Snow 2\0
Snow 3\0
Snow 4\0
Snow 5\0
Snow 6\0
Volcano 1\0
Volcano 2\0
Volcano 3\0
Volcano 4\0
Volcano 5\0
Volcano 6\0
Alien 1\0
Alien 2\0
Alien 3\0
Alien 4\0
NOT\0
Select a game:\0
OK\0
Forest\0
Desert\0
Ice\0
Volcano\0
Disconnect\0
Action\0
Quick game\0
Tactics\0
Strategy\0
User's game\0
empty\0
Starter structure\0
Starter castle\0
Team\0
Player/CPU level\0
Name/Tactics\0
Princess\0
Preset\0
Tournament\0
Cancel\0
Multiplayer\0
On\0
Off\0
Never\0
Seldom\0
Regularly\0
Often\0
Very often\0
Constantly\0
Special weapon\0
Zeppelin/Ballista\0
Invent\0
Magic\0
Infinite gold\0
Night curfew\0
Build structure/weapon\0
Farmers in new bldg\0
Farmer in new bldg\0
No night shift allowed\0
Repair\0
Farmhouses\0
Day/night change\0
Start sudden death\0
Cannons\0
Catapults\0
Change of wind\0
Starting build time\0
Starting Structure\0
Wind strength\0
Starting gold\0
joins in\0
is no longer connected\0
is ready\0
is no longer ready\0
Start\0
The server has closed the game.\0
Search\0
No access\0
random\0
Golden leaf\0
Desert Rose\0
Ice Star\0
Heart of Stone\0
Action Hero\0
Mr Speedy\0
Tactician\0
Strategist\0
Hit ratio\0
Score\0
Sky Lord\0
Mage Award\0
Multi winner\0
Hit ratio\0
Archmage medal\0
Cannon fodder\0
Cannon cleaner\0
Cannon loader\0
Gunner\0
Senior Gunner\0
Battery Chief\0
General\0
Shooting Star\0
Rank:\0
Congratulations! You've won the battle!\0
You've lost the battle!\0
Player\0
LAN Game\0
's Game\0
Game\0
Waiting for client.\0
Waiting for server.\0
You've lost the battle!\0
Please wait for the battle to end!\0
Forest campaign\0
Desert campaign\0
Ice campaign\0
Volcano campaign\0
Single player\0
Multiplayer\0
Score\0
Opponent\0
Level\0
AVAILABLE\0
Ally\0
640 x 480\0
800 x 600\0
1024 x 768\0
1280 x 1024\0
1600 x 1200\0
2048 x 1536\0
Low\0
Medium\0
High\0
16 Bit (high colour)\0
32 Bit (true colour)\0
Game resolution:\0
Texture detail:\0
Game colour depth:\0
Texture colour depth:\0
SFX volume:\0
Music volume:\0
Speech volume:\0
Comments:\0
\0
Server has closed the game.@nPress "Continue" to proceed.\0
Player name (max. 15 chars):\0
Choose your coat of arms:\0
Please choose an enemy castle to cast the spell on.\0
Current target:\0
Protective Shield\0
Metal shield\0
Rain spell\0
Fog spell\0
Lightning spell\0
Thunderstorm spell\0
Hurricane spell\0
Hill\0
Earthquake spell\0
Miasma\0
Peasant\0
Wrath of Jupiter\0
Royal Shield\0
Sandcloud\0
Icefinger\0
Hellholes\0
User's game\0
Hotseat\0
It's your turn player\0
Bronze\0
Silver\0
Gold\0
Chat input\0
Press <Return> to send chat message\0
Pressing the left mouse button cycles your view through the castles\0
or use the <PageUp> or <PageDown> Key\0
This is a fast, hands on battle. All opponents face each other with fully developed castles that are armed to the teeth. The idea is shoot and destroy. Objective is to destroy all the opponent's weapons.  Ammo won't cost you anything. This is a quick, action packed scenario, in which only the weapons of the participants are repaired.\0
Each player begins the battle with a fully developed castle, that is armed to the teeth. This scenario is perfect for players, who want a quick game without dispensing with building, research and magic features. Objective is to destroy the opponent's palace.\0
Each castle is equipped with the most important buildings and sufficient farmers. The castle is not protected by walls and towers. The player has to decide very fast what to do. E.g. erecting a protective wall or development of next generation weapons. Objective is to destroy the opponent's castle.\0
The castles are equipped with only the minimum of buildings needed. The challenge is the intelligent development of your resources and weaponry. Objective is to destroy the opponent's castle.\0
Here you determine the number of opponents. The more opponents you choose, the more weapons and gold you will have when you start the game.\0
Here you determine your opponent's strength. The higher the level is, the more dangerous your opponent will be.\0
Here you can select the scenery for the upcoming battle. Random scenery selection is also available.\0
Here you can choose which princess to serve. Your selection determines which royal weapon and royal spell is at your disposal when the battle starts.\0
If you do not want to select a fixed scenario but prefer to devise one yourself, you can do this here.\0
Takes you back to the Main Menu.\0
Start the game with the parameters above.\0
(Only if possible)\0
All players who have the same number are one team. Objective is to annihilate all the enemy teams.\0
You can set a specific parameter that adjusts the amount of gold a farmer produces and the amount of gold in your coffers when you start. This allows you to compensate for different player's strengths. The higher the factor is, the higher your income will be.\0
Here you can add or remove AI opponents. The figure shows the strength of the AI opponent.\0
Here you can determine the tactics the AI opponent follows.\0
Takes you back to the "Choose Scenario Menu".\0
This option enables you to select your castle's starting buildings and starting weapons. Your selection will be randomly placed in your castle.\0
For each preset there is a selection of prebuilt starting castles available.\0
Select your castle type here. Weapons are displayed in blue.\0
Determines the number of catapults at the beginning of the game. Catapults are rather imprecise, but do cause high collatoral damage.\0
Determines the number of cannons at the beginning of the game. Cannons are mounted on towers and walls. Cannons are precise, but cause little collatoral damage.\0
You should start with at least 3 farmhouses to have enough gold at your disposal. Farmhouses are the backbone of your economic system.\0
Determines how many farmers live in each farmhouse at the beginning of the game. Each newly built farmhouse will start with this population. A farmhouse can shelter a maximum of 10 farmers.\0
The treasury allows you to store more than 2000 gold coins.\0
This is the most valuable building in the game besides your palace. It is the ONLY building that can carry out build and repair orders.\0
This building allows you to produce weapons. The only weapons you won't need this for are the catapult and the Long John.\0
This is your laboratory. All research is done here. Researching improves your protective abilities and your weaponry.\0
The Mage Tower opens up the world of arcane powers to you.\0
Set the amount of gold all players start with here. Adjust the amount individual players have at their disposal by using the gold factor.\0
The number of minutes set create a cease-fire of this duration at the start. This ensures a peaceful development phase in the early game stages.\0
After this time has run out NO build or repair orders will be carried out. This is useful to limit game time.\0
If this option is deactivated NO repair orders for structures or weapons will be carried out.\0
If this option is deactivated, you won' t be able to construct ANY more buildings or weapons. This greatly simplifies and shortens gameplay.\0
Determines if magic can be used during battle or not.\0
If this option is deactivated NO research is possible. This greatly increases the importance of your castle walls.\0
Here you decide if zeppelins can be used in battle or not. If you decide against zeppelins in battle the anti-aircraft weapon, the Ballista is NOT available in the game.\0
Each princess has a powerful "royal weapon" at her disposal. If you want to battle WITHOUT this weapon, deactivate this option here.\0
This special weapon type can ONLY be researched once ALL other weapons in the game have been created. It will then take a further 90 seconds to build it. The first player completing this weapon, WINS the game automatically. You can deactivate this possibility here.@nThis option can't be used at the same time as a "Night Curfew".\0
Wind makes your bullets drift off course. The stronger the wind the more the drift, which makes aiming more difficult.\0
The higher you set the value of this parameter, the more the direction of the wind will change during gameplay. Frequent changes in wind direction and high windspeed can reduce targeting to complete chance. \0
Deactivate this option to have permanent daylight.\0
Using this option ensures noone shoots during the Night Curfew. This allows the castles to repair a bit of the damage during the night. The battle will however last much longer.@nThis option can NOT be used at the same time as "SUPER WEAPON".\0
If you ACTIVATE this option NO structure is built or repaired during the night. This makes your castle VERY VULNERABLE during the night.\0
Select your opponent here. To ensure that the battle data will be part of the BALLERBURG battle stats you can only select players who are on the player list.\0
Takes you back to the "Main Menu"\0
Deactivating this option means you can NOT repair or scrap ANY building or weapon. This option is ALWAYS deactivated in Hotseat Mode.\0
Bronze: awarded for successful completion of the 1st campaign.@nSilver: awarded for successful completion of the 1st campaign in less than 60 minutes.@nGold: awarded for successful completion of the 1st campaign in less than 40 minutes.\0
Bronze: awarded for successful completion of the 2nd campaign.@nSilver: awarded for successful completion of the 2nd campaign in less than 120 minutes.@nGold: awarded for successful completion of the 2nd campaign in less than 90 minutes.\0
Bronze : awarded for successful completion of the 3rd campaign.@nSilver: awarded for successful completion of the 3rd campaign in less than 180 minutes.@nGold: awarded for successful completion of the 3rd campaign in less than 140 minutes.\0
Bronze : awarded for successful completion of the 4th campaign.@nSilver: awarded for successful completion of the 4th campaign in less than 130 minutes.@nGold: awarded for successful completion of the 4th campaign in less than 100 minutes.\0
Bronze: awarded for wining an easy action scenario game.@nSilver: awarded for winning a normal action scenario game.@nGold: awarded for winning a hard action scenario game.\0
Bronze: awarded for winning an easy quick scenario game.@nSilver: awarded for winning a normal quick scenario game.@nGold: awarded for winning a hard quick scenario game.\0
Bronze: awarded for winning a tatics scenario game.@nSilver: awarded for winning a normal tactics scenario game.@nGold: awarded for winning a hard tactics scenario game.\0
Bronze: awarded for winning an easy strategy scenario game.@nSilver: awarded for winning a normal strategy scenario game.@nGold: awarded for winning a hard strategy scenario game.\0
Bronze: awarded for causing 1000 gold coins or more worth of damage with zeppelin@nSilver: awarded for awarded for causing 2000 gold coins or more worth of damage with zeppelin.@nGold: awarded for causing 3500 gold coins or more worth of damage with zeppelin.\0
Bronze: awarded for a total score of more than 300 in one game.@nSilver: awarded for a total score of more than 600 in one game.@nGold: awarded for a total score of more than 900 in one game.\0
Bronze: awarded for a hit ratio of more than 35% in one game.@nSilver: awarded for a hit ratio of more than 55% in one game.@nGold: awarded for a hit ratio of more than 75% in one game.\0
Bronze: Spending of 900 gold coins or more on spells.@nSilver: Spending of 2000 gold coins or more on spells.@nGold: Spending of 3500 gold coins or more on spells.\0
If you want to design your own battle scenario, you can adjust the game parameters here.\0
Select a preset here. The main difference is that there will be NO walls and towers around your castle to start with if you choose "Strategy". Your user defined settings will be LOST.\0
Select a preset castle here as your starting castle. The display is similar to the castle overview map. Buildings are displayed in green. Weapons in blue.\0
Select your opponent here. To ensure that the battle data will be part of the BALLERBURG battle stats, you can only select players who are on the BALLERBURG player's list.@nTo play the Hotseat mode you need TWO human players to sign up. You can add a NEW player at the start of BALLERBURG or in the Options menu.\0
Gold\0
(c) 2002 Ascaron, Version 1.00\0
M a i n   M e n u\0
O p t i o n s\0
Exit Game\0
T u t o r i a l\0
C a m p a i g n s\0
M u l t i p l a y e r\0
E x t r a s\0
M o v i e s\0
M e d a l s\0
H a l l  o f  F a m e\0
Scenario\0
Player Selection\0
Delete Player\0
P A U S E\0
CPU Level\0
 has left the LAN-Game.\0
No\0
Yes\0
After\0
Action mode@nThis is where sharpshooters can let off a bit of aggression. All you need is a good eye and a talent for tactical play.@n@nThe objective is to destroy all enemy weapons.@n@nThe enemies' weapons can be identified by the plumes of white smoke above them. A castle falls once it has lost all its weapons. The palace must not be destroyed.@n@nThe weapon loading time depends on the number of weapons a castle has. The fewer weapons a player has left, the faster the weapons will reload. The auto-repair function repairs the weapons and the palace. Provided that there's a mason's yard and enough gold to hand, of course.\0
sec. until menu closes.\0
BALLERBURG\0
Level\0
Complete!\0
Info\0
Most important\0
A few\0
Many\0
Most\0
All\0
Boris\0
Thomas\0
Daniel\0
Goliath\0
Dragan\0
Sigbert\0
Gregor\0
Damien\0
Soltan\0
Gerwulf\0
Darius\0
Sigurd\0
Mission: Destroy all enemy weapons.\0
Help: F1 button\0
Connection to the server could not be established.@nPress "Continue" to exit the program.\0
Cannot enter game-server mode.@nPress "Continue" to exit the program.\0
Cannot enter game-client mode.@nPress "Continue" to exit the program.\0
SINGLE PLAYER\0
MULTIPLAYER\0
Click on the flashing question mark!\0
Welcome to the BALLERBURG Tutorial!@n@nClicking the question mark gives you hints for your current mission and general gameplay. Always use this information tool if you are unsure how to solve your current mission or if you need help mastering the interface.@nFurthermore, this help tool offers useful tips for successful fighting, using the interface and provides important background information. So it's always a good idea to click the questionmark if it is flashing.@n@nYou have various tasks in BALLERBURG: to develop your castle, to research, to cast spells, and last, but not least bombing your opponent back to the stone age. As this is the key to success, we have made it the subject matter of the first tutorial.@n@n@n"EXIT" takes you back to the tutorial missions screen, "CONTINUE" will let you go on with the tutorial.@n@nHave fun!\0
Move cam until the castle symbol is at the top of the compass.\0
Camera Controls@n@nYou can move the camera in the CASTLE VIEW. By default, it always focuses on the middle of your castle. Holding down the right mouse button whilst moving the mouse moves the camera around the castle or alters its angle of view. This is very useful for inspecting buildings hidden by walls or for aiming at your opponent's castle buildings.@n@nTo zoom the camera in and out, move the mouse up and down whilst holding both mouse buttons down.@n@nUp to three different castle symbols attached to the compass indicate the position of the enemy castle(s). If the symbol of the castle you want to inspect or aim at is at the top of the compass, you are looking right at it. Your camera position is the "middle" of the compass.@n@nNow hold down the right mouse button and move the camera until the green castle symbol is at the top.\0
Click to select buildings\0
Buildings Information@n@nYou can access all of your buildings by clicking on them in castle view. The left hand menu informs you about the current state of the building, showing a percentage bar for the selected structure. Repair or scrap orders for buildings can be issued here.@nSome game features are only available if you have the appropriate building. For example to research, you need a Superbrain in residence.@nDouble-clicking on a structure brings up its sub-menu. Clicking on a weapon brings up the weapon view. Close sub-menus by right-clicking the mouse or selecting "Back".@n@nYou will now see a castle overview map in the bottom left hand corner.@nUndamaged weapons are BLUE and undamaged structures are GREEN. These colours gradually change to bright red the more damage they sustain. This gives you a good overview of the condition your castle is in.  Just like in castle view, clicking on any item takes you directly to it.@n@nNow select a building in the castle view and one on the overview map.\0
Switch to Weapon view\0
The Menu Structure@n@nIn general, you will use the right main menu to issue your orders. It opens by moving the mouse cursor to the right side of the screen, and closes if you move the mouse cursor back again.@nMain menu options not displaying any text indicate that the corresponding function is not available in the current mission. Dimmed switches indicate that the corresponding structure is missing.@n@nOn the left side of the screen you will find the weapons menu. It has the same structure as the main menu, and works in the same way. The total amount of slots indicate the maximum number of weapons you can build. A dimmed switch indicates that you can build another weapon. The loading bar displays the time spent for the reloading process of the weapon. A green LED indicates that the weapon is ready to fire.@n@nTo change to the weapons view now, you can use the following methods:@nThe main menu button "weapon view", a mouse click on the weapon button in the weapons menu, a double click directly on the weapon or on its map symbol, using the F2-key or pressing the keys 1 to 8 for direct access (from bottom-switch to top-switch).\0
Align your weapon with the windmill\0
Weapon Controls@n@nThis is the weapon view. Basically the weapon view interface allows you to align your weapon with the target using the directional keys positioned around the red fire button in the centre of the screen. It is simple to issue fire orders after you've aligned your weapon. Just press the red fire button.@n@nYou can use the mouse as well to perform the same action. Simply click the coordinate display, hold down the left mouse button and drag the weapon into the desired position. Please be patient, the weapon follows this command a bit slowly, because your artillerymen need time to execute the alignment order.@n@nTo align the weapon accurately use the compass in the upper right corner of the screen. Alter the position of your weapon until the castle symbol is on top. Now the weapon is aligned with your opponent's castle and you can choose your targets. If you want to have a bit more of a look around, hold down the right mouse button, click anywhere in the landscape and move the mouse.@n@nNow align the weapon horizontally with your opponent's windmill.\0
Issue a fire order and switch to the impact view\0
Firing Your Weapons@n@nAfter your artilleryman has finished his report, the map of the opponent's castle will appear. Pay attention to the mission briefing and do not fire on allies. Align your weapon with the target and press the red fire button. Remember you can only fire if you have enough gold to pay for the shot and the weapon is loaded. The reload time is indicated by the reloading bar. Once this has reached max., your artillerymen have reloaded the weapon and you can fire again.@n@nAfter firing your weapon, switch to impact view to monitor the accuracy of your shot. The crosshair is always aimed at the point of the scenery you've fired upon. The accuracy of the shot is determined by the alignment and the precision of your weapon. You will have to compensate for a weapon's lack of precision with your alignment.@nThe keyboard can also be used for this. The spacebar fires the weapon, the directional keys align the weapon and the END-key switches to the impact view.@n@nNow fire your weapon by pressing the fire button and immediately switch to the impact view using the END-key on your keyboard.\0
Destroy your opponent's windmill\0
Correct Weapon Alignment after the Shot@n@nAfter your gunner has finished his new report, the map of the enemy's castle is displayed in the lower right corner of the screen. Here you can monitor the impact of your shot. If you've hit the castle a grey circle is displayed, if you missed it, you will see an arrow on one of the edges of the map.@n@nThe weapons in BALLERBURG are not precise. The crosshair in the impact view shows the point you aimed at. You will notice that the actual impact is at a different spot. After the impact, the crosshair switches to the exact location of the impact to help you determine the changes required to hit your target with the next shot. The crosshair will remain on the last impact point until the weapon is fired again, then it will switch to the new impact point again.@nNow correct your weapon alignment with the directional keys and fire again, once your artillerymen have reloaded the weapon.@nAnother factor that influences the precision of your shot is the wind. A strong wind can carry your projectiles away from the point you aimed at. You can determine the wind strength and direction using the compass in the upper right corner of your screen. The wind direction is displayed by the red arrow. Under tutorial conditions, the wind strength is set to 0. You will not have to deal with this right now.@n@nYour task now is to destroy the windmill.\0
Switch to a different weapon\0
The Different Weapons@n@nNormally your arsenal will consist of different weapon types. Each weapon has it's own firing parameters and damage effect. This means that each weapon type needs a different set of firing co-ordinates to hit the same target.@n@nIn this part of the tutorial you have a cannon and a catapult at your command. These weapons have differing needs and characteristics.@nThe cannon always has to be mounted on a castle wall or a tower. The damage it causes is severe and rather precise. Cannons are not so easy to locate on the overview map, because they are mounted on walls and towers.@nThe catapult is always mounted on the ground and is therefore easily located. It isn't accurate or very powerful, but it inflicts collateral damage on buildings within in a certain range.@nTo switch from one weapon to another use the buttons with the cannon symbol below the fire button.@nUse them switch your weapons.\0
Click on your overview.\0
Toggeling between Castle View and Weapon View@n@nYou have learned how to switch the weapons using the cannon keys in the weapon view. You can do the same with direct click on a weapon in your overview map, by pressing F2, typing the corresponding number key or using the weapons menu on the left of your screen. Choose the method you think is most convenient.@n@nYou can go back to the castle view from the sub-menus and the weapon view with a single click on the overview map. In general, you will use this view to issue build or repair orders.@nPlease remember that double-clicking a weapon in the overview map takes you to the weapon view and not to the castle view! The same principle works in the castle view.@n@nNow go back to the castle view using the overview map of your castle!\0
Destroy the opponent's weapon!\0
How to Destroy the Opponent's Weapon@n@nYou have already learned all the basics you need to fight. Now it's time to weaken your enemy.@n@nSwitch back to the weapon view and align your fire with the opponent's weapon. Fine-tune the firing parameters of both weapons and remember that each weapon type requires it's specific settings.@n@nYour target is easily located since it is mounted on the ground. It is displayed as a 3x3 square in the overview in the lower right corner of your screen, the opponent's map.@n@nThis map does not display any colours for the different structures and weapons. This makes it more difficult to identify weapons mounted on walls or towers.@nThese weapons are much easier to locate in impact view. You can identify their location by following their firing traces back to their origin, too.@n@nDestroy your enemy's catapult now!\0
End this part of the tutorial by clicking the questionmark\0
End of Tutorial 1.@n@nCongratulations! You successfully mastered the first part of the tutorial. Now you know how to fight and nobody will challenge you and escape unpunished.@n@nSo you've mastered firing a weapon. You can hit a target (well sometimes!), but there's more to BALLERBURG than just that. So let's press on!@n@nIn the next part of the tutorial you will learn how to manage your castle's economic system. Without gold you will be a sitting duck for your enemies, as each shot, building, invention and repair needs to be paid for. You will also learn how to build structures and weapons and which structures are required for that purpose.@n@nStart the second part of the tutorial by clicking the "CONTINUE" button. End Of Tutorial\0
-\0
The Enemy is Annihilated!@n@nWell done! You've even managed to destroy your opponent's palace and won the battle. You've obviously got the hang of aiming your weapons.@n@nShooting skills are only one part in successfully mastering BALLERBURG. There is more to learn. Be prepared!@n@nIn the next part of the tutorial you will learn how to manage your castle's economic system. Without gold you will be a sitting duck for your enemies, as each shot, building, invention and repair needs to be paid for. You will also learn how to build structures and weapons and which structures are required for that purpose.@n@nStart the second part of the tutorial by clicking CONTINUE. If you want to take a break, simply click EXIT. EXIT takes you back to the tutorial main menu. As you like.\0
Open the sub-menu Build Structure\0
Welcome to the Second Tutorial of BALLERBURG!@n@nNow you have learned to defend yourself, you need to learn how to manage your castle successfully. This is no trivial task, there are walls to be erected, weapons mounted, facilities have to be built and much more. And you've guessed: all these tasks require gold, without it nothing moves.@n@nYou issue a build order for structures in the sub-menu "Build Structure". You can reach this sub-menu in two different ways: via the "Main Menu" on the right side of your screen or by pressing F3.@nJust follow the advice of your servant. The first thing he asks you to do is to open the "Build Structure" menu.@n@nUse the questionmark! As always, this useful help tool will provide hints and background information on your mission. So it's a good idea to click the questionmark if it flashes.@n@nClick on "Continue" to proceed with the tutorial.\0
Build a Mason's Yard!\0
Building Structures@n@nAll orders to build a structure are issued from the "Build Structure" sub-menu. The mason's yard is responsible for building and repairing facilities. Until you build a mason's yard, you can only build farmhouses. The mason's yard is therefore the key to developing your castle. Take good care of it and protect it well! If it is destroyed neither a build nor a repair order can be issued until you have built a new one.@n@nNow left-click the Mason's Yard button to build it. The camera now switches automatically to bird's-eye view. The selected building is visible on the end of your cursor. Green colored soil shows you where building is allowed. Now select an appropriate place for the structure and click it with your mouse to build there. If you hold down the left mouse button, you can align the building as you like. Your view will automatically switch back to the view where you issued the build order from. This can be the weapon or castle view. You can cancel a build order at any time before completion, by clicking the right mouse button.@nNow build a Mason's Yard!\0
Build a farmhouse\0
The Economic System@n@nThe whole economic system is based on taxes. Farmers pay tax and these taxes are the one and only way to finance your efforts. The more farmers you have the richer; the less you have, the poorer you will be. Nice and simple.@n@nThe number of farmers is limited by 3 factors:@n-Each farmhouse has a maximum capacity of 10 farmers.@n-Each farmhouse has a starting population of 5 farmers.@n-The tax rate. At a Tax rate below 40% the population will grow steadily to its maximum, a Tax rate of 40% keeps the population constant and a Tax rate above 40% will cause a decrease of your population..@nHint: a palace pays taxes equivalent to that of 10 peasants at a tax rate of 40%.@nAll important information regarding taxes and farmers is displayed in the header. You will find the following information from left to right:@n- The amount of gold at your disposal.@n- The amount of farmers with the maximum population possible in brackets.@n- The current tax level@n- The number of weapons at your command with the maximum number possible in brackets.@nYou can set the tax level in the castle view, by clicking your heraldic symbol.@nNow build a new farmhouse!\0
Build a tower and attach 5 wall-elements to it\0
The Castle Walls@n@nOn the whole your castle will be under a pretty constant state of siege. All valuable buildings and your palace have to be protected from your enemies. The castle's walls and towers are crucial for this task. Also never underestimate how much walls block the line of your opponent's view. Structures located directly behind walls are not displayed on your opponent's overview map. Keep that in mind when you construct your castle walls.@n@nTowers like any other building can be placed on a free spot of land. Building them is expensive, but they offer excellent protection. Wall sections can only be erected directly adjacent to an existing wall or tower. The new wall section automatically aligns itself with existing walls or towers.@n@nAfter each structure has been placed, you will automatically switch back to the menu and view you issued the order from. To place several structures of the same type in one step, just hold down SHIFT while you are placing them.@n@nNow build a tower and at least 5 wall elements!\0
Change to the sub-menu "Build Weapons"\0
How to Build Weapons@n@nSo you have learned how to build new structures and how to protect them with towers and walls. Now it's high time to teach you how to develop your offensive potential.@nWeapons are built in the same way as structures, with the difference that the number of available weapon slots is limited and some weapons require mounting on towers or walls.@n@nThere are only 2 weapons available to you to start with. The maximum amount of weapons you can build is displayed in brackets in the header menu. Another way of knowing how many weapons you can build is to count the empty weapon slots in the "Weapons Menu" on the left side of your screen.@nBuild orders for new weapons are issued in the "Build Weapon" sub-menu. Open this via the "MAIN MENU" on the right side of the screen or by pressing F4 to get direct access.@n@nNow open the "Build Weapon" menu!\0
Mount a catapult\0
The Catapult@n@nEach weapon in BALLERBURG has its own unique features and capabilities. All have their pros and cons.@nThe catapult is your most cost-efficient basic weapon. It is rather imprecise and the rocks thrown at your beloved foe do not inflict severe damage. However, rocks do inflict collateral damage to all structures in the vicinity too. So the catapult might not be much use for taking out individual objects, but is a perfect weapon for inflicting serious damage in dense areas.@nCatapults are mounted straight onto the ground. They are built the same way as structures, but require more free space. Weapons have no build time. You can use them, as soon as you place them..@n@nNow select the catapult in the "Weapons Menu" and arm your castle with it!\0
Build a smithy to construct new weapons\0
The Smithy@n@nYou can always build a catapult. For all other weapons in BALLERBURG you need the skills of a smithy. You should always have one serving you.@nAs you know there are a variety of weapon types in BALLERBURG each with it's individual pros and cons. Which weapon you choose is just a matter of personal taste. The smithy can provide you with the following arms:@nLong John: Imprecise, high collateral damage, low costs@nCannon: Precise, low collateral damage, relatively horizontal firing range@nFire catapult: inflicts severe fire damage, ineffective on walls, towers and palaces@nRocket Launcher: serious damage with explosive warheads, needs long time to reload, expensive@nBallista: Anti-Aircraft Weapon, causes practically no damage to structures and weapons@n@nNow build a smithy!\0
Mount a cannon on a wall or tower!\0
The Cannon@n@nNow that you have a smithy you can build your second basic weapon, the cannon.@nIt's precise, but can only be mounted on walls or towers. This is an advantage since those structures offer a certain degree of protection from enemy fire. Compared to the catapult its real disadvantage is the price. Oh and we should mention that you need a real smooth hand to align it. Whenever possible, the cannon should be mounted on a tower, as this offers more protection than a wall.@nTo build this workhorse select the "Cannon" in the Build Weapons menu. Your view will switch to bird's-eye view and you can mount it on a tower or wall. Locate a green flashing part of a tower or wall and simply mount it there pressing the left mouse button.@n@nNow build a cannon!\0
Build an ammo workshop and a zeppelin\0
The Ammo Workshop@n@nTo reach the highest pinnacle of weapon construction, you need to build an ammo workshop. It delivers the required technology to build the following special weapons:@nZeppelin: Steerable balloon carrying a heavy explosive bomb@nRoyal Weapon: Four unique and very mighty weapons@nSuper weapon: This is the ultimate weapon. Whoever owns one of these babies, can win the game within a minute.@nAll these special weapons have to be researched before you can build them. Research is explained fully in the 3rd tutorial. Here we'll just concentrate on researching and building a zeppelin.@nThe ammo workshop brings you another advantage. As soon as it's finished your ammo costs will be reduced by a third.@nThere is however one little disadvantage. If the ammo workshop is destroyed by enemy fire the exploding gun powder will inflict devastating damage on its surroundings. So don't put it near key buildings.@n@nNow build an ammo workshop and a zeppelin!\0
Destroy an enemy building with the zeppelin's bomb\0
The Zeppelin@n@nThe zeppelin is your Luftwaffe in BALLERBURG. It's the only weapon able to move and carries a heavy, highly explosive bomb. The only effective weapon against a zepp is the ballista: your anti-aircraft-weapon in BALLERBURG.@nYou can issue orders to the zepp just like other weapons in your arsenal. Before you send out this doozy of a weapon you must however arm it. Arming it is as easy as reloading a standard weapon. Just press the load switch attached to the right of the fire button in the zepp view (Weapon View). You steer the zeppelin using the directional keys. The zepp flies at a constant speed. Don't worry about altitude! Your zepp adjusts for this automatically. The directional key "up" starts the engines, "down" stops them.@n@nYou have 2 camera views at your disposal. First the in-flight view: a 3rd person view from behind the zepp. This is very handy for steering your aircraft through the BALLERBURG landscape. Second is the target view. It shows your zepp in a 3rd-person view with a red circle projected on the ground. This is your impact indicator. Toggle between the two views using the END key.@nNow load your zepp and navigate it to your opponent's castle. Deliver your payload there! The fire-button releases the bomb. The zeppelin will automatically return to your castle where you can rearm it.@nNow get airborne and destroy at least one enemy building!\0
End this tutorial by clicking the questionmark.\0
End of the Second Tutorial@n@nCongratulations! Now you are able to manage your castle. Your decision making skills will develop with experience, and your castle will develop accordingly.@n@nYou are now an able artilleryman and you know how to develop your castle. However battles are often won by those with the best gear. So weapon research is a must and magic can be decisive.@n@nThe next part of the tutorial deals with researching new technologies. Upgrading your weapons can prove critical to winning a battle. You also have awesome arcane powers at your beck and call in BALLERBURG. Here you will learn about the defensive and offensive spells that will help you to win your battles.@n@nTo start the third tutorial press "CONTINUE" or press "QUIT" to go back to the Tutorial Main Menu.\0
-\0
Your Foe is Annihilated!@n@nWell done! You even managed to destroy the enemy's castle and so have won the battle. This wasn't strictly the brief, but it's good to see that you're a natural.@nLet's hope that you master building your castle up and managing its finances, as well as you fight.@nAs you seem to be mastering skills well, you might as well go straight onto the 3rd part of the tutorial.@n@nHere you will learn how to research new technologies. Upgrading your weapons can prove critical in winning a battle. You also have awesome arcane powers at your beck and call in BALLERBURG. Learn about the defensive and offensive spells that will help you to win your battles.@n@nTo start the third tutorial press "CONTINUE" or press "QUIT" to go back to the Tutorial Main Menu.\0
Build a superbrain\0
Welcome to the Third Tutorial of BALLERBURG!@n@nIn the previous tutorials you have learned how to fire your weapons, research new weapon technology and develop new facilities for your castle. You are aware that farmers are the backbone of your economy.@nYou have two key focuses during a battle:@n- Strategic, careful target selection, so elliminating them with ruthless efficiency.@n- Managing your limited gold resources well.@n@nAt the beginning it will be difficult to decide what to spend the meagre gold supplies on:@nFarmhouses - to increase your paltry income@nWalls/Towers - to protect important buildings@nWeapons - for speedy attack@nAmmo - every single shot costs gold@nA Superbrain - in order to invent powerful weapons quickly@n@nFast weapon research is crucial and you should build a superbrain as soon as you can afford it, without plundering your coffers of the last piece of gold. Even in the early stages of a battle a superbrain may be the key to victory, because his inventions will broaden your tactical repertoire.@nNow build an superbrain!\0
Research the Long John\0
Research@n@nThe superbrain has opened up many interesting research possibilities to you. Keep R&D moving forwards as fast as possible, to keep you ahead of your enemies. They will not be resting on their laurels.@n@nBuilding a superbrain has added the Research button to Main Menu on the right-hand side of your screen. Access the Research Menu via the Main Menu, by pressing F6 or by clicking on the building. There are two possible reasons for this menu not to open:@n- Your superbrain is already busy working for you.@n- There is nothing left to research.@nIf you want to check the current development status just select your superbrain via the overview map in the castle view screen and a progress bar will be displayed.@n@nNow open the Research Menu and left-click on Long John.\0
Open fire with the Long John\0
The Long John@n@nIt is useful to develop existing weapon technology at the beginning of the battle. At the start of this tutorial you had a catapult, which is now upgraded to a Long John. The Long John is a catapult that fires with three loads of rocks instead of just the one.@n@nWeapon development has a second effect:@n- As soon as it is developed, all weapons of this class are automatically refitted to the new type. You will no longer be able to build the basic weapon.@nWeapons that need an ammo workshop will not be replaced and updated automatically. You still have to build them.@n@nSo lets see the difference between a catapult and the Long John! Switch to weapon view and fire the Long John. Then take a look at the damage in impact view! It is worth it!\0
Let the superbrain help you get more weapons\0
Adding Weapons@n@nAt the start of the game only two weapon slots are at your disposal. This can quickly cramp your style. The "Add weapon" technology is a handy tool to exploit your offensive potential to the max. Each time an "add weapon" order is carried out you will get a new weapon slot. A total of eight is possible. In later stages of the game, when you have more powerful weapons researched, you can scrap an older model and free up the slot for your improved weaponry.@nYou can see the total number of weapons you could currently use in two ways:@n- By the total amount of weapon slots in your Weapon Menu on the left side of your screen.@n- In the header display at the right side of the cannon symbol. This displays the number of weapons you currently own and - in brackets - the maximum number of free weapon slots. The figures are displayed in red if you have reached the maximum number of weapons and no free slots are left.@nCurrently you own two weapons within two slots. To add a slot select "Add Weapon" in the Research Menu.@n@nCurrently you own two weapons: a cannon and a Long John. To add to this you will first need to research "Add Weapon" by selecting it in the Research Menu.@n@nDo it now!\0
Research of the Trebuchet\0
The Royal Weapons@n@nYour Superbrain will create a unique royal weapon to complement the princess you are currently serving. These weapons are advanced designs of basic weapons.@n@nTo research the royal weapon you first need to have the basic weapon. The basic models required vary from princess to princess:@n- Forest Princess: Long John is required for Trebuchet@n- Ice Princess: Double cannon is required for Fat Freda@n- Desert Princess: Long John is required for Arcaballista@n- Volcano Princess: Double cannon is required for Hellfire@n@nAs you are in the service of the Forest Princess in this tutorial you have got the basic model required for the royal weapon by having already researched the Long John.@nNow research the Trebuchet!\0
Build a Trebuchet and fire it\0
The Trebuchet@n@nAfter researching a royal weapon, it then has to be built. Remember that all advanced weapons an ammo workshop, as well as a smithy for production! If you are having trouble issuing a special weapon build order during battle, check if one of those buildings is missing. All the gold and technology in the universe won't help if one of these buildings isn't there or has just been destroyed.@n@nRight now you have both these buildings at your disposal and can therefore build the Trebuchet.@n@nAll special weapons, barring the zeppelin, are ground mounted and are built in the same way as catapults. Just like catapults they are immediately operational.@n@nNow switch to the weapons menu and build a Trebuchet. Fire it and switch to impact view to check out the difference.@n@nIf you have already built three weapons you will have to scrap one to free up a weapon slot for the Trebuchet..\0
Build a Mage Tower\0
The Arcane Powers@n@nNow the final secret of BALLERBURG will be revealed to you. Using magic.@n@nMages are mighty allies, who reside in mage towers amongst vast quantities of parchments from the magic eras that time forgot.@n@nYou need a mage tower to attract one of these powerful men. It can be built like any other building.@n@nOne mage tower should suffice. After a mage has cast a spell he needs some time to recover. Building more than one mage tower does not speed up this recovery time. It may be a good idea to build one or two spares if you can, as this will minimise the risk of disrupting magical research if your enemy destroys this huge and vulnerable building.@n@nBeware: due to it's size it is unfortunately the perfect target for your foe's artillery.@n@nNow switch to the Build menu and erect a mage tower.\0
Open the "Magic" sub-menu and cast a rain spel\0
The Rain Spell@n@nNow you can unleash the true power of magic. Every mage knows how to cast a rain spell. You aren't a proper mage until you can do this.@n@nThis is a protective spell you will learn to appreciate. It opens the floodgates of heaven and everything and everyone (friend or foe) will be drenched in seconds.@n@nThe spell has two military effects:@n- All normal fires will be extinguished immediately. This can save essential buildings.@n- There are many weapons that rely on fire to function. For instance the Fire catapult's ammo is on fire or the cannon which requires fire to ignite the gunpowder. These are rendered useless by rain.@n@n@nSo open the Mage menu and let your mage cast a rain spell!\0
Research a new spell\0
Researching Spells@n@nThe rain spell might be quite useful, but can get a little boring. So to exploit your mage's full potential ask him to research a few more spells. As you might have guessed, there are many different spells in BALLERBURG. Protective spells to hide you from your enemy via smoke screens, offensive spells to wreak havoc on your opponent's buildings and weapons and more besides.@n@nYou can set your mage to work learn more spells. He concentrates hard on his scrolls and gradually gleans the knowledge to cast three other spells. These are acquired at random from whichever parchment was least dusty.@n@nThe last spell he can learn is the Princess's own spell. Besides being rather powerful, it reflects the princess's character. For instance your current mistress the Forest Princess is a more or less peaceful character. So her spell throws a protective shield around the castle.@n@nYou can stop the research of a new spell at any time. This can be quite useful if your castle is on fire and you need a rain spell.@nNow open the Magic Menu and let your mage learn a new spell!\0
Cast the Thunderstorm Spell on your Opponent's Castle!\0
Aggressive Spells@n@nYou just researched the Thunderstorm spell. It doesn't affect everyone like the rain spell, but hits whichever castle you aimed it at. Several lightning bolts will hit your opponent's buildings and cause severe damage.@nAfter you've selected this spell, the mage target view will appear. Select the target castle using the directional Keys. Your view will automatically align with the chosen target castle. Now simply press Fire to unleash the spell.@n@nRoyal spells are not cast on a selected enemy. They affect all of your opponents' castles, but spare those of your allies.@n@nYou can also call up the Mage menu by pressing F7.@n@nNow open the Mage menu and cast the thunderstorm spell on whichever castle you like!\0
End this tutorial by clicking the questionmark.\0
End of the Last Tutorial@n@nCongratulations! You have now mastered the worlds of science and of magic! You have become a worthy opponent to your princess's foes. Now it's high time to go kick some royal butt.@n@nDid you click on the questionmark as soon as it flashed and read the hints? If so you will have all the background information you need to make you a fearsome opponent.@n@nYour princess, the Forest Princess, is in urgent need of your services. So grab your things and start the first campaign from the Main Menu. Show her your newly aquired knowledge.@n@nClick CONTINUE to get to the Start menu or press EXIT to go back to the Main Menu.@n@nNow click CONTINUE or EXIT!\0
-\0
All Foes are Annihilated!@n@nPerfect job! You managed to destroy all your enemies and have won the battle. This was not really the objective, but bodes well for your future career in BALLERBURG. Always remember that science and magic provide the key to success in BALLERBURG.@n@nDid you click on the questionmark as soon as it flashed and read the hints? If so you will have all the background information you need to make you a fearsome opponent.@n@nYour princess, the Forest Princess, is in urgent need of your services. So grab your things and start the first campaign from the Main Menu. Show her your newly aquired knowledge.@n@nClick CONTINUE to get to the Start menu or press EXIT to go back to the Main Menu.@n@nNow click CONTINUE or EXIT!\0
@n@GForest Campaign, Mission 1:@nHello big boy! How wonderful that you've come... hope you didn't have too much trouble finding the way. Now did you know that my silly sister, the Ice Princess, has insulted those sweet, peace-loving little farmers of mine? That's really not nice, is it? Please be a complete darling and blow her castle up. I'm looking forward to us having some fun together!@n@WObjective:@nDestruction of following buildings:@n- 5 Farmhouses@n- 1 Windmill@n- 1 Ammo workshop@n- 1 Inn@nRestrictions:@n- The enemy palace and walls must not be destroyed.@n- Noone can build new weapons or structures@nTime limit:@n- 30 minutes@nTip:@n- None\0
@GForest Campaign, Mission 2:@nAhh, what peace! Unfortunately my sister is a little upset with us, but more at you than me. You'll never guess what she's done! She's pinched my designs for one of those... those cannon thingies. I think the best course of action is to wipe out her farmhouses. That will make the farmers run away and then we'll be able to call a truce. Would you do that for me?@n@n@WObjective:@n- Destruction of all 5 farmhouses@n- Construct a superbrain@n- Build a Long John@nTime limit:@n- None@nTip:@n- Some enemy farmhouses are hidden behind walls and aren't immediately obvious.\0
@GForest Campaign, Mission 3:@nFantastic, I'm so proud of you! But that old goat just doesn't want to give up those designs. And now she's built some of those new shooty thingies as well. I just want to make peace with her. Be a sweet and reduce her palace to rubble, but please take good care of our superbrain - he mustn't come to any harm!@n@n@WObjective:@n- Protect your superbrain@n- Destruction of the enemy palace@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- Protect your superbrain with walls immediately as it starts outside of the castle walls.\0
@GForest Campaign, Mission 4:@nOoooh, that stonehearted monster! She's only gone and frozen my farmers. They are sooo cold! And then she has the audacity to capture my sister, the Desert Princess, as well. Enough is enough! Do me a favour and destroy all those little buildings around her palace. I'm sure that will make her be nice to me again.@n@WObjective:@n- Destruction of all enemy buildings@n- 4 Farmhouses@n- 1 Inn@n- 1 Smithy@n- 1 Superbrain@n- 1 Mason's Yard@nRestrictions:@n- No construction of weapons or buildings allowed, only repairs.@nTime limit:@n- 20 minutes@nTip: - Protect your farmhouses! You cannot build new ones!\0
@GForest Campaign, Mission 5:@nHey, sugar-honey, do you know what my poor sister just told me? The Ice Princess's cell was freezing cold - she didn't even get a blanket to keep her warm. That Ice Princess needs to be taught a lesson. So be a love and trash her stupid palace, would you? In the meantime, I'm really looking forward to spring coming.@n@n@WObjective:@n- Destruction of the Ice Princess's palace@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- None\0
@GForest Campaign Mission 6:@nGood grief, what a racket! Well, now our little ice-beauty should have been turned into a sleeping-beauty - tee hee! But what will we do if someone tries to wake her with a kiss? Can't you try to make her cold heart melt? That would be soooo great! But hurry - we don't have much time before the Volcano Princess starts helping her.@n@n@WObjective:@n- Destruction of the Ice Princess's palace@nRestrictions:@n- None@nTime limit:@n- 15 minutes@nTip:@n- Destroy the Fat Freda as quickly as you can. It creates an awful mess if it hits you! \0
@GForest Campaign, Mission 7:@nOh no, I don't believe it! The Volcano Princess has actually dared to attack my favourite little sister! That's not nice, not nice at all. Help her! Mark my words - if you allow my sister, the Desert Princess, to be hurt in any way, you'll be out on your ear for good!@n@n@WObjective:@n- Destruction of the Volcano Princess's Palace@n- Protection of the allied Forest Princess. She must survive!@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- The enemy only shoots at your ally, but note that she is able to neither shoot nor build!@n\0
@GForest Campaign, Mission 8:@nPhew, that was a close call! But now fire and ice have allied themselves against us. This rotten war is far too loud and is completely ruining my lovely garden. Make it stop! I really hope for your sake that nothing harms my darling little desert sister!@n@n@WObjective:@n- Annihilation of both the Ice Princess and the Volcano Princess. The allied Desert Princess must survive.@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- Research your advanced defense options and use them.\0
@YDesert Campaign, Mission 1:@nWell, hello, who have we here? You were the one who supported us so brilliantly against the Ice and Volcano Princesses, weren't you? Perfect! You appear to be a man of many talents. Well, that's what my sister says anyway. Now, our first task is to increase our farming population.@n@n@WObjectives:@n- Build an Idol and attract 50 farmers@n- Destroy the Ice Princess's palace@nRestrictions:@n- You only have 50% of the normal tax income and limited research capability until you have completed the first objective@nTime limit:@n- None@nTip:@n- Decide carefully whether to build farms or idol first!\0
@YDesert Campaign, Mission 2:@nBoy, oh boy, you really showed her! I can't wait to see how you cope with our next problem! Ice Baby has got herself a bit of backup and now you will have to deal with two of them at once. Worried? No, didn't think so. Perhaps I'll pay you a little thank-you visit when you're done....@n@n@WObjective:@n- Annihilate both palaces of the Ice Princess.@n- The allied Forest Princess must survive@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- One of your enemies ONLY targets your ally with a Zeppelin! The other enemy ONLY targets you!\0
@YDesert Campaign, Mission 3:@nWell? By the look of you, you quite liked your little reward yesterday. I'm really jealous. The Ice Princess just can't get enough of you. Yesterday, she even decked the whole place out with idols. She's obviously in it for the long haul. Do you think you can do it again?@n@n@WObjective:@n- Destroy all 3 enemy idols@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- Remember a lightening spell will hit you once you destroy the idol, so make sure your castle is strong enough first!\0
@YDesert Campaign, Mission 4:@nWow, you shoot pretty straight, nearly all direct hits - what a natural! Unfortunately my people are freezing in this icy landscape. I suggest you build me an idol while I think up an exciting little treat for you.@n@n@WObjectives:@n- Build an idol@n- Annihilate both the Ice and Volcano Princess. Note: the Forest Princess is your ally@nRestrictions:@n- Until an idol is built:@n- you can only build farmhouses, Mason's Yards and Idols.@n- your tax income is reduced to 50%.@nTime limit:@n- None@nTip:@n- None\0
@n@YDesert Campaign, Mission 5:@nHmmm - yes, that was nice! But this time you should take things a bit more slowly - I really can't keep this up. What do you think about putting an end to the Ice Princess's clammy skulduggery? First you have to ruin her by destroying her idols. Who knows, perhaps you can even kindle a flame in my sister?@n@n@WObjectives:@n- Destroy the 3 enemy idols@n- Then destroy the Ice Princess's palace@nRestrictions:@n- Do not destroy the palace before the idols, otherwise all is lost.@nTime limit:@n- None@nTip:@n- None\0
@n@YDesert Campaign, Mission 6:@nNow you're getting hot, baby - so's the Ice Princess, by the way, which is fine by me. She wants to move in with me... well, as long as you support her with 3,000 gold coins, that is. I could really use an ally against the Volcano Princess. Two princesses and one commander. Hmmmm......@n@n@WObjective:@n- Donate 3000 gold coins to the Ice Princess and annihilate the Volcano Princess.@nRestrictions:@n- You only have 7 minutes to donate the gold. After this time has elapsed the Ice Princess will open fire on you until she has the full amount.@nTime limit:@n- 20 minutes@nTips:@n- You need a Treasury to deliver the gold.@n- Setting auto-repair to 1000 will help you to cope with the donation.\0
@n@YDesert Campaign, Mission 7:@nIncredible, was I dreaming? Six times and it's still standing up like a ramrod. The Ice Princess is now occupying herself quite happily, so don't stop. We're on the home straight. Go on, make the Volcano Princess beg... make her scream!@n@n@WObjective:@n- Destroy the Volcano Princess@nRestrictions:@n- One farmer will leave your castle to replace each enemy farmer killed.@nTime limit:@n- None@nTip:@n- None\0
@n@YDesert Campaign, Mission 8:@nYes, I think I'm almost there! Off you go - load your cannons and destroy both of that lava hag's two castles! Really give it some! The Ice Princess is supporting us in this battle. Please do it one more time, just for me?@n@n@WObjective:@n- Destroy the 2 Volcano Princesses' palaces, whilst protecting the life of the allied Ice Princess.@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- None\0
@n@BIce Campaign, Mission 1:@nWell, well - you want to serve me, do you? Then show me what you're made of. That forest chump has dared to venture into my lands without so much as a by your leave. Throw her out! And don't you dare hurt a single hair on our ally's head!@n@n@WObjective:@n- Annihilate the Forest Princess.@n- The Volcano Princess is your ally.@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- None\0
@n@BIce Campaign, Mission 2:@nSo it looks like you're ready for higher things! We have allied ourselves with the Volcano Princess, so that we can destroy the Forest Princess once and for all. If we win this battle, her woods belong to me. If we lose, you will be minus a head. What are you waiting for - Christmas? To work!@n@n@WObjective:@n- Destroy the 2 Forest Princess's palaces.@n- The Volcano Princess is your ally.@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- None\0
@n@BIce Campaign, Mission 3:@nThat was a decent bit of work. But we haven't much time - that dominatrix is starting to poach my lands. You are going to put paid to that. As soon as our reinforcements have arrived, the issue should be resolved. Your job is to ensure our survival, and that of the Desert Princess.@n@n@WObjective:@n- You and the allied Desert Princess must survive for 15 minutes@nRestrictions:@n- None@nTime limit:@n- 15 minutes@nTip:@n- None\0
@n@BIce Campaign, Mission 4:@nWell, I think you were very lucky there! To be quite honest, I'm used to a slightly more professional approach. Only the best stay in my employ, but I'm going to give you one more chance. Destroy those two hotheads on the border. And don't even contemplate failure!@n@n@WObjective:@n- Destroy both Volcano Princesses@nRestrictions:@n- You are not allowed to shoot at night@nTime limit:@n- None@nTip:@n- None\0
@n@BIce Campaign, Mission 5:@nThere you go - that wasn't so hard, was it? I sometimes wonder why I always have to threaten people before they give it their all. We managed to break over the border into the volcano territory yesterday. Now that latex princess needs to find out what I do with traitors.@n@n@WObjective:@n- Destroy the Volcano Princess.@nRestrictions:@n- Night Level (has no effects on the gameplay)@n- You can't research, however you will be able to build cannons that hit targets accurately right from the start.@nTime limit:@n- None@nTip:@n- None\0
@n@BIce Campaign, Mission 6:@nWell, you just about scraped through that one! I would be eternally grateful if you didn't make it quite so exciting the next time. To secure our position, we need farmers and buildings at the double. Well, what are you waiting for? Get moving!@n@n@WObjectives:@n- Attract 100 farmers.@n- Construct at least one building of every type.@nRestrictions:@n- Each player can only deploy two weapons.@nTime limit:@n- None@nTip:@n- None\0
@n@BIce Campaign, Mission 7:@nAhh, task complete. Soon nothing will stand between me and the fiery throne. And you are going to win me this victory. I'm giving you a fully kitted-out castle for this battle. But be careful: I've been waiting for this moment for way too long to let you fail at the last hurdle!@n@n@WObjective:@n- Destroy the Volcano Princess's palace@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- Your castle is fully developed. Open fire immediately.\0
@n@BIce Campaign, Mission 8:@nThere's our goal. I knew we could do it! Winning is my birthright. One of our opponents will use magic, the other only weapons. Unfortunately I don't know which palace our Cinderella is hiding in. Please do me the favour of reducing both of them into one of those lava flows she's so fond of.@n@n@WObjective:@n- Destruction of both Volcano Princesses' palaces.@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- One enemy only uses magic and few weapons, while the other enemy does exactly the opposite.\0
@n@RVolcano Campaign, Mission 1:@nWell, looky here - here comes the next champion sharpshooter! Rules are simple: YOU do what I say. OK? Right, now we've got that straight, here's your task. That oriental good-for-nothing hussy has somehow managed to bring my weapon production to a standstill. We only have our "Luftwaffe" left. First get rid of her Mage and then finish her off too.@n@WObjectives:@n- Destroy the enemy's Mage Tower@n- Annihilate the Desert Princess@nRestrictions:@n- You can only construct 1 Zeppelin, until you have destroyed the enemy's mage.@n- Only destroy the Mage Tower, not the palace.@nTime limit:@n- None@nTip:@n- The enemy with the mage only uses magic, no weapons!\0
@n@RVolcano Campaign, Mission 2:@nChrist, you were meant to send that desert tramp to hell, NOT just shoo her away! Is that so hard to understand? Oh well, at least now we can destroy our little innocent and her bedfellow at the same time. You shouldn't need more than 2 weapons for this. Off you go now, get to work! Otherwise I might get angry!@n@n@WObjective:@n- Annihilate the Forest and Desert Princess@nRestrictions:@n- The player only has 2 weapon slots@nTime limit:@n- None@nTip:@n- Use your mage and the rocket launcher! It might be expensive, but upgrading to a quad launcher has quite an effect!\0
@n@RVolcano Campaign, Mission 3:@nSo that's your definition of fast! Oh well, I'll be generous and assume you need a bit more practice. Now it's about time that you start showing some form. My patience is wearing thin. It's time for the two castles in the frost pocket made acquaintance with my Hellfire.@n@n@WObjective:@n- Destruction of both Ice Princesses@nRestrictions:@n- Player's income is permanently reduced@nTime limit:@n- None@nTip:@n- None\0
@n@RVolcano Campaign, Mission 4:@nWe are still alive! That wasn't a bad job. Now that we're on our own territory, you should find it easy to thaw out my sister's crystal crown a bit. Show her that melting point has been reached!@n@n@WObjective:@n- Destroy the Ice Princess's palace@nRestrictions:@n- The player's starting castle is very small@n- Magic is limited to Rain and Hellholes.@nTime Limt:@n- None@nTip:@n- None\0
@n@RVolcano Campaign, Mission 5:@nDamn! We've demolished one wall after another of that arrogant ice ass's castle, and she still keeps attacking us! And now that old maid won't even deign to face me herself. She's hired a Mage to destroy me. Make sure you knock down his tower. And once you've taken care of that, her palace is in bad need of ventilation - make some holes!@n@n@WObjectives:@n- Destroy the enemy mage within 5 minutes.@n- Then destroy the Ice Princess's palace@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- None\0
@n@RVolcano Campaign, Mission 6:@nOh YES, a firework display to remember. If my sister wants to repair that damage, she's going to have to bring in the turbo ice-booster. I hate to mention it, but somehow you seemed to have failed in the 2nd battle. The Desert and Forest Princesses are now outflanking us. Hold the fort for 10 minutes until we've evacuated.@n@n@WObjective:@n- Survival!@nRestrictions:@n- None@nTime limit:@n- 10 minutes@nTip:@n- None\0
@n@RVolcano Campaign, Mission 7:@nThat wussy tart! Runs out of steam and off she goes with a smirk on her face to get reinforcement. I'm going to my summer palace. Foolishly, they have placed victims in my way. Destroy this moronic rabble!@n@n@WObjective:@n- Annihilation of the Forest and Desert Princess@nRestrictions:@n- Night level - it's dark all the time@nTime limit:@n- 20 minutes@nTip:@n- None\0
@n@RVolcano Campaign, Mission 8:@nHahahaha, what a wonderful victory! The only thing not quite to my liking is that you have led our enemies straight to my summer palace. But so what? You've given me the chance to annihilate the whole sisterhood in one go. If we win, I might give you all my sisters to add to your harem. I AM THE TRUE PRINCESS OF BALLERBURG!@n@n@WObjective:@n- Anihilation of all three enemies (Forest, Ice and Desert Princess)@nRestrictions:@n- None@nTime limit:@n- None@nTip:@n- None\0
\0

```

### ml_tooltips.dat

```text
-\0
-- Main Menu --\0
Options\0
Options\0
Exit Game\0
Exit Game\0
Manage Players\0
Setup, select or delete a player@n@nUp to 10 players can join in each with their own individual careers.@nThe current player is:@n@W$V.\0
Campaign\0
Campaign Mode\0
High Scores\0
What are your best results ever?\0
Credits\0
Who are these crazy people behind @YBALLERBURG@@?\0
Setup\0
Battle Setup\0
Extras\0
Extras\0
Sound Setup\0
Adjust sound options\0
Screen Resolution\0
Change screen resolution:@n@n@n@n@nThe ingame screen resolution can be adjusted here. The higher the resolution, the higher the hardware requirements.\0
Texture Detail\0
Change Texture Details:@n@n@n@n@nThe higher the texture detail the better the in-game graphics will be. Low texture detail will however speed up gameplay.\0
Color Depth\0
Change Color Depth:@n@n@n@n@n@n@nHigh color depth settings enhance the in-game graphics, but need a lot of graphics memory.\0
Volume\0
Adjust Sound:\0
Cancel\0
Your mage is learning a new spell. As long as he concentrates on this he is not able to cast spells.@nIf you cancel the learning process he will have to start again, however will be immediately available for spell casting.\0
New Spell\0
Orders your mage to learn a new spell.@nYou can not order him to learn a specific spell. He is capable of learning three new spells in addition to the default rain spell. The last spell he can learn is the powerful royal spell.@nThe total amount of spells may be restricted by campaign settings.@n\0
Yes\0
Yes\0
No\0
No\0
Tutorial 1\0
Tutorial 1@n@nInterface and battle\0
Tutorial 2\0
Tutorial 2@n@nBuilding and scrapping\0
Tutorial 3\0
Tutorial 3@n@nResearch and development\0
Scenario\0
Scenario\0
IP-Address\0
IP-Address:@n@n$i@n@n@nReboot your system if neccessary!\0
Hot-Seat\0
Setup options and start a Hot-Seat game. Enables two to four players to battle it out on the same PC.\0
Hot-Seat\0
At least two players must be setup to play a Hot-Seat game.\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted....\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted....\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted....\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted.....\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted.....\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted.....\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted.....\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted....\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted.....\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze@n@nPlayer can be deleted.....\0
Hill Spell\0
cast Hill Spell (Costs: $p gold coins)\0
Tutorial\0
Learn the basics of playing here\0
Multiplayer\0
Multiplayer\0
Join LAN Game\0
Join LAN Game\0
Host LAN Game\0
Host LAN Game\0
Options\0
Options\0
Medals\0
Could there be anything more satisfying than collecting Medals?\0
Best Times\0
You want to drool over your Best Times? No probs\0
Super Weapon\0
Mount: ground@nTech required: Smithy and ammo workshop@nAccuracy: deadly@nCountermeasure: destruct during building phase@nSpecial info: released automatically after a 90 second building phase. \0
Adjust Screen\0
PC Instructions needed\0
Vibration\0
PC Instructions needed\0
Music\0
PC Instructions needed\0
SFX\0
PC Instructions needed\0
Save Game\0
PC Instructions needed.\0
Load Game\0
PC Instructions needed.\0
Movies\0
Aren't movies great? Stop by and enjoy!\0
Intro\0
\0
Ascaron\0
\0
Campaign 1\0
Forest Campaign\0
Campaign 2\0
Desert Campaign\0
Campaign 3\0
Ice Campaign\0
Campaign 4\0
Volcano Campaign\0
Arcaballista\0
\0
Fat Freda\0
\0
Double cannon\0
\0
Fire Ballista\0
\0
Hot Helga\0
\0
Hellfire\0
\0
Long John\0
\0
Rocket Launcher\0
\0
Trebuchet\0
\0
Zeppelin\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
Speech\0
Adjust volume of commentary and tips.\0
Soundtracks\0
Fantastic soundtracks by Dag Winderlich!"\0
Level 1\0
\0
Level 2\0
\0
Level 3\0
\0
Level 4\0
\0
Level 5\0
\0
Level 6\0
\0
Level 7\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
New Player\0
Setup a New Player.@n@nUp to 10 players each with individual careers can be setup. The current player is:@n@=@W$V.\0
Delete Player\0
Delete a Player from the Roster.\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nAwarded Medals:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
$v\0
@W$t $v@@@n@nFinished:@nCampaign 1: $l0@nCampaign 2: $l1@nCampaign 3: $l2@nCampaign 4: $l3@n@nMedals Awarded:@n$m3 x Gold@n$m2 x Silver@n$m1 x Bronze\0
Forest Campaign\0
Princess of the Forest\0
Desert Campaign\0
Princess of the Desert\0
Ice Campaign\0
Princess of Ice\0
Volcano Campaign\0
Princess of the Volcano\0
Level 1\0
Forest Campaign, Mission 1@n@nBest Time: $z00.\0
Level 2\0
Forest Campaign, Mission 2@n@nBest Time: $z00.\0
Level 3\0
Forest Campaign, Mission 3@n@nBest Time: $z02.\0
Level 4\0
Forest Campaign, Mission 4@n@nBest Time: $z03.\0
Level 5\0
Forest Campaign, Mission 5@n@nBest Time: $z04.\0
Level 6\0
Forest Campaign, Mission 6@n@nBest Time: $z05.\0
Level 7\0
Forest Campaign, Mission 7@n@n@nBest Time: $z06.\0
Level 8\0
Forest Campaign, Mission 8@n@n@nBest Time: $z07.\0
Level 9\0
Level 9\0
Level 10\0
Level 10\0
Level 11\0
Level 11\0
Level 12\0
Level 12\0
Level 13\0
Level 13\0
Level 1\0
Desert Campaign, Mission 1@@@n@nBest Time: $z08.\0
Level 2\0
Desert Campaign, Mission 2@n@nBest Time: $z09.\0
Level 3\0
Desert Campaign, Mission 3@n@nBest Time: $z10.\0
Level 4\0
Desert Campaign, Mission 4@n@nBest Time: $z11.\0
Level 5\0
Desert Campaign, Mission 5@n@nBest Time: $z12.\0
Level 6\0
Desert Campaign, Mission 6@n@nBest Time: $z13.\0
Level 7\0
Desert Campaign, Mission 7@n@nBest Time: $z14.\0
Level 8\0
Desert Campaign, Mission 8@n@nBest Time: $z15.\0
Level 9\0
Level 9\0
Level 10\0
Level 10\0
Level 11\0
Level 11\0
Level 12\0
Level 12\0
Level 13\0
Level 13\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
-- In-game Main Menu --\0
-- In-game Main Menu --\0
\0
\0
\0
\0
\0
\0
\0
\0
Game Controls\0
Game Controls\0
Build Weapons\0
Build Weapons\0
Construct Building\0
Construct Building\0
\0
\0
Mage Tower\0
Visit Mage Tower\0
Superbrain\0
Visit Superbrain\0
Inn\0
Visit Inn\0
Earthquake\0
Conjures up an earthquake@nBasic effect: shakes enemies castles@nAffected weapons: all@nAffected area: one enemy castle@nTarget selection: required@nResearch required: yes\0
Mason's Yard\0
Visit Mason's Yard\0
Windmill\0
Visit Windmill\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
Catapult\0
Mount: ground@nAmmo: 1 load of rocks@nAmmo costs: 53 gold coins@nDirect damage: low@nCollateral damage: heavy@nAccuracy: low@nTrajectory: normal@nCountermeasure: Protective Shield@nBasic tech for: Long John\0
Ballista\0
Mount: wall or tower@nTech required: Smithy@nAmmo: 1 anti-Zeppelin bolt@nAmmo costs: 23 gold coins@nDirect damage: 3 hits ground a Zeppelin@nCollateral damage: none@nAccuracy: high@nTrajectory: straight@nCountermeasure: Protective Shield@nBasic tech for: Fire Ballista\0
Cannon\0
Mount: wall or tower@nTech required: Smithy@nAmmo: 1 cannonball@nAmmo costs: 90 gold coins@nDirect damage: medium@nCollateral damage: very low@nAccuracy: medium@nTrajectory: flat@nCountermeasure: Metal Shield@nBasic tech for: double cannon\0
Double cannon\0
Mount: wall or tower@nTech required: Smithy@nAmmo: 2 cannonballs@nAmmo costs: 150 gold coins@nDirect damage: heavy@nCollateral damage: low@nAccuracy: medium@nTrajectory: straight@nCountermeasure: Metal Shield@nBasic tech For: Hellfire & Fat Freda\0
Fat Freda\0
Mount: ground@nTech required: Smithy & ammo workshop@nAmmo: 1 explosive missile@nAmmo costs: 225 gold coins@nDirect damage: very heavy@nCollateral damage: very heavy@nAccuracy: high@nTrajectory: high@nCountermeasure: Metal Shield@nBasic tech for: Super Weapon\0
Rocket Launcher\0
Mount: wall or tower@nTech required: Smithy@nAmmo: 1 rocket@nAmmo costs: 150 gold coins@nDirect damage: heavy@nCollateral damage: high@nAccuracy: low@nTrajectory: very high@nCountermeasure: Metal Shield@nBasic tech for: Quad Launcher\0
Zeppelin\0
Mount: none@nTech required: Smithy & ammo workshop@nAmmo: 1 480 lb bomb@nAmmo costs: 225 gold coins@nDirect damage: very heavy@nCollateral damage: very high@nAccuracy: guided@nTrajectory: guided@nCountermeasure: ballista@nBasic tech for: Super Weapon@n\0
Farmhouse\0
Basis of the castle's economic system. Income is determined by the amount of farmers and the tax rate. A low tax rate increases the amount of farmers in your castle. A high tax rate decreases the amount of farmers.@nEach farmhouse shelters a max. of 10 farmers.\0
Inn\0
An Inn is always a good place to get all sorts of information. Guests will share all sorts of interesting gossip about the other castles with you. An info ticker keeps you updated on enemy activities such as research or building.\0
Mason's Yard\0
This is one of the most valuable buildings in your castle. It is essential for building or repairing structures and weapons. Without a Mason's Yard your castle won't last long in battle.\0
Ammo workshop\0
Reduces ammo costs by a third and is essential for construction of advanced weapons like the Zeppelin or royal weapons.@nBe Careful! If an Ammo workshop sustains a direct hit it explodes with an almighty bang!\0
Smithy\0
This is where nearly all of your weapons are produced. Without it you can only build catapult weaponry. For repairing or adding weapons you will need a Mason's Yard as well.\0
Fire Catapult\0
Mount: ground@nTech required: Smithy@nAmmo: 1 fire bomb@nAmmo costs: 150 gold coins@nDirect damage: very low@nCollateral damage: fire@nAccuracy: high@nTrajectory: high@nCountermeasure: Protective Shield@nBasic tech for: Hot Helga\0
Treasury\0
Expands your gold storage capacity to accommodate more than 2000 gold coins. Constructing more than one treasury minimises the risk of loosing a large amount of gold if the treasury is destroyed. After constructing a treasury you can support your allies with gold.\0
Windmill\0
Provides freshly ground flour for your farmers. The increased food supply visibly speeds up population growth. However this won't change the limit of 10 farmers per farmhouse. Keep the tax rate below 40% until each farmhouse shelters 10 farmers.\0
Superbrain\0
This shelters a VIP. He is the one responsible for all those nifty inventions, which prove decisive in battle. It is common knowledge that starting research early is the key to dominating your enemies.\0
Mage Tower\0
Gateway to Arcane Powers. As soon as the mage tower is erected, the very useful rain spell can be caste. Then your mage can concentrate on learning more advanced, powerful spells.\0
Small Wall\0
This is the basic defense wall of your castle and it doesn't cost a fortune to build. The small wall protects the installations of your castle against direct hits, collateral damage and fire. New walls have to be attached to existing towers or walls.\0
Large wall\0
Large walls are higher and thicker and therefore offer more protection. All small walls will be automatically upgraded after an order to build large walls has been issued. You have to attach new walls to existing towers or walls@nHold down Shift to build multiple walls.\0
Small Tower\0
A tower offers protection against attacks and offer a relatively safe haven for weapons. Building a tower is more expensive, but worth it.@nTip: hold down the Shift key to build multiple towers.\0
Big Tower\0
A big tower offers the maximum protection level for your installations. They cost a small fortune, but can stand a lot of damage. Tip: Hold down the Shift key to build multiple towers.\0
Windsock\0
\0
Telescope\0
\0
Alarm Siren\0
\0
Trapoline\0
\0
Miasma\0
Unleashes a deadly mist.@nBasic effect: reduces nr. of farmers by 20%@nAffected weapon: none@nAffected area: one castle@nTarget selection: required@nResearch required: yes@nSpecial info: none\0
Idol\0
The Idol honours the high Goddess of Ballerburg. If one of her Idols is hit the attacker will incur her almighty wrath. This means that an Idol is quite good as a defensive mechanism.\0
End Player Turn\0
End Player Turn\0
Resign\0
Resign\0
Support\0
As soon as you have built a treasury you can supply other players with gold. Select the target castle and a transport balloon will automatically set off to deliver 1000 gold coins (provided you have got this amount). The gold will be deducted from your coffers.@nBeware! A transport balloon can be brought down by a ballista!\0
Exit\0
Exit\0
\0
\0
\0
\0
Zeppelin\0
Mount: none@nTech required: Smithy & ammo workshop@nAmmo: 1 480 lb bomb@nAmmo costs: 225 gold coins@nDirect damage: very heavy@nCollateral damage: very high@nAccuracy: guided@nTrajectory: guided@nCountermeasure: Ballista@nBasic tech for: Super Weapon\0
Protective Shield\0
Info: defensive spell.@nBasic effect: protection against non-metallic missiles@nAffected weapon: catapult, ballista@nAffected area: one castle@nTarget selection: not required@nResearch required: Yes\0
Metal Shield\0
Info: defensive spell.@nBasic effect: protection against metallic projectiles@nAffected weapon: cannon, rocket@nAffected area: one castle@nTarget selection: not required@nResearch required: yes\0
Rain Spell\0
Info: opens Heaven's Floodgates@nBasic effect: extinguishes all fires@nAffected weapon: cannon, fire bomb@nAffected area: all castles@nTarget selection: not required@nResearch required: no@nSpecial info: basic Mage Spell\0
Fog Spell\0
Info: dense fog wall covers all castles@nBasic effect: no targeting possible@nAffected weapon: all@nAffected area: all castles@nTarget selection: not required@nResearch required: yes@nSpecial info: gives time for repairs\0
Lightning Spell\0
Info: unleashes a powerful lightning bolt at enemy@nBasic effect: always hits 1 weapon@nAffected weapon: all@nAffected area: one castle@nTarget selection: required@nResearch required: yes@nSpecial info: able to destroy light weapons in one hit\0
Thunderstorm Spell\0
Info: Six giant lightning bolts hit enemy buildings@nBasic effect: always hits 6 buildings@nAffected weapon: none@nAffected area: one castle@nTarget selection: required@nResearch required: yes@nSpecial info: able to destroy farmhouses in one hit\0
Hurricane Spell\0
Info: conjures up a gigantic hurricane.@nBasic effect: aiming is hampered@nAffected weapon: all@nAffected area: all castles@nTarget selection: Not required@nResearch required: Yes@nSpecial info: Buys time for repairs.\0
Wall Upgrade\0
Without walls and towers your castle has no protection against your enemy's projectiles. The wall upgrade provides you with higher and thicker walls. It makes firing over your walls more difficult and enables them to withstand more damage. Once this research is complete all your current walls and towers will automatically be replaced by enhanced versions.\0
Accuracy\0
Ballerburg's weapons are not exactly what you might call accurate. The crosshairs might well show the exact point you are aiming for, but the impact point will be wide of that. After researching accuracy all weapons will fire more precisely. The only factor that will then cause inaccuracy is the wind.\0
Fragment Shield\0
Catapults and explosive missiles, warheads and bombs not only wreak havoc to the point of impact, but also inflict damage to surrounding buildings. The fragment shield reduces this collateral damage.\0
\0
\0
Wrath of Jupiter\0
Jupiter's Wrath\0
Palace\0
Palace\0
Arsenal\0
Weapon Overview\0
Princess's Shield\0
Info:@(Protects of the Forest Princess's castles@nBasic effect: fast switching shield@nAffected weapons: all@nAffected area: all allied castles@nTarget selection: not required@nResearch required: yes@nSpecial info: the last spell the Forest Princess's mage can learn\0
Long John\0
Mount: ground@nTech required: none@nAmmo: 3 loads of rocks@nAmmo costs: 113 gold coins@nDirect damage: medium@nCollateral damage: very high@nAccuracy: low@nTrajectory: high@nCountermeasure: Protective Shield@nBasic tech for: Trebuchet/Arcaballista\0
Hot Helga\0
Mount: ground@nTech required: Smithy@nAmmo 1 wildfire bomb@nAmmo costs: 225 gold coins@nDirect damage: very light@nCollateral damage: Causes multiple fires@nAccuracy: medium@nTrajectory: high@nCountermeasure: Protective Shield@nBasic tech for: Super weapon\0
Trebuchet\0
Mount: ground@nTech required: Smithy & ammo workshop@nAmmo: 5 loads of rocks@nAmmo costs: 225 gold coins@nDirect damage: Light@nCollateral damage: very heavy@nAccuracy: low@nTrajectory: high@nCountermeasure: Protective Shield@nBasic tech for: Super weapon\0
\0
\0
\0
\0
\0
\0
\0
\0
Arcaballista\0
Mount: ground@nTech required: Smithy & ammo workshop@nAmmo: 4 wooden bolts@nAmmo costs: 300 gold coins@nDirect damage: very heavy@nCollateral damage: very low@nAccuracy: high@nTrajectory: low@nCountermeasure: Protective Shield@nUpgrade: Super weapon\0
To\0
As soon as you have built a treasury you can send gold to other players. Select the target castle and a transport balloon will set off to deliver 1000 gold coins. The gold will be taken from your coffers.@nBeware! The transport balloon can be brought down by a ballista.\0
To\0
As soon as you have built a treasury you can send gold to other players. Select the target castle and a transport balloon will set off to deliver 1000 gold coins. The gold will be taken from your coffers.@nBeware! The transport balloon can be brought down by a ballista.\0
To\0
As soon as you have built a treasury you can send gold to other players. Select the target castle and a transport balloon will set off to deliver 1000 gold coins. The gold will be taken from your coffers.@nBeware! The transport balloon can be brought down by a ballista.\0
To\0
As soon as you have built a treasury you can send gold to other players. Select the target castle and a transport balloon will set off to deliver 1000 gold coins. The gold will be taken from your coffers.@nBeware! The transport balloon can be brought down by a ballista.\0
Pause\0
Pauses the Game\0
TEST Level\0
TEST Level\0
Double cannon\0
Mount: wall or tower@nTech required: Smithy@nAmmo: 2 cannonballs@nAmmo costs: 150 gold coins@nDirect damage: heavy@nCollateral damage: low@nAccuracy: medium@nTrajectory: straight@nCountermeasure: Metal Shield@nBasic tech for: Hellfire & Fat Freda\0
Testlevel 1\0
Testlevel 1\0
Testlevel 2\0
Testlevel 2\0
Testlevel 3\0
Testlevel 3\0
Testlevel 4\0
Testlevel 4\0
Testlevel 5\0
Testlevel 5\0
Testlevel 6\0
Testlevel 6\0
Testlevel 7\0
Testlevel 7\0
Testlevel 8\0
Testlevel 8\0
Testlevel 9\0
Testlevel 9\0
Testlevel 10\0
Testlevel 10\0
Testlevel 11\0
Testlevel 11\0
Testlevel 12\0
Testlevel 12\0
Testlevel 13\0
Testlevel 13\0
Weapon View\0
Change to Weapon View\0
\0
\0
Repair\0
Repair $O (Costs: $r gold coins). $R% of damage can be repaired.\0
Scrap\0
Scrap @R$o\0
Sandcloud\0
Info: conjures up a raging sandstorm@nBasic Effect: transforms damage into gold@nAffected Weapons: all@nAffected Area: all enemy castles@nTarget selection: not required@nResearch required: yes@nSpecial info: the last spell the Desert Princess's mage can learn.\0
Super Weapon\0
Mount: ground@nTech required: Smithy and ammo workshop@nAccuracy: deadly@nCountermeasure: destruct during building phase@nSpecial info: released automatically after a 90 second building phase. \0
Firewall\0
Gives structures greater fire resistance.\0
\0
\0
Fire Ballista\0
Mount: wall or tower@nTech required: Smithy@nAmmo: 1 burning bolt@nAmmo costs: 150 gold coins@nDirect damage:  1 hit grounds a zeppelin@nCollateral damage: none@nAccuracy: high@nTrajectory: straight@nBasic tech for: Super Weapon@nCountermeasure: Protective Shield\0
Quad Launcher\0
Mount: wall or tower@nTech required: Smithy@nAmmo: 4 rockets@nAmmo costs: 450 gold coins@nDirect damage: very heavy@nCollateral damage: very heavy@nAccuracy: very low@nTrajectory: very high@nBasic tech for: Super Weapon@nCountermeasure: Metal Shield\0
Long John\0
Mount: ground@nTech required: none@nAmmo: 3 loads of rocks@nAmmo costs: 113 gold coins@nDirect damage: medium@nCollateral damage: very high@nAccuracy: low@nTrajectory: medium@nBasic tech for: Trebuchet/ Arcaballista@nCountermeasure: Protective Shield\0
Arcaballista\0
Mount: ground@nTech required: Smithy & ammo workshop@nAmmo: 4 bolts@nAmmo costs: 300 gold coins@nDirect damage: very heavy@nCollateral damage: very low@nAccuracy: high@nTrajectory: low@nCountermeasure: Protective Shield@nBasic tech for: Super Weapon\0
Hot Helga\0
Mount: ground@nTech required: Smithy@nAmmo: 1 wildfire bomb@nAmmo costs: 225 gold coins@nDirect damage: very light@nCollateral damage: causes multiple fires@nAccuracy: medium@nTrajectory: high@nBasic tech for: Super Weapon@nCountermeasure: Protective Shield\0
Trebuchet\0
Mount: ground@nTech required: Smithy & ammo workshop@nAmmo: 5 loads of rocks@nAmmo costs: 225 gold coins@nDirect damage: light@nCollateral damage: very heavy@nAccuracy: low@nTrajectory: medium@nCountermeasure: Protective Shield@nBasic tech for: Super Weapon\0
Fat Freda\0
Mount: ground@nTech required: Smithy & ammo workshop@nAmmo: 1 explosive missile@nAmmo costs: 225 gold coins@nDirect damage: very heavy@nCollateral damage: very heavy@nAccuracy: high@nTrajectory: high@nCountermeasure: Metal Shield@nBasic tech for: Super Weapon\0
Hellfire\0
Mount: ground@nTech required: Smithy & ammo workshop@nAmmo: 5 cannonballs@nAmmo costs: 330 gold coins@nDirect damage: heavy@nCollateral damage: medium@nAccuracy: high@nTrajectory: straight@nCountermeasure: Metal Shield@nBasic tech for: Super Weapon\0
Add Weapon I\0
This invention adds an additional free weapon slot. This enables you to fight with three weapons simultaneously. A maximum number of eight weapon slots is available per castle.\0
Add Weapon II\0
This invention adds an additional free weapon slot.@nThis enables you to fight with four weapons simultaneously. A maximum number of eight weapon slots is available per castle.\0
Add Weapon III\0
This invention adds two additional free weapon slots. You can now fight with six weapons simultaneously.@nA maximum number of eight weapon slots is available per castle.\0
Add Weapon IV\0
This invention adds two additional free weapon slots. Now you can fight with eight weapons and you have the maximum firepower of one castle at your command.\0
Fire Ballista\0
Mount: wall or tower@nTech required: Smithy@nAmmo: 1 burning bolt@nAmmo costs: 150 gold coins@nDirect damage: 1 hit grounds a zeppelin@nCollateral damage: none@nAccuracy: high@nTrajectory: straight@nBasic tech for: Super weapon@nCountermeasure: Protective Shield\0
Quad Launcher\0
Mount: wall or tower@nTech required: Smithy@nAmmo: 4 rockets@nAmmo costs: 450 gold coins@nDirect damage: very heavy@nCollateral damage: very heavy@nAccuracy: very low@nTrajectory: very high@nBasic tech for: Super Weapon@nCountermeasure: Metal Shield\0
Hellfire\0
Mount: ground@nTech required: Smithy & ammo workshop@nAmmo: 5 cannonballs@nAmmo costs: 330 gold coins@nDirect damage: heavy@nCollateral damage: medium@nAccuracy: high@nTrajectory: straight@nCountermeasure: Metal Shield@nBasic tech for: Super Weapon\0
Icefinger\0
Info: giant ice bolts erupt from the soil@nBasic Effect: enemy income is halved@nAdvanced Effect: collateral damage@nAffected Area: all enemy castles@nTarget selection: not required@nResearch required: yes@nSpecial info: the last spell the Ice Princess's mage can learn.\0
Hellholes\0
Info: highly explosive gas eruptions@nBasic Effect: collateral damage@nAdvanced Effect: explode if fired upon@nAffected Area: one enemy castle@nTarget selection: required@nResearch required: yes@nSpecial info: the last spell the Volcano Princess's mage can learn\0
\0
\0
Level 1\0
Ice Campaign, Mission 1@n@nBest Time: $z16.\0
Level 2\0
Ice Campaign, Mission 2@n@nBest Time: $z17.\0
Level 3\0
Ice Campaign, Mission 3@n@nBest Time: $z18.\0
Level 4\0
Ice Campaign, Mission 4@n@nBest Time: $z19.\0
Level 5\0
Ice Campaign, Mission 5@n@nBest Time: $z20.\0
Level 6\0
Ice Campaign, Mission 6@n@nBest Time: $z21.\0
Level 7\0
Ice Campaign, Mission 7@n@nBest Time: $z22.\0
Level 8\0
Ice Campaign, Mission 8@n@nBest Time: $z23.\0
Level 9\0
Level 9\0
Level 10\0
Level 10\0
Level 11\0
Level 11\0
Level 12\0
Level 12\0
Level 13\0
Level 13\0
Level 1\0
Volcano Campaign, Mission 1@@@n@nBest Time: $z24.\0
Level 2\0
Volcano Campaign, Mission 2@n@nBest Time: $z25.\0
Level 3\0
Volcano Campaign, Mission 3@n@nBest Time: $z26.\0
Level 4\0
Volcano Campaign, Mission 4@n@nBest Time: $z27.\0
Level 5\0
Volcano Campaign, Mission 5@n@nBest Time: $z28.\0
Level 6\0
Volcano Campaign, Mission 6@n@nBest Time: $z29.\0
Level 7\0
Volcano Campaign, Mission 7@n@nBest Time: $z30.\0
Level 8\0
Volcano Campaign, Mission 8@n@nBest Time: $z31.\0
Level 9\0
Level 9\0
Level 10\0
Level 10\0
Level 11\0
Level 11\0
Level 12\0
Level 12\0
Level 13\0
Level 13\0
Action\0
\0
User defined\0
\0
Start!\0
\0
Players & Teams\0
\0
Player 1\0
\0
Player 2\0
\0
Player 3\0
\0
Player 4\0
\0
Starter castle\0
\0
Game\0
\0
Level\0
\0
Start\0
\0
Begin\0
\0
Player\0
\0
Level\0
\0
Starter castle\0
\0
Scenario\0
\0
Game\0
\0
Quick game\0
\0
Tactics\0
\0
Strategy\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0
\0

```

### Shading00.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	091	076	045	000	042	050	054	000	042	050	054	000	091	076	045
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	146	135	115	255	103	079	063	255	024	024	024	255	024	024	024	255	133	097	062
255	187	167	145	255	160	160	160	255	160	160	160	255	187	167	145	255	120	088	074	255	016	016	016	255	016	016	016	255	127	109	073
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	029	030	034	255	029	030	034	255	192	160	096

```

### Shading01.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	091	076	045	000	042	050	054	000	042	050	054	000	091	076	045
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	146	135	115	255	103	079	063	255	024	024	024	255	024	024	024	255	133	097	062
255	187	167	145	255	160	160	160	255	160	160	160	255	187	167	145	255	120	088	074	255	016	016	016	255	016	016	016	255	127	109	073
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	029	030	034	255	029	030	034	255	192	160	096

```

### Shading02.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	091	076	045	000	042	050	054	000	042	050	054	000	091	076	045
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	146	135	115	255	103	079	063	255	024	024	024	255	024	024	024	255	133	097	062
255	187	167	145	255	160	160	160	255	160	160	160	255	187	167	145	255	120	088	074	255	016	016	016	255	016	016	016	255	127	109	073
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	029	030	034	255	029	030	034	255	192	160	096

```

### Shading03.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	091	076	045	000	042	050	054	000	042	050	054	000	091	076	045
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	146	135	115	255	103	079	063	255	024	024	024	255	024	024	024	255	133	097	062
255	187	167	145	255	160	160	160	255	160	160	160	255	187	167	145	255	120	088	074	255	016	016	016	255	016	016	016	255	127	109	073
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	029	030	034	255	029	030	034	255	192	160	096

```

### Shading04.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	091	076	045	000	042	050	054	000	042	050	054	000	091	076	045
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	146	135	115	255	103	079	063	255	024	024	024	255	024	024	024	255	133	097	062
255	187	167	145	255	160	160	160	255	160	160	160	255	187	167	145	255	120	088	074	255	016	016	016	255	016	016	016	255	127	109	073
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	029	030	034	255	029	030	034	255	192	160	096

```

### Shading05.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	091	076	045	000	042	050	054	000	042	050	054	000	091	076	045
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	146	135	115	255	103	079	063	255	024	024	024	255	024	024	024	255	133	097	062
255	187	167	145	255	160	160	160	255	160	160	160	255	187	167	145	255	120	088	074	255	016	016	016	255	016	016	016	255	127	109	073
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	029	030	034	255	029	030	034	255	192	160	096

```

### Shading06.dat

```text
255	232	116	116	255	245	054	054	255	245	054	054	255	232	116	116	255	187	050	050	255	016	023	031	255	016	023	031	255	187	050	050
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	030	038	028	000	030	038	028	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	059	079	020	255	115	134	050	255	115	134	050	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	243	099	011	255	024	024	024	255	024	024	024	255	243	099	011
255	104	120	049	255	114	128	051	255	114	128	051	255	066	077	034	255	049	034	052	255	021	036	026	255	021	036	026	255	049	034	052
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading07.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	090	082	074	000	085	085	085	000	085	085	085	000	090	082	074	000	079	063	031	000	048	052	061	000	051	055	065	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	117	075	034	255	024	024	024	255	024	024	024	255	171	105	039
255	143	133	091	255	160	160	160	255	160	160	160	255	143	133	091	255	134	122	096	255	016	016	016	255	016	016	016	255	135	121	079
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading08.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	090	082	074	000	085	085	085	000	085	085	085	000	090	082	074	000	079	063	031	000	048	052	061	000	051	055	065	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	117	075	034	255	024	024	024	255	024	024	024	255	171	105	039
255	143	133	091	255	160	160	160	255	160	160	160	255	143	133	091	255	134	122	096	255	016	016	016	255	016	016	016	255	135	121	079
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading09.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	090	082	074	000	085	085	085	000	085	085	085	000	090	082	074	000	079	063	031	000	048	052	061	000	051	055	065	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	117	075	034	255	024	024	024	255	024	024	024	255	171	105	039
255	143	133	091	255	160	160	160	255	160	160	160	255	143	133	091	255	134	122	096	255	016	016	016	255	016	016	016	255	135	121	079
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading10.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	090	082	074	000	085	085	085	000	085	085	085	000	090	082	074	000	079	063	031	000	048	052	061	000	051	055	065	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	117	075	034	255	024	024	024	255	024	024	024	255	171	105	039
255	143	133	091	255	160	160	160	255	160	160	160	255	143	133	091	255	134	122	096	255	016	016	016	255	016	016	016	255	135	121	079
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading11.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	090	082	074	000	085	085	085	000	085	085	085	000	090	082	074	000	079	063	031	000	048	052	061	000	051	055	065	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	117	075	034	255	024	024	024	255	024	024	024	255	171	105	039
255	143	133	091	255	160	160	160	255	160	160	160	255	143	133	091	255	134	122	096	255	016	016	016	255	016	016	016	255	135	121	079
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading12.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	090	082	074	000	085	085	085	000	085	085	085	000	090	082	074	000	079	063	031	000	048	052	061	000	051	055	065	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	117	075	034	255	024	024	024	255	024	024	024	255	171	105	039
255	143	133	091	255	160	160	160	255	160	160	160	255	143	133	091	255	134	122	096	255	016	016	016	255	016	016	016	255	135	121	079
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading13.dat

```text
255	232	116	116	255	245	054	054	255	245	054	054	255	232	116	116	255	187	050	050	255	016	023	031	255	016	023	031	255	187	050	050
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	030	038	028	000	030	038	028	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	059	079	020	255	115	134	050	255	115	134	050	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	243	099	011	255	024	024	024	255	024	024	024	255	243	099	011
255	104	120	049	255	114	128	051	255	114	128	051	255	066	077	034	255	049	034	052	255	021	036	026	255	021	036	026	255	049	034	052
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading14.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	059	063	000	023	028	031	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	121	106	078	255	000	000	000	255	000	000	000	255	121	106	078	255	177	126	126	255	024	024	024	255	024	024	024	255	131	113	093
255	181	165	123	255	160	160	160	255	160	160	160	255	154	139	120	255	118	104	097	255	016	016	016	255	016	016	016	255	159	148	120
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading15.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	059	063	000	023	028	031	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	121	106	078	255	000	000	000	255	000	000	000	255	121	106	078	255	177	126	126	255	024	024	024	255	024	024	024	255	131	113	093
255	181	165	123	255	160	160	160	255	160	160	160	255	154	139	120	255	118	104	097	255	016	016	016	255	016	016	016	255	159	148	120
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading16.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	059	063	000	023	028	031	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	121	106	078	255	000	000	000	255	000	000	000	255	121	106	078	255	177	126	126	255	024	024	024	255	024	024	024	255	131	113	093
255	181	165	123	255	160	160	160	255	160	160	160	255	154	139	120	255	118	104	097	255	016	016	016	255	016	016	016	255	159	148	120
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading17.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	059	063	000	023	028	031	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	121	106	078	255	000	000	000	255	000	000	000	255	121	106	078	255	177	126	126	255	024	024	024	255	024	024	024	255	131	113	093
255	181	165	123	255	160	160	160	255	160	160	160	255	154	139	120	255	118	104	097	255	016	016	016	255	016	016	016	255	159	148	120
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading18.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	059	063	000	023	028	031	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	121	106	078	255	000	000	000	255	000	000	000	255	121	106	078	255	177	126	126	255	024	024	024	255	024	024	024	255	131	113	093
255	181	165	123	255	160	160	160	255	160	160	160	255	154	139	120	255	118	104	097	255	016	016	016	255	016	016	016	255	159	148	120
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading19.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	059	063	000	023	028	031	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	224	224	224	255	224	224	224	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	121	106	078	255	000	000	000	255	000	000	000	255	121	106	078	255	177	126	126	255	024	024	024	255	024	024	024	255	131	113	093
255	181	165	123	255	160	160	160	255	160	160	160	255	154	139	120	255	118	104	097	255	016	016	016	255	016	016	016	255	159	148	120
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading20.dat

```text
255	232	116	116	255	245	054	054	255	245	054	054	255	232	116	116	255	187	050	050	255	016	023	031	255	016	023	031	255	187	050	050
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	030	038	028	000	030	038	028	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	059	079	020	255	115	134	050	255	115	134	050	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	243	099	011	255	024	024	024	255	024	024	024	255	243	099	011
255	104	120	049	255	114	128	051	255	114	128	051	255	066	077	034	255	049	034	052	255	021	036	026	255	021	036	026	255	049	034	052
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading21.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	054	058	000	049	054	058	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	168	168	168	255	168	168	168	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	089	056	035	255	069	040	023	255	069	040	023	255	089	056	035
255	092	086	075	255	090	090	090	255	090	090	090	255	092	086	075	255	084	073	055	255	010	010	010	255	010	010	010	255	084	073	055
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading22.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	054	058	000	049	054	058	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	168	168	168	255	168	168	168	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	089	056	035	255	069	040	023	255	069	040	023	255	089	056	035
255	092	086	075	255	090	090	090	255	090	090	090	255	092	086	075	255	084	073	055	255	010	010	010	255	010	010	010	255	084	073	055
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading23.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	054	058	000	049	054	058	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	168	168	168	255	168	168	168	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	089	056	035	255	069	040	023	255	069	040	023	255	089	056	035
255	092	086	075	255	090	090	090	255	090	090	090	255	092	086	075	255	084	073	055	255	010	010	010	255	010	010	010	255	084	073	055
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading24.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	054	058	000	049	054	058	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	168	168	168	255	168	168	168	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	089	056	035	255	069	040	023	255	069	040	023	255	089	056	035
255	092	086	075	255	090	090	090	255	090	090	090	255	092	086	075	255	084	073	055	255	010	010	010	255	010	010	010	255	084	073	055
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading25.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	054	058	000	049	054	058	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	168	168	168	255	168	168	168	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	089	056	035	255	069	040	023	255	069	040	023	255	089	056	035
255	092	086	075	255	090	090	090	255	090	090	090	255	092	086	075	255	084	073	055	255	010	010	010	255	010	010	010	255	084	073	055
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading26.dat

```text
255	223	175	127	255	239	239	239	255	239	239	239	255	223	175	127	255	207	127	063	255	016	023	031	255	016	023	031	255	207	127	063
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	049	054	058	000	049	054	058	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	138	132	120	255	168	168	168	255	168	168	168	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	089	056	035	255	069	040	023	255	069	040	023	255	089	056	035
255	092	086	075	255	090	090	090	255	090	090	090	255	092	086	075	255	084	073	055	255	010	010	010	255	010	010	010	255	084	073	055
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Shading27.dat

```text
255	232	116	116	255	245	054	054	255	245	054	054	255	232	116	116	255	187	050	050	255	016	023	031	255	016	023	031	255	187	050	050
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	096	000	000	000	096	000	000	000	255	111	063	031
000	095	087	079	000	095	095	095	000	095	095	095	000	095	087	079	000	079	063	031	000	030	038	028	000	030	038	028	000	079	063	031
255	032	032	032	255	255	255	255	255	255	255	255	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032	255	032	032	032
255	127	119	111	255	127	127	127	255	127	127	127	255	127	119	111	255	111	063	031	255	000	000	000	255	000	000	000	255	111	063	031
255	059	079	020	255	115	134	050	255	115	134	050	255	138	132	120	255	036	036	034	255	076	076	076	255	076	076	076	255	036	036	034
255	102	089	066	255	000	000	000	255	000	000	000	255	102	089	066	255	243	099	011	255	024	024	024	255	024	024	024	255	243	099	011
255	104	120	049	255	114	128	051	255	114	128	051	255	066	077	034	255	049	034	052	255	021	036	026	255	021	036	026	255	049	034	052
255	224	208	128	255	255	255	255	255	255	255	255	255	224	208	128	255	192	160	096	255	032	032	032	255	032	032	032	255	192	160	096

```

### Representative particle frame (visual animation data)

```text
ATTRIBUTES
 position spriteScaleX spriteScaleY opacityPP
TYPES
 V R R R
NUMBER_OF_PARTICLES: 6
BEGIN DATA
-0.0067471336 0.42250437 0.00083158817 2 2 1 
0.02041439 0.40675241 0.05066989 2 2 1 
0.0065360963 0.15004954 -0.00019804605 2 2 1 
-0.01283719 0.14710189 -0.023209454 2 2 1 
-0.0045791566 0.056757156 0.007097221 2 2 1 
-0.00017649033 0.0040236949 0.0018366628 2 2 1 

```

The remaining 463 PDA frames are visual particle samples rather than gameplay constants; their complete original text is in Main/Particles and parsed records are in data/particles. The sine table is losslessly specified above and all 4096 integers are in data/sinelist.json.
