/**
 * test-export-profile.mjs —— 档案导出 / 合并的闸门（2026-10-17 新增）
 *
 * 为什么要单独测这一段：
 *   这两个函数是「子端 → 母端」整条链路的接缝。它们出错**不会报异常**，
 *   只会产出一份"看起来正常、其实没人"的班级数据 ——
 *   比如表头被当数据吃掉、或者答案键对不上导致整行是空的。
 *   这种错在界面上完全看不出来，只会在图表里表现为"全班都是 0 分"。
 *   ⇒ 正是纪律里说的「我以为没问题的两类」，必须进闸门。
 */

import {
  buildProfileCsv,
  mergeCsvTexts,
  makeProfileId,
} from '../src/lib/exportProfile.js';
import { parseCsvText } from '../src/lib/parseCsv.js';
import { QUESTIONS, REQUIRED_COLUMNS } from '../src/lib/surveySchema.js';
import Papa from 'papaparse';
import { cleanSurveyRows } from '../src/lib/surveyClean.js';

let pass = 0;
const fails = [];
function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
  } else {
    fails.push(name + (detail ? ` —— ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? ` —— ${detail}` : ''}`);
  }
}

// 构造一份"全选第一个选项"的答案：键用 id（SurveyForm 的存法）
const byId = {};
const byField = {};
const firstTexts = [];
for (const q of QUESTIONS) {
  const t = q.options[0].text;
  byId[q.id] = t;
  byField[q.field] = t;
  firstTexts.push(t);
}

// ── 1. 表头与列数 ────────────────────────────────────────────────
{
  const csv = buildProfileCsv(byId);
  const header = csv.split('\n')[0].split(',');
  check('无编号时表头 = REQUIRED_COLUMNS', header.join('|') === REQUIRED_COLUMNS.join('|'),
    `实际 ${header.length} 列`);
  check('无编号时只有 1 行数据', csv.trim().split('\n').length === 2);

  const withId = buildProfileCsv(byId, { id: 'P001' });
  const h2 = withId.split('\n')[0].split(',');
  check('带编号时表头首列是「编号」', h2[0] === '编号');
  check('带编号时列数 = 必需列 + 1', h2.length === REQUIRED_COLUMNS.length + 1);
}

// ── 2. 键的形式容错（id 与 field 都要认）────────────────────────
{
  const a = buildProfileCsv(byId).split('\n')[1];
  const b = buildProfileCsv(byField).split('\n')[1];
  check('答案键用 id 与用 field 结果一致', a === b);
  check('答案没有丢失（每列都有值）', a.split(',').every((v) => v.trim() !== ''));
}

// ── 3. 与上传管线往返：导出的文件必须能被 parseCsv 吃掉 ─────────
{
  const csv = buildProfileCsv(byId, { id: 'P002' });
  const parsed = parseCsvText(csv, REQUIRED_COLUMNS);
  check('导出的档案能被上传管线解析', parsed.ok === true, parsed.message ?? '');
  check('解析出 1 行', parsed.ok && parsed.rows.length === 1,
    parsed.ok ? `实际 ${parsed.rows.length} 行` : '');
}

// ── 4. 三份档案合并 ─────────────────────────────────────────────
{
  const one = buildProfileCsv(byId, { id: 'P010' });
  const two = buildProfileCsv(byId, { id: 'P011' });
  const three = buildProfileCsv(byField, { id: 'P012' });
  const merged = mergeCsvTexts([one, two, three]);

  const lines = merged.trim().split('\n');
  check('合并后共 4 行（1 表头 + 3 数据）', lines.length === 4, `实际 ${lines.length}`);
  check(
    '合并后表头只出现一次',
    merged.split(/^\uFEFF?编号,/m).length === 2,
    '表头重复出现',
  );

  const parsed = parseCsvText(merged, REQUIRED_COLUMNS);
  check('合并结果能被上传管线解析', parsed.ok === true, parsed.message ?? '');
  check('合并后解析出 3 个人', parsed.ok && parsed.rows.length === 3,
    parsed.ok ? `实际 ${parsed.rows.length}` : '');
}

// ── 5. 表头不一致时不能吞数据 ───────────────────────────────────
{
  const a = buildProfileCsv(byId, { id: 'P020' });
  // 一份"没有表头"的裸数据（只有一行值）
  const bare = buildProfileCsv(byId, { id: 'P021' }).split('\n')[1];
  const merged = mergeCsvTexts([a, bare]);
  const lines = merged.trim().split('\n');
  check('无表头的那份不会被当成表头吞掉', lines.length === 3, `实际 ${lines.length} 行`);
}

// ── 6. BOM 与空输入 ────────────────────────────────────────────
{
  const bom = `\uFEFF${buildProfileCsv(byId, { id: 'P030' })}`;
  const merged = mergeCsvTexts([bom]);
  check('合并时剥掉 BOM', !merged.startsWith('\uFEFF'));
  check('空输入返回空串', mergeCsvTexts([]) === '' && mergeCsvTexts(['', '  ']) === '');
}

// ── 7. 编号格式 ────────────────────────────────────────────────
{
  const id = makeProfileId(new Date(2026, 9, 17, 18, 30, 5));
  check('编号格式 PYYYYMMDD-HHMMSS-nnnn', /^P\d{8}-\d{6}-\d{4}$/.test(id), id);
  check('编号含日期信息', id.startsWith('P20261017-183005'));
}

// ── 8. 人数统计与去重不混淆（同一人导两次应该算两行）──────────
{
  const same = buildProfileCsv(byId, { id: 'P040' });
  const merged = mergeCsvTexts([same, same]);
  const lines = merged.trim().split('\n');
  check('同一份文件导入两次 = 2 行（不静默去重）', lines.length === 3, `实际 ${lines.length}`);
}

// Regression: two individually valid files must remain two valid people after reordering columns.
{
  const second = Object.fromEntries(QUESTIONS.map(q => [q.field, q.options[1].text]));
  const reversed = Papa.unparse([Object.fromEntries(Object.entries(second).reverse())]);
  const merged = mergeCsvTexts([buildProfileCsv(byField), reversed]);
  const parsed = parseCsvText(merged, REQUIRED_COLUMNS);
  check('列顺序不同也能合并为两条有效作答', parsed.ok && cleanSurveyRows(parsed.rows).records.length === 2);
  check('列重排后每道题的答案仍然对应原字段', REQUIRED_COLUMNS.every(c => parsed.rows[1].__raw[c] === second[c]));

  const laterId = parseCsvText(mergeCsvTexts([buildProfileCsv(byField), buildProfileCsv(second, {id:'LATE-ID'})]), REQUIRED_COLUMNS);
  check('后续文件新增编号不会丢失或移位', laterId.ok && laterId.rows[1].__raw['编号'] === 'LATE-ID');

  const withNote = Papa.unparse([{...byField, 备注: '第一行，含逗号\n第二行含"引号"'}]);
  const multiline = parseCsvText(mergeCsvTexts([withNote, reversed]), REQUIRED_COLUMNS);
  check('引号内换行逗号与双引号完整保留', multiline.ok && multiline.rows.length === 2 && multiline.rows[0].__raw['备注'] === '第一行，含逗号\n第二行含"引号"');

  const throws = input => {try {mergeCsvTexts(input); return false;} catch {return true;}};
  check('缺列的后续文件明确拒绝而非静默丢人', throws([buildProfileCsv(byField), Papa.unparse([{[REQUIRED_COLUMNS[0]]:'不完整'}])]));
  check('重复列名明确拒绝', throws([buildProfileCsv(byField), REQUIRED_COLUMNS.join(',')+','+REQUIRED_COLUMNS[0]+'\n'+Array(REQUIRED_COLUMNS.length+1).fill('x').join(',')]));
  check('未闭合引号明确拒绝', throws([buildProfileCsv(byField), '"unclosed']));
}

console.log(`\n导出/合并：${pass} 项通过${fails.length ? `，${fails.length} 项失败` : ''}`);
if (fails.length) {
  for (const f of fails) console.log('  ·', f);
  process.exit(1);
}
