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
    // 阈值放宽到 700 KB，**只针对一个已知的块**：ECharts（约 570 KB）。
    // 它绕不开 —— 方向 6 的官方描述点名了 ECharts / D3，不能为了体积换掉；
    // 已经用懒加载把它移出首屏（首屏 82 KB，进结果页才拉图表库）。
    //
    // 这不是「以后体积警告都可以不管」：将来再出现超限的块，
    // 仍要按同样标准处理 —— 要么分包，要么重新论证为什么它必须这么大。
    chunkSizeWarningLimit: 700,
  },
})
