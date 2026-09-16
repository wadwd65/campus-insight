/**
 * V3 场景机 —— 全站只有这一处决定「现在在哪个场景」。
 *
 * 为什么引入它，而不是像 V1 那样在 App 里用 useState：
 * V3 要把「入场 → 主站 → 行动地图 → 档案」串成一条线，而**行动过程会持续改玩家状态**
 * （属性、剧情标记、行动轨迹）。这些状态要被地图、HUD、档案页同时读，
 * 靠 props 一层层传会很快失控。这是 zustand 唯一被引入来解决的问题。
 *
 * 边界：这里只放「跨场景共享」的东西。单个页面内部的临时状态（上传进度、动画开关等）
 * 继续留在组件里 —— 什么状态都往全局搬，等于把 props 的问题换成"谁都能改"的问题。
 */

import { create } from 'zustand';
import { BASE_ATTR_KEYS } from '../lib/surveySchema.js';

/**
 * 空属性表。键名**从契约取**（`matrix.json` 的 attributes），不在这里硬编码 ——
 * 矩阵将来扩选项、改维度，这里跟着变，不会留下一个悄悄对不上的副本。
 */
function emptyAttributes() {
  return Object.fromEntries(BASE_ATTR_KEYS.map((k) => [k, 0]));
}

function emptyPlayer() {
  return { name: '', attributes: emptyAttributes(), flags: [], trail: [] };
}

export const useGameStore = create((set) => ({
  /** 场景：intro（入场动画）｜hub（主站，内含 V1 的四页流程） */
  scene: 'intro',

  /** 是否已看过入场（同一会话内不重复播） */
  introSeen: false,

  /** 玩家档案：V3 行动过程写入，档案页读取 */
  player: emptyPlayer(),

  enter: () => set({ scene: 'hub', introSeen: true }),
  backToIntro: () => set({ scene: 'intro' }),

  setName: (name) => set((s) => ({ player: { ...s.player, name } })),

  /**
   * 行动一次：累加属性 + 记一条轨迹。
   *
   * 地图上的每个选择、以及 V1 问卷的每一题，都走这一个入口 ——
   * 两条路进同一本账，档案页才不需要关心"这次的数据是从哪来的"。
   *
   * ⚠️ 这里**不夹紧到 0**。映射矩阵的增量本身带负数：
   * 「宿舍床上」给的是 academic −1 / social −1 / sport −1 / night +1 …
   * 一旦夹到 0，八个维度就退化成"只增不减的计数器" ——
   * 答「宿舍床上」和答「图书馆自习室」在账上几乎没差别，整条映射链的语义就废了。
   * 负值在**累加阶段**是有意义的；要换算成 0~100 的刻度，是展示阶段的事。
   */
  applyChoice: ({ id, label, delta, at }) =>
    set((s) => {
      const attributes = { ...s.player.attributes };
      for (const [k, v] of Object.entries(delta || {})) {
        if (k in attributes) attributes[k] += v;
      }

      // 轨迹按"有标签就算一次行动"来记，不强依赖时间戳：
      // 问卷那条路没有"第几秒点了哪个地点"的概念，但它同样是一次行动 ——
      // 之前写成"没有 at 就不记"，结果是答完 6 题轨迹为 0（由 selftest:store 抓到）。
      const trail = label
        ? [...s.player.trail, { id: id ?? null, label, at: at ?? null }]
        : s.player.trail;

      return {
        player: {
          ...s.player,
          attributes,
          flags: id ? [...s.player.flags, id] : s.player.flags,
          trail,
        },
      };
    }),

  resetPlayer: () => set({ player: emptyPlayer() }),
}));
