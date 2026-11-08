/* 修复后复测：读真实阴影层 y（不硬编码）、算与道路顶面的最小间距、
   统计烘焙接触阴影数量、检查 polygonOffset 是否生效。 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const T = window.__T, scene = window.__scene;
  if (!T || !scene) return JSON.stringify({ error: 'no __T/__scene' });
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  let shadowY = null, shadowMat = null;
  const roadTops = {}, decals = [];
  scene.traverse(o => {
    if (o.name === 'static-sun-shadow') {
      shadowY = +o.position.y.toFixed(4);
      shadowMat = { polygonOffset: o.material.polygonOffset,
        factor: o.material.polygonOffsetFactor, units: o.material.polygonOffsetUnits,
        renderOrder: o.renderOrder, depthWrite: o.material.depthWrite };
    }
    if (o.isInstancedMesh && /^(box:road|junction:road|box:sidewalk|box:paving)$/.test(o.name || '')) {
      const arr = [];
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); m.decompose(p, q, s);
        arr.push(+(p.y + s.y / 2).toFixed(4));
      }
      roadTops[o.name] = [...new Set(arr)];
    }
    if (o.isMesh && !o.isInstancedMesh && o.material && o.material.polygonOffset) {
      decals.push({ name: o.name || '(car-shadow)', polygonOffset: true,
        factor: o.material.polygonOffsetFactor, y: +o.position.y.toFixed(3) });
    }
  });
  const gaps = {};
  for (const [name, arr] of Object.entries(roadTops)) {
    gaps[name] = +Math.min(...arr.map(v => Math.abs(v - shadowY))).toFixed(4);
  }
  const campus = window.__campus;
  return JSON.stringify({
    shadowY, shadowMat,
    minGapAcrossAllRoadTops: Math.min(...Object.values(gaps)),
    gapsByLayer: gaps,
    contactShadowCount: campus && campus.shadowContacts ? campus.shadowContacts.length : null,
    polygonOffsetMeshes: decals.slice(0, 6),
    batches: campus && campus.metrics ? campus.metrics.batches : null,
  });
})()
