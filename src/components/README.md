# src/components/ · 界面组件

**职责**：只放看得见的东西 —— 页面区块、图表容器、按钮、提示条。

**约定**

- 一个组件一个文件，文件名用大驼峰（`RadarChart.jsx`）
- 图表组件只负责「把数据交给 ECharts 并画出来」，**不做任何计算**。组件里不该出现
  `if (选了网吧) ...` 这类判断 —— 所有数字都从 `src/lib/results.js` 拿
- 快入口的结果页与真入口的群体画像**共用同一批图表组件**，只是喂不同的数据
- 颜色、间距统一走 `src/index.css` 里的 CSS 变量，不要在组件里手写色号

**待落位**

| 文件 | 做什么 | 任务编号 |
|---|---|---|
| `Chart.jsx` | 包住 ECharts 的通用容器与统一主题（含 dispose 与 resize） | T-10 |
| `SurveyForm.jsx` | 六步问卷表单，一屏一题，可回退 | T-11 |
| `RadarChart.jsx` | 大学生活者画像（5 轴，带入场动画） | T-12 |
| `TimeDonut.jsx` | 「时间去哪了」环形图 | T-13 |
| `MoodCurve.jsx` | 四年心情曲线（含每段一句话） | T-14 |
| `FactsCard.jsx` | 称号 + 人群冷知识 | T-15 |
| `ResultPage.jsx` | 结果页组装：五件套按节奏依次出现 | T-16 |
| `Interpretation.jsx` | 大模型解读文字（流式逐字输出） | T-18 |
| `UploadPanel.jsx` | 上传批量问卷 CSV（真入口） | T-21 |
| `CohortPage.jsx` | 群体画像（真入口） | T-22 |
