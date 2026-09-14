/**
 * 数据入口的组装：CSV 文本 → 可以喂给计算层的一串记录。
 *
 * 为什么不把这三步散在组件里：
 *   界面层（src/components）的约定是"只画不判断"。如果 Uploader 里写着
 *   「先 parse、再 validate、失败就 setError、成功再 clean」，那它就在做业务判断了，
 *   换个地方入口（比如以后的"粘贴 CSV"）就得把这段逻辑再抄一遍。
 *   所以这里给出唯一的一个函数调用点：loadStudyRecords(text)。
 *
 * 返回结构是「成功/失败 + 人话原因」的形状，UI 直接照着渲染即可，
 * 不需要 try/catch —— 全流程不抛异常。
 */

import { parseCsvText } from './parseCsv.js';
import { validateRows } from './validate.js';
import { cleanRecords } from './cleanData.js';

export const LOAD_STAGE = {
  PARSE: 'parse', // 文件结构层面就不过（空文件、缺列）
  VALIDATE: 'validate', // 结构没问题，但字段类型/逻辑不成立
};

/**
 * @param {string} csvText
 * @returns {{
 *   ok:boolean,
 *   records:object[],
 *   errors:{line?:number,column?:string,message:string}[],
 *   warnings:object[],
 *   report:object|null,
 *   stage:string|null,
 * }}
 */
export function loadStudyRecords(csvText) {
  // 第一步：切行、认表头
  const parsed = parseCsvText(csvText);
  if (!parsed.ok) {
    return failure(LOAD_STAGE.PARSE, parsed.errors);
  }

  // 第二步：逐行校验字段。有任何一行不成立就整份拒绝。
  const validated = validateRows(parsed.rows);
  if (!validated.ok) {
    return failure(LOAD_STAGE.VALIDATE, validated.errors, {
      total: validated.stats.total,
      invalid: validated.stats.invalid,
    });
  }

  // 第三步：清洗（去重、剔掉算不出来的行），并把剔除情况如实带回去
  const cleaned = cleanRecords(validated.records);

  return {
    ok: true,
    stage: null,
    records: cleaned.records,
    errors: [],
    warnings: [...parsed.errors, ...cleaned.warnings],
    report: cleaned.report,
  };
}

function failure(stage, errors, extra = {}) {
  return { ok: false, stage, records: [], errors, warnings: [], report: null, ...extra };
}

/**
 * 给界面用的一句话总结。放在这里而不是组件里，是为了让「什么算成功」只有一处定义。
 */
export function describeLoadResult(result) {
  if (!result.ok) {
    const n = result.errors.length;
    return result.stage === LOAD_STAGE.PARSE
      ? `文件没能读进来（${n} 个问题），下面的信息来自文件结构检查。`
      : `文件里有 ${n} 处字段问题，先改好再导入 —— 数据不对时算出来的结论没有意义。`;
  }
  return result.report.summary;
}

export { parseCsvText, validateRows, cleanRecords };
