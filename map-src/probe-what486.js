(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  var target = '8e887e';
  var items = [];
  A.aptB.traverse(function (o) {
    if (!o.isMesh || !o.material || !o.material.color) return;
    if (o.material.color.getHexString() !== target) return;
    var bb = new THREE.Box3().setFromObject(o);
    var p = o.parent;
    items.push({
      geo: o.geometry.type,
      matName: o.material.name || '(无)',
      hasMap: !!o.material.map,
      pos: [o.position.x.toFixed(2), o.position.y.toFixed(2), o.position.z.toFixed(2)],
      size: [o.geometry.parameters ? (o.geometry.parameters.width || 0).toFixed(2) : '?',
             o.geometry.parameters ? (o.geometry.parameters.height || 0).toFixed(2) : '?',
             o.geometry.parameters ? (o.geometry.parameters.depth || 0).toFixed(2) : '?'],
      parent: p ? (p.userData.tower ? 'aptB' : (p.type + '/' + (p.name || ''))) : '?'
    });
  });
  var out = ['目标 ' + target + ' 共 ' + items.length + ' 个，前 12 个：'];
  items.slice(0, 12).forEach(function (it, i) {
    out.push('  [' + i + '] ' + it.geo + ' size=' + it.size.join('x')
      + ' pos=' + it.pos.join(',') + ' map=' + it.hasMap + ' mat=' + it.matName + ' parent=' + it.parent);
  });
  /* 对比：墙色 c08466 在哪个 mesh */
  out.push('');
  A.aptB.traverse(function (o) {
    if (!o.isMesh || !o.material || !o.material.color) return;
    if (o.material.color.getHexString() === 'c08466') {
      var g = o.geometry;
      out.push('★ 墙色 c08466: ' + g.type + ' size='
        + (g.parameters ? [g.parameters.width, g.parameters.height, g.parameters.depth].join('x') : '?')
        + ' map=' + !!o.material.map
        + ' pos=' + [o.position.x.toFixed(1), o.position.y.toFixed(1), o.position.z.toFixed(1)].join(','));
    }
  });
  return out.join('\n');
})()
