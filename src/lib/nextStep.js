/**
 * 报告的最后一步：给一条能马上做的事。
 *
 * 为什么要有这个文件而不是把文案写进组件：
 *   1. 文案要按「最低的那一维」分支，和雷达图的键同源（RADAR_KEYS）；
 *   2. 以后要改措辞，只改这一处，不用碰组件。
 *
 * 设计约束：
 *   - 只给一条，不给清单。十条建议等于没有建议。
 *   - 只给「两天内能做完」的动作，不给「你要多社交」这种空话。
 *   - 不承诺效果，不评价好坏：这是自述问卷推出来的倾向，不是诊断。
 *
 * 记录者：3号（WorkBuddy）｜2026-11-04
 */

import { RADAR_KEYS, RADAR_AXIS_NAME } from './results.js';

/** 每个维度对应的「最小一步」。键必须和 RADAR_KEYS 一致。 */
const ACTIONS = {
  academic: '挑一门最没把握的课，这周找老师问一个问题——哪怕只是「这章考不考」。',
  social: '这周主动约一个人吃饭或自习，不用等对方先开口；约到了就算完成。',
  sport: '把一次通勤改成走路 20 分钟，先做三天，不办卡、不买装备。',
  food: '给自己安排一顿不看手机的饭，二十分钟就够；吃完再决定要不要加餐。',
  buddhist: '在这周的日程里先占住半天，什么都不安排；写进日历，别只在心里想。',
};

/**
 * @param {Record<string, number>} percents 五维百分位，形如 {academic: 62, social: 22, ...}
 * @returns {{axis:string,label:string,value:number,text:string}|null}
 */
export function nextStepOf(percents) {
  if (!percents || typeof percents !== 'object') return null;
  let weakest = null;
  for (const key of RADAR_KEYS) {
    const value = Number(percents[key]);
    if (!Number.isFinite(value)) continue;
    if (!weakest || value < weakest.value) weakest = { key, value };
  }
  if (!weakest) return null;
  return {
    axis: weakest.key,
    label: RADAR_AXIS_NAME[weakest.key] ?? weakest.key,
    value: Math.round(weakest.value),
    text: ACTIONS[weakest.key] ?? ACTIONS.academic,
  };
}
