import * as THREE from 'three';
import {SPEAKERS,REMOTE} from './audio-mission.js';
export function setupAudioStage(scene){
 const panel=document.querySelector('#audio-panel'),cards=document.querySelector('#speaker-states');
 const zones=SPEAKERS.map(s=>{
  const group=new THREE.Group();scene.add(group);
  const speaker=new THREE.Mesh(new THREE.BoxGeometry(.7,1.2,.6),new THREE.MeshStandardMaterial({color:0x494358}));speaker.position.set(s.x,.6,-1.5);group.add(speaker);
  const cone=new THREE.Mesh(new THREE.TorusGeometry(.21,.06,8,24),new THREE.MeshStandardMaterial({color:0xd8d0e9}));cone.position.set(s.x,.7,-1.17);group.add(cone);
  const danger=new THREE.Mesh(new THREE.BoxGeometry(s.width,.75,2.4),new THREE.MeshBasicMaterial({color:0xe5636b,transparent:true,opacity:.3,depthWrite:false}));danger.position.set(s.x,.375,0);group.add(danger);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(s.width,.04,2.4),new THREE.MeshBasicMaterial({color:0x65bca0}));floor.position.set(s.x,.02,0);group.add(floor);
  const card=document.createElement('span');cards.append(card);
  return {group,danger,floor,card};
 });
 const remote=new THREE.Group();scene.add(remote);
 const body=new THREE.Mesh(new THREE.BoxGeometry(.35,.65,.2),new THREE.MeshStandardMaterial({color:0x66578e,emissive:0x44335e,emissiveIntensity:.4}));remote.add(body);
 for(let i=0;i<3;i++){const button=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),new THREE.MeshBasicMaterial({color:i===0?0xffbc62:0xffffff}));button.position.set(0,.15-i*.15,.13);remote.add(button);}
 remote.position.set(REMOTE.x,REMOTE.y,0);
 return m=>{
  const active=m.activeId==='audio',complete=m.records.audio.state==='complete';panel.hidden=!active;
  document.querySelector('#audio-objective').textContent=m.audio.carrying?'遙控器已取得 · 回法蘭奇處交還':'前往舞台最右端取回遙控器 · 可等待綠色或跳過紅色低音波';
  zones.forEach(({group,danger,floor,card},i)=>{
   group.visible=active||complete;
   const phase=active?m.audio.phase(SPEAKERS[i]):'safe';
   const color=phase==='blast'?0xe5636b:phase==='warning'?0xf2b94b:0x65bca0;
   floor.material.color.setHex(color);danger.visible=phase==='blast';
   danger.material.opacity=.25+.15*Math.sin(m.audio.elapsed*16)**2;
   card.textContent=`${SPEAKERS[i].name}：${phase==='safe'?'安全':phase==='warning'?'預警，準備發作':'危險，跳過或等待'} ${active?m.audio.remaining(SPEAKERS[i]).toFixed(1)+' 秒':''}`;
   card.dataset.phase=phase;
  });
  remote.visible=active&&!m.audio.carrying;remote.rotation.y=m.audio.elapsed;
 };
}
