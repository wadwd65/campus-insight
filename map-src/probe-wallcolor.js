(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  /* ★ 掩膜渲染：只留目标材质可见，其余涂黑 —— 记忆里的 audit-ground 技巧。
     这样"墙到底渲染成什么颜色"就不再靠目测圈窗口。 */
  window.__mask = function (targetHex, onlyIn) {
    var keep = 0, hide = 0;
    (onlyIn || A.scene).traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var cs = o.material.color ? o.material.color.getHexString() : '';
      var name = o.material.name || '';
      var hit = (cs === targetHex) || (name === targetHex);
      if (!o.userData.__origMat) o.userData.__origMat = o.material;
      if (hit) { o.material = o.userData.__origMat; o.visible = true; keep++; }
      else { o.visible = false; hide++; }
    });
    return 'keep=' + keep + ' hide=' + hide;
  };
  window.__unmask = function () {
    A.scene.traverse(function (o) { if (o.isMesh) { o.visible = true; if (o.userData.__origMat) o.material = o.userData.__origMat; } });
    return 'restored';
  };
  /* 列出 aptB 里所有材质色 + 数量，方便我挑"墙"的色号 */
  var cnt = {};
  A.aptB.traverse(function (o) {
    if (!o.isMesh || !o.material) return;
    var c = o.material.color ? o.material.color.getHexString() : 'none';
    var geo = o.geometry ? o.geometry.type : '?';
    var key = c;
    if (!cnt[key]) cnt[key] = { n: 0, geos: {} };
    cnt[key].n++;
    cnt[key].geos[geo] = (cnt[key].geos[geo] || 0) + 1;
  });
  var rows = Object.keys(cnt).map(function (k) {
    return k + ' n=' + cnt[k].n + ' [' + Object.keys(cnt[k].geos).join(',') + ']';
  }).sort(function (a, b) { return parseInt(b.split('n=')[1]) - parseInt(a.split('n=')[1]); });
  return 'aptB 材质色清单（按数量降序）:\n' + rows.join('\n');
})()
