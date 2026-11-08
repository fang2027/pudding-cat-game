import {CONSOLE} from './audio-mission.js';
import {BABY,GIRL,BACKSTAGE_Z,blockId,layoutPoint} from './layout.js';
export const baseBlocks = [
 {x:-7,y:-.5,w:14,h:1}, {x:8,y:-.5,w:16,h:1},
 {x:1.2,y:.35,w:1.3,h:.7}, {x:4.5,y:.65,w:1.5,h:1.3},
 {x:5,y:.45,w:1.5,h:.9}, {x:8,y:1,w:1.6,h:2}, {x:10.8,y:.45,w:1.5,h:.9},
 // Thin platforms can be jumped through from below; only their tops collide.
 {x:10.5,y:3.05,w:1.8,h:.3,oneWay:true},
 {x:6.8,y:4.25,w:3.6,h:.3,oneWay:true},
 {x:2.8,y:4.25,w:2.4,h:.3,oneWay:true},
 {x:-1,y:4.25,w:2.4,h:.3,oneWay:true},
 {x:-5,y:4.25,w:3,h:.3,oneWay:true},
 {x:1,y:-.5,w:30,h:1,z:BACKSTAGE_Z,d:4},
 {x:-11,y:-.5,w:4,h:1,z:-3,d:4},
 {x:12.5,y:-.5,w:5,h:1,z:-3,d:4}
].map((block,index)=>({z:index>=4&&index<=11?BACKSTAGE_Z:0,d:index<2?2.6:2.8,...block}));
export const blocks=baseBlocks.map((block,index)=>layoutPoint(blockId(index),block));
export const SPAWN=layoutPoint('spawn',{x:-11,y:0},blockId(0));
export const player = () => ({...SPAWN,vy:0,grounded:false});
export const WALK_SPEED=4.2;
const radius=.36, height=1.15;
// Character bodies are offset behind their interaction points.
const obstacles=[
 ...[BABY,GIRL].map(n=>({...n,y:n.y+.82,z:n.z-.7,w:1.03,h:1.64,d:.66,noStand:true})),
 {...CONSOLE,y:CONSOLE.y+.48,z:CONSOLE.z-1.2,w:1.2,h:.96,d:.72},
 layoutPoint('set-storage',{x:-13,y:.36,z:-1.76,w:1.27,h:.72,d:.74},blockId(0))
];
const fixedSolids=[...blocks,...obstacles];
const lowestLanding=Math.min(...fixedSolids.filter(b=>!b.noStand).map(b=>b.y+b.h/2));
export const isFallingOffStage=p=>p.vy<0&&p.y<lowestLanding-.001;
export function step(p, direction, jump, dt, depth=0, frankie=null){
 const solids=frankie?[...fixedSolids,{...frankie,y:frankie.y+.56,w:.88,h:1.12,d:.88,noStand:true}]:fixedSolids;
 p.z??=0;
 if(jump && p.grounded){p.vy=8;p.grounded=false;}
 const speed=WALK_SPEED*dt/Math.max(1,Math.hypot(direction,depth));
 let slide=null;
 function moveAxis(axis,amount,canSlide){
  if(!amount)return;
  const [other,size,otherSize]=axis==='x'?['z','w','d']:['x','d','w'];
  const sign=Math.sign(amount);
  const before=p[axis];
  p[axis]+=amount;
  for(const b of solids){
   if(b.oneWay||p.y+height<=b.y-b.h/2+.001||p.y>=b.y+b.h/2-.001)continue;
   if(Math.abs(p[other]-b[other])>=b[otherSize]/2+radius)continue;
   if(Math.abs(p[axis]-b[axis])<b[size]/2+radius&&sign*(before-b[axis])<0){
    p[axis]=b[axis]-sign*(b[size]/2+radius);
    if(b.noStand&&canSlide)slide={axis:other,amount:(Math.sign(p[other]-b[other])||1)*speed*.72};
   }
  }
 }
 moveAxis('x',direction*speed,!depth);
 moveAxis('z',depth*speed,!direction);
 if(slide)moveAxis(slide.axis,slide.amount,false);
 const old=p.y;p.vy-=20*dt;p.y+=p.vy*dt;p.grounded=false;
 for(const b of solids){
  if(Math.abs(p.x-b.x)>=b.w/2+radius||Math.abs(p.z-b.z)>=b.d/2+radius)continue;
  const top=b.y+b.h/2, bottom=b.y-b.h/2;
  if(p.vy<=0 && old>=top-.001 && p.y<=top){
   p.y=top;p.vy=0;
   if(b.noStand){
    // Drift out over the nearest edge without granting a grounded frame.
    const xGap=b.w/2+radius-Math.abs(p.x-b.x);
    const zGap=b.d/2+radius-Math.abs(p.z-b.z);
    const axis=xGap<zGap?'x':'z';
    const gap=Math.min(xGap,zGap);
    p[axis]+=(Math.sign(p[axis]-b[axis])||1)*Math.min(gap+.001,6*dt);
   }else p.grounded=true;
  }
  else if(!b.oneWay && p.vy>0 && old+height<=bottom && p.y+height>=bottom){p.y=bottom-height;p.vy=0;}
 }
 return p.y < -5;
}
