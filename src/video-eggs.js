import * as THREE from 'three';
import {BACKSTAGE_Z,blockId,depthDistance,layoutPoint} from './layout.js';
import {CONSOLE} from './audio-mission.js';

const screen=layoutPoint('set-screen',{x:-5.9,y:4.4,z:BACKSTAGE_Z},blockId(11));
const videos=[
 {title:'布丁貓的秘密練習',id:'1409348563054902',point:screen,unlocked:m=>m.records.lights.state==='complete'},
 {title:'法蘭奇的安可點播・貓狗武林夢',id:'1042574017692163',point:{...CONSOLE,x:CONSOLE.x-2},unlocked:m=>m.records.audio.state==='complete'}
];

export function setupVideoEasterEggs(scene,mission,getPlayer,clearInput){
 const dialog=document.querySelector('#video-egg');
 const prompt=document.querySelector('#video-prompt');
 const title=document.querySelector('#video-title');
 const close=document.querySelector('#video-close');
 const source=document.querySelector('#video-source');
 const frame=document.querySelector('#video-frame');
 const markers=videos.map(({point},index)=>{
  const shape=new THREE.Shape();
  const sides=index===0?3:10;
  for(let i=0;i<sides;i++){
   const angle=i*2*Math.PI/sides+(index===0?0:Math.PI/2);
   const radius=index===1&&i%2?.15:.31;
   shape[i===0?'moveTo':'lineTo'](Math.cos(angle)*radius,Math.sin(angle)*radius);
  }
  shape.closePath();
  const marker=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:index===0?0x9df5e5:0xffd36c,side:THREE.DoubleSide}));
  marker.position.set(point.x,point.y+1.25,point.z-.65);
  marker.visible=false;
  scene.add(marker);
  return marker;
 });

 function nearby(){
  const p=getPlayer();
  if(!p?.grounded||mission.activeId||dialog.open)return null;
  return videos.find(({point,unlocked})=>unlocked(mission)&&Math.abs(p.x-point.x)<1&&Math.abs(p.y-point.y)<.4&&depthDistance(p,point)<1)??null;
 }

 function open(clip){
  const url='https://www.facebook.com/joyteachers/videos/'+clip.id+'/';
  clearInput();
  title.textContent=clip.title;
  source.href=url;
  frame.title=clip.title;
  dialog.showModal();
  frame.src='https://www.facebook.com/plugins/video.php?href='+encodeURIComponent(url)+'&show_text=0&width=560';
  close.focus();
 }

 close.onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{
  frame.removeAttribute('src');
  clearInput();
 });
 prompt.onclick=()=>{const clip=nearby();if(clip)open(clip);};
 addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.repeat||event.code!=='KeyE')return;
  const clip=nearby();
  if(clip){event.preventDefault();open(clip);}
 });

 return {
  get open(){return dialog.open;},
  update(behind,visible){
   const clip=nearby();
   prompt.hidden=!clip;
   if(clip)prompt.textContent='按 E 觀看・'+clip.title;
   markers.forEach((marker,index)=>{marker.visible=visible&&videos[index].unlocked(mission)&&(index===0?behind:!behind);});
  }
 };
}
