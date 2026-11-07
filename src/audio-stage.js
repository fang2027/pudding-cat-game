import {createFace} from './character-face.js';
import {poseFinale} from './finale.js';
import {bindLayout,blockId,editingLayout,followLayout} from './layout.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createFrankieRun} from './frankie-run.js';
import {SPEAKERS,REMOTE,CONSOLE,CHASE_STAGES,audioObjective} from './audio-mission.js';
const loadFrankieGltf=()=>new GLTFLoader().loadAsync((import.meta.env?.BASE_URL??'/')+'assets/characters/frankie.glb');
export function setupAudioStage(scene,{loadFrankie=loadFrankieGltf}={}){
 const panel=document.querySelector('#audio-panel'),cards=document.querySelector('#speaker-states');
 const progress=document.querySelector('#chase-progress'),feedback=document.querySelector('#chase-feedback');
 const steps=CHASE_STAGES.map((stage,i)=>{const card=document.createElement('span');card.textContent=`${i+1}. ${stage.name}`;progress.append(card);return card;});
 const zones=SPEAKERS.map((s,index)=>{
  const group=new THREE.Group();scene.add(group);
  bindLayout('speaker-'+index,s.name,group,new THREE.Vector3(s.x,s.y,s.z),blockId(12));
  const speaker=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.6),new THREE.MeshStandardMaterial({color:0x494358}));speaker.position.set(s.x,s.y+.6,s.z-1.5);group.add(speaker);
  const cone=new THREE.Mesh(new THREE.TorusGeometry(.21,.06,8,24),new THREE.MeshStandardMaterial({color:0xd8d0e9}));cone.position.set(s.x,s.y+.7,s.z-1.17);group.add(cone);
  const danger=new THREE.Mesh(new THREE.BoxGeometry(s.width,.75,s.depth),new THREE.MeshBasicMaterial({color:0xe5636b,transparent:true,opacity:.3,depthWrite:false}));danger.position.set(s.x,s.y+.375,s.z);group.add(danger);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(s.width,.04,s.depth),new THREE.MeshBasicMaterial({color:0x65bca0}));floor.position.set(s.x,s.y+.02,s.z);group.add(floor);
  const card=document.createElement('span');cards.append(card);
  const rings=[.3,.48,.66].map(radius=>{
   const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,8,32),new THREE.MeshBasicMaterial({color:0xe5636b}));
   ring.position.set(s.x,s.y+.4,s.z);ring.scale.y=.5;group.add(ring);return ring;
  });
  return {group,danger,floor,card,rings};
 });
 const frankie=new THREE.Group();frankie.name='FrankieChase';
 if(editingLayout){
  const placement=new THREE.Group();scene.add(placement);placement.add(frankie);
  followLayout('console',placement,blockId(1));
 }else scene.add(frankie);
 let face=null,runner=null,previousActive=false,previousElapsed=0,previousPosition=CONSOLE,direction=Math.PI/2;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#66578e';ctx.fillRect(0,0,512,160);
 const texture=new THREE.CanvasTexture(canvas);let previousSign='';
 const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false}));sign.renderOrder=5;
 sign.scale.set(2.6,.81,1);sign.position.set(0,2.8,-.5);frankie.add(sign);
 const pole=new THREE.Mesh(new THREE.BoxGeometry(.07,1.2,.07),new THREE.MeshStandardMaterial({color:0x89674a}));pole.position.set(0,1.8,-.5);frankie.add(pole);
 if(loadFrankie)Promise.resolve().then(loadFrankie).then(gltf=>{
  runner=createFrankieRun(gltf);face=createFace(gltf.scene,{mouth:"嘴闔",surprise:"O",brow:"眉毛"},"閉眼",1.45);frankie.add(runner.object);pole.visible=false;
  sign.scale.set(2.3,.72,1);sign.position.set(0,1.95,-.5);
 }).catch(error=>{frankie.userData.modelError=error.message;});
 const remote=new THREE.Group();scene.add(remote);
 if(editingLayout){
  const placement=new THREE.Group();scene.add(placement);placement.add(remote);
  followLayout('console',placement,blockId(1));
 }
 const body=new THREE.Mesh(new THREE.BoxGeometry(.35,.65,.2),new THREE.MeshStandardMaterial({color:0x66578e,emissive:0x44335e,emissiveIntensity:.4}));remote.add(body);
 for(let i=0;i<3;i++){const button=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),new THREE.MeshBasicMaterial({color:i===0?0xffbc62:0xffffff}));button.position.set(0,.15-i*.15,.13);remote.add(button);}
 remote.position.set(REMOTE.x,REMOTE.y,REMOTE.z);
 const targetRing=new THREE.Mesh(new THREE.RingGeometry(.55,.7,32),new THREE.MeshBasicMaterial({color:0xe8a544,side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));
 targetRing.rotation.x=-Math.PI/2;scene.add(targetRing);
 return (m,p,{dt=0,paused=false,behind=false,dance=null}={})=>{
  const active=m.activeId==='audio',complete=m.records.audio.state==='complete';panel.hidden=!active;
  document.querySelector('#audio-objective').textContent=audioObjective(m.audio);
  feedback.hidden=!active||!m.audio.feedback;feedback.textContent=m.audio.feedback;
  steps.forEach((card,i)=>{const done=m.audio.carrying||i<m.audio.stage;card.dataset.state=done?'done':i===m.audio.stage?'current':'next';card.textContent=`${done?'✓':i+1+'.'} ${CHASE_STAGES[i].name}`;});
  const caught=active&&m.audio.carrying&&m.audio.feedbackRemaining>2.25;
  frankie.visible=(caught&&Boolean(runner))||(dance!==null&&Boolean(runner))||!complete&&!m.audio.carrying&&(active||!behind);
  if((previousActive&&!active)||(active&&m.audio.elapsed<previousElapsed))runner?.reset();
  const position=active?m.audio.position:CONSOLE;
  const dx=position.x-previousPosition.x,dz=position.z-previousPosition.z;
  const moving=active&&previousActive&&Math.hypot(dx,dz)>1e-6;
  if(moving)direction=Math.atan2(dx,dz);
  runner?.update(dt,{moving: moving&&!m.audio.carrying&&!m.audio.waiting&&m.audio.reactionRemaining===0,heading:direction,paused});
  previousActive=active;previousElapsed=m.audio.elapsed;previousPosition=position;
  frankie.position.set(position.x,position.y,position.z);
  frankie.rotation.set(0,0,0);
  sign.visible=dance===null&&!caught;
  const escape=active&&m.audio.stage===1&&m.audio.waveElapsed<.8;
  face?.(dt,dance!==null?{brow:.4,mouth:.1}:caught?{mouth:.9}:escape?{surprise:.6,brow:.7}:m.audio.reactionRemaining>0?{brow:.65}:{mouth:.18});
  if(dance!==null&&runner){
   runner.object.rotation.y=0;
   poseFinale(frankie,dance,3);
  }
  const heading=!active?'法蘭奇':m.audio.carrying?'抓到法蘭奇了！':`法蘭奇 · ${m.audio.stage+1} / 3 ${Math.abs(m.audio.target.z-position.z)>1?'↑':m.audio.target.x<position.x?'←':'→'}`;
  const speech=!active?'汪！一起玩追逐吧！':m.audio.stage===1&&m.audio.waveElapsed<1.2?'喇叭開起來！嘿嘿！':m.audio.reactionRemaining>0?'二樓見！追得到嗎？':m.audio.waiting?'追到就按 E！':'遙控器在我這！';
  const signature=heading+speech;
  if(signature!==previousSign){
   previousSign=signature;ctx.fillStyle=m.audio.reactionRemaining>0?'#a15f32':'#66578e';ctx.fillRect(0,0,512,160);
   ctx.fillStyle='#fff9e9';ctx.textAlign='center';ctx.font='bold 40px sans-serif';ctx.fillText(heading,256,68);
   ctx.font='28px sans-serif';ctx.fillText(speech,256,124);texture.needsUpdate=true;
  }
  targetRing.visible=active&&!m.audio.carrying;
  targetRing.position.set(m.audio.target.x,m.audio.target.y+.08,m.audio.target.z);
  targetRing.material.opacity=m.audio.waiting?.85:.4;
  zones.forEach(({group,danger,floor,card,rings},i)=>{
   group.visible=editingLayout||active||complete;
   const phase=active?m.audio.phase(SPEAKERS[i]):'safe';
   const color=phase==='blast'?0xe5636b:phase==='warning'?0xf2b94b:0x65bca0;
   floor.material.color.setHex(color);danger.visible=phase==='blast';
   danger.material.opacity=.25+.15*Math.sin(m.audio.elapsed*16)**2;
   rings.forEach((ring,index)=>{ring.visible=phase==='blast';ring.scale.x=1+.15*Math.sin(m.audio.elapsed*12-index);});
   card.textContent=active&&!m.audio.speakersActive?`${SPEAKERS[i].name}：尚未啟動 · 先追到左喇叭左側`:`${SPEAKERS[i].name}：${phase==='safe'?'安全':phase==='warning'?'預警，準備發作':'危險，跳過或等待'} ${active?m.audio.remaining(SPEAKERS[i]).toFixed(1)+' 秒':''}`;
   card.dataset.phase=phase;
  });
  remote.visible=active||!behind;remote.rotation.y=m.audio.elapsed;
  if(complete)remote.position.set(CONSOLE.x,CONSOLE.y+.95,CONSOLE.z-.8);
  else if(m.audio.carrying)remote.position.set(p.x+.45,p.y+1.5,p.z);
  else if(m.audio.waiting)remote.position.set(m.audio.frankieX,position.y+.65,position.z);
  else remote.position.set(m.audio.frankieX+.6,position.y+2,position.z-.5);
 };
}
