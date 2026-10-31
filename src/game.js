import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {blocks,player,step} from './physics.js';
import './game.css';
const host=document.querySelector('#game'),status=document.querySelector('#status');
const scene=new THREE.Scene();scene.background=new THREE.Color('#f9f0dc');
const camera=new THREE.PerspectiveCamera(36,1,.1,120);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
renderer.outputColorSpace=THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xffffff,0xbda5a0,2.5));
const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-5,10,8);scene.add(light);
for(const [i,b] of blocks.entries()){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(b.w,b.h,2.6),new THREE.MeshStandardMaterial({color:i<2?0x8db5a3:0xe4ae65,roughness:.85}));mesh.position.set(b.x,b.y,0);scene.add(mesh);
}
const star=new THREE.Mesh(new THREE.OctahedronGeometry(.45),new THREE.MeshStandardMaterial({color:0xffc63e,emissive:0xa65d00,emissiveIntensity:.3}));star.position.set(13,1.6,0);scene.add(star);
const actor=new THREE.Group();scene.add(actor);let ready=false,p=player(),queuedJump=false,finished=false;
const keys=new Set();
function reset(){p=player();queuedJump=false;finished=false;status.textContent=ready?'走到右側星星旁，試試跳過障礙！':'正在準備布丁貓…';}
document.querySelector('#reset').onclick=reset;
addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)queuedJump=true;if(e.code==='KeyR')reset();});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();queuedJump=false;});
document.addEventListener('visibilitychange',()=>{keys.clear();queuedJump=false;});
new GLTFLoader().load(import.meta.env.BASE_URL+'assets/characters/pudding-cat.glb',g=>{
 const model=g.scene;model.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(model);model.scale.setScalar(1.25/box.getSize(new THREE.Vector3()).y);model.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(model);const center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-center.z);actor.add(model);ready=true;reset();
},undefined,()=>{status.textContent='角色載入失敗，請重新整理頁面再試。';});
function resize(){camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);}
new ResizeObserver(resize).observe(host);
let previous=performance.now(),accumulator=0;
function frame(now){requestAnimationFrame(frame);accumulator+=Math.min((now-previous)/1000,.05);previous=now;
 while(accumulator>=1/120){
  if(ready){const dir=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));if(step(p,dir,queuedJump,1/120))reset();queuedJump=false;if(dir)actor.rotation.y=dir>0?Math.PI/2:-Math.PI/2;}
  accumulator-=1/120;
 }
 actor.position.set(p.x,p.y,0);
 const focus=THREE.MathUtils.clamp(p.x,-9,10);camera.position.set(focus+4,6.5,12);camera.lookAt(focus,1,0);
 if(ready&&p.x>12&&!finished){finished=true;status.textContent='暖身完成！你已跨越舞台。按 R 再來一次。';}
 star.rotation.y+=.012;renderer.render(scene,camera);
}requestAnimationFrame(frame);
