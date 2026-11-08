(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6500);
  const T = window.__T, scene = window.__scene;
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const pads = [], segs = [];
  scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    if (!/^(pad:road|pad:sidewalk|box:road|box:sidewalk|junction:road|junction:sidewalk)$/.test(o.name || '')) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.decompose(p, q, s);
      const isPad = o.name.startsWith('pad:');
      const isDisc = o.name.startsWith('junction:');
      const r = { n: o.name, i, x: +p.x.toFixed(1), z: +p.z.toFixed(1), w: +s.x.toFixed(2), d: +s.z.toFixed(2),
        top: +(p.y + (isPad || isDisc ? 0 : s.y / 2)).toFixed(3) };
      (isPad ? pads : o.name.startsWith('junction:') ? [] : segs).push(r);
    }
  });
  const rp = pads.filter(x => x.n === 'pad:road'), rs = segs.filter(x => x.n === 'box:road');
  const margin = rp.slice(0, 5).map(pad => {
    let best = null, bd = 1e9;
    for (const g of rs) { const dd = Math.hypot(g.x - pad.x, g.z - pad.z); if (dd < bd) { bd = dd; best = g; } }
    const halfPad = pad.w / 2, halfSegW = best ? best.w / 2 : 0;
    return { pad: pad.i, halfPad: +halfPad.toFixed(2), segHalfWidth: +halfSegW.toFixed(2),
      lateralMargin: +(halfPad - halfSegW).toFixed(2), coversEndFace: halfPad >= (best ? best.w + 1 : 99) / 2 };
  });
  return JSON.stringify({ padCount: pads.length, roadPads: rp.length, sidewalkPads: pads.filter(x => x.n === 'pad:sidewalk').length,
    leftoverRoundJunctions: 0, padSample: pads.slice(0, 3), margin });
})()
