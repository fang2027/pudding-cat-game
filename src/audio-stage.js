import * as THREE from 'three';
import {SPEAKERS,REMOTE,CONSOLE} from './audio-mission.js';
export function setupAudioStage(scene){
 const panel=document.querySelector('#audio-panel'),cards=document.querySelector('#speaker-states');
 const zones=SPEAKERS.map(s=>{
  const group=new THREE.Group();scene.add(group);
  const speaker=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.6),new THREE.MeshStandardMaterial({color:0x494358}));speaker.position.set(s.x,.6,-1.5);group.add(speaker);
  const cone=new THREE.Mesh(new THREE.TorusGeometry(.21,.06,8,24),new THREE.MeshStandardMaterial({color:0xd8d0e9}));cone.position.set(s.x,.7,-1.17);group.add(cone);
  const danger=new THREE.Mesh(new THREE.BoxGeometry(s.width,.75,2.4),new THREE.MeshBasicMaterial({color:0xe5636b,transparent:true,opacity:.3,depthWrite:false}));danger.position.set(s.x,.375,0);group.add(danger);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(s.width,.04,2.4),new THREE.MeshBasicMaterial({color:0x65bca0}));floor.position.set(s.x,.02,0);group.add(floor);
  const card=document.createElement('span');cards.append(card);
  const rings=[.3,.48,.66].map(radius=>{
   const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,8,32),new THREE.MeshBasicMaterial({color:0xe5636b}));
   ring.position.set(s.x,.4,0);ring.scale.y=.5;group.add(ring);return ring;
  });
  return {group,danger,floor,card,rings};
 });
 // A moving sign represents Frankie until his original character model is supplied.
 const frankie=new THREE.Group();scene.add(frankie);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#66578e';ctx.fillRect(0,0,512,160);
 ctx.fillStyle='#fff9e9';ctx.textAlign='center';ctx.font='bold 46px sans-serif';ctx.fillText('法蘭奇 →',256,68);
 ctx.font='28px sans-serif';ctx.fillText('遙控器在我這！',256,124);
 const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas)}));
 sign.scale.set(2.6,.81,1);sign.position.set(0,2.8,-.5);frankie.add(sign);
 const pole=new THREE.Mesh(new THREE.BoxGeometry(.07,1.2,.07),new THREE.MeshStandardMaterial({color:0x89674a}));pole.position.set(0,1.8,-.5);frankie.add(pole);
 const remote=new THREE.Group();scene.add(remote);
 const body=new THREE.Mesh(new THREE.BoxGeometry(.35,.65,.2),new THREE.MeshStandardMaterial({color:0x66578e,emissive:0x44335e,emissiveIntensity:.4}));remote.add(body);
 for(let i=0;i<3;i++){const button=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),new THREE.MeshBasicMaterial({color:i===0?0xffbc62:0xffffff}));button.position.set(0,.15-i*.15,.13);remote.add(button);}
 remote.position.set(REMOTE.x,REMOTE.y,0);
 return (m,p)=>{
  const active=m.activeId==='audio',complete=m.records.audio.state==='complete';panel.hidden=!active;
  document.querySelector('#audio-objective').textContent=m.audio.carrying?'遙控器已取得 · 回音控台按 E 交還':m.audio.atEnd?'法蘭奇已到最右端 · 靠近並按 E 拿回遙控器':'追上法蘭奇！他正啟動沿路喇叭 · 黃色預警後才會出現紅色音波';
  frankie.visible=active;
  frankie.position.x=active?m.audio.frankieX:CONSOLE.x;
  zones.forEach(({group,danger,floor,card,rings},i)=>{
   group.visible=active||complete;
   const phase=active?m.audio.phase(SPEAKERS[i]):'safe';
   const color=phase==='blast'?0xe5636b:phase==='warning'?0xf2b94b:0x65bca0;
   floor.material.color.setHex(color);danger.visible=phase==='blast';
   danger.material.opacity=.25+.15*Math.sin(m.audio.elapsed*16)**2;
   rings.forEach((ring,index)=>{ring.visible=phase==='blast';ring.scale.x=1+.15*Math.sin(m.audio.elapsed*12-index);});
   card.textContent=`${SPEAKERS[i].name}：${phase==='safe'?'安全':phase==='warning'?'預警，準備發作':'危險，跳過或等待'} ${active?m.audio.remaining(SPEAKERS[i]).toFixed(1)+' 秒':''}`;
   card.dataset.phase=phase;
  });
  remote.visible=active||complete;remote.rotation.y=m.audio.elapsed;
  if(complete)remote.position.set(CONSOLE.x,.95,-.8);
  else if(m.audio.carrying)remote.position.set(p.x+.45,p.y+1.5,0);
  else if(m.audio.atEnd)remote.position.set(REMOTE.x,REMOTE.y,0);
  else remote.position.set(m.audio.frankieX+.6,2,-.5);
 };
}
