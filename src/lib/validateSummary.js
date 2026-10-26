/**
 * validateSummary.js —— 对模型输出做**落地检查**（任务书 P3#4 / P6#2）。
 *
 * ── 为什么需要它 ────────────────────────────────────────────────
 * 提示词是"请求"，不是"保证"。模型大部分时候照做，但它也会：
 *   · 把没给它的数字写进去（"你每天学习 6 小时"——数据里根本没有小时）；
 *   · 把百分位当成心理诊断（"这说明你其实是回避型人格"）；
 *   · 用提示词明令禁止的词（"根据报告显示，你的数据表明…"）；
 *   · 段落数不够、或掺进 markdown 符号。
 *
 * 这些都是"看起来没问题"的失败 —— 页面照常显示，用户不会察觉，
 * 但答辩时评委一读就会发现数字对不上。**所以必须在显示前查一遍**。
 *
 * ── 本模块只做"检测"，不做"改写" ────────────────────────────────
 * 它返回一份问题清单，由调用方决定怎么处理（通常是：降级到内置文案，
 * 或照常显示但把问题记进控制台）。让检测与处置分开，是因为
 * "发现模型说错话"和"决定怎么办"是两件不同的事，混在一起会让两边都难测。
 *
 * ── 判据为什么这么写 ────────────────────────────────────────────
 * 刻意**宽容**：只抓"硬伤"（编造百分数、心理诊断口吻、禁用词、markdown 符号），
 * 不抓行文风格。原因是一个爱误报的闸门会被关掉，而关掉之后连硬伤也没人看了。
 */

/** 提示词里明令禁止出现的词（写了就说明模型没照做）。
 *  ★ 10-14 导出：群体版校验器（validateCohortSummary.js）要复用同一份词表。
 *    只加 export，不改值、不改行为 —— 两份校验器用不同词表，
 *    等于同一个禁忌在不同页面有不同标准，早晚有一边漏。 */
import { QUESTIONS } from './surveySchema.js';

export const FORBIDDEN_WORDS = [
  '雷达图', '百分位', '算法', '模型', '报告显示', '数据显示', '根据数据',
];

export const DIAGNOSIS_WORDS = [
  '心理诊断', '人格障碍', '焦虑型', '回避型', '抑郁倾向', '心理疾病',
  '你其实是', '你的潜意识', '测试结果说明你', '评估结果',
];

export const MARKDOWN_PATTERNS = [
  { re: /^\s*#{1,6}\s/m, name: '标题符号 #' },
  { re: /^\s*[-*+]\s+/m, name: '列表符号' },
  { re: /\*\*[^*]+\*\*/, name: '加粗 **' },
  { re: /^\s*\d+\.\s+/m, name: '有序列表' },
];

/**
 * 从文本里抽出所有**百分数**（`82%` / `82.5%`）。
 * 只查百分数是刻意的：它是这个产品唯一对外报出的数字形态，
 * 也是最容易被编造、且一编就露馅的一类。普通数字（"三段""两个人"）不查，避免误报。
 */
export function percentsIn(text) {
  return [...String(text).matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
}

/**
 * 收集"允许出现的百分数"白名单。
 *
 * @param {object} facts buildSummaryFacts() 的输出，或任何形如
 *        { percents:[{value}], timeSplit:[{value}], coldFacts:[{text}] } 的对象
 */
function allowedPercents(facts) {
  const out = new Set();
  const add = (v) => { if (Number.isFinite(v)) out.add(Math.round(v)); };
  if (!facts) return out;
  for (const p of facts.percents ?? []) add(p.value);
  for (const t of facts.timeSplit ?? []) add(t.value);
  // 冷知识句子里出现的「超过/低于 X%」也是合法数字
  for (const c of facts.coldFacts ?? []) for (const v of percentsIn(c.text)) add(v);
  // 百分位被夹在 2~98，模型可能写"98%"/"2%"这两种边界
  add(2); add(98);
  return out;
}

/**
 * 校验一段模型输出。
 *
 * @param {string} text 模型输出
 * @param {object} [options]
 * @param {object} [options.facts] 允许的数字白名单来源（见 allowedPercents）
 * @param {number} [options.minLen] 最少字数（默认 60；低于它基本等于没写出来）
 * @param {number} [options.tolerance] 百分数比对的容差（默认 1，容许模型四舍五入）
 * @returns {{ok: boolean, issues: Array<{type: string, detail: string}>}}
 */
export function validateSummary(text, { facts = null, minLen = 60, tolerance = 1 } = {}) {
  const issues = [];
  const s = String(text ?? '').trim();

  // ① 空内容 / 明显不完整
  if (!s) issues.push({ type: 'empty', detail: '输出为空' });
  else if (s.length < minLen) issues.push({ type: 'too-short', detail: `只有 ${s.length} 字（< ${minLen}）` });

  // ② 格式异常（markdown / 排版符号）
  for (const { re, name } of MARKDOWN_PATTERNS) {
    if (re.test(s)) issues.push({ type: 'format', detail: `出现了${name}` });
  }
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)) {
    issues.push({ type: 'format', detail: '出现了 emoji' });
  }

  // ③ 禁用词（提示词明令不许出现的说法）
  for (const w of FORBIDDEN_WORDS) {
    if (s.includes(w)) issues.push({ type: 'forbidden-word', detail: `出现禁用词「${w}」` });
  }

  // ④ 心理诊断口吻
  for (const w of DIAGNOSIS_WORDS) {
    if (s.includes(w)) issues.push({ type: 'diagnosis', detail: `出现诊断式表述「${w}」` });
  }

  // ⑤ 编造数字：文本里出现的百分数必须能追溯到白名单
  if (facts) {
    const chosen = new Set((facts.choices ?? []).map((choice) => choice.value).filter(Boolean));
    const known = new Set(QUESTIONS.flatMap((question) => question.options.map((option) => option.text)));
    for (const quote of s.matchAll(/[「“]([^」”]+)[」”]/g)) {
      if (!known.has(quote[1]) || chosen.has(quote[1])) continue;
      const preceding = s.slice(0, quote.index).split(/[。！？\n]/).at(-1);
      if (!/可以|不妨|试试|下次|如果|建议/.test(preceding)) issues.push({ type: 'invented-answer', detail: '把未选的选项写成了用户的回答' });
    }
    for (const sentence of s.split(/[。！？\n]/)) {
      if (/(?:大[一二三四]|开学第一周|之后四年|你这四年过得)/.test(sentence) && !/规则|推算|不是实测|不代表真实|并非真实/.test(sentence)) {
        issues.push({ type: 'ungrounded-narrative', detail: '把未提供的大学经历或年级变化写成事实' });
        break;
      }
    }
    const allowed = allowedPercents(facts);
    if (allowed.size) {
      for (const p of percentsIn(s)) {
        const hit = [...allowed].some((a) => Math.abs(a - p) <= tolerance);
        if (!hit) issues.push({ type: 'invented-number', detail: `出现白名单外的百分数 ${p}%` });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * 把校验结果压成一行可读文本（给控制台 / 状态提示用）。
 * 无问题时返回空串 —— 调用方可以直接 `if (msg)` 判断。
 */
export function describeIssues(result) {
  if (!result || result.ok) return '';
  return result.issues.map((i) => i.detail).join('；');
}
