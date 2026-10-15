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
  // ★ 10-14 三改（参考《众生行记》）：五个类别色从"蓝 + 紫 + 三个暖绿"改成
  //   **蓝紫家族主导 + 三个点缀**。原来 study 是蓝(#378ADD)、fun 是紫(#7F77DD)，
  //   两个冷色挤在一起还不统一；现在 study 走深紫、fun 走亮紫，
  //   同色系两个深浅，"学习/娱乐"在图上仍分得清，但整张图有了主色。
  //   社交（珊瑚）/ 干饭（琥珀）/ 睡觉（青）保持暖与青的对比 ——
  //   全紫会分不出类，必须留三个异色。
  study: '#0B5A6B',
  fun: '#2E8FA3',
  social: '#D85A30',
  food: '#C98A1B',
  sleep: '#0E7490',
};

/**
 * 品牌主色 —— **浅色内容区**用的那一个（按钮底、进度条、突出数字）。
 * 与 src/index.css 里的 `--brand` 是同一个值 —— ECharts 读不到 CSS 变量，
 * 只能在这边重复一次。改色时两处一起改（已在 index.css 里注明）。
 *
 * ★ 10-14：原值是 #4F46E5（Tailwind 默认 indigo-600）。换掉的两个理由：
 *   1. 它不在本作品的色板上（深蓝黑 / 青 / 琥珀 / 米），靛紫是"另一个网站"的颜色；
 *   2. 它拿去画深色外壳上的文字时只有 3.06，读不清 —— 见下面 BRAND_ON_DARK。
 *   10-14 二次改：参考《明日方舟》SideStory「众生行记」—— 那个活动的界面主色是
 *   **通透的蓝紫**（科技神学：数学逻辑 × 宗教仪式感，刻意避开深色与黑）。
 *   新值 #156B7A：on #f8fafc = 6.09 ✓、白字在其上 = 6.37 ✓。
 */
export const BRAND = '#156B7A';

/**
 * 品牌色在**深色外壳**上的版本。
 *
 * 为什么不能跟 BRAND 用同一个：同一个色值不可能同时适合两种底色 ——
 * 蓝紫 #156B7A 画在 #0A0F16 上只有 3.02，同样不够 ——
 * 而浅底可读的色在深底必然偏暗。这里用亮版 #46A9B8（5.66 ✓）。
 */
export const BRAND_ON_DARK = '#46A9B8';

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
