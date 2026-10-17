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
import Mascot from '../components/Mascot.jsx';


/**
 * @param {Function} onGoQuiz / onGoUpload / onGoMap  三个一级入口
 * @param {{text?:string}|null} [eggQuip]   立绘彩蛋的趣评（App 算好传进来，见 lib/egg.js）
 * @param {{label:string, run:Function}} [eggAction] 彩蛋气泡里的按钮动作
 */
export default function EntryScene({ onGoQuiz, onGoUpload, onGoMap, eggQuip, eggAction }) {
  const qn = QUESTIONS.length;

  return (
    <div className="relative min-h-full flex flex-col">
      {/* ★ 10-17 背景重做：深色场景图 → **明亮动漫天空**。
          用户原话：「主界面他就很怪……他自己看他那个背景黑的，然后中间一全部是吐的白，
          然后中间还有两个白，它是亮的」。
          截图确认：旧背景是三张**深色**场景图（左侧废墟、右侧藤蔓），
          内容却压在 0.92 不透明度的惨白上，两张入口卡又是亮白 ——
          **三档亮度硬碰**，像在一张黑纸上贴了三块白纸片。

          换成绘世出的 sky.webp（明度 164，晨空、青蓝 + 暖白云），
          用 mask 从底部渐隐进页面底色，让天空和内容自然过渡。 */}
      <div className="entry-sky" aria-hidden="true" />
      <Suspense fallback={null}>
        <Atmosphere variant="plain" />
      </Suspense>

      {/* 吉祥物：右下角，点一下会跳一下并说话（换图只改 public/art/mascot.webp）
          ★ 10-17 夜：60 秒内点 10 次触发彩蛋 —— 趣评与按钮由 App 传进来
            （入口页自己没有数据，不能算也不该编） */}
      <Mascot
        src={`${import.meta.env.BASE_URL}art/mascot.webp`}
        quip={eggQuip?.text ?? null}
        onQuipAction={eggAction?.run ?? null}
        actionLabel={eggAction?.label}
      />

      {/* ── 页头 ──────────────────────────────────────────────
          ★ 10-17 提亮：原来是**深色底板 + 浅色小字**（`rgba(10,15,22,.62)`）。
          实测那三张场景图明度是 190~224（白底 + 深色藤蔓剪影）——
          **背景本来就是亮的**，深暗全是这块深色底板造成的。
          现在改成透明 + 深色小字，让藤蔓从页头后面透出来。 */}
      <header
        className="relative z-10"
        style={{ borderBottom: '1px solid rgba(26, 26, 23, 0.10)' }}
      >
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center gap-3 flex-wrap">
          <span className="term-mono text-[11px] tracking-[0.12em]" style={{ color: 'var(--ink-dim)' }}>
            CAMPUS&nbsp;ARCHIVE&nbsp;//&nbsp;TERMINAL&nbsp;v3
          </span>
          <span className="flex-1" />
          <span className="term-mono text-[11px]" style={{ color: 'var(--ink-dim)' }}>
            不需要注册，也不需要密钥
          </span>
        </div>
      </header>

      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-6 py-10">
        {/* ★ 10-17：衬底从"惨白一块"改成**几乎透明的暖纱**。
            0.92 的白在亮天空上就是一块惨白的补丁；
            现在只留 0.30 上下的暖白，让天空的蓝透出来，
            文字仍有足够对比（天空下部本就接近白）。 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-6 -inset-y-10"
          style={{
            background:
              'radial-gradient(80% 72% at 50% 40%, rgba(255,253,247,0.34), rgba(255,250,240,0.12) 100%)',
          }}
        />

        <div className="relative">
          <MonoTag style={{ color: 'var(--accent)' }}>CAMPUS INSIGHT · 你的大学平行宇宙</MonoTag>

          <h1
            className="mt-5 text-[32px] sm:text-[38px] font-extrabold leading-[1.25] tracking-[-0.03em]"
            style={{ color: 'var(--ink-strong)' }}
          >
            把大学四年，
            <br className="hidden sm:block" />
            算成一份能看懂的数据叙事
          </h1>
          <p
            className="mt-4 text-[14px] leading-[1.9]"
            style={{ color: 'var(--ink-mid)', maxWidth: '56ch' }}
          >
            答 {qn} 道有画面感的选择题，约 1 分钟，得到一份八维画像、四年曲线与 AI 解读。
            手上正好有班级数据？也可以传一份 CSV，看整个群体的分布。
          </p>

          {/* 官方链路：让"这是个数据分析产品"一眼成立 */}
          <div
            className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 term-mono text-[10.5px] tracking-[0.14em]"
            style={{ color: 'var(--ink-dim)' }}
          >
            <span>数据</span>
            <span style={{ color: 'var(--accent)' }}>→</span>
            <span>图表大盘</span>
            <span style={{ color: 'var(--accent)' }}>→</span>
            <span>AI 解读</span>
            <span className="ml-1">（答题与上传，都走完这三段）</span>
          </div>

          {/* ★★ 10-17 布局重排（用户指令）：
                「主界面保留一个开始测评，上传数据面板放在右下角或者左下角，作为一个小的，
                  而不是放在核心……上传数据面板，可以跟那个地图那个界面进行一个对调。」

              改之前：左=上传数据看板（主位）右=开始测评；地图屈居页脚小字。
              改之后：**左=开始测评（主位）**，右=行动地图，**上传降到页脚**。

              为什么这么排（不是纯听指令，是有一个判断）：
                上传要求用户先有「10 道题、48 种约定答案、固定列名」的班级 CSV ——
                对陌生访客等于不可用（实测门槛见日志）。它不配占主位；
                但它背后的「群体分析」能力仍值得保留，所以降到页脚而不是删掉。
              而测评是唯一「零门槛、1 分钟出结果」的闭环，必须是第一眼看得到的。 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">
            <button
              type="button"
              onClick={onGoQuiz}
              className="ios-glass ci-lift relative text-left px-5 py-5 transition-transform"
              style={{
                clipPath:
                  'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
              }}
            >
              <span className="term-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--accent)' }}>
                01 · ASSESSMENT
              </span>
              <span
                className="term-mono absolute right-4 top-4 text-[10px]"
                style={{ color: 'var(--accent)' }}
              >
                1 分钟
              </span>
              <span className="block text-[16px] font-bold mt-2" style={{ color: 'var(--ink-strong)' }}>
                开始测评 →
              </span>
              <span className="block text-[12.5px] mt-2 leading-relaxed" style={{ color: 'var(--ink-mid)' }}>
                {qn} 道题 · 不需要任何数据，立刻出个人档案
              </span>
            </button>

            <button
              type="button"
              onClick={onGoMap}
              className="ios-glass ci-lift relative text-left px-5 py-5 transition-transform"
              style={{
                clipPath:
                  'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
              }}
            >
              <span className="term-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--ink-dim)' }}>
                02 · ACTION MAP
              </span>
              <span className="term-mono absolute right-4 top-4 text-[10px]" style={{ color: 'var(--ink-dim)' }}>
                17 个地点
              </span>
              <span className="block text-[16px] font-bold mt-2" style={{ color: 'var(--ink-strong)' }}>
                去校园里走走 →
              </span>
              <span className="block text-[12.5px] mt-2 leading-relaxed" style={{ color: 'var(--ink-mid)' }}>
                点一个地方 · 看它给你的八维加多少分
              </span>
            </button>
          </div>

          {/* 二级入口：工具与附加体验。
              ★ 10-17：上传从主位降到这里 —— 它需要「按模板收集好的班级 CSV」，
                对第一次来的人不是入口，是进阶工具。如实标注门槛，比藏起来好。 */}
          <div className="mt-9 pt-5" style={{ borderTop: '1px solid rgba(26, 26, 23, 0.14)' }}>
            <p className="term-mono text-[10px] tracking-[0.25em] mb-3" style={{ color: 'var(--ink-dim)' }}>
              工具与附加 · 不影响测评结果
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
              <button type="button" onClick={onGoUpload} style={{ color: 'var(--accent)' }}>
                上传班级问卷（已有数据时用）→
              </button>
              <a
                href={`${import.meta.env.BASE_URL}map/校园地图-3D实景.html`}
                style={{ color: 'var(--ink-dim)' }}
              >
                3D 实景校园（附加展示）
              </a>
            </div>
          </div>

          {/* 页脚三条 */}
          <div
            className="mt-9 pt-5 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3"
            style={{ borderTop: '1px solid rgba(26, 26, 23, 0.14)' }}
          >
            <FooterNote title="数据不出浏览器" body="上传的 CSV 只在本机解析与计算，服务端拿不到原始作答。" />
            <FooterNote title="没有密钥也完整" body="大模型不可用时，解读自动降级为本地规则按同一套数字生成。" />
            <FooterNote title="505 项自检" body="每次提交前自动验证计算层、两条主线、隐私白名单、统计边界、AI 落地与构建产物。" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 页脚一条：短标题 + 一句实话（★ 10-17 提亮：深色小字 → 亮背景上的深色小字） */
function FooterNote({ title, body }) {
  return (
    <div>
      <p className="term-mono text-[10px] tracking-[0.16em]" style={{ color: 'var(--accent)' }}>{title}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: 'var(--ink-mid)' }}>{body}</p>
    </div>
  );
}
