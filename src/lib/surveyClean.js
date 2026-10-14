/**
 * 问卷记录的校验与清洗。
 *
 * 与上一版（学习记录）的关键差别，值得说清楚：
 *   学习记录里每个值是**数字**，所以要判断「这是不是整数」「正确数会不会大于完成题量」——
 *   错误类型多，且需要区分「整份拒绝」与「单条剔除」。
 *   问卷里每个值是**对号入座的选项文本**，没有量纲问题，
 *   错误只剩两类：格式类（缺列 / 空文件，已在 parseCsv 挡掉）与内容类（值不在选项内、值为空）。
 *   所以这里只做一件事：**逐行体检，能用的留下，不能用的剔除并说清为什么**。
 *
 * 这个「整份拒绝 vs 单条剔除」的分界要守住：
 *   缺列 → 整份拒绝（说明文件选错了，重传）
 *   单行选项不认识 → 剔除该行（说明数据脏，但其余仍可用）
 */

import { QUESTIONS, OPTIONAL_COLUMNS, isKnownOption, MATRIX_VERSION } from './surveySchema.js';
import { normalizeCell } from './text.js';
import matrixJson from '../data/matrix.json' with { type: 'json' };

/**
 * @param {{__line:number, __raw:object}[]} rows parseCsvText 的输出
 * @returns {{ok:boolean, records:object[], report:object, details:object[]}}
 */
export function cleanSurveyRows(rows) {
  const records = [];
  const seen = new Set(); // 出现过的答案签名：只用于统计重复，**不用于剔除**
  let duplicateCount = 0;
  const reasons = new Map(); // 原因 → {count, samples:[]}
  const details = []; // 前若干条具体错误，供「查看详情」展开

  // ★ 10-14 审查补全（任务书 P4#3）：缺失值与非法选项**分开统计**。
  // 原来两类都并进"有选项不在题目选项范围内"一个桶里，用户看不出到底是
  // "有格子是空的"还是"填了不认识的选项"——而这两件事的改法完全不同。
  let missingCells = 0;   // 空值单元格数（不是行数：一行可能空好几格）
  let invalidCells = 0;   // 不在选项范围内的单元格数
  let missingRows = 0;    // 含空值的行数
  let invalidRows = 0;    // 含非法选项的行数

  const bump = (label, line, hint) => {
    if (!reasons.has(label)) reasons.set(label, { label, count: 0, samples: [], hint });
    const r = reasons.get(label);
    r.count += 1;
    if (r.samples.length < 3) r.samples.push(line);
  };

  for (const { __line, __raw } of rows) {
    const values = {};
    const problems = [];
    let rowMissing = 0;
    let rowInvalid = 0;

    for (const q of QUESTIONS) {
      const text = normalizeCell(__raw?.[q.field]);
      values[q.field] = text;

      if (!text) {
        rowMissing += 1;
        problems.push({ field: q.field, type: 'missing', message: `「${q.field}」是空的` });
      } else if (!isKnownOption(q.field, text)) {
        rowInvalid += 1;
        // 报「第几行、哪一列、原值是什么」—— 只说「数据格式错误」等于没说
        problems.push({ field: q.field, type: 'invalid', message: `「${q.field}」的值「${text}」不在该题的选项里` });
      }
    }

    if (problems.length) {
      missingCells += rowMissing;
      invalidCells += rowInvalid;
      if (rowMissing) missingRows += 1;
      if (rowInvalid) invalidRows += 1;

      // 分开记账：一行里既有空格又有非法值时要能区分主要病因
      const label = rowInvalid >= rowMissing
        ? '有选项不在题目选项范围内'
        : '有单元格是空的';
      bump(label, __line, '检查这一列是否填了错别字，或用了别的版本的问题表述');
      if (details.length < 20) details.push({ line: __line, problems });
      continue;
    }

    // ⚠️ 重复行**不剔除** —— 这里与上一版（学习记录）的处理正好相反。
    //
    // 原因很具体：
    //   学习记录的一行是「一次学习会话」，两行完全相同几乎只可能是复制粘贴的脏数据；
    //   问卷的一行是「一个人的答案」，而 48 个选项的组合只有几百万种，
    //   2000 人里必然有相当一部分人答案完全一致 —— 那是真人，不是脏数据。
    //   照上一版的规则去重，会安静地删掉两成样本，把百分位整体算歪；
    //   更糟的是，删掉的恰恰是最「大众」的那部分人，偏差还是系统性的。
    //
    // 但仍要统计：重复率高得离谱，说明文件本身出了问题（比如整段被粘了两遍）。
    const signature = QUESTIONS.map((q) => values[q.field]).join('\u0001');
    if (seen.has(signature)) duplicateCount += 1;
    else seen.add(signature);

    records.push({
      __line,
      ...values,
      // 「编号」这一列名从契约取，不在这里手写 —— 它上面那句注释（"不在任何地方手写"）
      // 原本就是被这个字面量违反的。缺编号时用行号兜底，保证每行都有可指认的 id。
      _id: normalizeCell(__raw?.[OPTIONAL_COLUMNS[0]]) || `第${__line}行`,
    });
  }

  const inputCount = rows.length;
  const droppedCount = inputCount - records.length;
  const base = matrixJson?.baselineMeta ?? {};

  return {
    ok: records.length > 0,
    records,
    report: {
      inputCount,
      keptCount: records.length,
      droppedCount,
      /** 剔除比例（0~1）—— 质量判断用，不再让调用方各算一遍 */
      dropRatio: inputCount ? droppedCount / inputCount : 0,
      duplicateCount,
      duplicateSuspicious: inputCount > 0 && duplicateCount / inputCount > 0.5,
      // ★ 10-14 补全：细分统计（任务书 P4#3）
      missingCells,
      invalidCells,
      missingRows,
      invalidRows,
      // ★ 10-14 补全：基准版本与数据来源 —— 报告里必须能说清"拿什么当的分母"
      baseline: {
        version: MATRIX_VERSION,
        sampleSize: base.sampleSize ?? null,
        source: base.source ?? null,
        disclaimer: base.disclaimer ?? null,
      },
      reasons: [...reasons.values()],
      summary: buildSummary(inputCount, records.length, reasons, duplicateCount, {
        missingCells, invalidCells, missingRows, invalidRows,
      }),
    },
    details,
  };
}

function buildSummary(inputCount, keptCount, reasons, duplicateCount, cells = {}) {
  const parts = [];

  if (reasons.size) {
    // 把"多少格是空的、多少格填错了"先说清楚 —— 这决定了用户去改哪一列
    const detail = [];
    if (cells.missingCells) detail.push(`空格 ${cells.missingCells} 处（涉及 ${cells.missingRows} 行）`);
    if (cells.invalidCells) detail.push(`选项不匹配 ${cells.invalidCells} 处（涉及 ${cells.invalidRows} 行）`);

    parts.push(
      `剔除 ${inputCount - keptCount} 条${detail.length ? '（' + detail.join('、') + '）' : ''}：${[...reasons.values()]
        .map((r) => {
          const where = r.samples.length
            ? `（第 ${r.samples.join('、')} 行${r.count > r.samples.length ? ' 等' : ''}）`
            : '';
          return `${r.label} ${r.count} 条${where}`;
        })
        .join('；')}`,
    );
  }

  if (duplicateCount) {
    const ratio = duplicateCount / inputCount;
    // 问卷里撞答案是常态，所以只在比例高得反常时才出声提醒
    parts.push(
      ratio > 0.5
        ? `另有 ${duplicateCount} 条与他人作答完全相同（占 ${Math.round(ratio * 100)}%，比例偏高，确认一下文件里是否重复粘贴了整段）`
        : `${duplicateCount} 条与他人作答完全相同（问卷里属正常现象，已保留）`,
    );
  }

  if (!parts.length) return `读入 ${inputCount} 条，全部可用。`;
  return `读入 ${inputCount} 条，实际使用 ${keptCount} 条。${parts.join('；')}。`;
}

/**
 * 单人作答的完整性检查 —— 快入口用。
 *
 * 与批量上传不同，快入口只有 6 个值，可以逐题告诉用户「第几题还没答」，
 * 而不是笼统地说「数据不完整」。
 */
export function checkAnswers(answers) {
  const missing = QUESTIONS.filter((q) => !isKnownOption(q.field, normalizeCell(answers?.[q.field])));
  if (!missing.length) return { ok: true, missing: [] };
  return {
    ok: false,
    missing: missing.map((q) => ({ id: q.id, field: q.field, text: q.text })),
    message: `还有 ${missing.length} 题没答：${missing.map((q) => q.id).join('、')}`,
  };
}
