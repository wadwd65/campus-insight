import { createElement } from 'react';
// Charts are covered by calculation tests. JSDOM cannot verify canvas pixels.
export default function ChartStub() {
  return createElement('div', { 'data-test-chart': true, 'aria-label': '图表渲染在此测试中省略' });
}
