import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mission,PROPS} from '../src/mission.js';
import {PADS,LightSequence,DEMO_SECONDS,LIGHT_RULES,LIGHT_ROUNDS,FEEDBACK_SECONDS,padUnderfoot,createLightRoundReset,LIGHT_READY_POSITION} from '../src/lights.js';
import {completeLightTask as completeLights} from './helpers/light-task.js';
import {step} from '../src/physics.js';
const on=id=>({...PADS.find(p=>p.id===id),grounded:true});
const away={x:20,y:0,grounded:true};
function passRound(m){
 m.tick(m.lights.demoSeconds);m.touchPad(away);let result;
 for(const id of [...m.lights.sequence]){m.touchPad(away);result=m.touchPad(on(id));}
 return result;
}
function completeProps(m){m.start('props');PROPS.forEach(p=>m.collect({x:p.x,y:p.y-.65,z:p.z}));return m.finish({x:-12,y:0,grounded:true});}
test('demo shows each shuffled pad once, ignores inputs, and hides answer afterwards',()=>{
 const l=new LightSequence(()=>0);l.start();assert.equal(new Set(l.sequence).size,3);
 assert.equal(l.litPad,null);assert.equal(l.touch(on(l.sequence[0])),null);
 l.tick(LIGHT_RULES.leadIn);assert.equal(l.litPad,l.sequence[0]);l.tick(.9);assert.equal(l.litPad,null);
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
 m.start('lights');assert.equal(m.start('props'),false);m.tick(DEMO_SECONDS);m.touchPad({x:-1.3,y:0,grounded:true});
 assert.equal(m.touchPad(on(m.lights.sequence[1])).kind,'failure');assert.equal(m.lives,2);
 assert.equal(m.touchPad(on('A')),null);assert.equal(m.lives,2);assert.equal(m.activeId,null);
 m.start('lights');assert.equal(m.remaining,LIGHT_RULES.seconds);assert.equal(m.lights.progress,0);
 assert.equal(m.tick(LIGHT_RULES.seconds+1).kind,'failure');m.start('lights');assert.equal(m.fail('reset').kind,'gameover');
 assert.equal(m.start('lights'),false);assert.equal(m.records.props.score,score);
});
test('pad interactions are inactive during free exploration and prop tasks',()=>{
 const m=new Mission();assert.equal(m.touchPad(on('A')),null);m.start();assert.equal(m.touchPad(on('B')),null);assert.equal(m.lives,3);
});
test('all six starting orders support three harder rounds with real jumps and repeated pads',()=>{
 for(const sequence of [['A','B','C'],['A','C','B'],['B','A','C'],['B','C','A'],['C','A','B'],['C','B','A']]){
  const m=new Mission(),p={x:-1.3,y:0,vy:0,grounded:true},resetRound=createLightRoundReset();m.start('lights');
  let outcome=null;
  function moveTo(x,jump=false){
   for(let i=0;i<600;i++){
    const dir=Math.abs(x-p.x)<.025?0:Math.sign(x-p.x);
    assert.equal(step(p,dir,jump&&i===0,1/120),false);
    assert.equal(m.tick(1/120),null);const hit=m.touchPad(p);if(hit){assert.equal(hit.kind,'success',`${sequence}: ${hit.title} at ${p.x}`);outcome=hit;}
    if(m.lights.stage==='round-clear'||m.activeId!=='lights')return;
    if(Math.abs(x-p.x)<.025&&p.grounded)return;
   }
   assert.fail(`stuck on ${sequence} at ${p.x}, ${p.y}, heading ${x}`);
  }
  for(let round=0;round<LIGHT_ROUNDS.length;round++){
   m.lights.sequence=[...sequence,...(round>0?[sequence[2]]:[]),...(round>1?[sequence[0]]:[])];
   assert.equal(resetRound(m,p),true);assert.deepEqual({x:p.x,y:p.y,z:p.z,vy:p.vy,grounded:p.grounded},LIGHT_READY_POSITION);assert.equal(padUnderfoot(p),null);
   m.tick(m.lights.demoSeconds);m.touchPad(p);
   for(const target of [...m.lights.sequence]){
    if(padUnderfoot(p)?.id===target){moveTo(p.x,true);continue;}
    if(target==='A'){
    if(p.x>3.4){moveTo(4);moveTo(1.8,true);}
    if(p.x>0.2){moveTo(1.8);moveTo(-1,true);}
    moveTo(-2.3);
   }else if(target==='B'){
    if(p.x<0.2){moveTo(0.15);moveTo(1.2,true);}else{moveTo(4);moveTo(1.2,true);}
   }else{
    if(p.x<0.2){moveTo(0.15);moveTo(2.5,true);moveTo(4.5,true);}
    else{moveTo(1.7);moveTo(4.5,true);}
    }
   }
   if(round<LIGHT_ROUNDS.length-1){assert.equal(m.score,0);assert.equal(m.lights.stage,'round-clear');m.tick(LIGHT_RULES.roundBreak);}
  }
  assert.equal(outcome?.kind,'success');assert.equal(m.lives,3);assert.ok(m.records.lights.remaining>0);
 }
});

test('standing on a pad when the demo ends never auto-submits or penalizes',()=>{
 const m=new Mission(()=>0);m.start('lights');m.tick(DEMO_SECONDS);
 const wrong=on(m.lights.sequence[1]);
 for(let i=0;i<120;i++)assert.equal(m.touchPad(wrong),null);
 assert.equal(m.lives,3);assert.equal(m.lights.progress,0);
 m.touchPad({x:-1.3,y:0,grounded:true});
 assert.equal(m.touchPad(wrong).kind,'failure');assert.equal(m.lives,2);
});

test('correct steps keep brief feedback after leaving without repeating the input',()=>{
 const l=new LightSequence(()=>0);l.start();l.tick(DEMO_SECONDS);
 l.touch({x:-1.3,y:0,grounded:true});const first=on(l.sequence[0]);
 assert.equal(l.touch(first),'correct');
 assert.deepEqual(l.feedback,{padId:first.id,result:'correct'});
 for(let i=0;i<120;i++)l.touch(first);
 assert.equal(l.progress,1);assert.equal(l.feedbackRemaining,FEEDBACK_SECONDS);
 l.touch({x:-1.3,y:0,grounded:true});l.tick(FEEDBACK_SECONDS/2);
 assert.equal(l.feedback.padId,first.id);
 l.tick(FEEDBACK_SECONDS/2+.001);assert.equal(l.feedback,null);
 assert.equal(l.progress,1);l.reset();assert.equal(l.feedbackRemaining,0);
});

test('feedback uses grounded contact and never reveals an unplayed answer',()=>{
 const l=new LightSequence(()=>0);l.start();
 assert.equal(l.feedback,null);l.tick(DEMO_SECONDS);
 const wrong=on(l.sequence[1]);l.touch(wrong);
 assert.equal(l.feedback,null);assert.equal(l.progress,0);
 assert.equal(padUnderfoot({...wrong,grounded:false}),null);
 assert.equal(padUnderfoot({...wrong,y:wrong.y+1}),null);
 assert.equal(padUnderfoot(wrong).id,wrong.id);
 l.touch({x:20,y:0,grounded:true});
 assert.equal(l.touch(wrong),'wrong');
 assert.deepEqual(l.feedback,{padId:wrong.id,result:'wrong'});
 l.start();assert.equal(l.feedback,null);
});

test('rounds use 3, 4 and 5 flashes, include repeats and speed up with visible dark gaps',()=>{
 for(const random of [()=>0,()=>.4,()=>.999]){
  const l=new LightSequence(random);l.start();let previousBeat=Infinity;
  for(let round=0;round<LIGHT_ROUNDS.length;round++){
   assert.equal(l.round,round);assert.equal(l.sequence.length,round+3);
   assert.equal(new Set(l.sequence).size,3);assert.ok(l.rules.beat<previousBeat);previousBeat=l.rules.beat;
   assert.equal(l.locked,true);assert.equal(l.litPad,null);
   for(let i=0;i<l.sequence.length;i++){
    l.tick(LIGHT_RULES.leadIn+i*l.rules.beat+.05-l.elapsed);
    assert.equal(l.litPad,l.sequence[i]);assert.equal(l.touch(on(l.sequence[i])),null);
    l.tick(l.rules.lit-.05+.02);assert.equal(l.litPad,null,'even identical flashes need a dark gap');
   }
   l.tick(l.demoSeconds-l.elapsed);assert.equal(l.stage,'input');assert.equal(l.locked,false);
   l.touch(away);
   for(const id of [...l.sequence]){l.touch(away);l.touch(on(id));}
   if(round<2){assert.equal(l.stage,'round-clear');assert.equal(l.locked,true);l.tick(LIGHT_RULES.roundBreak);}
   else assert.equal(l.stage,'complete');
  }
 }
});

test('intermission blocks inputs, keeps a single timer and carries elapsed time into the next demo',()=>{
 const m=new Mission(()=>.999);m.start('lights');assert.equal(passRound(m),null);
 assert.equal(m.records.lights.state,'active');assert.equal(m.score,0);
 const remaining=m.remaining,sequence=[...m.lights.sequence];
 assert.equal(m.touchPad(on('A')),null);assert.deepEqual(m.lights.sequence,sequence);
 m.tick(0);assert.equal(m.remaining,remaining);assert.equal(m.lights.stage,'round-clear');
 m.tick(LIGHT_RULES.roundBreak+.4);
 assert.equal(m.lights.round,1);assert.equal(m.lights.stage,'demo');assert.ok(Math.abs(m.lights.elapsed-.4)<1e-8);
 assert.ok(Math.abs(m.remaining-(remaining-LIGHT_RULES.roundBreak-.4))<1e-8);
 assert.equal(m.lights.progress,0);assert.equal(m.lights.feedback,null);
 assert.equal(m.lights.contact,null);assert.equal(m.lights.inputSampled,false);
});

test('each new round ignores the pad already underfoot and repeated inputs need a fresh contact',()=>{
 const m=new Mission(()=>.999);m.start('lights');passRound(m);m.tick(LIGHT_RULES.roundBreak);
 m.tick(m.lights.demoSeconds);const wrong=on(m.lights.sequence[1]);
 for(let i=0;i<120;i++)assert.equal(m.touchPad(wrong),null);
 assert.equal(m.lights.progress,0);assert.equal(m.lives,3);
 m.touchPad(away);
 for(const id of [...m.lights.sequence].slice(0,3)){m.touchPad(away);assert.equal(m.touchPad(on(id)),null);}
 const repeated=on(m.lights.sequence[3]);assert.equal(repeated.id,m.lights.sequence[2]);
 for(let i=0;i<120;i++)m.touchPad(repeated);
 assert.equal(m.lights.progress,3);
 m.touchPad({...repeated,grounded:false});m.touchPad(repeated);
 assert.equal(m.lights.stage,'round-clear');assert.equal(m.lives,3);assert.equal(m.score,0);
});

test('failure in any round resets all rounds and preserves another completed task score',()=>{
 for(let round=0;round<LIGHT_ROUNDS.length;round++){
  const m=new Mission(()=>0);completeProps(m);const saved={...m.records.props};m.start('lights');
  for(let i=0;i<round;i++){passRound(m);m.tick(LIGHT_RULES.roundBreak);}
  m.tick(m.lights.demoSeconds);m.touchPad(away);
  const wrong=m.touchPad(on(m.lights.sequence[1]));assert.equal(wrong.kind,'failure');
  assert.ok(wrong.title.includes(`第 ${round+1} 回合`));assert.equal(m.lives,2);
  assert.deepEqual(m.records.props,saved);assert.equal(m.records.lights.score,0);
  assert.equal(m.lights.round,0);assert.equal(m.lights.stage,'idle');assert.equal(m.lights.feedback,null);
  assert.equal(m.start('lights'),true);assert.equal(m.remaining,LIGHT_RULES.seconds);
  assert.equal(m.lights.round,0);assert.equal(m.lights.sequence.length,3);
 }
});

test('three rounds award one final score and timeout during a later demo cannot advance rounds',()=>{
 const m=new Mission(()=>.999);m.start('lights');passRound(m);
 assert.equal(m.score,0);m.tick(LIGHT_RULES.roundBreak);passRound(m);
 assert.equal(m.score,0);m.tick(LIGHT_RULES.roundBreak);
 assert.equal(m.tick(m.remaining).kind,'failure');assert.equal(m.lives,2);assert.equal(m.lights.stage,'idle');
 const outcome=completeLights(m);assert.equal(outcome.kind,'success');
 assert.equal(m.lights.stage,'complete');assert.equal(m.lights.round,2);
 assert.equal(m.score,500+Math.floor(m.records.lights.remaining)*10);
 const saved=m.score;assert.equal(m.touchPad(on('A')),null);m.tick(10);assert.equal(m.score,saved);
});

test('each round and retry returns from any pad or mid-jump to the girl, only once per round',()=>{
 const m=new Mission(()=>0),sync=createLightRoundReset(),p={...on('C'),vy:8};
 assert.equal(sync(m,p),false);m.start('lights');
 for(let round=0;round<3;round++){
  Object.assign(p,on('C'),{vy:8,grounded:false});
  assert.equal(sync(m,p),true);assert.deepEqual({x:p.x,y:p.y,z:p.z,vy:p.vy,grounded:p.grounded},LIGHT_READY_POSITION);assert.equal(padUnderfoot(p),null);
  assert.equal(m.lights.countdown,3);assert.equal(m.lights.locked,true);
  Object.assign(p,on('A'));assert.equal(sync(m,p),false);assert.equal(p.x,PADS[0].x);
  passRound(m);if(round<2)m.tick(LIGHT_RULES.roundBreak);
 }
 m.restart();m.start('lights');assert.equal(sync(m,p),true);m.fail('retry');sync(m,p);
 m.start('lights');assert.equal(sync(m,p),true);assert.equal(m.lights.countdown,3);assert.equal(m.lives,2);
});

test('3-2-1 countdown keeps pads dark and input locked until the demonstration begins',()=>{
 const l=new LightSequence(()=>0);l.start();
 for(const expected of [3,2,1]){
  assert.equal(l.countdown,expected);assert.equal(l.litPad,null);assert.equal(l.locked,true);
  assert.equal(l.touch(on('A')),null);const elapsed=l.elapsed;
  l.tick(0);assert.equal(l.elapsed,elapsed);assert.equal(l.countdown,expected);l.tick(1);
 }
 assert.equal(l.countdown,0);assert.equal(l.litPad,l.sequence[0]);assert.equal(l.progress,0);
 l.tick(l.demoSeconds-l.elapsed);assert.equal(l.locked,false);assert.equal(l.stage,'input');
});
