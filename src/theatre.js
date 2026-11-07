import {FINALE_CENTER} from './finale.js';
import * as THREE from 'three';
import {baseBlocks} from './physics.js';
import {BACKSTAGE_Z,blockId,bindLayout,offsetFor,editingLayout,followLayout} from './layout.js';

export const CURTAIN_SECONDS = 1.25;

export function setupTheatre(scene){
 const stage=new THREE.Group();
 scene.add(stage);
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:.82});
 const navy=material('#232239'),trim=material('#b58a52'),iron=material('#4e5269');
 const crate=material('#826044'),velvet=material('#83233c'),fold=material('#571c33');
 const wood=['#b88459','#bd8b62','#a97750','#b18057'].map(material);
 const lamp=new THREE.MeshStandardMaterial({color:'#f9c77f',emissive:'#ffa655',emissiveIntensity:.15});
 function box(parent,x,y,z,w,h,d,finish){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),finish);
  mesh.position.set(x,y,z);parent.add(mesh);
  return mesh;
 }
 function section(id,label,pivot,parent){
  const group=new THREE.Group();stage.add(group);
  const offset=offsetFor(id,parent);
  group.position.set(offset.x,offset.y,offset.z);
  bindLayout(id,label,group,new THREE.Vector3(...pivot).add(group.position),parent);
  return group;
 }
 function board(id,text,x,y,z,w,h){
  const canvas=document.createElement('canvas');
  canvas.width=640;canvas.height=144;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#302b45';ctx.fillRect(0,0,640,144);
  ctx.strokeStyle='#dbac73';ctx.lineWidth=5;ctx.strokeRect(9,9,622,126);
  ctx.fillStyle='#ffe4bb';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold 49px system-ui, sans-serif';ctx.fillText(text,320,74);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));
  mesh.position.set(x,y,z);
  const group=section(id,text,[x,y,z]);group.add(mesh);return group;
 }

 // All scenery is behind the lane or follows the existing collision blocks.
 box(stage,1,4.4,-8.85,38,11,.25,navy);
 const frame=section('set-frame','劇場框與外側布幕',[1,4,-3.6]);
 box(frame,1,7.8,-3.6,35,.86,.62,velvet);
 box(frame,1,7.34,-3.25,35,.08,.08,trim);
 for(const x of [-15.5,17.5]){
  box(frame,x,3.5,-3.2,1.5,8,.75,velvet);
  for(const offset of [-.5,0,.5])box(frame,x+offset,3.5,-2.78,.16,8,.15,fold);
 }
 const curtains=[-1,1].map(side=>{
  const pivot=1+side*3.4;
  const curtain=section(side<0?'set-curtain-left':'set-curtain-right',side<0?'左主幕':'右主幕',[pivot,3.55,-3.35]);
  const leaf=new THREE.Group();curtain.add(leaf);
  box(leaf,0,3.55,-3.35,6.8,7.15,.34,velvet);
  for(let i=0;i<13;i++)box(leaf,(i-6)*.51,3.55,-3.13,.16,7.12,.14,fold);
  box(leaf,0,.2,-3.04,6.8,.1,.1,trim);
  return {leaf,side};
 });
 const marquee=board('set-marquee','佳音小劇場',1,7.75,-3.18,4.5,.92);
 const leftSign=board('set-left-sign','側台準備區',-11.6,3.8,-2.45,3.1,.7);
 board('set-back-sign','後台 · 道具與換景區',0,2.5,-8.55,4.1,.8);
 board('set-left-passage','往後台 ↑',-13.2,2.2,-4.95,2.3,.58);
 board('set-right-passage','往後台 ↑',15,2.2,-4.95,2.3,.58);
 const rightSign=board('set-right-sign','音控・換景區',10.5,3.55,-1.65,3.1,.7);
 board('set-upper-sign','2F　燈架工作走道',-3.7,6.15,-8.15,4.1,.84);
 board('set-stairs-sign','由紫色踏階上樓',12.2,4.55,-8.2,3.5,.78);

 const frontPedestals=[];
 baseBlocks.forEach((block,index)=>{
  const {x,y,z,w,h,d,oneWay}=block;
  const top=y+h/2;
  const label=['左側地板','右側地板','B 踏板箱','C 踏板箱','追逐矮箱','換景高箱','換景矮箱','登樓踏階','二樓右平台','二樓中右平台','二樓中左平台','二樓左平台','後台地板','左側通道','右側通道'][index];
  const platform=section(blockId(index),label,[x,y,z]);
  if(index===2||index===3)frontPedestals.push(platform);
  if(editingLayout){
   const bounds=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,d)),new THREE.LineBasicMaterial({color:'#70e5ff'}));
   bounds.position.set(x,y,z);platform.add(bounds);
  }
  if(index>=12){
   // Recess the visible connectors so the overlapping decks never share a plane.
   const recess=index>12?.025:0;
   box(platform,x,y-recess,z,w,h,d,iron);
   for(const side of [-1,1])box(platform,x+side*(w/2-.12),top+.005-recess,z,.08,.01,d,trim);
   if(index>12){
    for(const at of [z-.95,z+.3,z+1.55])for(const side of [-1,1]){
     const arrow=box(platform,x+side*.14,top+.01-recess,at,.085,.014,.44,trim);
     arrow.rotation.y=side*.72;
    }
   }
  }else if(index<2){
   box(platform,x,y-.025,0,w,h-.05,2.6,navy);
   for(let row=0;row<7;row++){
    for(let panel=0;panel<4;panel++){
     const plankX=x-w/2+(panel+.5)*w/4;
     box(platform,plankX,top-.025,-1.3+(row+.5)*2.6/7,w/4-.022,.05,2.6/7-.017,wood[(row+panel*3)%wood.length]);
    }
   }
   box(platform,x,-.28,1.31,w,.07,.06,trim);
   for(let offset=-w/2+.65;offset<w/2;offset+=1.35){
    box(platform,x+offset,.015,1.18,.22,.11,.14,lamp);
   }
  }else if(oneWay){
   box(platform,x,y,z,w,h,d,material('#6b527f'));
   box(platform,x,top-.04,z+d/2,w,.055,.04,trim);
   for(const offset of [-w/2+.08,w/2-.08]){
    box(platform,x+offset,top+.39,z-d/2+.08,.075,.78,.075,iron);
   }
   box(platform,x,top+.72,z-d/2+.08,w,.065,.07,iron);
   box(platform,x,top+.38,z-d/2+.08,w,.05,.06,iron);
  }else{
   box(platform,x,y,z,w,h,d,crate);
   for(const offset of [-w/2+.09,w/2-.09])box(platform,x+offset,y,z+d/2,.12,h,.07,trim);
   box(platform,x,top-.07,z+d/2+.02,w,.09,.06,iron);
   box(platform,x,y,z+d/2+.04,.25,.08,.07,navy);
  }
 });

 // Steel frames support the upper walkways from the rear.
 for(const [index,x] of [-6.3,-.9,6.1,8.2].entries()){
  const truss=section('set-truss-'+index,'桁架 '+(index+1),[x,2.05,BACKSTAGE_Z-1.36],blockId([11,10,8,8][index]));
  for(const offset of [-.15,.15])box(truss,x+offset,2.05,BACKSTAGE_Z-1.36,.065,4.1,.11,iron);
  for(let y=.32;y<4;y+=.47){
   const brace=box(truss,x,y,BACKSTAGE_Z-1.35,.045,.52,.055,trim);
   brace.rotation.z=(Math.round(y/.47)%2?1:-1)*.59;
  }
 }
 for(const [index,x] of [-6,-1,3,7.5].entries()){
  const fixture=section('set-lamp-'+index,'吊燈 '+(index+1),[x,3.88,BACKSTAGE_Z-1.12],blockId([11,10,9,8][index]));
  box(fixture,x,3.88,BACKSTAGE_Z-1.12,.3,.29,.34,iron);
  box(fixture,x,3.84,BACKSTAGE_Z-.93,.19,.14,.07,lamp);
 }
 // Side-stage prop storage and a small projection screen on the catwalk.
 const storage=section('set-storage','側台道具箱',[-13,.34,-1.76],blockId(0));
 box(storage,-13,.34,-1.76,1.2,.68,.68,crate);
 box(storage,-13,.67,-1.76,1.27,.1,.74,trim);
 const screen=section('set-screen','二樓小布幕',[-5.9,5.05,BACKSTAGE_Z-1.67],blockId(11));
 box(screen,-5.9,5.05,BACKSTAGE_Z-1.67,1.25,.79,.08,trim);
 box(screen,-5.9,5.05,BACKSTAGE_Z-1.61,1.12,.66,.04,material('#e4cbae'));
 box(screen,-5.9,4.48,BACKSTAGE_Z-1.07,.42,.15,.28,iron);
 for(const [index,x] of [7.5,9.6,12.1].entries()){
  const flatGroup=section('set-flat-'+index,'換景布景板 '+(index+1),[x,.98,BACKSTAGE_Z-2.05],blockId(12));
  const flat=box(flatGroup,x,.98,BACKSTAGE_Z-2.05,1.05,1.96,.18,material('#385657'));
  flat.rotation.z=-.12;
 }
 const controls=new THREE.Group();stage.add(controls);
 const consoleOffset=offsetFor('console',blockId(1));
 controls.position.set(consoleOffset.x,consoleOffset.y,0);
 followLayout('console',controls,blockId(1));
 const consoleScreen=box(controls,10.5,.97,-1.4,.82,.22,.12,iron);
 consoleScreen.rotation.x=-.3;
 for(const x of [10.24,10.5,10.76])box(controls,x,.91,-.95,.12,.06,.13,lamp);
 const centreLight=new THREE.SpotLight(0xffd8a0,0,28,Math.PI/7,.65,1);
 centreLight.position.set(1,8.6,3.8);
 centreLight.target.position.set(FINALE_CENTER,.15,.82);
 stage.add(centreLight,centreLight.target);
 return (readyToOpen,progress,behind)=>{
  for(const group of [frame,marquee,leftSign,rightSign,controls,...frontPedestals])group.visible=!behind;
  const eased=progress*progress*(3-2*progress);
  for(const {leaf,side} of curtains){
   leaf.visible=!behind;
   leaf.position.x=1+side*(3.4+eased*4.6);
  }
  lamp.emissiveIntensity=readyToOpen?2.1:.15;
  centreLight.intensity=eased*85;
 };
}
