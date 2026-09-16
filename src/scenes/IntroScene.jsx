/**
 * 入场场景 —— 打开网站的第一屏。
 *
 * 它要解决的不是"好看"，而是**把这一屏和后面的报告接上**：
 * 报告是浅色的、读数据的；这一屏是深色的、像仪表盘。
 * 两屏之间的落差本身就是"从终端进入报告"的暗示，比加一句"正在加载报告"有用。
 *
 * 四条刻意的安排：
 *   1. **不用动画库**。入场只需要"位移 + 淡入"，CSS 的 animation-delay 就够排一条时间线。
 *      引进 framer-motion 会让首屏包多约 42 kB（gzip）—— 评委点开链接的第一眼，
 *      不该花在下载一个只在地图转场时才用得上的库上（那个场景会按需加载）。
 *   2. **总时长压在 2 秒内**（见 INTRO_TIMING 最后一项）。第一屏不该让人等。
 *   3. **"进入"按钮从第一时刻就可点**。动画只是包装，不给用户"必须等它演完"的枷锁。
 *   4. **减少动效交给 CSS 一次处理**，不在 JS 里写第二套分支：
 *      `index.css` 的 @media (prefers-reduced-motion) 会同时关掉动画与延时，
 *      元素直接显示终态。两处各写一套，迟早会不一致。
 */

import { useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { QUESTIONS } from '../lib/surveySchema.js';
import { TERMINAL, INTRO_TIMING, pickDotCount, preferCalm } from '../lib/terminalTheme.js';

/**
 * 生成背景光点。
 *
 * 不用 Math.random()：同一个组件重渲染时随机值会变，光点会"跳位"。
 * 用一个基于下标的确定性函数，位置固定，但看上去仍然是散的。
 */
function buildDots(n) {
  const rnd = (i, k) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  return Array.from({ length: n }, (_, i) => ({
    key: i,
    left: `${(rnd(i, 1) * 100).toFixed(2)}%`,
    bottom: `${(rnd(i, 2) * 58).toFixed(2)}%`,
    size: 1 + Math.round(rnd(i, 3) * 2),
    duration: `${(6 + rnd(i, 4) * 9).toFixed(1)}s`,
    delay: `${(rnd(i, 5) * 9).toFixed(1)}s`,
  }));
}

/** 时间线上的位置 → animation-delay。元素统一挂 .term-rise。 */
const at = (ms) => ({ animationDelay: `${ms}ms` });

export default function IntroScene() {
  const enter = useGameStore((s) => s.enter);
  const calm = useMemo(() => preferCalm(), []);
  // 减少动效时连光点都不生成：它们纯装饰，省下的渲染对弱机是实打实的
  const dots = useMemo(() => (calm ? [] : buildDots(pickDotCount())), [calm]);

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
      <div className="term-crt" />
      {!calm && <div className="term-scan" />}

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
          }}
        />
      ))}

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

          素材是 AI 生成的，来源与授权状态见 docs/素材说明.md。 */}
      <img
        src="/art/student-academic.webp"
        alt=""
        aria-hidden="true"
        className="term-rise hidden md:block absolute bottom-0 left-[2%] lg:left-[6%] h-[60vh] max-h-[540px] w-auto select-none pointer-events-none"
        style={{ animationDelay: '260ms' }}
      />
      <img
        src="/art/student-sporty.webp"
        alt=""
        aria-hidden="true"
        className="term-rise hidden md:block absolute bottom-0 right-[2%] lg:right-[6%] h-[60vh] max-h-[540px] w-auto select-none pointer-events-none"
        style={{ animationDelay: '380ms' }}
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

      {/* ── 底部：进入 ── */}
      <div
        className="term-rise relative z-10 pb-12 flex flex-col items-center gap-4"
        style={at(INTRO_TIMING.cta)}
      >
        <span className="term-mono text-[11px]" style={{ color: TERMINAL.inkSoft }}>
          欢迎回来
        </span>
        <button
          type="button"
          onClick={enter}
          className="term-panel term-mono group relative px-10 py-3.5 text-sm transition-colors"
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
 * 纹章：六边形 + 内环 + 中心菱形 + 对称射线。
 * 全对称是有意的 —— 不对称的图形会读成"某个 logo"，对称的才读成"某台机器的标志"。
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
    </svg>
  );
}
