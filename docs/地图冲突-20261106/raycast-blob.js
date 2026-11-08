/* 决定性定位：把截图里黑椭圆的像素坐标换算成 canvas NDC，
   用 Raycaster 打出该位置从近到远的命中链。 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const T = window.__T, scene = window.__scene, cam = window.__cam;
  const cv = document.querySelector('canvas');
  if (!T || !scene || !cam || !cv) return JSON.stringify({ error: 'missing' });
  const r = cv.getBoundingClientRect();
  const scale = 1.6; /* ViewImage 显示图 1000×625 → 实际截图 1600×1000 */
  const pts = [[842, 343], [855, 400], [240, 165], [922, 435], [560, 480]];
  const ray = new T.Raycaster();
  const hits = pts.map(([sx, sy]) => {
    const px = sx * scale, py = sy * scale;
    const ndc = { x: ((px - r.left) / r.width) * 2 - 1, y: 1 - ((py - r.top) / r.height) * 2 };
    ray.setFromCamera(ndc, cam);
    const list = ray.intersectObjects(scene.children, true).slice(0, 5).map(h => ({
      name: h.object.name || '(unnamed)',
      d: +h.distance.toFixed(1),
      inst: h.instanceId === undefined ? null : h.instanceId,
      y: +h.point.y.toFixed(2),
    }));
    return { screen: [sx, sy], ndc: [+ndc.x.toFixed(3), +ndc.y.toFixed(3)], list };
  });
  return JSON.stringify({ canvas: { left: r.left, top: r.top, w: r.width, h: r.height }, hits });
})()
