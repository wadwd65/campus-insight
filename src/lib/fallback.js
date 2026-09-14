/**
 * 无大模型时的降级文案（五件套之五的备用路径）。
 *
 * 关键要求：**降级也必须是个性化的。**
 *
 * 如果降级成所有人都一样的固定一段话，线上版本就废了一半 ——
 * 而线上版本（没配密钥）恰恰是评委最可能先打开的那一版。
 * 所以这里用属性组合拼句子：不同的人拿到的话确实不同，
 * 只是文采不如大模型，而不是「换了个人也一样」。
 *
 * 全部输入都来自 buildReport 的结果，不额外读数据、不额外计算。
 */

/**
 * 青春关键词：按属性组合挑，第一个命中的胜出，最后一条兜底。
 *
 * 顺序有意排过 —— 组合特征（比如「学术高 + 熬夜多」）放在单特征前面，
 * 否则「熬夜多」会先把所有夜猫子都吃掉，组合的那份辨识度就没了。
 */
const KEYWORDS = [
  { when: (p) => p.academic >= 65 && p.night >= 60, word: '灯火通明' },
  { when: (p) => p.social >= 65 && p.food >= 65, word: '热气腾腾' },
  { when: (p) => p.plan >= 65 && p.academic >= 60, word: '按表走' },
  { when: (p) => p.novelty >= 65 && p.social >= 60, word: '什么都试一次' },
  { when: (p) => p.resilience >= 70 && p.night >= 60, word: '扛得住' },
  { when: (p) => p.sport >= 65, word: '风里来雨里去' },
  { when: (p) => p.food >= 65, word: '深夜食堂' },
  { when: (p) => p.buddhist >= 65, word: '随遇而安' },
  { when: (p) => p.night >= 65, word: '不睡的那种人' },
  { when: (p) => p.academic >= 65, word: '书桌有结界' },
  { when: () => true, word: '不动声色' },
];

/**
 * @param {object} report buildReport 的返回值
 * @param {{name?: string}} options 称呼（评委姓氏等），可空
 * @returns {{paragraphs: string[], keyword: string, closing: string, degraded: true}}
 */
export function buildFallbackSummary(report, { name = '' } = {}) {
  const { percents: p, radar, timeSplit, moodCurve, facts } = report;
  const call = name ? `${name}，` : '';

  // ── 1. 称号 + 最突出与最不突出的两轴 ──
  const byAxis = [...radar].sort((a, b) => b.value - a.value);
  const top = byAxis[0];
  const bottom = byAxis[byAxis.length - 1];
  const p1 =
    `${call}你的称号是「${facts.title}」。` +
    `在「${top.axis}」上你超过了 ${top.value}% 的大学生，` +
    `而「${bottom.axis}」只有 ${bottom.value}% —— 这两个数放在一起，基本就是你的大学轮廓。`;

  // ── 2. 时间分配 ──
  const byTime = [...timeSplit].sort((a, b) => b.value - a.value);
  const most = byTime[0];
  const least = byTime[byTime.length - 1];
  const p2 =
    `你的时间大多给了${most.name}（${most.value}%），${least.name}只占 ${least.value}%。` +
    `${most.name}这一项排在最前面，${least.name}排在最后 —— 这个顺序本身就是一个选择。`;

  // ── 3. 四年心情曲线 ──
  const byMood = [...moodCurve].sort((a, b) => b.value - a.value);
  const high = byMood[0];
  const low = byMood[byMood.length - 1];
  const swing = high.value - low.value;
  const shape = swing >= 24 ? '起落挺大' : swing >= 14 ? '有起有伏' : '一直比较平';
  const p3 =
    `四年下来，你的心情${shape}：${high.stage}最松（${high.value}），${low.stage}最难（${low.value}）。` +
    `${low.stage}那句是这么写的 ——「${low.note}」`;

  // ── 4. 关键词收尾 ──
  const keyword = KEYWORDS.find((k) => k.when(p))?.word ?? '不动声色';
  const closing = `如果只用一个词概括你的大学，是「${keyword}」。`;

  return { paragraphs: [p1, p2, p3], keyword, closing, degraded: true };
}
