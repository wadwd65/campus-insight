(function () {
  var B = window.__BATCH;
  if (!B) return 'no __BATCH';
  var out = [], bad = 0;
  var CHECK = [6, 17, 20, 23, 24, 25, 26, 30, 32, 38];
  CHECK.forEach(function (i) {
    var r = B.buildOne(i);
    var hits = [];
    B.stage().traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var m = o.material;
      if (!(m.map && m.map.image)) return;
      var p = new THREE.Vector3();
      o.getWorldPosition(p);
      hits.push(m.map.image.width + 'x' + m.map.image.height +
                ' @y=' + p.y.toFixed(1) + ' size=' +
                o.geometry.parameters.width.toFixed(2) + 'x' +
                o.geometry.parameters.height.toFixed(2));
    });
    var tag = hits.length ? '' : '   ⚠ 无任何文字/贴图构件';
    if (!hits.length) bad++;
    out.push(String(i).padStart(2) + ' ' + r.id.padEnd(11) + ' 贴图面=' + hits.length + tag);
    hits.slice(0, 4).forEach(function (h) { out.push('      ' + h); });
  });
  out.push('── 无文字构件的建筑数 = ' + bad + ' ──');
  return out.join('\n');
})()
