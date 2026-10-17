# HOHENFEUER - Design

A three.js re-imagining of *Ballerburg: Castle Siege* (Ascaron 2001). Binding scope:
`research/00-scoping-decisions.md`. Original numbers: `research/06-manual-mechanics.md` (cited as
EN p.N). This file is WHAT we build; `CLAUDE.md` is HOW we work. Every number below is a default
that lives in `src/tuning.js`; change the number there, not the prose, and add a dated note here.

**Amendments 2026-10-17 (TB1 integration).** Tuning added: `ai.defaultLevel` 5, `ruler.sightUpM`
1.25 / `sightBackM` 2.0 (were 0.6 / 1.2), `ruler.weaponViewPitchDeg` -4, `ruler.mouseSensitivity`
0.0022 rad/px, `ui.messageLifetimeS` 10, `ui.messageMax` 4, `audio.falloffM` 40, `audio.earshotM` 600.
Contracts added: `META` (plot meta bits) and the SimView/HudView typedefs (8.3). Boot: `index.html`
-> `src/main.js` (plugins, freeze, createSim with slot 0 local and slot 1 AI, renderer, input,
cameras, HUD, audio, fixed-step loop); the scripted slice for goldens and tests is `src/tb1-script.js`.
Golden-mode and debug-hook rules in 7.6; weapon-view and PgUp/PgDn rules in 5. Open: terrain is
flattened to the plot origin (the foundation bottom), so castles stand on a 1 m foundation plinth;
lane A owns the change to origin.y + 1 (its terrain test pins the current value).

Conventions: Y-up, **1 world unit = 1 m**, north = -Z, east = +X. Azimuth is measured clockwise
from north in degrees; direction vector `(sin az, 0, -cos az)`. Sim time is ticks at 30 Hz.

---

## 1. Vision and scope

You are a mortal ruler inside your own block-built castle, in first person, in real time. Across a
valley an AI rival does the same. You walk the ramparts, point at stones to have masons build or
patch them, climb to a cannon, read the wind off the compass, dial direction and range on the
2001-style brass console and fire; or you order a crew to keep firing while you run to the
magazine wall that just cracked. Your people are the castle's hit points: gun crews, ammo runners,
masons and civilians, all moved by one morale number that can tip into flight, desertion and
surrender. One shot through the palace window can end the game; one shot through you certainly
does. Weapons, blocks, NPC types, maps and biomes are plugins. The look is the 2001 original:
low-poly, bilinear textures, one sun, baked shading, the stone-and-steel HUD frame.

**Out of scope** (do not build, do not stub beyond the reserved interface named):
1. Research tree, Superbrain, upgrades by research (upgrade weapons exist only as separate plugins).
2. Spells, mana, mage tower (interface `SpellDef` reserved in section 8, no implementation).
3. Campaigns, queens' story, tutorial levels, cutscenes, medals, titles, hall of fame.
4. Any RTS/overview/orbit camera. The only cameras are first person, weapon view, impact view and
   the dead ruler's ghost view.
5. Zeppelin and Super Weapon (possible later weapon plugins; not in Phase 0-4).
6. Tax dial, farmer immigration, treasuries, inn, idol, windmill economy. Income is fixed per castle.
7. Network transport (Phase 4 only proves lockstep determinism in-process; sockets are later).
8. Day/night, night curfew, sudden death (sudden death is a `MapDef` field reserved, default off).
9. Free-form terrain digging; terrain is not destructible.
10. Runtime loading of plugins from URLs; plugins are compiled in through two index files.
11. Shipping or committing anything from `assets-ripped/` or `downloads/`.

---

## 2. World and blocks

### 2.1 Grid and scale

- **Block = 1 m cube.** Justification: a 1.75 m ruler fits under 2 free cells (2 m clearance), so
  a walkway is "solid floor + 2 air"; a wall 3 blocks thick gives a parapet row plus a 2-wide
  walkway; crenellations read at 1 m; a blast of radius 1.25-2.5 m touches 7-65 cells, so a
  3-thick stone wall breaches after about 6 cannon hits in one area. 0.5 m blocks would cost 8x
  cells and remesh time for no gameplay gain; 2 m blocks make every wall either 2 m or 4 m thick
  and break the walkway rule.
- **Castle plot: 48 x 48 blocks footprint, 24 blocks tall** (x, z, y). Cell index
  `i = x + 48*z + 2304*y`, 55,296 cells per plot. Layer y = 0 is the indestructible foundation.
- Per plot state: `type: Uint8Array`, `meta: Uint8Array` (bits 0-1 facing N/E/S/W, bits 2-3 shape
  or variant, bit 4 burning, bit 5 designated), `hp: Uint8Array` (0-255; 255 = indestructible).
- Plots never overlap. Default duel: plot centres 192 m apart (dial value 038, see 3.3). 3-4 slot
  maps place plots on a ring of radius 110 m (neighbour 156 m, opposite 220 m).
- Map size: duel 384 x 256 m; 4-slot 384 x 384 m. Outside plots there is only terrain.
- Build limit: y 1..23. Weapon cap per castle: 4 (map setting 2-8; original base 2, max 8, EN p.52).

### 2.2 Block palette (core plugin `src/plugins/blocks/core.sim.js`)

Block hp is in the manual's "defence points" (dp). Calibration rule: one per-block hp equals the
dp of the original structure the block comes from; a normal cannonball deals 24 dp direct.

| id | key | origin (DE) | hp | cost g | build s | solid | walk-on | notes |
|---|---|---|---|---|---|---|---|---|
| 0 | air | - | - | - | - | no | - | |
| 1 | stone | Mauer klein 40 dp | 40 | 10 | 4 | yes | yes | default wall block |
| 2 | tower | Turm klein 72 dp | 72 | 16 | 5 | yes | yes | tower shells, keep |
| 3 | gate | Burgtor 96 dp | 96 | map-only | - | yes | yes | gatehouse |
| 4 | wood | Bauernhaus 12 dp | 16 | 4 | 2 | yes | yes | burnable; houses, hoardings |
| 5 | floor | planks | 12 | 3 | 2 | yes | yes | burnable; interior floors, bridges |
| 6 | stairs | - | 20 | 6 | 3 | step collider | yes | oriented; rises +1 toward facing |
| 7 | ladder | - | 6 | 3 | 2 | no | climb | oriented, hangs on a solid face; projectiles pass |
| 8 | door | - | 20 | 8 | 3 | for shots only | pass | oriented; always a 2-cell pair; walkers pass |
| 9 | roof | tiles | 8 | 5 | 2 | yes | no | shape bits: slope/ridge/corner; NPCs cannot stand |
| 10 | magazine | Munitionsfabrik 24 dp | 24 | 20 | 6 | yes | yes | placed as 2x2x2 prefab (160 g); explodes |
| 11 | palace | Palast 200 dp | 40 | map-only | - | yes | yes | win target; core of the keep |
| 12 | mount | Mauer gross 60 dp | 60 | 12 | 5 | yes | yes | gun platform; wall weapons need one under them |
| 13 | foundation | - | 255 | map-only | - | yes | yes | layer y = 0, indestructible |

Ids 0-63 are reserved for core; plugin blocks use 64-255.

Rules:
- **Support.** After each tick's destruction batch, flood-fill (6-neighbour, solid blocks only,
  ladders and doors count as solid for support) from the foundation over the cells within 12 of a
  destroyed cell; unsupported solid blocks collapse (removed, `EV.COLLAPSE`, debris fx, 50 dp to
  NPCs directly below, no hp credit loop). Budget 4096 visited cells per tick; overflow continues
  next tick. Towers cut at the base fall.
- **Damage states** (matches the rip's `_z0.._z3` meshes): hp > 75% state 0, > 50% state 1,
  > 25% state 2, else 3; 0 = destroyed. Render-only, derived from hp.
- **Magazine.** Connected magazine cells form one store, capacity 20 shot loads, restock +1 per
  4 s (free; gold is paid per shot, see 3.5). When a magazine cell is destroyed with stock s >= 1:
  explosion at that cell, splash `30 + 2s` dp (max 70), radius `2 + 0.1s` m (max 4), stock = 0.
  Tuning switch `magazineExplosions` (default on).
- **Palace integrity** = sum(hp of palace cells) / initial sum. Destroyed when < 30%.
- **Fire** (Phase 3, fire weapons only): an ignited burnable block burns 10 s at 2 dp/s; each
  second each burnable 6-neighbour ignites with p = 0.15 (sim RNG). Stone never burns (EN p.44).

### 2.3 Terrain and biomes

- Terrain is a sim-side pure heightfield on a 2 m grid, generated from `MapDef.terrain` + seed
  (value noise over `fmath`, 3 octaves, amplitude 0-12 m), with plots flattened to the plot base
  height plus an 8 m smoothstep skirt. Optional ridge between castles, height 0-30 m: a ridge
  forces lobbed weapons, as the original's "high mountains" (EN p.41).
- Projectiles collide with terrain by bilinear height sample per substep. Craters are decals only.
- River and lakes are cosmetic water planes at a fixed height; projectiles that hit water splash.
- Trees and rocks are instanced props, cosmetic, no collision (keeps the sim small).
- Biomes (render + terrain params): `forest` (Wald: green grass, conifers, grey stone),
  `desert` (Wueste: ochre sand #c9a66b, sparse palms, banded towers), `ice` (Eis: snow, blue rock,
  icicles), `volcano` (Vulkan: basalt, lava field glow, ash fog). Forest ships in Phase 1; the
  other three in Phase 3.

### 2.4 Ripped originals onto the block palette

The rip in `assets-ripped/Main/Objects/` holds walls (`MauerKlein_0..4`, `MauerGross_0..4`, each
with damage states `_z0.._z3` and `_lp` LOD), towers (`TurmKlein`, `TurmGross`), `palast`,
`Burgtor`, `bauernhaus`, `pulverfabrik`, `steinmetz`, weapons split into parts (`*_Gestell` frame,
`*_Drehkranz` turntable, `*_Rohr`/`*_Balken` barrel or arm, `Mun_*` ammo), blob `Shadows/`, cloud
layers `Wolken/`. Use in two stages, never shipped:
1. **Reference (Phase 0-2).** A Blender script imports a rip mesh into a reference collection,
   measures it (wall course height, merlon spacing, tower diameter, roof pitch, palette) into
   `research/08-rip-measurements.md`, and renders turntables at the golden poses. Block
   compositions are quantised from these measurements:

| original | block composition (1 m grid) |
|---|---|
| MauerKlein | stone, 3 thick, 6 high, merlon row at y = 7 on the outer line, pattern 1 on / 1 off |
| MauerGross | stone, 3 thick, 8 high, same merlons; mount blocks every 6 m on the walkway |
| TurmKlein | tower ring 6x6 hollow, 11 high, internal stairs, merlons, stepped roof cone to 15 |
| TurmGross | tower ring 8x8 hollow, 14 high, two floors, roof cone to 19 |
| palast | keep 10x10x10 of tower blocks around a 4x4x3 palace core at y 1-3, roof ridge |
| Burgtor | gate blocks 6 wide x 3 deep x 9 high, 2x3 opening with door pairs |
| bauernhaus | wood 4x5x3 with roof 2 high; civilian home and shelter |
| pulverfabrik | magazine 2x2x2 with roof |
| weapon parts | weapon GLB node tree `Base` (Gestell), `Yaw` (Drehkranz), `Pitch` (Rohr/Balken), `Muzzle` |

2. **Greebled skins (Phase 3).** Re-authored Blender block skins that evoke the original's stone
   courses, roof tiles and timber, built per face (see 7.3) and matched against reference renders
   with the metrics of 7.6. No vertex, UV or texel data is copied from the rip.

---

## 3. Simulation core

### 3.1 Shape

- Plain JS, pure, deterministic, **30 Hz fixed timestep** (`DT = 1/30`). Files under `src/core`,
  `src/sim`, `src/world`, `src/npc`, `src/ai` and every `plugins/**/*.sim.js` import nothing from
  three.js, the DOM, `Math.random`, `Date`, `performance`.
- `createSim({ map, seed, slots }) -> sim` with `sim.tick(commands)`, `sim.state` (read-only to
  everyone outside sim), `sim.drainEvents()`, `sim.hash()` (FNV-1a 32 over typed arrays and
  canonical entity fields), `sim.serialize()` / `restoreSim(blob)`.
- **PRNG:** sfc32, seeded through splitmix32 into independent streams `wind`, `scatter`, `npc`,
  `ai[slot]`, `fire`, `map`. Adding a draw in one stream never shifts another.
- **fmath:** `src/core/fmath.js` provides `sin, cos, atan2, exp, log, pow` by argument reduction
  and fixed polynomials. Sim code uses only these plus `+ - * / Math.sqrt Math.floor Math.abs
  Math.min Math.max` (IEEE-exact everywhere). Required for cross-browser lockstep.
- Normal deviates: `(u1 + u2 + u3 - 1.5) * 2 * sigma` (no transcendental, bounded).
- Commands are integer-quantised: yaw as uint16 of a full turn, pitch int16, aim azimuth in tenths
  of a degree, range in tenths of a dial unit.

### 3.2 Tick order (fixed)

1. Apply commands for this tick, sorted by slot id then sequence number.
2. Ruler kinematics (all slots), NPC kinematics.
3. AI think for slots whose `(tick + slot*5) % 15 == 0` (2 Hz, staggered); AI output is commands
   for tick + 1, like local human input.
4. Weapons: reload progress, crew checks, fire -> projectiles, `onTick` hooks.
5. Projectiles: 4 substeps, collision, impacts queued.
6. Blasts resolved in impact order: block and entity damage, `onDestroyed` hooks, fire, support.
7. Jobs (emit, expire, claim), NPC brains, work progress.
8. Morale, economy (income, magazine restock).
9. Win/lose checks; then `tick++` and events published.

Render runs at display rate and interpolates entity positions between the last two ticks.
Main loop: accumulator, dt clamp 0.25 s, max 5 sim ticks per frame, paused when the tab is hidden.

### 3.3 Ballistics, aim and HUD semantics

Integrator (spec derived from Kruse's drag-toward-wind form, re-implemented from the formula,
research/05 section 2.1): per substep `h = DT/4 = 1/120 s`, semi-implicit Euler

```
a = (k*(w.x - v.x), -g, k*(w.z - v.z))      // horizontal drag toward wind, vertical gravity only
v += a*h ;  p += v*h                          // g = 9.81 m/s^2, k = weapon drift coefficient (1/s)
```

Collision per substep: 3D DDA (Amanatides-Woo) along segment p_prev -> p over plot cells; segment
vs ruler/NPC capsules; segment vs weapon AABBs; terrain height sample; first hit wins (smallest t).
No tunnelling at any speed. Projectiles die after 30 s, below y = -50, or outside the map.

**Aim state** per weapon: `az` (tenths of a degree, 0-3599) and `range` (tenths of a dial unit).
- **Direction readout** (left three digits, EN p.27-28): `floor(az/10)`, 000 = north, wraps at 360.
  Arrow tap 0.5 deg, Ctrl 5 deg, mouse drag 0.1 deg per px.
- **Range readout** (right three digits): **1 dial unit = 5 m of flat-ground, zero-wind range**
  (shown as `floor(range/10)`). "Higher = further" holds exactly (EN p.28); tutorial values
  038-057 map to 190-285 m, our duel distance is 192 m = 038. Arrow tap 0.2 units (1 m), Ctrl
  2 units (10 m), drag 0.05 units per px.
- At `createSim` (cached per registry hash) each weapon gets a monotonic table range(elevation) with this same
  integrator (launch height = landing height, w = 0) at 0.25 deg steps over its elevation band;
  dial -> elevation by binary search + linear interpolation. Straight weapons use the low branch
  (-5..+25 deg), lobbed weapons the high branch (80 -> 45 deg, range grows as elevation drops).
- Height differences, wind and scatter make the dial approximate, as in the original: "the exact
  landing spot can only be ascertained by firing a test shot" (EN p.28).
- **Scatter** at fire time: azimuth `+ N(0, sAz)`, muzzle speed `* (1 + N(0, sV))`.
- **Restore** (Home) returns aim to the last fired settings. **Impact view** (hold End) shows the
  last real impact; during flight it shows the no-wind, no-scatter predicted point (EN p.29).

### 3.4 Wind

- Setting `windStrength` 0-5 -> max speed 0/3/6/9/12/15 m/s (default 2 = 6 m/s).
- Setting `windChange` 0-5 -> mean interval none/180/120/90/60/30 s (default 2 = 120 s), each
  interval jittered x U(0.7, 1.3).
- On change: `speed = clamp(0.9*speed + U(-0.4, 0.4)*max, 0, max)`, `dir += U(-60, 60) deg`.
- HUD (EN p.24): compass hub number = `round(speed)` in m/s; **red arrow** = direction the wind
  blows toward, hidden when speed < 0.5; **blue arrow** = previous direction, shown from a change
  until this slot's next shot or 20 s.
- Drift calibration (acceptance test): at 15 m/s crosswind and 192 m the mean lateral drift is
  cannon 2 m, catapult 8 m, rocket 15 m, each within +-25%.

### 3.5 Weapons (numbers for the core set; plugin data in section 8)

Original columns from EN pp.41-48; v0, elevation band, k, scatter, damage are design numbers.

| id | mount | cost | hp | reload s | crew N | fire g | traj | v0 m/s | k 1/s | sAz deg / sV | shot: n x direct/splash dp, radius m |
|---|---|---|---|---|---|---|---|---|---|---|---|
| catapult | ground 3x3 | 600 | 30 | 18 | 4 | 52 | lobbed | 52 | 0.010 | 1.0 / 2.5% | 1 x 16/12, 2.5 |
| cannon | wall | 750 | 36 | 22 | 3 | 90 | straight | 75 | 0.030 | 0.3 / 1.0% | 1 x 24/10, 1.25 |
| double-cannon | wall | 750 | 36 | 22 | 4 | 150 | straight | 75 | 0.030 | 0.4 / 1.0% | 2 x 24/10, 1.25, 0.3 s apart |
| fire-catapult | ground | 750 | 30 | 24 | 4 | 150 | lobbed | 50 | 0.008 | 0.6 / 1.5% | 1 x 8/4, 1.25, ignites r 2 |
| ballista | wall | 400 | 36 | 15 | 2 | 22 | lobbed | 60 | 0.006 | 0.15 / 0.5% | 1 x 6/0, 0; kills all NPCs on its line, max 3 |
| rocket | wall | 800 | 36 | 30 | 3 | 150 | lobbed | 60 | 0.016 | 1.6 / 4% | 1 x 40/20, 2.5 |
| trebuchet | ground | 850 | 48 | 18 | 6 | 225 | lobbed | 58 | 0.010 | 1.0 / 2.5% | 5 x 16/10, 2.5, spread 1.5 deg |
| arcaballista | ground | 850 | 48 | 18 | 4 | 300 | straight | 80 | 0.020 | 0.6 / 1.5% | 4 x 40/0, 0.75, spread 0.8 deg |
| fat-freda | ground | 850 | 48 | 22 | 6 | 225 | lobbed | 55 | 0.008 | 0.3 / 1.0% | 1 x 64/40, 3.5 |
| hellfire | ground | 850 | 48 | 22 | 5 | 330 | straight | 75 | 0.030 | 0.6 / 1.5% | 5 x 24/10, 1.25, 0.4 s apart |

- Wall weapons: footprint 1x1x1 on top of a `mount` block, hp 36 (half a 72 dp tower, EN p.43),
  operator cell directly behind (opposite facing). Ground weapons: 3x3x2 on 9 solid cells at plot
  base level y = 1 (EN p.25 "stand anywhere in the castle" = courtyard), operator cell at the rear
  middle. Phase 1 ships `cannon` only; the rest arrive as plugins in Phase 3. Long John, Hot
  Helga, Fire Ballista and Quad Launcher are data variants of their base plugins (Phase 3+).
- Gold per shot is paid at fire (EN p.27, red cost = cannot fire). In Phase 2+ a shot also needs
  one hauled load in the weapon's 2-load buffer.
- **Reload (Phase 2+):** `reloadS = base * N / max(1, crewPresent) * (1.5 - 0.5*workSpeed)`;
  crewPresent counts the ruler when he mans the gun; firing needs `crewPresent >= ceil(0.6*N)` or
  the ruler manning. Full crew at workSpeed 1.0 = original reload. Ruler alone at a cannon = 66 s.
  Phase 1: `reloadS = base`.

### 3.6 Damage

- Blast at impact point P: the hit block takes `direct`; every block whose centre is within
  `radius` takes `splash * (1 - d/radius)`; the weapon whose AABB is hit takes `direct` and weapons
  within radius take splash. Damage is rounded to integers (floor), applied in cell index order.
- People: a projectile segment intersecting a capsule (ruler r 0.3 m, NPC r 0.25 m, both 1.75 m)
  kills outright. Splash vs people: `150 * (1 - d/(radius + 1))`. NPC and ruler hp 100. Ruler
  regenerates 4 hp/s after 10 s without damage; NPCs do not. Falls > 3 m: `(h - 3) * 30`.
- Morale credit and stats are per projectile (section 4.6 caps), never per block.

### 3.7 Win / lose (per slot)

A castle is eliminated when, checked in this order at end of tick:
1. **Palace destroyed:** palace integrity < 30% (EN p.36 "palace destroyed = defeat").
2. **Ruler killed:** the slot's ruler entity dies (human or AI ruler; both are mortal).
3. **Surrender:** morale <= 10 for 45 continuous seconds, or population < 25% of start.
Last castle (or team) standing wins; eliminations in the same tick are a draw between them.
An eliminated human enters ghost view (free first-person fly, no interaction, EN p.26).
End screen: battle stats from EN pp.34-35: shots, direct hits, accuracy, damage dealt in dp and
gold value, losses, playing time.

### 3.8 Economy

Start gold 2000. Income per second: palace 6 g + 0.25 g per civilian at work (40 pop: ~9 g/s).
Cap 4000 g (original ~2000 without treasury, EN p.39, doubled because there is no treasury).
Spending: shots (fire cost), designations (block or weapon cost, reserved at designation time,
refunded on cancel), repairs (`cost * missingFraction * 0.5`, paid as the mason works).
**Pacing target:** a duel vs AI level 5 lasts 12-20 minutes. Knobs, in this order: palace block
hp, palace-destroyed threshold, direct damage, income. Measured by the headless AI-vs-AI runs.

---

## 4. NPC system

### 4.1 Population and roles

Default population P = 40 per castle (`CastleDef.population`, 20-80). Role is a tag, not a class.

| role | share | count at 40 | jobs | speed m/s | flee threshold |
|---|---|---|---|---|---|
| crew | 40% | 16 | CREW, HAUL_AMMO if idle | 3.0 | 10 + U(-10, 10) |
| runner | 15% (min 3) | 6 | HAUL_AMMO | 3.0, 2.0 carrying | 10 + U(-10, 10) |
| mason | 15% (min 2) | 6 | BUILD, REPAIR, DEMOLISH | 3.0 | 10 + U(-10, 10) |
| civilian | rest | 12 | WORK (income spots), draft pool | 3.0 | 25 + U(-10, 10) |

All NPCs: flee 4.0 m/s, ladder 1.0 m/s, stairs at 0.7x speed. **Draft:** when crew < sum of
`ceil(0.6N)` over manned weapons, runners < 3 or masons < 2, one civilian is retagged every 10 s.
NPCs never leave their plot except deserters (to the plot's `exit` cell, then despawn).

### 4.2 State machine

`IDLE -> CLAIM -> WALK -> WORK -> IDLE`, plus `FLEE`, `SHELTER`, `DEAD`. Transitions are evaluated
every tick in NPC id order. FLEE and SHELTER pre-empt everything and drop claims.

### 4.3 Jobs and claims

`Job { id, kind, castle, target: { cell } | { weaponId }, priority 0-3, role, slots, claimedBy[],
reachable, blockedUntilTick, createdTick, progress }`, kinds `BUILD REPAIR DEMOLISH CREW
HAUL_AMMO WORK`. One job list per castle, iterated by id.
- Emitters: designations (BUILD/DEMOLISH, priority 1), block hp < 50% (REPAIR, priority 0), ruler
  `R` on a block (REPAIR priority 3), weapon buffer < 2 loads (HAUL_AMMO, priority 2; `R` on the
  weapon -> 3), crew orders (CREW, priority 3, slots N).
- Claim: an idle NPC takes the highest priority, then smallest Manhattan distance, then lowest id,
  among jobs matching its role with a free slot and `reachable`. It plans a path; failure sets
  `reachable = false`, `blockedUntilTick = tick + 150` (5 s) and the NPC tries the next job.
- Claims expire when the claimant dies, flees, shelters, or its path breaks (next cell no longer
  standable), or after 60 s without progress. The job returns to the queue.
- **BUILD** is ready only when the target cell has a solid 6-neighbour or is at y = 1 and no
  person stands in it. Masons work from any standable cell whose centre is within 2.0 m of the
  target centre. Build time = `buildS` (table 2.2) / workSpeed.
- **REPAIR:** rate `maxHp / 8` per s (07: one block per 8 s).
- **Fear gate:** masons refuse BUILD/REPAIR within 6 m of an enemy impact in the last 5 s unless
  morale >= 60; if a castle has had no repair progress for 30 s, the gate lifts for its highest
  priority job (anti-deadlock).
- **Weapon designations** are one BUILD job of 20 s (wall weapon) or 30 s (ground weapon).
- **HAUL_AMMO:** runner walks to the nearest reachable magazine cell, takes 2 loads (if stock),
  walks to the weapon's operator cell, deposits into the 2-load buffer.

### 4.4 Pathfinding

- Standable cell: cell is air, door, ladder or stairs; the cell above is non-solid (2 m headroom);
  and the cell below is walk-on (table 2.2) or the cell itself is stairs/ladder.
- Moves: 4-neighbour horizontal (cost 1.0; through door 1.5), stairs up/down along facing (2.0),
  ladder up/down within the ladder column (3.0), step down 1 cell (1.5). No diagonals, no jumping
  up. Same rules for every NPC, AI or human castle.
- A* with Manhattan heuristic, ties broken by f, then h, then cell index. Max 2048 expansions per
  search, max 8 searches per castle per tick (queue, FIFO by NPC id), at most one replan per NPC
  per second. Paths are cell lists; NPCs move between cell centres at role speed.
- Block changes bump a per-plot `navVersion`; a walking NPC revalidates only its next 3 cells.

### 4.5 Gun crews

- Crew assigned to a weapon stand on the operator cell and the free standable cells within 2 m
  of the weapon (no per-crew-member slot geometry beyond that).
- **Auto-fire** (`Feuer frei`, per weapon, toggled in weapon view with F): when loaded the crew
  fires at the weapon's current aim. This is how a human runs more guns than he can man. AI uses
  the same command.

### 4.6 Morale (one number M in 0..100 per castle, start 70)

Two layers (DF slow baseline, research/07): fast layer F takes all inputs and relaxes toward B
with tau = 30 s; baseline B moves toward F by at most 0.05/s. `M = 0.7*F + 0.3*B`.

| input | effect on F |
|---|---|
| own crew/runner/mason killed | -2 each |
| own civilian killed | -1 each |
| death penalties, total | capped at -15 per rolling 10 s window |
| enemy projectile damages a palace block | -4 per projectile |
| our projectile damages enemy blocks | +2 per projectile |
| enemy blocks destroyed by our projectile | +0.5 each, cap +3 per projectile |
| enemy weapon destroyed | +5 |
| enemy NPCs killed by our projectile | +0.5 each, cap +3 per projectile |
| under fire (enemy impact in our plot in last 10 s) | -0.1 /s |
| own palace integrity < 50% | -0.2 /s |
| shelter ordered and >= 80% of civilians sheltered | +0.05 /s |
| **rally:** first damaging hit after M < 30 | +15, at most once per 60 s |

**Effects**
- workSpeed: M >= 70 -> 1.1; 40-70 -> 1.0; 20-40 -> 0.8; < 20 -> 0.5. Leadership: +0.1 for NPCs
  within 8 m of their own ruler (cap 1.2).
- Flee: an NPC flees to the nearest shelter cell when M < its threshold; returns when M >
  threshold + 15 (hysteresis).
- Desertion: M < 15 for > 20 s -> one NPC (highest id civilian, else runner, mason, crew) deserts
  every 10 s.
- Surrender: section 3.7.

**Spiral guards:** F and B never drop below 8 from inputs (only the surrender clock ends a castle);
the death cap; the rally; desertions and surrender do not feed back into M; each death counts once.

### 4.7 Shelter

Shelter cells: map-defined (`CastleDef.shelters`), plus any standable cell with at least 2 solid
blocks above it within 6 cells. `X` toggles shelter: civilians (and runners not carrying) walk to
the nearest free shelter cell (1 person per cell) and stay until `X` again. Fleeing NPCs use the
same target selection.

### 4.8 Ruler orders (first person: reticle + one key each)

| key | target under reticle | effect (command) |
|---|---|---|
| E | own weapon within 3 m | man it / leave it (enters weapon view) |
| Q | own weapon within 24 m | order crew to man it (CREW job, priority 3) / release crew |
| R | own block within 24 m | repair priority 3 |
| R | own weapon within 24 m | ammo priority 3 |
| B | - | toggle build mode (ghost on targeted face); 1-9 or wheel picks block; LMB designate; RMB cancel designation or designate demolish |
| G | - | toggle weapon placement mode (ghost weapon, valid mount check, cost shown) |
| X | - | shelter toggle |
| Tab (hold) | - | show all job markers: orange repair, blue build, green crew, n/N slot counts, red "unreachable"; path line of the claimant under the reticle |

Designations only inside the own plot; at most 64 open designations; cost reserved at designation.

---

## 5. Player and camera

- **First person only.** `PointerLockControls` from `three/addons` for mouse look; the browser
  side turns look and keys into integer commands every tick; the ruler body lives in the sim.
- Body: capsule r 0.3 m, h 1.75 m, **eye 1.60 m**; collision resolved as a 0.6 x 1.75 x 0.6 AABB
  swept per axis against cell boxes (Minecraft method). Stairs collide as two boxes (lower half
  cell, rear upper half); auto-step 0.55 m. Capsule semantics are kept for being hit (3.6).
- Speeds: **walk 4.0 m/s, sprint 6.0 m/s** (Shift), ladder 2.0 m/s (forward on a ladder cell
  climbs, Space jumps off). Gravity for the ruler 24 m/s^2, jump 7.9 m/s (apex 1.30 m: one block
  up, as Minecraft). Doors pass. Falls as 3.6.
- Camera: vertical **FOV 60 deg**, near 0.1 m, far 1500 m, fog linear 300-900 m (biome colour).
  Pitch clamp +-89 deg. Head bob 0.03 m at 2 Hz while walking (render-only, off in goldens).
- **Weapon view** (E at a weapon): camera at the weapon's `Sight` node (default 2.0 m behind and
  1.25 m above the yaw pivot, `TUNING.ruler.sightBackM/sightUpM`; amended 2026-10-17, the earlier
  1.2/0.6 put the eye at barrel height), tilted `TUNING.ruler.weaponViewPitchDeg` (-4 deg), FOV 50 deg,
  follows the yaw/pitch nodes. Controls: arrows/WASD
  adjust direction/range per 3.3, Ctrl x10, mouse drag on the readouts, hold RMB free look
  (returns on release, EN p.28), Space fire, Home restore, hold End impact view, F auto-fire,
  E or Esc leave. **Phase 1 (amended 2026-10-17):** the weapon view aims and fires only the weapon
  the ruler mans; PgUp/PgDn produce no remote (unmanned) aiming. Remote command of crewed weapons
  through PgUp/PgDn (EN p.58) returns with crews in Phase 2.
  Crosshair: vertical line on the azimuth, cross at the predicted impact.
- **Impact view:** camera 30 m behind and 20 m above the last impact on the weapon's azimuth,
  looking at it; crosshair on the impact (shot 12).
- **Death:** 3 s death cam (camera drops to 0.3 m and rolls 70 deg), then the end screen, or
  ghost view if other castles remain and the user picks "watch".
- Esc outside weapon view: pause menu (pointer lock released). Pointer lock is unavailable in
  headless tests; goldens drive the camera through the debug API (7.6).

---

## 6. AI opponents and slots

### 6.1 Slots

`Slot { id 0-3, castleId, team, color, controller: 'ai' | 'local' | 'remote', aiLevel 1-10,
aiTactic: 'worrier' | 'general' | 'daredevil' }` (levels and tactics from EN pp.12, 15). Max 4
slots (shot 02). The sim only sees per-slot command streams; a controller is a command source.
Swapping a slot's controller mid-match changes nothing in sim state.

### 6.2 AI controller (`src/ai/`, reads `SimView`, writes commands only)

- **Same rules as the player:** the AI has a mortal ruler (stays on the palace throne cell), uses
  the same commands, costs, crews, reload and morale. It reads the full public world (every block
  is visible in 3D to a human too), its own impacts, wind as shown on the HUD; never the enemy's
  jobs, morale or aim.
- **Aim.** First solution from geometry (azimuth to target, flat range / 5 m), plus error
  `sAz0 = 0.4 deg * (11 - L)`, `sR0 = 1.5% * (11 - L)`. After each own shot at the same target,
  measure the miss in (azimuth, range) from the real impact and correct by
  `alpha = 0.4 + 0.06 L` of it, plus noise `sigma_k = max(sigma0 * 0.6^k, sigmaMin)`,
  `sigmaMin = 0.008 deg * (11 - L)^2`. A wind change sets `k = max(0, k - 2)`. Per-weapon wind
  bias is remembered for the next target in the same castle (levels >= 4). Fire delay after
  loaded: `(11 - L) * 0.5 s`. Target: level 10 hits a 3x3 m target at 192 m within 6 shots in
  zero wind (median of 20 seeds); level 1 does not within 20 shots (EN p.12 "barn door").
- **Targeting.** Score = value x tactic weight; value palace block 10, enemy weapon 8, magazine 7,
  wall cell shielding the palace on the line of fire 4, crew cluster (>= 3 NPCs within 2 m) 3.
  Weights: daredevil palace x1.5; general weapon x1.5; worrier weapon x1.2. Straight weapons need
  a clear DDA line to the target; lobbed do not. Retarget every 60 s or on target destruction.
- **Building.** The castle's initial layout is the AI's blueprint. Every 2 s: designate up to 4
  missing blueprint cells, nearest to the palace first, while gold >= reserve (worrier 300,
  general 500, daredevil 800). Worrier spends up to 60% of income on repairs and rebuilds;
  daredevil up to 20%. Replace lost weapons at `CastleDef.mountSpots` when gold >= cost + reserve.
- **Crews.** Order crew to every weapon (priority by weapon value), auto-fire on. Shelter on when
  M < 35 and >= 3 enemy impacts in the last 10 s; off when neither holds for 20 s.
- Budget: AI think <= 1 ms per slot per think tick.

### 6.3 Humans in slots

- Phase 4: any slot can be `local`. **Hot-seat** follows the original (EN p.17): two local humans
  alternate the keyboard every 30 s while time runs; the inactive human's ruler stands where he
  was, crews keep auto-fire, and no AI acts for him.
- **Lockstep requirements** (proved in-process in Phase 4, transport later): identical builds and
  plugin sets (registry hash exchanged at start); seed and slot table exchanged; commands stamped
  with tick and an input delay of 3 ticks (100 ms); every 30 ticks peers compare `sim.hash()`;
  mismatch = desync, halt with both serialised states written for diffing. Everything in 3.1 is
  the precondition: fmath only, seeded streams, integer commands, id-ordered iteration, no
  wall-clock reads, no iteration over object keys created in non-deterministic order.

---

## 7. Rendering and look

### 7.1 Target

three.js pinned at **0.186.1** (package.json is authoritative). Logical frame **1024 x 768**,
4:3, scaled uniformly to the window with letterbox or pillarbox; the 3D view fills the whole frame
and the HUD frame overlays it like the original. `antialias: false`, `outputColorSpace =
SRGBColorSpace`, `toneMapping = NoToneMapping`, pixel ratio 1. Budgets: 60 fps on Intel Iris Xe at
1024 x 768, <= 250 draw calls, <= 300k triangles, no per-frame allocations in hot loops.

### 7.2 Light and materials

- `MeshLambertMaterial` everywhere, vertex colours carry baked light, texture atlas 2048 px with
  128 px tiles and 8 px gutters, `LinearMipmapLinearFilter`, anisotropy 1, max 4 mip levels.
- One sun (`DirectionalLight`, biome-specific direction and colour) + `HemisphereLight`.
  **No real-time shadow maps.** Blocks get per-vertex AO (Minecraft 3-neighbour rule) and a sun
  visibility term per face computed at mesh time by a 32-step DDA toward the sun: towers cast
  shadows across courtyards (shot 16) and shadows update when chunks remesh. People and weapons get
  blob shadows (one instanced dark radial quad each; the rip's `Shadows/` set is the reference).
- Sky: painted cumulus dome texture (shot 04), 3 slow cloud layers (rip `Wolken/` as reference).
- Particles: instanced camera-facing quads, pool of 2000; fire, muzzle flash, explosions additive
  (shot 17); smoke, dust, debris normal blend (shots 09, 12). Debris: 30-60 instanced 0.3 m cubes
  per destroyed block, ballistic, no collision, 2 s.

### 7.3 Blocks: chunked face-culled meshing (chosen)

Chunks of 16 x 16 x 16 cells (a plot = 3 x 2 x 3 = 18 chunks, the top layer 8 tall). Each block
type has a **block model**: a list of faces, each tagged with a cull direction (`px nx py ny pz
nz` or `none` for greebles inside the cell). The mesher emits a face only if the neighbour in its
cull direction is not opaque; output is one `BufferGeometry` per chunk per atlas material
(position, normal, uv, color with AO x sun x damage tint). The mesher core is pure JS producing
typed arrays (node-testable); `render/chunks.js` only wraps them.

Why not greedy meshing: merged quads cannot carry per-block skins, per-vertex AO, damage tint or
greebled models. Why not `InstancedMesh` per block type: whole-cube instances cannot drop hidden
faces, cannot bake per-face AO and sun, and cost one draw call per type per variant. Chunked
face-culling gives <= 18 draw calls per castle, skins with greebles, and local rebuilds.
Budget: remesh of one chunk <= 2 ms; at most 2 remeshes per frame (dirty queue, nearest first).
Damage states 1-3: vertex tint 0.9/0.8/0.7 plus a crack overlay atlas tile.

### 7.4 People and weapons

- **NPCs: skinned low-poly meshes (<= 300 tris, one shared skeleton, `SkeletonUtils.clone`)**
  for the 48 nearest NPCs within 40 m, clips `idle walk run carry work climb die`; beyond 40 m an
  instanced 8-direction billboard (rendered from the same Blender rig), one draw call. Chosen
  because in first person crews stand within 2 m of the camera (billboards fail there) while the
  enemy castle's people are 3-6 px tall at 150-220 m (meshes are wasted there). Role read by tunic
  colour: crew red, runner yellow, mason grey, civilian brown; castle colour on hat band.
- Weapons: GLB with node tree `Base`, `Yaw`, `Pitch`, `Muzzle`, `Sight`, optional `Arm` for
  throwing weapons (rip part naming: Gestell/Drehkranz/Rohr/Balken). Triangle budgets: weapon
  <= 1500, block skin <= 12 plain / <= 96 greebled, tree <= 150, ruler hands view model <= 400.

### 7.5 HUD and menus

Re-drawn (never ripped) art at 1024 x 768, laid out from shots 03, 04, 12, 16. Rects (+-4 px,
exact values measured in Phase 0 into `src/ui/layout.js`):

| element | rect x0,y0-x1,y1 | ours |
|---|---|---|
| top counters | chest 272,8-305,36; pop 478; weapons 652 | gold, population (start), weapons (cap) |
| compass | centre 908,110, r 68; N/O/S/W letters outside | heading, wind number in hub, red/blue arrows, enemy crown icons |
| info box top-left | 0,0-262,108 | messages (no tutorial) |
| right column | 1000,228-1024,528, 10 round buttons | menu (pause, options, quit) |
| left minimap | frame 0,562-210,768; inner 22,582-186,748 | own castle top-down: green blocks, blue weapons, redder = damaged |
| right minimap | frame 815,562-1024,768; inner 838,582-1002,748 | targeted enemy castle, grey impact craters, edge arrow on miss |
| console | 213,565-812,768 | weapon view: readouts 448,598-572,622; arrow pad centre 511,676 r 48, fire 511,676 r 14; reload bar 240,624-416,646 ("Laedt nach"); weapon bar 604,624-782,646 ("Kanone (100%)"); buttons 232,660-424,688 / 232,694-424,722 / 598,660-790,688 / 598,694-790,722 = Feuer frei / Mannschaft / Zuruecksetzen / Trefferansicht; info bar 230,732-800,758 |
| console, walking | same frame | the original's tax widget shows **morale** (number + band colour); shield emblem; selected block/designation name and cost in the left bar |

Language: German default (matches the reference shots and goldens), English selectable;
strings in `src/ui/i18n.js`. Bitmap-style fonts re-drawn after the rip's `Images/Fonts` look.
Menus (800 x 600 originals, shots 01, 02): main menu and a one-page skirmish setup with the
shot 02 controls that are in scope (slots, AI level, tactic, start gold, wind strength, wind
change, map, biome).

### 7.6 Asset pipeline and golden QA

- **Blender 4.5.14 LTS** pinned (`~/Apps/blender-4.5.14-linux-x64/blender`), headless
  `blender -b --python-exit-code 1 --python tools/blender/<x>.py -- <args>`; every script asserts
  `bpy.app.version == (4, 5, 14)`, prefers `bpy.data`/`bmesh` over `bpy.ops`, bakes textures at
  512 px into the atlas, exports GLB (Y-up, apply modifiers) into `assets/`. glTF validated in
  `npm test` by a structural check (node names, triangle budgets, texture sizes).
- **Goldens:** Playwright (`playwright-core` 1.64.1) + headless Chromium with SwiftShader only
  (`--use-angle=swiftshader --enable-unsafe-swiftshader`, never `--disable-gpu`), 1024 x 768,
  deviceScaleFactor 1, `?golden=1`. Debug hook `window.__hohenfeuer` (amended 2026-10-17):
  `ready` is a **boolean** (scaffold convention, set true after loading), plus `scene, camera,
  renderer, sim, state` (live SimView), `events`, `mode`, `setPose(pose)`, `stepTo(tick)`,
  `issue(cmd)` (queued for the next tick; tick and seq filled in), `render()`, `info()`,
  `timeFrames(n)`. No rAF-driven sim time in golden mode. Poses live in `tests/goldens/poses.json`,
  one object per golden: `page` (default the root page), `width`, `height`, camera `position`,
  `yaw`, `pitch` (radians, three.js Euler YXZ; required for every pose because tools/blender reads
  them), optional `fov`, and for scripted game poses `script: "tb1"`, `until: "ball-near-enemy" |
  <tick>`, `camera: "rig"` (the player camera rig decides; position/yaw/pitch then serve Blender
  only). Current goldens: `tb1-spawn`, `tb1-first-shot`, `rampart-north`, `weapon-view-cannon`,
  `hud-weapon-view`, `hud-walking`, `example-wall`.
- Two gates: (a) **regression** of our own frames: pixelmatch threshold 0.1, max diff 0.1% of
  pixels (`scripts/goldens.mjs`; in practice 0 px on the SwiftShader path); a golden is updated by
  deleting its PNG and rerunning `npm run goldens`, in a commit that contains the new PNGs and
  nothing else. (b) **likeness** to the 2001 reference shots (`research/
  screenshots-myabandonware/`, and originals captured under wine into `assets-ripped/
  goldens-original/`): HUD-only render over flat magenta vs reference with the 3D view masked:
  **hard gate: mean absolute error <= 20/255 after an 8 px Gaussian blur of both images**; SSIM on
  grayscale is reported as advice only (amended 2026-10-17: lane E measured SSIM 0.12 and blurred
  MAE 31/255 for `hud-weapon-view`, so the HUD art does not pass the gate yet); 3D view: 128 x 96 colour-histogram
  chi-square gate, SSIM on 256 x 192 reported (target >= 0.5), plus a vision-model rubric score
  (silhouette, palette, roof colour, stone scale, shadow direction; 1-5, target mean >= 4) as
  advice, never as a pass/fail gate alone.

---

## 8. Plugin architecture

### 8.1 Registration

`src/contracts.js` (orchestrator-owned) exports enums (`BLOCK`, `ROLE`, `JOB`, `CMD`, `EV`,
`MOUNT`, `TRAJ`), constants (`K`: grid sizes, DT, substeps), JSDoc typedefs below, and the
registries:

```
registerPlugin(kind, def)   registerView(kind, id, view)          // kind: PLUGIN_KIND
registerBlock registerWeapon registerNpcType registerCastle registerMap registerBiome
registerSpell (reserved: always throws)
registerBlockView(key, v) registerWeaponView(id, v) registerNpcView(id, v) registerBiomeView(id, v)
validate{Block,Weapon,NpcType,Castle,Map,Biome}Plugin(def)   validate{Block,Weapon,Npc,Biome}View(id, v)
validateCommand(cmd) (fields per CMD_FIELDS)   validateSlot(slot)   ContractError
freezeRegistries() -> registryHash   isFrozen()   registryHash()
getBlock(id) getBlockByKey(key) getWeapon getNpcType getCastle getMap getBiome getView(kind, id)
listPlugins(kind)   resetRegistriesForTests()                      // tests only
```

Each plugin is a folder with a pure `*.sim.js` (registers the sim def; imports only
`src/contracts.js`) and an optional `*.view.js` (registers the view; may import three).
`src/plugins/index.sim.js` and `src/plugins/index.view.js` import every plugin, one line each.
Node tests import only `index.sim.js`. Registration validates required fields and throws on
duplicates or unknown keys. Lifecycle: import index files -> `freezeRegistries()` (cross-checks
references such as castle legend keys, map castles and biomes, views without defs; returns the
registry hash over sim defs only) -> `createSim` (builds range tables) -> ticks -> `dispose`.

### 8.2 The sim API handed to hooks (`SimApi`, no three.js, deterministic)

```
api.tick, api.rng(stream)                        // sfc32 stream: 'scatter' | 'fire' | 'npc'
api.getBlock(world xyz) -> { id, hp, meta, plot } | null
api.damageBlock(xyz, dp, sourceSlot)  api.setBlock(xyz, id, meta)
api.applyBlast({ pos, direct, splash, radius, sourceSlot, ignite })   // section 3.6 rules
api.damagePeople({ pos, radius, peak, sourceSlot })
api.spawnProjectile({ pos, vel, radius, k, payload, sourceSlot, weaponId })
api.emit(EV.X, payload)                           // render/audio events
api.windAt(pos) -> { x, z }   api.castleOf(slot)
```

### 8.3 Shapes

```
BlockDef {
  id: 64-255 (core: BLOCK enum), key: 'stone', name: { de, en },
  hp, cost, buildS, solid, walkOn, passable, projectileSolid, climbable, burnable,
  oriented: false | 'h4', collider: 'cube' | 'stairs' | 'none', mapOnly,
  onDestroyed?(api, cell)              // e.g. magazine explosion
}
BlockView { model: 'assets/blocks/stone.glb' | null, tiles: { top, side, bottom },
  faces?: [{ cull: 'px'|...|'none', positions, uvs }], variants: 1-4, crackTile }

WeaponDef {
  id: 'cannon', name: { de, en }, mount: MOUNT.WALL | MOUNT.GROUND, footprint: [w, d, h],
  cost, hp, reloadS, crewSlots, fireCost, ammoLoads: 1,
  traj: TRAJ.STRAIGHT | TRAJ.LOBBED, elevDeg: [min, max], v0, k, scatter: { azDeg, vFrac },
  shot: { count, intervalS, spreadDeg, radius, direct, splash, splashRadius, ignite, pierce },
  variantOf?: 'catapult',              // data variants (Long John etc.)
  onFire?(api, weapon) -> handled?     // default: spawn `count` projectiles per `shot`
  onImpact?(api, proj, hit)            // default: api.applyBlast from `shot`
  onTick?(api, weapon)
}
WeaponView { model: 'assets/weapons/cannon.glb', nodes: { yaw, pitch, muzzle, sight, arm? },
  fx: { muzzle, trail, impact }, sfx: { fire, impact },
  create?(ctx) -> { update(weaponState, alpha), dispose() } }   // ctx = { THREE, scene, assets, fx }

NpcTypeDef { id: 'gunner', name?, role: ROLE.CREW, hp: 100, speed: 3.0, carrySpeed: 2.0,
  climbSpeed: 1.0, jobs: [JOB.CREW, JOB.HAUL_AMMO], flee: { base: 10, spread: 10 },
  workMul: 1.0, share: 0.4, pickJob?(api, npc, jobs) -> jobId | null }
NpcView { model, tint, clips: { idle, walk, run, carry, work, climb, die }, billboard }

CastleDef { id, name?, size: [w, h, d], legend: { '#': 'stone', 'T': 'tower', ... },
  layers: [ [ 'row z0', 'row z1', ... ] /* y = 1 */, ... ],      // ASCII, one string per z row
  weapons: [{ id, at: [x, y, z], facing }], mountSpots: [[x, y, z, facing]],
  shelters: [[x0, y0, z0, x1, y1, z1]], workSpots: [[x, y, z]], exit: [x, y, z],
  rulerSpawn: [x, y, z], throne: [x, y, z], population: 40 }   // castle-local x 0..w-1, y 1..h, z 0..d-1
                                                    // block cost null is allowed only with mapOnly
MapDef { id, name: { de, en }, biome, size: [x, z], slots: [{ origin: [x, y, z] /* plot min
  corner, plots may not overlap */, facingDeg, castle }], terrain: { amp, octaves, ridge: { height, axis } }, water: { y } | null,
  wind: { strength, change }, startGold, weaponCap, suddenDeathS: null }
BiomeDef { id, terrainPalette, props }   BiomeView { sky, fog, sun, hemi, atlas, props }
SpellDef (reserved) { id, cost, durationS, cooldownS, onCast(api, slot, target), onTick, onEnd }
Command { type: CMD, slot, tick, seq, ...CMD_FIELDS[type] }   // integers; cells plot-local
SimView (sim.state)  { tick, seed, mapId, slots, castles[slot], rulers[slot], npcs, weapons, projectiles,
  wind, terrain, outcome, commandKinds }   // full field list: contracts.js typedefs SimView, SimCastle,
                                           // SimRuler, SimWeapon, SimProjectile; vectors are {x,y,z}
HudView              { lang, mode, gold, pop, weapons, heading, wind, enemies, weapon, morale, selection,
  shelterOn, messages, enemyLabel, minimapOwn, minimapEnemy, reticle, castleColor, menu }  // contracts.js HudView
META (plot meta byte) { FACING_MASK 0b11, VARIANT_MASK 0b1100, BURNING_BIT 1<<4, DESIGNATED_BIT 1<<5 }
```
`sim.state` is a fresh deep snapshot per access: read it once per tick and keep render-side
mirrors of the plots (src/main.js refreshes them on block events).

Renderer calls: `view.create(ctx)` once per entity, `update(state, alpha)` per frame,
`dispose()` on removal; it reads sim state only through `sim.state` snapshots and events.
Sim calls: `onFire`, `onImpact`, `onTick`, `onDestroyed`, `pickJob`.
A new weapon = one folder (`plugins/weapons/<id>/<id>.sim.js`, `<id>.view.js`, GLB) + one line in
each index + passing `tests/unit/plugin-weapon-conformance.test.js` (fires, lands, damages,
range table monotonic, all fields valid).

---

## 9. Module map and ownership

Pure = no DOM/three/clock/random; testable with `node --test` (`tests/unit/*.test.js`). Test
file prefixes: lane A `sim-`, B `npc-`, C `ai-`, D `render-`, E `ui-`, F `plugin-`; orchestrator
`rules-`, `contracts`, `tuning`, `smoke`. IO = browser; tested with Playwright (`tests/browser.mjs`, goldens).

```
src/contracts.js          orchestrator: enums, constants, typedefs, registries        pure
src/tuning.js             orchestrator: every number in this document                pure
src/main.js               orchestrator: boot, wire sim + render + input + ui           IO
src/core/rng.js           sfc32 + splitmix32 streams                                   pure  A
src/core/fmath.js         deterministic sin/cos/atan2/exp/log/pow                      pure  A
src/core/hash.js          FNV-1a over typed arrays and entity fields                   pure  A
src/core/loop.js          fixed-step accumulator, dt clamp, visibility pause           IO    A
src/world/grid.js         plot storage, get/set, world<->cell, DDA raycast             pure  A
src/world/terrain.js      heightfield generation and sampling                          pure  A
src/world/castle-load.js  CastleDef ASCII -> grid                                      pure  A
src/world/support.js      collapse flood fill                                          pure  A
src/sim/sim.js            createSim, tick order, commands, serialize, hash             pure  A
src/sim/ballistics.js     integrator, range tables, dial <-> elevation                 pure  A
src/sim/wind.js           wind random walk                                             pure  A
src/sim/damage.js         blasts, people damage, fire                                  pure  A
src/sim/weapons.js        reload, fire, crew gating, auto-fire                         pure  A
src/sim/ruler.js          ruler kinematics (AABB sweep, stairs, ladders, falls)        pure  A
src/sim/economy.js        income, costs, magazine restock                              pure  A
src/sim/rules.js          win/lose, stats                                              pure  A
src/npc/jobs.js           job list, emitters, claims, expiry                           pure  B
src/npc/path.js           standability, A*                                             pure  B
src/npc/brain.js          state machine, roles, draft, shelter, desertion              pure  B
src/npc/morale.js         two-layer morale and effects                                 pure  B
src/npc/kinematics.js     path following, speeds                                       pure  B
src/ai/controller.js      AI slot: think schedule, command output                      pure  C
src/ai/aim.js             aim error model and correction                               pure  C
src/ai/targets.js         target scoring                                               pure  C
src/ai/build.js           blueprint rebuild, weapon replacement, reserves              pure  C
src/ai/slots.js           slot table, controller swap, hot-seat timer, lockstep harness pure C
src/render/renderer.js    WebGLRenderer, scene, frame, letterbox                       IO    D
src/render/mesher.js      block-model face culling, AO, sun -> typed arrays            pure  D
src/render/chunks.js      chunk geometries, dirty queue                                IO    D
src/render/terrain-view.js, sky.js, water.js, props.js                                 IO    D
src/render/people-view.js skinned NPCs, billboards, blob shadows                       IO    D
src/render/weapon-view.js weapon models, yaw/pitch, muzzle                             IO    D
src/render/fx.js          particles, debris, decals                                    IO    D
src/render/assets.js      GLTFLoader cache                                             IO    D
src/render/debug-api.js   window.__hohenfeuer                                          IO    D
src/player/input.js       key/mouse map, pointer lock                                  IO    E
src/player/commands.js    input -> integer commands                                    pure  E
src/player/camera.js      FP, weapon, impact, death, ghost cameras                     IO    E
src/player/interact.js    reticle picking, designation ghost validity                  pure  E
src/ui/layout.js          HUD rects from 7.5                                           pure  E
src/ui/hud.js, compass.js, minimap.js, console.js, menus.js, font.js, i18n.js         IO    E
src/audio/sfx.js          WebAudio one-shots for EV events                             IO    E
src/plugins/index.sim.js, index.view.js                                                F
src/plugins/blocks/core.sim.js, core.view.js                                           F
src/plugins/weapons/<id>/<id>.sim.js, <id>.view.js                                     F
src/plugins/npcs/<id>.sim.js, <id>.view.js                                             F
src/plugins/maps/<id>.sim.js; plugins/castles/<id>.sim.js; plugins/biomes/<id>.*.js    F
tools/blender/*.py, assets/**                                                          D
```

**Parallel lanes** (no file overlap; every lane may read anything; each writes only its rows and
its own test prefix):

| lane | owns | first deliverable |
|---|---|---|
| A sim+world | src/core, src/world, src/sim | deterministic duel sim with cannon, headless |
| B npc | src/npc | jobs, A*, morale against a `SimView` stub from contracts |
| C ai+slots | src/ai | AI aim/targets/build on the sim; slot swap; lockstep harness |
| D render+assets | src/render, tools/blender, assets | mesher, chunks, look, goldens poses |
| E player+ui | src/player, src/ui, src/audio | FP controls, weapon view, HUD from 7.5 |
| F content | src/plugins | blocks, cannon, default castle and forest map; later full weapon set |

The orchestrator owns `contracts.js`, `tuning.js`, `main.js`, `index.html`, `package.json`,
`tests/browser.mjs`, `tests/lib.mjs`, `scripts/`, `docs/`. Cross-lane needs go through contracts
first (orchestrator adds the shape), then both lanes implement against it.

Lane entry points (signatures fixed in contracts; everything else is lane-internal):
`sim/sim.js createSim(opts)`; `npc/brain.js npcTick(api, castle)` and `npc/morale.js
moraleTick(api, castle)`, both called by the sim in tick steps 7-8; `ai/controller.js
aiThink(view, slot, rng) -> Command[]`, called by the sim in step 3; `player/commands.js
buildCommands(input, tick) -> Command[]`; `render/renderer.js createRenderer(canvas)` with
`.frame(state, alpha, events)`; `ui/hud.js createHud(canvas2d)` with `.draw(view)`.

---

## 10. Engineering rules

1. **Determinism.** Same map, seed, slot table and command log -> identical `sim.hash()` at every
   tick, in node and every browser. No `Math.random`, `Date`, `performance.now`, `Math.sin` etc.
   in pure modules (fmath only); id-ordered iteration; integer commands.
2. **No three.js in the sim.** Pure modules (section 9) never import three, the DOM or
   `*.view.js`. `tests/unit/rules-purity.test.js` greps imports and fails the build.
3. **Plugins register only through `src/contracts.js`.** No lane imports another lane's internals;
   only contracts, `sim.state`, events and each lane's declared entry file.
4. **Names come from contracts.** Event names, block ids, roles, job kinds, command types are
   `EV.*`, `BLOCK.*`, `ROLE.*`, `JOB.*`, `CMD.*`; no string literals for them anywhere else.
5. **Numbers come from `src/tuning.js`.** Tests reference tuning names, not literals.
6. **Clean-room.** No code from the GPL-3 Ballerburg SDL port or any other project; formulas are
   re-implemented from the research notes. Ripped assets (meshes, textures, fonts, HUD art, audio)
   are reference-only: they stay in `assets-ripped/`, are git-ignored, never imported by `src/`,
   never copied into `assets/` or `dist/`; `tests/unit/rules-cleanroom.test.js` fails if any
   file under `src/`, `assets/` or `dist/` references `assets-ripped` or `downloads`, or if an
   asset's sha256 matches a ripped file.
7. **`downloads/` and `assets-ripped/` are untrusted.** Never executed on the host (only inside
   the wine prefix); extracted into fresh directories; Python that reads them runs with `-I`.
8. **Pinned versions.** Exact versions in `package.json` (three 0.186.1, vite 8.3.4,
   playwright-core 1.64.1, pixelmatch 8.0.0, pngjs 7.0.0), lockfile committed; Blender 4.5.14
   asserted in every bpy script; Node 24.x.
9. **Red-green TDD.** Failing test first; red and green output kept as
   `tests/evidence/NN-name-{red,green}.txt`. Semantic goldens with manual citations
   (`tests/goldens/manual-behavior.json`, ids `G-W01` etc.) are written before the behaviour.
10. **Deterministic goldens.** SwiftShader only, 1024 x 768, DPR 1, no MSAA, seeded, stepped
    clock, head bob and particles' random jitter seeded; golden updates in their own commit with
    diff images.
11. **Performance.** Sim tick <= 4 ms with 4 castles x 40 NPCs on the dev laptop; 60 fps and
    <= 250 draw calls at 1024 x 768 on Iris Xe; chunk remesh <= 2 ms, max 2 per frame; no
    allocations in per-tick or per-frame hot loops.
12. **Files.** Plain JS ES modules with JSDoc, no TypeScript; each file opens with
    `// <path> - owns <one job>`; `node --check` passes on every file.

---

## 11. Phase plan

Each phase ends with all its acceptance tests green in `npm test` and `npm run test:browser`.

**Phase 0 - scaffold, rip, goldens.**
Deliver: scaffold (done in parallel), contracts v1 and tuning from this document, purity and
clean-room rule tests, rip inventory and Blender reference renders, HUD rect measurement,
SwiftShader golden harness with the debug API stub.
Acceptance: (1) `rules-purity` and `rules-cleanroom` tests pass and fail when perturbed;
(2) `contracts` freezes and rejects a duplicate plugin id; (3) a test cube scene renders at
1024 x 768 under SwiftShader, `WEBGL_debug_renderer_info` reports SwiftShader, golden matches;
(4) rip inventory lists palast, MauerKlein, MauerGross, TurmKlein, TurmGross, Burgtor, Kanone,
Katapult with measured dimensions and one reference turntable PNG each (git-ignored);
(5) Blender script prints and asserts 4.5.14.

**Phase 1 - playable duel vs AI: blocks, one cannon, no NPCs.**
Deliver: lane A sim, lane D mesher and look v1, lane E FP + weapon view + HUD, lane C AI aim and
targets, lane F core blocks, cannon, default castle, forest duel map.
Acceptance: (1) zero-wind, k = 0 projectile matches the analytic parabola within 0.5% of range;
(2) range tables monotonic, dial -> elevation -> dial round-trip within 0.1 unit; (3) DDA never
tunnels a 1 m wall at 150 m/s over 10,000 random shots; (4) wind walk reproducible per seed,
drift calibration of 3.4 within +-25%; (5) blast damage per 3.6 on a fixture grid; (6) cutting a
tower base collapses the tower; (7) ruler climbs stairs and ladders, cannot pass a 1-high gap,
falls when the floor is shot away; (8) AI level 10 hit rate per 6.2, level 1 misses per 6.2;
(9) AI-vs-AI 15-minute headless match on seed 1 ends with a winner, two runs give identical
hashes; (10) a cannonball through the ruler ends the game; palace < 30% ends the game;
(11) goldens `rampart-north`, `weapon-view-cannon`, `hud-weapon-view` stable; HUD likeness gate
of 7.6 passes for the weapon-view HUD against shot 04.

**Phase 2 - NPC roles and morale.**
Deliver: lane B complete, crews/runners/masons/civilians, reload formula, magazine logistics,
shelter, orders of 4.8, AI crews and shelter.
Acceptance: (1) A* fixtures: stairs, ladders, doors, step-down, no diagonal, 2 m headroom,
deterministic tie-break; (2) claim expiry on death, flee and broken path; unreachable marking;
(3) reload formula table for N = 3 with 0-3 crew and the ruler; cannot fire below minCrew without
the ruler; (4) destroying the magazine starves guns after their buffers; magazine explosion
radius per 2.2; (5) one unit test per morale input row, flee/return hysteresis, desertion,
surrender clock, floor 8, death cap -15/10 s, rally once per 60 s; (6) fear gate and its 30 s
anti-deadlock; (7) 160 NPCs average tick <= 4 ms; (8) AI-vs-AI with NPCs ends with a winner and
stable hashes; (9) golden `courtyard-palace` with NPCs at fixed tick.

**Phase 3 - full weapon set, designation building, look polish.**
Deliver: the 10 weapons of 3.5 as plugins, fire, designation build/demolish/weapon placement with
budget, desert/ice/volcano biomes, greebled block skins, NPC rig, HUD and menus to likeness.
Acceptance: (1) every weapon passes the conformance suite; adding a weapon touches only its folder
and the two index lines (checked by a test that lists plugin folders vs index lines);
(2) designation reserves gold, cancel refunds it, the 64 cap holds; masons build supported cells
first and never build into a person; (3) building continues under fire subject to the fear gate;
(4) fire burns and spreads only through burnable blocks with the seeded rate; (5) likeness gates of
7.6 for 5 poses per biome; VLM rubric mean >= 4 (advisory); (6) performance budgets of rule 11 at
the 4-slot map.

**Phase 4 - human slots.**
Deliver: slot table in the skirmish menu, controller swap, hot-seat, in-process lockstep harness.
Acceptance: (1) swapping a slot AI -> local -> AI mid-match leaves the hash identical to a replay
of the same command log; (2) two sim instances fed one command stream with 3-tick input delay
agree on the hash for 20,000 ticks; (3) a one-bit state perturbation is detected within 30 ticks
and both states are written; (4) hot-seat alternates every 30 s with time running and no AI acting
for the inactive human; (5) registry hash differs when a plugin set differs and the match refuses
to start.
