(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  function stats(root, label) {
    var n = 0, byColor = {};
    var balconyCount = 0, balconyMinY = 1e9, balconyMaxY = -1e9;
    var box = new THREE.Box3().setFromObject(root);
    root.traverse(function (o) {
      if (!o.isMesh) return;
      n++;
      var c = o.material && o.material.color ? o.material.color.getHexString() : 'none';
      byColor[c] = (byColor[c] || 0) + 1;
      /* 阳台材质色：深棕 6a5240 / 浅栏板 b0a794 */
      if (c === '6a5240' || c === 'b0a794' || c === '8e7960' || c === '54402f') {
        balconyCount++;
        var bb = new THREE.Box3().setFromObject(o);
        balconyMinY = Math.min(balconyMinY, bb.min.y);
        balconyMaxY = Math.max(balconyMaxY, bb.max.y);
      }
    });
    var top = Object.keys(byColor).sort(function (a, b) { return byColor[b] - byColor[a]; })
      .slice(0, 12).map(function (k) { return k + ':' + byColor[k]; }).join('  ');
    return label + '\n'
      + '  mesh 总数 ' + n + '\n'
      + '  包围盒 X ' + box.min.x.toFixed(1) + '~' + box.max.x.toFixed(1)
      + '  Y ' + box.min.y.toFixed(1) + '~' + box.max.y.toFixed(1)
      + '  Z ' + box.min.z.toFixed(1) + '~' + box.max.z.toFixed(1) + '\n'
      + '  ★ 阳台材质构件数 ' + balconyCount
      + (balconyCount ? '  y ' + balconyMinY.toFixed(2) + '~' + balconyMaxY.toFixed(2) : '') + '\n'
      + '  色彩分布 top12: ' + top;
  }
  return stats(A.aptA, '[Plan-A 平顶公寓]') + '\n\n' + stats(A.aptB, '[Plan-B 坡顶公寓]');
})()
