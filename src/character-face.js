export function createFace(model, keys, blinkKey, offset=0){
 const bindings=[];
 model.traverse(mesh=>{
  for(const [expression,name] of Object.entries({...keys,blink:blinkKey})){
   const index=mesh.morphTargetDictionary?.[name];
   if(index!==undefined)bindings.push({expression,index,weights:mesh.morphTargetInfluences});
  }
 });
 let time=offset;
 return (dt,pose={},direct={})=>{
  time+=dt;
  const blink=Math.max(0,1-Math.abs(time%4.3-3.9)/.12);
  const blend=1-Math.exp(-dt*18);
  for(const {expression,index,weights} of bindings){
   const target=expression==='blink'?blink:pose[expression]??0;
   weights[index]=direct[expression]??(weights[index]+(target-weights[index])*blend);
  }
 };
}

export const babyFace=(model,offset)=>createFace(model,{smile:'笑瞇',mouth:'A',surprise:'嚇嘴',worry:'哭嘴',worriedEyes:'哭眼'},'嚇瞇',offset);
