export const OPENING = [
 {title:'今天，換布丁貓當主角！',text:'觀眾已經進場。布丁貓第一次擔任主角，滿心期待走進舞台，想像自己站在聚光燈下謝幕的樣子。',cue:'幕後傳來一陣忙亂的聲音……'},
 {title:'等等，我們還不能開演！',text:'燈光忽明忽暗，音響傳出怪聲，一顆道具星星從箱子裡滾了出來。佳音寶寶探頭喊：「布丁貓！你來得正好……我們好像還不能開演！」',cue:'道具散落了、燈光需要排練，法蘭奇還叼走了遙控器！'},
 {title:'一起把舞台準備好！',text:'先去看看誰需要幫忙吧！找回道具、完成燈光排練，再把音響遙控器帶回來。三件事都準備好，好戲就能開場。',cue:'任務順序由你決定。自由探索不計時，按 E 聽夥伴說話，選擇「我來幫忙」才開始挑戰。'}
];
export const PREPARATIONS = {props:'道具就位',lights:'燈光就位',audio:'音樂就位'};
export const REQUESTS = {
 props:{text:'「剛剛搬布景時晃了一下，星星、寶石和圓環全滾出去了！」佳音寶寶抱著空箱子，急得四處張望。「換景彩排要開始了，你能幫我找回來嗎？」',instructions:'3 個道具在右側側台、左後台和二樓燈架工作走道。從左右側台按 ↑ 進後台，再踩後台的箱子與紫色踏階上樓，全部找齊後回來按 E 交還。',label:'我來幫忙，找回道具！',thanks:'「星星、寶石、圓環都到齊了！謝謝你，佈景終於準備好了！」'},
 lights:{text:'佳音女寶寶拿著流程表，看了看忽明忽暗的燈光。「正式演出時，要照順序踩踏板，燈光才會跟上你。我先示範，我們一起練三段，好嗎？」',instructions:'每回合先回到我面前，倒數 3、2、1 後看示範。三回合分別記住 3／4／5 次亮燈，再依序踩 A、B、C。後兩回合有重複且逐漸加快；同一踏板連亮，要離開再踩回或原地跳一下。踩錯扣一次機會，重試從第一回合開始。',label:'我來排練，觀看燈光！',thanks:'「就是這樣！三段燈光都對好了，到時候放心站上舞台吧！」'},
 audio:{text:'音控台旁，法蘭奇正撥弄著叼來的遙控器。佳音寶寶喊：「那是播放開場音樂用的！」法蘭奇歪歪頭，以為大家要陪他玩追逐遊戲。「快攔住他，別讓喇叭繼續亂響！」',instructions:'從右側側台按 ↑ 進後台，先到左喇叭左側按 E 攔住他。喇叭啟動後，再追到後台最右端按 E；他會再逃往燈架走道。從後台的箱子與紫色踏階上樓，第三次同層落地按 E 取回遙控器，再回音控台交還。喇叭黃色預警後發出紅色音波，等綠色或跳過。',label:'我來追回遙控器！',thanks:'「音樂準備好了！法蘭奇把安可影片留在音控台左邊，去看看亮起來的星星吧！」'}
};

// The opening owns its modal; the game uses .open to pause every simulation.
export function setupOpening(clearInput){
 const dialog=document.querySelector('#opening');let page=0,onMenu=true;
 const menu=document.querySelector('#opening-menu');
 const story=document.querySelector('#opening-story');
 const start=document.querySelector('#game-start');
 const next=document.querySelector('#story-next');
 const nextLabel=next.querySelector('span');
 function render(){
  const beat=OPENING[page];
  story.setAttribute('data-beat',String(page+1));
  document.querySelector('#story-title').textContent=beat.title;
  document.querySelector('#story-text').textContent=beat.text;
  document.querySelector('#story-cue').textContent=beat.cue;
  document.querySelector('#story-step').textContent=`開演前大危機 · ${page+1} / ${OPENING.length}`;
  nextLabel.textContent=page===OPENING.length-1?'出發，幫大家準備！':'接下來呢？';
 }
 start.onclick=()=>{
  if(!onMenu)return;
  onMenu=false;clearInput();menu.hidden=true;story.hidden=false;
  dialog.setAttribute('aria-labelledby','story-title');
  render();next.focus();
 };
 function close(){dialog.close();clearInput();}
 next.onclick=()=>{if(page===OPENING.length-1)close();else{page++;render();}};
 document.querySelector('#story-skip').onclick=close;
 dialog.addEventListener('keydown',e=>{
  if(e.code!=='KeyE'||e.repeat||e.defaultPrevented)return;
  e.preventDefault();
  if(onMenu)start.onclick();else next.onclick();
 });
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(!onMenu){page=OPENING.length-1;render();}});
 dialog.addEventListener('close',clearInput);
 return {get open(){return dialog.open;},get menu(){return dialog.open&&onMenu;},show(){page=0;onMenu=true;clearInput();menu.hidden=false;story.hidden=true;dialog.setAttribute('aria-labelledby','menu-title');dialog.showModal();start.focus();}};
}
