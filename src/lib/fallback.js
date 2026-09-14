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

import { pickKeyword, buildClosing } from './keyword.js';

/**
 * 青春关键词已移到 keyword.js —— 大模型那条路径的收尾句也用同一个函数，
 * 两条路走出来的结尾必须一模一样，否则「有没有密钥」会变成两种产品。
 */

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
  const keyword = pickKeyword(p);
  const closing = buildClosing(keyword);

  return { paragraphs: [p1, p2, p3], keyword, closing, degraded: true };
}

/**
 * 降级正文拼成纯文本 —— 与大模型输出**同一种形状**（段落之间空行、不含结尾句）。
 *
 * 两个"统一"是刻意的：
 *   · 形状统一 → 界面上两条路径走同一段渲染代码，不会出现「有没有密钥，版式都不一样」。
 *   · 都不含结尾句 → 结尾那句由 keyword.js 确定性生成、由结果页单独排版，
 *     于是不管走哪条路，报告最后那一句是同一个字、同一个样式。
 */
export function fallbackText(report, options) {
  return buildFallbackSummary(report, options).paragraphs.join('\n\n');
}
