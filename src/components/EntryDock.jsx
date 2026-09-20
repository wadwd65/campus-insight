/**
 * 功能入口坞 —— 挂在地图界面上的玻璃质感入口组。
 *
 * ── 2026-09-20 新增：把「答题」从主界面降成子入口 ────────────────────
 *
 * 改版前，打开网站的第一屏是 Welcome：正中一个大蓝按钮「开始（10 题）」，
 * 旁边一条次按钮「或者去校园里走走」。
 * 那个版式**把答题当成了主入口**，地图是备选 —— 而这是反的：
 *
 *   - 地图是**可反复的、有空间感的、有反馈的**，它是这个产品的主体
 *   - 答题是**一次性**的，它是地图里的一个功能点，而不是门
 *
 * 所以这一版把 16 个地点所在的地图升为默认界面，
 * 答题 / 上传 / 生成档案收进这个入口坞。
 *
 * ── 为什么叫"入口坞"而不是"菜单" ─────────────────────────────────
 *
 * 因为它不是一组导航链接，而是**地图上可以按下去的实体**。
 * 参考站里可操作的东西读起来是"按在玻璃上"（半透明白底 + 内侧高光 +
 * backdrop 模糊），而不是"一块色块"。所以这里统一走 .glass-panel。
 *
 * ── 为什么玻璃坞要压在深色地图上 ─────────────────────────────────
 *
 * .glass-panel 的 backdrop-filter 需要身后有东西才显得出玻璃感。
 * 地图本身就是深色 + 网格 + 大量卡片，糊在它上面正好；
 * 若放在纯色底上，玻璃看起来只是一块灰。
 *
 * 注意：地图是**深色**的，所以坞里的文字用深色终端那套（TERMINAL），
 * 不是入场那套浅色的 LIGHT。两套色刻意不混 —— 见 terminalTheme.js。
 */

import { MonoTag } from './TermHead.jsx';
import { QUESTIONS } from '../lib/surveySchema.js';

/**
 * 一个入口项。
 *
 * `tone` 决定左侧那道竖条与标题的颜色：
 *   primary  —— 蓝，主路径（在这里是"生成档案"，因为那是玩家的目标）
 *   quiet    —— 灰，辅助路径（答题、上传）
 * 不引入第三种色：三色以上就分不出主次了。
 */
function DockItem({ no, title, desc, meta, tone = 'quiet', onClick, disabled, cta }) {
  const accent = tone === 'primary' ? '#4fa8d8' : 'var(--term-ink-soft)';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="glass-panel group relative text-left w-full px-3.5 py-3 flex items-start gap-3 rounded-sm"
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        // 左侧竖条：给每一项一个"这是可以按下去的"的把手，
        // 光靠背景色深浅区分主次太弱了
        borderLeft: `2px solid ${disabled ? 'var(--term-line)' : accent}`,
      }}
    >
      <MonoTag tone={tone === 'primary' ? 'cyan' : undefined} style={{ lineHeight: '18px', flexShrink: 0 }}>
        {no}
      </MonoTag>

      <span className="min-w-0 flex-1">
        <span
          className="block text-[12.5px] font-medium"
          style={{ color: disabled ? 'var(--term-ink-soft)' : 'var(--term-ink)' }}
        >
          {title}
        </span>
        <span
          className="block text-[10.5px] leading-relaxed mt-0.5"
          style={{ color: 'var(--term-ink-soft)' }}
        >
          {desc}
        </span>
        {meta && (
          <span
            className="term-mono block text-[9.5px] mt-1.5 tracking-[0.08em]"
            style={{ color: disabled ? '#5d6b7a' : accent }}
          >
            {meta}
          </span>
        )}
      </span>

      {cta && (
        <span
          className="term-mono text-[13px] shrink-0 self-center transition-transform group-hover:translate-x-0.5"
          style={{ color: disabled ? '#5d6b7a' : accent }}
        >
          →
        </span>
      )}
    </button>
  );
}

export default function EntryDock({ onGoQuiz, onUpload, onGoReport, canReport }) {
  return (
    <div className="space-y-2.5">
      {/* 坞的标题。用"这台机器能做什么"的口吻，而不是"请选择功能"——
          后者读起来像表单，前者读起来像仪表盘。 */}
      <div className="flex items-center justify-between">
        <p className="term-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--term-ink-soft)' }}>
          ACTIONS
        </p>
        <p className="term-mono text-[10px]" style={{ color: '#5d6b7a' }}>
          三个入口 · 同一本账
        </p>
      </div>

      {/* 01 · 生成档案 —— 玩家的目标，所以排第一、走主色。
          没走过任何地方时禁用，并把原因写在 meta 里（而不是让它静默无反应）。 */}
      <DockItem
        no="01"
        title="生成我的档案"
        desc="把这段经历算成八维属性，与 2000 人基准比对"
        meta={
          canReport
            ? '可生成 · 雷达图 / 四年曲线 / 人群冷知识'
            : '先去一个地方走走 · 至少要有一段轨迹'
        }
        tone="primary"
        onClick={onGoReport}
        disabled={!canReport}
        cta
      />

      {/* 02 · 答题 —— 从主入口降成子入口。
          它的定位写得很明确：「地图之外的另一条路」，不是「开始」。 */}
      <DockItem
        no="02"
        title={`答 ${QUESTIONS.length} 道题`}
        desc="不想走路就直接答题，约 1 分钟，一步到位"
        meta="答案同样写进这本账（会覆盖当前轨迹）"
        onClick={onGoQuiz}
        cta
      />

      {/* 03 · 上传班级 —— 这条不属于"我"，是"我们"。
          所以描述里点明它的产出是群体画像，而不是个人档案。 */}
      <DockItem
        no="03"
        title="上传班级问卷"
        desc="手上已有收集好的 CSV，看群体分布与最像你的人"
        meta="文件只在浏览器里算 · 不会上传"
        onClick={onUpload}
        cta
      />
    </div>
  );
}
