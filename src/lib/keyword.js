/**
 * 青春关键词 —— 报告最后那一句「如果只用一个词概括你的大学，是「XX」。」
 *
 * 为什么这一句**不走大模型**：
 *   它是整份报告的落点，也是最可能被截图转发的一句。大模型偶发不稳定
 *   （超时、字数不够、写跑偏），而这一句恰恰不能出现「这次没写好」的情况。
 *   所以这里做成纯函数、离线可复现：有没有密钥、接口通不通，结尾都是同一句。
 *   大模型负责把故事讲得有血有肉，这一句负责一个字定调。
 *
 * 为什么模板不是从大模型输出里解析出来的：
 *   「解析模型输出的最后一行」这类做法，一旦模型不按格式写就会静默失效 ——
 *   上一个版本已经在 FactsCard 上踩过一次。这里改成完全确定性的查表。
 */

/**
 * 关键词按属性组合挑，第一个命中的胜出，最后一条兜底。
 *
 * 顺序有意排过 —— 组合特征（比如「学术高 + 熬夜多」）必须排在单特征前面，
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

/** 全部关键词（自检用来确认返回值一定落在这个集合里）。 */
export const KEYWORD_WORDS = KEYWORDS.map((k) => k.word);

/** @param {Record<string, number>} percents 9 维百分位 */
export function pickKeyword(percents) {
  return KEYWORDS.find((k) => k.when(percents ?? {}))?.word ?? '不动声色';
}

/** 收尾句。两个字面量在 fallback 与大模型两条路径里共用，保证结尾一致。 */
export function buildClosing(keyword) {
  return `如果只用一个词概括你的大学，是「${keyword}」。`;
}
