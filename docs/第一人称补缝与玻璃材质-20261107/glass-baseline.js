(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6500);
  const c = window.__campus, T = window.__T, scene = window.__scene;
  if (!c || !scene) return JSON.stringify({ error: 'no globals' });
  const m = c.materials.libraryGlass;
  const info = {
    type: m.type, color: m.color.getHexString(),
    hasMap: !!m.map, mapUuid: m.map ? m.map.uuid.slice(0, 8) : null,
    mapSize: m.map && m.map.image ? [m.map.image.width, m.map.image.height] : null,
    shininess: m.shininess === undefined ? null : m.shininess,
    specular: m.specular ? m.specular.getHexString() : null,
    transparent: m.transparent, opacity: m.opacity,
  };
  let glassMeshes = 0, glassInstances = 0;
  scene.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some(x => x && x.map === m.map && x.type === m.type)) {
      glassMeshes++; glassInstances += o.isInstancedMesh ? o.count : 1;
    }
  });
  return JSON.stringify({ info, glassMeshes, glassInstances, allMaterialKeys: Object.keys(c.materials).filter(k => /glass/i.test(k)) });
})()
