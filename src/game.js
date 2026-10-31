import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {blocks,player,step} from './physics.js';
import './game.css';
import {setupNpcs} from './npcs.js';
import {Mission,RULES,PROPS} from './mission.js';
const host=document.querySelector('#game'),status=document.querySelector('#status');
const scene=new THREE.Scene();scene.background=new THREE.Color('#f9f0dc');
const camera=new THREE.PerspectiveCamera(36,1,.1,120);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
renderer.outputColorSpace=THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xffffff,0xbda5a0,2.5));
const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-5,10,8);scene.add(light);
for(const [i,b] of blocks.entries()){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(b.w,b.h,2.6),new THREE.MeshStandardMaterial({color:b.oneWay?0xaaa1d2:i<2?0x8db5a3:0xe4ae65,roughness:.85}));mesh.position.set(b.x,b.y,0);scene.add(mesh);
}
// Back supports show the upper floor without obscuring the walking lane.
for(const x of [-6, -1, 6, 8]){
 const support=new THREE.Mesh(new THREE.BoxGeometry(.12,4.3,.12),new THREE.MeshStandardMaterial({color:0xaaa1bd}));
 support.position.set(x,2.15,-1.25);scene.add(support);
}
function stageLabel(text,x,y){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff9e9';ctx.fillRect(0,0,512,96);
 ctx.fillStyle='#595074';ctx.textAlign='center';ctx.font='bold 32px sans-serif';ctx.fillText(text,256,62);
 const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas)}));
 label.scale.set(3.5,.66,1);label.position.set(x,y,-.8);scene.add(label);
}
stageLabel('2F · 上層舞台',-3,6.3);
stageLabel('↑ 跳上紫色踏階',11.5,4.4);
const propMeshes=PROPS.map((prop,i)=>{
 const geometry=i===0?new THREE.OctahedronGeometry(.4):i===1?new THREE.IcosahedronGeometry(.38,0):new THREE.TorusGeometry(.3,.1,8,20);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:prop.color,emissive:prop.color,emissiveIntensity:.25}));
 mesh.position.set(prop.x,prop.y,0);scene.add(mesh);return mesh;
});
const checklist=document.querySelector('#props');
const propItems=PROPS.map(prop=>{const item=document.createElement('li');checklist.append(item);return item;});
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
 status:n=>n.name!=='佳音寶寶'?'待確認':mission.phase==='complete'?`已完成 · ${mission.score} 分`:mission.phase==='active'?(mission.allCollected?'請交還道具':`已找到 ${mission.collected.size} / ${PROPS.length}`):mission.phase==='gameover'?'本場結束':'可接受任務',
 dialog:n=>{
  if(n.name!=='佳音寶寶')return {text:n.text,task:n.task+' · 內容待確認'};
  if(mission.phase==='complete')return {text:'謝謝你幫忙！這項任務已完成。',task:`本項 ${mission.score} 分；另外兩項任務待開放。`};
  if(mission.phase==='active')return {text:mission.allCollected?'3 個道具都找到了！一起交給我吧。':`目前找到 ${mission.collected.size} / ${PROPS.length} 個。要全部帶回才能完成！尚缺：${PROPS.filter(item=>!mission.collected.has(item.id)).map(item=>item.name+'（'+item.place+'）').join('、')}`,task:`剩餘 ${Math.ceil(mission.remaining)} 秒 · 對話期間暫停計時`,label:'交還全部 3 個道具',action:mission.allCollected?()=>showResult(mission.finish(p)):undefined};
  return {text:'3 個道具散在一樓右端、二樓右側及二樓左端！從右側箱子與紫色踏階跳上二樓，找齊後一起帶回來。',task:`測試規則：${RULES.seconds} 秒；完成 ${RULES.baseScore} 分＋每剩餘秒 ${RULES.perSecond} 分。掉落、超時或任務中按 R，扣一次失誤機會。`,label:'接受任務，開始計時',action:()=>{mission.start();clearInput();}};
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
 const focus=THREE.MathUtils.clamp(p.x,-9,10),focusY=1.7+Math.max(0,p.y)*.55;camera.position.set(focus+4,focusY+5.5,14);camera.lookAt(focus,focusY,0);
 if(ready){
 status.textContent=mission.phase==='active'?(mission.allCollected?'3 個道具已集齊！返回佳音寶寶身旁，按 E 交還。':'尋找 3 個道具：一樓右端、二樓右側與二樓左端。'):mission.phase==='complete'?'道具任務已完成！可以繼續自由探索。':mission.phase==='gameover'?'本場結束':'自由探索：靠近佳音寶寶，按 E 接受任務。';
 document.querySelector('#hud').textContent=`剩餘失誤機會 ${mission.lives} / ${RULES.lives} ｜ ${mission.phase==='active'?Math.ceil(mission.remaining)+' 秒':'不計時'} ｜ 道具 ${mission.collected.size} / ${PROPS.length} ｜ 已保存分數 ${mission.score}`;
 }
 propMeshes.forEach((mesh,i)=>{mesh.visible=mission.phase==='active'&&!mission.collected.has(PROPS[i].id);mesh.rotation.y+=.012;propItems[i].textContent=`${mission.collected.has(PROPS[i].id)?'✓':'○'} ${PROPS[i].name} · ${PROPS[i].place}`;});
 document.querySelector('#reset').textContent=mission.phase==='active'?'返回起點（扣 1 次機會）':'返回起點';
 renderer.render(scene,camera);
}requestAnimationFrame(frame);
