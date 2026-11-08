(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const out = [];
  window.__scene.traverse(o => {
    if (o.isMesh && /canopy|trunk|tree|foliage/i.test(o.name || '')) {
      const m = o.material;
      out.push({
        name: o.name, count: o.isInstancedMesh ? o.count : 1,
        geo: o.geometry && o.geometry.type,
        mat: m && m.type, color: m && m.color ? m.color.getHexString() : null,
        vertexColors: m && m.vertexColors, transparent: m && m.transparent,
        alphaTest: m && m.alphaTest, hasMap: !!(m && m.map),
        castShadow: o.castShadow, visible: o.visible,
        y0: o.geometry && o.geometry.boundingBox ? +o.geometry.boundingBox.min.y.toFixed(2) : null,
      });
    }
  });
  return JSON.stringify({ meshes: out });
})()
