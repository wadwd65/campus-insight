/**
 * 地图引擎 —— 全纯函数，`npm run selftest:map` 直接断言。
 *
 * 为什么又抽纯函数（跟 hudModel.js 同一个理由）：
 *   "点了几次属性条涨得对不对" 在浏览器里没法可靠验证 —— 有过渡动画、有重渲染、
 *   点偏一次就白测。但"去第三次图书馆该给多少增量"是**算术**，必须能自动断言。
 *
 * 核心规则只有两条，其余都是它们的推论：
 *
 *   规则一（衰减）：同一地点第 n 次去，增量按 (1, 1/2, 1/3, …) 缩水，第三次之后归零。
 *     为什么要有它：没有衰减，最优解永远是"在图书馆点 20 次" ——
 *     游戏退化成刷数值，玩家的选择不再有信息量，而"选择有信息量"是这个项目的全部意义。
 *
 *   规则二（时段）：一天 4 个时段，每次行动消耗 cost 个，不够就不能去。
 *     为什么要有它：时段是稀缺资源。有稀缺才有取舍，
 *     有取舍才会出现"我这次没去操场，所以我这四年少了点运动"这种叙事。
 */

import { PLACES, PLACE_INDEX, SLOTS_PER_DAY } from '../data/mapPlaces.js';

/** 同一地点最多计 3 次增量；第 4 次起是 0（但行动本身仍然记轨迹）。 */
export const DECAY_LIMIT = 3;

/**
 * 第 n 次（从 1 开始）去某地点的衰减系数。
 * n=1 → 1，n=2 → 0.5，n=3 → 0.333…，n>3 → 0。
 * `n >= DECAY_LIMIT` 时取 0 而不是 1/n，是为了让"衰减到无意义"这件事有个明确的终点 ——
 * 否则第 8 次还涨 0.125，玩家会算出来"其实还能刷"，规格就模糊了。
 */
export function decayFactor(n) {
  if (n <= 0) return 0;
  if (n >= DECAY_LIMIT + 1) return 0;
  return 1 / n;
}

/**
 * 给定一批已发生的行动，算每个地点去过几次。
 * @param {Array<{id:string}>} trail 账本里的轨迹
 */
export function countVisits(trail) {
  const counts = Object.create(null);
  for (const t of trail ?? []) {
    if (t?.id) counts[t.id] = (counts[t.id] ?? 0) + 1;
  }
  return counts;
}

/**
 * 算某地点"这一次去"带来的实际增量。
 *
 * 返回值是**已取整**的整数：属性条画的是整数，如果内部保留小数、
 * 显示时取整，就会出现"点了三次但条第次都没动"（每次都涨 0.33，取整后都是 0）。
 * 取整规则是 Math.round，并对非零结果保底 ±1 —— 让"衰减后仍有效"这件事看得见。
 */
export function nextDelta(place, visits) {
  const n = (visits?.[place.id] ?? 0) + 1;
  const f = decayFactor(n);
  if (f === 0) return null;

  const out = {};
  for (const [k, v] of Object.entries(place.vec)) {
    const scaled = v * f;
    const rounded = Math.round(scaled);
    out[k] = rounded === 0 && v !== 0 ? Math.sign(v) : rounded;
  }
  return { key: place.id, text: place.name, vec: out, visit: n, factor: f };
}

/**
 * 算出当天还剩几个时段。
 *
 * 时段是**按"这一局"算的**，不是按真实日期 —— 项目没有后端，
 * 用真实日期会让"昨天点过的今天不能点"这种事变得不可复现（评委第二天打开就状态不对）。
 */
export function slotsLeft(trail) {
  let used = 0;
  for (const t of trail ?? []) {
    const p = t?.id ? PLACE_INDEX.get(t.id) : null;
    used += p?.cost ?? 0;
  }
  return Math.max(0, SLOTS_PER_DAY - used);
}

/**
 * 某地点现在能不能去。
 *
 * 返回 {ok, reason} 而不是布尔 —— 界面上要解释"为什么这个按钮是灰的"，
 * 只说 false 的话，玩家面对一个点不动的方块只能猜。
 */
export function canVisit(place, state) {
  const { visited = {}, slots = SLOTS_PER_DAY } = state ?? {};

  if (place.once && (visited[place.id] ?? 0) > 0) {
    return { ok: false, reason: '只会有一次' };
  }
  if ((visited[place.id] ?? 0) >= DECAY_LIMIT + 1) {
    return { ok: false, reason: '再去也没用了' };
  }
  if (place.cost > slots) {
    return { ok: false, reason: '时段不够' };
  }
  return { ok: true, reason: '' };
}

/**
 * 把整张地图归纳成一个可渲染的状态表 —— 界面只读这个，不自己算规则。
 * 这是 hudModel.js 的同一个模式：规则在纯函数里，组件只负责画。
 */
export function mapModel(trail) {
  const visited = countVisits(trail);
  const slots = slotsLeft(trail);
  const anyLeft = slots > 0;

  const items = PLACES.map((p) => {
    const { ok, reason } = canVisit(p, { visited, slots });
    const times = visited[p.id] ?? 0;
    return {
      ...p,
      times,
      // 去过但衰减到头 → 标成 exhausted，与"没去过"区分开：
      // 两者都不能点，但意思完全不同（一个是"没去过"，一个是"去过了")
      exhausted: times >= DECAY_LIMIT + 1,
      enabled: ok,
      reason: anyLeft ? reason : times > 0 || p.once ? reason : '今天的时段用完了',
    };
  });

  return {
    items,
    slots,
    slotsPerDay: SLOTS_PER_DAY,
    visited,
    totalTrips: Object.values(visited).reduce((a, b) => a + b, 0),
    started: Object.keys(visited).length > 0,
    anyLeft,
  };
}

/** 轨迹 → 时间轴文案（按发生顺序）。 */
export function timeline(trail) {
  return (trail ?? [])
    .map((t) => {
      const p = t?.id ? PLACE_INDEX.get(t.id) : null;
      return p ? { id: p.id, name: p.name, zone: p.zone, line: p.line } : null;
    })
    .filter(Boolean);
}
