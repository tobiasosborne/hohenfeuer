// src/sim/ruler.js - owns swept ruler movement, two-box stairs, ladders and fall damage.
import { BLOCK, K, FACING, COLLIDER } from '../contracts.js';
import { TUNING as T } from '../tuning.js';
import { sin, cos, sqrt, TAU } from '../core/fmath.js';
import { worldToCell, getCell } from '../world/grid.js';
import { sampleHeight } from '../world/terrain.js';
import { damagePerson } from './damage.js';
const EPS = 1e-9;
/** Feet position and velocity, with camera angles stored as command integers. */
export function createRuler(slot, pos, id = slot) { return { id, slot, isRuler: true, pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, radius: T.ruler.radius, height: T.ruler.height, hp: T.people.hp, yaw: 0, pitch: 0, grounded: true, fallPeak: pos.y, lastDamageTick: -T.people.rulerRegenDelayS * K.TICK_HZ, manning: null }; }
function bounds(ruler, pos) { return { min: { x: pos.x - ruler.radius, y: pos.y, z: pos.z - ruler.radius }, max: { x: pos.x + ruler.radius, y: pos.y + ruler.height, z: pos.z + ruler.radius } }; }
function boxes(ctx, broad, visit) {
  for (const castle of ctx.state.castles) {
    const plot = castle.plot, lo = worldToCell(plot, broad.min), hi = worldToCell(plot, broad.max);
    for (let y = Math.max(0, lo.y); y <= Math.min(plot.height - 1, hi.y); y++) for (let z = Math.max(0, lo.z); z <= Math.min(plot.depth - 1, hi.z); z++) for (let x = Math.max(0, lo.x); x <= Math.min(plot.width - 1, hi.x); x++) {
      const cell = getCell(plot, x, y, z), def = ctx.getBlock(cell.type);
      if (!cell.type || cell.type === BLOCK.DOOR || cell.type === BLOCK.LADDER || def?.passable || def?.collider === COLLIDER.NONE) continue;
      const min = { x: plot.origin.x + x, y: plot.origin.y + y, z: plot.origin.z + z }, max = { x: min.x + 1, y: min.y + 1, z: min.z + 1 };
      if (cell.type === BLOCK.STAIRS || def?.collider === COLLIDER.STAIRS) {
        visit({ min, max: { ...max, y: min.y + 0.5 } });
        const upper = { min: { ...min, y: min.y + 0.5 }, max: { ...max } }, facing = cell.meta & 3;
        if (facing === FACING.N) upper.max.z -= 0.5;
        if (facing === FACING.E) upper.min.x += 0.5;
        if (facing === FACING.S) upper.min.z += 0.5;
        if (facing === FACING.W) upper.max.x -= 0.5;
        visit(upper);
      } else visit({ min, max });
    }
  }
}
function intersects(a, b) { return ['x', 'y', 'z'].every(axis => a.max[axis] > b.min[axis] + EPS && a.min[axis] < b.max[axis] - EPS); }
function clear(ctx, ruler, pos) { const box = bounds(ruler, pos); let ok = true; boxes(ctx, box, other => { if (intersects(box, other)) ok = false; }); return ok; }
function sweep(ctx, ruler, pos, axis, delta) {
  if (delta === 0) return 0;
  const body = bounds(ruler, pos), broad = { min: { ...body.min }, max: { ...body.max } };
  broad.min[axis] += Math.min(0, delta); broad.max[axis] += Math.max(0, delta);
  let allowed = delta;
  boxes(ctx, broad, box => {
    for (const other of ['x', 'y', 'z']) if (other !== axis && (body.max[other] <= box.min[other] + EPS || body.min[other] >= box.max[other] - EPS)) return;
    if (delta > 0 && body.max[axis] <= box.min[axis] + EPS) allowed = Math.min(allowed, Math.max(0, box.min[axis] - body.max[axis]));
    if (delta < 0 && body.min[axis] >= box.max[axis] - EPS) allowed = Math.max(allowed, Math.min(0, box.max[axis] - body.min[axis]));
  });
  return allowed;
}
function onLadder(ctx, ruler) { for (const { plot } of ctx.state.castles) { const p = worldToCell(plot, { ...ruler.pos, y: ruler.pos.y + 0.25 }); if (getCell(plot, p.x, p.y, p.z)?.type === BLOCK.LADDER) return true; } return false; }
/** Advance one ruler, sweeping all three axes rather than testing only the final position. */
export function tickRuler(ctx, ruler, input = {}, dt = K.DT) {
  if (ruler.hp <= 0) return;
  ruler.yaw = input.yaw ?? ruler.yaw; ruler.pitch = input.pitch ?? ruler.pitch;
  const fwd = (input.fwd ?? 0) / K.MOVE_AXIS_MAX, strafe = (input.strafe ?? 0) / K.MOVE_AXIS_MAX, norm = Math.max(1, sqrt(fwd * fwd + strafe * strafe));
  const speed = input.sprint ? T.ruler.sprint : T.ruler.walk, yaw = ruler.yaw * TAU / K.YAW_UNITS;
  const ladder = onLadder(ctx, ruler) && !input.jump;
  ruler.vel.x = ladder || ruler.manning !== null ? 0 : (sin(yaw) * fwd + cos(yaw) * strafe) * speed / norm;
  ruler.vel.z = ladder || ruler.manning !== null ? 0 : (-cos(yaw) * fwd + sin(yaw) * strafe) * speed / norm;
  for (const axis of ['x', 'z']) {
    const wanted = ruler.vel[axis] * dt, moved = sweep(ctx, ruler, ruler.pos, axis, wanted);
    if (Math.abs(moved - wanted) > EPS && ruler.grounded) {
      const raised = { ...ruler.pos, y: ruler.pos.y + T.ruler.autoStep };
      if (clear(ctx, ruler, raised)) {
        const stepped = sweep(ctx, ruler, raised, axis, wanted);
        if (Math.abs(stepped) > Math.abs(moved) + EPS) {
          raised[axis] += stepped;
          raised.y += sweep(ctx, ruler, raised, 'y', -T.ruler.autoStep);
          ruler.pos = raised; continue;
        }
      }
    }
    ruler.pos[axis] += moved;
  }
  if (input.jump && ruler.grounded) { ruler.vel.y = T.ruler.jumpV; ruler.grounded = false; }
  if (ladder) ruler.vel.y = fwd * T.ruler.ladder;
  else ruler.vel.y -= T.ruler.gravity * dt;
  const wantedY = ruler.vel.y * dt, movedY = sweep(ctx, ruler, ruler.pos, 'y', wantedY);
  ruler.pos.y += movedY;
  let landed = wantedY < 0 && movedY > wantedY + EPS;
  if (ctx.state.terrain) {
    const ground = sampleHeight(ctx.state.terrain, ruler.pos.x, ruler.pos.z);
    if (ruler.pos.y < ground) { ruler.pos.y = ground; landed = wantedY <= 0; }
  }
  ruler.fallPeak = Math.max(ruler.fallPeak, ruler.pos.y);
  if (landed) {
    const drop = ruler.fallPeak - ruler.pos.y;
    if (drop > T.people.fallSafeM) damagePerson(ctx, ruler, (drop - T.people.fallSafeM) * T.people.fallDmgPerM, ruler.slot, 'fall');
    ruler.fallPeak = ruler.pos.y; ruler.vel.y = 0;
  } else if (Math.abs(movedY - wantedY) > EPS) ruler.vel.y = 0;
  ruler.grounded = landed;
  if (ladder) ruler.fallPeak = ruler.pos.y;
  if (ctx.state.tick - ruler.lastDamageTick >= T.people.rulerRegenDelayS * K.TICK_HZ && ruler.hp > 0) ruler.hp = Math.min(T.people.hp, ruler.hp + T.people.rulerRegenHpS * dt);
}
