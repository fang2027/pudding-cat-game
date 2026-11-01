import {LightSequence,LIGHT_RULES} from './lights.js';
import {AudioMission,AUDIO_RULES} from './audio-mission.js';
export const RULES = Object.freeze({seconds:60,lives:3,baseScore:500,perSecond:10});
export const TASKS=Object.freeze({props:{name:'道具任務',seconds:RULES.seconds},lights:{name:'燈光任務',seconds:LIGHT_RULES.seconds},audio:{name:'音響任務',seconds:AUDIO_RULES.seconds}});
export const PROPS = Object.freeze([
 Object.freeze({id:'star',name:'金色星星',place:'一樓右端',x:13,y:.65,color:0xffc63e}),
 Object.freeze({id:'gem',name:'粉紅寶石',place:'二樓右側',x:8,y:5.05,color:0xf17dba}),
 Object.freeze({id:'ring',name:'藍色圓環',place:'二樓左端',x:-5,y:5.05,color:0x68b8ec})
]);
// One active mission, independent records, and a shared life pool.
export class Mission {
 constructor(random=Math.random){this.lights=new LightSequence(random);this.audio=new AudioMission();this.restart();}
 get allCollected(){return this.collected.size===PROPS.length;}
 get allComplete(){return Object.values(this.records).every(r=>r.state==='complete');}
 get phase(){return this.allComplete?'won':this.lives===0?'gameover':this.activeId?'active':Object.values(this.records).some(r=>r.state==='complete')?'complete':'idle';}
 get remaining(){return this.records[this.activeId??this.lastId].remaining;}
 get score(){return Object.values(this.records).reduce((sum,r)=>sum+r.score,0);}
 restart(){
  this.lives=RULES.lives;this.activeId=null;this.lastId='props';this.collected=new Set();this.lights.reset();this.audio.reset();
  this.records=Object.fromEntries(Object.entries(TASKS).map(([id,task])=>[id,{state:'idle',remaining:task.seconds,score:0}]));
 }
 start(id='props'){
  if(!this.records[id]||this.activeId||this.lives<=0||this.records[id].state==='complete')return false;
  this.activeId=id;this.lastId=id;this.records[id].state='active';
  this.records[id].remaining=TASKS[id].seconds;
  if(id==='props')this.collected.clear();else if(id==='lights')this.lights.start();else this.audio.reset();
  return true;
 }
 tick(dt){
  if(!this.activeId)return null;
  dt=Math.max(0,dt);const record=this.records[this.activeId];record.remaining=Math.max(0,record.remaining-dt);
  if(record.remaining===0)return this.fail('時間到了');
  if(this.activeId==='lights')this.lights.tick(dt);
  if(this.activeId==='audio')this.audio.tick(dt);
  return null;
 }
 collect(p){
  if(this.activeId!=='props')return false;
  const prop=PROPS.find(item=>!this.collected.has(item.id)&&Math.abs(p.x-item.x)<.7&&Math.abs(p.y+.65-item.y)<.7);
  if(!prop)return false;
  this.collected.add(prop.id);return true;
 }
 finish(p){
  if(this.activeId!=='props'||!this.allCollected||!p.grounded||Math.abs(p.x+12)>=1.5||Math.abs(p.y)>.8)return null;
  return this.save('3 個道具全部送達！');
 }
 touchPad(p){
  if(this.activeId!=='lights')return null;
  const contact=this.lights.touch(p);
  if(contact==='wrong')return this.fail('踩錯順序了！');
  return contact==='complete'?this.save('舞台燈光恢復了！'):null;
 }
 updateAudio(p){
  if(this.activeId!=='audio')return null;
  if(this.audio.hit(p))return this.fail('被音波嚇到了！');
  this.audio.collect(p);return null;
 }
 finishAudio(p){
  if(this.activeId!=='audio'||!this.audio.carrying||!p.grounded||Math.abs(p.x+.8)>=1.5||Math.abs(p.y)>.8)return null;
  return this.save('遙控器送達，音響恢復了！');
 }
 save(title){
  if(!this.activeId)return null;
  const record=this.records[this.activeId];
  record.score=RULES.baseScore+Math.floor(record.remaining)*RULES.perSecond;record.state='complete';this.activeId=null;
  if(this.allComplete)return {kind:'victory',title:'三項任務全部完成！',text:`舞台準備完成！三項分數合計 ${this.score} 分，剩餘 ${this.lives} 次失誤機會。`};
  return {kind:'success',title,text:`完成 ${RULES.baseScore} 分 ＋ 時間獎勵 ${record.score-RULES.baseScore} 分 ＝ ${record.score} 分。此項分數已保存，可繼續探索或挑戰另一項任務。`};
 }
 fail(reason){
  if(this.lives===0||this.allComplete)return null;
  this.lives--;const failed=this.activeId;
  if(failed){this.records[failed].state='idle';if(failed==='props')this.collected.clear();else if(failed==='lights')this.lights.reset();else this.audio.reset();}
  this.activeId=null;
  const hint=failed==='props'?'道具已回到原位，可找佳音寶寶重試。':failed==='lights'?'可找佳音女寶寶重新觀看順序並重試。':failed==='audio'?'遙控器已回到原位，可找法蘭奇重試。':'可以繼續探索。';
  return {kind:this.lives===0?'gameover':'failure',title:this.lives===0?'本場結束':reason,text:this.lives===0?'失誤機會已耗盡。重新開始會重置三項任務及本場分數。':`剩餘 ${this.lives} 次失誤機會。${hint}已完成的任務分數仍保留。`};
 }
}
