import {test} from 'node:test';
import assert from 'node:assert/strict';

test('saved stage edits apply to physics, NPC interactions and attached task points',async()=>{
 const offsets={
  'block-0':{x:2,y:1,z:0},
  'block-2':{x:1,y:.5,z:0},
  'block-4':{x:2,y:1,z:0},
  'block-8':{x:1,y:1,z:0},
  baby:{x:-1,y:0,z:0},
  girl:{x:.25,y:0,z:0}
 };
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
  getItem:()=>JSON.stringify({version:1,offsets})
 }});
 try{
  const {blocks,player,step}=await import('../src/physics.js');
  const {PADS,padUnderfoot,createLightRoundReset}=await import('../src/lights.js');
  const {Mission,PROPS}=await import('../src/mission.js');
  const {CONSOLE,CHASE_STAGES}=await import('../src/audio-mission.js');
  const {nearestCharacter}=await import('../src/npcs.js');
  const p=player();
  step(p,0,false,1/120);
  assert.deepEqual(p,{x:-9,y:1,z:0,vy:0,grounded:true});
  assert.equal(nearestCharacter({...p,x:-11})?.id,'baby');
  assert.equal(blocks[2].x,2.2);
  assert.equal(padUnderfoot({x:2.2,y:1.2,grounded:true})?.id,'B');
  assert.deepEqual(CONSOLE,{x:10.5,y:0,z:0});
  assert.deepEqual(CHASE_STAGES[0].path.at(-1),{x:1,y:0,z:-6});
  assert.deepEqual(CHASE_STAGES[2].path.at(-1),{x:7.8,y:5.4,z:-6});
  assert.equal(PROPS[1].x,9);assert.equal(PROPS[1].y,6.05);
  const mission=new Mission();
  mission.start('props');
  for(const prop of PROPS)mission.collect({x:prop.x,y:prop.y-.65,z:prop.z});
  assert.equal(mission.finish({x:-12,y:0,grounded:true}),null);
  assert.equal(mission.finish({x:-11,y:1,grounded:true})?.kind,'success');
  mission.start('lights');
  assert.equal(createLightRoundReset()(mission,p),true);
  assert.deepEqual(p,{x:.95,y:1,z:0,vy:0,grounded:true});
 }finally{delete globalThis.localStorage;}
});
