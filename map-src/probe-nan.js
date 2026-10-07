(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  var lines = [];
  var idx = 0;

  A.aptB.traverse(function (o) {
    if (!o.isMesh || !o.geometry) return;
    idx++;
    var pos = o.geometry.attributes.position;
    if (!pos) return;
    var bad = 0, firstBad = -1;
    for (var i = 0; i < pos.count; i++) {
      if (!isFinite(pos.getX(i)) || !isFinite(pos.getY(i)) || !isFinite(pos.getZ(i))) {
        bad++; if (firstBad < 0) firstBad = i;
      }
    }
    /* 世界矩阵也可能有 NaN */
    var wmBad = false;
    var e = o.matrixWorld.elements;
    for (var k = 0; k < 16; k++) if (!isFinite(e[k])) { wmBad = true; break; }

    if (bad > 0 || wmBad) {
      var c = o.material && o.material.color ? o.material.color.getHexString() : 'none';
      var gt = o.geometry.type;
      lines.push('#' + idx + ' ' + gt + ' color=' + c
        + ' 顶点NaN=' + bad + '/' + pos.count + (firstBad >= 0 ? ' 首个@' + firstBad : '')
        + ' 矩阵NaN=' + wmBad
        + ' pos=(' + o.position.x.toFixed(2) + ',' + o.position.y.toFixed(2) + ',' + o.position.z.toFixed(2) + ')');
    }
  });

  return lines.length ? lines.join('\n') : '全部有限（无 NaN）';
})()
