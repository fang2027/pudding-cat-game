import {RULES,PROPS} from './mission.js';
import {LIGHT_RULES} from './lights.js';
const idFor=n=>n.name==='佳音寶寶'?'props':n.name==='佳音女寶寶'?'lights':null;
export function missionStatus(m){
 if(m.phase==='gameover')return '本場結束';
 if(m.activeId==='props')return m.allCollected?'3 個道具已集齊！返回佳音寶寶身旁，按 E 交還。':'尋找 3 個道具：一樓右端、二樓右側與二樓左端。';
 if(m.activeId==='lights')return m.lights.stage==='demo'?'先看燈光示範：記住 A、B、C 亮起的順序！':'輪到你了！依記憶順序踩踏板，跳過目前不該踩的踏板。';
 return '自由探索：找佳音寶寶或佳音女寶寶接任務，可自由選擇先後。';
}
export function missionUi(m,getPlayer,onResult,onStart){
 return {
  status(n){
   const id=idFor(n);if(!id)return '待確認';
   const r=m.records[id];if(r.state==='complete')return `已完成 · ${r.score} 分`;
   if(m.phase==='gameover')return '本場結束';
   if(m.activeId===id)return id==='props'?`道具 ${m.collected.size} / 3`:`${m.lights.stage==='demo'?'觀看示範':'依序踩踏'} · ${m.lights.progress} / 3`;
   return m.activeId?'等待目前任務結束':'可接受任務';
  },
  dialog(n){
   const id=idFor(n);if(!id)return {text:n.text,task:n.task+' · 內容待確認'};
   const record=m.records[id];
   if(record.state==='complete')return {text:'謝謝你幫忙，這項任務已完成！',task:`本項 ${record.score} 分已保存。法蘭奇的任務仍待確認。`};
   if(m.activeId&&m.activeId!==id)return {text:'先完成目前的任務，再來找我吧！',task:'一次進行一項任務，已完成的分數會保留。'};
   if(m.activeId===id){
    if(id==='lights')return {text:missionStatus(m),task:`剩餘 ${Math.ceil(m.remaining)} 秒 · 已踩 ${m.lights.progress} / 3 · 對話暫停計時與示範`};
    return {text:m.allCollected?'3 個道具都找到了！一起交給我吧。':`目前找到 ${m.collected.size} / 3 個。尚缺：${PROPS.filter(item=>!m.collected.has(item.id)).map(item=>item.name+'（'+item.place+'）').join('、')}`,task:`剩餘 ${Math.ceil(m.remaining)} 秒 · 對話期間暫停計時`,label:'交還全部 3 個道具',action:m.allCollected?()=>onResult(m.finish(getPlayer())):undefined};
   }
   const seconds=id==='props'?RULES.seconds:LIGHT_RULES.seconds;
   return {
    text:id==='props'?'3 個道具散在一樓右端、二樓右側及二樓左端！從右側箱子與紫色踏階跳上二樓，找齊後一起帶回來。':'先看三個燈光踏板依序亮起，再照記憶順序踩 A、B、C。示範時先停下來看，結束後就能移動；跳過還不該踩的踏板，踩錯會扣一次機會並結束本次挑戰。',
    task:`試玩 ${seconds} 秒${id==='lights'?'（包含示範）':''}；完成 ${RULES.baseScore} 分＋每剩餘整秒 ${RULES.perSecond} 分。掉落、超時或任務中按 R 也會扣一次機會。`,
    label:id==='lights'?'接受任務，觀看燈光':'接受任務，開始計時',action:()=>{if(m.start(id))onStart();}
   };
  }
 };
}
