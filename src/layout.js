export const LAYOUT_KEY='pudding-cat-stage-layout-depth-v2';
export const editingLayout=typeof location!=='undefined'&&new URLSearchParams(location.search).get('edit')==='1';
export const BACKSTAGE_Z=-6;
export const depthDistance=(a,b)=>Math.abs((a.z??0)-(b.z??0));
const zero={x:0,y:0,z:0};

export function parseLayout(text){
 const file=JSON.parse(text);
 if(file?.version!==1||!file.offsets||typeof file.offsets!=='object'||Array.isArray(file.offsets))throw new Error('這不是有效的舞台布局檔。');
 const entries=Object.entries(file.offsets);
 if(entries.length>200)throw new Error('布局物件數量超過上限。');
 for(const [id,offset] of entries){
  if(!/^[a-z][a-z0-9-]{0,45}$/.test(id)||!['x','y','z'].every(axis=>Number.isFinite(offset?.[axis])&&Math.abs(offset[axis])<=80)){
   throw new Error('布局包含無效座標。');
  }
 }
 return Object.fromEntries(entries.map(([id,{x,y,z}])=>[id,{x,y,z:id.startsWith('set-')?z:0}]));
}

export const serializeLayout=offsets=>JSON.stringify({version:1,offsets},null,2);
export const defaultLayout=Object.freeze({
 "set-curtain-right":{x:0.3,y:0,z:0},
 "speaker-0":{x:-4.5,y:0,z:0},
 "block-4":{x:-3.8,y:0,z:0},
 "block-5":{x:-3.9,y:0,z:0},
 "block-6":{x:-3.75,y:0,z:0},
 "speaker-1":{x:-3.15,y:0,z:0},
 "block-8":{x:4.75,y:0,z:0},
 "block-7":{x:-3.45,y:0,z:0},
 "set-curtain-left":{x:0.25,y:0,z:0}
});
export const savedLayout=(()=>{
 try{return parseLayout(localStorage.getItem(LAYOUT_KEY)??serializeLayout(defaultLayout));}catch{return defaultLayout;}
})();
export const blockId=index=>`block-${index}`;
export function offsetFor(id,parent,layout=savedLayout){
 const own=Object.hasOwn(layout,id)?layout[id]:zero;
 const base=Object.hasOwn(layout,parent)?layout[parent]:zero;
 return {x:own.x+base.x,y:own.y+base.y,z:own.z+base.z};
}
export function layoutPoint(id,point,parent){
 const offset=offsetFor(id,parent);
 return {...point,x:point.x+offset.x,y:point.y+offset.y,z:(point.z??0)+offset.z};
}

export const editorObjects=new Map();
export const layoutFollowers=[];
// Objects are built at their saved positions. Editor deltas are applied on top.
export function bindLayout(id,label,root,pivot,parent){
 if(editingLayout)editorObjects.set(id,{id,label,root,pivot,parent,initial:root.position.clone()});
}
export function followLayout(id,root,parent){
 if(editingLayout)layoutFollowers.push({id,root,parent,initial:root.position.clone()});
}

export const BABY=layoutPoint('baby',{x:-12,y:0},blockId(0));
export const GIRL=layoutPoint('girl',{x:-1.3,y:0},blockId(0));
