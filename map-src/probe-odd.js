(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  var L = [];
  /* ★ 换口径：把 aptB 里**所有** mesh 的包围盒投到屏幕上，
     找出"明显超出楼体轮廓"的构件（那些戳出来的棒子）。
     ──────────────────────────────────────────────────────────────
     楼体：X ∈ [-18,18]、Y ∈ [0,~23.8]、Z ∈ [-17.75, 5.75]（含出檐）
     凡包围盒超出这个范围 0.5m 以上的，全部列出来。 */
  var BX = { x0: -19.5, x1: 19.5, y0: -1.0, y1: 25.5, z0: -19.0, z1: 7.0 };
  var odd = [];
  A.aptB.traverse(function (o) {
    if (!o.isMesh) return;
    var bb = new THREE.Box3().setFromObject(o);
    if (!isFinite(bb.min.x)) return;
    var over = 0, why = [];
    if (bb.min.x < BX.x0 - 0.3) { over++; why.push('x-min ' + bb.min.x.toFixed(2)); }
    if (bb.max.x > BX.x1 + 0.3) { over++; why.push('x-max ' + bb.max.x.toFixed(2)); }
    if (bb.min.y < BX.y0 - 0.3) { over++; why.push('y-min ' + bb.min.y.toFixed(2)); }
    if (bb.max.y > BX.y1 + 0.3) { over++; why.push('y-max ' + bb.max.y.toFixed(2)); }
    if (bb.min.z < BX.z0 - 0.3) { over++; why.push('z-min ' + bb.min.z.toFixed(2)); }
    if (bb.max.z > BX.z1 + 0.3) { over++; why.push('z-max ' + bb.max.z.toFixed(2)); }
    if (over) {
      odd.push({
        geo: o.geometry.type,
        color: o.material && o.material.color ? o.material.color.getHexString() : '?',
        size: o.geometry.parameters ? [o.geometry.parameters.width, o.geometry.parameters.height, o.geometry.parameters.depth].map(function (v) { return v === undefined ? '-' : (+v).toFixed(2); }).join('x') : '-',
        pos: [o.position.x.toFixed(2), o.position.y.toFixed(2), o.position.z.toFixed(2)].join(','),
        rot: [o.rotation.x.toFixed(3), o.rotation.y.toFixed(3), o.rotation.z.toFixed(3)].join(','),
        bb: [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map(function (v) { return v.toFixed(2); }).join(' '),
        why: why.join(' ')
      });
    }
  });
  L.push('★ aptB 内"超出楼体轮廓"的构件共 ' + odd.length + ' 个：');
  odd.slice(0, 25).forEach(function (o, i) {
    L.push('  [' + i + '] ' + o.geo + ' col=' + o.color + ' size=' + o.size
      + '\n      pos=(' + o.pos + ') rot=(' + o.rot + ')'
      + '\n      bb=(' + o.bb + ')  ← ' + o.why);
  });
  L.push('');
  L.push('★ 全场景扫描：aptA / aptB / campus 各自包围盒');
  ['aptA', 'aptB', 'campus'].forEach(function (nm) {
    var obj = A[nm];
    if (!obj) return;
    var b = new THREE.Box3().setFromObject(obj);
    L.push('  ' + nm + ' = [' + [b.min.x, b.min.y, b.min.z].map(function (v) { return v.toFixed(2); }).join(', ')
      + '] ~ [' + [b.max.x, b.max.y, b.max.z].map(function (v) { return v.toFixed(2); }).join(', ') + ']');
  });
  /* 列出 campus 顶层子对象（谁在场景里）*/
  L.push('');
  L.push('★ campus 顶层子对象 ' + A.campus.children.length + ' 个：');
  A.campus.children.forEach(function (c, i) {
    var b = new THREE.Box3().setFromObject(c);
    var isGround = c.geometry && c.geometry.type === 'PlaneGeometry';
    L.push('  [' + i + '] ' + c.type + (c.name ? (' name=' + c.name) : '')
      + ' tower=' + !!c.userData.tower
      + ' bb=[' + [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(function (v) { return v.toFixed(1); }).join(',') + ']');
  });
  /* ★ 全场景找"细长且斜置"的构件（棒子的特征）*/
  L.push('');
  L.push('★ 全场景"细长斜置"构件（长/宽 > 8 且 rotation.x 非 0）：');
  var sticks = [];
  A.scene.traverse(function (o) {
    if (!o.isMesh || !o.geometry) return;
    var p = o.geometry.parameters;
    if (!p || p.width === undefined) return;
    var dims = [p.width, p.height, p.depth].sort(function (a, b) { return a - b; });
    var ratio = dims[2] / Math.max(0.001, dims[0]);
    if (ratio > 8 && Math.abs(o.rotation.x) > 0.05) {
      sticks.push('  ' + o.geometry.type + ' ' + dims.map(function (v) { return v.toFixed(2); }).join('x')
        + ' rot.x=' + o.rotation.x.toFixed(3) + ' pos=' + [o.position.x.toFixed(1), o.position.y.toFixed(1), o.position.z.toFixed(1)].join(',')
        + ' col=' + (o.material && o.material.color ? o.material.color.getHexString() : '?'));
    }
  });
  L.push(sticks.length ? sticks.slice(0, 15).join('\n') : '  （无）');
  return L.join('\n');
})()
