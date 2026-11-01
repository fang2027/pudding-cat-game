// Trial timing; fixed cycles keep every attack predictable and avoid random traps.
export const AUDIO_RULES=Object.freeze({seconds:50,cycle:4.8,safe:2.4,warning:1.2});
export const REMOTE=Object.freeze({x:14.5,y:.65});
export const CONSOLE=Object.freeze({x:-.8,y:0});
export const CHASE=Object.freeze({speed:1.8});
export const SPEAKERS=Object.freeze([
 Object.freeze({name:'左側喇叭',x:3.1,y:0,width:1.1,offset:0}),
 Object.freeze({name:'右側喇叭',x:12.6,y:0,width:1.1,offset:1.6})
]);
export class AudioMission {
 constructor(){this.reset();}
 reset(){this.elapsed=0;this.carrying=false;}
 get frankieX(){return Math.min(REMOTE.x,CONSOLE.x+this.elapsed*CHASE.speed);}
 get atEnd(){return this.frankieX===REMOTE.x;}
 tick(dt){this.elapsed+=Math.max(0,dt);}
 phase(speaker){
  const time=(this.elapsed+speaker.offset)%AUDIO_RULES.cycle;
  return time<AUDIO_RULES.safe?'safe':time<AUDIO_RULES.safe+AUDIO_RULES.warning?'warning':'blast';
 }
 remaining(speaker){
  const time=(this.elapsed+speaker.offset)%AUDIO_RULES.cycle;
  const end=this.phase(speaker)==='safe'?AUDIO_RULES.safe:this.phase(speaker)==='warning'?AUDIO_RULES.safe+AUDIO_RULES.warning:AUDIO_RULES.cycle;
  return Math.max(0,end-time);
 }
 hit(p){return SPEAKERS.some(s=>this.phase(s)==='blast'&&Math.abs(p.x-s.x)<s.width/2+.36&&p.y<.75&&p.y+1.15>s.y);}
 canCollect(p){return !this.carrying&&this.atEnd&&p.grounded&&Math.abs(p.x-REMOTE.x)<.7&&Math.abs(p.y+.65-REMOTE.y)<.7;}
 collect(p){
  if(!this.canCollect(p))return false;
  this.carrying=true;return true;
 }
}
