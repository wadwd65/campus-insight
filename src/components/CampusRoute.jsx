import { useEffect, useMemo, useRef, useState } from 'react';
import { ZONES } from '../data/mapPlaces.js';
import { nextDelta } from '../lib/mapEngine.js';
import { shortLabelOf } from '../lib/surveySchema.js';
import { preferCalm } from '../lib/terminalTheme.js';
import { downloadText } from '../lib/exportProfile.js';
import { CAMPUS_POSITIONS, buildCampusJourney, buildJourneyText } from '../lib/campusJourney.js';
import CampusMapArt from './CampusMapArt.jsx';

export default function CampusRoute({ model, onPick, busy, trail, slotsPerDay }) {
  const [selectedId, setSelectedId] = useState('library');
  const [whisper, setWhisper] = useState(false);
  const [saved, setSaved] = useState(false);
  const preview = useRef(null);
  const canvas = useRef(null);
  const journey = useMemo(() => buildCampusJourney(trail, slotsPerDay), [trail, slotsPerDay]);
  const selected = model.items.find((p) => p.id === selectedId) ?? model.items[0];
  const next = selected.enabled ? nextDelta(selected, model.visited) : null;
  const zone = ZONES.find((zone) => zone.key === selected.zone);
  useEffect(() => setSaved(false), [journey]);

  function inspect(id) {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 767px)').matches) {
      window.requestAnimationFrame(() => {
        preview.current?.closest('.campus-place-preview')?.scrollIntoView({ block:'start', behavior:preferCalm()?'instant':'smooth' });
        preview.current?.focus({ preventScroll:true });
      });
    }
  }

  return <section className="campus-explorer" aria-label="可交互校园示意图">
    <div className="campus-explorer-heading"><span>CAMPUS WALK <b>把一天留在校园里</b></span><small>示意布局 · 非真实坐标</small></div>
    <div className="campus-explorer-body">
      <div className="campus-map-column">
        <div className="campus-map-canvas" ref={canvas} tabIndex={-1}>
          <CampusMapArt journey={journey} />
          <span className="campus-district district-north">教学区</span><span className="campus-district district-east">运动与湖畔</span><span className="campus-district district-west">生活与自由</span><span className="campus-district district-south">烟火日常</span>
          {model.items.map((place,index) => {
            const [x,y] = CAMPUS_POSITIONS[place.id];
            return <button key={place.id} type="button" disabled={busy}
              className={`campus-pin${selectedId===place.id?' is-selected':''}${place.times?' is-visited':''}${!place.enabled?' is-unavailable':''}`}
              style={{ left:`${x}%`, top:`${y}%` }} onClick={() => inspect(place.id)} aria-pressed={selectedId===place.id}
              aria-label={`查看${place.name}，${place.cost}个时段${place.times?`，已去${place.times}次`:''}${!place.enabled?`，${place.reason}`:''}`}>
              <span className="campus-pin-marker" aria-hidden="true">{place.times?'✓':String(index+1).padStart(2,'0')}</span>
              <span className="campus-pin-name">{place.name}</span>{place.times>0 && <small className="campus-pin-count">×{place.times}</small>}
            </button>;
          })}
          <button type="button" className="campus-duck" aria-label="听听湖边的悄悄话" aria-expanded={whisper} onClick={() => setWhisper(!whisper)}>
            <svg viewBox="0 0 40 32" width="28" height="24" aria-hidden="true"><path d="M10 17c-5-1-6-7-1-10 5-3 10 1 9 5l3 5c6-1 9-3 12-7 3 10-2 16-12 16-8 0-13-2-11-9Z" fill="#d8b65c" stroke="#927a46" strokeWidth="1" /><path d="m7 13-5 2 6 2" fill="#b78349" /><circle cx="12" cy="10" r="1" fill="#594d3c" /></svg>
          </button>
          {whisper && <div className="campus-whisper" role="status"><button type="button" aria-label="收起湖边留言" onClick={() => setWhisper(false)}>×</button><span>湖边的小住客</span><p>不用每一步都走得很快，湖边也值得留一个时段。</p></div>}
        </div>
        <p className="campus-map-instruction">点选地点看故事与增量，再决定要不要出发。灰色地点仍可查看说明。</p>
        <div className="campus-time-strip" aria-label="四时段行程">{journey.slots.map((slot) => <div key={slot.index} className={slot.visit?'is-filled':''}><span>时段 {slot.index}</span><b>{slot.visit ? slot.visit.name : '留给下一站'}</b>{slot.visit?.cost>1 && <small>{slot.index===slot.visit.start+1?'跨两个时段':'接上一时段'}</small>}</div>)}</div>
      </div>
      <aside className="campus-place-preview" aria-labelledby="campus-place-title">
        <div className="campus-place-art"><img src={`${import.meta.env.BASE_URL}art/ark/zone-${selected.zone}.webp`} alt="" /><span>{zone.label} · 区域印象</span></div>
        <div className="campus-place-copy">
          <label className="campus-place-picker">选择校园地点<select aria-label="选择校园地点" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{ZONES.map((zone) => <optgroup key={zone.key} label={zone.label}>{model.items.filter((place) => place.zone===zone.key).map((place) => <option key={place.id} value={place.id}>{place.name} · {place.cost}时段{place.enabled?'':` · ${place.reason}`}</option>)}</optgroup>)}</select></label>
          <h2 id="campus-place-title" ref={preview} tabIndex={-1}>{selected.name}</h2><p className="campus-place-story">{selected.line}</p>
          <div className="campus-place-budget"><span>需要 <b>{selected.cost}</b> 个时段</span><span>剩余 <b>{model.slots}</b> / {model.slotsPerDay}</span></div>
          {next ? <><p className="campus-preview-kicker">本次属性增量{next.visit>1?` · 第 ${next.visit} 次，已衰减`:''}</p><ul className="campus-preview-deltas">{Object.entries(next.vec).map(([key,value]) => <li key={key} className={value<0?'is-negative':''}>{shortLabelOf(key)} <b>{value>0?'+':''}{value}</b></li>)}</ul></> : <p className="campus-place-unavailable">{selected.reason}。可以看看其他地点，或回顾今天的路线。</p>}
          <button type="button" className="campus-commit" disabled={!selected.enabled||busy} onClick={() => onPick(selected)}>{busy?'正在记下这一站…':!selected.enabled?'这次暂时不能前往':`${selected.times?'再去':'去'}${selected.name} · 用${selected.cost}个时段`}<span aria-hidden="true">→</span></button>
          <p className="campus-preview-footnote">查看地点不消耗时段；确认出发后计入。增量是规则变化，不代表能力评分。</p>
          <button type="button" className="campus-back-map" onClick={() => { canvas.current?.scrollIntoView({block:'start',behavior:preferCalm()?'instant':'smooth'});canvas.current?.focus({preventScroll:true}); }}>回到地图，再选一站 ↑</button>
        </div>
      </aside>
    </div>
    <div className="campus-journey-card">
      <div><span className="campus-preview-kicker">今日路线纪念</span><h2>{journey.title}</h2><p>{journey.visits.length ? journey.visits.map((visit)=>visit.name).join(' → ') : '还没有出发，先找一个想去的地方。'}</p></div>
      <div className="campus-zone-stamps" aria-label="已到访的校园区域">{ZONES.map((zone) => <span key={zone.key} className={journey.zones.includes(zone.key)?'is-collected':''}>{journey.zones.includes(zone.key)?'✓ ':''}{zone.label.split(' · ')[1]}</span>)}</div>
      {journey.visits.length>0 && <button type="button" onClick={() => {downloadText('campus-insight-一日路线.txt',buildJourneyText(journey),'text/plain;charset=utf-8');setSaved(true);}}>下载路线小记 ↓</button>}
      <small role="status">{saved?'路线小记已生成，请在下载中查看。':'纪念章只记录路线，不改变画像属性。'}</small>
    </div>
  </section>;
}
