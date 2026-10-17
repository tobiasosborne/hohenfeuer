# Owns the reproducible format specification and complete asset inventory report.
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

SPEC = r'''<!-- Owns the original ISO container specifications, rip evidence and asset inventory. -->
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
'''


def generate(root, output):
    def read(name):return json.loads((root/name).read_text())
    verification=read('verification.json')
    main=read('Main/manifest.json')
    meshes=read('meshes/inventory.json')
    game=read('data/gameplay.json')
    data=read('data/inventory.json')
    media=read('video-frames/manifest.json')
    parts=[SPEC,'\n## Source identity\n\n']
    parts.append(f'- Main.cpr: `{main["sha256"]}`\n- Ballerburg.exe: `{game["sha256"]}`\n')
    parts.append('\n## Asset categories and output counts\n\n| Category | Count | Output |\n|---|---:|---|\n')
    locations={'.6do':'Main/Objects; meshes/', '.7do':'Main/Objects; meshes/', '.plateau':'Main/Data/Plateaus; data/layouts/',
               '.odn':'Main/Data/Kampagne; data/scenarios/', '.pda':'Main/Particles; data/particles/',
               '.dat':'Main/Data; data/', '.raw':'Main/Images/Special', '.wav':'Main/Sound',
               '.bmp':'Main/Images; images/', '.tga':'Main/Images; images/', '.jpg':'Main/Images; images/'}
    for ext,count in verification['cpr_types'].items():
        parts.append(f'| CPR {ext} | {count} | `assets-ripped/{locations.get(ext,"Main/Level; data/levels/")}` |\n')
    for label,count,location in [('TEX packs',51,'tex/'),('TEX embedded images / PNGs',2155,'tex/; textures/'),
                                ('CPR image PNGs',690,'images/'),('SKS containers',112,'sks/'),
                                ('SKS JPEG frames',1680,'sks/'),('Tree billboard images (included in CPR images)',252,'images/Images/Trees/'),
                                ('Additional themed building OBJ+MTL+JSON variants',808,'variants/'),
                                ('Installer members per installer',243,'installers/MinInst; installers/MaxInst'),
                                ('Video reference frames',10,'video-frames/'),
                                ('Original meshes exported',615,'meshes/')]:
        parts.append(f'| {label} | {count} | `assets-ripped/{location}` |\n')
    parts.append('| Original Bink videos | 15 | `downloads/en-iso/iso/Videos/`; two probed, ten selected frames in output |\n'
                 '| Original MP3 files | 647 | `downloads/en-iso/iso/Sound/`; Menue.mp3 fully decode-checked |\n'
                 '| Original PE executable / DLL files | 9 / 7 | Original CD tree; never executed |\n'
                 '| DirectX Cabinet archives | 4 | `downloads/en-iso/iso/directx/`; identified only |\n'
                 '| Manual PDF / README TXT / autorun INF / ICO / auxiliary DAT | 1 each | Original CD tree; retained |\n')
    parts.append(f'\nThe CPR produces **{verification["cpr_bytes"]:,} bytes** from **{verification["cpr_members"]:,} members**. '
                 f'Original mesh files contain **{verification["source_triangles"]:,} triangles** after 6DO polygon triangulation; '
                 f'default OBJ exports contain **{verification["obj_triangles"]:,} triangles** after removal of duplicate reflection passes. '
                 'There are no zero-triangle mesh exports. Theme variants are not counted as new original meshes.\n')
    parts.append('\n| Mesh category | Files |\n|---|---:|\n')
    for k,v in verification['mesh_categories'].items():parts.append(f'| {k} | {v} |\n')
    parts.append('\n## Gameplay table values\n\nThese are numeric table values, not numbers inferred from screenshots. '
                 'Table addresses and encoding are listed in `data/gameplay.json`. '
                 'A dash in the source name means a reserved/unused type. Weapon footprints and prices are retained even for those slots.\n\n')
    parts.append('| ID | English name | Build gold | Footprint | Build seconds | Defence | Reload seconds | Base shot gold | Without workshop (base ×1.5, truncated) | Powder coefficient |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|\n')
    for e in game['entities']:
        keys=['type_id','name','build_cost','footprint','build_time_seconds','defence_points','reload_seconds','base_shot_cost','shot_cost_without_workshop','powder_coefficient']
        parts.append('| '+' | '.join(str(e.get(k,'—')) for k in keys)+' |\n')
    parts.append('\nEvidence: build-price and defence-table reads at VA 0x403913/0x403927; footprint reads at 0x403c9d; '
                 'construction-time reads at 0x406aa2; reload reads at 0x406c88 and 0x453151; '
                 'shot-cost reads at 0x4248cc and 0x4531fa. HUD workshop adjustment at 0x45323b–0x45325e '
                 'multiplies by 15 and divides by 10. This explains the English catapult value 52 from base 35. '
                 'Powder and upgrades can add costs, so these base numbers do not override every dynamic rule.\n')
    parts.append('\n## Scenario/layout links\n\n| Scenario | Bytes | Level | Theme byte | Layout IDs for four slots | Gold candidates |\n|---|---:|---:|---:|---|---|\n')
    for e in data['scenarios']:
        parts.append(f'| {Path(e["source"]).name} | {e["size"]} | {e["level_id"]} | {e["theme_id"]} | {e["plateau_ids"]} | {e["starting_gold"]} |\n')
    parts.append('\n## Media verification\n\n| Input | Streams | Duration | Sample times |\n|---|---|---:|---|\n')
    for e in media:
        streams=', '.join(s['codec_name'] for s in e['probe']['streams'])
        parts.append(f'| {Path(e["source"]).name} | {streams} | {e["probe"]["format"]["duration"]} s | '+', '.join(f'{x["seconds"]:.3f}' for x in e['frames'])+' |\n')
    parts.append('\n## Every original named mesh\n\nPaths below are relative to `Main/Objects/`; matching OBJ/MTL/JSON paths are under `meshes/` '
                 'with the same relative name. Triangle column is default OBJ count; source column includes renderer reflection passes. '
                 'Texture filenames name decoded PNGs. `dynamic:N` means the numeric reference is preserved but not mapped.\n\n'
                 '| Internal name | OBJ triangles | Source triangles | Texture PNGs |\n|---|---:|---:|---|\n')
    for e in meshes:
        source=e['source'].split('/Objects/',1)[1]
        textures=', '.join(v.split('/textures/',1)[-1] if '/textures/' in v else v.split('/images/',1)[-1] if v else 'dynamic:'+k for k,v in e['textures'].items())
        parts.append(f'| `{source}` | {e["triangles"]} | {e["source_triangles"]} | {textures} |\n')
    parts.append('\n## Unassigned-field hex evidence\n')
    samples=[('6DO packed header, first 96 bytes','Main/Objects/Buehnen/b_a_01.6do',8,96),
             ('Scenario, first 96 bytes','Main/Data/Kampagne/Lv1_1_1.odn',0,96),
             ('Gradients.raw, first 64 bytes','Main/Images/Special/Gradients.raw',0,64),
             ('Sky/color data, first 64 bytes','Main/Level/Level00.him',0,64)]
    for title,name,start,length in samples:
        raw=(root/name).read_bytes()
        parts.append(f'\n{title}: `{name}`, file offset 0x{start:x}.\n\n```text\n')
        for off in range(start,start+length,16):parts.append(f'{off:08x}  {raw[off:off+16].hex(" ")}\n')
        parts.append('```\n')
    parts.append('\n## Verbatim text/table evidence\n\nThe source game files remain byte-for-byte in Main/. '
                 'String pools below are decoded as CP1252 with NUL displayed as `\\0`; other text is unchanged. '
                 'These are original extracted game data, not instructions to execute.\n')
    for name in ['ml_phrasen.dat','ml_tooltips.dat']:
        raw=(root/'Main/Data'/name).read_bytes()
        parts.append(f'\n### {name}\n\n```text\n'+raw.decode('cp1252').replace('\0','\\0\n')+'\n```\n')
    for p in sorted((root/'Main/Data').glob('Shading*.dat')):
        parts.append(f'\n### {p.name}\n\n```text\n'+p.read_text()+'\n```\n')
    p=root/'Main/Particles/0001/0002.pda'
    parts.append('\n### Representative particle frame (visual animation data)\n\n```text\n'+p.read_text()+'\n```\n')
    parts.append('\nThe remaining 463 PDA frames are visual particle samples rather than gameplay constants; their complete original text is in Main/Particles and parsed records are in data/particles. '
                 'The sine table is losslessly specified above and all 4096 integers are in data/sinelist.json.\n')
    output.write_text(''.join(parts))
    print(f'Wrote {output} ({output.stat().st_size:,} bytes)')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('input',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    generate(args.input,args.output)
