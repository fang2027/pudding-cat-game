import {RULES,PROPS,TASKS} from './mission.js';
import {audioObjective} from './audio-mission.js';
import {LIGHT_ROUNDS,lightObjective} from './lights.js';
import {REQUESTS,PREPARATIONS} from './story.js';
const idFor=n=>n.name==='佳音寶寶'?'props':n.name==='佳音女寶寶'?'lights':n.name==='法蘭奇'?'audio':null;
export function missionStatus(m){
 if(m.phase==='gameover')return '這次彩排先休息一下，重新開始再一起準備吧。';
 if(m.phase==='won')return `準備完成，好戲開場！總分 ${m.score} 分。`;
 if(m.phase==='ready-to-open')return '舞台準備好了！音控台左邊的星星亮了，可以先去看看。想結算時，回一樓左側找佳音寶寶確認開演。';
 if(m.activeId==='props')return m.allCollected?'3 個道具已集齊！返回佳音寶寶身旁，按 E 交還。':'找齊 3 件道具。';
 if(m.activeId==='lights')return lightObjective(m.lights);
 if(m.activeId==='audio')return audioObjective(m.audio);
 return '開演準備中：找夥伴聽聽哪裡需要幫忙。先幫誰都可以，探索不計時。';
}
export function missionUi(m,getPlayer,onResult,onStart){
 return {
  status(n){
   const id=idFor(n);if(!id)return '待確認';
   if(id==='props'&&m.phase==='ready-to-open')return '等你確認開演';
   const r=m.records[id];if(r.state==='complete')return `${PREPARATIONS[id]} · ${r.score} 分`;
   if(m.phase==='gameover')return '本場結束';
   if(m.activeId===id&&id==='audio')return m.audio.carrying?'回音控台交還遙控器':`追逐 ${m.audio.stage+1} / 3`;
   if(m.activeId===id)return id==='props'?`道具 ${m.collected.size} / 3`:`回合 ${m.lights.round+1} / ${LIGHT_ROUNDS.length} · ${m.lights.stage==='demo'?'觀看示範':m.lights.stage==='round-clear'?'本回合通過':`${m.lights.progress} / ${m.lights.sequence.length}`}`;
   return m.activeId?'等待目前任務結束':'需要你的幫忙';
  },
  dialog(n){
   const id=idFor(n);if(!id)return {text:n.text,task:n.task+' · 內容待確認'};
   if(m.phase==='ready-to-open'){
    if(id==='props')return {
     text:'道具、燈光和音樂都準備好了！你還想在舞台逛逛嗎？等你準備好，我們就一起開演。',
     task:'選擇「正式開演並結算」會結束本場。也可以關閉對話，繼續探索。',
     label:'正式開演並結算',action:()=>onResult(m.openShow())
    };
    return {text:REQUESTS[id].thanks,task:'可以繼續探索。準備好開演時，再去找一樓左側的佳音寶寶。'};
   }
   const record=m.records[id];
   if(record.state==='complete')return {text:REQUESTS[id].thanks,task:`本項 ${record.score} 分已保存。再去看看其他夥伴，幫大家把舞台準備好吧！`};
   if(m.activeId&&m.activeId!==id)return {text:'先完成目前的任務，再來找我吧！',task:'一次進行一項任務，已完成的分數會保留。'};
   if(m.activeId===id){
    if(id==='audio')return {text:missionStatus(m),task:`剩餘 ${Math.ceil(m.remaining)} 秒 · 對話暫停音波與計時`,label:'交還遙控器',action:m.audio.carrying?()=>onResult(m.finishAudio(getPlayer())):undefined};
    if(id==='lights')return {text:missionStatus(m),task:`剩餘 ${Math.ceil(m.remaining)} 秒 · 本回合 ${m.lights.progress} / ${m.lights.sequence.length} · 對話暫停計時、示範與換回合`};
    return {text:m.allCollected?'3 個道具都找到了！一起交給我吧。':`目前找到 ${m.collected.size} / 3 個。尚缺：${PROPS.filter(item=>!m.collected.has(item.id)).map(item=>item.name).join('、')}`,task:`剩餘 ${Math.ceil(m.remaining)} 秒 · 對話期間暫停計時`,label:'交還全部 3 個道具',action:m.allCollected?()=>onResult(m.finish(getPlayer())):undefined};
   }
   const seconds=TASKS[id].seconds;
   const goal={props:'找齊 3 件道具並交還',lights:'3 回合，記住亮燈順序再踩踏板',audio:'攔住法蘭奇 3 次，追回遙控器'}[id];
   return {
    text:REQUESTS[id].text,
    summary:`${seconds} 秒 ・ ${goal}`,
    task:`${REQUESTS[id].instructions}\n\n彩排時間 ${seconds} 秒${id==='lights'?'（三回合共用，包含預備倒數、示範及換回合）':''}；完成 ${RULES.baseScore} 分＋每剩餘整秒 ${RULES.perSecond} 分。掉落、超時或任務中按 R 也會扣一次機會。`,
    label:REQUESTS[id].label,action:()=>{if(m.start(id))onStart();}
   };
  }
 };
}
