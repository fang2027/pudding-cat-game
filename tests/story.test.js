import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupOpening} from '../src/story.js';
import {missionUi} from '../src/mission-ui.js';
import {Mission,TASKS} from '../src/mission.js';

test('opening can advance, explain controls on Escape, skip and replay without starting a task',()=>{
 const previous=globalThis.document;
 const nodes=Object.fromEntries(['opening','opening-menu','opening-story','game-start','story-next','story-skip','story-title','story-text','story-cue','story-step'].map(id=>['#'+id,{textContent:'',open:false,listeners:{},addEventListener(k,f){this.listeners[k]=f;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},focus(){},setAttribute(){},querySelector(){return this;}}]));
 globalThis.document={querySelector:id=>nodes[id]};let cleared=0;
 try{
  const story=setupOpening(()=>cleared++);story.show();assert.equal(story.open,true);
  const pressE=(repeat=false)=>nodes['#opening'].listeners.keydown({code:'KeyE',repeat,preventDefault(){this.defaultPrevented=true;}});
  assert.equal(nodes['#opening-story'].hidden,true);
  pressE();assert.equal(nodes['#opening-story'].hidden,false);
  pressE();pressE(true);assert.match(nodes['#story-step'].textContent,/2 \/ 3/);
  let prevented=false;nodes['#opening'].listeners.cancel({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(story.open,true);assert.match(nodes['#story-cue'].textContent,/不計時/);
  pressE();assert.equal(story.open,false);
  story.show();assert.equal(nodes['#opening-menu'].hidden,false);nodes['#game-start'].onclick();assert.match(nodes['#story-step'].textContent,/1 \/ 3/);nodes['#story-skip'].onclick();assert.equal(story.open,false);assert.ok(cleared>=4);
 }finally{globalThis.document=previous;}
});

test('hearing each request leaves exploration untimed and only accepting starts its full timer',()=>{
 for(const [name,id] of [['佳音寶寶','props'],['佳音女寶寶','lights'],['法蘭奇','audio']]){
  const m=new Mission();let starts=0;const ui=missionUi(m,()=>({}),()=>{},()=>starts++);
  const info=ui.dialog({name});assert.equal(m.activeId,null);m.tick(100);
  assert.equal(m.records[id].remaining,TASKS[id].seconds);assert.match(info.label,/我來/);
  info.action();assert.equal(m.activeId,id);assert.equal(starts,1);assert.equal(m.remaining,TASKS[id].seconds);
 }
});
