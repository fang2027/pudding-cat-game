import * as THREE from 'three';
import {PADS} from './lights.js';
export function setupLightStage(scene){
 const panel=document.querySelector('#light-panel'),hint=document.querySelector('#light-hint');
 const cards=PADS.map(p=>{
  const card=document.createElement('span');card.textContent=p.name;card.style.setProperty('--pad-color','#'+p.color.toString(16));panel.querySelector('.light-cards').append(card);return card;
 });
 const lamps=PADS.map(p=>{
  const material=new THREE.MeshStandardMaterial({color:p.color,emissive:p.color,emissiveIntensity:.04});
  const pad=new THREE.Mesh(new THREE.BoxGeometry(1,.07,1.8),material);pad.position.set(p.x,p.y+.035,0);scene.add(pad);
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#302c45';ctx.font='bold 88px sans-serif';ctx.textAlign='center';ctx.fillText(p.id,64,98);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.6,.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,side:THREE.DoubleSide}));
  label.rotation.x=-Math.PI/2;label.position.set(p.x,p.y+.08,.3);scene.add(label);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),material);lamp.position.set(p.x,3.5,-1.3);scene.add(lamp);
  return material;
 });
 const glow=new THREE.PointLight(0xffe5bb,0,18);glow.position.set(-6,6,2);scene.add(glow);
 return m=>{
  const active=m.activeId==='lights',complete=m.records.lights.state==='complete';
  panel.hidden=!active;
  hint.textContent=m.lights.stage==='demo'?'觀看示範 · 記住亮起順序':'輪到你了 · 已踩 '+m.lights.progress+' / 3（先離開腳下踏板，再依序踩踏）';
  PADS.forEach((p,i)=>{
   const lit=active&&m.lights.litPad===p.id;
   lamps[i].emissiveIntensity=lit?2.5:complete?.7:.04;
   cards[i].classList.toggle('lit',lit);
   cards[i].textContent=p.name+(lit?' ● 亮起':'');
  });
  glow.intensity=complete?12:0;
 };
}
