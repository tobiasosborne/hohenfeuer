// tests/unit/npc-path-cache.test.js - owns bounded repeated path work and topology/mutation safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {findPathToAny} from '../../src/npc/path.js';
import {BLOCK} from '../../src/contracts.js';
import {fixture} from './npc-fixture.test.js';
test('repeated impossible paths avoid repeated grid scans and invalidate on topology change', () => {
  const f=fixture({width:10,depth:1});for(const y of [1,2,3])f.put(3,y,0,BLOCK.STONE);let reads=0;
  const type=f.plot.type;f.plot.type=new Proxy(type,{get(t,key){reads++;return Reflect.get(t,key,t);}});
  assert.equal(findPathToAny(f.plot,[1,1,0],[[8,1,0]]),null);const first=reads;reads=0;
  assert.equal(findPathToAny(f.plot,[1,1,0],[[8,1,0]]),null);assert.ok(reads<first/10);
  for(const y of [1,2,3])f.put(3,y,0,BLOCK.AIR);const path=findPathToAny(f.plot,[1,1,0],[[8,1,0]]);assert.ok(path);path[0][0]=999;
  assert.deepEqual(findPathToAny(f.plot,[1,1,0],[[8,1,0]])[0],[1,1,0]);
  for(const y of [1,2,3])f.put(3,y,0,BLOCK.STONE);assert.equal(findPathToAny(f.plot,[1,1,0],[[8,1,0]]),null);
});
