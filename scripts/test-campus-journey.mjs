import assert from 'node:assert/strict';
import { PLACES } from '../src/data/mapPlaces.js';
import { CAMPUS_POSITIONS, buildCampusJourney, buildJourneyText } from '../src/lib/campusJourney.js';
import { mapModel, slotsLeft } from '../src/lib/mapEngine.js';
let count=0;
function check(name,fn){fn();count++;console.log(`  ✓ ${name}`);}
const route=(...ids)=>ids.map(id=>({id}));
check('所有16个地点都有唯一且在画布内的示意坐标',()=>{
  assert.deepEqual(Object.keys(CAMPUS_POSITIONS).sort(),PLACES.map(p=>p.id).sort());
  assert.equal(new Set(Object.values(CAMPUS_POSITIONS).map(p=>p.join(','))).size,16);
  assert.ok(Object.values(CAMPUS_POSITIONS).every(p=>p.every(n=>n>0&&n<100)));
});
check('空行程保留4个空时段，不虚构路线纪念章',()=>{
  const j=buildCampusJourney(); assert.equal(j.slots.length,4);assert.ok(j.slots.every(s=>s.visit===null));
  assert.equal(j.complete,false);assert.deepEqual(j.zones,[]);
});
check('两时段地点占据连续两格，和实际时段引擎同源',()=>{
  const t=route('station','library','lake'),j=buildCampusJourney(t);
  assert.deepEqual(j.slots.map(s=>s.visit.id),['station','station','library','lake']);
  assert.equal(j.used,4-slotsLeft(t));assert.equal(j.visits.length,mapModel(t).totalTrips);assert.equal(j.complete,true);
});
check('四区印章由实际行动获得，不含问卷和未知记录',()=>{
  const t=route('Q1=answer','unknown','library','court','canteen','dorm'),j=buildCampusJourney(t);
  assert.equal(j.visits.length,4);assert.equal(j.zones.length,4);assert.equal(j.title,'环校一日');
});
check('撤销后行程、跨时段占用和纪念标题全部重新计算',()=>{
  const t=route('library','lake','station');
  const before=buildCampusJourney(t),after=buildCampusJourney(t.slice(0,-1));
  assert.equal(before.used,4);assert.equal(after.used,2);assert.equal(after.complete,false);
  assert.deepEqual(after.slots.slice(2).map(s=>s.visit),[null,null]);assert.equal(after.title,'把书读进风里');
});
check('重复到访保留每次行动，不误计为多个区域',()=>{
  const j=buildCampusJourney(route('library','library','library'));
  assert.equal(j.used,3);assert.equal(j.zones.length,1);assert.equal(j.title,'老地方的新一页');
});
check('路线小记只含本次地点、真实花费和示意说明',()=>{
  const j=buildCampusJourney(route('Q1=private','canteen','convenience'));
  const text=buildJourneyText(j);assert.match(text,/2 \/ 4 个时段/);assert.match(text,/1. 食堂/);assert.match(text,/校园寻味记/);
  assert.doesNotMatch(text,/private|编号|百分位/);assert.match(text,/不参与画像计算/);
});
check('生成行程不改写原始轨迹或地点数据',()=>{
  const t=route('library','station'),copy=structuredClone(t),places=structuredClone(PLACES);
  buildCampusJourney(t);assert.deepEqual(t,copy);assert.deepEqual(PLACES,places);
});
console.log(`校园行程与纪念小记：${count} 项通过`);
