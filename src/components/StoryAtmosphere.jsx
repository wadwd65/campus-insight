import {memo,useId} from 'react';
import './story-atmosphere.css';
const RAIN=Array.from({length:24},(_,i)=>({left:`${(i*43+7)%101}%`,delay:`${-(i%9)*.31}s`,duration:`${1.1+(i%5)*.19}s`}));
function StoryAtmosphere({cue,moving=false}){
  if(!cue)return null;
  return <div className={`story-atmosphere mood-${cue.mood} weather-${cue.weather} ${moving?'is-moving':'is-still'}`} aria-hidden="true" data-story-effect={cue.effect}>
    <div className="story-atmosphere-tint"/><div className="story-atmosphere-horizon"/>
    {cue.weather==='rain'&&<><div className="story-screen-rain">{RAIN.map((drop,i)=><i key={i} style={{left:drop.left,'--rain-line':i,'--rain-delay':drop.delay,'--rain-speed':drop.duration}}/>)}</div><div className="story-glass-drops">{[0,1,2,3,4].map(i=><i key={i} style={{left:`${12+i*19}%`,top:`${15+(i*23)%69}%`,'--drop-delay':`${-i*1.1}s`}}/>)}</div></>}
    {cue.effect!=='none'&&<div key={cue.eventKey} className={`story-choice-flash effect-${cue.effect}`}>{[0,1,2,3,4,5].map(i=><i key={i} style={{'--item':i}}>{cue.effect==='notes'?'♪':cue.effect==='tickets'?'▱':cue.effect==='messages'?'◇':'+'}</i>)}</div>}
  </div>;
}
export default memo(StoryAtmosphere);
export function StoryStage({cue,moving=false}){
  const id=useId().replace(/:/g,'');
  const extra=cue.episodeId&&cue.episodeId!=='screening';
  const projection=['indoor','corridor'].includes(cue.mood)||cue.effect==='projector',social=cue.mood==='social',live=cue.mood==='live'||cue.effect==='notes'||cue.effect==='sound';
  return <figure className={`story-stage mood-${cue.mood} effect-${cue.effect} ${moving?'is-moving':'is-still'}`} aria-label={cue.label}>
    <svg viewBox="0 0 700 220" role="img" aria-label={cue.label}><defs><pattern id={id} width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#aac4b8" opacity=".12"/></pattern></defs>
      <rect width="700" height="220" className="stage-sky"/><rect width="700" height="220" fill={`url(#${id})`}/><circle cx="581" cy="47" r="24" className="stage-sun"/>
      <g className="stage-buildings" fill="#527277" stroke="#a7bdb4" strokeWidth="1"><path d="M22 173V82L111 59l88 23v91M486 173V75l83-26 89 26v98"/>{[43,76,133,165,509,542,589,622].map(x=><rect key={x} x={x} y="98" width="14" height="26" className="stage-window"/>)}</g>
      <path d="M0 177h700m-340 0-38 43m142-43 51 43" stroke="#adc3ae" opacity=".5" fill="none"/>
      <g style={{display:extra?'none':undefined}}><path d="M231 172V62h235v110" fill="#e5e7cd" stroke="#b8c7b3" strokeWidth="2"/><path d="M224 60h249" stroke="#c4d1bd" strokeWidth="5"/>{projection?<><path d="m167 172 70-100v93Z" className="stage-projector-beam" fill="#f6d796" opacity=".23"/><rect x="250" y="80" width="195" height="74" fill="#aec9c0"/><path d="m250 135 50-26 50 24 43-35 52 41v15H250Z" fill="#779f94"/><circle cx="419" cy="96" r="10" fill="#e9ce8f"/><path d="m333 99 24 16-24 16Z" fill="#f6f1d9"/></>:<><text x="349" y="111" textAnchor="middle" fontSize="23" fill="#405f62" letterSpacing="6">{cue.mood==='ticket'?'下次见':live?'今晚有声音':'晚风放映计划'}</text><path d="M271 132h155" stroke="#a68b53" strokeDasharray="3 7"/></>}</g>
      {!extra&&['workshop','library'].includes(cue.mood)&&<g fill="#b1c6a4" stroke="#e4d4ad"><rect x="36" y="143" width="103" height="31"/><path d="M53 143v-16h20v16m11 0v-24h24v24"/><text x="88" y="164" fontSize="9" fill="#314e56" textAnchor="middle">{cue.mood==='library'?'备用场地 / 已找到':'设备柜 / 查找中'}</text></g>}
      {!extra&&(social||cue.effect==='messages')&&<g className="stage-message-signals" fill="#d6debc" stroke="#719b92"><path d="M70 122h73v31H99l-12 10v-10H70Z"/><path d="M520 126h79v33h-43l-13 9v-9h-23Z"/><circle cx="89" cy="137" r="2"/><circle cx="106" cy="137" r="2"/><circle cx="123" cy="137" r="2"/></g>}
      {cue.weather!=='dry'&&<g className="stage-rain" stroke="#c8e3e8" strokeWidth="1.2" opacity=".55">{Array.from({length:15},(_,i)=><path key={i} d={`m${i*51+9} ${12+(i%3)*19}-13 29`}/>)}</g>}
      {(cue.mood==='corridor'||cue.effect==='canopy')&&<path d="M193 49h315l-26 19H216Z" fill="#667b77" stroke="#bfd0b7"/>}
      <g fill="#d4c39a" stroke="#d4c39a" strokeWidth="2">{(cue.effect==='seats'?[242,350,443]:[195,242,291,391,443,493]).map((x,i)=><g key={x} className={live?'stage-audience is-live':'stage-audience'} style={{'--audience':i}}><circle cx={x} cy={187+(i%2)*6} r="5"/><path d={`M${x} ${193+(i%2)*6}v17m-8-9 8-5 8 5`} fill="none"/></g>)}</g>
      {live&&<g className="stage-notes" fontSize="20" fill="#e7d38f"><text x="159" y="135">♪</text><text x="492" y="111">♫</text><text x="530" y="154">♪</text></g>}
      {cue.mood==='ticket'&&<g fill="#e4d2a7" stroke="#a88b55"><path d="m490 136 52-8 8 37-52 8Z"/><path d="m501 143 30-4m-27 12 30-4"/></g>}
      {extra&&<g className={`stage-episode-art episode-art-${cue.episodeId}`} stroke="#c9d7bc" strokeWidth="2">
        {cue.episodeId==='lost'?<><rect x="218" y="64" width="257" height="112" fill="#3c5c62"/>{[0,1,2,3].map(i=><g key={i}><rect x={228+i*60} y="75" width="51" height="90" fill={i===1?'#d7c38f':'#77978a'}/><text x={253+i*60} y="101" textAnchor="middle" fill="#2e4c52" fontSize="13" stroke="none">{16+i}</text><circle cx={263+i*60} cy="130" r="3"/></g>)}<circle cx="166" cy="123" r="15" fill="none"/><path d="M166 138v34m0-11h13m-13 7h9"/><path d="M521 87h61v72h-61Z" fill="#dbddbc"/><path d="M531 103h41m-41 13h29m-29 13h34" stroke="#7a8c73"/></>:cue.episodeId==='repair'?<><path d="M178 169h349m-323 0v34m298-34v34"/><rect x="247" y="85" width="185" height="83" rx="9" fill="#c3aa79"/><circle cx="290" cy="124" r="25" fill="#3c5c62"/><path d="M275 109l30 30m-30 0 30-30" opacity=".4"/><rect x="334" y="100" width="80" height="21" fill="#526e6d"/><circle cx="349" cy="144" r="7"/><circle cx="393" cy="144" r="7"/><path d="m395 85 21-48m48 123 28-30m-21 1 20 20"/><rect x="179" y="121" width="38" height="46" fill="#879e80"/></>:<><rect x="239" y="75" width="231" height="94" rx="5" fill="#344e59"/><rect x="302" y="91" width="106" height="27" fill="#c2aa79"/><text x="355" y="109" textAnchor="middle" fontSize="14" fill="#324c53" stroke="none">ON AIR</text><path d="M255 139h198m-187-8v16m15-19v22m15-12v9m15-17v23m15-15v12m15-20v25m15-29v33m15-22v13m15-19v25m15-17v12m15-21v28m15-19v12" stroke="#a9c3a6"/><rect x="181" y="82" width="23" height="43" rx="11" fill="#b5c8ad"/><path d="M172 108v8a20 20 0 0041 0v-8m-20 29v30m-18 0h36"/><path d="m492 94 15 15-15 15m13-44 29 29-29 29" fill="none"/></>}
        <text x="350" y="54" textAnchor="middle" fontSize="17" fill="#e2dec1" stroke="none" letterSpacing="3">{cue.title}</text>
      </g>}
      <text x="20" y="27"  fontFamily="monospace" fontSize="9" letterSpacing="2" fill="#d9e0c9">CAMPUS / SCENE IN MOTION</text>
    </svg><figcaption><span>{cue.label}</span><small>{cue.weather==='rain'?'雨落在屏幕外，也落进这一幕':cue.weather==='window'?'把雨留在窗外，把这一晚留住':extra?'线索、工具和声音，跟着你的决定留下来':'你的选择，让场景往前走了一点'}</small></figcaption>
  </figure>;
}
