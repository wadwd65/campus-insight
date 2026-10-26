import {useEffect,useMemo,useRef,useState} from 'react';
import {STORY_EVENT,newStory,readStory,storyView,chooseStory,continueStory,saveStory,endingText,storyEpisode,storyReflection,readActiveEpisode,saveActiveEpisode} from '../lib/campusStory.js';
import StoryShelf,{storyStorage,nextEpisode} from './StoryShelf.jsx';
import {useExperience} from './ExperienceSettings.jsx';
import {storyAtmosphere} from '../lib/storyAtmosphere.js';
import {StoryStage} from './StoryAtmosphere.jsx';
import './campus-story.css';
function RouteMap({view}){
  const places=[...new Set([view.episode.startPlace,...view.steps.map(step=>step.place),...(view.node?[view.node.place]:[])])];
  return <div className="story-route-map" aria-label="这次走过的地点"><span>这一晚的路线</span><ol>{places.map((place,i)=><li key={place}><i aria-hidden="true">{i+1}</i>{place}</li>)}</ol></div>;
}
export default function CampusStory({scope='guest',onBack,onGoQuiz,onStartDay,initialEpisode}){
  const [episodeId,setEpisodeId]=useState(()=>storyEpisode(initialEpisode||readActiveEpisode(storyStorage(),scope)).id);
  useEffect(()=>{saveActiveEpisode(storyStorage(),scope,episodeId);},[scope,episodeId]);
  return <div className="story-library"><header className="story-library-header"><span>CAMPUS / 四个地方，四件正在发生的事</span><h1>今天，接下哪一段？</h1><p>找线索、修旧物、做一期广播，或者救一场电影。每段都有自己的进度，换剧场也不会丢。</p></header><StoryShelf scope={scope} selected={episodeId} onSelect={setEpisodeId}/><StoryRun key={`${scope}:${episodeId}`} {...{scope,onBack,onGoQuiz,onStartDay,episodeId}} onSelect={setEpisodeId}/></div>;
}
function StoryRun({scope,onBack,onGoQuiz,onStartDay,episodeId,onSelect}){
  const episode=storyEpisode(episodeId),CHAPTERS=episode.chapters,STORY_ENDINGS=episode.endings;
  const [loaded]=useState(()=>readStory(storyStorage(),scope,episodeId)),[progress,setProgress]=useState(loaded.progress),[available,setAvailable]=useState(loaded.available),[restarting,setRestarting]=useState(false),[error,setError]=useState('');
  const view=storyView(progress),heading=useRef(null),last=progress.history.at(-1);
  const {moving,setStoryCue}=useExperience(),cue=useMemo(()=>storyAtmosphere(view),[progress]);
  useEffect(()=>{setStoryCue(cue);return()=>setStoryCue(null);},[cue,setStoryCue]);
  useEffect(()=>{heading.current?.focus({preventScroll:true});},[last,progress.pending]);
  function commit(next){
    setProgress(next);setError('');setAvailable(saveStory(storyStorage(),scope,next));
    window.dispatchEvent(new Event(STORY_EVENT));
  }
  function choose(id){try{commit(chooseStory(progress,id));}catch{setError('这一幕刚刚更新，请继续当前画面。');}}
  function restart(){commit(newStory(progress.endings,episodeId));setRestarting(false);}
  return <section className="campus-story" aria-label="校园连续小剧场">
    <header className="story-header"><div><span>校园支线 / EP. {episode.number} · {episode.genre}</span><h2>{episode.title}</h2><p>{episode.intro}</p></div><button type="button" className="story-text-button" onClick={onBack}>{available?'先离开，下次接着玩':'返回主页'} ↗</button></header>
    <p className="story-save-note" role="status">{!available?'这个浏览器暂时无法保存剧情。你仍能玩完这一轮，离开或刷新后可能丢失进度。':loaded.recovered&&!progress.history.length?'上次的进度没能读取，已回到开场。接下来的选择会重新保存。':progress.history.length?'这一幕已保存在当前浏览器，下次从这里继续。':'剧情会自动保存到当前浏览器。'}<span>故事独立于测评，不改变答卷和圈子填报。</span></p>
    <nav className="story-chapters" aria-label="四幕进度">{CHAPTERS.map((label,i)=><span key={label} className={view.ending||progress.history.length>i+(view.pending?1:0)?'is-done':i===Math.min(3,progress.history.length-(view.pending?1:0))?'is-current':''}><b>{`0${i+1}`}</b>{label}</span>)}</nav>
    <div className="story-layout"><div className="story-main"><StoryStage cue={cue} moving={moving}/>
      {view.ending?<article className={`story-ending ending-${view.ending.id}`}><span className="story-ticket-mark" aria-hidden="true">{view.ending.mark}</span><span className="story-eyebrow">这一段，已收好 / ENDING FOUND</span><h2 ref={heading} tabIndex={-1}>{view.ending.title}</h2><p className="story-ending-line">{view.ending.line}</p>{endingText(view).map(line=><p key={line}>{line}</p>)}<div className="story-reality-bridge"><strong>{onStartDay?'下一步，把自己的路线走出来':'镜头转向真实的你'}</strong><p>{onStartDay?'剧场先收好。接下来的十个决定直接发生在校园地图上：选择去处、分配餐券、应对天气。':episode.bridge}</p><small>{onStartDay?'地图一天也是模拟，不会代填或提交圈子真实问卷。':'接下来回答自己的日常；刚才替角色做的选择不会代填或计入报告。'}</small></div><div className="story-ending-actions"><button type="button" className="story-primary" onClick={()=>onStartDay?onStartDay():onGoQuiz(storyReflection(progress))}>{onStartDay?'去地图，走出自己的一天 →':'带着这一幕，写我的日常 →'}</button><button type="button" className="story-text-button" onClick={()=>onSelect(nextEpisode(episodeId).id)}>下一段 · {nextEpisode(episodeId).title} ↗</button><button type="button" className="story-text-button" onClick={restart}>换条路线，看看另一个收尾 →</button></div><small>剧情人物和情节为虚构；这张结局只记录本次故事选择。</small></article>
      :view.pending?<article className="story-consequence"><span className="story-eyebrow">你刚刚选择了 / {view.last.place}</span><h2 ref={heading} tabIndex={-1}>{view.last.choice.label}</h2><p>{view.last.choice.reply}</p>{view.last.choice.flags.some(flag=>!flag.includes(':'))&&<p className="story-new-item">这次找到的帮手，已放入右侧行囊。</p>}<button type="button" className="story-primary" onClick={()=>commit(continueStory(progress))}>继续 · {view.node.chapter} →</button><button type="button" className="story-text-button" onClick={onBack}>这一幕先存着，回主页</button></article>
      :<article className="story-scene"><div className="story-scene-meta"><span>{view.node.place}</span><span>{view.node.time} / 剧情时间</span></div><h2 ref={heading} tabIndex={-1}>{view.node.chapter}</h2><p className="story-prose">{view.node.text}</p><blockquote><span>{view.node.speaker}</span><p>{view.node.dialogue}</p></blockquote><div className="story-choices" aria-label="现在采取的行动">{view.choices.map(choice=><button key={choice.id} type="button" disabled={!choice.available} onClick={()=>choose(choice.id)} data-choice={choice.id}><span className="story-choice-title">{choice.label}<i aria-hidden="true">{choice.available?'↗':'—'}</i></span><span>{choice.available?choice.hint:choice.locked}</span>{!choice.available&&<small>这次还没准备好 · 换条开场路线可以遇到</small>}</button>)}</div></article>}
      {error&&<p role="alert">{error}</p>}
    </div><aside className="story-sidebar"><RouteMap view={view}/><section className="story-inventory" aria-label="今晚找到的帮手"><h3>今晚的行囊</h3>{view.items.length?<ul>{view.items.map(item=><li key={item}><span aria-hidden="true">＋</span>{item}</li>)}</ul>:<p>还空着。你接下来找到的东西，会让一些新方案变得可行。</p>}</section><section className="story-collection" aria-label="已发现的结局"><h3>收尾手册 <span>{progress.endings.length} / {STORY_ENDINGS.length}</span></h3><ul>{STORY_ENDINGS.map(ending=><li key={ending.id} className={progress.endings.includes(ending.id)?'is-found':''}><b aria-hidden="true">{progress.endings.includes(ending.id)?ending.mark:'?'}</b><span>{progress.endings.includes(ending.id)?ending.title:'还没走到的收尾'}<small>{progress.endings.includes(ending.id)?ending.line:'换个开场，可能就有新的机会。'}</small></span></li>)}</ul></section>
      {!view.ending&&progress.history.length>0&&<div className="story-restart">{restarting?<><p>重新开场会清掉这一次的路线，已发现的结局保留。</p><button type="button" onClick={restart}>确认重新开场</button><button type="button" onClick={()=>setRestarting(false)}>继续当前故事</button></>:<button type="button" className="story-text-button" onClick={()=>setRestarting(true)}>重新开场…</button>}</div>}
    </aside></div>
  </section>;
}
