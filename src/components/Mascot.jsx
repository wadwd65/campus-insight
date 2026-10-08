/**
 * Mascot.jsx —— 站点吉祥物（10-08 新增）
 *
 * 用户要求："加一个动漫小人上去，让他能动起来，做个交互，点一下就可以动。"
 *
 * ── 设计要点 ─────────────────────────────────────────────────────
 * · **可点击就有反应**：点一下 = 跳一下 + 冒出 6 颗小星 + 说一句话（话从一组里轮换）
 * · 只做"轻"交互：不做鼠标跟随（廉价）、不做拖拽（会和页面滚动打架）
 * · **无障碍**：`role="button"` + `tabIndex=0`，Enter/Space 等价于点击；
 *   说话内容用 `aria-live="polite"` 播报 —— 键盘与读屏用户同样"点得到"
 * · **降级**：`prefers-reduced-motion` 时不做漂浮/跳跃/星星，但**点了仍然说话**
 *   （信息不该因为动画被关掉而消失）
 * · **素材缺失不报错**：图没到位就整块不渲染（`onError` 收起），不出现裂图
 *
 * ⚠️ 立绘占位：`public/art/mascot.webp`。换图**只需覆盖这一个文件**，源码零改动
 *   （沿用 docs/素材说明.md 里那套"同名覆盖"的做法）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const LINES = [
  '点我一下？我还有话没说完。',
  '十道题，一分钟，我就能算出你的四年。',
  '有班级问卷？直接传上来，我帮你看分布。',
  '别只看雷达图 —— 最像你的那个人，可能就坐你后面。',
  '数据不出浏览器，这点我可以保证。',
  '地图只是彩蛋；主线是数据，和解读。',
];

export default function Mascot({ src, side = 'right' }) {
  const [ok, setOk] = useState(true);
  const [line, setLine] = useState(null);
  const [beats, setBeats] = useState(0);          /* 每次点击 +1，用来重放动画 */
  const timer = useRef(null);
  const idx = useRef(0);

  /* 卸载时清掉隐藏气泡的定时器（否则会在已卸载组件上 setState） */
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const poke = useCallback(() => {
    idx.current = (idx.current + 1) % LINES.length;
    setLine(LINES[idx.current]);
    setBeats((b) => b + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLine(null), 4200);
  }, []);

  if (!ok) return null;

  return (
    <div className={`mascot mascot-${side}`}>
      {line && (
        <div className="mascot-bubble" role="status" aria-live="polite">
          {line}
        </div>
      )}

      <button
        type="button"
        className="mascot-hit"
        onClick={poke}
        aria-label="看看这个小人会说什么"
        title="点我一下"
      >
        {/* 外层只管"一直漂浮"；内层用 key 重挂载 ⇒ 每次点击重放一次跳跃/星花，
            不会把漂浮动画一起打断（那会看出来"卡一下"） */}
        <span className="mascot-figure">
          <span className="mascot-spark" key={'spark' + beats} aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => <i key={i} style={{ '--i': i }} />)}
          </span>
          <img
            key={'img' + beats}
            className={beats ? 'is-poked' : ''}
            src={src}
            alt=""
            draggable="false"
            onError={() => setOk(false)}
          />
        </span>
      </button>
    </div>
  );
}
