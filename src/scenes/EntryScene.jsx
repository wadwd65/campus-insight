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

export default function EntryScene({ onGoQuiz, onGoUpload, onGoMap }) {
  const qn = QUESTIONS.length;

  return (
    <div className="max-w-3xl mx-auto py-10">
      <MonoTag>CAMPUS INSIGHT · 你的大学平行宇宙</MonoTag>

      <h1 className="text-[26px] font-semibold mt-4 leading-snug" style={{ color: 'var(--term-ink, #0f1720)' }}>
        把大学四年，算成一份能看懂的数据叙事
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: '#5d6b7a' }}>
        两条路，同一套算法：答 {qn} 道有画面感的选择题，约 1 分钟拿到你的八维属性、
        时间分配、四年心情曲线与大模型解读；手上已经有班级问卷，就直接上传 CSV，
        看群体分布与最像你的那一类人。
      </p>

      {/* ── 一级入口：两个主按钮 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
        <button
          type="button"
          onClick={onGoQuiz}
          className="glass-panel glass-btn text-left px-5 py-5 rounded-sm"
          style={{ borderColor: BRAND, background: `${BRAND}14` }}
        >
          <span className="term-mono text-[10px] tracking-[0.25em]" style={{ color: BRAND }}>
            01 · ASSESSMENT
          </span>
          <span className="block text-[15px] font-semibold mt-2" style={{ color: 'var(--term-ink, #0f1720)' }}>
            开始测评 →
          </span>
          <span className="block text-[11.5px] mt-1.5" style={{ color: '#5d6b7a' }}>
            {qn} 道题 · 约 1 分钟 · 立刻出个人档案
          </span>
        </button>

        <button
          type="button"
          onClick={onGoUpload}
          className="glass-panel glass-btn text-left px-5 py-5 rounded-sm"
        >
          <span className="term-mono text-[10px] tracking-[0.25em]" style={{ color: '#5d6b7a' }}>
            02 · COHORT
          </span>
          <span className="block text-[15px] font-semibold mt-2" style={{ color: 'var(--term-ink, #0f1720)' }}>
            上传班级数据 →
          </span>
          <span className="block text-[11.5px] mt-1.5" style={{ color: '#5d6b7a' }}>
            已有问卷 CSV · 出群体画像（文件只在浏览器里算）
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
    </div>
  );
}
