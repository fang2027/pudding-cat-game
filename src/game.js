import {setupGameFeedback} from './game-feedback.js';
import {CONSOLE} from './audio-mission.js';
import {loadSitSettings,mountSitEditor} from './sit-editor.js';
import {createFace} from './character-face.js';
import {DANCE_SECONDS,FINALE_CENTER,poseFinale} from './finale.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {player,step,SPAWN,WALK_SPEED,isFallingOffStage} from './physics.js';
import './game.css';
import {blockId,bindLayout,editingLayout,layoutPoint} from './layout.js';
import {setupLayoutEditor} from './layout-editor.js';
import {setupTheatre,CURTAIN_SECONDS} from './theatre.js';
import {setupNpcs} from './npcs.js';
import {Mission,RULES,PROPS,TASKS} from './mission.js';
import {missionUi,missionStatus} from './mission-ui.js';
import {setupLightStage} from './light-stage.js';
import {createLightRoundReset,PADS} from './lights.js';
import {setupVideoEasterEggs} from './video-eggs.js';
import {setupAudioStage} from './audio-stage.js';
import {setupOpening,REQUESTS} from './story.js';
import {createPuddingWalk} from './pudding-walk.js';
const host=document.querySelector('#game'),status=document.querySelector('#status');
const sitSettings=loadSitSettings();
const sitEditor=!editingLayout&&new URLSearchParams(location.search).get('sit')==='1';
if(sitEditor)mountSitEditor(sitSettings);
if(!editingLayout&&!sitEditor)document.body.classList.add('playing');
const scene=new THREE.Scene();

const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const padBounceDuration=.18;
let padBounce=0;scene.background=new THREE.Color('#211c30');
const camera=new THREE.PerspectiveCamera(36,1,.1,120);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
const gameFeedback=setupGameFeedback(scene,renderer.domElement);
renderer.outputColorSpace=THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xffffff,0xbda5a0,2.5));
const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-5,10,8);scene.add(light);
const updateTheatre=setupTheatre(scene);
const lightFocus=(Math.min(...PADS.map(pad=>pad.x))+Math.max(...PADS.map(pad=>pad.x)))/2;
const lightHeight=(Math.min(...PADS.map(pad=>pad.y))+Math.max(...PADS.map(pad=>pad.y+3.5)))/2;
const cameraTarget=new THREE.Vector3();
const cameraDirection=new THREE.Vector3(.17,.29,1).normalize();
const cameraRight=new THREE.Vector3(0,1,0).cross(cameraDirection).normalize();
const cameraUp=cameraDirection.clone().cross(cameraRight);
const corner=new THREE.Vector3();
function lightCameraDistance(){
 const slope=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*.9;
 let distance=0;
 for(const pad of PADS){
  for(const x of [-.65,.65])for(const y of [0,3.7])for(const z of [-1.5,1]){
   corner.set(pad.x+x-lightFocus,pad.y+y-lightHeight,pad.z+z);
   distance=Math.max(distance,corner.dot(cameraDirection)+Math.max(
    Math.abs(corner.dot(cameraRight))/(slope*camera.aspect),Math.abs(corner.dot(cameraUp))/slope));
  }
 }
 return distance;
}
const storageTop=layoutPoint('set-storage',{x:-13,y:.72,z:-1.76},blockId(0));
const displayScale=.42;
const propMeshes=PROPS.map((prop,i)=>{
 const geometry=i===0?new THREE.OctahedronGeometry(.4):i===1?new THREE.IcosahedronGeometry(.38,0):new THREE.TorusGeometry(.3,.1,8,20);
 geometry.computeBoundingBox();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:prop.color,emissive:prop.color,emissiveIntensity:.25}));
 mesh.position.set(prop.x,prop.y,prop.z);
 const group=new THREE.Group();group.add(mesh);scene.add(group);
 bindLayout('prop-'+prop.id,prop.name,group,mesh.position.clone(),blockId([1,8,12][i]));
 return mesh;
});
const checklist=document.querySelector('#props');
const propIcons={star:'★',gem:'◆',ring:'◯'};
const propItems=PROPS.map(prop=>{
 const item=document.createElement('li');
 const icon=document.createElement('span');
 icon.className='hud-icon';icon.textContent=propIcons[prop.id];icon.setAttribute('aria-hidden','true');
 item.append(icon,prop.name);
 item.dataset.prop=prop.id;
 item.title=prop.name;
 checklist.append(item);
 return item;
});
const dashboard=document.querySelector('#dashboard');
const hudHearts=document.querySelector('#hud-hearts');
const hudTimer=document.querySelector('#hud-timer');
const hudProgress=document.querySelector('#preparations');
const hudMissions=document.querySelector('#hud-missions');
const hudScores=document.querySelector('#hud-scores');
const propPanel=document.querySelector('#prop-panel');
const propCount=document.querySelector('#prop-count');
const hearts=Array.from({length:RULES.lives},()=>{
 const heart=document.createElement('span');
 heart.textContent='♥';heart.setAttribute('aria-hidden','true');hudHearts.append(heart);
 return heart;
});
const taskIcons={props:'★',lights:'♪',audio:'♥'};
const taskLabels={props:'道具',lights:'燈光',audio:'音響'};
const taskCards=Object.entries(TASKS).map(([id,task])=>{
 const chip=(list,label)=>{
  const card=document.createElement('li');
  card.dataset.task=id;card.title=task.name;
  const icon=document.createElement('span');icon.className='hud-icon';
  icon.textContent=taskIcons[id];icon.setAttribute('aria-hidden','true');
  const value=document.createElement('strong');value.textContent=label;
  card.append(icon,value);list.append(card);
  return {card,icon,value};
 };
 return {id,progress:chip(hudMissions,(id==='audio'?'音樂':taskLabels[id])+'就位'),points:chip(hudScores,'')};
});
const actor=new THREE.Group(),actorPlacement=new THREE.Group();actorPlacement.add(actor);scene.add(actorPlacement);
bindLayout('spawn','布丁貓起點',actorPlacement,new THREE.Vector3(SPAWN.x,SPAWN.y,SPAWN.z),blockId(0));let ready=false,p=player(),queuedJump=false,walk=null,walking=false;
let face=null,reaction=null;
const keys=new Set();let paused=false;
const mission=new Mission();
const resetLightRound=createLightRoundReset();
function prepareLightRound(){
 if(!resetLightRound(mission,p))return;
 clearInput();walking=false;walk?.reset();actor.rotation.y=Math.PI/2;
}
const opening=setupOpening(clearInput);
let curtainProgress=0,danceElapsed=0,pendingFinale=null;
const updateLights=setupLightStage(scene);
const updateAudioStage=setupAudioStage(scene);
const audioReady=()=>mission.activeId==='audio'&&mission.audio.readyRemaining>0;
const controlsLocked=()=>audioReady()||(mission.activeId==='lights'&&mission.lights.locked);
const result=document.querySelector('#result');
const continueButton=document.querySelector('#result-close');
const restartButton=document.querySelector('#restart-game');
const ended=()=>['gameover','won'].includes(mission.phase);
function clearInput(){keys.clear();queuedJump=false;}
function respawn(){padBounce=0;p=player();clearInput();walking=false;walk?.reset();}
function showResult(outcome){
 if(!outcome)return;clearInput();
 if(outcome.kind==='failure'||outcome.kind==='gameover')reaction={pose:mission.lastId==='lights'?{surprise:.85}:{scared:.85},time:.6};
 if(outcome.kind==='success')reaction={pose:{grin:.8},time:1};
 if(outcome.kind==='victory'&&danceElapsed<DANCE_SECONDS){pendingFinale=outcome;return;}
 const {kind}=outcome;
 const success=kind==='success',victory=kind==='victory';
 if(success||victory)gameFeedback.success();
 const record=mission.records[mission.lastId];
 result.dataset.kind=kind;
 document.querySelector('#result-title').textContent=success?'完成':outcome.title;
 const resultText=document.querySelector('#result-text');
 resultText.hidden=victory;
 resultText.textContent=success&&!mission.allComplete?'此項分數已保存，可繼續探索或挑戰另一項任務。':outcome.text;
 document.querySelector('#result-earned').hidden=!success;
 if(success){
  document.querySelector('#result-points').textContent=record.score;
  document.querySelector('#result-base').textContent=RULES.baseScore;
  document.querySelector('#result-bonus').textContent='+'+(record.score-RULES.baseScore);
 }
 const total=document.querySelector('#result-total');
 total.hidden=!victory;
 total.querySelector('strong').textContent=mission.score;
 const lives=document.querySelector('#result-lives');
 lives.hidden=success;
 const hearts=lives.querySelector('span');
 hearts.setAttribute('aria-label',`${mission.lives} / ${RULES.lives}`);
 hearts.replaceChildren(...Array.from({length:RULES.lives},(_,index)=>{
  const heart=document.createElement('i');
  heart.setAttribute('aria-hidden','true');
  heart.classList.toggle('spent',index>=mission.lives);
  heart.textContent='♥';
  return heart;
 }));
 const names={props:'佳音寶寶',lights:'佳音女寶寶',audio:'法蘭奇'};
 document.querySelector('#result-speaker').textContent=victory?'舞台上':success?names[mission.lastId]:'夥伴們';
 const story=document.querySelector('#result-story');
 story.textContent=outcome.kind==='victory'?'「道具就位！」「燈光就位！」「音樂……法蘭奇，不可以再咬了！」\n聚光燈亮起，布丁貓站上舞台。這一次，大家都準備好了。':outcome.kind==='success'?REQUESTS[mission.lastId].thanks:outcome.kind==='gameover'?'大家陪布丁貓回到幕後。「先休息一下，我們再一起練一次！」':'「沒關係，彩排就是拿來練習的，再試一次！」';
 const scores=document.querySelector('#result-scores');
 scores.hidden=!ended();
 if(ended()){
  const icons={props:'★',lights:'♪',audio:'♥'};
  scores.replaceChildren(...Object.entries(TASKS).map(([id,task])=>{
   const li=document.createElement('li');
   const {state,score}=mission.records[id];
   li.dataset.task=id;
   li.classList.toggle('incomplete',state!=='complete');
   const icon=document.createElement('span');
   icon.className='result-task-icon';
   icon.textContent=icons[id];
   icon.setAttribute('aria-hidden','true');
   const label=document.createElement('span');
   label.textContent=task.name;
   const value=document.createElement('strong');
   value.textContent=state==='complete'?score+' 分':'未完成';
   li.append(icon,label,value);
   return li;
  }));
 }
 continueButton.hidden=ended();restartButton.hidden=!ended();
 result.showModal();
 (ended()?restartButton:continueButton).focus();
}
continueButton.onclick=()=>result.close();
result.addEventListener('close',clearInput);
result.addEventListener('cancel',e=>{if(ended())e.preventDefault();});
restartButton.onclick=()=>{curtainProgress=0;danceElapsed=0;reaction=null;actor.rotation.set(0,Math.PI/2,0);pendingFinale=null;mission.restart();respawn();result.close();opening.show();};
result.addEventListener('keydown',e=>{
 if(e.repeat||e.defaultPrevented)return;
 const button=ended()?(e.code==='KeyR'?restartButton:null):(e.code==='KeyE'?continueButton:null);
 if(!button)return;
 e.preventDefault();
 button.click();
});
function reset(){if(audioReady()||editingLayout||!ready||opening.open||paused||videoEggs.open||result.open)return;if(ended())return;if(mission.phase==='active'){showResult(mission.fail('返回起點：本次任務失敗'));}respawn();}
const remotePrompt=document.querySelector('#remote-interaction');
function interactWithFrankie(){if(ready&&!opening.open&&!paused&&!videoEggs.open&&!result.open&&!document.hidden&&!ended()&&mission.interactAudio(p))clearInput();}
remotePrompt.onclick=interactWithFrankie;
// Handle pickup before the NPC listener, so a single E has a single purpose.
addEventListener('keydown',e=>{
 if(e.code==='KeyE'&&!e.repeat&&ready&&!opening.open&&!paused&&!videoEggs.open&&!result.open&&!ended()&&mission.activeId==='audio'&&mission.audio.canInteract(p)){
  e.preventDefault();interactWithFrankie();
 }
});
const videoEggs=setupVideoEasterEggs(scene,mission,()=>!editingLayout&&ready&&!opening.open&&!paused&&!result.open&&!document.hidden&&!ended()&&!audioReady()?p:null,clearInput);
const updateNpcs=setupNpcs(scene,()=>!editingLayout&&ready&&!opening.open&&!result.open&&!ended()&&!controlsLocked()&&!videoEggs.open?p:{x:0,grounded:false},value=>{if(paused===value)return;paused=value;clearInput();},missionUi(mission,()=>p,showResult,clearInput));
const updateEditor=editingLayout?setupLayoutEditor(scene,camera,renderer.domElement):null;
document.querySelector('#reset').onclick=reset;
addEventListener('keydown',e=>{
 if(editingLayout||opening.open||paused||videoEggs.open||result.open||ended()||e.target?.closest?.('#sit-editor'))return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();
 if(e.code==='KeyR'&&!e.repeat){reset();return;}
 if(controlsLocked())return;
 keys.add(e.code);if(e.code==='Space'&&!e.repeat)queuedJump=true;
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();queuedJump=false;});
document.addEventListener('visibilitychange',()=>{clearInput();previous=performance.now();accumulator=0;});
new GLTFLoader().load(import.meta.env.BASE_URL+'assets/characters/pudding-cat.glb',g=>{
 const model=g.scene;model.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(model);model.scale.setScalar(1.25/box.getSize(new THREE.Vector3()).y);model.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(model);const center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-center.z);actor.add(model);walk=createPuddingWalk(model,{idle:!editingLayout,sitSettings});face=createFace(model,{smile:"貓表情--E微笑",laugh:"貓表情--A張口笑",grin:"貓表情--I露齒笑",surprise:"貓表情--O驚訝",scared:"嚇",happyEyes:"貓表情--瞇眼",tongue:"收舌頭"},"貓表情--閉眼");ready=true;respawn();if(!editingLayout)opening.show();
},undefined,()=>{status.textContent='角色載入失敗，請重新整理頁面再試。';});
function resize(){camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);}
new ResizeObserver(resize).observe(host);
let previous=performance.now(),accumulator=0;
function frame(now){requestAnimationFrame(frame);const wallDelta=(now-previous)/1000;accumulator+=Math.min(wallDelta,.05);previous=now;
 let travel=0,takeoff=false,landedSpeed=0;
 if(ready&&!opening.open&&!paused&&!videoEggs.open&&!result.open&&!document.hidden){const wasLocked=controlsLocked();const outcome=mission.tick(wallDelta);if(wasLocked&&!controlsLocked())clearInput();if(outcome){respawn();showResult(outcome);}}
 // Reset once per new sequence, before physics or any pad input is sampled.
 prepareLightRound();
 while(accumulator>=1/120){
  if(!editingLayout&&ready&&!opening.open&&!paused&&!videoEggs.open&&!result.open&&!document.hidden&&!ended()&&!controlsLocked()){
   const dir=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
   const depth=mission.activeId==='lights'?0:Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
   const before=p,wasGrounded=p.grounded,previousVy=p.vy;
   const frankie=mission.records.audio.state!=='complete'&&!mission.audio.carrying
    ?(mission.activeId==='audio'?mission.audio.position:CONSOLE):null;
   if(step(p,dir,queuedJump,1/120,depth,frankie)){showResult(mission.fail('掉下舞台了'));respawn();}
   if(mission.collect(p)){
    reaction={pose:mission.allCollected?{grin:.8}:{laugh:.7},time:.65};
    const id=[...mission.collected].at(-1);
    const index=PROPS.findIndex(prop=>prop.id===id);
    if(!reducedMotion.matches)gameFeedback.pickup(propMeshes[index],propItems[index]);
   }
   const previousPadFeedback=mission.lights.feedback;
   const padResult=mission.touchPad(p)??mission.updateAudio(p);
   const padFeedback=mission.lights.feedback;
   if(padFeedback!==previousPadFeedback&&padFeedback?.result==='correct'){
    gameFeedback.pad(PADS.find(pad=>pad.id===padFeedback.padId));
    padBounce=padBounceDuration;
   }
   if(padResult){if(['failure','gameover'].includes(padResult.kind))respawn();showResult(padResult);}
   walking=p===before&&Boolean(dir||depth);
   if(p===before){
    if(walking)travel+=WALK_SPEED/120;
    if(wasGrounded&&queuedJump&&!p.grounded&&p.vy>0)takeoff=true;
    if(!wasGrounded&&p.grounded)landedSpeed=Math.max(landedSpeed,-previousVy);
   }else{travel=0;takeoff=false;landedSpeed=0;}
   queuedJump=false;if(dir||depth)actor.rotation.y=Math.atan2(dir,depth);
  }
  accumulator-=1/120;
 }
 const celebrating=mission.phase==='won';
 if(celebrating&&!document.hidden&&pendingFinale){
  const dt=Math.min(wallDelta,.05);
  if(curtainProgress<1)curtainProgress=Math.min(1,curtainProgress+dt/CURTAIN_SECONDS);
  else danceElapsed=Math.min(DANCE_SECONDS,danceElapsed+dt);
 }
 const dance=celebrating&&curtainProgress===1?danceElapsed:null;
 const faceDt=document.hidden?0:Math.min(wallDelta,.05);
 if(!result.open&&reaction)reaction.time-=faceDt;
 const lightFeedback=mission.activeId==='lights'&&mission.lights.feedback?.result==='correct';

 const behind=!editingLayout&&!celebrating&&p.z<-1.65;
 updateTheatre(mission.allComplete,curtainProgress,behind);
 padBounce=Math.max(0,padBounce-faceDt);
 const bounce=p.grounded&&!reducedMotion.matches?.15*Math.sin(Math.PI*padBounce/padBounceDuration):0;
 actor.position.set(p.x,p.y+bounce,p.z);walk?.update(Math.min(wallDelta,.05),{distance:travel,moving:walking,grounded:p.grounded,verticalVelocity:p.vy,takeoff,landedSpeed,paused:opening.open||paused||videoEggs.open||result.open||document.hidden||ended()||controlsLocked()});if(dance!==null){walk?.reset();poseFinale(actor,dance,1);}
 const seated=walk?.seated;
 const gotRemote=mission.activeId==='audio'&&mission.audio.carrying;
 const falling=isFallingOffStage(p);
 const tongueOut=!falling&&(seated||gotRemote);
 // The smile targets also pull the tongue back, so tongue-out poses use the base mouth.
 face?.(faceDt,falling?{scared:1}:gotRemote?{happyEyes:.65}:seated?{}:dance!==null?(Math.sin(dance*5)>0?{laugh:.8}:{grin:.8}):reaction?.time>0?reaction.pose:lightFeedback?{smile:.8}:mission.activeId?{}:{smile:.25}, {tongue:tongueOut?0:1,scared:falling?1:undefined});
 videoEggs.update(behind,!editingLayout&&ready&&!ended());updateNpcs(behind,dance,mission,faceDt,reaction?.time>0&&Boolean(reaction.pose.surprise));updateLights(mission,p,behind);updateAudioStage(mission,p,{behind,dance,dt:Math.min(wallDelta,.05),paused:opening.open||paused||videoEggs.open||result.open||document.hidden||ended()||controlsLocked()});
 remotePrompt.hidden=!(ready&&!opening.open&&!paused&&!videoEggs.open&&!result.open&&!ended()&&mission.activeId==='audio'&&mission.audio.canInteract(p));
 remotePrompt.textContent=mission.audio.interactionLabel;
 const stageView=curtainProgress*curtainProgress*(3-2*curtainProgress);
 const lighting=mission.activeId==='lights';
 const followX=lighting?lightFocus:p.x;
 const followY=lighting?lightHeight:1.45+p.y*.85;
 const focus=THREE.MathUtils.lerp(followX,FINALE_CENTER,stageView);
 const focusY=THREE.MathUtils.lerp(followY,1.45,stageView);
 if(updateEditor)updateEditor();
 else if(opening.menu&&!sitEditor){
  cameraTarget.set(-1,2.6,-1.5);
  camera.position.set(4+Math.sin(now/5500)*2,7,Math.max(17,23/camera.aspect));
  camera.lookAt(cameraTarget);
 }
 else{
  cameraTarget.set(focus,focusY,THREE.MathUtils.lerp(lighting?0:p.z,0,stageView));
  const distance=THREE.MathUtils.lerp(lighting?lightCameraDistance():8.1,Math.max(10.5,13/camera.aspect),stageView);
  camera.position.copy(cameraTarget).addScaledVector(cameraDirection,distance);
  camera.lookAt(cameraTarget);
 }
 if(ready){
 status.textContent=missionStatus(mission);
 const done=taskCards.filter(({id})=>mission.records[id].state==='complete').length;
 dashboard.hidden=celebrating;
 hudHearts.setAttribute('aria-label','剩餘機會 '+mission.lives+' / '+RULES.lives);
 hearts.forEach((heart,i)=>heart.classList.toggle('spent',i>=mission.lives));
 const seconds=Math.ceil(mission.remaining);
 hudTimer.textContent=mission.activeId?taskLabels[mission.activeId]+'任務 '+seconds+' 秒':'不計時';
 hudTimer.dataset.urgent=Boolean(mission.activeId&&seconds<=10);
 hudTimer.dataset.active=Boolean(mission.activeId);
 hudProgress.textContent=done+' / '+taskCards.length;
 hudProgress.setAttribute('aria-label','開演準備 '+done+' / '+taskCards.length);
 for(const {id,progress,points} of taskCards){
  const {state,score}=mission.records[id];
  progress.card.dataset.state=points.card.dataset.state=state;
  progress.icon.textContent=state==='complete'?'✓':taskIcons[id];
  progress.card.setAttribute('aria-label',TASKS[id].name+' '+(state==='complete'?'已完成':state==='active'?'進行中':'未完成'));
  points.value.textContent=taskLabels[id]+' '+score+' 分';
 }
 propCount.textContent=mission.collected.size+' / '+PROPS.length;

 }
 propMeshes.forEach((mesh,i)=>{const delivered=mission.records.props.state==='complete';mesh.visible=editingLayout||delivered||(mission.activeId==='props'&&!mission.collected.has(PROPS[i].id));mesh.scale.setScalar(delivered?displayScale:1);mesh.position.set(delivered?storageTop.x+(i-1)*.39:PROPS[i].x,delivered?storageTop.y-mesh.geometry.boundingBox.min.y*displayScale:PROPS[i].y,delivered?storageTop.z:PROPS[i].z);mesh.rotation.y+=.012;const collected=mission.collected.has(PROPS[i].id);propItems[i].classList.toggle('collected',collected);propItems[i].firstElementChild.textContent=collected?'✓':propIcons[PROPS[i].id];propItems[i].setAttribute('aria-label',PROPS[i].name+(collected?' 已取得':' 未取得'));});
 propPanel.hidden=mission.activeId!=='props';
 document.querySelector('#reset').textContent=mission.phase==='active'?'返回起點（扣 1 次機會）':'返回起點';
 gameFeedback.update(faceDt,camera);
 renderer.render(scene,camera);
 if(pendingFinale&&danceElapsed===DANCE_SECONDS){
  const outcome=pendingFinale;pendingFinale=null;showResult(outcome);
 }
}requestAnimationFrame(frame);
