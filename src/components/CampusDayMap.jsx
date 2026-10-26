import {useId} from 'react';
import {campusLeg,pathPoints,walkingFrames} from '../lib/campusPaths.js';
import CampusMapArt from './CampusMapArt.jsx';
import {CAMPUS_POSITIONS} from '../lib/campusJourney.js';
import {placeName} from '../lib/campusDay.js';
import './campus-day.css';
export default function CampusDayMap({view,selected=null,onPlace,mini=false,moving=false}){
 const candidates=view.pending||view.complete?[]:view.task.choices,seen=[...new Set([...view.visits.map(v=>v.place),view.place])],destinations=[...new Set(candidates.map(c=>c.place))],ids=[...new Set([...seen,...destinations])];
 const [x,y]=CAMPUS_POSITIONS[view.place],target=selected&&CAMPUS_POSITIONS[selected.place];
 const uid=useId().replace(/[^a-z0-9]/gi,''),from=view.visits.at(-2)?.place||'dorm',animation='campuswalk'+uid+'_'+view.visits.length+'_'+from+'_'+view.place;
 const frames=walkingFrames(from,view.place),journey={visits:[{id:'dorm'},...view.journey.visits]};
 return <figure className={`day-map ${mini?'is-mini':''} ${moving?'is-moving':'is-still'}`} aria-label="十个决定发生的校园地图"><div className="day-map-canvas"><CampusMapArt journey={journey}/>
   {!mini&&target&&view.task?.kind!=='memory'&&<svg className="day-preview-line" viewBox="0 0 1000 640" aria-hidden="true"><polyline points={pathPoints(campusLeg(view.place,selected.place))} fill="none" stroke="#ad7d48" strokeWidth="4" strokeDasharray="7 8" strokeLinejoin="round"/></svg>}
   {ids.map(id=>{const [left,top]=CAMPUS_POSITIONS[id],at=id===view.place,choices=candidates.filter(c=>c.place===id),active=selected?.place===id,possible=choices.some(c=>c.available);return !mini&&onPlace&&choices.length?<button type="button" key={id} className={`day-pin ${at?'is-here':''} ${active?'is-selected':''}`} data-day-place={id} aria-pressed={active} aria-label={`查看${placeName(id)}的${choices.length}个决定${possible?'':'，本次条件不足'}`} style={{left:left+'%',top:top+'%'}} onClick={()=>onPlace(id)}><i aria-hidden="true">{active?'→':at?'●':'+'}</i><span>{placeName(id)}</span></button>:<span key={id} className={`day-map-visited ${at?'is-here':''} ${view.keepsake===id?'is-keepsake':''}`} style={{left:left+'%',top:top+'%'}}><i aria-hidden="true">{view.keepsake===id?'✦':at?'●':'✓'}</i>{placeName(id)}</span>;})}
   <style>{`@keyframes ${animation}{${frames}}`}</style><div className="day-player-anchor" style={{transform:`translate(${x}%,${y}%)`,animationName:moving&&!mini&&from!==view.place?animation:undefined}} aria-hidden="true"><svg className="day-player" viewBox="0 0 34 49"><ellipse cx="17" cy="45" rx="13" ry="3" fill="#65795644"/><path d="m13 30-3 13m12-13 3 13" stroke="#3b5354" strokeWidth="4" strokeLinecap="round"/><path d="M9 19q8-7 16 0l2 13H7Z" fill="#b7975a" stroke="#796440"/><path d="m9 20-5 10m21-10 5 10" stroke="#4b6655" strokeWidth="4" strokeLinecap="round"/><circle cx="17" cy="10" r="7" fill="#e0d0ad" stroke="#7a7c5e"/><path d="M10 9q0-10 12-6l3 7-6-4-9 3" fill="#405a53"/><path d="M12 22h10v8H12Z" fill="#e1d4ae"/></svg></div>
   <div className="day-map-corner"><b>YOU ARE HERE</b><span>{placeName(view.place)}</span></div>
  </div><figcaption><span>{mini?'从宿舍出发，每一个决定都在这张地图上发生。':view.complete?'实线是你真正选择过的路线，星标是今天的纪念。':'点地点或行动卡，沿道路出发。实线已走，虚线预览。'}</span>{!mini&&<small>校园示意 · 模拟一天</small>}</figcaption></figure>;
}
