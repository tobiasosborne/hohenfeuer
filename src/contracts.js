// src/contracts.js - owns the cross-lane contract: enums, constants, typedefs, validators, plugin registries (orchestrator-owned).
// Pure: imports only src/tuning.js. Shapes follow docs/DESIGN.md sections 3, 4, 6 and 8.
// Lanes import names from here; nobody but the orchestrator edits this file.

import { TUNING } from "./tuning.js";

export const VERSION = 1;

/* ------------------------------------------------------------------ constants */

const W = TUNING.world;

/**
 * Structural constants (derived from TUNING; numbers live there).
 * Plot cell index: `i = x + PLOT_W * z + CELLS_PER_LAYER * y`, x,z in 0..47, y in 0..23.
 */
export const K = Object.freeze({
  TICK_HZ: TUNING.sim.tickHz,
  DT: 1 / TUNING.sim.tickHz,
  SUBSTEPS: TUNING.sim.substeps,
  SUBSTEP_DT: 1 / (TUNING.sim.tickHz * TUNING.sim.substeps),
  PLOT_W: W.plotW,
  PLOT_D: W.plotD,
  PLOT_H: W.plotH,
  CELLS_PER_LAYER: W.plotW * W.plotD,
  CELLS_PER_PLOT: W.plotW * W.plotD * W.plotH,
  CHUNK: W.chunk,
  MAX_SLOTS: W.maxSlots,
  CORE_BLOCK_MAX: TUNING.pluginBlockIdMin - 1,
  PLUGIN_BLOCK_MIN: TUNING.pluginBlockIdMin,
  MAX_BLOCK_ID: 255,
  HP_INDESTRUCTIBLE: TUNING.hpIndestructible,
  DIAL_UNIT_M: TUNING.aim.dialUnitM,
  AZ_UNITS: 360 * TUNING.aim.azUnitsPerDeg, // az command/aim units per turn (tenths of a degree)
  RANGE_UNITS_PER_DIAL: TUNING.aim.rangeUnitsPerDial,
  YAW_UNITS: 65536, // uint16 per full turn
  PITCH_LIMIT: 16384, // +-90 deg in yaw units
  MOVE_AXIS_MAX: 127, // int8 move axes
  LOGICAL_W: TUNING.render.logicalW,
  LOGICAL_H: TUNING.render.logicalH,
});

/* ------------------------------------------------------------------ enums */

/** Core block ids (DESIGN 2.2). Plugin blocks use 64..255. Key = lower-case enum name. */
export const BLOCK = Object.freeze({
  AIR: 0, STONE: 1, TOWER: 2, GATE: 3, WOOD: 4, FLOOR: 5, STAIRS: 6, LADDER: 7,
  DOOR: 8, ROOF: 9, MAGAZINE: 10, PALACE: 11, MOUNT: 12, FOUNDATION: 13,
});
const CORE_KEY_BY_ID = Object.freeze(Object.fromEntries(Object.entries(BLOCK).map(([k, v]) => [v, k.toLowerCase()])));

/** Plot `meta` byte layout (DESIGN 2.1): facing bits 0-1, shape/variant bits 2-3, burning bit 4, designated bit 5. */
export const META = Object.freeze({ FACING_MASK: 0b11, VARIANT_SHIFT: 2, VARIANT_MASK: 0b1100, BURNING_BIT: 1 << 4, DESIGNATED_BIT: 1 << 5 });

export const MOUNT = Object.freeze({ WALL: "wall", GROUND: "ground" });
export const TRAJ = Object.freeze({ STRAIGHT: "straight", LOBBED: "lobbed" });
export const COLLIDER = Object.freeze({ CUBE: "cube", STAIRS: "stairs", NONE: "none" });
export const FACING = Object.freeze({ N: 0, E: 1, S: 2, W: 3 });
export const ROLE = Object.freeze({ CREW: "crew", RUNNER: "runner", MASON: "mason", CIVILIAN: "civilian", RULER: "ruler" });
export const JOB = Object.freeze({
  BUILD: "build", REPAIR: "repair", DEMOLISH: "demolish", CREW: "crew", HAUL_AMMO: "haul-ammo", WORK: "work",
});
export const NPC_STATE = Object.freeze({
  IDLE: "idle", CLAIM: "claim", WALK: "walk", WORK: "work", FLEE: "flee", SHELTER: "shelter", DEAD: "dead",
});
export const CONTROLLER = Object.freeze({ AI: "ai", LOCAL: "local", REMOTE: "remote" });
export const TACTIC = Object.freeze({ WORRIER: "worrier", GENERAL: "general", DAREDEVIL: "daredevil" });
/** Elimination reasons (DESIGN 3.7), checked in this order. */
export const ELIM = Object.freeze({ PALACE: "palace", RULER: "ruler", SURRENDER: "surrender" });
export const CAMERA_MODE = Object.freeze({ WALK: "walk", WEAPON: "weapon", IMPACT: "impact", DEATH: "death", GHOST: "ghost" });
/** Seeded PRNG stream names (DESIGN 3.1); AI streams are `ai:<slot>`. */
export const RNG_STREAM = Object.freeze({ WIND: "wind", SCATTER: "scatter", NPC: "npc", AI: "ai", FIRE: "fire", MAP: "map" });
export const PLUGIN_KIND = Object.freeze({
  BLOCK: "block", WEAPON: "weapon", NPC_TYPE: "npcType", CASTLE: "castle", MAP: "map", BIOME: "biome", SPELL: "spell",
});

/**
 * Command types (DESIGN 3.1, 4.8, 5). Every command is
 * `{ type, slot, tick, seq, ...fields }` with integer fields only (string ids for weapon defs).
 * Field sets are in CMD_FIELDS; `validateCommand` enforces them.
 */
export const CMD = Object.freeze({
  MOVE: "move", MAN_WEAPON: "man-weapon", LEAVE_WEAPON: "leave-weapon", AIM: "aim", FIRE: "fire",
  RESTORE_AIM: "restore-aim", AUTO_FIRE: "auto-fire", DESIGNATE: "designate",
  DESIGNATE_WEAPON: "designate-weapon", CANCEL: "cancel", DEMOLISH: "demolish",
  REPAIR_PRIORITY: "repair-priority", AMMO_PRIORITY: "ammo-priority", ORDER_CREW: "order-crew",
  SHELTER: "shelter", SURRENDER: "surrender",
});

/**
 * Sim -> render/audio/ui events (drained once per tick via `sim.drainEvents()`).
 * Payloads (positions are world [x,y,z] metres; cells are plot-local [x,y,z]):
 *  SHOT_FIRED {slot, weaponId, pos, vel}           IMPACT {slot, weaponId, pos, hit: 'block'|'terrain'|'water'|'person'|'weapon'|'void'}
 *  BLOCK_DAMAGED {plot, cell, id, hp, state}       BLOCK_DESTROYED {plot, cell, id, sourceSlot}
 *  BLOCK_BUILT {plot, cell, id}                    COLLAPSE {plot, cells}
 *  MAGAZINE_EXPLODED {plot, cell, stock}           FIRE_IGNITED / FIRE_OUT {plot, cell}
 *  PERSON_DAMAGED {entityId, hp}                   NPC_DIED {entityId, role, castle, cause}
 *  RULER_DIED {slot, cause}                        WEAPON_DAMAGED {weaponId, hp}
 *  WEAPON_DESTROYED {weaponId, slot}               WEAPON_LOADED {weaponId}
 *  WEAPON_PLACED {weaponId, slot, defId}           WIND_CHANGED {speed, dirDeg, prevDirDeg}
 *  MORALE_BAND {castle, morale, band}              NPC_FLED / NPC_RETURNED / NPC_DESERTED {entityId, castle}
 *  JOB_CREATED / JOB_CLAIMED / JOB_DONE / JOB_UNREACHABLE {jobId, kind, castle}
 *  DESIGNATION_ADDED / DESIGNATION_CANCELLED {slot, cell, block}
 *  SHELTER_TOGGLED {slot, on}                      CASTLE_ELIMINATED {slot, reason: ELIM}
 *  GAME_OVER {winners: slot[], draw}               DESYNC {tick, localHash, remoteHash}
 *  RULER_THREAT {castle, fromCastle, fromWeapon, projectileId, impactPos, etaTicks}  (predicted at launch)
 *  WEAPON_IDLE {castle, weaponId, reason: IDLE_REASON, detail}  (emitted when the reason changes)
 *  PROJECTILE_LOST {slot, weaponId, projectileId, pos, reason: LOST_REASON}  (terminal event for a shot
 *    that ends without an impact: left the map, fell below ground or expired; pos is the last sim
 *    position, never a landing point)
 */
export const EV = Object.freeze({
  SHOT_FIRED: "shot-fired", IMPACT: "impact",
  BLOCK_DAMAGED: "block-damaged", BLOCK_DESTROYED: "block-destroyed", BLOCK_BUILT: "block-built",
  COLLAPSE: "collapse", MAGAZINE_EXPLODED: "magazine-exploded", FIRE_IGNITED: "fire-ignited", FIRE_OUT: "fire-out",
  PERSON_DAMAGED: "person-damaged", NPC_DIED: "npc-died", RULER_DIED: "ruler-died",
  WEAPON_DAMAGED: "weapon-damaged", WEAPON_DESTROYED: "weapon-destroyed", WEAPON_LOADED: "weapon-loaded",
  WEAPON_PLACED: "weapon-placed", WIND_CHANGED: "wind-changed", MORALE_BAND: "morale-band",
  NPC_FLED: "npc-fled", NPC_RETURNED: "npc-returned", NPC_DESERTED: "npc-deserted",
  JOB_CREATED: "job-created", JOB_CLAIMED: "job-claimed", JOB_DONE: "job-done", JOB_UNREACHABLE: "job-unreachable",
  DESIGNATION_ADDED: "designation-added", DESIGNATION_CANCELLED: "designation-cancelled",
  SHELTER_TOGGLED: "shelter-toggled", CASTLE_ELIMINATED: "castle-eliminated", GAME_OVER: "game-over",
  DESYNC: "desync",
  RULER_THREAT: "ruler-threat", WEAPON_IDLE: "weapon-idle",
  PROJECTILE_LOST: "projectile-lost",
});
/** Why a projectile ended without an impact; carried in EV.PROJECTILE_LOST. */
export const LOST_REASON = Object.freeze({
  OUT_OF_MAP: "out-of-map", BELOW_GROUND: "below-ground", EXPIRED: "expired",
});
/** Why a weapon is not firing right now; carried as weapon.idleReason and in EV.WEAPON_IDLE. */
export const IDLE_REASON = Object.freeze({
  NO_CREW: "no-crew", NO_AMMO: "no-ammo", NO_GOLD: "no-gold", OBSTRUCTED: "obstructed",
  DAMAGED: "damaged", RELOADING: "reloading", READY: "ready",
});
/** Alias kept from the scaffold; same object as EV. */
export const EVENTS = EV;

/* ------------------------------------------------------------------ typedefs */

/**
 * @typedef {{ de: string, en: string }} Name
 * @typedef {[number, number, number]} Vec3   world metres
 * @typedef {[number, number, number]} Cell   plot-local integer cell
 *
 * @typedef {object} BlockDef  DESIGN 2.2 / 8.3
 * @property {number} id  0..63 core (must match BLOCK), 64..255 plugin
 * @property {string} key  lower snake case
 * @property {Name} name
 * @property {number} hp  0..255, 255 = indestructible
 * @property {number|null} cost  gold; null only when mapOnly
 * @property {number} buildS
 * @property {boolean} solid @property {boolean} walkOn @property {boolean} passable
 * @property {boolean} projectileSolid @property {boolean} climbable @property {boolean} burnable
 * @property {false|'h4'} oriented @property {'cube'|'stairs'|'none'} collider @property {boolean} mapOnly
 * @property {(api: SimApi, cell: {plot: number, cell: Cell}) => void} [onDestroyed]
 *
 * @typedef {object} BlockView
 * @property {string|null} [model] GLB path of the block model
 * @property {{top: number|string, side: number|string, bottom: number|string}} tiles atlas tiles
 * @property {Array<{cull: 'px'|'nx'|'py'|'ny'|'pz'|'nz'|'none', positions: number[], uvs: number[]}>} [faces]
 * @property {number} variants 1..4
 * @property {number|string} [crackTile]
 *
 * @typedef {object} WeaponDef  DESIGN 3.5 / 8.3
 * @property {string} id kebab case @property {Name} name
 * @property {'wall'|'ground'} mount @property {[number, number, number]} footprint [w, d, h]
 * @property {number} cost @property {number} hp @property {number} reloadS @property {number} crewSlots
 * @property {number} fireCost @property {number} ammoLoads
 * @property {'straight'|'lobbed'} traj @property {[number, number]} elevDeg
 * @property {number} v0 m/s @property {number} k horizontal drag toward wind, 1/s
 * @property {{azDeg: number, vFrac: number}} scatter
 * @property {{count: number, intervalS: number, spreadDeg: number, radius: number, direct: number,
 *   splash: number, splashRadius: number, ignite: number, pierce: number}} shot
 * @property {string} [variantOf] base weapon id (Long John etc.)
 * @property {(api: SimApi, weapon: object) => boolean} [onFire]  return true if it spawned the shot itself
 * @property {(api: SimApi, proj: object, hit: object) => void} [onImpact]
 * @property {(api: SimApi, weapon: object) => void} [onTick]
 *
 * @typedef {object} WeaponView
 * @property {string} model
 * @property {{yaw: string, pitch: string, muzzle: string, sight: string, arm?: string}} nodes
 * @property {{muzzle: string, trail: string, impact: string}} fx
 * @property {{fire: string, impact: string}} sfx
 * @property {(ctx: {THREE: object, scene: object, assets: object, fx: object}) =>
 *   {update: (weaponState: object, alpha: number) => void, dispose: () => void}} [create]
 *
 * @typedef {object} NpcTypeDef  DESIGN 4.1 / 8.3
 * @property {string} id @property {Name} [name] @property {'crew'|'runner'|'mason'|'civilian'|'ruler'} role
 * @property {number} hp @property {number} speed @property {number} carrySpeed @property {number} climbSpeed
 * @property {string[]} jobs JOB values @property {{base: number, spread: number}} flee
 * @property {number} workMul @property {number} share 0..1 of population
 * @property {(api: SimApi, npc: object, jobs: Job[]) => (number|null)} [pickJob]
 *
 * @typedef {object} NpcView
 * @property {string} model @property {number|string} tint @property {string} billboard
 * @property {{idle: string, walk: string, run: string, carry: string, work: string, climb: string, die: string}} clips
 *
 * @typedef {object} CastleDef  DESIGN 8.3. Castle-local coords: x 0..w-1, y 1..h, z 0..d-1.
 * @property {string} id @property {Name} [name]
 * @property {[number, number, number]} size [w, h, d] within 48 x 24 x 48
 * @property {Object<string, string>} legend single char -> block key ('.' is always air)
 * @property {string[][]} layers layers[y-1][z] is a string of w chars
 * @property {Array<{id: string, at: Cell, facing: number}>} weapons
 * @property {Array<[number, number, number, number]>} mountSpots [x, y, z, facing]
 * @property {Array<[number, number, number, number, number, number]>} shelters inclusive boxes
 * @property {Cell[]} workSpots @property {Cell} exit @property {Cell} rulerSpawn @property {Cell} throne
 * @property {number} population 20..80
 *
 * @typedef {object} MapDef  DESIGN 2.3 / 8.3. World x/z in 0..size; slot origin = plot min corner.
 * @property {string} id @property {Name} name @property {string} biome @property {[number, number]} size
 * @property {Array<{origin: Vec3, facingDeg: number, castle: string}>} slots 1..4
 * @property {{amp: number, octaves: number, ridge: null|{height: number, axis: 'x'|'z'}}} terrain
 * @property {null|{y: number}} water @property {{strength: number, change: number}} wind
 * @property {number} startGold @property {number} weaponCap 2..8 @property {number|null} suddenDeathS
 *
 * @typedef {object} BiomeDef @property {string} id @property {Name} [name]
 * @property {object} terrainPalette @property {Array<object>} props
 * @typedef {object} BiomeView @property {object} sky @property {object} fog @property {object} sun
 * @property {object} hemi @property {object} atlas @property {Array<object>} props
 *
 * @typedef {object} SpellDef  RESERVED (out of scope, DESIGN 1). registerSpell throws.
 * @property {string} id @property {number} cost @property {number} durationS @property {number} cooldownS
 *
 * @typedef {object} Slot  DESIGN 6.1
 * @property {number} id 0..3 @property {string} castleId @property {number} team @property {number} color 0xRRGGBB
 * @property {'ai'|'local'|'remote'} controller @property {number} aiLevel 1..10
 * @property {'worrier'|'general'|'daredevil'} aiTactic
 *
 * @typedef {object} Command  `{type, slot, tick, seq, ...}`; see CMD_FIELDS.
 *
 * @typedef {object} Job  DESIGN 4.3
 * @property {number} id @property {string} kind JOB @property {number} castle
 * @property {{cell: Cell}|{weaponId: number}} target @property {number} priority 0..3
 * @property {string} role @property {number} slots @property {number[]} claimedBy
 * @property {boolean} reachable @property {number} blockedUntilTick @property {number} createdTick
 * @property {number} progress 0..1
 *
 * @typedef {object} SimApi  handed to plugin hooks and lane-internal tick functions (DESIGN 8.2)
 * @property {number} tick
 * @property {(stream: string) => (() => number)} rng  uniform [0,1) from a seeded stream
 * @property {(pos: Vec3) => ({id: number, hp: number, meta: number, plot: number}|null)} getBlock
 * @property {(pos: Vec3, dp: number, sourceSlot: number) => void} damageBlock
 * @property {(pos: Vec3, id: number, meta: number) => void} setBlock
 * @property {(b: {pos: Vec3, direct: number, splash: number, radius: number, sourceSlot: number, ignite?: number}) => void} applyBlast
 * @property {(b: {pos: Vec3, radius: number, peak: number, sourceSlot: number}) => void} damagePeople
 * @property {(p: {pos: Vec3, vel: Vec3, radius: number, k: number, payload: object, sourceSlot: number, weaponId: number}) => number} spawnProjectile
 * @property {(type: string, payload: object) => void} emit  type from EV
 * @property {(pos: Vec3) => {x: number, z: number}} windAt
 * @property {(slot: number) => object} castleOf
 *
 * @typedef {object} SimView  read-only snapshot for AI, player picking, render and ui (`sim.state`, a fresh deep copy per access)
 * @property {number} tick @property {number} seed @property {string} mapId @property {Slot[]} slots
 * @property {SimCastle[]} castles indexed by slot @property {SimRuler[]} rulers indexed by slot @property {object[]} npcs (Phase 2)
 * @property {SimWeapon[]} weapons by id @property {SimProjectile[]} projectiles
 * @property {{strength: number, change: number, speed: number, direction: number, previousDirection: number|null,
 *   previousUntil: number, changeId: number, shotVersions: Object<number, number>, time: number}} wind
 *   speed m/s, direction degrees the air blows toward (HUD via src/sim/wind.js windHud(wind, slot))
 * @property {{width: number, depth: number, spacing: number, origin: {x: number, z: number}, heights: Float64Array,
 *   plots: Array<{origin: number[], width: number, depth: number}>}} terrain
 * @property {null|{winners: number[], draw: boolean, tick: number}} outcome
 * @property {string[]} commandKinds CMD values the current phase accepts
 *
 * @typedef {object} SimPlot  GridView: {id, width, height, depth, origin: {x,y,z}, type, hp, meta: Uint8Array, navVersion}
 * @typedef {object} SimCastle
 * @property {number} id @property {number} slot @property {string} defId @property {SimPlot} plot
 * @property {number[]} palaceCells plot cell indices @property {number} initialPalaceHp
 * @property {{x: number, y: number, z: number}} rulerSpawn @property {{x: number, y: number, z: number}} throne
 * @property {number} gold @property {number} morale @property {number} population @property {number} initialPopulation
 * @property {boolean} shelter @property {boolean} eliminated @property {string|null} reason ELIM
 * @property {{shots: number, directHits: number, damageDp: number, damageGold: number, losses: number,
 *   ammoCosts: number, income: number, eliminatedTick: number|null}} stats
 * @typedef {object} SimRuler
 * @property {number} id @property {number} slot @property {{x: number, y: number, z: number}} pos feet, metres
 * @property {number} yaw uint16 units (clockwise from north) @property {number} pitch int16 units
 * @property {number} hp @property {boolean} grounded @property {number|null} manning weapon id
 * @typedef {object} SimWeapon
 * @property {number} id @property {number} slot @property {string} defId @property {{x: number, y: number, z: number}} pos feet
 * @property {number} hp @property {{az: number, range: number}} aim command units @property {{az: number, range: number}} lastAim
 * @property {number} reload seconds since the last shot (loaded at def.reloadS) @property {boolean} autoFire
 * @property {boolean} crewOrdered @property {number} ammo loads in the buffer
 * @property {null|{x: number, y: number, z: number}} lastImpact @property {null|{x: number, y: number, z: number}} predictedImpact
 * @typedef {object} SimProjectile
 * @property {number} id @property {{x: number, y: number, z: number}} pos @property {{x: number, y: number, z: number}} vel
 * @property {number} sourceSlot @property {number} weaponId @property {number} age seconds
 *
 * @typedef {object} HudView  lane E src/ui/hud.js createHud(canvas).draw(view); built by src/main.js each frame
 * @property {string} lang 'de'|'en' @property {string} mode CAMERA_MODE @property {number} [tick]
 * @property {number} gold @property {{now: number, start: number}} pop @property {{now: number, cap: number}} weapons
 * @property {number} heading camera heading, degrees clockwise from north
 * @property {{speed: number, dirDeg: number|null, prevDirDeg: number|null}} wind
 * @property {Array<{bearingDeg: number, ally?: boolean, color?: string}>} enemies
 * @property {null|{name: string, hpPct: number, az: number, range: number, reload: number, loaded: boolean,
 *   fireCost: number, affordable: boolean, autoFire?: boolean, crewOrdered?: boolean, restoreLit?: boolean}} weapon
 * @property {null|{value: number}} morale @property {null|{name: string, cost: number, valid?: boolean}} selection
 * @property {boolean} shelterOn @property {Array<{text: string, tone?: string}>} messages
 * @property {null|{title: string, name: string, castle: string, color?: string}} enemyLabel
 * @property {null|{w: number, d: number, codes: Uint8Array, craters?: Array<{x: number, z: number, r: number}>, missArrowDeg?: number|null}} minimapOwn
 * @property {null|object} minimapEnemy same shape as minimapOwn
 * @property {{predicted?: number[]}} reticle logical px of the predicted impact @property {string} [castleColor]
 * @property {null|object} [menu] src/ui/menus.js createMenu() state drawn on top
 *
 * @typedef {object} Sim  returned by `createSim({map, seed, slots})` (src/sim/sim.js)
 * @property {(commands: Command[]) => void} tick @property {SimView} state
 * @property {() => Array<{type: string, payload: object}>} drainEvents
 * @property {() => number} hash @property {() => Uint8Array} serialize
 *
 * Lane entry points (DESIGN 9):
 * @typedef {(opts: {map: string, seed: number, slots: Slot[]}) => Sim} CreateSim          src/sim/sim.js
 * @typedef {(api: SimApi, castle: object) => void} NpcTick                                 src/npc/brain.js npcTick
 * @typedef {(api: SimApi, castle: object) => void} MoraleTick                              src/npc/morale.js moraleTick
 * @typedef {(view: SimView, slot: Slot, rng: () => number) => Command[]} AiThink           src/ai/controller.js aiThink
 * @typedef {(input: object, tick: number) => Command[]} BuildCommands                      src/player/commands.js buildCommands
 * @typedef {(canvas: object) => {frame: (state: SimView, alpha: number, events: object[]) => void}} CreateRenderer  src/render/renderer.js
 * @typedef {(canvas2d: object) => {draw: (view: object) => void}} CreateHud                src/ui/hud.js createHud
 * Debug hook (render/debug-api.js, golden mode): `__hohenfeuer = { ready, load({map, seed, slots}),
 *   step(n), setPose(name | {pos, yaw, pitch, fov, mode}), render(), hash() }`.
 */

/* ------------------------------------------------------------------ validation helpers */

export class ContractError extends Error {
  constructor(message) { super(message); this.name = "ContractError"; }
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const show = (v) => (typeof v === "string" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.join(",")}]` : String(v));

/** Field checker bound to one label, e.g. `weapon "cannon"`. */
function checker(label) {
  const fail = (msg) => { throw new ContractError(`${label}: ${msg}`); };
  const at = (path) => `field "${path}"`;
  return {
    fail,
    req(obj, f, path = f) { if (obj[f] === undefined) fail(`${at(path)} is required`); return obj[f]; },
    keys(obj, allowed, prefix = "") {
      for (const k of Object.keys(obj)) if (!allowed.includes(k)) fail(`unknown field "${prefix}${k}"`);
    },
    num(path, v, { gt, min, max } = {}) {
      const ok = typeof v === "number" && Number.isFinite(v)
        && (gt === undefined || v > gt) && (min === undefined || v >= min) && (max === undefined || v <= max);
      if (ok) return;
      const range = gt !== undefined ? `> ${gt}` : min !== undefined && max !== undefined ? `in ${min}..${max}`
        : min !== undefined ? `>= ${min}` : max !== undefined ? `<= ${max}` : "finite";
      fail(`${at(path)} must be a number ${range} (got ${show(v)})`);
    },
    int(path, v, min, max) {
      const ok = Number.isInteger(v) && (min === undefined || v >= min) && (max === undefined || v <= max);
      if (ok) return;
      const range = max !== undefined ? `in ${min}..${max}` : `>= ${min}`;
      fail(`${at(path)} must be an integer ${range} (got ${show(v)})`);
    },
    oneOf(path, v, values) { if (!values.includes(v)) fail(`${at(path)} must be one of ${values.join(", ")} (got ${show(v)})`); },
    bool(path, v) { if (typeof v !== "boolean") fail(`${at(path)} must be a boolean (got ${show(v)})`); },
    str(path, v) { if (typeof v !== "string" || v.length === 0) fail(`${at(path)} must be a non-empty string (got ${show(v)})`); },
    fn(path, v) { if (v !== undefined && typeof v !== "function") fail(`${at(path)} must be a function`); },
    obj(path, v) { if (!isObj(v)) fail(`${at(path)} must be an object`); },
    id(path, v, re) { if (typeof v !== "string" || !re.test(v)) fail(`${at(path)} must match ${re} (got ${show(v)})`); },
    name(path, v) {
      if (!isObj(v) || typeof v.de !== "string" || typeof v.en !== "string" || !v.de || !v.en) {
        fail(`${at(path)} must be { de: string, en: string }`);
      }
    },
  };
}

function begin(kind, def, idField = "id") {
  if (!isObj(def)) throw new ContractError(`${kind}: definition must be an object`);
  return checker(`${kind} ${show(def[idField])}`);
}

const KEBAB = /^[a-z][a-z0-9-]*$/;
const SNAKE = /^[a-z][a-z0-9_]*$/;

function checkPos(c, path, v, size) {
  const [w, h, d] = size;
  if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isInteger)) c.fail(`field "${path}" must be an integer [x,y,z]`);
  const [x, y, z] = v;
  if (x < 0 || x >= w || y < 1 || y > h || z < 0 || z >= d) c.fail(`field "${path}" is outside the castle size (got ${show(v)})`);
}

/* ------------------------------------------------------------------ validators: sim defs */

const BLOCK_FIELDS = ["id", "key", "name", "hp", "cost", "buildS", "solid", "walkOn", "passable", "projectileSolid",
  "climbable", "burnable", "oriented", "collider", "mapOnly", "onDestroyed"];

/** @param {BlockDef} def */
export function validateBlockPlugin(def) {
  const c = begin("block", def, "key");
  c.keys(def, BLOCK_FIELDS);
  for (const f of BLOCK_FIELDS) if (f !== "onDestroyed") c.req(def, f);
  c.int("id", def.id, 0, K.MAX_BLOCK_ID);
  c.id("key", def.key, SNAKE);
  if (def.id <= K.CORE_BLOCK_MAX) {
    const want = CORE_KEY_BY_ID[def.id];
    if (want === undefined) c.fail(`block id ${def.id} is in the reserved core range 0..${K.CORE_BLOCK_MAX}`);
    if (want !== def.key) c.fail(`core block id ${def.id} must have key "${want}" (got ${show(def.key)})`);
  } else if (Object.values(CORE_KEY_BY_ID).includes(def.key)) {
    c.fail(`plugin block key "${def.key}" collides with a core block`);
  }
  c.name("name", def.name);
  c.int("hp", def.hp, 0, 255);
  for (const f of ["solid", "walkOn", "passable", "projectileSolid", "climbable", "burnable", "mapOnly"]) c.bool(f, def[f]);
  if (def.cost === null) { if (!def.mapOnly) c.fail(`field "cost" may be null only when mapOnly is true`); }
  else c.int("cost", def.cost, 0);
  c.num("buildS", def.buildS, { min: 0 });
  if (def.oriented !== false && def.oriented !== "h4") c.fail(`field "oriented" must be false or "h4" (got ${show(def.oriented)})`);
  c.oneOf("collider", def.collider, Object.values(COLLIDER));
  c.fn("onDestroyed", def.onDestroyed);
  return true;
}

const WEAPON_FIELDS = ["id", "name", "mount", "footprint", "cost", "hp", "reloadS", "crewSlots", "fireCost", "ammoLoads",
  "traj", "elevDeg", "v0", "k", "scatter", "shot"];
const WEAPON_OPTIONAL = ["variantOf", "onFire", "onImpact", "onTick"];
const SHOT_FIELDS = ["count", "intervalS", "spreadDeg", "radius", "direct", "splash", "splashRadius", "ignite", "pierce"];

/** @param {WeaponDef} def */
export function validateWeaponPlugin(def) {
  const c = begin("weapon", def);
  c.keys(def, [...WEAPON_FIELDS, ...WEAPON_OPTIONAL]);
  for (const f of WEAPON_FIELDS) c.req(def, f);
  c.id("id", def.id, KEBAB);
  c.name("name", def.name);
  c.oneOf("mount", def.mount, Object.values(MOUNT));
  const fp = def.footprint;
  if (!Array.isArray(fp) || fp.length !== 3 || !fp.every((n) => Number.isInteger(n) && n > 0)) {
    c.fail(`field "footprint" must be [w,d,h] positive integers (got ${show(fp)})`);
  }
  const want = def.mount === MOUNT.WALL ? TUNING.weaponRules.wallFootprint : TUNING.weaponRules.groundFootprint;
  if (fp.join() !== want.join()) c.fail(`${def.mount} weapons have footprint ${show(want)} (got ${show(fp)})`);
  c.int("cost", def.cost, 0);
  c.int("hp", def.hp, 1, 255);
  c.num("reloadS", def.reloadS, { gt: 0 });
  c.int("crewSlots", def.crewSlots, 1, 12);
  c.int("fireCost", def.fireCost, 0);
  c.int("ammoLoads", def.ammoLoads, 1, TUNING.weaponRules.bufferLoads);
  c.oneOf("traj", def.traj, Object.values(TRAJ));
  const e = def.elevDeg;
  if (!Array.isArray(e) || e.length !== 2 || !e.every(Number.isFinite) || e[0] >= e[1] || e[0] < -90 || e[1] > 90) {
    c.fail(`field "elevDeg" must be [min, max] with -90 <= min < max <= 90 (got ${show(e)})`);
  }
  if (def.traj === TRAJ.LOBBED && e[0] < 45) c.fail(`lobbed weapons need elevDeg[0] >= 45 (got ${e[0]})`);
  if (def.traj === TRAJ.STRAIGHT && e[1] > 45) c.fail(`straight weapons need elevDeg[1] <= 45 (got ${e[1]})`);
  c.num("v0", def.v0, { gt: 0 });
  c.num("k", def.k, { min: 0, max: 1 });
  c.obj("scatter", def.scatter);
  c.keys(def.scatter, ["azDeg", "vFrac"], "scatter.");
  c.num("scatter.azDeg", c.req(def.scatter, "azDeg", "scatter.azDeg"), { min: 0, max: 45 });
  c.num("scatter.vFrac", c.req(def.scatter, "vFrac", "scatter.vFrac"), { min: 0, max: 0.5 });
  c.obj("shot", def.shot);
  c.keys(def.shot, SHOT_FIELDS, "shot.");
  for (const f of SHOT_FIELDS) c.req(def.shot, f, `shot.${f}`);
  const s = def.shot;
  c.int("shot.count", s.count, 1);
  c.num("shot.intervalS", s.intervalS, { min: 0 });
  c.num("shot.spreadDeg", s.spreadDeg, { min: 0 });
  c.num("shot.radius", s.radius, { gt: 0 });
  c.num("shot.direct", s.direct, { min: 0 });
  c.num("shot.splash", s.splash, { min: 0 });
  c.num("shot.splashRadius", s.splashRadius, { min: 0 });
  c.num("shot.ignite", s.ignite, { min: 0 });
  c.int("shot.pierce", s.pierce, 0);
  if (def.variantOf !== undefined) c.id("variantOf", def.variantOf, KEBAB);
  for (const f of ["onFire", "onImpact", "onTick"]) c.fn(f, def[f]);
  return true;
}

const NPC_FIELDS = ["id", "role", "hp", "speed", "carrySpeed", "climbSpeed", "jobs", "flee", "workMul", "share"];

/** @param {NpcTypeDef} def */
export function validateNpcTypePlugin(def) {
  const c = begin("npcType", def);
  c.keys(def, [...NPC_FIELDS, "name", "pickJob"]);
  for (const f of NPC_FIELDS) c.req(def, f);
  c.id("id", def.id, KEBAB);
  if (def.name !== undefined) c.name("name", def.name);
  c.oneOf("role", def.role, Object.values(ROLE));
  c.num("hp", def.hp, { gt: 0 });
  for (const f of ["speed", "carrySpeed", "climbSpeed"]) c.num(f, def[f], { gt: 0 });
  if (!Array.isArray(def.jobs) || def.jobs.length === 0) c.fail(`field "jobs" must be a non-empty array`);
  def.jobs.forEach((j, i) => c.oneOf(`jobs[${i}]`, j, Object.values(JOB)));
  c.obj("flee", def.flee);
  c.keys(def.flee, ["base", "spread"], "flee.");
  c.num("flee.base", def.flee.base, { min: 0, max: 100 });
  c.num("flee.spread", def.flee.spread, { min: 0, max: 100 });
  c.num("workMul", def.workMul, { gt: 0 });
  c.num("share", def.share, { min: 0, max: 1 });
  c.fn("pickJob", def.pickJob);
  return true;
}

const CASTLE_FIELDS = ["id", "size", "legend", "layers", "weapons", "mountSpots", "shelters", "workSpots", "exit",
  "rulerSpawn", "throne", "population"];

/** @param {CastleDef} def */
export function validateCastlePlugin(def) {
  const c = begin("castle", def);
  c.keys(def, [...CASTLE_FIELDS, "name"]);
  for (const f of CASTLE_FIELDS) c.req(def, f);
  c.id("id", def.id, KEBAB);
  if (def.name !== undefined) c.name("name", def.name);
  const sz = def.size;
  const okSize = Array.isArray(sz) && sz.length === 3 && sz.every((n) => Number.isInteger(n) && n >= 1)
    && sz[0] <= K.PLOT_W && sz[1] <= K.PLOT_H - 1 && sz[2] <= K.PLOT_D;
  if (!okSize) c.fail(`field "size" must be [w,h,d] within ${K.PLOT_W}x${K.PLOT_H}x${K.PLOT_D} (got ${show(sz)})`);
  const [w, h, d] = sz;
  c.obj("legend", def.legend);
  for (const [ch, key] of Object.entries(def.legend)) {
    if (ch.length !== 1 || ch === ".") c.fail(`legend key ${show(ch)} must be one character other than "."`);
    c.id(`legend.${ch}`, key, SNAKE);
  }
  if (!Array.isArray(def.layers) || def.layers.length > h) c.fail(`field "layers" must be an array of at most ${h} layers`);
  def.layers.forEach((layer, y) => {
    if (!Array.isArray(layer) || layer.length !== d) c.fail(`layers[${y}] must have ${d} rows (got ${Array.isArray(layer) ? layer.length : show(layer)})`);
    layer.forEach((row, z) => {
      if (typeof row !== "string" || row.length !== w) c.fail(`layers[${y}][${z}] must have length ${w} (got ${typeof row === "string" ? row.length : show(row)})`);
      for (const ch of row) if (ch !== "." && def.legend[ch] === undefined) c.fail(`layers[${y}][${z}] uses ${show(ch)} which is not in legend`);
    });
  });
  if (!Array.isArray(def.weapons)) c.fail(`field "weapons" must be an array`);
  def.weapons.forEach((wp, i) => {
    c.obj(`weapons[${i}]`, wp);
    c.keys(wp, ["id", "at", "facing"], `weapons[${i}].`);
    c.id(`weapons[${i}].id`, wp.id, KEBAB);
    checkPos(c, `weapons[${i}].at`, wp.at, sz);
    c.int(`weapons[${i}].facing`, wp.facing, 0, 3);
  });
  if (!Array.isArray(def.mountSpots)) c.fail(`field "mountSpots" must be an array`);
  def.mountSpots.forEach((m, i) => {
    if (!Array.isArray(m) || m.length !== 4) c.fail(`field "mountSpots[${i}]" must be [x,y,z,facing]`);
    checkPos(c, `mountSpots[${i}]`, m.slice(0, 3), sz);
    c.int(`mountSpots[${i}][3]`, m[3], 0, 3);
  });
  if (!Array.isArray(def.shelters)) c.fail(`field "shelters" must be an array`);
  def.shelters.forEach((b, i) => {
    if (!Array.isArray(b) || b.length !== 6) c.fail(`field "shelters[${i}]" must be [x0,y0,z0,x1,y1,z1]`);
    checkPos(c, `shelters[${i}] min`, b.slice(0, 3), sz);
    checkPos(c, `shelters[${i}] max`, b.slice(3, 6), sz);
    if (b[0] > b[3] || b[1] > b[4] || b[2] > b[5]) c.fail(`field "shelters[${i}]" must have min <= max`);
  });
  if (!Array.isArray(def.workSpots)) c.fail(`field "workSpots" must be an array`);
  def.workSpots.forEach((p, i) => checkPos(c, `workSpots[${i}]`, p, sz));
  for (const f of ["exit", "rulerSpawn", "throne"]) checkPos(c, f, def[f], sz);
  c.int("population", def.population, TUNING.npc.populationMin, TUNING.npc.populationMax);
  return true;
}

const MAP_FIELDS = ["id", "name", "biome", "size", "slots", "terrain", "water", "wind", "startGold", "weaponCap", "suddenDeathS"];

/** @param {MapDef} def */
export function validateMapPlugin(def) {
  const c = begin("map", def);
  c.keys(def, MAP_FIELDS);
  for (const f of MAP_FIELDS) c.req(def, f);
  c.id("id", def.id, KEBAB);
  c.name("name", def.name);
  c.id("biome", def.biome, KEBAB);
  const sz = def.size;
  if (!Array.isArray(sz) || sz.length !== 2 || !sz.every((n) => Number.isInteger(n) && n > 0 && n <= 4096)) {
    c.fail(`field "size" must be [x,z] positive integers <= 4096 (got ${show(sz)})`);
  }
  if (!Array.isArray(def.slots) || def.slots.length < 1 || def.slots.length > K.MAX_SLOTS) {
    c.fail(`field "slots" must hold 1..${K.MAX_SLOTS} entries`);
  }
  def.slots.forEach((s, i) => {
    const p = `slots[${i}]`;
    c.obj(p, s);
    c.keys(s, ["origin", "facingDeg", "castle"], `${p}.`);
    const o = s.origin;
    if (!Array.isArray(o) || o.length !== 3 || !o.every(Number.isInteger)) c.fail(`field "${p}.origin" must be an integer [x,y,z]`);
    if (o[0] < 0 || o[2] < 0 || o[0] + K.PLOT_W > sz[0] || o[2] + K.PLOT_D > sz[1]) {
      c.fail(`field "${p}.origin" puts the ${K.PLOT_W}x${K.PLOT_D} plot outside the map (got ${show(o)})`);
    }
    c.num(`${p}.facingDeg`, s.facingDeg, { min: 0, max: 360 });
    c.id(`${p}.castle`, s.castle, KEBAB);
    for (let j = 0; j < i; j++) {
      const q = def.slots[j].origin;
      const overlap = o[0] < q[0] + K.PLOT_W && q[0] < o[0] + K.PLOT_W && o[2] < q[2] + K.PLOT_D && q[2] < o[2] + K.PLOT_D;
      if (overlap) c.fail(`slots[${i}] plot overlaps slots[${j}] plot`);
    }
  });
  c.obj("terrain", def.terrain);
  c.keys(def.terrain, ["amp", "octaves", "ridge"], "terrain.");
  c.num("terrain.amp", def.terrain.amp, { min: 0, max: TUNING.world.terrainAmpMaxM });
  c.int("terrain.octaves", def.terrain.octaves, 1, 8);
  const r = def.terrain.ridge;
  if (r !== null && r !== undefined) {
    c.obj("terrain.ridge", r);
    c.num("terrain.ridge.height", r.height, { min: 0, max: TUNING.world.ridgeMaxM });
    c.oneOf("terrain.ridge.axis", r.axis, ["x", "z"]);
  }
  if (def.water !== null) { c.obj("water", def.water); c.num("water.y", def.water.y); }
  c.obj("wind", def.wind);
  c.keys(def.wind, ["strength", "change"], "wind.");
  c.int("wind.strength", def.wind.strength, 0, 5);
  c.int("wind.change", def.wind.change, 0, 5);
  c.int("startGold", def.startGold, 0);
  c.int("weaponCap", def.weaponCap, TUNING.world.weaponCapMin, TUNING.world.weaponCapMax);
  if (def.suddenDeathS !== null) c.num("suddenDeathS", def.suddenDeathS, { gt: 0 });
  return true;
}

/** @param {BiomeDef} def */
export function validateBiomePlugin(def) {
  const c = begin("biome", def);
  c.keys(def, ["id", "name", "terrainPalette", "props"]);
  c.id("id", c.req(def, "id"), KEBAB);
  if (def.name !== undefined) c.name("name", def.name);
  c.obj("terrainPalette", c.req(def, "terrainPalette"));
  if (!Array.isArray(c.req(def, "props"))) c.fail(`field "props" must be an array`);
  return true;
}

/* ------------------------------------------------------------------ validators: views */

/** @param {string} key @param {BlockView} view */
export function validateBlockView(key, view) {
  const c = checker(`block view ${show(key)}`);
  if (!isObj(view)) c.fail("view must be an object");
  c.keys(view, ["model", "tiles", "faces", "variants", "crackTile"]);
  if (view.model !== undefined && view.model !== null) c.str("model", view.model);
  c.obj("tiles", c.req(view, "tiles"));
  for (const f of ["top", "side", "bottom"]) c.req(view.tiles, f, `tiles.${f}`);
  if (view.faces !== undefined && !Array.isArray(view.faces)) c.fail(`field "faces" must be an array`);
  c.int("variants", c.req(view, "variants"), 1, 4);
  return true;
}

/** @param {string} id @param {WeaponView} view */
export function validateWeaponView(id, view) {
  const c = checker(`weapon view ${show(id)}`);
  if (!isObj(view)) c.fail("view must be an object");
  c.keys(view, ["model", "nodes", "fx", "sfx", "create"]);
  c.str("model", c.req(view, "model"));
  c.obj("nodes", c.req(view, "nodes"));
  for (const f of ["yaw", "pitch", "muzzle", "sight"]) c.str(`nodes.${f}`, c.req(view.nodes, f, `nodes.${f}`));
  c.obj("fx", c.req(view, "fx"));
  for (const f of ["muzzle", "trail", "impact"]) c.str(`fx.${f}`, c.req(view.fx, f, `fx.${f}`));
  c.obj("sfx", c.req(view, "sfx"));
  for (const f of ["fire", "impact"]) c.str(`sfx.${f}`, c.req(view.sfx, f, `sfx.${f}`));
  c.fn("create", view.create);
  return true;
}

/** @param {string} id @param {NpcView} view */
export function validateNpcView(id, view) {
  const c = checker(`npcType view ${show(id)}`);
  if (!isObj(view)) c.fail("view must be an object");
  c.keys(view, ["model", "tint", "clips", "billboard"]);
  c.str("model", c.req(view, "model"));
  c.req(view, "tint");
  c.str("billboard", c.req(view, "billboard"));
  c.obj("clips", c.req(view, "clips"));
  for (const f of ["idle", "walk", "run", "carry", "work", "climb", "die"]) c.str(`clips.${f}`, c.req(view.clips, f, `clips.${f}`));
  return true;
}

/** @param {string} id @param {BiomeView} view */
export function validateBiomeView(id, view) {
  const c = checker(`biome view ${show(id)}`);
  if (!isObj(view)) c.fail("view must be an object");
  c.keys(view, ["sky", "fog", "sun", "hemi", "atlas", "props"]);
  for (const f of ["sky", "fog", "sun", "hemi", "atlas", "props"]) c.req(view, f);
  return true;
}

/* ------------------------------------------------------------------ validators: commands and slots */

const CELL = "cell";
const INT = (min, max) => ({ min, max });
const WEAPON_ID = INT(0, 0x7fffffff);
const BIT = INT(0, 1);

/** Per-type command fields. CELL = plot-local [x,y,z]; {min,max} = integer range; "defId" = weapon def id. */
export const CMD_FIELDS = Object.freeze({
  [CMD.MOVE]: { fwd: INT(-127, 127), strafe: INT(-127, 127), yaw: INT(0, 65535), pitch: INT(-16384, 16384), jump: BIT, sprint: BIT },
  [CMD.MAN_WEAPON]: { weaponId: WEAPON_ID },
  [CMD.LEAVE_WEAPON]: {},
  [CMD.AIM]: { weaponId: WEAPON_ID, az: INT(0, 3599), range: INT(0, 9999) },
  [CMD.FIRE]: { weaponId: WEAPON_ID },
  [CMD.RESTORE_AIM]: { weaponId: WEAPON_ID },
  [CMD.AUTO_FIRE]: { weaponId: WEAPON_ID, on: BIT },
  [CMD.DESIGNATE]: { cell: CELL, block: INT(0, 255), facing: INT(0, 3) },
  [CMD.DESIGNATE_WEAPON]: { weapon: "defId", cell: CELL, facing: INT(0, 3) },
  [CMD.CANCEL]: { cell: CELL },
  [CMD.DEMOLISH]: { cell: CELL },
  [CMD.REPAIR_PRIORITY]: { cell: CELL },
  [CMD.AMMO_PRIORITY]: { weaponId: WEAPON_ID },
  [CMD.ORDER_CREW]: { weaponId: WEAPON_ID, on: BIT },
  [CMD.SHELTER]: { on: BIT },
  [CMD.SURRENDER]: {},
});

/** @param {Command} cmd */
export function validateCommand(cmd) {
  if (!isObj(cmd)) throw new ContractError("command: must be an object");
  const spec = CMD_FIELDS[cmd.type];
  if (!spec) throw new ContractError(`command: unknown command type ${show(cmd.type)}`);
  const c = checker(`command ${cmd.type}`);
  c.keys(cmd, ["type", "slot", "tick", "seq", ...Object.keys(spec)]);
  c.int("slot", c.req(cmd, "slot"), 0, K.MAX_SLOTS - 1);
  c.int("tick", c.req(cmd, "tick"), 0);
  c.int("seq", c.req(cmd, "seq"), 0);
  for (const [f, s] of Object.entries(spec)) {
    const v = c.req(cmd, f);
    if (s === CELL) {
      const ok = Array.isArray(v) && v.length === 3 && v.every(Number.isInteger)
        && v[0] >= 0 && v[0] < K.PLOT_W && v[1] >= 0 && v[1] < K.PLOT_H && v[2] >= 0 && v[2] < K.PLOT_D;
      if (!ok) c.fail(`field "${f}" must be a plot cell [x,y,z] (got ${show(v)})`);
    } else if (s === "defId") c.id(f, v, KEBAB);
    else c.int(f, v, s.min, s.max);
  }
  return true;
}

/** @param {Slot} slot */
export function validateSlot(slot) {
  if (!isObj(slot)) throw new ContractError("slot: must be an object");
  const c = checker(`slot ${show(slot.id)}`);
  const f = ["id", "castleId", "team", "color", "controller", "aiLevel", "aiTactic"];
  c.keys(slot, f);
  for (const k of f) c.req(slot, k);
  c.int("id", slot.id, 0, K.MAX_SLOTS - 1);
  c.id("castleId", slot.castleId, KEBAB);
  c.int("team", slot.team, 0, K.MAX_SLOTS - 1);
  c.int("color", slot.color, 0, 0xffffff);
  c.oneOf("controller", slot.controller, Object.values(CONTROLLER));
  c.int("aiLevel", slot.aiLevel, TUNING.ai.levelMin, TUNING.ai.levelMax);
  c.oneOf("aiTactic", slot.aiTactic, Object.values(TACTIC));
  return true;
}

/* ------------------------------------------------------------------ registries */

const SIM_KINDS = [PLUGIN_KIND.BLOCK, PLUGIN_KIND.WEAPON, PLUGIN_KIND.NPC_TYPE, PLUGIN_KIND.CASTLE, PLUGIN_KIND.MAP, PLUGIN_KIND.BIOME];
const VIEW_KINDS = [PLUGIN_KIND.BLOCK, PLUGIN_KIND.WEAPON, PLUGIN_KIND.NPC_TYPE, PLUGIN_KIND.BIOME];
const VALIDATE = {
  [PLUGIN_KIND.BLOCK]: validateBlockPlugin, [PLUGIN_KIND.WEAPON]: validateWeaponPlugin,
  [PLUGIN_KIND.NPC_TYPE]: validateNpcTypePlugin, [PLUGIN_KIND.CASTLE]: validateCastlePlugin,
  [PLUGIN_KIND.MAP]: validateMapPlugin, [PLUGIN_KIND.BIOME]: validateBiomePlugin,
};
const VALIDATE_VIEW = {
  [PLUGIN_KIND.BLOCK]: validateBlockView, [PLUGIN_KIND.WEAPON]: validateWeaponView,
  [PLUGIN_KIND.NPC_TYPE]: validateNpcView, [PLUGIN_KIND.BIOME]: validateBiomeView,
};

function freshRegistry() {
  const defs = {}; const views = {};
  for (const k of SIM_KINDS) defs[k] = new Map();
  for (const k of VIEW_KINDS) views[k] = new Map();
  return { defs, views, blockByKey: new Map(), frozen: false, hash: null };
}
let REG = freshRegistry();

/** Copy plain objects/arrays (functions kept by reference) and freeze the copy. */
function frozenCopy(v) {
  if (Array.isArray(v)) return Object.freeze(v.map(frozenCopy));
  if (isObj(v)) {
    const o = {};
    for (const k of Object.keys(v)) o[k] = frozenCopy(v[k]);
    return Object.freeze(o);
  }
  return v;
}

function assertOpen(what) {
  if (REG.frozen) throw new ContractError(`registries are frozen; cannot register ${what}`);
}

/**
 * Register one sim-side plugin definition. Plugins call this only from their `*.sim.js`.
 * @param {string} kind PLUGIN_KIND value
 * @param {object} def
 */
export function registerPlugin(kind, def) {
  if (kind === PLUGIN_KIND.SPELL) return registerSpell(def);
  const validate = VALIDATE[kind];
  if (!validate) throw new ContractError(`unknown plugin kind ${show(kind)}; expected one of ${SIM_KINDS.join(", ")}`);
  assertOpen(`${kind} ${show(isObj(def) ? (def.id ?? def.key) : def)}`);
  validate(def);
  const stored = frozenCopy(def);
  if (kind === PLUGIN_KIND.BLOCK) {
    if (REG.defs.block.has(def.id)) throw new ContractError(`duplicate block id ${def.id} (${show(def.key)})`);
    if (REG.blockByKey.has(def.key)) throw new ContractError(`duplicate block key ${show(def.key)}`);
    REG.defs.block.set(def.id, stored);
    REG.blockByKey.set(def.key, stored);
  } else {
    if (REG.defs[kind].has(def.id)) throw new ContractError(`duplicate ${kind} id ${show(def.id)}`);
    REG.defs[kind].set(def.id, stored);
  }
  return stored;
}

/**
 * Register one render-side view. Plugins call this only from their `*.view.js`.
 * @param {string} kind PLUGIN_KIND.BLOCK | WEAPON | NPC_TYPE | BIOME
 * @param {string} id block key, weapon id, npcType id or biome id
 * @param {object} view
 */
export function registerView(kind, id, view) {
  const validate = VALIDATE_VIEW[kind];
  if (!validate) throw new ContractError(`unknown view kind ${show(kind)}; expected one of ${VIEW_KINDS.join(", ")}`);
  assertOpen(`${kind} view ${show(id)}`);
  validate(id, view);
  if (REG.views[kind].has(id)) throw new ContractError(`duplicate ${kind} view ${show(id)}`);
  const stored = frozenCopy(view);
  REG.views[kind].set(id, stored);
  return stored;
}

export const registerBlock = (def) => registerPlugin(PLUGIN_KIND.BLOCK, def);
export const registerWeapon = (def) => registerPlugin(PLUGIN_KIND.WEAPON, def);
export const registerNpcType = (def) => registerPlugin(PLUGIN_KIND.NPC_TYPE, def);
export const registerCastle = (def) => registerPlugin(PLUGIN_KIND.CASTLE, def);
export const registerMap = (def) => registerPlugin(PLUGIN_KIND.MAP, def);
export const registerBiome = (def) => registerPlugin(PLUGIN_KIND.BIOME, def);
export const registerBlockView = (key, view) => registerView(PLUGIN_KIND.BLOCK, key, view);
export const registerWeaponView = (id, view) => registerView(PLUGIN_KIND.WEAPON, id, view);
export const registerNpcView = (id, view) => registerView(PLUGIN_KIND.NPC_TYPE, id, view);
export const registerBiomeView = (id, view) => registerView(PLUGIN_KIND.BIOME, id, view);

/** Reserved interface (DESIGN 1: spells are out of scope). Always throws. */
export function registerSpell(def) {
  throw new ContractError(`SpellDef is reserved and out of scope (DESIGN.md section 1); cannot register spell ${show(isObj(def) ? def.id : def)}`);
}

/** Canonical text of a value: sorted object keys, functions by source text. */
function canonical(v) {
  if (typeof v === "function") return `fn:${v.toString()}`;
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v === undefined ? null : v);
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function crossCheck() {
  const blocksByKey = REG.blockByKey;
  for (const castle of REG.defs.castle.values()) {
    for (const [ch, key] of Object.entries(castle.legend)) {
      if (!blocksByKey.has(key)) throw new ContractError(`castle "${castle.id}": legend "${ch}" -> unknown block key "${key}"`);
    }
    castle.weapons.forEach((w, i) => {
      if (!REG.defs.weapon.has(w.id)) throw new ContractError(`castle "${castle.id}": weapons[${i}].id -> unknown weapon "${w.id}"`);
    });
  }
  for (const map of REG.defs.map.values()) {
    map.slots.forEach((s, i) => {
      if (!REG.defs.castle.has(s.castle)) throw new ContractError(`map "${map.id}": slots[${i}].castle -> unknown castle "${s.castle}"`);
    });
    if (!REG.defs.biome.has(map.biome)) throw new ContractError(`map "${map.id}": biome -> unknown biome "${map.biome}"`);
  }
  for (const w of REG.defs.weapon.values()) {
    if (w.variantOf !== undefined && !REG.defs.weapon.has(w.variantOf)) {
      throw new ContractError(`weapon "${w.id}": variantOf -> unknown weapon "${w.variantOf}"`);
    }
  }
  const has = { block: (k) => blocksByKey.has(k), weapon: (k) => REG.defs.weapon.has(k),
    npcType: (k) => REG.defs.npcType.has(k), biome: (k) => REG.defs.biome.has(k) };
  for (const kind of VIEW_KINDS) {
    for (const id of REG.views[kind].keys()) {
      if (!has[kind](id)) throw new ContractError(`${kind} view "${id}" has no ${kind} def`);
    }
  }
}

/**
 * Cross-check references, freeze all registries and return the registry hash (8 hex chars,
 * FNV-1a over the canonical sim defs; views are excluded). Lockstep peers compare this hash.
 * Range tables and other derived data are built by createSim, not here.
 * @returns {string}
 */
export function freezeRegistries() {
  if (REG.frozen) return REG.hash;
  crossCheck();
  const parts = [];
  for (const kind of SIM_KINDS) {
    const ids = [...REG.defs[kind].keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const id of ids) parts.push(`${kind}:${canonical(REG.defs[kind].get(id))}`);
  }
  REG.hash = fnv1a(`v${VERSION};${parts.join(";")}`);
  REG.frozen = true;
  return REG.hash;
}

export const isFrozen = () => REG.frozen;
/** @returns {string|null} hash after freezeRegistries, else null */
export const registryHash = () => REG.hash;

export const getBlock = (id) => REG.defs.block.get(id) ?? null;
export const getBlockByKey = (key) => REG.blockByKey.get(key) ?? null;
export const getWeapon = (id) => REG.defs.weapon.get(id) ?? null;
export const getNpcType = (id) => REG.defs.npcType.get(id) ?? null;
export const getCastle = (id) => REG.defs.castle.get(id) ?? null;
export const getMap = (id) => REG.defs.map.get(id) ?? null;
export const getBiome = (id) => REG.defs.biome.get(id) ?? null;
/** @param {string} kind @param {string} id */
export const getView = (kind, id) => (REG.views[kind] ? REG.views[kind].get(id) ?? null : null);

/** All defs of a kind in deterministic order (blocks by numeric id, others by id string). */
export function listPlugins(kind) {
  const m = REG.defs[kind];
  if (!m) throw new ContractError(`unknown plugin kind ${show(kind)}`);
  return [...m.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((k) => m.get(k));
}

/** Test-only: drop every registration and unfreeze. Never call from game code. */
export function resetRegistriesForTests() {
  REG = freshRegistry();
}
