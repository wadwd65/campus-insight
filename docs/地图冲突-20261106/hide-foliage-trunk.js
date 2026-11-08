(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  let n = 0;
  window.__scene.traverse(o => {
    if (o.isMesh && /foliage|trunk/i.test(o.name || '')) { o.visible = false; n++; }
  });
  const btn = document.getElementById('labels');
  if (btn) { btn.click(); await wait(400); btn.click(); }
  await wait(1800);
  return JSON.stringify({ hiddenFoliageTrunk: n });
})()
