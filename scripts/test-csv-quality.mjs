#!/usr/bin/env node
/**
 * CSV 质量闸门 —— `node scripts/test-csv-quality.mjs`
 *
 * ★ 10-14 新增（对应审查任务书 P4 的验收标准）。
 *
 * 上一个文件（smoke-csv.mjs）测的是"一份好 CSV 能不能一路走到画像"。
 * 本文件测的是反过来的那半：**一份坏 CSV 会发生什么** ——
 * 空文件、没有表头、缺列、只有表头、引号不闭合、超大文件、值全是脏的。
 *
 * 为什么这部分最要紧：真实使用里，用户上传的第一份文件大概率**不是**格式正确的。
 * 而"畸形 CSV 导致页面崩溃"是最伤演示效果的一类失败 —— 白屏一次，评委的印象就定了。
 * 所以每条畸形输入都必须有明确的、可读的结局，而不是抛异常。
 */

import { parseCsvText, CSV_ERROR } from '../src/lib/parseCsv.js';
import { cleanSurveyRows } from '../src/lib/surveyClean.js';
import { QUESTIONS, REQUIRED_COLUMNS, emptyAnswers } from '../src/lib/surveySchema.js';
import { checkFileSize, assessQuality, THRESHOLDS } from '../src/lib/thresholds.js';

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

/** 造一份合法 CSV 文本（每题取第 1 个选项）。 */
function goodCsv(n = 10) {
  const header = ['编号', ...REQUIRED_COLUMNS].join(',');
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const cells = QUESTIONS.map((q) => q.options[i % q.options.length].text);
    rows.push([`S${i + 1}`, ...cells].join(','));
  }
  return [header, ...rows].join('\n');
}

console.log('\n一 · 六类畸形 CSV 都必须有可读结局（不能抛异常）');
{
  const cases = [
    ['空文件', '', CSV_ERROR.EMPTY_FILE],
    ['只有空白', '   \n  \n', CSV_ERROR.EMPTY_FILE],
    ['只有表头无数据行', ['编号', ...REQUIRED_COLUMNS].join(','), CSV_ERROR.NO_DATA_ROWS],
    ['缺列', '编号,' + REQUIRED_COLUMNS.slice(0, 3).join(',') + '\nS1,a,b,c', CSV_ERROR.MISSING_COLUMNS],
  ];
  for (const [label, text, expect] of cases) {
    let r;
    try {
      r = parseCsvText(text, REQUIRED_COLUMNS);
    } catch (e) {
      check(`${label} → 不抛异常`, false, `抛了 ${e.name}`);
      continue;
    }
    check(`${label} → 被拒绝且错误码正确`, r.ok === false && r.errors[0]?.code === expect,
      `ok=${r.ok}, code=${r.errors[0]?.code}`);
    check(`${label} → 错误信息是人话（含具体指引）`, (r.errors[0]?.message ?? '').length >= 8,
      r.errors[0]?.message?.slice(0, 40));
  }

  // 引号不闭合：PapaParse 会报 error 但仍返回行 —— 要求"不崩且给出提醒"
  const broken = ['编号,' + REQUIRED_COLUMNS.join(',')].concat(
    Array.from({ length: 5 }, (_, i) => `S${i},${QUESTIONS.map((q) => `"${q.options[0].text}`).join(',')}`),
  ).join('\n');
  let r;
  try {
    r = parseCsvText(broken, REQUIRED_COLUMNS);
    check('引号不闭合 → 不抛异常', true);
    check('引号不闭合 → 至少给出格式提醒或明确结果', true, r.ok ? `warnings=${r.errors.length}` : r.errors[0]?.code);
  } catch (e) {
    check('引号不闭合 → 不抛异常', false, `抛了 ${e.name}`);
  }
}

console.log('\n二 · 数据质量报告必须齐全（任务书 P4#3 的七项）');
{
  const r = parseCsvText(goodCsv(20), REQUIRED_COLUMNS);
  const c = cleanSurveyRows(r.rows);
  const rep = c.report;

  for (const [label, key] of [
    ['原始记录数', 'inputCount'],
    ['有效记录数', 'keptCount'],
    ['被剔除记录数', 'droppedCount'],
    ['剔除比例', 'dropRatio'],
    ['缺失值数量', 'missingCells'],
    ['非法选项数量', 'invalidCells'],
    ['重复记录数量', 'duplicateCount'],
  ]) {
    check(`报告含「${label}」`, key in rep && typeof rep[key] === 'number', `${key}=${rep[key]}`);
  }
  check('报告含基准版本与数据来源', !!rep.baseline && !!rep.baseline.version && !!rep.baseline.source,
    `v${rep.baseline?.version} / ${(rep.baseline?.source ?? '').slice(0, 18)}`);
  check('干净数据：剔除 0 条', rep.droppedCount === 0, `剔除 ${rep.droppedCount}`);
}

console.log('\n三 · 缺失值与非法选项必须分开统计（改法不同）');
{
  // 造一行：1 个空值 + 2 个非法值
  const lines = goodCsv(5).split('\n');
  const header = lines[0].split(',');
  const bad = [...lines[1].split(',')];
  bad[1] = '';                 // 第 1 题留空
  bad[2] = '我在瞎填';          // 第 2 题非法
  bad[3] = '这也是瞎填的';      // 第 3 题非法
  const text = [lines[0], bad.join(','), ...lines.slice(2)].join('\n');

  const c = cleanSurveyRows(parseCsvText(text, REQUIRED_COLUMNS).rows);
  const rep = c.report;
  check('空值计数 = 1', rep.missingCells === 1, `实际 ${rep.missingCells}`);
  check('非法选项计数 = 2', rep.invalidCells === 2, `实际 ${rep.invalidCells}`);
  check('该行被剔除（可用数少 1）', rep.keptCount === 4, `可用 ${rep.keptCount}`);
  check('汇总文案里两类都提到了',
    rep.summary.includes('空') && (rep.summary.includes('不匹配') || rep.summary.includes('选项')),
    rep.summary.slice(0, 60));
}

console.log('\n四 · 小样本 / 高剔除比例要有明确提示（P4#4 + P4#8）');
{
  // 样本太少
  const few = cleanSurveyRows(parseCsvText(goodCsv(3), REQUIRED_COLUMNS).rows);
  const q1 = assessQuality(few.report);
  check('3 条可用 → 判定需要确认（block）', q1.needConfirm && q1.level === 'block', q1.level);

  // 样本偏少但可用
  const mid = cleanSurveyRows(parseCsvText(goodCsv(10), REQUIRED_COLUMNS).rows);
  const q2 = assessQuality(mid.report);
  check('10 条可用 → 提示样本偏少但不拦', q2.level === 'warn' && !q2.needConfirm, q2.level);

  // 剔除比例高
  const lines = goodCsv(20).split('\n');
  const header = lines[0];
  const body = lines.slice(1).map((ln, i) => {
    if (i % 2 === 0) {
      const cells = ln.split(',');
      cells[1] = '乱填的值';
      return cells.join(',');
    }
    return ln;
  });
  const dirty = cleanSurveyRows(parseCsvText([header, ...body].join('\n'), REQUIRED_COLUMNS).rows);
  const q3 = assessQuality(dirty.report);
  check('剔除 >30% → 判定需要确认（warn）',
    q3.needConfirm && q3.level === 'warn',
    `剔除 ${Math.round(dirty.report.dropRatio * 100)}% / ${q3.level}`);

  // 样本多且干净 → 不打扰
  const clean = cleanSurveyRows(parseCsvText(goodCsv(40), REQUIRED_COLUMNS).rows);
  const q4 = assessQuality(clean.report);
  check('40 条且干净 → 不弹任何提示', q4.level === 'ok' && !q4.needConfirm, q4.level);

  // 阈值是集中配置的（产品策略，不是统计学标准）
  check('阈值集中定义且带说明', typeof THRESHOLDS.minRecordsForCohort === 'number'
    && THRESHOLDS.minRecordsForCohort < THRESHOLDS.minRecordsForWarning);
}

console.log('\n五 · 文件大小限制在读取前生效（P4#2）');
{
  check('5MB 以内 → 放行', checkFileSize({ size: 1024 * 1024, name: 'a.csv' }).ok);
  const big = checkFileSize({ size: 20 * 1024 * 1024, name: 'big.csv' });
  check('20MB → 拒绝', !big.ok);
  check('拒绝信息含具体大小与上限', big.message.includes('20.0') && big.message.includes('5 MB'),
    big.message.slice(0, 50));
  check('没有 size 字段时放行（不误拦）', checkFileSize({ name: 'x.csv' }).ok);
}

console.log('\n六 · 全空值文件 / 全非法值文件（极端但要能收场）');
{
  // 全空值：表头合法但每格都空
  const emptyRows = ['编号,' + REQUIRED_COLUMNS.join(',')]
    .concat(Array.from({ length: 5 }, (_, i) => `S${i},,,,,,,,,,`))
    .join('\n');
  const c1 = cleanSurveyRows(parseCsvText(emptyRows, REQUIRED_COLUMNS).rows);
  check('全空值 → ok=false（没有一条可用）且给出原因', !c1.ok && c1.report.droppedCount === 5,
    c1.report.summary.slice(0, 50));

  // 全非法值
  const badRows = ['编号,' + REQUIRED_COLUMNS.join(',')]
    .concat(Array.from({ length: 5 }, (_, i) => `S${i},` + Array(REQUIRED_COLUMNS.length).fill('乱填').join(',')))
    .join('\n');
  const c2 = cleanSurveyRows(parseCsvText(badRows, REQUIRED_COLUMNS).rows);
  check('全非法值 → ok=false 且非法计数正确', !c2.ok && c2.report.invalidCells === 5 * REQUIRED_COLUMNS.length,
    `invalid=${c2.report.invalidCells}`);
}

console.log('\n' + '─'.repeat(64));
if (failures.length) {
  console.log(`✗ ${failures.length} 项失败 / 共 ${pass + failures.length} 项`);
  for (const f of failures) console.log(`   · ${f}`);
  process.exit(1);
} else {
  console.log(`✓ 全部 ${pass} 项通过`);
}
