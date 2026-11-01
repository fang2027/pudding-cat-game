import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioMission,AUDIO_RULES,SPEAKERS,REMOTE} from '../src/audio-mission.js';
import {Mission,PROPS} from '../src/mission.js';
import {PADS,DEMO_SECONDS} from '../src/lights.js';
import {step} from '../src/physics.js';
const frankie={x:-.8,y:0,grounded:true};
const remote={x:REMOTE.x,y:0,grounded:true};
const finishers={
 props:m=>{m.start('props');PROPS.forEach(p=>m.collect({x:p.x,y:p.y-.65}));return m.finish({x:-12,y:0,grounded:true});},
 lights:m=>{m.start('lights');m.tick(DEMO_SECONDS);m.touchPad({x:-8.5,y:0,grounded:true});let result;for(const id of m.lights.sequence)result=m.touchPad({...PADS.find(p=>p.id===id),grounded:true});return result;},
 audio:m=>{m.start('audio');m.updateAudio(remote);return m.finishAudio(frankie);}
};
test('sound has safe, warning and blast windows, and jumping clears a blast',()=>{
 const a=new AudioMission(),s=SPEAKERS[0],p={x:s.x,y:0};
 assert.equal(a.phase(s),'safe');assert.equal(a.hit(p),false);
 a.tick(AUDIO_RULES.safe+.01);assert.equal(a.phase(s),'warning');assert.equal(a.hit(p),false);
 a.tick(AUDIO_RULES.warning);assert.equal(a.phase(s),'blast');assert.equal(a.hit(p),true);
 assert.equal(a.hit({...p,y:.8}),false);assert.equal(a.hit({x:-.8,y:0}),false);
 a.tick(1.2);assert.equal(a.phase(s),'safe');
});
test('remote requires pickup and return on the correct floor',()=>{
 const m=new Mission();assert.equal(m.updateAudio(remote),null);assert.equal(m.audio.carrying,false);
 m.start('audio');assert.equal(m.finishAudio(frankie),null);m.updateAudio({...remote,y:4.4});assert.equal(m.audio.carrying,false);
 m.updateAudio(remote);assert.equal(m.audio.carrying,true);assert.equal(m.finishAudio(remote),null);
 assert.equal(m.finishAudio({...frankie,y:4.4}),null);assert.equal(m.finishAudio(frankie).kind,'success');
 assert.equal(m.finishAudio(frankie),null);assert.equal(m.start('audio'),false);
});
test('audio failure resets remote and cycle, deducts once, preserves other scores',()=>{
 const m=new Mission();finishers.props(m);const saved={...m.records.props};m.start('audio');m.updateAudio(remote);m.tick(3.7);
 assert.equal(m.updateAudio({x:3.1,y:0}).kind,'failure');assert.equal(m.lives,2);assert.equal(m.audio.carrying,false);
 assert.equal(m.audio.elapsed,0);assert.equal(m.updateAudio({x:3.1,y:0}),null);assert.equal(m.lives,2);
 assert.deepEqual(m.records.props,saved);m.start('audio');assert.equal(m.remaining,50);
 assert.equal(m.tick(51).kind,'failure');m.start('audio');m.fail('reset');assert.equal(m.phase,'gameover');
 m.restart();assert.equal(m.lives,3);assert.equal(m.records.audio.score,0);assert.equal(m.audio.carrying,false);
});
test('all six task orders end with one complete three-score summary',()=>{
 for(const order of [['props','lights','audio'],['props','audio','lights'],['lights','props','audio'],['lights','audio','props'],['audio','props','lights'],['audio','lights','props']]){
  const m=new Mission();const saved={};
  order.forEach((id,index)=>{
   const outcome=finishers[id](m);assert.equal(outcome.kind,index===2?'victory':'success');
   saved[id]={...m.records[id]};Object.keys(saved).forEach(key=>assert.deepEqual(m.records[key],saved[key]));
   assert.equal(m.allComplete,index===2);
  });
  const sum=Object.values(saved).reduce((total,r)=>total+r.score,0);assert.equal(m.score,sum);assert.equal(m.phase,'won');
  assert.equal(m.fail('fall'),null);assert.equal(m.save('again'),null);assert.equal(m.start('props'),false);
  m.tick(100);assert.equal(m.score,sum);m.restart();assert.equal(m.allComplete,false);assert.equal(m.score,0);
 }
});
test('physical route waits for safe windows, retrieves remote, and returns in time',()=>{
 const m=new Mission(),p={...frankie,vy:0};m.start('audio');
 function advance(dir,jump){
  assert.equal(m.tick(1/120),null);assert.equal(step(p,dir,jump,1/120),false);
  assert.equal(m.updateAudio(p),null,`hit at x=${p.x}, y=${p.y}, t=${m.audio.elapsed}`);
 }
 function moveTo(x,jump=false){
  for(let i=0;i<600;i++){
   advance(Math.abs(p.x-x)<.025?0:Math.sign(x-p.x),jump&&i===0);
   if(Math.abs(p.x-x)<.025&&p.grounded)return;
  }
  assert.fail(`stuck at ${p.x},${p.y} heading ${x}`);
 }
 function safe(speaker){for(let i=0;i<650;i++){if(m.audio.phase(speaker)==='safe'&&m.audio.remaining(speaker)>1)return;advance(0,false);}assert.fail('no safe window');}
 moveTo(-.1);moveTo(2.9,true);moveTo(3.85);moveTo(5.6,true);moveTo(8,true);moveTo(11.6);
 safe(SPEAKERS[1]);moveTo(14.5);assert.equal(m.audio.carrying,true);
 safe(SPEAKERS[1]);moveTo(13.5);moveTo(10.8,true);moveTo(10.3);moveTo(8,true);moveTo(5.5);
 // Stay on the box outside the left hazard, then cross during a full safe window.
 safe(SPEAKERS[0]);moveTo(2.1);moveTo(-.8,true);
 assert.equal(m.finishAudio(p).kind,'success');assert.equal(m.lives,3);assert.ok(m.records.audio.remaining>0);
});
