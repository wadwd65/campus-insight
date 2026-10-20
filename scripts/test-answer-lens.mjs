import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';
import { QUESTIONS, REQUIRED_COLUMNS } from '../src/lib/surveySchema.js';
import { parseCsvText } from '../src/lib/parseCsv.js';
import { cleanSurveyRows } from '../src/lib/surveyClean.js';
import { buildAnswerDistributions, buildAnswerDistributionCsv } from '../src/lib/answerDistribution.js';
import { decodeCsvBytes } from '../src/lib/decodeCsv.js';

let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`  ✓ ${name}`); }
const utf8 = new TextEncoder();
const csv = fs.readFileSync(new URL('../public/data/示例-班级问卷.csv', import.meta.url));
const records = cleanSurveyRows(parseCsvText(decodeCsvBytes(csv).text, REQUIRED_COLUMNS).rows).records;
const distributions = buildAnswerDistributions(records);
check('十题都使用当前题库，48份有效作答每题恰好计数48次', () => {
  assert.equal(distributions.length, QUESTIONS.length);
  for (const q of distributions) {
    assert.equal(q.total, 48);
    assert.equal(q.options.reduce((n, o) => n + o.count, 0), 48);
    assert.ok(Math.abs(q.options.reduce((n, o) => n + o.pct, 0) - 100) < .3);
  }
});
check('并列第一全部保留，零人选项保留，每人不重复计数', () => {
  const field = QUESTIONS[0].field;
  const [a, b] = QUESTIONS[0].options;
  const [q] = buildAnswerDistributions([{[field]:a.text}, {[field]:b.text}]);
  assert.deepEqual(q.leaders.map(o=>o.text),[a.text,b.text]);
  assert.deepEqual(q.options.map(o=>o.pct),[50,50,0,0,0]);
});
check('空样本不出现NaN、Infinity或虚构的领先选项', () => {
  for (const q of buildAnswerDistributions([])) {
    assert.equal(q.total,0); assert.deepEqual(q.leaders,[]);
    assert.ok(q.options.every(o=>o.count===0 && o.pct===0));
  }
});
check('缺失或未知答案不进入分母，原输入不被修改', () => {
  const before=structuredClone(records);
  const [q]=buildAnswerDistributions([{[QUESTIONS[0].field]:QUESTIONS[0].options[0].text},{},{[QUESTIONS[0].field]:'unknown'}]);
  assert.equal(q.total,1); assert.equal(q.options[0].pct,100);
  buildAnswerDistributions(records); assert.deepEqual(records,before);
});
check('导出是48行选项汇总，不携带个人编号、原始行号或额外字段', () => {
  const output=buildAnswerDistributionCsv(distributions);
  const parsed=Papa.parse(output,{header:true});
  assert.equal(parsed.data.length,QUESTIONS.reduce((n,q)=>n+q.options.length,0));
  assert.deepEqual(parsed.meta.fields,['题目','选项','人数','占比（%）','本题有效作答数']);
  assert.doesNotMatch(output,/S00\d\d|_id|__line|编号/);
});
check('UTF-8与UTF-8 BOM返回相同中文，且支持有偏移的字节视图', () => {
  const text='深夜出没地,期末生存方式\r\n宿舍床上,死磕课本';
  assert.equal(decodeCsvBytes(utf8.encode(text)).text,text);
  assert.equal(decodeCsvBytes(utf8.encode('\uFEFF'+text)).text,text);
  const buffer=Buffer.concat([Buffer.from([0,0]),utf8.encode(text)]);
  assert.equal(decodeCsvBytes(buffer.subarray(2)).text,text);
});
check('Excel常见GBK编码不会被当成乱码或替换符', () => {
  const bytes=Buffer.from('ye7SubP2w7u12CzG2sSpyfq05re9yr0NCsveyeG0ssnPLMvAv8S/zrG+','base64');
  const decoded=decodeCsvBytes(bytes);
  assert.equal(decoded.encoding,'GB18030 / GBK');
  assert.equal(decoded.text,'深夜出没地,期末生存方式\r\n宿舍床上,死磕课本');
});
check('带BOM的UTF-16大小端都能读取中文', () => {
  const text='深夜出没地,期末生存方式';
  const little=Buffer.concat([Buffer.from([255,254]),Buffer.from(text,'utf16le')]);
  assert.equal(decodeCsvBytes(little).text,text);
  const big=Buffer.from(little); big.swap16();
  assert.equal(decodeCsvBytes(big).text,text);
});
check('误选工作簿或PDF时说明正确转换方式', () => {
  assert.throws(()=>decodeCsvBytes(Uint8Array.from([80,75,3,4])),/Excel.*CSV UTF-8/);
  assert.throws(()=>decodeCsvBytes(Uint8Array.from([208,207,17,224])),/Excel/);
  assert.throws(()=>decodeCsvBytes(utf8.encode('%PDF-1.7')),/PDF/);
});
check('损坏字节与二进制空字符不会静默进入清洗管线', () => {
  assert.throws(()=>decodeCsvBytes(Uint8Array.from([255])),/编码/);
  assert.throws(()=>decodeCsvBytes(Uint8Array.from([65,0,66])),/字符/);
  assert.throws(()=>decodeCsvBytes(utf8.encode('坏\uFFFD字符')),/字符/);
});
console.log(`逐题分布与中文编码：${passed} 项通过`);
