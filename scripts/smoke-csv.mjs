/**
 * smoke-csv.mjs —— CSV 主线端到端冒烟（进 `npm run check`）
 *
 * ── 它解决的问题（用户 10-08 指出） ───────────────────────────────
 * 「上传 CSV → 群体画像」这条主线以前**只靠手动点页面**验证过，
 * 一旦某个环节静默坏掉（列名校验、清洗、分组、结论文案），
 * `check` 不会知道 —— 而它恰恰是作品的两条主体之一。
 *
 * 做法：**不开浏览器**，在 Node 里直接跑真实链路（与页面完全同一批纯函数）：
 *     parseCsvText → cleanSurveyRows → buildCohort → cohortHeadline
 * 断言"示例数据必须得出的那几个数"，并补一个**负向用例**（缺列的 CSV 必须被拒）。
 *
 * ⚠️ 只断言"稳定且有意义"的量：人数、最多的一类、占比、结论文案关键词。
 *    阈值型/可调参数（分位、权重）不写死，避免以后调参就红。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsvText } from '../src/lib/parseCsv.js';
import { cleanSurveyRows } from '../src/lib/surveyClean.js';
import { toAttributeMatrix, buildBaseline } from '../src/lib/matrix.js';
import { buildCohort, cohortHeadline } from '../src/lib/cohort.js';
import { buildCohortFacts, buildCohortRequest, cohortFallbackText } from '../src/lib/cohortSummary.js';
import { REQUIRED_COLUMNS } from '../src/lib/surveySchema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = '示例-班级问卷.csv';
const BASELINE = '问卷基准数据.csv';
const read = (f) => fs.readFileSync(path.join(ROOT, 'public', 'data', f), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + label + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ✗ ' + label + (extra ? '  ' + extra : '')); }
};

console.log('\nE · CSV 主线端到端（示例数据 → 群体画像）');

/* ── 1. 基准人群：链路第一段必须可用 ── */
const baseParsed = parseCsvText(read(BASELINE), REQUIRED_COLUMNS);
ok(baseParsed.ok, '基准数据能解析', baseParsed.ok ? '' : JSON.stringify(baseParsed.errors?.[0] || {}));
const baseCleaned = cleanSurveyRows(baseParsed.rows || []);
ok(baseCleaned.ok, '基准数据清洗后可用', `可用 ${baseCleaned.records?.length ?? 0} 条`);
const baseline = buildBaseline(toAttributeMatrix(baseCleaned.records || []));
ok(baseline && typeof baseline === 'object', '基准线构建成功');

/* ── 2. 示例班级：整条链路 + 数值断言 ── */
const parsed = parseCsvText(read(SAMPLE), REQUIRED_COLUMNS);
ok(parsed.ok, `${SAMPLE} 能解析`, `原始 ${parsed.rows?.length ?? 0} 行`);
const cleaned = cleanSurveyRows(parsed.rows || []);
ok(cleaned.ok, '清洗后全部可用', `可用 ${cleaned.records?.length ?? 0} 条`);
ok(cleaned.records.length === 48, '人数 = 48', String(cleaned.records.length));

const cohort = buildCohort(cleaned.records, baseline, null);
ok(cohort.size === 48, '群体统计人数 = 48', String(cohort.size));
ok(cohort.most && cohort.most.count > 0, '能算出最多的一类', cohort.most && `${cohort.most.name} ${cohort.most.count} 人 ${cohort.most.pct}%`);
ok(cohort.most.name === '学术型', '最多的一类是「学术型」', cohort.most.name);
ok(cohort.most.count === 12 && cohort.most.pct === 25, '计数与占比 = 12 人 / 25%',
   `${cohort.most.count} 人 / ${cohort.most.pct}%`);
ok(Array.isArray(cohort.groups) && cohort.groups.length >= 3, '类型分布有多组', `${cohort.groups.length} 组`);
ok(Array.isArray(cohort.axes) && cohort.axes.length === 5, '雷达轴 = 5 条', `${cohort.axes.length} 条`);
ok(cohort.medianAttrs && Object.keys(cohort.medianAttrs).length >= 8, '中位数属性齐全',
   `${Object.keys(cohort.medianAttrs || {}).length} 项`);

/* ── 3. 结论文案：页面顶部那句"结论优先"必须能生成 ── */
const head = cohortHeadline(cohort);
ok(head.includes('48 个人里'), '结论句含人数', head.slice(0, 28) + '…');
ok(head.includes('学术型最多'), '结论句含"最多的一类"');
ok(head.includes('25%'), '结论句含占比');
ok(head.length > 30, '结论句不是空壳', `${head.length} 字`);

/* ── 4. 第三段链路：AI 解读（10-08 补齐，同样要上闸门）── */
const facts = buildCohortFacts(cohort, { className: '测试班' });
ok(facts.includes('有效样本 48 人'), '事实文本含样本数');
ok(facts.includes('学术型'), '事实文本含最多的一类');
ok(facts.includes('分歧最大'), '事实文本含分歧项');

const req = buildCohortRequest(cohort, { className: '测试班' });
ok(req && typeof req.system === 'string' && req.system.length > 80, '请求含 system 提示词', `${req.system.length} 字`);
ok(req && typeof req.user === 'string' && req.user.includes('有效样本'), '请求含 user 事实');
ok(/不要编造/.test(req.system), 'system 里有"不许编造"的约束');

const fb = cohortFallbackText(cohort);
ok(fb.length > 150, '兜底文案有实质内容（评委没密钥时看到的就是它）', `${fb.length} 字`);
ok(fb.includes('48'), '兜底文案含人数');
ok(fb.includes('学术型'), '兜底文案含最多的一类');
ok(fb.includes('建议'), '兜底文案给出可执行建议');
ok(!/undefined|NaN|\[object/.test(fb), '兜底文案无坏值（undefined/NaN/[object）');

/* ── 5. 负向用例：脏数据必须被拦住（而不是静默算出一个错结果）── */
const bad = parseCsvText('姓名,年龄\n张三,20\n', REQUIRED_COLUMNS);
ok(bad.ok === false, '负向：缺列的 CSV 被拒绝', bad.ok === false ? '' : '竟然通过了');
ok((bad.errors || []).length > 0, '负向：给出了可读的错误信息', (bad.errors?.[0]?.message || '').slice(0, 40));

console.log(`\n${fail === 0 ? '✓' : '✗'} CSV 主线冒烟：${pass} 项通过${fail ? '，' + fail + ' 项失败' : ''}`);
process.exit(fail === 0 ? 0 : 1);
