/**
 * 切角面板（浅色版）—— 内容区的基本容器。
 *
 * 直接用 `<div style={{clipPath: ...}}>` 也能出形状，那为什么还要一个组件：
 * **描边**。clip-path 会把 border 在切角处一起裁掉，
 * 结果是四个角上各少一截线，看起来像渲染出错。
 * 正确做法是在外层再画一个同样形状、大一圈的块，露出 1px 当描边。
 * 这个"外框 + 内芯"的结构有三处细节（外框形状、内芯内缩、两层同几何），
 * 散在二十个调用点上一定会写错，所以收进组件。
 *
 * ⚠️ 两层必须用**同一个切角尺寸**，且内芯各方向内缩 1px。
 *    内芯若用 CUT_SIZE - 1，切角处的两条斜边会错开 1px，边上会出现毛刺。
 *
 * ⚠️ 切角尺寸随面板宽度走：窄块用 14，宽块用 22。
 *    差别在 surface.js 里说明了 —— 一句话，太小的切角等于没切，只是难看。
 *
 * ★ 10-14 美化：给面板加**层次**。
 *   原来所有卡片都是"一张平白纸 + 1px 灰边"，页面上根本分不出
 *   哪些是容器、哪些是重点 —— 这是"素"最直接的来源。
 *   加阴影有个坑：**clip-path 会把 box-shadow 一起裁掉**，
 *   所以不能用 box-shadow，必须用 `filter: drop-shadow()`
 *   （drop-shadow 跟的是裁剪后的实际形状，切角处会正确地缺一块）。
 *   代价：drop-shadow 会建合成层，所以默认只给最轻的一档（2px 模糊），
 *   大面积列表（地图页那种几十张卡）要显式传 shadow="none"。
 */

import { CUT_SIZE, CUT_SIZE_WIDE } from '../lib/surface.js';

const shape = (n) =>
  `polygon(0 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% 100%, ${n}px 100%, 0 calc(100% - ${n}px))`;

/**
 * 三档阴影。都用 drop-shadow（理由见文件头），不用 box-shadow。
 * 模糊半径刻意压得很小 —— 这个项目有过背景动画 + 多层模糊导致掉帧的教训，
 * 阴影只要"能浮起来"就够，10px 以上的柔边在浅色页面上反而显脏。
 */
const SHADOW = {
  none: 'none',
  sm: 'drop-shadow(0 1px 2px rgba(15,23,42,0.07)) drop-shadow(0 1px 1px rgba(15,23,42,0.04))',
  md: 'drop-shadow(0 4px 10px rgba(15,23,42,0.10)) drop-shadow(0 1px 3px rgba(15,23,42,0.06))',
  lg: 'drop-shadow(0 14px 30px rgba(15,23,42,0.16)) drop-shadow(0 4px 10px rgba(15,23,42,0.08))',
};

/**
 * @param {'sm'|'md'} [cut] 切角档位。窄块用 'sm'（14px），宽卡片用 'md'（22px）
 * @param {string} [variant] 'surface'（默认，白底）| 'canvas'（浅灰底）
 * @param {boolean} [hoverable] 鼠标移上去时底色变一点（用在可点的卡片上）
 * @param {'none'|'sm'|'md'|'lg'} [shadow] 阴影档位，默认 'sm'
 * @param {boolean} [lift] 鼠标移上去时微微抬起（可点卡片用）
 * @param {'accent'|'warm'|null} [tick] 左上角的小色标，标出"这张卡是重点"
 */
export default function TermPanel({
  children,
  className = '',
  cut = 'sm',
  variant = 'surface',
  hoverable = false,
  shadow = 'sm',
  lift = false,
  tick = null,
  brackets = false,
  style,
  ...rest
}) {
  const n = cut === 'md' ? CUT_SIZE_WIDE : CUT_SIZE;
  const clip = shape(n);
  const fill = variant === 'canvas' ? 'var(--canvas)' : 'var(--surface)';
  const tickColor = tick === 'warm' ? 'var(--accent-warm)' : 'var(--accent)';

  return (
    <div
      className={['relative group', lift ? 'ci-lift' : '', className].filter(Boolean).join(' ')}
      style={{ filter: SHADOW[shadow] ?? SHADOW.sm, ...style }}
      {...rest}
    >
      {/* 外层：只负责 1px 的描边。它比内芯大 1px，被裁剩的那圈就形成了边线 */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        // ★ 10-15：描边从 #e5e7eb 换成可见的冷青。
        //   白纸时代灰描边够用；压在动漫天空上时它和云一样亮，卡片边界就没了。
        style={{ background: 'rgba(21, 107, 122, 0.18)', clipPath: clip }}
      />
      {/* 内芯：真正装内容的层，各方向内缩 1px 让外层露出来。
          ★ 10-14：底色从纯白改成极淡的竖向渐变 —— 同样是白，
            有渐变的会让人读出"这是一个面"，纯色块则像页面本身。 */}
      <span
        aria-hidden="true"
        className={`absolute transition-colors ${hoverable ? 'group-hover:bg-[var(--canvas)]' : ''}`}
        style={{
          inset: 1,
          // ★ 10-15：内芯从"纯白渐变"改成 0.9 的玻璃白。
          //   整站背景已经是动漫天空，卡片要"浮在画面上但不遮住画面"。
          //   0.9 的不透明度足以保证任何正文读得清，同时让天空透一口气。
          background: variant === 'canvas' ? 'var(--canvas)' : 'rgba(255, 255, 255, 0.90)',
          clipPath: clip,
        }}
      />
      {/* 方舟式角标：四段短 L 线。比一圈完整描边轻，比什么都没有贵 ——
          一眼就知道这块是"被框住的仪表"。只在整行宽的块上开（见 TermBlock）。 */}
      {brackets && (
        <>
          <span aria-hidden="true" className="ark-bracket ark-bracket-tl" />
          <span aria-hidden="true" className="ark-bracket ark-bracket-tr" />
          <span aria-hidden="true" className="ark-bracket ark-bracket-bl" />
          <span aria-hidden="true" className="ark-bracket ark-bracket-br" />
        </>
      )}
      {/* 角标：左上角一小段色条。它不占布局，只给"这张卡是重点"一个落点 */}
      {tick && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0"
          style={{ width: 3, height: 26, background: tickColor }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * 报告页/欢迎页里「一段内容」的容器：切角 + 内边距。
 * 默认用宽切角 —— 它服务的都是整行宽度的块。
 */
export function TermBlock({
  children,
  className = '',
  hoverable = false,
  variant,
  cut = 'md',
  shadow = 'sm',
  lift = false,
  tick = null,
  brackets = true,
  style,
}) {
  return (
    <TermPanel
      cut={cut}
      variant={variant}
      hoverable={hoverable}
      shadow={shadow}
      lift={lift}
      tick={tick}
      brackets={brackets}
      className={className}
      style={{ padding: '18px 20px', ...style }}
    >
      {children}
    </TermPanel>
  );
}
