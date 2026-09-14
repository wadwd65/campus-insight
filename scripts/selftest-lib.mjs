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


// ─────────────────────────────────────────── 汇总

console.log(`\n${'─'.repeat(56)}`);
if (failures.length) {
  console.log(`通过 ${passed} 项，失败 ${failures.length} 项：`);
  for (const f of failures) console.log(`  - ${f.name}${f.detail ? `　(${f.detail})` : ''}`);
  process.exit(1);
}
console.log(`全部通过：${passed} 项`);
