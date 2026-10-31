import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nearestCharacter} from '../src/npcs.js';
test('NPC interaction requires landing on the same floor',()=>{
 assert.equal(nearestCharacter({x:-.8,y:4.4,grounded:true}),null);
 assert.equal(nearestCharacter({x:-12,y:0,grounded:false}),null);
 assert.equal(nearestCharacter({x:-12,y:0,grounded:true}).name,'佳音寶寶');
});
