import {GIRL,blockId,depthDistance,layoutPoint} from './layout.js';
export const LIGHT_RULES = Object.freeze({seconds:75,leadIn:3,roundBreak:1.8});
// Directly in front of the girl NPC, one unit away from pad A.
export const LIGHT_READY_POSITION=Object.freeze({...GIRL,vy:0,grounded:true});
export function createLightRoundReset(){
 let sequence=null;
 return (mission,player)=>{
  if(mission.activeId!=='lights'){sequence=null;return false;}
  if(sequence===mission.lights.sequence)return false;
  sequence=mission.lights.sequence;
  Object.assign(player,LIGHT_READY_POSITION);
  return true;
 };
}
export const LIGHT_ROUNDS=Object.freeze([
 Object.freeze({name:'暖身',length:3,beat:1.4,lit:.85}),
 Object.freeze({name:'進階',length:4,beat:1.15,lit:.65}),
 Object.freeze({name:'挑戰',length:5,beat:.9,lit:.5})
]);
export const PADS = Object.freeze([
 Object.freeze({id:'A',name:'粉紅 A',x:-2.3,y:0,color:0xf183b0}),
 Object.freeze({id:'B',name:'金黃 B',x:1.2,y:.7,color:0xf3c14b}),
 Object.freeze({id:'C',name:'藍色 C',x:4.5,y:1.3,color:0x66bfee})
].map((pad,index)=>Object.freeze(layoutPoint('pad-'+pad.id.toLowerCase(),pad,blockId([0,2,3][index])))));
export const DEMO_SECONDS=LIGHT_RULES.leadIn+LIGHT_ROUNDS[0].length*LIGHT_ROUNDS[0].beat;
export const FEEDBACK_SECONDS=.7;
export const padUnderfoot=p=>p?.grounded?PADS.find(item=>depthDistance(p,item)<.9&&Math.abs(p.x-item.x)<.5&&Math.abs(p.y-item.y)<.12)??null:null;
export class LightSequence {
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){this.round=0;this.stage='idle';this.sequence=[];this.elapsed=0;this.progress=0;this.contact=null;this.inputSampled=false;this.feedback=null;this.feedbackRemaining=0;}
 get rules(){return LIGHT_ROUNDS[this.round];}
 get demoSeconds(){return LIGHT_RULES.leadIn+this.sequence.length*this.rules.beat;}
 get countdown(){return this.stage==='demo'&&this.elapsed<LIGHT_RULES.leadIn?Math.ceil(LIGHT_RULES.leadIn-this.elapsed):0;}
 get locked(){return this.stage==='demo'||this.stage==='round-clear';}
 start(){
  this.reset();this.beginRound();
 }
 beginRound(){
  this.stage='demo';this.sequence=PADS.map(p=>p.id);this.elapsed=0;this.progress=0;
  this.contact=null;this.inputSampled=false;this.feedback=null;this.feedbackRemaining=0;
  for(let i=this.sequence.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.sequence[i],this.sequence[j]]=[this.sequence[j],this.sequence[i]];}
  while(this.sequence.length<this.rules.length)this.sequence.push(PADS[Math.floor(this.random()*PADS.length)].id);
 }
 get litPad(){
  if(this.stage!=='demo')return null;
  const t=this.elapsed-LIGHT_RULES.leadIn;
  return t>=0&&t%this.rules.beat<this.rules.lit?this.sequence[Math.floor(t/this.rules.beat)]??null:null;
 }
 tick(dt){
  dt=Math.max(0,dt);this.feedbackRemaining=Math.max(0,this.feedbackRemaining-dt);
  if(this.feedbackRemaining===0)this.feedback=null;
  if(this.stage==='round-clear'){
   const remaining=LIGHT_RULES.roundBreak-this.elapsed;
   if(dt<remaining){this.elapsed+=dt;return;}
   this.round++;this.beginRound();dt-=remaining;
  }
  if(this.stage==='demo'){this.elapsed=Math.min(this.demoSeconds,this.elapsed+dt);if(this.elapsed>=this.demoSeconds)this.stage='input';}
 }
 touch(p){
  if(this.stage!=='input')return null;
  const pad=padUnderfoot(p);
  const id=pad?.id??null,previous=this.contact;this.contact=id;
  // Ignore a pad already underfoot as the demonstration ends.
  if(!this.inputSampled){this.inputSampled=true;return null;}
  if(!id||id===previous)return null;
  this.feedback={padId:id,result:id===this.sequence[this.progress]?'correct':'wrong'};
  this.feedbackRemaining=FEEDBACK_SECONDS;
  if(this.feedback.result==='wrong')return 'wrong';
  this.progress++;
  if(this.progress===this.sequence.length){
   if(this.round===LIGHT_ROUNDS.length-1){this.stage='complete';return 'complete';}
   this.stage='round-clear';this.elapsed=0;return 'round-complete';
  }
  return 'correct';
 }
}
export function lightObjective(l){
 const round=`第 ${l.round+1} / ${LIGHT_ROUNDS.length} 回合`;
 if(l.stage==='round-clear')return `✓ 第 ${l.round+1} 回合通過！準備第 ${l.round+2} 回合（${LIGHT_ROUNDS[l.round+1].length} 次亮燈）`;
 if(l.countdown)return `${round} · 準備看示範 · ${l.countdown}`;
 if(l.stage==='demo')return `${round} · 觀看示範，記住 ${l.sequence.length} 次亮燈順序`;
 if(l.stage==='complete')return '✓ 三回合全部通過！';
 return `${round} · 已踩 ${l.progress} / ${l.sequence.length} · 同一踏板重複亮起時，離開再踩回或原地跳一下`;
}
