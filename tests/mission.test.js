import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mission,RULES,PROPS} from '../src/mission.js';
import {player,step} from '../src/physics.js';
const npc={x:-12,y:0,grounded:true};
const atProp=prop=>({x:prop.x,y:prop.y-.65,z:prop.z,grounded:true});
test('exploration is untimed; accepting starts a fresh timer only once',()=>{
 const m=new Mission();m.tick(100);assert.equal(m.remaining,RULES.seconds);assert.equal(m.collect(atProp(PROPS[0])),false);
 assert.equal(m.start(),true);m.tick(2);assert.equal(m.start(),false);assert.equal(m.remaining,RULES.seconds-2);
});
test('all three distinct props must be returned before a single score is awarded',()=>{
 const m=new Mission();m.start();assert.equal(m.finish(npc),null);
 for(const item of [PROPS[2],PROPS[0]]){
  assert.equal(m.collect(atProp(item)),true);assert.equal(m.collect(atProp(item)),false);
  assert.equal(m.finish(npc),null);assert.equal(m.score,0);
 }
 assert.equal(m.collected.size,2);assert.equal(m.allCollected,false);
 m.collect(atProp(PROPS[1]));assert.equal(m.allCollected,true);
 assert.equal(m.finish(atProp(PROPS[1])),null);assert.equal(m.finish({...npc,y:4.4}),null);
 m.tick(17.4);assert.equal(m.finish(npc).kind,'success');assert.equal(m.score,920);
 assert.equal(m.finish(npc),null);assert.equal(m.start(),false);m.tick(100);assert.equal(m.score,920);
 m.fail('fall');assert.equal(m.score,920);assert.equal(m.phase,'complete');
});
test('props require the correct height and depth',()=>{
 const m=new Mission();m.start();
 assert.equal(m.collect({...atProp(PROPS[1]),y:0}),false);
 assert.equal(m.collect({...atProp(PROPS[2]),z:0}),false);
 assert.equal(m.collected.size,0);
});
test('failure clears every pickup, restores the route, and uses shared lives',()=>{
 const m=new Mission();m.start();PROPS.forEach(prop=>m.collect(atProp(prop)));
 assert.equal(m.tick(RULES.seconds+1).kind,'failure');
 assert.equal(m.lives,2);assert.equal(m.collected.size,0);assert.equal(m.phase,'idle');
 m.start();assert.equal(m.remaining,RULES.seconds);assert.equal(m.collect(atProp(PROPS[0])),true);
 m.fail('reset');assert.equal(m.collected.size,0);m.start();m.fail('fall');
 assert.equal(m.lives,0);assert.equal(m.phase,'gameover');assert.equal(m.start(),false);
 assert.equal(m.fail('again'),null);m.restart();assert.equal(m.lives,3);assert.equal(m.score,0);assert.equal(m.collected.size,0);
});
test('physical route reaches both floors, collects all three, and returns in time',()=>{
 const p=player(),m=new Mission();m.start();let elapsed=0;
 function moveTo(target,jump=false,height,axis='x'){
  for(let i=0;i<600;i++){
   const dir=Math.abs(target-p[axis])<.025?0:Math.sign(target-p[axis]);
   assert.equal(step(p,axis==='x'?dir:0,jump&&i===0,1/120,axis==='z'?dir:0),false,`fell heading to ${target}`);
   assert.equal(m.tick(1/120),null,'time ran out');m.collect(p);elapsed+=1/120;
   if(Math.abs(target-p[axis])<.025&&p.grounded){
    if(height!==undefined)assert.ok(Math.abs(p.y-height)<.01,`expected height ${height} at ${target}, got ${p.y}`);
    return;
   }
  }
  assert.fail(`cannot reach ${target}; stopped at ${p.x}, ${p.y}`);
 }
 const x=moveTo,z=(target,jump,height)=>moveTo(target,jump,height,'z');
 z(-6);x(-5);assert.equal(m.collected.size,1);
 z(-8);x(7.05);z(-6,true,.9);x(6.55);x(4.1,true,2);
 x(4.75);x(7.05,true,3.2);x(7.85);x(10,true,4.4);x(12.75);assert.equal(m.collected.size,2);
 z(-8);x(13);z(0);assert.equal(m.allCollected,true);
 z(-8);x(0);x(-11);z(0);
 assert.equal(m.finish(p).kind,'success');assert.ok(elapsed<RULES.seconds);assert.equal(m.lives,3);
});
