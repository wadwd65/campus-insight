(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6500);
  const T = window.__T, scene = window.__scene, campus = window.__campus;
  if (!T || !scene || !campus) return JSON.stringify({ error: 'no globals' });
  const lib = campus.targets && campus.targets.find(t => t.id === 'lib');
  if (!lib) return JSON.stringify({ error: 'no lib target', keys: Object.keys(campus) });
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const counts = {}, samples = {};
  scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    let n = 0;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.decompose(p, q, s);
      if (Math.hypot(p.x - lib.x, p.z - lib.z) < 55) {
        n++;
        if (!samples[o.name]) samples[o.name] = { x: +p.x.toFixed(1), z: +p.z.toFixed(1), sx: +s.x.toFixed(1), sy: +s.y.toFixed(1), sz: +s.z.toFixed(1) };
      }
    }
    if (n) counts[o.name] = n;
  });
  return JSON.stringify({ lib: { x: +lib.x.toFixed(1), z: +lib.z.toFixed(1) },
    top: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => ({ name: k, n: v, sample: samples[k] })) });
})()
