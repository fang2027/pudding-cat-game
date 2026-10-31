import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {blocks,player,step} from './physics.js';
import './game.css';
import {setupNpcs} from './npcs.js';
import {Mission,RULES} from './mission.js';
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
const star=new THREE.Mesh(new THREE.OctahedronGeometry(.45),new THREE.MeshStandardMaterial({color:0xffc63e,emissive:0xa65d00,emissiveIntensity:.3}));star.position.set(RULES.propX,.9,0);scene.add(star);
const actor=new THREE.Group();scene.add(actor);let ready=false,p=player(),queuedJump=false;
const keys=new Set();let paused=false;
const mission=new Mission();
const result=document.querySelector('#result');
function clearInput(){keys.clear();queuedJump=false;}
function respawn(){p=player();clearInput();}
function showResult(outcome){if(!outcome)return;clearInput();document.querySelector('#result-title').textContent=outcome.title;document.querySelector('#result-text').textContent=outcome.text;document.querySelector('#result-close').hidden=mission.phase==='gameover';document.querySelector('#restart-game').hidden=mission.phase!=='gameover';result.showModal();}
document.querySelector('#result-close').onclick=()=>result.close();
result.addEventListener('close',clearInput);
result.addEventListener('cancel',e=>{if(mission.phase==='gameover')e.preventDefault();});
document.querySelector('#restart-game').onclick=()=>{mission.restart();respawn();result.close();};
function reset(){if(!ready)return;if(mission.phase==='gameover'){showResult({title:'本場結束',text:'請重新開始。'});return;}if(mission.phase==='active'){showResult(mission.fail('返回起點：本次任務失敗'));}respawn();}
const updateNpcs=setupNpcs(scene,()=>ready&&!result.open&&mission.phase!=='gameover'?p:{x:0,grounded:false},value=>{if(paused===value)return;paused=value;clearInput();},{
 status:n=>n.name!=='佳音寶寶'?'待確認':mission.phase==='complete'?`已完成 · ${mission.score} 分`:mission.phase==='active'?(mission.carrying?'請交還道具':'取回道具中'):mission.phase==='gameover'?'本場結束':'可接受任務',
 dialog:n=>{
  if(n.name!=='佳音寶寶')return {text:n.text,task:n.task+' · 內容待確認'};
  if(mission.phase==='complete')return {text:'謝謝你幫忙！這項任務已完成。',task:`本項 ${mission.score} 分；另外兩項任務待開放。`};
  if(mission.phase==='active')return {text:mission.carrying?'你找到道具了！交給我吧。':'道具在右側星星的位置，拿到後記得帶回來！',task:`剩餘 ${Math.ceil(mission.remaining)} 秒 · 對話期間暫停計時`,label:'交還道具',action:mission.carrying?()=>showResult(mission.finish(p)):undefined};
  return {text:'請跨越舞台的障礙，拿到最右側的星星道具，再回來交給我！',task:`測試規則：${RULES.seconds} 秒；完成 ${RULES.baseScore} 分＋每剩餘秒 ${RULES.perSecond} 分。掉落、超時或任務中按 R，扣一次失誤機會。`,label:'接受任務，開始計時',action:()=>{mission.start();clearInput();}};
 }
});
document.querySelector('#reset').onclick=reset;
addEventListener('keydown',e=>{if(paused||result.open||mission.phase==='gameover')return;if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)queuedJump=true;if(e.code==='KeyR'&&!e.repeat)reset();});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();queuedJump=false;});
document.addEventListener('visibilitychange',()=>{clearInput();previous=performance.now();accumulator=0;});
new GLTFLoader().load(import.meta.env.BASE_URL+'assets/characters/pudding-cat.glb',g=>{
 const model=g.scene;model.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(model);model.scale.setScalar(1.25/box.getSize(new THREE.Vector3()).y);model.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(model);const center=box.getCenter(new THREE.Vector3());model.position.set(-center.x,-box.min.y,-center.z);actor.add(model);ready=true;respawn();
},undefined,()=>{status.textContent='角色載入失敗，請重新整理頁面再試。';});
function resize(){camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);}
new ResizeObserver(resize).observe(host);
let previous=performance.now(),accumulator=0;
function frame(now){requestAnimationFrame(frame);const wallDelta=(now-previous)/1000;accumulator+=Math.min(wallDelta,.05);previous=now;
 if(ready&&!paused&&!result.open&&!document.hidden){const outcome=mission.tick(wallDelta);if(outcome){respawn();showResult(outcome);}}
 while(accumulator>=1/120){
  if(ready&&!paused&&!result.open&&!document.hidden&&mission.phase!=='gameover'){const dir=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));if(step(p,dir,queuedJump,1/120)){showResult(mission.fail('掉下舞台了'));respawn();}mission.collect(p);queuedJump=false;if(dir)actor.rotation.y=dir>0?Math.PI/2:-Math.PI/2;}
  accumulator-=1/120;
 }
 actor.position.set(p.x,p.y,0);updateNpcs();
 const focus=THREE.MathUtils.clamp(p.x,-9,10);camera.position.set(focus+4,6.5,12);camera.lookAt(focus,1,0);
 if(ready){
 status.textContent=mission.phase==='active'?(mission.carrying?'已取得道具！返回佳音寶寶身旁，按 E 交還。':'任務進行中：往右跨越障礙，取得星星道具。'):mission.phase==='complete'?'道具任務已完成！可以繼續自由探索。':mission.phase==='gameover'?'本場結束':'自由探索：靠近佳音寶寶，按 E 接受任務。';
 document.querySelector('#hud').textContent=`剩餘失誤機會 ${mission.lives} / ${RULES.lives} ｜ ${mission.phase==='active'?Math.ceil(mission.remaining)+' 秒':'不計時'} ｜ 已保存分數 ${mission.score}`;
 }
 star.visible=mission.phase==='active'&&!mission.carrying;
 document.querySelector('#reset').textContent=mission.phase==='active'?'返回起點（扣 1 次機會）':'返回起點';
 star.rotation.y+=.012;renderer.render(scene,camera);
}requestAnimationFrame(frame);
