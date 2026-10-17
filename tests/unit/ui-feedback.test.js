// owns: causal HUD regression tests without a DOM or simulation mutations.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EV, IDLE_REASON, K } from '../../src/contracts.js';
import { createBattleFeedback, impactOffset, impactText, palaceStatus, pressureText, idleDiagnosis, threatEdge, lossAccount, readableWork } from '../../src/ui/battle-feedback.js';
import { createMenu, SCREEN, MENU_EVENT } from '../../src/ui/menus.js';

const state = (tick = 0) => ({ tick, castles: [{slot:0, plot:{origin:{x:0,y:0,z:0}}, stats:{}},{slot:1,plot:{origin:{x:190,y:0,z:0}}}], weapons:[{id:4,slot:1,defId:'cannon',pos:{x:190,y:0,z:0}}], rulers:[{pos:{x:0,y:0,z:0}}] });
const ev = (type,payload) => ({type,payload});
test('a salvo keeps every threat but sounds at most once per second',()=>{
  const f=createBattleFeedback(0),threat=id=>ev(EV.RULER_THREAT,{castle:0,fromCastle:1,fromWeapon:4,projectileId:id,impactPos:[0,0,0],etaTicks:90});
  assert.equal(f.ingest([threat(1)],state(0)).sound,true);
  assert.equal(f.ingest([threat(2)],state(10)).sound,false);
  assert.equal(f.ingest([threat(3)],state(30)).sound,true);
});
test('world progress labels avoid fixed HUD areas and each other',()=>{
  const visible=readableWork([{screen:[512,100]},{screen:[512,384],active:true},{screen:[520,386]},{screen:[600,480]},{screen:[700,300]}]);
  assert.deepEqual(visible.map(j=>j.screen),[[512,384],[700,300]]);
});
test('danger is local, deduplicated, expires at impact and rotates with the camera', () => {
  const f=createBattleFeedback(0), s=state(30);
  const threat=ev(EV.RULER_THREAT,{castle:0,fromCastle:1,fromWeapon:4,projectileId:8,impactPos:[0,0,0],etaTicks:90});
  assert.equal(f.ingest([threat,threat],s).warnings.length,1);
  assert.equal(f.danger(60).etaTicks,60);
  assert.equal(f.danger(120),null);
  assert.equal(f.ingest([ev(EV.RULER_THREAT,{...threat.payload,castle:1,projectileId:9})],s).warnings.length,0);
  assert.ok(threatEdge(90,0).x>950);
  assert.ok(threatEdge(90,90).y<180);
  assert.ok(threatEdge(90,270).y>490);
  assert.ok(threatEdge(180,0).y+16<514,'rear warning stays above the shot-reference text');
  f.ingest([ev(EV.IMPACT,{projectileId:8})],state(70)); assert.equal(f.danger(71),null);
});
test('integrity hides missing contracts and reports the actual moving defeat line', () => {
  assert.equal(palaceStatus({},900*30),null);
  assert.equal(palaceStatus({palaceIntegrity:1,palaceDefeatThreshold:.3},10),null);
  assert.deepEqual(palaceStatus({palaceIntegrity:.62,palaceDefeatThreshold:.425,keepCracking:true},750*30),{integrity:.62,threshold:.425,margin:.195});
  const f=createBattleFeedback(0),s=state();
  for(const [tick,line,count] of [[599*30,.3,0],[600*30,.3,1],[601*30,.301,0],[900*30,.55,1],[901*30,.55,0]]) {
    s.tick=tick;s.castles[0].palaceDefeatThreshold=line;s.castles[0].palaceIntegrity=.8;
    assert.equal(f.ingest([],s).notices.length,count);
  }
});
test('signed miss is measured along the shot bearing, not world axes or later aim',()=>{
  assert.deepEqual(impactOffset({x:0,z:0},{x:190,z:0},{x:180,z:3}),{range:-10,lateral:3});
  assert.deepEqual(impactOffset([0,0,0],[0,0,-190],[3,0,-200]),{range:10,lateral:3});
  assert.match(impactText({offset:{range:-10,lateral:3},kind:'wall'},'en'),/Wall.*10 m short.*3 m right/);
  assert.match(impactText({offset:{range:2,lateral:-3},kind:'palace'},'en'),/Palace.*2 m long.*3 m left/);
});
test('shot references survive impacts, retain previous mark, and message lasts two seconds',()=>{
  const f=createBattleFeedback(0),s=state();
  f.shot({weaponId:1,projectileId:10,origin:[0,0,0],aimPoint:[190,0,0],aim:{az:900,range:1000}},0);
  f.ingest([ev(EV.IMPACT,{slot:0,weaponId:1,projectileId:10,pos:[180,0,3],hit:'block'})],s);
  assert.equal(f.impact(1,59).kind,'wall');assert.equal(f.impact(1,60),null);
  f.shot({weaponId:1,projectileId:11,origin:[0,0,0],aimPoint:[190,0,0],aim:{az:890,range:1010}},70);
  assert.deepEqual(f.reference(1).previousImpact,[180,0,3]);
});
test('overlapping flights attribute the old impact without replacing the new shot reference',()=>{
  const f=createBattleFeedback(0);
  f.shot({weaponId:1,projectileId:10,origin:[0,0,0],aimPoint:[190,0,0],aim:{az:900,range:1000}},0);
  f.shot({weaponId:1,projectileId:11,origin:[0,0,0],aimPoint:[210,0,0],aim:{az:900,range:1100}},10);
  f.ingest([ev(EV.IMPACT,{slot:0,weaponId:1,projectileId:10,pos:[180,0,3],hit:'block'})],state(20));
  assert.equal(f.impact(1,20).offset.range,-10);
  assert.deepEqual(f.reference(1).aimPoint,[210,0,0]);
  assert.deepEqual(f.reference(1).previousImpact,[180,0,3]);
});
test('loss uses exact killer attribution, keeps three decisive events, and falls back honestly',()=>{
  const s=state(1380);s.castles[0].reason='ruler';
  const f=createBattleFeedback(0);
  f.ingest([ev(EV.RULER_THREAT,{castle:0,fromCastle:1,fromWeapon:4,projectileId:8,impactPos:[0,0,0],etaTicks:90})],state(1290));
  f.ingest([ev(EV.RULER_DIED,{slot:0,fromCastle:1,fromWeapon:4,projectileId:8,cause:'blast'})],s);
  const a=lossAccount(s,0,f,{lang:'en',nameOf:()=> 'Kunibert',weaponName:()=> 'Cannon'});
  assert.match(a.cause,/0:46.*Kunibert.*Cannon.*E/); assert.ok(a.events.length<=3);
  assert.match(lossAccount(s,0,null,{lang:'en'}).cause,/ruler/i);
  s.castles[0]={reason:'palace',palaceIntegrity:.41,palaceDefeatThreshold:.425};
  assert.match(lossAccount(s,0,null,{lang:'en'}).cause,/41%.*42.5%/);
  s.castles[0]={reason:'surrender',pressure:[{cause:'casualties',weight:8}]};
  assert.match(lossAccount(s,0,null,{lang:'en'}).cause,/losses/i);
  s.castles[0]={reason:'surrender',pressure:[{cause:'quiet',weight:1}]};
  assert.equal(lossAccount(s,0,null,{lang:'en'}).cause,'0:46: Your castle surrendered.');
});
test('the actual elimination rule wins over a simultaneous ruler death; collapse stays attributable',()=>{
  const s=state(1380),f=createBattleFeedback(0);
  f.ingest([ev(EV.RULER_DIED,{slot:0,cause:'collapse'})],s);
  assert.match(lossAccount(s,0,f,{lang:'en'}).cause,/collapsing masonry/);
  s.castles[0]={reason:'palace',palaceIntegrity:.29,palaceDefeatThreshold:.3};
  assert.match(lossAccount(s,0,f,{lang:'en'}).cause,/Palace at 29%/);
});
test('pressure line explains actual hold and population triggers; absent fields hide',()=>{
  assert.equal(pressureText({},'en'),null);
  const text=pressureText({pressure:[{cause:'casualties',weight:8}],surrender:{morale:30,moraleThreshold:40,holdTicks:600,holdRequiredTicks:1350,population:15,popThreshold:14}},'en');
  assert.match(text,/losses/i);assert.match(text,/20\/45 s/);
});
test('a surrender account groups casualties from one blast instead of filling its three rows',()=>{
  const f=createBattleFeedback(0),s=state(100);s.castles[0].reason='surrender';
  f.ingest(Array.from({length:5},(_,entityId)=>ev(EV.NPC_DIED,{castle:0,entityId})),s);
  f.ingest([ev(EV.WEAPON_DESTROYED,{slot:0}),ev(EV.CASTLE_ELIMINATED,{slot:0,reason:'surrender'})],state(110));
  const a=lossAccount(s,0,f,{lang:'en'});assert.equal(a.events.length,3);assert.match(a.events[0],/5 people/);
});
test('idle diagnoses distinguish reasons with reachable, gated actions',()=>{
  const ctx={lang:'en',distance:2,features:{repair:false,orders:false},manned:false};
  assert.equal(idleDiagnosis({idleReason:undefined},ctx),null);
  assert.match(idleDiagnosis({idleReason:IDLE_REASON.NO_CREW,crewOrdered:false,detail:{crewPresent:0,crewRequired:2}},ctx),/crew.*E:/i);
  assert.match(idleDiagnosis({idleReason:IDLE_REASON.NO_AMMO,detail:{haulerEnRoute:true}},ctx),/ammunition.*en route/i);
  assert.match(idleDiagnosis({idleReason:IDLE_REASON.NO_GOLD},ctx),/gold/i);
  assert.match(idleDiagnosis({idleReason:IDLE_REASON.OBSTRUCTED,detail:{blockingCell:[1,2,3]}},ctx),/blocked/i);
  assert.doesNotMatch(idleDiagnosis({idleReason:IDLE_REASON.NO_CREW}, {...ctx,distance:12}),/E:|Q:/);
});
test('defeat offers Enter retry as its first action and preserves setup',()=>{
  const settings={map:'forest-duel',seed:6,slots:[]};
  const menu=createMenu({maps:[{id:'forest-duel',slots:[],wind:{}}],screen:SCREEN.OVER,settings});
  assert.equal(menu.key('Enter').type,MENU_EVENT.RESTART);assert.deepEqual(menu.settings,settings);
});
