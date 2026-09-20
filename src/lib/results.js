/**
 * 五件套派生 —— 属性 → 结果页的四样图表内容（第五样「AI 总结」在 buildSummary.js）。
 *
 * 一个贯穿始终的原则：**所有输出都由属性派生，没有任何一处在硬编码结论。**
 * 因为一旦某样输出是「如果选了什么就显示什么」，它就只会跟着那一个选项动，
 * 而我们要的是「答案不同 → 输出处处不同」。
 *
 * 设计依据：docs/设计-01-问题与映射矩阵.md 第五节。
 */

import { ALL_ATTR_KEYS, labelOf } from './surveySchema.js';
import { toAttributes, toPercents } from './matrix.js';

/**
 * 百分位 → 偏离系数（−1 ~ +1）。
 *
 * 为什么中间要过一道这个：属性的**原始分**量纲不一（有的题给 ±3，有的给 ±1），
 * 直接乘进公式会让不同维度的影响差出三五倍；而**百分位**天然是「相对人群的位置」，
 * 换算成 −1~+1 之后，每增加 1 个单位的影响都是可预期的，公式才好调。
 */
const dev = (pct, key) => (pct?.[key] ?? 50) / 50 - 1;

// ─────────────────────────────────────────────────────────────────────────
// 一 · 雷达图
// ─────────────────────────────────────────────────────────────────────────

/**
 * 雷达图五轴。
 *
 * 导出给真入口（cohort.js）共用 —— 一个班的分组依据也是这五维。
 * 两处各写一份的话，改了一边另一边不会报错，只会安静地少一组或者多一组。
 */
export const RADAR_KEYS = ['academic', 'social', 'sport', 'food', 'buddhist'];

export const RADAR_AXIS_NAME = {
  academic: '学术力',
  social: '社交力',
  sport: '运动力',
  food: '美食力',
  buddhist: '佛系指数',
};

/** 雷达图五轴。数值即百分位，所以图上不用再解释「这个数是什么意思」。 */
export function radarOf(pct) {
  return RADAR_KEYS.map((key) => ({
    key,
    axis: RADAR_AXIS_NAME[key] ?? labelOf(key),
    value: pct[key],
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// 二 · 环形图「时间去哪了」
// ─────────────────────────────────────────────────────────────────────────

/**
 * 权重 = 基准值 + Σ(偏离 × 影响系数)。
 * 睡觉是**反向**的：夜猫程度越高，睡眠时间越少。
 */
const TIME_FORMULA = [
  { name: '学习', base: 22, min: 7, terms: { academic: 15, novelty: -5 } },
  { name: '娱乐', base: 14, min: 5, terms: { novelty: 9, night: 6 } },
  { name: '社交', base: 16, min: 6, terms: { social: 11 } },
  { name: '干饭', base: 9, min: 4, terms: { food: 6 } },
  { name: '睡觉', base: 35, min: 20, terms: { night: -9 } },
];

/**
 * 每类各有自己的下限，**不是一个共用的常数**。
 *
 * 共用一个下限会出这种事：一个极度自律的人，娱乐 / 社交 / 干饭三类的权重
 * 全都跌穿各自的下限，于是环形图上出现三个一模一样的百分比 ——
 * 那三个维度的信息就全丢了，看图的人还会以为「他这三件事花的时间一样多」。
 * 不同下限让它们即使都被压住，也仍然彼此可区分。
 */
export function timeSplitOf(pct) {
  const items = TIME_FORMULA.map(({ name, base, min, terms }) => {
    const weight = Math.max(
      min,
      base + Object.entries(terms).reduce((sum, [k, coef]) => sum + coef * dev(pct, k), 0),
    );
    return { name, weight };
  });

  const total = items.reduce((s, x) => s + x.weight, 0);
  const out = items.map((x) => ({ name: x.name, value: Math.round((x.weight / total) * 1000) / 10 }));

  // 四舍五入会让和小数点后差个零点几，把误差挪到最大的一项上，
  // 免得界面显示五个数加起来 99.9% —— 这种小瑕疵最伤「工程严谨」的印象分。
  const drift = Math.round((100 - out.reduce((s, x) => s + x.value, 0)) * 10) / 10;
  const biggest = out.reduce((a, b) => (b.value > a.value ? b : a));
  biggest.value = Math.round((biggest.value + drift) * 10) / 10;

  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// 三 · 四年心情曲线
// ─────────────────────────────────────────────────────────────────────────

/** 与属性无关的基线形状：新鲜 → 社交高峰 → 压力谷 → 怀念回升。 */
const MOOD_BASE = [70, 78, 62, 76];
const STAGES = ['大一', '大二', '大三', '大四'];
const MOOD_MID = 72; // 抗压调整的收敛中心

/**
 * 每个阶段准备几句台词，按属性挑最贴的一句。
 * 顺序即优先级，最后一条是无条件兜底 —— 保证任何输入都有话说。
 */
const STAGE_NOTES = [
  [
    { when: (p) => p.novelty >= 60, text: '什么都想试一次，社团招新那天你报了三个' },
    { when: (p) => p.academic >= 60, text: '开学第一周，图书馆那张座位的归属就定下来了' },
    { when: (p) => p.sport >= 60, text: '操场是你认识这个学校的第一张地图' },
    { when: () => true, text: '食堂是社交中心，宿舍是据点，两点一线也热闹' },
  ],
  [
    { when: (p) => p.social >= 60, text: '社交半径达到四年最大 —— 谁过生日你都在场' },
    { when: (p) => p.academic >= 60, text: '课程最难的一年，你反而最沉得住气' },
    { when: (p) => p.night >= 60, text: '作息开始往后挪，深夜成了效率最高的时段' },
    { when: () => true, text: '在宿舍和图书馆之间反复横跳，哪边都待不久' },
  ],
  [
    { when: (p) => p.academic >= 60 && p.plan >= 60, text: '别人开始慌的时候，你在按表推进' },
    { when: (p) => p.night >= 60, text: '专业课压力最大的一年，熬夜成了默认选项' },
    { when: (p) => p.resilience >= 60, text: '最难的一年，但你扛得住，也没垮' },
    { when: () => true, text: '压力最大的一年，也是分水岭 —— 有人转向，有人沉下去' },
  ],
  [
    { when: (p) => p.night >= 60, text: '最怀念的是那些熬到天亮的夜' },
    { when: (p) => p.food >= 60, text: '最后一次在食堂坐到闭馆，阿姨都认识你了' },
    { when: (p) => p.social >= 60, text: '散伙饭吃了很多顿，谁也没先说再见' },
    { when: () => true, text: '一边赶论文，一边舍不得走' },
  ],
];

/** 四年心情曲线：4 个节点 + 每个节点一句话。 */
export function moodCurveOf(pct) {
  const values = [...MOOD_BASE];

  values[0] += dev(pct, 'novelty') * 10;
  values[1] += dev(pct, 'social') * 9;
  values[2] += (dev(pct, 'academic') * 0.6 + dev(pct, 'plan') * 0.6) * 12;
  values[3] += dev(pct, 'night') * 8;

  const foodLift = dev(pct, 'food') * 5;
  for (let i = 0; i < values.length; i += 1) values[i] += foodLift;

  // 抗压高 → 曲线整体变平（向 72 收敛）；抗压低 → 起伏被放大。
  // 一个式子同时表达两件事：value = 中心 + (原偏离) × (1 − flatten)
  const flatten = dev(pct, 'resilience') * 0.45;
  for (let i = 0; i < values.length; i += 1) {
    values[i] = MOOD_MID + (values[i] - MOOD_MID) * (1 - flatten);
  }

  return STAGES.map((stage, i) => {
    const value = Math.round(Math.min(95, Math.max(30, values[i])));
    const note = STAGE_NOTES[i].find((n) => n.when(pct))?.text ?? '';
    return { stage, value, note };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 四 · 人群冷知识
// ─────────────────────────────────────────────────────────────────────────

/**
 * 每个属性的两句话：偏高时用前半，偏低时用后半。
 *
 * ⚠️ **必须覆盖 ALL_ATTR_KEYS 的全部 9 个键**（8 基础 + 派生 `buddhist`）。
 *    漏掉任何一个，冷知识那一行会输出成「…… —— 」后面空着 ——
 *    它不报错、不崩溃，只是安静地难看。自检里有对应的覆盖断言。
 */
export const FACT_COPY = {
  academic: ['你的书桌像有结界，坐下就能学进去', '书本对你更像一份待办清单，而不是一种生活'],
  social: ['你是那种能把食堂坐成客厅的人', '你的社交电量充得慢，但用得住'],
  sport: ['身体是你最信得过的伙伴', '你和操场的关系，长期停留在路过'],
  food: ['你对吃的判断力，明显高于大多数人', '吃饭对你是续航，不是享受'],
  night: ['深夜才是你的主场，白天只是过场', '你的作息忠诚于太阳，这很少见'],
  plan: ['你的事大多在计划内发生', '计划是拿来改的 —— 这是你的哲学'],
  novelty: ['你对新东西的胃口很大，从不嫌多', '你更愿意把熟悉的事做到熟透'],
  resilience: ['你扛得住，而且恢复得快', '压力在你身上留的痕迹比一般人深'],
  buddhist: ['你不太跟事情较劲，睡得着，也放得下', '你对自己有要求，松不太下来'],
};

/** 极端维度的「称号」，用于报告标题。键的覆盖要求同上。 */
export const TITLES = {
  academic: ['图书馆常驻民', '自习室里的过路人'],
  social: ['食堂客厅的主人', '安静但绝对可靠'],
  sport: ['操场的钉子户', '电梯的忠实用户'],
  food: ['深夜食堂的神秘部员', '吃饭只为了续航'],
  night: ['凌晨三点的守夜人', '和太阳同一作息的人'],
  plan: ['按表推进的人', '见招拆招的选手'],
  novelty: ['什么都想试一次的人', '认定一件事就一直做'],
  resilience: ['扛得住的那种人', '容易被压力留下痕迹'],
  buddhist: ['真·随遇而安的人', '对自己有要求的人'],
};

/**
 * 冷知识 —— 从**最有戏剧性**的两个维度里挑，而不是随便挑。
 *
 * 挑法：先取 |百分位−50| 最大的那个维度，再找一个方向相反的次极端维度。
 * 方向相反才会形成反差句 ——「最爱吃宵夜」里「最不熬夜」的那个 3%，
 * 这种句子才让人想转发。
 */
export function factsOf(pct) {
  const ranked = ALL_ATTR_KEYS.map((key) => ({ key, pct: pct[key], dev: pct[key] - 50 })).sort(
    (a, b) => Math.abs(b.dev) - Math.abs(a.dev),
  );

  const first = ranked[0];
  const opposite =
    ranked.find((r) => Math.abs(r.dev) > 0 && Math.sign(r.dev) === -Math.sign(first.dev)) ??
    ranked[1];

  return {
    title: TITLES[first.key]?.[first.dev >= 0 ? 0 : 1] ?? '独特的那一个',
    lines: [describe(first), describe(opposite)].filter(Boolean),
  };
}

function describe(item) {
  if (!item) return null;
  const { key, pct, dev: d } = item;
  const high = d >= 0;
  const label = labelOf(key);
  const copy = FACT_COPY[key]?.[high ? 0 : 1] ?? '';
  // 低值不写「只有 X% 的人比你更低」—— 那句话读者要绕一圈才明白，
  // 直接说「低于 X% 的大学生」，一眼就懂，也避免 2% 这种小数字看着像笔误
  return {
    key,
    label,
    pct,
    high,
    copy,
    // text 是整句，供纯文本场景用（自检输出、导出报告、喂给大模型的摘要）。
    // 界面**不要**去解析这句话，它只是这句话的一种渲染结果。
    text: `在「${label}」上，你${high ? '超过' : '低于'} ${high ? pct : 100 - pct}% 的大学生 —— ${copy}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 汇总
// ─────────────────────────────────────────────────────────────────────────

/**
 * 完整报告。基线由 buildBaseline() 从基准 CSV 算出来，只算一次，全站共用。
 *
 * @param {Record<string,string>} answers 6 个字段 → 选项文本
 * @param {{size:number, sorted:object}} baseline
 */
export function buildReport(answers, baseline) {
  return buildReportFromAttributes(toAttributes(answers), baseline, { answers });
}

/**
 * 同一份报告，但**跳过"问卷答案 → 属性"这一步**，直接拿一本算好的属性。
 *
 * 为什么需要它（这是地图上线时才暴露出来的一个结构性缺口）：
 *   报告页原本只认 `answers`（问卷答案对象），于是从地图点「生成档案」会走到欢迎页 ——
 *   因为地图玩家根本没答过题，`answers` 是空的。
 *   而地图的全部意义恰恰是"不答题也能出一份档案"。
 *
 *   修法不是给 ReportView 加一堆 if，而是把这条链上真正的**分界点**找出来：
 *   「属性」才是报告页的输入，`answers` 只是一种**得出属性的方式**。
 *   于是在这里切开 —— 计算层从此不关心数据来自问卷还是地图，
 *   与 store 里那句"两条路进同一本账，档案页不必关心数据从哪来"是同一件事。
 *
 * @param {Record<string,number>} attributes 8 基础属性 + 派生（缺的按 0 算）
 * @param {{size:number, sorted:object}} baseline
 * @param {{answers?:object}} extra 透传原始答案（有就带上，供摘要复用）
 */
export function buildReportFromAttributes(attributes, baseline, extra = {}) {
  const percents = toPercents(attributes, baseline);
  return {
    answers: extra.answers ?? null,
    attributes,
    percents,
    radar: radarOf(percents),
    timeSplit: timeSplitOf(percents),
    moodCurve: moodCurveOf(percents),
    facts: factsOf(percents),
  };
}
