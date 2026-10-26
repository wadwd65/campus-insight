import {QUESTIONS,isKnownOption} from './surveySchema.js';

export const MOMENTS={
  Q1:{line:'晚一点的灯光，也有你的落脚处。',title:'夜里还亮着的灯',mark:'月',color:'#686792'},Q2:{line:'这一次，复习节奏由你来定。',title:'期末前的一页',mark:'书',color:'#aa7a4e'},
  Q3:{line:'这一口日常，已经记下了。',title:'夜宵的约定',mark:'食',color:'#b47850'},Q4:{line:'想加入的热闹，你已经选好了。',title:'想加入的热闹',mark:'友',color:'#748967'},
  Q5:{line:'日子里的小计划，按自己的节奏来。',title:'口袋里的小计划',mark:'记',color:'#8c7a58'},Q6:{line:'这一幕，想留到毕业以后。',title:'想留住的大学',mark:'留',color:'#aa796c'},
  Q7:{line:'早晨这一幕，按你的时间开场。',title:'早八前的开场',mark:'早',color:'#b17c48'},Q8:{line:'操场上的这一刻，留给你自己。',title:'操场边的自己',mark:'动',color:'#578474'},
  Q9:{line:'给不顺心的日子，留一个停靠。',title:'不顺心时的停靠',mark:'歇',color:'#74869b'},Q10:{line:'这一帧，留给以后翻相册的自己。',title:'相册里的定格',mark:'影',color:'#9d7586'},
};
const sceneSpecs=[
  {id:'morning',questionId:'Q7',time:'07:50',label:'早八开场',title:'今天的第一幕，你会怎样出场？',sky:'#f2cfa4',ground:'#d9dfc2',ink:'#745639',choices:[
    [0,'前排，留给提前到的自己。','书'],[1,'铃声响起，刚好赶上这一幕。','跑'],[4,'你的清晨，有自己的开场时间。','晴'],
  ]},
  {id:'afternoon',questionId:'Q8',time:'17:40',label:'课后留白',title:'下课后的这段时间，镜头给谁？',sky:'#b9dcd8',ground:'#d8e6c1',ink:'#3c6e62',choices:[
    [0,'耳机一戴，这圈跑道只属于你。','跑'],[1,'球落地的声音里，还有队友的回应。','球'],[4,'今天，坐在树下看看也很好。','歇'],
  ]},
  {id:'night',questionId:'Q1',time:'22:30',label:'深夜收尾',title:'忙完一天，你想把结尾留在哪儿？',sky:'#797caa',ground:'#b7c7b9',ink:'#5b5b82',choices:[
    [1,'把最后一盏灯，留给还没翻完的那一页。','书'],[2,'晚风顺着跑道，把这一天吹慢一点。','跑'],[3,'从窗口接过一份热乎的收尾。','食'],
  ]},
];
export const THEATRE_SCENES=sceneSpecs.map(spec=>{
  const question=QUESTIONS.find(q=>q.id===spec.questionId);
  return {...spec,field:question.field,choices:spec.choices.map(([index,line,mark])=>({text:question.options[index].text,line,mark}))};
});
export function keepsakeMoments(answers){
  return ['Q6','Q8','Q10'].flatMap(id=>{const q=QUESTIONS.find(q=>q.id===id),text=answers?.[q.field];return isKnownOption(q.field,text)?[{id,field:q.field,answer:text,...MOMENTS[id]}]:[];});
}
const xml=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const lines=(text,length)=>{const chars=Array.from(text),result=[];for(let i=0;i<chars.length;i+=length)result.push(chars.slice(i,i+length).join(''));return result;};
export function keepsakeSvg(moment,caption=''){
  const question=QUESTIONS.find(q=>q.id===moment?.id);
  if(!question||!isKnownOption(question.field,moment.answer))throw new Error('请选择一条有效的校园片段。');
  const meta=MOMENTS[question.id],note=Array.from(typeof caption==='string'?caption.trim():'').slice(0,40).join('');
  const answer=lines(moment.answer,15).map((text,i)=>`<tspan x="78" y="${705+i*51}">${xml(text)}</tspan>`).join('');
  const words=lines(note||'这一幕，我想留给以后的自己。',19).map((text,i)=>`<tspan x="78" y="${900+i*40}">${xml(text)}</tspan>`).join('');
  const motif=question.id==='Q8'?`<ellipse cx="420" cy="504" rx="173" ry="48" fill="none" stroke="${meta.color}" stroke-width="11" opacity=".6"/><ellipse cx="420" cy="504" rx="145" ry="32" fill="none" stroke="#f8edd9" stroke-width="3"/><path d="M420 474v62" stroke="#f8edd9" stroke-width="3"/>`:question.id==='Q10'?`<rect x="340" y="415" width="158" height="116" rx="16" fill="#f8edda" stroke="${meta.color}" stroke-width="7"/><circle cx="419" cy="472" r="32" fill="#c8d8cb" stroke="${meta.color}" stroke-width="7"/><path d="M366 415v-17h48v17" fill="none" stroke="${meta.color}" stroke-width="8"/>`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1160" viewBox="0 0 900 1160"><rect width="900" height="1160" fill="#f9f2e6"/><rect x="28" y="28" width="844" height="1104" rx="22" fill="none" stroke="#d7c6ab"/><g font-family="Microsoft YaHei,PingFang SC,sans-serif"><text x="78" y="104" fill="#53634e" font-size="21" letter-spacing="3">CAMPUS INSIGHT / 我的校园片段</text><rect x="66" y="153" width="768" height="422" rx="14" fill="#dce6d6"/><circle cx="690" cy="247" r="48" fill="#e9b978"/><path d="M66 480Q280 373 480 471T834 450V575H66Z" fill="#9cbaa4"/><path d="M210 495V308L425 256 642 308V495" fill="#f8ecd5"/><path d="M188 309 425 239 664 309" fill="none" stroke="${meta.color}" stroke-width="18"/><path d="M425 339v153" stroke="#bec7af" stroke-width="20"/><g fill="${meta.color}"><path d="M258 349h62v52h-62Zm95 0h35v52h-35Zm124 0h43v52h-43Zm77 0h46v52h-46Z" opacity=".65"/><circle cx="711" cy="451" r="19"/><path d="M711 474v56m-25-36 25-13 26 13m-26 36-17 25m17-25 20 25" fill="none" stroke="${meta.color}" stroke-width="11" stroke-linecap="round"/></g>${motif}<text x="78" y="640" fill="#64624e" font-size="23">${xml(meta.title)} / 来自我的问卷选择</text><text fill="#314d3e" font-size="39" font-weight="600">${answer}</text><path d="M78 831h744" stroke="#d4c8b5"/><text fill="#716652" font-size="27">${words}</text><text x="78" y="1055" fill="#5d695a" font-size="20">自己选的一幕，自己写的一句话。</text><text x="78" y="1090" fill="#5d695a" font-size="17">个人校园记录 · 非测评结论 · 你的大学平行宇宙</text></g></svg>`;
}
export async function downloadKeepsake(moment,caption){
  const source=URL.createObjectURL(new Blob([keepsakeSvg(moment,caption)],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('图片未能生成'));image.src=source;});
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1160;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('图片未能生成');ctx.drawImage(image,0,0);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片未能生成')),'image/png'));
    const target=URL.createObjectURL(blob),a=document.createElement('a');a.href=target;a.download='campus-insight-我的校园片段.png';a.click();window.setTimeout(()=>URL.revokeObjectURL(target),1000);
  }finally{URL.revokeObjectURL(source);}
}
