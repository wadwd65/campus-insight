/* 决定性对照：只关树的 castShadow，树本身保留。
   黑椭圆若消失 ⇒ 实时树影；若仍在 ⇒ 树冠几何本身。 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  let n = 0;
  window.__scene.traverse(o => {
    if (o.isMesh && /canopy|trunk|tree|foliage/i.test(o.name || '')) { o.castShadow = false; n++; }
  });
  const btn = document.getElementById('labels');
  if (btn) { btn.click(); await wait(400); btn.click(); }
  await wait(1800);
  return JSON.stringify({ castShadowOff: n });
})()
