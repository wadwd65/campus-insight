/* 最后一步验证：用页面开关隐藏烘焙阴影层，并强制多次重绘、等足时间。
   若黑斑随之消失 ⇒ 直接把该层默认隐藏就是确定有效的处理。 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const shade = document.getElementById('shade');
  const labels = document.getElementById('labels');
  if (shade) shade.click();
  await wait(700);
  if (labels) { labels.click(); await wait(500); labels.click(); }
  await wait(3200);
  const o = window.__scene.getObjectByName('static-sun-shadow');
  return JSON.stringify({ shadeClicked: !!shade, shadowVisible: o ? o.visible : null });
})()
