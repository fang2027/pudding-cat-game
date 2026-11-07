import {createGirlWorryPose} from './girl-worry.js';
import {babyFace} from './character-face.js';
import {poseFinale} from './finale.js';
import {BABY,GIRL,editingLayout,bindLayout,blockId,depthDistance} from './layout.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CONSOLE} from './audio-mission.js';
export const characters = [
 {name:'佳音寶寶',...BABY,id:'baby',file:'jiayin-baby.glb',task:'舞台道具任務',cue:'道具跑到哪裡去了？',text:'搬布景時，道具全滾出去了！'},
 {name:'佳音女寶寶',...GIRL,id:'girl',file:'jiayin-girl.glb',task:'燈光任務',cue:'燈光還沒排練好呢……',text:'拿著流程表，準備最後一次燈光排練。'},
 {name:'法蘭奇',...CONSOLE,id:'console',chaseFile:'frankie.glb',interaction:'音控台',task:'法蘭奇，遙控器還來！',cue:'汪！這個玩具是我的！',text:'法蘭奇正撥弄開場音樂的遙控器。'}
];
export function nearestCharacter(p, list=characters){
 if(!p.grounded)return null;
 return list.filter(n=>depthDistance(p,n)<1.25 && Math.abs(p.x-n.x)<1.5 && Math.abs((p.y??0)-(n.y??0))<.8).sort((a,b)=>Math.hypot(p.x-a.x,depthDistance(p,a))-Math.hypot(p.x-b.x,depthDistance(p,b)))[0]??null;
}
function addEyeHighlights(model,head){
 let source;
 model.traverse(mesh=>{
  if(mesh.isSkinnedMesh&&mesh.material?.name.startsWith('白.'))source=mesh;
 });
 const headIndex=source?.skeleton.bones.indexOf(head)??-1;
 if(headIndex<0)return null;

 // The white primitive also contains teeth. Isolate only the two eye glints.
 const positions=source.geometry.getAttribute('position');
 const index=source.geometry.getIndex();
 const eyeVertex=i=>positions.getY(i)>2.85&&positions.getZ(i)>1.3;
 const triangles=[],other=[];
 for(let i=0;i<(index?.count??positions.count);i+=3){
  const a=index?index.getX(i):i;
  const b=index?index.getX(i+1):i+1;
  const c=index?index.getX(i+2):i+2;
  const target=eyeVertex(a)&&eyeVertex(b)&&eyeVertex(c)?triangles:other;
  target.push(a,b,c);
 }
 if(!triangles.length)return null;

 // Draw the glints as a material group on the original skinned mesh.
 const geometry=source.geometry.clone();
 // The original glints split weight between the head and separate eye bones.
 // The eye surface uses the head bone alone, so match it during nods.
 const joints=geometry.getAttribute('skinIndex');
 const weights=geometry.getAttribute('skinWeight');
 for(const vertex of new Set(triangles)){
  joints.setXYZW(vertex,headIndex,0,0,0);
  weights.setXYZW(vertex,1,0,0,0);
 }
 geometry.setIndex([...other,...triangles]);
 geometry.clearGroups();
 geometry.addGroup(0,other.length,0);
 geometry.addGroup(other.length,triangles.length,1);
 const glints=new THREE.MeshBasicMaterial({color:0xffffff,depthWrite:false,side:THREE.DoubleSide});
 source.geometry=geometry;
 source.material=[source.material,glints];
 source.renderOrder=2;
 const blinkIndex=source.morphTargetDictionary?.['嚇瞇'];
 return worried=>{
  glints.depthTest=!worried;
  glints.visible=(source.morphTargetInfluences?.[blinkIndex]??0)<.25;
 };
}
export function setupNpcs(scene,getPlayer,pause,missionUi){
 const dialog=document.querySelector('#conversation'),prompt=document.querySelector('#interaction');
 const action=document.querySelector('#mission-action');
 let active=null;const visited=new Set();
 const cues=[];
 let previousCards="";
 function refresh(){const signature=characters.map(n=>missionUi?.status(n)??"待確認").join()+[...visited].join();if(signature===previousCards)return;previousCards=signature;document.querySelector('#missions').replaceChildren(...characters.map(n=>{const card=document.createElement('li');card.textContent=`${n.name} · ${n.task}：${missionUi?.status(n)??"待確認"}${visited.has(n.name)?' · 已交談':''}${n.file||n.chaseFile?'':' · 模型待提供'}`;return card;}));}
 for(const n of characters){
  const group=new THREE.Group();scene.add(group);
  group.position.set(n.x,n.y,n.z);
  bindLayout(n.id,n.interaction??n.name,group,group.position.clone(),blockId(n.id==='console'?1:0));
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff9e9';ctx.fillRect(0,0,512,128);ctx.fillStyle='#353047';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText(n.interaction??n.name,256,76);
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas)}));label.scale.set(2.3,.575,1);label.position.set(0,2.6,-.7);group.add(label);
  const bubbleCanvas=document.createElement("canvas");bubbleCanvas.width=640;bubbleCanvas.height=100;
  const bubbleCtx=bubbleCanvas.getContext("2d");bubbleCtx.fillStyle="#fff4d1";bubbleCtx.fillRect(0,0,640,100);bubbleCtx.fillStyle="#724518";bubbleCtx.textAlign="center";bubbleCtx.font="bold 32px sans-serif";bubbleCtx.fillText(n.cue,320,63);
  const bubble=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(bubbleCanvas)}));bubble.scale.set(3.6,.56,1);bubble.position.set(0,3.4,-.7);group.add(bubble);const cue={n,bubble,group,label,face:null};cues.push(cue);
  if(!n.file){const desk=new THREE.Mesh(new THREE.BoxGeometry(1.2,.8,.7),new THREE.MeshStandardMaterial({color:0x66578e}));desk.position.set(0,.4,-1.2);group.add(desk);continue;}
  new GLTFLoader().load(import.meta.env.BASE_URL+'assets/characters/'+n.file,g=>{
   const model=g.scene;model.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(model);model.scale.setScalar(1.8/box.getSize(new THREE.Vector3()).y);model.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(model);const center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-.7-center.z);group.add(model);cue.face=babyFace(model,n.id==='baby'?.7:2.2);
   const head=model.getObjectByName('DEF-spine006')??model.getObjectByName('DEF-spine.006');
   cue.updateGlints=addEyeHighlights(model,head);
   if(n.id==='girl')cue.worryMotion=createGirlWorryPose(model);
   if(n.id==='baby'){
    const rest=head?.quaternion.clone();
    const nodAxis=head?new THREE.Vector3(1,0,0).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()).invert()):null;
    let time=0,weight=0;
    cue.worryMotion=(dt,worried,dancing)=>{
     time+=dt;
     weight=dancing?0:THREE.MathUtils.damp(weight,Number(worried),8,dt);
     model.rotation.y=Math.sin(time*2.1)*.20*weight;
     if(head)head.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(nodAxis,(.15+.09*Math.cos(time*2.1))*weight));
    };
   }
  },undefined,()=>{n.text='角色模型載入失敗，請重新整理。任務內容仍待確認。';label.material.color.set(0xffa080);});
 }
 function open(){
  if(dialog.open)return;
  active=nearestCharacter(getPlayer());
  if(!active)return;
  pause(true);
  const info=missionUi?.dialog(active);
  dialog.dataset.speaker=active.id;
  document.querySelector('#speaker').textContent=active.name;
  document.querySelector('#speech').textContent=info?.text??active.text;
  document.querySelector('#task-name').textContent=info?.task??active.task+' · 內容、計時與計分待確認';
  const summary=document.querySelector('#task-summary');
  const details=document.querySelector('#task-details');
  summary.hidden=!info?.summary;
  summary.textContent=info?.summary??'';
  details.open=!info?.summary;
  details.querySelector('summary').hidden=!info?.summary;
  action.hidden=!info?.action;
  action.querySelector('span').textContent=info?.label??'';
  action.onclick=info?.action?()=>{close();info.action();}:null;
  visited.add(active.name);
  refresh();
  dialog.showModal();
  document.querySelector('#close-dialog').focus();
 }
 function close(){pause(false);dialog.close();}
 document.querySelector('#close-dialog').onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('close',()=>{pause(false);active=null;});
 addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.code!=='KeyE'||e.repeat)return;
  e.preventDefault();
  if(!dialog.open)open();
  else if(!action.hidden)action.click();
 });
 prompt.onclick=open;refresh();
 return (behind=false,dance=null,mission,dt=0,lightMistake=false)=>{refresh();cues.forEach(({n,bubble,group,label,face,worryMotion,updateGlints})=>{
  const dancing=dance!==null&&Boolean(n.file);
  group.visible=!behind;
  label.visible=dance===null;
  if(dancing)poseFinale(group,dance,n.id==='baby'?0:2,.7);
  else if(!editingLayout){group.position.set(n.x,n.y,n.z);group.rotation.set(0,0,0);}const state=missionUi?.status(n);
  const id=n.id==='baby'?'props':'lights';
  const worried=Boolean(n.file)&&Boolean(mission)&&mission.records[id].state!=='complete'&&!editingLayout&&!dancing;
  worryMotion?.(dt,worried,dancing);
  const roundClear=id==='lights'&&mission?.activeId==='lights'&&mission.lights.stage==='round-clear';
  face?.(dt,dancing?{smile:.75,mouth:.4+.25*Math.sin(dance*8+(id==='props'?0:1))}:id==='lights'&&lightMistake?{surprise:.65}:roundClear||mission?.records[id]?.state==='complete'?{smile:.7}:worried?{worry:.7,worriedEyes:.55}:dialog.open&&active===n?{smile:.5,mouth:.3}:{});updateGlints?.(worried);bubble.visible=state==='需要你的幫忙';});const n=nearestCharacter(getPlayer());prompt.hidden=!n||dialog.open;prompt.textContent=n?'按 E 與'+(n.interaction??n.name)+'互動':'';};
}
