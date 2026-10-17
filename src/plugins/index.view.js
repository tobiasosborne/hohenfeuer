// src/plugins/index.view.js - owns explicit registration of Phase 1 render content.
import { registerCoreBlockViews } from './blocks/core.view.js';
import { registerCannonView } from './weapons/cannon/cannon.view.js';
import { registerForestView } from './biomes/forest.view.js';

/** Register compiled-in render descriptions before the orchestrator freezes registries. */
export function registerCoreView() {
  registerCoreBlockViews();
  registerCannonView();
  registerForestView();
}
