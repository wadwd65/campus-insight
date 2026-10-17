/**
 * egg.js —— 立绘彩蛋的"趣评"（2026-10-17 夜）
 *
 * 触发条件：60 秒内点立绘 10 次。
 * 表现：小人歪一下头 + 气泡里先说一句固定台词，再给一句**基于当前作答的趣评**。
 *
 * ── 为什么这个彩蛋值得做 ────────────────────────────────────────
 * 它是"功能露出"而不是"放烟花"：趣评里那个百分比是**真算出来的**
 * （维度百分位，来自 buildReport 的同一套计算），不是写死的一句漂亮话。
 * 用户点十下换到的是"哦，它是真的在算我"，而不是一个动画。
 *
 * ── 三条规矩 ────────────────────────────────────────────────────
 * ① **数字必须有出处**：趣评里的百分比只能是 `percents[key]`（基准人群分位），
 *    与报告页、AI 摘要用的是同一个数。写死一个"72%"看起来更巧，
 *    但那正是这个站点最不能犯的错 —— 用户的档案里写着另一个数，一秒钟就穿帮。
 * ② **没数据就说没数据**：没答完题、或基准还没加载好，返回 null，
 *    由调用方显示"先答完十题"——不编、不猜。
 * ③ **模板可以朴素，但不能错**：极端项取"离中位数最远"的那一维，
 *    这个判断是**对称**的（28% 和 72% 一样突出），不会只夸不评。
 */

import { buildReport, buildReportFromAttributes } from './results.js';
import { labelOf, QUESTIONS } from './surveySchema.js';

/** 触发条件：60 秒内 10 次 */
export const EGG_CLICKS = 10;
export const EGG_WINDOW_MS = 60 * 1000;

/** 固定台词（用户指定的原文） */
export const EGG_GREET =
  '检测到您与档案精灵互动过于频繁。作为奖励，我免费为您提供一次专属数据解读。';

/** 拿不到数据时的兜底句 */
export const EGG_NO_DATA = '先答完十题，我就能给你算出这一句 —— 手上没数据的时候我不编。';

/**
 * 生成趣评。
 *
 * @param {object}  opts
 * @param {Record<string,string>} [opts.answers]    问卷作答（答完才有）
 * @param {Record<string,number>} [opts.attributes] 账本属性（地图路线）
 * @param {{size:number,sorted:object}} opts.baseline 2000 人基准
 * @returns {{text:string, axis:string, axisLabel:string, value:number, answered:number|null}|null}
 */
export function buildEggQuip({ answers, attributes, baseline } = {}) {
  if (!baseline) return null;

  let report = null;
  let answered = null;

  // ── 两条来路，与报告页完全一致：要么有作答，要么有一本算好的账 ──
  const hasAnswers = answers && Object.keys(answers).length > 0;
  const hasAttrs = attributes && Object.values(attributes).some((v) => v !== 0);

  if (hasAnswers) {
    report = buildReport(answers, baseline);
    answered = QUESTIONS.filter((q) => answers[q.field]).length;
    if (!answered) return null; // 有 key 但没有一题真答了
  } else if (hasAttrs) {
    report = buildReportFromAttributes(attributes, baseline);
    answered = null;
  } else {
    return null;
  }

  // ── 最突出的一维：离中位数 50 最远。对称 —— 低分同样算"突出" ──
  let axis = null;
  let gap = -1;
  for (const [key, value] of Object.entries(report.percents)) {
    const g = Math.abs(value - 50);
    if (g > gap) {
      gap = g;
      axis = key;
    }
  }
  if (!axis) return null;

  const value = report.percents[axis];
  const axisLabel = labelOf(axis);
  const head = answered ? `你答的 ${answered} 题里` : '你这一本账里';

  return {
    axis,
    axisLabel,
    value,
    answered,
    text:
      `${head}，最突出的一项是「${axisLabel}」：你超过了 ${value}% 的基准人群。` +
      '需要我把这一条写进你的档案吗？',
  };
}
