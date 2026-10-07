/* -*- coding: utf-8 -*- */
/* ══════════════════════════════════════════════════════════════════
   tower-11-campus-terrain.js —— 完整地图的「地形层」
   地面（含用地红线形状）/ 晴缘湖 / 田径场台地 / 校园道路

   ★ 坐标系：世界 1 单位 = 1m；原点 = 校园中心（对应平面图切片 (102,105)）
   ★ 大地面用**一张 canvas 贴图**画完（一次 draw call）——
     草地 / 郊野 / 铺装 / 用地边界 全部画进去，
     比"逐格摆 mesh"既省又精细（贴图分辨率 0.29 m/px）。
   ══════════════════════════════════════════════════════════════════ */

/* canvas 覆盖的世界范围。
   ★ 收到 ±360：初版 ±620 时，校园（±280）与城市层之间会露出一圈
     "深绿荒地"（校园层的郊野），过渡生硬、像贴了两个地块。
     现在校园层只负责校园本体 + 一圈缓冲，剩下的全交给 campCity()。
   ★ 顺带精度还提高了：720m / 4096 = **0.176 m/px**（原来 0.30）。 */
var CAMP_G = { x0: -360, x1: 360, z0: -360, z1: 360, N: 4096 };

/* 世界坐标 → canvas 像素 */
function cgU(x) { return (x - CAMP_G.x0) / (CAMP_G.x1 - CAMP_G.x0) * CAMP_G.N; }
function cgV(z) { return (z - CAMP_G.z0) / (CAMP_G.z1 - CAMP_G.z0) * CAMP_G.N; }

/* 切片坐标 → canvas 像素（先过 cx/cz 换世界，再换 canvas）*/
function cgPX(px) { return cgU(cx(px)); }
function cgPY(py) { return cgV(cz(py)); }

/* ★ 湖岸扰动**单一真源**（10-06 深夜）。
   主体 3D（ring/skirt）与 canvas 环湖步道必须用**同一个** w(a)，
   否则水岸与步道对不上（此前步道是正椭圆、水面有扰动 ⇒ 北侧露白弧）。
   幅度 ±8.75%：轮廓明显有机、又不捏成水滴（v7~v11 两头都踩过）。
   ★ 10-07：湖改用**真实轮廓多边形**（CAMP_LAKE_POLY）后，
   本函数只保留给包络椭圆兜底（旧代码路径），多边形世界不再需要它。 */
function lakeWob(a) {
  return 1 + 0.25 * (Math.sin(a * 3 + 0.7) * .17 + Math.sin(a * 5 - 1.9) * .11
                   + Math.sin(a * 7 + 2.4) * .07);
}

/* ══ 真实湖轮廓的工具（10-07）══════════════════════════════════════
   lakePolyPts(sc)：按质心缩放的多边形（切片坐标）—— sc=1 就是真实岸线，
     sc>1 是向外偏移的等距近似（湖 25px 尺度下 1.06 倍≈1.5px≈5m，够用）。
   lakeHit(px,py,k)：点是否落在缩放 k 倍的多边形内（射线法）—— 树木/家具/草簇的排斥闸门。
   lakeShape(sc) / lakeHolePath(sc)：给 ShapeGeometry 的点集，**喂 [cx, -cz]**
     （ShapeGeometry + rotation.x=-π/2 会把 shape 的 y 映成世界 -z，镜像铁律）。 */
function lakePolyPts(sc) {
  var n = CAMP_LAKE_POLY.length, sx = 0, sy = 0;
  CAMP_LAKE_POLY.forEach(function (p) { sx += p[0]; sy += p[1]; });
  var cxp = sx / n, cyp = sy / n;
  return CAMP_LAKE_POLY.map(function (p) {
    return [cxp + (p[0] - cxp) * sc, cyp + (p[1] - cyp) * sc];
  });
}
function lakeHit(px, py, sc) {
  var poly = lakePolyPts(sc), inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function lakeShape(sc) {
  var s = new THREE.Shape();
  lakePolyPts(sc).forEach(function (p, i) {
    var x = cx(p[0]), z = -cz(p[1]);
    i ? s.lineTo(x, z) : s.moveTo(x, z);
  });
  s.closePath();
  return s;
}
function lakeHolePath(sc) {
  var pa = new THREE.Path();
  lakePolyPts(sc).forEach(function (p, i) {
    var x = cx(p[0]), z = -cz(p[1]);
    i ? pa.lineTo(x, z) : pa.moveTo(x, z);
  });
  pa.closePath();
  return pa;
}

/* ══════════════════════════════════════════════════════════════════
   ① 大地面
   ══════════════════════════════════════════════════════════════════ */
function campGround() {
  var g = new THREE.Group();
  var N = CAMP_G.N;
  var cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  var c2 = cv.getContext('2d');

  /* 底：校园外的郊野（比校内草地**明显暗一档** —— 初版两色只差一档，
     远看校园与郊野糊成一片绿，读不出"这是一所有围墙的学校"）*/
  c2.fillStyle = '#3C4C28';
  c2.fillRect(0, 0, N, N);
  /* 郊野上的细碎斑驳（避免大片纯色 = 卡通感的主要来源）*/
  for (var i = 0; i < 2600; i++) {
    var u = rnd(i, 3.1) * N, v = rnd(i, 7.7) * N, s = 18 + rnd(i, 5.5) * 46;
    c2.fillStyle = rnd(i, 9.3) > .5 ? 'rgba(96,116,66,.22)' : 'rgba(74,92,52,.20)';
    c2.beginPath(); c2.ellipse(u, v, s, s * (.5 + rnd(i, 11) * .5), rnd(i, 13) * 3, 0, 6.3); c2.fill();
  }

  /* ★ 校园外的城市环境已摘到独立的 campCity()（见文件末尾）——
     城市要用「更大范围 + 更低精度」的单独一层贴图，
     与校园层（±620m / 0.30 m/px）分开，否则要么糊、要么露边。 */
  /* 用地红线内的校园本体（亮一档的草地）*/
  c2.save();
  c2.beginPath();
  CAMP_BOUND.forEach(function (p, k) {
    var u = cgPX(p[0]), v = cgPY(p[1]);
    k ? c2.lineTo(u, v) : c2.moveTo(u, v);
  });
  c2.closePath();
  c2.fillStyle = '#6F9048';   /* 10-06：原 #7C9C52 朝天面被抬升 +43 后洗成黄绿，压深一档 */
  c2.fill();
  c2.clip();                       /* 以下全部只在校园内画 */

  /* 校园草地的层次：深浅斑块 + 修剪条带。
     ★ 斑块要**又多又小又淡**：初版 2200 块、半径 22~82px，渲出来是大片
     均匀绿（远看就是一张色卡）。改成 5200 块、半径 10~46px、对比再压淡，
     远看是"有质感的草坪"，近看也不出现明显斑块边界。 */
  for (var j = 0; j < 5200; j++) {
    var a = rnd(j, 21.3) * N, b = rnd(j, 23.7) * N, r2 = 10 + rnd(j, 27) * 36;
    c2.fillStyle = rnd(j, 29) > .48 ? 'rgba(132,162,88,.13)' : 'rgba(92,118,62,.12)';
    c2.beginPath(); c2.ellipse(a, b, r2, r2 * .62, rnd(j, 31) * 3, 0, 6.3); c2.fill();
  }
  /* 修剪条带（沿南北向，淡淡的一道道 —— 草坪"被剪过"的读感）*/
  for (var k2 = 0; k2 < 46; k2++) {
    var uu = cgPX(20 + k2 * 3.6);
    c2.fillStyle = 'rgba(255,255,255,.022)';
    c2.fillRect(uu, 0, (CAMP_G.N / 210) * 1.6, N);
  }

  /* ─────────────────────────────────────────────────────────────────
     10-06 新增：**能看见的草**（用户要"地面粒粒分明"）
     ─────────────────────────────────────────────────────────────────
     ⚠️ 先算尺度：校园层 4096px / 720m = **0.176 m/px**。
     近景机位（建筑特写，距目标 ~330m）垂直 **3.77 px/m**，
     航拍（~780m）**1.59 px/m**。⇒ 一根 3cm 的草叶 = 近景 0.11px / 航拍 0.05px
     ⇒ **亚像素，等于没画**（技能里的老坑，本轮再次命中）。
     正解分两层：
       ① **贴图层**：1~3 画布像素的短笔触 = 近景 1~2 屏幕像素，粒粒可数；
       ② **3D 层**（campTufts）：0.45m 宽的草簇，交给 3D 给轮廓和自阴影。
     本段只做 ①：草簇笔触 + 三叶草点 + 细碎落英（落叶/白点）。 */
  function tuft(u, v, sc, dark) {
    var n2 = 3 + Math.floor(rnd(u * 0.7 + v * 0.3, 41) * 3);   /* 3~5 叶 */
    c2.lineWidth = 1;
    c2.strokeStyle = dark
      ? 'rgba(84,112,46,.72)'
      : 'rgba(162,196,104,.70)';
    for (var t = 0; t < n2; t++) {
      var a2 = rnd(u + t * 3.1, 43) * 6.283;
      var ln = (1.6 + rnd(u + t * 5.3, 47) * 2.4) * sc;
      var bend = (rnd(u + t * 7.7, 53) - .5) * 1.5 * sc;
      var ex = u + Math.cos(a2) * ln, ey = v + Math.sin(a2) * ln * .8;
      c2.beginPath();
      c2.moveTo(u, v);
      c2.quadraticCurveTo(u + bend * .5, v - ln * .5, ex, ey);
      c2.stroke();
    }
  }
  /* ① 草簇笔触：9000 丛，1~3px，跟随深浅斑块的明暗（不是均匀撒） */
  for (var tf = 0; tf < 14000; tf++) {
    var tu = rnd(tf, 61.1) * N, tv = rnd(tf, 67.3) * N;
    tuft(tu, tv, 0.55 + rnd(tf, 71) * 0.75, rnd(tf, 73) > .5);
  }
  /* ② 三叶草/碎叶点：4200 个 1px 点，成小簇分布（每簇 5~9 点） */
  /* ⚠️⚠️ 变量名铁律：这里的第二个坐标**不能叫 cv**。
     `var` 是函数作用域内提升、与外层同名即**覆盖**：
     初版写成 `var cu = ..., cv = rnd(...)` ⇒ 把函数开头的 canvas 对象
     顶成一个数字 ⇒ 贴图上传时 image 是 Number ⇒
     `texSubImage2D` 报 "dimensions not positive" ⇒ **整张地面全黑**。
     诊断线索：`window.__CAMP_GROUND_CV` 打印出来 typeof === 'number'。 */
  for (var cl = 0; cl < 840; cl++) {
    var cu = rnd(cl, 79.1) * N, cv2 = rnd(cl, 83.3) * N;
    var cn = 5 + Math.floor(rnd(cl, 89) * 5);
    c2.fillStyle = rnd(cl, 97) > .55 ? 'rgba(176,206,116,.60)' : 'rgba(78,102,46,.52)';
    for (var ci = 0; ci < cn; ci++) {
      var an = rnd(cl * 11 + ci, 101) * 6.283;
      var rr3 = rnd(cl * 13 + ci, 103) * 4.5;
      c2.fillRect(cu + Math.cos(an) * rr3, cv2 + Math.sin(an) * rr3 * .8, 1, 1);
    }
  }
  /* ③ 零星落英（浅色小花点，每簇 3~5 点，压在草簇之上）*/
  for (var fl = 0; fl < 260; fl++) {
    var fu = rnd(fl, 107.1) * N, fv = rnd(fl, 109.3) * N;
    c2.fillStyle = rnd(fl, 113) > .5 ? 'rgba(238,238,220,.55)' : 'rgba(232,214,150,.48)';
    for (var fj = 0; fj < 3 + Math.floor(rnd(fl, 127) * 3); fj++) {
      var fr = rnd(fl * 17 + fj, 131) * 3.2;
      c2.fillRect(fu + (rnd(fl * 19 + fj, 137) - .5) * fr * 2,
                  fv + (rnd(fl * 23 + fj, 139) - .5) * fr * 2, 1, 1);
    }
  }

  /* ★★★ 铺装区 —— 校园的"空地"**大部分是铺装**，不是草地。
     初版几乎全是草 ⇒ 读起来像"郊外别墅区"而不是大学校园（v2 截图）。
     真实校园里：建筑周围是广场与人行道、车行道，草地只出现在草坪与绿化带。
     ⇒ 给**每个建筑组团铺一块底板**，相邻底板自然连成连续铺装面。 */
  function pad(px, py, w, d, rot) {
    c2.save();
    c2.translate(cgPX(px), cgPY(py));
    c2.rotate(rot || 0);
    /* ★★★ 世界米 → canvas px 的换算系数。
       ⚠️ 初版写成 `(w / CAMP.k) * (N / 世界跨度)` —— **多除了一次 CAMP.k**，
       铺装被画成 1/3.5 大小（约 1.4m 见方），全部被草地盖住 ⇒ v3 截图里
       "铺装完全看不见"。正确系数就是 `N / 世界跨度`（单位：canvas px / m）。 */
    var sx = CAMP_G.N / (CAMP_G.x1 - CAMP_G.x0);
    var sz = CAMP_G.N / (CAMP_G.z1 - CAMP_G.z0);
    var W = w * sx, D = d * sz;
    c2.fillStyle = '#B6B0A4';
    c2.fillRect(-W / 2, -D / 2, W, D);
    /* 板材分格（3.2m 一道，与实拍石材大板同尺度）*/
    c2.strokeStyle = 'rgba(92,88,82,.26)'; c2.lineWidth = 2.2;
    var step = 3.2 * sx;
    for (var u = -W / 2; u <= W / 2; u += step) {
      c2.beginPath(); c2.moveTo(u, -D / 2); c2.lineTo(u, D / 2); c2.stroke();
    }
    for (var v = -D / 2; v <= D / 2; v += step) {
      c2.beginPath(); c2.moveTo(-W / 2, v); c2.lineTo(W / 2, v); c2.stroke();
    }
    /* ★ 收边：铺装与草地之间的一道深色窄边。
       这一条对"设计感"的提升最明显 —— 没有收边时，灰色的铺装块像是
       "草绿画布上贴的灰纸"；有了收边才有"这里被规划过"的读感。 */
    c2.strokeStyle = 'rgba(78,74,68,.55)';
    c2.lineWidth = 3.2;
    c2.strokeRect(-W / 2, -D / 2, W, D);
    c2.restore();
  }
  /* 成片铺装：整组整组地铺，让相邻区域连成连续铺装面。
     ⚠️ 必须避开晴缘湖（椭圆 px 79~127 / py 87~129），否则广场会盖到水面上。 */
  pad(52, 66, 56, 44, 0);        /* 西侧北段（实验楼区）*/
  pad(50, 114, 52, 50, 0);       /* 西侧中段 */
  pad(54, 160, 64, 48, 0);       /* 西侧南段 + 西南组团 */
  pad(154, 52, 58, 44, 0);       /* 北侧一列（教学楼区；让开田径场 px77~123）*/
  pad(158, 90, 54, 26, 0);       /* 北侧南段 */
  pad(167, 124, 44, 74, 0);      /* 东侧新建区 */
  pad(166, 166, 54, 34, 0);      /* 东南组团 */
  pad(92, 154, 104, 36, 0);      /* 南侧（食堂 / 体育馆 / 公寓前排）*/
  pad(94, 180, 114, 28, 0);      /* 南侧后排 */
  pad(68, 108, 15, 40, 0);       /* 湖西小广场（贴湖西界，不进水）*/
  pad(34, 132, 26, 70, 0);       /* 小吃街人行街面 */
  /* 连接步道（窄长条，把各组团串起来；同样避开湖面）*/
  pad(92, 66, 5.4, 62, 0);
  pad(72, 150, 5.4, 30, 0);      /* 湖西侧步道（只在湖南段，不贴新湖西界 px82）*/
  pad(133, 68, 5.4, 56, 0);
  pad(142, 104, 48, 5.4, 0);     /* 东西步道只在湖东（10-07：湖东沿到 x141，东移让开）*/
  pad(92, 168, 5.4, 42, 0);
  pad(148, 152, 44, 5.4, 0);

  /* ★★ 主轴林荫道：南校门 → 南广场 → **湖畔** → 田径场。
     一所学校"像学校"的关键不是楼多，而是**有一条能一眼读懂的主轴**。
     ⚠️ 主轴**不能穿湖**：初版写了 `pad(96,116,6.5,22)` 与 `pad(101,84,15,30)`，
       它们的范围落在湖面里（湖 px79~127 / py87~129）⇒ 湖被一条浅色带切成
       左右两块（v7/v8 截图都能看到那条"分界线"）。
     ✅ 正解：主轴在两岸**各自终止**，用环湖步道绕过去衔接。 */
  pad(102, 168, 15, 24, 0);      /* 南门内引道 */
  pad(102, 152, 15, 20, 0);      /* 主轴 · 南段（10-07：湖东移后南移，止于湖南岸 y140）*/
  pad(100, 78, 15, 20, 0);       /* 主轴 · 北段（田径场与湖之间）*/

  /* ★★ 环湖步道：沿湖一圈（用 even-odd 填出环带；湖本身是 3D 实体，
     canvas 上只画它外圈这一步道）
     ★★★ 10-06 深夜：步道必须**跟水岸用同一个 lakeWob(a)**。
     初版用 c2.ellipse 画正椭圆 ⇒ 水面有扰动、步道没有，
     北侧露出一圈白弧（航拍图里"湖边的白月牙"就是这么来的）。 */
  (function () {
    var sc = CAMP_G.N / (CAMP_G.x1 - CAMP_G.x0);
    function lakeSub(scaleR) {           /* 只加子路径，不 beginPath */
      var poly = lakePolyPts(scaleR);
      for (var i = 0; i <= poly.length; i++) {
        var p = poly[i % poly.length];
        var u = cgPX(p[0]), v = cgPY(p[1]);
        i ? c2.lineTo(u, v) : c2.moveTo(u, v);
      }
      c2.closePath();
    }
    void sc;
    c2.beginPath(); lakeSub(1.20); lakeSub(1.045);
    c2.fillStyle = '#BEB8AE';
    c2.fill('evenodd');
    /* 步道外沿一圈草地收边（把"路"和"湖"分开一档）*/
    c2.beginPath(); lakeSub(1.28); lakeSub(1.195);
    c2.fillStyle = '#648A44';
    c2.fill('evenodd');
  })();

  /* ★★★ 10-07：**人行小道**（用户点名："人行小道都得能看出来"）
     画法：折线描边（round cap/join），先深色收边再铺浅石色 ⇒ 远看是一条条细路。
     宽度 2.4~3.0m（真实校园步道尺度）。路线全程避开湖面。 */
  function walk(pts, wm) {
    var w = wm * (CAMP_G.N / (CAMP_G.x1 - CAMP_G.x0));
    c2.lineCap = 'round'; c2.lineJoin = 'round';
    c2.beginPath();
    pts.forEach(function (p, i) { var u = cgPX(p[0]), v = cgPY(p[1]); i ? c2.lineTo(u, v) : c2.moveTo(u, v); });
    c2.strokeStyle = 'rgba(112,108,100,.50)'; c2.lineWidth = w + 2.0; c2.stroke();
    c2.strokeStyle = '#CAC6BA'; c2.lineWidth = w; c2.stroke();
  }
  walk([[102, 170], [102, 158], [103, 148]], 3.0);                 /* 南门 → 湖岸 */
  walk([[74, 152], [100, 150], [124, 145], [138, 138]], 2.6);      /* 湖南岸横径 */
  walk([[86, 148], [84, 128], [88, 108], [96, 100]], 2.4);         /* 湖西径 */
  walk([[146, 126], [148, 110], [142, 100], [132, 92]], 2.4);      /* 湖东径 */
  walk([[56, 68], [56, 100], [56, 132], [56, 150]], 2.4);          /* 公寓列间纵径 */
  walk([[60, 76], [80, 82], [100, 86], [118, 82]], 2.2);           /* 湖北横径 */
  walk([[150, 58], [152, 84], [152, 112]], 2.2);                   /* 东侧纵径 */
  walk([[104, 86], [104, 96]], 2.0);
  walk([[66, 140], [82, 144]], 2.0);

  c2.restore();                    /* 结束 clip */

  /* 用地红线（画在贴图上，作为校园边界的一条淡色收边）*/
  c2.beginPath();
  CAMP_BOUND.forEach(function (p, k) {
    var u = cgPX(p[0]), v = cgPY(p[1]);
    k ? c2.lineTo(u, v) : c2.moveTo(u, v);
  });
  c2.closePath();
  c2.strokeStyle = 'rgba(196,160,90,.55)';
  c2.lineWidth = 3.2;
  c2.stroke();

  var tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 8;
  /* ★ 把地表 canvas 暴露给探针 —— 诊断"画了却看不见"这类问题，
     唯一的可靠办法是**把贴图本体导出来看**，而不是对着 3D 截图猜。 */
  window.__CAMP_GROUND_CV = cv;
  var m = new THREE.Mesh(
    new THREE.PlaneGeometry(CAMP_G.x1 - CAMP_G.x0, CAMP_G.z1 - CAMP_G.z0),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.97, metalness: 0.0 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  m.userData.noFrame = true;
  g.add(m);
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ② 晴缘湖
   ══════════════════════════════════════════════════════════════════ */
function campLake() {
  var g = new THREE.Group();
  var RX = CAMP_LAKE.rx * CAMP.k, RZ = CAMP_LAKE.rz * CAMP.k;
  var px = cx(CAMP_LAKE.px), pz = cz(CAMP_LAKE.py);

  /* 不规则轮廓：椭圆 + 低频扰动（lakeWob 单一真源）。
     ★★★ 10-06 深夜修复**主体镜像坑**：ShapeGeometry + rotation.x=-π/2
     把 shape 的 y 映成世界 -z，而 ring() 一直喂的是 +pz ——
     ⇒ 主体水面**实际渲染在镜像位**（南偏 35m），弯臂（喂 -cz）却在正确位，
     水面与弯臂脱节、步道环带北沿露白弧、inLake 排斥区与真水错位。
     probe-lake 实测：渲染中心 (-48.5,+1.9) vs 期望 (-28,+17.5)，实锤。
     ✅ 与弯臂同法：shape 点一律喂 [x, -z]。 */
  function ring(scaleXZ) {
    var pts = [];
    var n = 72;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2;
      var w = lakeWob(a);
      pts.push([px + Math.cos(a) * RX * w * scaleXZ,
                -(pz + Math.sin(a) * RZ * w * scaleXZ)]);
    }
    return pts;
  }
  function shapeOf(pts) {
    var s = new THREE.Shape();
    pts.forEach(function (p, i) { i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]); });
    s.closePath();
    return s;
  }

  /* ★★★ 10-07 换真实轮廓：整片湖（浅洲/石岸/裙边/水面）全部按
     CAMP_LAKE_POLY（Apple 地图抠取，见 tower-10 注释）绘制，
     不再用"椭圆 + 扰动 + 弯臂"那套自造形状。 */
  /* ②-1 浅水洲（向外 1.06 倍） */
  var shoal = new THREE.Mesh(new THREE.ShapeGeometry(lakeShape(1.06)),
    mat(0x6E8F86, { rough: 0.55 }));
  shoal.rotation.x = -Math.PI / 2;
  shoal.position.y = 0.05;
  shoal.receiveShadow = true;
  g.add(shoal);

  /* ②-2 石砌水岸 —— 必须是**环**：外圈 1.055、内圈 1.00 挖空 */
  var bankShape = lakeShape(1.055);
  bankShape.holes.push(lakeHolePath(1.00));
  var bank = new THREE.Mesh(new THREE.ShapeGeometry(bankShape),
    mat(0xA29E94, { rough: 0.92 }));
  bank.rotation.x = -Math.PI / 2;
  bank.position.y = 0.22;
  bank.receiveShadow = true;
  g.add(bank);

  /* ②-2b 岸线裙边（消除"湖浮在草地上"）：世界坐标 BufferGeometry ⇒ 不镜像 */
  (function () {
    var poly = lakePolyPts(1.0), posA = [], idx = [];
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i];
      var gx = cx(p[0]), gz = cz(p[1]);
      /* 由质心向外推：1.055 倍 = 岸沿，1.105 倍 = 贴地外沿 */
      var q1 = lakePolyPts(1.055)[i], q2 = lakePolyPts(1.105)[i];
      posA.push(cx(q1[0]), 0.22, cz(q1[1]));
      posA.push(cx(q2[0]), 0.02, cz(q2[1]));
      void gx; void gz;
    }
    for (var t = 0; t < poly.length; t++) {
      var a0 = t * 2, a1 = a0 + 1, a2 = ((t + 1) % poly.length) * 2, a3 = a2 + 1;
      idx.push(a0, a1, a2, a1, a3, a2);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var skirt = new THREE.Mesh(geo, mat(0x968F82, { rough: 0.95, side: THREE.DoubleSide }));
    skirt.receiveShadow = true;
    g.add(skirt);
  })();

  /* ②-3 水面（真实轮廓本体）*/
  var water = new THREE.Mesh(new THREE.ShapeGeometry(lakeShape(1.00)),
    new THREE.MeshStandardMaterial({
      color: 0x2B7CA8, roughness: 0.08, metalness: 0.50,   /* 10-07 转蓝 */
      transparent: true, opacity: 0.92
    }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.10;
  water.receiveShadow = false;
  g.add(water);

  /* ②-4 湖心涟漪：按多边形质心与包络尺寸铺两圈（保持"平静水面"的读感）*/
  var ctr = (function () {
    var sx = 0, sy = 0;
    CAMP_LAKE_POLY.forEach(function (p) { sx += p[0]; sy += p[1]; });
    return [sx / CAMP_LAKE_POLY.length, sy / CAMP_LAKE_POLY.length];
  })();
  var RXw = 0, RZw = 0;
  CAMP_LAKE_POLY.forEach(function (p) {
    RXw = Math.max(RXw, Math.abs(p[0] - ctr[0]) * CAMP.k);
    RZw = Math.max(RZw, Math.abs(p[1] - ctr[1]) * CAMP.k);
  });
  for (var r = 0; r < 2; r++) {
    var rr = (0.34 + r * 0.24);
    var rip = new THREE.Mesh(new THREE.RingGeometry(
      RXw * rr - 0.5, RXw * rr + 0.5, 64),
      new THREE.MeshBasicMaterial({
        color: 0xCFE6EE, transparent: true, opacity: 0.10 - r * 0.04,
        side: THREE.DoubleSide, depthWrite: false
      }));
    rip.rotation.x = -Math.PI / 2;
    rip.position.set(cx(ctr[0]), 0.13, cz(ctr[1]));
    rip.scale.set(1, RZw / RXw * (1 + r * 0.04), 1);
    g.add(rip);
  }

  /* ════════════════════════════════════════════════════════════════
     ②-5 西北弯臂 —— **10-07 停用**（官方图色彩网格实测：北侧那块淡紫是
     球类运动场、不是水域；"钩形臂"是看走眼的产物）。
     spine 只剩单点即跳过整段；结构保留，随时可恢复。 */
  if (CAMP_LAKE_ARM.spine.length < 2) return g;
  /* 弯臂三层与主体一致（浅洲 / 石岸 / 水面），y 各抬 0.01m 错开重叠区防 z-fight。
     ⚠️ 石岸只画外半段（从归一化距离 >1.06 的臂身开始）——
     若从臂根画起，石岸的直切头会作为一条石线**立在主体水面里**。 */
  function capsule(spineW, halfW) {
    var L = [], R = [], i, p, a, b;
    for (i = 0; i < spineW.length; i++) {
      p = spineW[i];
      a = spineW[Math.max(0, i - 1)]; b = spineW[Math.min(spineW.length - 1, i + 1)];
      var dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
      L.push([p[0] - dz / len * halfW, p[1] + dx / len * halfW]);
      R.push([p[0] + dz / len * halfW, p[1] - dx / len * halfW]);
    }
    var tip = spineW[spineW.length - 1], t0 = spineW[spineW.length - 2];
    var ta = Math.atan2(tip[1] - t0[1], tip[0] - t0[0]);
    for (var k = 1; k < 8; k++) {
      var aa = ta + Math.PI / 2 - (k / 8) * Math.PI;
      L.push([tip[0] + Math.cos(aa) * halfW, tip[1] + Math.sin(aa) * halfW]);
    }
    return L.concat(R.reverse());
  }
  /* ⚠️★ 坐标镜像坑：ShapeGeometry + rotation.x=-π/2 把 shape 的 y 映成世界 -z
     （(x,y,0)→(x,0,-y)）。主体湖是椭圆、镜像不可见；但**弯臂有方向**，
     直接喂 cz 会渲成西南向（g1-plan 实锤）。⇒ shape 点一律喂 [cx, -cz]。 */
  var spineW = CAMP_LAKE_ARM.spine.map(function (p) { return [cx(p[0]), -cz(p[1])]; });
  var hw = CAMP_LAKE_ARM.w / 2 * CAMP.k;
  /* 浅洲（整条臂）*/
  var aShoal = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(capsule(spineW, hw * 1.45))),
    mat(0x6E8F86, { rough: 0.55 }));
  aShoal.rotation.x = -Math.PI / 2; aShoal.position.y = 0.06; aShoal.receiveShadow = true;
  g.add(aShoal);
  /* 石岸（只画外半段：spine[2] 起到臂尖）*/
  var spineBank = spineW.slice(2);
  var bankShapeA = shapeOf(capsule(spineBank, hw * 1.42));
  bankShapeA.holes.push(new THREE.Path(capsule(spineBank, hw * 1.02).map(function (p) {
    return new THREE.Vector2(p[0], p[1]);
  })));
  var bankA = new THREE.Mesh(new THREE.ShapeGeometry(bankShapeA),
    mat(0xA29E94, { rough: 0.92 }));
  bankA.rotation.x = -Math.PI / 2; bankA.position.y = 0.23; bankA.receiveShadow = true;
  g.add(bankA);
  /* 弯臂裙边：同主体，从臂岸外沿斜升到贴地，消除悬空边。
     ★★★ 10-06 深夜修复：裙边是**世界坐标 BufferGeometry**（不经旋转），
     而 spineW 是为 shape 准备的 [cx,-cz] ⇒ 裙边渲染在镜像位、与臂水脱节。
     ✅ 裙边专用真实坐标 spineR = [cx, +cz]。 */
  (function () {
    var spineR = CAMP_LAKE_ARM.spine.map(function (p) { return [cx(p[0]), cz(p[1])]; }).slice(2);
    var up = capsule(spineR, hw * 1.42), lo = capsule(spineR, hw * 1.62);
    var posB = [], idxB = [], m = up.length;
    for (var i = 0; i < m; i++) {
      posB.push(up[i][0], 0.23, up[i][1]);
      posB.push(lo[i][0], 0.02, lo[i][1]);
    }
    for (var t = 0; t < m; t++) {
      var b0 = t * 2, b1 = b0 + 1, b2 = ((t + 1) % m) * 2, b3 = b2 + 1;
      idxB.push(b0, b1, b2, b1, b3, b2);
    }
    var gB = new THREE.BufferGeometry();
    gB.setAttribute('position', new THREE.Float32BufferAttribute(posB, 3));
    gB.setIndex(idxB);
    gB.computeVertexNormals();
    var skA = new THREE.Mesh(gB, mat(0x968F82, { rough: 0.95, side: THREE.DoubleSide }));
    skA.receiveShadow = true;
    g.add(skA);
  })();
  /* 水面（整条臂，与主体同材质）*/
  var aWater = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(capsule(spineW, hw * 1.02))),
    new THREE.MeshStandardMaterial({
      color: 0x2B7CA8, roughness: 0.08, metalness: 0.50,   /* 10-07 转蓝 */
      transparent: true, opacity: 0.92
    }));
  aWater.rotation.x = -Math.PI / 2; aWater.position.y = 0.11;
  g.add(aWater);
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ③ 田径场台地（★ 补上"台地无立体侧面"这条历史遗留）
   ══════════════════════════════════════════════════════════════════ */
function campTrack() {
  var g = new THREE.Group();
  var px = cx(CAMP_TRACK.px), pz = cz(CAMP_TRACK.py);
  var BL = CAMP_TRACK.L * CAMP.k;         /* 东西向总宽 */
  var BD = CAMP_TRACK.W * CAMP.k;         /* 南北向总长（长轴）*/
  var H = 1.6;                            /* 台地抬高 */
  var trackW = 9.0;                       /* 8 道跑道宽（世界米）*/

  /* 台地体块（灰）：侧面深、顶面浅 —— 不旋转，直接按 BL×BD 摆 */
  var mSide = mat(0x8A8578, { rough: 0.94 });
  var mTop = mat(0x9E998C, { rough: 0.94 });
  var block = box(BL + 4, H, BD + 4, mSide, 0, H / 2, 0);
  block.material = [mSide, mSide, mTop, mSide, mSide, mSide];
  block.position.set(px, H / 2, pz);
  block.receiveShadow = true; block.castShadow = true;
  g.add(block);

  /* ★★★ 跑道改用**几何体**（ShapeGeometry + hole），彻底绕开 canvas 贴图
     （swiftshader 下 CanvasTexture 上屏失败的老坑）。
     ★★★ 10-07：stadiumShape 要求**长轴沿局部 X**（hw ≥ rad），
     而官方图跑道长轴是**南北向** ⇒ 在**局部子组**里照常造（长轴=南北总长 BD），
     再把子组绕 Y 转 90°，长轴即落到世界 Z 轴。
     ⚠️ 不能旋转整个 g：g 里的构件用的是**世界坐标**，绕世界原点转会整体跑位。 */
  function stadiumShape(hw, rad, holeOf) {
    var sh = new THREE.Shape();
    var r = hw - rad;
    sh.moveTo(-r, -rad);
    sh.lineTo(r, -rad);
    sh.absarc(r, 0, rad, -Math.PI / 2, Math.PI / 2, false);      /* 右半圆 */
    sh.lineTo(-r, rad);
    sh.absarc(-r, 0, rad, Math.PI / 2, Math.PI * 1.5, false);    /* 左半圆 */
    sh.closePath();
    if (holeOf) sh.holes.push(holeOf);
    return sh;
  }
  var st = new THREE.Group();
  st.position.set(px, 0, pz);
  st.rotation.y = Math.PI / 2;
  g.add(st);

  var hwO = BD / 2, radO = BL / 2;        /* 局部长轴 = 南北总长 */
  var hwI = hwO - trackW, radI = radO - trackW;
  var holeI = new THREE.Path();
  (function () {
    var r = hwI - radI;
    holeI.moveTo(-r, -radI); holeI.lineTo(r, -radI);
    holeI.absarc(r, 0, radI, -Math.PI / 2, Math.PI / 2, false);
    holeI.lineTo(-r, radI);
    holeI.absarc(-r, 0, radI, Math.PI / 2, Math.PI * 1.5, false);
    holeI.closePath();
  })();

  /* 内场草地（绿胶囊，无洞）*/
  var innerGeo = new THREE.ShapeGeometry(stadiumShape(hwI, radI));
  var inner = new THREE.Mesh(innerGeo, mat(0x4E7A3A, { rough: 0.96, side: THREE.DoubleSide }));
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = H + 0.08;
  inner.receiveShadow = true;
  st.add(inner);

  /* 跑道环（红：外胶囊 - 内胶囊洞）*/
  var ringGeo = new THREE.ShapeGeometry(stadiumShape(hwO, radO, holeI));
  var ring = new THREE.Mesh(ringGeo, mat(0x9E543A, { rough: 0.94, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = H + 0.12;
  ring.receiveShadow = true;
  st.add(ring);

  /* 内场足球场白线（局部坐标，随子组一起转）*/
  var mLine = mat(0xE8E4D8, { rough: 0.7 });
  var fw = hwI * 0.72, fd = radI * 0.56;
  var mkLine = function (x0, y0, x1, y1) {
    var len = Math.hypot(x1 - x0, y1 - y0) || 1;
    var ln = box(len, 0.05, 0.22, mLine, (x0 + x1) / 2, H + 0.14, (y0 + y1) / 2);
    ln.rotation.y = Math.atan2(x1 - x0, y1 - y0);
    return ln;
  };
  st.add(mkLine(-fw, -fd, fw, -fd));   /* 上边线 */
  st.add(mkLine(-fw, fd, fw, fd));     /* 下边线 */
  st.add(mkLine(-fw, -fd, -fw, fd));   /* 左边线 */
  st.add(mkLine(fw, -fd, fw, fd));     /* 右边线 */
  st.add(mkLine(0, -fd, 0, fd));       /* 中线 */

  /* 看台：**东西两侧**（南北向长轴场的两条长边）不旋转，直接按世界坐标摆 */
  var mStep = mat(0xB2AEA4, { rough: 0.92 });
  [-1, 1].forEach(function (s) {
    for (var k = 0; k < 5; k++) {
      g.add(box(2.4, H + 0.42 + k * 0.42, BD * 0.62, mStep,
                px + s * (BL / 2 + 3.0 + k * 2.4), (H + 0.42 + k * 0.42) / 2, pz));
    }
  });
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ④ 校园道路（实体带：路面 + 路缘石 + 中线）
   ══════════════════════════════════════════════════════════════════ */
function campRoads() {
  var g = new THREE.Group();
  var mRoad = mat(0x54585E, { rough: 0.96 });      /* 冷调沥青（实拍车行道色）*/
  var mCurb = mat(0xA8A49A, { rough: 0.90 });
  var mLine = mat(0xD8D4C4, { rough: 0.70 });

  CAMP_ROADS.forEach(function (rd) {
    var pts = rd.pts.map(function (p) { return new THREE.Vector3(cx(p[0]), 0, cz(p[1])); });
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var dx = b.x - a.x, dz = b.z - a.z;
      var len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.4) continue;
      var ang = Math.atan2(dz, dx);
      var mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      /* 路面 */
      var deck = box(len + rd.w * 0.5, 0.16, rd.w, mRoad, mx, 0.08, mz);
      deck.rotation.y = -ang;
      deck.receiveShadow = true;
      g.add(deck);
      /* 两侧路缘石（同时把路面"架起来"，读作真路面）*/
      [-1, 1].forEach(function (s) {
        var cb = box(len, 0.30, 0.55, mCurb,
                     mx + Math.sin(ang) * s * (rd.w / 2), 0.15,
                     mz - Math.cos(ang) * s * (rd.w / 2));
        cb.rotation.y = -ang;
        cb.receiveShadow = true; cb.castShadow = true;
        g.add(cb);
      });
      /* 中线（双黄虚线，实拍就是这样）*/
      var nseg = Math.max(1, Math.round(len / 12));
      for (var s2 = 0; s2 < nseg; s2++) {
        var t = (s2 + 0.5) / nseg;
        var lx = a.x + dx * t, lz = a.z + dz * t;
        [-0.55, 0.55].forEach(function (off) {
          var ln = box(len / nseg * 0.5, 0.02, 0.16, mLine,
                       lx + Math.sin(ang) * off, 0.17, lz - Math.cos(ang) * off);
          ln.rotation.y = -ang;
          g.add(ln);
        });
      }
    }
  });
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ⑤ campWall —— 校园院墙（10-07 新增）
   ──────────────────────────────────────────────────────────────────
   为什么要它：3D 母版（官方模型）"合理又好看"的第一条就是**院墙围合**——
   校园有明确边界、内外分明；旧版没有墙，校园直接溶进外面的绿野里，
   读起来像"荒地上一堆楼"。墙沿 CAMP_BOUND 逐段生成，柱距 7m。
   ══════════════════════════════════════════════════════════════════ */
function campWall() {
  var g = new THREE.Group();
  var mWall = mat(0xCFC7B8, { rough: 0.90 });
  var mBase = mat(0x9A9284, { rough: 0.94 });
  var mCap  = mat(0xB4AC9C, { rough: 0.66 });
  var H = 2.0;                                  /* 墙高 2m */
  var seg = [];
  for (var i = 0; i < CAMP_BOUND.length; i++) {
    var a = CAMP_BOUND[i], b = CAMP_BOUND[(i + 1) % CAMP_BOUND.length];
    seg.push([cx(a[0]), cz(a[1]), cx(b[0]), cz(b[1])]);
  }
  function put(x, y, z, w, h, d, m, ry) {
    var o = box(w, h, d, m, 0, 0, 0);
    o.position.set(x, y, z);
    if (ry) o.rotation.y = ry;
    o.castShadow = true; o.receiveShadow = true;
    g.add(o);
    return o;
  }
  seg.forEach(function (sg) {
    var x0 = sg[0], z0 = sg[1], x1 = sg[2], z1 = sg[3];
    var dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    if (L < 1) return;
    var ang = Math.atan2(dz, dx);
    var mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    /* 基座 + 墙身 + 压顶 */
    put(mx, 0.22, mz, L, 0.44, 0.86, mBase, -ang);
    put(mx, 1.22, mz, L, H, 0.52, mWall, -ang);
    put(mx, H + 0.32, mz, L + 0.12, 0.20, 0.68, mCap, -ang);
    /* 柱：每 7m 一根，略高略粗（校园围墙的读感）
       ★ 门口留空：南门(px102,py170) 与 东门(py100 一线) 附近不立柱不砌墙 */
    var n = Math.max(1, Math.round(L / 7));
    for (var k = 0; k <= n; k++) {
      var t = k / n;
      var px_ = x0 + dx * t, pz_ = z0 + dz * t;
      /* 换算回切片坐标判门口 */
      var spx = px_ / CAMP.k + CAMP.ox, spy = pz_ / CAMP.k + CAMP.oz;
      var nearGate = (Math.abs(spx - 102) < 9 && spy > 160) ||          /* 南门 */
                     (Math.abs(spy - 100) < 7 && spx > 172);           /* 东门 */
      if (nearGate) continue;
      put(px_, 1.35, pz_, 0.72, H + 0.70, 0.72, mCap, -ang);
    }
  });
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ⑥ campCity —— 校园**之外**的城市层（用户要的「周围背景的精细度」）

   为什么不和校园共用一层贴图：
     校园层要 0.30 m/px 才看得清铺装分格；而城市要覆盖 ±1800m。
     一张贴图同时满足两者需要 ~12000×12000 像素（不可行）。
     ⇒ 分两层：校园层 ±620m / 4096（高精度），城市层 ±1800m / 2048（低精度）。
     城市层**下沉 0.35m**，被校园层压住的部分看不见（也不需要做遮挡计算）。
   ══════════════════════════════════════════════════════════════════ */
function campCity() {
  var g = new THREE.Group();
  var SPAN = 3600, N = 2048;
  var cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  var c2 = cv.getContext('2d');
  var scl = N / SPAN;
  var U = function (x) { return (x + SPAN / 2) * scl; };
  var V = function (z) { return (z + SPAN / 2) * scl; };

  /* 底：郊野 */
  c2.fillStyle = '#46552F';   /* 10-07：郊野略提亮，校园才跳出来 */
  c2.fillRect(0, 0, N, N);
  for (var i = 0; i < 1500; i++) {
    var u = rnd(i, 211) * N, v = rnd(i, 213) * N, s = 14 + rnd(i, 217) * 52;
    c2.fillStyle = rnd(i, 219) > .5 ? 'rgba(66,82,44,.20)' : 'rgba(48,62,32,.20)';
    c2.beginPath(); c2.ellipse(u, v, s, s * .6, rnd(i, 221) * 3, 0, 6.3); c2.fill();
  }

  /* 路网：主干道格网（约 220m 一档，符合城市支路间距）*/
  function rd(x, z, vert, wm) {
    c2.save();
    c2.translate(U(x), V(z));
    if (vert) c2.rotate(Math.PI / 2);
    c2.fillStyle = 'rgba(120,126,118,.34)';   /* 10-07：0.92→0.34，路网别抢戏 */
    c2.fillRect(-SPAN * scl / 2, -wm * scl / 2, SPAN * scl, wm * scl);
    c2.restore();
  }
  var xs = [], zs = [];
  for (var x2 = -1600; x2 <= 1600; x2 += 220) xs.push(x2);
  for (var z2 = -1600; z2 <= 1600; z2 += 220) zs.push(z2);
  xs.forEach(function (x) { rd(x, 0, true, 11); });
  zs.forEach(function (z) { rd(0, z, false, 11); });

  /* 街区建筑：只在网格之间撒，且离校园足够远 */
  var seed = 4000;
  for (var bi = 0; bi < xs.length - 1; bi++) {
    for (var bj = 0; bj < zs.length - 1; bj++) {
      var bxc = (xs[bi] + xs[bi + 1]) / 2;
      var bzc = (zs[bj] + zs[bj + 1]) / 2;
      if (Math.abs(bxc) < 330 && Math.abs(bzc) < 330) continue;   /* 校园位置留空 */
      seed += 7;
      if (rnd(seed, 7) < 0.28) continue;                           /* 留空地/公园 */
      var n = 1 + Math.floor(rnd(seed, 11) * 3);
      for (var k = 0; k < n; k++) {
        seed++;
        var ox = (rnd(seed, 13) - .5) * 130;
        var oz = (rnd(seed, 17) - .5) * 130;
        var w2 = (28 + rnd(seed, 19) * 62) * scl;
        var d2 = (22 + rnd(seed, 23) * 54) * scl;
        var uu = U(bxc + ox), vv = V(bzc + oz);
        /* ★ 压暗一档：城市是**背景**，太亮会跟校园抢注意力；
           而且 2D 贴图天生没有立体感，越亮越像一块贴纸。 */
        var lift = 0.16 + rnd(seed, 29) * 0.10;   /* 10-07：0.40→0.16，外围建筑压低对比 */
        c2.fillStyle = 'rgba(150,148,142,' + lift.toFixed(2) + ')';
        c2.fillRect(uu - w2 / 2, vv - d2 / 2, w2, d2);
        c2.fillStyle = 'rgba(186,184,178,' + (lift * 0.75).toFixed(2) + ')';
        c2.fillRect(uu - w2 / 2, vv - d2 / 2, w2, d2 * 0.24);
      }
    }
  }

  /* 河流（斜穿，远景的线状要素）*/
  c2.strokeStyle = '#39647C';
  c2.lineWidth = 30 * scl;
  c2.lineCap = 'round';
  c2.beginPath();
  c2.moveTo(U(-1800), V(620));
  c2.bezierCurveTo(U(-900), V(520), U(-300), V(700), U(300), V(620));
  c2.bezierCurveTo(U(900), V(540), U(1400), V(700), U(1800), V(640));
  c2.stroke();

  var tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  var m = new THREE.Mesh(
    new THREE.PlaneGeometry(SPAN, SPAN),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.98, metalness: 0 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.35;                 /* 下沉，被校园层压住时不可见 */
  m.receiveShadow = true;
  m.userData.noFrame = true;
  g.add(m);
  return g;
}
