/**
 * 应用外壳 —— 当前是欢迎页。
 *
 * 一共三个状态：欢迎 → 答题 → 结果。
 * 答题与结果页在 M3 实现（见 docs/开发任务表-大学平行宇宙.md，T-10 ~ T-16）。
 * 这一版只负责把「这是什么」讲清楚，同时证明工程链路是通的。
 */

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight">你的大学平行宇宙</h1>
          <span className="text-sm text-[var(--ink-soft)]">个人青春行为图谱生成器</span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16">
        <h2 className="text-3xl font-semibold tracking-tight leading-snug mb-4">
          回答 6 个问题，
          <br />
          看看你的大学落在哪一个宇宙
        </h2>

        <p className="text-base text-[var(--ink-soft)] leading-7 mb-10">
          不需要账号，不需要上传任何数据，也不需要安装什么。六道有画面感的选择题，大约 30 秒。
          答完你会拿到一份只属于你的报告：一张人物雷达图、一份「时间去哪了」、一条四年的心情曲线，
          以及一句只有你能拿到的评语。
        </p>

        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-8 py-12 text-center">
          <p className="text-base font-medium mb-1">答题界面正在开发中</p>
          <p className="text-sm text-[var(--ink-soft)] mb-6 leading-6">
            计算层与 2000 人基准数据已经跑通（39 项自检全通过），
            <br />
            下一步把页面接上 —— 六道题、四张图、一段 AI 解读
          </p>
          <button
            type="button"
            disabled
            className="rounded-lg bg-slate-200 px-5 py-2.5 text-sm text-slate-500 cursor-not-allowed"
          >
            开始（6 题，约 30 秒）
          </button>
        </div>

        <p className="mt-8 text-xs text-[var(--ink-soft)] leading-6">
          产品逻辑：每个选项会同时影响 8 个潜在属性；你的属性值再与 2000 人基准人群比对，
          得到「你排在人群第几」。所以不同的人答完，拿到的报告是真的不一样的 ——
          这一点由 <code className="font-mono">npm run selftest</code> 里的分化度闸门守着。
        </p>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-6xl mx-auto px-6 py-3 text-xs text-[var(--ink-soft)]">
          数据只在你的浏览器里处理，不会上传到任何服务器 · 基准人群数据为模拟生成，非真实调查结果
        </div>
      </footer>
    </div>
  )
}
