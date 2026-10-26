import {useId,useState} from 'react';
import {THEATRE_SCENES} from '../lib/campusMoments.js';
import './participation.css';

function CampusScene({scene,choice}){
  const id=useId().replace(/:/g,'');
  return <svg className="theatre-scene" viewBox="0 0 420 175" aria-hidden="true"><defs><pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#7b98a3" strokeWidth=".4" opacity=".25"/></pattern></defs>
    <rect width="420" height="175" fill="#344b57"/><rect width="420" height="175" fill={`url(#${id})`}/>
    <g fill="#3e5965" stroke="#a7b9b8" strokeWidth="1"><path d="M100 125V59l94-23 93 23v66Z"/><path d="m90 61 104-29 104 29" fill="none"/><path d="M194 62v63"/>{[123,151,216,244].map(x=><rect key={x} x={x} y="73" width="16" height="27" fill={scene.id==='night'?'#baa572':'#738f96'}/>)}</g>
    <path d="M31 142h103l33 16h151l39-23h38" stroke="#9cb5b4" fill="none" strokeWidth="1.2"/>
    <g stroke="#9fb9b8" fill="none"><circle cx="51" cy="117" r="15"/><path d="M51 102v50m-12-35h24"/><circle cx="339" cy="99" r="20"/><path d="M339 79v65m-15-45h30"/><path d="M16 40V16h24m340 143h24v-24" stroke="#b9a06a"/></g>
    <path d={choice?'M51 151h61l56-18h102l69 11':'M51 151h61l56-18h102'} fill="none" stroke={choice?'#e3be7b':'#7e969b'} strokeWidth="2" strokeDasharray={choice?'none':'3 5'}/>
    <circle cx={choice?270:168} cy="133" r="4" fill="#edd49c"/>{choice&&<><rect x="293" y="111" width="26" height="23" fill="#d8c295"/><text x="306" y="127" textAnchor="middle" fontSize="12" fill="#344b57">{choice.mark}</text></>}
    <text x="19" y="30" fontSize="9" fontFamily="monospace" letterSpacing="1.5" fill="#c4d1ca">{scene.time} / CAMPUS INTERLUDE</text><text x="294" y="163" fontSize="8" fontFamily="monospace" fill="#a5bab9">FIELD NOTE / 0{scene.id==='morning'?1:scene.id==='afternoon'?2:3}</text>
  </svg>;
}
export default function CampusTheatre({onStart}){
  const [index,setIndex]=useState(0),[choices,setChoices]=useState({});
  const scene=THEATRE_SCENES[index],choice=scene.choices.find(c=>c.text===choices[scene.id]),complete=THEATRE_SCENES.every(s=>choices[s.id]);
  return <section className="campus-theatre" aria-label="校园选择小剧场" style={{'--theatre-accent':scene.ink}}>
    <header><span>三段校园切片 / INTERLUDE</span><button type="button" onClick={onStart}>跳过试玩 →</button></header>
    <nav className="theatre-tabs" aria-label="切换试玩片段">{THEATRE_SCENES.map((s,i)=><button key={s.id} type="button" aria-pressed={index===i} onClick={()=>setIndex(i)}><small>{choices[s.id]?'✓':`0${i+1}`}</small>{s.label}</button>)}</nav>
    <CampusScene scene={scene} choice={choice}/><h2>{scene.title}</h2>
    <div className="theatre-choices" aria-label={scene.title}>{scene.choices.map((c,i)=><button key={c.text} type="button" aria-pressed={choice===c} onClick={()=>setChoices(previous=>({...previous,[scene.id]:c.text}))}><span>{String.fromCharCode(65+i)}</span>{c.text}<i aria-hidden="true">{choice===c?'✓':'↗'}</i></button>)}</div>
    <div className="theatre-response" role="status" aria-live="polite">{choice?<><span aria-hidden="true">✦</span><p>{choice.line}</p></>:<p>点一个选择，让这一幕开始。</p>}</div>
    <footer>{complete?<><p className="theatre-complete">三段切片已收好。再走五站，留下一份校园记录。</p><button type="button" className="theatre-next" onClick={onStart}>开始测评，写我的故事 →</button><button type="button" className="theatre-replay" onClick={()=>{setChoices({});setIndex(0);}}>换一种过法，再玩一次</button></>:<button type="button" className="theatre-next" disabled={!choice} onClick={()=>setIndex((index+1)%THEATRE_SCENES.length)}>看看{THEATRE_SCENES[(index+1)%3].label} →</button>}
    <small>试玩不写入答卷；正式测评以你逐题确认的答案为准。</small></footer>
  </section>;
}
