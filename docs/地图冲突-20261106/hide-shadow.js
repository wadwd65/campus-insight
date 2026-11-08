/* 对照 B：用页面自带的「阴影」开关隐藏烘焙阴影层，
   它会顺带 requestRender()；静止按需绘制下直接改 visible 不会重绘。 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const btn = document.getElementById('shade');
  if (btn) btn.click();
  await wait(1200);
  const o = window.__scene.getObjectByName('static-sun-shadow');
  return JSON.stringify({ clicked: !!btn, shadowVisible: o ? o.visible : null });
})()
