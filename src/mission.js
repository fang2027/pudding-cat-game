// Playtest tuning; the approved rules are three shared mistakes and time bonus.
export const RULES = Object.freeze({seconds:60, lives:3, baseScore:500, perSecond:10, propX:13});
export class Mission {
 constructor(){this.restart();}
 restart(){this.phase='idle';this.lives=RULES.lives;this.remaining=RULES.seconds;this.carrying=false;this.score=0;}
 start(){if(this.phase!=='idle'||this.lives<=0)return false;this.phase='active';this.remaining=RULES.seconds;this.carrying=false;return true;}
 tick(dt){if(this.phase!=='active')return null;this.remaining=Math.max(0,this.remaining-Math.max(0,dt));return this.remaining===0?this.fail('時間到了'):null;}
 collect(p){if(this.phase==='active'&&!this.carrying&&Math.abs(p.x-RULES.propX)<.9&&p.y>=-.1&&p.y<1.8){this.carrying=true;return true;}return false;}
 finish(p){if(this.phase!=='active'||!this.carrying||!p.grounded||Math.abs(p.x+12)>=1.5)return null;this.phase='complete';this.carrying=false;this.score=RULES.baseScore+Math.floor(this.remaining)*RULES.perSecond;return {kind:'success',title:'道具送達！',text:`完成 ${RULES.baseScore} 分 ＋ 時間獎勵 ${this.score-RULES.baseScore} 分 ＝ ${this.score} 分。分數已保存於本次遊戲。`};}
 fail(reason){if(this.phase==='gameover')return null;this.lives=Math.max(0,this.lives-1);this.carrying=false;this.phase=this.lives===0?'gameover':this.phase==='complete'?'complete':'idle';return {kind:this.phase==='gameover'?'gameover':'failure',title:this.phase==='gameover'?'本場結束':reason,text:this.phase==='gameover'?'失誤機會已耗盡。重新開始會重置生命與本場分數。':`剩餘 ${this.lives} 次失誤機會。${this.phase==='complete'?'已完成的分數仍保留。':'可回佳音寶寶處重新接受任務。'}`};}
}
