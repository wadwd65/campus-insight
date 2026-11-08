/* 帧率对照 v2：不数"渲染帧数"（SwiftShader 下单帧 1~2s，短窗口全是 0），
   改数 requestAnimationFrame 的调度次数 —— 钓鱼那条无条件 rAF 每帧都会续一次，
   这个信号比完成帧灵敏得多。窗口拉到 9 秒。 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(4500);
  const rt = document.getElementById('runtime');
  const origRAF = window.requestAnimationFrame.bind(window);
  let rafCalls = 0;
  window.requestAnimationFrame = function (cb) { rafCalls++; return origRAF(cb); };
  const wt = document.getElementById('walk-toggle');
  if (wt) wt.click();
  await wait(1800);
  const n0 = rafCalls, f0 = Number(rt.dataset.frames || 0);
  const t0 = performance.now();
  await wait(9000);
  const secs = (performance.now() - t0) / 1000;
  return JSON.stringify({
    seconds: +secs.toFixed(1),
    rafScheduled: rafCalls - n0,
    renderFrames: Number(rt.dataset.frames || 0) - f0,
    mode: rt.dataset.playMode,
    hasFpsPatch: !!(window.__fish && typeof window.__fish.needsFrame === 'function'),
  });
})()
