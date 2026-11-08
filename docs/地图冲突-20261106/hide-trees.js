/* 对照 C：隐藏所有树，再用「地点标记」开关连点两次强制 requestRender，
   最终地点标记状态不变，但画面会重绘。 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  let n = 0;
  window.__scene.traverse(o => {
    if (o.isMesh && /canopy|trunk|tree|foliage/i.test(o.name || '')) { o.visible = false; n++; }
  });
  const btn = document.getElementById('labels');
  if (btn) { btn.click(); await wait(300); btn.click(); }
  await wait(1200);
  return JSON.stringify({ hiddenMeshes: n, redraw: !!btn });
})()
