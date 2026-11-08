(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const T = window.__T, scene = window.__scene;
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const out = [];
  scene.traverse(o => {
    if (!o.isInstancedMesh || !/^(tree:foliage|trunk:trunk)$/.test(o.name || '')) return;
    const all = [];
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.decompose(p, q, s);
      all.push({ i, x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1),
        sx: +s.x.toFixed(2), sy: +s.y.toFixed(2), sz: +s.z.toFixed(2),
        flat: +(s.x * s.z / Math.max(.01, s.y)).toFixed(1) });
    }
    all.sort((a, b) => b.flat - a.flat);
    out.push({ name: o.name, count: o.count, topFlat: all.slice(0, 10) });
  });
  let sunCast = null, shadowVisible = null;
  scene.traverse(o => {
    if (o.isDirectionalLight && sunCast === null) sunCast = o.castShadow;
    if (o.name === 'static-sun-shadow') shadowVisible = o.visible;
  });
  return JSON.stringify({ meshes: out, sunCastShadow: sunCast, bakedShadowVisible: shadowVisible, url: location.search });
})()
