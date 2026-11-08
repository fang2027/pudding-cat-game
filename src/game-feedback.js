import * as THREE from 'three';

export function setupGameFeedback(scene,canvas){
 const projected=new THREE.Vector3();
 const haloGeometry=new THREE.RingGeometry(.39,.49,32);
 const effects=[];
 let audio=null;
 function enableAudio(){
  if(!globalThis.AudioContext)return;
  try{
   audio??=new AudioContext();
   if(audio.state!=='running')audio.resume().catch(()=>{});
  }catch{}
 }
 addEventListener('pointerdown',enableAudio,{once:true});
 addEventListener('keydown',enableAudio,{once:true});

 return {
  pickup(mesh,target){
   const root=mesh.clone();
   root.material=mesh.material.clone();
   root.material.depthTest=false;
   root.material.depthWrite=false;
   root.visible=true;
   root.renderOrder=10;
   const origin=mesh.getWorldPosition(new THREE.Vector3());
   scene.add(root);
   effects.push({root,material:root.material,time:0,duration:.48,origin,target});
  },
  pad(point){
   const material=new THREE.MeshBasicMaterial({color:point.color,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
   const root=new THREE.Mesh(haloGeometry,material);
   root.position.set(point.x,point.y+.095,point.z);
   root.rotation.x=-Math.PI/2;
   scene.add(root);
   effects.push({root,material,time:0,duration:.38});
  },
  success(){
   if(audio?.state!=='running')return;
   const start=audio.currentTime;
   [523.25,659.25,783.99].forEach((frequency,i)=>{
    const when=start+i*.075;
    const tone=audio.createOscillator(),gain=audio.createGain();
    tone.type='sine';tone.frequency.value=frequency;
    gain.gain.setValueAtTime(.001,when);
    gain.gain.exponentialRampToValueAtTime(.11,when+.014);
    gain.gain.exponentialRampToValueAtTime(.001,when+.17);
    tone.connect(gain).connect(audio.destination);
    tone.start(when);tone.stop(when+.18);
   });
  },
  update(dt,camera){
   if(!effects.length)return;
   camera.updateMatrixWorld();
   for(let i=effects.length-1;i>=0;i--){
    const effect=effects[i];
    effect.time+=dt;
    const t=Math.min(1,effect.time/effect.duration);
    if(t===1){
     effect.root.removeFromParent();effect.material.dispose();effects.splice(i,1);continue;
    }
    if(effect.target){
     const target=effect.target.getBoundingClientRect();
     const viewport=canvas.getBoundingClientRect();
     if(!target.width||!viewport.width||!viewport.height){effect.root.visible=false;continue;}
     const progress=t*t*(3-2*t);
     projected.copy(effect.origin).project(camera);
     const x=2*(target.left+target.width/2-viewport.left)/viewport.width-1;
     const y=1-2*(target.top+target.height/2-viewport.top)/viewport.height;
     projected.x=THREE.MathUtils.lerp(projected.x,x,progress);
     projected.y=THREE.MathUtils.lerp(projected.y,y,progress)+.12*Math.sin(Math.PI*t);
     effect.root.position.copy(projected.unproject(camera));
     effect.root.rotation.y+=dt*7;
     effect.root.scale.setScalar(THREE.MathUtils.lerp(1,.12,t));
    }else{
     effect.material.opacity=1-t;
     effect.root.scale.setScalar(.8+2.3*t);
    }
   }
  }
 };
}
