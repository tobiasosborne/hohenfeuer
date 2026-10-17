<!-- Owns static executable evidence for Ballerburg ballistics, weapon tables, aiming, damage and wind; reference only. -->
# Ballerburg: Castle Siege — executable ballistics and weapon tables

Date: 2026-10-17. **Static analysis only. No game, DLL, Wine, emulation or original machine code was executed. No Git command was run.** Writes were limited to this report, `scripts/rip/exe_tables.py`, and `/tmp/claude-1000/`. The narrower task scope supersedes the general HANDOFF/Beads/commit workflow; repository guidance and `bd prime` were read without creating tracking entries.

The central result is an **integer, tick-based, quadratic air-drag model**, including vertical drag, with wind represented as an air-velocity vector. Ordinary range controls launch speed; the two ballistas instead expose elevation. Gravity is a scenario field, not 9.81 and not a per-weapon multiplier. Direct damage and distance-dependent splash are separate table fields. Rockets are powered carriers that release explosive child projectiles.

## 1. Provenance, confidence and reproducibility

All addresses below are **virtual addresses in the English ISO executable**, not file offsets or addresses from the installed executable. Types and bytes are little endian.

| Source | SHA256 |
| --- | --- |
| `downloads/en-iso/iso/Ballerburg.exe` | `1856b61fb8654aaefcc3f8e2b16918999e9f3fc325b08ad761dd0079dac01c9a` |
| Installed `Ballerburg.exe` | `29b83c8cda7b9ab013d94eb69be6f373440e77b3361c466207f828324720fea9` |

The files are both 1,310,770 bytes but differ substantially. The compared table region at ISO file offsets `0x134700..0x1350ff` is identical; the code at the same offsets is not. **Do not apply the ISO code addresses to the installed copy.** DLL analysis was unnecessary for the recovered simulation.

The ISO PE is x86 PE32, image base `0x400000`, timestamp 2002-08-27 00:20:37 UTC. It has no relocation directory and is marked “relocations stripped”. `.text` begins at VA `0x401000`, raw offset `0x1000`; `.rdata` at `0x4ee000` / `0xee000`; `.data` at `0x4ff000` / `0xff000`. Thus subtraction of `0x400000` works for the code/tables here, **not for every PE section** (`.rsrc` has a different mapping). The extractor uses the section headers.

Confidence is per **interpretation**, not just per byte: **H** = high, an explicit reader/writer establishes the operation; **M** = medium, a role is inferred from the surrounding paths or nomenclature; **U** = unassigned/unverified meaning. All numeric table bytes below are exact for the fingerprint above. **Every gameplay conclusion remains unverified by runtime observation**, including those rated H. World units are renderer units; equating one world unit with one metre is **U**.

`objdump`, `strings`, and isolated Python were available; `r2` and `ghidra` were not. Installation of `pefile`/`capstone` into scratch failed because the package index was unreachable. The completed extractor requires only Python's standard library. Absolute immediates/displacements and static callback tables supplied the xrefs; there were no relocations to use. Function names in this report are descriptive names, not recovered symbols. Linear disassembly sometimes walks through jump-table data; function-entry disassembly and branch targets were used to distinguish it from code.

Reproduce the raw data without executing the input:

```bash
python3 -I scripts/rip/exe_tables.py downloads/en-iso/iso/Ballerburg.exe > /tmp/claude-1000/exe-tables.json
objdump -d -Mintel --start-address=0x4a02c0 --stop-address=0x4a04fa downloads/en-iso/iso/Ballerburg.exe
objdump -d -Mintel --start-address=0x407dbd --stop-address=0x4080af downloads/en-iso/iso/Ballerburg.exe
objdump -d -Mintel --start-address=0x411ff0 --stop-address=0x4122e3 downloads/en-iso/iso/Ballerburg.exe
```

## 2. Table layout and column identification

There are **20 weapon slots**: global IDs 34–53, with 39–42 reserved, leaving the requested **16 named weapons**. Let `w = global_id - 34`. Several subsequent tables use a **projectile/effect index**, whose first 20 entries correspond to these slots but whose special entries continue beyond them. In particular, **`0x534a7c` is the tail of the projectile-count table**, not the start of an independent 20-column flag table as conjectured in research/10.

### 2.1 Address dictionary and reader evidence

| VA / layout | Column or operational meaning | Reader evidence | Confidence |
| --- | --- | --- | --- |
| `0x5347e0`, i16[54], global ID | Build price | `0x408f8c–0x408f9b` subtracts indexed value from gold | H |
| `0x534860`, i16[20], w | Base firing price | `0x4248cc` uses biased base `0x53481c + 2*global_id`; cost additions below | H |
| `0x5349c4`, u8[34], building ID | Full supporting-building HP | Initialization `0x4081b5`; actual subtraction `0x403bce`, half-HP weapon loss `0x403c78–0x403cc4` | H |
| `0x535cd8`, i8[54], global ID | Footprint side in grid cells | `0x4090c2`, grid writes `0x4091c7–0x409235`; one grid cell = 256 position units | H |
| `0x534a0c`, u8[36], w | Reload nominal seconds; first 20 weapon entries | `0x406c88` uses `0x5349ea+global_id`, then `shl edx,4`; HUD `0x453151–0x453157` | H |
| `0x534a30`, u8[36], w | Launch/animation delay, in ticks | `0x406c71`, `0x407ec7–0x407ed4`: biased base `0x534a0e+global_id`, add to spawn tick | H |
| `0x534a54`, u8[20], w | Charge-dependent firing-price coefficient | `0x424765`, `0x424901–0x42492d`, `0x453202–0x453239` | H |
| `0x534a68`, u8[28], projectile index | Primary projectiles per firing event | Actual spawn loop `0x407dee–0x4080a1` reads `0x534a46+global_id`; 28-slot extent also covers special effects | H for first 20; M for all tail roles |
| `0x534a84`, u8[20], w | Exemption from a temporary powder-firing disable state | `0x424780–0x4247b7`; gates firing at `0x4249bc`; state `scenario+0xf3` incremented/decremented by timed effect `0x40bbd5`, `0x40c4f1` | H operation; M “powder disable” name |
| `0x534a98`, u8[20], w | Loaded flag with no downstream use found | `0x424777` reads `0x534a76+global_id` into local `[ebp-0xe]`; no later use in this firing routine | U purpose; H observed dead local load |
| `0x534aac..0x534aaf` | Four zero bytes, padding/unassigned | No justified column assignment | U |
| `0x534ab0`, u8[28], projectile index | Fire classification, 0 or 100 | `0x40ad95` selects ground-effect variant; `0x42294d` tests >=50 for AI target selection against flammable targets | H classification; **U as a probability** |
| `0x534acc`, u8[28], projectile index | Shield category: 0 checks ward bit 1; 1 checks bit 2; 2 bypasses those tests | `0x4029b4–0x4029cc`; also used for visual effect choice and AI composition | H operation; M stone/bolt versus gunpowder labels |
| `0x534ae8`, u8[28], projectile index | Impact camera-shake impulse | `0x40abb2` -> `0x439470` saturating 64x64 field -> `0x43996d–0x439a18` random camera-position offsets | H; **not damage** |
| `0x534b04`, u8[20][2], w | Minimum/maximum elevation code | `0x408f1d/29` initializes clamped pitch; `0x422f65–0x422fb9` clamps AI; ballista controls `0x45cbbb/ cbcb`, `0x45cd0c/cdce` | H |
| `0x534b2c`, u8[20], w | Angular scatter parameter S | `0x407dd0` uses `0x534b0a+global_id`; modulo draws and angle perturbations `0x407e4b–0x407eaa` | H |
| `0x534eac`, i16[26], projectile index | Drag numerator C | Spawn `0x407f9a` -> projectile +4; integrator `0x4a0321` multiplies it by relative speed | H operation; U physical units |
| `0x534ee0`, i16[26], projectile index | Drag denominator M, mass-like | Spawn `0x407fa9` -> +2; integrator `0x4a0328–0x4a032d` divides by it | H operation; M “mass”, **not verified kg** |
| `0x534f14`, i16[26], projectile index | Launch-speed coefficient K; rockets use fixed initial speed instead | `0x407fb8–0x407fc0` multiplies by charge; rocket special cases `0x407f59–0x407fef` | H |
| `0x534f48`, 28 records x 10 bytes | Impact parameters, layout below | Direct `0x4038cd`, splash `0x403d47/0x40436d`, secondary effects `0x40ad5e`, HUD `0x453da5` | Per field below |

The adjacent block beginning `0x534b40` is an **entity-type AI target-score matrix**, covering buildings **and weapons**, not a ballistic array. Its readers `0x420705–0x420722` and `0x4210b4–0x4210f7` index `3*global_type + selector` and add the result to a target score. The latter explicitly extracts a weapon type. Its weapon rows are included in section 2.6; the 7/5/35/100 building-row values must not be relabelled weapon speeds or damage.

Impact-record layout, relative to `0x534f48 + 10*projectile_index`:

| Offset | Type | Meaning | Confidence |
| --- | --- | --- | --- |
| +0 | u16 | Building-splash radius, native position units | H: used as 3D distance cutoff and falloff denominator |
| +2 | u16 | Secondary ground-effect radius, passed to `0x430ba0` and `0x44d4b0` | H call/data flow; M crater/scorch role; **not the building-damage radius** |
| +4 | u16 | Enemy-map impact-circle radius | H: `0x453da5`, multiply by map scale then >>8 |
| +6 | u8 | Zero in every record | U; no reader identified |
| +7 | u8 | Direct-hit defence-point subtraction | H |
| +8 | u8 | Maximum collateral/splash defence-point subtraction | H |
| +9 | u8 | Zero in every record | U; no reader identified |

### 2.2 Prices, reload and support HP — all 16 named weapons

“Base/no workshop” excludes the charge/powder-price addition. Reload is in **nominal 16-tick seconds**, not an assertion about measured real seconds. `H/2` below means half the full HP of the hosting wall/tower. Ground support labels follow the known basic/royal grouping; the half-HP destruction operation is independently traced in section 5. Air-unit handling is separate.

| ID / weapon | Build gold | Base / no workshop gold | Reload | Footprint | Support HP / weapon threshold |
| --- | --- | --- | --- | --- | --- |
| 34 Catapult | 600 | 35 / 52 | 18 | 3 | 60 / nominal 30 |
| 35 Fire catapult | 750 | 100 / 150 | 24 | 3 | 60 / nominal 30 |
| 36 Long John | 600 | 90 / 135 | 18 | 3 | 60 / nominal 30 |
| 37 Hot Helga | 750 | 150 / 225 | 24 | 3 | 60 / nominal 30 |
| 38 Trebuchet | 850 | 150 / 225 | 18 | 3 | 96 / nominal 48 |
| 43 Ballista | 400 | 15 / 22 | 15 | 1 | host H / nominal H/2 |
| 44 Fire ballista | 400 | 100 / 150 | 15 | 1 | host H / nominal H/2 |
| 45 Arcaballista | 850 | 200 / 300 | 18 | 3 | 96 / nominal 48 |
| 46 Cannon | 750 | 60 / 90 | 22 | 1 | host H / nominal H/2 |
| 47 Double cannon | 750 | 100 / 150 | 22 | 1 | host H / nominal H/2 |
| 48 Quad launcher | 800 | 300 / 450 | 30 | 1 | host H / nominal H/2 |
| 49 Fat Freda | 850 | 150 / 225 | 22 | 3 | 96 / nominal 48 |
| 50 Hellfire | 850 | 220 / 330 | 22 | 3 | 96 / nominal 48 |
| 51 Rocket launcher | 800 | 100 / 150 | 30 | 1 | host H / nominal H/2 |
| 52 Zeppelin | 700 | 150 / 225 | 1 | 4 | counter 0..12 (section 5) |
| 53 Transport balloon | 0 | 0 / 0 | 1 | 4 | counter 0..12 (section 5) |

Price formula (H), with integer truncation at each division:

```text
with_workshop = base[w] + trunc(charge * powder_coefficient[w] * powder_price / 50)
without_workshop = trunc(with_workshop * 15 / 10)
```

`powder_price` is the signed word at `0x5348e4`, initially **0 in this file**, not a hardcoded 1. The multiply/divide is at `0x424901–0x42492d`; workshop absence applies 15/10 at `0x42496e–0x42497c`, mirrored by the HUD. Mode-specific free-fire paths also exist. Thus “Cannon 60/90” is a base price, not a universal final firing bill.

### 2.3 Launch, drag, elevation and scatter — all 16

All entries are native integers. `V0 = K*charge` position units/tick for ordinary artillery; rocket `K=1000` means a **fixed** initial speed, with charge setting burn duration. Elevation codes become `code*11` in a 4096-unit turn. `S` is the scatter input, not a Gaussian standard deviation. `N` counts initial projectiles, not rocket children. All operational meanings in this table are H; treating C/M as measured aerodynamic quantities is U.

| ID / weapon | N | Delay ticks | C | M | K | Elevation code min–max | S | Powder coeff |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 34 Catapult | 1 | 3 | 94 | 48 | 60 | 38–38 | 16 | 0 |
| 35 Fire catapult | 1 | 3 | 90 | 40 | 70 | 38–38 | 11 | 0 |
| 36 Long John | 3 | 3 | 94 | 48 | 60 | 38–38 | 16 | 0 |
| 37 Hot Helga | 1 | 3 | 90 | 40 | 70 | 38–38 | 11 | 0 |
| 38 Trebuchet | 5 | 3 | 94 | 48 | 60 | 38–38 | 16 | 0 |
| 43 Ballista | 1 | 3 | 10 | 31 | 45 | 5–65 | 8 | 0 |
| 44 Fire ballista | 1 | 3 | 10 | 31 | 45 | 5–65 | 8 | 0 |
| 45 Arcaballista | 4 | 3 | 10 | 31 | 45 | 20–20 | 14 | 0 |
| 46 Cannon | 1 | 0 | 80 | 52 | 40 | 22–22 | 11 | 1 |
| 47 Double cannon | 2 | 0 | 80 | 52 | 40 | 22–22 | 11 | 2 |
| 48 Quad launcher | 1 | 1 | 54 | 55 | 1000 | 68–68 | 20 | 1 |
| 49 Fat Freda | 1 | 0 | 90 | 76 | 38 | 38–38 | 11 | 1 |
| 50 Hellfire | 5 | 0 | 80 | 52 | 40 | 22–22 | 14 | 5 |
| 51 Rocket launcher | 1 | 1 | 54 | 55 | 1000 | 68–68 | 20 | 1 |
| 52 Zeppelin | 1 | 0 | 80 | 100 | 0 | 10–70 | 0 | 0 |
| 53 Transport balloon | 1 | 0 | 76 | 76 | 76 | 0–0 | 0 | 0 |

Zeppelin/balloon rows contain **table defaults**, not proof of an ordinary gun launch. Zeppelin's index 18 is also an event token; its actual dropped bomb is index **23**. Rockets release index **24** payloads. See section 4.5. No per-weapon gravity-scale field was found: the common integrator adds the same scenario gravity.

Elevation in degrees is `code * 0.966796875`: 5 -> 4.833984375°, 20 -> 19.3359375°, 22 -> 21.26953125°, 38 -> 36.73828125°, 40 -> 38.671875°, 65 -> 62.841796875°, 68 -> 65.7421875°. The table's “38” is not exactly 38 degrees.

### 2.4 Damage, radii and effect classifications — all 16

Radii are **raw native units**. Multiply by **5/256** to obtain renderer world units. C/S = direct/collateral damage in defence points. Gate = the exemption at `0x534a84`; F = the unassigned loaded flag at `0x534a98`. These retain every column in the immediate table block without inventing semantics for F.

| ID / weapon | Direct | Splash max | Splash radius | Ground-effect radius | HUD radius | Fire | Shield class | Shake | Gate | F |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 34 Catapult | 12 | 10 | 1024 | 450 | 1024 | 0 | 0 | 40 | 1 | 0 |
| 35 Fire catapult | 8 | 4 | 153 | 600 | 800 | 100 | 0 | 40 | 1 | 0 |
| 36 Long John | 12 | 10 | 1024 | 700 | 1024 | 0 | 0 | 40 | 1 | 0 |
| 37 Hot Helga | 12 | 4 | 384 | 512 | 800 | 100 | 0 | 40 | 1 | 0 |
| 38 Trebuchet | 12 | 10 | 1024 | 600 | 1024 | 0 | 0 | 40 | 1 | 0 |
| 43 Ballista | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 16 | 1 | 0 |
| 44 Fire ballista | 4 | 4 | 384 | 300 | 400 | 100 | 0 | 16 | 1 | 0 |
| 45 Arcaballista | 24 | 12 | 320 | 300 | 320 | 100 | 0 | 16 | 1 | 0 |
| 46 Cannon | 16 | 20 | 640 | 600 | 640 | 0 | 1 | 56 | 0 | 1 |
| 47 Double cannon | 16 | 20 | 640 | 600 | 640 | 0 | 1 | 56 | 0 | 1 |
| 48 Quad launcher | 1 | 1 | 0 | 100 | 1152 | 0 | 1 | 16 | 0 | 1 |
| 49 Fat Freda | 40 | 48 | 1536 | 1200 | 1536 | 100 | 1 | 95 | 0 | 1 |
| 50 Hellfire | 16 | 20 | 640 | 600 | 640 | 0 | 1 | 56 | 0 | 1 |
| 51 Rocket launcher | 1 | 1 | 0 | 120 | 1152 | 0 | 1 | 16 | 0 | 1 |
| 52 Zeppelin | 40 | 48 | 1536 | 1536 | 1536 | 0 | 1 | 0 | 1 | 0 |
| 53 Transport balloon | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 1 | 0 |

Selected **building-splash** radii in world units: Catapult/Long John/Trebuchet **20**; Fire catapult **2.98828125**; Hot Helga/Fire ballista **7.5**; Arcaballista **6.25**; Cannon/Double cannon/Hellfire **12.5**; Fat Freda **30**; rocket **payload** **22.5**; Zeppelin **dropped bomb** **30**. These are much larger than several tentative tuning values in DESIGN; no source tuning file was changed.

### 2.5 Reserved slots, extended tails and boundary audit

Reserved IDs **39–42** are identical: build 1500, footprint 3, base fire 10 (15 without workshop before additions), reload 14, delay 255, powder coefficient 0, primary count 1, gate 1, F 1, fire 0, shield class 2, shake 0, pitch 20–40, S 11, C 94, M 48, K 85, all seven impact fields zero. Their presence does not establish a playable weapon.

The full 36-byte reload and delay arrays include these extra 16 bytes after the 20 weapon slots. They are preserved rather than misassigned to weapon columns:

| Array | Tail indices 20–35 |
| --- | --- |
| reload_nominal_seconds | 100, 100, 60, 90, 120, 150, 90, 60, 150, 120, 60, 60, 200, 200, 200, 200 |
| launch_delay_ticks | 40, 40, 20, 40, 2, 6, 40, 60, 4, 6, 60, 60, 90, 90, 90, 90 |

Additional projectile/effect rows follow the first 20. A dash means the 26-entry physics arrays do not contain that index. Names are assigned only where a creator was traced. Ground-effect/HUD radii retain raw values.

| Index | Observed role | N | C/M/K | Splash/ground/HUD radius | Direct/splash | Fire/class/shake |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | unassigned special effect | 1 | 0/0/0 | 1536/1536/1536 | 32/48 | 0/2/0 |
| 21 | unassigned special effect | 1 | 0/0/0 | 1224/900/1224 | 12/10 | 0/2/0 |
| 22 | ammo workshop destruction effect | 1 | 0/0/0 | 1536/1536/1536 | 32/32 | 100/2/0 |
| 23 | Zeppelin dropped bomb | 1 | 80/100/0 | 1536/1536/1536 | 40/60 | 0/1/112 |
| 24 | rocket explosive child | 4 | 53/60/16 | 1152/1152/1152 | 24/28 | 0/1/80 |
| 25 | unassigned special effect | 0 | 94/48/85 | 1/0/0 | 8/8 | 0/2/88 |
| 26 | unassigned special effect | 0 | — | 100/0/100 | 0/0 | 0/2/0 |
| 27 | unassigned special effect | 0 | — | 100/0/100 | 0/0 | 0/2/0 |

The damage records end exactly at **`0x535060`**, where the separate phrase-pointer table begins (loaded/rebased at `0x40d150–0x40d179`). The C/M/K arrays each have 26 words and end/start at `0x534ee0`, `0x534f14`, `0x534f48`. The four `0x534aac` bytes and impact offsets +6/+9 remain unassigned. The additional AI matrix below is also decoded; this is not a claim that every neighboring research/AI tuning table has been decoded.


### 2.6 Adjacent AI target-score columns — all 16

`0x534b40 + 3*global_id + selector` stores target values, including a weapon contribution when a weapon sits on the candidate building. At `0x4210da` the weapon's value is read, multiplied by a palace-damage-dependent factor, and added to the target score at `0x4210f2–0x4210f7`. Selector comes from the low nibble of a 20-byte AI profile record (`0x4206a3–0x4206b8`); the three profile values at `0x534d30/0x534d44/0x534d58` are 0/1/2. **H** for values and target-score use; **U** for assigning the three columns to localized personality names without tracing that UI mapping.

| ID / weapon | Selector 0 | Selector 1 | Selector 2 |
| --- | --- | --- | --- |
| 34 Catapult | 14 | 11 | 14 |
| 35 Fire catapult | 13 | 12 | 12 |
| 36 Long John | 16 | 15 | 14 |
| 37 Hot Helga | 17 | 17 | 18 |
| 38 Trebuchet | 20 | 20 | 18 |
| 43 Ballista | 3 | 3 | 3 |
| 44 Fire ballista | 3 | 7 | 7 |
| 45 Arcaballista | 20 | 20 | 18 |
| 46 Cannon | 6 | 6 | 6 |
| 47 Double cannon | 9 | 9 | 9 |
| 48 Quad launcher | 10 | 10 | 5 |
| 49 Fat Freda | 20 | 20 | 18 |
| 50 Hellfire | 20 | 20 | 20 |
| 51 Rocket launcher | 10 | 10 | 10 |
| 52 Zeppelin | 30 | 30 | 30 |
| 53 Transport balloon | 0 | 0 | 0 |

Reserved IDs 39–42 each have **0/15/15**. The extractor preserves all 64 triples up to `0x534c00`; rows 54–63 are zero/unassigned, and `0x534c00` begins a separately referenced scalar AI-tuning block. The 64-row extent is a boundary inference (M); the first 54 entity rows and their reads are established.

## 3. Projectile tick, units, gravity, drag and wind coupling

### 3.1 Call chain and state layout

The event dispatcher `0x4079a0` is called from the simulation-tick loop at `0x40e2d7`. The tables at `0x517af0`, `0x517b28`, `0x517b60` hold start/update/end callbacks. Event type **6** maps to **`0x40a290 / 0x40a420 / 0x40ab80`**. Its update calls **`0x4a02c0(projectile, tick)` at `0x40a48e`**, then the collision routine **`0x4019b0` at `0x40a4c9`**. While flying, its end tick is moved forward by one (`0x40aab1–0x40aab6`); a collision selects the impact/end path. This establishes that `0x4a02c0` is the actual simulation integrator, not just a visual particle or aim-preview routine. The preview at `0x406e60` also calls it, at `0x406fcf`.

Projectile data starts at event-record +`0x14`; events occupy 64 bytes at `0x23a1040`. Offsets below are relative to the projectile pointer (for example `0x23a1054`):

| Offset | Type | Interpretation | Confidence |
| --- | --- | --- | --- |
| +0 | i16 | Projectile/effect index | H |
| +2 | i16 | M, drag denominator; changes during rocket burn | H |
| +4 | i16 | C, drag numerator | H |
| +6,+8,+10 | i16 x3 | X,Y,Z position | H |
| +12,+14,+16 | i16 x3 | X,Y,Z velocity, native position units/tick | H |
| +18 | i16 | Rocket burn counter / stage sentinel | H for rockets; not a general life timer |
| +20,+22 | i16 x2 | Rocket direction and elevation in 4096-turn units | H |
| +24,+26,+28 | i16 x3 | Previous position, used for collision/render interpolation | H |
| +30,+32,+34 | i16 x3 | Impact position | H |
| +36 | u32 | Collision result/flags | H; not every bit decoded |

### 3.2 Time step: distinguish game time from wall time

**H:** the integrator advances one discrete tick, with no float `dt` argument. At `0x40e177–0x40e1bc`, elapsed milliseconds accumulate and are divided by the integer at **`0x518430`** to determine how many simulation ticks to run; the remainder provides render interpolation. `timeGetTime` is imported at IAT **`0x4ee800`** and used in `0x40e9c0–0x40ea28`.

**The ISO file initializes `0x518430` to decimal 62**, so the default wall-clock step is **0.062 s**, approximately **16.129 ticks/s**. Do not silently round that to 1/16 s. Input paths at `0x410f19`, `0x410f3f`, `0x410f65` write **66, 33, 10 ms**, respectively. The initial timer call can inject 66 ms at `0x40e9f5`; that is distinct from the default tick divisor. Pausing/network catch-up can further change how ticks are dispatched, without changing the per-tick integration arithmetic.

Game timers and reload counters commonly use **16 ticks per nominal second** (`<<4` / `>>4`). Thus the ordinary cannon's table reload is 22 nominal seconds = **352 ticks** = **21.824 wall seconds at the untouched 62 ms divisor**, before animation/scheduling/mode effects. The launch-delay column and the extra event-scheduling tick should not be mistaken for gravity or reload seconds. No claim of measured timing is made.

### 3.3 Coordinate scale and gravity

Renderer interpolation directly converts the projectile positions using **`0x4eece4 = float32 0.01953125 = 5/256`**:

```asm
43f36c  movsx ecx,WORD PTR [edi+0x18]  ; old X
43f370  movsx edx,WORD PTR [edi+0x06]  ; current X
43f374  sub   edx,ecx
43f37e  fild  DWORD PTR [esp+0x28]
43f382  fmul  DWORD PTR ds:0x53b6e8    ; fractional tick
43f388  fiadd DWORD PTR [esp+0x1c]
43f38c  fmul  DWORD PTR ds:0x4eece4    ; 5/256
43f392  fstp  DWORD PTR [eax+0xc0]
```

Y and Z use the same factor at `0x43f3b8` / `0x43f3e4`. Native **positive Y is downward**: launch elevation negates Y velocity, and gravity adds positive Y velocity. The grid's 256 position units correspond to **5 renderer units**. The fact that this agrees with the mesh grid does not prove SI metres.

Gravity is the i16 field **`scenario + 0xec`**, read at **`0x23974ec + scenario_index*0x144`**:

```asm
4a0386  mov ax,WORD PTR [edx*4+0x23974ec]
4a038e  add ax,cx                       ; cx = drag-adjusted Vy
4a0391  mov WORD PTR [esi+0x0e],ax
```

Custom-game setup **`0x49dc23–0x49dc37`** and another setup path **`0x42a3c9–0x42a3dd`** assign **`g_tick = 33 + (rng() % 8)`**, i.e. **33–40 native position units/tick²**. The PRNG returns nonnegative 15-bit integers, so the compiler's signed-modulo correction does not widen this range. Campaigns load the scenario field; for example the original `Lv1_1_1.odn` has **33** at file offset `0xec`. A universal fixed gravity of 33 would therefore omit the custom-game variation.

For `q = 5/256` world units/native unit and chosen wall step `h`:

```text
gravity_world = g_tick * q / h²       (positive downward)
```

At the file's default **h=0.062**, g=33 means **167.6720213 world units/s²**, and custom 33–40 means **167.6720213–203.2388137**. If using **nominal game seconds of 16 ticks**, the corresponding numbers are **165–200 world units/(nominal s)²**. The formulas/conversions are H; interpreting these as m/s² is U. **No 9.81-based projectile rule was found.** Float-constant searching alone would miss this implementation.

### 3.4 Exact ordinary-projectile update

Let `v=(vx,vy,vz)`, `p=(x,y,z)`, current tick `n`, and `W` be the wind vector defined in section 6. Let `R16(t)=(t+32768) >> 16`, with arithmetic right shift. For the normal positive M/C cases:

```text
j = (n >> 5) & 255
wx = wind_table[j].x + extra_wind_x
wz = wind_table[j].z + extra_wind_z
r  = (wx - vx, -vy, wz - vz)
s  = integer_sqrt(rx² + vy² + rz²)
A  = trunc(C * s / M)                 if s != 0, otherwise 0
vx = i16(vx + R16(A * rx))
vy = i16(vy + R16(-A * vy))
vz = i16(vz + R16(A * rz))
vy = i16(vy + g_tick)
previous_position = p
p = i16_componentwise(p + v)
```

This describes the non-rocket core. Exact reproduction must retain x86 32-bit intermediate arithmetic, signed division and i16 stores/wraps; arbitrary unbounded real-number arithmetic is not bit-identical. `R16` rounds half upward, including the asymmetric negative case; it is not truncation toward zero. The square root helper **`0x401820`** is an integer bit-pair algorithm, not an FPU call.

Selected integrator evidence:

```asm
4a02cc  sar  eax,0x5
4a02d7  and  eax,0xff
4a02dc  mov  edi,DWORD PTR [eax*8+0x23844e0] ; wind X
4a02e3  mov  ebx,DWORD PTR [eax*8+0x23844e4] ; wind Z
4a02ef  sub  edi,ecx                        ; subtract vx
4a02f7  sub  ebx,edx                        ; subtract vz
; 4a02f9/2fb add extra wind; 4a0301–310 square/sum including vy
4a0313  call 0x401820
4a0321  movsx eax,WORD PTR [esi+0x4]        ; C
4a0325  imul eax,ecx                        ; C * relative speed
4a0328  movsx ecx,WORD PTR [esi+0x2]        ; M
4a032c  cdq
4a032d  idiv ecx
4a0336  imul ecx,edi                        ; X drag impulse numerator
4a0343  add  ecx,0x8000
4a0350  sar  ecx,0x10
4a0361  add  WORD PTR [esi+0xc],cx
; 4a0365/369 update Y/Z, then scenario gravity at 4a0386
4a04ca  mov  WORD PTR [esi+0x18],ax         ; save old X
4a04ce  add  di,ax                         ; new X = old X + new vx
4a04e3  mov  WORD PTR [esi+0x6],di
```

This is **velocity-first Euler with quadratic drag relative to air**, not constant horizontal acceleration, constant wind displacement, or horizontal-only linear drag. Wind changes the magnitude of drag as well as its direction. Vertical drag is present even though vertical wind is zero. There is no independent per-weapon “wind scale” array: the response is governed by **C/M** and relative speed.

Ignoring integer quantization, a continuous approximation in renderer units is:

```text
dV/dt ≈ (C / (1280*M)) * |W - V| * (W - V) + (0, gravity_world, 0)
W = (q/h) * (wx, 0, wz)
```

The `1280 = 65536*q` conversion is derived algebraically, not a new executable constant. Use the discrete formula for fidelity. Gravity, thrust and drag are applied before position is advanced; there is no additional `0.5*g*dt²` position term.

## 4. Direction, range, launch vector and spread

### 4.1 Stored aim and direction readout

A 36-byte weapon record begins at `0x237f780 + player*0x160c + weapon_slot*0x24`. Its relevant fields are:

| Offset | Meaning |
| --- | --- |
| +0x0c | u8 charge/range power |
| +0x0d | saved previous charge |
| +0x0e | actual packed aim |
| +0x10 | saved previous packed aim |
| +0x12 | requested packed aim, read by the HUD |

Packed aim uses **low 10 bits for `a`, 0–719**, and **high 6 bits for `e-5`**. Button handlers `0x45c9b0` / `0x45ca40` increment/decrement `a` by one and wrap at **719/720**. This is nominal **half-degree** control, not 360 storage slots. The gun follows requested aim; firing checks that actual and requested packed aim agree (`0x4249fd–0x424a26`).

Let `c` be the castle's orientation byte `player+0x66`, read at `0x237ed06 + player*0x160c`. The three-digit HUD direction is:

```text
D = wrap360(360 - floor((a + 180*(2-c)) / 2))
  = wrap360(180 + 90*c - floor(a/2))
```

**H:** `0x45285d–0x4528b6` reads c, builds the 180 multiplier with LEAs, shifts by one, subtracts from 360, and wraps. It then splits D into decimal digit sprites. Both half-degree internal settings can display the same integer D.

The launch code uses a slightly approximate conversion:

```text
azimuth_turn_units = (1024*c - trunc(91*a/16)) & 4095
elevation_turn_units = 11 * e
```

Evidence: `0x406d5a–0x406d9b` for azimuth and `0x406d68–0x406e26` for elevation, independently mirrored in the predictor call at `0x424b10–0x424b71`. `91/16=5.6875` approximates `4096/720`, so do not replace it with exact degrees if matching integer results. With sine table S and cosine obtained by adding 1024:

```text
H  = (V0 * S[(elevation+1024)&4095]) >> 12
vx = (H * S[azimuth]) >> 12
vy = (-V0 * S[elevation]) >> 12
vz = (H * S[(azimuth+1024)&4095]) >> 12
```

The launch generator at `0x408004–0x408066` uses these operations. S has amplitude **4096** and **4096 samples per turn**. The coordinate conversion is H. The conventional compass label “north” comes from the manual: approximately D=000 -> native -Z; D=090 -> native -X, subject to the rounding and half-step ambiguity above. Reusing a positive-X-east convention from the new game without converting the original axes would mirror the shot.

### 4.2 What the right-hand number controls

**Ordinary artillery, excluding the two ballistas and the air units:** right readout **R = charge byte**. Human controls clamp it to **1–255** (`0x45cd54–0x45cd60`, `0x45ce09–0x45ce15`, drag clamp `0x45cede–0x45cf08`). The HUD reads it directly at `0x452af8`. The speed before scatter is **`V0 = K[w]*R`**, not a fixed speed with an inverse range-to-elevation lookup. Speed in world units/s at the default divisor is `0.31502016129*K*R`.

Example: Cannon at R=048 has `V0=40*48=1920` native units/tick, approximately **604.839 world units/s** at 62 ms, before drag. Its normal elevation code is 22 -> 242/4096 turn -> **21.26953125°**. This speed must not be called 604.839 m/s without establishing a metric scale.

**Ballista IDs 43/44:** the right readout is instead **e = (packed_aim >> 10)+5**, shown at `0x452ad8–0x452ae2`. The same arrows adjust elevation between codes **5 and 65** (`0x45cd0c–0x45cd2a`, `0x45cdce–0x45cde0`). Their charge is initialized to **127** at `0x409059–0x409061`, giving `45*127=5715` native units/tick; normal human “range” adjustment does not edit that charge. AI or other paths may set state differently. The left-number drag also adjusts ballista height, as described in the manual.

**Rockets IDs 48/51:** right R controls **burn duration** and starting M, with fixed initial `V0=1000`. See 4.5. **Zeppelin/transport balloon:** separate air control/state paths; the ordinary R/angle formula does not describe their movement.

The “range higher = farther” description is therefore a control explanation, not a stored metres-per-dial constant. **No fixed distance-per-dial mapping or metric min/max-range table was identified.** The known limits are input limits and pitch limits. Distance depends on charge, drag, wind, gravity, height, terrain, stage behavior and signed-coordinate bounds. Research/06's “not a power value” inference is overturned for ordinary artillery by the spawn reader.

### 4.3 Default aim and initial charge

`0x408e88` starts elevation code at **38**, or **70** for rocket IDs 48/51 (`0x408ef4–0x408f00`), then clamps to the per-weapon pair at `0x408f1d–0x408f72` and stores `(e-5)<<10`. Thus catapults use 38, cannons/Hellfire 22, Arcaballista 20, Fat Freda 38, rockets 68 after clamping; ballistas start at 38 within 5–65. This is a set of fixed launch pitches for many weapons, not a 5–65 universal elevation band.

Creation explicitly assigns initial charge **Catapult 38, Fire catapult 40, Cannon 48, Ballistas 127** at `0x408ff4–0x409061`. Other ordinary slots read a calculated setup table at `0x23978a0+w` (`0x409045` uses the biased address). That table is generated with trial integrations at `0x412300–0x41258c`; it is not another constant muzzle-speed array. No static fixed initial charge is asserted for those weapons.

### 4.4 Exact scatter distribution and salvo timing

At launch `0x407dd0` reads S from `0x534b2c+w`. If player flag `0x04` is set at `player+0x0c` (`0x237ecac`), it halves S using signed integer division (`0x407dd6–0x407de8`). The operation is H; identifying that flag as **Accuracy research** is M, consistent with the localized tooltip. It does **not** eliminate scatter.

Four fresh PRNG outputs, each reduced modulo `S+1`, are used per primary projectile. Write these as u1..u4 in 0..S (modulo reduction, not an ideal continuous uniform):

```text
azimuth'  = (azimuth + u1 + u2 - S) & 4095
elevation'= (elevation + trunc((m*(u3-S) + u4)/4)) & 4095
m = 4 normally; 5 when unperturbed elevation == 242;
    15 when unperturbed elevation == 418
```

Evidence: `0x407e02–0x407e2a` chooses m; `0x407e4b–0x407e6d` forms horizontal scatter; `0x407e73–0x407eaa` forms vertical scatter. **The vertical expression is asymmetric in this build**: do not replace it with `(u3+u4-S)*m/4`. No independent random speed multiplier was seen in this launch loop. Angles are not reclamped to the pitch table after perturbation.

Horizontal support is ±`S*360/4096` degrees: Catapult S=16 -> ±1.40625°; Cannon S=11 -> ±0.966796875°; Ballista S=8 -> ±0.703125°; rocket S=20 -> ±1.7578125°. The horizontal distribution is triangular from two modulo draws, not Gaussian. The shared PRNG (`0x411fc0`) is:

```text
seed = (214013*seed + 2531011) mod 2^32
return (seed >> 16) & 32767
```

`0x407df4–0x407dfd` seeds this generator from the current game tick before the salvo; later draws also serve other systems. The extractor only reads data and does not execute this algorithm or the game.

The primary spawn loop reads N at `0x407dee` and iterates N times. Hellfire (global ID 50) adds offsets **36,27,18,9,0 ticks** in loop allocation order (`0x407f85–0x407f94`, `0x408095`), i.e. five shots **9 ticks apart** in chronological order, **0.558 s** at the default divisor. Double cannon's two primary projectiles have no corresponding extra interval in this loop; they share the base spawn tick. This is not the assumed 0.3 s double-cannon delay in DESIGN.

### 4.5 Rockets and Zeppelin bomb: effective payloads

For rocket primary indices **14 and 17**:

```text
V0 = 1000 native units/tick
C = 54
M_initial = 55 + 2*R
burn_ticks = R
```

The spawn exceptions are at `0x407f59–0x407fef`, with the same setup in the predictor at `0x406ee6–0x406f44`. During positive burn count the core drag/gravity update is followed by approximately **45 native units/tick²** of forward thrust in the stored orientation (`0x4a03b5–0x4a0433`), then orientation is recomputed from velocity, **M -= 2**, **burn_ticks -= 1** (`0x4a0491–0x4a049d`). Integer sine shifts apply to thrust too. At burn count zero the next update halves velocity and sets the stage sentinel to -1 (`0x4a04a3–0x4a04b4`).

On the subsequent non-collision stage path, **Rocket launcher releases one** index-24 explosive child (`0x40a56e–0x40a697`); **Quad launcher releases four** (`0x40a69c–0x40aaaa`). Children copy position, use **C=53, M=60**, and velocities based on twice the halved parent velocity plus small integer random offsets. The four quad children differ in the X/Z signs of those offsets; they are not four identical copies. The child has **direct 24, splash max 28, radius 1152 = 22.5 world units**. The carrier's raw `direct=1, splash=1, radius=0` row is therefore **not the weapon's effective explosive damage**. Staging is skipped on the collision branch; impact before burnout differs from normal payload release. The parent sentinel becomes -2 after spawning to prevent repeated child creation.

Zeppelin's fire callback first creates index **18** when initiating its loading/flight state (`0x407c98`, consumed specially at `0x40a2cd–0x40a31f`). A real bomb drop uses index **23**, **C=80, M=100**, initial velocity **(0,40,0)** and Y offset **+200**, from `0x407cf4–0x407d66`. Its effective bomb row is **direct 40, splash max 60, radius 1536 = 30 world units**, not index 18's splash 48. Transport balloon is not an artillery gun; its nonzero K table entry is not evidence that it fires that projectile.

## 5. What a hit does to defence points

### 5.1 Direct damage

The damage routine at **`0x403820`** reads the current projectile index from the collision context `0x23bebe8`. For a direct building collision it reads **record +7**, not the projectile count, shake magnitude, C, M or kinetic energy:

```asm
4038c7  lea ecx,[ecx+ecx*4]
4038cd  mov dl,BYTE PTR [ecx*2+0x534f4f] ; +7 of 10-byte record
; selected building current HP is byte 0x237ed72 + player/slot offsets
403bb0  mov al,BYTE PTR [ebx+0x237ed72]
403bbc  mov cl,BYTE PTR [esp+0x28]       ; direct damage
403bc6  cmp al,cl
403bc8  jbe 0x403de6                    ; destruction if HP <= damage
403bce  sub al,cl
403bd2  mov BYTE PTR [ebx+0x237ed72],al
```

**H:** a normal cannonball subtracts **16 defence points** from its directly hit building, a catapult rock **12**, an Arcaballista stake **24**, a Fat Freda ball **40**, and a normal ballista bolt **4**. These are per projectile. There is no velocity-dependent or random damage multiplier in this ordinary direct subtraction. Scenario/tutorial special cases, scoring, other effects and collision acceptance precede/follow it; the table is not a promise that every projectile can hit every target.

### 5.2 Splash is separate and excludes the directly hit object

At `0x403d47`, impact-record **+0** is the splash radius R. A zero radius skips building splash even when the max-damage byte is nonzero, explaining the rocket carrier's 0/1 combination. For nearby buildings the code:

1. Enumerates spatial bins around the impact, limits candidates to building types below 34, and skips the direct-hit object (`0x404234–0x404253`). Per-impact stamps also prevent duplicate application.
2. Measures integer Euclidean distance from impact to a building reference point near its vertical midpoint (`0x4042b5–0x40433a`). It uses the target's height entry at `0x517888+18*building_type`, shifted by one, not nearest-surface distance.
3. Rejects `distance >= R` (`0x404348–0x40434a`) and a nonzero result from the intervening spatial/obstruction test **`0x4048f0`** (`0x40435a–0x404361`). Its role as an obstruction test is **M**; its full geometric edge cases were not exhaustively decoded.
4. Reads impact-record **+8** and computes damage:

```text
base_splash_damage = Smax - trunc(Smax * integer_distance / R)
```

Evidence:

```asm
40436d  mov cl,BYTE PTR [eax+0x534f50] ; Smax, record +8
404373  mov eax,ecx
404375  imul eax,edi                  ; edi = integer distance
404378  cdq
404379  idiv DWORD PTR [esp+0x30]     ; radius
40437d  sub ecx,eax
...
4045d0  cmp ecx,edx                  ; current HP versus adjusted splash
4045d2  jle 0x404756                 ; destroy
4045dc  sub al,dl
4045de  mov BYTE PTR [ecx+0x237ed72],al
```

For nonnegative quantities this falloff is **ceil(Smax*(1-d/R))**, not floor of the final real-valued expression. At the radius boundary it is skipped entirely. A cannon therefore applies **16 direct to the hit building**, and up to **20** to each eligible nearby building within **640** native units. The hit building does **not** automatically get 16+20 from the same impact. Example: a different unobstructed building at distance 320 receives `20-floor(20*320/640)=10` before modifiers.

Modifiers visible here: player flag **0x20 halves splash** (`0x4043a4–0x4043af`, arithmetic shift; **H**, identification as fragment-shield research **M**). A special palace/owner-state combination doubles it (`0x40437f–0x4043a0`: target building type 29, player byte +0x7a==2 and +0x78>0); its gameplay label is **U**. These modifiers must not be baked into the base table. The shield-category table can also cause a projectile to be intercepted before ordinary damage (`0x4029b4`).

### 5.3 Why the manual says ground weapons have 30/48 HP

The supporting-building HP array contains type **31 = 60**, type **32 = 96**. After a surviving direct hit, **`0x403c78–0x403c86`** compares remaining HP to **`full_HP >> 1`**. At or above that value it keeps the weapon; **below** it, the code walks the footprint and destroys its mounted weapon(s) through `0x406220`. For ground-support types >=31 it also calls the support-destruction routine (`0x403cbc–0x403cc4`). Splash repeats the same half-HP threshold at `0x40464d–0x4046a4`.

This explains the factor-of-two in research/10: **60/96 is support HP; 30/48 is the nominal weapon condition range above the halfway threshold.** The basic versus royal assignment to particular ground weapons in the table is **M**, consistent with their grouping/manual; there is no independent 16-row weapon-HP table. The threshold operation itself is **H**. The HUD explicitly shows `max(1, trunc(200*remaining_HP/full_HP)-100)` at `0x452f0f–0x452f34`, independently corroborating it.

**Boundary detail:** the comparison is strict “remaining HP < half”, not “<= half”. From full HP, destruction therefore needs **31** points removed for a 60-HP support, or **49** for a 96-HP support, if damage arrives in one-point increments. A 96-HP support survives three ordinary 16-point cannon hits at exactly 48 HP, and crosses the threshold on the fourth. Wall-mounted weapons use the corresponding half-HP threshold of their host wall/tower; this is not a universal fixed 36-HP weapon.

Air units use a separate hit counter: **`0x403f9a–0x403fd5`** identifies global IDs 52/53, adds **4** for projectile index 9 (Ballista) or **12** for index 10 (Fire ballista), and destroys at counter **>=12**. That gives three normal bolt hits or one fire bolt from a fresh zero counter, subject to collision/state paths. It is not the support HP model.

### 5.4 Fire and collateral side effects

The 0/100 column is not established as “100% ignite probability”. It has classification uses and feeds secondary ground-effect selection, while fire impact handling branches explicitly on projectile index (`0x40acfd–0x40ad4c`). The ordinary direct/splash numbers above do not include subsequent burning, spells, economy consequences or chain reactions. A full fire duration/spread model was outside this trace; no guessed burn DPS is supplied.

One confirmed chain-reaction example: destruction of building type **21** (ammo workshop) creates an impact event with projectile/effect index **22** at `0x405e33–0x405e98`. Its raw damage row is direct **32**, splash **32**, radius **1536**; ordinary impact filtering still governs its application. It is a separate event, not a multiplication of the projectile that struck the workshop.

## 6. Wind settings, initialization, schedule and HUD

### 6.1 Setting fields, ranges and defaults

The scenario record is 0x144 bytes. Its relevant offsets are:

| Offset from scenario base | Runtime address for scenario 0 | Meaning | Confidence |
| --- | --- | --- | --- |
| +0xc6 | `0x23974c6` | Maximum direction change in nominal degrees; forced to **60** during setup | H |
| +0xec | `0x23974ec` | Gravity per tick² | H |
| +0xee | `0x23974ee` | Initial wind angle, 4096 units/turn | H |
| +0xf0 | `0x23974f0` | Wind strength setting | H |
| +0xf1 | `0x23974f1` | Wind change setting | H |

Custom setup copies UI settings **+0x170 (strength)** and **+0x17c (change)** into these fields at `0x49dfec–0x49dffd`. UI increment handlers cap them at **strength 8** and **change 5** (`0x46cd10–0x46cd3f`); decrement handlers stop at **0** (`0x46cfd2–0x46d005`). Therefore the custom ranges are **0–8 and 0–5**, not two 0–5 sliders.

The five preset-reset paths beginning `0x466870`, `0x4669f0`, `0x466b70`, `0x466d00`, `0x466e90` write **strength=0, change=0** (writes at `0x466990/69b4`, `0x466b10/6b38`, `0x466c7e/6ca6`, `0x466e0e/6e36`, `0x466f9e/6fc6`). Saved/user settings and scenario loads can override these; there is **no universal always-random initial wind strength**.

The initial direction comes from the scenario, not a fresh unrestricted random angle in the wind generator. For example, as byte reads of the original 324-byte scenario files: **`Lv0_0_1.odn` has gravity 33, initial angle 0, strength 3, change 4**; **`Lv1_1_1.odn` has 33, 0, 0, 0**, respectively at `+0xec/+0xee/+0xf0/+0xf1`. These identify concrete scenario initial values, not a claimed universal custom-game preset. With change enabled the generator perturbs the direction **before writing its first segment**, so the actual initial vector need not use exactly that stored angle.

### 6.2 Strength maps to air velocity

The i32[9] array at **`0x534730`** is read at `0x412187/0x4121a7` and `0x41225f/0x41227f`:

| Strength / compass number | Magnitude in native units/tick | World units/s at 62 ms | Confidence |
| --- | --- | --- | --- |
| 0 | 0 | 0 | H |
| 1 | 10 | 3.150202 | H |
| 2 | 25 | 7.875504 | H |
| 3 | 45 | 14.175907 | H |
| 4 | 70 | 22.051411 | H |
| 5 | 100 | 31.502016 | H |
| 6 | 135 | 42.527722 | H |
| 7 | 175 | 55.128528 | H |
| 8 | 220 | 69.304435 | H |

For strength s and wind angle theta:

```text
wind.x = (magnitude[s] * S[(theta+1024)&4095]) >> 12
wind.z = (magnitude[s] * S[theta]) >> 12
```

Thus theta=0 means a **+X air velocity** in native coordinates. This angle's zero differs from the launch azimuth convention. Integer sine multiplication slightly perturbs the resulting vector's magnitude. No independent randomization of the magnitude occurs in the normal wind generator.

The **compass's central number is the strength index**, not these converted velocities: `0x459897` reads the u8 scenario strength and passes it to the numeric format/render path at `0x45989e–0x4598bd`. Calling the displayed “3” 3 m/s would be unsupported.

### 6.3 Change model and cycle

`0x411ff0–0x4122e2` builds **256 X/Z pairs** at `0x23844e0`. The integrator selects **`(tick >> 5) & 255`**. One entry therefore spans **32 ticks = 1.984 default wall seconds**, or 2 nominal game seconds. The schedule repeats every **8192 ticks = 507.904 default wall seconds**, or **512 nominal seconds**. No regeneration at each wrap was found in the normal update path.

When **change=0**, all 256 entries receive the same vector from the scenario's initial direction and selected magnitude (or zero for strength 0). No RNG direction perturbation is made in that branch.

When **change=c>0**, let `B=[64,32,16,8,4,1][c]`, read from **`0x534718`**. Starting at entry `i=0`, repeat:

```text
end = i + B + (rng() & 31)
if end > 246: end = 256
L = trunc(60*4096/360) = 682
theta = (theta + rng() % (2*L+1) - L) & 4095
fill entries i .. end-1 with magnitude[strength] * (cos(theta), sin(theta))
i = end
```

The angle change is **-682..+682 turn units**, approximately **±59.94140625°**, with modulo bias from the 15-bit PRNG. There is no gradual interpolation in projectile physics: the vector changes at a segment boundary. The final segment is adjusted by the `end>246` rule, so the following interval table describes ordinary nonfinal segments:

| Change | B | Segment entries | Ticks | Nominal seconds (16 ticks/s) | Wall seconds at 62 ms |
| --- | --- | --- | --- | --- | --- |
| 0 | 64, unused | constant entire schedule | — | no changes | no changes |
| 1 | 32 | 32–63 | 1024–2016 | 64–126 | 63.488–124.992 |
| 2 | 16 | 16–47 | 512–1504 | 32–94 | 31.744–93.248 |
| 3 | 8 | 8–39 | 256–1248 | 16–78 | 15.872–77.376 |
| 4 | 4 | 4–35 | 128–1120 | 8–70 | 7.936–69.440 |
| 5 | 1 | 1–32 | 32–1024 | 2–64 | 1.984–63.488 |

Evidence excerpt:

```asm
4121fa  call 0x411fc0
4121ff  and  eax,0x1f
412205  mov  ecx,DWORD PTR [edx*4+0x534718]
41220c  add  ecx,eax
41220e  add  ecx,DWORD PTR [ebp-0x18]
412214  cmp  DWORD PTR [ebp-0x8],0xf6
41221d  mov  DWORD PTR [ebp-0x8],0x100
412224  call 0x411fc0
41222c  lea  ecx,[edx+edx*1+0x1]      ; 2*682 + 1
412231  idiv ecx
412236  add  eax,edx
412238  sub  eax,DWORD PTR [ebp-0x1c] ; subtract 682
41223b  and  eax,0xfff
; 412258–28c: sine/cosine components; 4122a8/b5: write wind table
```

The schedule is **precomputed from the shared PRNG**, not fresh per-frame noise or a randomized strength walk. Wraparound can introduce a different jump between the last and first segments; it is not constrained by a new ±60° draw at that boundary.

### 6.4 Extra wind and remaining wind limits

The integrator also adds two i32 globals **`0x23973e8` / `0x23973ec`** to the table vector. Setup zeroes them (`0x4122cb–0x4122d5`). A timed effect generates additional sine/cosine components with magnitude **175** at `0x40b524–0x40b541` and `0x40bdd5–0x40bdf1`, writes displayed strength **7** (`0x40b55c`), then restores/clears state (`0x40be18–0x40be3b`). The extra-vector mechanics are **H**; matching this effect's name specifically to “Hurricane” is **M**. This is a **vector addition**, so table magnitude need not equal the total air velocity during that effect.

The full animation/filtering of the red/blue compass arrows and every scenario's seed/configuration were not recovered. They do not alter the established ordinary projectile/wind arithmetic. No current runtime save state, initial seed or observed trajectory was claimed.

## 7. Verification, limitations and implications for earlier research

The extraction was checked against **all 20 weapon slots**, **all 28 impact records**, the known prior price/reload tables, raw reads at each declared address, and the reader disassembly. The program rejects any other executable hash, checks section-backed bounds and never imports the input as a library. Validation included malformed/truncated headers, unmapped virtual-address rejection, the `.rsrc` mapping exception, and deterministic repeated JSON output. These verify the extractor and transcription, **not gameplay by execution**.

The result answers the main open questions with the following distinctions:

- **Recovered with H static evidence:** table values, primary salvo counts and Hellfire interval, C/M drag arithmetic, scenario gravity, tick divisor, native/world coordinate conversion, launch vector, ordinary charge limits, ballista elevation exception, angular scatter, direct damage, building splash/falloff, half-HP weapon loss, rocket children, Zeppelin bomb row, and normal wind setup/schedule.
- **Inferred/M:** physical “mass” terminology, basic/royal support assignment per named weapon, several research/spell names for flags, precise interpretation of the splash obstruction helper, and secondary ground effects. All are explicitly separated from the arithmetic they do establish.
- **Unverified/U:** metres or kilograms, the purpose of the dead-loaded `0x534a98` flag and zero/padding fields, generic firing use of transport-balloon placeholders, a universal metric range bound, all fire propagation/timing rules, complete collision/material behavior, and equivalence to the installed executable's code. These are not filled with design guesses.

This corrects four consequential prior leads without editing their source files: the `0x534a7c` boundary was false; `0x534ae8` is camera shake; ground weapons fail below half of their support HP; and ordinary range is charge/speed rather than a metres-per-dial elevation lookup. The original model is also quadratic drag in all three axes, not the current DESIGN's horizontal-only linear drag. The values are research evidence, not an instruction to copy the original code or change the new game's tuning.

## 8. Fifteen-line constants summary

1. **[H]** Default tick divisor = **62 ms**; input paths can select **66/33/10 ms**; nominal timer second = **16 ticks**.
2. **[H]** Position scale = **5/256 world units/native unit**; **[U]** world units equal metres.
3. **[H]** Scenario gravity = stored i16; custom generation **33 + rng()%8**, hence **33–40 units/tick²**.
4. **[H]** At 62 ms, custom gravity = **167.672021–203.238814 world units/s²**; nominal 16-tick scale = **165–200**.
5. **[H]** Drag = relative-speed quadratic C/M rule with **65536 divisor** and **32768 rounding bias**, including Y drag.
6. **[H]** Ordinary launch speed = **K×charge**, charge **1–255**; Cannon K=**40**, Catapult K=**60**.
7. **[H]** Aim storage = **720 half-step azimuth settings**; sine table = **4096 samples/amplitude**; conversions **91/16** and **11×elevation code**.
8. **[H]** Typical pitches: Catapult **36.738281°**, Cannon **21.269531°**; Ballista codes **5–65**, initialized charge **127**.
9. **[H]** Scatter S: Catapult **16**, Cannon **11**, Ballista **8**, Rocket **20** turn units; flag **0x04** halves S.
10. **[H]** Primary counts: Long John **3**, Trebuchet **5**, Arcaballista **4**, Double cannon **2**, Hellfire **5**; Hellfire spacing **9 ticks**.
11. **[H]** Direct/splash maxima: Catapult **12/10**, Cannon **16/20**, Arcaballista **24/12**, Fat Freda **40/48** defence points.
12. **[H]** Splash radii: Catapult **1024**, Cannon **640**, Fat Freda **1536** native units; linear integer falloff excludes direct-hit building.
13. **[H]** Weapon destruction threshold = support HP **strictly below half**; ground support tables **60/96**, nominal weapon condition **30/48**.
14. **[H]** Rockets: initial speed **1000**, thrust **45**, M=**55+2R**; payload **24/28** damage, radius **1152**; one/four children.
15. **[H]** Wind strengths **0–8 -> 0,10,25,45,70,100,135,175,220**; change bases **64,32,16,8,4,1**, **32 ticks/entry**, **256 entries**, direction steps **±682/4096 turn**.
