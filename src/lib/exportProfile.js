/**
 * exportProfile.js —— 把「一份答题结果」导出成可传阅的档案文件（2026-10-17）
 *
 * ── 要解决的问题 ────────────────────────────────────────────────
 * 10-17 之前，产品的「群体分析」入口要求用户**先有一份班级 CSV**：
 * 10 个问题、48 种约定答案字符串、固定列名。对陌生访客等于不可用
 * （实测门槛见当日日志）。用户因此提出：**让数据由产品自己产出** ——
 * 同学答完题导出档案，发给班群；管理员收齐后导入，看班级画像。
 *
 * ── 为什么导出成「和上传同格式的 CSV」而不是自定义 JSON ──────────
 * 因为母端（管理员）最终要做的事，就是把这 N 份档案当成一份班级问卷来算。
 * 只要导出格式 == 上传入口要求的格式，**整个 parseCsv + 群体分析管线原样复用**，
 * 不需要为"导入档案"再写一套解析与校验。
 *   代价：文件里只有 10 个答案 + 编号，没有时间戳、没有昵称。
 *   但那正是群体分析需要的全部 —— 多一个字段反而要处理"这份缺字段"的分支。
 *
 * ── 格式契约（改动时必须同步的地方）────────────────────────────
 *   列顺序 = REQUIRED_COLUMNS（来自 matrix.json，与上传校验同源）
 *   首列 = 「编号」（OPTIONAL_COLUMNS，允许缺省，但档案里给上更好认）
 *   编码 = UTF-8 **带 BOM** —— Excel 直接打开中文不乱码
 */

import { QUESTIONS, REQUIRED_COLUMNS } from './surveySchema.js';

/** CSV 字段转义：含逗号/引号/换行时用双引号包住，内部引号翻倍。 */
function esc(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 把一个答案对象映射成「按 field 取值」的规范化行。
 *
 * ★ 容错：`answers` 的键历史上可能是**题目 id** 也可能是 **field**
 *   （SurveyForm 用 id 存，上传管线用 field）。这里两种都认，
 *   否则导出会静默产出空行 —— 而这种错在 CSV 里看不出来，
 *   只会表现为"这个人的所有维度都是 0"。
 */
function normalizeRow(answers) {
  const byField = {};
  for (const q of QUESTIONS) {
    const v =
      answers?.[q.id] !== undefined
        ? answers[q.id]
        : answers?.[q.field] !== undefined
          ? answers[q.field]
          : '';
    byField[q.field] = v;
  }
  return byField;
}

/**
 * 生成一份档案 CSV 文本（含表头 + 1 行数据）。
 *
 * @param {Record<string,string>} answers 答题结果
 * @param {{id?: string}} [opts] id 会写进「编号」列；不传则省略该列
 * @returns {string}
 */
export function buildProfileCsv(answers, opts = {}) {
  const row = normalizeRow(answers);
  const withId = Boolean(opts.id);

  const header = withId ? ['编号', ...REQUIRED_COLUMNS] : [...REQUIRED_COLUMNS];
  // ★ 这里刻意写成两条独立分支，而不是「先塞 null 再 filter 掉」：
  //   后者在 num 为空字符串时会与"要省略的编号列"混在一起，删错列还看不出来。
  const values = withId
    ? [opts.id, ...REQUIRED_COLUMNS.map((f) => row[f])]
    : REQUIRED_COLUMNS.map((f) => row[f]);

  return `${header.map(esc).join(',')}\n${values.map(esc).join(',')}\n`;
}

/** 生成一个人类可读、且不会重复的档案编号（本地时间 + 4 位随机）。 */
export function makeProfileId(now = new Date()) {
  const p = (n, len = 2) => String(n).padStart(len, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  const salt = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `P${stamp}-${salt}`;
}

/** 触发浏览器下载。带 BOM，Excel 打开中文不乱码。 */
export function downloadText(filename, text) {
  const blob = new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 立刻 revoke 会让部分浏览器来不及下载，给一帧的余量
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 合并多份档案 CSV 文本为一份（母端导入用）。
 *
 * 规则：**取第一份的表头，其余各份都丢掉自己的表头**，只留数据行。
 * 为什么不能简单拼接字符串：每份档案都自带表头，
 * 直接相加会得到 N 行表头夹在数据中间 —— parseCsv 会把它们当成"无效行"，
 * 于是"导入 40 份"变成"导入了 1 份 + 39 行错误"，而且不报错。
 *
 * 空行与纯空白行一律丢弃。
 */
export function mergeCsvTexts(texts) {
  const blocks = texts
    .map((t) => String(t || '').replace(/^\uFEFF/, '').trim())
    .filter(Boolean);
  if (!blocks.length) return '';

  const split = (t) => t.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = split(blocks[0])[0];
  const rows = [];

  for (const block of blocks) {
    const lines = split(block);
    if (!lines.length) continue;
    // 第一行默认是表头；只有当它和主表头完全一致时才跳过。
    // 若用户直接给了一份"无表头"的数据，第一行就是数据，不能吞掉。
    const start = lines[0].trim() === header.trim() ? 1 : 0;
    for (let i = start; i < lines.length; i += 1) rows.push(lines[i]);
  }

  return `${header}\n${rows.join('\n')}\n`;
}
