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
        symbolSize: 5,
        lineStyle: { width: 2, color: BRAND },
        itemStyle: { color: BRAND },
        // 有对比序列时不再填色：两条半透明色块叠在一起会互相盖住，
        // 读图的人分不清哪块是哪个
        areaStyle: compare ? undefined : { color: 'rgba(79,70,229,0.16)' },
        emphasis: { lineStyle: { width: 3 } },
        data: [{ value: data.map((d) => d.value), name }],
      },
    ];

    if (compare) {
      series.push({
        type: 'radar',
        symbolSize: 0,
        silent: true,
        lineStyle: { width: 1, type: 'dashed', color: INK_SOFT },
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
        radius: '64%',
        center: ['50%', compare ? '48%' : '52%'],
        axisName: AXIS_LABEL_STYLE,
        splitLine: { lineStyle: { color: LINE } },
        axisLine: { lineStyle: { color: LINE } },
        splitArea: { show: false },
      },
      series,
    };
  }, [data, compare, name]);

  const label = `大学生活者画像雷达图：${data.map((d) => `${d.axis} ${d.value}`).join('，')}`;

  return <Chart option={option} height={320} ariaLabel={label} />;
}
