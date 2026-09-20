/**
 * 答题前的入口面板 —— 点「答 10 道题」之后先看到的那一屏。
 *
 * ── 为什么要有这一屏（用户明确要求的） ────────────────────────────
 *
 * 原话：「**答题应该是一个功能，而不是点进去就是答题**」，
 * 以及「里面那些答题的东西也不是那么直白，就是太没有东西了，
 * 就像我们**玻璃质感的手给它按上去**」。
 *
 * 也就是说，点进去直接看到"第 1 题 / 共 10 题 + 四个选项"
 * 这件事本身是错的 —— 它把答题读成了"一个你要填的表单"，
 * 而不是"游戏里的一个功能点"。
 *
 * 所以中间加这一屏，它做三件事：
 *   1. **说明这是在哪**：告诉你这是平行宇宙的问卷，不是考试
 *   2. **说明要多久、会得到什么**："10 题约 1 分钟，答完立刻有档案"
 *   3. **给一个明确的手感**：玻璃按钮，按下去才真的开始
 *
 * ── 为什么不做成"确认弹窗" ────────────────────────────────────────
 *
 * 弹窗是"打断"，它是用来问"你真的要删吗"的。
 * 这里不是打断，是**入口**：用户主动点进来的，所以应该是一个可以停留的页面，
 * 而不是一个必须立刻做决定的对话框。所以它是整屏的、有背景的、有呼吸的。
 *
 * 配色说明：这一屏属于**内容区**（浅色），不属于场景层（深色）。
 * 所以文字用 CSS 变量那套浅色正文色，不引入 TERMINAL 或 LIGHT。
 * 玻璃效果在这里靠一层浅色渐变底衬显出来 —— 浅底上的玻璃与深底上的玻璃
 * 观感完全不同，所以这里的 .glass-panel 需要配一条更亮的渐变背景。
 */

import { QUESTIONS } from '../lib/surveySchema.js';
import { MonoTag } from './TermHead.jsx';
import { BRAND } from '../lib/theme.js';

export default function QuizGate({ onStart, onBack }) {
  const qn = QUESTIONS.length;

  return (
    <div className="max-w-2xl mx-auto py-6">
      {/* 顶部：告诉用户"你在哪一层"。用等宽小标与整个项目一致，
          而不是一个"返回"按钮 —— 后者会让这一屏读起来像错误页。 */}
      <div className="flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={onBack}
          className="term-mono text-[10.5px] tracking-[0.12em] transition-colors"
          style={{ color: 'var(--ink-soft)' }}
        >
          ← 回到地图
        </button>
        <MonoTag>CAMPUS&nbsp;ARCHIVE&nbsp;//&nbsp;SURVEY</MonoTag>
      </div>

      {/* ── 玻璃主面板 ──
          底下垫一层浅紫渐变，玻璃的 backdrop-filter 才有东西可以糊。
          没有这层衬底，浅色页面上的 backdrop-filter 是看不见效果的
          （身后就是白的，糊了还是白的）。 */}
      <div
        className="relative px-7 py-9 overflow-hidden rounded-sm"
        style={{
          background:
            'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 42%, #fdf4ff 100%)',
        }}
      >
        {/* 两块柔光：让底衬不是死板的线性渐变。
            位置刻意不对称，对称的柔光会读成"一个光晕素材"。 */}
        <span
          className="absolute pointer-events-none"
          style={{
            left: '-8%',
            top: '-32%',
            width: '58%',
            height: '110%',
            background: 'radial-gradient(circle, rgba(79,70,229,0.13), transparent 68%)',
          }}
          aria-hidden="true"
        />
        <span
          className="absolute pointer-events-none"
          style={{
            right: '-6%',
            bottom: '-36%',
            width: '52%',
            height: '104%',
            background: 'radial-gradient(circle, rgba(168,85,247,0.11), transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative">
          <p className="term-mono text-[10px] tracking-[0.32em]" style={{ color: 'var(--ink-soft)' }}>
            QUESTIONNAIRE · {qn} ITEMS
          </p>

          <h2 className="text-2xl sm:text-[28px] font-semibold tracking-tight leading-snug mt-3">
            十个问题，
            <br />
            决定你在哪一层宇宙
          </h2>

          {/* 三条事实，用等宽列表而不是散文。
              这一屏的作用是"让人敢按下去"，所以信息要能一眼扫完。 */}
          <div className="mt-6 space-y-2.5">
            {[
              ['题量', `${qn} 题，每题四个选项，都在校园生活里`],
              ['用时', '大约 1 分钟，中途不用填任何资料'],
              ['产出', '答完立刻得到雷达图、时间分配与人群定位'],
              ['隐私', '全程在浏览器里算，不上传任何内容'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 items-baseline">
                <span
                  className="term-mono text-[10px] tracking-[0.14em] shrink-0"
                  style={{ color: 'var(--ink-soft)', minWidth: 40 }}
                >
                  {k}
                </span>
                <span className="text-[13px] leading-6 text-[var(--ink)]">{v}</span>
              </div>
            ))}
          </div>

          {/* 一句"为什么值得答"。放在按钮之前最后一步 —— 这是临门一脚的位置。 */}
          <p className="mt-6 text-[12px] leading-6 text-[var(--ink-soft)]">
            每道题都同时改变 8 个属性，所以没有"答对答错" ——
            只有"你是哪一种"。
          </p>

          {/* ── 按钮组 ──
              主按钮走品牌色实心（它是这一屏唯一的动作）；
              次按钮是"回到地图"，用文字链接而不是并列按钮 ——
              两个并列按钮会让"要选哪个"这件事重新变成问题。 */}
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStart}
              className="glass-btn term-mono px-8 py-3.5 text-[13px] tracking-[0.18em] rounded-sm"
              style={{ background: BRAND, border: `1px solid ${BRAND}`, color: '#fff' }}
            >
              开始答题 →
            </button>
            <button
              type="button"
              onClick={onBack}
              className="term-mono text-[11px] tracking-[0.1em] transition-colors"
              style={{ color: 'var(--ink-soft)' }}
            >
              先不答，回地图
            </button>
          </div>
        </div>
      </div>

      {/* 屏下的补充说明：把"这一份答案会怎样影响已有轨迹"讲清楚。
          这是真实的副作用（finishQuiz 会 resetPlayer），
          不说清楚会让已经走过地图的人意外丢数据。 */}
      <p className="mt-5 text-[11px] leading-6 text-[var(--ink-soft)]">
        注意：答题会重建你的属性账本。如果你已经在地图上走过一些地方，
        那些轨迹会被这一份答案**替换**（不是叠加）。
      </p>
    </div>
  );
}
