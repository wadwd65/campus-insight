import {useEffect,useState} from 'react';
import {DAY_EVENT,readDay,dayView} from '../lib/campusDay.js';
import CampusDayMap from './CampusDayMap.jsx';
export function dayStorage(){try{return typeof window==='undefined'?null:window.localStorage;}catch{return null;}}
export default function CampusDayEntry({scope='guest',onStart}){
 const [saved,setSaved]=useState(()=>readDay(dayStorage(),scope));
 useEffect(()=>{const update=()=>setSaved(readDay(dayStorage(),scope));update();window.addEventListener(DAY_EVENT,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(DAY_EVENT,update);window.removeEventListener('storage',update);};},[scope]);
 const view=dayView(saved.progress);
 return <section className="day-entry" aria-label="地图中的十个决定"><div className="day-entry-kicker"><span>ONE DAY / CHOOSE & REVIEW</span><b>{saved.progress.history.length} / 10</b></div><CampusDayMap view={view} mini/><h2>这一次，选择会带你走路。</h2><p>去过实验楼，下午才有工具救场；借到一把伞，下雨才多一个去处。你的行动也会带出问卷建议，核对后再生成自己的校园档案。</p><button type="button" className="story-primary" onClick={onStart}>{view.complete?'回看这一天，试着改一个决定':saved.progress.history.length?'回到地图，接着刚才的决定':'从宿舍出发，开始我的一天'} <span aria-hidden="true">↗</span></button><small>无需注册 · 可暂停 · 行动带入问卷 · 答案由你核对</small></section>;
}
