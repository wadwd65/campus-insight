import {JOURNEY_CHAPTERS,JOURNEY_QUESTIONS} from '../lib/surveyJourney.js';
import {isKnownOption} from '../lib/surveySchema.js';
export default function CampusFieldLog({answers}){
  const selected=JOURNEY_QUESTIONS.filter(q=>isKnownOption(q.field,answers?.[q.field]));
  if(!selected.length)return null;
  return <section className="campus-field-log" aria-label="我的校园行迹，来自实际作答">
    <header><p>FIELD NOTES / {selected.length} 个生活切面</p><h2>先看看，你留下了哪些日常。</h2><span>以下原样保留你的选择。顺着五站读一遍，也许比一个称号更接近你。</span></header>
    <ol>{JOURNEY_CHAPTERS.map((chapter,i)=>{
      const entries=selected.filter(q=>q.chapter.id===chapter.id);if(!entries.length)return null;
      return <li key={chapter.id}><div className="field-stop"><b>0{i+1}</b><h3>{chapter.label}</h3><small>{chapter.scene}</small></div><dl>{entries.map(q=><div key={q.id}><dt>{q.focus}</dt><dd>{answers[q.field]}</dd></div>)}</dl></li>;
    })}</ol><p className="field-log-note">来自本次答卷 · 不补写经历 · 原始答案仍可导出</p>
  </section>;
}
