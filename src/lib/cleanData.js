/**
 * T-07 · 数据清洗
 *
 * 与 validate.js 的分界：这里处理的是「格式没错、但这条记录不能用」的行。
 * 这类行不拒绝整份文件，只剔除、并如实告诉用户剔了几行、为什么 ——
 * 静默丢弃比报错更糟：用户以为自己的数据全被用上了，诊断结论却是缺斤少两的。
 *
 * 剔除规则（三条）：
 *   1. 完全重复的记录（六列全同）—— 多半是往 CSV 里粘了两遍
 *   2. 时长 = 0 —— 没有学习时长，进不了任何时长统计，留着只会拉低日均
 *   3. 完成题量 = 0 —— 正确率的分母是 0，算不出来，留着会让聚合出现空洞
 *
 * 负值不在这里处理：那属于录入手误（前面多了个减号），已在 validate.js 拒绝整份文件，
 * 这样用户会被迫回去改源文件，而不是让系统悄悄吃掉。
 */

/** 六列的指纹，用于判重。 */
function fingerprint(r) {
  return [r.date, r.startTime, r.subject, r.minutes, r.questions, r.correct].join('|');
}

/**
 * @param {object[]} records validateRows 的输出
 * @returns {{records:object[], dropped:object[], warnings:object[], report:object}}
 */
export function cleanRecords(records) {
  const seen = new Set();
  const kept = [];
  const dropped = [];
  const slotSeen = new Map();

  for (const record of records) {
    const key = fingerprint(record);
    if (seen.has(key)) {
      dropped.push({ record, reason: 'DUPLICATE', detail: '和上面某条完全相同' });
      continue;
    }
    seen.add(key);

    if (record.minutes === 0) {
      dropped.push({ record, reason: 'ZERO_MINUTES', detail: '时长为 0' });
      continue;
    }
    if (record.questions === 0) {
      dropped.push({ record, reason: 'ZERO_QUESTIONS', detail: '完成题量为 0，正确率无法计算' });
      continue;
    }

    // 同一时刻同一科目出现多条：不是完全重复（数值不同），所以不丢，
    // 但很可能是「一次学习被拆成两行」，会让那次学习的正确率被平均两次，值得提醒。
    const slot = `${record.date} ${record.startTime} ${record.subject}`;
    if (slotSeen.has(slot)) {
      slotSeen.set(slot, slotSeen.get(slot) + 1);
    } else {
      slotSeen.set(slot, 1);
    }

    kept.push(record);
  }

  // 固定按时间升序输出：输入行的先后顺序不该影响图表和结论，
  // 排序放在这里是「让下游拿到的东西已经规矩了」，而不是每个图表各排一次。
  kept.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );

  const warnings = [...slotSeen.entries()]
    .filter(([, n]) => n > 1)
    .map(([slot, n]) => ({
      code: 'SAME_SLOT',
      message: `${slot} 有 ${n} 条记录，如果是同一次学习被拆成了多行，建议合并后再导入`,
    }));

  return { records: kept, dropped, warnings, report: buildReport(records.length, kept, dropped) };
}

/** 把剔除情况汇成一句人话，界面直接显示，不用自己拼。 */
function buildReport(inputCount, kept, dropped) {
  const byReason = {};
  for (const d of dropped) {
    byReason[d.reason] = byReason[d.reason] || { reason: d.reason, detail: d.detail, count: 0, lines: [] };
    byReason[d.reason].count += 1;
    if (byReason[d.reason].lines.length < 5) byReason[d.reason].lines.push(d.record.sourceLine);
  }

  const reasons = Object.values(byReason).map((r) => ({ ...r, lines: [...r.lines].sort((a, b) => a - b) }));

  const summary = reasons.length
    ? `共读入 ${inputCount} 行，剔除了 ${dropped.length} 行（${reasons
        .map((r) => `${r.detail} ${r.count} 行`)
        .join('、')}），实际使用 ${kept.length} 行。`
    : `共读入 ${inputCount} 行，全部有效。`;

  return { inputCount, outputCount: kept.length, droppedCount: dropped.length, reasons, summary };
}
