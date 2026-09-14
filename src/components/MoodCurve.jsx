/**
 * 四年心情曲线。
 *
 * 曲线本身是折线图，但**真正讲故事的是每个节点下面那句话** ——
 * 「大二 · 社交半径达到四年最大，谁过生日你都在场」。
 * 所以台词用 HTML 排在下方，而不是塞进 ECharts 的 label：
 * 图表里放不下这么长的句子，硬塞会挤成一团。
 *
 * 纵轴刻意不显示刻度。它测的不是一个真实存在的量表，
 * 显示「72 分」会让人以为那是某种权威分数 —— 它只是一条相对起伏的线。
 */

import { useMemo } from 'react';
import Chart from './Chart.jsx';
import { BRAND, INK, INK_SOFT, LINE, FONT } from '../lib/theme.js';

export default function MoodCurve({ data }) {
  const option = useMemo(
    () => ({
      grid: { left: 10, right: 24, top: 28, bottom: 6, containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (ps) => `${ps[0].axisValue}　${Math.round(ps[0].value)}`,
        textStyle: { fontFamily: FONT, fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.stage),
        boundaryGap: false,
        axisLine: { lineStyle: { color: LINE } },
        axisTick: { show: false },
        axisLabel: { color: INK_SOFT, fontSize: 12, fontFamily: FONT },
      },
      yAxis: {
        type: 'value',
        min: 30,
        max: 95,
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: LINE, type: 'dashed' } },
      },
      series: [
        {
          type: 'line',
          smooth: 0.4,
          symbolSize: 9,
          data: data.map((d) => d.value),
          lineStyle: { width: 3, color: BRAND },
          itemStyle: { color: BRAND, borderColor: '#ffffff', borderWidth: 2 },
          areaStyle: { color: 'rgba(79,70,229,0.10)' },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            color: INK,
            fontSize: 12,
            fontFamily: FONT,
          },
        },
      ],
    }),
    [data],
  );

  return (
    <div>
      <Chart
        option={option}
        height={200}
        ariaLabel={`四年心情曲线：${data.map((d) => `${d.stage} ${d.value}`).join('，')}`}
      />
      <ul className="mt-3 space-y-2">
        {data.map((d) => (
          <li key={d.stage} className="flex gap-3 text-sm leading-6">
            <span className="shrink-0 w-9 text-[var(--ink-soft)]">{d.stage}</span>
            <span className="text-[var(--ink)]">{d.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
