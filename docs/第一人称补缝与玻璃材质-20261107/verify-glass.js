(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6500);
  const c = window.__campus, scene = window.__scene;
  if (!c || !scene) return JSON.stringify({ error: 'no globals' });
  const m = c.materials.libraryGlass;
  const info = {
    type: m.type, color: m.color.getHexString(),
    hasMap: !!m.map, mapUuid: m.map ? m.map.uuid.slice(0, 8) : null,
    mapSize: m.map && m.map.image ? [m.map.image.width, m.map.image.height] : null,
    metalness: m.metalness === undefined ? null : m.metalness,
    roughness: m.roughness === undefined ? null : m.roughness,
    clearcoat: m.clearcoat === undefined ? null : m.clearcoat,
    shininess: m.shininess === undefined ? null : m.shininess,
    transparent: m.transparent, opacity: m.opacity,
    side: m.side,
  };
  let batches = 0, instances = 0;
  scene.traverse(o => {
    if (o.isMesh && /libraryGlass/i.test(o.name || '')) { batches++; instances += o.isInstancedMesh ? o.count : 1; }
  });
  /* 确认实际被用于渲染的材质也是新的（不是只有 materials 字典换了） */
  let applied = 0;
  scene.traverse(o => {
    if (!o.isMesh || !/libraryGlass/i.test(o.name || '')) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some(x => x && x.type === 'MeshPhysicalMaterial' && x.map === m.map)) applied++;
  });
  return JSON.stringify({ info, glassBatches: batches, glassInstances: instances, appliedNewMaterialBatches: applied });
})()
