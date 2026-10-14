/**
 * 加载基准人群，算出分位数表。
 *
 * 只算一次，之后全站共用。
 *
 * 为什么要缓存：分位数表要把 2000 人 × 9 个维度逐个排序。
 * 如果每次答题都重算，用户点最后一下选项时能感到一顿 ——
 * 而这个产品全部卖点就是「30 秒内出结果」，那一下顿很伤。
 */

import { parseCsvText } from '../lib/parseCsv.js';
import { cleanSurveyRows } from '../lib/surveyClean.js';
import { toAttributeMatrix, buildBaseline } from '../lib/matrix.js';
import { REQUIRED_COLUMNS } from '../lib/surveySchema.js';

const DATA_FILE = '问卷基准数据.csv';

let cache = null;
let pending = null;

/**
 * @returns {Promise<{baseline: object, records: object[], report: object}>}
 */
export function loadBaseline() {
  if (cache) return Promise.resolve(cache);
  if (pending) return pending;

  pending = (async () => {
    const url = `${import.meta.env.BASE_URL}data/${DATA_FILE}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`基准数据加载失败（HTTP ${res.status}）。确认 public/data/${DATA_FILE} 存在。`);
    }
    const text = await res.text();

    const parsed = parseCsvText(text, REQUIRED_COLUMNS);
    if (!parsed.ok) {
      throw new Error(`基准数据格式有问题：${parsed.errors[0]?.message ?? '未知原因'}`);
    }

    const cleaned = cleanSurveyRows(parsed.rows);
    if (!cleaned.ok) {
      throw new Error(`基准数据没有一条可用：${cleaned.report.summary}`);
    }

    cache = {
      baseline: buildBaseline(toAttributeMatrix(cleaned.records)),
      records: cleaned.records,
      report: cleaned.report,
    };
    pending = null;
    return cache;
  })();

  // ★ 10-14 审查修复（任务书 P5#2「数据加载失败后能否重试」）：
  //   原实现只在**成功**路径里 `pending = null`。一旦失败，`pending` 就永久留着一个
  //   rejected promise —— 之后无论调用多少次，返回的都是同一个失败，重试按钮形同虚设。
  //   这里补上失败清理：失败后把 pending 清掉，下一次调用才会真的重新发起请求。
  //   （cache 不设，所以成功后仍然只算一次 —— 缓存语义不变。）
  pending.catch(() => {
    pending = null;
  });

  return pending;
}
