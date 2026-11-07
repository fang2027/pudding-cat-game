export const SIT_DEFAULTS=Object.freeze({pitch:22,drop:9,spread:15,forward:-3,delay:2.5});
const KEY='pudding-cat-sit-v1';
const fields=[
 ['pitch','抬胸角度（°）',0,65,1],
 ['drop','身體下沉（身高 %）',0,28,.5],
 ['spread','後腳外張（身高 %）',0,30,.5],
 ['forward','後腳前移（身高 %）',-15,25,.5],
 ['delay','坐下前等待（秒）',0,8,.1]
];

export function loadSitSettings(){
 const settings={...SIT_DEFAULTS};
 try{
  const saved=JSON.parse(localStorage.getItem(KEY));
  for(const [id,,min,max] of fields){
   if(Number.isFinite(saved?.[id]))settings[id]=Math.max(min,Math.min(max,saved[id]));
  }
 }catch{}
 return settings;
}

export function mountSitEditor(settings){
 const panel=document.createElement('section');
 panel.id='sit-editor';
 panel.innerHTML='<h2>布丁貓坐姿調整</h2><p>略過開場後停在原地。把等待調成 0 秒，可立即預覽坐姿。</p><div class="sit-fields"></div><button type="button" data-save>儲存到此瀏覽器</button> <button type="button" data-reset>還原預設</button> <a href="./">返回遊戲</a><p role="status"></p><label>坐姿數值（可複製分享） <input data-values readonly></label>';
 const values=panel.querySelector('[data-values]');
 const status=panel.querySelector('[role=status]');
 const controls=fields.map(([id,label,min,max,step])=>{
  const row=document.createElement('label');
  row.textContent=label;
  const slider=document.createElement('input');
  Object.assign(slider,{type:'range',min,max,step});
  const output=document.createElement('output');
  row.append(slider,output);
  panel.querySelector('.sit-fields').append(row);
  slider.oninput=()=>{
   settings[id]=slider.valueAsNumber;
   status.textContent='';
   refresh();
  };
  return {id,slider,output};
 });
 function refresh(){
  for(const {id,slider,output} of controls){slider.value=settings[id];output.value=settings[id];}
  values.value=JSON.stringify(settings);
 }
 panel.querySelector('[data-save]').onclick=()=>{
  try{localStorage.setItem(KEY,values.value);status.textContent='已儲存，可返回遊戲試玩。';}
  catch{status.textContent='瀏覽器無法儲存，可複製下方數值。';}
 };
 panel.querySelector('[data-reset]').onclick=()=>{Object.assign(settings,SIT_DEFAULTS);status.textContent='已還原預覽。按儲存可套用。';refresh();};
 values.onclick=()=>values.select();
 refresh();
 document.querySelector('#game').before(panel);
}
