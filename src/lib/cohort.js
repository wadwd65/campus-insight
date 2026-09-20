/**
 * 真入口的计算层 —— 一批问卷记录 → 群体画像（任务 T-22 的数据部分）。
 *
 * 它和快入口的关系是这一层唯一要想清楚的事：
 *
 *   快入口回答「我」——一个人答一轮，与他/她本人无关的 2000 人基准做分母。
 *   真入口回答「我们」——一批人答同一份问卷，**同一个 2000 人基准**做分母。
 *
 *   两边用同一套映射矩阵、同一个基准、同一个百分位函数，
 *   所以「班里学术力中位数 62」和「我的学术力 82」是**可以直接比的**。
 *   这不是顺手实现的，这是主动选择的：真入口本可以自己给自己当分母
 *   （48 个人互相排），但那样算出来的数只在这个班内部有意义，
 *   换一个班就不可比 —— 教师拿两个班一对比就会得出错的结论。
 *
 * 一个必须讲清楚的取舍：**班级整体位置用「个体百分位的中位数」，不用「均值的百分位」。**
 *   48 个样本的均值的波动远小于个体（约 1/√48），它的百分位会挤在 40~60 之间，
 *   几乎每个班看起来都是"中等"—— 把「有没有特点」这个真问题给压平了。
 *   中位数则是个体层面的统计量，既稳（不受极端值影响）又与个体数字同标尺。
 */

import { RADAR_KEYS, RADAR_AXIS_NAME } from './results.js';
import { ALL_ATTR_KEYS, labelOf } from './surveySchema.js';
import { toAttributeMatrix, toPercents, toAttributes } from './matrix.js';

/**
 * 分组依据：**这个人最突出的那一个维度**。
 *
 * 为什么不用聚类：k-means 的结果依赖初始点，同一批数据跑两次可能给出不同的组名，
 * 而「我们班 12 个人是学术型」这句话必须每次都一样。按最大值归组是确定性的，
 * 而且教师一眼就能理解规则 —— 能被解释的分组才有用，神秘的分组只会被当成黑箱。
 */
export const GROUPS = [
  { key: 'academic', name: '学术型', desc: '最突出的是学习投入', color: '#378ADD' },
  { key: 'social', name: '社交型', desc: '最突出的是人际交往', color: '#D85A30' },
  { key: 'sport', name: '运动型', desc: '最突出的是身体活动', color: '#1D9E75' },
  { key: 'food', name: '生活型', desc: '最突出的是吃与日常', color: '#BA7517' },
  { key: 'buddhist', name: '佛系型', desc: '最突出的是松弛感', color: '#7F77DD' },
];

const GROUP_KEYS = GROUPS.map((g) => g.key);

/** 一批属性 → 每个人归到哪个组（取基数最大的那一维；并列时按 GROUPS 顺序，保证确定性）。 */
export function groupOf(percents) {
  let best = GROUP_KEYS[0];
  for (const key of GROUP_KEYS) {
    if ((percents?.[key] ?? 0) > (percents?.[best] ?? 0)) best = key;
  }
  return best;
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** 分位数（线性插值）。数组不需预排序。 */
function quantile(xs, q) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

const stdev = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** 九维属性上的欧氏距离 —— 「和你最像的人」就按这个排。 */
function distance(a, b) {
  return Math.sqrt(ALL_ATTR_KEYS.reduce((s, k) => s + (a[k] - b[k]) ** 2, 0));
}

/**
 * @param {object[]} records 已清洗的问卷记录（cleanSurveyRows 的输出）
 * @param {{size:number, sorted:object}} baseline 2000 人基准（与快入口同一个）
 * @param {Record<string,string>|null} ownAnswers 同一个会话里答过快入口的作答，可空
 */
export function buildCohort(records, baseline, ownAnswers = null) {
  const attrs = toAttributeMatrix(records);
  const personPercents = attrs.map((a) => toPercents(a, baseline));

  // ── 一 · 五组分布 ──
  const counts = Object.fromEntries(GROUPS.map((g) => [g.key, 0]));
  for (const p of personPercents) counts[groupOf(p)] += 1;
  const total = records.length;
  const groups = GROUPS.map((g) => ({
    ...g,
    count: counts[g.key],
    pct: total ? Math.round((counts[g.key] / total) * 1000) / 10 : 0,
  }));

  // ── 二 · 每一维的位置与分歧 ──
  // 位置用中位数（稳、且与个体同标尺）；分歧用四分位距 —— 它比标准差更抗极端值，
  // 也更适合只有几十个人的班级：一个人特别极端不会把"这个班很不一致"这句话带偏。
  const axes = RADAR_KEYS.map((key) => {
    const values = personPercents.map((p) => p[key]);
    const q1 = quantile(values, 0.25);
    const q3 = quantile(values, 0.75);
    return {
      key,
      axis: RADAR_AXIS_NAME[key] ?? labelOf(key),
      median: Math.round(quantile(values, 0.5)),
      q1: Math.round(q1),
      q3: Math.round(q3),
      iqr: Math.round(q3 - q1),
      stdev: Math.round(stdev(values)),
      min: Math.round(Math.min(...values)),
      max: Math.round(Math.max(...values)),
    };
  });

  const most = [...groups].sort((a, b) => b.count - a.count)[0];
  // 分歧最大的维度：只有样本够多时才说这句话 —— 3 个人的"分歧最大"没有意义
  const divergent = total >= 8 ? [...axes].sort((a, b) => b.iqr - a.iqr)[0] : null;

  // ── 三 · 与你最像的人 ──
  // 需要"你"存在，所以只有在本会话答过快入口时才算。没答过就不编一个"你"出来。
  let similar = null;
  if (ownAnswers && total) {
    const mine = toAttributes(ownAnswers);
    const ranked = records
      .map((r, i) => ({ id: r._id ?? `第${i + 1}人`, group: groupOf(personPercents[i]), dist: distance(mine, attrs[i]) }))
      .sort((a, b) => a.dist - b.dist || String(a.id).localeCompare(String(b.id)))
      .slice(0, 3)
      .map((x) => ({
        id: x.id,
        group: x.group,
        groupName: GROUPS.find((g) => g.key === x.group)?.name ?? x.group,
        // 距离换算成"像的程度"只是给人看的刻度，不要当成统计量。
        // 分母用同维度随机作答的典型距离量级 —— 8 维、每维 0~100 的百分位
        level: x.dist < 40 ? '非常像' : x.dist < 70 ? '挺像' : '有点像',
        dist: Math.round(x.dist),
      }));
    similar = { top: ranked, mineGroup: groupOf(toPercents(toAttributes(ownAnswers), baseline)) };
  }

  return {
    size: total,
    groups,
    axes,
    most,
    divergent,
    similar,
    medianAttrs: Object.fromEntries(
      ALL_ATTR_KEYS.map((k) => [k, Math.round(quantile(attrs.map((a) => a[k]), 0.5))]),
    ),
  };
}

/** 一句话结论 —— 让不看图的人也能拿到结论。 */
export function cohortHeadline(cohort) {
  const { size, most, groups, divergent } = cohort;
  if (!size) return '';
  const parts = [`${size} 个人里，${most.name}最多（${most.count} 人，${most.pct}%）。`];
  const empty = groups.filter((g) => g.count === 0);
  if (empty.length === 1) parts.push(`一个${empty[0].name}都没有。`);
  else if (empty.length > 1) parts.push(`没有${empty.map((g) => g.name).join('、')}。`);
  if (divergent && divergent.iqr >= 24) {
    parts.push(`分歧最大的是「${divergent.axis}」—— 一半人落在 ${divergent.q1}~${divergent.q3} 之间，这个班在这件事上很不一样。`);
  }
  return parts.join('');
}
