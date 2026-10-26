import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCsvText } from '../src/lib/parseCsv.js';
import { QUESTIONS, ALL_ATTR_KEYS, REQUIRED_COLUMNS } from '../src/lib/surveySchema.js';
import { buildBaseline, toAttributeMatrix } from '../src/lib/matrix.js';
import { cleanSurveyRows } from '../src/lib/surveyClean.js';
import { buildReport } from '../src/lib/results.js';
import { previewAnswers } from '../src/lib/previewProfiles.js';
import { previewAnswer } from '../src/lib/profileExplanation.js';
import { fallbackText } from '../src/lib/fallback.js';
import { readSurveyReport, saveSurveyReport, clearSurveyReport, validSurveyAnswers } from '../src/lib/surveyReportSession.js';
import { radarTooltip, timeShareLabel, timeShareTooltip } from '../src/lib/chartLabels.js';

const rows=parseCsvText(fs.readFileSync(new URL('../public/data/问卷基准数据.csv',import.meta.url),'utf8'),REQUIRED_COLUMNS).rows;
const baseline=buildBaseline(toAttributeMatrix(cleanSurveyRows(rows).records)), records=[];
assert.equal(baseline.size,2000);
function test(name, fn){fn();records.push(name);console.log('  ✓ '+name);}
test('三套不同的十题真实回答，生成的雷达、时间倾向与个人解读均有差异',()=>{
  const reports=['study','explore','relax'].map(id=>buildReport(previewAnswers(id),baseline));
  for(const key of ['radar','timeSplit','moodCurve'])assert.equal(new Set(reports.map(r=>JSON.stringify(r[key]))).size,3);
  assert.equal(new Set(reports.map(r=>fallbackText(r))).size,3);
});
test('遍历三套答卷的每一题、每个改答，预览与整份正式报告重算一致，原答卷不变',()=>{
  for(const id of ['study','explore','relax']){
    const answers=Object.freeze(previewAnswers(id)), before=JSON.stringify(answers);
    for(const q of QUESTIONS)for(const option of q.options){
      const next={...answers,[q.field]:option.text}, preview=previewAnswer({answers,baseline,field:q.field,value:option.text}), report=buildReport(next,baseline);
      assert.deepEqual(preview.percents,report.percents);assert.deepEqual(preview.attributes,report.attributes);
      assert.equal(Math.round(report.timeSplit.reduce((s,item)=>s+item.value,0)*10),1000);
      for(const key of ALL_ATTR_KEYS)assert.ok(Number.isFinite(report.percents[key])&&report.percents[key]>=2&&report.percents[key]<=98);
      assert.ok(fallbackText(report).length>100);
    }
    assert.equal(JSON.stringify(answers),before);
  }
});
test('图表浮层逐轴说明模拟百分位，占比标签与输入一致，避免二次取整和真实人群误称',()=>{
  const radar=buildReport(previewAnswers('study'),baseline).radar, values=radar.map(x=>x.value);
  const text=radarTooltip(radar,{name:'<script>测试</script>',value:values});
  for(const item of radar)assert.ok(text.includes(`${item.axis}：第 ${item.value} 百分位`));
  assert.ok(text.includes('模拟基准'));assert.ok(text.includes('各项不相加'));assert.ok(!text.includes('<script>'));assert.ok(!text.includes('的大学生'));
  assert.equal(timeShareLabel({name:'学习',value:22.7,percent:23}),'学习\n22.7%');
  assert.equal(timeShareTooltip({name:'学习',value:22.7,percent:23}),'学习　22.7%（规则估算）');
});
test('结果仅存十个合法回答，匿名和账号隔离；刷新可读、退出可清，额外字段不进入快照',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}, answers=previewAnswers('study');
  assert.equal(saveSurveyReport({...answers,email:'PRIVATE',name:'PRIVATE',admin:true},storage),true);
  assert.deepEqual(readSurveyReport(storage),answers);assert.equal(readSurveyReport(storage,'user-2'),null);
  saveSurveyReport(previewAnswers('explore'),storage,'user-2');assert.deepEqual(readSurveyReport(storage),answers);
  assert.ok(!JSON.stringify([...values]).includes('PRIVATE'));clearSurveyReport(storage,'user-2');assert.equal(readSurveyReport(storage,'user-2'),null);assert.deepEqual(readSurveyReport(storage),answers);
  clearSurveyReport(storage);assert.equal(readSurveyReport(storage),null);
});
test('缺题、非法选项、损坏快照、禁用存储均不会伪造报告或阻止当次计算',()=>{
  const answers=previewAnswers('study'), incomplete={...answers};delete incomplete[QUESTIONS[0].field];
  assert.equal(validSurveyAnswers(incomplete),null);assert.equal(validSurveyAnswers({...answers,[QUESTIONS[0].field]:'UNKNOWN'}),null);
  for(const raw of ['{',JSON.stringify({version:99,answers}),JSON.stringify({version:1,answers:incomplete})])assert.equal(readSurveyReport({getItem:()=>raw}),null);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
  assert.equal(saveSurveyReport(answers,blocked),false);assert.equal(readSurveyReport(blocked),null);assert.doesNotThrow(()=>clearSurveyReport(blocked));assert.ok(buildReport(answers,baseline).facts.title);
});
console.log(`问卷主线与报告重算：${records.length} 项通过`);
