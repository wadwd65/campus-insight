import { useMemo } from 'react';
import Chart from './Chart.jsx';
import { BRAND, INK, FONT, AXIS_LABEL_STYLE } from '../lib/theme.js';

export default function MoodCurve({ data }) {
  const option = useMemo(
    () => ({
      grid: { left: 18, right: 24, top: 28, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        formatter: (ps) => `${ps[0].axisValue}　${Math.round(ps[0].value)}`,
        textStyle: { fontFamily: FONT, fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.stage),
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#c9c2e6' } },
        axisTick: { show: false },
        axisLabel: AXIS_LABEL_STYLE,
      },
      yAxis: {
        type: 'value',
        min: 30,
        max: 95,
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: '#ddd8ee', type: 'dashed' } },
      },
      series: [
        {
          type: 'line',
          smooth: 0.4,
          symbolSize: 9,
          data: data.map((d) => d.value),
          lineStyle: { width: 3, color: BRAND },
          itemStyle: { color: BRAND, borderColor: '#ffffff', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(21,107,122,0.26)' },
                { offset: 0.6, color: 'rgba(21,107,122,0.08)' },
                { offset: 1, color: 'rgba(21,107,122,0.02)' },
              ],
            },
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            ...AXIS_LABEL_STYLE,
            color: INK,
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
