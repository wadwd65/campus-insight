/**
 * 数据契约 —— 全项目唯一的一份定义。
 *
 * 为什么单独抽一个文件：
 *   解析、校验、清洗、聚合、图表、喂给大模型的摘要，全都要知道
 *   「列叫什么名字」「时段怎么分」「正确率怎么算」。
 *   如果这些散在六个文件里，改一次口径就要改六处，必然有一处漏掉。
 *   所以口径只写在这里，别处一律 import。
 *
 * 契约本体见 docs/开发任务表-方向C.md 第二节。
 */

/** 必需的 6 列。顺序可变，按表头名识别，所以这里只要名字。 */
export const REQUIRED_COLUMNS = ['日期', '开始时间', '科目', '时长_分钟', '完成题量', '正确数'];

/** 数值列：必须是整数，不接受 "90.5" 或 "90分"。 */
export const INTEGER_COLUMNS = ['时长_分钟', '完成题量', '正确数'];

/** 中文列名 → 内部英文字段。内部统一用英文，避免到处写中文 key 拼错。 */
export const FIELD_MAP = {
  日期: 'date',
  开始时间: 'startTime',
  科目: 'subject',
  时长_分钟: 'minutes',
  完成题量: 'questions',
  正确数: 'correct',
};

/** 时段划分，与契约一致：<12:00 上午；12:00~17:59 下午；>=18:00 晚上。 */
export const TIME_SLOTS = ['上午', '下午', '晚上'];

/**
 * 去掉表头里最容易混进来的几种杂质：BOM、首尾空格、全角空格、换行。
 * 用户从 Excel 导出的 CSV 几乎一定带 BOM，不处理会让「日期」变成「\uFEFF日期」，
 * 于是 6 个必需列全被判成缺失 —— 这是这类工具最常见的第一次翻车。
 */
export function normalizeHeader(name) {
  return String(name ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}

/** 清理单元格文本：去首尾空白与全角空格。 */
export function normalizeCell(value) {
  return String(value ?? '')
    .replace(/\u3000/g, ' ')
    .trim();
}

/** 日期：只接受 YYYY-MM-DD，且必须是真实存在的日期（挡掉 2026-02-30）。 */
export function parseDateValue(value) {
  const text = normalizeCell(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { ok: false, reason: '日期格式应为 2026-03-01 这样的 YYYY-MM-DD' };
  }
  const [y, m, d] = text.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const real =
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  if (!real) return { ok: false, reason: `${text} 不是一个真实存在的日期` };
  return { ok: true, value: text };
}

/** 开始时间：接受 8:30 / 08:30，统一输出 HH:MM 便于排序。 */
export function parseTimeValue(value) {
  const text = normalizeCell(value);
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(text);
  if (!m) return { ok: false, reason: '开始时间格式应为 08:30 这样的 HH:MM' };
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return { ok: false, reason: `${text} 不是有效时间` };
  return { ok: true, value: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

/** 整数：只接受整数字面量，'90.5' / 'abc' / '' 都算类型错。 */
export function parseIntValue(value) {
  const text = normalizeCell(value);
  if (!/^-?\d+$/.test(text)) {
    return { ok: false, reason: `「${text || '(空)'}」不是整数` };
  }
  return { ok: true, value: Number(text) };
}

/** 时段：由开始时间推导，不写进 CSV。 */
export function slotOf(startTime) {
  const hh = Number(String(startTime).slice(0, 2));
  if (hh < 12) return '上午';
  if (hh < 18) return '下午';
  return '晚上';
}

/**
 * 正确率。分母为 0 时返回 null，而不是 NaN / Infinity。
 * 返回 null 是有意的：让「算不出来」和「算出来是 0」在类型上就分得开，
 * 否则一个除零会一路污染到平均值，最后在图上是空白，没人查得出原因。
 */
export function accuracyOf(record) {
  if (!record.questions) return null;
  return record.correct / record.questions;
}

/** 有题量的记录才参与正确率统计。 */
export function hasAccuracy(record) {
  return record.questions > 0;
}

/**
 * 聚合用的加权正确率：先把所有人的题量和正确数加总再相除，
 * 而不是把每天的百分比再平均 —— 后者会让「做了 3 题的那天」和「做了 60 题的那天」等权，
 * 是被平均平均坑得最惨的一种算法。
 */
export function weightedAccuracy(records) {
  let questions = 0;
  let correct = 0;
  for (const r of records) {
    if (!hasAccuracy(r)) continue;
    questions += r.questions;
    correct += r.correct;
  }
  if (!questions) return null;
  return correct / questions;
}
