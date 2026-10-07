/* -*- coding: utf-8 -*- */
/* ══════════════════════════════════════════════════════════════════
   tower-09-apt-cluster.js —— 学生公寓组团（连体板楼 + 内院 + 连廊）
   ══════════════════════════════════════════════════════════════════
   ★★★ 为什么新增这个文件（2026-10-02 用户纠正）

     此前 11 栋公寓都是**各自独立的矩形板楼**（直接调 makeApartment）。
     用户对照平面图指出：
       「有的是连在一起的，它学生公寓**它不长这样**」

     回到原始素材核对（不靠推想）：

       ① `official-360/BUILDING-SPEC.md`「C. 学生公寓」
          · 平面：「**长条形板楼**，多栋**正交咬合**成 L / U 型」
          · 连廊：「楼栋之间有**横向连廊／过街楼**连接」
       ② `official-360/outdoor/27836784_d.jpg`、`27836783_d.jpg`、
          `27836786_d.jpg`（1536² 官方航拍，本次才读到的 3 张）
          · 三栋长条板楼**正交咬合**成凹字形（U），中间围出内院
          · 内院 = 大面积浅灰铺装 + 不规则绿岛 + 树池，**不是草坪**
          · 侧翼**阳台朝内院**；转角处屋面**相交**
       ③ `.workbuddy-gen/cmp/plane1.png`（官方总平面规划公示图）
          · 左侧公寓群轮廓呈 **L 形 / 凹字形**

     ⇒ 出图单元从「11 栋独立板楼」改为「若干院落」。
       （SITES 里 11 个"独立格位"只是**示意占位**，不是真实轮廓。
         这与 09-25 那条铁律同源：**别把示意方块当建筑轮廓**。）

   ★ 尺寸依据（全部有出处，不凭感觉）
     · 开间 `APT_BAY` = 3.6m（宿舍常规 3.6~4.2）
       ⇒ 翼长 = 9 开间 = **32.4m**
     · 翼进深 **13.0m**（房间 6.0 + 内走廊 2.4 + 阳台 1.4 + 结构余量）
     · 层高 3.25m × 6 层 = **19.5m**（沿用已验收的 APT_* 常量）
     · 内院净宽 **16.0m**（SITES 同行两栋净距约 13m，取 16 更接近实拍观感）
     · 坡度 **24°**（规范「双坡为主，坡度 20~25°」）
     · 出檐 **1.20m**（规范「大出檐」，实拍有明显檐下阴影带）
   ══════════════════════════════════════════════════════════════════ */

/* ── 树（内院用：树干 + 双球树冠）─────────────────────────────────
   ★ 为什么不直接复用 propPlanter：那个是"花箱"，体量太小（<2m），
     在内院尺度（16×19m）下读不出来。树是内院的**竖向要素**，
     没有它内院会读成"一块平地板"。 */
/* ══════════════════════════════════════════════════════════════════
   树皮 / 叶簇 贴图（10-06 新增）
   ──────────────────────────────────────────────────────────────────
   为什么必须加：单靠几何，1820 面的树在近景仍然是"一根柱 + 几个光球"——
   几何面数解决的是**轮廓**，解决不了**表面**。
   ① 树皮：竖向裂纹 + 环向深浅，贴到干与枝上（干是 10 棱柱，UV 沿柱面）
   ② 叶簇：高频明暗噪点，贴到树冠球面上 ⇒ 球面读作"叶簇"而不是"几何球"
   ⚠️ 贴图一律"**纯白基底 + 系数 ≤1.0** 的调制层"（技能铁律）：
   带贴图的材质 color 必须保持白/接近白，否则 map × color 双重相乘会把
   饱和色洗成灰。 */
var _barkTex = null, _leafTex = null;

function barkTex() {
  if (_barkTex) return _barkTex;
  var N = 128, cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  var c = cv.getContext('2d');
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, N, N);   /* 纯白基底 */
  /* 竖向裂纹：深色竖条 + 轻微抖动，模拟树皮的纵向开裂 */
  for (var i = 0; i < 46; i++) {
    var x = rnd(i, 311) * N;
    var w = 1 + rnd(i, 313) * 3.4;
    var g = 118 + rnd(i, 317) * 52;                /* 灰度 118~170 ⇒ 系数 0.46~0.67 */
    c.fillStyle = 'rgba(' + (g | 0) + ',' + (g | 0) + ',' + (g | 0) + ',' + (0.55 + rnd(i, 319) * 0.4).toFixed(2) + ')';
    var y0 = rnd(i, 323) * N * 0.5, hh = N * (0.4 + rnd(i, 329) * 0.6);
    c.fillRect(x, y0, w, hh);
  }
  /* 横向环纹（树皮的横向节疤），压得很淡 */
  for (var j = 0; j < 16; j++) {
    var y2 = rnd(j, 331) * N;
    c.fillStyle = 'rgba(150,150,150,.20)';
    c.fillRect(0, y2, N, 1 + rnd(j, 337) * 2);
  }
  var t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding;
  _barkTex = t;
  return t;
}

function leafTex() {
  if (_leafTex) return _leafTex;
  var N = 256, cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  var c = cv.getContext('2d');
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, N, N);
  /* 叶簇：成百上千个小椭圆叶片，明暗两档，密到能读出"颗粒" */
  /* ⚠️ 动态范围要克制：初版亮部用纯白 255、占比近半 ⇒ 渲出"一坨发白泡沫"。
     贴图只负责 ±12% 的明暗调制，**绝不能自己决定明暗**。 */
  for (var i = 0; i < 2600; i++) {
    var x = rnd(i, 411) * N, y = rnd(i, 413) * N;
    var r = 2.2 + rnd(i, 417) * 4.6;
    var dark = rnd(i, 419) > .5;
    c.fillStyle = dark
      ? 'rgba(150,150,150,' + (0.30 + rnd(i, 421) * 0.30).toFixed(2) + ')'
      : 'rgba(232,232,232,' + (0.26 + rnd(i, 423) * 0.26).toFixed(2) + ')';
    c.beginPath();
    c.ellipse(x, y, r, r * (0.42 + rnd(i, 427) * 0.4), rnd(i, 429) * 3.14, 0, 6.3);
    c.fill();
  }
  var t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding;
  _leafTex = t;
  return t;
}

/* ══════════════════════════════════════════════════════════════════
   propTree(h, mTrunk, mLeaf, seed) —— 校园行道树/景观树
   ──────────────────────────────────────────────────────────────────
   ★ 10-06 重写：初版是"1 根 8 棱柱 + 2 个球"，实测**只有 390 三角面**，
   远看是两坨绿球，凑近全是死几何。改为**真树结构**：
     ① 树干 3 段带锥度（下粗上细）+ 根部 3 个板根
     ② 一级分枝 3~4 根（沿 y 轴张开，各带一个小球冠）
     ③ 主冠 4~5 个交叠球（不是 1 个），构成不规则轮廓
   三角面预算：干 ~220 + 枝 ~130 + 冠 5×288 ≈ **1990 面/棵**，
   远超"100 面"的要求，且轮廓不再是几何球。
   ⚠️ 复用场景（公寓院落里的树）也走这条路径，故保持同名同签名。 */
function propTree(h, mTrunk, mLeaf, seed, baseLeaf) {
  seed = seed || 11;
  baseLeaf = baseLeaf || 0x4E6E2E;          /* 树冠基色（默认中绿；可由调用方分档）*/
  var g = new THREE.Group();
  var R = function (i) { return rnd(seed + i, 7.3 + i * 1.7); };
  var th = h * 0.38;                                  /* 枝下高 */

  /* ★ 10-06 贴图接入：干/枝用树皮、冠球用叶簇。
     材质 color 保持原色（树皮贴图是灰度调制层，冠球贴图是白基底），
     贴图 repeat 按构件尺寸给，使纹理密度与构件真实尺度挂钩。 */
  var bark = barkTex();
  var mBark = mat(0x6E5A46, { rough: 0.95, tex: bark });
  bark.repeat.set(1.6, 3.2);
  var leafT = leafTex();
  var mLeafT = mat(0xFFFFFF, { rough: 0.93, tex: leafT });
  leafT.repeat.set(3.4, 2.4);
  /* ★★ 树冠基色压深（10-06 实测修正）。
     叶簇贴图是"白基底 + 灰/白颗粒"，均值 ≈0.82；再乘材质 color 就是双重相乘：
     初版基色取 `0xB9D18A`（亮浅绿）⇒ 渲出 (200,215,180) 上下，
     实测树冠**偏白、像一坨泡沫**，深绿香樟/雪松的体量感全丢。
     正解：**基色取深绿、让贴图只负责"颗粒明暗"**。
     ⚠️ 三档树种色差必须**由基色承担**（贴图是同一个、灰度无色相）：
     若都写死一个基色，深绿/中绿/黄绿会被压成同一个绿。 */
  mLeafT.color.setHex(baseLeaf);
  var mTrunkB = mBark;
  void mTrunk;                                          /* 兼容旧调用签名 */

  /* ── ① 树干：3 段锥度 + 板根 ── */
  var segs = [[0.052, 0.040], [0.040, 0.030], [0.030, 0.022]];
  var y0 = 0, r0 = 0.052;
  for (var s = 0; s < segs.length; s++) {
    var sh = th * (s === 2 ? 0.34 : 0.33), rr = segs[s][1];
    var m = new THREE.Mesh(
      new THREE.CylinderGeometry(rr * h, r0 * h, sh, 10, 1, true), mTrunkB);
    m.position.y = y0 + sh / 2;
    m.castShadow = true;
    g.add(m);
    y0 += sh; r0 = rr;
  }
  /* 板根：3 片斜插的小楔形，让树脚不悬空 */
  for (var rt = 0; rt < 3; rt++) {
    var a = rt / 3 * Math.PI * 2 + R(1) * 0.6;
    var root = new THREE.Mesh(
      new THREE.CylinderGeometry(h * 0.010, h * 0.026, h * 0.075, 6), mTrunkB);
    root.position.set(Math.cos(a) * h * 0.035, h * 0.030, Math.sin(a) * h * 0.035);
    root.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(root);
  }

  /* ── ② 一级分枝：从枝下高顶端向四周张开，每枝托一个侧球冠 ── */
  var nb = 3 + (seed % 2);
  var rTop = y0;
  for (var b = 0; b < nb; b++) {
    var ab = b / nb * Math.PI * 2 + R(2) * 1.2;
    var tilt = 0.42 + R(3) * 0.30;                     /* 0.42~0.72 rad */
    var bl = h * (0.20 + R(4) * 0.10);
    var br = new THREE.Mesh(
      new THREE.CylinderGeometry(h * 0.008, h * 0.019, bl, 6, 1, true), mTrunkB);
    br.position.set(
      Math.cos(ab) * Math.sin(tilt) * bl * 0.5,
      rTop + Math.cos(tilt) * bl * 0.5,
      Math.sin(ab) * Math.sin(tilt) * bl * 0.5);
    br.rotation.set(0, -ab, tilt);
    br.castShadow = true;
    g.add(br);

    var sr = h * (0.11 + R(5) * 0.035);
    var sgeo2 = new THREE.SphereGeometry(sr, 11, 9);
    var p2 = sgeo2.attributes.position;      /* 同样加噪声，避免读作小球体 */
    for (var v2 = 0; v2 < p2.count; v2++) {
      var ax2 = p2.getX(v2), ay2 = p2.getY(v2), az2 = p2.getZ(v2);
      var al = Math.sqrt(ax2 * ax2 + ay2 * ay2 + az2 * az2) || 1;
      var nn = 1 + (rnd(seed * 17 + b * 71 + v2, 173) - 0.42) * 0.30;
      p2.setXYZ(v2, ax2 / al * sr * nn, ay2 / al * sr * nn, az2 / al * sr * nn);
    }
    sgeo2.computeVertexNormals();
    var sc = new THREE.Mesh(sgeo2, mLeafT);
    sc.position.set(
      Math.cos(ab) * Math.sin(tilt) * bl,
      rTop + Math.cos(tilt) * bl * 0.92,
      Math.sin(ab) * Math.sin(tilt) * bl);
    sc.scale.set(1.12, 0.88, 1.12);
    sc.rotation.y = R(6) * 3;
    sc.castShadow = true; sc.receiveShadow = true;
    g.add(sc);
  }

  /* ── ③ 主冠：4~5 个交叠球，随机偏心 + 缩放 ⇒ 不规则轮廓 ──
     ★★ 10-06：球面加**噪声位移**（每个顶点沿法线随机推拉 8~18%），
     否则 12×10 的球面在近景是**光滑的"几何球"**，一眼假。
     噪声按顶点序号取随机（同一个 seed ⇒ 同一棵树形状稳定）。 */
  var nc = 4 + (seed % 2);
  var cr = h * 0.19;
  for (var c = 0; c < nc; c++) {
    var ac = c / nc * Math.PI * 2 + R(7) * 0.9;
    var rr2 = cr * (0.68 + R(8 + c) * 0.46);
    var sgeo = new THREE.SphereGeometry(rr2, 14, 11);
    /* 顶点噪声：沿法线推拉，让球面长出"叶团"的凹凸 */
    var pos = sgeo.attributes.position;
    for (var v = 0; v < pos.count; v++) {
      var vx = pos.getX(v), vy = pos.getY(v), vz = pos.getZ(v);
      var vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      var n = 1 + (rnd(seed * 31 + c * 131 + v, 167) - 0.42) * 0.30;
      pos.setXYZ(v, vx / vl * rr2 * n, vy / vl * rr2 * n, vz / vl * rr2 * n);
    }
    sgeo.computeVertexNormals();
    var cm = new THREE.Mesh(sgeo, mLeafT);
    var dist = c === 0 ? 0 : cr * (0.52 + R(20 + c) * 0.34);
    cm.position.set(
      Math.cos(ac) * dist,
      rTop + h * 0.10 + (c === 0 ? cr * 0.32 : (R(30 + c) - 0.4) * cr * 0.62),
      Math.sin(ac) * dist);
    cm.scale.set(1.06 + R(40 + c) * 0.16, 0.80 + R(50 + c) * 0.20, 1.06 + R(60 + c) * 0.16);
    cm.rotation.set(R(70 + c), R(80 + c) * 3, R(90 + c));
    cm.castShadow = true; cm.receiveShadow = true;
    g.add(cm);
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   makeAptCluster(o) —— 一个学生公寓院落

   o.shape : 'II' 两栋平行（+ 二层连廊跨院）
             'U'  三栋围合（两翼 + 南封口段，+ 连廊）

   坐标约定（与世界轴一致）：
     · 两翼沿 **Z** 向延伸，分别在 X 轴两侧 ⇒ 内院在中间
     · 内院开口朝 **+Z**；U 形的封口段在 **-Z** 端
   ══════════════════════════════════════════════════════════════════ */
function makeAptCluster(o) {
  o = o || {};
  var shape = o.shape || 'II';
  var DEP   = o.wingDep === undefined ? 13.0 : o.wingDep;
  var LEN   = o.wingLen === undefined ? 32.4 : o.wingLen;
  var CW    = o.courtW  === undefined ? 16.0 : o.courtW;
  var nf    = o.floors  || 6;
  var ANG   = Math.PI * (o.roofDeg === undefined ? 24 : o.roofDeg) / 180;
  var EAVE  = o.roofEave === undefined ? 1.20 : o.roofEave;
  var pal   = o.pal || null;
  var seed  = o.seed || 7;

  var g = new THREE.Group();
  var SB = Math.max(2, Math.round(DEP / APT_BAY));    /* 短边开间数 */

  /* 一段板楼：W 沿 X、D 沿 Z。色板通过 batWithAptPal 临时替换 AC。 */
  var seg = function (W_, D_, opt) {
    var run = function () { return makeApartment(W_, D_, opt); };
    return pal ? batWithAptPal(pal, run) : run();
  };
  var wingOpt = function (balc, nm, dir, sd) {
    return {
      floors: nf, bays: SB, balcony: balc, seed: sd,
      hipRoof: true, roofAng: ANG, roofEave: EAVE,
      name: nm || '', nameDir: dir
    };
  };

  /* ── ① 西翼（阳台朝内院 = +X = dir 1）────────────────────────── */
  var west = seg(DEP, LEN, wingOpt([1], o.nameW, 1, seed));
  west.position.set(-(CW / 2 + DEP / 2), 0, 0);
  g.add(west);

  /* ── ② 东翼（阳台朝内院 = -X = dir 3）────────────────────────── */
  var east = seg(DEP, LEN, wingOpt([3], o.nameE, 3, seed + 1));
  east.position.set(CW / 2 + DEP / 2, 0, 0);
  g.add(east);

  /* ── ③ U 形：南封口段 ──────────────────────────────────────────
     ★ 向南凸出 OV = 0.55m，这不是装饰：
       若三段同在 z = −LEN/2 收头，南墙就是**两个共面的竖直面**
       ⇒ 深度打架（与 §24.4「两个共面水平面」同一类错）。
       凸出 0.55m 后既避开共面，又读作"门厅体块前凸"。
     ★ 宽度 = CW + 2×1.2 ⇒ 两端各伸进翼内 1.2m
       ⇒ 封口段的**端墙**藏在翼体内部，外轮廓连续。 */
  var OV = 0.55;
  var yS = -LEN / 2 - OV;                    /* 南边界 */
  if (shape === 'U') {
    var south = seg(CW + 2.4, DEP, wingOpt([0], o.nameS, 0, seed + 2));
    south.position.set(0, 0, yS + DEP / 2);
    g.add(south);
  }

  /* ── ④ 内院（铺装 + 绿岛 + 树池 + 主轴步道）────────────────────
     参照实拍：**大面积浅灰石材铺装 + 不规则绿岛**，
     绿岛边缘是弧形草边，不是方方正正的草坪。 */
  var cz0 = yS + DEP;                        /* 内院南界（贴着南翼北墙）*/
  var cz1 = LEN / 2;                         /* 内院北界（开口处）*/
  var CD  = cz1 - cz0;                       /* 内院进深 */
  var yard = new THREE.Group();
  yard.position.set(0, 0, (cz0 + cz1) / 2);

  /* 铺装：白色基底 + 方格细缝（规则图案 ⇒ 安全，不会读成噪点）*/
  var cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  var c2 = cv.getContext('2d');
  c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, 128, 128);
  c2.strokeStyle = 'rgba(0,0,0,.11)'; c2.lineWidth = 1.5;
  for (var i = 0; i <= 4; i++) {
    var p = i * 32;
    c2.beginPath(); c2.moveTo(p, 0); c2.lineTo(p, 128); c2.stroke();
    c2.beginPath(); c2.moveTo(0, p); c2.lineTo(128, p); c2.stroke();
  }
  var ptex = new THREE.CanvasTexture(cv);
  ptex.encoding = THREE.sRGBEncoding;
  ptex.wrapS = ptex.wrapT = THREE.RepeatWrapping;
  ptex.repeat.set(CW / 5.4, CD / 5.4);
  var pav = new THREE.Mesh(new THREE.PlaneGeometry(CW, CD),
    mat(0xA19E99, { tex: ptex, rough: 0.95 }));
  pav.rotation.x = -Math.PI / 2;
  pav.position.set(0, 0.02, 0);
  pav.receiveShadow = true;
  yard.add(pav);

  /* 绿岛：3 块不规则（矩形切角 → 用两块长方体错位搭出 L 形）*/
  var mGrass = mat(0x466B2E, { rough: 0.97 });
  var mCurb  = mat(0x8E8A84, { rough: 0.93 });
  var islands = [
    { x: -CW * 0.24, z:  CD * 0.20, w: 5.2, d: 4.0 },
    { x:  CW * 0.26, z:  CD * 0.06, w: 4.4, d: 5.4 },
    { x: -CW * 0.10, z: -CD * 0.26, w: 6.0, d: 3.4 }
  ];
  islands.forEach(function (s, si) {
    /* ★ 每块绿岛放在一个子组里**整体转一点角**（±0.22 rad ≈ 12.6°）：
       正放的盒子在俯视下读作"绿色地毯块"；转一点角 + 搭上树和灌木球
       才像院子里的不规则花坛（参照实拍：绿岛边缘是弧形草边）。 */
    var ig = new THREE.Group();
    ig.position.set(s.x, 0, s.z);
    ig.rotation.y = (si % 2 ? -1 : 1) * 0.22;

    var cr = new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.36, 0.16, s.d + 0.36), mCurb);
    cr.position.y = 0.10;
    cr.receiveShadow = true;
    ig.add(cr);

    var gr = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.20, s.d), mGrass);
    gr.position.y = 0.20;
    gr.receiveShadow = true;
    ig.add(gr);

    /* 每块绿岛上加一丛灌木球 + 一株树（内院的竖向要素）*/
    var mLeaf = mat(0x3E5E28, { rough: 0.95 });
    var bu = new THREE.Mesh(new THREE.SphereGeometry(0.86, 10, 8), mLeaf);
    bu.position.set(-s.w * 0.22, 0.86, s.d * 0.18);
    bu.scale.set(1, 0.78, 1);
    bu.castShadow = true; bu.receiveShadow = true;
    ig.add(bu);

    var tr = propTree(6.4, mat(0x4A3A2C, { rough: 0.95 }), mLeaf);
    tr.position.set(s.w * 0.26, 0.24, -s.d * 0.20);
    ig.add(tr);

    yard.add(ig);
  });

  /* 主轴步道（从开口直通南翼入口 —— 让内院"有方向"）*/
  var axis = new THREE.Mesh(new THREE.PlaneGeometry(3.4, CD),
    mat(0xB2AFA9, { rough: 0.93 }));
  axis.rotation.x = -Math.PI / 2;
  axis.position.set(0, 0.035, 0);
  axis.receiveShadow = true;
  yard.add(axis);

  /* 路灯 ×4（内院两侧，成对）*/
  var mLamp = mat(0x5A6068, { rough: 0.55, metal: 0.30 });
  var mLight = mat(0xD8D2BC, { rough: 0.30, metal: 0.10 });
  [-1, 1].forEach(function (sx) {
    [-0.34, 0.34].forEach(function (sz) {
      var px = sx * (CW / 2 - 1.5), pz = sz * CD;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 4.6, 8), mLamp);
      pole.position.set(px, 2.3, pz);
      pole.castShadow = true;
      yard.add(pole);
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.28, 0.72), mLight);
      head.position.set(px, 4.72, pz);
      head.castShadow = true;
      yard.add(head);
    });
  });
  g.add(yard);

  /* ── ⑤ 二层连廊（白色钢桁架，跨内院）──────────────────────────
     规范：「白色/浅灰钢桁架连廊，二层连接楼栋」。
     位置取**开口端**（z 接近 +LEN/2）——这样从南向看两翼完整，
     从北向看有一条连廊把院落"收口"。 */
  var BY = APT_FLOOR + 1.55;                  /* 底面正好落在二层楼面 */
  var BR = withPalette(
    /* ★ 顶板材质按规范反推：规范给的是"实拍色 #E8EAEC（白连廊）"，
       而顶板是**朝上的面**（实拍传递关系 ≈ 渲染 = 材质 + 90）
       ⇒ 材质 = 232 − 90 ≈ 142 = 0x8E8E8E。初版给 0x9AA0A6 ⇒ 渲成 244，
         那块顶板成了画面第二亮的东西，比建筑还抢眼。 */
    { gallery: 0x8E9298, galleryE: 0xC0C4CA, galleryD: 0x8A8E94 },
    function () { return skyBridge(CW + 0.8, { w: 2.0, h: 2.7 }); });
  /* ★ 位置取**内院深处**，不放开口端。
     起因（实测截图）：初版放在 z = +LEN/2−2（开口端）⇒ 在 64° 俯角下
       它横在画面最前方，把内院挡掉一半。
     移到深处后，从开口方向看它是院子的"底" ⇒ 围合感更强，也不挡视线。 */
  BR.position.set(0, BY, -LEN / 2 + (shape === 'U' ? DEP : 0) + 2.4);
  g.add(BR);

  return g;
}
