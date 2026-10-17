// src/plugins/index.sim.js - owns explicit registration of Phase 1 simulation content.
import { registerCoreBlocks } from './blocks/core.sim.js';
import { registerCannon } from './weapons/cannon/cannon.sim.js';
import { registerCatapult } from './weapons/catapult/catapult.sim.js';
import { registerDoubleCannon } from './weapons/double-cannon/double-cannon.sim.js';
import { registerFireCatapult } from './weapons/fire-catapult/fire-catapult.sim.js';
import { registerBallista } from './weapons/ballista/ballista.sim.js';
import { registerRocket } from './weapons/rocket/rocket.sim.js';
import { registerTrebuchet } from './weapons/trebuchet/trebuchet.sim.js';
import { registerArcaballista } from './weapons/arcaballista/arcaballista.sim.js';
import { registerFatFreda } from './weapons/fat-freda/fat-freda.sim.js';
import { registerHellfire } from './weapons/hellfire/hellfire.sim.js';
import { registerZeppelin } from './weapons/zeppelin/zeppelin.sim.js';
import { registerBomb } from './weapons/bomb/bomb.sim.js';
import { registerDefaultCastle } from './castles/default.sim.js';
import { registerForestDuel } from './maps/forest-duel.sim.js';
import { registerForest } from './biomes/forest.sim.js';

/** Register compiled-in sim plugins; the orchestrator calls freezeRegistries afterward. */
export function registerCoreSim() {
  registerCoreBlocks();
  registerCannon();
  registerCatapult();
  registerDoubleCannon();
  registerFireCatapult();
  registerBallista();
  registerRocket();
  registerTrebuchet();
  registerArcaballista();
  registerFatFreda();
  registerHellfire();
  registerZeppelin();
  registerBomb();
  registerDefaultCastle();
  registerForestDuel();
  registerForest();
}
