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

/** One weapon row. Original columns: cost, hp, reloadS, fireCost (EN pp.41-48). Rest: D 3.5 design. */
function weapon(mount, cost, hp, reloadS, crewSlots, fireCost, traj, v0, k, sAzDeg, sV,
  count, direct, splash, splashRadius, extra = {}) {
  return {
    mount, cost, hp, reloadS, crewSlots, fireCost, traj, v0, k, sAzDeg, sV,
    count, direct, splash, splashRadius,
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
    duelDistanceM: 192, // D 2.1: plot centres, dial 038
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
    gravity: 9.81, // D 3.3
    projectileMaxLifeS: 30, // D 3.3
    projectileMinY: -50, // D 3.3
    collapseRadius: 12, // D 2.2: support flood-fill radius around a destroyed cell
    collapseBudgetCells: 4096, // D 2.2: cells visited per tick
    aiThinkEveryTicks: 15, // D 3.2: 2 Hz
    aiSlotStaggerTicks: 5, // D 3.2
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
    dialUnitM: 5, // D 3.3: one range-dial unit = 5 m flat-ground range
    rangeUnitsPerDial: 10, // D 3.3: range stored in tenths of a dial unit
    rangeTapDial: 0.2, // D 3.3 (1 m)
    rangeCtrlDial: 2, // D 3.3 (10 m)
    rangeDragDialPerPx: 0.05, // D 3.3
    tableStepDeg: 0.25, // D 3.3: range-table elevation step
    straightElevDeg: [-5, 25], // D 3.3
    lobbedElevDeg: [45, 80], // D 3.3
  },

  wind: {
    maxSpeedByStrength: [0, 3, 6, 9, 12, 15], // D 3.4: m/s per setting 0..5
    meanIntervalSByChange: [0, 180, 120, 90, 60, 30], // D 3.4: 0 = never changes
    defaultStrength: 2, // D 3.4
    defaultChange: 2, // D 3.4
    intervalJitter: [0.7, 1.3], // D 3.4
    decay: 0.9, // D 3.4 (Kruse-style mean reversion, research/05)
    gustFrac: 0.4, // D 3.4: U(-0.4, 0.4) * max
    turnDeg: 60, // D 3.4
    redArrowMinSpeed: 0.5, // D 3.4
    blueArrowS: 20, // D 3.4
    driftTest: { windMs: 15, distanceM: 192, cannonM: 2, catapultM: 8, rocketM: 15, tolerance: 0.25 }, // D 3.4
  },

  // Core block numbers (D 2.2). hp in manual defence points; cost null = map-only.
  blocks: {
    air: { hp: 0, cost: 0, buildS: 0 }, // D 2.2
    stone: { hp: 40, cost: 10, buildS: 4 }, // EN p.36 small wall 40 dp
    tower: { hp: 72, cost: 16, buildS: 5 }, // EN p.37 small tower 72 dp
    gate: { hp: 96, cost: null, buildS: 0 }, // EN p.37 gatehouse 96 dp
    wood: { hp: 16, cost: 4, buildS: 2 }, // EN p.38 farmhouse 12 dp, raised (guess)
    floor: { hp: 12, cost: 3, buildS: 2 }, // guess
    stairs: { hp: 20, cost: 6, buildS: 3 }, // guess
    ladder: { hp: 6, cost: 3, buildS: 2 }, // guess
    door: { hp: 20, cost: 8, buildS: 3 }, // guess
    roof: { hp: 8, cost: 5, buildS: 2 }, // guess
    magazine: { hp: 24, cost: 20, buildS: 6 }, // EN p.39 ammo workshop 24 dp
    palace: { hp: 40, cost: null, buildS: 0 }, // D 2.2 (palace 200 dp, EN p.36, spread over a core)
    mount: { hp: 60, cost: 12, buildS: 5 }, // EN p.36 large wall 60 dp
    foundation: { hp: 255, cost: null, buildS: 0 }, // D 2.1: 255 = indestructible
  },
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
    moraleDrainBelow: 0.5, // D 4.6
  },

  fire: {
    burnS: 10, // D 2.2 (guess)
    dps: 2, // D 2.2 (guess)
    spreadP: 0.15, // D 2.2: per second per burnable neighbour (guess)
  },

  // D 3.5 table. Fields: mount, cost, hp, reloadS, crewSlots, fireCost, traj, v0 m/s, k 1/s,
  // sAzDeg, sV, count, direct, splash, splashRadius (+ intervalS, spreadDeg, ignite, pierce, projRadius).
  weapons: {
    catapult: weapon("ground", 600, 30, 18, 4, 52, "lobbed", 52, 0.010, 1.0, 0.025, 1, 16, 12, 2.5, { projRadius: 0.25 }), // EN p.42
    cannon: weapon("wall", 750, 36, 22, 3, 90, "straight", 75, 0.030, 0.3, 0.01, 1, 24, 10, 1.25), // EN p.43
    "double-cannon": weapon("wall", 750, 36, 22, 4, 150, "straight", 75, 0.030, 0.4, 0.01, 2, 24, 10, 1.25, { intervalS: 0.3 }), // EN p.43
    "fire-catapult": weapon("ground", 750, 30, 24, 4, 150, "lobbed", 50, 0.008, 0.6, 0.015, 1, 8, 4, 1.25, { ignite: 2, projRadius: 0.25 }), // EN p.44
    ballista: weapon("wall", 400, 36, 15, 2, 22, "lobbed", 60, 0.006, 0.15, 0.005, 1, 6, 0, 0, { pierce: 3, projRadius: 0.08 }), // EN p.45
    rocket: weapon("wall", 800, 36, 30, 3, 150, "lobbed", 60, 0.016, 1.6, 0.04, 1, 40, 20, 2.5), // EN p.46
    trebuchet: weapon("ground", 850, 48, 18, 6, 225, "lobbed", 58, 0.010, 1.0, 0.025, 5, 16, 10, 2.5, { spreadDeg: 1.5, projRadius: 0.25 }), // EN p.47
    arcaballista: weapon("ground", 850, 48, 18, 4, 300, "straight", 80, 0.020, 0.6, 0.015, 4, 40, 0, 0.75, { spreadDeg: 0.8, projRadius: 0.1 }), // EN p.47
    "fat-freda": weapon("ground", 850, 48, 22, 6, 225, "lobbed", 55, 0.008, 0.3, 0.01, 1, 64, 40, 3.5, { projRadius: 0.3 }), // EN p.48
    hellfire: weapon("ground", 850, 48, 22, 5, 330, "straight", 75, 0.030, 0.6, 0.015, 5, 24, 10, 1.25, { intervalS: 0.4 }), // EN p.48
  },

  weaponRules: {
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
    sightBackM: 2.0, // D 5 (amended 2026-10-17, lane D: 1.2 put the eye at barrel height)
    sightUpM: 1.25, // D 5 (amended 2026-10-17, lane D)
    weaponViewPitchDeg: -4, // D 5: fixed downward tilt of the weapon view (lane E, shot 04)
    mouseSensitivity: 0.0022, // D 5: radians per pointer-locked pixel (lane E)
    impactBackM: 30, // D 5
    impactUpM: 20, // D 5
    deathCamS: 3, // D 5
    deathCamY: 0.3, // D 5
    deathRollDeg: 70, // D 5
  },

  economy: {
    startGold: 2000, // D 3.8 (EN p.13 Tactics 1500, raised)
    palaceIncomeS: 6, // D 3.8 (guess)
    civilianIncomeS: 0.25, // D 3.8 (guess)
    goldCap: 4000, // D 3.8 (EN p.39 ~2000 without treasury, doubled)
    repairCostFrac: 0.5, // D 3.8
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
    fleeCrew: { base: 10, spread: 10 }, // research/07: crew, runner, mason
    fleeCivilian: { base: 25, spread: 10 }, // research/07
    returnHysteresis: 15, // research/07
    repairFullS: 8, // research/07: one block per 8 s
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
    pathCost: { flat: 1, door: 1.5, stairs: 2, ladder: 3, stepDown: 1.5 }, // D 4.4 (research/07 traffic)
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
    rallyBelow: 30, // research/07
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
    windResetSteps: 2, // D 6.2
    windMemoryMinLevel: 4, // D 6.2
    fireDelayPerLevelS: 0.5, // D 6.2
    targetValue: { palace: 10, weapon: 8, magazine: 7, shieldWall: 4, crewCluster: 3 }, // D 6.2
    tacticWeight: { daredevil: { palace: 1.5 }, general: { weapon: 1.5 }, worrier: { weapon: 1.2 } }, // D 6.2
    crewClusterN: 3, // D 6.2
    crewClusterM: 2, // D 6.2
    retargetS: 60, // D 6.2
    buildEveryS: 2, // D 6.2
    buildPerThink: 4, // D 6.2
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
