import {useMemo,useState} from 'react';
import {keepsakeMoments,keepsakeSvg,downloadKeepsake} from '../lib/campusMoments.js';
import './participation.css';

export default function CampusKeepsake({answers,onSkip,reportLink='#sec-1'}){
  const moments=useMemo(()=>keepsakeMoments(answers),[answers]);
  const [id,setId]=useState('Q6'),[caption,setCaption]=useState(''),[status,setStatus]=useState('idle');
  const moment=moments.find(m=>m.id===id)||moments[0];
  if(!moment)return null;
  const svg=keepsakeSvg(moment,caption);
  async function save(){
    setStatus('saving');
    try{await downloadKeepsake(moment,caption);setStatus('saved');}
    catch{setStatus('error');}
  }
  return <section className="campus-keepsake" aria-labelledby="keepsake-title"><div className="keepsake-heading"><span>留一点，只属于你的东西</span><h2 id="keepsake-title">把这一幕，留给以后的自己。</h2><p>从你选过的答案里挑一幕，再留一句自己的话。</p>{onSkip&&<a className="keepsake-skip" href={reportLink} onClick={onSkip}>先看报告，暂不制作 ↓</a>}</div>
    <div className="keepsake-layout"><img className="keepsake-preview" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} width="900" height="1160" alt={`纪念卡预览：${moment.title}，${moment.answer}${caption?`，留言：${caption}`:''}`}/>
      <div className="keepsake-controls"><fieldset disabled={status==='saving'}><legend>先选一幕</legend>{moments.map(m=><button key={m.id} type="button" aria-pressed={moment.id===m.id} onClick={()=>{setId(m.id);setStatus('idle');}}><span>{m.mark}</span><span><b>{m.title}</b><small>{m.answer}</small></span><i aria-hidden="true">{moment.id===m.id?'✓':'＋'}</i></button>)}</fieldset>
        <label htmlFor="keepsake-caption">给以后的自己留句话 <small>选填 · 40字以内</small><input id="keepsake-caption" disabled={status==='saving'} value={caption} maxLength={40} placeholder="比如：下次，还想和你们一起坐在这里。" onChange={e=>{setCaption(e.target.value);setStatus('idle');}}/></label>
        <button type="button" className="keepsake-save" disabled={status==='saving'} onClick={save}>{status==='saving'?'正在制作图片…':'保存我的纪念卡 ↓'}</button>
        <p className="keepsake-note" role="status">{status==='saved'?'图片已交给浏览器下载，请在下载列表查看。':status==='error'?'图片暂未生成，你仍可直接截图保存上方预览。':'留言只用于这张本机图片，不会修改答卷或提交到圈子。'}</p>
      </div></div>
  </section>;
}
