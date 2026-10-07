(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  var out = [];

  /* 从 canvas 直接拿 GL 上下文 */
  var cvs = document.querySelector('canvas');
  var gl = cvs.getContext('webgl2') || cvs.getContext('webgl');
  var W = cvs.width, H = cvs.height;
  out.push('canvas ' + W + 'x' + H + '  gl=' + (gl ? 'OK' : 'null'));

  /* ── 1. 列出 aptB 全部材质色 ── */
  function scan(root) {
    var cnt = {};
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var c = o.material.color ? o.material.color.getHexString() : 'none';
      if (!cnt[c]) cnt[c] = { n: 0, geo: {}, map: 0 };
      cnt[c].n++;
      var g = o.geometry ? o.geometry.type : '?';
      cnt[c].geo[g] = (cnt[c].geo[g] || 0) + 1;
      if (o.material.map) cnt[c].map++;
    });
    return cnt;
  }
  var cntB = scan(A.aptB);
  out.push('── aptB（坡顶公寓）材质色 ──');
  Object.keys(cntB).map(function (k) {
    return { k: k, n: cntB[k].n, geo: Object.keys(cntB[k].geo).join(','), map: cntB[k].map };
  }).sort(function (a, b) { return b.n - a.n; }).forEach(function (r) {
    out.push('  #' + r.k + '  n=' + r.n + '  map=' + r.map + '  [' + r.geo + ']');
  });

  /* ── 2. 掩膜渲染 + readPixels ──
     ★ 关键：不能依赖 scene.background（可能为空/被别的组盖住），
       改为用"全黑清屏 + 只留目标可见"的差分法：
       先渲染"全场景涂黑"当底，再渲染"只留目标" —— 两次都读像素，
       只有目标可见的那次非黑像素才是目标贡献。简单起见直接用后者。 */
  var scene = A.scene;
  var bg0 = scene.background;
  var cam = null;
  scene.traverse(function (o) { if (!cam && o.isCamera) cam = o; });
  out.push('camera found = ' + (cam ? cam.type : 'NO'));

  function measure(targetHex) {
    var keep = 0;
    scene.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var c = o.material.color ? o.material.color.getHexString() : '';
      o.visible = (c === targetHex);
      if (o.visible) keep++;
    });
    scene.background = new THREE.Color(0x000000);
    if (gl && cam) {
      /* 手动清屏 + 用它自己的渲染循环不方便，改用 readPixels 前先 render 一次 */
    }
    var ok = false;
    try {
      if (window.__RENDER) { window.__RENDER(); ok = true; }
    } catch (e) {}
    var px = new Uint8Array(W * H * 4);
    var res = '';
    if (ok) {
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      var lum = [], rs = [], gs = [], bs = [];
      for (var i = 0; i < px.length; i += 4) {
        var r = px[i], g = px[i + 1], b = px[i + 2];
        if (r + g + b < 24) continue;
        rs.push(r); gs.push(g); bs.push(b);
        lum.push(0.299 * r + 0.587 * g + 0.114 * b);
      }
      if (lum.length) {
        lum.sort(function (a, b) { return a - b; });
        function mean(a) { var s = 0; for (var k = 0; k < a.length; k++) s += a[k]; return s / a.length; }
        function pc(a, p) { return a[Math.min(a.length - 1, Math.floor(a.length * p))]; }
        var sat = 0;
        for (var j = 0; j < rs.length; j++) {
          var mx = Math.max(rs[j], gs[j], bs[j]), mn = Math.min(rs[j], gs[j], bs[j]);
          sat += (mx - mn) / (mx || 1);
        }
        sat /= rs.length;
        res = 'px=' + lum.length +
          ' RGB=(' + mean(rs).toFixed(0) + ',' + mean(gs).toFixed(0) + ',' + mean(bs).toFixed(0) + ')' +
          ' L_mean=' + mean(lum).toFixed(1) + ' med=' + pc(lum, .5).toFixed(1) +
          ' p90=' + pc(lum, .9).toFixed(1) + ' p99=' + pc(lum, .99).toFixed(1) +
          ' sat=' + sat.toFixed(3);
      } else { res = '** 0 可见像素 **'; }
    } else { res = '__RENDER() 不可用'; }
    return { keep: keep, res: res };
  }

  /* 还原 */
  function restore() {
    scene.traverse(function (o) { if (o.isMesh) o.visible = true; });
    scene.background = bg0;
  }

  out.push('── 掩膜实测 ──');
  var targets = out.filter(function (s) { return false; });  // noop
  var list = ['a3855f', 'c08466', 'b3936e', '848555',
              '8e887c', '5e5a52', '6e6a62', '4a4842',
              '6e6c68', '8c8880'];
  list.forEach(function (h) {
    if (!cntB[h] && !scan(A.scene)[h]) return;
    var m = measure(h);
    out.push('  #' + h + '  keep=' + m.keep + '  ' + m.res);
  });
  restore();
  return out.join('\n');
})()
