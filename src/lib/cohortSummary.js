/**
 * cohortSummary.js —— 群体画像的大模型解读（第三段链路）
 *
 * ── 为什么需要它（10-08 自查发现的真缺口） ────────────────────────
 * 官方对方向 6 的链路是**三段**：数据源 → 图表大盘 → 大模型趣味解读。
 * 而我们的「上传 CSV → 群体画像」此前只走完前两段：有分布、有雷达、有百分位，
 * **但没有大模型那一段**。等于这条主线只做了 2/3。
 *
 * ── 与个人版（buildSummary.js）的区别 ─────────────────────────────
 * 视角不同、读者不同：
 *   · 个人版：写给"这个人"看，第二人称，讲他的四年
 *   · 群体版：写给"看这个班的人"（班主任/辅导员/评委）看，第三人称，
 *     讲这个群体的**分布、分歧与可用结论**
 * 所以提示词与兜底文案都要重写，不能复用个人版。
 *
 * ★ 兜底文案的重要性：评委手上通常没有大模型密钥，
 *   他们看到的就是这里的 `cohortFallbackText`。它必须是**真结论**，
 *   而不是"AI 不可用"这种占位句。
 */
import { cohortHeadline } from './cohort.js';

/** 把 cohort 变成一段"给模型看的事实"（只给数字，不给结论 —— 结论让模型写） */
export function buildCohortFacts(cohort, { className = '' } = {}) {
  const L = [];
  L.push(`【这是一份班级问卷的统计结果${className ? '：' + className : ''}】`);
  L.push(`有效样本 ${cohort.size} 人。`);

  L.push('');
  L.push('【类型分布】');
  for (const g of cohort.groups) {
    L.push(`· ${g.name} ${g.count} 人（${g.pct}%）`);
  }
  L.push(`最多的一类：${cohort.most.name} ${cohort.most.count} 人（${cohort.most.pct}%）`);

  L.push('');
  L.push('【五维分布 · 括号内是"一半人落在哪一段"（Q1~Q3）】');
  for (const a of cohort.axes) {
    L.push(`· ${a.axis} 中位 ${a.median}（${a.q1}~${a.q3}，离散度 IQR ${a.iqr}）`);
  }
  if (cohort.divergent) {
    L.push(`分歧最大的一项：${cohort.divergent.axis}（IQR ${cohort.divergent.iqr}）`);
  }

  L.push('');
  L.push('【九项属性的班级中位数】');
  L.push(Object.entries(cohort.medianAttrs).map(([k, v]) => `${k} ${v}`).join(' · '));

  if (cohort.similar) {
    L.push('');
    L.push(`【群体内部最像的一撮人】${cohort.similar.mineGroup ?? cohort.similar.top?.[0]?.name ?? '—'}`);
  }
  return L.join('\n');
}

export function buildCohortSystemPrompt() {
  return [
    '你是一位擅长把统计数据讲成人话的数据分析师，正在帮一位班主任读懂他班上刚收上来的一份问卷。',
    '',
    '要求：',
    '1. 写三段，每段 3~5 句，合计 260~360 字（不要更多）。段落之间不要小标题，直接分段。',
    '2. 第一段：这个班整体是什么气质（用分布里最突出的那一类说事，给数字）。',
    '3. 第二段：这个班"最不一样"的地方（用分歧最大的那一维，给 Q1~Q3 的区间，说明这意味着什么）。',
    '4. 第三段：给班主任一到两条**可执行**的建议（比如班会怎么设计、哪些人容易被忽略），不要空话。',
    '5. 只能说上面给的数据能支撑的结论。**不要编造数据里没有的信息**（不要提学校名、不要提具体人名、不要提问卷没有的维度）。',
    '6. 语气像个有经验、不端着的老师：具体、克制、不煽情。不用 emoji，不用感叹号。',
  ].join('\n');
}

export function buildCohortUserPrompt(cohort, opts = {}) {
  return `请按上面的要求，为下面这份班级问卷统计写三段解读。\n\n${buildCohortFacts(cohort, opts)}`;
}

/** 一次请求的完整载荷 */
export function buildCohortRequest(cohort, opts = {}) {
  return { system: buildCohortSystemPrompt(), user: buildCohortUserPrompt(cohort, opts) };
}

/**
 * 兜底文案：没有大模型密钥时用它。
 * 必须是**真结论**（数字全部来自 cohort），否则等于这段链路没做。
 */
export function cohortFallbackText(cohort) {
  if (!cohort || !cohort.size) return '';
  const { size, most, groups, divergent, axes } = cohort;
  const empty = groups.filter((g) => g.count === 0);
  const top2 = [...groups].sort((a, b) => b.count - a.count).slice(0, 3);
  const P = [];

  /* 第一段：整体气质 */
  const p1 = [`这个班 ${size} 个人，${most.name}最多，${most.count} 人，占 ${most.pct}%。`];
  if (top2[1]) {
    p1.push(`其次是${top2[1].name}（${top2[1].count} 人，${top2[1].pct}%），两者合起来接近${Math.round(((top2[0].count + top2[1].count) / size) * 100)}%。`);
  }
  if (empty.length === 1) p1.push(`一个${empty[0].name}都没有。`);
  else if (empty.length > 1) p1.push(`没有${empty.map((g) => g.name).join('、')}。`);
  p1.push(
    top2[0].pct >= 40
      ? '这个班的倾向相当集中，一件事拉得动大多数人。'
      : '分布比较分散，说明这个班不是一种人，做班级决定时要考虑两拨人的不同需要。'
  );
  P.push(p1.join(''));

  /* 第二段：最不一样的地方 */
  if (divergent) {
    const p2 = [
      `最"不一样"的是「${divergent.axis}」—— 一半人落在 ${divergent.q1} 到 ${divergent.q3} 之间，离散度 ${divergent.iqr}。`,
    ];
    const wide = divergent.iqr >= 24;
    p2.push(
      wide
        ? '这个跨度很大：同一个班里，有人在这件事上非常靠前，有人非常靠后，中间几乎没有过渡。'
        : '这个跨度不算大，说明这一项上大家比较接近。'
    );
    const sorted = [...axes].sort((a, b) => b.iqr - a.iqr);
    if (sorted[1]) p2.push(`相对最一致的是「${sorted[sorted.length - 1].axis}」（离散度 ${sorted[sorted.length - 1].iqr}）。`);
    P.push(p2.join(''));
  }

  /* 第三段：可执行建议 */
  const p3 = [];
  if (divergent && divergent.iqr >= 24) {
    p3.push(`建议：把班会设计成"两种节奏都能参与"的形式 —— 围绕「${divergent.axis}」这一项，先给不爱表达的一半留出书面/小组的参与方式，再让活跃的一半带节奏，别让跨度变成沉默。`);
  } else {
    p3.push('建议：这个班比较同质，适合用统一的任务推进；但也要留意少数几类占比很小的人，他们容易被"多数人的节奏"盖过去。');
  }
  if (empty.length) {
    p3.push(`另外，${empty.map((g) => g.name).join('、')}的人数目前是 0 —— 这不是问题，但如果一个类型长期为 0，可以想想是问卷没问到位，还是班里确实缺少这类兴趣的入口。`);
  }
  P.push(p3.join(''));

  P.push(`（以上由本地规则根据 ${size} 份作答直接算出，未调用大模型。）`);
  void cohortHeadline;
  return P.join('\n\n');
}
