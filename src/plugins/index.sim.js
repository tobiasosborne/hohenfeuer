// src/plugins/index.sim.js - owns explicit registration of Phase 1 simulation content.
import { registerCoreBlocks } from './blocks/core.sim.js';
import { registerCannon } from './weapons/cannon/cannon.sim.js';
import { registerDefaultCastle } from './castles/default.sim.js';
import { registerForestDuel } from './maps/forest-duel.sim.js';
import { registerForest } from './biomes/forest.sim.js';

/** Register compiled-in sim plugins; the orchestrator calls freezeRegistries afterward. */
export function registerCoreSim() {
  registerCoreBlocks();
  registerCannon();
  registerDefaultCastle();
  registerForestDuel();
  registerForest();
}
