/**
 * 雷达图 —— 大学生活者画像，五轴。
 *
 * 数值是百分位，所以轴上不需要任何说明：「学术力 82」自己就说明了
 * 「你超过了 82% 的大学生」。这是把归一化选成分位数换来的好处 ——
 * 换成 min-max，这里就得再配一段图例去解释分数的含义。
 *
 * 两个入口共用这个组件，只差一个 `compare`：
 *   快入口       —— 一条线（"你的画像"），锚点是人本身
 *   真入口       —— 两条线，第二条是 50 分位基准圈，用来回答"这个班偏不偏"
 *
 * `compare` 是可选参数而不是分成两个组件：一旦拆开，两边会各自演化，
 * 迟早出现"快入口的轴标签改了、真入口没改"这种肉眼很难发现的不一致。
 */

import { useMemo } from 'react';
import Chart from './Chart.jsx';
import { BRAND, INK_SOFT, LINE, FONT, AXIS_LABEL_STYLE } from '../lib/theme.js';

export default function RadarChart({ data, compare = null, name = '你的画像' }) {
  const option = useMemo(() => {
    const series = [
      {
        type: 'radar',
        symbolSize: 6,
        // ★ 10-14 v2（参考《众生行记》）：
        //   ① 线宽 2 → 2.5，描边也要在截图里活下来
        //   ② 面积从一层死板的纯色改成**径向渐变**：中心 0.22 → 边缘 0.04。
        //      纯色面积是"一块塑料"，渐变面积是"一团光" ——
        //      这正是那个活动"通透的蓝紫"的意思。
        //   ③ 填色值从 rgba(79,70,229,...)（旧 indigo）换成蓝紫 #156b7a 的 rgb 分量
        lineStyle: { width: 2.5, color: BRAND },
        itemStyle: { color: BRAND, borderColor: '#ffffff', borderWidth: 1.5 },
        // 有对比序列时仍然填色，但改成很淡的渐变：
        // 两条叠在一起时分得清（一条实线一团光 vs 一条虚线），
        // 而且班级页那条"基准圈"在淡面积上仍然读得出来
        areaStyle: {
          color: {
            type: 'radial',
            x: 0.5, y: 0.5, r: 0.62,
            colorStops: [
              { offset: 0, color: 'rgba(21,107,122,0.24)' },
              { offset: 0.55, color: 'rgba(21,107,122,0.14)' },
              { offset: 1, color: 'rgba(21,107,122,0.05)' },
            ],
          },
        },
        emphasis: { lineStyle: { width: 3 }, areaStyle: { opacity: 0.95 } },
        data: [{ value: data.map((d) => d.value), name }],
      },
    ];

    if (compare) {
      series.push({
        type: 'radar',
        symbolSize: 0,
        silent: true,
        lineStyle: { width: 1.5, type: 'dashed', color: INK_SOFT },
        data: [{ value: data.map(() => compare.value), name: compare.name }],
      });
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) =>
          compare && params.seriesName === compare.name
            ? `${params.name}：${compare.name}`
            : `${params.name}：超过 ${params.value}% 的大学生`,
        textStyle: { fontFamily: FONT, fontSize: 12 },
      },
      legend: compare
        ? {
            bottom: 0,
            itemWidth: 12,
            itemHeight: 8,
            textStyle: AXIS_LABEL_STYLE,
          }
        : undefined,
      radar: {
        indicator: data.map((d) => ({ name: d.axis, max: 100 })),
        radius: '70%',
        center: ['50%', compare ? '48%' : '52%'],
        axisName: AXIS_LABEL_STYLE,
        // ★ v2：网格线从 #e5e7eb 加深到带紫调的 #d9d4ec，并在奇数圈铺极淡的底 ——
        // 一圈淡一圈白，雷达的"格"才数得出来（原来全是白的，格等于不存在）
        splitLine: { lineStyle: { color: '#d9d4ec' } },
        axisLine: { lineStyle: { color: '#c9c2e6' } },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['rgba(21,107,122,0.035)', 'rgba(21,107,122,0)'],
          },
        },
      },
      series,
    };
  }, [data, compare, name]);

  const label = `大学生活者画像雷达图：${data.map((d) => `${d.axis} ${d.value}`).join('，')}`;

  return <Chart option={option} height={320} ariaLabel={label} />;
}
