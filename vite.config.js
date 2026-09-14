import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    // ECharts 单独成块后仍有约 570 KB —— 这是本产品绕不开的体积：
    // 方向 6 的官方描述里点名了 ECharts / D3，不能为了体积换掉它。
    // 已经用懒加载把它挪出首屏（首屏 82 KB，进结果页才拉图表库），
    // 到这里已经是合理状态，所以把阈值放宽，避免每次构建都刷一条已知且可接受的警告。
    chunkSizeWarningLimit: 700,
  },
})
