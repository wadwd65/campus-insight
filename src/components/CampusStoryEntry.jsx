import {useEffect,useState} from 'react';
import {storyShelf,STORY_EVENT} from '../lib/campusStory.js';
import {storyStorage} from './StoryShelf.jsx';
export {storyStorage} from './StoryShelf.jsx';
import './campus-story.css';
export default function CampusStoryEntry({scope='guest',onOpen,compact=false}){
  const [shelf,setShelf]=useState(()=>storyShelf(storyStorage(),scope));
  useEffect(()=>{const update=()=>setShelf(storyShelf(storyStorage(),scope));update();window.addEventListener('storage',update);window.addEventListener(STORY_EVENT,update);return()=>{window.removeEventListener('storage',update);window.removeEventListener(STORY_EVENT,update);};},[scope]);
  const active=shelf.find(item=>item.progress.history.length&&!item.view.ending)||shelf.find(item=>!item.view.ending)||shelf[0],count=shelf.reduce((sum,item)=>sum+item.progress.endings.length,0),total=shelf.reduce((sum,item)=>sum+item.episode.endings.length,0);
  return <section className={`story-entry ${compact?'is-compact':''}`} aria-label="可接续的校园小剧场">
    <div className="story-entry-label"><span>四段校园小剧场 / STORY SHELF</span><span>{count} / {total} 种收尾</span></div>
    <div className="story-entry-lineup" aria-label="四种不同的校园经历">{shelf.map(({episode,progress,view})=><button type="button" key={episode.id} className={`entry-episode entry-${episode.id}`} onClick={()=>onOpen(episode.id)}><i aria-hidden="true">{episode.mark}</i><span><strong>{episode.title}</strong><small>{episode.genre} · {view.ending?'已收好一个结局':progress.history.length?'接着上次':'可以开始'}</small></span><b aria-hidden="true">↗</b></button>)}</div>
    <h2>{active.progress.history.length&&!active.view.ending?'上次的那一幕，还在。':'不止一种校园生活。'}</h2><p>{active.progress.history.length&&!active.view.ending?`「${active.episode.title}」停在了「${active.view.pending?active.view.last.chapter:active.view.node.chapter}」。也可以换一段，进度各自保留。`:'一串找不到主人的钥匙，一台不响的收音机，一段空白广播，还有一场快下雨的电影。你想先遇见哪件事？'}</p>
    <button type="button" className="story-primary" onClick={()=>onOpen(active.episode.id)}>{active.progress.history.length&&!active.view.ending?'接着上次的故事':'选一段，走进去'} <span aria-hidden="true">↗</span></button>
    <small>每段约 2–4 分钟 · 独立存档 · 可跳过故事直接记录日常</small>
  </section>;
}
