/**
 * validateCohortSummary.js —— 群体画像（班级）解读的落地校验。
 *
 * ── 为什么单独写一份（任务书 P0：群体链路缺数字校验）────────────────
 * 个人版（validateSummary.js）早就有了数字白名单校验，但群体链路
 * （cohortSummary → llm.js 的 report:null 分支）**一直是裸奔的**：
 * 提示词让它"只说数据支撑的结论"，可提示词是请求不是保证。
 * 一旦模型写出"这个班 60% 的人都偏爱夜猫"而数据里根本没有 60%，
 * 页面照常显示、班主任照常念 —— 而这份东西是给老师看的，
 * 错了比空着糟得多。
 *
 * ── 与个人版的差别（为什么不能直接复用）────────────────────────────
 * 数字形态完全不同：
 *   · 个人版对外只报**百分数**（百分位 + 时间分配），所以只查 `N%`
 *   · 群体版同时有三种数：**人数**（48 人）、**占比**（25%）、
 *     **分数**（中位数 62、Q1~Q3 的 29~78、IQR 24）
 *     后两种都长得像"62"，但含义完全不同 —— 占比 62% 和分数 62
 *     在白名单里不是同一个集合。混在一起查，要么放过错数，要么误报一片。
 *
 * 所以这里分三张白名单分别查，并额外查两件群体版特有的硬伤：
 *   ① **人数超限** —— "N 人"里的 N 不可能超过有效样本数
 *   ② **口径混淆** —— 把中位数说成"平均"，正是系统提示词第 7 条明令禁止的
 *
 * ── 判据仍然刻意宽容 ────────────────────────────────────────────────
 * 只抓硬伤（编造占比 / 人数超限 / 口径混淆 / 诊断口吻 / 空），
 * 不抓行文。理由同个人版：一个爱误报的闸门会被关掉，
 * 关掉之后连硬伤也没人看了。
 */

import {
  FORBIDDEN_WORDS,
  DIAGNOSIS_WORDS,
  MARKDOWN_PATTERNS,
  percentsIn,
} from './validateSummary.js';
import { THRESHOLDS } from './thresholds.js';

/** 群体版额外禁用的说法：把"中位数"说成"平均"是口径错误（提示词第 7 条）。 */
const CALIBER_WORDS = [
  '平均', '均值', '平均水平', '占总分的', '得分为',
];

/** 群体版额外的诊断式表述：对一整个人群下心理判断。 */
const GROUP_DIAGNOSIS_WORDS = [
  '这个班有心理', '群体性焦虑', '班级人格', '普遍存在心理',
];

/**
 * 从文本里抽出所有「N 人」（`12 人` / `12人`）。
 * 也认 `12 名` / `12 位` —— 模型换词不改事实。
 */
function countsIn(text) {
  return [...String(text).matchAll(/(\d+)\s*[人名位]/g)].map((m) => Number(m[1]));
}

/**
 * 建三张白名单。
 *
 * @param {object} cohort buildCohort() 的输出
 * @returns {{percents:Set<number>, counts:Set<number>, scores:Set<number>}}
 */
function buildAllowlists(cohort) {
  const percents = new Set();
  const counts = new Set();
  const scores = new Set();

  const addPct = (v) => { if (Number.isFinite(v)) percents.add(Math.round(v)); };
  const addScore = (v) => { if (Number.isFinite(v)) scores.add(Math.round(v)); };

  if (!cohort) return { percents, counts, scores };

  // ① 人数：有效样本数、各类型人数、以及"前两类合起来"这种派生和
  counts.add(cohort.size);
  for (const g of cohort.groups ?? []) {
    if (Number.isFinite(g.count)) counts.add(g.count);
  }
  // 前 N 类的累计人数（兜底文案里就有"两者合起来接近 X%"的说法）
  const sorted = [...(cohort.groups ?? [])].sort((a, b) => b.count - a.count);
  let run = 0;
  for (const g of sorted) {
    run += g.count;
    counts.add(run);
  }

  // ② 占比：各类型 pct、最多那类 pct、以及各类的累计占比
  for (const g of cohort.groups ?? []) addPct(g.pct);
  if (cohort.most) addPct(cohort.most.pct);
  let runPct = 0;
  for (const g of sorted) {
    runPct += g.pct;
    addPct(runPct);
  }
  addPct(100);
  addPct(0);

  // ③ 分数：五维的中位数 / Q1 / Q3 / IQR，加九项属性的班级中位数
  for (const a of cohort.axes ?? []) {
    addScore(a.median); addScore(a.q1); addScore(a.q3); addScore(a.iqr);
    if (Number.isFinite(a.min)) addScore(a.min);
    if (Number.isFinite(a.max)) addScore(a.max);
  }
  if (cohort.divergent) {
    addScore(cohort.divergent.iqr);
    addScore(cohort.divergent.q1);
    addScore(cohort.divergent.q3);
  }
  for (const v of Object.values(cohort.medianAttrs ?? {})) addScore(v);
  // 离散度阈值也可能被引用（"超过 24 算分歧大"）
  addScore(THRESHOLDS.divergentIqr);

  return { percents, counts, scores };
}

/**
 * 校验一段群体解读。
 *
 * @param {string} text 模型输出
 * @param {object} [options]
 * @param {object} [options.cohort] buildCohort() 的输出（白名单来源）
 * @param {number} [options.minLen] 最少字数（默认 60）
 * @param {number} [options.tolerance] 数值比对容差（默认 1）
 * @returns {{ok: boolean, issues: Array<{type: string, detail: string}>}}
 */
export function validateCohortSummary(text, { cohort = null, minLen = 60, tolerance = 1 } = {}) {
  const issues = [];
  const s = String(text ?? '').trim();

  // ① 空内容 / 明显不完整
  if (!s) issues.push({ type: 'empty', detail: '输出为空' });
  else if (s.length < minLen) issues.push({ type: 'too-short', detail: `只有 ${s.length} 字（< ${minLen}）` });

  // ② 格式异常（markdown / emoji）—— 与个人版同一套判据
  for (const { re, name } of MARKDOWN_PATTERNS) {
    if (re.test(s)) issues.push({ type: 'format', detail: `出现了${name}` });
  }
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)) {
    issues.push({ type: 'format', detail: '出现了 emoji' });
  }

  // ③ 禁用词（个人版那份 + 群体版专属）
  for (const w of [...FORBIDDEN_WORDS, ...GROUP_DIAGNOSIS_WORDS]) {
    if (s.includes(w)) issues.push({ type: 'forbidden-word', detail: `出现禁用词「${w}」` });
  }

  // ④ 诊断口吻：个人版那份 + 群体版专属
  for (const w of [...DIAGNOSIS_WORDS, ...GROUP_DIAGNOSIS_WORDS]) {
    if (s.includes(w)) issues.push({ type: 'diagnosis', detail: `出现诊断式表述「${w}」` });
  }

  // ⑤ 口径混淆：把中位数说成平均 —— 提示词第 7 条明令禁止
  for (const w of CALIBER_WORDS) {
    if (s.includes(w)) issues.push({ type: 'caliber', detail: `口径混淆：出现「${w}」（中位数不是平均值）` });
  }

  if (cohort) {
    for (const sentence of s.split(/[。！？\n]/)) {
      if (/(?:两极分化|中间(?:地带|的人|人群).{0,8}(?:不厚|很少|稀疏)|两头(?:的人|人群).{0,6}多)/.test(sentence) && !/不能|无法|不足以|不代表|不意味着|不说明|不等于/.test(sentence)) {
        issues.push({ type: 'unsupported-distribution', detail: '用分位区间推断了未经计算的分布形态' });
        break;
      }
    }
    const { percents, counts } = buildAllowlists(cohort);

    // ⑥ 编造占比：每个 N% 都要能追到某类的 pct 或累计占比
    if (percents.size) {
      for (const p of percentsIn(s)) {
        const hit = [...percents].some((a) => Math.abs(a - p) <= tolerance);
        if (!hit) issues.push({ type: 'invented-number', detail: `出现白名单外的占比 ${p}%` });
      }
    }

    // ⑦ 人数超限：不可能有"超过有效样本数"的人
    if (counts.size && cohort.size) {
      for (const c of countsIn(s)) {
        if (c > cohort.size) {
          issues.push({ type: 'invented-number', detail: `出现 ${c} 人，超过有效样本 ${cohort.size} 人` });
        }
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * 把校验结果压成一行可读文本。无问题时返回空串。
 */
export function describeCohortIssues(result) {
  if (!result || result.ok) return '';
  return result.issues.map((i) => i.detail).join('；');
}

/**
 * 群体版的"硬伤"集合。
 *
 * 与个人版（HARD_ISSUE_TYPES）的差别：
 *   · 加了 `caliber`（口径混淆）—— 对给班主任看的东西，说错口径等于教错
 *   · 同样**刻意不含 too-short**：写得少不等于说错话。
 *     （个人版在这点上踩过：为了拦短文本把 3~6 字的假文本判成硬伤，
 *       结果是改了实现去迁就测试。短≠错，说错才是错。）
 */
export const COHORT_HARD_ISSUE_TYPES = new Set([
  'empty',
  'invented-number',
  'diagnosis',
  'caliber',
  'unsupported-distribution',
]);
