export const LIGHT_RULES = Object.freeze({seconds:45, leadIn:1, beat:1.4, lit:0.85});
export const PADS = Object.freeze([
 Object.freeze({id:'A',name:'粉紅 A',x:-9.5,y:0,color:0xf183b0}),
 Object.freeze({id:'B',name:'金黃 B',x:-6,y:.7,color:0xf3c14b}),
 Object.freeze({id:'C',name:'藍色 C',x:-2.7,y:1.3,color:0x66bfee})
]);
export const DEMO_SECONDS=LIGHT_RULES.leadIn+PADS.length*LIGHT_RULES.beat;
export class LightSequence {
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){this.stage='idle';this.sequence=[];this.elapsed=0;this.progress=0;this.contact=null;this.inputSampled=false;}
 start(){
  this.reset();this.stage='demo';this.sequence=PADS.map(p=>p.id);
  for(let i=this.sequence.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.sequence[i],this.sequence[j]]=[this.sequence[j],this.sequence[i]];}
 }
 get litPad(){
  if(this.stage!=='demo')return null;
  const t=this.elapsed-LIGHT_RULES.leadIn;
  return t>=0&&t%LIGHT_RULES.beat<LIGHT_RULES.lit?this.sequence[Math.floor(t/LIGHT_RULES.beat)]??null:null;
 }
 tick(dt){if(this.stage==='demo'){this.elapsed+=dt;if(this.elapsed>=DEMO_SECONDS)this.stage='input';}}
 touch(p){
  if(this.stage!=='input')return null;
  const pad=p.grounded?PADS.find(item=>Math.abs(p.x-item.x)<.5&&Math.abs(p.y-item.y)<.12):null;
  const id=pad?.id??null,previous=this.contact;this.contact=id;
  // Ignore a pad already underfoot as the demonstration ends.
  if(!this.inputSampled){this.inputSampled=true;return null;}
  if(!id||id===previous)return null;
  if(id!==this.sequence[this.progress])return 'wrong';
  this.progress++;
  if(this.progress===this.sequence.length){this.stage='complete';return 'complete';}
  return 'correct';
 }
}
