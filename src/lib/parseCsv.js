/**
 * T-05 · CSV 文本 → 原始行对象
 *
 * 这一层只干一件事：把文本切成人能用的行，并且认出表头。
 * **它不管数字对不对** —— 类型校验在 validate.js，脏数据清理在 cleanData.js。
 * 分层的好处是：报错时能明确告诉用户「是格式问题还是数据问题」，而不是笼统一句解析失败。
 */

import Papa from 'papaparse';
import { REQUIRED_COLUMNS, normalizeHeader, normalizeCell } from './schema.js';

/** 错误码集中列出，界面按码决定怎么提示，不用去匹配文案。 */
export const CSV_ERROR = {
  EMPTY_FILE: 'EMPTY_FILE',
  NO_HEADER: 'NO_HEADER',
  MISSING_COLUMNS: 'MISSING_COLUMNS',
  NO_DATA_ROWS: 'NO_DATA_ROWS',
  MALFORMED: 'MALFORMED',
};

/**
 * @param {string} text CSV 全文
 * @returns {{ok:boolean, rows:object[], columns:string[], errors:{code:string,message:string}[]}}
 */
export function parseCsvText(text) {
  // 空文件要单独挡：PapaParse 对空串不报错，会安静地返回零行，
  // 一路走到图表层才变成一张空图，用户根本不知道发生了什么。
  if (typeof text !== 'string' || text.replace(/^\uFEFF/, '').trim() === '') {
    return fail(CSV_ERROR.EMPTY_FILE, '这个文件是空的，没有读到任何内容。');
  }

  const result = Papa.parse(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
    transform: normalizeCell,
  });

  const columns = (result.meta?.fields ?? []).filter(Boolean);
  if (!columns.length) {
    return fail(CSV_ERROR.NO_HEADER, '没有读到表头。第一行应该是列名，例如：日期,开始时间,科目,时长_分钟,完成题量,正确数');
  }

  // 顺序可以换，缺一个就点名说缺哪个 —— 用户才知道去改哪里。
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length) {
    return fail(
      CSV_ERROR.MISSING_COLUMNS,
      `缺少必需的列：${missing.join('、')}。需要这 ${REQUIRED_COLUMNS.length} 列：${REQUIRED_COLUMNS.join('、')}（顺序可以不同）`,
    );
  }

  const rows = result.data.map((raw, index) => ({
    // 行号按「表头占第 1 行」估算，用于把错误定位给用户；文件里有空行时会略有偏差，够用了。
    __line: index + 2,
    __raw: raw,
  }));

  if (!rows.length) {
    return fail(CSV_ERROR.NO_DATA_ROWS, '表头读到了，但下面一行数据都没有。');
  }

  // PapaParse 自己发现的引号不闭合、列数对不上等问题，原样透传成人话。
  const errors = (result.errors ?? []).map((e) => ({
    code: CSV_ERROR.MALFORMED,
    message: `第 ${(e.row ?? 0) + 2} 行附近格式有问题：${e.message}`,
  }));

  return { ok: true, rows, columns, errors };
}

function fail(code, message) {
  return { ok: false, rows: [], columns: [], errors: [{ code, message }] };
}
