(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  var L = [];

  /* ★ 换测量口径：不读缓存的 matrixWorld，先手动 update，再逐级追 */
  A.aptB.updateMatrixWorld(true);

  function finite(m) { var e = m.elements; for (var i = 0; i < 16; i++) if (!isFinite(e[i])) return false; return true; }

  /* 找 aptGableRoof 的 Group：aptB 的直接子级里，含 8e887c 材质的 */
  var g2 = null;
  A.aptB.children.forEach(function (c) {
    if (g2) return;
    var has = false;
    c.traverse(function (o) { if (o.isMesh && o.material && o.material.color && o.material.color.getHexString() === '8e887c') has = true; });
    if (has) g2 = c;
  });

  L.push('aptB.matrix finite = ' + finite(A.aptB.matrix));
  L.push('aptB.matrixWorld finite = ' + finite(A.aptB.matrixWorld));
  L.push('aptB.position = ' + [A.aptB.position.x,A.aptB.position.y,A.aptB.position.z].map(function(v){return v.toFixed(2);}).join(','));
  L.push('aptB.scale = ' + [A.aptB.scale.x,A.aptB.scale.y,A.aptB.scale.z].map(function(v){return v.toFixed(4);}).join(','));
  L.push('aptB.quaternion = ' + [A.aptB.quaternion.x, A.aptB.quaternion.y, A.aptB.quaternion.z, A.aptB.quaternion.w].map(function (v) { return v.toFixed(4); }).join(','));
  L.push('');
  if (!g2) { L.push('★ 未找到坡顶 Group'); return L.join('\n'); }
  L.push('坡顶Group children = ' + g2.children.length);
  L.push('坡顶Group.matrix finite = ' + finite(g2.matrix));
  L.push('坡顶Group.matrixWorld finite = ' + finite(g2.matrixWorld));
  L.push('坡顶Group.position type = ' + (typeof g2.position) + ' isVec3=' + (g2.position && g2.position.isVector3 === true));
  L.push('坡顶Group.position raw = ' + JSON.stringify(g2.position));
  L.push('');
  /* 逐个 mesh：先 update 再读自己的 matrix */
  var bad = [];
  g2.children.forEach(function (o, i) {
    if (!o.isMesh) { return; }
    var okM = finite(o.matrix), okW = finite(o.matrixWorld);
    var okQ = isFinite(o.quaternion.x) && isFinite(o.quaternion.y) && isFinite(o.quaternion.z) && isFinite(o.quaternion.w);
    var c = o.material && o.material.color ? o.material.color.getHexString() : '?';
    if (!okM || !okW || !okQ) {
      bad.push('  [' + i + '] ' + o.geometry.type + ' color=' + c
        + ' matrix=' + okM + ' world=' + okW + ' quat=' + okQ
        + ' rot=(' + o.rotation.x.toFixed(3) + ',' + o.rotation.y.toFixed(3) + ',' + o.rotation.z.toFixed(3) + ')'
        + ' pos=(' + o.position.x.toFixed(2) + ',' + o.position.y.toFixed(2) + ',' + o.position.z.toFixed(2) + ')');
    }
  });
  L.push(bad.length ? ('★ 异常构件 ' + bad.length + ' 个：\n' + bad.join('\n')) : '★ 坡顶 Group 内所有 mesh 的 matrix/quat 均有限');

  /* 再算一次包围盒，看是谁把 Box3 搞成 NaN */
  var box = new THREE.Box3();
  g2.children.forEach(function (o) {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    var bb = o.geometry.boundingBox;
    if (!isFinite(bb.min.x) || !isFinite(bb.max.x)) {
      L.push('★ 几何包围盒 NaN: ' + o.geometry.type + ' ' + (o.material.color ? o.material.color.getHexString() : '?'));
    }
  });
  L.push('');
  L.push('直接 new Box3().setFromObject(aptB) = ' + (function(b){return [b.min.x,b.min.y,b.min.z].map(function(v){return v.toFixed(2);}).join(',');})(new THREE.Box3().setFromObject(A.aptB)));
  return L.join('\n');
})()
