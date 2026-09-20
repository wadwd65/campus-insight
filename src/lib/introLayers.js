/**
 * 入场动画的分层数据 —— 纯函数，没有 React、没有 DOM。
 *
 * 为什么要**单独抽出来**，而不是写在 IntroScene.jsx 里：
 * 入场动画是"一堆随机位置的装饰元素"，看起来没什么可测的。但只要它是随机就有两条
 * 必须守住的底线，而这两条恰恰是最容易在改版时被破坏、又最难靠肉眼发现的：
 *
 *   1. **确定性**。用 Math.random() 的话，同一屏重渲染一次光点就"跳位"——
 *      首屏尤其致命，因为浏览器在任何一次 re-render（比如字体加载完、窗口 resize）
 *      就会让整片星点瞬移。这里用基于下标的确定性伪随机，位置永远一样。
 *   2. **分层边界**。参考站的做法是"四层各走各的速度"，层与层之间**必须**有可辨的
 *      速度差，否则视差读不出来（四层一样快 = 一层）。而且层内元素要**散开**，
 *      不能全挤在一处 —— 这两件事都是纯数值判断，正好适合断言。
 *
 * 抽成纯函数之后，这两条就能被 scripts/selftest-intro.mjs 直接钉住；
 * 留在组件里的话，SSR 只渲染出空态，什么也验不了（zustand 的前车之鉴）。
 */

/**
 * 确定性伪随机：同样的小数种子永远得到同一个 [0, 1) 值。
 *
 * 用 sin 的大数取小数部分是图形学里的老把戏 —— 便宜、无依赖、
 * 且相邻种子之间足够"散"。它不是密码学随机，这里也完全不需要。
 */
export function prand(i, k) {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * 视差层。数值都是"相对速度"，不是绝对时长 ——
 * 具体放慢到几秒由各层自己决定，这里只定义层序与相对关系。
 *
 * depth 的含义：0 = 最远（动得最慢、最暗、最小），越大 = 越近。
 * scale / drift 都从 depth 推出来，保证"近的动得快"这条视觉规律不被写反。
 */
export const PARALLAX_LAYERS = [
  { id: 'far', depth: 0, label: '远景雾团', scale: 1.18, drift: 26, opacity: 0.5 },
  { id: 'mid', depth: 1, label: '中景剪影', scale: 1.1, drift: 46, opacity: 0.34 },
  { id: 'near', depth: 2, label: '近景光带', scale: 1.04, drift: 74, opacity: 0.22 },
];

/** 推镜参数：开场到结束的缓慢放大 + 轻微上移（参考站整段都在推，没有一刻是静的）。 */
export const PUSH = {
  fromScale: 1.0,
  toScale: 1.08,
  fromY: 0,
  toY: -2.2, // 百分比
  durationMs: 26000,
};

/**
 * 垂直光带（参考站前景里最显眼的特征：一排竖直细线）。
 *
 * 不画成"雨"：雨是斜的、有落差感的；这里要的是**静止的光柱在缓慢明灭**，
 * 与整体"慢 → 静 → 出现按钮"的节奏一致。所以只有位置的散开 + 极慢的亮度呼吸。
 *
 * 2026-09-16 调过一轮：第一版太粗太亮，读起来像一排栅栏，还压住了标题。
 * 位置元素**数量不能减**（数量决定"满屏氛围"的感觉），要减的是**每一条的权重**：
 * 宽度 0.5~1.4px（原来是 0.6~2.2），亮度 0.03~0.11（原来是 0.04~0.16）。
 * 并且让一部分光带只占屏幕的一小段高度 —— 长度一致会强化"栅栏感"。
 */
export function buildLightShafts(n) {
  return Array.from({ length: n }, (_, i) => {
    const width = 0.5 + prand(i, 11) * 0.9; // 0.5 ~ 1.4 px
    // 短的多、长的少：长光带只留少数几条，视野才不会被切成竖条
    const long = prand(i, 13) > 0.68;
    return {
      key: i,
      left: `${(prand(i, 12) * 100).toFixed(2)}%`,
      width: `${width.toFixed(2)}px`,
      height: `${(long ? 40 + prand(i, 18) * 40 : 12 + prand(i, 13) * 26).toFixed(1)}%`,
      top: `${(prand(i, 14) * 52).toFixed(2)}%`,
      // 亮度压低到 0.03~0.11：它铺满全屏，稍亮一点就会糊住标题
      opacity: Number((0.03 + prand(i, 15) * 0.08).toFixed(3)),
      duration: `${(9 + prand(i, 16) * 13).toFixed(1)}s`,
      delay: `${(prand(i, 17) * 13).toFixed(1)}s`,
    };
  });
}

/**
 * 远景剪影。参考站中景是破碎拱门/建筑，我们没有那种素材，
 * 也不该去扒（版权），所以用**几何剪影**：几块不同高低的深色多边形，
 * 铺在最底层做"地平线之外还有东西"的暗示。自创图形，零素材依赖。
 */
export function buildRidges(n) {
  return Array.from({ length: n }, (_, i) => ({
    key: i,
    // 沿水平方向均匀铺开，再各自偏移一点，避免看出等距
    left: `${(i * (100 / n) - 6 + prand(i, 21) * 12).toFixed(2)}%`,
    width: `${(14 + prand(i, 22) * 22).toFixed(2)}%`,
    height: `${(10 + prand(i, 23) * 26).toFixed(2)}%`,
    skew: `${(prand(i, 24) * 16 - 8).toFixed(1)}deg`,
    opacity: Number((0.16 + prand(i, 25) * 0.26).toFixed(3)),
  }));
}

/**
 * 光点（沿用原来的 buildDots，但那套只做"上升"）。
 *
 * 这里给它加两个维度，是为了让粒子真正成"层"而不是"一片"：
 *   - depth 决定大小与快慢：远处小而慢、近处大而快
 *   - 每个点带一点水平漂移，纯垂直运动看起来像雨，加点横向才像悬浮
 */
export function buildDots(n) {
  return Array.from({ length: n }, (_, i) => {
    const depth = Math.floor(prand(i, 31) * 3); // 0 / 1 / 2
    const base = 0.8 + depth * 0.7;
    // 深度的步进必须**压过**层内的随机抖动，否则"近处更快"只是平均意义上的巧合，
    // 单独看十个点就有一半是反的，视差读不出来。
    // 所以：层内抖动 1.4s（±0.7），深度步进 3.2s（超过抖动的两倍）。
    return {
      key: i,
      depth,
      left: `${(prand(i, 1) * 100).toFixed(2)}%`,
      bottom: `${(prand(i, 2) * 58).toFixed(2)}%`,
      size: Number((base + prand(i, 3) * 1.4).toFixed(2)),
    // 近处的点飘得更快 —— 与 PARALLAX_LAYERS 的规律保持一致。
    // 注意方向：**duration 更小 = 更快**，所以近处（depth 大）要减、不是加。
    // 第一版这里写成了 `+ depth * 3.2`，把"近处更快"写反成了"近处更慢"，
    // 肉眼看画面只是"有点不对"，是自检把它抓出来的。
    duration: `${(10.6 - depth * 3.2 + prand(i, 4) * 1.4).toFixed(1)}s`,
      delay: `${(prand(i, 5) * 9).toFixed(1)}s`,
      sway: `${(prand(i, 6) * 46 - 23).toFixed(1)}px`,
      opacity: Number((0.28 + depth * 0.16 + prand(i, 7) * 0.22).toFixed(3)),
    };
  });
}

/** 由设备能力决定"每个装饰层放多少元素"。SSR 下给保守值。 */
export function pickLayerBudget() {
  if (typeof navigator === 'undefined') return { dots: 24, shafts: 10, ridges: 6 };
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = typeof window !== 'undefined' && window.innerWidth < 768;

  let dots = 46;
  let shafts = 22;
  let ridges = 8;
  if (cores <= 4 || mem <= 4) {
    dots = 24;
    shafts = 12;
    ridges = 6;
  }
  if (small) {
    dots = Math.min(dots, 18);
    shafts = Math.min(shafts, 9);
    ridges = Math.min(ridges, 5);
  }
  return { dots, shafts, ridges };
}

/**
 * 各层元素的"入场时刻"：参考站的顺序是**由远及近**——
 * 先看见远处的雾，再看见建筑，最后光带亮起，粒子一直在。
 * 这个顺序不是随意定的：先给环境、后给主体，视线才会自然落到中心。
 *
 * 返回毫秒延迟，供 CSS animation-delay 使用。
 */
export const LAYER_REVEAL = {
  sky: 0,
  ridge: 220,
  dots: 380,
  shaft: 620,
  crest: 900,
  rule: 1180,
  title: 1360,
  subtitle: 1560,
  meta: 1760,
  cta: 2100,
};
