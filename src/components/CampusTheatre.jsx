import {useId,useState} from 'react';
import {THEATRE_SCENES} from '../lib/campusMoments.js';
import './participation.css';

function CampusScene({scene,choice}){
  const id=useId().replace(/:/g,''),night=scene.id==='night';
  return <svg className="theatre-scene" viewBox="0 0 420 175" aria-hidden="true"><defs><linearGradient id={id} x2="0" y2="1"><stop stopColor={scene.sky}/><stop offset="1" stopColor={night?'#c7c4d2':'#fff0d5'}/></linearGradient></defs>
    <rect width="420" height="175" rx="12" fill={`url(#${id})`}/><circle cx="345" cy="37" r="19" fill={night?'#f2efd3':'#ffedbf'}/>{night&&<circle cx="354" cy="29" r="17" fill={scene.sky}/>}
    <path d="M0 139Q80 101 190 135T420 128V175H0Z" fill={scene.ground}/><path d="M53 169q88-52 194-5" fill="none" stroke="#f3ecd5" strokeWidth="15"/>
    <path d="M116 133V70l81-22 83 22v63" fill="#f7edda"/><path d="m105 70 92-27 95 27" fill="none" stroke={scene.ink} strokeWidth="7"/><path d="M197 76v57" stroke="#c9c6a5" strokeWidth="12"/>
    {[137,165,218,246].map(x=><rect key={x} x={x} y="81" width="16" height="24" rx="2" fill={night?'#f0d790':scene.ink} opacity=".7"/>)}
    <path d="M43 143V86m295 60V99" stroke="#887c5d" strokeWidth="7"/>{[[43,84,25],[338,94,29]].map(([x,y,r])=><g key={x}><circle cx={x} cy={y} r={r} fill={night?'#6c8c82':'#84a68e'}/><circle cx={x-12} cy={y+9} r={r*.65} fill="#99b498"/></g>)}
    <g className="theatre-person" transform={`translate(${choice?270:306} 127)`}><circle cy="-15" r="7" fill="#344e44"/><path d="M0-5V14m-11-6L0-2l12 9M0 14l-9 16m9-16 10 15" fill="none" stroke="#507d68" strokeWidth="5" strokeLinecap="round"/>{choice&&<><circle cx="29" cy="-22" r="16" fill="#fff9e9"/><text x="29" y="-17" textAnchor="middle" fontSize="13" fill={scene.ink}>{choice.mark}</text></>}</g>
    <text x="17" y="28" fontSize="11" fill={night?'#fff9e7':scene.ink}>校园小剧场 · {scene.time}</text>
  </svg>;
}
export default function CampusTheatre({onStart}){
  const [index,setIndex]=useState(0),[choices,setChoices]=useState({});
  const scene=THEATRE_SCENES[index],choice=scene.choices.find(c=>c.text===choices[scene.id]),complete=THEATRE_SCENES.every(s=>choices[s.id]);
  return <section className="campus-theatre" aria-label="校园选择小剧场" style={{'--theatre-accent':scene.ink}}>
    <header><span>先玩三幕，再认识自己</span><button type="button" onClick={onStart}>跳过试玩 →</button></header>
    <nav className="theatre-tabs" aria-label="切换试玩片段">{THEATRE_SCENES.map((s,i)=><button key={s.id} type="button" aria-pressed={index===i} onClick={()=>setIndex(i)}><small>{choices[s.id]?'✓':`0${i+1}`}</small>{s.label}</button>)}</nav>
    <CampusScene scene={scene} choice={choice}/><h2>{scene.title}</h2>
    <div className="theatre-choices" aria-label={scene.title}>{scene.choices.map((c,i)=><button key={c.text} type="button" aria-pressed={choice===c} onClick={()=>setChoices(previous=>({...previous,[scene.id]:c.text}))}><span>{String.fromCharCode(65+i)}</span>{c.text}<i aria-hidden="true">{choice===c?'✓':'↗'}</i></button>)}</div>
    <div className="theatre-response" role="status" aria-live="polite">{choice?<><span aria-hidden="true">✦</span><p>{choice.line}</p></>:<p>点一个选择，让这一幕开始。</p>}</div>
    <footer>{complete?<><p className="theatre-complete">三幕已收好。完整的你，还藏在更多日常里。</p><button type="button" className="theatre-next" onClick={onStart}>开始测评，写我的故事 →</button><button type="button" className="theatre-replay" onClick={()=>{setChoices({});setIndex(0);}}>换一种过法，再玩一次</button></>:<button type="button" className="theatre-next" disabled={!choice} onClick={()=>setIndex((index+1)%THEATRE_SCENES.length)}>看看{THEATRE_SCENES[(index+1)%3].label} →</button>}
    <small>试玩不写入答卷；正式测评以你逐题确认的答案为准。</small></footer>
  </section>;
}
