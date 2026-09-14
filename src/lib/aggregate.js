/**
 * T-08 / T-09 · 聚合层
 *
 * 输入是清洗过的记录，输出是各种"分组后的数字"。这一层只做加减乘除，不下结论。
 * 结论（谁高谁低、哪背离）归 diagnose.js，人话归 buildSummary.js。
 *
 * 全线遵守两条口径，都来自 schema.js：
 *   - 正确率一律**加权**（先加总题量与正确数再相除）
 *   - 分母为 0 返回 null，不返回 NaN
 */

import { weightedAccuracy, slotOf } from './schema.js';

/** 按日期升序、同日按开始时间升序 —— 输入顺序不该影响输出。 */
function sortRecords(records) {
  return [...records].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}

const sum = (records, key) => records.reduce((acc, r) => acc + r[key], 0);

/**
 * 时间跨度。
 *
 * `daysWithRecords` 与 `calendarDays` 必须分开给：
 * 日均时长按**有记录的天数**算（契约第二节写死的），而不是按日历天数。
 * 两者混用会让"某天没学"变成"那天学了 0 分钟"，直接把日均拉低十几分钟，
 * 于是所有跟时长有关的结论都偏小 —— 这是这类工具最容易算错的一处。
 */
export function dateSpan(records) {
  if (!records.length) {
    return { start: null, end: null, daysWithRecords: 0, calendarDays: 0, dates: [], missingDates: [] };
  }
  const dates = [...new Set(records.map((r) => r.date))].sort();
  const start = dates[0];
  const end = dates[dates.length - 1];
  const calendarDays = diffDays(start, end) + 1;

  const missingDates = [];
  for (let i = 0; i < calendarDays; i += 1) {
    const d = addDays(start, i);
    if (!dates.includes(d)) missingDates.push(d);
  }

  return { start, end, daysWithRecords: dates.length, calendarDays, dates, missingDates };
}

/** T-08 · 按科目聚合，按时长降序。 */
export function subjectStats(records) {
  const total = sum(records, 'minutes');
  const groups = new Map();

  for (const r of records) {
    if (!groups.has(r.subject)) groups.set(r.subject, []);
    groups.get(r.subject).push(r);
  }

  return [...groups.entries()]
    .map(([subject, group]) => {
      const minutes = sum(group, 'minutes');
      const questions = sum(group, 'questions');
      const correct = sum(group, 'correct');
      const days = new Set(group.map((r) => r.date)).size;
      return {
        subject,
        sessions: group.length,
        days,
        minutes,
        minutesShare: total ? minutes / total : null,
        questions,
        correct,
        accuracy: weightedAccuracy(group),
        avgMinutesPerSession: group.length ? minutes / group.length : null,
        // 单位时间产出：每分钟做对几题。跨科目只作参考（题型不同，题量不可直接比），
        // 所以它不参与诊断排序，只在摘要里作为旁证给出来。
        correctPerMinute: minutes ? correct / minutes : null,
      };
    })
    .sort((a, b) => b.minutes - a.minutes || a.subject.localeCompare(b.subject, 'zh'));
}

/**
 * T-09 · 按日聚合，只返回**有记录的日期**，不补零。
 *
 * 为什么不补零：见 dateSpan 的注释。补零会让趋势线在没学的日子掉到 0，
 * 看起来像"某天完全崩了"，实际上那天只是没记。图表层要画断点就自己判断缺口。
 */
export function dailyStats(records) {
  const groups = new Map();
  for (const r of sortRecords(records)) {
    if (!groups.has(r.date)) groups.set(r.date, []);
    groups.get(r.date).push(r);
  }

  return [...groups.entries()].map(([date, group]) => ({
    date,
    sessions: group.length,
    minutes: sum(group, 'minutes'),
    questions: sum(group, 'questions'),
    correct: sum(group, 'correct'),
    accuracy: weightedAccuracy(group),
    subjects: [...new Set(group.map((r) => r.subject))],
  }));
}

/** 全局总量与整体正确率 —— 后面所有"高于/低于整体"的判断都以它为基准。 */
export function overallStats(records) {
  const span = dateSpan(records);
  const minutes = sum(records, 'minutes');
  return {
    sessions: records.length,
    subjects: new Set(records.map((r) => r.subject)).size,
    minutes,
    hours: minutes / 60,
    questions: sum(records, 'questions'),
    correct: sum(records, 'correct'),
    accuracy: weightedAccuracy(records),
    ...span,
    avgMinutesPerActiveDay: span.daysWithRecords ? minutes / span.daysWithRecords : null,
    avgSessionsPerActiveDay: span.daysWithRecords ? records.length / span.daysWithRecords : null,
  };
}

/**
 * T-11 的半成品：某个科目的时长在各时段怎么分布。用来回答
 * 「你上午效率最高，但数学是不是被排在下午」这类问题。
 */
export function subjectSlotMatrix(records) {
  const matrix = {};
  for (const r of records) {
    matrix[r.subject] ??= { 上午: 0, 下午: 0, 晚上: 0, total: 0 };
    matrix[r.subject][slotOf(r.startTime)] += r.minutes;
    matrix[r.subject].total += r.minutes;
  }
  for (const s of Object.keys(matrix)) {
    for (const slot of ['上午', '下午', '晚上']) {
      matrix[s][slot] = matrix[s].total ? matrix[s][slot] / matrix[s].total : null;
    }
  }
  return matrix;
}

// ── 日期小工具（不引第三方库：只要两个函数，引一个 dayjs 不划算） ──

export function diffDays(fromISO, toISO) {
  const a = Date.UTC(...fromISO.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
  const b = Date.UTC(...toISO.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v))));
  return Math.round((b - a) / 86400000);
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
