# src/components/ · 界面组件

**职责**：只放看得见的东西——页面区块、图表容器、按钮、提示条。

**约定**

- 一个组件一个文件，文件名用大驼峰（`ScatterChart.jsx`）
- 图表组件只负责「把数据交给 ECharts 并画出来」，**不做任何计算**；算的活交给 `src/lib/`
- 颜色、间距统一走 `src/index.css` 里的 CSS 变量，不要在组件里手写色号

**预计落位的组件**

| 文件 | 做什么 | 任务编号 |
|---|---|---|
| `Chart.jsx` | 包住 ECharts 的通用容器与统一主题 | T-14 |
| `OccupancyChart.jsx` | 科目时长占比环形图 | T-15 |
| `TrendChart.jsx` | 每日投入趋势 | T-16 |
| `ScatterChart.jsx` | 投入-产出散点图（核心图） | T-17 |
| `DiagnoseChart.jsx` | 时长占比 vs 正确率对照 | T-18 |
| `Interpretation.jsx` | 大模型解读文字（流式） | T-21 |
| `Uploader.jsx` | 拖拽上传 / 一键加载示例 | T-24 |
