/**
 * EntryScene —— 站点入口页（一级界面）
 *
 * ── 为什么是这样（两次改版叠加） ──────────────────────────────────
 * ① 10-07 重心修正：一级入口 = 数据看板 / 问卷测评；地图与 3D 是附加体验。
 * ② 10-08 环境层：用户要求"界面四周换成动态、加动漫图片、加粒子效果"。
 *    于是这一屏从"浅色纸面"变成**场景页**：背后是项目自己的三张动漫场景图
 *    （天空 / 拱门废墟 / 藤蔓剪影，与入场页同一套素材 ⇒ 观感连续），
 *    慢速漂移 + 粒子浮沉；正文收进一块深色玻璃面板里，保证可读性。
 *
 * 约束（都不是可选项）：
 *   · 环境层 `pointer-events:none` + `aria-hidden`：只做背景，不抢交互
 *   · 尊重 `prefers-reduced-motion`：动画停、粒子不初始化（见 Atmosphere.jsx）
 *   · 文字对比度：深色面板上的正文用浅色 token，不靠"氛围"硬撑可读性
 */
import { lazy, Suspense } from 'react';
import { QUESTIONS } from '../lib/surveySchema.js';
import { MonoTag } from '../components/TermHead.jsx';
/* 粒子库（@tsparticles）体积不小，而它只在挂载后才有意义
   ⇒ 懒加载：主包不带它，首屏不被拖累（构建后可见它单独成 chunk）*/
const Atmosphere = lazy(() => import('../components/Atmosphere.jsx'));
import { BRAND } from '../lib/theme.js';
import Mascot from '../components/Mascot.jsx';

const INK = '#EDF3FA';
const INK_SOFT = '#9FB2C4';
const CARD = 'rgba(255,255,255,.055)';
const LINE = 'rgba(255,255,255,.16)';

export default function EntryScene({ onGoQuiz, onGoUpload, onGoMap }) {
  const qn = QUESTIONS.length;

  return (
    <div className="relative min-h-full flex flex-col">
      {/* 四周：动漫场景 + 粒子（懒加载，失败也不影响正文）*/}
      <Suspense fallback={null}>
        <Atmosphere variant="scene" />
      </Suspense>

      {/* 吉祥物：右下角，点一下会跳一下并说话（占位立绘待换，换图只改 public/art/mascot.webp）*/}
      <Mascot src={`${import.meta.env.BASE_URL}art/mascot.webp`} />

      {/* 页头 */}
      <header className="relative z-10" style={{ borderBottom: '1px solid rgba(255,255,255,.10)' }}>
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center gap-3 flex-wrap">
          <span className="term-mono text-[11px] tracking-[0.12em]" style={{ color: INK_SOFT }}>
            CAMPUS&nbsp;ARCHIVE&nbsp;//&nbsp;TERMINAL&nbsp;v3
          </span>
          <span className="flex-1" />
          <span className="term-mono text-[11px]" style={{ color: INK_SOFT }}>
            未配置密钥也能走完三段
          </span>
        </div>
      </header>

      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 py-10">
        <div className="atmo-panel rounded-sm px-7 py-9 sm:px-10 sm:py-11">
          <MonoTag>CAMPUS INSIGHT · 你的大学平行宇宙</MonoTag>

          <h1 className="text-[30px] font-semibold mt-5 leading-[1.35] tracking-[-0.01em]" style={{ color: INK }}>
            把大学四年，算成一份能看懂的数据叙事
          </h1>
          <p className="mt-3.5 text-[13.5px] leading-[1.9]" style={{ color: INK_SOFT }}>
            一条主线：一份问卷 CSV 进来，图表大盘与 AI 解读出去。没有数据也能玩 ——
            答 {qn} 道有画面感的选择题，约 1 分钟，同样出档案。
          </p>

          {/* 官方链路：让"这是个数据分析产品"一眼成立 */}
          <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 term-mono text-[10.5px] tracking-[0.14em]"
               style={{ color: INK_SOFT }}>
            <span>数据</span>
            <span style={{ color: BRAND }}>→</span>
            <span>图表大盘</span>
            <span style={{ color: BRAND }}>→</span>
            <span>AI 解读</span>
            <span className="ml-1">（两条路都走完这三段）</span>
          </div>

          {/* 一级入口 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <button
              type="button"
              onClick={onGoUpload}
              className="relative text-left px-5 py-5 rounded-sm transition"
              style={{ background: 'rgba(106,169,255,.14)', border: `1px solid ${BRAND}` }}
            >
              <span className="term-mono text-[10px] tracking-[0.25em]" style={{ color: BRAND }}>
                01 · DATA BOARD
              </span>
              <span className="term-mono absolute right-4 top-4 text-[10px]" style={{ color: BRAND }}>
                3 步
              </span>
              <span className="block text-[15px] font-semibold mt-2" style={{ color: INK }}>
                上传数据看板 →
              </span>
              <span className="block text-[12px] mt-2 leading-relaxed" style={{ color: INK_SOFT }}>
                一份问卷 CSV → 分布 / 雷达 / 分位 + AI 解读
              </span>
            </button>

            <button
              type="button"
              onClick={onGoQuiz}
              className="relative text-left px-5 py-5 rounded-sm transition"
              style={{ background: CARD, border: `1px solid ${LINE}` }}
            >
              <span className="term-mono text-[10px] tracking-[0.25em]" style={{ color: INK_SOFT }}>
                02 · ASSESSMENT
              </span>
              <span className="term-mono absolute right-4 top-4 text-[10px]" style={{ color: INK_SOFT }}>
                1 分钟
              </span>
              <span className="block text-[15px] font-semibold mt-2" style={{ color: INK }}>
                开始测评 →
              </span>
              <span className="block text-[12px] mt-2 leading-relaxed" style={{ color: INK_SOFT }}>
                {qn} 道题 · 没有数据也能玩，立刻出个人档案
              </span>
            </button>
          </div>

          {/* 二级入口：附加体验 */}
          <div className="mt-9 pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
            <p className="term-mono text-[10px] tracking-[0.25em] mb-3" style={{ color: INK_SOFT }}>
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
                style={{ color: INK_SOFT }}
              >
                3D 实景校园（附加展示）
              </a>
            </div>
          </div>
          {/* 页脚三条（★ 10-08 修正：放进面板内 —— 直接压在环境层上会被藤蔓压得读不清）*/}
          <div className="mt-9 pt-5 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3"
               style={{ borderTop: `1px solid ${LINE}` }}>
            <FooterNote title="数据不出浏览器" body="上传的 CSV 只在本机解析与计算，服务端拿不到原始作答。" />
            <FooterNote title="没有密钥也完整" body="大模型不可用时，解读自动降级为本地规则按同一套数字生成。" />
            <FooterNote title="426 项自检" body="每次提交前自动验证计算层、两条主线与构建产物。" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 页脚一条：短标题 + 一句实话（深色环境层上的浅色小字） */
function FooterNote({ title, body }) {
  return (
    <div>
      <p className="term-mono text-[10px] tracking-[0.16em]" style={{ color: BRAND }}>{title}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: INK_SOFT }}>{body}</p>
    </div>
  );
}
