/* 逐实例解矩阵，算道路/铺装的真实世界顶面 y；并列出所有透明贴片的 y。
   Box3.setFromObject 对 InstancedMesh 在 r149 只给单位盒，不能用。 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const T = window.__T, scene = window.__scene;
  if (!T || !scene) return JSON.stringify({ error: 'no __T/__scene' });
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const tops = {}, decals = [];
  scene.traverse(o => {
    if (o.isInstancedMesh && /road|sidewalk|paving|curb|track/i.test(o.name || '')) {
      const arr = [];
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); m.decompose(p, q, s);
        arr.push(+(p.y + s.y / 2).toFixed(4));
      }
      tops[o.name] = { count: o.count, min: Math.min(...arr), max: Math.max(...arr),
        uniq: [...new Set(arr)].slice(0, 10) };
    }
    if (o.isMesh && !o.isInstancedMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mm of mats) {
        if (mm && (mm.transparent || mm.depthWrite === false || o.renderOrder)) {
          decals.push({ name: o.name || '(unnamed)', y: +o.position.y.toFixed(4),
            parentY: +(o.parent && o.parent.position.y || 0).toFixed(4),
            renderOrder: o.renderOrder, depthWrite: mm.depthWrite,
            opacity: mm.opacity, transparent: mm.transparent });
        }
      }
    }
  });
  /* 阴影层 y 与每个道路顶面的最小差 */
  const shadowY = 0.36, gaps = {};
  for (const [name, v] of Object.entries(tops)) {
    gaps[name] = +Math.min(...v.uniq.map(u => Math.abs(u - shadowY)), 99).toFixed(4);
  }
  return JSON.stringify({ roadTops: tops, gapsToShadowLayer: gaps, decals: decals.slice(0, 10) });
})()
