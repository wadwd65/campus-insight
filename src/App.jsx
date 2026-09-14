export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">学习投入诊断看板</h1>
          <span className="text-sm text-[var(--ink-soft)]">
            上传每日学习记录，看看时间和正确率是不是在往同一个方向走
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        {/* 空状态：数据入口接通前，页面就停在这里 */}
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-8 py-16 text-center">
          <p className="text-base font-medium mb-1">还没有数据</p>
          <p className="text-sm text-[var(--ink-soft)] mb-6">
            数据入口与图表区正在开发中，下一步接通示例数据集
          </p>
          <button
            type="button"
            disabled
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm text-slate-500 cursor-not-allowed"
          >
            加载示例数据（待接通）
          </button>
        </div>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6 py-3 text-xs text-[var(--ink-soft)]">
          数据只在你的浏览器里处理，不会上传到任何服务器
        </div>
      </footer>
    </div>
  )
}
