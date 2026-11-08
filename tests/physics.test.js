import {test} from 'node:test';
import assert from 'node:assert/strict';
import {player,step,isFallingOffStage} from '../src/physics.js';
test('lands on ground and stays stable',()=>{const p=player();p.y=3;for(let i=0;i<300;i++)step(p,0,false,1/120);assert.equal(p.y,0);assert.equal(p.grounded,true);});
test('cannot walk through crate',()=>{const p=player();for(let i=0;i<300;i++)step(p,1,false,1/120);assert.ok(p.x<=.19);});
test('jump clears low crate and lands on it',()=>{const p=player();p.x=.15;step(p,0,false,1/120);let highest=0;for(let i=0;i<100;i++){step(p,i<35?1:0,i===0,1/120);highest=Math.max(highest,p.y);}assert.ok(highest>1.5);assert.equal(p.y,.7);});
test('airborne input cannot double jump',()=>{const p=player();step(p,0,false,1/120);step(p,0,true,1/120);const v=p.vy;step(p,0,true,1/120);assert.ok(p.vy<v);});
test('walking off the front edge triggers fall reset signal',()=>{const p=player();p.x=1;p.z=2;let fallen=false;for(let i=0;i<150;i++)fallen=step(p,0,false,1/120)||fallen;assert.equal(fallen,true);});
test('the front-stage seam supports walking without jumping',()=>{const p=player();p.x=-.5;for(let i=0;i<48;i++)step(p,1,false,1/120);assert.ok(p.x>0);assert.equal(p.y,0);assert.ok(p.grounded);});
test('upper platforms allow jumping through and catch the descent',()=>{
 const p={x:7.05,y:2,z:-6,vy:0,grounded:true};let highest=0;
 for(let i=0;i<160;i++){step(p,0,i===0,1/120);highest=Math.max(highest,p.y);}
 assert.ok(highest>3.5);assert.ok(Math.abs(p.y-3.2)<.001);assert.equal(p.grounded,true);
});

test('characters, the sound console and the prop box stop movement at their visible positions',()=>{
 for(const [x,z,limit] of [[10.5,-1.2,-.48],[-13,-1.76,-1.03]]){
  const p={...player(),x,z:0,grounded:true};
  for(let i=0;i<90;i++)step(p,0,false,1/120,-1);
  assert.ok(Math.abs(p.z-limit)<1e-6,`collision at ${x}, ${z}: ${p.z}`);
  assert.equal(p.y,0);
 }
 const frankie={x:-8,y:0,z:0},p={...player(),x:-9,z:0,grounded:true};
 for(let i=0;i<7;i++)step(p,1,false,1/120,0,frankie);
 assert.ok(Math.abs(p.x-frankie.x+.8)<1e-6);
 assert.ok(Math.abs(p.x-frankie.x)<.85,'Frankie remains within interaction range');
 assert.ok(p.z>0,'side contact starts sliding along the character');
 for(let i=0;i<90;i++)step(p,1,false,1/120,0,frankie);
 assert.ok(p.x>frankie.x&&p.z>=.8&&p.grounded);
});

test('landing on another character slides off without allowing a jump from their head',()=>{
 const frankie={x:-8,y:0,z:0};
 for(const [x,z,dog] of [[-12,-.7,null],[-1.3,-.7,null],[-8,0,frankie]]){
  const p={x,y:2.2,z,vy:0,grounded:false};
  for(let i=0;i<150;i++){
   step(p,0,p.y>.01,1/120,0,dog);
   if(p.y>.01){assert.equal(p.grounded,false);assert.ok(p.vy<=0);}
  }
  assert.equal(p.y,0);assert.equal(p.grounded,true);
  assert.ok(Math.hypot(p.x-x,p.z-z)>.65);
 }
});

test('an unrecoverable fall is detected before reset, while a jump above the stage is not',()=>{
 const p={...player(),z:2,grounded:false};
 assert.equal(isFallingOffStage({...p,y:1,vy:-3}),false);
 assert.equal(step(p,0,false,1/120),false);
 assert.equal(isFallingOffStage(p),true);
});
