/* 3D 冲突综合探针（只读）
   A. 列出所有透明/半透明贴片与其世界 y，找出和道路顶面几乎共面的对；
   B. 检查 11-05 图集 clone（map.offset/repeat 非默认）所对应的 geometry UV 是否越界 → 串格。
*/
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const T = window.__T, scene = window.__scene;
  if (!T || !scene) return JSON.stringify({ error: 'no __T/__scene' });
  const Box3 = T.Box3;
  const decals = [], atlas = [], roads = [];
  const uvRange = g => {
    const a = g && g.attributes && g.attributes.uv;
    if (!a) return null;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < a.count; i++) {
      const u = a.getX(i), v = a.getY(i);
      if (u < u0) u0 = u; if (u > u1) u1 = u;
      if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    return [+u0.toFixed(3), +u1.toFixed(3), +v0.toFixed(3), +v1.toFixed(3)];
  };
  scene.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const b = new Box3().setFromObject(o);
    const rec = {
      name: o.name || '(unnamed)',
      y0: +b.min.y.toFixed(4), y1: +b.max.y.toFixed(4),
      x0: +b.min.x.toFixed(1), x1: +b.max.x.toFixed(1),
      z0: +b.min.z.toFixed(1), z1: +b.max.z.toFixed(1),
      count: o.isInstancedMesh ? o.count : 1,
    };
    for (const m of mats) {
      if (!m) continue;
      if (m.transparent || m.depthWrite === false || o.renderOrder !== 0) {
        decals.push({ ...rec, opacity: m.opacity, depthWrite: m.depthWrite,
          renderOrder: o.renderOrder, hasMap: !!m.map, mat: m.type });
      }
      const t = m.map;
      if (t && (Math.abs(t.offset.x) > 1e-6 || Math.abs(t.offset.y) > 1e-6 ||
                Math.abs(t.repeat.x - 1) > 1e-6 || Math.abs(t.repeat.y - 1) > 1e-6)) {
        const uv = uvRange(o.geometry);
        atlas.push({ name: rec.name,
          offset: [+t.offset.x.toFixed(4), +t.offset.y.toFixed(4)],
          repeat: [+t.repeat.x.toFixed(4), +t.repeat.y.toFixed(4)],
          uv, uvOutOfRange: uv ? (uv[0] < -0.001 || uv[1] > 1.001 || uv[2] < -0.001 || uv[3] > 1.001) : null });
      }
    }
    if (/road|junction|sidewalk|paving|track/i.test(rec.name)) roads.push(rec);
  });
  /* 阴影贴片 vs 道路顶面的 y 差 */
  const near = [];
  for (const d of decals) for (const r of roads) {
    const gap = Math.abs(d.y1 - r.y1);
    const overlapX = Math.min(d.x1, r.x1) - Math.max(d.x0, r.x0);
    const overlapZ = Math.min(d.z1, r.z1) - Math.max(d.z0, r.z0);
    if (gap < 0.05 && overlapX > 0 && overlapZ > 0) {
      near.push({ decal: d.name, road: r.name, gap: +gap.toFixed(4),
        decalY: d.y1, roadY: r.y1, depthWrite: d.depthWrite, renderOrder: d.renderOrder });
    }
  }
  return JSON.stringify({
    decals: decals.slice(0, 14),
    decalCount: decals.length,
    roads: roads.slice(0, 10),
    roadCount: roads.length,
    coplanarCandidates: near.slice(0, 14),
    atlasCount: atlas.length,
    atlasOutOfRange: atlas.filter(a => a.uvOutOfRange).slice(0, 12),
    atlasSample: atlas.slice(0, 6),
  });
})()
