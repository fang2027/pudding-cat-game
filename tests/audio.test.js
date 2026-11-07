import {missionUi} from '../src/mission-ui.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AudioMission,AUDIO_RULES,SPEAKERS,REMOTE,CONSOLE,CHASE,CHASE_STAGES,LEFT_BLAST_START,audioObjective} from '../src/audio-mission.js';
import {Mission,PROPS} from '../src/mission.js';
import {completeLightTask} from './helpers/light-task.js';
import {step} from '../src/physics.js';
const consolePlayer={...CONSOLE,grounded:true};
const atTarget=a=>({...a.target,grounded:true});
function arrive(a){a.tick(a.reactionRemaining+a.routeLength/a.speed+.01);}
function activate(a){arrive(a);assert.equal(a.interact(atTarget(a)),'escaped');}
function finishChase(m){
 for(let i=0;i<3;i++){
  m.tick(m.audio.reactionRemaining+m.audio.routeLength/m.audio.speed+.01);
  assert.equal(m.interactAudio(atTarget(m.audio)),i===2?'collected':'escaped');
 }
}
const finishers={
 props:m=>{m.start('props');PROPS.forEach(p=>m.collect({x:p.x,y:p.y-.65,z:p.z}));return m.finish({x:-12,y:0,grounded:true});},
 lights:completeLightTask,
 audio:m=>{m.start('audio');finishChase(m);return m.finishAudio(consolePlayer);}
};

test('speakers stay inactive until the first catch, then jumping clears a blast',()=>{
 const a=new AudioMission(),s=SPEAKERS[0],p={x:s.x,y:0,z:s.z};
 a.tick(20);assert.equal(a.speakersActive,false);assert.equal(a.hit(p),false);
 assert.equal(a.phase(s),'safe');assert.equal(a.interact(atTarget(a)),'escaped');
 assert.equal(a.waveElapsed,0);a.tick(LEFT_BLAST_START-.01);
 assert.equal(a.phase(s),'warning');assert.equal(a.hit(p),false);
 a.tick(.02);assert.equal(a.phase(s),'blast');assert.equal(a.hit(p),true);
 assert.ok(a.frankieX>s.x+s.width/2);
 assert.equal(a.hit({...p,x:a.position.x-(a.speed-4.2)*a.legElapsed}),true,'running directly behind Frankie reaches the blast');
 assert.equal(a.hit({...p,y:.8}),false);assert.equal(a.hit({...p,z:0}),false);assert.equal(a.hit(consolePlayer),false);
 a.tick(1.2);assert.equal(a.phase(s),'safe');
});

test('three stops require separate grounded interactions before collecting the remote',()=>{
 const m=new Mission();assert.equal(m.interactAudio(consolePlayer),null);m.start('audio');
 assert.equal(m.finishAudio(consolePlayer),null);
 for(let i=0;i<3;i++){
  const a=m.audio,p=atTarget(a);
  assert.equal(a.stage,i);assert.equal(m.interactAudio(p),null,'cannot catch a moving sign');
  m.tick(a.reactionRemaining+a.routeLength/a.speed+.01);
  assert.equal(m.interactAudio({...p,grounded:false}),null);
  assert.equal(m.interactAudio({...p,y:p.y-1}),null);
  assert.equal(m.interactAudio({...p,z:0}),null);
  assert.equal(m.interactAudio({...p,x:p.x-1}),null);
  assert.equal(m.updateAudio(p),null);assert.equal(a.carrying,false,'walking nearby does not advance a stop');
  if(i<2)assert.equal(m.takeRemote(p),false,'early catches cannot award the remote');
  assert.equal(m.interactAudio(p),i===2?'collected':'escaped');
  assert.equal(m.interactAudio(p),null,'one stop cannot count twice');
  assert.equal(a.carrying,i===2);
 }
 assert.equal(m.audio.atEnd,true);assert.equal(m.audio.target.x,REMOTE.x);
 assert.ok(Math.abs(m.audio.target.y+.65-REMOTE.y)<1e-8);
 assert.equal(m.finishAudio({...consolePlayer,y:4.4}),null);
 assert.equal(m.finishAudio(consolePlayer).kind,'success');
 assert.equal(m.finishAudio(consolePlayer),null);assert.equal(m.start('audio'),false);
});

test('failure resets chase stages, speakers, feedback and remote while preserving other scores',()=>{
 const m=new Mission();finishers.props(m);const saved={...m.records.props};m.start('audio');finishChase(m);
 while(m.audio.phase(SPEAKERS[0])!=='blast')m.tick(.01);
 assert.equal(m.updateAudio(SPEAKERS[0]).kind,'failure');assert.equal(m.lives,2);
 assert.equal(m.audio.stage,0);assert.equal(m.audio.elapsed,0);assert.equal(m.audio.frankieX,CONSOLE.x);
 assert.equal(m.audio.carrying,false);assert.equal(m.audio.speakersActive,false);
 assert.equal(m.audio.feedback,'');assert.equal(m.audio.reactionRemaining,0);
 assert.equal(m.updateAudio(SPEAKERS[0]),null);assert.deepEqual(m.records.props,saved);
 m.start('audio');assert.equal(m.remaining,AUDIO_RULES.seconds);
 assert.equal(m.tick(AUDIO_RULES.seconds+1).kind,'failure');m.start('audio');m.fail('reset');assert.equal(m.phase,'gameover');
 m.restart();assert.equal(m.lives,3);assert.equal(m.records.audio.score,0);
});

test('all six task orders preserve scores while exploring until the player confirms the show',()=>{
 for(const order of [['props','lights','audio'],['props','audio','lights'],['lights','props','audio'],['lights','audio','props'],['audio','props','lights'],['audio','lights','props']]){
  const m=new Mission();const saved={};
  order.forEach((id,index)=>{
   const outcome=finishers[id](m);assert.equal(outcome.kind,'success');
   saved[id]={...m.records[id]};Object.keys(saved).forEach(key=>assert.deepEqual(m.records[key],saved[key]));
   assert.equal(m.allComplete,index===2);
  });
  assert.equal(m.score,Object.values(saved).reduce((sum,r)=>sum+r.score,0));assert.equal(m.phase,'ready-to-open');
  assert.equal(m.fail('fall'),null);assert.equal(m.save('again'),null);assert.equal(m.start('props'),false);
  const score=m.score,lives=m.lives;m.tick(100);assert.equal(m.score,score);assert.equal(m.lives,lives);
  let result;const ui=missionUi(m,()=>({}),value=>{result=value;},()=>{});
  assert.equal(ui.dialog({name:'佳音女寶寶'}).action,undefined);
  const opening=ui.dialog({name:'佳音寶寶'});assert.equal(m.phase,'ready-to-open');
  opening.action();assert.equal(result.kind,'victory');assert.ok(result.text.includes(String(score)));
  assert.equal(m.phase,'won');assert.equal(m.openShow(),null);
  m.restart();assert.equal(m.phase,'idle');assert.equal(m.openShow(),null);assert.equal(m.score,0);assert.equal(m.audio.stage,0);
 }
});

test('real movement completes three catches on both floors and returns within the time limit',()=>{
 const m=new Mission(),p={...consolePlayer,vy:0};m.start('audio');
 function advance(dir,jump,depth=0){
  assert.equal(m.tick(1/120),null,'time ran out');assert.equal(step(p,dir,jump,1/120,depth),false);
  assert.equal(m.updateAudio(p),null,`hit at ${p.x}, ${p.y}, ${p.z}`);
 }
 function move(axis,target,jump=false,height){
  for(let i=0;i<600;i++){
   const input=Math.abs(p[axis]-target)<.025?0:Math.sign(target-p[axis]);
   advance(axis==='x'?input:0,jump&&i===0,axis==='z'?input:0);
   if(Math.abs(p[axis]-target)<.025&&p.grounded){
    if(height!==undefined)assert.ok(Math.abs(p.y-height)<.01,`expected ${height}, got ${p.y}`);
    return;
   }
  }
  assert.fail(`stuck at ${p.x}, ${p.y}, ${p.z} heading toward ${axis}=${target}`);
 }
 const x=(target,jump,height)=>move('x',target,jump,height);
 const z=(target,jump,height)=>move('z',target,jump,height);
 function catchFrankie(expected){
  for(let i=0;i<1800&&!m.audio.waiting;i++)advance(0,false);
  assert.equal(m.interactAudio(p),expected);
 }
 x(12.5);z(-8);x(-3.5);z(-6);catchFrankie('escaped');
 z(-8);
 while(m.audio.phase(SPEAKERS[0])!=='safe'||m.audio.remaining(SPEAKERS[0])<.65)advance(0,false);
 x(14.5);z(-6);catchFrankie('escaped');
 z(-8);x(7.05);z(-6,true,.9);x(6.55);x(4.1,true,2);
 x(4.75);x(7.05,true,3.2);x(7.85);x(10,true,4.4);x(11.55);catchFrankie('collected');
 z(-8);x(14);z(0);x(10.5);
 assert.equal(m.finishAudio(p).kind,'success');assert.equal(m.lives,3);
 assert.ok(m.records.audio.remaining>10,`only ${m.records.audio.remaining} seconds left`);
});

test('Frankie waits at each stop and reacts before escaping along the upper route',()=>{
 const a=new AudioMission();a.tick(.5);assert.ok(a.frankieX>CONSOLE.x);assert.equal(a.waiting,false);
 a.tick(100);assert.equal(a.stage,0);assert.equal(a.waiting,true);assert.deepEqual(a.position,a.target);
 const first={...a.position};assert.equal(a.interact(atTarget(a)),'escaped');
 assert.deepEqual(a.position,first);a.tick(.1);assert.ok(a.frankieX>first.x);
 arrive(a);assert.equal(a.interact(atTarget(a)),'escaped');
 a.tick(CHASE.reaction+2);assert.ok(a.frankieX<14.5);assert.ok(a.frankieY>0);
 arrive(a);assert.equal(a.atEnd,true);assert.equal(a.frankieY,4.4);assert.equal(a.stage,2);
 assert.equal(a.collect(atTarget(a)),true);assert.equal(a.collect(atTarget(a)),false);
 a.reset();assert.equal(a.frankieY,0);assert.equal(a.stage,0);assert.equal(a.carrying,false);
});

test('both speakers give full warnings after activation and do not restart on the second catch',()=>{
 for(const speaker of SPEAKERS){
  const a=new AudioMission(),p={x:speaker.x,y:0,z:speaker.z};activate(a);
  if(speaker!==SPEAKERS[0])a.tick(AUDIO_RULES.safe-speaker.offset);assert.equal(a.phase(speaker),'warning');
  assert.equal(a.hit(p),false);assert.ok(Math.abs(a.remaining(speaker)-(speaker===SPEAKERS[0]?LEFT_BLAST_START:AUDIO_RULES.warning))<1e-8);
  a.tick(a.remaining(speaker)-.001);assert.equal(a.hit(p),false);
  a.tick(.002);assert.equal(a.phase(speaker),'blast');assert.equal(a.hit(p),true);
  arrive(a);const clock=a.waveElapsed;
  assert.equal(a.interact(atTarget(a)),'escaped');assert.equal(a.waveElapsed,clock);
 }
});

test('objectives explain each new target and intermediate catches award no score',()=>{
 const m=new Mission();m.start('audio');
 for(let i=0;i<3;i++){
  assert.ok(audioObjective(m.audio).includes(`追逐 ${i+1} / 3`));
  assert.ok(audioObjective(m.audio).includes(CHASE_STAGES[i].place));
  m.tick(m.audio.reactionRemaining+m.audio.routeLength/m.audio.speed+.01);
  m.interactAudio(atTarget(m.audio));assert.notEqual(m.audio.feedback,'');assert.equal(m.score,0);
 }
 assert.match(audioObjective(m.audio),/回音控台/);
 m.tick(CHASE.feedback+.01);assert.equal(m.audio.feedback,'');
 assert.equal(m.finishAudio(consolePlayer).kind,'success');assert.ok(m.score>0);
});

test('retry from any chase stage begins at the first stop with fresh warnings',()=>{
 for(let completed=0;completed<3;completed++){
  const m=new Mission();m.start('audio');
  for(let i=0;i<completed;i++){
   m.tick(m.audio.reactionRemaining+m.audio.routeLength/m.audio.speed+.01);
   m.interactAudio(atTarget(m.audio));
  }
  assert.equal(m.audio.stage,completed);assert.equal(m.fail('返回起點').kind,'failure');
  assert.equal(m.lives,2);assert.equal(m.start('audio'),true);
  assert.equal(m.audio.stage,0);assert.equal(m.audio.waiting,false);
  assert.equal(m.audio.speakersActive,false);assert.equal(m.audio.feedback,'');
  assert.equal(m.audio.frankieX,CONSOLE.x);assert.equal(m.remaining,AUDIO_RULES.seconds);
 }
});
