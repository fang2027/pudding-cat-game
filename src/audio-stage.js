import {createFace} from './character-face.js';
import {poseFinale} from './finale.js';
import {bindLayout,blockId,editingLayout,followLayout} from './layout.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createFrankieRun} from './frankie-run.js';
import {AUDIO_RULES,SPEAKERS,SOUND_FIELD_ANGLE,REMOTE,CONSOLE,CHASE_STAGES,WAVE_COUNTDOWN_SECONDS,audioObjective} from './audio-mission.js';
const loadFrankieGltf=()=>new GLTFLoader().loadAsync((import.meta.env?.BASE_URL??'/')+'assets/characters/frankie.glb');
const SECTOR_START=Math.PI/2-SOUND_FIELD_ANGLE;
const SECTOR_SPAN=SOUND_FIELD_ANGLE*2;
const BLAST_SECONDS=AUDIO_RULES.cycle-AUDIO_RULES.safe-AUDIO_RULES.warning;
function waveGeometry(){
 const geometry=new THREE.RingGeometry(.72,1,48,8,SECTOR_START,SECTOR_SPAN);
 const position=geometry.attributes.position,colors=[];
 const red=new THREE.Color(0xff2929),crest=new THREE.Color(0xff9a88);
 for(let i=0;i<position.count;i++){
  const t=THREE.MathUtils.clamp((Math.hypot(position.getX(i),position.getY(i))-.72)/.28,0,1);
  const alpha=Math.sin(t*Math.PI);
  const color=red.clone().lerp(crest,t);
  colors.push(color.r,color.g,color.b,alpha);
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
 return geometry;
}
export function setupAudioStage(scene,{loadFrankie=loadFrankieGltf}={}){
 const panel=document.querySelector('#audio-panel'),cards=document.querySelector('#speaker-states');
 const progress=document.querySelector('#chase-progress'),feedback=document.querySelector('#chase-feedback');
 const countdown=document.querySelector('#audio-countdown'),countdownNumber=document.querySelector('#audio-countdown-number');
 const steps=CHASE_STAGES.map((stage,i)=>{const card=document.createElement('span');card.textContent=`${i+1}. ${stage.name}`;progress.append(card);return card;});
 const zones=SPEAKERS.map((s,index)=>{
  const group=new THREE.Group();scene.add(group);
  bindLayout('speaker-'+index,s.name,group,new THREE.Vector3(s.x,s.y,s.z),blockId(12));
  const speaker=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.6),new THREE.MeshStandardMaterial({color:0x494358}));speaker.position.set(s.x,s.y+.6,s.z-1.5);group.add(speaker);
  const cone=new THREE.Mesh(new THREE.TorusGeometry(.21,.06,8,24),new THREE.MeshStandardMaterial({color:0xd8d0e9}));cone.position.set(s.x,s.y+.7,s.fieldZ);group.add(cone);
  const field=new THREE.Mesh(new THREE.CircleGeometry(1,48,SECTOR_START,SECTOR_SPAN),
   new THREE.MeshBasicMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  field.name='SoundFieldFill';field.rotation.x=Math.PI/2;field.position.set(s.x,s.y+.03,s.fieldZ);
  field.scale.set(s.fieldWidth,s.fieldDepth,1);field.visible=false;group.add(field);
  const card=document.createElement('span');cards.append(card);
  const geometry=waveGeometry();
  const waves=[0,1,2].map(()=>{
   const wave=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false}));
   wave.name='SoundFieldWave';wave.rotation.x=Math.PI/2;wave.position.set(s.x,s.y+.055,cone.position.z);
   wave.visible=false;group.add(wave);return wave;
  });
  return {field,cone,card,waves};
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
  const ready=active&&m.audio.readyRemaining>0;
  if(countdown){
   countdown.hidden=!ready;
   const number=ready&&m.audio.readyRemaining<=WAVE_COUNTDOWN_SECONDS?String(Math.ceil(m.audio.readyRemaining)):'';
   if(countdownNumber.textContent!==number)countdownNumber.textContent=number;
   countdownNumber.hidden=!number;
  }
  document.querySelector('#audio-objective').textContent=audioObjective(m.audio);
  feedback.hidden=!active||ready||!m.audio.feedback;feedback.textContent=m.audio.feedback;
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
  targetRing.visible=active&&!ready&&!m.audio.carrying;
  targetRing.position.set(m.audio.target.x,m.audio.target.y+.08,m.audio.target.z);
  targetRing.material.opacity=m.audio.waiting?.85:.4;
  zones.forEach(({field,cone,card,waves},i)=>{
   const speaker=SPEAKERS[i],phase=active?m.audio.phase(speaker):'safe';
   const warning=phase==='warning',blast=phase==='blast',remaining=m.audio.remaining(speaker);
   const color=blast?0xf0313f:warning?0xf2b94b:0x55c97d;
   field.visible=active;
   field.material.color.setHex(color);
   field.material.opacity=blast?.56:warning?.35+.18*Math.cos(2*Math.PI*remaining/AUDIO_RULES.warning)**2:.32;
   cone.material.emissive.setHex(warning||blast?color:0);
   waves.forEach((wave,index)=>{
    const progress=((BLAST_SECONDS-remaining)/BLAST_SECONDS-index*.16)/.68;
    wave.visible=blast&&progress>=0&&progress<1;
    if(wave.visible){
     const spread=.08+.92*progress;
     wave.scale.set(speaker.fieldWidth*spread,speaker.fieldDepth*spread,1);
     wave.material.opacity=(1-progress**2)*(.95-index*.16);
    }
   });
   card.textContent=(i===0?'◀':'▶')+' '+SPEAKERS[i].name+' · '+(phase==='safe'?'安全':phase==='warning'?'預警':'音波');
   card.title=SPEAKERS[i].name;
   card.setAttribute('aria-label',SPEAKERS[i].name+' '+(phase==='safe'?'安全':phase==='warning'?'預警':'危險'));
   card.dataset.phase=m.audio.speakersActive?phase:'idle';
  });
  remote.visible=active||!behind;remote.rotation.y=m.audio.elapsed;
  if(complete)remote.position.set(CONSOLE.x,CONSOLE.y+.95,CONSOLE.z-.8);
  else if(m.audio.carrying)remote.position.set(p.x+.45,p.y+1.5,p.z);
  else if(m.audio.waiting)remote.position.set(m.audio.frankieX,position.y+.65,position.z);
  else remote.position.set(m.audio.frankieX+.6,position.y+2,position.z-.5);
 };
}
