import assert from 'node:assert/strict';
import {LIGHT_ROUNDS,LIGHT_RULES,PADS} from '../../src/lights.js';
const away={x:20,y:0,grounded:true};
export function completeLightTask(m){
 assert.equal(m.start('lights'),true);let result=null;
 for(let round=0;round<LIGHT_ROUNDS.length;round++){
  m.tick(m.lights.demoSeconds);m.touchPad(away);
  for(const id of [...m.lights.sequence]){
   m.touchPad(away);
   result=m.touchPad({...PADS.find(p=>p.id===id),grounded:true});
  }
  if(round<LIGHT_ROUNDS.length-1){assert.equal(result,null);assert.equal(m.score,m.records.props.score+m.records.audio.score);m.tick(LIGHT_RULES.roundBreak);}
 }
 return result;
}
