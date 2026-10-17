// src/tuning.js - owns every numeric knob of docs/DESIGN.md in one deep-frozen object (orchestrator-owned).
// Source tags: "EN p.N" = English manual page (research/06), "D x.y" = docs/DESIGN.md section,
// "guess" = design default awaiting playtest. Change numbers here, never in prose or code.

function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

// research/11 sections 2-4: one original renderer unit becomes 1/8 m (TB2 calibration).
const ORIGINAL_WORLD_M = 1 / 8, ORIGINAL_NATIVE_UNIT = 5 / 256;
const NATIVE_M = ORIGINAL_NATIVE_UNIT * ORIGINAL_WORLD_M, NATIVE_TICK_S = 0.062;
/** Native C/M/K, pitch code, scatter and damage; contract v0 remains full-charge speed.
 * Ballista uses its default pitch (original human dial changed elevation); rocket uses a
 * guessed charge-speed surrogate for the powered carrier. Those two control exceptions
 * need future plugins; ordinary artillery below uses the recovered constants directly.
 */
function weapon(mount, cost, hp, reloadS, crewSlots, fireCostWorkshop, traj,
  C, M, K, pitch, scatterTurnUnits, count, direct, splash, nativeRadius, extra = {}) {
  const speedPerCharge = K * NATIVE_M / NATIVE_TICK_S;
  return {
    mount, cost, hp, reloadS, crewSlots, fireCost: Math.floor(fireCostWorkshop * 1.5), fireCostWorkshop,
    traj, v0: speedPerCharge * 255, speedPerCharge, nativeK: K, nativeC: C, nativeM: M,
    k: C / (M * 65536 * NATIVE_M), elevationDeg: pitch * 11 * 360 / 4096, scatterTurnUnits,
    sAzDeg: scatterTurnUnits * 360 / 4096, sV: 0, count, direct, splash,
    splashRadius: nativeRadius * NATIVE_M * 3, nativeSplashRadius: nativeRadius,
    intervalS: 0, spreadDeg: 0, ignite: 0, pierce: 0, projRadius: 0.15,
    ...extra,
  };
}

export const TUNING = deepFreeze({
  world: {
    blockM: 1, // D 2.1: 1 m blocks
    plotW: 48, // D 2.1: plot footprint x
    plotD: 48, // D 2.1: plot footprint z
    plotH: 24, // D 2.1: plot height
    foundationY: 0, // D 2.1: indestructible layer
    buildMinY: 1, // D 2.1
    buildMaxY: 23, // D 2.1
    chunk: 16, // D 7.3: chunk edge in cells
    duelDistanceM: 192, // D 2.1: plot centres; dial now charge, research/11
    ringRadiusM: 110, // D 2.1: 3-4 slot maps
    duelMapM: [384, 256], // D 2.1
    ringMapM: [384, 384], // D 2.1
    maxSlots: 4, // shot 02, D 6.1
    weaponCapDefault: 4, // D 2.1 (guess)
    weaponCapMin: 2, // EN p.52 base cap
    weaponCapMax: 8, // EN p.52 max cap
    terrainGridM: 2, // D 2.3
    terrainAmpMaxM: 12, // D 2.3
    terrainOctaves: 3, // D 2.3
    plotSkirtM: 8, // D 2.3
    ridgeMaxM: 30, // D 2.3
    maxOpenDesignations: 64, // D 4.8
  },

  sim: {
    tickHz: 30, // D 3.1
    substeps: 4, // D 3.3: projectile substeps per tick (120 Hz)
    // research/11 3.2-3.4: q=5/2048 m/native unit, h=62 ms, default scenario g=33.
    // Calibration: renderer distances x1/8; full-charge cannon ~278 m vs 192 m duel.
    // research/08/10 give local 32x24-cell plateaus (256 native units/cell),
    // but no established castle-centre spacing. This metric scale is a design choice.
    // TB2 stabilisation 2026-10-17: individual voxel centres take splash, so use
    // three times the flight scale. Renderer-sized blasts applied a building's damage to dozens
    // of palace cells at once and bypassed the protective keep/curtain walls.
    splashNativePositionM: NATIVE_M * 3,
    originalWorldUnitM: ORIGINAL_WORLD_M,
    nativePositionM: NATIVE_M,
    nativeTickS: NATIVE_TICK_S,
    nativeGravity: 33, // research/11: Lv1_1_1=33; custom scenarios vary 33..40
    nativeDragDivisor: 65536,
    gravity: 33 * NATIVE_M / NATIVE_TICK_S ** 2,
    projectileMaxLifeS: 30, // D 3.3
    projectileMinY: -50, // D 3.3
    collapseRadius: 12, // D 2.2: support flood-fill radius around a destroyed cell
    collapseBudgetCells: 4096, // D 2.2: cells visited per tick
    aiThinkEveryTicks: 15, // D 3.2: 2 Hz
    aiSlotStaggerTicks: 0, // repair wave 1: both slots decide on the same public tick
    maxTicksPerFrame: 5, // D 3.2
    dtClampS: 0.25, // D 3.2
    hashEveryTicks: 30, // D 6.3: lockstep hash compare
    inputDelayTicks: 3, // D 6.3
    tickBudgetMs: 4, // D 10 rule 11
  },

  aim: {
    azUnitsPerDeg: 10, // D 3.3: az stored in tenths of a degree
    azTapDeg: 0.5, // D 3.3
    azCtrlDeg: 5, // D 3.3
    azDragDegPerPx: 0.1, // D 3.3
    dialUnitM: 5, // Legacy UI/fixture compatibility only; no distance-per-charge mapping.
    chargeMin: 1, // research/11 4.2
    chargeMax: 255, // AIM remains 0..9999 tenths; 0..2550 maps to charge 1..255, above clamps
    fallbackStraightDeg: 22 * 11 * 360 / 4096, // guess for unknown plugins
    fallbackLobbedDeg: 38 * 11 * 360 / 4096, // guess for unknown plugins
    rangeUnitsPerDial: 10, // D 3.3: range stored in tenths of a dial unit
    rangeTapDial: 0.2, // D 3.3 (1 m)
    rangeCtrlDial: 2, // D 3.3 (10 m)
    rangeDragDialPerPx: 0.05, // D 3.3
    tableStepDeg: 0.25, // D 3.3: range-table elevation step
    straightElevDeg: [-5, 25], // D 3.3
    lobbedElevDeg: [45, 80], // D 3.3
  },

  wind: {
    nativeSpeedByStrength: [0, 10, 25, 45, 70, 100, 135, 175, 220], // research/11 6.2
    maxSpeedByStrength: [0, 10, 25, 45, 70, 100, 135, 175, 220].map(v => v * NATIVE_M / NATIVE_TICK_S),
    segmentBaseByChange: [64, 32, 16, 8, 4, 1], // research/11 6.3; change 0 constant
    scheduleEntries: 256,
    ticksPerEntry: 32,
    turnUnits: 4096,
    turnLimitUnits: 682, // +/-59.94140625 degrees, research/11
    initialDirectionDeg: 270, // native theta=0 points west in our east-positive axes
    defaultStrength: 2,
    defaultChange: 2,
    redArrowMinSpeed: 0.5, // D 3.4
    blueArrowS: 20, // D 3.4
    driftTest: { windMs: 15, distanceM: 192 }, // legacy test wind, no guessed per-weapon drift targets
  },

  // Core block numbers (D 2.2). hp in manual defence points; cost null = map-only.
  blocks: {
    air: { hp: 0, cost: 0, buildS: 0 }, // D 2.2
    stone: { hp: 40, cost: 4, buildS: 0.125 }, // repair wave 1: 360g per 90-cell wall; build time remains the voxel calibration
    tower: { hp: 72, cost: 8, buildS: 18 }, // repair wave 1: 1760g per 220-cell shell; small tower 18s
    gate: { hp: 96, cost: null, buildS: 0 }, // EN p.37 gatehouse 96 dp
    wood: { hp: 12, cost: 4, buildS: 2 }, // research/10: farmhouse 12 dp
    floor: { hp: 12, cost: 3, buildS: 2 }, // guess
    stairs: { hp: 20, cost: 6, buildS: 3 }, // guess
    ladder: { hp: 6, cost: 3, buildS: 2 }, // guess
    door: { hp: 20, cost: 8, buildS: 3 }, // guess
    roof: { hp: 8, cost: 5, buildS: 2 }, // guess
    magazine: { hp: 24, cost: 75, buildS: 6 }, // research/10: eight-voxel workshop 600g, 24dp
    palace: { hp: 80, cost: null, buildS: 0 }, // repair wave 1: reinforced core; 3840 initial dp, paid repairs
    mount: { hp: 60, cost: 6, buildS: 0.125 }, // EN p.36 large wall 60 dp
    foundation: { hp: 255, cost: null, buildS: 0 }, // D 2.1: 255 = indestructible
  },
  structures: { windmill: { hp: 24, cost: 300, buildS: 30 } }, // research/10: reference prefab; manual 4 dp is a typo
  hpIndestructible: 255, // D 2.1
  damageStateAbove: [0.75, 0.5, 0.25], // D 2.2: hp fraction thresholds for states 0/1/2, else 3
  pluginBlockIdMin: 64, // D 2.2

  magazine: {
    capacityLoads: 20, // research/07, D 2.2
    restockS: 4, // D 2.2 (guess)
    prefab: [2, 2, 2], // D 2.2
    explosions: true, // D 2.2 tuning switch
    splashBase: 30, // D 2.2
    splashPerLoad: 2, // D 2.2
    splashMax: 70, // D 2.2
    radiusBase: 2, // D 2.2
    radiusPerLoad: 0.1, // D 2.2
    radiusMax: 4, // D 2.2
  },

  palace: {
    destroyedBelow: 0.3, // D 2.2 / D 3.7: integrity threshold
    crackingStartS: 600, // repair wave 1: late pressure starts at minute 10
    crackingEndS: 900, // repair wave 1: full threshold at minute 15
    crackingDestroyedBelow: 0.55, // repair wave 1: probe11 stalled at 45.7%; 45% permanent damage ends the late tail
    moraleDrainBelow: 0.5, // D 4.6
  },

  fire: {
    burnS: 10, // D 2.2 (guess)
    dps: 2, // D 2.2 (guess)
    spreadP: 0.15, // D 2.2: per second per burnable neighbour (guess)
  },

  // research/11 tables 2.3/2.4. Ground HP follows requested support values 60/96;
  // original removes weapons below half support HP (5.3), unlike our independent entities.
  weapons: {
    // TB4: maxRangeM is a conservative calm/equal-height bound, not a hard map cap.
    // Double cannon follows requested D 3.5 stagger; research/11 has simultaneous rounds.
    // Rocket replaces the old guessed speed-per-charge surrogate: fixed 1000 native
    // units/tick, 45 thrust, charge native burn ticks, then 53/60 drag on the payload.
    catapult: weapon("ground", 600, 60, 18, 4, 35, "lobbed", 94, 48, 60, 38, 16, 1, 12, 10, 1024, { maxRangeM: 400, projRadius: 0.25 }),
    cannon: weapon("wall", 750, 36, 22, 3, 60, "straight", 80, 52, 40, 22, 11, 1, 16, 20, 640, { maxRangeM: 300 }),
    "double-cannon": weapon("wall", 750, 36, 22, 4, 100, "straight", 80, 52, 40, 22, 11, 2, 16, 20, 640, { maxRangeM: 300, intervalS: 0.3 }),
    "fire-catapult": weapon("ground", 750, 60, 24, 4, 100, "lobbed", 90, 40, 70, 38, 11, 1, 8, 4, 153, { maxRangeM: 400, ignite: 2, projRadius: 0.25 }),
    ballista: weapon("wall", 400, 36, 15, 2, 15, "lobbed", 10, 31, 45, 38, 8, 1, 4, 0, 0, { maxRangeM: 1800, pierce: 3, projRadius: 0.08, controlGuess: true }),
    rocket: weapon("wall", 800, 36, 30, 3, 100, "lobbed", 54, 55, 60, 68, 20, 1, 24, 28, 1152, { maxRangeM: 1000, speedPerCharge: 0, v0: 1000 * NATIVE_M / NATIVE_TICK_S, nativeK: 1000, nativeThrust: 45, propulsion: { initialSpeed: 1000, thrust: 45, massBase: 55, massPerCharge: 2, carrierC: 54, payloadC: 53, payloadM: 60 } }), // fixed-speed powered carrier; effective child payload
    trebuchet: weapon("ground", 850, 96, 18, 6, 150, "lobbed", 94, 48, 60, 38, 16, 5, 12, 10, 1024, { maxRangeM: 400, projRadius: 0.25, spreadDeg: 1.5 }),
    arcaballista: weapon("ground", 850, 96, 18, 4, 200, "straight", 10, 31, 45, 20, 14, 4, 24, 12, 320, { maxRangeM: 1600, projRadius: 0.1, spreadDeg: 0.8 }),
    "fat-freda": weapon("ground", 850, 96, 22, 6, 150, "lobbed", 90, 76, 38, 38, 11, 1, 40, 48, 1536, { maxRangeM: 400, projRadius: 0.3 }),
    hellfire: weapon("ground", 850, 96, 22, 5, 220, "straight", 80, 52, 40, 22, 14, 5, 16, 20, 640, { maxRangeM: 300, intervalS: 9 * NATIVE_TICK_S }),
  },

  weaponRules: {
    muzzleClearanceM: 3, // keep standing goals and AI fire clear of allied bodies
    muzzleSafetyPadM: 0.15, // one tick of movement plus projectile scatter
    wallFootprint: [1, 1, 1], // D 3.5
    groundFootprint: [3, 3, 2], // D 3.5, EN p.25 (3x3 squares)
    wallHp: 36, // EN p.43: half a 72 dp tower
    buildWallS: 20, // D 4.3 (guess)
    buildGroundS: 30, // D 4.3 (guess)
    bufferLoads: 2, // research/07, D 3.5
    minCrewFrac: 0.6, // research/07, D 3.5: minCrew = ceil(0.6 N)
    reloadMoraleA: 1.5, // D 3.5: (1.5 - 0.5 * workSpeed)
    reloadMoraleB: 0.5, // D 3.5
  },

  people: {
    hp: 100, // D 3.6
    rulerRadius: 0.3, // D 3.6 / D 5
    npcRadius: 0.25, // D 3.6
    height: 1.75, // D 3.6
    splashPeak: 150, // D 3.6
    splashExtraM: 1, // D 3.6: people splash radius = blast radius + 1 m
    rulerRegenHpS: 4, // D 3.6 (guess)
    rulerRegenDelayS: 10, // D 3.6 (guess)
    fallSafeM: 3, // D 3.6
    fallDmgPerM: 30, // D 3.6
    collapseDmg: 50, // D 2.2
  },

  ruler: {
    radius: 0.3, // D 5
    height: 1.75, // D 5
    eye: 1.6, // D 5
    walk: 4.0, // D 5
    sprint: 6.0, // D 5
    ladder: 2.0, // D 5
    gravity: 24, // D 5: ruler-only gravity for snappy jumps
    jumpV: 7.9, // D 5: apex 1.30 m
    autoStep: 0.55, // D 5
    interactWeaponM: 3, // D 4.8
    interactOrderM: 24, // D 4.8
    fovDeg: 60, // D 5: vertical FOV walking
    weaponFovDeg: 50, // D 5
    nearM: 0.1, // D 5
    farM: 1500, // D 5
    fogNearM: 300, // D 5
    fogFarM: 900, // D 5
    pitchClampDeg: 89, // D 5
    headBobM: 0.03, // D 5
    headBobHz: 2, // D 5
    sightBackM: 2.35, // D 5, 2026-10-17 pass 2: +0.35 m back from the measured pass-1 eye.
    sightUpM: 1.85, // D 5, 2026-10-17 pass 2: proposal +0.20 m clears the muzzle below the skyline.
    sightRightM: 0.35, // D 5, 2026-10-17 pass 2: shoulder offset puts the barrel left of centre (original 049).
    weaponViewPitchDeg: -4, // D 5: fixed downward tilt of the weapon view (lane E, shot 04)
    mouseSensitivity: 0.0022, // D 5: radians per pointer-locked pixel (lane E)
    impactBackM: 30, // D 5
    impactUpM: 20, // D 5
    deathCamS: 3, // D 5
    deathCamY: 0.3, // D 5
    deathRollDeg: 70, // D 5
  },

  economy: {
    startGold: 1500, // research/10, EN p.13 Tactics default
    palaceIncomeS: 3, // D 3.8 (guess)
    civilianIncomeS: 0.1, // D 3.8 (guess)
    goldCap: 2000, // research/10, EN p.39 without treasury
    weaponSalvageFrac: 0.5, // recover wreck materials; replacement still costs half plus time and crew losses
    demolishRefundFrac: 0.5, // retain salvage value while repair materials rise to 80%
    mapOnlyRepairBlockCost: 8, // repair wave 1: unique keep/gate repairs still need materials
    repairCostFrac: 0.8, // D 3.8
  },

  rules: {
    surrenderMorale: 10, // D 3.7
    surrenderS: 45, // D 3.7
    surrenderPopFrac: 0.25, // D 3.7
    hotseatTurnS: 30, // EN p.17, D 6.3
    matchTargetMinS: 720, // D 3.8 pacing target vs AI level 5
    matchTargetMaxS: 1200, // D 3.8
  },

  npc: {
    population: 40, // research/07, D 4.1
    populationMin: 20, // D 4.1
    populationMax: 80, // D 4.1
    shares: { crew: 0.4, runner: 0.15, mason: 0.15 }, // research/07, D 4.1 (civilians = rest)
    minRunners: 3, // research/07
    minMasons: 2, // research/07
    speed: 3.0, // research/07 (3 blocks/s)
    carrySpeed: 2.0, // research/07
    fleeSpeed: 4.0, // D 4.1
    ladderSpeed: 1.0, // D 4.1
    stairsMul: 0.7, // D 4.1
    carryLoads: 2, // research/07
    draftEveryS: 10, // D 4.1
    levyBelowPopFrac: 0.7, // research/16 P3: casualties accelerate civilian levy
    levyEveryS: 5, // research/16 P3
    fleeCrew: { base: 10, spread: 10 }, // research/07: crew, runner, mason
    fleeCivilian: { base: 25, spread: 10 }, // research/07
    returnHysteresis: 15, // research/07
    clamberMaxRiseM: 2, // repair wave 1: escape collapsed walkway pits
    clamberSpeedMul: 0.5, // deliberate vertical lift, then traverse the ledge
    autoRepairQuietS: 30, // routine wall patching resumes after focused shelling stops
    repairFullS: 12, // repair wave 1 / research/16 P2
    repairJobBelow: 0.5, // research/07: hp < 50% posts a repair job
    workReachM: 2.0, // D 4.3
    claimBlockedS: 5, // D 4.3
    claimTimeoutS: 60, // D 4.3
    fearRadiusM: 6, // D 4.3
    fearWindowS: 5, // D 4.3
    fearMoraleOverride: 60, // research/07
    fearDeadlockS: 30, // D 4.3
    pathMaxExpansions: 2048, // D 4.4
    pathSearchesPerTick: 8, // D 4.4
    pathReplanMinS: 1, // research/07
    pathRevalidateCells: 3, // D 4.4
    pathCost: { flat: 1, door: 1.5, stairs: 2, ladder: 3, stepDown: 1.5, clamber: 3 }, // D 4.4 (research/07 traffic)
    shelterSolidAbove: 2, // D 4.7
    shelterAboveRange: 6, // D 4.7
    leadershipM: 8, // D 4.6 (guess)
    leadershipBonus: 0.1, // D 4.6 (guess)
    workSpeedCap: 1.2, // D 4.6
    desertBelow: 15, // research/07
    desertAfterS: 20, // research/07
    desertEveryS: 10, // research/07
  },

  morale: {
    start: 70, // research/07
    tauFastS: 30, // D 4.6
    baselineRateS: 0.05, // D 4.6: max baseline move per second
    wFast: 0.7, // research/07
    wBase: 0.3, // research/07
    floor: 8, // D 4.6 (research/07 said 10; lowered below the surrender line)
    crewDeath: -2, // research/07
    civilianDeath: -1, // research/07
    deathCap: -15, // research/07
    deathWindowS: 10, // research/07
    palaceHit: -4, // research/07
    ourHit: 2, // research/07
    enemyBlock: 0.5, // D 4.6 (research/07 had +3 per block)
    enemyBlockCap: 3, // D 4.6: per projectile
    enemyWeapon: 5, // research/07
    enemyNpc: 0.5, // D 4.6
    enemyNpcCap: 3, // D 4.6
    underFireS: -0.1, // research/07
    underFireWindowS: 10, // research/07
    palaceLowS: -0.2, // research/07
    shelterS: 0.05, // research/07
    shelterFrac: 0.8, // D 4.6
    rallyBelow: 50, // repair wave 1 / research/16 P3
    rally: 15, // research/07
    rallyCooldownS: 60, // research/07
    workBands: [[70, 1.1], [40, 1.0], [20, 0.8], [0, 0.5]], // research/07: [M >= threshold, workSpeed]
  },

  ai: {
    levelMin: 1, // EN p.12
    levelMax: 10, // EN p.12
    defaultLevel: 5, // guess: mid level, the skirmish menu default (lane E)
    sAz0PerLevelDeg: 0.4, // D 6.2: sAz0 = 0.4 * (11 - L)
    sR0PerLevel: 0.015, // D 6.2: sR0 = 1.5% * (11 - L)
    alphaBase: 0.4, // D 6.2
    alphaPerLevel: 0.06, // D 6.2
    shrink: 0.6, // D 6.2
    sMinCoefDeg: 0.008, // D 6.2: sigmaMin = 0.008 * (11 - L)^2
    sMinRangeCoef: 0.000008, // TB2 calibration: fractional range floor; L1 8%, L5 1.0368%
    sMinRangeExponent: 4, // TB2 guess: preserve low-level misses while mid-level crews learn a breach
    windResetSteps: 2, // D 6.2
    breachAimAbovePalaceM: 1, // strike the low shield segment within blast reach of the core
    transferConfidenceMax: 4, // a new point in a ranged castle does not restart blind exploration
    windMemoryMinLevel: 4, // D 6.2
    fireDelayPerLevelS: 0.5, // D 6.2
    targetValue: { palace: 10, weapon: 8, magazine: 7, shieldWall: 4, crewCluster: 3 }, // D 6.2
    tacticWeight: { daredevil: { palace: 1.5 }, general: { weapon: 1.5 }, worrier: { weapon: 1.2 } }, // D 6.2
    crewClusterN: 3, // D 6.2
    crewClusterM: 2, // D 6.2
    targetRetryS: 5, // guess: back off unusable firing lanes rather than retrying at 2 Hz
    retargetS: 120, // research/16 P2: retain a breach across four volleys
    breachAfterS: 120, // repair wave 1: three opening volleys, then a stable breach
    rulerRetreatCooldownS: 30, // repair wave 1: reassess cover as the keep opens
    rulerDangerM: 10, // repair wave 1: walk to shelter when nearby impacts expose the throne
    rulerDangerWindowS: 30, // repair wave 1
    recoveryWeapon: 'ballista', // repair wave 1: affordable cover while restoring the cannon blueprint
    recoveryMountOffsetZ: 8, // repair wave 1: spare batteries flank the central breach
    recoveryGunHpFrac: 0.5, // repair wave 1: automatic masonry preserves one replacement gun
    maxFireSilenceS: 60, // repair wave 1: retry infeasible lanes before 90 s
    buildEveryS: 2, // D 6.2
    buildPerThink: 4, // D 6.2
    recoveryDesignationSlots: 8, // repair wave 1: reserve one 2x2x2 magazine of queue space
    reserve: { worrier: 300, general: 500, daredevil: 800 }, // D 6.2
    repairShare: { worrier: 0.6, general: 0.4, daredevil: 0.2 }, // D 6.2 (general: guess)
    shelterBelow: 35, // D 6.2
    shelterImpacts: 3, // D 6.2
    shelterWindowS: 10, // D 6.2
    shelterOffS: 20, // D 6.2
    thinkBudgetMs: 1, // D 6.2
    hitTest: { targetM: 3, distanceM: 192, level10Shots: 6, level1Shots: 20, seeds: 20 }, // D 6.2
  },

  render: {
    gpuExtras: false, // Modern only; forcibly disabled by golden=1 (2026-10-17).
    modern: {
      sun: 0xffefd6, sunGain: 2.2, ambientSky: 0xc5d7ed, ambientGround: 0x8b806b,
      ambientGain: 0.85, wrap: 0.18, ironSpecular: 0.08,
      fog: 0xa8c0d0, fogDensity: 0.0024, fogFalloff: 0.035,
      zenith: 0x2467a7, horizon: 0xa8c1d4,
      grass: 0x43552d, sand: 0xb1a083, rock: 0x85867e,
      exposure: 1.05, shadowSize: 2048, shadowExtentM: 145,
      fireMax: 256, bloomStrength: 0.16, bloomRadius: 0.35, bloomThreshold: 1.0,
    },
    logicalW: 1024, // D 7.1, shots 03-12
    logicalH: 768, // D 7.1
    targetFps: 60, // D 7.1
    maxDrawCalls: 250, // D 7.1
    maxTris: 300000, // D 7.1
    atlasPx: 2048, // D 7.2
    tilePx: 128, // D 7.2
    gutterPx: 8, // D 7.2
    maxMip: 4, // D 7.2
    bakePx: 512, // D 7.6
    sunDdaSteps: 32, // D 7.2
    particles: 2000, // D 7.2
    debrisMin: 30, // D 7.2
    debrisMax: 60, // D 7.2
    debrisSizeM: 0.3, // D 7.2
    debrisS: 2, // D 7.2
    remeshMs: 2, // D 7.3
    remeshPerFrame: 2, // D 7.3
    damageTint: [0.9, 0.8, 0.7], // D 7.3: states 1-3
    npcMeshMax: 48, // D 7.4
    npcMeshRangeM: 40, // D 7.4
    npcTris: 300, // D 7.4
    weaponTris: 1500, // D 7.4
    blockTrisPlain: 12, // D 7.4
    blockTrisGreebled: 96, // D 7.4
    treeTris: 150, // D 7.4
    handsTris: 400, // D 7.4
  },

  ui: {
    messageLifetimeS: 10, // D 7.5: info-bar message lifetime (lane E console)
    messageMax: 4, // D 7.5: visible message lines (lane E console)
  },

  audio: {
    falloffM: 40, // guess: distance attenuation 1 / (1 + d / falloffM) (lane E sfx)
    earshotM: 600, // guess: silent beyond this distance (lane E sfx)
  },

  golden: {
    width: 1024, // D 7.6
    height: 768, // D 7.6
    threshold: 0.1, // D 7.6: pixelmatch threshold
    maxDiffRatio: 0.002, // D 7.6
    hudSsim: 0.85, // D 7.6
    hudMae: 12, // D 7.6: mean abs error out of 255
    sceneSsimTarget: 0.5, // D 7.6 (reported, not gating)
    vlmTarget: 4, // D 7.6 (advisory)
  },
});

export default TUNING;
