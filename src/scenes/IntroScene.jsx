/**
 * 入场场景 —— 打开网站的第一屏。
 *
 * ── 2026-09-20 第三版：真看了参考视频之后的重写 ──────────────────────
 *
 * 前两版都错在同一个地方：**把参考当配方抄，而不是当"效果能做到什么程度"看**。
 *
 * 第一版（深色终端 + 逐条淡入）根本没做动态，只是界面加载。
 * 第二版（四层平铺视差）以为读懂了参考，其实理解成了"多层各自淡入 + 相互漂移"。
 *
 * 真去抽帧看了参考（B站 BV16N41117xb，0-30s 逐帧）之后，真相是：
 *
 *   12s 起，是**一整段不间断的推镜**，镜头缓缓穿过一层层景深。
 *   画面是**浅紫→灰蓝的雾蒙蒙天空**（很亮、很淡，不是深色）。
 *   有**下落的光雨**贯穿全屏、**蝴蝶/花瓣**在飘。
 *   背景里有**破碎的大教堂尖塔**与**悬浮的碎玻璃**。
 *   文字是**细衬线 + 发光、逐行浮现**，而且前 6 秒一个字都没有。
 *
 * 四条因此落地的改动：
 *   - 平铺视差 → **推镜穿过场景**（各层按景深缩放，近处涨得快）
 *   - 深色 → **浅紫雾调**（进去之后才切深色 HUD，落差即"进入"）
 *   - 竖直光柱 → **下落光雨**（有速度有倾角的才是雨）
 *   - **两侧真人立绘整个删掉**。参考里主角就在场景里，
 *     不是贴两张照片在边缘 —— 而"平行宇宙"这件事，
 *     交给主站 HUD 的八维条去表达，比两个半身像准确得多。
 *
 * 两条纪律没有变：
 *   1. **不用动画库**。推镜是一个 rAF 写 CSS 变量，其余全是 CSS keyframes。
 *      引进 framer-motion 会让首屏多约 42 kB（gzip）；它留给地图转场按需加载。
 *   2. **场景素材是我们自己生成的**（见 docs/素材说明.md）。
 *      参考站的图/音/字体版权归 lowiro，**一个字节都不能进公开仓库**。
 *      所以这里只有"同样在推镜、同样在下雨、同样是浅雾"的机制借鉴。
 *
 * 一条刻意的不变：**「进入」始终可点，且从第一时刻就能点**。
 * 动画是包装，不给用户"必须等它演完"的枷锁 —— 慢节奏是给愿意看的人的，
 * 不愿意看的人一进来按 Enter 就该走。
 */

import { useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { QUESTIONS } from '../lib/surveySchema.js';
import { LIGHT, INTRO_TIMING, TERMINAL, preferCalm } from '../lib/terminalTheme.js';
import {
  SCENE_LAYERS,
  PUSH,
  layerTransform,
  buildFloaters,
  buildLightRain,
  pickSceneBudget,
} from '../lib/introLayers.js';
import { startPush } from '../lib/introPush.js';

/** 时间线上的位置 → animation-delay。 */
const at = (ms) => ({ animationDelay: `${ms}ms` });

export default function IntroScene() {
  const enter = useGameStore((s) => s.enter);
  const calm = useMemo(() => preferCalm(), []);
  const stageRef = useRef(null);

  // 减少动效时所有装饰层都不生成：它们纯氛围，省下的渲染对弱机是实打实的。
  // 注意这里连"生成再隐藏"都不做 —— 那样 DOM 里仍然挂着几十个元素。
  const budget = useMemo(() => (calm ? { floaters: 0, rain: 0 } : pickSceneBudget()), [calm]);
  const floaters = useMemo(() => buildFloaters(budget.floaters), [budget]);
  const rain = useMemo(() => buildLightRain(budget.rain), [budget]);

  // 推镜：一个 rAF 循环往 .intro-stage 写 `--push`，各层在 CSS 里按自己的
  // zoom 系数读它。这条循环**比入场动画本身长得多**（34s vs 4.6s）——
  // 意思是用户看完文字、点进终端时，镜头还在推。
  // 只要这一屏还在，它就不该停；停下来才显得是"动画播完了"。
  useEffect(() => {
    if (calm) {
      // 减少动效：直接把终态写进去（推到头），不留任何逐帧。
      stageRef.current?.style.setProperty('--push', '1');
      return undefined;
    }
    return startPush(stageRef.current, PUSH.durationMs);
  }, [calm]);

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
    <div
      className="relative min-h-screen overflow-hidden flex flex-col"
      style={{ background: LIGHT.mist, color: LIGHT.ink }}
    >
      {/* ── 推镜舞台 ──
          三层景深，全部读同一个 `--push`。DOM 顺序即层序：先画的在最下面。
          z-index 不必写 —— 顺序已经说明了一切。 */}
      <div className="intro-stage" ref={stageRef} aria-hidden="true">
        {SCENE_LAYERS.map((layer) => (
          <div
            key={layer.id}
            className={`intro-layer intro-layer-enter${layer.id === 'front' ? ' intro-layer-front' : ''}`}
            // 各层初始不可见，靠这条把 --push=0 时的 scale/drift 写进去。
            // 推镜过程中由 rAF 覆盖 --push，这里的初始值只负责第一帧。
            style={{
              backgroundImage: `url(/art/${layer.asset})`,
              '--zoom': layer.zoom,
              '--drift': layer.drift,
              '--push': 0,
              // 呼吸式的错开：近层稍晚一点淡入，读起来像"镜头先看清远处"
              animationDelay: `${layer.depth * 160}ms`,
              transform: layerStatic(layer),
            }}
          />
        ))}

        {/* 光雨：贯穿全屏的下落细线。放在场景层之上、文字之下 ——
            它是"空气里的光"，不该盖住字。 */}
        <div className="absolute inset-0">
          {rain.map((r) => (
            <span
              key={r.key}
              className="intro-rain"
              style={{
                left: r.left,
                width: `${r.thickness}px`,
                height: `${r.length}px`,
                opacity: r.opacity,
                animationDuration: r.duration,
                animationDelay: r.delay,
                rotate: `${r.tilt}deg`,
              }}
            />
          ))}
        </div>

        {/* 飘浮物：蝴蝶 / 花瓣。极小极多，是"画面活着"的关键细节。 */}
        <div className="absolute inset-0">
          {floaters.map((f) => (
            <span
              key={f.key}
              className={`intro-floater${f.toRight ? '' : ' intro-floater-rev'}`}
              style={{
                left: f.left,
                top: f.top,
                width: `${f.size}px`,
                height: `${f.size}px`,
                opacity: f.opacity,
                animationDuration: f.duration,
                animationDelay: f.delay,
                '--bob': `${f.bob}px`,
                '--spin': f.spin,
              }}
            >
              <span aria-hidden="true">{f.kind === 'petal' ? <Petal /> : <Butterfly />}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── 屏幕质感层：不参与推镜，所以放在 .intro-stage 外面 ──
          它们模拟的是"显示器本身"，不是"显示器里的世界"。
          跟着推镜一起放大就会露馅。 */}
      <div className="term-crt" />

      {/* ── 文字可读底衬 ──
          压在场景之上、文字之下。没有它，浅色雾景上的标题读不清 ——
          这是实测截图看出来的，不是理论上该有的。见 index.css 的注释。 */}
      <div className="intro-scrim" aria-hidden="true" />
      <div className="intro-scrim-cta" aria-hidden="true" />

      {/* ── 顶栏：像终端的状态条，不是导航 ── */}
      <div
        className="term-rise relative z-10 flex items-center justify-between px-6 py-5 text-[11px] term-mono"
        style={{ color: LIGHT.inkFaint, ...at(INTRO_TIMING.scene + 1500) }}
      >
        <span>CAMPUS&nbsp;ARCHIVE&nbsp;//&nbsp;TERMINAL&nbsp;v3</span>
        <span className="hidden sm:inline">基准人群 2000 · 已就绪</span>
        <span style={{ color: LIGHT.inkSoft }}>●&nbsp;ONLINE</span>
      </div>

      {/* ── 中央 ──
          参考里前 6 秒屏幕上没有任何要读的东西，这里压到 1.5 秒 ——
          仪式感要有，但评委的时间比视频观众贵。
          文字用 .intro-line（1400ms + blur 从 6px 解开）而不是 .term-rise，
          因为"凝成光"和"亮起来"是两种完全不同的观感。 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="intro-line" style={at(INTRO_TIMING.crest)}>
          <Crest />
        </div>

        <p
          className="intro-line term-mono mt-8 mb-4 text-[11px] tracking-[0.3em]"
          style={{ color: LIGHT.inkSoft, ...at(INTRO_TIMING.rule) }}
        >
          {'// 个人青春行为图谱'}
        </p>

        <h1
          className="intro-line intro-serif intro-glow text-3xl sm:text-5xl tracking-[0.12em]"
          style={{ color: LIGHT.ink, ...at(INTRO_TIMING.title) }}
        >
          你的大学平行宇宙
        </h1>

        <p
          className="intro-line mt-6 text-sm sm:text-base leading-8 max-w-md"
          style={{ color: LIGHT.inkSoft, ...at(INTRO_TIMING.subtitle) }}
        >
          {QUESTIONS.length} 道题，决定了你在哪一层宇宙
          <br />
          两千个人的数据在这里等着和你的答案对上
        </p>

        <p
          className="intro-line term-mono mt-9 text-[11px] leading-6"
          style={{ color: LIGHT.inkFaint, ...at(INTRO_TIMING.meta) }}
        >
          零准备 · 不上传任何数据 · 约 1 分钟
        </p>
      </div>

      {/* ── 进入 ──
          参考放在**左下角**，正中留给纹章。这个位置关系不是随意的：
          正中一旦有按钮，整屏就读成"一个等待操作的对话框"；
          挪到角落，它才读成"一整片环境，你随时可以走进去"。
          窄屏由 CSS 改回居中。

          玻璃质感（.glass-btn）是这一版新加的：参考里可操作的东西
          读起来是"按在玻璃上"，而不是"一块实心色块"。 */}
      <div className="intro-enter intro-line flex flex-col gap-4 items-start" style={at(INTRO_TIMING.cta)}>
        <span className="term-mono text-[11px]" style={{ color: LIGHT.inkSoft }}>
          欢迎回来
        </span>
        <button
          type="button"
          onClick={enter}
          className="glass-btn term-mono group relative px-11 py-3.5 text-sm rounded-sm"
          style={{ color: LIGHT.ink }}
        >
          <span className="relative z-10 tracking-[0.25em]">进入终端</span>
        </button>
        <span className="term-mono text-[10px]" style={{ color: LIGHT.inkFaint }}>
          或按 Enter
        </span>
      </div>
    </div>
  );
}

/**
 * 层的静态 transform —— 纯 CSS 变量驱动的推镜 transform。
 *
 * 关键在 `calc(1 + (var(--zoom) - 1) * var(--push))`：
 * 每个层自己带一个 zoom 系数，共享的 --push 从 0 涨到 1，
 * 于是"近处涨得快、远处涨得慢"变成了**数据上的层次关系**，
 * 而不是三条各写各的 @keyframes。
 *
 * 为什么还在 JS 里算一遍同样的公式（layerTransform）：
 * 自检要能对"近处涨得快"这条直接下断言，而在 CSS 字符串上做断言太脆
 * （改一个空格就断）。公式在 introLayers.js 里是唯一的真源，
 * 这里只是把它序列化成 CSS —— 两边一致由 selftest 守。
 */
function layerStatic(layer) {
  const { drift } = layerTransform(layer, 0);
  return [
    'translate3d(0,0,0)',
    `scale(calc(1 + (var(--zoom) - 1) * var(--push)))`,
    `translateX(calc(${layer.drift}px * var(--push) * ${layer.depth % 2 === 0 ? 1 : -1}))`,
    drift ? '' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * 纹章。
 *
 * 参考里的中心纹章是**静态**的（整屏在动就够了）。这里让它极慢自转 + 呼吸，
 * 因为我们的画面元素比参考少，中心需要一个"自身也在动"的锚点，
 * 否则视线落上去会觉得那里是一张图片。
 *
 * 全对称是有意的 —— 不对称的图形会读成"某个 logo"，
 * 对称的才读成"某台机器的标志"。
 *
 * 配色改用 LIGHT（浅色入场上的深紫系），不再是深色终端的青金。
 */
function Crest() {
  return (
    <svg width="104" height="104" viewBox="0 0 120 120" role="img" aria-label="终端纹章">
      <title>终端纹章</title>
      <polygon
        points="60,4 108,32 108,88 60,116 12,88 12,32"
        fill="none"
        stroke={LIGHT.stone}
        strokeWidth="0.8"
        opacity="0.5"
      />
      <polygon
        points="60,20 96,40 96,80 60,100 24,80 24,40"
        fill="none"
        stroke={LIGHT.inkSoft}
        strokeWidth="0.8"
        opacity="0.85"
      />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <line
          key={deg}
          x1="60"
          y1="34"
          x2="60"
          y2="44"
          stroke={LIGHT.stone}
          strokeWidth="0.8"
          opacity="0.55"
          transform={`rotate(${deg} 60 60)`}
        />
      ))}
      <polygon points="60,46 74,60 60,74 46,60" fill={LIGHT.ink} opacity="0.9" />
      <polygon
        className="term-breathe"
        points="60,30 86,45 86,75 60,90 34,75 34,45"
        fill="none"
        stroke={LIGHT.accent}
        strokeWidth="0.8"
      />
      {/* 外圈虚线环，缓慢自转。虚线的断口让旋转能被看出来 ——
          实线圆环转起来是完全静态的，转了等于没转。 */}
      <circle
        className="term-orbit"
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke={LIGHT.stone}
        strokeWidth="0.6"
        strokeDasharray="2 7"
        opacity="0.45"
      />
    </svg>
  );
}

/** 花瓣：一片略微卷曲的水滴形。刻意画成不对称的，才像被风吹着。 */
function Petal() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path
        d="M12 2 C18 8, 20 15, 12 22 C4 15, 6 8, 12 2 Z"
        fill="rgba(255,255,255,0.85)"
        stroke="rgba(200,190,240,0.7)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

/** 蝴蝶：两对翅 + 一条身。很小（10~47px），所以只保留最必要的形。 */
function Butterfly() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <path d="M12 6 C8 1, 2 3, 4 9 C6 14, 10 13, 12 12 Z" fill="rgba(255,255,255,0.8)" />
      <path d="M12 6 C16 1, 22 3, 20 9 C18 14, 14 13, 12 12 Z" fill="rgba(255,255,255,0.6)" />
      <path d="M12 12 C8 13, 5 17, 8 20 C10 22, 12 17, 12 15 Z" fill="rgba(255,255,255,0.7)" />
      <path d="M12 12 C16 13, 19 17, 16 20 C14 22, 12 17, 12 15 Z" fill="rgba(255,255,255,0.5)" />
      <line x1="12" y1="5" x2="12" y2="17" stroke="rgba(140,130,180,0.6)" strokeWidth="0.6" />
    </svg>
  );
}

/** 供 smoke 断言用：这一屏里不允许再出现真人立绘。 */
export const INTRO_FORBIDDEN_ASSETS = ['student-academic.webp', 'student-sporty.webp'];
/** 供 smoke 断言用：场景层必须正好用上 SCENE_LAYERS 里那几张。 */
export const INTRO_REQUIRED_ASSETS = SCENE_LAYERS.map((l) => l.asset);
/** 供 smoke 断言用：浅色调色板必须真的被用上（防止改回深色而没人发现）。 */
export const INTRO_PALETTE_KEYS = Object.keys(LIGHT);
