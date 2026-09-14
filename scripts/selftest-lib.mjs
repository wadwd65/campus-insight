/**
 * 数据层自检（T-05 / T-06 / T-07）
 *
 * 跑法：
 *   node scripts/selftest-lib.mjs
 *
 * 为什么不用测试框架：这个阶段引入 vitest 只会多一个可能装不上的依赖。
 * 纯函数层本身就是「输入 → 输出」，用 assert 足够，而且评委 clone 下来
 * 不用任何额外安装就能跑这一条命令看到结果。
 *
 * 里面有一项特意做成跨语言对账：
 * Python 生成脚本报出「数学正确率 63.24%」，JS 计算层必须算出同一个数才算通过。
 * 两边独立实现、对上了，说明口径没有各写各的。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadStudyRecords,
  parseCsvText,
  validateRows,
  LOAD_STAGE,
} from '../src/lib/loadData.js';
import { weightedAccuracy, slotOf, accuracyOf } from '../src/lib/schema.js';
import { subjectStats, dailyStats, overallStats, addDays, diffDays } from '../src/lib/aggregate.js';
import { investmentOutcome, slotBreakdown, subjectTrends, detectChangePoint, movingAverage, syncPairs, strongestSync } from '../src/lib/diagnose.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SAMPLE = path.join(root, 'public', 'data', '学习记录示例.csv');

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push({ name, detail });
    console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
  }
}

const near = (a, b, tol = 5e-4) => a !== null && Math.abs(a - b) < tol;


// ─────────────────────────────────────────── 一、示例数据（真实文件）

console.log('\n一、示例数据 —— 真实文件走完整流程');
const raw = fs.readFileSync(SAMPLE, 'utf8');
check('文件带 BOM（模拟 Excel 导出）', raw.charCodeAt(0) === 0xfeff);

const loaded = loadStudyRecords(raw);
check('整份文件读入成功', loaded.ok, JSON.stringify(loaded.errors?.slice(0, 2)));
check('共 229 条记录', loaded.records?.length === 229, `实际 ${loaded.records?.length}`);
check('没有行被剔除', loaded.report?.droppedCount === 0, loaded.report?.summary);
check('报告读入 229 行', loaded.report?.inputCount === 229);

const math = loaded.records.filter((r) => r.subject === '数学');
const allMinutes = loaded.records.reduce((s, r) => s + r.minutes, 0);
const mathShare = math.reduce((s, r) => s + r.minutes, 0) / allMinutes;

// 与 scripts/generate-sample-data.py 的输出对账：同一份数据、两套独立实现
check(
  '跨语言对账：数学正确率 = 63.24%',
  near(weightedAccuracy(math), 0.6324),
  `JS 算出 ${(weightedAccuracy(math) * 100).toFixed(2)}%`,
);
check(
  '跨语言对账：数学时长占比 = 46.6%',
  near(mathShare, 0.466, 1e-3),
  `JS 算出 ${(mathShare * 100).toFixed(1)}%`,
);

const bySlot = {};
for (const r of loaded.records) (bySlot[slotOf(r.startTime)] ||= []).push(r);
check(
  '跨语言对账：上午正确率 = 76.81%',
  near(weightedAccuracy(bySlot['上午']), 0.7681),
  `JS 算出 ${(weightedAccuracy(bySlot['上午']) * 100).toFixed(2)}%`,
);
check(
  '跨语言对账：下午正确率 = 63.31%',
  near(weightedAccuracy(bySlot['下午']), 0.6331),
  `JS 算出 ${(weightedAccuracy(bySlot['下午']) * 100).toFixed(2)}%`,
);

check('记录的字段名已转为内部英文', 'subject' in loaded.records[0] && 'minutes' in loaded.records[0]);
check(
  '输出已按时间升序',
  loaded.records.every((r, i) => {
    if (i === 0) return true;
    const prev = loaded.records[i - 1];
    return prev.date < r.date || (prev.date === r.date && prev.startTime <= r.startTime);
  }),
);
check('单条正确率可算', near(accuracyOf({ questions: 20, correct: 13 }), 0.65));
check('分母为 0 时返回 null 而不是 NaN', accuracyOf({ questions: 0, correct: 0 }) === null);


// ─────────────────────────────────────────── 二、表头顺序

console.log('\n二、表头顺序变化');
const lines = raw.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const order = ['正确数', '科目', '时长_分钟', '日期', '完成题量', '开始时间'];
const idx = lines[0].split(',').map((h, i) => [h.trim(), i]);
const pick = (line, col) => {
  const i = idx.find(([h]) => h === col)[1];
  return line.split(',')[i];
};
const shuffled = [
  order.join(','),
  ...lines.slice(1).map((l) => order.map((c) => pick(l, c)).join(',')),
].join('\n');

const shuffledResult = loadStudyRecords(shuffled);
check('列顺序打乱后仍能读入', shuffledResult.ok, JSON.stringify(shuffledResult.errors?.slice(0, 2)));
check('打乱后记录数不变', shuffledResult.records?.length === 229);
check(
  '打乱后数字不变（同一行同一科）',
  shuffledResult.records?.[0]?.subject === loaded.records[0].subject &&
    shuffledResult.records?.[0]?.minutes === loaded.records[0].minutes,
);


// ─────────────────────────────────────────── 三、结构错误（整份拒绝）

console.log('\n三、结构错误 —— 应该整份拒绝，并说清原因');
const structural = [
  ['空文件', '', 'EMPTY_FILE'],
  ['只有 BOM 和空白', '\uFEFF   \n  \n', 'EMPTY_FILE'],
  ['只有表头没有数据行', '日期,开始时间,科目,时长_分钟,完成题量,正确数\n', 'NO_DATA_ROWS'],
];
for (const [name, text, expectCode] of structural) {
  const r = loadStudyRecords(text);
  check(
    `${name} → 被拒绝且错误码为 ${expectCode}`,
    !r.ok && r.errors.some((e) => e.code === expectCode),
    JSON.stringify(r.errors),
  );
  check(`${name} → 不抛异常且错误信息是人话`, !r.ok && /[。：]/.test(r.errors[0].message));
}

const missingCol = '日期,开始时间,科目,时长_分钟\n2026-03-01,08:30,数学,90';
const missingResult = loadStudyRecords(missingCol);
check(
  '缺列 → 点名缺的是「完成题量、正确数」',
  !missingResult.ok &&
    missingResult.errors[0].message.includes('完成题量') &&
    missingResult.errors[0].message.includes('正确数'),
  missingResult.errors?.[0]?.message,
);
check('缺列被归到 parse 阶段', missingResult.stage === LOAD_STAGE.PARSE);


// ─────────────────────────────────────────── 四、字段错误（整份拒绝）

console.log('\n四、字段错误 —— 逐行校验，任何一行不成立就整份拒绝');
const header = '日期,开始时间,科目,时长_分钟,完成题量,正确数';

const fieldCases = [
  ['日期写成斜杠', '2026/03/01,08:30,数学,90,20,13', '日期格式'],
  ['不存在的日期 02-30', '2026-02-30,08:30,数学,90,20,13', '不是一个真实存在'],
  ['时间超出范围', '2026-03-01,25:00,数学,90,20,13', '不是有效时间'],
  ['时长写成文字', '2026-03-01,08:30,数学,一个半小时,20,13', '不是整数'],
  ['时长写成小数', '2026-03-01,08:30,数学,90.5,20,13', '不是整数'],
  ['科目为空', '2026-03-01,08:30,,90,20,13', '科目不能为空'],
  ['正确数大于完成题量', '2026-03-01,08:30,数学,90,20,25', '串位'],
  ['时长是负数', '2026-03-01,08:30,数学,-90,20,13', '不能是负数'],
  ['完成题量是负数', '2026-03-01,08:30,数学,90,-20,13', '不能是负数'],
];
for (const [name, row, keyword] of fieldCases) {
  const r = loadStudyRecords(`${header}\n${row}`);
  const hit = r.errors?.some((e) => e.message.includes(keyword));
  check(`${name} → 报错且提到「${keyword}」`, !r.ok && hit, JSON.stringify(r.errors?.[0]));
}

const lineNo = loadStudyRecords(`${header}\n2026-03-01,08:30,数学,90,20,13\n2026-03-02,08:30,数学,90,20,99`);
check('错误信息带行号（第 3 行）', lineNo.errors?.[0]?.line === 3, JSON.stringify(lineNo.errors?.[0]));
check('有非法行时不返回部分结果', lineNo.records.length === 0);

check(
  '时间 8:30 被规范成 08:30',
  loadStudyRecords(`${header}\n2026-03-01,8:30,数学,90,20,13`).records[0].startTime === '08:30',
);
check(
  '列名带空格仍能识别',
  parseCsvText(' 日期 , 开始时间 ,科目,时长_分钟,完成题量,正确数\n2026-03-01,08:30,数学,90,20,13').ok,
);


// ─────────────────────────────────────────── 五、清洗（剔除并告知）

console.log('\n五、清洗 —— 剔除并如实告知剔了几行');
const dirty = [
  header,
  '2026-03-01,08:30,数学,90,20,13',
  '2026-03-01,08:30,数学,90,20,13', // 完全重复
  '2026-03-01,14:00,英语,0,20,15', // 时长为 0
  '2026-03-01,15:00,英语,45,0,0', // 题量为 0，正确率算不出来
  '2026-03-02,09:00,政治,50,25,18',
  '2026-03-02,09:00,政治,50,25,18', // 又一条重复
].join('\n');

const dirtyResult = loadStudyRecords(dirty);
check('脏数据不拒绝整份文件', dirtyResult.ok, JSON.stringify(dirtyResult.errors));
check('读入 6 行', dirtyResult.report.inputCount === 6, String(dirtyResult.report.inputCount));
check('剔除 4 行（2 条重复 + 1 条零时长 + 1 条零题量）', dirtyResult.report.droppedCount === 4, String(dirtyResult.report.droppedCount));
check('实际使用 2 行', dirtyResult.records.length === 2);
check(
  '报告是完整的人话，三种原因各一条',
  dirtyResult.report.summary.includes('剔除') && dirtyResult.report.reasons.length === 3,
  dirtyResult.report.summary,
);
check(
  '报告里能看出剔的是什么',
  dirtyResult.report.reasons.map((r) => r.reason).sort().join(',') === 'DUPLICATE,ZERO_MINUTES,ZERO_QUESTIONS',
  JSON.stringify(dirtyResult.report.reasons.map((r) => r.reason)),
);
check(
  '重复行报出源文件行号',
  dirtyResult.report.reasons.find((r) => r.reason === 'DUPLICATE')?.lines.length === 2,
  JSON.stringify(dirtyResult.report.reasons),
);

const sameSlot = loadStudyRecords(
  [header, '2026-03-01,08:30,数学,90,20,13', '2026-03-01,08:30,数学,60,10,7'].join('\n'),
);
check('同一时刻同科不同值 → 保留但给出提醒', sameSlot.ok && sameSlot.records.length === 2 && sameSlot.warnings.length === 1,
  JSON.stringify(sameSlot.warnings));


// ─────────────────────────────────────────── 六、界面文案

console.log('\n六、给界面用的一句话总结');
const { describeLoadResult } = await import('../src/lib/loadData.js');
check('成功时给的是清洗报告', describeLoadResult(loaded) === loaded.report.summary);
check('失败时按阶段给不同措辞', describeLoadResult(missingResult).includes('文件没能读进来'));
check(
  '字段错时提示去改源文件',
  describeLoadResult(lineNo).includes('先改好再导入'),
  describeLoadResult(lineNo),
);


// ─────────────────────────────────────────── 七、聚合层（T-08 / T-09）

console.log('\n七、聚合层 —— 科目聚合与按日聚合');
const R = loaded.records;
const subjects = subjectStats(R);
const overall = overallStats(R);

const expectSubjects = [
  ['数学', 8579, 0.466, 0.6324],
  ['专业课', 4505, 0.244, 0.682],
  ['英语', 3679, 0.2, 0.7402],
  ['政治', 1663, 0.09, 0.7163],
];
check('科目数 = 4', subjects.length === 4, String(subjects.length));
check(
  '按科目聚合的时长/占比/正确率与生成端一致',
  expectSubjects.every(([name, minutes, share, acc]) => {
    const s = subjects.find((x) => x.subject === name);
    return s && s.minutes === minutes && near(s.minutesShare, share, 1e-3) && near(s.accuracy, acc);
  }),
  JSON.stringify(subjects.map((s) => [s.subject, s.minutes, +s.minutesShare.toFixed(3), +s.accuracy.toFixed(4)])),
);
check('科目已按时长降序', subjects[0].subject === '数学' && subjects[3].subject === '政治');

const days = dailyStats(R);
check('按日聚合 = 79 天有记录', days.length === 79, String(days.length));
check('按日聚合不补零（无记录的日子不出现）', days.every((d) => d.minutes > 0));
check('按日聚合按日期升序', days.every((d, i) => i === 0 || days[i - 1].date < d.date));

check('有记录天数 79 / 日历天数 80', overall.daysWithRecords === 79 && overall.calendarDays === 80,
  `${overall.daysWithRecords} / ${overall.calendarDays}`);
check('确认有 1 天完全没记录，且被单独标出', overall.missingDates.length === 1, JSON.stringify(overall.missingDates));
check('日均时长按「有记录天数」算 = 233 分钟', near(overall.avgMinutesPerActiveDay, 18426 / 79, 0.5),
  `${overall.avgMinutesPerActiveDay.toFixed(1)} 分钟`);


// ─────────────────────────────────────────── 八、诊断层（T-10 / T-11）

console.log('\n八、诊断层 —— 投入产出与时段');
const io = investmentOutcome(R);
check('最该关注的科目是数学', io.worst?.subject === '数学', io.worst?.subject);
check('数学排名差 = +3（时长第 1、正确率第 4，完全倒挂）', io.worst?.divergence === 3, String(io.worst?.divergence));
check('数学被判定为「高投入低产出」', io.worst?.verdict === '高投入低产出', io.worst?.verdict);
check('数学正确率低于整体水平', io.worst?.accuracyGap < 0, `${(io.worst?.accuracyGap * 100).toFixed(2)} 个百分点`);
check('确实存在背离', io.hasDivergence === true);
check('英语被判定为「低投入高产出」（反例）', io.items.find((i) => i.subject === '英语')?.verdict === '低投入高产出',
  io.items.find((i) => i.subject === '英语')?.verdict);

const slots = slotBreakdown(R);
check('高效时段是上午', slots.best?.slot === '上午', slots.best?.slot);
check('低效时段是下午', slots.worst?.slot === '下午', slots.worst?.slot);
check('上午比下午高出 13.5 个百分点', near(slots.spread, 0.135, 1e-3), `${(slots.spread * 100).toFixed(2)} 个百分点`);
check('时段正确率与生成端一致（上午 76.81% / 下午 63.31%）',
  near(slots.slots.find((s) => s.slot === '上午').accuracy, 0.7681) &&
    near(slots.slots.find((s) => s.slot === '下午').accuracy, 0.6331));
check('发现时段错配：最差的科目正好堆在最差的时段', slots.misallocation.worstSubjectSitsInWorstSlot === true,
  JSON.stringify(slots.misallocation.worstSlotTopSubject));
check('数学下午时长占比 64% 上下', near(slots.matrix['数学']['下午'], 0.64, 0.02),
  `${(slots.matrix['数学']['下午'] * 100).toFixed(1)}%`);


// ─────────────────────────────────────────── 九、趋势层（T-12）

console.log('\n九、趋势层 —— 转折点检测');
const trends = subjectTrends(R);
const engTrend = trends.find((t) => t.subject === '英语');
const engOffset = diffDays('2026-04-14', engTrend.accuracyChange.date);
check('英语下滑点检测误差 ≤ 3 天', Math.abs(engOffset) <= 3,
  `检测到 ${engTrend.accuracyChange.date}（设定 2026-04-14，偏 ${engOffset} 天）`);
check('英语判定为下滑方向', engTrend.accuracyChange.direction === 'down');
check('英语下滑幅度 ≈ 10.6 个百分点', near(Math.abs(engTrend.accuracyChange.delta), 0.1058, 5e-3),
  `${(engTrend.accuracyChange.delta * 100).toFixed(2)} 个百分点`);
check('数学时长判定为上升方向', trends.find((t) => t.subject === '数学').minutesChange.direction === 'up');

// 跨科目同步：这才是产品真正要讲的那句话
const pairs = syncPairs(trends);
const mainPair = strongestSync(pairs);
check('检出「英语正确率下滑」与「数学时长上升」的跨科目同步',
  !!mainPair && mainPair.dropSubject === '英语' && mainPair.riseSubject === '数学' && !mainPair.sameSubject,
  JSON.stringify(pairs.map((p) => `${p.dropSubject}↓/ ${p.riseSubject}↑ 滞后${p.lagDays}天`)));
check('两个转折点相差 ≤ 5 天', mainPair && Math.abs(mainPair.lagDays) <= 5, `滞后 ${mainPair?.lagDays} 天`);
check('同步对里同时带上跌幅与涨幅两个数字',
  mainPair && mainPair.accuracyDropPoints > 0.05 && mainPair.minutesRiseRatio > 0.15,
  `掉 ${(mainPair?.accuracyDropPoints * 100).toFixed(1)} 个百分点 / 涨 ${(mainPair?.minutesRiseRatio * 100).toFixed(0)}%`);
check('显著性门槛生效：平稳科目不会凑出假同步',
  pairs.every((p) => p.accuracyDropPoints >= 0.05 && p.minutesRiseRatio >= 0.15));

// 回归测试：专门锁死「滑动平均滞后」这个坑。
// 造一条理想的阶跃序列（第 20 天从 1 掉到 0），居中平均必须把转折点定在第 20 天附近；
// 滞后平均必然偏后。两者一比，就把修复固化下来了 —— 以后谁改回滞后版，这里立刻红。
const stepSeries = Array.from({ length: 40 }, (_, i) => ({
  date: addDays('2026-01-01', i),
  value: i < 20 ? 1 : 0,
}));
const stepCentered = detectChangePoint(stepSeries, { window: 7, minSeg: 10 });
const laggedMa = movingAverage(stepSeries, 7, false);
let laggedCross = null;
for (let i = 0; i < laggedMa.length; i += 1) {
  if (laggedMa[i].value < 0.5) { laggedCross = i; break; }
}
check('居中平均把阶跃点定在第 20 天（误差 ≤1 天）', Math.abs(stepCentered.index - 20) <= 1,
  `定在第 ${stepCentered.index} 天`);
check('滞后平均确实偏后（证明这个坑真实存在）', laggedCross !== null && laggedCross > stepCentered.index,
  `滞后版落在第 ${laggedCross} 天，偏 ${laggedCross - 20} 天`);

const rising = Array.from({ length: 40 }, (_, i) => ({ date: addDays('2026-01-01', i), value: i < 20 ? 10 : 30 }));
check('上升阶跃被判定为 up', detectChangePoint(rising, { window: 7, minSeg: 10 }).direction === 'up');
check('序列太短时返回 null 而不是瞎猜', detectChangePoint(stepSeries.slice(0, 8), { minSeg: 10 }) === null);
check('正确率序列不补零（英语天数 = 有英语记录的天数）', engTrend.accuracySeries.length < 80 && engTrend.accuracySeries.length > 60,
  `${engTrend.accuracySeries.length} 天`);
check('时长序列补零（固定覆盖 80 天）', engTrend.minutesSeries.length === 80, String(engTrend.minutesSeries.length));


// ─────────────────────────────────────────── 十、极端输入

console.log('\n十、极端输入 —— 空数据不许抛异常');
const empties = [
  ['subjectStats', () => subjectStats([])],
  ['dailyStats', () => dailyStats([])],
  ['overallStats', () => overallStats([])],
  ['investmentOutcome', () => investmentOutcome([])],
  ['slotBreakdown', () => slotBreakdown([])],
  ['subjectTrends', () => subjectTrends([])],
  ['detectChangePoint', () => detectChangePoint([])],
];
for (const [name, fn] of empties) {
  let ok = true;
  let value;
  try { value = fn(); } catch (e) { ok = false; value = e.message; }
  check(`${name}(空数组) 不抛异常`, ok, String(value));
}
check('空数据的整体正确率是 null 而不是 NaN', overallStats([]).accuracy === null);
check('空数据的日均是 null 而不是 Infinity', overallStats([]).avgMinutesPerActiveDay === null);
check('单条记录也能算', investmentOutcome([{ subject: '数学', date: '2026-03-01', startTime: '08:00', minutes: 60, questions: 10, correct: 6 }]).items.length === 1);


// ─────────────────────────────────────────── 汇总

console.log(`\n${'─'.repeat(56)}`);
if (failures.length) {
  console.log(`通过 ${passed} 项，失败 ${failures.length} 项：`);
  for (const f of failures) console.log(`  - ${f.name}${f.detail ? `　(${f.detail})` : ''}`);
  process.exit(1);
}
console.log(`全部通过：${passed} 项`);
