export const blocks = [
 {x:-7,y:-.5,w:14,h:1}, {x:9,y:-.5,w:14,h:1},
 {x:-6,y:.35,w:1.3,h:.7}, {x:-2.7,y:.65,w:1.5,h:1.3},
 {x:5,y:.45,w:1.5,h:.9}, {x:8,y:1,w:1.6,h:2}
];
export const player = () => ({x:-11,y:0,vy:0,grounded:false});
const radius=.36, height=1.15;
export function step(p, direction, jump, dt){
 if(jump && p.grounded){p.vy=8;p.grounded=false;}
 p.x+=direction*4.2*dt;
 for(const b of blocks){
  if(p.y+height>b.y-b.h/2+.001 && p.y<b.y+b.h/2-.001 && Math.abs(p.x-b.x)<b.w/2+radius){
   if(direction>0)p.x=b.x-b.w/2-radius;
   if(direction<0)p.x=b.x+b.w/2+radius;
  }
 }
 const old=p.y;p.vy-=20*dt;p.y+=p.vy*dt;p.grounded=false;
 for(const b of blocks){
  if(Math.abs(p.x-b.x)>=b.w/2+radius)continue;
  const top=b.y+b.h/2, bottom=b.y-b.h/2;
  if(p.vy<=0 && old>=top-.001 && p.y<=top){p.y=top;p.vy=0;p.grounded=true;}
  else if(p.vy>0 && old+height<=bottom && p.y+height>=bottom){p.y=bottom-height;p.vy=0;}
 }
 return p.y < -5;
}
