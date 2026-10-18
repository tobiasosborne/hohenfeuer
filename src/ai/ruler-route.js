// src/ai/ruler-route.js - owns ordinary MOVE commands along a ruler's stair/ladder path.
import {BLOCK,K} from '../contracts.js';
import {TUNING as T} from '../tuning.js';
import {atan2,TAU} from '../core/fmath.js';

/** Consume reached nodes in controller-owned memory; never mutate the public plot/body.
 * Stair nodes name the voxel base; the physical feet stand on its upper surface.
 * The command persists for thinkTicks, so cap speed to avoid overshooting a node.
 */
export function rulerPathMove(plot,ruler,path,thinkTicks=T.sim.aiThinkEveryTicks){
 const o=plot.origin,pos=ruler.pos;
 while(path.length){
  const c=path[0],dx=o.x+c[0]+.5-pos.x,dz=o.z+c[2]+.5-pos.z,dy=o.y+c[1]-pos.y;
  const at=[Math.floor(pos.x-o.x),Math.floor(pos.y-o.y),Math.floor(pos.z-o.z)];
  const ladder=plot.type[at[0]+plot.width*at[2]+plot.width*plot.depth*at[1]]===BLOCK.LADDER;
  const arrivedHeight=ladder?Math.abs(dy)<.7:dy<=.7&&dy>=-1.1;
  if(dx*dx+dz*dz<.04&&arrivedHeight){path.shift();continue;}
  if(dx*dx+dz*dz<.04&&ladder)return {fwd:dy>0?K.MOVE_AXIS_MAX:-K.MOVE_AXIS_MAX,strafe:0,yaw:ruler.yaw??0,pitch:0,jump:0,sprint:0};
  const yaw=(Math.round(atan2(dx,-dz)/TAU*K.YAW_UNITS)+K.YAW_UNITS)%K.YAW_UNITS;
  const fwd=Math.min(K.MOVE_AXIS_MAX,Math.max(1,Math.round(Math.sqrt(dx*dx+dz*dz)/(T.ruler.walk*thinkTicks/T.sim.tickHz)*K.MOVE_AXIS_MAX)));
  return {fwd,strafe:0,yaw,pitch:0,jump:ladder&&dy<.7?1:0,sprint:0};
 }
 return {fwd:0,strafe:0,yaw:ruler.yaw??0,pitch:0,jump:0,sprint:0};
}
