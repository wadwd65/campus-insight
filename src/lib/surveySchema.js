/**
 * 问卷契约 —— 单点定义。
 *
 * 数据的**唯一来源**是 src/data/matrix.json：问题、选项、增量向量全在那里。
 * Python 生成端也读同一个文件。
 *
 * 为什么这件事重要：
 *   「选项池」如果有两份（一份给生成脚本、一份给前端），改了其中一份忘了另一份，
 *   生成出来的 CSV 里就会出现前端不认识的选项 —— 而这种错误在图表上完全看不出来，
 *   只会表现为某些人的某个维度莫名其妙偏低。
 *   让两边读同一个文件，这个错误就没有发生的空间。
 */

import matrixJson from '../data/matrix.json' with { type: 'json' };

export const MATRIX_VERSION = matrixJson.version;

/** 8 个基础属性：{key, label, axis} */
export const ATTRIBUTES = matrixJson.attributes;

/** 派生属性（由基础属性组合而来）：{key, label, axis, formula, why} */
export const DERIVED = matrixJson.derived;

/** 全部问题：{id, field, text, hint, options:[{text, vec}]} */
export const QUESTIONS = matrixJson.questions;

/** 全部问题的字段名 —— 也就是上传 CSV 的必需列（顺序可变）。 */
export const REQUIRED_COLUMNS = QUESTIONS.map((q) => q.field);

/** 可选列：真入口上传的批量数据未必带编号。 */
export const OPTIONAL_COLUMNS = ['编号'];

/** 8 个基础属性的键。 */
export const BASE_ATTR_KEYS = ATTRIBUTES.map((a) => a.key);

/** 全部属性键（含派生）。计算与归一化都按这个全集走。 */
export const ALL_ATTR_KEYS = [...BASE_ATTR_KEYS, ...DERIVED.map((d) => d.key)];

/** {字段名: Map(选项文本 → 增量向量)} —— 查表用，避免每次答题都 find 一遍数组。 */
const OPTION_INDEX = (() => {
  const idx = new Map();
  for (const q of QUESTIONS) {
    const m = new Map();
    for (const o of q.options) m.set(o.text, o.vec);
    idx.set(q.field, m);
  }
  return idx;
})();

/** 某题的合法选项文本列表。 */
export function optionsOf(field) {
  return [...(OPTION_INDEX.get(field)?.keys() ?? [])];
}

/** 某个值是不是该题的合法选项。 */
export function isKnownOption(field, text) {
  return OPTION_INDEX.get(field)?.has(text) ?? false;
}

/** 查某题的增量向量；不认识就返回 undefined（由调用方决定怎么处理）。 */
export function vectorOf(field, text) {
  return OPTION_INDEX.get(field)?.get(text);
}

/** 属性 key → 中文标签。 */
export function labelOf(key) {
  return [...ATTRIBUTES, ...DERIVED].find((a) => a.key === key)?.label ?? key;
}

/** 空作答：{字段名: null}。界面表单以此为初始状态。 */
export function emptyAnswers() {
  return Object.fromEntries(QUESTIONS.map((q) => [q.field, null]));
}
