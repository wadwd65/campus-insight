/**
 * Mascot.jsx —— 站点吉祥物（10-08 新增）
 *
 * 用户要求："加一个动漫小人上去，让他能动起来，做个交互，点一下就可以动。"
 *
 * ── 设计要点 ─────────────────────────────────────────────────────
 * · **可点击就有反应**：点一下 = 跳一下 + 冒出 6 颗小星 + 说一句话（话从一组里轮换）
 * · 只做"轻"交互：不做鼠标跟随（廉价）、不做拖拽（会和页面滚动打架）
 * · **无障碍**：`role="button"` + 键盘可达（button 元素天然如此），
 *   说话内容用 `aria-live="polite"` 播报 —— 键盘与读屏用户同样"点得到"
 * · **降级**：`prefers-reduced-motion` 时不做漂浮/跳跃/星星/歪头，
 *   但**点了仍然说话**（信息不该因为动画被关掉而消失）
 * · **素材缺失不报错**：图没到位就整块不渲染（`onError` 收起），不出现裂图
 *
 * ── 彩蛋（10-17 夜新增）────────────────────────────────────────
 * 60 秒内点 10 次 ⇒ 小人歪一下头，气泡里给一次"专属数据解读"：
 *   ① 固定台词：`EGG_GREET`
 *   ② 一句**趣评**，基于当前作答实时算出（见 lib/egg.js）
 *   ③ 一个真能按的按钮：把档案导出成 CSV（不是装饰）
 *
 * 为什么做成"功能露出"而不是放烟花：
 *   彩蛋的价值在于让人发现"哦，它是真的在算我"；
 *   夸张的特效只会让人记住特效，记不住产品。所以画面只加了一个 8° 的歪头。
 *
 * ⚠️ 立绘占位：`public/art/mascot.webp`。换图**只需覆盖这一个文件**，源码零改动
 *   （沿用 docs/素材说明.md 里那套"同名覆盖"的做法）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { EGG_CLICKS, EGG_WINDOW_MS, EGG_GREET, EGG_NO_DATA } from '../lib/egg.js';

const LINES = [
  '点我一下？我还有话没说完。',
  '十道日常选择，看看你的校园生活是什么画风。',
  '有班级问卷？直接传上来，我帮你看分布。',
  '别只看雷达图 —— 最像你的那个人，可能就坐你后面。',
  '原始文件留在本机；开启在线解读时，只发送报告摘要。',
  '地图只是彩蛋；主线是数据，和解读。',
];

/**
 * @param {string}  src           立绘图片路径
 * @param {string}  [side]        'right' | 'left'
 * @param {string}  [quip]        彩蛋趣评（没有作答时传 null，会显示兜底句）
 * @param {Function}[onQuipAction] 趣评里的按钮动作（如导出档案）；没有就不显示按钮
 * @param {string}  [actionLabel] 按钮文案
 */
export default function Mascot({
  src,
  side = 'right',
  quip = null,
  onQuipAction = null,
  actionLabel = '写进我的档案',
}) {
  const [ok, setOk] = useState(true);
  const [line, setLine] = useState(null);
  const [beats, setBeats] = useState(0);          /* 每次点击 +1，用来重放动画 */
  const [egg, setEgg] = useState(false);          /* 彩蛋是否正在播放 */
  const [done, setDone] = useState(false);        /* 按钮按过了 */
  const timer = useRef(null);
  const idx = useRef(0);
  const stamps = useRef([]);                      /* 最近 60 秒内的点击时刻 */

  /* 卸载时清掉隐藏气泡的定时器（否则会在已卸载组件上 setState） */
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const poke = useCallback(() => {
    const now = Date.now();
    // 只保留最近 60 秒的点击 —— 窗口是**滑动**的，不是"从第 1 次开始算 60 秒"，
    // 否则慢慢点也会攒满，彩蛋就变成"点十下必有"，失去"手快"的味道。
    stamps.current = [...stamps.current, now].filter((t) => now - t < EGG_WINDOW_MS);

    const hit = stamps.current.length >= EGG_CLICKS;
    if (hit) {
      stamps.current = [];      // 触发后清零，之后攒够还能再触发一次
      setEgg(true);
      setDone(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setEgg(false), 11000);  // 两句话 + 一个按钮，给足时间读
      return;
    }

    idx.current = (idx.current + 1) % LINES.length;
    setLine(LINES[idx.current]);
    setBeats((b) => b + 1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLine(null), 4200);
  }, []);

  if (!ok) return null;

  return (
    <div className={`mascot mascot-${side}`}>
      {(egg || line) && (
        <div
          className={`mascot-bubble${egg ? ' mascot-bubble--egg' : ''}`}
          role="status"
          aria-live="polite"
        >
          <button type="button" className="mascot-dismiss" aria-label="收起精灵的对话" onClick={() => { setLine(null); setEgg(false); }}>×</button>
          {egg ? (
            <>
              <span>{EGG_GREET}</span>
              {/* ★ 趣评里的百分比是真算出来的（维度百分位），不是写死的漂亮话 */}
              <span className="egg-quip">{quip || EGG_NO_DATA}</span>
              {onQuipAction && (
                <button
                  type="button"
                  className="egg-go"
                  onClick={() => {
                    onQuipAction();
                    setDone(true);
                  }}
                >
                  {done ? '已写入 ↓' : actionLabel}
                </button>
              )}
            </>
          ) : (
            line
          )}
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
          {/* 彩蛋的"歪头"包一层：它和跳跃动画分别作用在两个元素上，
              互相不会抢 animation 属性（一次只能生效一个 animation 名） */}
          <span className={`mascot-tilt${egg ? ' is-tilt' : ''}`}>
            <img
              key={'img' + beats}
              className={beats ? 'is-poked' : ''}
              src={src}
              alt=""
              draggable="false"
              onError={() => setOk(false)}
            />
          </span>
        </span>
      </button>
    </div>
  );
}
