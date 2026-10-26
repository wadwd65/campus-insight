import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MATRIX_VERSION, REQUIRED_COLUMNS } from '../src/lib/surveySchema.js';
import { JOURNEY_QUESTIONS as QUESTIONS } from '../src/lib/surveyJourney.js';
import { readSurveyDraft, saveSurveyDraft, clearSurveyDraft, SURVEY_DRAFT_KEY } from '../src/lib/surveyDraft.js';
import { parseCsvText } from '../src/lib/parseCsv.js';
import { cleanSurveyRows } from '../src/lib/surveyClean.js';
import { toAttributes, buildBaseline } from '../src/lib/matrix.js';
import { buildCohort } from '../src/lib/cohort.js';
import { cohortFallbackText, buildCohortExport } from '../src/lib/cohortSummary.js';
import { PREVIEW_STYLES, previewAnswers, buildPreviewReport } from '../src/lib/previewProfiles.js';
import { buildReport, buildReportFromAttributes } from '../src/lib/results.js';
import { mapModel, nextDelta } from '../src/lib/mapEngine.js';
import { useGameStore } from '../src/store/useGameStore.js';
import { reportIdentity } from '../src/lib/reportCard.js';

let count = 0;
function check(name, fn) { fn(); count++; console.log(`  ✓ ${name}`); }
const memory = new Map();
const storage = { getItem:k=>memory.get(k)??null, setItem:(k,v)=>memory.set(k,v), removeItem:k=>memory.delete(k) };
const answers = Object.fromEntries(QUESTIONS.slice(0,2).map(q=>[q.field,q.options[0].text]));
check('空标签页无草稿',()=>assert.equal(readSurveyDraft(storage),null));
check('恢复进度与已选答案',()=>{
  saveSurveyDraft(2,answers,storage);
  assert.deepEqual(readSurveyDraft(storage),{index:2,answers});
});
check('损坏的草稿不阻塞作答',()=>{storage.setItem(SURVEY_DRAFT_KEY,'{broken');assert.equal(readSurveyDraft(storage),null);});
check('旧契约版本不误用',()=>{storage.setItem(SURVEY_DRAFT_KEY,JSON.stringify({version:MATRIX_VERSION-1,index:2,answers}));assert.equal(readSurveyDraft(storage),null);});
check('越界进度不导致白屏',()=>{saveSurveyDraft(99,answers,storage);assert.equal(readSurveyDraft(storage),null);});
check('缺少前题答案不允许跳题',()=>{saveSurveyDraft(2,{},storage);assert.equal(readSurveyDraft(storage),null);});
check('未知选项不会写入报告',()=>{saveSurveyDraft(1,{[QUESTIONS[0].field]:'不认识的答案'},storage);assert.equal(readSurveyDraft(storage),null);});
check('额外身份字段不随草稿恢复',()=>{saveSurveyDraft(2,{...answers,email:'private@example.invalid'},storage);assert.deepEqual(readSurveyDraft(storage).answers,answers);});
check('存储被禁用仍能正常开始',()=>{
  const blocked={getItem(){throw Error('denied')},setItem(){throw Error('denied')},removeItem(){throw Error('denied')}};
  assert.equal(readSurveyDraft(blocked),null);saveSurveyDraft(0,{},blocked);clearSurveyDraft(blocked);
});
check('清除草稿后不恢复旧答案',()=>{clearSurveyDraft(storage);assert.equal(readSurveyDraft(storage),null);});

const data = file => cleanSurveyRows(parseCsvText(fs.readFileSync(new URL(`../public/data/${file}`,import.meta.url),'utf8'),REQUIRED_COLUMNS).rows).records;
const base = buildBaseline(data('问卷基准数据.csv').map(toAttributes));
const sample = data('示例-班级问卷.csv');
check('单人样本不产生班级整体结论',()=>{
  const text=cohortFallbackText(buildCohort(sample.slice(0,1),base));
  assert.match(text,/样本太少/);assert.doesNotMatch(text,/最多|分歧最大|一半/);
});
check('四分位距大不推断中间缺人',()=>{
  const text=cohortFallbackText(buildCohort(sample,base));
  assert.match(text,/不能判断是否两极分化/);assert.doesNotMatch(text,/中间几乎没有过渡|不爱表达的一半/);
});
check('示例答案全部是当前题库的合法选项',()=>{
  for (const style of PREVIEW_STYLES) {
    const a=previewAnswers(style.id);
    assert.equal(Object.keys(a).length,QUESTIONS.length);
    for(const q of QUESTIONS) assert.ok(q.options.some(o=>o.text===a[q.field]));
  }
});
check('示例数字与生产报告同源，且不需要篡改真实答卷',()=>{
  for(const style of PREVIEW_STYLES) assert.deepEqual(buildPreviewReport(base,style.id),buildReport(previewAnswers(style.id),base));
  assert.notDeepEqual(buildPreviewReport(base,'study').radar,buildPreviewReport(base,'explore').radar);
  assert.equal(buildPreviewReport(null,'study'),null);
});
check('地图行程不把问卷记录算进去',()=>{
  const model=mapModel([{id:`${QUESTIONS[0].field}=any`},{id:'library'},{id:'unknown'}]);
  assert.equal(model.totalTrips,1);assert.equal(model.slots,3);assert.equal(model.started,true);
  assert.equal(mapModel([{id:'unknown'}]).started,false);
});
check('第3次到访后明确禁用，防止第4次点击没有反应',()=>{
  const m=mapModel(Array.from({length:3},()=>({id:'library'})));
  const library=m.items.find(p=>p.id==='library');
  assert.equal(m.slots,1);assert.equal(library.enabled,false);assert.equal(library.exhausted,true);
  assert.equal(nextDelta(library,m.visited),null);
});
check('撤销地图行动恢复全部属性、时段与标记，保留问卷',()=>{
  const store=useGameStore;
  store.getState().resetPlayer();
  const q=QUESTIONS[0];
  store.getState().applyChoice({id:`${q.field}=${q.options[0].text}`,label:q.text,delta:q.options[0].vec});
  const before=structuredClone(store.getState().player);
  const m=mapModel(before.trail),place=m.items.find(p=>p.id==='library');
  store.getState().applyChoice({id:place.id,label:place.name,at:123,delta:nextDelta(place,m.visited).vec});
  store.getState().undoMapChoice();
  assert.deepEqual(store.getState().player,before);
  assert.equal(mapModel(store.getState().player.trail).slots,4);
  store.getState().undoMapChoice(); // Must not remove the preceding questionnaire answer.
  assert.deepEqual(store.getState().player,before);
  store.getState().resetPlayer();
});
check('不同地图属性生成不同档案编号，同输入编号稳定',()=>{
  assert.notEqual(reportIdentity(null,{academic:2}),reportIdentity(null,{academic:3}));
  assert.equal(reportIdentity(answers,null),reportIdentity({...answers},null));
});
check('同一组八维属性从账本生成报告，派生轴与原问卷完全一致',()=>{
  const a=previewAnswers('study');
  const report=buildReport(a,base);
  const raw={...report.attributes};delete raw.buddhist;
  assert.deepEqual(buildReportFromAttributes(raw,base).percents,report.percents);
  const changed=buildReportFromAttributes({...raw,plan:raw.plan-100},base);
  assert.notEqual(changed.percents.buddhist,report.percents.buddhist);
});
check('班级摘要保留统计口径，不导出编号或原始作答',()=>{
  const cohort=buildCohort(sample,base,previewAnswers('study'));
  const text=buildCohortExport(cohort);
  assert.match(text,/48 人/);assert.match(text,/学术型：12 人，25%/);
  assert.match(text,/个体百分位的中位数/);assert.match(text,/模拟记录/);
  assert.doesNotMatch(text,/S00\d\d|图书馆自习室|提前两周就复习完了/);
});
console.log(`问卷体验、地图与解释边界：${count} 项通过`);
