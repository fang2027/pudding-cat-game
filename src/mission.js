// Playtest tuning; three shared mistakes and a bonus for remaining whole seconds.
export const RULES = Object.freeze({seconds:60, lives:3, baseScore:500, perSecond:10});
export const PROPS = Object.freeze([
 Object.freeze({id:'star',name:'金色星星',place:'一樓右端',x:13,y:.65,color:0xffc63e}),
 Object.freeze({id:'gem',name:'粉紅寶石',place:'二樓右側',x:8,y:5.05,color:0xf17dba}),
 Object.freeze({id:'ring',name:'藍色圓環',place:'二樓左端',x:-5,y:5.05,color:0x68b8ec})
]);
export class Mission {
 constructor(){this.restart();}
 get allCollected(){return this.collected.size===PROPS.length;}
 restart(){
  this.phase='idle';this.lives=RULES.lives;this.remaining=RULES.seconds;
  this.collected=new Set();this.score=0;
 }
 start(){
  if(this.phase!=='idle'||this.lives<=0)return false;
  this.phase='active';this.remaining=RULES.seconds;this.collected.clear();return true;
 }
 tick(dt){
  if(this.phase!=='active')return null;
  this.remaining=Math.max(0,this.remaining-Math.max(0,dt));
  return this.remaining===0?this.fail('時間到了'):null;
 }
 collect(p){
  if(this.phase!=='active')return false;
  // Compare both axes so walking beneath a prop cannot collect it through a floor.
  const prop=PROPS.find(item=>!this.collected.has(item.id)&&Math.abs(p.x-item.x)<.7&&Math.abs(p.y+.65-item.y)<.7);
  if(!prop)return false;
  this.collected.add(prop.id);return true;
 }
 finish(p){
  if(this.phase!=='active'||!this.allCollected||!p.grounded||Math.abs(p.x+12)>=1.5||Math.abs(p.y)>.8)return null;
  this.phase='complete';
  this.score=RULES.baseScore+Math.floor(this.remaining)*RULES.perSecond;
  return {kind:'success',title:'3 個道具全部送達！',text:`完成 ${RULES.baseScore} 分 ＋ 時間獎勵 ${this.score-RULES.baseScore} 分 ＝ ${this.score} 分。分數已保存於本次遊戲。`};
 }
 fail(reason){
  if(this.phase==='gameover')return null;
  this.lives=Math.max(0,this.lives-1);
  if(this.phase!=='complete')this.collected.clear();
  this.phase=this.lives===0?'gameover':this.phase==='complete'?'complete':'idle';
  return {kind:this.phase==='gameover'?'gameover':'failure',title:this.phase==='gameover'?'本場結束':reason,text:this.phase==='gameover'?'失誤機會已耗盡。重新開始會重置生命與本場分數。':`剩餘 ${this.lives} 次失誤機會。${this.phase==='complete'?'已完成的分數仍保留。':'道具已回到原位，可找佳音寶寶重新接受任務。'}`};
 }
}
