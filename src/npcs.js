import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export const characters = [
 {name:'佳音寶寶',x:-12,file:'jiayin-baby.glb',task:'舞台道具任務',text:'歡迎來到舞台！我們先認識一下，之後再一起準備演出。'},
 {name:'佳音女寶寶',x:-8.5,file:'jiayin-girl.glb',task:'燈光任務',text:'嗨，布丁貓！先自由逛逛吧，燈光任務還在準備中。'},
 {name:'法蘭奇',x:-.8,task:'音響任務',text:'這裡預留給法蘭奇。角色模型尚未提供，可在此接受音響試玩任務。'}
];
export function nearestCharacter(p, list=characters){
 if(!p.grounded)return null;
 return list.filter(n=>Math.abs(p.x-n.x)<1.5 && Math.abs((p.y??0)-(n.y??0))<.8).sort((a,b)=>Math.abs(p.x-a.x)-Math.abs(p.x-b.x))[0]??null;
}
export function setupNpcs(scene,getPlayer,pause,missionUi){
 const dialog=document.querySelector('#conversation'),prompt=document.querySelector('#interaction');
 let active=null;const visited=new Set();
 let previousCards="";
 function refresh(){const signature=characters.map(n=>missionUi?.status(n)??"待確認").join()+[...visited].join();if(signature===previousCards)return;previousCards=signature;document.querySelector('#missions').replaceChildren(...characters.map(n=>{const card=document.createElement('li');card.textContent=`${n.name} · ${n.task}：${missionUi?.status(n)??"待確認"}${visited.has(n.name)?' · 已交談':''}${n.file?'':' · 模型待提供'}`;return card;}));}
 for(const n of characters){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff9e9';ctx.fillRect(0,0,512,128);ctx.fillStyle='#353047';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText(n.name+(n.file?'':' · 預留位置'),256,76);
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas)}));label.scale.set(2.3,.575,1);label.position.set(n.x,2.6,-.7);scene.add(label);
  if(!n.file){const sign=new THREE.Mesh(new THREE.BoxGeometry(.08,1.7,.08),new THREE.MeshStandardMaterial({color:0x89674a}));sign.position.set(n.x,.85,-.7);scene.add(sign);continue;}
  new GLTFLoader().load(import.meta.env.BASE_URL+'assets/characters/'+n.file,g=>{
   const model=g.scene;model.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(model);model.scale.setScalar(1.8/box.getSize(new THREE.Vector3()).y);model.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(model);const center=box.getCenter(new THREE.Vector3());model.position.set(n.x-center.x,-box.min.y,-.7-center.z);scene.add(model);
  },undefined,()=>{n.text='角色模型載入失敗，請重新整理。任務內容仍待確認。';label.material.color.set(0xffa080);});
 }
 function open(){if(dialog.open)return;active=nearestCharacter(getPlayer());if(!active)return;pause(true);document.querySelector('#speaker').textContent=active.name;document.querySelector('#speech').textContent=active.text;document.querySelector('#task-name').textContent=active.task+' · 內容、計時與計分待確認';const info=missionUi?.dialog(active);const action=document.querySelector('#mission-action');action.hidden=!info?.action;if(info){document.querySelector('#speech').textContent=info.text;document.querySelector('#task-name').textContent=info.task;action.textContent=info.label??'';action.onclick=()=>{const run=info.action;close();run();};}visited.add(active.name);refresh();dialog.showModal();document.querySelector('#close-dialog').focus();}
 function close(){pause(false);dialog.close();}
 document.querySelector('#close-dialog').onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('close',()=>{pause(false);active=null;});
 addEventListener('keydown',e=>{if(e.code==='KeyE'&&!e.repeat){e.preventDefault();open();}});
 prompt.onclick=open;refresh();
 return ()=>{refresh();const n=nearestCharacter(getPlayer());prompt.hidden=!n||dialog.open;prompt.textContent=n?'按 E 與'+n.name+'互動':'';};
}
