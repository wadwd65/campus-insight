/**
 * HUD 的显示模型 —— 纯函数。
 *
 * 为什么从组件里抽出来：显示规则（哪边是正、归一化分母取多少、最强最弱是谁）是**判定逻辑**，
 * 判定逻辑必须能被自动断言。
 *
 * 这件事上踩过一次：最初把规则写在 HubHud 里，想用服务端渲染去断言"有数据时的 HUD 长什么样"，
 * 结果永远失败 —— 因为 zustand 在 SSR 时会刻意返回**初始状态**（避免 hydration 前后不一致），
 * 组件根本读不到测试预置的数据。于是"有数据的样子"只剩一条验证途径：肉眼看截图。
 * 而这恰恰是这个项目一直在避免的验证方式（见 scripts/smoke-render.jsx 顶部）。
 *
 * 把规则搬到纯函数里之后，同一件事可以用确定性断言锁住，不需要浏览器。
 */

import { ATTRIBUTES } from './surveySchema.js';

/** 双向条的**单侧**最大高度（像素）。上下各一份，中间是零线。 */
export const HUD_HALF = 13;

/**
 * 把账本里的属性值整理成 HUD 需要的形状。
 *
 * 归一化分母取"当前绝对值最大的那一项"，不用固定上限：
 * 答题阶段的增量是个位数，地图阶段会大得多，固定上限会让早期数据全塌成一条线。
 */
export function summarizeAttributes(attributes) {
  const rows = ATTRIBUTES.map((a) => ({
    key: a.key,
    label: a.label,
    // HUD 的柱子只有 14px 宽，标签只能是**一个字**：
    // 「学术 社交 运动 美食 夜猫 计划 尝鲜 抗压」→「学 社 运 美 夜 计 尝 抗」，猜得出来。
    // 两个字的名字（shortLabelOf）给地图的增益标签用，那边空间够。
    short: a.label.slice(0, 1),
    value: attributes?.[a.key] ?? 0,
  }));

  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  // 用绝对值之和判断"有没有数据"：一正一负相抵会得到 0，但账本显然是启用了的
  const started = rows.some((r) => r.value !== 0);

  const scaled = rows.map((r) => ({
    ...r,
    height: Math.round((Math.abs(r.value) / peak) * HUD_HALF),
    positive: r.value >= 0,
  }));

  /**
   * 最强 / 最弱只在**真正有取值**的项里选。
   *
   * 这件事上踩过一次：原来是在全部 8 项里取最大最小，于是只去过图书馆（学术 +4）时，
   * 摘要显示「↓ 夜猫程度 0」—— 说"你最弱的是夜猫程度，0"没有任何信息量，
   * 而且把"没被任何行动影响过"和"被负向影响过"混为一谈（两者含义完全不同）。
   * 修法：先过滤掉 0，再选极值；一项都没动过时返回 null（空态已在 started 里处理）。
   */
  const touched = scaled.filter((r) => r.value !== 0);

  return {
    rows: scaled,
    peak,
    started,
    touchedCount: touched.length,
    top: touched.length ? touched.reduce((a, b) => (b.value > a.value ? b : a)) : null,
    bottom: touched.length ? touched.reduce((a, b) => (b.value < a.value ? b : a)) : null,
  };
}

/** 带符号显示：正数补 + ；零与负数原样。 */
export function signed(v) {
  return v > 0 ? `+${v}` : `${v}`;
}
