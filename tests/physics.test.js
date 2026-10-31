import {test} from 'node:test';
import assert from 'node:assert/strict';
import {player,step} from '../src/physics.js';
test('lands on ground and stays stable',()=>{const p=player();p.y=3;for(let i=0;i<300;i++)step(p,0,false,1/120);assert.equal(p.y,0);assert.equal(p.grounded,true);});
test('cannot walk through crate',()=>{const p=player();for(let i=0;i<300;i++)step(p,1,false,1/120);assert.ok(p.x<=-7.009);});
test('jump clears low crate and lands on it',()=>{const p=player();p.x=-7.05;step(p,0,false,1/120);let highest=0;for(let i=0;i<100;i++){step(p,i<35?1:0,i===0,1/120);highest=Math.max(highest,p.y);}assert.ok(highest>1.5);assert.equal(p.y,.7);});
test('airborne input cannot double jump',()=>{const p=player();step(p,0,false,1/120);step(p,0,true,1/120);const v=p.vy;step(p,0,true,1/120);assert.ok(p.vy<v);});
test('gap triggers fall reset signal',()=>{const p=player();p.x=1;let fallen=false;for(let i=0;i<150;i++)fallen=step(p,0,false,1/120)||fallen;assert.equal(fallen,true);});
