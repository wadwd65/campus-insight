#!/usr/bin/env node
/**
 * 计算层自检 —— `npm run selftest`
 *
 * 两道闸门（必须能自动跑；只写在文档里的要求不算要求）：
 *
 *   闸门一 · 选项覆盖率
 *     基准 CSV 里的每一个值都能在矩阵里找到。防的是「生成端与计算端选项池漂移」——
 *     这种错误在图表上完全看不出来，只会让某些人的某个维度莫名其妙偏低。
 *
 *   闸门二 · 输出分化度
 *     随机 5000 份作答，四样输出必须真的分得开。
 *     这是「千人一面」的唯一防线：一个产品如果不同的人答完题看起来都差不多，
 *     那么它最值钱的那个瞬间 ——「这就是我」—— 根本不会发生。
 *     而这件事人眼验证不了（你不可能手点 5000 次），只能靠量化。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { QUESTIONS, ALL_ATTR_KEYS, REQUIRED_COLUMNS, optionsOf } from '../src/lib/surveySchema.js';
import { parseCsvText } from '../src/lib/parseCsv.js';
import { cleanSurveyRows } from '../src/lib/surveyClean.js';
import {
  toAttributes,
  toAttributeMatrix,
  buildBaseline,
  toPercents,
  percentileOf,
} from '../src/lib/matrix.js';
import { buildReport, FACT_COPY, TITLES } from '../src/lib/results.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV_PATH = path.join(ROOT, 'public', 'data', '问卷基准数据.csv');

let pass = 0;
const failures = [];

function group(title) {
  console.log(`\n${title}`);
}

function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? `  ${detail}` : ''}`);
  }
}

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const stdev = (xs) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

/** 可复现的伪随机（不用 Math.random：自检失败要能复现）。 */
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════ A · 矩阵结构

group('A · 矩阵结构');

check('6 个问题', QUESTIONS.length === 6, `实际 ${QUESTIONS.length}`);

const OPTION_COUNT = QUESTIONS.reduce((s, q) => s + q.options.length, 0);
check('28 个选项', OPTION_COUNT === 28, `实际 ${OPTION_COUNT}`);

const EXPECTED_PER_Q = { Q1: 5, Q2: 5, Q3: 4, Q4: 5, Q5: 4, Q6: 5 };
for (const q of QUESTIONS) {
  check(`${q.id} 有 ${EXPECTED_PER_Q[q.id]} 个选项`, q.options.length === EXPECTED_PER_Q[q.id], `实际 ${q.options.length}`);
}

// 增量必须在 −3 ~ +3 之间：超出这个范围某一个选项就能单独把维度顶到极值，
// 那么「六题共同决定」的设计就失效了
const outOfRange = QUESTIONS.flatMap((q) =>
  q.options.flatMap((o) =>
    Object.entries(o.vec).filter(([, v]) => Math.abs(v) > 3).map(([k, v]) => `${q.id}/${o.text}/${k}=${v}`),
  ),
);
check('所有增量都在 −3 ~ +3', outOfRange.length === 0, outOfRange.slice(0, 3).join(', '));

const emptyVec = QUESTIONS.flatMap((q) => q.options.filter((o) => !Object.keys(o.vec).length).map((o) => `${q.id}/${o.text}`));
check('没有空向量选项', emptyVec.length === 0, emptyVec.join(', '));

// 每个维度至少被 5 个选项影响：少于这个数，该维度的信号几乎全来自一两道题，
// 结果是「这一维其实只在测一道题」，而用户看到的却是「8 个维度」
const touchCount = {};
for (const q of QUESTIONS) {
  for (const o of q.options) {
    for (const k of Object.keys(o.vec)) touchCount[k] = (touchCount[k] ?? 0) + 1;
  }
}
const thinDims = Object.entries(touchCount).filter(([, n]) => n < 5);
check('每个基础属性至少被 5 个选项影响', thinDims.length === 0, JSON.stringify(touchCount));

// 文案覆盖：漏掉任何一个键，界面上就会输出「…… —— 」后面空着。
// 它不报错、不崩溃、不影响任何数字，只是安静地难看 —— 所以只能由断言来守。
const copyMissing = ALL_ATTR_KEYS.filter((k) => !FACT_COPY[k] || !TITLES[k]);
check('9 个属性（含派生）都有冷知识文案与称号', copyMissing.length === 0, copyMissing.join(', '));

// ═══════════════════════════════════════════════ B · 闸门一：选项覆盖率

group('B · 闸门一 · 选项覆盖率（基准 CSV ↔ 矩阵）');

const csvText = fs.readFileSync(CSV_PATH, 'utf8');
const parsed = parseCsvText(csvText, REQUIRED_COLUMNS);
check('基准 CSV 能解析', parsed.ok, parsed.errors?.[0]?.message ?? '');

const cleaned = cleanSurveyRows(parsed.rows);
check('基准 CSV 剔除 0 条（说明每个值都在矩阵选项内）', cleaned.report.droppedCount === 0,
  `剔除 ${cleaned.report.droppedCount} 条`);
if (cleaned.report.droppedCount) console.log(`      ${cleaned.report.summary}`);

check('基准 CSV 2000 行', cleaned.records.length === 2000, `实际 ${cleaned.records.length}`);

const baselineAttrs = toAttributeMatrix(cleaned.records);
const baseline = buildBaseline(baselineAttrs);
check('基线含 9 个维度（8 基础 + 1 派生）', Object.keys(baseline.sorted).length === 9,
  Object.keys(baseline.sorted).join(', '));

// 与 Python 生成端对账：min/max 不受分位数插值方式影响，是可以直接比的两个数
const PY_MIN_MAX = {
  academic: [-6, 15], social: [-4, 13], sport: [-3, 7], food: [-2, 11],
  night: [-2, 12], plan: [-12, 12], novelty: [-1, 9], resilience: [1, 12], buddhist: [-7, 17],
};
for (const [key, [lo, hi]] of Object.entries(PY_MIN_MAX)) {
  const s = baseline.sorted[key];
  check(`跨语言对账 ${key} min/max`, s[0] === lo && s[s.length - 1] === hi,
    `JS ${s[0]}~${s[s.length - 1]} / Python ${lo}~${hi}`);
}

// ═══════════════════════════════════════════════ C · 闸门二：输出分化度

group('C · 闸门二 · 输出分化度（随机 5000 份作答）');

const rnd = mulberry32(20260914);
const N = 5000;
const answersList = [];
for (let i = 0; i < N; i += 1) {
  const a = {};
  for (const q of QUESTIONS) a[q.field] = q.options[Math.floor(rnd() * q.options.length)].text;
  answersList.push(a);
}

const reports = answersList.map((a) => buildReport(a, baseline));

const radarVecs = reports.map((r) => r.radar.map((x) => x.value));
const curveVecs = reports.map((r) => r.moodCurve.map((x) => x.value));

// 两两平均距离：取前 400 份算 —— 400²/2 = 8 万对，足够代表整体，也不至于让自检跑成分钟级
const SAMPLE = 400;
const pairDist = (vecs) => {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < SAMPLE; i += 1) {
    for (let j = i + 1; j < SAMPLE; j += 1) {
      sum += dist(vecs[i], vecs[j]);
      n += 1;
    }
  }
  return sum / n;
};

const radarSpread = pairDist(radarVecs);
check('雷达图两两平均距离 ≥ 18', radarSpread >= 18, `实际 ${radarSpread.toFixed(2)}`);

const axisStd = [];
for (let i = 0; i < 5; i += 1) axisStd.push(stdev(radarVecs.map((v) => v[i])));
check('雷达 5 轴标准差均 ≥ 12', axisStd.every((s) => s >= 12),
  axisStd.map((s) => s.toFixed(1)).join(' / '));

const curveSpread = pairDist(curveVecs);
check('四年曲线两两平均距离 ≥ 4', curveSpread >= 4, `实际 ${curveSpread.toFixed(2)}`);

const curveStd = [];
for (let i = 0; i < 4; i += 1) curveStd.push(stdev(curveVecs.map((v) => v[i])));
check('四年曲线各节点标准差均 ≥ 3', curveStd.every((s) => s >= 3),
  curveStd.map((s) => s.toFixed(1)).join(' / '));

// 环形图：必须出现「主导类」和「次要类」，否则每个人都是平均分配的五个 20%
const maxShares = reports.map((r) => Math.max(...r.timeSplit.map((x) => x.value)));
const minShares = reports.map((r) => Math.min(...r.timeSplit.map((x) => x.value)));
check('环形图最大类占比中位数 ≥ 25%', mean(maxShares) >= 25, `实际 ${mean(maxShares).toFixed(1)}%`);
check('环形图最小类占比中位数 ≤ 15%', mean(minShares) <= 15, `实际 ${mean(minShares).toFixed(1)}%`);

// 结果不该重复：抽 200 对，检查是否有两份报告完全一样
let identical = 0;
for (let i = 0; i < 200; i += 1) {
  const a = reports[Math.floor(rnd() * reports.length)];
  const b = reports[Math.floor(rnd() * reports.length)];
  if (JSON.stringify(a.radar) === JSON.stringify(b.radar)) identical += 1;
}
check('不同作答不产生相同雷达图（200 对抽样）', identical <= 2, `重复 ${identical} 对`);

// ═══════════════════════════════════════════════ D · 输出合理性

group('D · 输出合理性');

const splitOk = reports.every((r) => {
  const sum = r.timeSplit.reduce((s, x) => s + x.value, 0);
  return near(sum, 100, 0.05) && r.timeSplit.every((x) => x.value >= 3 && x.value <= 70);
});
check('环形图每份都：和为 100 且每类在 3%~70%', splitOk);

const curveOk = reports.every((r) => r.moodCurve.every((x) => x.value >= 30 && x.value <= 95));
check('四年曲线每点都在 30~95 之间', curveOk);

const factsOk = reports.every((r) => r.facts.title && r.facts.lines.length === 2 && r.facts.lines.every((l) => l.text));
check('冷知识每份都有标题 + 2 条', factsOk);

const noteOk = reports.every((r) => r.moodCurve.every((x) => x.note && x.note.length >= 6));
check('四年曲线每段都有解读句', noteOk);

const radarOk = reports.every((r) =>
  r.radar.length === 5 && r.radar.every((x) => x.value >= 2 && x.value <= 98 && x.axis));
check('雷达图每份都是 5 轴且取值在 2~98', radarOk);

// 极端作答不能把系统带崩
const extreme = {};
for (const q of QUESTIONS) extreme[q.field] = q.options[0].text;
let extremeOk = false;
try {
  const r = buildReport(extreme, baseline);
  extremeOk = r.radar.length === 5 && Number.isFinite(r.radar[0].value);
} catch (e) {
  extremeOk = false;
}
check('全选第一项的极端作答不报错', extremeOk);

let extremeLast = false;
try {
  const a = {};
  for (const q of QUESTIONS) a[q.field] = q.options[q.options.length - 1].text;
  const r = buildReport(a, baseline);
  extremeLast = r.moodCurve.length === 4;
} catch (e) {
  extremeLast = false;
}
check('全选最后一项的极端作答不报错', extremeLast);

// 抽样打印一份，肉眼确认可读
console.log('\n【抽样一份完整报告（作答：图书馆自习室 / 提前复习 / 从不宵夜 / 辩论队 / 奖学金 / 图书馆座位）】');
const demo = buildReport(
  {
    深夜出没地: '图书馆自习室',
    期末生存方式: '提前两周就复习完了',
    宵夜频率: '从不',
    想加入的社团: '辩论队',
    经济状态: '靠奖学金过日子',
    毕业最想带走: '图书馆那张常坐的座位',
  },
  baseline,
);
console.log('  雷达：', demo.radar.map((x) => `${x.axis} ${x.value}`).join(' · '));
console.log('  时间：', demo.timeSplit.map((x) => `${x.name} ${x.value}%`).join(' · '));
console.log('  曲线：', demo.moodCurve.map((x) => `${x.stage} ${x.value}`).join(' → '));
console.log('  称号：', demo.facts.title);
for (const l of demo.facts.lines) console.log('    ·', l.text);
console.log('  台词：', demo.moodCurve.map((x) => `${x.stage}「${x.note}」`).join('\n        '));

console.log('\n【抽样一份完全不同的报告（网吧 / 临时抱佛脚 / 天天宵夜 / 电竞社 / 月初土豪 / 宿舍的人）】');
const demo2 = buildReport(
  {
    深夜出没地: '网吧',
    期末生存方式: '临时抱佛脚',
    宵夜频率: '天天吃',
    想加入的社团: '电竞社',
    经济状态: '月初土豪，月底吃土',
    毕业最想带走: '宿舍的那群人',
  },
  baseline,
);
console.log('  雷达：', demo2.radar.map((x) => `${x.axis} ${x.value}`).join(' · '));
console.log('  时间：', demo2.timeSplit.map((x) => `${x.name} ${x.value}%`).join(' · '));
console.log('  曲线：', demo2.moodCurve.map((x) => `${x.stage} ${x.value}`).join(' → '));
console.log('  称号：', demo2.facts.title);
console.log('  台词：', demo2.moodCurve.map((x) => `${x.stage}「${x.note}」`).join('\n        '));

// ═══════════════════════════════════════════════ 汇总

console.log(`\n${'─'.repeat(64)}`);
if (failures.length) {
  console.log(`✗ ${pass} 项通过，${failures.length} 项失败：`);
  for (const f of failures) console.log(`    · ${f}`);
  console.log('\n注意：失败时先怀疑「设计」是不是真的没达标，不要先动阈值。');
  process.exit(1);
}
console.log(`✓ 全部 ${pass} 项通过`);
