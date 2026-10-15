/**
 * ArkOption —— 问卷选项（参考《明日方舟》的面板语言重做）。
 *
 * 用户 10-14 的原话：「这些选项都一点意思都没有，没有什么特色，
 * 那框框和那些触发特效都没有。」—— 说得对。改之前它就是一个
 * 「白底描边矩形 + 一个紫方块字母」，既没有框的造型，也没有任何反馈。
 *
 * 方舟系面板的三个特征，这里全做上：
 *
 *   ① **斜切角**（右上 + 左下各切 14px）。矩形是"网页控件"，
 *      斜切角是"仪表面板"—— 这个项目里 TermPanel 已经用了同一套几何，
 *      选项却还是矩形，所以它在一整页斜切语言里像个外来物。
 *
 *   ② **常驻角标 + 悬停展开**。四个角各一段短 L 线，静止时淡（0.35），
 *      悬停时亮起并向外张开 3px。它是"这个框是活的"最省力的表达，
 *      而且不占布局、不引入图片。
 *
 *   ③ **选中扫描线**。点下去的那一瞬间，一道亮线从左掠到右
 *      （420ms，只播一次）。这是"触发特效"—— 原来选中只是底色变紫，
 *      而 160ms 后就跳下一题了，用户根本看不清自己选了什么。
 *
 * 实现上的两个坑（都踩过）：
 *   - **clip-path 会连 box-shadow 一起裁掉**，所以阴影必须用
 *     `filter: drop-shadow()`（它跟裁剪后的实际形状走）。
 *   - 悬停的边框/底色变化要用**两层绝对定位的 span**（外框层 + 内芯层，
 *     内芯各方向内缩 1px），不能给 button 直接设 border ——
 *     border 在切角处会被裁掉一截，看起来像渲染出错。
 */

import { monoTag } from '../lib/surface.js';

const shape = (n) =>
  `polygon(0 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% 100%, ${n}px 100%, 0 calc(100% - ${n}px))`;

const CUT = 14;

export default function ArkOption({ letter, children, active = false, onClick }) {
  const clip = shape(CUT);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full text-left transition-transform duration-150 ci-lift"
      style={{
        clipPath: clip,
        filter: active ? 'drop-shadow(0 8px 22px -8px rgba(21,107,122,0.55))' : 'none',
        transform: active ? 'translateY(-2px)' : undefined,
      }}
    >
      {/* ① 外框层：1px 描边。悬停/选中时换成主色 */}
      <span
        aria-hidden="true"
        className="absolute inset-0 transition-colors duration-150"
        style={{
          // ★ 10-15：描边从 #e5e7eb 换成可见的冷蓝。
          //   白纸时代 #e5e7eb 够用；压在云上时它和云一样亮，卡片边界就消失了。
          background: active ? 'var(--ark)' : 'rgba(21, 107, 122, 0.22)',
          clipPath: clip,
        }}
      />
      {/* ② 内芯层：装内容的底。各方向内缩 1px 让外框露出来 */}
      <span
        aria-hidden="true"
        className="absolute inset-[1px] transition-all duration-150"
        style={{
          // ★ 10-15：背景换成动漫天空后，这张卡的定位变了 ——
          //   它不再需要"从白纸上跳出来"，而是**要浮在画面之上但不遮住画面**。
          //   所以从"实心白 + 斜纹"改成 0.9 的**玻璃白**：
          //   天空仍在底下透一口气，而 0.9 的不透明度足以让任何一句选项都读得清。
          //   斜纹同时删掉 —— 云本身是斜的，斜纹压在云上会被吃掉，放大看只觉得脏。
          background: active ? 'var(--grad-ark)' : 'rgba(255, 255, 255, 0.90)',
          clipPath: clip,
        }}
      />

      {/* ③ 切面高光：斜切角处一道 45° 亮线。
              斜切角如果没有高光，看起来只是"缺了一块"而不是"切过"。
              这道线让它读作"抛光过的切面" —— 方舟面板的立体感全靠它。 */}
      <span aria-hidden="true" className="ark-cut-edge-tr" />
      <span aria-hidden="true" className="ark-cut-edge-bl" />

      {/* ④ 常驻角标：四段短 L 线。静止 0.5，悬停/选中 1 并向外张开 */}
      {[
        'ark-bracket-tl',
        'ark-bracket-tr',
        'ark-bracket-bl',
        'ark-bracket-br',
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden="true"
          className={`ark-bracket ark-opt-brk ark-opt-brk-${pos}`}
        />
      ))}

      {/* ④ 选中扫描线：一道亮线从左掠到右，只播一次。
            用 active 做 key 的前缀不行（React 复用同一个节点就不会重播），
            所以这里靠 CSS animation + 只在 active 时挂载来实现"每次选中都播"。 */}
      {active && <span aria-hidden="true" className="ark-scanline" />}

      {/* ⑤ 右侧刻度带。
          ★ 10-15：原来是 45° 斜纹（方舟的"警示带"）。换到天空底之后它失效了 ——
            云本身是斜向的、有明暗的，斜纹压在云上会被"吃掉"，
            放大看只觉得脏。换成**等距的竖刻度**：它不模仿任何自然纹理，
            是纯人造的记号，在任何背景上都不会被误读成"画面的一部分"。
            选中时淡出，把位置让给渐变底。 */}
      <span
        aria-hidden="true"
        className="absolute right-0 top-0 bottom-0 w-[10px] transition-opacity duration-150"
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(21,107,122,0.42) 0 1px, transparent 1px 5px)',
          opacity: active ? 0.2 : 1,
        }}
      />

      {/* ⑥ 左侧常驻主色竖条：3px。它是这一行"被框住的仪表"的锚点，
              静止时就有，悬停/选中时加亮。 */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-[3px] transition-opacity duration-150"
        style={{ background: 'var(--grad-ark)', opacity: active ? 1 : 0.55 }}
      />

      {/* ⑦ 内容 */}
      <span className="relative flex items-center gap-4 px-4 py-4">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center transition-all duration-150"
          style={{
            ...monoTag({ fontSize: 14, letterSpacing: '0', fontWeight: 700 }),
            background: active ? 'rgba(255,255,255,0.24)' : 'var(--grad-ark)',
            color: '#ffffff',
            boxShadow: active ? 'none' : 'var(--shadow-ark)',
            transform: active ? 'scale(1.08)' : undefined,
          }}
        >
          {letter}
        </span>
        <span
          className="flex-1 text-[16px] transition-colors duration-150"
          style={{ color: active ? '#ffffff' : 'var(--ink)' }}
        >
          {children}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-sm transition-all duration-150"
          style={{
            color: active ? 'rgba(255,255,255,0.9)' : 'var(--ark)',
            opacity: active ? 1 : 0.35,
            transform: active ? 'translateX(3px)' : undefined,
          }}
        >
          →
        </span>
      </span>
    </button>
  );
}
