(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  var out = [];
  /* 1. AC 色板当前值（buildApartment 后应已还原）*/
  out.push('AC.balSide = ' + AC.balSide.toString(16) + '   AC.balPanel = ' + AC.balPanel.toString(16));
  /* 2. 直接手工调一次 aptBalcony，看它能不能产出 mesh */
  var t = new THREE.Group();
  var before = 0;
  try {
    aptBalcony(t, 0, 10, 5, 0, 3, 3.2, 1.35);
    before = t.children.length;
  } catch (e) {
    out.push('!! aptBalcony 抛异常: ' + e.message);
  }
  out.push('手工 aptBalcony 产出 mesh 数 = ' + before);
  if (before) {
    t.children.forEach(function (m, i) {
      var c = m.material && m.material.color ? m.material.color.getHexString() : '?';
      var p = m.position;
      out.push('   [' + i + '] color=' + c + '  pos=(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ',' + p.z.toFixed(2) + ')'
        + '  尺寸=' + m.geometry.parameters.width.toFixed(2) + 'x' + m.geometry.parameters.height.toFixed(2) + 'x' + m.geometry.parameters.depth.toFixed(2));
    });
  }
  /* 3. aptA 里有没有 balSide 色的 mesh（放宽：任何颜色接近 6a5240 的）*/
  var found = [];
  A.aptA.traverse(function (o) {
    if (!o.isMesh || !o.material || !o.material.color) return;
    var h = o.material.color.getHex();
    var r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255;
    /* 深棕判据 */
    if (r > 80 && r < 140 && g > 60 && g < 110 && b > 40 && b < 90) {
      found.push(o.material.color.getHexString() + '@z' + o.position.z.toFixed(1));
    }
  });
  out.push('aptA 中"深棕色系"mesh 数 = ' + found.length + '  ' + found.slice(0, 8).join(' '));
  return out.join('\n');
})()
