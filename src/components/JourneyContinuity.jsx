import {cleanStoryReflection,storyEpisode} from '../lib/campusStory.js';
import {realLifeFrames} from '../lib/surveyNarrative.js';
import {nextEpisode} from './StoryShelf.jsx';
import './campus-story.css';
export default function JourneyContinuity({context,answers,onGoStory,onGoMap,fromMap=false}){
  const clean=cleanStoryReflection(context),episode=clean?storyEpisode(clean.episodeId):null,ending=episode?.endings.find(e=>e.id===clean.endingId),frames=realLifeFrames(answers),next=nextEpisode(episode?.id||'screening');
  return <section className="journey-continuity" aria-label="从故事到我的校园日常"><p className="story-eyebrow">{fromMap?'故事 → 真实日常 → 本次行动':'故事 → 真实日常 → 下一步'}</p><h2>{episode?'刚才那一幕，现在接到你身上。':'十个选择，留下了这三帧。'}</h2>{episode&&<div className="journey-fiction-record"><b>虚构剧场 · {episode.title}</b><span>{ending?`你带着「${ending.title}」来到这里。`:'你从这段故事走到自己的日常。'} 剧情选择不参与报告计算。</span></div>}<div className="journey-real-frames">{frames.map(frame=><div key={frame.id}><small>{frame.label} / 真实答卷</small><strong>{frame.answer}</strong><p>{frame.line}</p></div>)}</div><div className="journey-next"><p>{fromMap?'刚才的地图行动已经接入本份报告；你可以往下看前后变化，或者回到校园的另一段故事。':'接下来可以在行动地图里安排一天，再回来对照；想继续玩，就去另一段完全不同的小剧场。'}</p><div>{onGoMap&&<button type="button" className="story-primary" onClick={onGoMap}>接着安排我的校园一天 →</button>}{episode&&onGoStory&&<button type="button" className="story-text-button" onClick={()=>onGoStory(episode.id)}>回到「{episode.title}」</button>}{onGoStory&&<button type="button" className="story-text-button" onClick={()=>onGoStory(next.id)}>另一段 · {next.title} ↗</button>}</div></div></section>;
}
