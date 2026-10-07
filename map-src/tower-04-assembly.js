/* ══════════════════════════════════════════════════════════════════════
   v12 · 主体组装 + 连廊 + 楼梯间 + 场地 + 交互
   ══════════════════════════════════════════════════════════════════════ */

/* ── 一栋楼：砖体 + 四面立面 + 庑殿顶 + 屋面棱 + 天窗 + 楼梯间 ── */
function makeTower(W_, D_, o) {
  o = o || {};
  var nf = o.floors || N_FLOOR;
  var h = nf * FLOOR;
  var g = new THREE.Group();
  var halfW = W_ / 2, halfD = D_ / 2;

  /* ① 结构体（★ v14：砖贴图**物理尺度修正** —— 这是"塑料玩具感"的第一真凶）
     ⚠️ v13 的 repeat 算法是错的：`repeat.y = h/1.0` 意味着整个 19.5m 高的墙
        铺 19.5 张、每张贴图里 19 行砖 ⇒ 共 370 行 ⇒ 每行砖只有 5cm
        ⇒ 远看糊成一片纯色，"砖感"完全消失（DIAG-v14 ②）。
     ✅ v14：一张贴图 = 1.6m × 1.6m（含 25 行砖）⇒ repeat = 尺寸 / 1.6
        ⇒ 19.5m 高的墙铺 12.2 张 × 25 行 = **305 行** ⇒ 行高 64mm ✓
        （实拍砌筑行高 = 砖厚 53 + 灰缝 10 = 63mm，误差 1.6%）*/
  /* ★★★ v22 新增：可选「墙色由调用方承担」（o.wallTint / o.texNeutral）
     ──────────────────────────────────────────────────────────────────
     背景：v17 的写法把墙色**写死**成 `0xFFE8E0`，色相全部来自
       **彩色砖贴图**（`makeBrickTex(1)` 内部写死 rgb(168,90,72)）。
     后果（实测）：批次里给教学楼传了 `PAL.academic`（米黄墙），
       渲出来还是**砖红色** —— 色板对墙面**完全无效**。
       （探针读 `C.wallMid` 确实是米黄，但墙面用的是 mBrickW 的 0xFFE8E0。）

     ✅ 做法：`o.wallTint` 有值时改用**中性灰阶砖贴图**（R=G=B，不含彩度），
        色相完全由 `o.wallTint` 决定 ⇒ 换墙色不用重画贴图。
        这与 `makeApartment` 的 `makeBrickTex(seed, true)` 是**同一套思路**。
     零回归：不传 `o.wallTint` ⇒ 逐字沿用旧的 0xFFE8E0 + 彩色贴图
        （实验楼三个翼都没传，已用同尺寸截图验证：平均绝对差 0.000）。 */
  var NEUTRAL_BRICK = !!o.wallTint;
  /* ★ v22：`o.wallTint` 优先；未传则读 `C.wallTint`（由 withPalette 注入）
     ⇒ 批次只要在色板里写 `wallTint`，墙色就自动生效，调用点无需逐处传参。 */
  var WT = o.wallTint === undefined ? C.wallTint : o.wallTint;
  NEUTRAL_BRICK = !!WT;
  var brickW = makeBrickTex(1, NEUTRAL_BRICK);
  brickW.repeat.set(Math.max(1, Math.round(W_ / BRICK_TILE_M)),
                    Math.max(1, Math.round(h / BRICK_TILE_M)));
  var brickD = makeBrickTex(2, NEUTRAL_BRICK);
  brickD.repeat.set(Math.max(1, Math.round(D_ / BRICK_TILE_M)),
                    Math.max(1, Math.round(h / BRICK_TILE_M)));
  /* ══════════════════════════════════════════════════════════════════════
     ★★★ v17 重大修正：**贴图与材质色被"双重相乘"**（砖红被洗成粉灰的真凶）
     ──────────────────────────────────────────────────────────────────────
     症状（diag-brickmap.cjs + 立面像素直方图）：
       立面像素 p50 明度 139，主色 **#A08078**（rgb 160,128,120 = 粉灰）。
       而"高饱和砖红"像素 **仅 1 个（0%）** —— 设计里的砖红 `rgb(168,90,72)`
       在画面上完全消失。
     定位（diag-brickmap.cjs）：
       砖贴图本身是对的（8×8 均值 rgb(169,98,79) ≈ 设计值）。
       但它挂在 `M.wallMid`（**0x9A5242** = rgb 154,82,66）上。
       three.js 的 `MeshLambertMaterial/MeshStandardMaterial` 在同时有
         `map` 和 `color` 时，结果是 **`map × color`**（逐通道相乘），
       期望值 = rgb(169,98,79) × rgb(154,82,66)/255 = **rgb(102,32,20)**
       ⇒ 一块**极暗的红**，再被太阳/半球光一照，低通道先被抬起来
         ⇒ 高光部分变成"褪色的粉灰"（正是 #A08078）。
     ★ 与上一轮踩的 `sRGBEncoding` 是**同一类病**：都不是"选错颜色"，
       而是**颜色在管线里被多乘了一次 / 少转了一次**。
     ✅ 正解：**有 `map` 的材质，`color` 必须是白（0xFFFFFF）**，
       贴图自带完整颜色信息，材质色只做整体染色用。
       ⇒ 保留 `M.wallMid` 作**色调微调**，但改成"白基 + 极轻微偏色"：
         通道比取 0x9A5242 的**相对关系**（R:G:B ≈ 1 : 0.53 : 0.43）
         抬到接近白：0xFFE8E0（R:G:B ≈ 1 : 0.91 : 0.88）——
         既保住"砖是暖红"的倾向，又不把明度压掉一半。
     ══════════════════════════════════════════════════════════════════════ */
  var mBrickW = M.wallMid.clone();
  /* ★ v17 默认白基（微暖）；v22：有色板就由它承担色相 */
  mBrickW.color.setHex(WT === undefined ? 0xFFE8E0 : WT);
  mBrickW.map = brickW; mBrickW.needsUpdate = true;
  var mBrickD = M.wallMid.clone();
  /* 侧面深一档（保留方向感）：有色板时按 0.87 系数压暗，无则沿用旧值 */
  if (WT === undefined) {
    mBrickD.color.setHex(0xFFE4DA);
  } else {
    var tr = (WT >> 16) & 255, tg = (WT >> 8) & 255, tb = WT & 255;
    mBrickD.color.setHex(((Math.round(tr * 0.87) << 16) |
                          (Math.round(tg * 0.87) << 8) |
                           Math.round(tb * 0.87)) >>> 0);
  }
  mBrickD.map = brickD; mBrickD.needsUpdate = true;
  var core = new THREE.Mesh(new THREE.BoxGeometry(W_ - 0.06, h, D_ - 0.06),
    [mBrickD, mBrickD, M.wallDark, M.base, mBrickW, mBrickW]);
  core.position.y = h / 2;
  core.castShadow = true; core.receiveShadow = true;
  g.add(core);

  /* ★★★ v14b 关键修正：立面基准面必须与**结构体外表面**对齐
     ────────────────────────────────────────────────────────────────
     v13/v14a 的致命 bug（由 diag-glass.cjs 抓出，证据确凿）：
       结构体盒子的外表面在 `halfD`（因为 BoxGeometry(W_−0.06, …) 的
       halfD 已经是 W_/2−0.03，而我把 facade 的 halfD 传成 **W_/2**）⇒
       **墙面比立面基准面多了 0.03**（实测：墙面 z=−7.03，基准面 z=−7.00）。
       然后 `aWindow` 的玻璃给 v=−0.075（想"凹进 0.075"）
       ⇒ 玻璃外表面 = −7.00 − 0.075 = **−7.075**，比墙面 −7.03 **还靠里 0.045**
       ⇒ **玻璃整个埋进墙里** ⇒ 立面上深色玻璃像素 = 0（实测确认）。
     ✅ 修法：立面基准面 = **结构体外表面**（halfW−0.03 / halfD−0.03），
        这样 v=−0.075 就是"相对真实墙面凹进 0.075"，玻璃必然露在墙外可见。
     ⚠️ 顺便：结构体四面外表面其实不是同一个值（W 面在 halfW−0.03、
        D 面在 halfD−0.03），所以按 dir 分别给基准。 */
  var BASE_OFF = 0.03;   /* 结构体每面内缩量（与 BoxGeometry 的 −0.06 对应）*/
  var halfWf = halfW - BASE_OFF;   /* ★ 立面基准：真实墙面 */
  var halfDf = halfD - BASE_OFF;
  for (var dir = 0; dir < 4; dir++) {
    var isX = (dir === 1 || dir === 3);
    var len = (isX ? D_ : W_) - 1.1;        /* 两端留角柱位 */
    var b = facade(g, dir, halfWf, halfDf, len, nf, {
      entry: !!o.entry && (dir === o.entryDir || o.entryDir === undefined),
      bays: o.bays || Math.max(3, Math.round(len / 3.4))   /* ★ v14：开间 3.4m */
    });
    bays = b;
    /* 空调外机（只装在两个可见面，省三角形）*/
    if (o.ac !== false && (dir === 0 || dir === 1)) {
      acUnits(g, dir, halfWf, halfDf, len, nf, { bays: b });
    }
  }

  /* ③ 四个转角柱（把四个立面在角上"收口"，否则转角处墙垛会断）*/
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (s) {
    var p = box(0.86, h, 0.86, M.pier, s[0] * (halfW - 0.30), h / 2, s[1] * (halfD - 0.30));
    g.add(p);
  });

  /* ④ 入口雨棚 */
  if (o.entry) {
    var eDir = o.entryDir === undefined ? 0 : o.entryDir;
    var isEx = (eDir === 1 || eDir === 3);
    var eLen = (isEx ? D_ : W_) - 1.1;
    entryCanopy(g, eDir, halfWf, halfDf, eLen, { w: 5.4, u: 0 });
  }

  /* ⑤ 楼名 */
  if (o.name) buildingName(g, o.nameDir === undefined ? 0 : o.nameDir, halfWf, halfDf, W_, o.name);

  /* ⑥ 屋顶
     ★ v22 新增分支：`o.flatRoof` 为真时改走 **平顶 + 女儿墙**。
       默认（不传）= 庑殿顶，实验楼三个翼都没传 ⇒ **零回归**。
       为什么要它：教学楼若也用四坡顶就成了"实验楼同款"，
       而用户对"是实验楼的复制品"这类判断非常敏感。 */
  var roof = o.flatRoof
    ? flatRoofWithParapet(W_, D_, h, o.flatRoofOpts || {})
    : hipRoof(W_, D_, h);
  g.add(roof);

  /* ⑦ 屋面锁边板缝 —— ★ v13：**改由贴图表达**（v12 用真几何棱条，
        结果 0.42m 的亮色凸条在正交投影下叠成"百叶"，读错了。
        实拍真值是**板宽 1.2m + 深色细缝**，贴图才是对的载体）。 */

  /* ⑧ 屋面天窗（★ 平顶时跳过：天窗是坡屋面的语言）*/
  if (o.roofWin !== false && !o.flatRoof) {
    var rw = roofWindows(W_, D_, h);
    rw.position.y = h + 0.10;
    g.add(rw);
  }

  /* ⑨ 楼梯间出屋面
     ────────────────────────────────────────────────────────────────
     ★★ v15 修异常 [A]（最严重的一处）：原代码
         sy = h + (D+2E)/2·tan(ang)·0.42 + sh/2
       那个 0.42 是"屋面高度的经验折扣"，**但构造物的底面必须落在屋面上**。
       实测：屋面真实 rise = 3.514m，乘 0.42 只算成 1.476m
       ⇒ 楼梯间底面 y=20.976，而屋脊处屋面在 y=23.014 ⇒ **悬空 2.04m**。
     ✅ 正解：用 roofRiseAt()（与屋面同一真源）求**该点真实屋面高度**，
        底面坐进 0.18m。楼梯间收在正脊范围内（|u| ≤ r·0.8）避免落在陡坡上。 */
  if (o.stair) {
    var G = roofGeom(W_, D_);
    var sw = 3.4, sd = 3.0, sh = 2.9;
    /* ★★★ v15b 修异常 [J]：o.stair 的语义是**米**（-8.5 = 往西 8.5m），
       不是"正脊半长的倍数"。v15 误写成 `× G.r` ⇒ 北楼 -8.5 × 4.675 = -39.74m
       （楼宽才 26m！）⇒ 楼梯间直接飘到楼外 26m 的空中。
       铁证：诊断脚本查到 mesh 局部 x = -39.74，正好 = -8.5 × G.r。 */
    var su = o.stair[0];                /* 沿长边（米） */
    var sv = o.stair[1];                /* 沿短边（米） */
    /* 安全钳：任何屋顶附属物的 |u| 不得超过"长边半长 - 自身半宽"，否则弹回 */
    var uMax = G.a - sw / 2 - 0.30;
    su = Math.max(-uMax, Math.min(uMax, su));
    var vMax = G.b - sd / 2 - 0.30;
    sv = Math.max(-vMax, Math.min(vMax, sv));
    var sx = G.longIsX ? su : -sv;
    var sz = G.longIsX ? sv : su;
    var ySurf = roofRiseAt(G, sx, sz);
    var sy = h + ySurf - 0.18 + sh / 2;  /* 底面坐进屋面 0.18m */

    /* ══════════════════════════════════════════════════════════════════
       ★★★ v17 重做楼梯间（原 version 是一个纯色立方体 = "塑料玩具盒"）
       ──────────────────────────────────────────────────────────────────
       诊断（diag-roofkit.cjs）：
         `3.4×2.9×3.0` 的 `M.metal`(#8A9096) 单色盒子 + 白压顶 + 3 条百叶。
         放大图（crop-kit-n.png）读成**没有任何建筑语言的光板**。
       病根与前几轮完全同源：**均匀几何 + 均匀材质**。
       正解 = 给这 3.4m 的方块**建筑语言**（与立面同一套语汇）：
         ① 分两级体量（主间 + 西侧低一档的电梯机房）—— 破"一个整块"
         ② 竖向壁柱 3 道 —— 立面已经证明：**竖线定开间**，横线只是层
         ③ 女儿墙压顶**出挑 8cm 并下沉**（原来是一块平盖板贴在顶上）
         ④ 百叶改成**凹进的百叶窗**（带框），不再是浮在墙面的三条
         ⑤ 出屋面门加**门斗 + 雨棚 + 两级踏步**（原来是一块贴在墙上的深色片）
         ⑥ 屋面挂**爬梯**（实拍里每个出屋面楼梯间都有）
       ══════════════════════════════════════════════════════════════════ */
    var sg = new THREE.Group();

    /* ① 主间体量（略收 6cm，给壁柱留出凸出量）*/
    var bodyW = sw - 0.12, bodyD = sd - 0.12;
    sg.add(box(bodyW, sh, bodyD, M.stairWall, 0, 0, 0));

    /* ①b 电梯机房：西侧低一档、进深收一档 —— 二级体量 */
    var liftW = 1.7, liftH = sh * 0.62, liftD = 1.9;
    var liftX = -sw / 2 - liftW / 2 + 0.10;
    sg.add(box(liftW, liftH, liftD, M.stairWall, liftX, -sh / 2 + liftH / 2, 0.10));
    /* 机房屋面（比墙浅半档，且出挑 10cm）*/
    sg.add(box(liftW + 0.20, 0.16, liftD + 0.20, M.stairTop,
              liftX, -sh / 2 + liftH + 0.08, 0.10));

    /* ② 竖向壁柱 ×3（南面 2 道 + 东侧 1 道）
       立面结论：**竖线定开间**。柱宽 0.22、凸出 0.11（略凸，不遮墙）。
       ★ 必须显式往外推 0.11（`sd/2 + PIL_OUT`），不能压在墙面上
         —— 否则与主体南面共面 ⇒ §9.2 共面闪烁。 */
    var PIL_W = 0.22, PIL_OUT = 0.11;
    [-sw / 2 + 0.75, sw / 2 - 0.75].forEach(function (pxo) {
      sg.add(box(PIL_W, sh, PIL_OUT * 2, M.stairWall, pxo, 0, sd / 2 + PIL_OUT));
    });
    /* 东侧柱 1 道 */
    sg.add(box(PIL_OUT * 2, sh, 0.24, M.stairWall, sw / 2 + PIL_OUT, 0, 0.2));

    /* ③ 女儿墙压顶：出挑 9cm 并**下沉** 4cm（原来是平盖板浮在顶面）*/
    sg.add(box(sw + 0.18, 0.20, sd + 0.18, M.stairTop, 0, sh / 2 - 0.10, 0));
    /* ③b 压顶下沿一道 3cm 阴影线（让压顶读出厚度）*/
    sg.add(box(sw + 0.10, 0.035, sd + 0.10, M.pipeD, 0, sh / 2 - 0.215, 0));

    /* ④ 百叶窗：**凹进** 5cm，带四条叶片 + 上下框（原来是浮在墙上的三条）*/
    var LVR_W = sw * 0.52, LVR_H = 0.78, LVR_Z = sd / 2 - 0.03;
    sg.add(box(LVR_W + 0.10, LVR_H + 0.10, 0.03, M.stairTop, -sw * 0.04, 0.30, LVR_Z + 0.015));
    sg.add(box(LVR_W, LVR_H, 0.015, M.pipeD, -sw * 0.04, 0.30, LVR_Z + 0.035));
    for (var i = 0; i < 4; i++) {
      sg.add(box(LVR_W - 0.06, 0.09, 0.045, M.stairWall,
                 -sw * 0.04, 0.30 - LVR_H / 2 + 0.14 + i * 0.19, LVR_Z + 0.055));
    }

    /* ⑤ 出屋面门斗：门框 + 门扇 + 雨棚 + 两级踏步（原来只是一块深色片）*/
    var DOOR_Z = sd / 2 + 0.02;
    sg.add(box(1.16, 2.24, 0.06, M.frame, sw * 0.20, -sh / 2 + 1.16, DOOR_Z));       /* 门框 */
    sg.add(box(0.94, 2.06, 0.05, M.win,   sw * 0.20, -sh / 2 + 1.06, DOOR_Z + 0.045)); /* 门扇 */
    sg.add(box(1.44, 0.10, 0.52, M.stairTop, sw * 0.20, -sh / 2 + 2.42, DOOR_Z + 0.24)); /* 雨棚 */
    /* 两级踏步 */
    sg.add(box(1.30, 0.15, 0.34, M.stairTop, sw * 0.20, -sh / 2 + 0.075, DOOR_Z + 0.20));
    sg.add(box(1.30, 0.15, 0.34, M.stairTop, sw * 0.20, -sh / 2 - 0.075, DOOR_Z + 0.46));

    /* ⑥ 屋面爬梯（北面，从压顶挂到屋面）—— 实拍里每栋都有
       ★ v17e 改：原来 5 道横档 `0.05×0.05×0.14` 屏幕只有 **4×4px**
         （diag-roofkit 判为噪点）。§12.4：<6px 是噪点不是质感。
       正解 = **减少横档、加粗**：3 道 × 0.07 粗 ⇒ 屏幕 ~6px 起，读成"梯子"。
         两根立杆保持 1.78m（1×11px，细线是合理的 —— 立杆本来就细）。 */
    var LD_Z = -sd / 2 - 0.09, LD_X = -sw * 0.24;
    for (var r = 0; r < 3; r++) {
      sg.add(box(0.07, 0.07, 0.16, M.pipeD, LD_X, sh / 2 - 0.30 - r * 0.58, LD_Z));
    }
    [-0.42, 0.42].forEach(function (lo) {
      sg.add(box(0.07, 1.78, 0.07, M.pipeD, LD_X + lo, sh / 2 - 1.10, LD_Z));
    });

    sg.position.set(sx, sy, sz);
    g.add(sg);
  }

  /* ⑩ 屋顶设备（水箱 / 空调机组 / 风机 / 排气管）
     ★ v15 修异常 [G]：v14 用 `p[0]·W_` 定位水箱，跑出正脊范围 ⇒ 悬空 0.83m。
     正解：一律用 roofGeom() 求正脊半长 r、roofRiseAt() 求该点屋面高。

     ══════════════════════════════════════════════════════════════════════
     ★★★ v17 重做（原版：2 个水箱 + 6 根细管，其中 **42 个网格屏幕 <10px**）
     ──────────────────────────────────────────────────────────────────────
     diag-roofkit.cjs 实测：
       水箱支座四条腿 `0.10×0.32×0.10` → **1×3px**  × 24 个网格
       排气管        `0.22×0.70×0.22` → **3×6px**  × 18 个网格
     §12.4 判据：小于 ~6px 是噪点不是质感 ⇒ 这 42 个网格在做负功。

     正解三条：
       ① **删掉全部 <10px 构件**（水箱腿 → 改成整块混凝土地台，一次替代四条腿）
       ② **建立大中小三级尺度**（真实设备屋面就是这样）：
            大 · 混凝土设备台（2.6m）+ 空调机组（1.9×1.0×0.95）
            中 · 水箱（1.35φ）+ 屋面风机（1.05φ 圆筒 + 顶罩）
            小 · 排气管加粗到 0.30φ（屏幕 ≥8px 才成立）
       ③ **同色不同档**：stairWall / tank / tankLow / pipeD / roofDeck 五档灰
          —— 同一画面出现 4~5 档不同的灰，才有"设备屋面"的真实感。

     位置策略：一律落在 **正脊两侧的缓坡**（|v| ≤ 0.45b）且**避让楼梯间**，
       因为陡坡上的设备会"插进"屋面看起来像悬空。
     ══════════════════════════════════════════════════════════════════════ */
  /* ⑨ 屋面设备（★ 平顶时跳过：平顶的设备在 flatRoofWithParapet 里）*/
  if (o.roofKit !== false && !o.flatRoof) {
    var Gk = roofGeom(W_, D_);
    var kit = new THREE.Group();

    /* 屋面高度函数（局部坐标，返回相对屋脊的 rise）*/
    function yAt(u, v) { return h + roofRiseAt(Gk, Gk.longIsX ? u : -v, Gk.longIsX ? v : u); }
    /* 把 (u,v) 局部坐标落到世界 xz */
    function place(u, v) { return [Gk.longIsX ? u : -v, Gk.longIsX ? v : u]; }
    /* 避让楼梯间：楼梯间占了 (su, sv) 附近 sw×sd 的矩形 */
    function blocked(u, v) {
      if (!o.stair) return false;
      var du = u - o.stair[0], dv = v - o.stair[1];
      return Math.abs(du) < 2.6 && Math.abs(dv) < 2.4;
    }

    /* ── ① 大件：混凝土设备台 + 空调机组（放在正脊一侧的缓坡）──
       设备台整块落地（替代原来的四条 1×3px 细腿）*/
    var DK_W = 2.60, DK_D = 2.30, DK_H = 0.34;
    var dkU = 0.34 * Gk.r, dkV = -0.34 * Gk.b;
    if (!blocked(dkU, dkV)) {
      var dkW = place(dkU, dkV);
      var dkY = yAt(dkU, dkV) - 0.12;
      kit.add(box(DK_W, DK_H, DK_D, M.roofDeck, dkW[0], dkY + DK_H / 2, dkW[1]));

      /* 台面上两台空调机组（一大一小，形成尺度层级）*/
      var AC1_W = 1.90, AC1_H = 0.95, AC1_D = 1.00;
      kit.add(box(AC1_W, AC1_H, AC1_D, M.tank, dkW[0] - 0.16, dkY + DK_H + AC1_H / 2, dkW[1] - 0.42));
      /* 机组顶面格栅（凹进 4cm 的深色板 —— 破掉"纯色盒子"）*/
      kit.add(box(AC1_W - 0.16, 0.04, AC1_D - 0.16, M.pipeD,
                  dkW[0] - 0.16, dkY + DK_H + AC1_H - 0.02, dkW[1] - 0.42));
      /* 机组侧面散热格栅（三条竖线）*/
      for (var gv = 0; gv < 3; gv++) {
        kit.add(box(0.05, AC1_H * 0.62, 0.03, M.pipeD,
                    dkW[0] - 0.16 - AC1_W / 2 + 0.34 + gv * 0.46,
                    dkY + DK_H + AC1_H * 0.52, dkW[1] - 0.42 + AC1_D / 2 + 0.02));
      }
      /* 小机组（尺度对比）*/
      var AC2_W = 1.10, AC2_H = 0.66, AC2_D = 0.86;
      kit.add(box(AC2_W, AC2_H, AC2_D, M.tankLow,
                  dkW[0] - 0.20, dkY + DK_H + AC2_H / 2, dkW[1] + 0.50));
      kit.add(box(AC2_W - 0.14, 0.035, AC2_D - 0.14, M.pipeD,
                  dkW[0] - 0.20, dkY + DK_H + AC2_H - 0.02, dkW[1] + 0.50));
    }

    /* ── ② 中件：水箱（双侧壁，φ1.35，比原来 1.24 略大更易读）──
       原来四条细腿全删；改成一个矮的混凝土基座（整块落地，不再是噪点）*/
    var TANK_R = 0.68, TANK_H = 1.30;
    [[-0.62, 0.30], [0.62, -0.30]].forEach(function (p) {
      var u = p[0] * Gk.r, v = p[1] * Gk.b;
      if (blocked(u, v)) return;
      var w = place(u, v);
      var yB = yAt(u, v) - 0.10;
      /* 基座：φ1.5 圆台（等效于原来的四条腿，但整体可得、屏幕 ≥14px）*/
      var base = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R + 0.14, TANK_R + 0.20, 0.30, 16), M.roofDeck);
      base.position.set(w[0], yB + 0.15, w[1]);
      base.castShadow = true; base.receiveShadow = true;
      kit.add(base);
      /* 罐体 */
      var tk = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 18), M.tank);
      tk.position.set(w[0], yB + 0.30 + TANK_H / 2, w[1]);
      tk.castShadow = true; tk.receiveShadow = true;
      kit.add(tk);
      /* 罐体下箍（一道深色环，破掉"纯圆柱"）*/
      var hoop = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R + 0.035, TANK_R + 0.035, 0.10, 18), M.tankLow);
      hoop.position.set(w[0], yB + 0.30 + TANK_H * 0.30, w[1]);
      kit.add(hoop);
      /* 顶盖（略出檐 + 中间的检修口）*/
      var lid = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R + 0.06, TANK_R + 0.06, 0.10, 16), M.tankLow);
      lid.position.set(w[0], yB + 0.30 + TANK_H + 0.04, w[1]);
      kit.add(lid);
      var hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12), M.pipeD);
      hatch.position.set(w[0], yB + 0.30 + TANK_H + 0.12, w[1]);
      kit.add(hatch);
    });

    /* ── ③ 中件：屋面风机 ×2（圆筒 + 顶罩 —— 真实设备屋面最常见的件）── */
    var FAN_R = 0.52, FAN_H = 0.72;
    [[-0.22, -0.44], [0.20, 0.44]].forEach(function (p) {
      var u = p[0] * Gk.r, v = p[1] * Gk.b;
      if (blocked(u, v)) return;
      var w = place(u, v);
      var yB = yAt(u, v) - 0.08;
      /* 底座（方台，比圆筒略大）*/
      kit.add(box(FAN_R * 2.3, 0.16, FAN_R * 2.3, M.roofDeck, w[0], yB + 0.08, w[1]));
      /* 筒身 */
      var fan = new THREE.Mesh(new THREE.CylinderGeometry(FAN_R, FAN_R * 0.92, FAN_H, 16), M.tank);
      fan.position.set(w[0], yB + 0.16 + FAN_H / 2, w[1]);
      fan.castShadow = true; fan.receiveShadow = true;
      kit.add(fan);
      /* 顶罩（略大的扁圆盘 + 一圈深色边）*/
      var hood = new THREE.Mesh(new THREE.CylinderGeometry(FAN_R + 0.10, FAN_R + 0.10, 0.08, 16), M.tankLow);
      hood.position.set(w[0], yB + 0.16 + FAN_H + 0.04, w[1]);
      kit.add(hood);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 10), M.pipeD);
      hub.position.set(w[0], yB + 0.16 + FAN_H + 0.15, w[1]);
      kit.add(hub);
    });

    /* ── ④ 小件：排气管（★ 加粗到 φ0.30 ⇒ 屏幕 ≥8px，才不是噪点）
       原来 φ0.22×0.70 = 3×6px。现在 φ0.30×0.95 + 顶帽。── */
    for (var k = 0; k < 4; k++) {
      var u2 = -Gk.r * 0.70 + k * (Gk.r * 1.40 / 3);
      var v2 = 0.52 * Gk.b;
      if (blocked(u2, v2)) continue;
      var w2 = place(u2, v2);
      var yB2 = yAt(u2, v2) - 0.06;
      var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.95, 12), M.pipeD);
      pipe.position.set(w2[0], yB2 + 0.475, w2[1]);
      pipe.castShadow = true;
      kit.add(pipe);
      /* 顶帽（★ v17e：原来 0.22φ×0.09 屏幕只有 **4×4px** = 噪点。
         §12.4 判据：<6px 不要加。改成 **0.30φ × 0.16** 的喇叭口雨帽，
         并做成"管细帽大"的对比 ⇒ 屏幕 ≥7px，才读得出"这是个通气管"。*/
      var capP = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.20, 0.16, 12), M.tank);
      capP.position.set(w2[0], yB2 + 1.02, w2[1]);
      capP.castShadow = true;
      kit.add(capP);
    }

    g.add(kit);
  }

  return g;
}

/* ── 白色钢桁架连廊（v12：加腹杆 + 栏板 + 端头插入楼体）───────── */
function skyBridge(len, o) {
  o = o || {};
  var wd = o.w || 2.9;
  var hg = o.h || 3.1;
  var g = new THREE.Group();
  var hf = hg / 2;

  /* 底板（稍厚，有结构感）*/
  var deck = box(len, 0.42, wd, M.galleryE, 0, -hf, 0);
  g.add(deck);
  /* 顶板（略出檐 —— 实拍那圈白色边框）*/
  var top = box(len + 0.20, 0.30, wd + 1.0, M.gallery, 0, hf, 0);
  g.add(top);
  /* 顶板下沿细线（让顶板读出"厚度"）*/
  var lip = box(len + 0.14, 0.10, wd + 0.88, M.galleryD, 0, hf - 0.20, 0);
  g.add(lip);

  /* 两侧栏板 */
  [1, -1].forEach(function (sg) {
    var r = box(len, hg - 0.78, 0.16, M.gallery, 0, -0.10, sg * (wd / 2 - 0.08));
    g.add(r);
    /* 栏板上沿扶手 */
    var h2 = box(len, 0.10, 0.24, M.galleryD, 0, hg - 0.46, sg * (wd / 2 - 0.08));
    g.add(h2);
  });

  /* ★ 腹杆（斜撑呈 W 形 —— 这是"钢桁架"的视觉签名）*/
  var n = Math.max(3, Math.round(len / 1.7));
  for (var i = 0; i < n; i++) {
    var x0 = -len / 2 + (i / n) * len;
    var x1 = -len / 2 + ((i + 1) / n) * len;
    [1, -1].forEach(function (sg) {
      /* 斜杆：从 (x0, 下) 到 (x1, 上) */
      var dx = x1 - x0, dy = hg - 1.1;
      var L = Math.sqrt(dx * dx + dy * dy);
      var d = new THREE.Mesh(new THREE.BoxGeometry(L, 0.11, 0.11), M.galleryD);
      d.position.set((x0 + x1) / 2, -hf + 0.42 + dy / 2, sg * (wd / 2 - 0.08));
      d.rotation.z = Math.atan2(dy, dx);
      d.castShadow = true;
      g.add(d);
      /* 反向斜杆 → W 形 */
      if (i % 2 === 1) {
        var d2 = new THREE.Mesh(new THREE.BoxGeometry(L, 0.11, 0.11), M.galleryD);
        d2.position.set((x0 + x1) / 2, -hf + 0.42 + dy / 2, sg * (wd / 2 - 0.08));
        d2.rotation.z = -Math.atan2(dy, dx);
        d2.castShadow = true;
        g.add(d2);
      }
    });
  }

  /* 端头封板（让连廊"插进"楼里）*/
  [-1, 1].forEach(function (sg) {
    var e = box(0.34, hg, wd + 0.30, M.galleryE, sg * len / 2, 0, 0);
    g.add(e);
  });

  return g;
}

/* ══════════════════════════════════════════════════════════════════
   场地（★ 按实拍：大面积石材铺装 + 3 块不规则绿岛 + 球形灌木）
   ══════════════════════════════════════════════════════════════════ */
var campus = new THREE.Group();
scene.add(campus);

/* 地面（大板石材，带铺装缝）*/
(function () {
  var geo = new THREE.PlaneGeometry(220, 220, 1, 1);
  var groundMat = mat(C.ground, { rough: 0.95 });
  /* 用一张"石板缝"贴图 */
  var cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  var c2 = cv.getContext('2d');
  c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, 256, 256);
  /* 2×2 大板 + 极淡缝 */
  c2.strokeStyle = 'rgba(0,0,0,.075)'; c2.lineWidth = 1.2;
  for (var i = 0; i <= 2; i++) {
    var p = i * 128;
    c2.beginPath(); c2.moveTo(p, 0); c2.lineTo(p, 256); c2.stroke();
    c2.beginPath(); c2.moveTo(0, p); c2.lineTo(256, p); c2.stroke();
  }
  /* 板面极淡斑驳 */
  for (var k = 0; k < 700; k++) {
    var rx = rnd(k, 1) * 256, ry = rnd(k, 2) * 256;
    c2.fillStyle = 'rgba(0,0,0,' + (0.010 + rnd(k, 3) * 0.016).toFixed(3) + ')';
    c2.fillRect(rx, ry, 1 + rnd(k, 4) * 3, 1 + rnd(k, 5) * 3);
  }
  var t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  /* ★ v12b：铺装缝密度 —— 一张贴图 256px = 2×2 块板。
     实拍一块石板约 1.2m ⇒ 一张贴图 = 2.4m ⇒ 220m 的地面要 repeat 92
     但那样太密（像格子布）。实拍的中庭铺装是**大块浅石板**（约 2.4m 一块），
     且缝隙极淡。取 repeat = 220/4.8 ≈ 46（一张贴图 = 4.8m = 2 块 2.4m 板）。 */
  t.repeat.set(46, 46);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  groundMat.map = t;
  /* ★★★ v15c 修异常 [R]（像素统计暴露的最大观感问题）：
     全图 1440×960 里 **79% 的像素是同一块纯净浅灰地面**（#B4B0A9，B−R≈0）。
     它抢走了建筑的对比、让整个画面"空"。
     ✅ 正解：给地面**分区** —— 建筑群周边保持石材铺装，
        外圈铺**草地/绿化带**，并在两者之间做一条**道路环**。
     实现：在石材地面之上叠一块"外圈草地"（RingGeometry，内径 34 / 外径 110），
        再加一条浅灰道路环（内径 30 / 外径 34）。三层高差极小（0.02/0.04）防 z-fight。 */
  var base = new THREE.Mesh(geo, groundMat);
  base.rotation.x = -Math.PI / 2;
  base.receiveShadow = true;
  base.userData.noFrame = true;
  campus.add(base);

  /* ── 石材铺装圆盘（半径 34）—— 把"无限灰地"收成"一个铺装广场" ──
     ★ v15c：`base`（220×220 灰地）只是**兜底**（防止边缘穿帮）；
       真正的"校园地面"是这个半径 34 的铺装圆盘。
       层次：铺装圆盘(0~34) → 道路环(29.6~34) → 草地(34~108)，
       但有重叠，靠 y 递进（0.02 / 0.035 / 0.05）避免 z-fight。 */
  /* ── 石材铺装圆盘（半径 34）──
     ★ v15c：`base`（220×220 灰地）只是**兜底**（防止边缘穿帮）；
       真正的"校园地面"是这个半径 34 的铺装圆盘。
       层次：铺装圆盘(0~34) → 道路环(34.2~38) → 草地(34~108)，
       但有重叠，靠 y 递进（0.02 / 0.035 / 0.05）避免 z-fight。

     ★★★ v18 重做「铺装分格」（本轮任务）
     ══════════════════════════════════════════════════════════════════
     【旧做法的两条硬伤 —— 都是量化之后才看见的】
     ① **7 圈分格环的可见像素 = 0**（audit-ground.cjs 掩膜渲染实测）
        真因：环宽 **0.03m**，本视角 **7.564 px/m** ⇒ **0.227 像素**。
        20% 覆盖率 × 0.14 不透明度 ⇒ 贡献约等于 0。
        ⇒ 我上一轮还在调它的 opacity（0.30 → 0.14）——**在亚像素的东西上做功**。
        ⇒ 撞在 §16.4：小物件先估屏幕尺寸，<6px 就不要加。这里是 **0.2px**。
        （不是 z-fighting：探针实测间隙 6mm、该距离深度精度 1.48mm，差 4 倍）
     ② **形态错了**：真实铺装是**正交方格**；同心环读成"靶环/雷达"，
        不是"石板分格"（BUILDING-SPEC.md：铺装 = 浅灰石材大板）。
     【新做法】
     · 分格**烘焙进贴图**，不再用浮在面之上的几何环（顺带彻底消除 z-fight 风险）。
     · 两个尺度（真实广场本来就是这样分级的）：
       大分格 **2.1m**（15.9px），缝芯 **0.18m ≈ 1.36px** ← 这条是"看得见的分格"；
       细石板 **0.525m**（4.0px），缝宽 0.07m ≈ 0.53px ← 交给 mipmap 平均成"石材质感"。
       ★ 2.1m 是**视觉 A/B 选出来的**（build-variants.py 出 4.2 / 2.1 / 1.4 三版同图对比）：
         4.2m 读成"大块地砖"、1.4m 偏忙；且格子越细缝占面积越大、广场越暗
         （实测广场明度 4.2m→172.5、2.1m→169.8、1.4m→167.4），
         "更像铺装"与"广场要比草坪亮"在这里是互相拉扯的。
     · 贴图**严格周期**（缝画在整数格边界 + 环绕补齐）⇒ 平铺天然无缝，
       绕开 §16.2「大面积平面贴图露平铺边界」的坑（方格是周期图案，不是斑块）。
     · 明度微差**只向下**做（0.96~1.00）—— 因为广场明度没有向上余量。
     · 收边带（深色石环 2.6m）把广场(172.5)与道路(178.6)分开 —— 两者几乎同色。 */
  (function () {
    /* ══ 铺装参数（**单一入口** —— 尺寸只在这里改）══════════════════
       ★★★ 为什么这几个数必须一起定：本视角 **7.564 px/m**，所以
         · 缝宽 < 0.15m ⇒ 亚像素 ⇒ 等于没画（旧版的 0.03m = 0.227px 就是这么废掉的）
         · 缝宽 ≥ 0.20m ⇒ 1.51px ⇒ 稳定看得见
         · 格子边长决定"读成大块地砖还是石材铺装"：4.2m=31.8px 偏大、2.1m=15.9px 适中
       ⇒ 缝宽**用绝对值**（不跟格子等比缩放）：等比缩到 2.1m 格时缝会掉回亚像素。 */
    var CELL_M      = 2.1;    /* 大分格边长（世界米）—— 视觉 A/B 选出来的 */
    var BIG         = 8;      /* 一张贴图 = 8×8 大格 */
    var SUB         = 4;      /* 一大格 = 4×4 细石板（细缝交给 mipmap 平均成质感）*/
    var TILE_M      = BIG * CELL_M;   /* 一张贴图的物理尺寸 */
    var JOINT_FINE_M = 0.07;  /* 细石板缝：0.53px —— 不指望看得见，只贡献质感 */
    var JOINT_SOFT_M = 0.30;  /* 大缝"软肩"：2.27px —— 让缝有过渡，不是硬贴一条线 */
    var JOINT_CORE_M = 0.18;  /* 大缝"芯"：1.36px —— **这条才是看得见的分格** */
    var PLAZA_D     = 68;     /* 铺装圆盘直径（半径 34）*/

    /* ── 石材铺装贴图（周期图案，无缝）── */
    function makePavingTex() {
      var N = 512;                  /* 画布边长 */
      var CELL = N / BIG;           /* 一大格在贴图里占多少像素 */

      var cv = document.createElement('canvas');
      cv.width = cv.height = N;
      var g = cv.getContext('2d');

      /* ★★★ v18b 关键修正：这张贴图是**纯白基底 + 只向下的调制层**，
         不是"石材色本身"。
         ────────────────────────────────────────────────────────────────
         为什么必须这样（第一版实测踩到的坑）：
         把石材色画进贴图、材质 color 设白、并 tex.encoding = sRGBEncoding，
         结果广场明度 **179.8 → 126.4**（掉了一半）。
         真因是两条路径的色彩管理**不一致**：
           · 材质 color：three r149 传统模式下 **不做** sRGB→线性转换
           · 贴图 encoding = sRGBEncoding：**做** 转换（0.549 → 0.262）
         ⇒ 白色 × 转过的贴图 ≈ 一半亮度。又是 §14「颜色被多转一次」那一族。
         而广场明度**向上零余量**（材质抬 10 就 70% 过曝），掉下去很难补回来。
         ✅ 零回归写法：**材质 color 保持 0x8C8880 不动**（= 已验证安全的 v17 值），
            贴图做成"系数恒 ≤ 1.0"的调制层 ⇒ 平坦区乘积恒等于
            1.0 × 0x8C8880，**与 v17 逐像素相同**；图案只可能让画面变暗，
            永不增加过曝 —— 这正好对上了"广场只能靠压暗做分格"的约束。
         ⇒ 因此这里**不设** tex.encoding（保持 LinearEncoding）：
            让贴图与材质 color 处在同一色彩空间，k 才是"乘数"的本来含义。 */
      function rgb(k) {             /* k = 相对材质的乘数（≤ 1.0）*/
        var v = Math.max(0, Math.min(255, Math.round(255 * k)));
        return 'rgb(' + v + ',' + v + ',' + v + ')';
      }
      /* ★ 缝的深浅**从色板推导**，不写死倍数 ——
         否则改 C.plazaJoint 时贴图不跟着变（"闸门/贴图依赖会漂移的常量"那类病）。 */
      function lumOf(hex) {
        return 0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255);
      }
      var LJ = lumOf(C.plazaJoint) / lumOf(C.plaza);   /* 大缝系数 ≈ 0.66 */
      var LF = lumOf(C.plazaFine) / lumOf(C.plaza);    /* 细缝系数 ≈ 0.86 */
      /* 环绕补齐：把一条缝在 -N / 0 / +N 三个位置各画一次。
         这样画布左边缘的缝会从右边缘"接回来"，平铺时无缝。 */
      function jointAt(pos, hw, style) {
        g.fillStyle = style;
        [-N, 0, N].forEach(function (off) {
          g.fillRect(pos + off - hw, 0, hw * 2, N);   /* 竖缝 */
          g.fillRect(0, pos + off - hw, N, hw * 2);   /* 横缝 */
        });
      }

      /* ① 底色 */
      g.fillStyle = rgb(1); g.fillRect(0, 0, N, N);

      /* ② 每块细石板的明度微差（★ 只向下 0.96~1.00）
         ── 为什么幅度这么小：
            ① 广场明度向上零余量、向下也只能让 5% 左右，幅度大就把广场压得跟草坪一样暗；
            ② 贴图会平铺 68/16.8 ≈ 4 次，微差幅度越大、"同一块斑"重复越容易被看出来。*/
      for (var by = 0; by < BIG; by++) {
        for (var bx = 0; bx < BIG; bx++) {
          for (var sy = 0; sy < SUB; sy++) {
            for (var sx = 0; sx < SUB; sx++) {
              var idx = (by * SUB + sy) * 64 + (bx * SUB + sx);
              g.fillStyle = rgb(0.96 + rnd(idx, 7) * 0.04);
              g.fillRect(bx * CELL + sx * (CELL / SUB), by * CELL + sy * (CELL / SUB),
                         CELL / SUB, CELL / SUB);
            }
          }
        }
      }

      /* ③ 板面斑驳（低对比、环绕补齐；§9.5：斑块总面积要小于画布面积）
         ★ 用**黑 + 低 alpha**（向下调制）—— 因为是纯白基底，加白等于没加 */
      for (var i = 0; i < 200; i++) {
        var pxq = rnd(i, 11) * N, pyq = rnd(i, 12) * N, pr = 3 + rnd(i, 13) * 8;
        var al = (0.012 + rnd(i, 14) * 0.014).toFixed(3);
        [-N, 0, N].forEach(function (ox) {
          [-N, 0, N].forEach(function (oy) {
            g.fillStyle = 'rgba(0,0,0,' + al + ')';
            g.beginPath(); g.arc(pxq + ox, pyq + oy, pr, 0, 6.2832); g.fill();
          });
        });
      }

      /* ④ 细石板缝（0.07m ≈ 0.53px —— 会被 mipmap 平均成质感，不是"看得到的线"）*/
      var fw = (JOINT_FINE_M / TILE_M) * N / 2;
      for (var f = 0; f < BIG * SUB; f++) {
        jointAt(f * (N / (BIG * SUB)), fw, rgb(LF));
      }

      /* ⑤ 大分格缝 —— **两段式：软肩 + 缝芯**
         · 软肩 0.34m ≈ 2.57px、系数 0.90 —— 给缝一个过渡，不是硬贴一条线
         · 缝芯 0.20m ≈ 1.51px、系数 LJ≈0.66 —— 这条才是"看得见的分格"
         总宽 0.34m ⇒ 屏幕上约 2.6px，越过"亚像素"这条死线 11 倍。 */
      var hwSoft = (JOINT_SOFT_M / TILE_M) * N / 2;
      var hwCore = (JOINT_CORE_M / TILE_M) * N / 2;
      for (var b = 0; b < BIG; b++) {
        jointAt(b * CELL, hwSoft, rgb(0.96));
        jointAt(b * CELL, hwCore, rgb(LJ));
      }
      return cv;
    }

    var tex = new THREE.CanvasTexture(makePavingTex());
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    /* ★ 重复次数 = 直径 / 一张贴图的物理尺寸（不是拍脑袋的数字）*/
    tex.repeat.set(PLAZA_D / TILE_M, PLAZA_D / TILE_M);
    /* ★★★ 这里**故意不设** tex.encoding（保持默认 LinearEncoding）。
       ────────────────────────────────────────────────────────────────
       技能 §9.3 写的是"所有程序化 canvas 贴图都要 sRGBEncoding"。本轮实测
       **这条在本项目（three r149 + 传统色彩管理）会出错**：
       材质 color 不做 sRGB→线性转换，而 sRGBEncoding 的贴图会做
       ⇒ 两条路径不一致，实测广场 179.8 → 126.4（掉一半）。
       正确判据不是"贴图要不要转"，而是
         **贴图与材质 color 必须处在同一色彩空间**。
       本贴图是"纯白基底 + ≤1.0 乘数"的**调制层**，与 color 同空间 ⇒ 保持 Linear。
       （若将来把石材色搬进贴图、color 设白，那时才该设 sRGBEncoding。） */
    tex.anisotropy = 8;

    /* ★ 96 → 128 段：铺装边缘更圆 */
    var gPlaza = new THREE.CircleGeometry(34, 128);
    /* ★★ color 保持 0x8C8880 —— 与 v17 逐像素相同（广场明度零余量，不能动）。
       贴图只向下调制，所以平坦区乘积 = 1.0 × 0x8C8880。 */
    var mPlaza = mat(C.plaza, { rough: 0.94 });
    mPlaza.map = tex;
    mPlaza.needsUpdate = true;

    var plaza = new THREE.Mesh(gPlaza, mPlaza);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.05, -4);
    plaza.receiveShadow = true;
    plaza.userData.noFrame = true;
    campus.add(plaza);

    /* ── 收边带（深色石环，2.6m ≈ 19.7px）──
       广场 179.8 与道路 178.6 只差 1.2 ⇒ 边缘完全读不出来。
       一条深色收边带把两者分开，同时给圆盘的方格一个"收头"。 */
    var gEdge = new THREE.RingGeometry(31.4, 34, 128, 1);
    var edge = new THREE.Mesh(gEdge, mat(C.plazaEdge, { rough: 0.90 }));
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.055, -4);
    edge.receiveShadow = true;
    edge.userData.noFrame = true;
    campus.add(edge);
  })();

  /* ── 外圈草地（把"无限灰地"收成"校园在绿地中"）──
     ★ 坑：RingGeometry 建在局部 XY 平面，rotation.x = −π/2 后
       局部 +y → 世界 −z，但对**圆环**来说这只是一个镜像，不影响外观。 */
  (function () {
    /* ★ v15c：外径从 118 收到 62 —— 118 会把取景包围盒撑爆（建筑缩成一点）。
       ★★ v15c-2：62 又太"圆盘感"（截图里读成"一个绿圆浮在灰地上"）。
       正解 = 外径放到 **108**（超出视野 ⇒ 草地自然"延出画面"），
        同时**取景过滤掉 RingGeometry**（见 fitCameraTo 的 filter）
        ⇒ 两全：建筑不被缩小，草地不露出边界。 */
    var gGrass = new THREE.RingGeometry(34, 108, 96, 1);
    /* ★★★ v15c-3（第三次迭代，最终方案）：**草地不用贴图**
       ────────────────────────────────────────────────────────────
       三轮试错的教训（都是"可辨识平铺"这一个病）：
         ① repeat 9 + 小斑  ⇒ "麻点"
         ② repeat 4 + 大斑  ⇒ "水彩晕染"
         ③ repeat 26 + 中斑 ⇒ **规则网格**（肉眼能看出重复的六边形）
       病根：`CanvasTexture` 的 `RepeatWrapping` 在**大面积斜视**下，
         只要图案有可辨识的结构，平铺边界就一定会被看出来。
         草地恰恰是画面里面积最大、视角最平的面 —— 最不适合贴图。
       ✅ 正解：**纯色草地**，靠三样东西提供"材质感"：
         ① 建筑投影（现有）② 灌木/树木（现有）
         ③ 一条略深的"草坪内圈"（靠近道路处略深，暗示修剪过渡）
       这比任何贴图都干净，且远看不会露出重复。 */
    /* ★★★ v17b 最终档（实验驱动，不是拍脑袋）
       ────────────────────────────────────────────────────────────────
       两条实验结论：
       ① `exp-grass-contrast.cjs`（只改草材质，单变量）：
            材质明度 88 → 渲染 164.5
            材质明度 79 → 渲染 158.8
            材质明度 70 → 渲染 152.8
            材质明度 64 → 渲染 147.2
          ⇒ **传递率 ≈ 0.67**（光照把低值抬回去 1/3）。
       ② `exp-sun-elev.cjs`（只改太阳高度角）：
            54°(原) 反差 −46.4 / 阴影 8.4%
            45°     反差 −54.2 / 阴影 10.1%   ← 反而更差（非单调）
            35°     反差 −47.7 / 阴影 12.8%
            27°     反差 −35.7 / 阴影 20.0%
            20°     反差 −22.6 / 阴影 37.7%
          ⇒ 压低太阳**确实**能收反差，但 20° 时阴影吃掉 37.7% 画面
            —— 那会毁掉用户已认可的"干净俯视"观感。**不是可用的杠杆。**
       ⇒ 结论：只走材质一途，按 0.67 传递率定档。
         目标让草坪落到 **~150**（≈ 广场 −20，建立"铺装最亮 / 草最暗"的正序）。
         0x4E6B44（渲染 169.6）→ 需再降 ~30 ⇒ 材质需再降 ~45
         ⇒ 取 **0x3A522F**（明度 74）。 */
    var mGrass = mat(0x3A522F, { rough: 1.0 });
    var ring = new THREE.Mesh(gGrass, mGrass);
    ring.rotation.x = -Math.PI / 2;
    /* ★ v15c：环心对齐**建筑群中心**（三栋楼的包围盒中心约 z = −4）
       —— 否则建筑在环内偏心，"校园"读起来歪着。 */
    ring.position.set(0, 0.02, -4);
    ring.receiveShadow = true;
    campus.add(ring);

    /* ══════════════════════════════════════════════════════════════
       ★★★ v16d：**撤回**色块拼贴与草叶线（两条路都证伪）
       ──────────────────────────────────────────────────────────────
       诊断起点（diag-lawn.py）：草坪占全图 **74.8%**、明度 ~200、标准差仅 7~9。
       我据此判断"面积最大的面没有结构"，做了两轮方案，**都失败**：

       ① 色块拼贴（grass patchwork）
          · v16a 同心扇环   ⇒ 截图上读成**同心环纹**（像雷达图）
          · v16b 斜方格 11m ⇒ 读成**低多边形地形色斑**（像游戏地形）
          · v16c 斜方格 6.2m ⇒ 读成**碎花布/马赛克**
          ★ 三版都没解决"块内均匀"——块的**内部还是纯色**。

       ② 草叶线（11000 条 LineSegments）
          ★★ 关键对照实验（exp-lawn-tex.cjs，固定相机与光照）：
              方案              标准差   边缘密度
              P0 纯色（基线）     8.13     2.42
              P1 纯色 + 草叶线    8.12     2.73   ← ★ 线对"标准差"**零贡献**
              P3 只有色块         9.55     2.70
              P4 色块 + 草叶线    9.51     3.01
          ⇒ **0.42 透明度的细线被 mipmap 完全平均掉了**，肉眼也看不出。
            唯一有"数据效果"的是色块，但它把 SD 从 8.1 拉到 9.5（+17%）
            的代价，是**整个画面变成碎花布** —— 收益小、代价大，不划算。

       ★★★ 结论（本轮最重要的方法论修正）：
          **"草坪太均匀"不是病，我给一个本不该有质感的表面强加质感才是病。**
          真实航拍里草坪之所以没有质感，是因为**从那个高度看它就是一块均匀的绿**。
          画面"空"的真正原因是**场地上没有别的东西**，
          而不是草坪本身缺少纹理。
          ⇒ 正解不是"给草坪加颜色纹理"，而是**用场地上真实存在的东西打断它**：
             行道树（沿路阵列）/ 人行步道（把草坪切成人可以走的分区）/
             分区绿化带（草坪与道路的过渡）。
             这些是**语义正确**的：真实校园就是这样，且它们自带投影与轮廓，
             不是"贴上去的花纹"。
          （本节撤回的代码仍保留在 git 与 2026-09-25 日志里，作为过程留痕。）
       ══════════════════════════════════════════════════════════════ */


    /* ── 草坪内圈（略深一档，暗示修剪过渡；让"草"不是一块绝对纯色）
       ★ v17：内圈同步压深（0x53703F → 0x45602F），与外圈拉开**两个明度档**
         —— 原来内外只差 9 个明度值，在屏幕上根本读不出分界。 ── */
    (function () {
      var gIn = new THREE.RingGeometry(34, 52, 96, 1);
      var ringIn = new THREE.Mesh(gIn, mat(0x33482A, { rough: 1.0 }));
      ringIn.rotation.x = -Math.PI / 2;
      ringIn.position.set(0, 0.028, -4);
      ringIn.receiveShadow = true;
      campus.add(ringIn);
    })();

    /* ── 道路环（铺装广场与草地之间的环路）──
       ★ v15c：从 29.6~33.8 外移到 **34.2~38.0** —— 原来的内径 29.6
         与铺装（半径 34）重叠，读成"广场中间一条弧线"。 */
    var gRoad = new THREE.RingGeometry(34.2, 38.0, 96, 1);
    var mRoad = mat(0x7A7872, { rough: 0.92 });
    var road = new THREE.Mesh(gRoad, mRoad);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.045, -4);
    road.receiveShadow = true;
    campus.add(road);
    /* 路缘石（内外各一圈细高环）*/
    [[34.2, 0.10], [37.6, 0.10]].forEach(function (c) {
      var cg = new THREE.RingGeometry(c[0], c[0] + 0.34, 96, 1);
      var cm = new THREE.Mesh(cg, mat(C.curb, { rough: 0.9 }));
      cm.rotation.x = -Math.PI / 2;
      cm.position.set(0, 0.052, -4);
      cm.receiveShadow = true;
      campus.add(cm);
    });
  })();
})();

/* 三块不规则绿岛（实拍：两块在中庭、一大块在南侧）
   ★ v14：实测中庭配景结构 = **大面积石材铺装（约 70%）+ 3 块有机形绿岛 + 成簇灌木 + 行道树**
     v13 的问题是"三块 + 12 个孤立球" ⇒ 像洒了几颗豆子，读不出"校园"。
   ⚠️ 坐标映射坑：ShapeGeometry 建在**局部 XY 平面**，rotation.x = -π/2 后
      局部 +y 映射到世界 **-z**。所以传入 (u, v) 时，v 是"世界 -z"。 */
function island(worldPts, y) {
  var shape = new THREE.Shape();
  worldPts.forEach(function (p, i) {
    /* 世界 (x, z) → 局部 (x, -z) */
    if (i === 0) shape.moveTo(p[0], -p[1]); else shape.lineTo(p[0], -p[1]);
  });
  shape.closePath();
  var m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(C.island, { rough: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  campus.add(m);
  /* 岛边缘深色收边（用世界坐标直接建线，不用旋转）*/
  var lp = worldPts.map(function (p) { return new THREE.Vector3(p[0], y + 0.015, p[1]); });
  lp.push(lp[0].clone());
  campus.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(lp),
    new THREE.LineBasicMaterial({ color: 0x54683E })
  ));
  return m;
}

/* ★ v14 新增：把折线点自动"圆化"成有机曲线（实拍绿岛是平滑的弧边，不是多边形）
   做法：对每一对相邻点之间插入二次贝塞尔的中点扰动，生成 2 倍密度点列。*/
function organic(pts, bulge) {
  var out = [];
  bulge = bulge === undefined ? 0.18 : bulge;
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[(i + 1) % pts.length];
    out.push(a);
    var mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    /* 中点沿"外法向"外凸，形成柔和弧线 */
    var dx = b[0] - a[0], dz = b[1] - a[1];
    var L = Math.sqrt(dx * dx + dz * dz) || 1;
    out.push([mx - dz / L * L * bulge * 0.5, mz + dx / L * L * bulge * 0.5]);
  }
  return out;
}

/* 内院两块（世界 z 为负方向是"北"，内院在 z ∈ [-7, 11] 之间）*/
island(organic([[-7.5, -2.0], [-3.2, -4.6], [-1.0, -2.4], [-2.2, 1.2], [-5.6, 0.6], [-8.2, 0.4]]), 0.03);
island(organic([[2.6, -3.4], [6.4, -5.2], [7.0, -1.4], [4.2, 0.8], [1.2, -0.6]]), 0.03);
/* 南侧大块 */
island(organic([[-4.0, 13.4], [1.4, 12.2], [2.0, 6.4], [-3.4, 5.2], [-5.6, 9.2]]), 0.03);

/* ★ v14 新增：成簇灌木（实拍是**一簇一簇**的修剪球，大小递减，不是孤立散布）
   每簇：1 个大的居中 + 4~6 个小的环绕，半径与高度都递减。*/
(function () {
  var geo = new THREE.SphereGeometry(1, 16, 12);
  var m1 = mat(C.hedge, { rough: 0.94 });
  /* 簇心（世界 x, z） + 该簇主球半径 */
  var clumps = [
    [-6.0, -1.0, 0.95], [-3.2, -2.4, 0.80],
    [4.6, -2.8, 0.98], [5.6, -1.2, 0.72],
    [-1.4, 9.0, 1.05], [1.0, 10.4, 0.78]
  ];
  clumps.forEach(function (c, ci) {
    var R = c[2];
    /* 主球 */
    var b0 = new THREE.Mesh(geo, m1);
    b0.scale.set(R, R * 0.82, R);
    b0.position.set(c[0], R * 0.82, c[1]);
    b0.castShadow = true; b0.receiveShadow = true;
    campus.add(b0);
    /* 环绕小球（5 个，半径 0.45R ~ 0.68R）*/
    for (var k = 0; k < 5; k++) {
      var ang = (k / 5) * Math.PI * 2 + rnd(ci * 7 + k, 31) * 0.9;
      var dist = R * (1.05 + rnd(ci + k, 32) * 0.55);
      var r2 = R * (0.42 + rnd(ci * 3 + k, 33) * 0.26);
      var b = new THREE.Mesh(geo, m1);
      b.scale.set(r2, r2 * 0.80, r2);
      b.position.set(c[0] + Math.cos(ang) * dist, r2 * 0.80, c[1] + Math.sin(ang) * dist);
      b.rotation.y = rnd(ci + k, 34) * 3.14;
      b.castShadow = true; b.receiveShadow = true;
      campus.add(b);
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   ★★★ v16d 新增：**用场地实体打断草坪**（本轮找到的正解）
   ──────────────────────────────────────────────────────────────────
   为什么是这三样（而不是继续给草坪加纹理）：
     对照实验（exp-lawn-tex.cjs）已证：色块（+17% SD，代价是碎花布）与
     草叶线（SD 零贡献）都走不通。真病是**场地上没有别的东西**，
     不是草坪缺纹理。⇒ 正解 = 加**真实存在、语义正确、自带投影与轮廓**的实体。
   三样（按打断效果排序）：
     ① **沿路行道树阵列** —— 沿道路环规则列植（不是随机散布）。
        列植的**节奏感**是打破"均匀"最有效的手段：等距的树冠在天际线上
        形成重复的凸起，视线立刻有了标尺。
     ② **人行步道** —— 从道路环伸出 4 条放射步道 + 1 条环形步道。
        把"一整块绿"切成"人可以走进去的几个分区"，这是**功能性的分割**，
        比任何花纹都合理。
     ③ **分区绿化灌木带** —— 沿步道两侧的低矮灌木，强化分割线。
   三样都遵守既有约定：`receiveShadow`、投影真实、`userData.noFrame` 不进取景。
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var CYc = -4;                       /* 场地中心（对齐建筑群）*/
  var R_ROAD_IN = 38.0;               /* 道路环外沿 */
  var R_LAWN_IN = 34.0;               /* 道路环内沿 */
  var trunkMat = mat(0x6A5240, { rough: 0.95 });
  /* ★ v16g：树冠改用**顶点色多面体**（makeCrown），这两档绿只作备用 */
  var crownA = mat(0x42692C, { rough: 0.97 });
  var crownB = mat(0x527B39, { rough: 0.97 });
  /* ★ v16f：树池不用"亮白砖"（0xB2AEA6 在绿地上像棋盘格）
     ⇒ 深灰池边 + 更深的种植土，两件都压暗
     ★ v16g：0x8E8A80 仍然偏亮（放大看还是"白框"）⇒ 再压到 0x746F66 */
  var potMat = mat(0x746F66, { rough: 0.95 });
  var potSoil = mat(0x4A4034, { rough: 1.0 });

  /* ══════════════════════════════════════════════════════════════
     ★★★ v16g 新增：makeCrown() —— 树冠专用网格（本轮最大的观感突破）
     ──────────────────────────────────────────────────────────────
     问题（v16f 放大读图）：6 个球叠在一起还是"一颗光滑塑料球"。
     真因是**理想几何 + 均匀材质**：轮廓是精确圆弧、球面明度只有光照梯度。
     ✅ 两步修法（都在顶点层面）：
       ① **顶点抖动**：每个顶点沿自身法向随机推 ±JIT*R，
          球面变成起伏的不规则体 ⇒ 轮廓线有了"叶簇的凹凸"。
          ★ 抖动必须**按顶点位置做确定性噪声**（不能纯随机），
            否则同一个球在不同帧/不同实例会闪。
       ② **顶点色**：每个顶点在 4 档绿里按噪声取一色（vertexColors）。
          ⇒ 球面上出现"叶片明暗斑驳"，这是破塑料感的关键一步。
          ★ 必须 `flatShading` 吗？**不需要** —— 我们要的是"斑驳",
            不是"低多边形棱面"（那会变成"纸团"）。
     成本：SphereGeometry(13,9) ≈ 250 顶点 / 球，20 棵 × 6 球 = 120 球
        ⇒ 3 万顶点，可接受。
     ══════════════════════════════════════════════════════════════ */
  var CROWN_COLS = [0x3D6329, 0x4C7434, 0x5A8440, 0x6B944C];
  function makeCrown(R, squash, toneIdx, seed) {
    /* ★ v16h：分段数与半径挂钩 —— v16g 固定 13×9 对小球不够
       （抖动幅度按 R 比例，但顶点数不随 R 变 ⇒ 小球顶点太少、抖不出细节，
        放大看还是光滑球）。⇒ 小 R 用少分段（省），大 R 用多分段（够细节）。 */
    var seg = R >= 2.4 ? 14 : R >= 1.5 ? 12 : 10;
    var ring = R >= 2.4 ? 10 : R >= 1.5 ? 9 : 8;
    var g = new THREE.SphereGeometry(R, seg, ring);
    var pos = g.attributes.position;
    var nor = g.attributes.normal;
    var cols = [];
    var c = new THREE.Color();
    var V = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      V.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      /* ── ① 顶点抖动（沿法向推，幅度按球半径比例）── */
      var nz = (rnd(i * 13 + seed, 401) - 0.5) * 2;   /* −1 ~ 1 */
      var nz2 = (rnd(i * 17 + seed, 402) - 0.5) * 2;
      /* ★ v16h：幅度 0.155 → 0.175（v16g 读图：起伏还不够）*/
      var amp = R * 0.175;
      /* 抖动方向：法向 + 少量切向（纯法向会变成"刺球"）*/
      V.x += nor.getX(i) * nz * amp + nz2 * amp * 0.42;
      V.y += nor.getY(i) * nz2 * amp * 0.70 + nz * amp * 0.30;
      V.z += nor.getZ(i) * nz * amp * 0.85 + nz2 * amp * 0.38;
      /* 压扁 */
      V.y *= squash;
      pos.setXYZ(i, V.x, V.y, V.z);
      /* ── ② 顶点色（4 档绿里按噪声取）── */
      var ci = Math.floor(rnd(i * 23 + seed, 403) * 4);
      if (ci > 3) ci = 3;
      /* ★ 顶部略亮、底部略暗（模拟顶光穿透树冠，增强体积感）*/
      var up = (V.y / (R * squash) + 1) * 0.5;      /* 0~1 */
      var k2 = 0.68 + up * 0.50 + (rnd(i * 29 + seed, 404) - 0.5) * 0.38;
      c.setHex(CROWN_COLS[(ci + toneIdx) % 4]);
      cols.push(c.r * k2, c.g * k2, c.b * k2);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, crownVertMat);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.noFrame = true;
    return m;
  }
  /* 顶点色材质（全局共用一份 —— 20 棵树 120 个球都用它）*/
  var crownVertMat = new THREE.MeshLambertMaterial({
    vertexColors: true, side: THREE.FrontSide
  });

  /* ── ① 沿道路环外沿的行道树阵列（列植，等角距）──
     ★★★ v16e 尺寸修正（v16d 审计数据）：
       v16d 树冠半径 1.42m —— 在 149.7m 宽的视锥里只占 **1.9%（约 27px）**，
       加上"圆柱+球"的棒棒糖造型，俯视下读成"小圆点"，**完全不像行道树**。
       ⇒ 树冠 1.42 → **2.55**（+80%），树干 2.9 → **4.2**，树池 1.8 → 2.9。

     ★★★ v16f 造型重做（v16e 放大读图的四条结论）：
       ⓐ **"棒棒糖"（细杆 + 单球）太幼稚** —— 放大后是"手游农场"的味道。
          ⇒ 正解：**多球簇树冠**（1 大 + 3 中 + 2 小 = 6 个球），
            球之间位置错开、大小不一、用两档绿穿插 ⇒ 读成"叶簇"而非"球"。
       ⓑ **从俯视能看到树干**（圆柱杆明晃晃戳在草地上）。
          ⇒ 正解：树冠**下沿压到树干 2/3 高度以下**，
            俯视时树冠把树干完全吃掉（只从斜侧缝里露一点皮）。
       ⓒ **树池是"白色方块"**（0xB2AEA6 太亮，在绿地上像棋盘格）。
          ⇒ 正解：树池改**深一档的灰**（0x8E8A80）+ 内部一块更深的种植土
            （0x5A4E42），且**只有 0.10 厚**（不是一块砖）。
       ⓓ **阴影是硬边灰圆片**（像贴纸）。
          ⇒ 正解：树冠球用**略大一点的包围**让阴影边缘自然重叠，
            并在材质上把 roughness 调到 0.95（减少高光让球面不"塑料"）。 */
  var NTREE = 20;
  for (var i = 0; i < NTREE; i++) {
    var a = (i / NTREE) * Math.PI * 2 + 0.14;
    /* ★ 加一点位置抖动（±0.65m）—— 完全等距会读成"机器摆的" */
    var r = 42.0 + (rnd(i, 301) - 0.5) * 1.3;
    var tx = Math.cos(a) * r, tz = CYc + Math.sin(a) * r;
    var k = 0.90 + rnd(i, 302) * 0.22;    /* 高矮系数（0.90~1.12）*/
    var TH = 4.4 * k, CR = 2.60 * k;

    /* ── 树池：深灰窄边 + 深色种植土（★ 两件，都不是"白方块"）── */
    var potOut = box(2.9, 0.10, 2.9, potMat, tx, 0.05, tz);       /* 池边 */
    potOut.userData.noFrame = true;
    campus.add(potOut);
    var potIn = box(2.4, 0.12, 2.4, potSoil, tx, 0.062, tz);      /* 种植土 */
    potIn.userData.noFrame = true;
    campus.add(potIn);

    var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * k, 0.34 * k, TH, 8), trunkMat);
    tr.position.set(tx, TH / 2 + 0.08, tz);
    tr.castShadow = true; tr.receiveShadow = true;
    tr.userData.noFrame = true;
    campus.add(tr);

    /* ── 多球簇树冠（6 球：1 主 + 3 中 + 2 小）──
       ★ 布局原则：主球居中且最低（占体积），中球向三个方向外扩，
         小球补顶部与侧面的空缺 ⇒ 从各个角度看都是"一丛树冠"。
       ★★ 关键：所有球的**下沿都要低于 TH**，否则俯视看得到树干。
       ★★★ v16g 造型再重做（v16f 放大读图的致命问题）：
          v16f 的"6 个球"被完全抹平 —— 球与球的交界读不出来，
          结果还是"一颗光滑塑料球"。真因有三条，且都是**同一个病**：
            ① 轮廓是**精确圆弧**（理想球面）⇒ 没有叶簇的凹凸
            ② 明度在同一球面上**只有光照梯度**（没有叶片随机明暗）
            ③ 球与球**重叠太多**（CR*0.5~0.6 的位移 vs CR*0.6~0.94 的半径）
               ⇒ 小的完全被大的吞掉
          ✅ 三条对应修法（技术要点，可复用）：
            ⓐ **顶点抖动**：把 SphereGeometry 的每个顶点沿法向随机推
               ±0.16R ⇒ 轮廓变成不规则起伏（这一步观感提升最大）
            ⓑ **顶点色**：每个顶点在 4 档绿里按噪声取一色 ⇒
               球面上出现"叶片明暗斑驳"，彻底破掉塑料感
            ⓒ **拉开球间位移**：从 CR*0.5 拉到 CR*0.72~0.92 ⇒
               每个球的轮廓都能被看见（读成"一簇"而非"一颗"） */
    var CL = [
      /* [dx, dz, 半径系数, 压扁, 色调档] */
      [0.00, 0.00, 0.92, 0.72, 0],
      [CR * 0.78, CR * 0.42, 0.58, 0.82, 1],
      [-CR * 0.74, CR * 0.36, 0.56, 0.82, 0],
      [CR * 0.14, -CR * 0.80, 0.60, 0.82, 1],
      [-CR * 0.40, -CR * 0.46, 0.44, 0.88, 0],
      [CR * 0.44, -CR * 0.16, 0.40, 0.88, 1]
    ];
    CL.forEach(function (cd, ci) {
      var sph = makeCrown(CR * cd[2], cd[3], cd[4], i * 7 + ci);
      var yy = TH + CR * 0.30 + cd[1] * 0.9;
      sph.position.set(tx + cd[0], yy, tz + cd[1] * 0.55);
      campus.add(sph);
    });
  }

  /* ── ② 人行步道：4 条放射 + 1 条环形 ──
     ★★★ v16e 尺寸修正（v16d 审计：视锥半宽仅 74.8m）：
       v16d 把环形步道放在 r=62、放射步道伸到 63、灌木带在 65.6 ——
       **全部贴着画面边缘**，放射步道四条白线一路捅到画布外，非常刺眼。
       ⇒ 环形步道 62 → **47.5**，放射步道 38 → 47.5（收进画面内 36% 半径）。
         同时"草坪分区"的效果反而更清楚（分割线在画面内才看得见）。
     ★ 宽度 2.2m：在斜视下 ≈ 15px，够看出"这是一条路"，
       又不至于宽到把草坪切碎。 */
  var mWalk = mat(0x97938B, { rough: 0.94 });
  var mWalkEdge = mat(0x7E7A73, { rough: 0.95 });
  var R_RING = 47.5;                  /* ★ 环形步道中心半径 */

  /* 环形步道（把外圈草坪再切一刀）*/
  (function () {
    var g1 = new THREE.RingGeometry(R_RING - 1.1, R_RING + 1.1, 96, 1);
    var w1 = new THREE.Mesh(g1, mWalk);
    w1.rotation.x = -Math.PI / 2;
    w1.position.set(0, 0.030, CYc);
    w1.receiveShadow = true; w1.userData.noFrame = true;
    campus.add(w1);
    /* 两侧路缘（细环，深一档）*/
    [R_RING - 1.1, R_RING + 0.94].forEach(function (rr) {
      var g2 = new THREE.RingGeometry(rr, rr + 0.16, 96, 1);
      var w2 = new THREE.Mesh(g2, mWalkEdge);
      w2.rotation.x = -Math.PI / 2;
      w2.position.set(0, 0.032, CYc);
      w2.receiveShadow = true; w2.userData.noFrame = true;
      campus.add(w2);
    });
  })();

  /* 4 条放射步道（从道路环外沿 38 伸到环形步道边 48.6）*/
  for (var q = 0; q < 4; q++) {
    var qa = q * Math.PI / 2 + Math.PI / 4 + 0.10;   /* 对角方向，避开正面入口 */
    var r0 = R_ROAD_IN, r1 = R_RING + 1.1;
    var mid = (r0 + r1) / 2, len = r1 - r0;
    var gW = new THREE.PlaneGeometry(len, 2.2);
    var walk = new THREE.Mesh(gW, mWalk);
    walk.rotation.x = -Math.PI / 2;
    /* PlaneGeometry 建在局部 XY；rotation.x=−π/2 后：
       局部 +x → 世界 +x；局部 +y → 世界 −z
       故局部绕 z 旋转 → 世界绕 y 旋转（方向相反）*/
    walk.rotation.z = -qa;
    walk.position.set(Math.cos(qa) * mid, 0.030, CYc + Math.sin(qa) * mid);
    walk.receiveShadow = true; walk.userData.noFrame = true;
    campus.add(walk);
    /* 路缘两条 */
    [1.10, -1.10].forEach(function (off) {
      var gE = new THREE.PlaneGeometry(len, 0.16);
      var e = new THREE.Mesh(gE, mWalkEdge);
      e.rotation.x = -Math.PI / 2;
      e.rotation.z = -qa;
      /* 沿垂直方向偏移 off */
      var px = Math.cos(qa) * mid - Math.sin(qa) * off;
      var pz = CYc + Math.sin(qa) * mid + Math.cos(qa) * off;
      e.position.set(px, 0.032, pz);
      e.receiveShadow = true; e.userData.noFrame = true;
      campus.add(e);
    });
  }

  /* ── ③ 分区绿化灌木带：沿环形步道外侧，低矮灌木球 ──
     ★ 作用：把步道这条"线"加粗成"带"，分割感更强；
       同时灌木球自带投影，在草坪上留下成串的小阴影。
     ★★★ v16e 尺寸修正：v16d 用 0.62~1.00m 的球 —— 太小（≈15px），
       完全被树盖住看不见。⇒ 放大到 **1.05~1.55m**，并成簇（3 株一簇）。 */
  var mShrub = mat(0x3F6630, { rough: 0.95 });
  var mShrub2 = mat(0x4A7438, { rough: 0.95 });
  var NSH = 34;
  for (var s = 0; s < NSH; s++) {
    var sa2 = (s / NSH) * Math.PI * 2 + 0.08;
    /* ★ 每 3 株一簇，簇间留空（均匀散布会读成"项链珠"）*/
    var cl = Math.floor(s / 3), inCl = s % 3;
    if (cl % 3 === 2) continue;                  /* 每三簇空一组 */
    var sa3 = sa2 + (inCl - 1) * 0.035;
    var sr = R_RING + 3.6 + rnd(s, 311) * 1.4;
    var srr = 1.05 + rnd(s, 312) * 0.50;
    var sh = new THREE.Mesh(new THREE.SphereGeometry(srr, 11, 8),
                            (s % 2) ? mShrub : mShrub2);
    sh.scale.set(1, 0.72, 1);
    sh.position.set(Math.cos(sa3) * sr, srr * 0.70 + 0.02, CYc + Math.sin(sa3) * sr);
    sh.castShadow = true; sh.receiveShadow = true;
    sh.userData.noFrame = true;
    campus.add(sh);
  }
})();


(function () {
  var trunkMat = mat(0x6A5240, { rough: 0.95 });
  var crownMat = mat(0x4E7A34, { rough: 0.93 });
  var crownMat2 = mat(0x5E8C3E, { rough: 0.93 });   /* 上层略亮 */
  var potMat = mat(0xB6B2AA, { rough: 0.94 });

  /* 树位（世界 x, z） + 高矮系数 */
  var trees = [
    [-9.5, 4.0, 1.00], [-9.5, 7.6, 0.92], [-9.5, 11.2, 0.98],
    [9.5, 4.0, 0.95], [9.5, 7.6, 1.02], [9.5, 11.2, 0.90],
    [-2.5, 15.2, 1.05], [2.5, 15.2, 0.96],
    [-15.0, -10.0, 0.94], [15.0, -10.0, 1.00]
  ];
  trees.forEach(function (t, i) {
    var k = t[2];
    var TH = 2.6 * k;          /* 树干高 */
    var CR = 1.35 * k;         /* 树冠半径 */
    /* 方形树池 */
    var pot = box(1.7, 0.16, 1.7, potMat, t[0], 0.08, t[1]);
    pot.castShadow = false;
    /* 树干 */
    var tr = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * k, 0.18 * k, TH, 8), trunkMat);
    tr.position.set(t[0], TH / 2 + 0.10, t[1]);
    tr.castShadow = true; tr.receiveShadow = true;
    campus.add(tr);
    /* 树冠：下层大球压扁 + 上层小球，形成"分层树冠"（比单球更像树）*/
    var c1 = new THREE.Mesh(new THREE.SphereGeometry(CR, 14, 10), crownMat);
    c1.scale.set(1, 0.72, 1);
    c1.position.set(t[0], TH + CR * 0.52, t[1]);
    c1.castShadow = true; c1.receiveShadow = true;
    campus.add(c1);
    var c2 = new THREE.Mesh(new THREE.SphereGeometry(CR * 0.66, 12, 9), crownMat2);
    c2.scale.set(1, 0.78, 1);
    c2.position.set(t[0] + 0.12, TH + CR * 1.02, t[1] - 0.10);
    c2.castShadow = true; c2.receiveShadow = true;
    campus.add(c2);
  });
})();

/* ★★★ v16h：**删除** v15c 的「成簇草丛」（30 簇 × 9~16 撮 = 375 个锥体）
   ────────────────────────────────────────────────────────────────
   删除理由（diag-dots.cjs 审计 + 放大读图）：
     ① **尺寸根本不成立**：0.46r × 1.45h 的锥体，在 149.7m 宽的视锥里
        只有 **3~5px** —— 远看读成"草地上的苔藓点/噪点"，没有"草丛"语义。
        （v15c 四轮迭代都在调尺寸，但**从没量过它在屏幕上到底几个像素**
          —— 这是本条的教训：调尺寸前先算屏幕占比。）
     ② **位置压在路上**：半径延伸到 49.2，而环形步道在 r=47.5
        ⇒ 草丛长在路面上了。
     ③ **375 个额外网格 + 3000 三角形** 换来几乎为零的观感收益。
   ★ 用户要求"把一栋做到顶点"——**顶点的含义是去掉没用的东西，不是堆**。
     省下的预算全部给"看得见"的部件（行道树阵列 / 屋面 / 立面）。
   （代码留在 git 与 2026-09-25 日志，作为过程留痕。） */



/* ══════════════════════════════════════════════════════════════════
   ★ 组装 U 型围合（实拍：北楼 + 西楼 + 东楼 + 四处连廊）
   尺寸按实拍比例：北楼 26×12，西/东楼 12×20
   ══════════════════════════════════════════════════════════════════ */
var NORTH_W = 26, NORTH_D = 12;
var SIDE_W = 12, SIDE_D = 20;

/* 北楼（东西向，入口朝南 +Z）*/
var north = makeTower(NORTH_W, NORTH_D, {
  bays: 6, entry: true, entryDir: 0, name: '实验楼A', nameDir: 0,
  stair: [-8.5, 0], ac: true
});
north.position.set(0, 0, -13.0);
campus.add(north);

/* 西楼（南北向，入口朝东 +X 面向内院）*/
var west = makeTower(SIDE_W, SIDE_D, {
  bays: 4, entry: true, entryDir: 1, name: '实验楼B', nameDir: 1,
  stair: [0, 5.5], ac: true
});
west.position.set(-19.0, 0, 1.0);
campus.add(west);

/* 东楼 */
var east = makeTower(SIDE_W, SIDE_D, {
  bays: 4, entry: true, entryDir: 3, name: '实验楼C', nameDir: 3,
  stair: [0, 5.5], ac: true
});
east.position.set(19.0, 0, 1.0);
campus.add(east);

/* 连廊
   ★★★ v13 修正：v12 加了两根**横穿中庭**的长连廊 —— 实拍里根本没有！
     对照 q-court.png（中庭放大图）：中庭是**完全开放**的，
     连廊只出现在**楼与楼的转角外侧**（把相邻两栋在二层连起来）。
   ⇒ 只保留 4 根**转角短连廊**，全部位于 U 型外侧。 */
var BR_Y = FLOOR * 1.5 + 0.55;

/* ① 北楼西端 ↔ 西楼北端（转角外侧）*/
(function () {
  var gb = skyBridge(5.2, { w: 2.9, h: 3.1 });
  gb.position.set(-19.0, BR_Y, -6.5);
  campus.add(gb);
})();
/* ② 北楼东端 ↔ 东楼北端 */
(function () {
  var gb = skyBridge(5.2, { w: 2.9, h: 3.1 });
  gb.position.set(19.0, BR_Y, -6.5);
  campus.add(gb);
})();
/* ③ 西楼南端 ↔ 南楼（若在南侧还有楼）—— 实拍中庭南侧开口，只有一栋楼
      故这里改为把西/东楼与**南侧独立小楼**相连的位置留白，
      只在西楼南端做一小段"平台挑出"（实拍可见的悬挑平台）*/
[[-1], [1]].forEach(function (p) {
  var gb = skyBridge(3.2, { w: 2.6, h: 2.9 });
  gb.position.set(p[0] * 19.0, BR_Y, 12.2);
  campus.add(gb);
});

/* ══════════════════════════════════════════════════════════════════
   ★ 取景：按实际包围盒自动定正交视锥（组装完成后调用）
   ⚠️ 必须**排除 220×220 的地面** —— 否则地面主导包围盒，建筑缩成一点。
      做法：只把三栋楼 + 连廊 + 绿岛放进一个专门的 Group 里参与取景。
   ══════════════════════════════════════════════════════════════════ */
scene.updateMatrixWorld(true);
fitCameraTo([north, west, east, campus], 1.42, function (o) {
  /* 过滤：排除**场地层**（地面 220×220 平面、草地环、道路环、路缘石）
     ★ v15c：草地环（RingGeometry R62）会把包围盒撑到 124m 宽
       ⇒ 建筑缩成一点。取景必须只看**建筑 + 三栋 + 连廊 + 绿岛**。
     判据：① PlaneGeometry width>100（大地面）
           ② RingGeometry 一律排除（只有场地层用环）
           ③ userData.noFrame（草丛等散布装饰：数量多、铺得远，
              会把包围盒撑到 90m+ ⇒ 建筑缩成一点）*/
  if (o.userData && o.userData.noFrame) return false;
  if (o.isMesh && o.geometry) {
    var gt = o.geometry.type;
    if (gt === 'PlaneGeometry') {
      var p = o.geometry.parameters;
      if (p && p.width > 100) return false;
    }
    if (gt === 'RingGeometry') return false;
  }
  return true;
});

/* ══════════════════════════════════════════════════════════════════
   交互：点击弹跳
   ══════════════════════════════════════════════════════════════════ */
var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
var picked = null, towers = [north, west, east];

renderer.domElement.addEventListener('pointerdown', function (e) {
  ndc.x = (e.clientX / W) * 2 - 1;
  ndc.y = -(e.clientY / H) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  var hits = ray.intersectObjects(towers, true);
  if (!hits.length) return;
  var o = hits[0].object;
  while (o.parent && towers.indexOf(o) < 0) o = o.parent;
  if (towers.indexOf(o) < 0) return;
  if (o === picked) { o.position.y = 0; picked = null; return; }
  if (picked) picked.position.y = 0;
  picked = o;
});

/* ══════════════════════════════════════════════════════════════════
   主循环
   ══════════════════════════════════════════════════════════════════ */
var t0 = performance.now();
function loop() {
  requestAnimationFrame(loop);
  var t = (performance.now() - t0) / 1000;
  if (picked) picked.position.y = Math.abs(Math.sin(t * 4.0)) * 0.75;
  renderer.render(scene, camera);
}
loop();

window.addEventListener('resize', function () {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setSize(W, H);
  scene.updateMatrixWorld(true);
  fitCameraTo(campus, 1.42, function (o) {
    if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry') {
      var p = o.geometry.parameters;
      if (p && p.width > 100) return false;
    }
    return true;
  });
});

/* 供外部验证：三角形/拾取体统计 */
window.__stats = function () {
  var tri = 0, mesh = 0;
  scene.traverse(function (o) {
    if (o.isMesh) {
      mesh++;
      var g2 = o.geometry;
      if (g2.index) tri += g2.index.count / 3;
      else if (g2.attributes.position) tri += g2.attributes.position.count / 3;
    }
  });
  return { meshes: mesh, triangles: Math.round(tri) };
};
