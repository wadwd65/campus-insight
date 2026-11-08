(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6500);
  const scene = window.__scene; if (!scene) return JSON.stringify({ error: 'no scene' });
  let batches = 0, instances = 0; const names = [];
  scene.traverse(o => {
    if (!o.isMesh || !/libraryGlass/i.test(o.name || '')) return;
    batches++; const n = o.isInstancedMesh ? o.count : 1; instances += n;
    names.push(o.name + '#' + n);
  });
  return JSON.stringify({ glassBatches: batches, glassInstances: instances, names: names.slice(0, 20) });
})()
