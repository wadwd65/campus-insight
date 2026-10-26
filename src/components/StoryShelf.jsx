import {useEffect,useState} from 'react';
import {STORY_EPISODES,storyShelf,STORY_EVENT} from '../lib/campusStory.js';
import './campus-story.css';
import './story-continuity.css';
export function storyStorage(){try{return typeof window==='undefined'?null:window.localStorage;}catch{return null;}}
export default function StoryShelf({scope='guest',selected,onSelect}){
  const [saved,setSaved]=useState(()=>storyShelf(storyStorage(),scope));
  useEffect(()=>{const update=()=>setSaved(storyShelf(storyStorage(),scope));update();window.addEventListener(STORY_EVENT,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(STORY_EVENT,update);window.removeEventListener('storage',update);};},[scope]);
  return <nav className="story-shelf" aria-label="选择校园小剧场">{saved.map(({episode,progress,view})=><button type="button" key={episode.id} data-episode={episode.id} aria-pressed={selected===episode.id} onClick={()=>onSelect(episode.id)} className={`shelf-card shelf-${episode.id} ${selected===episode.id?'is-selected':''}`}><span className="shelf-card-top"><b>EP. {episode.number} / {episode.genre}</b><i aria-hidden="true">{episode.mark}</i></span><strong>{episode.title}</strong><span>{episode.tagline}</span><small>{view.ending?`已到达「${view.ending.title}」`:progress.history.length?'已存档 · 可以接着玩':'未开始 · 约 2–4 分钟'} · {progress.endings.length}/{episode.endings.length} 收尾</small></button>)}</nav>;
}
export function nextEpisode(id){return STORY_EPISODES[(STORY_EPISODES.findIndex(episode=>episode.id===id)+1)%STORY_EPISODES.length];}
