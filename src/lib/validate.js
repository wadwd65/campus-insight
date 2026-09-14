/**
 * T-06 · 字段校验
 *
 * 分工（这条分工决定了报错文案该怎么写，别把两件事混在一起）：
 *   - 本文件负责「这份文件的结构和字段对不对」→ 不对就**整份拒绝**，一条都不算。
 *     理由：格式不成立时，任何"算出来的数字"都是假的，比不显示更糟。
 *   - cleanData.js 负责「个别记录的数值能不能用」→ **剔掉并如实告知剔了几行**。
 *
 * 校验通过的行会被转成内部英文字段，界面和大模型摘要都只认这套字段。
 */

import { FIELD_MAP, normalizeCell, parseDateValue, parseTimeValue, parseIntValue } from './schema.js';

/**
 * @param {{__line:number, __raw:object}[]} rows parseCsvText 的输出
 * @returns {{ok:boolean, records:object[], errors:object[], stats:object}}
 */
export function validateRows(rows) {
  const records = [];
  const errors = [];

  for (const item of rows) {
    const raw = item.__raw ?? {};
    const line = item.__line;
    const rowErrors = [];

    const date = check(line, '日期', raw, parseDateValue, rowErrors);
    const startTime = check(line, '开始时间', raw, parseTimeValue, rowErrors);

    const subject = normalizeCell(raw['科目']);
    if (!subject) {
      rowErrors.push({ line, column: '科目', value: raw['科目'], message: '科目不能为空' });
    }

    const minutes = check(line, '时长_分钟', raw, parseIntValue, rowErrors);
    const questions = check(line, '完成题量', raw, parseIntValue, rowErrors);
    const correct = check(line, '正确数', raw, parseIntValue, rowErrors);

    // 负数：明显是录入事故（比如前面多了个减号），不属于"可以悄悄剔掉"的脏数据，
    // 因为剔掉之后用户不会去查，错误会一直留在源文件里。
    for (const [column, value] of [['时长_分钟', minutes], ['完成题量', questions], ['正确数', correct]]) {
      if (value !== undefined && value < 0) {
        rowErrors.push({ line, column, value, message: `${column} 不能是负数` });
      }
    }

    // 逻辑矛盾：对了的题不可能比做的题还多。这类错误极常见（列串了位），
    // 而且一旦放过，正确率会算出大于 100% 的数字，看起来像系统坏了。
    if (questions !== undefined && correct !== undefined && correct > questions) {
      rowErrors.push({
        line,
        column: '正确数',
        value: correct,
        message: `正确数（${correct}）比完成题量（${questions}）还多，这两列可能串位了`,
      });
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }

    records.push({
      date,
      startTime,
      subject,
      minutes,
      questions,
      correct,
      sourceLine: line,
    });
  }

  return {
    ok: errors.length === 0,
    records,
    errors,
    stats: { total: rows.length, valid: records.length, invalid: rows.length - records.length },
  };
}

/** 单个字段的「取值 → 校验 → 取值」小包装，省掉六段重复代码。 */
function check(line, column, raw, parser, rowErrors) {
  const value = raw[column];
  const result = parser(value);
  if (!result.ok) {
    rowErrors.push({ line, column, value, message: result.reason });
    return undefined;
  }
  return result.value;
}

export { FIELD_MAP };
