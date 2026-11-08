(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const out = [];
  window.__scene.traverse(o => {
    if (!o.isInstancedMesh || !/canopy|trunk|tree|foliage/i.test(o.name || '')) return;
    const c = o.instanceColor && o.instanceColor.array;
    if (!c) { out.push({ name: o.name, noColor: true }); return; }
    const dark = [], samples = [];
    for (let i = 0; i < o.count; i++) {
      const r = c[i * 3], g = c[i * 3 + 1], b = c[i * 3 + 2];
      if (r < .18 && g < .18 && b < .18) dark.push(i);
      if (i < 3) samples.push([+r.toFixed(2), +g.toFixed(2), +b.toFixed(2)]);
    }
    out.push({ name: o.name, count: o.count, darkCount: dark.length, darkIdx: dark.slice(0, 12), samples });
  });
  /* 顺便找场景里所有纯黑/极深材质 */
  const darkMats = [];
  window.__scene.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const m = o.material;
    if (m.color && m.color.r < .12 && m.color.g < .12 && m.color.b < .12) {
      darkMats.push({ name: o.name, color: m.color.getHexString(), type: m.type });
    }
  });
  return JSON.stringify({ treeColors: out, darkMaterials: darkMats.slice(0, 14) });
})()
