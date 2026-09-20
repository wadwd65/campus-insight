/**
 * 图表配色与通用常量。
 *
 * 为什么单独一个文件：雷达图的五轴、环形图的五类、四年曲线的线，用的是**同一套语义色** ——
 * 「学习」永远是同一个蓝，「社交」永远是同一个珊瑚。
 * 如果每个组件各自挑色，同一个概念在不同图上会变成不同颜色，
 * 读者得在每张图前重新建立一次对应关系。
 */

/** 五个类别的主色，供环形图 / 曲线 / 图例共用。不外传 —— 对外只暴露语义化的 TIME_COLORS。 */
const PALETTE = {
  study: '#378ADD',
  fun: '#7F77DD',
  social: '#D85A30',
  food: '#BA7517',
  sleep: '#1D9E75',
};

/**
 * 品牌主色。
 * 与 src/index.css 里的 `--brand` 是同一个值 —— ECharts 读不到 CSS 变量，
 * 只能在这边重复一次。改色时两处一起改（已在 index.css 里注明）。
 */
export const BRAND = '#4F46E5';

export const INK = '#1f2937';
export const INK_SOFT = '#6b7280';
export const LINE = '#e5e7eb';

/** 「时间去哪了」五类 → 颜色 */
export const TIME_COLORS = {
  学习: PALETTE.study,
  娱乐: PALETTE.fun,
  社交: PALETTE.social,
  干饭: PALETTE.food,
  睡觉: PALETTE.sleep,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';

/**
 * 图表坐标轴 / 图例 / 标注的统一文字样式。
 *
 * 这几个属性在 RadarChart、MoodCurve、CohortPage 里原本各写了一遍
 * （`{ color: INK_SOFT, fontSize: 12, fontFamily: FONT }` 共出现 6 次）。
 * 抽成常量不只是省字：**改字号或颜色时只需要动这里一处**，
 * 否则会出现「雷达图 12px、曲线图 14px」这种肉眼能看出、但代码里找不到的错位。
 */
export const AXIS_LABEL_STYLE = { color: INK_SOFT, fontSize: 12, fontFamily: FONT };
