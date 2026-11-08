/* 量交口圆盘与矩形路段端角的覆盖关系 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6500);
  const T = window.__T, scene = window.__scene;
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const discs = [], segs = [];
  scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    if (o.name !== 'junction:road' && o.name !== 'box:road') return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.decompose(p, q, s);
      const rec = { n: o.name, i, x: +p.x.toFixed(1), z: +p.z.toFixed(1), w: +s.x.toFixed(2), d: +s.z.toFixed(2), top: +(p.y + (o.name === 'box:road' ? s.y / 2 : 0)).toFixed(3) };
      (o.name === 'junction:road' ? discs : segs).push(rec);
    }
  });
  /* 对前 5 个圆盘，找最近路段，算矩形端面角点到圆心的距离 vs 圆盘半径 */
  const checks = discs.slice(0, 5).map(d => {
    const r = d.w / 2, inset = r * Math.cos(Math.PI / 20); // 20 边形内切半径
    let best = null, bd = 1e9;
    for (const g of segs) { const dd = Math.hypot(g.x - d.x, g.z - d.z); if (dd < bd) { bd = dd; best = g; } }
    const halfW = best ? best.w / 2 : 0;
    const corner = Math.sqrt(Math.pow(Math.min(bd, r), 2) + halfW * halfW);
    return { disc: d.i, r: +r.toFixed(2), polygonInset: +inset.toFixed(2),
      nearestSeg: best && best.i, segHalfWidth: +halfW.toFixed(2),
      cornerDist: +corner.toFixed(2), uncovered: +(corner - inset).toFixed(2) };
  });
  return JSON.stringify({ discCount: discs.length, segCount: segs.length,
    discSample: discs.slice(0, 3), checks });
})()
