import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {AMBIENT_TRACKS,AMBIENT_VOLUME,MUSIC_SCENES,musicScene,sceneTrackIndices,nextSceneTrackIndex,sceneTrackIndex,motionAllowed,nextTrackIndex,playbackVolume} from '../lib/ambience.js';
import CampusCompanion from './CampusCompanion.jsx';
import StoryAtmosphere from './StoryAtmosphere.jsx';
const ExperienceContext=createContext({moving:false,notify:()=>{},setMusicScene:()=>{},setCompanionEgg:()=>{},setStoryCue:()=>{}});
export const useExperience=()=>useContext(ExperienceContext);

export default function ExperienceSettings({children,companion=true}){
  const [paused,setPaused]=useState(false),[hidden,setHidden]=useState(false),[reduced,setReduced]=useState(true),[compact,setCompact]=useState(false);
  const [audioState,setAudioState]=useState('off'),[volume,setVolume]=useState(AMBIENT_VOLUME),[trackIndex,setTrackIndex]=useState(()=>sceneTrackIndex('entry')),[mode,setMode]=useState('cycle'),[showMusic,setShowMusic]=useState(false),[notice,setNotice]=useState(null);
  const [stage,setMusicScene]=useState('entry'),[followScene,setFollowScene]=useState(true);
  const [companionEgg,setCompanionEgg]=useState(null);
  useEffect(()=>{setNotice(null);},[stage]);
  const [storyCue,setStoryCue]=useState(null);
  const audio=useRef(null),generation=useRef(0),intent=useRef(false),noticeId=useRef(0),volumeRef=useRef(AMBIENT_VOLUME);
  const previousScene=useRef(null);
  const notify=useCallback(text=>setNotice({id:++noticeId.current,text}),[]);
  useEffect(()=>{
    const element=audio.current,calm=window.matchMedia('(prefers-reduced-motion: reduce)'),small=window.matchMedia('(max-width: 700px)');
    const update=()=>{setReduced(calm.matches);setCompact(small.matches);};
    const visibility=()=>{setHidden(document.hidden);if(document.hidden){generation.current++;intent.current=false;element?.pause();setAudioState(s=>s==='off'||s==='error'?s:'paused');}};
    update();visibility();calm.addEventListener('change',update);small.addEventListener('change',update);document.addEventListener('visibilitychange',visibility);
    return ()=>{calm.removeEventListener('change',update);small.removeEventListener('change',update);document.removeEventListener('visibilitychange',visibility);generation.current++;intent.current=false;element?.pause();};
  },[]);
  const moving=motionAllowed({hidden,reduced,compact,paused}),track=AMBIENT_TRACKS[trackIndex];
  const cue=['story','day'].includes(stage)?storyCue:null,effectiveScene=cue?.musicScene||stage,scenePool=sceneTrackIndices(effectiveScene);
  const stop=useCallback(()=>{generation.current++;intent.current=false;audio.current?.pause();setAudioState(s=>s==='off'?'off':'paused');},[]);
  const begin=useCallback(async(index)=>{
    const element=audio.current;if(!element)return;
    const current=++generation.current;intent.current=true;setAudioState('loading');
    const src=`${import.meta.env.BASE_URL}${AMBIENT_TRACKS[index].file}`;
    if(element.getAttribute('src')!==src)element.src=src;
    element.volume=playbackVolume(index,volumeRef.current);
    try{await element.play();if(current!==generation.current)return;if(document.hidden){stop();return;}setAudioState('playing');}
    catch{if(current===generation.current){intent.current=false;setAudioState('error');}}
  },[stop]);
  const choose=useCallback((index,autoplay=intent.current)=>{
    stop();setTrackIndex(index);
    if(autoplay)begin(index);
    else {audio.current?.removeAttribute('src');audio.current?.load();}
  },[begin,stop]);
  useEffect(()=>{
    if(!followScene){previousScene.current=null;return;}
    const key=musicScene(effectiveScene),pool=sceneTrackIndices(key),changed=previousScene.current!==key;
    previousScene.current=key;
    const next=changed||!pool.includes(trackIndex)?pool[0]:trackIndex;
    if(next!==trackIndex)choose(next);
  },[effectiveScene,followScene,trackIndex,choose]);
  function manualChoose(index){setFollowScene(false);choose(index);}
  function ended(){if(intent.current)choose(followScene?nextSceneTrackIndex(trackIndex,effectiveScene):nextTrackIndex(trackIndex,mode),true);}
  return <ExperienceContext.Provider value={{moving,notify,setMusicScene,setCompanionEgg,setStoryCue}}><div className="field-edition">
    <div className="experience-strip" aria-label="氛围设置"><span className="experience-sign"><i aria-hidden="true"/> CAMPUS FIELD NOTES <b>校园行迹</b></span><div className="experience-switches">
      <button type="button" onClick={()=>setPaused(v=>!v)} disabled={reduced||compact} aria-pressed={paused} title={reduced?'系统已选择减少动态效果':compact?'小屏幕自动使用静态背景':'暂停背景与同行小人的持续动作'}>{reduced?'背景：系统静态':compact?'背景：省电静态':paused?'背景：已暂停':'背景：微动态'}</button>
      <button type="button" onClick={()=>intent.current?stop():begin(trackIndex)} aria-pressed={audioState==='playing'}>{audioState==='loading'?'音乐：点击取消':audioState==='playing'?'音乐：已开启':audioState==='error'?'音乐：重试':audioState==='paused'?'音乐：继续':'音乐：开启'}</button>
      <button type="button" className="music-library-toggle" onClick={()=>setShowMusic(v=>!v)} aria-expanded={showMusic} aria-controls="campus-music-library">曲库 · {AMBIENT_TRACKS.length} 首 {showMusic?'−':'＋'}</button>
    </div></div>
    {showMusic&&<section id="campus-music-library" className="music-library" aria-label="背景音乐曲库"><div className="music-library-title"><strong>{track.title}</strong><span>{track.mood} · {Math.floor(track.seconds/60)}:{String(track.seconds%60).padStart(2,'0')}</span><small>{followScene?`跟随场景 · ${MUSIC_SCENES[musicScene(effectiveScene)].title} · ${scenePool.length} 首轮播`:'手动选曲 · 按你的喜好播放'} · 仅加载当前曲目</small><div className="music-credit-links"><span>{track.attribution||track.artist} · {track.collection||'国际曲库'}</span><a href={track.source} target="_blank" rel="noreferrer">作品来源 ↗</a><a href={track.licenseUrl} target="_blank" rel="noreferrer">{track.license}</a></div></div><div className="music-library-controls">
      <button type="button" className="music-scene-toggle" aria-pressed={followScene} onClick={()=>setFollowScene(v=>!v)}>{followScene?'✓ 跟随场景换曲':'跟随场景换曲'}</button>
      <label>选择配乐<select aria-label="选择背景配乐" value={trackIndex} onChange={e=>manualChoose(Number(e.target.value))}>{['国内来源','国际曲库'].map(group=><optgroup key={group} label={group}>{AMBIENT_TRACKS.map((song,i)=>(song.collection||'国际曲库')===group?<option key={song.id} value={i}>{song.title} · {song.mood}</option>:null)}</optgroup>)}</select></label>
      <div className="music-skip-controls"><button type="button" onClick={()=>manualChoose((trackIndex+AMBIENT_TRACKS.length-1)%AMBIENT_TRACKS.length)}>上一首</button><button type="button" onClick={()=>manualChoose((trackIndex+1)%AMBIENT_TRACKS.length)}>下一首</button></div>
      <label>手动播放方式<select aria-label="背景音乐播放方式" value={mode} disabled={followScene} onChange={e=>setMode(e.target.value)}><option value="cycle">顺序轮播</option><option value="shuffle">随机轮播</option><option value="single">单曲循环</option></select></label>
      <label className="music-volume">音量<input aria-label="背景音乐音量" type="range" min="0" max="0.5" step="0.01" value={volume} onChange={e=>{const next=Number(e.target.value);volumeRef.current=next;setVolume(next);if(audio.current)audio.current.volume=playbackVolume(trackIndex,next);}}/></label>
    </div><details className="music-credits"><summary>全部配乐署名与授权</summary><ul>{AMBIENT_TRACKS.map(song=><li key={song.id}>{song.title} — {song.attribution||song.artist}<a href={song.source} target="_blank" rel="noreferrer">作品页</a><a href={song.licenseUrl} target="_blank" rel="noreferrer">{song.license}</a></li>)}</ul><p>本地播放文件经过MP3重新编码，保留完整录音、原速度与声道。作者保留各自权利；音乐许可独立于本项目代码。</p></details></section>}
    <audio ref={audio} preload="none" loop={followScene?scenePool.length===1:mode==='single'} onEnded={ended} onError={()=>{generation.current++;intent.current=false;setAudioState('error');}}/>
    <p className="sr-only" role="status">{audioState==='error'?'背景音乐暂时未能播放，请点击重试。':audioState==='paused'?'背景音乐已暂停，点击音乐继续。':audioState==='playing'?`正在播放${track.title}`:''}</p>
    {companion&&<CampusCompanion mode={stage} moving={moving} notice={notice} eggData={companionEgg}/>}
    <StoryAtmosphere cue={cue} moving={moving}/>
    {children}
  </div></ExperienceContext.Provider>;
}
