(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6500);
  const T = window.__T, scene = window.__scene, campus = window.__campus;
  if (!T || !scene || !campus) return JSON.stringify({ error: 'no globals' });
  const lib = campus.targets && campus.targets.find(t => t.id === 'lib');
  if (!lib) return JSON.stringify({ error: 'no lib' });
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const out = [];
  scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.decompose(p, q, s);
      if (Math.hypot(p.x - lib.x, p.z - lib.z) > 46) continue;
      if (p.y > 3) continue;                       /* 只看地面层 */
      if (s.x > 40 || s.z > 40) continue;         /* 排除大场地 */
      out.push({ n: o.name, i, x: +p.x.toFixed(1), z: +p.z.toFixed(1),
        w: +s.x.toFixed(1), h: +s.y.toFixed(2), d: +s.z.toFixed(1),
        top: +(p.y + s.y / 2).toFixed(2), z0: +(p.z - s.z / 2).toFixed(1), z1: +(p.z + s.z / 2).toFixed(1) });
    }
  });
  out.sort((a, b) => a.z - b.z || a.top - b.top);
  return JSON.stringify({ lib: { x: +lib.x.toFixed(1), z: +lib.z.toFixed(1) }, count: out.length, items: out.slice(0, 70) });
})()
