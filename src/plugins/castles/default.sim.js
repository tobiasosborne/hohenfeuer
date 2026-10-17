// src/plugins/castles/default.sim.js - owns the symmetric playable starter castle blueprint.
import { FACING, registerCastle } from '../../contracts.js';
import { TUNING } from '../../tuning.js';

const WIDTH = TUNING.world.plotW, DEPTH = TUNING.world.plotD, HEIGHT = 16;

/** Paint a deterministic ASCII blueprint; y=0 foundation is supplied by castle-load.
 * Plan (north up), inside a six-cell plot margin:
 *     TTTTTT########################TTTTTT
 *     T....T      north wall        T....T
 *     ######                       ######
 *     #             KEEP                #
 *     # C           PPPP              C #   C: gun above a mount
 *     #             PPPP                #   P: 4x4x3 palace core
 *     # ^^           MM            ^^   #   ^: two-wide stairs rising north
 *     #              MM                 #   M: 2x2x2 magazine
 *     TTTTTT#########DD###########TTTTTT
 * Four hollow 6x6 towers reach y=11 with ladders and floor openings.
 * Walls are three cells thick and six high; the walkway is y=7 with two air cells.
 * ASCII legends cannot encode metadata, so every stair rises north (FACING.N).
 * @returns {ReadonlyArray<ReadonlyArray<string>>}
 */
function makeLayers() {
  const cells = Array.from({ length: HEIGHT }, () => Array.from({ length: DEPTH }, () => Array(WIDTH).fill('.')));
  /** Paint an inclusive box in castle-local x/y/z coordinates. */
  function box(ch, x0, y0, z0, x1, y1, z1) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) cells[y - 1][z][x] = ch;
  }
  /** Paint a hollow single-cell shell. */
  function shell(ch, x0, z0, x1, z1, top) {
    box(ch, x0, 1, z0, x1, top, z0); box(ch, x0, 1, z1, x1, top, z1);
    box(ch, x0, 1, z0, x0, top, z1); box(ch, x1, 1, z0, x1, top, z1);
  }

  // Three-thick curtain walls and an outside merlon row; x reflection is exact.
  box('#', 6, 1, 6, 8, 6, 41); box('#', 39, 1, 6, 41, 6, 41);
  box('#', 6, 1, 6, 41, 6, 8); box('#', 6, 1, 39, 41, 6, 41);
  for (let n = 6; n <= 41; n++) {
    if (n % 2 === 0) { box('#', 6, 7, n, 6, 7, n); box('#', 41, 7, n, 41, 7, n); }
    if (Math.min(n, WIDTH - 1 - n) % 2 === 0) { box('#', n, 7, 6, n, 7, 6); box('#', n, 7, 41, n, 7, 41); }
  }

  for (const x of [6, 36]) for (const z of [6, 36]) {
    box('.', x + 1, 1, z + 1, x + 4, 11, z + 4);
    shell('T', x, z, x + 5, z + 5, 11);
    box('F', x + 1, 5, z + 1, x + 4, 5, z + 4);
    box('F', x + 1, 11, z + 1, x + 4, 11, z + 4);
    const ladderX = x === 6 ? x + 3 : x + 2;
    box('L', ladderX, 1, z + 1, ladderX, 11, z + 1);
    const doorZ = z === 6 ? z + 5 : z;
    box('.', x + 2, 1, doorZ, x + 3, 3, doorZ);
    box('D', x + 2, 1, doorZ, x + 3, 2, doorZ);
    for (const n of [0, 2, 3, 5]) {
      box('T', x + n, 12, z, x + n, 12, z);
      box('T', x + n, 12, z + 5, x + n, 12, z + 5);
      box('T', x, 12, z + n, x, 12, z + n);
      box('T', x + 5, 12, z + n, x + 5, 12, z + n);
    }
  }

  // Both interior stairs rise north and connect directly to the wall walkway.
  for (const x of [9, 10, 37, 38]) {
    for (let step = 1; step <= 6; step++) {
      if (step > 1) box('#', x, 1, 35 - step, x, step - 1, 35 - step);
      box('S', x, step, 35 - step, x, step, 35 - step);
    }
    box('F', x, 6, 27, x, 6, 28);
  }
  box('C', 7, 6, 23, 7, 6, 23); box('C', 40, 6, 23, 40, 6, 23);

  // Gate opening: paired two-cell doors, three-cell clearance through the wall.
  box('G', 21, 1, 39, 26, 6, 41);
  box('.', 23, 1, 39, 24, 3, 41);
  box('D', 23, 1, 41, 24, 2, 41);

  // Ten-cube keep around the manual's 4x4x3 palace core, with a stepped tile roof.
  shell('T', 19, 16, 28, 25, 10);
  box('P', 22, 1, 19, 25, 3, 22);
  box('.', 23, 1, 25, 24, 3, 25); box('D', 23, 1, 25, 24, 2, 25);
  for (let tier = 0; tier < 5; tier++) box('R', 19 + tier, 11 + tier, 16 + tier, 28 - tier, 11 + tier, 25 - tier);

  box('M', 23, 1, 30, 24, 2, 31); box('R', 23, 3, 30, 24, 3, 31);
  for (const x of [13, 31]) {
    shell('W', x, 29, x + 3, 33, 3);
    box('F', x + 1, 3, 30, x + 2, 3, 32);
    box('D', x + 1, 1, 33, x + 2, 2, 33);
    box('R', x, 4, 29, x + 3, 4, 33); box('R', x + 1, 5, 30, x + 2, 5, 32);
  }

  return Object.freeze(cells.map(layer => Object.freeze(layer.map(row => row.join('')))));
}

/** @type {import('../../contracts.js').CastleDef} */
export const DEFAULT_CASTLE = Object.freeze({
  id: 'default', name: Object.freeze({ de: 'Hohenfeuer', en: 'Hohenfeuer' }),
  size: Object.freeze([WIDTH, HEIGHT, DEPTH]),
  legend: Object.freeze({ '#': 'stone', T: 'tower', G: 'gate', W: 'wood', F: 'floor', S: 'stairs', L: 'ladder', D: 'door', R: 'roof', M: 'magazine', P: 'palace', C: 'mount' }),
  layers: makeLayers(),
  weapons: Object.freeze([
    Object.freeze({ id: 'cannon', at: Object.freeze([7, 7, 23]), facing: FACING.W }),
    Object.freeze({ id: 'cannon', at: Object.freeze([40, 7, 23]), facing: FACING.E }),
  ]),
  // Coordinates are the weapon feet, one cell above the mount block.
  mountSpots: Object.freeze([Object.freeze([7, 7, 23, FACING.W]), Object.freeze([40, 7, 23, FACING.E])]),
  shelters: Object.freeze([Object.freeze([20, 1, 17, 21, 1, 23]), Object.freeze([26, 1, 17, 27, 1, 23])]),
  workSpots: Object.freeze([Object.freeze([16, 1, 27]), Object.freeze([31, 1, 27])]),
  exit: Object.freeze([23, 1, 42]), rulerSpawn: Object.freeze([23, 1, 27]), throne: Object.freeze([23, 1, 23]),
  population: TUNING.npc.population,
});

/** Register a blueprint usable unchanged by both duel slots. */
export function registerDefaultCastle() { registerCastle(DEFAULT_CASTLE); }
