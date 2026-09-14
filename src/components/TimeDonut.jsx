/**
 * 「时间去哪了」环形图。
 *
 * 五类的颜色取自 theme.js，与雷达图的轴色语义一致 ——
 * 「学习」永远是同一个蓝，读者不必在两图之间重新建立一次对应关系。
 *
 * 中心不放图例，放**占比最高的那一类**：这是唯一一个需要被一眼看到的信息，
 * 其余四类看扇区大小就够了。
 */

import { useMemo } from 'react';
import Chart from './Chart.jsx';
import { TIME_COLORS, INK, INK_SOFT, LINE, FONT } from '../lib/theme.js';

export default function TimeDonut({ data }) {
  const top = useMemo(() => [...data].sort((a, b) => b.value - a.value)[0], [data]);

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: (p) => `${p.name}　${p.percent}%`,
        textStyle: { fontFamily: FONT, fontSize: 12 },
      },
      legend: { show: false },
      series: [
        {
          type: 'pie',
          radius: ['54%', '80%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
          label: {
            color: INK_SOFT,
            fontSize: 12,
            fontFamily: FONT,
            lineHeight: 16,
            formatter: '{b}\n{d}%',
          },
          labelLine: { length: 8, length2: 8, lineStyle: { color: LINE } },
          data: data.map((d) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: TIME_COLORS[d.name] },
          })),
        },
      ],
    }),
    [data],
  );

  return (
    <div className="relative">
      <Chart
        option={option}
        height={300}
        ariaLabel={`时间分配环形图：${data.map((d) => `${d.name} ${d.value}%`).join('，')}`}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[11px] text-[var(--ink-soft)]">最多的时间给了</span>
        <span className="text-lg font-semibold leading-tight" style={{ color: INK }}>
          {top.name}
        </span>
        <span className="text-sm text-[var(--ink-soft)] tabular-nums">{top.value}%</span>
      </div>
    </div>
  );
}
