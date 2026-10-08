/**
 * EntryScene —— 站点入口页（10-07 新增，作品重心修正）
 *
 * ── 为什么要有这一屏 ──────────────────────────────────────────────
 * 用户下的任务单：「首页/主流程必须突出**问卷测评**和**上传 CSV**两个核心入口，
 * 地图不得阻塞主流程」「地图降级为可选展示项」。
 *
 * 改版前的落地页是**行动地图**——一个可反复玩的场景层。
 * 它把"点进去先看到一张地图"变成了默认路径，于是重心读起来像是地图产品，
 * 而作品主体（问卷 → 八维属性 → 图表 → AI 解读 / CSV → 群体画像）反而成了支线。
 *
 * 这一屏把重心摆正：
 *   一级（主按钮）= 开始测评 / 上传班级数据
 *   二级（文字链）= 去校园里走走（行动地图）/ 3D 实景（**附加展示**，外链静态页）
 *
 * 样式与全站一致：浅色内容区 + 玻璃卡片 + 等宽小标；不引入任何新依赖。
 */
import { QUESTIONS } from '../lib/surveySchema.js';
import { MonoTag } from '../components/TermHead.jsx';
import { BRAND } from '../lib/theme.js';
import { TERMINAL } from '../lib/terminalTheme.js';

export default function EntryScene({ onGoQuiz, onGoUpload, onGoMap }) {
  const qn = QUESTIONS.length;

  return (
    <div className="flex flex-col min-h-[calc(100vh-0px)]">
      {/* ── 轻量页头（★ 10-08）：入口页不该出现"属性待充能"的空条 ——
          那对第一次来的人像一条报错。这里只留站点标识 + 一句真承诺。 */}
      <header className="term-canvas" style={{ borderBottom: `1px solid ${TERMINAL.line}` }}>
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center gap-3 flex-wrap">
          <span className="term-mono text-[11px]" style={{ color: TERMINAL.inkDim }}>
            CAMPUS&nbsp;ARCHIVE&nbsp;//&nbsp;TERMINAL&nbsp;v3
          </span>
          <span className="flex-1" />
          <span className="term-mono text-[11px]" style={{ color: TERMINAL.inkSoft }}>
            未配置密钥也能走完三段
          </span>
        </div>
      </header>

      <div className="max-w-4xl w-full mx-auto px-6 py-12 flex-1">
      <MonoTag>CAMPUS INSIGHT · 你的大学平行宇宙</MonoTag>

      <h1 className="text-[30px] font-semibold mt-5 leading-[1.35] tracking-[-0.01em]" style={{ color: 'var(--term-ink, #0f1720)' }}>
        把大学四年，算成一份能看懂的数据叙事
      </h1>
      <p className="mt-3.5 text-[13.5px] leading-[1.9]" style={{ color: '#5d6b7a' }}>
        两条路，同一套算法：答 {qn} 道有画面感的选择题，约 1 分钟拿到你的八维属性、
        时间分配、四年心情曲线与大模型解读；手上已经有班级问卷，就直接上传 CSV，
        看群体分布与最像你的那一类人。
      </p>

      {/* ★ 10-08 重心修正（B）：把"官方链路"直接摆在按钮上方 ——
          数据 → 图表 → AI 解读。这样评委一眼就明白这是个数据分析产品，
          而不是"一个问卷测评网站"。 */}
      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 term-mono text-[10.5px] tracking-[0.14em]"
           style={{ color: '#8698a8' }}>
        <span>数据</span>
        <span style={{ color: BRAND }}>→</span>
        <span>图表大盘</span>
        <span style={{ color: BRAND }}>→</span>
        <span>AI 解读</span>
        <span className="ml-1" style={{ color: '#b3bfca' }}>（两条路都走完这三段）</span>
      </div>

      {/* ── 一级入口：两个主按钮（上传在前 —— 它是最贴赛题形态的那条路） ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <button
          type="button"
          onClick={onGoUpload}
          className="glass-panel glass-btn relative text-left px-6 py-6 rounded-sm"
          style={{ borderColor: BRAND, background: `${BRAND}14` }}
        >
          <span className="term-mono text-[10px] tracking-[0.25em]" style={{ color: BRAND }}>
            01 · DATA BOARD
          </span>
          <span className="term-mono absolute right-4 top-4 text-[10px]" style={{ color: BRAND }}>
            3 步
          </span>
          <span className="block text-[15px] font-semibold mt-2" style={{ color: 'var(--term-ink, #0f1720)' }}>
            上传数据看板 →
          </span>
          <span className="block text-[12px] mt-2 leading-relaxed" style={{ color: '#5d6b7a' }}>
            一份问卷 CSV → 分布 / 雷达 / 分位 + AI 解读
          </span>
        </button>

        <button
          type="button"
          onClick={onGoQuiz}
          className="glass-panel glass-btn relative text-left px-6 py-6 rounded-sm"
        >
          <span className="term-mono text-[10px] tracking-[0.25em]" style={{ color: '#5d6b7a' }}>
            02 · ASSESSMENT
          </span>
          <span className="term-mono absolute right-4 top-4 text-[10px]" style={{ color: '#8698a8' }}>
            1 分钟
          </span>
          <span className="block text-[15px] font-semibold mt-2" style={{ color: 'var(--term-ink, #0f1720)' }}>
            开始测评 →
          </span>
          <span className="block text-[12px] mt-2 leading-relaxed" style={{ color: '#5d6b7a' }}>
            {qn} 道题 · 约 1 分钟 · 没有数据也能玩，立刻出个人档案
          </span>
        </button>
      </div>

      {/* ── 二级入口：场景层与附加展示 ── */}
      <div className="mt-9 pt-5" style={{ borderTop: '1px solid rgba(15,23,32,.10)' }}>
        <p className="term-mono text-[10px] tracking-[0.25em] mb-3" style={{ color: '#8698a8' }}>
          附加体验 · 不参与测评结果
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
          <button type="button" onClick={onGoMap} style={{ color: BRAND }}>
            去校园里走走（行动地图）→
          </button>
          <a
            href={`${import.meta.env.BASE_URL}map/校园地图-3D实景.html`}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#5d6b7a' }}
          >
            3D 实景校园（附加展示）
          </a>
        </div>
        <p className="text-[11px] mt-4" style={{ color: '#8698a8' }}>
          测评与上传都不需要地图；地图只是同一个校园的另一层呈现。
        </p>
      </div>

      {/* ── 页脚三条（★ 10-08）：给页面收底，且每条都是真信息 */}
      <div className="mt-4 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3"
           style={{ borderTop: '1px solid rgba(15,23,32,.10)' }}>
        <FooterNote title="数据不出浏览器" body="上传的 CSV 只在本机解析与计算，服务端拿不到原始作答。" />
        <FooterNote title="没有密钥也完整" body="大模型不可用时，解读自动降级为本地规则按同一套数字生成。" />
        <FooterNote title="415 项自检" body="每次提交前自动验证计算层、两条主线与构建产物。" />
      </div>
      </div>
    </div>
  );
}

/** 页脚一条：短标题 + 一句实话 */
function FooterNote({ title, body }) {
  return (
    <div>
      <p className="term-mono text-[10px] tracking-[0.16em]" style={{ color: BRAND }}>{title}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: '#8698a8' }}>{body}</p>
    </div>
  );
}
