#!/usr/bin/env node
/**
 * 统计有效性闸门 —— `node scripts/test-statistical-validity.mjs`
 *
 * ★ 10-13 新增（对应审查任务书 P2#2/#8 与 P6#1）。
 *
 * 为什么统计层需要单独的边界测试：
 *   百分位是这个产品**唯一对外说出的数字**（「你超过了 82% 的大学生」）。
 *   它的正常路径很容易写对，真正会出事的是边缘 —— 空基准、单样本、全同值、
 *   并列、极值、NaN、缺字段、损坏数据。这些输入在真实使用里迟早会出现
 *   （一个上传的 CSV 里少一列、多一个空行就够了），而它们出错时的表现
 *   往往不是崩溃，而是**安静地给一个看起来正常的错数字** —— 那比崩溃更糟。
 *
 * 本文件把任务书列出的 8 类边界逐条钉住，另加确定性测试（同样输入必须同样输出）。
 */

import { ALL_ATTR_KEYS, QUESTIONS, emptyAnswers } from '../src/lib/surveySchema.js';
import {
  buildBaseline,
  percentileOf,
  toAttributes,
  toAttributeMatrix,
  toPercents,
} from '../src/lib/matrix.js';
import { buildReport, radarOf, timeSplitOf, moodCurveOf, factsOf } from '../src/lib/results.js';
import { distance } from '../src/lib/cohort.js';

let pass = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}${detail ? '  ' + detail : ''}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? '  ' + detail : ''}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n一 · percentileOf 的八类边界');
// ─────────────────────────────────────────────────────────────────────────

// ① 空数组
check('空基准 → 中性 50（不假装知道）', percentileOf(50, []) === 50 && percentileOf(50, undefined) === 50);

// ② 单个样本
//    注意：等于唯一基准值时应落在**中点 50**，不是 98 —— 基准只有一个人，
//    你和他完全并列，排名中点是 0.5/1 = 50%。这不是"夹取"，是并列规则的自然结果。
check('单样本基准：小于它 → 夹到 2', percentileOf(1, [10]) === 2, `1→${percentileOf(1, [10])}`);
check('单样本基准：等于它 → 并列中点 50', percentileOf(10, [10]) === 50, `10→${percentileOf(10, [10])}`);

// ③ 所有样本数值相同（此时任何人都会被判为并列 → 取中点）
{
  const same = [5, 5, 5, 5];
  const got = percentileOf(5, same);
  check('全同基准：并列取中点（不是 0 也不是 100）', got === 50, `实际 ${got}`);
}

// ④ 并列值取排名中点 —— 用一组含三连并列的数据验证
{
  const arr = [1, 2, 3, 3, 3, 4];
  // 值 3 的排名区间是 [2,5)，中点 3.5 → 3.5/6 = 58.3% → 58
  const got = percentileOf(3, arr);
  check('并列值取排名中点', got === 58, `实际 ${got}`);
}

// ⑤ 最小值 / 最大值（越界夹取）
{
  const arr = [10, 20, 30];
  check('小于全部 → 夹到 2', percentileOf(0, arr) === 2);
  check('大于全部 → 夹到 98', percentileOf(99, arr) === 98);
}

// ⑥ 非有限数值（NaN / ±Infinity / undefined）
check('NaN → 中性 50（不伪装成"特别低"）', percentileOf(NaN, [1, 2, 3]) === 50);
check('Infinity → 中性 50', percentileOf(Infinity, [1, 2, 3]) === 50);
check('undefined → 中性 50', percentileOf(undefined, [1, 2, 3]) === 50);

// ⑦ 缺失属性 —— 属性对象里少一维时，toPercents 不能崩、且该维为中性
{
  const partial = { academic: 5 }; // 只有一维
  const baseline = buildBaseline([{ academic: 5 }]);
  const p = toPercents(partial, baseline);
  check('缺失属性不崩、且为中性 50',
    p.academic !== undefined && p.social === 50, `social=${p.social}`);
}

// ⑧ 基准数据损坏（数组里混入 NaN / 非数字）
{
  const dirty = [{ academic: 1 }, { academic: NaN }, { academic: 3 }, { academic: undefined }];
  const baseline = buildBaseline(dirty);
  const n = baseline.sorted.academic.length;
  check('buildBaseline 剔除非有限值（脏数据不进排序表）', n === 2, `有效值 ${n} 个`);
  // 剔干净之后，正常值仍能落回 2~98
  const p = percentileOf(3, baseline.sorted.academic);
  check('脏数据剔除后，百分位仍在 2~98', p >= 2 && p <= 98, `实际 ${p}`);
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n二 · 确定性与可复现');
// ─────────────────────────────────────────────────────────────────────────

{
  const records = [];
  for (let i = 0; i < 60; i += 1) {
    const a = emptyAnswers();
    for (const q of QUESTIONS) a[q.field] = q.options[i % q.options.length].text;
    records.push(a);
  }
  const baseline = buildBaseline(toAttributeMatrix(records));

  const ans = emptyAnswers();
  for (const q of QUESTIONS) ans[q.field] = q.options[0].text;

  const r1 = buildReport(ans, baseline);
  const r2 = buildReport(ans, baseline);

  check('同一输入 → 同一百分位（可复现）',
    JSON.stringify(r1.percents) === JSON.stringify(r2.percents));
  check('同一输入 → 同一雷达图',
    JSON.stringify(radarOf(r1.percents)) === JSON.stringify(radarOf(r2.percents)));
  check('同一输入 → 同一时间分配',
    JSON.stringify(timeSplitOf(r1.percents)) === JSON.stringify(timeSplitOf(r2.percents)));
  check('同一输入 → 同一四年曲线',
    JSON.stringify(moodCurveOf(r1.percents)) === JSON.stringify(moodCurveOf(r2.percents)));
  check('同一输入 → 同一冷知识',
    JSON.stringify(factsOf(r1.percents)) === JSON.stringify(factsOf(r2.percents)));
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n三 · 输出与计算值一致（图表 / 文字 / 数字三处同源）');
// ─────────────────────────────────────────────────────────────────────────

{
  const records = [];
  for (let i = 0; i < 60; i += 1) {
    const a = emptyAnswers();
    for (const q of QUESTIONS) a[q.field] = q.options[(i * 3) % q.options.length].text;
    records.push(a);
  }
  const baseline = buildBaseline(toAttributeMatrix(records));
  const ans = emptyAnswers();
  for (const q of QUESTIONS) ans[q.field] = q.options[1 % q.options.length].text;
  const report = buildReport(ans, baseline);

  // 时间分配：5 项之和必须是 100（±0.1）—— 否则环形图会露出一条缝
  const tsum = report.timeSplit.reduce((s, x) => s + x.value, 0);
  check('时间分配五项之和 = 100（±0.1）', Math.abs(tsum - 100) <= 0.1, `实际 ${tsum.toFixed(1)}%`);

  // 雷达图数值必须就是百分位本身（不是另算一套）
  check('雷达图数值 === 对应维度的百分位',
    report.radar.every((d) => d.value === report.percents[d.key]));

  // 冷知识的句子里必须出现它自己的百分位数字（不能是另一套数）
  check('冷知识句子里的数字与 percent 一致',
    report.facts.lines.every((l) => l.text.includes(String(l.high ? l.pct : 100 - l.pct))));

  // 所有百分位必须落在 2~98
  check('全部百分位落在 2~98',
    ALL_ATTR_KEYS.every((k) => report.percents[k] >= 2 && report.percents[k] <= 98));
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n四 · 相似度距离不含派生属性（防重复计权，任务书 P4#6）');
// ─────────────────────────────────────────────────────────────────────────
{
  // buddy = -1×plan + 1×resilience 是纯线性组合，不含新信息。
  // 若把它算进距离，plan 与 resilience 就被计了两遍 —— 这里用一组"只在 plan /
  // resilience 上有差异"的记录钉住：距离必须恰好等于这两个基础维的贡献。
  const a = { academic: 0, social: 0, sport: 0, food: 0, night: 0, plan: 10, novelty: 0, resilience: 20, buddhist: 10 };
  const b = { academic: 0, social: 0, sport: 0, food: 0, night: 0, plan: 0, novelty: 0, resilience: 0, buddhist: 0 };

  const d = distance(a, b);
  const expectedBase = Math.sqrt(10 ** 2 + 20 ** 2);            // 只用基础维 → √500 ≈ 22.36
  const withDerived = Math.sqrt(10 ** 2 + 20 ** 2 + 10 ** 2);   // 若把 buddhist 也算上 → √600 ≈ 24.49

  check('距离 = 只含基础维（不含派生 buddhist）',
    Math.abs(d - expectedBase) < 1e-9, `实际 ${d.toFixed(3)}，基础维应为 ${expectedBase.toFixed(3)}`);
  check('距离显著小于"把派生维也算上"的结果（确认没重复计权）',
    d < withDerived - 1, `实际 ${d.toFixed(3)} vs 含派生 ${withDerived.toFixed(3)}`);

  // 反向：一个纯派生维的差异不该产生任何距离（因为它不含新信息）
  const c = { ...b, buddhist: 50 };
  check('仅派生属性不同 → 距离为 0（派生维不参与相似度）',
    distance(c, b) === 0, `实际 ${distance(c, b)}`);
}

console.log('\n' + '─'.repeat(64));
if (failures.length) {
  console.log(`✗ ${failures.length} 项失败 / 共 ${pass + failures.length} 项`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
} else {
  console.log(`✓ 全部 ${pass} 项通过`);
}
