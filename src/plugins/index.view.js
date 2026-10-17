// src/plugins/index.view.js - owns explicit registration of Phase 1 render content.
import { registerCoreBlockViews } from './blocks/core.view.js';
import { registerCannonView } from './weapons/cannon/cannon.view.js';
import { registerCatapultView } from './weapons/catapult/catapult.view.js';
import { registerDoubleCannonView } from './weapons/double-cannon/double-cannon.view.js';
import { registerFireCatapultView } from './weapons/fire-catapult/fire-catapult.view.js';
import { registerBallistaView } from './weapons/ballista/ballista.view.js';
import { registerRocketView } from './weapons/rocket/rocket.view.js';
import { registerTrebuchetView } from './weapons/trebuchet/trebuchet.view.js';
import { registerArcaballistaView } from './weapons/arcaballista/arcaballista.view.js';
import { registerFatFredaView } from './weapons/fat-freda/fat-freda.view.js';
import { registerHellfireView } from './weapons/hellfire/hellfire.view.js';
import { registerZeppelinView } from './weapons/zeppelin/zeppelin.view.js';
import { registerBombView } from './weapons/bomb/bomb.view.js';
import { registerForestView } from './biomes/forest.view.js';

/** Register compiled-in render descriptions before the orchestrator freezes registries. */
export function registerCoreView() {
  registerCoreBlockViews();
  registerCannonView();
  registerCatapultView();
  registerDoubleCannonView();
  registerFireCatapultView();
  registerBallistaView();
  registerRocketView();
  registerTrebuchetView();
  registerArcaballistaView();
  registerFatFredaView();
  registerHellfireView();
  registerZeppelinView();
  registerBombView();
  registerForestView();
}
