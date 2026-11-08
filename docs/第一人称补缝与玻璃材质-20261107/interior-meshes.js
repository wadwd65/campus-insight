(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  const btn = [...document.querySelectorAll('button')].find(e => (e.textContent || '').includes('图书馆 ↗'));
  if (btn) btn.click();
  await wait(3200);
  const T = window.__T, scene = window.__scene;
  const out = [];
  scene.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    const g = o.geometry; if (!g || !g.boundingBox) g.computeBoundingBox && g.computeBoundingBox();
    const bb = g && g.boundingBox;
    const m = o.material;
    out.push({ name: o.name || '(unnamed)', type: m && m.type, color: m && m.color ? m.color.getHexString() : null,
      inst: o.isInstancedMesh ? o.count : 1,
      y: +o.position.y.toFixed(2),
      bb: bb ? [+bb.min.y.toFixed(2), +bb.max.y.toFixed(2)] : null });
  });
  return JSON.stringify({ count: out.length, meshes: out.slice(0, 40) });
})()
