/**
 * 入场场景 —— 打开网站的第一屏。
 *
 * 它要解决的不是"好看"，而是**把这一屏和后面的报告接上**：
 * 报告是浅色的、读数据的；这一屏是深色的、像仪表盘。
 * 两屏之间的落差本身就是"从终端进入报告"的暗示，比加一句"正在加载报告"有用。
 *
 * ── 2026-09-16 第二版：按参考站重做，加入四层视差 ──────────────────
 *
 * 参考站（桌面参赛包 07-素材调研/参考站-ArcaeaWeb复刻）给了一条很具体的配方：
 * 入场画面由**四层**叠成，每层速度不同 ——
 *
 *   底（雾/天空）  慢速推镜        → .intro-sky   （34s 循环，最慢）
 *   中景（剪影）   比底快一点      → .intro-ridge
 *   粒子（光点）   悬浮，大小不一  → .term-dot
 *   前景（光带）   极慢明灭        → .intro-shaft
 *   中心（纹章）   对称 + 缓呼吸    → <Crest />
 *
 * 关键观察，也是上一版最缺的一点：**整段没有一处硬切，全是长时间缓变**。
 * 上一版只有"逐条淡入"（各 0.3s）+ 一片静止的光点，读起来是"界面在加载"；
 * 参考站读起来是"环境一直在那里，你刚好走进来"。差别就在**有没有慢层**。
 *
 * 三条纪律没有变，反而更重要了：
 *   1. **不用动画库**。四层视差全是 CSS keyframes，零 JS 逐帧。
 *      引进 framer-motion 会让首屏包多约 42 kB（gzip）—— 评委点开链接的第一眼，
 *      不该花在下载一个只在地图转场时才用得上的库上（那个场景会按需加载）。
 *   2. **装饰层全部零素材**。雾团是 CSS 径向渐变、剪影是 clip-path 几何块、
 *      光带是渐变条、纹章是自绘 SVG。参考站的音/图/字体版权归 lowiro，
 *      **一个字节都不能进我们的公开仓库**，所以这里没有借用任何素材。
 *   3. **减少动效交给 CSS 一次处理**，不在 JS 里写第二套分支：
 *      `index.css` 的 @media (prefers-reduced-motion) 会同时关掉四层动画与延时，
 *      元素直接显示终态。两处各写一套，迟早会不一致。
 *
 * 一条刻意的不变：**"进入"始终可点，且从第一时刻就能点**。
 * 动画只是包装，不给用户"必须等它演完"的枷锁 —— 慢节奏是给愿意看的人的，
 * 不愿意看的人一进来按 Enter 就该走。
 */

import { useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { QUESTIONS } from '../lib/surveySchema.js';
import { TERMINAL, INTRO_TIMING, preferCalm } from '../lib/terminalTheme.js';
import {
  buildDots,
  buildLightShafts,
  buildRidges,
  pickLayerBudget,
  LAYER_REVEAL,
} from '../lib/introLayers.js';

/** 时间线上的位置 → animation-delay。元素统一挂 .term-rise。 */
const at = (ms) => ({ animationDelay: `${ms}ms` });

/** 氛围层的延迟写法：本层淡入慢（2.4s），所以不能复用 .term-rise 的 0.3s。 */
const fadeAt = (ms) => ({ animationDelay: `${ms}ms` });

/** 雾团：三块大范围径向渐变，颜色取终端的青与骨白，位置各不相同。 */
const SKY_BLOBS = [
  { left: '-10%', top: '8%', size: '62vw', color: 'rgba(79, 168, 216, 0.20)' },
  { left: '48%', top: '-6%', size: '54vw', color: 'rgba(232, 226, 210, 0.10)' },
  { left: '18%', top: '52%', size: '70vw', color: 'rgba(79, 168, 216, 0.13)' },
];

export default function IntroScene() {
  const enter = useGameStore((s) => s.enter);
  const calm = useMemo(() => preferCalm(), []);

  // 减少动效时所有装饰层都不生成：它们纯氛围，省下的渲染对弱机是实打实的。
  // 注意这里连"生成再隐藏"都不做 —— 那样 DOM 里仍然挂着几十个元素。
  const budget = useMemo(() => (calm ? { dots: 0, shafts: 0, ridges: 0 } : pickLayerBudget()), [calm]);
  const dots = useMemo(() => buildDots(budget.dots), [budget]);
  const shafts = useMemo(() => buildLightShafts(budget.shafts), [budget]);
  const ridges = useMemo(() => buildRidges(budget.ridges), [budget]);

  // 键盘也能进：焦点在第一屏时，回车/空格不该毫无反应
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        enter();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enter]);

  return (
    <div className="term-canvas term-grid min-h-screen relative overflow-hidden flex flex-col">
      {/* ── 四层视差，全部装在推镜容器里共享同一个镜头运动 ──
          顺序即层序：先画的在最下面。z-index 不必写 —— DOM 顺序已经说明了一切。 */}
      <div className="intro-push" aria-hidden="true">
        {/* 第 1 层 · 雾团：没有它，深色底就是纯黑，推镜也看不出来（黑背景放大还是黑） */}
        <div className="intro-sky intro-fade" style={fadeAt(LAYER_REVEAL.sky)}>
          {SKY_BLOBS.map((b, i) => (
            <span
              key={i}
              style={{
                left: b.left,
                top: b.top,
                width: b.size,
                height: b.size,
                background: `radial-gradient(circle, ${b.color}, transparent 70%)`,
                animationDelay: `${i * 3.4}s`,
              }}
            />
          ))}
        </div>

        {/* 第 2 层 · 几何剪影：自创的"建筑天际线"。参考站用的是实拍级素材，版权归 lowiro，
            所以这里换成 clip-path 拼的几何块 —— 效果弱一些，但零素材依赖、可安全公开。 */}
        <div className="intro-fade absolute inset-0" style={fadeAt(LAYER_REVEAL.ridge)}>
          {ridges.map((r) => (
            <span
              key={r.key}
              className="intro-ridge"
              style={{
                left: r.left,
                width: r.width,
                height: r.height,
                opacity: r.opacity,
                transform: `skewX(${r.skew})`,
              }}
            />
          ))}
        </div>

        {/* 第 3 层 · 光带：参考站前景里最显眼的特征（一排竖直细线）。
            没画成"雨"——雨是斜的、有落差感的；这里要的是静止的光柱在极慢明灭。 */}
        <div className="intro-fade absolute inset-0 overflow-hidden" style={fadeAt(LAYER_REVEAL.shaft)}>
          {shafts.map((s) => (
            <span
              key={s.key}
              className="intro-shaft"
              style={{
                left: s.left,
                width: s.width,
                height: s.height,
                top: s.top,
                opacity: s.opacity,
                animationDuration: s.duration,
                animationDelay: s.delay,
              }}
            />
          ))}
        </div>

        {/* 第 4 层 · 光点：分三档深度，大小/速度/亮度各不相同 */}
        <div className="intro-fade absolute inset-0" style={fadeAt(LAYER_REVEAL.dots)}>
          {dots.map((d) => (
            <span
              key={d.key}
              className="term-dot"
              style={{
                left: d.left,
                bottom: d.bottom,
                width: d.size,
                height: d.size,
                animationDuration: d.duration,
                animationDelay: d.delay,
                '--sway': d.sway,
                '--dot-peak': d.opacity,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── 屏幕质感层：不参与推镜，所以放在 .intro-push 外面 ──
          它们模拟的是"显示器本身"，不是"显示器里的世界"。
          跟着推镜一起放大会露馅 —— 扫描线和 CRT 细纹应该恒定不动。 */}
      <div className="term-crt" />
      {!calm && <div className="term-scan" />}

      {/* ── 顶栏：像终端的状态条，不是导航 ── */}
      <div
        className="term-rise relative z-10 flex items-center justify-between px-6 py-5 text-[11px] term-mono"
        style={{ color: TERMINAL.inkDim, ...at(INTRO_TIMING.kicker) }}
      >
        <span>CAMPUS&nbsp;ARCHIVE&nbsp;//&nbsp;TERMINAL&nbsp;v3</span>
        <span className="hidden sm:inline">基准人群 2000 · 已就绪</span>
        <span style={{ color: TERMINAL.ok }}>●&nbsp;ONLINE</span>
      </div>

      {/* ── 两侧立绘 ──
          两个角色是同一个人的两种可能：左边偏学术（青），右边偏运动（琥珀），
          正好用掉终端的两个强调色 —— 「平行宇宙」这件事因此不用写一个字就能看出来。

          只在 md 以上出现：窄屏放不下，硬挤会把标题压成两行。
          alt 留空 + aria-hidden：它们是装饰，读屏软件不该念出"图片"。

          素材是 AI 生成的，来源与授权状态见 docs/素材说明.md。

          动画用 .intro-fade（2.4s）而不是 .term-rise（0.3s）：
          立绘是"环境的一部分"，该和雾团一起慢慢浮出来，而不是"啪"地弹入。
          z-index 压在最底，让它们待在雾与光带之后。 */}
      <img
        src="/art/student-academic.webp"
        alt=""
        aria-hidden="true"
        className="intro-fade hidden md:block absolute bottom-0 left-[2%] lg:left-[6%] h-[60vh] max-h-[540px] w-auto select-none pointer-events-none z-[1]"
        style={fadeAt(LAYER_REVEAL.ridge + 240)}
      />
      <img
        src="/art/student-sporty.webp"
        alt=""
        aria-hidden="true"
        className="intro-fade hidden md:block absolute bottom-0 right-[2%] lg:right-[6%] h-[60vh] max-h-[540px] w-auto select-none pointer-events-none z-[1]"
        style={fadeAt(LAYER_REVEAL.ridge + 420)}
      />

      {/* ── 中央 ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="term-rise" style={at(INTRO_TIMING.crest)}>
          <Crest />
        </div>

        <p
          className="term-rise term-mono mt-7 mb-3 text-[11px]"
          style={{ color: TERMINAL.cyan, ...at(INTRO_TIMING.rule) }}
        >
          {'// 个人青春行为图谱'}
        </p>

        <h1
          className="term-rise text-3xl sm:text-5xl tracking-tight"
          style={{ fontWeight: 500, color: TERMINAL.ink, ...at(INTRO_TIMING.title) }}
        >
          你的大学平行宇宙
        </h1>

        <p
          className="term-rise mt-5 text-sm sm:text-base leading-7 max-w-md"
          style={{ color: TERMINAL.inkSoft, ...at(INTRO_TIMING.subtitle) }}
        >
          {QUESTIONS.length} 道题，决定了你在哪一层宇宙
          <br />
          两千个人的数据在这里等着和你的答案对上
        </p>

        <p
          className="term-rise term-mono mt-8 text-[11px] leading-6"
          style={{ color: TERMINAL.inkDim, ...at(INTRO_TIMING.meta) }}
        >
          零准备 · 不上传任何数据 · 约 1 分钟
        </p>
      </div>

      {/* ── 进入：参考站放在**左下角**，正中留给纹章 ──
          这个位置关系不是随意的：正中一旦有按钮，整屏就读成
          "一个等待操作的对话框"；挪到角落，它才读成
          "一整片环境，你随时可以走进去"。窄屏由 CSS 改回居中。

          同时保持"从第一时刻就可点"——慢节奏是给愿意看的人的礼物，不是收费站。 */}
      <div className="intro-enter term-rise flex flex-col gap-4" style={at(INTRO_TIMING.cta)}>
        <span className="term-mono text-[11px]" style={{ color: TERMINAL.inkSoft }}>
          欢迎回来
        </span>
        <button
          type="button"
          onClick={enter}
          className="term-panel term-mono group relative px-10 py-3.5 text-sm transition-colors self-start"
          style={{ color: TERMINAL.amber, border: `1px solid ${TERMINAL.line}` }}
        >
          <span className="relative z-10 tracking-[0.2em]">进入终端</span>
          <span
            className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(245, 166, 35, 0.08)' }}
          />
        </button>
        <span className="term-mono text-[10px]" style={{ color: TERMINAL.inkDim }}>
          或按 Enter
        </span>
      </div>
    </div>
  );
}

/**
 * 纹章：六边形 + 内环 + 中心菱形 + 对称射线 + 缓慢旋转的外环。
 * 全对称是有意的 —— 不对称的图形会读成"某个 logo"，对称的才读成"某台机器的标志"。
 *
 * 旋转外环（.term-orbit，24s 一圈）是本版新加的：参考站的中心纹章虽然静态，
 * 但整屏仍在动（推镜 + 粒子），中心需要一个"自身也在动"的锚点，
 * 否则视线落上去会觉得那里是张图片。24 秒慢到第一眼看不出来，盯着看它是活的。
 */
function Crest() {
  return (
    <svg width="112" height="112" viewBox="0 0 120 120" role="img" aria-label="终端纹章">
      <title>终端纹章</title>
      <polygon
        points="60,4 108,32 108,88 60,116 12,88 12,32"
        fill="none"
        stroke={TERMINAL.cyan}
        strokeWidth="1"
        opacity="0.45"
      />
      <polygon
        points="60,20 96,40 96,80 60,100 24,80 24,40"
        fill="none"
        stroke={TERMINAL.amber}
        strokeWidth="1"
        opacity="0.8"
      />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <line
          key={deg}
          x1="60"
          y1="34"
          x2="60"
          y2="44"
          stroke={TERMINAL.cyan}
          strokeWidth="1"
          opacity="0.5"
          transform={`rotate(${deg} 60 60)`}
        />
      ))}
      <polygon points="60,46 74,60 60,74 46,60" fill={TERMINAL.amber} opacity="0.9" />
      <polygon
        className="term-breathe"
        points="60,30 86,45 86,75 60,90 34,75 34,45"
        fill="none"
        stroke={TERMINAL.bone}
        strokeWidth="0.75"
      />
      {/* 外圈虚线环，缓慢自转。虚线的断口让旋转能被看出来 ——
          实线圆环转起来是完全静态的，转了等于没转。 */}
      <circle
        className="term-orbit"
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke={TERMINAL.cyan}
        strokeWidth="0.6"
        strokeDasharray="2 7"
        opacity="0.4"
      />
    </svg>
  );
}
