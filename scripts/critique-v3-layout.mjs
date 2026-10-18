// owns: exact x-reflection audit of starter geometry, entity anchors and approach terrain.
import {writeFileSync} from 'node:fs';
import * as C from '../src/contracts.js';
import {registerCoreSim} from '../src/plugins/index.sim.js';
import {createSim} from '../src/sim/sim.js';
import {createSlotTable} from '../src/ai/slots.js';
import {sampleHeight} from '../src/world/terrain.js';
registerCoreSim();C.freezeRegistries();const map=C.getMap('forest-duel'),def=C.getCastle('default');
const pairs={cells:0,differentCells:0,examples:[]};
for(let y=0;y<def.layers.length;y++)for(let z=0;z<48;z++)for(let x=0;x<48;x++){pairs.cells++;if(def.layers[y][z][x]!==def.layers[y][z][47-x]){pairs.differentCells++;if(pairs.examples.length<12)pairs.examples.push([x,y+1,z]);}}
const anchors=Object.fromEntries(['rulerSpawn','throne','exit'].map(k=>[k,{actual:def[k],reflected:[47-def[k][0],...def[k].slice(1)],xDifference:47-2*def[k][0]}]));
const seeds=[];for(let seed=1;seed<=20;seed++){const sim=createSim({map,seed,slots:createSlotTable(map)}),s=sim.state,t=s.terrain,profile=[];for(let x=120;x<=264;x+=4)profile.push({x,westToEast:sampleHeight(t,x,127.5),reflected:sampleHeight(t,384-x,127.5)});seeds.push({seed,wind:s.wind.direction,speed:s.wind.speed,profile});}
writeFileSync('tests/evidence/critique-v3/layout.json',JSON.stringify({pairs,anchors,weapons:def.weapons,mounts:def.mountSpots,workSpots:def.workSpots,shelters:def.shelters,seeds},null,2));console.log(pairs,anchors);
