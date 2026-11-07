import {BACKSTAGE_Z,blockId,layoutPoint} from './layout.js';
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
const radius=.36, height=1.15;
export function step(p, direction, jump, dt, depth=0){
 p.z??=0;
 if(jump && p.grounded){p.vy=8;p.grounded=false;}
 const speed=4.2*dt/Math.max(1,Math.hypot(direction,depth));
 for(const [axis,input,other,size,otherSize] of [['x',direction,'z','w','d'],['z',depth,'x','d','w']]){
  if(!input)continue;
  p[axis]+=input*speed;
  for(const b of blocks){
   if(b.oneWay||p.y+height<=b.y-b.h/2+.001||p.y>=b.y+b.h/2-.001)continue;
   if(Math.abs(p[other]-b[other])>=b[otherSize]/2+radius)continue;
   if(Math.abs(p[axis]-b[axis])<b[size]/2+radius)p[axis]=b[axis]-Math.sign(input)*(b[size]/2+radius);
  }
 }
 const old=p.y;p.vy-=20*dt;p.y+=p.vy*dt;p.grounded=false;
 for(const b of blocks){
  if(Math.abs(p.x-b.x)>=b.w/2+radius||Math.abs(p.z-b.z)>=b.d/2+radius)continue;
  const top=b.y+b.h/2, bottom=b.y-b.h/2;
  if(p.vy<=0 && old>=top-.001 && p.y<=top){p.y=top;p.vy=0;p.grounded=true;}
  else if(!b.oneWay && p.vy>0 && old+height<=bottom && p.y+height>=bottom){p.y=bottom-height;p.vy=0;}
 }
 return p.y < -5;
}
