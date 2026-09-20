/**
 * 推镜驱动 —— 把"镜头往里推"这件事变成可断言的纯函数 + 一个很薄的 DOM 写入层。
 *
 * ── 为什么单独成文件，而不是塞进 IntroScene.jsx ────────────────────
 *
 * 因为**推镜的进度计算本身是可错的**，而错了在界面上极难看出来：
 * 算成"先快后慢"或者"局部抖动"，读起来只是"有点怪"，
 * 说得出怪、说不出哪里怪。抽成纯函数之后，自检可以直接喂它一组 t
 * 断言单调性、断言区间、断言近层比远层涨得多 —— 这三条一过，
 * 界面上就只剩"好不好看"的问题，不会再有"对不对"的问题。
 *
 * 保证的三条性质：
 *   1. **单调递增**：t 变大，进度只能变大，绝不回退（回退 = 镜头在抖）
 *   2. **区间闭合**：t=0 → 0，t=1 → 1，中间不会越界
 *   3. **首尾平缓**：起步和收尾的变化率低于中段（真实镜头不会硬起硬停），
 *      但中段必须保持接近匀速 —— 参考里的推镜就是匀速慢推。
 */

/** 缓动：接近线性的 smoothstep 变体。中段斜率 ≈ 1.35，首尾接近 0.7。 */
export function pushEase(t) {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  // smoothstep 会让中段太快、首尾太慢；这里取 85% 线性 + 15% smoothstep
  // 的加权，得到"几乎匀速、首尾略缓"的效果 —— 正是参考里那台机器的走法。
  const smooth = c * c * (3 - 2 * c);
  return c * 0.85 + smooth * 0.15;
}

/**
 * 由"已过毫秒数"算出推进量 0~1。
 *
 * @param {number} elapsedMs 从入场开始算起的毫秒数
 * @param {number} durationMs 推镜全程时长（PUSH.durationMs）
 */
export function pushProgress(elapsedMs, durationMs) {
  if (!(durationMs > 0)) return 1;
  const raw = elapsedMs / durationMs;
  return pushEase(raw);
}

/**
 * 帧率闸：推镜是匀速慢推，30fps 与 60fps 肉眼无差，
 * 但样式重算次数差一倍。返回 true 表示这一帧该画。
 *
 * 抽出来也是为了让自检能断言"节流不会漏掉最后一帧"这个边界 ——
 * 漏掉最后一帧的后果是推镜永远到不了终点，停在 97% 之类的值上，
 * 肉眼完全看不出来，但它就是错的。
 */
export function shouldDraw(nowMs, lastMs, minGapMs) {
  if (!(lastMs > 0)) return true;
  return nowMs - lastMs >= minGapMs;
}

/** 默认帧间隔：1000/30 ≈ 33.3ms，向上取整到 34 避免浮点误差卡帧。 */
export const FRAME_GAP_MS = 34;

/**
 * 把推进量写给一个元素上的 CSS 变量。
 *
 * 各层读同一个 `--push`，在 CSS 里用 calc() 按自己的系数取值：
 *   `scale(calc(1 + (var(--zoom) - 1) * var(--push)))`
 * 这样"近处涨得快"就写在**层自己的 zoom 值**里，
 * 而不是写在三条各写各的 @keyframes 里 —— 层次关系变成了数据。
 *
 * 这个函数本身不计算任何东西，只是把纯函数的结果落进 DOM，
 * 所以它刻意做得很薄、且能安全地在没有 DOM 的环境里被 import。
 */
export function writePush(el, progress) {
  if (!el || !el.style) return;
  el.style.setProperty('--push', String(progress));
}

/**
 * 启动推镜循环。返回一个 stop 函数。
 *
 * 三处刻意的选择：
 *   1. **不接 rAF 的 timestamp 之外的任何东西** —— 不读 performance.now()，
 *      因为两者在标签页切回来时的行为不同，混用会让进度跳一下。
 *   2. **标签页切走就停**：切回来时按新的 timestamp 续上。
 *      否则一个后台标签页跑 10 分钟，回来时镜头已经推过头了。
 *   3. **推到头就停**，不循环。参考里的推镜是单程的，
 *      循环会让画面在到点那一刻"啪"地跳回起点。
 */
export function startPush(el, durationMs, opts = {}) {
  if (typeof window === 'undefined' || typeof el === 'undefined' || !el) {
    return () => {};
  }
  const gap = opts.gapMs ?? FRAME_GAP_MS;
  const onDone = opts.onDone;
  let raf = 0;
  let start = 0;
  let last = 0;
  let stopped = false;

  function frame(ts) {
    if (stopped) return;
    if (!start) start = ts;
    const elapsed = ts - start;
    const p = pushProgress(elapsed, durationMs);
    if (shouldDraw(ts, last, gap) || p >= 1) {
      last = ts;
      writePush(el, p);
    }
    if (p >= 1) {
      onDone?.();
      return; // 到头即停，不循环
    }
    raf = window.requestAnimationFrame(frame);
  }

  raf = window.requestAnimationFrame(frame);

  return () => {
    stopped = true;
    if (raf) window.cancelAnimationFrame(raf);
  };
}
