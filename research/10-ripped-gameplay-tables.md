<!-- Owns the decoded gameplay tables from the ripped Ballerburg data, the rip/manual/TUNING discrepancy list and the castle-layout conversion notes. Reference only; nothing here is a runtime source. -->
# Ripped gameplay tables, discrepancies and castle layouts

Date: 2026-10-17. Sources: `research/08-iso-formats-and-rip.md`, `assets-ripped/data/gameplay.json`, `assets-ripped/data/layouts/*.json`, `assets-ripped/data/scenarios/*.json`, `assets-ripped/data/levels/*/terrain.json`, `assets-ripped/data/ml_phrasen.txt`, `ml_tooltips.txt`, `assets-ripped/turntables/INVENTORY.md`, `research/06-manual-mechanics.md`, `src/tuning.js`, `docs/DESIGN.md` 2.2/3.5/8.3, `src/contracts.js`. Everything was read as data; no original code was run.

Provenance tags used below: **[exe]** = static table in `Ballerburg.exe` (exact reads, addresses in `gameplay.json`); **[phr]** = string pool text (`ml_phrasen`/`ml_tooltips`); **[mesh]** = my own bounding-box measurement of the OBJ export (1 OBJ unit assumed 1 m, uncalibrated per INVENTORY.md); **[man]** = manual via research/06; **[inf]** = my inference, labelled; **[lead]** = unverified candidate found while checking the exe bytes next to the known tables.

## Headline findings

- The rip contains **no ballistic constants** (no gravity, muzzle speed, drag, wind scale, elevation limits, per-hit damage, blast radius, spread). Report section "Validation and remaining uncertainty" says so explicitly and a search of every decoded data file confirms it. Every `v0`, `k`, `sAzDeg`, `sV`, `direct`, `splash`, `splashRadius`, `elevDeg` and all of `TUNING.wind` / `TUNING.aim` stays a design guess. See section 1.6 for the leads that remain.
- The exe prices are the **with-ammo-workshop** shot costs. The manual and `TUNING.weapons[*].fireCost` are the **without-workshop** values, computed by the HUD as `floor(base*15/10)` (report line "HUD workshop adjustment ... multiplies by 15 and divides by 10"). TUNING has no workshop discount at all.
- Ground-weapon defence in the exe (type 31 = 60, type 32 = 96) is **exactly double** the manual and TUNING (30 and 48). Walls, towers, palace and all houses are identical in exe and manual, so this one is a genuine open conflict.
- Manual typos relative to the exe: windmill defence 4 (exe 24), small tower build time 8 s (exe 18 s). The DE/tooltip fire costs 53/113/23 are stale tooltip text; the HUD formula gives 52/135/22.
- Per-block `cost`/`buildS` in TUNING.blocks are 1 m voxel numbers while the exe prices whole 5 m pieces. A 5 m wall segment of the default castle (3 thick x 6 high = 90 blocks) costs 900 g in TUNING against 100 g in the original. Section 2 gives recalibrated values.
- Castles: 257 template slots (-1..255), 145 non-empty, 9,153 placements, one palace in every non-empty template. Walls use only type ids 0 and 6; ids 1-5 and 7-11 never occur (runtime connection variants). Campaign: `LvC_M_V` with C = 1 Forest, 2 Desert, 3 Ice, 4 Volcano, confirmed by the mission texts in `ml_phrasen`. The Forest mission 1 text (5 farmhouses, 1 windmill, 1 ammo workshop, 1 inn) matches template 1 exactly.

## 1. Tables extracted from the rip

### 1.1 Weapons: static table [exe], one row per weapon id 34-53

Footprint is a side length in 5 m grid cells (ground weapons 3 = 3x3, matching the manual "3x3 squares"; wall/tower weapons 1 = 1x1). "Shot cost (workshop)" is the exe base value; "Shot cost (no workshop)" is `floor(base*15/10)` and equals the manual and TUNING `fireCost`. "Powder" is the exe `powder_coefficient` byte (0 for stone/bolt/fire weapons, >0 for gunpowder weapons). "Proj/shot" is **[lead]**, see 1.6.

| id | name (EN) | TUNING key | mount | build gold | footprint | shot cost (workshop) | shot cost (no workshop) | reload s | powder | proj/shot |
|---|---|---|---|---|---|---|---|---|---|---|
| 34 | Catapult | catapult | ground | 600 | 3 | 35 | 52 | 18 | 0 | 1 |
| 35 | Fire catapult | fire-catapult | ground | 750 | 3 | 100 | 150 | 24 | 0 | 1 |
| 36 | Long John | (variant of catapult) | ground | 600 | 3 | 90 | 135 | 18 | 0 | 3 |
| 37 | Hot Helga | (variant of fire-catapult) | ground | 750 | 3 | 150 | 225 | 24 | 0 | 1 |
| 38 | Trebuchet | trebuchet | ground | 850 | 3 | 150 | 225 | 18 | 0 | 5 |
| 43 | Ballista | ballista | wall/tower | 400 | 1 | 15 | 22 | 15 | 0 | 1 |
| 44 | Fire ballista | (variant of ballista) | wall/tower | 400 | 1 | 100 | 150 | 15 | 0 | 1 |
| 45 | Arcaballista | arcaballista | ground | 850 | 3 | 200 | 300 | 18 | 0 | 4 |
| 46 | Cannon | cannon | wall/tower | 750 | 1 | 60 | 90 | 22 | 1 | 1 |
| 47 | Double cannon | double-cannon | wall/tower | 750 | 1 | 100 | 150 | 22 | 2 | 2 |
| 48 | Quad launcher | (variant of rocket) | wall/tower | 800 | 1 | 300 | 450 | 30 | 1 | 1 |
| 49 | Fat Freda | fat-freda | ground | 850 | 3 | 150 | 225 | 22 | 1 | 1 |
| 50 | Hellfire | hellfire | ground | 850 | 3 | 220 | 330 | 22 | 5 | 5 |
| 51 | Rocket launcher | rocket | wall/tower | 800 | 1 | 100 | 150 | 30 | 1 | 1 |
| 52 | Zeppelin | (not in TUNING) | air | 700 | 4 | 150 | 225 | 1 | 0 | 1 |
| 53 | Transport balloon | (not in TUNING) | air | 0 | 4 | 0 | 0 | 1 | 0 | 1 |

Unnamed/reserved weapon ids 39-42: build 1500, footprint 3, reload 14 s, base shot 10 (15 without workshop), powder 0; never placed in any template, no mesh. Unused slots (probably cut weapons). `Objects/Mun_Moerser` (mortar ammo mesh) hints at a cut mortar.

Not in the exe tables (no data anywhere in the rip): crew size (TUNING `crewSlots` is a pure design number), per-weapon defence for wall-mounted weapons (manual: half of host, TUNING 36), elevation/direction limits, muzzle speed, drift, damage, blast radius, fire damage. Qualitative values are only in the manual (research/06 section 1) and `ml_tooltips.txt`.

Qualitative stats from `ml_tooltips.txt` (static text; tooltips disagree with the manual in places, noted):

| weapon | direct | collateral | accuracy (tooltip) | trajectory (tooltip) | ammo (tooltip) |
|---|---|---|---|---|---|
| Catapult | low | heavy | low | normal | 1 load of rocks, 53 g (stale; HUD 52) |
| Long John | medium | very high | low | high (one tooltip) / medium (another) | 3 loads of rocks, 113 g (stale; HUD 135) |
| Cannon | medium | very low | medium | flat | 1 cannonball, 90 g |
| Double cannon | heavy | low | medium | straight | 2 cannonballs, 150 g |
| Ballista | 3 hits ground a zeppelin | none | high | straight | 1 anti-zeppelin bolt, 23 g (stale; HUD 22) |
| Fire ballista | 1 hit grounds a zeppelin | none | high | straight | 1 burning bolt, 150 g |
| Fire catapult | very low | fire | high | high | 1 fire bomb, 150 g |
| Hot Helga | very light | multiple fires | medium | high | 1 wildfire bomb, 225 g |
| Rocket launcher | heavy | high | low | very high | 1 rocket, 150 g |
| Quad launcher | very heavy | very heavy | very low | very high | 4 rockets, 450 g |
| Trebuchet | light | very heavy | low | medium | 5 loads of rocks, 225 g |
| Arcaballista | very heavy | very low | high | low | 4 wooden bolts, 300 g |
| Fat Freda | very heavy | very heavy | high | high | 1 explosive missile, 225 g |
| Hellfire | heavy | medium | high | straight | 5 cannonballs, 330 g |
| Zeppelin | very heavy | very high | guided | guided | 1 480 lb bomb, 225 g |
| Super weapon | - | - | deadly | - | 90 s build, released automatically |

Tooltip accuracy ranks: high = ballista, fire ballista, fire catapult, Arcaballista, Fat Freda, Hellfire; medium = cannon, double cannon, Hot Helga; low = catapult, Long John, Trebuchet, rocket; very low = quad launcher. TUNING `sAzDeg` mostly follows this (rocket 1.6, catapult 1.0, ballista 0.15) but puts the three "high" ground weapons (Arcaballista 0.6, Hellfire 0.6, Fat Freda 0.3) at or behind the "medium" cannon (0.3), and Fire catapult 0.6 is looser than the cannon. Candidate retune: Arcaballista 0.2, Hellfire 0.25, Fat Freda 0.25, Fire catapult 0.25, cannon 0.4.

### 1.2 Weapon model part names and sizes [mesh]

All under `assets-ripped/meshes/Objects/` (`.obj/.mtl/.json`). Parts are separate models with no serialized joint hierarchy (report: "weapon pieces such as Gestell/Balken/Drehkranz are separate models"). Sizes are W x H x D of each part in OBJ units (assumed metres). Assembled sizes for Kanone and Katapult are from `turntables/INVENTORY.md`.

| id / weapon | frame and moving parts (OBJ names) | ammo / projectile meshes | assembled (INVENTORY) |
|---|---|---|---|
| 34 Catapult | Katapult_Gestell 2.51x2.37x4.62, Katapult_Drehkranz 2.53x0.65x0.65, Katapult_Drehachse 2.09x0.13x0.13, Katapult_Balken 0.70x0.83x2.84 | Mun_Katapult 0.53x0.47x0.49 (+ biome rocks Mun_KatapultWald/Wueste/Eis/Vulkan), stein1 0.58x0.51x0.51 | assembled 2.55 x 3.07 x 5.10 (INVENTORY, 4 parts) |
| 35 Fire catapult | Feuerkatapult_Gestell/Drehkranz/Drehachse/Balken (same sizes as Katapult_*) | Mun_FeuerKatapult 0.53x0.47x0.49, FlammenTopf 0.50x0.42x0.50 |  |
| 36 Long John | LangerFritz_Gestell 2.94x4.52x7.29, LangerFritz_Drehkranz 2.97x0.72x0.72, LangerFritz_Balken 0.80x1.83x5.92 | Mun_LangerFritz 0.53x0.47x0.49 |  |
| 37 Hot Helga | HeisseGina_Gestell 5.17x4.57x9.87, HeisseGina_Drehkranz 1.58x0.81x0.81, HeisseGina_Balken 0.89x1.87x6.27, HeisseGina_Kasten1/2 0.52x1.12x1.10 | Mun_HeisseGina 0.53x0.47x0.49 |  |
| 38 Trebuchet | Trebuchet_Gestell 9.63x5.94x9.88, Trebuchet_Drehkranz 2.83x1.11x1.11, Trebuchet_Balken 1.52x6.22x9.68, Trebuchet_Kiste 1.43x3.28x1.69 | Mun_Trebuchet 0.53x0.47x0.49 |  |
| 43 Ballista | Ballista_Gestell 2.01x1.67x2.01, Ballista_Drehkreuz 0.55x0.54x0.57, Ballista_haken 0.07x0.14x0.59, Ballista_schlitten 2.90x0.57x3.00 | ballista_geschoss 0.23x0.23x1.86, Mun_Ballista 0.38x0.49x2.73 |  |
| 44 Fire ballista | FeuerBallista_Gestell/Drehkreuz/Haken/Schlitten (same sizes as Ballista_*) | Mun_Feuerballista 0.40x0.42x2.54 |  |
| 45 Arcaballista | AtlantischeBallista_Grundkoerper 8.14x1.00x9.88, _Drehkranz 0.53x0.56x1.72, _Rad1..Rad4 0.14x1.36x1.37, _Schiene 0.96x0.87x6.59, _Schlitten 0.79x0.54x4.16 | atlantischeballista_geschoss 0.19x0.22x3.07, Mun_AtlantischeBallista 0.17x0.16x1.74 |  |
| 46 Cannon | Kanone_Gestell 1.55x1.15x2.33, Kanone_Drehkranz 1.43x0.52x0.54, Kanone_Rohr 0.49x0.56x2.26 | kanonenkugel 0.27 sphere, Mun_Kanone 0.25 cube, MuendungsFeuer (muzzle fire, 5.02x5.02x20.3) | assembled 1.55 x 1.41 x 2.64 (INVENTORY, 3 parts) |
| 47 Double cannon | Doppelkanone_Gestell 2.04x1.00x2.24, Doppelkanone_Rohr 2.01x0.57x2.35 | Mun_DoppelKanone 0.25 cube |  |
| 48 Quad launcher | RaketenwerferMKII_Plattform 2.26x1.57x2.27, _Drehkranz 2.33x0.19x0.19, _Gefaess 0.61x0.61x1.25 | RaketeMKII 0.54x0.54x1.74 |  |
| 49 Fat Freda | DickeLuise_Gestell 3.41x2.15x4.24, DickeLuise_Rohr 3.09x1.98x3.60, DickeLuise_Drehrad 0.27x0.83x0.85 | Mun_DickeLuise 0.25 cube |  |
| 50 Hellfire | Hoellenorgel_Gestell 3.01x2.37x5.95, Hoellenorgel_Kanone 0.77x0.77x3.08, Hoellenorgel_Raeder 3.94x2.40x2.41 | Mun_Hoellenorgel 0.25 cube |  |
| 51 Rocket launcher | Raketenwerfer_Gestell 2.09x1.47x2.09, Raketenwerfer_Drehkranz 1.47x0.43x0.39, Raketenwerfer_Gefaess 0.69x0.70x2.01 | Rakete 0.53x0.55x3.73, Mun_Raketenwerfer 0.88x2.34x2.32 |  |
| 52 Zeppelin | Zeppelin_Ballon 4.88x5.13x13.95, Zeppelin_Gondel 3.04x2.54x2.99, Zeppelin_HoehenruderL/R 1.22x0.04x0.56, Zeppelin_SeitenruderO/U, Zeppelin_Propeller 0.62x0.63x0.10, _PropellerL/R | Mun_Zeppelin 0.25 cube |  |
| 17 Super weapon | Buildings/Superwaffe 11.34x7.79x11.39 | Mun_Superwaffe 0.25 cube |  |

Observation [mesh]: the Arcaballista, Trebuchet and Hot Helga frames are 8-10 m long, i.e. 2-3 grid cells at 5 m, consistent with footprint 3 (15 m) only if the pieces are scaled. The catapult is 2.5 x 4.6 m, cannon 1.6 x 2.6 m: the wall weapons are small relative to their 5 m wall pieces, consistent with "hard to spot". Unit scale was never independently calibrated.

### 1.3 Building pieces [exe] + [mesh]

"Defence" is the exe `uint8[34]` table; HP and defence points are the same thing (manual: "number of hits a weapon can take", 0 = destroyed). Build time is seconds [exe int16]. Footprint is a side length in grid cells (palace 4 = 4x4, farmhouse 2 = 2x2). Dimensions are W x H x D of the `_z0` (undamaged) mesh [mesh]; for walls and towers INVENTORY.md gives the same values (5.00 footprint). Damage-state meshes exist as `<name>_z0 .. _z3` (palace has `_z4`), houses also `_ruine`; walls, towers and gate also have `_lp` low-poly twins. Layout count = placements across all templates.

| id | name | internal mesh name(s) | gold | build s | defence pts | footprint | z0 size m [mesh] | placements in layouts |
|---|---|---|---|---|---|---|---|---|
| 0 | Small wall | MauerKlein_0 (6 variants 0,1,2a,2b,3,4) | 100 | 10 | 40 | 1 | 5.0x15.5x5.0 | 4924 (ids 0-5 total; only id 0 occurs) |
| 6 | Big wall | MauerGross_0 (6 variants 0,1,2a,2b,3,4) | 100 | 15 | 60 | 1 | 5.0x20.75x5.0 | 810 (ids 6-11; only id 6 occurs) |
| 12 | Small tower | TurmKlein | 500 | 18 | 72 | 1 | 5.0x19.25x5.0 | 820 |
| 13 | Big tower | TurmGross | 500 | 24 | 96 | 1 | 5.0x25.5x5.0 | 118 |
| 14 | Giant tower | (no mesh identified) | 1200 | 24 | 128 | 2 | - | 0 |
| 15 | Gatehouse | Burgtor (z0-z3, _lp) | 150 | 0 | 96 | 2 | 11.5x26.0x10.03 | 158 |
| 16 | - | (none) | 0 | 0 | 8 | 1 | - | 0 |
| 17 | Super weapon | Superwaffe | 5000 | 90 | 96 | 3 | 11.34x7.79x11.39 | 0 |
| 18 | Farmhouse | bauernhaus (z0-z3, _ruine) | 500 | 9 | 12 | 2 | 7.89x5.51x7.65 | 935 |
| 19 | Inn | Kneipe_z0, kneipe_z1-z3, Kneipe_ruine | 500 | 15 | 20 | 2 | 8.44x5.70x9.59 | 83 |
| 20 | Mason's Yard | steinmetz_z0-z3 | 700 | 15 | 24 | 2 | 8.07x6.49x9.80 | 171 |
| 21 | Ammo workshop | pulverfabrik (z0-z3, _ruine) | 600 | 18 | 24 | 2 | 7.45x5.83x7.95 | 75 |
| 22 | Smithy | schmiede (z0-z3, _ruine) | 700 | 24 | 24 | 2 | 9.16x6.97x8.40 | 247 |
| 23 | - | (no mesh identified) | 1200 | 60 | 48 | 2 | - | 0 |
| 24 | Treasury | schatzkammer (z0-z3, _ruine) | 300 | 15 | 48 | 2 | 8.00x3.00x8.00 | 49 |
| 25 | Windmill | windmuehle_z0-z3 + windmuehle_spitze_z0-z3 (cap) + windrad_z0-z3 (sails, 16.9x16.9x0.63) | 300 | 30 | 24 | 4 | 8.88x7.66x7.69 (body) | 26 |
| 26 | Superbrain | erfinder (z0-z3, _ruine) | 900 | 32 | 32 | 2 | 8.47x7.45x7.65 | 51 |
| 27 | Mage tower | magierturm (z0-z3, _ruine) | 900 | 32 | 64 | 4 | 16.66x22.69x14.06 | 52 |
| 28 | Idol | statue (z0-z3, _ruine) | 700 | 15 | 24 | 2 | 4.39x12.10x4.35 | 42 |
| 29 | Palace | palast_z0-z4, palast_ruine | 2000 | 50 | 200 | 4 | 17.60x25.38x18.04 | 145 |
| 30 | Trampoline | (none) | 0 | 0 | 12 | 4 | - | 0 |
| 31 | Ground weapon (slot A) | (generic) | 0 | 0 | 60 | 3 | - | 0 |
| 32 | Ground weapon (slot B) | (generic) | 0 | 0 | 96 | 3 | - | 0 |
| 33 | Zeppelin (as target) | Zeppelin_* | 0 | 0 | 12 | 4 | see 1.2 | 0 |

Notes:

- Ids 0-5 and 6-11 are six variants each of small/big wall (MauerKlein_0,1,2a,2b,3,4 / MauerGross_0,1,2a,2b,3,4), identical in cost/time/defence. Templates only store id 0 and 6, so the 6 variants are the runtime wall-connection shapes (end, straight, corner, T, ...; report: "final wall-connection variant [is] assigned at runtime"). Variant footprints differ slightly (MauerKlein 2a/3/4 are 5.0x4.0 in plan).
- Gatehouse costs 150 g and has build time 0 in the exe but the manual says it cannot be built; it is placed by templates only (158 placements).
- Wall/tower mesh heights (15.5-25.5 m on a 5 m footprint) are 3-5x the footprint, houses are 3-7 m tall: walls stand roughly three times higher than houses, which is what makes them shields.
- Palace: 200 defence points, destroyed at 0 (manual and exe agree). Every one of the 145 non-empty templates holds exactly one palace.
- Type 23 ("-", 1200 g, 60 s, 48 dp, footprint 2) and 14 (giant tower, never placed) are unused slots. Types 16, 30-33 carry only a defence value (placeholders/targets).
- Treasury: manual and tooltip say it allows more than 2000 gold; the capacity per treasury is not in the rip.

### 1.4 Economy constants

| constant | value | source |
|---|---|---|
| Farmers per farmhouse, max | 10 | [man] EN pp.24,27; [phr] tooltip "limit of 10 farmers per farmhouse" |
| Farmers per new farmhouse at start | 5 | [phr] tutorial 2 text "starting population of 5 farmers" |
| Tax neutral point / farmer growth | tax 40 % keeps population constant; below 40 % grows; above 40 % shrinks; max tax 80 % | [phr] + [man] |
| Palace tax | equals 10 peasants at tax 40 % | [phr] tutorial 2 text |
| Gold per farmer per second | NOT in rip, NOT in manual | UNKNOWN |
| Gold cap without treasury | about 2000 ("allows you to store more than 2000 gold coins") | [phr] tooltip + [man] EN p.39 |
| Treasury capacity bonus; loss fraction when destroyed | NOT decoded ("You've lost $v gold coins" string exists, so loss is computed at runtime) | [phr] |
| Ammo workshop discount | shot cost = floor(base*15/10) without it, i.e. base with it (one third off) | [exe] HUD code 0x45323b |
| Gold gift via transport balloon | 1000 gold, needs treasury | [phr] tooltip |
| Super weapon build | 5000 g, 90 s, 96 dp, footprint 3 | [exe] |
| Starting gold, campaign slots (field inferred) | 129 non-zero values in Lv1-4: median 500; mode 500 (50x), then 300 (14x), 700 (10x), 1000 (9x), 400 (9x), 1500 (6x); range 100-5000; tutorial player 5000, Lv6 slot 0 = 50000 | [inf] `.odn` bytes at +20 (report: "candidates") |
| Tactics preset start gold | 1500 | [man] EN p.13 |
| Gold factor | x1.5 vs 2 enemies, x2.0 vs 3 enemies (Quick/Tactics) | [man] |
| Auto-repair tick | one repair per 2 s | [man] EN p.31 |
| Weapon cap | 2 base; research steps 3/4/6/8 (600/900/1200/1500 g, 30 s) | [man] EN p.52 |
| Hotseat turn | 30 s | [man] |
| Action mode reload | "The fewer weapons a player has left, the faster the weapons will reload"; palaces not to be destroyed | [phr] mode text |
| Research costs | Wall upgrade 700/30 s, Accuracy 500/15 s, Fragment shield 600/20 s, Firewall 600/20 s, weapon upgrades 800/30 s, royal weapons 800/50 s, Zeppelin 400/35 s, Super 4000/90 s | [man] research/06 sec. 7 |
| Mission time limits (examples) | Forest m1 30 min; survival missions 10-20 min; Ice m3 survive 15 min; Desert m6 donate 3000 g within 7 min | [phr] mission texts |

### 1.5 Ballistics, wind, aim: what exists

| quantity | rip value | status |
|---|---|---|
| Gravity | none | UNKNOWN. TUNING 9.81 is a design choice. |
| Muzzle speed / range per weapon | none | UNKNOWN. TUNING `v0`, `k` guesses. |
| Elevation limits | none | UNKNOWN. TUNING `aim.straightElevDeg/lobbedElevDeg` guesses. |
| Range dial | manual only: tutorial values 007/038 -> 048..057; "higher = further" | No unit or limit. TUNING `dialUnitM` 5 m is an inference, untested. |
| Azimuth | 0 = north, values like 353/354, 3 digits | Unit likely degrees, wraparound unknown. |
| Wind | strength 0 in tutorials; custom "Wind strength" and "Change of wind" options exist; wind shown as number mid-compass | No scale. Per-level default wind not decoded (possibly inside `.odn` raw bytes, see section 4). |
| Drift / spread | qualitative only (very low .. enormous) | No numbers. |
| Damage / blast radius | qualitative direct damage and radius per weapon | No numbers. "Damage falls off with distance" (EN p.29). |
| `sinelist.dat` | 4096 int16 samples, amplitude 4096, sample i = round(4096*sin(2*pi*i/4096)) | A fixed-point sine table with 4096 steps per revolution; probably angle math in the engine. Does not say what the angle units of the aim dials are. |
| Reload table | stored value is "shifted left by four" by the game; nominal seconds equal the manual | Nothing more. |
| Projectile mass/size | kanonenkugel 0.27 m sphere, rocks 0.53x0.47x0.49, ballista bolt 1.86 m | Cosmetic only; TUNING `projRadius` 0.15-0.3 is roughly in line (cannonball 0.135 radius, rock 0.25). |

### 1.6 Leads in the exe worth a follow-up static pass [lead]

While verifying the rip I re-read `Ballerburg.exe` (as bytes; file offset = VA - 0x400000 in this PE, and reading `build_cost` at 0x5347e0 reproduces the gameplay table exactly). The 20-entry tables are contiguous: reload at 0x534a0c, powder at 0x534a54, then these further tables, which the decoder did not export:

| VA | bytes (20 entries, weapon index 0 = catapult) | reading |
|---|---|---|
| 0x534a68 | 01 01 03 01 05 01 01 01 01 01 01 04 01 02 01 01 05 01 01 01 | Projectiles per shot: catapult 1, Long John 3, Trebuchet 5, Arcaballista 4, Double cannon 2, Hellfire 5, rest 1. Agrees exactly with the manual ("3 rocks", "5 rocks", "4 stakes", "2 balls", "5 balls"). High confidence. |
| 0x534a7c | 01 01 01 01 04 00 00 00 01 01 01 01 01 01 01 01 01 01 01 01 | Unknown flags/levels table. Candidate: research tier or class. |
| 0x534a90 .. 0x534acc | 00 00 00 00 00 00 01 01 ... 00 00 64 64 00 00 00 64 ... | Sparse 0/1/0x64 (100) tables; 0x64 on a handful of weapons. Candidate: fire/ignition chance or percent modifier. No reading is justified. |
| 0x534ad1 .. 0x534bd0 | 02 02 02 02 00 00 00 01 01 ... 28 28 28 28 28 ... 10 10 10 38 38 10 5f 38 10 ... | Many small per-weapon/per-castle-size tables (0x28 = 40, 0x5f = 95). These are the most likely home of damage / spread / angle constants. Needs disassembly of the reader functions near the reload and shot-cost reads (0x406c88, 0x4248cc). |

Recommendation: one targeted disassembly pass (objdump only, no execution) on the code that reads 0x534a68+ and on the projectile integrator should give gravity, muzzle speed, and wind. This is the only realistic source of ballistic numbers.

## 2. Discrepancies: rip vs manual vs TUNING

Legend: match = all three agree. "Recommended" is the value I suggest `src/tuning.js` use. Confidence in brackets where it is not high.

| item | rip | manual (research/06) | TUNING | recommended | reason |
|---|---|---|---|---|---|
| catapult cost | 600 | 600 | 600 | 600 | match |
| cannon cost | 750 | 750 | 750 | 750 | match |
| double-cannon / fire-catapult cost | 750 / 750 | 750 / 750 | 750 / 750 | keep | match |
| ballista cost | 400 | 400 | 400 | 400 | match |
| rocket cost | 800 | 800 | 800 | 800 | match |
| trebuchet, arcaballista, fat-freda, hellfire cost | 850 each | 850 each | 850 each | keep | match |
| catapult fireCost | 35 workshop / 52 none | 52 (DE 53) | 52 | 52 plus workshop 35 | HUD truncates 1.5x; DE 53 is tooltip rounding. See next row. |
| workshop discount | HUD: floor(base*15/10) without workshop | cost reduced by one third with workshop | none (no discount field) | add `fireCostWorkshop` (rip base) or `workshopMul` 2/3 | TUNING cannot model the Ammo workshop benefit; exe base values are the discounted ones. |
| cannon fireCost | 60 / 90 | 90 | 90 | 90 (60 with workshop) | match, add discount |
| double-cannon fireCost | 100 / 150 | 150 | 150 | 150 (100) | match |
| fire-catapult fireCost | 100 / 150 | 150 | 150 | 150 (100) | match |
| ballista fireCost | 15 / 22 | 22 (DE 23) | 22 | 22 (15) | HUD floor; tooltip text 23 is stale |
| rocket fireCost | 100 / 150 | 150 | 150 | 150 (100) | match |
| trebuchet fireCost | 150 / 225 | 225 | 225 | 225 (150) | match |
| arcaballista fireCost | 200 / 300 | 300 | 300 | 300 (200) | match |
| fat-freda fireCost | 150 / 225 | 225 | 225 | 225 (150) | match |
| hellfire fireCost | 220 / 330 | 330 | 330 | 330 (220) | match |
| Long John fireCost (variant) | 90 / 135 | 135 (DE 113) | not present | 135 (90) | 113 in tooltips/DE is an older balance (113 = 75*1.5); exe base 90 wins. |
| Hot Helga / Quad / Fire ballista fireCost | 150/225, 300/450, 100/150 | 225, 450, 150 | not present | 225 (150), 450 (300), 150 (100) | variants to be added |
| reload s (all) | 18,24,18,24,18,15,15,18,22,22,30,22,22,30 | same | same | keep | match |
| zeppelin reload | 1 (table placeholder) | returns to palace to reload | not present | n/a | zeppelin is a different mechanic |
| small wall/stone hp | 40 | 40 | stone 40 | 40 | match |
| big wall hp (mount) | 60 | 60 | mount 60 | 60 | match |
| small tower hp | 72 | 72 | tower 72 | 72 | match |
| big tower hp | 96 | 96 | not present | add if a big-tower block is wanted | exe only |
| giant tower hp | 128 | not in manual | not present | skip | unused in templates |
| gatehouse hp | 96 | 96 | gate 96 | 96 | match |
| palace dp | 200 | 200 | block 40 x 48 cells, destroyed below 30 % integrity => 1344 hp to remove | core block hp 6 (=> ~200 dp to destroy), or 8 for splash slack [medium] | TUNING makes the keep 6.7x tougher than the original, assuming 24 dp cannon hits. Alternative: keep the block hp and use a separate 200 dp "palace pool". |
| palace destroyed at | 0 dp | 0 dp | < 30 % integrity | keep 0.3 (voxel design) or lower to 0.2 | design divergence, not a data conflict |
| farmhouse hp | 12 | 12 | wood 16 (raised on purpose) | 12 | wood is the only burnable house block; hp 16 not required by data. Keep 16 only if you want slack. |
| inn hp | 20 | 20 | n/a | 20 | - |
| mason / ammo workshop / smithy / idol / windmill hp | 24 / 24 / 24 / 24 / 24 | 24 / 24 / 24 / 24 / **4** | magazine 24 | 24 for all five | manual windmill 4 is a typo (exe 24, and the report table row 25) |
| treasury / superbrain / mage tower hp | 48 / 32 / 64 | 48 / 32 / 64 | n/a | 48 / 32 / 64 | - |
| catapult-class ground weapon hp | 60 (type 31 "ground weapon") | 30 | 30 | 60 [medium] | exe is exactly 2x the manual; every other building matches, so this is a real conflict. Either the manual lists half values for weapons or the engine halves weapon damage. Playtest. |
| royal ground weapon hp | 96 (type 32) | 48 | 48 | 96 [medium] | same |
| wall weapon hp | no data | half of host | 36 | 36 | host tower 72 / 2 |
| super weapon hp | 96 | 96 | n/a | 96 | - |
| small wall build s | 10 | 10 | stone 4 per block | piece 10 s | scale, see below |
| big wall build s | 15 | 15 | mount 5 | piece 15 s | scale |
| small tower build s | **18** | **8** | tower 5 | 18 | manual 8 is a typo (big tower is 24, ratio and report agree) |
| big tower / giant tower build s | 24 / 24 | 24 / n/a | n/a | 24 / 24 | - |
| farmhouse / inn / mason / workshop / smithy / treasury build s | 9/15/15/18/24/15 | same | n/a | keep | - |
| windmill / superbrain / mage / idol / palace build s | 30/32/32/15/50 | 30/32/32/15/- | n/a | keep | palace build time only for completeness |
| unnamed id 23 | 1200 g, 60 s, 48 dp | n/a | n/a | ignore | unused |
| stone cost per block | piece: 100 g for 5x5x15.5 m | 100 g | 10 g/block (wall segment of default castle 90 blocks = 900 g) | 1 g/block (90 blocks ~ 100 g) | TUNING is ~9x the original per wall length. See cost-scale paragraph. |
| tower cost per block | 500 g per piece | 500 | 16 g/block (a default 6x6x11 hollow tower is 220 blocks = 3520 g) | 2 g/block (~440 g) | ~7x too dear |
| mount cost per block | 100 g (big wall piece) | 100 | 12 g/block | 1 g/block | gun platform |
| magazine cost | 600 g (ammo workshop piece, 2x2) | 600 | 20 g/block, 2x2x2 prefab = 160 g | 75 g/block (prefab 8 blocks = 600 g) | TUNING is 3.75x cheaper than the original here (the only block priced below the original) |
| wood cost | 500 g (farmhouse, 2x2) | 500 | 4 g/block | farmhouse prefab 2x2x2 = 8 blocks -> 60 g/block, or keep cheap and price the building | TUNING prices plain wood; the original prices the building. Houses should be prefabs. |
| goldCap | ~2000 without treasury | ~2000 (EN p.39) | 4000 ("doubled") | 2000 base, +treasury (capacity unknown, guess +2000 each) | Nothing in the rip supports doubling; the tooltip and manual both say 2000. |
| startGold | campaign median 500 (mode 500), range 100-5000; tutorial player 5000 | Tactics 1500 | 2000 | per-map value; default 1500 | 2000 is 4x the campaign median; 1500 is the only documented preset. |
| palaceIncomeS | palace = 10 farmers at 40 % tax | - | 6 (guess) vs civilianIncomeS 0.25 | 10 x civilianIncomeS = 2.5 /s | the only hard ratio in the data; with 0.25 per farmer the palace should give 2.5. |
| civilianIncomeS | not decoded | not stated | 0.25 | keep 0.25 [guess] | - |
| weaponCapMin / Max | - | 2 / 8 | 2 / 8 | keep | match |
| weaponCapDefault | Action: 4 (2 foes) or 3 (3 foes) | Tactics preset cap not stated | 4 | keep | - |
| hotseatTurnS | - | 30 | 30 | keep | match |
| farmer start / max per house | 5 / 10 | - / 10 | population 40 default | keep | population 40 is in the 2-8 house range at 5-10 farmers |
| palace footprint | 4 (4x4 cells) | "4x4" | 4x4x3 core | keep | match |
| ground weapon footprint | 3 | 3x3 | [3,3,2] | keep | match |
| wall weapon footprint | 1 | 1x1 | [1,1,1] | keep | match |
| projectiles per shot | Long John 3, Trebuchet 5, Arca 4, Double 2, Hellfire 5 [lead] | same | trebuchet 5, arca 4, double 2, hellfire 5 | keep | match |
| gravity, v0, k, scatter, direct, splash, splashRadius, elevDeg, wind speeds, aim units | absent | absent (qualitative only) | all guesses | keep as guesses | no contradiction possible. Preserve qualitative ordering from tooltips (section 1.1). |

**Cost-scale paragraph.** Two scales collide. The exe prices a 5 m piece (wall 5x5x15.5 m = 100 g; tower 500 g; farmhouse 2x2 cells = 500 g; palace 4x4 = 2000 g); TUNING prices 1 m blocks, and the default castle is built from hundreds of them. If the economy (income, ammo 52-330 g, start gold 500-2000) is to keep the original ratios, a repair or rebuild of a 5 m wall segment must cost on the order of 100 g, so stone costs ~1 g per block, towers ~2, mounts ~1, and houses/magazine are cheaper to price as whole prefabs (farmhouse 500 g, ammo workshop 600 g, smithy 700 g, mason 700 g, treasury 300 g, inn 500 g, superbrain 900 g, windmill 300 g, idol 700 g). Build times follow the same logic: 10 s for a 90-block wall segment means ~0.1 s per block with a single builder, so `buildS` per block should drop to ~0.1-0.5 with NPC crews supplying parallelism. These are recommendations for an orchestrator decision, not rip facts.

## 3. Castle layouts

### 3.1 Inventory

- 257 template files `layouts/plateau.N.json` (+ a 32x32 PNG index each): ids -1 and 0..255. Source `Data/Plateaus/plateau.N`.
- 145 non-empty (9,153 placements total), 112 empty (ids -1, 63, 90-98, 104-108, 111-149 except 140, 158-166, 174-179, 181-189, 192-198, 205-209, 215-219, 225-229, 235-239, 242-247, 255); the empty ids come in aligned runs of about five, so they look like reserved or generated slots.
- 112 distinct ids are referenced by the 74 scenario records (255 = no castle in that slot). 108 referenced ids are non-empty; the referenced-but-empty ids are 104, 105, 106 (Lv3_3_2) and 215 (Lv5_13_1): those slots get a castle some other way (runtime/random/user layout) [inf].
- 37 non-empty templates are never referenced by a scenario: 87, 89, 99-103, 109, 110, 172, 190, 191, 199-204, 210, 211, 213, 214, 221-224, 230-234, 240, 241, 248, 249, 251, 252. Probable pools for Quick/Tactics/Strategy/Action and random games [inf].
- Names: none. Templates are numbered only; "castle names" are not in the rip. Scenarios (`.odn`) and mission texts (`ml_phrasen`) name campaign, mission and enemy princess.
- Grid: coordinates 0..31 in x, 0..23 in z observed (5-bit fields, plateau is a 32 x 24 cell area, 160 x 120 m at 5 m cells). The PNG index is 32x32.

### 3.2 Placement record

One little-endian u32 per record, terminated by `0xffffffff` (`0xfffffffe` = deleted). JSON shape:

```json
{"index": 0, "raw_hex": "00230430", "type_id": 35, "label": "Fire catapult", "grid_x": 1, "grid_z": 3, "orientation": 0, "unused_bits": 0}
```

Bits: 0-1 orientation (0-3), 4-8 grid_z, 10-14 grid_x, 16-21 type (0-63, name at phrase index type+8), all else unused (all 9,153 records have unused_bits = 0). Orientation histogram over all records: 0 = 6132, 2 = 1964, 3 = 577, 1 = 480. Sign/zero direction not established. No height: everything sits on the plateau.

**Anchor convention (verified by me on template 0).** `(grid_x, grid_z)` is the minimum corner of a `footprint x footprint` square. Template 0: palace (footprint 4) at (15,12) covers x 15-18, z 12-15; the four small towers (footprint 1) sit at (14,11), (19,11), (19,16), (14,16), i.e. exactly the cells around that square. The only footprint overlap in the whole template is the cannon on the tower at (19,11): wall weapons share the cell of their host wall/tower. This is consistent with the manual (wall weapons stand on a wall or tower).

| type | name | placements |
|---|---|---|
| 0 | Small wall | 4924 |
| 6 | Big wall | 810 |
| 12 | Small tower | 820 |
| 13 | Big tower | 118 |
| 15 | Gatehouse | 158 |
| 18 | Farmhouse | 935 |
| 19 | Inn | 83 |
| 20 | Mason's Yard | 171 |
| 21 | Ammo workshop | 75 |
| 22 | Smithy | 247 |
| 24 | Treasury | 49 |
| 25 | Windmill | 26 |
| 26 | Superbrain | 51 |
| 27 | Mage tower | 52 |
| 28 | Idol | 42 |
| 29 | Palace | 145 |
| 34 | Catapult | 104 |
| 35 | Fire catapult | 8 |
| 36 | Long John | 78 |
| 37 | Hot Helga | 3 |
| 38 | Trebuchet | 24 |
| 43 | Ballista | 3 |
| 45 | Arcaballista | 6 |
| 46 | Cannon | 129 |
| 47 | Double cannon | 78 |
| 49 | Fat Freda | 6 |
| 50 | Hellfire | 7 |
| 51 | Rocket launcher | 1 |

Never placed: giant tower (14), id 16, 17 super weapon, 23, 30-33, zeppelin/balloon, Fire ballista (44), Quad launcher (48). Weapons that do appear: catapult, fire catapult, Long John, Hot Helga, Trebuchet, Ballista, Arcaballista, Cannon, Double cannon, Fat Freda, Hellfire, Rocket launcher. Walls: 4,924 small + 810 big; towers 820 small + 118 big; 158 gatehouses.

### 3.3 Campaigns, missions, biomes

Scenario file `LvC_M_V.odn`: **C** = campaign (1 Forest "G", 2 Desert "Y", 3 Ice "B", 4 Volcano "R"; verified by the mission texts whose colour codes and princess names match), **M** = mission 1..8 (Lv3 has a 9th record that reuses mission 8 data), **V** = variant (_2 = a second stage of the same mission with different gold/level). The mission text for each is in `ml_phrasen.txt` lines 653-692 (objectives, restrictions, time limit). Campaign 5-8 files (`Lv5_*`..`Lv8_*`) have no campaign text: Lv5 looks like tutorials/special missions (Lv5_10_1 == Lv1_1_1 data; tutorials are "Forest Princess" scripted) [inf], Lv6 has 50000 gold for slot 0 (looks like Action mode) [inf], Lv7/Lv8 use template 0 or none (likely Quick/Tactics/Strategy/user presets filled at runtime) [inf].

**Biome.** The rip has five building-texture themes (Grass, Wueste, Schnee, Vulkan, Alien) and five ground sets (`BodenSet_*`), plus 28 terrain levels (`Level00..27`: 128x128 height `.pln`, tile words, tree density `.tre`, `.alp`, `.hmm`, `.him`). The scenario byte 1 ("theme", values 0-3) is **not** resolved to a biome: Forest mission 1 against the Ice princess has theme 0, Forest mission 2 has theme 2, Volcano mission 7 (night level) theme 2 and Ice mission 5 (night) theme 0, so it is not simply campaign, not night, not obviously Grass/Wueste/Schnee/Vulkan [inf]. The campaign-to-biome mapping is therefore from campaign names only (Forest = Grass, Desert = Wueste, Ice = Schnee, Volcano = Vulkan), as research/06 section 8 already says. Per-level terrain data is in 3.5.

### 3.4 Scenario table (all 74)

`level` = terrain `LevelNN`; `theme` = byte 1; slots show `template id (pieces)`; 255 = none; `gold` = candidate starting gold per slot (field identification inferred).

| scenario | campaign | mission | var | level | theme | slot templates (pieces) | gold |
|---|---|---|---|---|---|---|---|
| Lv0_0_1 | special (Lv0) | 0 | 1 | 8 | 0 | 0 (17), 0 (17), 0 (17), 0 (17) | [2000, 2000, 2000, 2000] |
| Lv1_1_1 | Forest | 1 | 1 | 0 | 0 | 0 (17), 255, 255, 1 (55) | [5000, 0, 0, 500] |
| Lv1_2_1 | Forest | 2 | 1 | 2 | 2 | 255, 3 (54), 2 (56), 255 | [0, 750, 1500, 0] |
| Lv1_3_1 | Forest | 3 | 1 | 5 | 0 | 4 (54), 255, 5 (63), 255 | [1000, 0, 400, 0] |
| Lv1_4_1 | Forest | 4 | 1 | 1 | 0 | 6 (89), 255, 255, 7 (57) | [500, 0, 0, 500] |
| Lv1_4_2 | Forest | 4 | 2 | 3 | 1 | 255, 6 (89), 7 (57), 255 | [0, 2000, 1500, 0] |
| Lv1_5_1 | Forest | 5 | 1 | 15 | 0 | 8 (51), 255, 9 (93), 255 | [600, 0, 250, 0] |
| Lv1_6_1 | Forest | 6 | 1 | 19 | 3 | 10 (126), 255, 255, 11 (72) | [300, 0, 0, 700] |
| Lv1_7_1 | Forest | 7 | 1 | 0 | 3 | 255, 12 (100), 13 (82), 14 (66) | [0, 100, 700, 500] |
| Lv1_8_1 | Forest | 8 | 1 | 12 | 0 | 15 (110), 16 (105), 18 (86), 17 (91) | [1000, 500, 300, 300] |
| Lv2_1_1 | Desert | 1 | 1 | 8 | 0 | 19 (41), 255, 255, 20 (62) | [800, 0, 0, 300] |
| Lv2_1_2 | Desert | 1 | 2 | 8 | 0 | 19 (41), 255, 255, 20 (62) | [300, 0, 0, 200] |
| Lv2_2_1 | Desert | 2 | 1 | 12 | 1 | 23 (52), 21 (69), 24 (53), 22 (14) | [700, 800, 5000, 100] |
| Lv2_3_1 | Desert | 3 | 1 | 9 | 0 | 27 (60), 25 (55), 26 (62), 255 | [500, 500, 500, 0] |
| Lv2_3_2 | Desert | 3 | 2 | 10 | 0 | 55 (65), 56 (79), 255, 57 (53) | [500, 500, 0, 500] |
| Lv2_4_1 | Desert | 4 | 1 | 14 | 3 | 28 (51), 29 (65), 30 (54), 31 (64) | [500, 500, 500, 300] |
| Lv2_4_2 | Desert | 4 | 2 | 14 | 3 | 28 (51), 29 (65), 30 (54), 31 (64) | [500, 500, 500, 500] |
| Lv2_5_1 | Desert | 5 | 1 | 17 | 0 | 32 (71), 255, 255, 33 (74) | [400, 0, 0, 800] |
| Lv2_5_2 | Desert | 5 | 2 | 17 | 0 | 32 (71), 255, 255, 33 (74) | [700, 0, 0, 500] |
| Lv2_6_1 | Desert | 6 | 1 | 18 | 0 | 34 (47), 35 (55), 36 (40), 255 | [600, 500, 500, 0] |
| Lv2_6_2 | Desert | 6 | 2 | 18 | 0 | 34 (47), 35 (55), 36 (40), 255 | [500, 500, 500, 0] |
| Lv2_7_1 | Desert | 7 | 1 | 21 | 0 | 37 (33), 255, 255, 38 (47) | [300, 0, 0, 400] |
| Lv2_8_1 | Desert | 8 | 1 | 26 | 3 | 40 (60), 41 (65), 42 (57), 39 (44) | [500, 500, 500, 500] |
| Lv2_8_2 | Desert | 8 | 2 | 26 | 0 | 72 (61), 73 (84), 74 (41), 71 (45) | [650, 600, 600, 600] |
| Lv3_1_1 | Ice | 1 | 1 | 17 | 0 | 43 (68), 44 (45), 45 (55), 255 | [500, 200, 400, 0] |
| Lv3_2_1 | Ice | 2 | 1 | 3 | 0 | 46 (63), 47 (59), 49 (58), 48 (54) | [600, 400, 400, 600] |
| Lv3_2_2 | Ice | 2 | 2 | 3 | 0 | 46 (63), 255, 255, 48 (54) | [500, 0, 0, 300] |
| Lv3_3_1 | Ice | 3 | 1 | 15 | 1 | 51 (39), 53 (65), 52 (48), 50 (49) | [700, 300, 300, 500] |
| Lv3_3_2 | Ice | 3 | 2 | 14 | 2 | 105 (0), 106 (0), 104 (0), 255 | [3000, 1200, 1200, 1000] |
| Lv3_4_1 | Ice | 4 | 1 | 16 | 3 | 255, 55 (65), 54 (53), 56 (79) | [0, 400, 400, 300] |
| Lv3_5_1 | Ice | 5 | 1 | 26 | 0 | 57 (53), 58 (56), 255, 255 | [400, 500, 0, 0] |
| Lv3_5_2 | Ice | 5 | 2 | 26 | 0 | 57 (53), 58 (56), 255, 255 | [300, 500, 0, 0] |
| Lv3_6_1 | Ice | 6 | 1 | 25 | 0 | 59 (53), 255, 60 (63), 61 (38) | [1500, 0, 300, 200] |
| Lv3_7_1 | Ice | 7 | 1 | 21 | 0 | 65 (86), 255, 255, 66 (97) | [1000, 0, 0, 1000] |
| Lv3_8_1 | Ice | 8 | 1 | 24 | 0 | 62 (65), 255, 62 (65), 64 (76) | [700, 0, 500, 500] |
| Lv3_9_1 | Ice | 9 | 1 | 24 | 0 | 62 (65), 255, 62 (65), 64 (76) | [700, 0, 500, 500] |
| Lv4_1_1 | Volcano | 1 | 1 | 10 | 0 | 67 (66), 255, 68 (71), 69 (22) | [800, 0, 500, 500] |
| Lv4_1_2 | Volcano | 1 | 2 | 4 | 0 | 67 (66), 255, 68 (71), 69 (22) | [1000, 0, 500, 500] |
| Lv4_2_1 | Volcano | 2 | 1 | 4 | 0 | 70 (83), 255, 71 (45), 72 (61) | [1000, 0, 500, 500] |
| Lv4_3_1 | Volcano | 3 | 1 | 15 | 0 | 73 (84), 255, 74 (41), 75 (53) | [300, 0, 700, 700] |
| Lv4_4_1 | Volcano | 4 | 1 | 23 | 1 | 77 (47), 76 (42), 255, 255 | [200, 700, 0, 0] |
| Lv4_5_1 | Volcano | 5 | 1 | 22 | 1 | 255, 79 (69), 255, 78 (68) | [0, 200, 0, 1000] |
| Lv4_5_2 | Volcano | 5 | 2 | 22 | 1 | 255, 79 (69), 255, 78 (68) | [0, 200, 0, 1000] |
| Lv4_6_1 | Volcano | 6 | 1 | 21 | 2 | 80 (81), 255, 81 (93), 82 (69) | [1500, 0, 1800, 1500] |
| Lv4_6_2 | Volcano | 6 | 2 | 21 | 2 | 80 (81), 255, 81 (93), 82 (69) | [500, 0, 1200, 500] |
| Lv4_7_1 | Volcano | 7 | 1 | 26 | 2 | 83 (74), 84 (76), 85 (81), 255 | [500, 500, 1200, 0] |
| Lv4_8_1 | Volcano | 8 | 1 | 24 | 2 | 86 (81), 82 (69), 88 (144), 80 (81) | [500, 500, 1500, 500] |
| Lv5_1_1 | special (Lv5) | 1 | 1 | 18 | 0 | 253 (12), 255, 255, 253 (12) | [5000, 0, 0, 500] |
| Lv5_1_2 | special (Lv5) | 1 | 2 | 8 | 0 | 253 (12), 255, 255, 253 (12) | [500, 0, 0, 500] |
| Lv5_2_1 | special (Lv5) | 2 | 1 | 0 | 0 | 167 (73), 255, 255, 170 (73) | [500, 500, 500, 500] |
| Lv5_3_1 | special (Lv5) | 3 | 1 | 0 | 0 | 168 (74), 255, 170 (73), 170 (73) | [1000, 500, 500, 500] |
| Lv5_4_1 | special (Lv5) | 4 | 1 | 0 | 0 | 173 (11), 255, 171 (9), 171 (9) | [750, 500, 500, 500] |
| Lv5_5_1 | special (Lv5) | 5 | 1 | 0 | 0 | 167 (73), 255, 255, 170 (73) | [500, 500, 500, 500] |
| Lv5_6_1 | special (Lv5) | 6 | 1 | 0 | 0 | 168 (74), 255, 170 (73), 170 (73) | [1000, 500, 500, 500] |
| Lv5_7_1 | special (Lv5) | 7 | 1 | 0 | 0 | 169 (75), 170 (73), 170 (73), 170 (73) | [2000, 500, 500, 500] |
| Lv5_8_1 | special (Lv5) | 8 | 1 | 0 | 0 | 254 (98), 255, 255, 154 (56) | [500, 0, 0, 500] |
| Lv5_9_1 | special (Lv5) | 9 | 1 | 21 | 0 | 250 (105), 255, 255, 250 (105) | [0, 0, 0, 0] |
| Lv5_10_1 | special (Lv5) | 10 | 1 | 0 | 0 | 0 (17), 255, 255, 1 (55) | [5000, 0, 0, 500] |
| Lv5_11_1 | special (Lv5) | 11 | 1 | 21 | 0 | 180 (108), 180 (108), 180 (108), 180 (108) | [3000, 1500, 1500, 1500] |
| Lv5_12_1 | special (Lv5) | 12 | 1 | 18 | 0 | 140 (105), 140 (105), 140 (105), 140 (105) | [5000, 10000, 10000, 10000] |
| Lv5_13_1 | special (Lv5) | 13 | 1 | 27 | 0 | 215 (0), 180 (108), 180 (108), 212 (116) | [500, 0, 0, 500] |
| Lv6_1_1 | special (Lv6) | 1 | 1 | 0 | 0 | 150 (38), 255, 151 (37), 255 | [50000, 0, 500, 0] |
| Lv6_1_2 | special (Lv6) | 1 | 2 | 2 | 0 | 253 (12), 253 (12), 253 (12), 253 (12) | [1000, 1000, 1000, 1000] |
| Lv6_2_1 | special (Lv6) | 2 | 1 | 0 | 0 | 153 (8), 255, 255, 152 (24) | [50000, 0, 0, 500] |
| Lv6_3_1 | special (Lv6) | 3 | 1 | 0 | 0 | 154 (56), 156 (4), 155 (5), 157 (6) | [50000, 500, 500, 500] |
| Lv7_1_1 | special (Lv7) | 1 | 1 | 0 | 0 | 0 (17), 0 (17), 0 (17), 0 (17) | [0, 0, 0, 0] |
| Lv7_1_2 | special (Lv7) | 1 | 2 | 7 | 0 | 220 (84), 2 (56), 1 (55), 3 (54) | [200, 5000, 5000, 5000] |
| Lv7_2_1 | special (Lv7) | 2 | 1 | 0 | 0 | 0 (17), 0 (17), 0 (17), 0 (17) | [0, 0, 0, 0] |
| Lv7_3_1 | special (Lv7) | 3 | 1 | 0 | 0 | 0 (17), 0 (17), 0 (17), 0 (17) | [1500, 1500, 1500, 1500] |
| Lv7_4_1 | special (Lv7) | 4 | 1 | 0 | 0 | 0 (17), 0 (17), 0 (17), 0 (17) | [500, 500, 500, 500] |
| Lv8_1_1 | special (Lv8) | 1 | 1 | 0 | 0 | 0 (17), 0 (17), 0 (17), 0 (17) | [0, 0, 0, 0] |
| Lv8_2_1 | special (Lv8) | 2 | 1 | 0 | 0 | 0 (17), 0 (17), 0 (17), 0 (17) | [1500, 1500, 1500, 1500] |
| Lv8_3_1 | special (Lv8) | 3 | 1 | 0 | 0 | 0 (17), 0 (17), 0 (17), 0 (17) | [1500, 1500, 1500, 1500] |
| Lv8_4_1 | special (Lv8) | 4 | 1 | 0 | 0 | 0 (17), 0 (17), 0 (17), 0 (17) | [500, 500, 500, 500] |

### 3.5 Terrain sets (28 levels) [exe/rip]

Heights are the stored int16 (the game negates them; real-world scale not established). `tiles` = distinct terrain tile indices used. `used by` = scenarios whose level byte equals this level.

| level | grid | min h | max h | tiles | used by |
|---|---|---|---|---|---|
| Level00 | 128x128 | 1007 | 6818 | 92 | Lv1_1_1, Lv1_7_1, Lv5_2_1, Lv5_3_1, Lv5_4_1, Lv5_5_1 ...(21) |
| Level01 | 128x128 | 0 | 10010 | 89 | Lv1_4_1 |
| Level02 | 128x128 | 0 | 10445 | 75 | Lv1_2_1, Lv6_1_2 |
| Level03 | 128x128 | -521 | 10680 | 93 | Lv1_4_2, Lv3_2_1, Lv3_2_2 |
| Level04 | 128x128 | 0 | 13890 | 58 | Lv4_1_2, Lv4_2_1 |
| Level05 | 128x128 | -1102 | 7430 | 71 | Lv1_3_1 |
| Level06 | 128x128 | 0 | 20478 | 78 | - |
| Level07 | 128x128 | -806 | 11863 | 77 | Lv7_1_2 |
| Level08 | 128x128 | 0 | 8003 | 67 | Lv0_0_1, Lv2_1_1, Lv2_1_2, Lv5_1_2 |
| Level09 | 128x128 | 0 | 14892 | 57 | Lv2_3_1 |
| Level10 | 128x128 | 0 | 5765 | 48 | Lv2_3_2, Lv4_1_1 |
| Level11 | 128x128 | 0 | 6515 | 56 | - |
| Level12 | 128x128 | 0 | 1841 | 36 | Lv1_8_1, Lv2_2_1 |
| Level13 | 128x128 | 0 | 17783 | 88 | - |
| Level14 | 128x128 | -429 | 4154 | 44 | Lv2_4_1, Lv2_4_2, Lv3_3_2 |
| Level15 | 128x128 | -265 | 8389 | 52 | Lv1_5_1, Lv3_3_1, Lv4_3_1 |
| Level16 | 128x128 | 0 | 6240 | 63 | Lv3_4_1 |
| Level17 | 128x128 | 0 | 14023 | 51 | Lv2_5_1, Lv2_5_2, Lv3_1_1 |
| Level18 | 128x128 | 0 | 17142 | 48 | Lv2_6_1, Lv2_6_2, Lv5_1_1, Lv5_12_1 |
| Level19 | 128x128 | 0 | 4468 | 45 | Lv1_6_1 |
| Level20 | 128x128 | 0 | 28723 | 82 | - |
| Level21 | 128x128 | 0 | 7386 | 40 | Lv2_7_1, Lv3_7_1, Lv4_6_1, Lv4_6_2, Lv5_9_1, Lv5_11_1 |
| Level22 | 128x128 | 0 | 9164 | 36 | Lv4_5_1, Lv4_5_2 |
| Level23 | 128x128 | -498 | 13192 | 58 | Lv4_4_1 |
| Level24 | 128x128 | 0 | 3997 | 53 | Lv3_8_1, Lv3_9_1, Lv4_8_1 |
| Level25 | 128x128 | 1111 | 8604 | 51 | Lv3_6_1 |
| Level26 | 128x128 | 0 | 7655 | 51 | Lv2_8_1, Lv2_8_2, Lv3_5_1, Lv3_5_2, Lv4_7_1 |
| Level27 | 128x128 | -130 | 12745 | 93 | Lv5_13_1 |

### 3.6 Template statistics (145 non-empty)

`walls` = types 0+6, `towers` = 12+13, `weap` = weapon types 34-51, `houses` = all other buildings except palace and gatehouse. `used by` = scenario count. Ids not listed are empty.

| id | pieces | walls | towers | gate | weap | houses | used by |
|---|---|---|---|---|---|---|---|
| 0 | 17 | 0 | 4 | 0 | 3 | 9 | Lv0_0_1, Lv1_1_1, Lv5_10_1 +8 |
| 1 | 55 | 39 | 5 | 1 | 1 | 8 | Lv1_1_1, Lv5_10_1, Lv7_1_2 |
| 2 | 56 | 35 | 9 | 1 | 2 | 8 | Lv1_2_1, Lv7_1_2 |
| 3 | 54 | 37 | 5 | 3 | 1 | 7 | Lv1_2_1, Lv7_1_2 |
| 4 | 54 | 32 | 8 | 3 | 2 | 8 | Lv1_3_1 |
| 5 | 63 | 44 | 6 | 3 | 1 | 8 | Lv1_3_1 |
| 6 | 89 | 65 | 5 | 2 | 4 | 12 | Lv1_4_1, Lv1_4_2 |
| 7 | 57 | 39 | 5 | 1 | 3 | 8 | Lv1_4_1, Lv1_4_2 |
| 8 | 51 | 40 | 4 | 1 | 1 | 4 | Lv1_5_1 |
| 9 | 93 | 69 | 6 | 2 | 2 | 13 | Lv1_5_1 |
| 10 | 126 | 92 | 20 | 1 | 1 | 11 | Lv1_6_1 |
| 11 | 72 | 52 | 4 | 1 | 3 | 11 | Lv1_6_1 |
| 12 | 100 | 82 | 4 | 3 | 0 | 10 | Lv1_7_1 |
| 13 | 82 | 60 | 6 | 1 | 3 | 11 | Lv1_7_1 |
| 14 | 66 | 48 | 4 | 1 | 2 | 10 | Lv1_7_1 |
| 15 | 110 | 72 | 20 | 1 | 3 | 13 | Lv1_8_1 |
| 16 | 105 | 80 | 10 | 1 | 2 | 11 | Lv1_8_1 |
| 17 | 91 | 66 | 8 | 2 | 3 | 11 | Lv1_8_1 |
| 18 | 86 | 64 | 7 | 1 | 2 | 11 | Lv1_8_1 |
| 19 | 41 | 28 | 4 | 1 | 1 | 6 | Lv2_1_1, Lv2_1_2 |
| 20 | 62 | 47 | 5 | 1 | 1 | 7 | Lv2_1_1, Lv2_1_2 |
| 21 | 69 | 54 | 4 | 3 | 1 | 6 | Lv2_2_1 |
| 22 | 14 | 0 | 0 | 0 | 0 | 13 | Lv2_2_1 |
| 23 | 52 | 36 | 4 | 1 | 0 | 10 | Lv2_2_1 |
| 24 | 53 | 36 | 6 | 1 | 1 | 8 | Lv2_2_1 |
| 25 | 55 | 40 | 4 | 3 | 1 | 6 | Lv2_3_1 |
| 26 | 62 | 44 | 4 | 2 | 1 | 10 | Lv2_3_1 |
| 27 | 60 | 38 | 6 | 2 | 2 | 11 | Lv2_3_1 |
| 28 | 51 | 36 | 5 | 1 | 0 | 8 | Lv2_4_1, Lv2_4_2 |
| 29 | 65 | 46 | 8 | 1 | 1 | 8 | Lv2_4_1, Lv2_4_2 |
| 30 | 54 | 36 | 6 | 1 | 1 | 9 | Lv2_4_1, Lv2_4_2 |
| 31 | 64 | 45 | 7 | 1 | 1 | 9 | Lv2_4_1, Lv2_4_2 |
| 32 | 71 | 54 | 4 | 1 | 2 | 9 | Lv2_5_1, Lv2_5_2 |
| 33 | 74 | 43 | 8 | 1 | 2 | 19 | Lv2_5_1, Lv2_5_2 |
| 34 | 47 | 34 | 4 | 0 | 1 | 7 | Lv2_6_1, Lv2_6_2 |
| 35 | 55 | 36 | 6 | 0 | 2 | 10 | Lv2_6_1, Lv2_6_2 |
| 36 | 40 | 27 | 3 | 0 | 1 | 8 | Lv2_6_1, Lv2_6_2 |
| 37 | 33 | 12 | 9 | 0 | 2 | 9 | Lv2_7_1 |
| 38 | 47 | 22 | 12 | 1 | 2 | 9 | Lv2_7_1 |
| 39 | 44 | 25 | 8 | 0 | 2 | 8 | Lv2_8_1 |
| 40 | 60 | 43 | 4 | 2 | 2 | 8 | Lv2_8_1 |
| 41 | 65 | 45 | 7 | 1 | 2 | 9 | Lv2_8_1 |
| 42 | 57 | 36 | 4 | 1 | 2 | 13 | Lv2_8_1 |
| 43 | 68 | 43 | 9 | 2 | 2 | 11 | Lv3_1_1 |
| 44 | 45 | 33 | 3 | 1 | 2 | 5 | Lv3_1_1 |
| 45 | 55 | 34 | 6 | 2 | 1 | 11 | Lv3_1_1 |
| 46 | 63 | 39 | 9 | 1 | 2 | 11 | Lv3_2_1, Lv3_2_2 |
| 47 | 59 | 36 | 6 | 1 | 2 | 13 | Lv3_2_1 |
| 48 | 54 | 34 | 6 | 1 | 2 | 10 | Lv3_2_1, Lv3_2_2 |
| 49 | 58 | 40 | 4 | 1 | 2 | 10 | Lv3_2_1 |
| 50 | 49 | 25 | 6 | 1 | 3 | 13 | Lv3_3_1 |
| 51 | 39 | 20 | 6 | 1 | 2 | 9 | Lv3_3_1 |
| 52 | 48 | 34 | 6 | 1 | 1 | 5 | Lv3_3_1 |
| 53 | 65 | 45 | 6 | 1 | 2 | 10 | Lv3_3_1 |
| 54 | 53 | 36 | 6 | 1 | 1 | 8 | Lv3_4_1 |
| 55 | 65 | 43 | 9 | 1 | 1 | 10 | Lv2_3_2, Lv3_4_1 |
| 56 | 79 | 62 | 4 | 1 | 1 | 10 | Lv2_3_2, Lv3_4_1 |
| 57 | 53 | 33 | 7 | 2 | 2 | 8 | Lv2_3_2, Lv3_5_1, Lv3_5_2 |
| 58 | 56 | 36 | 6 | 2 | 2 | 9 | Lv3_5_1, Lv3_5_2 |
| 59 | 53 | 38 | 6 | 1 | 1 | 6 | Lv3_6_1 |
| 60 | 63 | 39 | 9 | 2 | 2 | 10 | Lv3_6_1 |
| 61 | 38 | 20 | 8 | 0 | 2 | 7 | Lv3_6_1 |
| 62 | 65 | 44 | 6 | 1 | 2 | 11 | Lv3_8_1, Lv3_9_1 |
| 64 | 76 | 52 | 10 | 1 | 2 | 10 | Lv3_8_1, Lv3_9_1 |
| 65 | 86 | 54 | 12 | 2 | 2 | 15 | Lv3_7_1 |
| 66 | 97 | 61 | 13 | 2 | 4 | 16 | Lv3_7_1 |
| 67 | 66 | 47 | 7 | 1 | 0 | 10 | Lv4_1_1, Lv4_1_2 |
| 68 | 71 | 56 | 5 | 1 | 1 | 7 | Lv4_1_1, Lv4_1_2 |
| 69 | 22 | 0 | 8 | 0 | 2 | 11 | Lv4_1_1, Lv4_1_2 |
| 70 | 83 | 59 | 8 | 2 | 1 | 12 | Lv4_2_1 |
| 71 | 45 | 27 | 5 | 2 | 1 | 9 | Lv2_8_2, Lv4_2_1 |
| 72 | 61 | 39 | 5 | 1 | 1 | 14 | Lv2_8_2, Lv4_2_1 |
| 73 | 84 | 52 | 16 | 1 | 2 | 12 | Lv2_8_2, Lv4_3_1 |
| 74 | 41 | 22 | 6 | 0 | 2 | 10 | Lv2_8_2, Lv4_3_1 |
| 75 | 53 | 36 | 6 | 1 | 1 | 8 | Lv4_3_1 |
| 76 | 42 | 24 | 6 | 0 | 2 | 9 | Lv4_4_1 |
| 77 | 47 | 26 | 5 | 1 | 1 | 13 | Lv4_4_1 |
| 78 | 68 | 47 | 7 | 1 | 2 | 10 | Lv4_5_1, Lv4_5_2 |
| 79 | 69 | 49 | 7 | 1 | 2 | 9 | Lv4_5_1, Lv4_5_2 |
| 80 | 81 | 54 | 10 | 1 | 3 | 12 | Lv4_6_1, Lv4_6_2, Lv4_8_1 |
| 81 | 93 | 68 | 9 | 1 | 1 | 13 | Lv4_6_1, Lv4_6_2 |
| 82 | 69 | 46 | 7 | 1 | 3 | 11 | Lv4_6_1, Lv4_6_2, Lv4_8_1 |
| 83 | 74 | 54 | 6 | 1 | 1 | 11 | Lv4_7_1 |
| 84 | 76 | 52 | 6 | 1 | 3 | 13 | Lv4_7_1 |
| 85 | 81 | 61 | 5 | 1 | 2 | 11 | Lv4_7_1 |
| 86 | 81 | 54 | 10 | 1 | 3 | 12 | Lv4_8_1 |
| 87 | 1 | 0 | 0 | 0 | 0 | 0 | - |
| 88 | 144 | 115 | 8 | 2 | 3 | 15 | Lv4_8_1 |
| 89 | 1 | 0 | 0 | 0 | 0 | 0 | - |
| 99 | 56 | 40 | 4 | 0 | 2 | 9 | - |
| 100 | 69 | 54 | 5 | 1 | 2 | 6 | - |
| 101 | 62 | 46 | 4 | 1 | 2 | 8 | - |
| 102 | 46 | 31 | 5 | 1 | 2 | 6 | - |
| 103 | 46 | 32 | 6 | 1 | 2 | 4 | - |
| 109 | 64 | 44 | 6 | 1 | 4 | 8 | - |
| 110 | 68 | 46 | 4 | 1 | 1 | 15 | - |
| 140 | 105 | 65 | 13 | 3 | 6 | 17 | Lv5_12_1 |
| 150 | 38 | 22 | 4 | 1 | 2 | 8 | Lv6_1_1 |
| 151 | 37 | 22 | 4 | 1 | 1 | 8 | Lv6_1_1 |
| 152 | 24 | 0 | 0 | 0 | 0 | 23 | Lv6_2_1 |
| 153 | 8 | 0 | 0 | 0 | 0 | 7 | Lv6_2_1 |
| 154 | 56 | 34 | 6 | 1 | 2 | 12 | Lv5_8_1, Lv6_3_1 |
| 155 | 5 | 0 | 0 | 0 | 1 | 3 | Lv6_3_1 |
| 156 | 4 | 0 | 0 | 0 | 1 | 2 | Lv6_3_1 |
| 157 | 6 | 0 | 0 | 0 | 1 | 4 | Lv6_3_1 |
| 167 | 73 | 56 | 4 | 1 | 1 | 10 | Lv5_2_1, Lv5_5_1 |
| 168 | 74 | 56 | 4 | 1 | 2 | 10 | Lv5_3_1, Lv5_6_1 |
| 169 | 75 | 56 | 4 | 1 | 3 | 10 | Lv5_7_1 |
| 170 | 73 | 56 | 4 | 1 | 1 | 10 | Lv5_2_1, Lv5_3_1, Lv5_5_1 +2 |
| 171 | 9 | 1 | 1 | 0 | 1 | 5 | Lv5_4_1 |
| 172 | 9 | 0 | 1 | 0 | 2 | 5 | - |
| 173 | 11 | 0 | 1 | 0 | 3 | 6 | Lv5_4_1 |
| 180 | 108 | 106 | 0 | 1 | 0 | 0 | Lv5_11_1, Lv5_13_1 |
| 190 | 61 | 46 | 4 | 0 | 1 | 9 | - |
| 191 | 16 | 0 | 4 | 0 | 1 | 10 | - |
| 199 | 51 | 38 | 4 | 1 | 1 | 6 | - |
| 200 | 105 | 52 | 10 | 2 | 12 | 28 | - |
| 201 | 105 | 52 | 10 | 2 | 12 | 28 | - |
| 202 | 105 | 54 | 10 | 2 | 12 | 26 | - |
| 203 | 105 | 52 | 10 | 2 | 12 | 28 | - |
| 204 | 105 | 52 | 10 | 2 | 12 | 28 | - |
| 210 | 116 | 65 | 9 | 2 | 12 | 27 | - |
| 211 | 116 | 64 | 11 | 2 | 12 | 26 | - |
| 212 | 116 | 68 | 8 | 1 | 12 | 26 | Lv5_13_1 |
| 213 | 116 | 68 | 8 | 1 | 12 | 26 | - |
| 214 | 116 | 68 | 8 | 1 | 12 | 26 | - |
| 220 | 84 | 38 | 8 | 1 | 10 | 26 | Lv7_1_2 |
| 221 | 84 | 38 | 8 | 1 | 10 | 26 | - |
| 222 | 84 | 38 | 8 | 1 | 10 | 26 | - |
| 223 | 84 | 39 | 7 | 1 | 10 | 26 | - |
| 224 | 84 | 38 | 8 | 1 | 10 | 26 | - |
| 230 | 46 | 0 | 9 | 0 | 10 | 26 | - |
| 231 | 46 | 0 | 9 | 0 | 10 | 26 | - |
| 232 | 46 | 0 | 9 | 0 | 10 | 26 | - |
| 233 | 46 | 0 | 9 | 0 | 10 | 26 | - |
| 234 | 46 | 0 | 9 | 0 | 10 | 26 | - |
| 240 | 89 | 53 | 16 | 2 | 4 | 13 | - |
| 241 | 88 | 53 | 16 | 2 | 3 | 13 | - |
| 248 | 14 | 0 | 4 | 0 | 1 | 8 | - |
| 249 | 16 | 0 | 4 | 0 | 1 | 10 | - |
| 250 | 105 | 65 | 13 | 3 | 6 | 17 | Lv5_9_1 |
| 251 | 80 | 54 | 7 | 2 | 4 | 12 | - |
| 252 | 80 | 54 | 7 | 2 | 4 | 12 | - |
| 253 | 12 | 0 | 4 | 0 | 1 | 6 | Lv5_1_1, Lv5_1_2, Lv6_1_2 |
| 254 | 98 | 50 | 10 | 3 | 8 | 26 | Lv5_8_1 |

Smallest non-empty templates: 87 and 89 (1 piece each, unreferenced), 156 (4), 155 (5), 157 (6), 153 (8), 171 and 172 (9), 173 (11), 253 (12; used by Lv5_1 and Lv6_1_2), 22 (14, no weapons), 0 (17). Largest: 88 (144), 10 (126), 211-214 (116 each, unreferenced).

### 3.7 Worked conversion: template 0 -> CastleDef at 1 piece = 1 cell

Template 0 is the tutorial player castle (Lv1_1_1 slot 0, 17 pieces: palace, 4 towers, cannon, catapult, fire catapult, 6 farmhouses, treasury, mason's yard, superbrain). Rules used: 1 cell = one 5 m grid cell; a footprint-N building covers N x N cells anchored at its minimum corner; towers are 4 layers (19.25 m / 5 m), palace 3 layers (DESIGN 4x4x3 core, the mesh would allow 5), houses 2 layers; a wall weapon sits on a `mount` block placed on its tower (mount at y=5, weapon at y=6, matching DESIGN 3.5 "on top of a mount block"); ground weapons are entities on the foundation, left as air in the ASCII (DESIGN 3.5: 3x3x2 at y=1, `at` = centre cell, assumption); origin shifted so the bounding box starts at (0,0): x-1, z-2; size [29, 6, 20] (w, h, d). Legend: `T` tower, `M` mount, `P` palace, `W` wood.

```js
{ id: "ripped-plateau-0", name: { en: "Tutorial player castle (plateau.0)" },
  size: [29, 6, 20],
  legend: { T: "tower", M: "mount", P: "palace", W: "wood" },
  layers: [
    [ // y = 1
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      "........WW...................",
      "........WW...................",
      "WW...........................",
      "WW...........................",
      ".....WW......................",
      ".....WW......T....T..........",
      "..............PPPP...........",
      "..............PPPP...........",
      ".......WW.....PPPP........WW.",
      ".......WW.....PPPP........WW.",
      ".............T....T..........",
      ".......................WW....",
      ".......................WW....",
      "...WW...WW...................",
      "...WW...WW.................WW",
      "...........................WW",
    ],
    [ // y = 2
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      "........WW...................",
      "........WW...................",
      "WW...........................",
      "WW...........................",
      ".....WW......................",
      ".....WW......T....T..........",
      "..............PPPP...........",
      "..............PPPP...........",
      ".......WW.....PPPP........WW.",
      ".......WW.....PPPP........WW.",
      ".............T....T..........",
      ".......................WW....",
      ".......................WW....",
      "...WW...WW...................",
      "...WW...WW.................WW",
      "...........................WW",
    ],
    [ // y = 3
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............T....T..........",
      "..............PPPP...........",
      "..............PPPP...........",
      "..............PPPP...........",
      "..............PPPP...........",
      ".............T....T..........",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
    ],
    [ // y = 4
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............T....T..........",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............T....T..........",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
    ],
    [ // y = 5
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      "..................M..........",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
    ],
    [ // y = 6
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
      ".............................",
    ],
  ],
  weapons: [
    { id: "fire-catapult", at: [1, 1, 2], facing: 0 },
    { id: "catapult", at: [15, 1, 1], facing: 0 },
    { id: "cannon", at: [18, 6, 9], facing: 0 },
  ],
  mountSpots: [ [13, 5, 9, 0], [18, 5, 9, 0], [18, 5, 14, 0], [13, 5, 14, 0] ], // every tower top; invented
  shelters: [[13, 1, 10, 13, 3, 13]], // invented placeholder
  workSpots: [[14, 1, 8], [10, 1, 14]], // invented
  exit: [18, 1, 17], rulerSpawn: [15, 1, 14], throne: [15, 4, 11], // invented
  population: 40 }
```

Check of the anchor: after the shift the palace spans x 14-17, z 10-13 and towers sit at (13,9), (18,9), (18,14), (13,14); the cannon is on the tower at (18,9).

**Information lost or invented in this conversion:**

- **Scale.** 5 m pieces become 1 cell: the whole 160 x 120 m plateau (32x24 cells) shrinks to 29x20 cells. Relative distances between castles on a map are then governed by `duelDistanceM`, not by the template. Ranges of 190 m (dial 038 x 5 m) are unrelated to template geometry.
- **Building identity.** Farmhouse, treasury, mason's yard, superbrain, inn, smithy, windmill, idol all collapse onto the single `wood` block (or `magazine` for the ammo workshop); the CastleDef cannot say "this 2x2x2 wood cube is the treasury". Gameplay roles (farmer housing, income, research, gold storage, repair, weapon smithing) would need a new `buildings` list or distinct block keys. The 24-dp ammo workshop is the only one with a matching block (`magazine`).
- **Per-piece hp/cost.** A 2x2 farmhouse is 12 dp as one object in the original; as 8 wood cells it is 8 x 16 hp.
- **Damage states and variants.** `_z0.._z3`, `_lp`, `_ruine` meshes are render state; CastleDef derives states from hp. Wall connection variants (6 per wall) are recomputed from neighbours.
- **Heights.** Templates have no y at all. Layer counts above are my choice (mesh height / 5 m); the original wall is 3.1x its footprint tall, houses ~0.7x.
- **Orientation.** The 2-bit code is copied into `facing` unchanged (template 0 is all 0); rotation sign and whether 0 = north are unknown. Nothing in 9,153 records is oriented outside 0-3.
- **Terrain.** Plateau height, world origin and terrain mask are runtime; castle `plot` has no relation to the 128x128 `.pln` height maps.
- **Invented fields.** `mountSpots`, `shelters`, `workSpots`, `exit`, `rulerSpawn`, `throne`, `population`: nothing in the rip (the original has no ruler on foot, no NPC crews, no shelters).
- **Unused bits.** All records have unused_bits = 0 so nothing is dropped there.
- **Overlap.** Wall weapons share the cell of the tower (handled by mount block above it); ground weapons and some farmhouse positions may overlap neighbours at 1:1 when the template relied on 5 m separation. Template 0 has none. Other templates were not checked.

## 4. Open questions for the orchestrator

1. **Ground-weapon hp: 60/96 (exe) or 30/48 (manual, TUNING)?** The exe contradicts the manual by exactly 2x for the two "Ground weapon" slots only. Decide by playtest or accept the exe. Wall-weapon hp (36) is unaffected.
2. **Do we recalibrate block costs to the original economy?** Section 2 recommends stone 1 g, tower 2 g, prefab prices for buildings. This changes the incentive structure in DESIGN 3.8; the current numbers make a rebuilt 5 m wall cost ~900 g. Needs an owner decision.
3. **Ammo workshop: model it?** The rip proves 1.5x ammo cost without workshop and royal/advanced weapons require one. TUNING has a `magazine` block (stock + explosion) but no price effect. Add `fireCostWorkshop` and a "has workshop" rule, or declare the magazine the workshop.
4. **Ballistics source.** No numeric constants exist in the rip. Do you want a follow-up job (static disassembly with objdump, no execution) on the code reading 0x534a68+ and the projectile integrator to extract gravity, muzzle speed, wind scale, elevation limits and spread? It is the only route to real numbers; otherwise all of `TUNING.sim/aim/wind` and every weapon `v0`, `k`, `sAzDeg`, `sV`, direct/splash stay guesses.
5. **Wind defaults per level.** Tutorials use wind 0. The 292/324-byte `.odn` records have unexplained fields (wind strength/change, weapon cap, mission rules, time limit) preserved only as hex; decoding them would give per-mission wind, weapon caps and objectives.
6. **Scenario theme byte and biome.** Which of Grass/Wueste/Schnee/Vulkan/Alien does theme 0-3 select, and how do the 28 levels map to campaigns? Not resolved. Our map presets can use campaign names, but faithful reproduction needs this.
7. **Meaning of the 4 slot role/owner/AI fields** in `.odn` (`slot_bytes_2_17`, e.g. [0,3,0,0]): needed to know which slot is the human and which enemy/ally.
8. **Orientation code** (0-3): sign and zero direction. Matters for importing the 145 castles with correct handedness.
9. **Empty referenced templates** 104, 105, 106, 215: where do those castles come from (maybe random generation or per-slot "build your own")? And what are the 37 unreferenced templates for?
10. **Palace durability model.** Keep the voxel-core integrity threshold (30 %) or use a single 200 dp pool? Current TUNING makes the palace ~6.7x the original; this affects the match target pacing in DESIGN 3.8.
11. **Unit scale of the meshes.** Walls are 15.5-20.75 m tall on a 5 m footprint, weapons 1.5-10 m. Is 1 OBJ unit really 1 m? If we want to reuse proportions, the wall height (3-4 cells) vs weapon size (cannon 1.5 m) decides how the `mount`/weapon blocks look.
12. **Treasury and gold cap.** Cap ~2000 without treasury; capacity per treasury and the loss fraction on destruction are runtime values not in the rip.
13. **Gold per farmer per second.** Neither manual nor rip give it; only the palace = 10 farmers at 40 % tax ratio. TUNING `palaceIncomeS` 6 and `civilianIncomeS` 0.25 are inconsistent with that ratio (6 vs 2.5).
