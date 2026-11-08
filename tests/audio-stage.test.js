import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {setupAudioStage} from '../src/audio-stage.js';
import {Mission} from '../src/mission.js';
import {CONSOLE,CHASE,CHASE_STAGES,LEFT_BLAST_START} from '../src/audio-mission.js';

test('chase display follows every stop, reaction, upper-floor pickup, return and reset',()=>{
 const drawn=[];
 const element=()=>({textContent:'',hidden:false,children:[],dataset:{},
  append(child){this.children.push(child);}, setAttribute(){},
  getContext(){return {fillRect(){},fillText(text){drawn.push(text);}};}
 });
 const selectors=Object.fromEntries(['audio-panel','speaker-states','chase-progress','chase-feedback','audio-objective','audio-countdown','audio-countdown-number'].map(id=>['#'+id,element()]));
 const previous=globalThis.document;
 globalThis.document={querySelector:selector=>selectors[selector],createElement:element};
 const scene=new THREE.Scene();
 try{
  const update=setupAudioStage(scene,{loadFrankie:null}),m=new Mission(),p={...CONSOLE,grounded:true};
  const sign=scene.children.find(obj=>obj.children.some(child=>child.isSprite));
  const remote=scene.children.find(obj=>obj.isGroup&&obj.children.length===4);
  const targetRing=scene.children.find(obj=>obj.geometry?.type==='RingGeometry');
  const speakers=scene.children.filter(obj=>obj.children.some(child=>child.material?.color?.getHex()===0x494358));
  assert.equal(speakers.length,2);
  const checkSpeakers=(showField)=>{
   const fields=speakers.map(group=>group.getObjectByName('SoundFieldFill'));
   assert.deepEqual(fields[0].scale.toArray(),fields[1].scale.toArray());
   for(const group of speakers){
    assert.equal(group.visible,true);
    assert.equal(group.children[0].visible,true);
    assert.equal(group.children[1].visible,true);
    assert.equal(group.children.some(child=>child.material?.isLineDashedMaterial),false);
    assert.equal(group.getObjectByName('SoundFieldFill').visible,showField);
    if(!showField)assert(group.children.filter(child=>child.name==='SoundFieldWave').every(wave=>!wave.visible));
   }
  };
  checkSpeakers(false);
  update(m,p);assert.equal(selectors['#audio-panel'].hidden,true);assert.equal(sign.visible,true);assert.equal(sign.position.x,CONSOLE.x);assert.equal(remote.visible,true);
  checkSpeakers(false);
  m.start('audio');update(m,p);
  checkSpeakers(true);
  assert.equal(sign.visible,true);assert.equal(selectors['#chase-progress'].children[0].dataset.state,'current');
  assert.equal(selectors['#speaker-states'].children[0].dataset.phase,'idle');
  for(let i=0;i<3;i++){
   const a=m.audio;m.tick(a.readyRemaining+a.reactionRemaining+a.routeLength/a.speed+.01);update(m,p);
   assert.equal(sign.position.x,a.target.x);assert.equal(sign.position.y,a.target.y);
   assert.equal(targetRing.position.y,a.target.y+.08);
   assert.match(selectors['#audio-objective'].textContent,new RegExp(`追逐 ${i+1} / 3`));
   const target={...a.target,grounded:true};m.interactAudio(target);update(m,target);
   assert.equal(selectors['#chase-progress'].children[i].dataset.state,'done');
   assert.equal(selectors['#chase-feedback'].hidden,i===0);
   if(i<2){assert.equal(a.carrying,false);assert.equal(sign.position.x,target.x);assert.equal(targetRing.position.x,CHASE_STAGES[i+1].path.at(-1).x);}
   if(i===0){
    const overlay=selectors['#audio-countdown'],number=selectors['#audio-countdown-number'];
    const before=m.remaining;
    assert.equal(overlay.hidden,false);assert.equal(number.hidden,true);
    for(const expected of ['3','2','1']){
     m.tick(expected==='3'?3:1);update(m,target);
     assert.equal(number.textContent,expected);
     assert.equal(m.remaining,before);
     assert.equal(a.speakersActive,false);assert.equal(a.waveElapsed,0);
     assert.equal(sign.position.x,target.x);
    }
    m.tick(1);update(m,target);
    assert.equal(overlay.hidden,true);assert.equal(m.remaining,before);
    assert.equal(a.speakersActive,true);assert.equal(a.waveElapsed,0);
    assert.equal(sign.position.x,target.x);
    assert.match(selectors['#chase-feedback'].textContent,/等等會有聲波/);
    const fill=speakers[0].getObjectByName('SoundFieldFill');
    const waves=speakers[0].children.filter(child=>child.name==='SoundFieldWave');
    assert.equal(fill.material.color.getHex(),0xf2b94b);
    assert(waves.every(wave=>!wave.visible));
    m.tick(LEFT_BLAST_START+.12);update(m,target);
    assert.ok(sign.position.x>target.x);
    assert.ok(Math.abs(before-m.remaining-LEFT_BLAST_START-.12)<1e-8);
    assert.deepEqual(waves.map(wave=>wave.visible),[true,false,false]);
    assert.equal(fill.material.color.getHex(),0xf0313f);
    assert.equal(waves[0].geometry.getAttribute('color').itemSize,4);
    const firstWidth=waves[0].scale.x;
    m.tick(.36);update(m,target);
    assert(waves.every(wave=>wave.visible));
    assert(waves[0].scale.x>firstWidth&&waves[0].scale.x>waves[1].scale.x);
   }
  }
  assert.equal(sign.visible,false);assert.equal(targetRing.visible,false);assert.equal(remote.visible,true);
  assert.match(selectors['#audio-objective'].textContent,/回音控台/);
  m.finishAudio(p);update(m,p);assert.equal(selectors['#audio-panel'].hidden,true);
  checkSpeakers(false);
  assert.equal(remote.position.x,CONSOLE.x);
  m.restart();update(m,p);assert.equal(remote.visible,true);assert.equal(sign.visible,true);assert.equal(targetRing.visible,false);
  checkSpeakers(false);
  assert.equal(selectors['#chase-feedback'].hidden,true);
  assert.ok(drawn.some(text=>text.includes('喇叭開起來')));
  assert.ok(drawn.some(text=>text.includes('二樓見')));
 }finally{
  globalThis.document=previous;
  scene.traverse(obj=>{obj.geometry?.dispose();obj.material?.map?.dispose();obj.material?.dispose();});
 }
});
