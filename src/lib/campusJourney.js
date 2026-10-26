import { PLACE_INDEX, SLOTS_PER_DAY } from '../data/mapPlaces.js';

/** Coordinates are for an illustrated layout, never real campus coordinates. */
export const CAMPUS_POSITIONS = {
  library:[24,18], lab:[43,17], late_class:[38,35],
  court:[73,20], gym:[88,40], field:[69,45], lake:[70,64],
  canteen:[56,77], nightmarket:[80,84], convenience:[42,88], printshop:[36,67],
  dorm:[14,51], rooftop:[13,32], club:[33,51], station:[15,84], intern:[15,68],
};

/**
 * 一天的时段数由「体力」决定 —— 问卷里的 sport 维度换算成 0~100 的百分比后：
 * ≥65 给 5 个时段，≤35 给 3 个，其余 4 个。
 *
 * 为什么用 percent 而不是账本里的累加值：账本值是**可正可负的累加数**
 * （见 useGameStore 的注释：不夹紧到 0，否则八个维度退化成只增不减的计数器），
 * 没有固定上限，拿它做阈值判断会随去过几个地点而漂移。
 * percent 是相对基准人群算出来的，稳定在 0~100。
 *
 * 没有问卷数据时返回 null —— 由调用方决定用默认值，不要在这里替用户假设。
 */
export function slotsForPercents(percents) {
  const sport = Number(percents?.sport);
  if (!Number.isFinite(sport)) return null;
  if (sport >= 65) return 5;
  if (sport <= 35) return 3;
  return 4;
}

export function buildCampusJourney(trail = [], slotsPerDay = SLOTS_PER_DAY) {
  const daySlots = Number.isFinite(slotsPerDay) && slotsPerDay > 0 ? slotsPerDay : SLOTS_PER_DAY;
  let used = 0;
  const visits = trail.flatMap((entry) => {
    const place = PLACE_INDEX.get(entry?.id);
    if (!place) return [];
    const start = used;
    used += place.cost;
    return [{...place, order:0, start, end:used}];
  }).map((visit,index)=>({...visit,order:index+1}));
  const slots = Array.from({length:daySlots},(_,i)=>({
    index:i+1, visit:visits.find((visit)=>i>=visit.start&&i<visit.end) ?? null,
  }));
  const zones = [...new Set(visits.map((visit)=>visit.zone))];
  const ids = new Set(visits.map((visit)=>visit.id));
  const mostVisits = Math.max(0,...[...ids].map((id)=>visits.filter((visit)=>visit.id===id).length));
  let title = '从一个地方开始';
  if (!visits.length) title='今天的故事还没开始';
  else if (zones.length===4) title='环校一日';
  else if (ids.has('library')&&ids.has('lake')) title='把书读进风里';
  else if (mostVisits>=3) title='老地方的新一页';
  else if (visits.filter((visit)=>visit.zone==='south').length>=2) title='校园寻味记';
  else if (ids.has('station')||ids.has('intern')) title='向校门外走一步';
  else if (zones.length>=3) title='随性漫游的一天';
  return {visits,slots,zones,used,title,slotsPerDay:daySlots,complete:used>=daySlots};
}

export function buildJourneyText(journey) {
  const daySlots = journey?.slotsPerDay ?? SLOTS_PER_DAY;
  return [
    'CAMPUS INSIGHT · 校园一日小记', journey.title,
    `已使用 ${journey.used} / ${daySlots} 个时段，共 ${journey.visits.length} 次行动。`,
    ...journey.visits.map((visit)=>`${visit.order}. ${visit.name} · ${visit.cost} 个时段\n   ${visit.line}`),
    '', '路线来自本次选择，地点布局为示意。路线纪念章仅记录行程，不参与画像计算。',
  ].join('\n');
}
