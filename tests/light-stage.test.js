import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {setupLightStage} from '../src/light-stage.js';
import {Mission} from '../src/mission.js';
import {PADS,DEMO_SECONDS,FEEDBACK_SECONDS,LIGHT_RULES,LIGHT_ROUNDS} from '../src/lights.js';

test('stage lights follow actual feet and accepted inputs without exposing the next answer',()=>{
 const element=()=>({textContent:'',hidden:false,children:[],classes:new Set(),dataset:{},
  append(child){this.children.push(child);},setAttribute(){},style:{setProperty(){}},
  get classList(){return {toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};},
  getContext(){return {fillText(){}};}
 });
 const panel=element(),hint=element(),cards=element(),rounds=element(),countdown=element(),countdownRound=element(),countdownNumber=element();panel.querySelector=()=>cards;
 const previous=globalThis.document;
 globalThis.document={querySelector:selector=>selector==='#light-panel'?panel:selector==='#light-rounds'?rounds:selector==='#light-hint'?hint:selector==='#light-countdown'?countdown:selector==='#countdown-round'?countdownRound:selector==='#countdown-number'?countdownNumber:null,createElement:element};
 const scene=new THREE.Scene();
 try{
  const update=setupLightStage(scene),m=new Mission(()=>.999);
  const [padA]=scene.children;
  const at=id=>({...PADS.find(p=>p.id===id),grounded:true});
  const away={x:-1.3,y:0,grounded:true};
  for(const task of [null,'props','audio']){
   if(task)m.start(task);
   update(m,at('A'));assert.equal(padA.children[0].material.emissiveIntensity,.04);
   assert.equal(padA.children[3].material.opacity,0);assert.equal(panel.hidden,true);
   assert.equal(padA.children[0].position.y,.035);
   assert.equal(cards.children[0].classes.has('lit'),false);
   m.restart();
  }
  update(m,{...at('A'),grounded:false});assert.equal(padA.children[3].material.opacity,0);
  m.start('lights');update(m,at('C'));assert.equal(countdown.hidden,false);assert.equal(countdownNumber.textContent,3);assert.match(countdownRound.textContent,/第 1/);
  assert.equal(cards.children.some(c=>c.classes.has('lit')),false);m.tick(LIGHT_RULES.leadIn);update(m,at('C'));assert.equal(countdown.hidden,true);
  assert.equal(cards.children[0].classes.has('lit'),true);
  assert.equal(cards.children[2].classes.has('lit'),false,'feet must not interfere with the demo');
  m.tick(DEMO_SECONDS);m.touchPad(away);m.touchPad(at('A'));update(m,away);
  assert.match(hint.textContent,/A 踩對了.*1 \/ 3/);
  assert.equal(cards.children[0].classes.has('correct'),true);
  assert.equal(padA.children[3].material.opacity,.8);
  assert.equal(cards.children[1].classes.has('lit'),false,'next answer stays hidden');
  m.tick(FEEDBACK_SECONDS+.01);update(m,away);
  assert.equal(padA.children[0].material.emissiveIntensity,.04);
  assert.equal(cards.children[0].classes.has('correct'),false);
  update(m,at('A'));assert.match(cards.children[0].textContent,/踩下/);
  assert.equal(padA.children[0].material.emissiveIntensity,2.5);
  assert.equal(padA.children[3].material.opacity,.45);
  m.touchPad(at('B'));assert.equal(m.touchPad(at('C')),null);update(m,away);
  assert.equal(panel.hidden,false);assert.match(hint.textContent,/第 1 回合通過/);
  assert.equal(rounds.children[0].dataset.state,'done');
  for(let round=1;round<LIGHT_ROUNDS.length;round++){
   m.tick(LIGHT_RULES.roundBreak);update(m,at('C'));
   assert.equal(m.lights.stage,'demo');assert.equal(m.lights.round,round);assert.equal(countdown.hidden,false);assert.equal(countdownNumber.textContent,3);assert.match(countdownRound.textContent,new RegExp('第 '+(round+1)));
   assert.equal(rounds.children[round].dataset.state,'current');
   assert.equal(padA.children[3].material.opacity,0);
   m.tick(m.lights.demoSeconds);m.touchPad(away);
   for(const id of [...m.lights.sequence]){m.touchPad(away);m.touchPad(at(id));}
   update(m,away);
  }
  assert.equal(panel.hidden,true);assert.equal(countdown.hidden,true);assert.equal(padA.children[0].material.emissiveIntensity,.7);
  for(const foot of [at('A'),at('B'),at('C')]){
   update(m,foot);
   for(let i=0;i<PADS.length;i++){
    assert.equal(scene.children[i].children[0].material.emissiveIntensity,.7);
    assert.equal(scene.children[i].children[3].material.opacity,0);
    assert.equal(cards.children[i].classes.has('lit'),false);
   }
  }
  m.restart();update(m,away);assert.equal(padA.children[0].material.emissiveIntensity,.04);
 }finally{
  globalThis.document=previous;
  scene.traverse(obj=>{obj.geometry?.dispose();obj.material?.map?.dispose();obj.material?.dispose();});
 }
});
