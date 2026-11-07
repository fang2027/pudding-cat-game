import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {setupAudioStage} from '../src/audio-stage.js';
import {Mission} from '../src/mission.js';
import {CONSOLE,CHASE,CHASE_STAGES} from '../src/audio-mission.js';

test('chase display follows every stop, reaction, upper-floor pickup, return and reset',()=>{
 const drawn=[];
 const element=()=>({textContent:'',hidden:false,children:[],dataset:{},
  append(child){this.children.push(child);},
  getContext(){return {fillRect(){},fillText(text){drawn.push(text);}};}
 });
 const selectors=Object.fromEntries(['audio-panel','speaker-states','chase-progress','chase-feedback','audio-objective'].map(id=>['#'+id,element()]));
 const previous=globalThis.document;
 globalThis.document={querySelector:selector=>selectors[selector],createElement:element};
 const scene=new THREE.Scene();
 try{
  const update=setupAudioStage(scene,{loadFrankie:null}),m=new Mission(),p={...CONSOLE,grounded:true};
  const sign=scene.children.find(obj=>obj.children.some(child=>child.isSprite));
  const remote=scene.children.find(obj=>obj.isGroup&&obj.children.length===4);
  const targetRing=scene.children.find(obj=>obj.geometry?.type==='RingGeometry');
  update(m,p);assert.equal(selectors['#audio-panel'].hidden,true);assert.equal(sign.visible,true);assert.equal(sign.position.x,CONSOLE.x);assert.equal(remote.visible,true);
  m.start('audio');update(m,p);
  assert.equal(sign.visible,true);assert.equal(selectors['#chase-progress'].children[0].dataset.state,'current');
  assert.match(selectors['#speaker-states'].children[0].textContent,/尚未啟動/);
  for(let i=0;i<3;i++){
   const a=m.audio;m.tick(a.reactionRemaining+a.routeLength/a.speed+.01);update(m,p);
   assert.equal(sign.position.x,a.target.x);assert.equal(sign.position.y,a.target.y);
   assert.equal(targetRing.position.y,a.target.y+.08);
   assert.match(selectors['#audio-objective'].textContent,new RegExp(`追逐 ${i+1} / 3`));
   const target={...a.target,grounded:true};m.interactAudio(target);update(m,target);
   assert.equal(selectors['#chase-progress'].children[i].dataset.state,'done');
   assert.equal(selectors['#chase-feedback'].hidden,false);
   if(i<2){assert.equal(a.carrying,false);assert.equal(sign.position.x,target.x);assert.equal(targetRing.position.x,CHASE_STAGES[i+1].path.at(-1).x);}
  }
  assert.equal(sign.visible,false);assert.equal(targetRing.visible,false);assert.equal(remote.visible,true);
  assert.match(selectors['#audio-objective'].textContent,/回音控台/);
  m.finishAudio(p);update(m,p);assert.equal(selectors['#audio-panel'].hidden,true);
  assert.equal(remote.position.x,CONSOLE.x);
  m.restart();update(m,p);assert.equal(remote.visible,true);assert.equal(sign.visible,true);assert.equal(targetRing.visible,false);
  assert.equal(selectors['#chase-feedback'].hidden,true);
  assert.ok(drawn.some(text=>text.includes('喇叭開起來')));
  assert.ok(drawn.some(text=>text.includes('二樓見')));
 }finally{
  globalThis.document=previous;
  scene.traverse(obj=>{obj.geometry?.dispose();obj.material?.map?.dispose();obj.material?.dispose();});
 }
});
