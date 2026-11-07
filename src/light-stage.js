import {bindLayout,blockId} from './layout.js';
import * as THREE from 'three';
import {PADS,padUnderfoot,LIGHT_ROUNDS,lightObjective} from './lights.js';
export function setupLightStage(scene){
 const panel=document.querySelector('#light-panel'),hint=document.querySelector('#light-hint');
 const countdown=document.querySelector('#light-countdown');
 hint.setAttribute('role','status');
 const rounds=LIGHT_ROUNDS.map((r,i)=>{const card=document.createElement('span');card.textContent=`${i+1}. ${r.name} · ${r.length} 次`;document.querySelector('#light-rounds').append(card);return card;});
 const cards=PADS.map(p=>{
  const card=document.createElement('span');card.textContent=p.name;card.style.setProperty('--pad-color','#'+p.color.toString(16));panel.querySelector('.light-cards').append(card);return card;
 });
 const lamps=PADS.map((p,index)=>{
  const group=new THREE.Group();
  scene.add(group);
  bindLayout('pad-'+p.id.toLowerCase(),'燈光踏板 '+p.id,group,new THREE.Vector3(p.x,p.y,0),blockId([0,2,3][index]));
  const material=new THREE.MeshStandardMaterial({color:p.color,emissive:p.color,emissiveIntensity:.04});
  const pad=new THREE.Mesh(new THREE.BoxGeometry(1,.07,1.8),material);pad.position.set(p.x,p.y+.035,0);group.add(pad);
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#302c45';ctx.font='bold 88px sans-serif';ctx.textAlign='center';ctx.fillText(p.id,64,98);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.6,.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,side:THREE.DoubleSide}));
  label.rotation.x=-Math.PI/2;label.position.set(p.x,p.y+.08,.3);group.add(label);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),material);lamp.position.set(p.x,p.y+([3.5,2.8,2.2][index]),-1.3);group.add(lamp);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.43,.57,32),new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.set(p.x,p.y+.09,0);group.add(ring);
  return {group,material,pad,ring};
 });
 const glow=new THREE.PointLight(0xffe5bb,0,18);glow.position.set(PADS[1].x,6,2);scene.add(glow);
 return (m,player,behind=false)=>{
  const active=m.activeId==='lights',complete=m.records.lights.state==='complete';
  const underfoot=active&&m.lights.stage==='input'?padUnderfoot(player):null,feedback=active?m.lights.feedback:null;
  panel.hidden=!active;
  if(countdown){
   const visible=active&&m.lights.countdown>0;
   countdown.hidden=!visible;
   if(visible){
    document.querySelector('#countdown-round').textContent=`第 ${m.lights.round+1} / ${LIGHT_ROUNDS.length} 回合 · 準備看燈光`;
    document.querySelector('#countdown-number').textContent=m.lights.countdown;
   }
  }
  const objective=lightObjective(m.lights);
  hint.textContent=m.lights.stage==='input'?(feedback?.result==='correct'?`✓ ${feedback.padId} 踩對了！ · `:underfoot?`踏板 ${underfoot.id} 已踩下 · `:'輪到你了 · ')+objective:objective;
  rounds.forEach((card,i)=>{const done=complete||i<m.lights.round||(i===m.lights.round&&m.lights.stage==='round-clear');card.dataset.state=done?'done':i===m.lights.round?'current':'next';card.textContent=`${done?'✓':i+1+'.'} ${LIGHT_ROUNDS[i].name} · ${LIGHT_ROUNDS[i].length} 次`;});
  PADS.forEach((p,i)=>{
   lamps[i].group.visible=!behind;
   const demo=active&&m.lights.stage==='demo';
   const pressed=!demo&&underfoot?.id===p.id;
   const correct=feedback?.padId===p.id&&feedback.result==='correct';
   const lit=demo?m.lights.litPad===p.id:pressed||correct;
   lamps[i].material.emissiveIntensity=lit?2.5:complete?.7:.04;
   lamps[i].pad.position.y=p.y+(pressed?.02:.035);
   lamps[i].ring.material.opacity=correct?.8:pressed?.45:0;
   cards[i].classList.toggle('lit',lit);
   cards[i].classList.toggle('correct',correct);
   cards[i].textContent=p.name+(correct?' ✓ 踩對':pressed?' ● 踩下':lit?' ● 亮起':'');
  });
  glow.intensity=complete?12:0;
 };
}
