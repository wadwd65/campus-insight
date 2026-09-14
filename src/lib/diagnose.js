/**
 * T-10 / T-11 / T-12 · 诊断层
 *
 * 这一层开始"下结论"：谁投入产出背离、哪个时段效率高、哪个科目从哪天起变了。
 * 每个结论都必须能追到具体数字 —— 因为下游要拿这些数字去喂大模型，
 * 而大模型的任务是"用给定的数字说话"，不是自己编。
 * 所以这一层不许出现任何拿不出数字的判断。
 */

import { TIME_SLOTS, slotOf, weightedAccuracy } from './schema.js';
import { subjectStats, overallStats, subjectSlotMatrix, dateSpan, addDays, diffDays } from './aggregate.js';

// ═══════════════════════════════════════════════ T-10 投入产出

/**
 * 投入产出诊断。
 *
 * 核心概念（这是整个产品的命题）：
 *   投入 = 时长占比；产出 = 正确率。
 *   两者本该同向，但人会在一科上砸更多时间却看不到起色 —— 这个背离本人算不出来，
 *   因为他脑子里只有"我数学花的时间最多"，没有把两个维度交叉过。
 *
 * 两个指标：
 *   - accuracyGap：该科正确率减整体正确率（百分点）。负数 = 拖后腿。
 *   - divergence：正确率排名 − 时长排名。正数 = 投入多而产出差，越大越背离。
 *     用它而不是"时长占比−正确率"直接相减，是因为两个量的量纲没法直接比；
 *     用排名差就绕开了量纲，而且天然是整数，一眼能看出"倒挂了几个位次"。
 */
export function investmentOutcome(records) {
  const subjects = subjectStats(records);
  const overall = overallStats(records);
  if (!subjects.length || overall.accuracy === null) {
    return { overall, evenShare: null, items: [], worst: null, hasDivergence: false };
  }

  const evenShare = 1 / subjects.length; // 均分状态下的时长占比
  const byTime = [...subjects].sort((a, b) => b.minutes - a.minutes);
  const byAccuracy = [...subjects].sort((a, b) => b.accuracy - a.accuracy);

  const items = subjects.map((s) => {
    const rankByTime = byTime.findIndex((x) => x.subject === s.subject) + 1;
    const rankByAccuracy = byAccuracy.findIndex((x) => x.subject === s.subject) + 1;
    const accuracyGap = s.accuracy - overall.accuracy;
    const heavy = s.minutesShare >= evenShare;
    const weak = accuracyGap < 0;

    return {
      subject: s.subject,
      minutes: s.minutes,
      minutesShare: s.minutesShare,
      accuracy: s.accuracy,
      accuracyGap,
      rankByTime,
      rankByAccuracy,
      divergence: rankByAccuracy - rankByTime,
      heavy,
      weak,
      verdict: heavy && weak ? '高投入低产出' : heavy ? '高投入高产出' : weak ? '低投入低产出' : '低投入高产出',
    };
  });

  // 排名差从大到小 → 最背离的排最前，"最该关注的科目"就是第一个。
  items.sort((a, b) => b.divergence - a.divergence || b.minutesShare - a.minutesShare);

  return {
    overall,
    evenShare,
    items,
    worst: items[0] ?? null,
    // 只有"投入高于均分且正确率低于整体"才算真的背离，排名差为正但投入不高的情况不算。
    hasDivergence: items.some((i) => i.heavy && i.weak),
  };
}

// ═══════════════════════════════════════════════ T-11 时段

/**
 * 时段统计 + 时段错配判断。
 *
 * 单看"哪个时段效率高"没用，要接一步：
 *   效率最高的时段，时间花在哪一科上？效率最低的时段，时间又花在哪一科上？
 *   如果最差的那科恰好堆在最差的时段，这才叫"错配"，也才是能落地成建议的结论。
 */
export function slotBreakdown(records) {
  const totalMinutes = records.reduce((s, r) => s + r.minutes, 0);

  const slots = TIME_SLOTS.map((slot) => {
    const group = records.filter((r) => slotOf(r.startTime) === slot);
    const minutes = group.reduce((s, r) => s + r.minutes, 0);
    return {
      slot,
      sessions: group.length,
      minutes,
      minutesShare: totalMinutes ? minutes / totalMinutes : null,
      questions: group.reduce((s, r) => s + r.questions, 0),
      accuracy: weightedAccuracy(group),
    };
  });

  const rated = slots.filter((s) => s.accuracy !== null);
  const best = rated.length ? rated.reduce((a, b) => (b.accuracy > a.accuracy ? b : a)) : null;
  const worst = rated.length ? rated.reduce((a, b) => (b.accuracy < a.accuracy ? b : a)) : null;

  const matrix = subjectSlotMatrix(records);
  const topSubjectIn = (slot) => {
    if (!slot) return null;
    const rows = Object.entries(matrix)
      .map(([subject, dist]) => ({ subject, share: dist[slot] }))
      .filter((x) => x.share !== null)
      .sort((a, b) => b.share - a.share);
    return rows[0] ?? null;
  };

  const bestSlotTop = topSubjectIn(best?.slot);
  const worstSlotTop = topSubjectIn(worst?.slot);
  const outcome = investmentOutcome(records);

  return {
    slots,
    best,
    worst,
    spread: best && worst ? best.accuracy - worst.accuracy : null,
    matrix,
    misallocation: {
      bestSlotTopSubject: bestSlotTop,
      worstSlotTopSubject: worstSlotTop,
      // 最差时段里堆得最多的那科，是不是恰好也是全局投入产出最差的那科
      worstSubjectSitsInWorstSlot:
        !!worstSlotTop && !!outcome.worst && worstSlotTop.subject === outcome.worst.subject,
    },
  };
}

// ═══════════════════════════════════════════════ T-12 趋势

/**
 * 滑动平均。
 *
 * centered=true 取「前 3 天 + 当天 + 后 3 天」，时间戳打在正中间，**曲线没有滞后**。
 *
 * ⚠️ 这条是踩过的坑：一开始用"只看过去 7 天"的滞后平均，结果第 45 天开始的跌幅，
 * 曲线要到第 55 天才跌到底，转折点被测出偏晚 12 天。
 * 分析一份**已经完整拿到的历史数据**时，没有任何理由忍受这个滞后 ——
 * 实时监控才必须只用过去的数据，离线分析一律用居中平均。
 */
export function movingAverage(points, window = 7, centered = true) {
  const half = Math.floor(window / 2);
  return points.map((p, i) => {
    const slice = centered
      ? points.slice(Math.max(0, i - half), Math.min(points.length, i + half + 1))
      : points.slice(Math.max(0, i - window + 1), i + 1);
    return { date: p.date, value: slice.reduce((s, x) => s + x.value, 0) / slice.length };
  });
}

function sse(values) {
  if (!values.length) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0);
}

/**
 * 找转折点：把序列在每个位置切成前后两段，取「两段各自内部离均差平方和之和」最小的切点。
 *
 * 为什么不用"跌破某条阈值"：滑动平均本身是渐变的，等它跌破阈值时跌幅已经走完大半，
 * 测出来的是**终点**而不是**起点**。分段最优点测的才是过渡段的中点。
 */
export function detectChangePoint(points, { window = 7, minSeg = 10 } = {}) {
  if (points.length < minSeg * 2) return null;
  const ma = movingAverage(points, window);
  const values = ma.map((p) => p.value);

  let bestIndex = null;
  let bestSse = null;
  for (let i = minSeg; i <= values.length - minSeg; i += 1) {
    const total = sse(values.slice(0, i)) + sse(values.slice(i));
    if (bestSse === null || total < bestSse) {
      bestSse = total;
      bestIndex = i;
    }
  }
  if (bestIndex === null) return null;

  // 前后水平在**原始序列**上算，不用滑动平均的值 —— 平均值会被过渡段稀释，
  // 报告给用户的"下滑了多少个百分点"应该是原始数的对比。
  const before = points.slice(0, bestIndex);
  const after = points.slice(bestIndex);
  const meanBefore = before.reduce((s, p) => s + p.value, 0) / (before.length || 1);
  const meanAfter = after.reduce((s, p) => s + p.value, 0) / (after.length || 1);

  return {
    date: points[bestIndex].date,
    index: bestIndex,
    meanBefore,
    meanAfter,
    delta: meanAfter - meanBefore,
    direction: meanAfter >= meanBefore ? 'up' : 'down',
  };
}

/**
 * 按日的正确率序列：**只包含当天有该科记录的日子**，不补零。
 * 正确率没有"0"这个合法值可补 —— 那天没学英语，不等于那天英语正确率是 0%。
 */
export function accuracySeries(records, subject) {
  const group = records.filter((r) => r.subject === subject);
  const byDate = new Map();
  for (const r of group) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  return [...byDate.entries()]
    .filter(([, rs]) => rs.some((r) => r.questions > 0))
    .map(([date, rs]) => ({ date, value: weightedAccuracy(rs) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 按日的时长序列：**补零**，覆盖整个日历范围。
 * 这里补零是对的 —— 那天没学数学，数学时长确实就是 0 分钟，0 是合法值。
 *
 * 同一个"缺数据"问题，两个序列的处理相反，判据是**0 在这条指标上是否是合法值**。
 */
export function minutesSeries(records, subject) {
  const span = dateSpan(records);
  const byDate = new Map();
  for (const r of records) {
    if (r.subject !== subject) continue;
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.minutes);
  }
  const out = [];
  for (let i = 0; i < span.calendarDays; i += 1) {
    const date = addDays(span.start, i);
    out.push({ date, value: byDate.get(date) ?? 0 });
  }
  return out;
}

/**
 * 逐科的趋势：正确率转折点 + 时长转折点。
 * 注意这里**只出原始趋势，不下"同步"的结论** —— 同步是跨科目的判断，归 syncPairs。
 */
export function subjectTrends(records, { minSeg = 10 } = {}) {
  return subjectStats(records).map((s) => {
    const acc = accuracySeries(records, s.subject);
    const min = minutesSeries(records, s.subject);
    const accuracyChange = detectChangePoint(acc, { minSeg });
    const minutesChange = detectChangePoint(min, { minSeg });

    return {
      subject: s.subject,
      minutesShare: s.minutesShare,
      accuracy: s.accuracy,
      accuracySeries: acc,
      minutesSeries: min,
      accuracyChange,
      minutesChange,
    };
  });
}

const SYNC_TOLERANCE_DAYS = 5; // 两个转折点相差几天内算"同步"
const MIN_MEANINGFUL_DROP = 0.05; // 正确率跌幅低于 5 个百分点视为噪声，不做同步判断
const MIN_MEANINGFUL_RISE = 0.15; // 时长上升低于 15% 视为波动，不做同步判断

/**
 * 跨科目的"同步"检测 —— 这才是产品要讲的那件事。
 *
 * ⚠️ 这里踩过一次坑：第一版把"同步"写成**同一科目内部**的条件
 * （某科时长涨 + 该科正确率跌）。跑数据立刻露馅：英语正确率确实掉了 10.6 个百分点，
 * 但英语自己的时长是平的，所以判定不成立。
 * 真实的故事是**跨科目**的 ——「英语掉分，和数学开始加时是同一段时间」。
 * 两个维度分属不同科目，就不能在单科内部比。
 *
 * 做法：把"正确率显著下滑的科目"与"时长显著上升的科目"两两配对，
 * 转折点相差不超过 tolerance 天即算同步，按时间差从小到大排。
 * 另外加了两个显著性门槛，否则噪声造出的假转折点会凑出一堆假同步。
 */
export function syncPairs(trends, {
  tolerance = SYNC_TOLERANCE_DAYS,
  dropThreshold = MIN_MEANINGFUL_DROP,
  riseThreshold = MIN_MEANINGFUL_RISE,
} = {}) {
  const drops = trends.filter(
    (t) => t.accuracyChange && t.accuracyChange.direction === 'down' && Math.abs(t.accuracyChange.delta) >= dropThreshold,
  );
  const rises = trends
    .filter((t) => t.minutesChange && t.minutesChange.direction === 'up' && t.minutesChange.meanBefore > 0)
    .map((t) => ({
      ...t,
      relativeRise: (t.minutesChange.meanAfter - t.minutesChange.meanBefore) / t.minutesChange.meanBefore,
    }))
    .filter((t) => t.relativeRise >= riseThreshold);

  const pairs = [];
  for (const drop of drops) {
    for (const rise of rises) {
      const lagDays = diffDays(rise.minutesChange.date, drop.accuracyChange.date);
      if (Math.abs(lagDays) > tolerance) continue;
      pairs.push({
        dropSubject: drop.subject,
        riseSubject: rise.subject,
        dropDate: drop.accuracyChange.date,
        riseDate: rise.minutesChange.date,
        lagDays,
        // 正确率掉了几个百分点 / 时长涨了百分之几 —— 两个数都带上，结论才立得住
        accuracyDropPoints: Math.abs(drop.accuracyChange.delta),
        minutesRiseRatio: rise.relativeRise,
        sameSubject: drop.subject === rise.subject,
      });
    }
  }
  return pairs.sort((a, b) => Math.abs(a.lagDays) - Math.abs(b.lagDays));
}

/** 只保留最值得说的那一条：优先跨科目（同一科目内部归因太弱，不构成"挤占"）。 */
export function strongestSync(pairs) {
  return pairs.find((p) => !p.sameSubject) ?? pairs[0] ?? null;
}

/** 供摘要层调用：什么算"没有任何数据"。 */
export function isEmpty(records) {
  return !records || records.length === 0;
}
