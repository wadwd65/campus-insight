/**
 * 雷达图 —— 大学生活者画像，五轴。
 *
 * 数值是百分位，所以轴上不需要任何说明：「学术力 82」自己就说明了
 * 「你超过了 82% 的大学生」。这是把归一化选成分位数换来的好处 ——
 * 换成 min-max，这里就得再配一段图例去解释分数的含义。
 */

import { useMemo } from 'react';
import Chart from './Chart.jsx';
import { BRAND, INK_SOFT, LINE, FONT } from '../lib/theme.js';

export default function RadarChart({ data }) {
  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: (params) => `${params.name}：超过 ${params.value}% 的大学生`,
        textStyle: { fontFamily: FONT, fontSize: 12 },
      },
      radar: {
        indicator: data.map((d) => ({ name: d.axis, max: 100 })),
        radius: '66%',
        center: ['50%', '52%'],
        axisName: { color: INK_SOFT, fontSize: 12, fontFamily: FONT },
        splitLine: { lineStyle: { color: LINE } },
        axisLine: { lineStyle: { color: LINE } },
        splitArea: { show: false },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 5,
          lineStyle: { width: 2, color: BRAND },
          itemStyle: { color: BRAND },
          areaStyle: { color: 'rgba(79,70,229,0.16)' },
          emphasis: { lineStyle: { width: 3 } },
          data: [{ value: data.map((d) => d.value), name: '你的画像' }],
        },
      ],
    }),
    [data],
  );

  const label = `大学生活者画像雷达图：${data.map((d) => `${d.axis} ${d.value}`).join('，')}`;

  return <Chart option={option} height={320} ariaLabel={label} />;
}
