/**
 * 几何装饰层 v2 —— 参考《明日方舟》SideStory「众生行记」的界面语言。
 *
 * 那个活动的设计分析（smzdm 那篇讲得很细）：界面"融合了数学逻辑与宗教仪式感，
 * 使用函数曲线和斐波那契螺旋线强化理性与秩序感"；主海报是三角构图；
 * 滑动关卡时有角色剪影与**飘荡在画面中的几何色块**；主色是通透的蓝紫，
 * 刻意避开深色与黑；UI 本身极简洁。
 *
 * v1 的问题（看图后确认）：螺旋/圆环都画了，但透明度压在 0.06~0.09，
 * 在 1080p 的 JPEG 里几乎看不出来 —— 用户的原话是"感觉没什么变化"。
 * 所以 v2 做三件事：
 *
 *   ① **加实心几何色块**。这是众生行记最抓眼的元素，v1 完全没做。
 *      色块用 fill + 低透明度（0.05~0.09），比描边亮一个量级，
 *      隔着屏幕也能看见，但又重到不会被人当成"内容"。
 *   ② **描边透明度从 0.06~0.09 提到 0.12~0.18**。仍然只是纸纹，
 *      但能在截图里活下来。
 *   ③ **三角构图**落到画面上（不只是右下角一个轮廓三角）。
 *
 * 三条不变的硬规则：
 *   ① 纯静态，不做动画（这个项目有多层实时模糊 → 掉帧的教训，见 index.css）
 *   ② pointer-events:none + aria-hidden
 *   ③ 面积最大的一块在右侧与底部 —— 内容是从左往上读的，
 *      装饰不能压在正文最密的地方
 */

import { memo } from 'react';

/** 黄金螺旋：r = a·e^(b·θ)，b = ln(φ)/(π/2) —— 每转 90° 半径乘一次黄金比。 */
function goldenSpiral({ turns = 2.2, a = 5, cx = 0, cy = 0, step = 0.05 }) {
  const b = Math.log((1 + Math.sqrt(5)) / 2) / (Math.PI / 2);
  const max = turns * Math.PI * 2;
  const pts = [];
  for (let t = 0; t <= max; t += step) {
    const r = a * Math.exp(b * t);
    pts.push(`${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')}`;
}

/** 函数曲线：一条正弦。用它是为了和螺旋区分 —— 螺旋是"增长"，正弦是"周期"。 */
function sinePath({ w = 600, cycles = 1.5, amp = 26, y = 0, step = 4 }) {
  const pts = [];
  for (let x = 0; x <= w; x += step) {
    pts.push(`${x} ${(y + Math.sin((x / w) * Math.PI * 2 * cycles) * amp).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')}`;
}

const SPIRAL = goldenSpiral({ turns: 2.3, a: 5, cx: 1130, cy: 470 });
const SINE = sinePath({ w: 1440, cycles: 2.4, amp: 34, y: 830 });

/** 页面主色（蓝紫）。装饰层直接写色号 —— 它是 SVG 属性，读不到 CSS 变量。 */
const ARK = '#156b7a';
const ARK_PALE = '#46a9b8';

/** 斜纹填充（方舟系常用的"警示带"纹理）。给一个角落铺上，
 *  比纯色块多一层"工业仪表"的质感。用 pattern 而不是手绘一排线。 */
function HatchDefs() {
  return (
    <defs>
      <pattern id="ark-hatch" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="none" />
        <line x1="0" y1="0" x2="0" y2="10" stroke={ARK} strokeWidth="2.4" opacity="0.5" />
      </pattern>
      <linearGradient id="ark-tri" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={ARK} stopOpacity="0.1" />
        <stop offset="100%" stopColor={ARK_PALE} stopOpacity="0.03" />
      </linearGradient>
    </defs>
  );
}

function GeometricBackdrop({ variant = 'page' }) {
  return (
    <div className="ark-backdrop" aria-hidden="true">
      {variant === 'page' ? (
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%' }}
        >
          <HatchDefs />

          {/* ── 实心几何色块（众生行记最抓眼的元素）─────────────────
              ★ v3 重新布点：v2 把五个形状堆在左下角，互相叠在一起糊成一团
              （看图后发现）。现在按"四角各一组、中间留白"重排：
                右上  实心三角 + 描边三角（海报的三角构图）
                右中  主螺旋 + 三个同心圆
                右下  实心圆
                左上  小六边形 + 参考圆（六边形是方舟的标志形）
                左中  实心方块
                左下  只放制图十字 + 斜纹块，不再堆图形
                下中  一个较小的描边三角 */}
          <path d="M 1150 80 L 1400 80 L 1275 300 Z" fill="url(#ark-tri)" />
          <path
            d="M 1150 80 L 1400 80 L 1275 300 Z"
            fill="none"
            stroke={ARK}
            strokeWidth="1.4"
            opacity="0.21"
          />
          <circle cx="1288" cy="760" r="76" fill={ARK_PALE} opacity="0.10" />

          {/* 左上：六边形 + 参考圆。六边形是方舟 UI 的标志形状 */}
          <g opacity="0.19" stroke={ARK} strokeWidth="1.2" fill="none">
            <polygon points="190,120 250,152 250,216 190,248 130,216 130,152" />
            <circle cx="190" cy="184" r="92" />
          </g>

          {/* 左中：实心方块 */}
          <rect x="196" y="452" width="128" height="128" fill={ARK} opacity="0.08" />

          {/* 左下：只留制图十字 + 一块斜纹，不再堆螺旋和圆 */}
          <g opacity="0.18" stroke={ARK} strokeWidth="1">
            <line x1="150" y1="660" x2="150" y2="900" />
            <line x1="0" y1="760" x2="330" y2="760" />
            <circle cx="150" cy="760" r="100" fill="none" />
          </g>
          <path d="M 262 690 L 330 690 L 330 760 L 262 760 Z" fill="url(#ark-hatch)" opacity="0.22" />

          {/* 下中：较小的描边三角 */}
          <path
            d="M 720 640 L 890 850 L 550 850 Z"
            fill="none"
            stroke={ARK}
            strokeWidth="1.2"
            opacity="0.15"
          />

          {/* ── 黄金螺旋（主）───────────────────────────────────────
              众生行记 logo 致敬《维特鲁威人》时用了工程制图辅助线，
              这里把"人"换成"螺旋" —— 同样是"几何叠在几何上"。 */}
          <path d={SPIRAL} fill="none" stroke={ARK} strokeWidth="1.5" opacity="0.22" />
          {[130, 205, 290].map((r, i) => (
            <circle
              key={r}
              cx="1130"
              cy="470"
              r={r}
              fill="none"
              stroke={ARK}
              strokeWidth="1"
              opacity={0.20 - i * 0.035}
            />
          ))}

          {/* ── 函数曲线（底部通栏）────────────────────────────────
              一条横贯页面的正弦。它替代了"页脚分隔线"这件事 ——
              与其画一条灰线，不如画一条看得出在按某种规律起伏的线。 */}
          <path d={SINE} fill="none" stroke={ARK} strokeWidth="1.3" opacity="0.16" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 672 260"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%' }}
        >
          {/* 报告页称号区：同心圆 + 制图十字 + 一个实心色块 */}
          <path d="M 336 130 L 470 250 L 202 250 Z" fill={ARK} opacity="0.10" />
          <circle cx="336" cy="130" r="108" fill="none" stroke={ARK} strokeWidth="1.2" opacity="0.18" />
          <circle cx="336" cy="130" r="80" fill="none" stroke={ARK} strokeWidth="1" opacity="0.24" />
          <circle cx="336" cy="130" r="52" fill="none" stroke={ARK_PALE} strokeWidth="1" opacity="0.2" />
          <path d="M 220 130 L 452 130 M 336 14 L 336 246" stroke={ARK} strokeWidth="1" opacity="0.14" />
        </svg>
      )}
    </div>
  );
}

export default memo(GeometricBackdrop);
