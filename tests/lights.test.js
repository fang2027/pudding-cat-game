import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mission,PROPS} from '../src/mission.js';
import {PADS,LightSequence,DEMO_SECONDS,LIGHT_RULES} from '../src/lights.js';
import {step} from '../src/physics.js';
const on=id=>({...PADS.find(p=>p.id===id),grounded:true});
function completeProps(m){m.start('props');PROPS.forEach(p=>m.collect({x:p.x,y:p.y-.65}));return m.finish({x:-12,y:0,grounded:true});}
function completeLights(m){m.start('lights');m.tick(DEMO_SECONDS);m.touchPad({x:-8.5,y:0,grounded:true});let result;for(const id of m.lights.sequence){result=m.touchPad(on(id));}return result;}
test('demo shows each shuffled pad once, ignores inputs, and hides answer afterwards',()=>{
 const l=new LightSequence(()=>0);l.start();assert.equal(new Set(l.sequence).size,3);
 assert.equal(l.litPad,null);assert.equal(l.touch(on(l.sequence[0])),null);
 l.tick(1);assert.equal(l.litPad,l.sequence[0]);l.tick(.9);assert.equal(l.litPad,null);
 l.tick(DEMO_SECONDS);assert.equal(l.stage,'input');assert.equal(l.litPad,null);
});
test('only new grounded contacts on the correct floor count, staying still is safe',()=>{
 const l=new LightSequence(()=>0);l.start();l.tick(DEMO_SECONDS);const first=on(l.sequence[0]);
 assert.equal(l.touch({...first,grounded:false}),null);assert.equal(l.touch({...first,y:4.4}),null);
 assert.equal(l.touch(first),'correct');for(let i=0;i<120;i++)assert.equal(l.touch(first),null);
 assert.equal(l.progress,1);l.touch({x:20,y:0,grounded:true});assert.equal(l.touch(first),'wrong');
});
test('either mission order works, timers and scores stay separate, completed tasks cannot restart',()=>{
 for(const order of [['props','lights'],['lights','props']]){
  const m=new Mission(()=>0);const finish={props:completeProps,lights:completeLights};
  assert.equal(finish[order[0]](m).kind,'success');const saved={...m.records[order[0]]};
  m.tick(100);assert.equal(m.start(order[0]),false);
  assert.equal(finish[order[1]](m).kind,'success');assert.deepEqual(m.records[order[0]],saved);
  assert.equal(m.lives,3);assert.ok(m.records.props.score>0&&m.records.lights.score>0);
  m.restart();assert.equal(m.records.props.score,0);assert.equal(m.records.lights.score,0);assert.equal(m.lives,3);
 }
});
test('wrong pad, timeout and reset share lives without erasing the other completed score',()=>{
 const m=new Mission(()=>0);completeProps(m);const score=m.records.props.score;
 m.start('lights');assert.equal(m.start('props'),false);m.tick(DEMO_SECONDS);m.touchPad({x:-8.5,y:0,grounded:true});
 assert.equal(m.touchPad(on(m.lights.sequence[1])).kind,'failure');assert.equal(m.lives,2);
 assert.equal(m.touchPad(on('A')),null);assert.equal(m.lives,2);assert.equal(m.activeId,null);
 m.start('lights');assert.equal(m.remaining,LIGHT_RULES.seconds);assert.equal(m.lights.progress,0);
 assert.equal(m.tick(46).kind,'failure');m.start('lights');assert.equal(m.fail('reset').kind,'gameover');
 assert.equal(m.start('lights'),false);assert.equal(m.records.props.score,score);
});
test('pad interactions are inactive during free exploration and prop tasks',()=>{
 const m=new Mission();assert.equal(m.touchPad(on('A')),null);m.start();assert.equal(m.touchPad(on('B')),null);assert.equal(m.lives,3);
});
test('all six sequences can be traversed with real movement while skipping unwanted pads',()=>{
 for(const sequence of [['A','B','C'],['A','C','B'],['B','A','C'],['B','C','A'],['C','A','B'],['C','B','A']]){
  const m=new Mission(),p={x:-8.5,y:0,vy:0,grounded:true};m.start('lights');m.lights.sequence=[...sequence];m.tick(DEMO_SECONDS);
  let outcome=null;
  function moveTo(x,jump=false){
   for(let i=0;i<600;i++){
    const dir=Math.abs(x-p.x)<.025?0:Math.sign(x-p.x);
    assert.equal(step(p,dir,jump&&i===0,1/120),false);
    assert.equal(m.tick(1/120),null);const hit=m.touchPad(p);if(hit){assert.equal(hit.kind,'success',`${sequence}: ${hit.title} at ${p.x}`);outcome=hit;}
    if(Math.abs(x-p.x)<.025&&p.grounded)return;
   }
   assert.fail(`stuck on ${sequence} at ${p.x}, ${p.y}, heading ${x}`);
  }
  for(const target of sequence){
   if(target==='A'){
    if(p.x>-3.8){moveTo(-3.2);moveTo(-5.4,true);}
    if(p.x>-7){moveTo(-5.4);moveTo(-8.2,true);}
    moveTo(-9.5);
   }else if(target==='B'){
    if(p.x<-7){moveTo(-7.05);moveTo(-6,true);}else{moveTo(-3.2);moveTo(-6,true);}
   }else{
    if(p.x<-7){moveTo(-7.05);moveTo(-4.7,true);moveTo(-2.7,true);}
    else{moveTo(-5.5);moveTo(-2.7,true);}
   }
  }
  assert.equal(outcome?.kind,'success');assert.equal(m.lives,3);assert.ok(m.records.lights.remaining>0);
 }
});

test('standing on a pad when the demo ends never auto-submits or penalizes',()=>{
 const m=new Mission(()=>0);m.start('lights');m.tick(DEMO_SECONDS);
 const wrong=on(m.lights.sequence[1]);
 for(let i=0;i<120;i++)assert.equal(m.touchPad(wrong),null);
 assert.equal(m.lives,3);assert.equal(m.lights.progress,0);
 m.touchPad({x:-8.5,y:0,grounded:true});
 assert.equal(m.touchPad(wrong).kind,'failure');assert.equal(m.lives,2);
});
