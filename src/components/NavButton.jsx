/**
 * NavButton —— 全局导航按钮（返回 / 主页 / 终端）。
 *
 * 用户 10-15 原话：「为一些那些返回按键，或者是主页按键，做一些大的按钮」。
 *
 * ── 改之前它们是什么样 ──────────────────────────────────────────
 * 全站的导航全是 11px 的等宽小字（`◄ 主页`、`◄ 终端`、`← 返回主页`），
 * 没有边框、没有底色，只在 hover 时提一点透明度。
 * 在深色终端时代那是"仪表上的小标"，成立；
 * 换成动漫天空之后它们**直接压在云上**，既看不清、也点不中
 * （实测热区只有 39×17，手机上基本点不到）。
 *
 * ── 这一版的四条规矩 ────────────────────────────────────────────
 *  ① **高度 ≥ 40px**（WCAG 2.5.8 要求 24，Apple HIG 建议 44；取 40 是两者的折中）。
 *     它同时解决了可点性与"看得见"两件事。
 *  ② **玻璃底 + 冷色描边**。压在天空上必须有自己的底，否则和云糊在一起。
 *  ③ **图标 + 文字**。纯文字按钮在扫读时会被当成正文；
 *     加一个方向符号，人一眼就知道"这是往回走"。
 *  ④ **主次分两档**：`primary`（去主页/回地图这类主干动作）用实心主色；
 *     `plain`（次一级的返回）用玻璃。同屏出现两三个时不会互相抢。
 *
 * 为什么做成组件而不是在各处改样式：
 *   导航按钮散在 5 个组件里（HUD / 地图 / 报告 / 答题 / 上传）。
 *   各改各的，下次调尺寸又得找一遍 —— 而且一定会漏一个。
 */

import { monoTag } from '../lib/surface.js';

/**
 * @param {'plain'|'primary'} [tone] 主次。primary 用实心主色，plain 用玻璃
 * @param {'md'|'lg'} [size] md=40px（页内次级），lg=44px（主干动作）
 */
export default function NavButton({
  children,
  onClick,
  icon = '←',
  tone = 'plain',
  size = 'md',
  title,
  className = '',
  ...rest
}) {
  const primary = tone === 'primary';
  const h = size === 'lg' ? 44 : 40;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-2 px-4 transition-all duration-150 ci-lift ${className}`}
      style={{
        minHeight: h,
        // 斜切角：与全站面板同一套几何语言
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
        background: primary ? 'var(--grad-ark)' : 'rgba(255, 255, 255, 0.88)',
        border: primary ? '1px solid transparent' : '1px solid rgba(21, 107, 122, 0.22)',
        color: primary ? '#ffffff' : 'var(--ink-strong)',
        boxShadow: primary ? 'var(--shadow-ark)' : '0 6px 18px -10px rgba(16, 42, 78, 0.35)',
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="shrink-0"
        style={{ ...monoTag({ fontSize: 13, fontWeight: 700 }), lineHeight: 1 }}
      >
        {icon}
      </span>
      <span className="text-[13px] font-medium whitespace-nowrap">{children}</span>
    </button>
  );
}
