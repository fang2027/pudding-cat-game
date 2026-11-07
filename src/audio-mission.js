import {BACKSTAGE_Z,blockId,depthDistance,layoutPoint} from './layout.js';
// Trial timing; fixed cycles keep every attack predictable and avoid random traps.
export const AUDIO_RULES=Object.freeze({seconds:50,cycle:4.8,safe:2.4,warning:1.2});
export const CONSOLE=Object.freeze(layoutPoint('console',{x:10.5,y:0},blockId(1)));
export const CHASE=Object.freeze({speed:4.6,reaction:1.2,feedback:3,escapeSpeed:6.1});
const route=points=>Object.freeze(points.map(([x,y,index,z=BACKSTAGE_Z])=>Object.freeze(index===undefined?CONSOLE:layoutPoint(blockId(index),{x,y,z}))));
export const SPEAKERS=Object.freeze([
 Object.freeze({name:'左側喇叭',x:3.1,y:0,z:BACKSTAGE_Z,width:.9,depth:4,offset:0}),
 Object.freeze({name:'右側喇叭',x:12.6,y:0,z:BACKSTAGE_Z,width:1.1,depth:2.4,offset:1.6})
].map((speaker,index)=>Object.freeze(layoutPoint('speaker-'+index,speaker,blockId(12)))));
const [floor]=route([[0,0,12]]);
const firstStop=Object.freeze({...floor,x:SPEAKERS[0].x-2.1});
const [low,high,right,stair,catwalk,rightStop]=route([[5,.9,4],[8,2,5],[10.8,.9,6],[10.5,3.2,7],[6.8,4.4,8],[14.5,0,12]]);
const jump=(from,to)=>Object.freeze({x:(from.x+to.x)/2,y:Math.max(from.y,to.y)+.45,z:(from.z+to.z)/2});
const takeoff=Object.freeze({...low,x:low.x-1.35,y:floor.y});
const rightTakeoff=Object.freeze({...right,x:right.x+1.6,y:floor.y});
export const CHASE_STAGES=Object.freeze([
 Object.freeze({name:'左側攔截',place:'後台左喇叭左側',path:Object.freeze([
  ...route([[0,0],[12.5,0,1,0],[12.5,0,14,-3],[12.5,0,12,-4.15]]),
  Object.freeze({...firstStop,z:firstStop.z+1.85}),firstStop
 ])}),
 Object.freeze({name:'右端再追',place:'後台最右端',path:Object.freeze([
  firstStop,takeoff,jump(takeoff,low),low,jump(low,high),high,jump(high,right),right,
  jump(right,rightTakeoff),rightTakeoff,rightStop
 ])}),
 Object.freeze({name:'二樓奪回',place:'二樓燈架工作走道',path:Object.freeze([
  rightStop,rightTakeoff,jump(rightTakeoff,right),right,jump(right,high),high,
  jump(high,stair),stair,jump(stair,catwalk),catwalk
 ])})
]);
const leftSpeaker=SPEAKERS[0];
export const LEFT_BLAST_START=(leftSpeaker.x+leftSpeaker.width/2+.36-firstStop.x)/CHASE.escapeSpeed;
const phaseOffset=speaker=>speaker===leftSpeaker?AUDIO_RULES.safe+AUDIO_RULES.warning-LEFT_BLAST_START:speaker.offset;
export const REMOTE=Object.freeze({...catwalk,y:catwalk.y+.65});
export class AudioMission {
 constructor(){this.reset();}
 reset(){
  this.elapsed=0;this.carrying=false;this.stage=0;this.legElapsed=0;this.reactionRemaining=0;
  this.speakersActive=false;this.waveElapsed=0;this.feedback='';this.feedbackRemaining=0;
 }
 get target(){return CHASE_STAGES[this.stage].path.at(-1);}
 get routeLength(){
  const path=CHASE_STAGES[this.stage].path;
  return path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.y-path[i].y,p.z-path[i].z),0);
 }
 get speed(){return this.stage===1?CHASE.escapeSpeed:CHASE.speed;}
 get waiting(){return this.legElapsed>=this.routeLength/this.speed;}
 get atEnd(){return this.stage===CHASE_STAGES.length-1&&this.waiting;}
 get position(){
  if(this.waiting)return this.target;
  const path=CHASE_STAGES[this.stage].path;let distance=this.legElapsed*this.speed;
  for(let i=1;i<path.length;i++){
   const from=path[i-1],to=path[i],length=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
   if(distance<length){const t=distance/length;return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t};}
   distance-=length;
  }
  return this.target;
 }
 get frankieX(){return this.position.x;}
 get frankieY(){return this.position.y;}
 get interactionLabel(){return this.stage<2?`按 E 攔住法蘭奇（第 ${this.stage+1} 次）`:'按 E 拿回遙控器';}
 tick(dt){
  dt=Math.max(0,dt);this.elapsed+=dt;
  if(this.speakersActive)this.waveElapsed+=dt;
  this.feedbackRemaining=Math.max(0,this.feedbackRemaining-dt);
  if(this.feedbackRemaining===0)this.feedback='';
  const moving=Math.max(0,dt-this.reactionRemaining);
  this.reactionRemaining=Math.max(0,this.reactionRemaining-dt);
  this.legElapsed=Math.min(this.routeLength/this.speed,this.legElapsed+moving);
 }
 phase(speaker){
  if(!this.speakersActive)return 'safe';
  const time=(this.waveElapsed+phaseOffset(speaker))%AUDIO_RULES.cycle;
  return time<AUDIO_RULES.safe?'safe':time<AUDIO_RULES.safe+AUDIO_RULES.warning?'warning':'blast';
 }
 remaining(speaker){
  if(!this.speakersActive)return 0;
  const time=(this.waveElapsed+phaseOffset(speaker))%AUDIO_RULES.cycle;
  const end=this.phase(speaker)==='safe'?AUDIO_RULES.safe:this.phase(speaker)==='warning'?AUDIO_RULES.safe+AUDIO_RULES.warning:AUDIO_RULES.cycle;
  return Math.max(0,end-time);
 }
 hit(p){return SPEAKERS.some(s=>this.phase(s)==='blast'&&depthDistance(p,s)<s.depth/2+.36&&Math.abs(p.x-s.x)<s.width/2+.36&&p.y<s.y+.75&&p.y+1.15>s.y);}
 canInteract(p){return !this.carrying&&this.waiting&&p.grounded&&depthDistance(p,this.target)<.85&&Math.abs(p.x-this.target.x)<.85&&Math.abs(p.y-this.target.y)<.35;}
 canCollect(p){return this.atEnd&&this.canInteract(p);}
 interact(p){
  if(!this.canInteract(p))return null;
  if(this.stage===2){this.collect(p);return 'collected';}
  this.feedback=this.stage===0?'差一點就拿到了！左側喇叭啟動了！等綠燈或跳過音波，沿箱子往右追！':'又被他溜走了！法蘭奇跳上二樓，從後台的箱子和紫色踏階追上去！';
  this.feedbackRemaining=CHASE.feedback;
  if(!this.speakersActive){this.speakersActive=true;this.waveElapsed=0;}
  this.stage++;this.legElapsed=0;this.reactionRemaining=this.stage===1?0:CHASE.reaction;
  return 'escaped';
 }
 collect(p){
  if(!this.canCollect(p))return false;
  this.carrying=true;this.feedback='終於拿回遙控器了！回音控台按 E 交還。';this.feedbackRemaining=CHASE.feedback;return true;
 }
}
export function audioObjective(a){
 if(a.carrying)return '✓ 三次追逐完成！遙控器已取得 · 回音控台按 E 交還';
 const stage=CHASE_STAGES[a.stage];
 return `追逐 ${a.stage+1} / 3 · ${stage.place} · ${a.waiting?'靠近、落地後'+a.interactionLabel:'追上法蘭奇！'+(a.stage===2?'從後台箱子與紫色踏階上二樓':'走右側側台進後台')}`;
}
