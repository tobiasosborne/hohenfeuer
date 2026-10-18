// owns: wave 3 terminal-shot honesty, universal surrender warning and palace recovery regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EV, BLOCK } from '../../src/contracts.js';
import * as feedback from '../../src/ui/battle-feedback.js';
const ev=(type,payload)=>({type,payload});
const state=tick=>({tick,projectiles:[],weapons:[],rulers:[{pos:{x:0,y:0,z:0}}],castles:[{slot:0,plot:{origin:{x:0,y:0,z:0},width:48,depth:48}}, {slot:1,plot:{origin:{x:190,y:0,z:0},width:48,depth:48}}]});
const shot=(f,id=1)=>f.shot({weaponId:1,projectileId:id,origin:[0,2,20],aimPoint:[220,0,20],aim:{az:900,range:1000}},0);
test('loss captions never project a last position as a landing, and preserve the previous impact',()=>{
 const f=feedback.createBattleFeedback(0);shot(f);
 f.ingest([ev(EV.IMPACT,{slot:0,weaponId:1,projectileId:1,pos:[200,0,20],hit:'block'})],state(1));
 shot(f,2);f.ingest([ev(EV.PROJECTILE_LOST,{slot:0,weaponId:1,projectileId:2,pos:[350,30,20],reason:'out-of-map'})],state(2));
 const result=f.impact(1,2);assert.equal(result.kind,'lost');assert.equal(result.impact,undefined);assert.equal(result.offset,undefined);
 assert.match(feedback.impactText(result,'en'),/left the map beyond the far wall.*reduce charge/i);
 assert.deepEqual(f.reference(1).previousImpact,[200,0,20]);assert.equal(f.reference(1).impact,undefined);
});
test('legacy disappearance produces an honest fallback within two seconds and cannot repeat',()=>{
 const f=feedback.createBattleFeedback(0);shot(f);const s=state(1);s.projectiles=[{id:1,pos:{x:30,y:9,z:20}}];f.ingest([],s);
 f.ingest([],state(2));f.ingest([],state(62));
 assert.match(feedback.impactText(f.impact(1,62),'en'),/lost/i);assert.equal(f.impact(1,62).impact,undefined);
 f.ingest([],state(130));assert.equal(f.impact(1,130),null);
});
test('launch vectors are copied and signed axes survive external aim mutations',()=>{
 const f=feedback.createBattleFeedback(0),origin=[0,0,0],aimPoint=[190,0,0],aim={az:900,range:1000};
 f.shot({weaponId:1,projectileId:1,origin,aimPoint,aim},0);origin[0]=90;aimPoint[2]=90;aim.az=1800;
 f.ingest([ev(EV.IMPACT,{slot:0,weaponId:1,projectileId:1,pos:[180,0,3],hit:'block'})],state(10));
 assert.deepEqual(f.impact(1,10).offset,{range:-10,lateral:3});assert.equal(f.reference(1).aim.az,900);
});
test('short loss, expiry, own obstruction, enemy interception and palace have distinct captions',()=>{
 const f=feedback.createBattleFeedback(0);
 for(const [id,pos,hit,want] of [[1,[12,7,20],'block',/own wall.*clear/i],[2,[194,7,20],'block',/enemy wall.*intercept/i],[3,[200,7,20],{kind:'block',plot:1,id:BLOCK.PALACE},/palace damaged/i]]) {
  shot(f,id);f.ingest([ev(EV.IMPACT,{slot:0,weaponId:1,projectileId:id,pos,hit})],state(id));assert.match(feedback.impactText(f.impact(1,id),'en'),want);
 }
 for(const [id,reason,pos,want] of [[4,'below-ground',[60,-4,20],/fell short of the map/i],[5,'expired',[60,40,20],/lost/i]]) {
  shot(f,id);f.ingest([ev(EV.PROJECTILE_LOST,{slot:0,weaponId:1,projectileId:id,pos,reason})],state(id));assert.match(feedback.impactText(f.impact(1,id),'en'),want);
 }
});
test('population warning is strict, contextual and independent of pressure/morale unlock',()=>{
 const c={surrender:{population:16,popThreshold:14}};
 assert.equal(feedback.populationText(c,'en'),'Population 16, surrender below 14');
 c.surrender.population=17.5;assert.ok(feedback.populationText(c,'de'));
 c.surrender.population=18;assert.equal(feedback.populationText(c,'en'),null);
 assert.equal(feedback.populationText({},'en'),null);
});
test('match one hides ordinary morale pressure but never an active surrender clock',()=>{
 const c={pressure:[{cause:'deaths',weight:-1}],surrender:{morale:50,moraleThreshold:20,holdTicks:0,holdRequiredTicks:1350,population:20,popThreshold:14}};
 assert.equal(feedback.pressureText(c,'en',{moraleVisible:false}),null);
 c.surrender.morale=19;c.surrender.holdTicks=1320;
 assert.match(feedback.pressureText(c,'en',{moraleVisible:false}),/44\/45 s/);
});
test('win account follows recorded ruler reason even when population also crosses the line',()=>{
 const s=state(900);s.outcome={winners:[0],tick:900};Object.assign(s.castles[1],{eliminated:true,reason:'ruler',surrender:{population:12,popThreshold:14},stats:{eliminatedTick:900}});
 const f=feedback.createBattleFeedback(0);f.ingest([ev(EV.RULER_DIED,{slot:1,cause:'blast'}),ev(EV.CASTLE_ELIMINATED,{slot:1,reason:'ruler'})],s);
 assert.match(feedback.winAccount(s,0,f,{lang:'en',nameOf:()=> 'East'}).cause,/East.*ruler.*explosion/i);
 s.castles[1].reason='surrender';assert.match(feedback.winAccount(s,0,null,{lang:'en',nameOf:()=> 'East'}).cause,/12.*below 14/);
 s.castles[1].surrender={population:18,popThreshold:14,morale:19,moraleThreshold:20,holdTicks:1350,holdRequiredTicks:1350};
 assert.match(feedback.winAccount(s,0,null,{lang:'en'}).cause,/20%.*45 s/);
});
test('a winning account names the eliminated opponent, never a fallen ally',()=>{
 const s=state(1000);s.slots=[{id:0,team:0},{id:1,team:1},{id:2,team:0}];
 Object.assign(s.castles[1],{eliminated:true,reason:'ruler',stats:{eliminatedTick:900}});
 s.castles.push({slot:2,eliminated:true,reason:'palace',stats:{eliminatedTick:1000}});
 assert.match(feedback.winAccount(s,0,null,{lang:'en',nameOf:n=>n===1?'Enemy':'Ally'}).cause,/Enemy.*ruler/);
});
test('palace repair marker follows an active palace job and hides completed or unrelated work',()=>{
 const c={palaceIntegrity:.6,palaceDefeatThreshold:.2,palaceCells:[1],plot:{width:2,depth:2,type:new Uint8Array([0,BLOCK.PALACE]),hp:new Uint8Array([0,60])},jobs:[{id:3,kind:'repair',target:{cell:[1,0,0]},claimedBy:[2],progress:.625,reachable:true}]};
 assert.equal(feedback.palaceStatus(c,100).repair.progress,.625);
 assert.equal(feedback.palaceStatus(c,100,[{id:2,jobId:3,state:'walk'}]).repair,undefined);
 assert.equal(feedback.palaceStatus(c,100,[{id:2,jobId:3,state:'work'}]).repair.progress,.625);
 c.jobs[0].claimedBy=[];assert.equal(feedback.palaceStatus(c,100).repair,undefined);
 c.jobs[0].claimedBy=[2];c.jobs[0].progress=0;assert.equal(feedback.palaceStatus(c,100).repair,undefined,'queued/travelling work has no recovery marker');
 c.jobs=[];assert.equal(feedback.palaceStatus(c,100).repair,undefined);
});
test('the new semantic collision field survives deletion of the struck block',()=>{
 const f=feedback.createBattleFeedback(0);shot(f);
 f.ingest([ev(EV.IMPACT,{slot:0,weaponId:1,projectileId:1,pos:[300,1,30],hit:'block',hitKind:'palace'})],state(10));
 assert.match(feedback.impactText(f.impact(1,10),'en'),/Palace damaged/);
});
test('enemy palace repair in the same tick cannot turn an own-wall hit into palace damage',()=>{
 const f=feedback.createBattleFeedback(0),s=state(0),p=s.castles[1].plot;
 s.castles[1].palaceCells=[0];p.hp=new Uint8Array([60]);p.type=new Uint8Array([BLOCK.PALACE]);
 f.ingest([],s);shot(f);s.tick=1;p.hp[0]=61;
 f.ingest([ev(EV.IMPACT,{slot:0,weaponId:1,projectileId:1,pos:[12,7,20],hit:'block'}),ev(EV.BLOCK_DAMAGED,{plot:1,cell:[0,0,0],id:BLOCK.PALACE,hp:61})],s);
 assert.equal(f.impact(1,1).kind,'ownWall');
});
