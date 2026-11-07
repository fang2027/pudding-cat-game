import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {baseBlocks} from './physics.js';
import {blockId,editorObjects,layoutFollowers,offsetFor,savedLayout,defaultLayout,parseLayout,serializeLayout,LAYOUT_KEY} from './layout.js';

const axes=['x','y','z'];
const limit=value=>THREE.MathUtils.clamp(Math.round(value*100)/100,-80,80);

export function setupLayoutEditor(scene,camera,canvas){
 const panel=document.querySelector('#layout-editor');
 panel.hidden=false;
 document.body.classList.add('editing-layout');
 const find=id=>document.querySelector('#'+id);
 const menu=find('layout-object'),message=find('layout-message');
 const inputs=axes.map(axis=>find('layout-'+axis));
 const undoButton=find('layout-undo'),redoButton=find('layout-redo');
 let draft=structuredClone(savedLayout),selected=null,dragStart=null;
 const undo=[],redo=[];
 const orbit=new OrbitControls(camera,canvas);
 orbit.target.set(1,2.4,-3);
 camera.position.set(8,16,36);
 orbit.update();
 const pivot=new THREE.Object3D();
 scene.add(pivot);
 const gizmo=new TransformControls(camera,canvas);
 gizmo.setSize(.9);
 gizmo.setTranslationSnap(.05);
 scene.add(gizmo.getHelper());
 const outline=new THREE.BoxHelper(undefined,0xffd26b);
 outline.visible=false;
 scene.add(outline);
 const roots=new Map();
 for(const item of editorObjects.values()){
  roots.set(item.root,item);
  menu.add(new Option(item.label,item.id));
 }
 function position(item){
  const before=offsetFor(item.id,item.parent,savedLayout),after=offsetFor(item.id,item.parent,draft);
  return item.pivot.clone().add(new THREE.Vector3(after.x-before.x,after.y-before.y,after.z-before.z));
 }
 function refreshFields(){
  if(!selected)return;
  inputs.forEach((input,index)=>{input.value=pivot.position[axes[index]].toFixed(2);});
 }
 function warnUnsupported(){
  const blocks=baseBlocks.map((block,index)=>{
   const offset=offsetFor(blockId(index),undefined,draft);
   return {...block,x:block.x+offset.x,y:block.y+offset.y};
  });
  const unsupported=[];
  for(const item of editorObjects.values()){
   if(!/^(spawn|baby|girl|console|pad-|prop-|speaker-)/.test(item.id))continue;
   const point=position(item);
   const x=point.x,y=point.y-(item.id.startsWith('prop-') ? .65 : 0);
   const supported=blocks.some(block=>Math.abs(point.z-block.z)<block.d/2&&Math.abs(x-block.x)<block.w/2&&Math.abs(y-(block.y+block.h/2))<.13);
   const obstructed=blocks.some(block=>!block.oneWay&&Math.abs(point.z-block.z)<block.d/2&&Math.abs(x-block.x)<block.w/2&&y<block.y+block.h/2-.03&&y+.8>block.y-block.h/2);
   if(!supported||obstructed)unsupported.push(item.label);
  }
  const girl=position(editorObjects.get('girl'));
  const overlapping=[...editorObjects.values()].filter(item=>item.id.startsWith('pad-')).some(item=>{
   const pad=position(item);
   return Math.abs(girl.z-pad.z)<.9&&Math.abs(girl.x-pad.x)<.5&&Math.abs(girl.y-pad.y)<.12;
  });
  const warnings=[];
  if(unsupported.length)warnings.push('檢查落腳位置：'+unsupported.join('、'));
  if(overlapping)warnings.push('女寶寶前的預備站位踩到踏板');
  message.textContent=warnings.join('。')||'布局可試玩。移動平台後請檢查跳躍距離。';
 }
 function sync({movePivot=true}={}){
  for(const item of [...editorObjects.values(),...layoutFollowers]){
   const before=offsetFor(item.id,item.parent,savedLayout),after=offsetFor(item.id,item.parent,draft);
   item.root.position.copy(item.initial).add(new THREE.Vector3(after.x-before.x,after.y-before.y,after.z-before.z));
  }
  if(selected){
   if(movePivot)pivot.position.copy(position(selected));
   outline.setFromObject(selected.root);
   refreshFields();
  }
  undoButton.disabled=!undo.length;
  redoButton.disabled=!redo.length;
  warnUnsupported();
 }
 function select(item){
  selected=item;
  menu.value=item.id;
  pivot.position.copy(position(item));
  gizmo.showZ=item.id.startsWith('set-');
  inputs[2].disabled=!gizmo.showZ;
  gizmo.attach(pivot);
  outline.visible=true;
  outline.setFromObject(item.root);
  refreshFields();
 }
 function remember(previous){
  if(JSON.stringify(previous)===JSON.stringify(draft))return;
  undo.push(previous);
  if(undo.length>60)undo.shift();
  redo.length=0;
 }
 function moveSelected(world){
  const old=offsetFor(selected.id,undefined,savedLayout);
  const previousParent=offsetFor(selected.parent,undefined,savedLayout);
  const parent=offsetFor(selected.parent,undefined,draft);
  draft[selected.id]=Object.fromEntries(axes.map(axis=>{
   const base=selected.pivot[axis]-old[axis]-previousParent[axis];
   return [axis,axis==='z'&&!gizmo.showZ?0:limit(world[axis]-base-parent[axis])];
  }));
 }
 gizmo.addEventListener('dragging-changed',event=>{orbit.enabled=!event.value;});
 gizmo.addEventListener('mouseDown',()=>{dragStart=structuredClone(draft);});
 gizmo.addEventListener('objectChange',()=>{
  if(!selected||!dragStart)return;
  moveSelected(pivot.position);
  sync({movePivot:false});
 });
 gizmo.addEventListener('mouseUp',()=>{
  if(!dragStart)return;
  remember(dragStart);
  dragStart=null;
  sync();
 });
 menu.onchange=()=>select(editorObjects.get(menu.value));
 inputs.forEach((input,index)=>{
  const commit=()=>{
   if(!selected||!Number.isFinite(input.valueAsNumber)){refreshFields();return;}
   const next=position(selected);
   if(Math.abs(next[axes[index]]-input.valueAsNumber)<.001)return;
   const previous=structuredClone(draft);
   next[axes[index]]=input.valueAsNumber;
   moveSelected(next);
   remember(previous);
   sync();
  };
  input.onchange=commit;
  input.onkeydown=event=>{
   if(event.key!=='Enter')return;
   event.preventDefault();
   commit();
  };
 });
 const ray=new THREE.Raycaster();
 let pointer=null;
 canvas.addEventListener('pointerdown',event=>{
  pointer=event.button===0&&!gizmo.dragging?{x:event.clientX,y:event.clientY}:null;
 });
 canvas.addEventListener('pointerup',event=>{
  if(!pointer)return;
  const from=pointer;pointer=null;
  if(gizmo.dragging||Math.hypot(from.x-event.clientX,from.y-event.clientY)>5)return;
  const rect=canvas.getBoundingClientRect();
  ray.setFromCamera({x:(event.clientX-rect.left)/rect.width*2-1,y:1-(event.clientY-rect.top)/rect.height*2},camera);
  for(const hit of ray.intersectObjects([...roots.keys()],true)){
   let node=hit.object;
   while(node&&!roots.has(node))node=node.parent;
   if(node){select(roots.get(node));return;}
  }
 });
 undoButton.onclick=()=>{
  if(!undo.length)return;
  redo.push(draft);draft=undo.pop();sync();
 };
 redoButton.onclick=()=>{
  if(!redo.length)return;
  undo.push(draft);draft=redo.pop();sync();
 };
 find('layout-default').onclick=()=>{
  const previous=draft;draft=structuredClone(defaultLayout);remember(previous);sync();
 };
 find('layout-export').onclick=()=>{
  const url=URL.createObjectURL(new Blob([serializeLayout(draft)],{type:'application/json'}));
  const download=document.createElement('a');
  download.href=url;download.download='pudding-stage-layout.json';download.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const fileInput=find('layout-import');
 fileInput.onchange=async ()=>{
  const file=fileInput.files[0];fileInput.value='';
  if(!file)return;
  try{
   if(file.size>100000)throw new Error('布局檔太大。');
   const parsed=parseLayout(await file.text());
   const previous=draft;
   draft=Object.fromEntries(Object.entries(parsed).filter(([id])=>editorObjects.has(id)));
   remember(previous);sync();
  }catch(error){message.textContent=error instanceof SyntaxError?'無法讀取 JSON 布局。':error.message;}
 };
 function save(){
  try{localStorage.setItem(LAYOUT_KEY,serializeLayout(draft));return true;}
  catch{message.textContent='瀏覽器無法儲存布局。請先匯出 JSON 保留修改。';return false;}
 }
 find('layout-save').onclick=()=>{if(save())message.textContent='已儲存到這個瀏覽器。';};
 find('layout-play').onclick=()=>{
  if(!save())return;
  const url=new URL(location.href);
  url.searchParams.delete('edit');
  location.href=url.href;
 };
 select(editorObjects.get('spawn'));
 sync();
 return ()=>orbit.update();
}
