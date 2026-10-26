import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newDay,chooseDay,continueDay,rewindDay} from '../src/lib/campusDay.js';
import {buildDaySurveyBridge,cleanDaySurveyContext} from '../src/lib/daySurveyBridge.js';
import {QUESTIONS,isKnownOption} from '../src/lib/surveySchema.js';
import {buildReport} from '../src/lib/results.js';
import {buildBaseline,toAttributeMatrix} from '../src/lib/matrix.js';
import {parseCsvText} from '../src/lib/parseCsv.js';
import {cleanSurveyRows} from '../src/lib/surveyClean.js';
import {previewAnswers} from '../src/lib/previewProfiles.js';
import {saveSurveyDraft,readSurveyDraft} from '../src/lib/surveyDraft.js';
import {saveSurveyReport,readSurveyReportSnapshot} from '../src/lib/surveyReportSession.js';
const baseline=buildBaseline(toAttributeMatrix(cleanSurveyRows(parseCsvText(fs.readFileSync(new URL('../public/data/问卷基准数据.csv',import.meta.url),'utf8')).rows).records));
const walk=ids=>ids.reduce((p,id)=>chooseDay(continueDay(p),id),newDay());
let count=0;const test=(name,fn)=>{fn();count++;console.log('  ✓ '+name);};
const a=walk(['front','finish','canteen','rehearsal','rainclub','outline','watch','window','call','keep-dorm']);
test('十个行动与问卷逐题有关联；建议仅取合法原选项，餐券不推断经济、晚饭不推断宵夜频率',()=>{
 const bridge=buildDaySurveyBridge(a);assert.equal(bridge.links.length,10);assert.ok(bridge.suggestedCount>=5);assert.equal(bridge.decisions,10);
 for(const link of bridge.links){if(link.value)assert.ok(isKnownOption(link.field,link.value));assert.ok(a.history[link.source.step-1]===link.source.choice);}
 for(const id of ['Q3','Q5'])assert.equal(bridge.links.find(link=>link.id===id).value,null);
 assert.equal(bridge.suggestions['想加入的社团'],'乐队');assert.equal(bridge.suggestions['操场上的位置'],'看台或树下，看别人动');
});
test('同一个跑道地点，跑步和旁观得到不同问卷建议、不同正式雷达和占比；不再只读地点向量',()=>{
 const prefix=['slow','tinker','canteen','rehearsal','rainclub','repair'];const run=buildDaySurveyBridge(walk([...prefix,'run'])),watch=buildDaySurveyBridge(walk([...prefix,'watch']));
 assert.notEqual(run.suggestions['操场上的位置'],watch.suggestions['操场上的位置']);
 const seed=previewAnswers('study'),r1=buildReport({...seed,...run.suggestions},baseline),r2=buildReport({...seed,...watch.suggestions},baseline);
 assert.notDeepEqual(r1.radar,r2.radar);assert.notDeepEqual(r1.percents,r2.percents);
 // Sport alone need not change the time heuristic; the whole report still uses the new answer.
 assert.equal(Math.round(r1.timeSplit.reduce((s,x)=>s+x.value,0)*10),1000);
});
test('回退改线后，旧社团与运动建议跟着清除，不沿用被取消行动；不完整行程也可带入已知线索',()=>{
 const before=rewindDay(a,3),after=chooseDay(continueDay(before),'camera');
 assert.equal(buildDaySurveyBridge(before).suggestions['想加入的社团'],undefined);
 assert.equal(buildDaySurveyBridge(after).suggestions['想加入的社团'],'摄影社');
 assert.equal(buildDaySurveyBridge(after).suggestions['操场上的位置'],undefined);
});
test('问卷草稿和最终报告保留可重放来源，原答案优先；额外私有字段、非法路线和零选择不进入',()=>{
 const m=new Map(),storage={setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k),removeItem:k=>m.delete(k)};
 const bridge=buildDaySurveyBridge(a),answers={...previewAnswers('study'),...bridge.suggestions};
 saveSurveyDraft(3,answers,storage,'',null,bridge.context);const draft=readSurveyDraft(storage);assert.deepEqual(draft.answers,answers);assert.deepEqual(draft.dayContext,bridge.context);
 saveSurveyReport(answers,storage,'guest',{...bridge.context,password:'PRIVATE',progress:{...a,email:'PRIVATE'}});const saved=readSurveyReportSnapshot(storage);
 assert.deepEqual(saved.answers,answers);assert.deepEqual(saved.dayContext,bridge.context);assert.ok(!JSON.stringify([...m]).includes('PRIVATE'));
 assert.equal(cleanDaySurveyContext(newDay()),null);assert.equal(cleanDaySurveyContext({...a,history:['UNKNOWN']}),null);assert.equal(cleanDaySurveyContext({...a,history:Array(11).fill('slow')}),null);
});
console.log(`小游戏到问卷的真实联系：${count}项通过`);
