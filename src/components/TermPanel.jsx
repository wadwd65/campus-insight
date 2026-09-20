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
 */

import { CUT_SIZE, CUT_SIZE_WIDE } from '../lib/surface.js';

const shape = (n) =>
  `polygon(0 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% 100%, ${n}px 100%, 0 calc(100% - ${n}px))`;

/**
 * @param {'sm'|'md'} [cut] 切角档位。窄块用 'sm'（14px），宽卡片用 'md'（22px）
 * @param {string} [variant] 'surface'（默认，白底）| 'canvas'（浅灰底）
 * @param {boolean} [hoverable] 鼠标移上去时底色变一点（用在可点的卡片上）
 */
export default function TermPanel({
  children,
  className = '',
  cut = 'sm',
  variant = 'surface',
  hoverable = false,
  style,
  ...rest
}) {
  const n = cut === 'md' ? CUT_SIZE_WIDE : CUT_SIZE;
  const clip = shape(n);
  const fill = variant === 'canvas' ? 'var(--canvas)' : 'var(--surface)';

  return (
    <div className={`relative group ${className}`} style={style} {...rest}>
      {/* 外层：只负责 1px 的描边。它比内芯大 1px，被裁剩的那圈就形成了边线 */}
      <span
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'var(--line)', clipPath: clip }}
      />
      {/* 内芯：真正装内容的层，各方向内缩 1px 让外层露出来 */}
      <span
        aria-hidden="true"
        className={`absolute transition-colors ${hoverable ? 'group-hover:bg-[var(--canvas)]' : ''}`}
        style={{ inset: 1, background: fill, clipPath: clip }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * 报告页/欢迎页里「一段内容」的容器：切角 + 内边距。
 * 默认用宽切角 —— 它服务的都是整行宽度的块。
 */
export function TermBlock({ children, className = '', hoverable = false, variant, cut = 'md', style }) {
  return (
    <TermPanel
      cut={cut}
      variant={variant}
      hoverable={hoverable}
      className={className}
      style={{ padding: '18px 20px', ...style }}
    >
      {children}
    </TermPanel>
  );
}
