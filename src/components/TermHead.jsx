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
 *
 * ★ 10-14：tone 的色值**改成读 CSS 变量**，不再写死十六进制。
 *   原因：同一个 MonoTag 既会落在浅色内容区、也会落在深色顶栏里，
 *   写死一个值必然有一边读不清（实测：琥珀 #f5a623 在浅底只有 1.94）。
 *   现在由**作用域决定取值** —— index.css 的 `.term-canvas` 里已经把
 *   `--accent` / `--accent-warm` / `--ink-soft` 重映射到深色版，
 *   所以这一行代码在浅底拿到深青 #0e7490（5.12 ✓）、
 *   在深色顶栏拿到终端青 #4fa8d8（7.25 ✓），两边都对。
 */
export function MonoTag({ children, tone = 'soft', className = '', style }) {
  const color =
    tone === 'cyan'
      ? 'var(--accent)'
      : tone === 'amber'
        ? 'var(--accent-warm)'
        : 'var(--ink-soft)';
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
 *
 * ★ 10-14 美化：原来的样子是「灰编号 + 灰斜杠 + 普通 h3 + 一行灰注释」，
 *   四个元素全是同一种灰，等于**没有任何层次** —— 这是页面"素"的直接来源。
 *   这里把层次做出来：
 *     ① 编号进一枚描边小徽标（青色描边 + 极淡青底）—— 它变成可扫读的锚点
 *     ② 斜杠改用 --ink-dim（原来用 --line，1.18，等于隐形）
 *     ③ 标题从 16px 常规字提到 17px 中粗、色号用 --ink-strong（17.06）
 *     ④ 标题下方补一条渐变细线：从左到右由实到透，
 *        它比纯灰线"有方向"，把标题和下一段内容在视觉上分开
 */
/**
 * @param {2|3} [level] 标题级别。
 *   ★ 10-14：默认 3，但**每个视图应当恰好有一个 h1**。
 *     上传页 / 班级页的"第一块"就是该页的主标题，原来也是 h3 ——
 *     结果整页没有 h1，屏幕阅读器没法用"按标题跳转"导航。
 *     这里让调用方能把它提到 h1，字号与样式不变（样式由下面这条 className 统一给）。
 * @param {string} [art] 章节插图（绘世出的 WebP，斜切角小图）。
 *   ★ 10-14 v4：这是把"素"变成"有画面"最省力的一处 —— 每个章节头右侧
 *     一枚 44px 的暗色几何图。它不占布局、不挡阅读，但五枚并排出现在
 *     滚动过程里，整页就从"五段文字"变成"五个带图的章节"。
 *     图本身是深色调，所以在浅色页面上它同时充当一个视觉锚点。
 */
export function SectionHead({ index, title, hint, art = null, level = 3 }) {
  const Tag = `h${level}`;

  /* ★ 10-14 v5：带插图的章节头**整条换成深色横带**。
     用户反馈「裁剪力度不够，周围还是太素」—— 根因是 v4 只在标题行右侧
     放了一枚 44px 小方块：图确实在，但小到等于没有，章节下方依旧是大片白纸。
     现在反过来：**图铺满整条**，标题浮在图上。滚动报告页时是五道暗带，
     每章一张画，这才是众生行记"一关一幅景"的节奏。

     实现上三条：
       ① 图用 <img> + object-cover（能被 Vite 打 hash、进产物清单）
       ② 压一层从左到右的暗渐变：左边 0.94（标题所在）→ 右边 0.34（露出画面）。
         标题必须落在最暗的那一侧，否则浅字压在亮图上会读不清。
       ③ 容器斜切角 + 左侧 3px 主色条，与全站的方舟面板语言一致。 */
  if (art) {
    return (
      <div className="mb-4">
        <div
          className="relative flex h-[76px] items-center gap-3 overflow-hidden px-4"
          style={{
            clipPath:
              'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
            boxShadow: '0 8px 22px -14px rgba(11, 90, 107, 0.45)',
          }}
        >
          <img
            src={art}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover ark-art"
            decoding="async"
          />
          {/* ★ 10-15：章节图从"铺满并压暗"改成**右侧露出一角的插图**。
              深色图带在亮天空上就是一条黑砖（和称号区同一个病）。
              现在用一层从白到透的横向渐变盖住左侧 2/3（标题所在），
              右 1/3 把插图露出来 —— 标题清楚、画面也还在。 */}
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(100deg, rgba(255,255,255,0.93) 0%, rgba(255,255,255,0.88) 44%, rgba(255,255,255,0.30) 78%, rgba(255,255,255,0.12) 100%)',
            }}
          />
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: 'var(--grad-ark)' }}
          />

          <div className="relative flex items-center gap-3">
            <span
              className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center"
              style={{
                ...monoTag({ fontSize: 13, letterSpacing: '0', fontWeight: 700 }),
                color: '#ffffff',
                background: 'var(--grad-ark)',
                boxShadow: 'var(--shadow-ark)',
              }}
            >
              {sectionIndex(index)}
            </span>
            <span
              aria-hidden="true"
              style={monoTag({ color: 'var(--ark)', fontSize: 13, fontWeight: 700 })}
            >
              //
            </span>
            <Tag
              className="text-[19px] font-extrabold tracking-tight"
              style={{ color: 'var(--ink-strong)' }}
            >
              {title}
            </Tag>
          </div>
        </div>

        {hint && (
          <p className="mt-2 text-xs leading-5" style={{ color: 'var(--ink-dim)' }}>
            {hint}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        {/* ★ 10-14 v2：编号徽标从"描边小方框"改成**实心蓝紫方块 + 白字**。
            原来的淡青底 + 淡青边，在截图里几乎看不见；
            实心块是页面上最亮的点之一，扫一眼就知道"这是第几块"。
            众生行记的界面大量使用实心几何块做锚点，不是描边。 */}
        <span
          className="inline-flex items-center justify-center w-[30px] h-[30px] shrink-0"
          style={{
            ...monoTag({ fontSize: 13, letterSpacing: '0', fontWeight: 700 }),
            color: '#ffffff',
            background: 'var(--grad-ark)',
            boxShadow: 'var(--shadow-ark)',
          }}
        >
          {sectionIndex(index)}
        </span>
        <span
          aria-hidden="true"
          style={monoTag({ color: 'var(--ark)', fontSize: 13, fontWeight: 700 })}
        >
          //
        </span>
        <Tag
          className="text-[20px] font-extrabold tracking-tight"
          style={{ color: 'var(--ink-strong)' }}
        >
          {title}
        </Tag>
      </div>

      {/* 渐变细线：分隔标题与内容。"有方向"的线比等宽灰线更有设计感。
          v2 从 1px 加到 2px、不透明度 0.55→0.7 —— 1px 的淡线在截图里等于没有。 */}
      <span
        aria-hidden="true"
        className="mt-3 block h-[2px]"
        style={{ background: 'var(--grad-hair)', opacity: 0.7 }}
      />

      {hint && (
        <p
          className="mt-2 text-xs leading-5"
          style={{ color: 'var(--ink-dim)' }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
