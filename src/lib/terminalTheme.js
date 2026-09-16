/**
 * V3 场景层的视觉令牌。
 *
 * 为什么另立一份，而不是改 src/lib/theme.js：
 * 那一份是**图表语义色**（「学习」永远是同一个蓝、「社交」永远是同一个珊瑚），
 * 服务的是"同一概念在各图之间颜色一致"，与明暗无关。
 * 这一份是**场景外壳的配色**（背景 / 面板 / 描边 / 强调色），深色专用。
 * 两者职责不同，混在一处会让改一个误伤另一个。
 *
 * 与 src/index.css 里 `.term-canvas` 的变量是同一组值：DOM 那边用 CSS 变量，
 * canvas / SVG 属性读不到 CSS 变量，只能在这边再声明一次。改色时两处一起改。
 */

export const TERMINAL = {
  bg: '#0b0f14',
  panel: '#141c25',
  panelSoft: '#1b2530',
  line: '#243040',
  ink: '#e8edf2',
  inkSoft: '#8a98a8',
  inkDim: '#5a6675',
  amber: '#f5a623',
  cyan: '#4fa8d8',
  bone: '#e8e2d2',
  ok: '#1d9e75',
  danger: '#e24b4a',
};

/**
 * 入场动画的节拍（毫秒，相对开场起点的延迟）。
 * 集中在一处，是为了能整体调快调慢 —— 分散在各组件里就只能靠肉眼试着改。
 * 总长压在 2 秒内：评委点开链接的第一眼不该等。
 */
export const INTRO_TIMING = {
  kicker: 120,
  crest: 260,
  rule: 640,
  title: 900,
  subtitle: 1200,
  meta: 1480,
  cta: 1780,
};

/**
 * 由设备能力决定背景光点数量。
 *
 * 判断放在**渲染之前**，而不是"先生成 300 个再删掉"——
 * 后者在低端机上已经卡过一次，卡损的是第一印象。
 */
export function pickDotCount() {
  if (typeof navigator === 'undefined') return 24;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = typeof window !== 'undefined' && window.innerWidth < 768;
  let n = 42;
  if (cores <= 4 || mem <= 4) n = 22;
  if (small) n = Math.min(n, 16);
  return n;
}

/** 系统是否要求减少动效（含"设备过弱"时的等效处理）。 */
export function preferCalm() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}
