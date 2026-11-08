/* 量图书馆入口沿世界 x 的连通性（考虑 frame 旋转后的真实 AABB） */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6500);
  const T = window.__T, scene = window.__scene, campus = window.__campus;
  if (!T || !scene || !campus) return JSON.stringify({ error: 'no globals' });
  const lib = campus.targets.find(t => t.id === 'lib');
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(), e = new T.Euler();
  const out = [];
  scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    const keys = o.userData.keys || [];
    for (let i = 0; i < o.count; i++) {
      const key = keys[i];
      const isLib = key === 'lib';
      o.getMatrixAt(i, m); m.decompose(p, q, s);
      if (Math.hypot(p.x - lib.x, p.z - lib.z) > 46) continue;
      if (p.z < 34 || p.z > 53) continue;          /* 门厅所在的中间带 */
      if (p.y > 3) continue;                        /* 地面层 */
      e.setFromQuaternion(q, 'YXZ'); const th = e.y;
      const hw = (Math.abs(Math.cos(th)) * s.x + Math.abs(Math.sin(th)) * s.z) / 2;
      const hd = (Math.abs(Math.sin(th)) * s.x + Math.abs(Math.cos(th)) * s.z) / 2;
      if (!isLib && !(s.x > 8 && s.z > 8)) continue; /* 非 lib 只留大平台 */
      out.push({ n: o.name, i, key: key || '-', x0: +(p.x - hw).toFixed(2), x1: +(p.x + hw).toFixed(2),
        z0: +(p.z - hd).toFixed(1), z1: +(p.z + hd).toFixed(1), top: +(p.y + s.y / 2).toFixed(2) });
    }
  });
  out.sort((a, b) => a.x0 - b.x0 || a.top - b.top);
  /* 相邻构件在 x 上的空隙（只看 y<1 的地面/台阶/基座层） */
  const ground = out.filter(v => v.top < 1.1);
  const gaps = [];
  for (let i = 1; i < ground.length; i++) {
    const g = +(ground[i].x0 - ground[i - 1].x1).toFixed(2);
    if (g > 0.15) gaps.push({ between: ground[i - 1].n + '#' + ground[i - 1].i + ' → ' + ground[i].n + '#' + ground[i].i, gap: g });
  }
  return JSON.stringify({ lib: { x: +lib.x.toFixed(1), z: +lib.z.toFixed(1) }, count: out.length,
    ground: ground.slice(0, 30), gaps: gaps.slice(0, 12) });
})()
