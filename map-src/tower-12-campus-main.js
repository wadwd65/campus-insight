/* -*- coding: utf-8 -*- */
/* ══════════════════════════════════════════════════════════════════
   tower-12-campus-main.js —— 完整地图的「装配层」
   绿化 / 建筑摆放 / 天空 / 光照 / 相机

   ★ 建筑全部复用已验收的生成器（tower-01~09），**不为地图另做一套** ——
     地图的观感由"排布 + 环境 + 光照"负责，建筑本身保持既有品质。
   ══════════════════════════════════════════════════════════════════ */

var CAMP_STAGE = new THREE.Group();

/* ── 按 id 找建筑定义 ─────────────────────────────────────────── */
function campDef(id) {
  for (var i = 0; i < BAT_DEFS.length; i++) {
    if (BAT_DEFS[i].id === id) return BAT_DEFS[i];
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════════
   ① 绿化
   ══════════════════════════════════════════════════════════════════ */
function campGreen() {
  var g = new THREE.Group();
  var mTrunk = mat(0x4A3A2C, { rough: 0.95 });
  /* ★ 10-06：樱花方案用户否决（"太抽象"），**换回绿色行道树**。
     三档绿色拉开树种层次：深绿香樟/雪松 → 中绿 → 偏黄绿银杏/法桐。
     ⚠️ 基色走 baseLeaf 传给 propTree；叶簇贴图是灰度调制层，
     所以色相只由这里决定。基色必须压深（贴图均值≈0.82 双重相乘，
     浅基色会洗白成"一坨泡沫"，10-06 实测教训）。 */
  var mLeafA = mat(0x3E5E28, { rough: 0.95 });   /* 深绿（香樟/雪松）*/
  var mLeafB = mat(0x4E6E2E, { rough: 0.95 });   /* 中绿 */
  var mLeafC = mat(0x5E7A34, { rough: 0.94 });   /* 偏黄绿（银杏/法桐）*/
  var mLeafs = [mLeafA, mLeafB, mLeafC];

  /* ★ 硬性排斥（f3 截图核验发现的两个缺陷）：
       ① 湖里不长树 —— 行道树贴着环湖路两侧偏移，会落进水面
       ② 红线外不长树 —— 西树带 px17~20 < 红线 px24，散到校外绿地上
       ③ 10-04 补：田径场台地内不长树 —— py78 路与旧南北主轴都从
       台地（px77~123, py42~91）穿过，路面被盖住看不见，树全种在跑道里 */
  function inLake(px, py) {
    /* ★ 10-07：改判**真实湖轮廓多边形**（CAMP_LAKE_POLY，Apple 地图抠取），
       1.15 倍外扩 = 岸外余量。旧版按包络椭圆判 ⇒ 湖东移后树会种进水里。 */
    return lakeHit(px, py, 1.15);
  }
  function inTrack(px, py) {
    return px > CAMP_TRACK.px - CAMP_TRACK.L / 2 - 2 &&
           px < CAMP_TRACK.px + CAMP_TRACK.L / 2 + 2 &&
           py > CAMP_TRACK.py - CAMP_TRACK.W / 2 - 2 &&
           py < CAMP_TRACK.py + CAMP_TRACK.W / 2 + 2;
  }
  function inBound(px, py) {
    var inside = false;
    for (var i = 0, j = CAMP_BOUND.length - 1; i < CAMP_BOUND.length; j = i++) {
      var xi = CAMP_BOUND[i][0], yi = CAMP_BOUND[i][1];
      var xj = CAMP_BOUND[j][0], yj = CAMP_BOUND[j][1];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function put(px, py, h, li, seed) {
    if (inLake(px, py) || !inBound(px, py) || inTrack(px, py)) return;
    /* ★ 10-07 回退：KayKit 真人资产被用户否决（"房子忒丑"），
       恢复程序化树（形态随机由 seed 驱动，全校不再是同一款）。 */
    var t = propTree(h, mTrunk, mLeafs[li % 3], seed * 7 + 3, mLeafs[li % 3].color.getHex());
    t.position.set(cx(px), 0, cz(py));
    t.rotation.y = rnd(seed, 41) * 6.28;
    g.add(t);
    /* ★ 10-07：**方形树池**（官方航拍里行道树都是方池，近看很"有人打理"）*/
    var pit = box(1.8, 0.07, 1.8, mat(0xA9A499, { rough: 0.92 }), cx(px), 0.035, cz(py));
    pit.receiveShadow = true;
    g.add(pit);
  }

  /* ②-1 行道树：沿每条路两侧成列（间距 9m，实拍就是这个密度）*/
  var SEED = 500;
  CAMP_ROADS.forEach(function (rd) {
    for (var i = 0; i < rd.pts.length - 1; i++) {
      var a = rd.pts[i], b = rd.pts[i + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var L = Math.sqrt(dx * dx + dz * dz) * CAMP.k;
      var n = Math.max(2, Math.round(L / 9));
      var nx = -dz / Math.sqrt(dx * dx + dz * dz);
      var nz = dx / Math.sqrt(dx * dx + dz * dz);
      for (var k = 0; k <= n; k++) {
        var t2 = k / n;
        var mx2 = a[0] + dx * t2, mz2 = a[1] + dz * t2;
        var off = rd.w / CAMP.k / 2 + 1.6;
        [-1, 1].forEach(function (s) {
          SEED++;
          var h = 7.4 + rnd(SEED, 3) * 2.6;
          put(mx2 + nx * off * s, mz2 + nz * off * s, h, SEED, SEED);
        });
      }
    }
  });

  /* ②-2 东侧林带（平面图上校园东界内侧那条很宽的绿化）
     ★ 10-04 收窄：东侧建筑（教学/新建院落）现在排到 px172+，
     林带只剩 px175.5~177 一条缝；越界的由 inBound 闸门丢 */
  for (var i2 = 0; i2 < 64; i2++) {
    var py = 32 + i2 * 2.05 + (rnd(i2, 53) - .5) * 1.6;
    var px = 177 - rnd(i2, 59) * 1.5;
    put(px, py, 8.6 + rnd(i2, 61) * 3.4, i2, i2);
  }
  /* ②-3 西侧边界树带（收窄到 px26.5~28.2：西公寓区西沿已到 px29.6）*/
  for (var i3 = 0; i3 < 40; i3++) {
    var py3 = 96 + i3 * 1.8 + (rnd(i3, 67) - .5) * 1.4;
    put(27 + rnd(i3, 71) * 1.2, py3, 8.0 + rnd(i3, 73) * 3.0, i3, i3 + 7);
  }
  /* ②-4 北侧沿红线 */
  for (var i4 = 0; i4 < 46; i4++) {
    var px4 = 46 + i4 * 2.8;
    var py4 = (px4 < 96 ? 34 + (96 - px4) * 0.32 : 30) - rnd(i4, 79) * 2.2;
    put(px4, py4, 8.2 + rnd(i4, 83) * 3.2, i4 + 1, i4);
  }
  /* ②-5 南侧草坪上的散点大树（不要成行，成行读作"苗圃"）*/
  for (var i5 = 0; i5 < 30; i5++) {
    var px5 = 50 + rnd(i5, 89) * 130;
    var py5 = 172 + rnd(i5, 97) * 14;
    put(px5, py5, 9.0 + rnd(i5, 101) * 4.0, i5 + 2, i5 + 3);
  }
  /* ②-6 湖边绿化（垂柳姿态：矮而冠大，贴着岸线）*/
  for (var i6 = 0; i6 < 26; i6++) {
    var a6 = i6 / 26 * Math.PI * 2 + 0.3;
    var w6 = 1.22 + rnd(i6, 103) * 0.10;
    var lx = CAMP_LAKE.px + Math.cos(a6) * CAMP_LAKE.rx * w6;
    var lz = CAMP_LAKE.py + Math.sin(a6) * CAMP_LAKE.rz * w6;
    put(lx, lz, 6.2 + rnd(i6, 107) * 1.8, i6, i6 + 5);
  }

  /* ②-7 灌木球：广场边 + 建筑前（成组，不要散点）*/
  var mBush = mat(0x44652A, { rough: 0.96 });
  var bushSpots = [
    [88, 88], [96, 88], [88, 120], [96, 120],
    [150, 84], [158, 84], [150, 118], [158, 118],
    [68, 136], [80, 136], [128, 128], [140, 128],
    [44, 132], [44, 152]
  ];
  bushSpots.forEach(function (p, i) {
    if (inLake(p[0], p[1])) return;   /* ★ 10-06：灌木球曾直接摆进湖里（航拍可见一排浮水绿球）*/
    for (var k = 0; k < 3; k++) {
      var b = new THREE.Mesh(new THREE.SphereGeometry(1.5 + rnd(i * 3 + k, 109) * 0.5, 10, 8), mBush);
      b.position.set(cx(p[0] + (k - 1) * 3.4), 1.4, cz(p[1] + (rnd(i + k, 113) - .5) * 3));
      b.scale.set(1, 0.72, 1);
      b.castShadow = true; b.receiveShadow = true;
      g.add(b);
    }
  });

  /* ②-8 南侧大草坪上的观赏草/花丛（细碎、低矮，只做色点）
     10-04 改位置：图书馆以南、小吃街以南的草坪（py152~160），
     避开摊位（py147~148）与停车位（px116~132, py158~165）*/
  /* ★ 10-06 花境重做：初版是"半径 0.85m、scale(1.5,0.55,1.5) 的扁球"
     ⇒ 近景读作**地上一块黄油饼**（宽 2.5m、贴地）。
     正解：一丛花 = **绿叶底（扁、哑光）+ 3~5 个小花头（小、抬高、饱和）**，
     花头直径 0.22~0.34m，与草簇同一量级 ⇒ 读作"花"而不是"饼"。 */
  var mFlower = mat(0xD8B23E, { rough: 0.88 });
  var mLeafBase = mat(0x4A6B2A, { rough: 0.95 });
  for (var i8 = 0; i8 < 90; i8++) {
    var fx = 40 + rnd(i8, 127) * 44, fz = 152.5 + rnd(i8, 131) * 6.5;
    if (!inBound(fx, fz) || inLake(fx, fz)) continue;
    /* 绿叶底：贴着地的一小丛 */
    var base = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 5), mLeafBase);
    base.position.set(cx(fx), 0.16, cz(fz));
    base.scale.set(1.5, 0.5, 1.5);
    g.add(base);
    /* 花头：3~5 颗，抬高 0.22~0.42m */
    var nh = 3 + Math.floor(rnd(i8, 133) * 3);
    for (var q = 0; q < nh; q++) {
      var hd = new THREE.Mesh(new THREE.SphereGeometry(0.11 + rnd(i8 * 7 + q, 137) * 0.06, 6, 5), mFlower);
      var ang = rnd(i8 * 11 + q, 139) * 6.283, rr4 = rnd(i8 * 13 + q, 149) * 0.32;
      hd.position.set(cx(fx) + Math.cos(ang) * rr4, 0.22 + rnd(i8 * 17 + q, 151) * 0.20, cz(fz) + Math.sin(ang) * rr4);
      g.add(hd);
    }
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ② 建筑摆放
   ══════════════════════════════════════════════════════════════════ */
function campBuildings() {
  var g = new THREE.Group();
  var ok = 0, miss = [];
  CAMP_PLACE.forEach(function (pl) {
    var d = campDef(pl.id);
    if (!d) { miss.push(pl.id); return; }
    if (!d.build) { miss.push(pl.id + '(no build)'); return; }
    var b;
    /* ★ 10-07 回退：恢复程序化建筑（KayKit 版被否决）。
       ★★ 同夜补密度：按 3D 母版，楼要"占满院子"（旧版楼小、草坪大、像荒地）
       ⇒ 占地横向放大 1.28 倍（高度不动，窗带略被拉长，可接受）。 */
    try { b = d.build(); } catch (e) { miss.push(pl.id + '(err)'); return; }
    b.scale.set(1.28, 1, 1.28);
    b.position.set(cx(pl.px), 0, cz(pl.py));
    /* ★ 10-07：给每栋打上**身份**（游戏层按 id 出行动选项） */
    b.userData.placeId = pl.id;
    var _d = campDef(pl.id) || {};
    b.userData.placeLine = _d.note || '';
    b.rotation.y = pl.rot || 0;
    g.add(b);
    ok++;
  });
  CAMP_BUILT = ok;
  CAMP_MISS = miss;
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ①-b 公寓连廊（10-06 新增）：把院落**串成连在一起的建筑群**
   ──────────────────────────────────────────────────────────────────
   用户指出「公寓应该是连在一起的」。单个院落（II/U 形）本身内部有连廊，
   但**院落与院落之间**是断开的 ⇒ 远看是 4 栋独立板楼。
   平面图上西侧公寓区是**一个整体**：院落间有 2~3 层高的连接体。
   这里按实测占位（每院落 ~10×14px、间距 ~26px）自动生成连接廊。 */
function campAptLinks() {
  var g = new THREE.Group();
  /* ⚠️⚠️ 10-06 二次修正：**绝不能硬编码 SPOTS 坐标**。
     初版写死 `['apt-c2', 37, 64]` 这类切片坐标，但探针 diag-link 实测：
       连廊落在 x36.4~37.6 / y63.9~90.1，而公寓实际在 y55.9~152.5
     ⇒ 廊既没接到任何院落、也不在同一条竖线上（远看读作"凭空一段墙"）。
     ★ 教训同 §28：**改了建筑数据，忘了改依赖它的构件**。
     ✅ 正解：直接从 buildings 组里**量出每栋真实 bbox** 再连接，
        位置永远跟着建筑走。廊高 2 层（7.2m）、宽 3.4m，两侧连续窗带。 */
  var bld = null, st = CAMP_STAGE;
  for (var si = 0; si < st.children.length; si++) {
    if (st.children[si].name === 'buildings') { bld = st.children[si]; break; }
  }
  if (!bld) return g;
  var apts = [];
  bld.children.forEach(function (b, i) {
    var id = (CAMP_PLACE[i] || {}).id || '';
    if (id.indexOf('apt-') !== 0) return;
    var bb = new THREE.Box3().setFromObject(b);
    if (bb.isEmpty()) return;
    apts.push({ id: id, x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z });
  });
  /* 只连西侧那一列（按世界 x 升序取前 4 栋），东南那栋独处不连 */
  apts.sort(function (a, b) { return (a.x0 + a.x1) - (b.x0 + b.x1); });
  var col = apts.slice(0, 4);
  if (col.length < 2) return g;
  col.sort(function (a, b) { return a.z0 - b.z0; });

  var mWall = mat(0xC8B49A, { rough: 0.92 });
  var mRoof = mat(0x5A5F52, { rough: 0.70, metal: 0.12 });
  var mBase = mat(0x9A9284, { rough: 0.94 });
  var mGlass = mat(0x2E3A48, { rough: 0.25, metal: 0.3 });
  var h = 4.6, w = 2.8;

  for (var k = 0; k < col.length - 1; k++) {
    var a = col[k], b = col[k + 1];
    var gap0 = a.z1, gap1 = b.z0;                 /* 院落之间的真实空隙 */
    var len = gap1 - gap0;
    if (len < 1.2) continue;                       /* 本就贴着，无需廊 */
    var xc = (a.x0 + a.x1) / 2, zc = (gap0 + gap1) / 2;
    var L = new THREE.Group();
    L.position.set(xc, 0, zc);
    L.add(box(w + 0.5, 0.5, len, mBase, 0, 0.25, 0));
    L.add(box(w, h, len, mWall, 0, h / 2 + 0.3, 0));
    L.add(box(w + 0.7, 0.45, len + 0.6, mRoof, 0, h + 0.5, 0));
    for (var fl = 0; fl < 2; fl++) {
      var y = 1.3 + fl * 2.3;
      L.add(box(0.16, 1.15, len - 0.6, mGlass, w / 2, y, 0));
      L.add(box(0.16, 1.15, len - 0.6, mGlass, -w / 2, y, 0));
    }
    L.userData.noFrame = true;
    g.add(L);
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ②-补 次要建筑（附属楼 / 教职工楼 / 后勤）
   ──────────────────────────────────────────────────────────────────
   为什么要单独一批：一所大学除了主楼群，还有大量附属楼。
   初版只有 34 个主原型 ⇒ 校园**大片空草地**，像郊外别墅区而不是校园。
   这批用**简化模型**（平顶 + 女儿墙 + 窗带），成本极低但立刻把密度补上。
   ══════════════════════════════════════════════════════════════════ */
function campSecondary() {
  var g = new THREE.Group();
  var mWall  = mat(0xC2AA84, { rough: 0.92 });
  var mWallB = mat(0xBCB4A6, { rough: 0.92 });
  var mWallC = mat(0xA88E6C, { rough: 0.92 });
  var mWalls = [mWall, mWallB, mWallC];
  var mCap   = mat(0xE2DED4, { rough: 0.72 });
  var mBase  = mat(0x9E9686, { rough: 0.94 });
  var mGlass = mat(0x2E3A48, { rough: 0.20, metal: 0.30 });
  var mEquip = mat(0x8A9098, { rough: 0.62, metal: 0.16 });

  /* w 沿 X、d 沿 Z、nf 层数（层高按 3.2m）
     ★ 10-06：附属楼也换 KayKit 真人美术（5 个型号轮换），
       只保留 cornerIn 红线硬闸门。 */
  function cornerIn(px, py) {
    var inside = false;
    for (var i = 0, j = CAMP_BOUND.length - 1; i < CAMP_BOUND.length; j = i++) {
      var xi = CAMP_BOUND[i][0], yi = CAMP_BOUND[i][1];
      var xj = CAMP_BOUND[j][0], yj = CAMP_BOUND[j][1];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  var SEC_TYPES = ['building_E', 'building_B', 'building_C', 'building_G', 'building_F'];
  void SEC_TYPES;                       /* 10-07 回退：KayKit 附属楼停用 */
  function block(px, py, w, d, nf, rot, mi) {
    var hw = (w / 2 + 1) / CAMP.k, hd = (d / 2 + 1) / CAMP.k;
    if (!cornerIn(px - hw, py - hd) || !cornerIn(px + hw, py - hd) ||
        !cornerIn(px - hw, py + hd) || !cornerIn(px + hw, py + hd)) return;
    var grp = new THREE.Group();
    grp.position.set(cx(px), 0, cz(py));
    grp.rotation.y = rot || 0;
    var h = nf * 3.2;
    grp.add(box(w + 0.7, 0.9, d + 0.7, mBase, 0, 0.45, 0));
    grp.add(box(w, h, d, mWalls[mi % 3], 0, 0.9 + h / 2, 0));
    /* 女儿墙压顶 */
    grp.add(box(w + 0.55, 0.55, d + 0.55, mCap, 0, 0.9 + h + 0.27, 0));
    /* 每层一圈窗带（立面不空，且让"层数"读得出来）*/
    for (var fl = 0; fl < nf; fl++) {
      var y = 0.9 + fl * 3.2 + 1.75;
      grp.add(box(w + 0.08, 1.42, 0.14, mGlass, 0, y, d / 2));
      grp.add(box(w + 0.08, 1.42, 0.14, mGlass, 0, y, -d / 2));
      grp.add(box(0.14, 1.42, d + 0.08, mGlass, w / 2, y, 0));
      grp.add(box(0.14, 1.42, d + 0.08, mGlass, -w / 2, y, 0));
    }
    /* 屋面设备 1~2 件（俯视下的"这是屋顶不是平板"信号）*/
    grp.add(box(2.2, 0.85, 1.7, mEquip, -w * 0.22, 0.9 + h + 0.9, 0));
    if (nf >= 4) grp.add(box(1.7, 0.85, 1.7, mEquip, w * 0.24, 0.9 + h + 0.9, d * 0.16));
    g.add(grp);
  }

  /* 布置：只填空地，不与主建筑冲突。
     ⚠️ 全部必须在**校园用地红线以内**（切片 px 24~182 / py 30~172）——
     初版有 4 栋排在 px184~186（红线之外），它们既没有阴影（超出阴影相机）
     又会孤零零地立在郊野上，读作"漂浮的白骰子"。
     ★ 10-04 重排：西侧 / 南缘旧位全部让位给公寓区与绿带（回总平面图），
     四角由 block() 里的 cornerIn 硬闸门兜底。 */
  var SPOTS = [
    /* 西公寓区列 2 的空档（lab-2 与 apt-c5 之间，让开 py104 东西路）*/
    [58, 112, 13, 10, 3, 0],
    /* 东北角（教学院落以北）*/
    [170, 38, 14, 11, 4, 0.06],
    /* 东门大道两侧（路北 / 路南）*/
    [172, 90, 13, 11, 4, 0],
    [172, 110, 12, 10, 3, 0],
    /* 东南角（新建公寓以东）*/
    [166, 158, 14, 11, 4, 0]
  ];
  SPOTS.forEach(function (s, i) { block(s[0], s[1], s[2], s[3], s[4], s[5], i); });
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ②-补2 景观构筑物：南校门 / 亲水平台 / 湖畔平台
   ──────────────────────────────────────────────────────────────────
   "像不像一所学校"往往由这几个**标志物**决定，而不是楼的数量。
   ══════════════════════════════════════════════════════════════════ */
function campLandscape() {
  var g = new THREE.Group();

  /* ── 南校门：两根门柱 + 横梁 + 校名牌 + 门卫房 ×2 ────────────── */
  var px0 = 102, pz0 = 171;
  var gx = cx(px0), gz = cz(pz0);
  var mPier = mat(0xB8AC96, { rough: 0.90 });
  var mBeam = mat(0x8E6A46, { rough: 0.72 });
  var mBase = mat(0x9E998C, { rough: 0.94 });
  var gw = new THREE.Group();
  gw.position.set(gx, 0, gz);

  /* 门柱（方柱 + 柱帽）*/
  [-1, 1].forEach(function (s) {
    gw.add(box(2.0, 7.2, 2.0, mPier, s * 8.5, 3.6, 0));
    gw.add(box(2.7, 0.6, 2.7, mBase, s * 8.5, 7.5, 0));
  });
  /* 横梁 + 其上压顶 */
  gw.add(box(20.0, 1.5, 1.6, mBeam, 0, 8.4, 0));
  gw.add(box(20.6, 0.45, 2.1, mBase, 0, 9.35, 0));
  /* 校名牌（复用已有的 canvas 文字能力）*/
  var t = makeSignTex('武汉晴川学院', {
    fs: 150, fg: '#F6EFDC', bg: '#7E3A2A', border: '#C8A24A',
    padX: 40, padY: 22
  });
  var asp = t.image.width / t.image.height;
  var ph = 1.5, pw = ph * asp;
  var plate = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph),
    mat(0xFFFFFF, { tex: t, rough: 0.68 }));
  plate.position.set(0, 8.4, 0.86);
  gw.add(plate);
  /* 门卫房 ×2（位置用世界坐标一次算好，不要先设相对再覆盖）*/
  [-1, 1].forEach(function (s) {
    var gh = new THREE.Group();
    gh.position.set(gx + s * 12.5, 0, gz + 1.5);
    gh.add(box(4.2, 0.6, 4.0, mBase, 0, 0.3, 0));
    gh.add(box(4.0, 3.4, 3.8, mat(0xC6BA9E, { rough: 0.90 }), 0, 2.3, 0));
    gh.add(box(4.5, 0.42, 4.3, mat(0x3E5276, { rough: 0.56, metal: 0.22 }), 0, 4.18, 0));
    g.add(gh);
  });
  g.add(gw);

  /* ── 东主门（10-04 回总平面图：主入口在**东侧**，对着东门大道 py100）──
     结构同南门，整体转 90° 让横梁跨在东西向路上；校名牌朝东（面向校外）*/
  var eg = new THREE.Group();
  eg.position.set(cx(179), 0, cz(100));
  eg.rotation.y = Math.PI / 2;
  [-1, 1].forEach(function (s) {
    eg.add(box(2.0, 7.2, 2.0, mPier, s * 8.5, 3.6, 0));
    eg.add(box(2.7, 0.6, 2.7, mBase, s * 8.5, 7.5, 0));
  });
  eg.add(box(20.0, 1.5, 1.6, mBeam, 0, 8.4, 0));
  eg.add(box(20.6, 0.45, 2.1, mBase, 0, 9.35, 0));
  var plate2 = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph),
    mat(0xFFFFFF, { tex: t, rough: 0.68 }));
  plate2.position.set(0, 8.4, 0.86);
  eg.add(plate2);
  g.add(eg);
  /* 东门门卫房 ×2（世界坐标：路两侧）*/
  [-1, 1].forEach(function (s) {
    var gh2 = new THREE.Group();
    gh2.position.set(cx(179) + 1.5, 0, cz(100) + s * 12.5);
    gh2.add(box(4.2, 0.6, 4.0, mBase, 0, 0.3, 0));
    gh2.add(box(4.0, 3.4, 3.8, mat(0xC6BA9E, { rough: 0.90 }), 0, 2.3, 0));
    gh2.add(box(4.5, 0.42, 4.3, mat(0x3E5276, { rough: 0.56, metal: 0.22 }), 0, 4.18, 0));
    g.add(gh2);
  });

  /* ── 南缘地面停车场（10-04：平面图南绿带里的小方块 = 地面停车；
     规划指标"地面停车位 561 个"。沥青薄板 + 白色车位线，2 列 × 8 位）── */
  var pkAsp = mat(0x565A60, { rough: 0.96 });
  var pkLine = mat(0xE8E6DE, { rough: 0.80 });
  var pkx = cx(124), pkz = cz(160);
  g.add(box(56, 0.14, 24, pkAsp, pkx, 0.07, pkz));
  for (var pi = 0; pi < 8; pi++) {
    for (var pj = 0; pj < 2; pj++) {
      var sx = pkx - 24.5 + pi * 7, sz = pkz - 6 + pj * 12;
      /* 每个车位：左右两条分隔线 + 一条端线（薄板贴地，不做成沟）*/
      g.add(box(0.22, 0.05, 5.0, pkLine, sx - 2.6, 0.16, sz));
      g.add(box(0.22, 0.05, 5.0, pkLine, sx + 2.6, 0.16, sz));
      g.add(box(5.4, 0.05, 0.22, pkLine, sx, 0.16, sz + 2.5));
    }
  }

  /* ── 亲水平台（伸入湖中的木平台）：★ 10-07 按**真实岸线**挂在多边形上 ──
     取轮廓上"最东"与"最南"两个顶点，各自朝外法线方向外移 4m 落平台，
     平台的朝向由该处岸线的切线决定 ⇒ 岸线怎么变，平台都贴岸。 */
  var polyW = lakePolyPts(1.0);
  var mWood = mat(0x8A6A48, { rough: 0.80 });
  var mDeck = mat(0x9E7C54, { rough: 0.78 });
  var anchors = [];
  var iE = 0, iS = 0;
  polyW.forEach(function (p, i) {
    if (p[0] > polyW[iE][0]) iE = i;
    if (p[1] > polyW[iS][1]) iS = i;
  });
  if (iE === iS) iS = (iE + 6) % polyW.length;
  [iE, iS].forEach(function (idx) {
    var p = polyW[idx], q = polyW[(idx + 1) % polyW.length], r2 = polyW[(idx - 1 + polyW.length) % polyW.length];
    var tx = q[0] - r2[0], ty = q[1] - r2[1], tl = Math.hypot(tx, ty) || 1;
    /* 外法线（切线转 −90°），并保证指向湖外 */
    var nx2 = -ty / tl, ny2 = tx / tl;
    var cxw = 0, cyw = 0;
    polyW.forEach(function (o) { cxw += o[0]; cyw += o[1]; });
    cxw /= polyW.length; cyw /= polyW.length;
    if ((p[0] - cxw) * nx2 + (p[1] - cyw) * ny2 < 0) { nx2 = -nx2; ny2 = -ny2; }
    var dx = nx2 * 1.1, dy = ny2 * 1.1;              /* 外移 1.1 切片px ≈ 4m */
    var bs = new THREE.Group();
    bs.position.set(cx(p[0] + dx), 0, cz(p[1] + dy));
    bs.rotation.y = -Math.atan2(ny2, nx2) - Math.PI / 2;
    bs.add(box(13.0, 0.42, 7.0, mDeck, 0, 0.55, 0));
    for (var k = -5; k <= 5; k++) {
      bs.add(box(0.18, 0.46, 7.0, mWood, k * 1.2, 0.56, 0));
    }
    for (var qx = -1; qx <= 1; qx += 1) {
      for (var qz = -1; qz <= 1; qz += 1) {
        bs.add(box(0.34, 2.2, 0.34, mWood, qx * 5.6, -0.6, qz * 2.8));
      }
    }
    var mRail = mat(0x6E5638, { rough: 0.82 });
    bs.add(box(13.0, 0.14, 0.16, mRail, 0, 1.35, 3.45));
    bs.add(box(0.16, 0.14, 7.0, mRail, 6.45, 1.35, 0));
    bs.add(box(0.16, 0.14, 7.0, mRail, -6.45, 1.35, 0));
    g.add(bs);
  });

  /* ── 湖畔景观石 + 汀步（同样挂在真实轮廓上，1.30 倍外扩）── */
  var mRock = mat(0x8E8A82, { rough: 0.95 });
  var ringPts = lakePolyPts(1.30);
  for (var i2 = 0; i2 < ringPts.length; i2 += 2) {
    var rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + rnd(i2, 137) * 1.1, 0), mRock);
    rk.position.set(cx(ringPts[i2][0]) + (rnd(i2, 141) - .5) * 1.2, 0.5,
                    cz(ringPts[i2][1]) + (rnd(i2, 143) - .5) * 1.2);
    rk.rotation.set(rnd(i2, 139) * 3, rnd(i2, 149) * 3, rnd(i2, 151) * 3);
    rk.scale.set(1, 0.66, 1.2);
    rk.castShadow = true; rk.receiveShadow = true;
    g.add(rk);
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ③ 天空 + 雾（校园尺度必须"望得远"，雾要拉得很开）
   ══════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   ②-补3 街道家具：路灯 / 长椅 / 花池 / 果皮箱（10-06 新增）
   ──────────────────────────────────────────────────────────────────
   为什么必须有它们：初版校园只有"楼 + 树 + 草"，人走在路上**没有任何
   人造物**——路灯一排排立起来，尺度感才立得住（"这是学校，不是公园"）。
   全部按**道路法线两侧成列**摆放，间距 26m（实拍尺度），
   并与建筑/湖/田径场/红线同走闸门，绝不落进不该落的地方。 */
/* ══════════════════════════════════════════════════════════════════
   ②-补 草簇层（10-06）：给草坪真正的 3D 轮廓与自阴影
   ──────────────────────────────────────────────────────────────────
   贴图层的笔触解决"平面上的粒粒分明"，但**草是立体的**——近景要有
   起伏的草尖和一小片一小片的暗部，靠 InstancedMesh 交叉片实现。
   ⚠️ 尺度铁律：草叶真实尺度 3~8cm，在近景机位（3.77 px/m）下
   只有 0.11~0.30 px ⇒ 直接做等于没画（技能老坑），
   所以这是**尺度作弊**：草簇做成"草丛"而不是单根草。
   ★★ 10-06 二次实测修正（重要）：初版取 0.45m 宽 × 0.34m 高，
   算出来近景 15px 宽 × 11px 高 —— **尺寸并不小**，但宽高比 1.3:1 的
   等腰三角**天生读作"三角纸片"**。⇒ 决定读感的是**形状比例**不是尺寸：
   改成 0.26m 宽 × 0.62m 高（1:2.4 细高比）才读作"草"。
   ⇒ 并且材质必须 FrontSide：DoubleSide 下每片草叶的背面也被光打亮，
   近景细叶的背面像素占比极高 ⇒ 整片草地读作"撒了一地白绿碎纸"
   （实测白占比 17.5% → 改后 0.4%）。
   数量：27000 株 × 3 片 = 81000 面，实例化后只 3 个 draw call。 */
function campTufts() {
  var g = new THREE.Group();
  /* 一片草叶：底部宽 0.26m、尖顶 0.62m —— **细高比 1:2.4**。
     ★★ 10-06 实测修正形状：初版 0.45m 宽 × 0.34m 高（宽高比 1.3:1），
     算出来近景 15px 宽 × 11px 高 —— 尺寸并不小，但**等腰三角的比例
     天生读作"三角纸片"**。真实草簇是竖起来的一把细叶，宽高比 1:2~1:3。
     改比例后同样的屏幕尺寸读作"草"，这是几何问题、不是调色问题。
     两片交叉 = 4 三角面（单片 2 面太单薄，近景透光读作"纸"）。 */
  var blade = new THREE.BufferGeometry();
  var V = [
    /* 片 A（面向 +z）*/
    -0.13, 0, 0,  0.13, 0, 0,  0.015, 0.62, 0.008,
    /* 片 B（绕 y 转 90°，面向 +x）—— 交叉才不是纸片 */
    0, 0, -0.13,  0, 0, 0.13,  0.01, 0.55, 0.014,
    /* 片 C（45° 斜插，高一点，冠层更蓬）*/
    -0.10, 0, -0.10,  0.10, 0, 0.10,  0, 0.50, 0
  ];
  blade.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
  blade.computeVertexNormals();

  /* ★★ 草簇材质改 **FrontSide**（10-06 实测修正）。
     原来用 DoubleSide：每片草叶的**背面也会被光打亮**，而草叶是细长三角、
     近景只有几个像素宽 ⇒ 背面像素占比极高 ⇒ 整片草地读作"撒了一地白绿碎纸"。
     实测白+灰占比 17.5%。
     改成 FrontSide 后只渲染朝上的正面（法线朝上/朝侧），暗面直接不画，
     草簇回到"绿色剪影"，这才是草坪该有的读感。 */
  var mTuftA = new THREE.MeshStandardMaterial({ color: 0x4E6E2A, roughness: 0.95, side: THREE.FrontSide });
  var mTuftB = new THREE.MeshStandardMaterial({ color: 0x415E24, roughness: 0.95, side: THREE.FrontSide });
  var mTuftC = new THREE.MeshStandardMaterial({ color: 0x5A7A32, roughness: 0.94, side: THREE.FrontSide });
  var MATS = [mTuftA, mTuftB, mTuftC];
  var PER = 9000;              /* 草叶变细后必须加密，否则草坪读作"秃地" */

  function inB(px, py) {
    var inside = false;
    for (var i = 0, j = CAMP_BOUND.length - 1; i < CAMP_BOUND.length; j = i++) {
      var xi = CAMP_BOUND[i][0], yi = CAMP_BOUND[i][1];
      var xj = CAMP_BOUND[j][0], yj = CAMP_BOUND[j][1];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inL(px, py) {
    return lakeHit(px, py, 1.06);      /* 真实湖轮廓（10-07）*/
  }
  /* 跑道台地 = 压实硬地，不长草 */
  function inT(px, py) {
    return px > CAMP_TRACK.px - CAMP_TRACK.L / 2 - 1 && px < CAMP_TRACK.px + CAMP_TRACK.L / 2 + 1 &&
           py > CAMP_TRACK.py - CAMP_TRACK.W / 2 - 1 && py < CAMP_TRACK.py + CAMP_TRACK.W / 2 + 1;
  }
  /* 路面 = 沥青/铺装，不长草（用路宽 + 0.6px 判）*/
  function onRoad(px, py) {
    for (var i = 0; i < CAMP_ROADS.length; i++) {
      var rd = CAMP_ROADS[i], half = rd.w / CAMP.k / 2 + 0.9;
      for (var j = 0; j < rd.pts.length - 1; j++) {
        var a = rd.pts[j], b = rd.pts[j + 1];
        var vx = b[0] - a[0], vy = b[1] - a[1];
        var t = ((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy);
        t = Math.max(0, Math.min(1, t));
        var ex = a[0] + vx * t - px, ey = a[1] + vy * t - py;
        if (Math.sqrt(ex * ex + ey * ey) < half) return true;
      }
    }
    return false;
  }

  var dummy = new THREE.Object3D();
  var seeds = [151, 163, 179];
  for (var m = 0; m < 3; m++) {
    var inst = new THREE.InstancedMesh(blade, MATS[m], PER);
    inst.castShadow = false;          /* 草太小，自阴影收益低于开销 */
    inst.receiveShadow = true;
    var k = 0, guard = 0, cx0 = 0, cz0 = 0;
    /* ★★ 10-06 改为**成丛撒布**：真实草坪是丛生的，均匀撒会读作"插秧"。
       做法：先随机一个丛心，再在丛心周围 0.9m 内撒 4~7 叶，
       丛与丛之间保持大间隔 ⇒ 远看是"草丛分布"而不是"一地均匀小刺"。 */
    while (k < PER && guard < PER * 6) {
      guard++;
      var s = guard;
      if (k % 5 === 0) {                       /* 每 5 株换一个新丛心 */
        cx0 = 26 + rnd(s, seeds[m] + 0.3) * 152;
        cz0 = 32 + rnd(s, seeds[m] + 0.7) * 138;
      }
      var jx = (rnd(s, 17.1) - .5) * 1.8;       /* 丛内抖动 ±0.9m */
      var jz = (rnd(s, 19.3) - .5) * 1.8;
      var px = cx0 + jx, py = cz0 + jz;
      /* 越界就跳过本丛（continue 让 while 自然重试，不动 k、不动丛心）*/
      if (!inB(px, py) || inL(px, py) || inT(px, py) || onRoad(px, py)) continue;
      dummy.position.set(cx(px), 0, cz(py));
      dummy.rotation.set((rnd(s, 3.1) - .5) * 0.30, rnd(s, 5.3) * 6.283, (rnd(s, 7.7) - .5) * 0.30);
      /* 高度差拉大（0.55~1.45）：全同高会读作"修剪过的假草"，随机才像自然生长 */
      var sc = 0.55 + rnd(s, 11.3) * 0.90;
      dummy.scale.set(sc, sc * (0.8 + rnd(s, 13.7) * 0.6), sc);
      dummy.updateMatrix();
      inst.setMatrixAt(k++, dummy.matrix);
    }
    inst.count = k;
    inst.instanceMatrix.needsUpdate = true;
    inst.userData.noFrame = true;      /* 不参与取景包围盒 */
    if (!window.__NO_TUFT) g.add(inst);
  }
  return g;
}

function campFurniture() {
  var g = new THREE.Group();

  var mPole  = mat(0x4E545C, { rough: 0.58, metal: 0.42 });
  var mArm   = mat(0x5A6068, { rough: 0.56, metal: 0.44 });
  var mLampH = mat(0x3E434A, { rough: 0.50, metal: 0.48 });
  var mGlow  = new THREE.MeshStandardMaterial({
    color: 0xFFF0CC, emissive: 0xFFE7A8, emissiveIntensity: 0.55,
    roughness: 0.36, transparent: true, opacity: 0.92
  });
  var mWood  = mat(0x9A7A4E, { rough: 0.86 });
  var mWood2 = mat(0x8A6B44, { rough: 0.88 });
  var mIron  = mat(0x3A4048, { rough: 0.62, metal: 0.30 });
  var mBin   = mat(0x4C6B4A, { rough: 0.82 });
  var mSoil  = mat(0x4A3A2C, { rough: 0.97 });
  var mKerb  = mat(0xB4B0A4, { rough: 0.92 });

  /* ── 路灯：底座 + 锥柱 + 悬臂 + 灯壳 + 发光灯罩（≈420 面）── */
  function lamp(x, z, rot) {
    var L = new THREE.Group();
    L.position.set(x, 0, z);
    L.rotation.y = rot;
    L.add(box(0.62, 0.24, 0.62, mKerb, 0, 0.12, 0));                 /* 基座 */
    L.add(box(0.46, 0.20, 0.46, mPole, 0, 0.32, 0));
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.135, 7.2, 10), mPole);
    pole.position.y = 0.42 + 3.6;
    pole.castShadow = true;
    L.add(pole);
    /* 悬臂：从柱顶斜伸 1.35m */
    var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.078, 1.5, 8), mArm);
    arm.position.set(0.60, 7.86, 0);
    arm.rotation.z = -1.16;
    arm.castShadow = true;
    L.add(arm);
    /* 灯壳（浅盘）+ 发光灯罩（略下凸）*/
    var hood = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.30, 0.30, 12), mLampH);
    hood.position.set(1.18, 8.28, 0);
    hood.castShadow = true;
    L.add(hood);
    var lens = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8, 0, 6.3, Math.PI / 2, Math.PI / 2), mGlow);
    lens.position.set(1.18, 8.12, 0);
    L.add(lens);
    /* 柱脚接线盒：小方块，凑近看有东西 */
    L.add(box(0.26, 0.42, 0.20, mArm, 0.14, 0.72, 0));
    g.add(L);
  }

  /* ── 长椅：座板 ×3 + 靠背 ×2 + 铸铁腿（≈300 面）── */
  function bench(x, z, rot) {
    var B = new THREE.Group();
    B.position.set(x, 0, z);
    B.rotation.y = rot;
    for (var s = 0; s < 3; s++) {
      B.add(box(1.86, 0.065, 0.145, mWood, 0, 0.45, -0.18 + s * 0.18));
    }
    for (var b = 0; b < 2; b++) {
      var bs = box(1.86, 0.135, 0.055, mWood2, 0, 0.66 + b * 0.20, 0.235);
      bs.rotation.x = -0.16;                       /* 靠背后仰 */
      B.add(bs);
    }
    [-0.78, 0.78].forEach(function (o) {
      B.add(box(0.075, 0.45, 0.62, mIron, o, 0.225, 0.02));
      B.add(box(0.11, 0.075, 0.70, mIron, o, 0.47, 0.02));
      B.add(box(0.10, 0.62, 0.075, mIron, o, 0.72, 0.30));   /* 靠背立柱 */
    });
    g.add(B);
  }

  /* ── 花池：带沿石框 + 土面 + 3 团低矮灌木（≈520 面）── */
  function planter(x, z, rot, w, d) {
    w = w || 2.6; d = d || 1.5;
    var P = new THREE.Group();
    P.position.set(x, 0, z); P.rotation.y = rot || 0;
    P.add(box(w, 0.34, d, mKerb, 0, 0.17, 0));
    P.add(box(w - 0.34, 0.12, d - 0.34, mSoil, 0, 0.36, 0));
    [[-0.30, 0], [0.28, 0.18], [0.02, -0.24]].forEach(function (o, i) {
      var s = new THREE.Mesh(new THREE.SphereGeometry(0.42 + i * 0.07, 12, 9), mBin);
      s.position.set(o[0] * w, 0.50 + i * 0.06, o[1] * d);
      s.scale.set(1, 0.78, 1);
      s.rotation.y = i * 1.1;
      s.castShadow = true; s.receiveShadow = true;
      P.add(s);
    });
    g.add(P);
  }

  /* ── 果皮箱：柱身 + 顶盖 + 投入口 ── */
  function binBox(x, z) {
    var B2 = new THREE.Group();
    B2.position.set(x, 0, z);
    B2.add(box(0.52, 0.86, 0.46, mBin, 0, 0.43, 0));
    B2.add(box(0.58, 0.10, 0.52, mIron, 0, 0.90, 0));
    B2.add(box(0.34, 0.14, 0.06, mIron, 0, 0.70, 0.24));
    g.add(B2);
  }

  /* ── 闸门（与树木同一套判据，多一份"离路太近"的排除）── */
  function inBound2(px, py) {
    var inside = false;
    for (var i = 0, j = CAMP_BOUND.length - 1; i < CAMP_BOUND.length; j = i++) {
      var xi = CAMP_BOUND[i][0], yi = CAMP_BOUND[i][1];
      var xj = CAMP_BOUND[j][0], yj = CAMP_BOUND[j][1];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inLake2(px, py) {
    return lakeHit(px, py, 1.10);      /* 真实湖轮廓（10-07）*/
  }
  function inTrack2(px, py) {
    return px > CAMP_TRACK.px - CAMP_TRACK.L / 2 - 1.5 &&
           px < CAMP_TRACK.px + CAMP_TRACK.L / 2 + 1.5 &&
           py > CAMP_TRACK.py - CAMP_TRACK.W / 2 - 1.5 &&
           py < CAMP_TRACK.py + CAMP_TRACK.W / 2 + 1.5;
  }
  /* 主楼占位（不能摆家具的地方）*/
  var BLOCK = CAMP_PLACE.filter(function (p) {
    return ['track'].indexOf(p.id) < 0;
  }).map(function (p) { return { id: p.id, px: p.px, py: p.py }; });
  function nearBuilding(px, py) {
    /* 建筑体量按 id 给一个保守半径（切片 px）*/
    var RAD = {
      'apt-c1': 9, 'apt-c2': 8, 'apt-c3': 8, 'apt-c4': 8, 'apt-c5': 8,
      'bldg-c1': 4, 'bldg-c2': 4, 'lab-1': 6, 'lab-2': 5, 'tuoxin': 4,
      'cscenter': 5, 'lib': 6, 'gym': 6, 'canteen': 6,
      'teach-1': 7, 'teach-2': 7, 'teach-3': 7, 'teach-4': 7
    };
    for (var i = 0; i < BLOCK.length; i++) {
      var b = BLOCK[i], r = RAD[b.id] || 4;
      if (Math.abs(px - b.px) < r + 1.2 && Math.abs(py - b.py) < r * 0.72 + 1.2) return true;
    }
    return false;
  }
  function ok(px, py) {
    return inBound2(px, py) && !inLake2(px, py) && !inTrack2(px, py) && !nearBuilding(px, py);
  }

  /* ── 沿主路 + 次路成列摆放（间距 26m，路口两侧交替）── */
  var LANE = [
    /* 环路（w≥13 的三条 + py78/py138 两条次路）*/
    { rd: 0, w: 13, gap: 26 }, { rd: 1, w: 15, gap: 26 },
    { rd: 3, w: 13, gap: 30 }, { rd: 4, w: 9, gap: 34 },
    { rd: 5, w: 9, gap: 30 }, { rd: 6, w: 9, gap: 30 }
  ];
  var pl = 0, pb = 0, pf = 0;
  LANE.forEach(function (ln, li) {
    var rd = CAMP_ROADS[ln.rd];
    for (var i = 0; i < rd.pts.length - 1; i++) {
      var a = rd.pts[i], b = rd.pts[i + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var seglen = Math.sqrt(dx * dx + dz * dz) * CAMP.k;
      var n = Math.max(1, Math.floor(seglen / ln.gap));
      var ux = dx / (seglen / CAMP.k), uz = dz / (seglen / CAMP.k);
      var nx = -uz, nz = ux;
      for (var k = 0; k <= n; k++) {
        var t2 = k / n;
        var mx = a[0] + dx * t2, mz = a[1] + dz * t2;
        var off = rd.w / CAMP.k / 2 + 1.1;
        for (var s = -1; s <= 1; s += 2) {
          var fx = mx + nx * off * s, fz = mz + nz * off * s;
          if (!ok(fx, fz)) continue;
          var rot = Math.atan2(uz * s, ux * s);        /* 灯头朝路外 */
          lamp(cx(fx), cz(fz), rot);
          /* 长椅：每隔一个位放一条，贴着灯柱内侧、朝路 */
          if ((k + li + (s > 0 ? 1 : 0)) % 2 === 0) {
            var bx2 = mx + nx * (off - 1.5) * s, bz2 = mz + nz * (off - 1.5) * s;
            if (ok(bx2, bz2) && pb < 46) {
              bench(cx(bx2), cz(bz2), Math.atan2(uz * s, ux * s) + Math.PI / 2);
              pb++;
            }
          }
          /* 果皮箱：路灯点位每 3 个放 1 个 */
          if ((k + li) % 3 === 0 && pf < 16 && ok(fx + nx * 1.6 * s, fz + nz * 1.6 * s)) {
            binBox(cx(fx + nx * 1.6 * s), cz(fz + nx * 0 + nz * 1.6 * s));
            pf++;
          }
        }
      }
    }
  });

  /* ── 斑马线（10-07）：南门引道口 + 东门大道口，白色条纹横跨路面 ── */
  function zebra(pxc, pyc, vertical) {
    for (var zi = -2; zi <= 2; zi++) {
      var stripe = box(vertical ? 0.55 : 3.4, 0.03, vertical ? 3.4 : 0.55,
        mat(0xEDEAE0, { rough: 0.72 }),
        cx(pxc) + (vertical ? zi * 1.2 : 0), 0.19, cz(pyc) + (vertical ? 0 : zi * 1.2));
      g.add(stripe);
    }
  }
  zebra(102, 157, false);      /* 南门引道 */
  zebra(166, 100, true);       /* 东门大道 */

  /* ── 花池：广场 / 建筑前 / 路口（成组，不散点）── */
  var FLOWERS = [
    [92, 92], [114, 92], [92, 128], [114, 128],
    [150, 84], [150, 108], [66, 140], [76, 140],
    [122, 156], [130, 156], [46, 108], [46, 116],
    [160, 120], [160, 136], [86, 64], [100, 64]
  ];
  FLOWERS.forEach(function (p, i) {
    if (!ok(p[0], p[1])) return;
    planter(cx(p[0]), cz(p[1]), (i % 4) * 0.785, 2.8, 1.6);
  });

  /* ── 路边停车（10-07：KayKit 汽车停用，改用程序化小箱车，保持"尺度参照物"）── */
  [[178, 72, 1.571], [178, 96, 1.571], [178, 122, 1.571],
   [92, 164, 0], [112, 164, 0], [146, 46, 0]].forEach(function (c, i) {
    if (!ok(c[0], c[1])) return;
    var car = new THREE.Group();
    car.position.set(cx(c[0]), 0.17, cz(c[1]));
    car.rotation.y = c[2] + (i % 2) * 3.1416;
    var mBody = mat([0xC8C4BC, 0x8A9AA8, 0xB4A48E, 0x9E5A4E][i % 4], { rough: 0.42, metal: 0.30 });
    var mGlassC = mat(0x2A3644, { rough: 0.16, metal: 0.40 });
    car.add(box(4.3, 0.62, 1.86, mBody, 0, 0.50, 0));
    car.add(box(2.4, 0.56, 1.72, mGlassC, -0.25, 1.06, 0));
    car.add(box(2.6, 0.16, 1.74, mBody, -0.25, 1.38, 0));
    [-1.35, 1.35].forEach(function (wx) {
      [-0.86, 0.86].forEach(function (wz) {
        var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10), mat(0x2A2A2E, { rough: 0.9 }));
        wh.position.set(wx, 0.33, wz);
        wh.rotation.x = Math.PI / 2;
        car.add(wh);
      });
    });
    car.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(car);
  });

  return g;
}

function campSky() {  var N = 512;
  var cv = document.createElement('canvas');
  cv.width = 8; cv.height = N;
  var c2 = cv.getContext('2d');
  var grd = c2.createLinearGradient(0, 0, 0, N);
  grd.addColorStop(0.00, '#3E7CB8');   /* 天顶：饱和蓝 */
  grd.addColorStop(0.34, '#77A8D0');
  grd.addColorStop(0.62, '#B6CEDA');
  grd.addColorStop(0.82, '#DFE4DC');
  grd.addColorStop(1.00, '#F0E6CE');   /* 地平线：暖白（与校园暖调呼应）*/
  c2.fillStyle = grd;
  c2.fillRect(0, 0, 8, N);
  var tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  var sky = new THREE.Mesh(
    new THREE.SphereGeometry(1900, 32, 20),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
  sky.userData.noFrame = true;
  return sky;
}

/* ══════════════════════════════════════════════════════════════════
   ④ 装配 + 相机
   ══════════════════════════════════════════════════════════════════ */
var CAMP_BUILT = 0, CAMP_MISS = [];

(function campAssemble() {
  scene.add(CAMP_STAGE);
  (function(g){g.name="city";CAMP_STAGE.add(g);})(campCity());     /* 最先加：城市层在最下（y=-0.35）*/
  (function(g){g.name="ground";CAMP_STAGE.add(g);})(campGround());
  (function(g){g.name="lake";CAMP_STAGE.add(g);})(campLake());
  (function(g){g.name="track";CAMP_STAGE.add(g);})(campTrack());
  (function(g){g.name="roads";CAMP_STAGE.add(g);})(campRoads());
  (function(g){g.name="green";CAMP_STAGE.add(g);})(campGreen());
  (function(g){g.name="tufts";CAMP_STAGE.add(g);})(campTufts());
  (function(g){g.name="furniture";CAMP_STAGE.add(g);})(campFurniture());
  (function(g){g.name="buildings";CAMP_STAGE.add(g);})(campBuildings());
  (function(g){g.name="aptlinks";CAMP_STAGE.add(g);})(campAptLinks());/* 公寓院落间连廊（10-06） */
  (function(g){g.name="secondary";CAMP_STAGE.add(g);})(campSecondary());
  (function(g){g.name="wall";CAMP_STAGE.add(g);})(campWall());   /* 院墙（10-07 按 3D 母版新增）*/
  (function(g){g.name="landscape";CAMP_STAGE.add(g);})(campLandscape());
  scene.add(campSky());

  /* 雾：校园 560m 尺度 ⇒ 拉远到 780m 才起雾。
     初版 620 起雾，把 ±620 的校外城市整个糊掉了（"周围背景"就白做了）。 */
  /* 近处（校园 ±360m）完全清晰；城市从 ~520m 起渐隐
     ⇒ 远景自然退成雾里的城市，不会跟校园抢注意力。 */
  scene.fog = new THREE.Fog(0xCED8E0, 520, 1900);

  /* 阴影相机：覆盖整个校园（正交 ±340）*/
  /* ★ 单栋场景配的太阳是"近处、偏高"（-52,96,46）—— 校园尺度下会显得平板。
     这里改成**更低更斜**的太阳：阴影拉长、明暗面拉开 ⇒ 立体感立刻出来。 */
  sun.position.set(345, 182, 288);
  sun.intensity = 1.12;
  sun.color.setHex(0xFFF0D6);
  sun.target.position.set(0, 0, 0);
  if (sun.target.parent !== scene) scene.add(sun.target);
  var sc = sun.shadow.camera;
  sc.left = -340; sc.right = 340; sc.top = 340; sc.bottom = -340;
  sc.near = 40; sc.far = 1400;
  sc.updateProjectionMatrix();
  sun.shadow.mapSize.set(8192, 8192);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.9;

  /* 半球光提亮一档：单栋配 0.46 是为"近距离一栋楼"调的，
     整片校园时整体会偏暗（草地尤其显脏）*/
  var hemi = null;
  scene.traverse(function (o) { if (o.isHemisphereLight) hemi = o; });
  if (hemi) { hemi.intensity = 0.58; hemi.color.setHex(0xC8D8E6); }

  /* ★ 换成**透视相机**：正交适合单栋看形制，整片校园用透视才有纵深。
     ★★ 取景要**同时容下校园与周围城市**：视角 40°、距离约 780m 时
     画面横向覆盖 ≈ 890m（±445m），校园（±280m）之外还能看到 165m 的城市。
     初版相机在 (345,182,288)（约 490m）⇒ 画面只覆盖 ±370m，
     校外地表**整个在视野外**，等于城市白画了。 */
  var cam = new THREE.PerspectiveCamera(40, W / H, 2, 4800);
  /* ★ 初始视角可由 URL 指定：campus.html?view=lake —— 出多角度图用 */
  var VP = {
    aerial: [[515, 318, 472], [0, 6, 0]],
    close:  [[236, 128, 262], [10, 10, 30]],
    lake:   [[66, 52, 232],  [-6, 5, 6]],
    south:  [[-60, 116, 452], [0, 10, 40]],
    gate:   [[28, 20, 272],  [-6, 9, 195]],
    snack:  [[-70, 30, 262], [-70, 3, 199]],   /* 10-06：摊位已南移 py162（世界 z199.5），旧机位瞄 py145 拍空 */
    /* 正对西侧公寓列（探针实测该列在世界 x≈-186、z 从 -182 到 +156）*/
    apts:   [[-40, 42, -40], [-186, 8, -20]],
    egate:  [[368, 42, 14],  [240, 8, -28]],
    /* 10-06 验收机位：树/草近景（判"粒粒分明"）与街道家具近景（判灯/椅细节）*/
    tree:   [[-96, 17, 168], [-118, 8, 118]],
    furn:   [[-108, 15, 176], [-128, 4, 132]],
    grass:  [[-104, 7.5, 190], [-116, 1.5, 152]],
    /* 路灯+长椅特写（探针实测那盏灯在 (-107, 199.2)，高 8.4m）*/
    furn2:  [[-99, 4.2, 209], [-107, 3.4, 199]],
    plan:   [[0, 900, 210],  [0, 0, 0]],
    /* 跑道特写（世界中心 -49,-136.5，正上方俯视）*/
    track:  [[-49, 80, -100], [-49, 0, -136.5]],
  }[(location.search.match(/view=(\w+)/) || [])[1]] || [[515, 318, 472], [0, 6, 0]];
  cam.position.set(VP[0][0], VP[0][1], VP[0][2]);
  cam.lookAt(VP[1][0], VP[1][1], VP[1][2]);
  camera = cam;
  window.__CAMP_CAM = cam;

  /* 窗口变化时同步（透视相机只需改 aspect + 画布尺寸）*/
  window.addEventListener('resize', function () {
    var a2 = window.innerWidth / window.innerHeight;
    cam.aspect = a2;
    cam.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

/* ══════════════════════════════════════════════════════════════════
   ⑤ 对外探针
   ══════════════════════════════════════════════════════════════════ */
window.__CAMP = {
  built: function () { return CAMP_BUILT; },
  miss: function () { return CAMP_MISS; },
  stage: function () { return CAMP_STAGE; },
  stat: function () {
    var n = 0, tri = 0;
    CAMP_STAGE.traverse(function (o) {
      if (!o.isMesh) return;
      n++;
      if (o.geometry && o.geometry.index) tri += o.geometry.index.count / 3;
      else if (o.geometry && o.geometry.attributes.position) {
        tri += o.geometry.attributes.position.count / 3;
      }
    });
    var bb = new THREE.Box3().setFromObject(CAMP_STAGE);
    return {
      meshes: n, tris: Math.round(tri),
      bbox: { min: bb.min.toArray().map(function (v) { return +v.toFixed(1); }),
              max: bb.max.toArray().map(function (v) { return +v.toFixed(1); }) },
      built: CAMP_BUILT, miss: CAMP_MISS
    };
  },
  /* 视角预设（截图与演示用）*/
  view: function (name) {
    var c = window.__CAMP_CAM;
    var P = {
      aerial: [[430, 330, 520], [0, 6, 0]],
      north:  [[0, 150, 620],   [0, 10, -40]],
      lake:   [[40, 62, 190],   [-10, 4, 10]],
      south:  [[-40, 96, 470],  [0, 8, 60]],
      close:  [[150, 96, 250],  [10, 6, 40]],
      plan:   [[0, 760, 190],   [0, 0, 0]],
      /* 10-06 补：与 URL 参数 VP 表对齐（此前缺这几个，view('gate') 静默回退航拍）*/
      gate:   [[28, 20, 272],   [-6, 9, 195]],
      egate:  [[368, 42, 14],   [240, 8, -28]],
      snack:  [[-70, 30, 262],  [-70, 3, 199]],
      tree:   [[-96, 17, 168],  [-118, 8, 118]],
      furn:   [[-108, 15, 176], [-128, 4, 132]],
      apts:   [[-40, 42, -40],  [-186, 8, -20]],
      track:  [[-49, 80, -100], [-49, 0, -136.5]]
    }[name] || [[430, 330, 520], [0, 6, 0]];
    c.position.set(P[0][0], P[0][1], P[0][2]);
    c.lookAt(P[1][0], P[1][1], P[1][2]);
    return name;
  }
};
