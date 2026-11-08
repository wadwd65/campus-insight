(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const T = window.__T, scene = window.__scene;
  if (!T || !scene) return JSON.stringify({ error: 'no globals' });
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const tiny = [], byName = {};
  scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    if (!/^(box:road|box:sidewalk|junction:road|junction:sidewalk)$/.test(o.name || '')) return;
    byName[o.name] = o.count;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.decompose(p, q, s);
      if (s.z < 2.5 || s.x < 2.5) tiny.push({ n: o.name, i, x: +p.x.toFixed(1), z: +p.z.toFixed(1), sx: +s.x.toFixed(2), sy: +s.y.toFixed(2), sz: +s.z.toFixed(2) });
    }
  });
  const grid = {};
  tiny.forEach(t => { const k = Math.round(t.x / 30) + ',' + Math.round(t.z / 30); grid[k] = (grid[k] || 0) + 1; });
  return JSON.stringify({ byName, tinyCount: tiny.length, tiny: tiny.slice(0, 18), clusters: Object.entries(grid).sort((a, b) => b[1] - a[1]).slice(0, 8) });
})()
