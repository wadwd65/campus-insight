/**
 * 图表配色与通用常量。
 *
 * 为什么单独一个文件：雷达图的五轴、环形图的五类、四年曲线的线，用的是**同一套语义色** ——
 * 「学习」永远是同一个蓝，「社交」永远是同一个珊瑚。
 * 如果每个组件各自挑色，同一个概念在不同图上会变成不同颜色，
 * 读者得在每张图前重新建立一次对应关系。
 */

/** 五个类别的主色，供环形图 / 曲线 / 图例共用。 */
export const PALETTE = {
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

/** 雷达图五轴 → 颜色（与时间分配共用同一套语义） */
export const AXIS_COLORS = {
  学术力: PALETTE.study,
  社交力: PALETTE.social,
  运动力: PALETTE.sleep,
  美食力: PALETTE.food,
  佛系指数: PALETTE.fun,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';

/** 雷达图 / 折线图等的统一文字样式 */
export const AXIS_LABEL_STYLE = { color: INK_SOFT, fontSize: 12, fontFamily: FONT };
