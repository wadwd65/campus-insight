/**
 * 内容区的终端化标题件：等宽小标（MonoTag）与章节标题（SectionHead）。
 *
 * 这两个在入场里是"主角"（`// 个人青春行为图谱`、`CAMPUS ARCHIVE // TERMINAL v3`），
 * 到了内容区却是完全缺席的 —— 报告页的标题是一行普通的 `<h3>`。
 * 这就是四页之间气质断裂最直接的原因：**形式语言只在场景层存在，没往下传。**
 *
 * 把它们做成组件而不是散落的 className，理由和别处一致：
 * 「01 // 标题」这个组合里有三个需要一致的量（编号宽度、分隔符、间距），
 * 散着写迟早会出现"这里用 // 那里用 ·"、"编号这里补零那里没补"。
 */

import { monoTag, sectionIndex } from '../lib/surface.js';

/**
 * 等宽小标 —— 一行 `// 说明文字` 或 `CAMPUS ARCHIVE // v3`。
 *
 * @param {string} [tone] 'soft'（默认，次要）| 'cyan' | 'amber'
 *   cyan / amber 取自入场立绘的两色，用在需要"终端在说话"的地方
 */
export function MonoTag({ children, tone = 'soft', className = '', style }) {
  const color =
    tone === 'cyan' ? '#4fa8d8' : tone === 'amber' ? '#f5a623' : 'var(--ink-soft)';
  return (
    <span className={className} style={monoTag({ color, ...style })}>
      {children}
    </span>
  );
}

/**
 * 章节标题：`01 // 大学生活者画像` + 可选副标题。
 *
 * 编号不是为了好看 —— 报告页本来就让五块内容分四拍依次出现
 * （见 ReportView.jsx 的注释），编号是那个"依次"在视觉上的落点：
 * 滚动的时候，人始终知道自己在第几块。
 */
export function SectionHead({ index, title, hint }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2.5">
        <span style={monoTag({ color: 'var(--ink-soft)', fontSize: 12 })}>
          {sectionIndex(index)}
        </span>
        <span style={monoTag({ color: 'var(--line)', fontSize: 12 })}>//</span>
        <h3 className="text-base font-medium text-[var(--ink)]">{title}</h3>
      </div>
      {hint && (
        <p className="mt-1.5 text-xs text-[var(--ink-soft)] leading-5" style={{ paddingLeft: 30 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
