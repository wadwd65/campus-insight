/* 回归：第一人称步行时鱼竿视模型必须仍然可见 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(4500);
  const rt = document.getElementById('runtime');
  const w = document.getElementById('walk-toggle');
  if (w) w.click();
  await wait(2600);
  return JSON.stringify({
    mode: rt.dataset.playMode,
    personView: rt.dataset.personView,
    fishState: window.__fish && window.__fish.state,
  });
})()
