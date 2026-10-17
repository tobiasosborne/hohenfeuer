// owns: probe determinism, command validity and measurement sanity checks for critique v2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runNovice } from './novice.mjs';
import { validateCommand, getBlock } from '../src/contracts.js';
import { TUNING as T } from '../src/tuning.js';
import { visibleTarget } from '../src/ai/view.js';
test('match-one probe replays deterministically, hits the enemy, and obeys the restricted command surface',()=>{
  const job={seed:1,level:2,policy:'match1',maxMinutes:1};
  const a=runNovice(job),b=runNovice(job);
  assert.equal(a.hash,b.hash);assert.equal(a.firstHitS,b.firstHitS);
  assert.ok(a.firstHitS>0&&a.firstHitS<=a.firstPalaceS);assert.ok(a.shots[0]>=2);
  assert.equal(a.remoteManualShots,0);
  for(const cmd of a.commandTrace){validateCommand(cmd);assert.ok(!['designate-weapon','repair-priority','shelter','auto-fire'].includes(cmd.type));}
  assert.equal(a.commandCounts['order-crew'],1);
  for(const w of a.windows){assert.ok(w.endS>w.startS);assert.equal(new Set(w.types).size,w.types.length);assert.ok(w.match1.every(t=>['aim','fire','designate','move'].includes(t)));}
});
test('embodied novice leaves the gun and uses visible nearby damaged cells for priority repair',()=>{
  let repairs=0;
  const result=runNovice({seed:1,level:5,policy:'novice',maxMinutes:2,onCommands(state,commands){
    for(const c of commands){validateCommand(c);if(c.type!=='repair-priority')continue;
      repairs++;const r=state.rulers[0],p=state.castles[0].plot,i=c.cell[0]+p.width*c.cell[2]+p.width*p.depth*c.cell[1];
      const eye={...r.pos,y:r.pos.y+T.ruler.eye},pos={x:p.origin.x+c.cell[0]+.5,y:p.origin.y+c.cell[1]+.5,z:p.origin.z+c.cell[2]+.5};
      assert.equal(r.manning,null);assert.ok(p.hp[i]<getBlock(p.type[i]).hp);
      assert.ok(Math.hypot(pos.x-eye.x,pos.y-eye.y,pos.z-eye.z)<=T.ruler.interactOrderM);
      assert.ok(visibleTarget(state,eye,{slot:0,index:i,pos}));
    }
  }});
  assert.ok(repairs>0);assert.equal(result.remoteManualShots,0);assert.equal(result.commandCounts['order-crew'],1);
});
