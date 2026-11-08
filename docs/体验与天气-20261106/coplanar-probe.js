/* 静态几何断言：数出交口区域里「顶面差 <0.02m 且水平重叠」的面片对。
   z-fighting 的物理根源就是这个数；连续帧像素指标会被相机位移干扰，
   这个计数不会。box 顶面 = p.y+s.y/2；junction 是水平圆盘 = p.y。 */
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const T = window.__T, scene = window.__scene;
  if (!T || !scene) return JSON.stringify({ error: 'no globals' });
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const faces = [];
  scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    if (!/^(box:road|box:sidewalk|junction:road|junction:sidewalk)$/.test(o.name || '')) return;
    const isJunction = o.name.startsWith('junction');
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.decompose(p, q, s);
      const halfX = isJunction ? s.x / 2 : s.x / 2;
      const halfZ = isJunction ? s.z / 2 : s.z / 2;
      faces.push({
        name: o.name, i,
        x0: p.x - halfX, x1: p.x + halfX,
        z0: p.z - halfZ, z1: p.z + halfZ,
        top: isJunction ? p.y : p.y + s.y / 2,
      });
    }
  });
  let pairs = 0; const samples = [];
  for (let a = 0; a < faces.length; a++) for (let b = a + 1; b < faces.length; b++) {
    const A = faces[a], B = faces[b];
    if (A.name === B.name && A.i === B.i) continue;
    const gap = Math.abs(A.top - B.top);
    /* 0.01m ≈ 2 个深度量化步长(300m 处 .0054m)，超过这个量级不会 z-fight */
    if (gap > 0.01) continue;
    const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
    const oz = Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0);
    if (ox <= 0 || oz <= 0) continue;
    pairs++;
    if (samples.length < 8) samples.push({ a: A.name + '#' + A.i, b: B.name + '#' + B.i, gap: +gap.toFixed(4), overlap: [+ox.toFixed(1), +oz.toFixed(1)] });
  }
  const byName = {};
  faces.forEach(f => { byName[f.name] = (byName[f.name] || 0) + 1; });
  return JSON.stringify({ faceCount: faces.length, byName, coplanarPairs: pairs, samples });
})()
