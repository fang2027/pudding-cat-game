import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mission,RULES} from '../src/mission.js';
import {player,step} from '../src/physics.js';
const npc={x:-12,y:0,grounded:true};
const prop={x:RULES.propX,y:0,grounded:true};
test('exploration is untimed; accepting starts a fresh timer only once',()=>{
 const m=new Mission();m.tick(100);assert.equal(m.remaining,60);assert.equal(m.collect(prop),false);
 assert.equal(m.start(),true);m.tick(2);assert.equal(m.start(),false);assert.equal(m.remaining,58);
});
test('only bringing the prop back earns a single saved time bonus',()=>{
 const m=new Mission();m.start();assert.equal(m.finish(npc),null);assert.equal(m.collect(npc),false);
 assert.equal(m.collect(prop),true);assert.equal(m.collect(prop),false);assert.equal(m.finish(prop),null);
 m.tick(17.4);assert.equal(m.finish(npc).kind,'success');assert.equal(m.score,920);
 assert.equal(m.finish(npc),null);assert.equal(m.start(),false);m.tick(100);assert.equal(m.score,920);
 m.fail('fall');assert.equal(m.score,920);assert.equal(m.phase,'complete');
});
test('timeout and failures share three lives, drop the prop, and allow retries',()=>{
 const m=new Mission();m.start();m.collect(prop);assert.equal(m.tick(61).kind,'failure');
 assert.equal(m.lives,2);assert.equal(m.carrying,false);assert.equal(m.phase,'idle');
 m.start();assert.equal(m.remaining,60);m.fail('reset');m.start();m.fail('fall');
 assert.equal(m.lives,0);assert.equal(m.phase,'gameover');assert.equal(m.start(),false);
 assert.equal(m.fail('again'),null);m.restart();assert.equal(m.lives,3);assert.equal(m.score,0);assert.equal(m.phase,'idle');
});
test('a physical round trip across the stage can return the prop within the limit',()=>{
 const p=player(),m=new Mission();m.start();let elapsed=0;
 function moveTo(x,jump=false){
  for(let i=0;i<600;i++){
   const dir=Math.abs(x-p.x)<.025?0:Math.sign(x-p.x);
   assert.equal(step(p,dir,jump&&i===0,1/120),false,`fell heading to ${x}`);
   assert.equal(m.tick(1/120),null,'time ran out');m.collect(p);elapsed+=1/120;
   if(Math.abs(x-p.x)<.025&&p.grounded)return;
  }
  assert.fail(`cannot reach ${x}; stopped at ${p.x}, ${p.y}`);
 }
 moveTo(-7.05);moveTo(-5.5,true);moveTo(-2.7,true);moveTo(-.1);moveTo(2.9,true);
 moveTo(3.85);moveTo(5.6,true);moveTo(8,true);moveTo(13);
 assert.equal(m.carrying,true);
 moveTo(11.95);moveTo(10.3,true);moveTo(8,true);moveTo(5.5);moveTo(2.1);
 moveTo(-.8,true);moveTo(-1.5);moveTo(-2.7,true);moveTo(-5.5,true);moveTo(-12);
 assert.equal(m.finish(p).kind,'success');assert.ok(elapsed<60);assert.equal(m.lives,3);
});
