/**
 * ArkOption —— 问卷选项行（iPhone 磨砂玻璃 + 天空色 + 触发反馈）
 *
 * ── 版本史 ──────────────────────────────────────────────────
 * 10-14 v2：参考《明日方舟》面板语言重做 —— 斜切角 + 常驻角标 + 选中扫描线。
 *            当时的理由是"方舟系界面长这样"。
 * 10-17 v3：用户三条指令，全部推翻配色与质感：
 *   ① 「把选项的颜色换一下，不要那个色，太难看了，那种青蓝的，使用天空的颜色」
 *   ② 「再出一个效果，一些触发效果」
 *   ③ 「每个按钮都做成像那种 iPhone 的那种玻璃感」
 *
 * ── v3 的三处判断 ───────────────────────────────────────────
 *
 * ① **强调色从青蓝换成天空的暖橙**。
 *    这不是拍脑袋换色：天空的色卡是量出来的（sky.webp 量化，见 ark-gen.py 注释）——
 *    顶部蓝、中部青、**近地暖橙**。以前界面主色是青蓝，选项跟着青蓝，
 *    于是"选项=青蓝"变成默认，用户看腻了。
 *    现在强调色取自天空的另一端（暖），冷色只留在天空本身 ——
 *    冷暖各占一头，选项在页面上才是"被选中的那一个"，而不是"第 N 个蓝块"。
 *
 * ② **三层触发反馈，全部 CSS 驱动**（无 JS 定时器，避免多一个状态源）：
 *      · hover  —— 卡片浮起、右侧刻度提亮
 *      · select —— 暖色描边与勾选标记
 *      · focus  —— 键盘焦点环，看得见但不抢
 *    选中态同时用**颜色 + ✓**三种方式表达，不靠单一色彩传达
 *    （色弱用户和黑白打印都还能读出状态）。
 *
 * ③ **iOS 玻璃**（`.ios-glass`）：**不用 backdrop-filter**。
 *    第一版照抄了 iOS 的实时模糊，结果整页掉帧（实测 90 帧 6 秒跑不完，
 *    关掉模糊立刻满帧）—— 这个项目 10-10 就踩过同一个坑。
 *    现在玻璃感由"上亮下暗的半透明白渐变 + 白边 + 内侧高光"给出，
 *    成本为零，观感差别在按钮这种小面积上几乎看不出来。
 *
 * 实现上的两个老坑（仍然成立，别改回去）：
 *   - **clip-path 会连 box-shadow 一起裁掉**，所以阴影要用 `filter: drop-shadow()`
 *   - 切角处的描边必须用**两层绝对定位 span**（外框 + 内芯内缩 1px），
 *     不能给 button 直接设 border —— border 在切角处会被裁掉一截
 */

import { monoTag } from '../lib/surface.js';

/** 天空色卡（从 sky.webp 量化得出）。暖端 = 云被照亮的那一面。 */
const SKY_WARM = '#c98a5a';
const SKY_WARM_DEEP = '#b45309';

/**
 * 未选态的描边/刻度色 —— **不是旧 ark 蓝，是天空图里云影的中性灰**。
 * 10-17 用户原话：「不要那个色，太难看了，那种青蓝的」。
 * 旧值 rgba(44,90,160,·) 是 #2c5aa0 一族（azure 蓝），压在青蓝天空上
 * 就是"一片蓝"—— 每张卡片都像一块蓝，正是被否定的观感。
 * 新值从 sky.webp 的低饱和像素量出（云影均值 #6c7069、最深 #474d4b），
 * 取 #474d4b 作基色：中性灰描边 + 白玻璃，未选态读作"素玻璃卡"；
 * 选中态的暖橙因此是页面上唯一的彩色强调，冷暖分明。
 */
const SKY_SHADOW = '71, 77, 75';

/**
 * ⚠️ props 契约（10-17 踩过，别改）：
 *   `letter`   —— 字母（A/B/C…），调用方传 `String.fromCharCode(65+i)`
 *   `children` —— 选项正文，调用方用 children 传，不是 `text` prop
 * 我曾把这两个改名为 label/text，结果选项文字全变空、冒烟测试立刻报
 * 「渲染出第一题的全部选项」—— 而构建是过的。改名 props 前先看调用方。
 */
export default function ArkOption({
  letter,
  children,
  hint,
  active = false,
  flash = null,
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`group relative w-full text-left transition-all duration-200 ${
        active ? 'is-active' : ''
      } ${disabled ? 'opacity-40' : 'ci-lift cursor-pointer'}`}
    >
      {/* 外框层：斜切角描边。选中时换成暖色，不靠颜色也能读出"被选中" */}
      <span
        aria-hidden="true"
        className="absolute inset-0 transition-all duration-200"
        style={{
          background: active ? SKY_WARM_DEEP : `rgba(${SKY_SHADOW}, 0.22)`,
          clipPath:
            'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
        }}
      />

      {/* 内容层：iOS 磨砂玻璃 */}
      <span
        aria-hidden="true"
        className="ios-glass absolute inset-[1px] transition-all duration-200"
        style={{
          clipPath:
            'polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px))',
          background: active ? 'rgba(255, 246, 236, 0.68)' : undefined,
        }}
      />

      <span className="relative flex items-start gap-3.5 px-4 py-4 sm:px-5 sm:py-[18px]">
        {/* 字母块：未选中时是磨砂玻璃 + 深字（不填色）；
            选中才变成天空的暖橙渐变。这样"没选"和"选了"是两回事，
            不是"两种蓝"—— 那正是用户说难看的地方。 */}
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center transition-all duration-200"
          style={{
            ...monoTag({ fontSize: 16, fontWeight: 700, letterSpacing: '0' }),
            color: active ? '#ffffff' : 'var(--ink-mid)',
            background: active
              ? `linear-gradient(135deg, ${SKY_WARM}, ${SKY_WARM_DEEP})`
              : 'rgba(255, 255, 255, 0.62)',
            border: active ? 'none' : `1px solid rgba(${SKY_SHADOW}, 0.28)`,
            clipPath:
              'polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px))',
            boxShadow: active ? '0 8px 20px -8px rgba(180, 83, 9, 0.5)' : 'none',
          }}
        >
          {letter}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className="text-[16px] font-semibold leading-[1.5]"
              style={{ color: active ? 'var(--accent-warm-deep)' : 'var(--ink-strong)' }}
            >
              {children}
            </span>
            {active && (
              <span
                aria-hidden="true"
                style={{ ...monoTag({ fontSize: 13, fontWeight: 700 }), color: SKY_WARM_DEEP }}
              >
                ✓
              </span>
            )}
          </span>
          {hint && (
            <span
              className="mt-1 block text-[12.5px] leading-[1.7]"
              style={{ color: active ? 'var(--accent-warm)' : 'var(--ink-soft)' }}
            >
              {hint}
            </span>
          )}
        </span>

        {/* 右侧刻度带：等距竖线（不是斜纹 —— 斜纹会被天空的纹理"吃掉"）。
            选中时淡出，把位置让给暖色。 */}
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 top-0 w-[10px] transition-opacity duration-200"
          style={{
            background:
              `repeating-linear-gradient(90deg, rgba(${SKY_SHADOW},0.38) 0 1px, transparent 1px 5px)`,
            opacity: active ? 0 : 1,
          }}
        />

        {/* 选中时右下角浮出的暖色小角标 */}
        {active && (
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 h-0 w-0"
            style={{
              borderLeft: '14px solid transparent',
              borderBottom: `14px solid ${SKY_WARM_DEEP}`,
            }}
          />
        )}
      </span>
    </button>
  );
}
