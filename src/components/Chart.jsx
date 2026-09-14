/**
 * ECharts 容器 —— 界面层与图表库之间唯一的一处接触。
 *
 * 两个设计点：
 *   1. **按需注册**，不 import 整个 echarts。只装了雷达 / 饼 / 折线 + 提示框与网格，
 *      构建体积因此能小一大截 —— 对一个「评委点开就能看」的静态站，首屏速度是体验的一部分。
 *   2. **组件只负责画**。所有数值由 src/lib/results.js 算好传进来，
 *      这里不出现任何业务判断（没有「如果选了网吧就……」）。
 */

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { RadarChart, PieChart, LineChart, BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  RadarChart,
  PieChart,
  LineChart,
  BarChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

export default function Chart({ option, height = 280, ariaLabel = '图表', className = '' }) {
  const holder = useRef(null);
  const inst = useRef(null);

  useEffect(() => {
    if (!holder.current) return undefined;
    const chart = echarts.init(holder.current);
    inst.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    if (!inst.current || !option) return;
    inst.current.setOption(option, true);
  }, [option]);

  return (
    <div
      ref={holder}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ width: '100%', height }}
    />
  );
}
