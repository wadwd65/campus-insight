(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  var out = [];

  var cvs = document.querySelector('canvas');
  var gl = cvs.getContext('webgl2') || cvs.getContext('webgl');
  var W = cvs.width, H = cvs.height;

  var scene = A.scene;
  var bg0 = scene.background;

  /* ── 材质清单 ── */
  function scan(root) {
    var cnt = {};
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var c = o.material.color ? o.material.color.getHexString() : 'none';
      if (!cnt[c]) cnt[c] = 0;
      cnt[c]++;
    });
    return cnt;
  }
  var cntB = scan(A.aptB);
  out.push('── aptB 材质色 ──');
  Object.keys(cntB).sort(function (a, b) { return cntB[b] - cntB[a]; }).forEach(function (k) {
    out.push('  #' + k + '  n=' + cntB[k]);
  });

  /* ── 掩膜 + readPixels（同步：遮好后立刻 requestAnimationFrame 里读）── */
  var results = {};
  var list = ['a3855f','c08466','b3936e','848555','8e887c','5e5a52','6e6a62',
              '4a4842','6e6c68','8c8880','e4e0d8','ac9376','d0c4aa','8e6248','6c4a34'];

  function applyMask(hex) {
    scene.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var c = o.material.color ? o.material.color.getHexString() : '';
      o.visible = (c === hex);
    });
    scene.background = new THREE.Color(0x000000);
  }
  function restore() {
    scene.traverse(function (o) { if (o.isMesh) o.visible = true; });
    scene.background = bg0;
  }
  function readStats() {
    var px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var lum = [], rs = [], gs = [], bs = [];
    for (var i = 0; i < px.length; i += 4) {
      var r = px[i], g = px[i + 1], b = px[i + 2];
      if (r + g + b < 30) continue;
      rs.push(r); gs.push(g); bs.push(b);
      lum.push(0.299 * r + 0.587 * g + 0.114 * b);
    }
    if (!lum.length) return null;
    function mean(a) { var s = 0; for (var k = 0; k < a.length; k++) s += a[k]; return s / a.length; }
    var sat = 0;
    for (var j = 0; j < rs.length; j++) {
      var mx = Math.max(rs[j], gs[j], bs[j]), mn = Math.min(rs[j], gs[j], bs[j]);
      sat += (mx - mn) / (mx || 1);
    }
    return {
      n: lum.length,
      rgb: [mean(rs), mean(gs), mean(bs)],
      L: mean(lum),
      sat: sat / rs.length
    };
  }

  /* 同步跑：applyMask → 强制渲染一帧（用 rAF 同步不了，改用 requestAnimationFrame 队列）
     ★ 简化方案：直接调用 gl 的绘制不可能，因为拿不到 renderer。
       改为：把要测的色号排成队列，每个 rAF 测一个，最后拼结果 —— 但探针必须同步返回。
       ⇒ 折中：一次只测一个色号（由命令行参数控制），多次调用。 */
  var TARGET = (typeof window.__MASKHEX === 'string') ? window.__MASKHEX : null;
  if (!TARGET) {
    out.push('（未设 window.__MASKHEX，只列材质清单）');
    return out.join('\n');
  }
  applyMask(TARGET);
  return 'MASKED ' + TARGET + '（已遮罩，等下一帧读像素）';
})()
