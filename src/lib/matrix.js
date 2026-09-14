/**
 * 映射矩阵 —— 把「6 个选项」变成「8 个属性的连续值」。
 *
 * 这是整个产品的技术内核（D-1 选了 B 路线）。它要做的事只有一件：
 *   让 6 个选择在 8 个维度上留下印迹，而 8 个维度会同时传导到四样输出上。
 * 于是「选项数少、输出维度多」这个矛盾被解开。
 *
 * 设计依据：docs/设计-01-问题与映射矩阵.md 第四节。
 */

import { QUESTIONS, ATTRIBUTES, DERIVED, ALL_ATTR_KEYS } from './surveySchema.js';

/** 全零属性向量（含派生维）。 */
export function emptyVector() {
  return Object.fromEntries(ALL_ATTR_KEYS.map((k) => [k, 0]));
}

/**
 * 一次作答 → 属性原始分。
 *
 * @param {Record<string,string>} answers {问题字段: 选项文本}
 * @returns {Record<string,number>} {academic: 5, social: -2, ..., buddhist: 7}
 */
export function toAttributes(answers) {
  const vec = emptyVector();

  for (const q of QUESTIONS) {
    const text = answers?.[q.field];
    const option = q.options.find((o) => o.text === text);
    // 不认识的选项静默跳过，不抛错：调用方（surveyClean.checkAnswers）已经负责提示用户，
    // 这里再抛一次只会让一个脏值炸掉整份报告。
    if (!option) continue;
    for (const [key, delta] of Object.entries(option.vec)) vec[key] += delta;
  }

  // 派生属性在最后算：它们依赖基础属性的最终值
  for (const d of DERIVED) {
    vec[d.key] = Object.entries(d.formula).reduce((sum, [k, coef]) => sum + coef * vec[k], 0);
  }

  return vec;
}

/** 批量换算：记录数组 → 属性数组。基准人群与真入口都走这个函数。 */
export function toAttributeMatrix(records) {
  return records.map((r) => toAttributes(r));
}

/**
 * 基准人群的分位数表。
 *
 * 为什么归一化不用 min-max：
 *   属性原始分是两个不同量纲的累加（有的题给 ±3，有的给 ±1），
 *   直接 min-max 会让绝大多数人挤在中间，雷达图退化成五点等距的一个圆 ——
 *   形状没了，产品最要紧的「这就是我」也就没了。
 *   用分位数则不同：数值本身就有含义 ——「学术力 82」＝ 你超过了 82% 的大学生。
 *   于是「人群对比」不必再单独做一个功能，**它就是归一化本身**。
 */
export function buildBaseline(attributeList) {
  const sorted = {};
  for (const key of ALL_ATTR_KEYS) {
    sorted[key] = attributeList.map((a) => a[key]).sort((x, y) => x - y);
  }
  return { size: attributeList.length, sorted };
}

/**
 * 值 → 百分位（2~98）。
 *
 * 夹在 2~98 而不是 0~100：「超过了 0% 的人」这种话没法读，
 * 而且基准只有 2000 人，两端的精度本来就不值得相信。
 */
export function percentileOf(value, sortedValues) {
  const n = sortedValues?.length ?? 0;
  if (!n) return 50;

  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedValues[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  let end = lo;
  while (end < n && sortedValues[end] === value) end += 1;

  // 并列值取排名中点：否则一堆人并列在同一个分数上时，先出现的会被算成低于自己
  const rank = (lo + end) / 2;
  const pct = Math.round((rank / n) * 100);
  return Math.min(98, Math.max(2, pct));
}

/** 一次作答 → 8+1 维的百分位。 */
export function toPercents(attributes, baseline) {
  const out = {};
  for (const key of ALL_ATTR_KEYS) {
    out[key] = percentileOf(attributes[key], baseline.sorted[key]);
  }
  return out;
}

/** 属性清单里的中文标签，界面直接用。 */
export const ATTRIBUTE_META = [...ATTRIBUTES, ...DERIVED];
