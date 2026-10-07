/* ══════════════════════════════════════════════════════════════════════
   tower-08-batch-main.js —— 40 栋批量场景 + 逐栋取景接口（v22 新增）
   ──────────────────────────────────────────────────────────────────────
   目标（用户 2026-10-02 派活）：
     「把所有图都开做吧，做完之后再把每个建筑的图都要分开发我一份」

   ★ 架构决定（为什么不是"全摆在一个场景里截 40 次"）：
     全摆一起 ⇒ 场景跨约 400m ⇒ 8192 阴影贴图摊到 400m 上是
     **0.049 m/纹素**（比单栋时的 0.019 粗 2.6 倍）⇒ 阴影全部糊掉。
     ⇒ 正解：**一次只建一栋**（`buildOne`），阴影贴图始终贴合该栋，
       截完再换下一栋。同时也正好对应"每栋一张图"的交付形态。
     另有 `buildAll()` 只用于出一张总览索引图。

   ★ 与用户纪律的关系：本文件只做"建模 + 取景"，**不碰 campus-insight 主站**。
   ══════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   公寓色板隔离器（`tower-06` 里的 buildApartment 不能直接引 ——
   那个文件带顶层场景代码，引进来会污染批次场景）
   ★ 与 `withPalette` 同构：只覆盖传入的键，try/finally 保证还原。
   ══════════════════════════════════════════════════════════════════ */
function batWithAptPal(colorSet, fn) {
  var saved = {};
  for (var k in AC) saved[k] = AC[k];
  for (var k2 in colorSet) if (colorSet[k2] !== undefined) AC[k2] = colorSet[k2];
  try {
    return fn();
  } finally {
    for (var k3 in saved) AC[k3] = saved[k3];
  }
}

/* 公寓三档色调（11 栋共用，靠"暖度/深度"拉开差异，不靠换形制）
   ★ v21c 已验收的基准：墙 0xC87148 / 坡面 0x6E7A84 / 地面 0x7A6350
     —— 这三档都保持"冷屋面 + 暖墙面"的冷暖对比（§23.6 的结论）。 */
var BAT_APT_PAL = {
  /* 标准档（v21c 原值，作为主力）*/
  std: {
    wallLit: 0xC07A52, wallMid: 0xAC6A46, wallDark: 0x8E5436,
    wallPier: 0xB4744C, wallLow: 0x96603E,
    roofSlopeA: 0x2A5A98, roofSlopeB: 0x24467C,
    roofSeam: 0x22303E, roofSeamHi: 0x8CA2BC,
    roofUnder: 0x2E3A46, fascia: 0x344355,
    ridgeCap: 0x2A3A4E, ridgeHi: 0xA8BACC,
    gableWall: 0xA87A54, gableTrim: 0x6E5A42,
    solarPanel: 0x1A2430, solarTank: 0x7E868E,
    balSlab: 0xB08A64, balPanel: 0xAA7D58,
    balSide: 0x8E6248, balInner: 0x5E4030
  },
  /* 浅暖档（米黄砖，用于富梅苑等）*/
  sand: {
    wallLit: 0xCB9E6C, wallMid: 0xB48C5A, wallDark: 0x94724C,
    wallPier: 0xC29462, wallLow: 0x9E7C54,
    roofSlopeA: 0x2A5A98, roofSlopeB: 0x24467C,
    roofSeam: 0x22303E, roofSeamHi: 0x8CA2BC,
    roofUnder: 0x2E3A46, fascia: 0x344355,
    ridgeCap: 0x2A3A4E, ridgeHi: 0xA8BACC,
    gableWall: 0xB48E62, gableTrim: 0x6E5A42,
    solarPanel: 0x1A2430, solarTank: 0x7E868E,
    balSlab: 0xB48E68, balPanel: 0xAE8460,
    balSide: 0x92684C, balInner: 0x624434
  },
  /* 深砖档（更沉，用于 9/10 栋）*/
  deep: {
    wallLit: 0xAC6038, wallMid: 0x96512E, wallDark: 0x7A3E24,
    wallPier: 0xA25836, wallLow: 0x82462A,
    roofSlopeA: 0x24507F, roofSlopeB: 0x1E3E66,
    roofSeam: 0x1E2A36, roofSeamHi: 0x8298B0,
    roofUnder: 0x2A3640, fascia: 0x2E3C4C,
    ridgeCap: 0x243448, ridgeHi: 0xA0B2C4,
    gableWall: 0x9E6C4C, gableTrim: 0x6A4E38,
    solarPanel: 0x1A2430, solarTank: 0x7E868E,
    balSlab: 0xA47A54, balPanel: 0x9E7250,
    balSide: 0x82583C, balInner: 0x563A28
  }
};

/* ══════════════════════════════════════════════════════════════════
   40 栋清单（顺序 = 批次分组顺序，便于索引图阅读）
   ──────────────────────────────────────────────────────────────────
   字段：id / name / batch / 建造函数 builder()
   ══════════════════════════════════════════════════════════════════ */
var BAT_DEFS = [

  /* ═══ ① rect/wing ×6 —— 实验楼家族（砖红墙 + 冷蓝四坡顶）═══ */
  {
    id: 'lab-1', name: '实验楼一', batch: 'rect/wing',
    note: 'U 形三翼围合 · 砖红墙 + 冷蓝四坡顶 + 白色钢桁架连廊',
    build: function () {
      /* ★ 直接复用已验收的 v18 配置（三个 makeTower + 两根转角连廊）*/
      var g = new THREE.Group();
      var NW = 26, ND = 12, SW = 12, SD = 20, GAP = 19.0;
      var mk = function (W_, D_, opt) { return makeTower(W_, D_, opt); };
      var north = mk(NW, ND, {
        bays: 6, entry: true, entryDir: 0, name: '实验楼一', nameDir: 0,
        stair: [-8.5, 0], ac: true
      });
      north.position.set(0, 0, -13.0); g.add(north);
      var west = mk(SW, SD, {
        bays: 4, entry: true, entryDir: 1, name: '', nameDir: 1,
        stair: [0, 5.5], ac: true
      });
      west.position.set(-GAP, 0, 1.0); g.add(west);
      var east = mk(SW, SD, {
        bays: 4, entry: true, entryDir: 3, name: '', nameDir: 3,
        stair: [0, 5.5], ac: true
      });
      east.position.set(GAP, 0, 1.0); g.add(east);
      var BRY = 3.9 * 1.5 + 0.55;
      [-1, 1].forEach(function (s) {
        var gb = skyBridge(5.2, { w: 2.9, h: 3.1 });
        gb.position.set(s * GAP, BRY, -6.5); g.add(gb);
      });
      return g;
    }
  },
  {
    id: 'lab-2', name: '实验楼二', batch: 'rect/wing',
    note: '单体翼 · 同为砖红 + 蓝四坡顶，层数少一层作区分',
    build: function () {
      return makeTower(26, 12, {
        floors: 4, bays: 6, entry: true, entryDir: 0,
        name: '实验楼二', nameDir: 0, stair: [-8.5, 0], ac: true
      });
    }
  },
  {
    id: 'bldg-c1', name: '综合楼一', batch: 'rect/wing',
    note: '浅灰白墙 + 蓝檐带 · 偏"办公/科研"调子',
    build: function () {
      return withPalette(PAL.general, function () {
        return makeTower(30, 14, {
          floors: 5, bays: 7, entry: true, entryDir: 0,
          name: '综合楼一', nameDir: 0, stair: [-10.0, 0], ac: true
        });
      });
    }
  },
  {
    id: 'bldg-c2', name: '综合楼二', batch: 'rect/wing',
    note: '浅灰白墙 · 更高更窄（6 层），与综合楼一同族但不同比例',
    build: function () {
      return withPalette(PAL.general, function () {
        return makeTower(23, 13, {
          floors: 6, bays: 5, entry: true, entryDir: 0,
          name: '综合楼二', nameDir: 0, stair: [-7.0, 0], ac: true
        });
      });
    }
  },
  {
    id: 'teach-4', name: '教学楼四', batch: 'rect/wing',
    note: '米黄墙 + **平顶女儿墙**（与实验楼的四坡顶分家）',
    build: function () {
      return withPalette(PAL.academic, function () {
        return makeTower(28, 13, {
          floors: 6, bays: 6, entry: true, entryDir: 0,
          name: '教学楼四', nameDir: 0, stair: [-9.0, 0], ac: true,
          flatRoof: true,
          flatRoofOpts: {
            cSlab: 0x707074, cPar: 0xA29680, cCoping: 0xB2A68E,
            cEquip: 0x828890, cEquipD: 0x6A7078, parapetH: 0.95
          }
        });
      });
    }
  },
  {
    id: 'tuoxin', name: '拓新楼', batch: 'rect/wing',
    note: '米黄墙 + 平顶 · 体量最小（4 层），作为本批次的最矮项',
    build: function () {
      return withPalette(PAL.academic, function () {
        return makeTower(22, 12, {
          floors: 4, bays: 5, entry: true, entryDir: 0,
          name: '拓新楼', nameDir: 0, stair: [-6.0, 0], ac: true,
          flatRoof: true,
          flatRoofOpts: {
            cSlab: 0x707074, cPar: 0xA29680, cCoping: 0xB2A68E,
            cEquip: 0x828890, cEquipD: 0x6A7078, parapetH: 1.05
          }
        });
      });
    }
  },

  /* ═══ ② rect/core —— 学生公寓（**院落**，不是独立栋）═══════════════
     ★★★ 2026-10-02 用户纠正：「有的是连在一起的，它学生公寓**它不长这样**」。
     回查官方素材后确认形制应为 **L / U 形连体板楼**（推导见 tower-09 文件头）：
       · BUILDING-SPEC.md「C. 学生公寓」：平面 = 长条形板楼，多栋正交咬合成
         L / U 型；连廊 = 楼栋之间有横向连廊／过街楼连接
       · outdoor/27836784/27836783/27836786_d.jpg（1536² 航拍）：
         三栋正交咬合成凹字形，中间围出内院
       · .workbuddy-gen/cmp/plane1.png（官方总平面公示图）：
         左侧公寓群轮廓呈 L 形 / 凹字形
     ⇒ 出图单元从「11 栋独立板楼」改为「5 个院落」。

     ★ 分组依据 = SITES 网格坐标的**邻近关系**（逐条核对，不是随意合并）：
       · 8/7/6 栋：r=16/17/19，c 在 7~11 之间交错 ⇒ 三栋折线咬合 ⇒ U 形
       · 9/10 栋：r=9/11 相邻两行                  ⇒ 一对
       · 5 栋 + 富梅苑：同行 r=24，左右并列         ⇒ 一对
       · 4 栋 + 1 栋：  同行 r=29                  ⇒ 一对
       · 3 栋 + 2 栋：  同行 r=32                  ⇒ 一对 */
  { id: 'apt-c1', name: '学生公寓 8·7·6 栋', batch: 'rect/core', shape: 'U',
    note: 'U 形院落 · 三栋正交咬合 · 内院 + 二层连廊 · 7 层',
    pal: 'std', seed: 18, floors: 7, wingLen: 36.0, courtW: 22.0, roofDeg: 24, viewEl: 64,
    segNames: ['学生公寓 8 栋', '学生公寓 7 栋', '学生公寓 6 栋'] },
  { id: 'apt-c2', name: '学生公寓 9·10 栋', batch: 'rect/core', shape: 'II',
    note: '两栋平行院落 · 二层连廊跨院 · 6 层',
    pal: 'std', seed: 19, floors: 6, wingLen: 32.4, courtW: 21.0, roofDeg: 24, viewEl: 64,
    segNames: ['学生公寓 9 栋', '学生公寓 10 栋'],
    /* ★★ 10-06 修 bug：原定义**没有 build** ⇒ campus 里 4 栋公寓
       全是空 Group（探针实测 bbox 0×0、高 0.6）⇒ 用户看到"公寓少了"。
       根因：只有 apt-c1 接了 makeAptCluster，其余 4 条只留了元数据。 */
    build: function () {
      return makeAptCluster({ shape: 'II', wingLen: 32.4, courtW: 21.0, floors: 6,
        roofDeg: 24, pal: 'std', seed: 19,
        nameW: '学生公寓 9 栋', nameE: '学生公寓 10 栋' });
    } },
  { id: 'apt-c3', name: '学生公寓 5 栋 · 富梅苑', batch: 'rect/core', shape: 'II',
    note: '两栋平行院落 · 浅暖档（米黄砖）· 6 层',
    pal: 'sand', seed: 21, floors: 6, wingLen: 32.4, courtW: 21.0, roofDeg: 24, viewEl: 64,
    segNames: ['学生公寓 5 栋', '学生公寓富梅苑'],
    build: function () {
      return makeAptCluster({ shape: 'II', wingLen: 32.4, courtW: 21.0, floors: 6,
        roofDeg: 24, pal: 'sand', seed: 21,
        nameW: '学生公寓 5 栋', nameE: '学生公寓富梅苑' });
    } },
  { id: 'apt-c4', name: '学生公寓 4 栋 · 1 栋', batch: 'rect/core', shape: 'II',
    note: '两栋平行院落 · 标准档 · 6 层',
    pal: 'std', seed: 14, floors: 6, wingLen: 28.8, courtW: 19.0, roofDeg: 24, viewEl: 64,
    segNames: ['学生公寓 4 栋', '学生公寓 1 栋'],
    build: function () {
      return makeAptCluster({ shape: 'II', wingLen: 28.8, courtW: 19.0, floors: 6,
        roofDeg: 24, pal: 'std', seed: 14,
        nameW: '学生公寓 4 栋', nameE: '学生公寓 1 栋' });
    } },
  { id: 'apt-c5', name: '学生公寓 3 栋 · 2 栋', batch: 'rect/core', shape: 'II',
    note: '两栋平行院落 · 深砖档 · 5 层',
    pal: 'deep', seed: 13, floors: 5, wingLen: 32.4, courtW: 24.0, roofDeg: 24, viewEl: 64,
    segNames: ['学生公寓 3 栋', '学生公寓 2 栋'],
    build: function () {
      return makeAptCluster({ shape: 'II', wingLen: 32.4, courtW: 24.0, floors: 5,
        roofDeg: 24, pal: 'deep', seed: 13,
        nameW: '学生公寓 3 栋', nameE: '学生公寓 2 栋' });
    } },

  /* ═══ ③ U/tower ×3 —— 教学楼（米黄墙 + 平顶 + U 形内院）═══ */
  {
    id: 'teach-1', name: '教学楼一', batch: 'U/tower',
    note: 'U 形三翼 · 米黄墙 + 平顶女儿墙 · 6 层 · 内院圆坛',
    build: function () {
      return makeUComplex({
        NW: 30, ND: 13, SW: 13, SD: 22, floors: 6, gap: 15.5,
        palette: 'academic', nameA: '教学楼一'
      });
    }
  },
  {
    id: 'teach-2', name: '教学楼二', batch: 'U/tower',
    note: 'U 形三翼 · 同族，北翼更宽（内院更扁）',
    build: function () {
      return makeUComplex({
        NW: 34, ND: 13, SW: 13, SD: 21, floors: 6, gap: 16.5,
        palette: 'academic', nameA: '教学楼二'
      });
    }
  },
  {
    id: 'teach-3', name: '教学楼三', batch: 'U/tower',
    note: 'U 形三翼 · 同族，整体更紧凑（占地最小的教学楼）',
    build: function () {
      return makeUComplex({
        NW: 26, ND: 12, SW: 12, SD: 20, floors: 5, gap: 14.0,
        palette: 'academic', nameA: '教学楼三'
      });
    }
  },

  /* ═══ ④ round ×3 —— 三座亭 ═══ */
  {
    id: 'pav-bp', name: '抱璞亭', batch: 'round',
    note: '六柱圆亭 · 攒尖顶（青灰瓦）+ 宝顶 · 半径 2.8m',
    build: function () {
      return makePavilion(2.8, { name: '抱璞亭', cols: 6, colH: 3.30, cRoof: 0x232B35, cRoofD: 0x1A2028, cFin: 0xB8963E });
    }
  },
  {
    id: 'pav-yr', name: '迎日亭', batch: 'round',
    note: '六柱圆亭 · 同形制，顶色偏暖（黛褐）作区分',
    build: function () {
      return makePavilion(2.5, { name: '迎日亭', cols: 6, colH: 3.05, cRoof: 0x2A2118, cRoofD: 0x1E1710, cFin: 0xB08A3A });
    }
  },
  {
    id: 'pav-wy', name: '望月亭', batch: 'round',
    note: '六柱圆亭 · 稍小（半径 2.3m），顶色更冷（深青）',
    build: function () {
      return makePavilion(2.3, { name: '望月亭', cols: 6, colH: 2.90, cRoof: 0x1E262E, cRoofD: 0x151B22, cFin: 0xA89448 });
    }
  },

  /* ═══ ⑤ rect/hall ×2 —— 大跨单体 ═══ */
  {
    id: 'gym', name: '凌云体育馆', batch: 'rect/hall',
    note: '大跨拱壳屋顶（半圆筒壳）+ 高侧窗带 + 大台阶入口',
    build: function () {
      /* ★★★ v22c 修色（实测截图：整栋**一片浅灰、零对比**）
         真因：拱壳是**朝上的斜面**，受照抬升约 **+90**。
           v22b 的 cShell 0x8E96A0 ⇒ 渲染约 200 —— 和墙(约 205)几乎同色。
         ✅ 按 §14.3 反推：目标渲染 ≈ (110,118,128)（深灰蓝金属壳）
            ⇒ 材质 ≈ 目标 − 90 = (20,28,38)… 那太黑了，
            实际拱壳只有**顶部**吃满照度、两侧吃不满，取折中:
            材质 (60,68,78)=0x3C444E ⇒ 顶部渲染 ≈150、两侧 ≈110
            ⇒ 与浅灰墙(≈205)形成 **55~95 的明度差**，拱形立刻读得出来。 */
      return makeHall(42, 30, {
        name: '凌云体育馆', kind: 'gym', floors: 2, floorH: 5.4,
        cWall: 0xBCBAB4, cWallD: 0x9E9C96,
        cShell: 0x3C444E, cShellD: 0x2E353D
      });
    }
  },
  {
    id: 'canteen', name: '晴味堂', batch: 'rect/hall',
    note: '食堂 · 暖黄墙 + 大平顶 + **密集排气阵列**（厨房在下面的特征件）',
    build: function () {
      return makeHall(36, 24, {
        name: '晴味堂', kind: 'canteen', floors: 3, floorH: 4.0,
        cWall: 0xC8B489, cWallD: 0xAE9A72,
        cPar: 0x9A9080, cSlab: 0x707074
      });
    }
  },

  /* ═══ ⑥ rect/null ×15 ═══ */
  {
    id: 'lib', name: '图书馆', batch: 'rect/null',
    note: '暖浅砂墙 + 平顶 · 5 层 · 中庭（用大玻璃带表达）',
    build: function () {
      return withPalette(PAL.library, function () {
        return makeTower(30, 22, {
          floors: 5, bays: 5, entry: true, entryDir: 0,
          name: '图书馆', nameDir: 0, stair: [-10.0, 3.0], ac: true,
          flatRoof: true,
          flatRoofOpts: {
            cSlab: 0x6A6A6E, cPar: 0x9E927A, cCoping: 0xAEA288,
            cEquip: 0x7E848A, cEquipD: 0x666C72, parapetH: 0.95,
            stairBoxAt: [9.0, -4.0]
          }
        });
      });
    }
  },
  {
    id: 'cscenter', name: '计算机中心', batch: 'rect/null',
    note: '浅灰白墙 + 平顶 · 4 层 · 屋面有天线杆（feat=mast）',
    build: function () {
      var g = withPalette(PAL.general, function () {
        return makeTower(26, 18, {
          floors: 4, bays: 6, entry: true, entryDir: 0,
          name: '计算机中心', nameDir: 0, stair: [-8.0, 2.0], ac: true,
          flatRoof: true,
          flatRoofOpts: {
            cSlab: 0x6A6A6E, cPar: 0x9A9080, cCoping: 0xAAA08E,
            cEquip: 0x7E848A, cEquipD: 0x666C72, parapetH: 0.95
          }
        });
      });
      /* 天线杆：feat=mast —— 用一根 6m 高细杆 + 3 根横臂（零旋转）*/
      var mAst = mat(0x8A9096, { rough: 0.55, metal: 0.40 });
      var h0 = 4 * 3.9;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 6.6, 8), mAst);
      pole.position.set(8.5, h0 + 1.15 + 3.3, -5.0);
      pole.castShadow = true;
      g.add(pole);
      for (var i = 0; i < 3; i++) {
        g.add(box(2.0 - i * 0.4, 0.09, 0.09, mAst, 8.5, h0 + 1.15 + 4.2 + i * 0.85, -5.0));
      }
      return g;
    }
  },
  {
    /* ★★ 10-06 数据源收敛：这里原来硬编码 `makeCourtField(108, 66, ...)`
       （世界米），而 CAMP_PLACE 又写了 px100/py66、CAMP_TRACK 写 py74
       —— **同一个操场三份坐标**，改任何一处都不生效（探针实测中心仍在 100,66）。
       ✅ 正解：跑道**只以 CAMP_TRACK 为真源**，位置在 campTrack() 里用
       cx()/cz() 换算；这条记录改为 build-less 占位（campTrack 负责渲染），
          且从 CAMP_PLACE 移除，避免重复摆放。 */
    id: 'track', name: '腾龙田径运动场', batch: 'rect/null',
    note: '400m 环形跑道（贴图，规则图案）+ 内场草地 · 位置见 CAMP_TRACK（单一真源）'
  },
  {
    id: 'tennis-1', name: '凌云网球场', batch: 'rect/null',
    note: '标准网球场 24×11m · 围栏 + 4 灯柱',
    build: function () { return makeCourtField(24, 11, { kind: 'tennis', name: '网球场 · 贰号', cSurf: 0x35586E, cOut: 0x8E7A5A }); }
  },
  {
    id: 'tennis-2', name: '凌跃网球场', batch: 'rect/null',
    note: '同规格网球场 · 换场地面色（与凌云网球场区分）',
    build: function () { return makeCourtField(24, 11, { kind: 'tennis', name: '网球场 · 叁号', cSurf: 0x2E5E4E, cOut: 0x8E7A5A }); }
  },
  {
    id: 'bball', name: '篮球场', batch: 'rect/null',
    note: '标准篮球场 28×15m · 禁区/三分弧/中圈',
    build: function () { return makeCourtField(28, 15, { kind: 'basketball', name: '篮球场 · 肆号', cSurf: 0x3E6E48, cOut: 0x9C6A4E }); }
  },
  {
    id: 'badminton', name: '羽毛球场', batch: 'rect/null',
    note: '标准羽毛球场 13.4×6.1m · 场地最小',
    build: function () { return makeCourtField(13.4, 6.1, { kind: 'badminton', name: '羽毛球场 · 伍号', cSurf: 0x3E6E5A, cOut: 0x8E8272 }); }
  },
  /* 小吃街 ×6（用雨棚色相区分 —— 这是"一条街"与"一排仓库"的分界）
     ★★★ v22e：这里的 `cAwn` 全是**压暗过约 45%** 的值（不是"看着像粉橘"的那个原色）。
       原因：雨棚是**朝上的面**，受全照度抬升 **+90** ——
         若直接写 0xD07A62（粉橘），渲出来是 (208+90) 量级的**一块白板**。
       ⇒ 反推：`材质 ≈ 目标渲染 − 90`。所以源码里的 0x724336 才对应画面上的"粉橘"。
       ★ 这条与 §14.3「按眼睛选色 ⇒ 朝上的面必然发光」是同一条铁律。 */
  { id: 'st-milk', name: '小吃街·奶茶店', batch: 'rect/null', note: '鲜果奶茶 · 小铺 6×4.5m · 斜挑雨棚（暖砖）+ 招牌横带', stall: { kind: 'milktea', storeName: '鲜果奶茶', slogan: '鲜果现萃 · 冰爽一夏', no: '壹号', tick: '现做现卖 · 干净卫生', W: 6.0, D: 4.5, h: 4.0, cAwn: 0x724336 } },
  { id: 'st-fruit', name: '小吃街·水果捞', batch: 'rect/null', note: '水果捞 · 小铺 6×4.5m · 雨棚（青绿）', stall: { kind: 'fruit', storeName: '水果捞', slogan: '当季鲜果 · 随心搭配', no: '贰号', tick: '按份计价 · 可加酸奶', W: 6.0, D: 4.5, h: 4.0, cAwn: 0x345548 } },
  { id: 'st-bbq', name: '小吃街·烤串档', batch: 'rect/null', note: '烧烤串串 · 小铺 5.5×4.2m · 雨棚（赭红）', stall: { kind: 'bbq', storeName: '烧烤串串', slogan: '炭火现烤 · 麻辣鲜香', no: '叁号', tick: '现串现烤 · 微辣可选', W: 5.5, D: 4.2, h: 3.9, cAwn: 0x632B20 } },
  { id: 'st-fry', name: '小吃街·炸物铺', batch: 'rect/null', note: '炸物小铺 · 小铺 5.5×4.2m · 雨棚（橙黄）', stall: { kind: 'fry', storeName: '炸物小铺', slogan: '现炸酥脆 · 出锅即食', no: '肆号', tick: '新油现炸 · 每日更换', W: 5.5, D: 4.2, h: 3.9, cAwn: 0x775019 } },
  { id: 'st-noodle', name: '小吃街·面馆', batch: 'rect/null', note: '面馆 · 小铺 5.5×4.2m · 雨棚（暖棕）', stall: { kind: 'noodle', storeName: '面馆', slogan: '热汤现煮 · 手工面', no: '伍号', tick: '大碗足量 · 免费加面', W: 5.5, D: 4.2, h: 3.9, cAwn: 0x553A25 } },
  { id: 'st-stat', name: '小吃街·文具店', batch: 'rect/null', note: '文具店 · 小铺 5.0×4.0m · 雨棚（蓝灰）', stall: { kind: 'stationery', storeName: '文具店', slogan: '文具·打印·复印', no: '陆号', tick: '打印复印 · 证件照', W: 5.0, D: 4.0, h: 3.8, cAwn: 0x324355 } },
  { id: 'express', name: '快递驿站', batch: 'rect/null', note: '快递驿站 · 快递驿站 7×5.5m · 雨棚（灰）+ 更低的招牌', stall: { kind: 'express', storeName: '快递驿站', slogan: '取件 · 寄件 · 代收', no: '柒号', tick: '凭取件码取件', W: 7.0, D: 5.5, h: 4.4, cAwn: 0x45494B, cWall: 0xC6C2B8, cWallD: 0xAAA69C } },
  { id: 'market', name: '超市周边商业区', batch: 'rect/null', note: '便利店 · 临街商铺 12×5m · 长条体量 + 双开间招牌', stall: { kind: 'conv', storeName: '便利店', slogan: '日用百货 · 零食饮料', no: '捌号', tick: '营业时间 07-23', W: 12.0, D: 5.0, h: 4.6, cAwn: 0x4E3A2B, cWall: 0xD2C4A8 } }
];

/* 给公寓类型的条目补 build（避免在数组字面量里写 11 个重复函数）*/
(function () {
  BAT_DEFS.forEach(function (d) {
    /* ★★★ 学生公寓：走**组团**生成器（L/U 形连体 + 内院 + 连廊）。
       原来是直接 makeApartment 出一栋独立板楼 —— 形制不对（见定义处注释）。 */
    if (d.batch === 'rect/core' && d.shape && !d.build) {
      d.build = function () {
        var sn = d.segNames || [];
        return makeAptCluster({
          shape:   d.shape,
          pal:     BAT_APT_PAL[d.pal || 'std'],
          seed:    d.seed || 7,
          floors:  d.floors || 6,
          wingLen: d.wingLen,
          wingDep: d.wingDep,
          courtW:  d.courtW,
          roofDeg: d.roofDeg,
          nameW: sn[0] || '', nameE: sn[1] || '', nameS: sn[2] || ''
        });
      };
    }
    if (d.stall && !d.build) {
      d.build = function () { return makeStall(d.stall.W, d.stall.D, d.stall); };
    }
  });
})();

/* ══════════════════════════════════════════════════════════════════
   场景舞台 + 逐栋取景
   ══════════════════════════════════════════════════════════════════ */
var BAT_STAGE = new THREE.Group();
scene.add(BAT_STAGE);

/* ★★★ v22a：批量模式把阴影贴图 8192 → 4096。
   为什么**不影响画质**（这是一次换算，不是妥协）：
     单栋模式（tower.html）：阴影相机 ±78 ⇒ 跨 156m，贴图 8192
       ⇒ 纹素密度 = 156/8192 = **0.0190 m/纹素**
     批量模式（本文件）：`batFitShadow` 按该栋尺寸收拢
       36m 的楼 ⇒ R = (18+8)×1.5 = 39 ⇒ 跨 78m，贴图 4096
       ⇒ 纹素密度 = 78/4096 = **0.0190 m/纹素** —— **完全相等**
   而 40 栋要渲 40 次，4096² 比 8192² 少 4 倍的纹素 ⇒ 直接省 3/4 的阴影渲染时间。
   ⚠️ 改 mapSize 后必须显式 dispose 旧贴图，否则 three.js 不会重建。 */
sun.shadow.mapSize.set(4096, 4096);
if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }

/* 每栋脚下的一块小地台（避免"悬空"，也把视线锚住）
   ★★★ v22a 修正：v22 初版把地台写死成 30×30 ⇒ 探针里 40 栋的包围盒
     X/Z **全部是 46.5**（= 30×1.55），也就是说——
       · 亭（5.6m）套了一个 46.5m 的大台子（建筑缩成一点）
       · 田径场（108m）反而台子比它小（四周露出背景）
     真因：**地台尺寸没有跟建筑走**。
     ✅ 正解：地台按**该栋真实包围盒**算（1.55 倍），并打上 `noFrame`
        —— 这样取景 filter 能确定性地把它排除，
        不再依赖"PlaneGeometry 宽度 > 40"这种**会随建筑尺寸漂移**的判据
        （本项目的铁律：闸门/过滤器不能依赖会漂移的常量）。 */
function batPlatform(fpW, fpD) {
  var g = new THREE.Group();
  /* ★★★ v22d：外扩量改成「固定下限 + 30% 比例」，不再用单一倍率。
     真因（读图发现）：1.55 倍对**大场地**会留下过多空白 ——
       田径场 108×66 ⇒ 台子 167×102，画面里一半是空地，场地被"缩小"了。
     ✅ 正解：`外扩 = max(9m, 尺寸×0.30)`
       田径场 ⇒ 138×84（场地占画面 ~78%）✓
       小铺 6×4.5 ⇒ 15×13.5（小建筑也需要足够的"院子"）✓ */
  /* ★ v24：外扩量 30%/9m → **55%/14m**。
     起因（读图）：取景改成"瞄主体"之后，主体居中，
       而地台只外扩 30% ⇒ 画面四角露出背景（像"孤岛"）。
     55% 能保证在 margin 1.16 下地台铺满画面边缘。 */
  var pw = fpW + Math.max(14, fpW * 0.55);
  var pd = fpD + Math.max(14, fpD * 0.55);
  var cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  var c2 = cv.getContext('2d');
  c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, 128, 128);
  c2.strokeStyle = 'rgba(0,0,0,.085)'; c2.lineWidth = 1.4;
  for (var i = 0; i <= 4; i++) {
    var p = i * 32;
    c2.beginPath(); c2.moveTo(p, 0); c2.lineTo(p, 128); c2.stroke();
    c2.beginPath(); c2.moveTo(0, p); c2.lineTo(128, p); c2.stroke();
  }
  var t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  /* ★ 铺装格固定 6m 一格（不跟台子等比缩放 —— §17「缝宽用绝对值」）*/
  t.repeat.set(pw / 6, pd / 6);
  var pl = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), mat(0x9A9488, { tex: t, rough: 0.96 }));
  pl.rotation.x = -Math.PI / 2;
  /* ★★★ v22e：地台必须**下沉** 0.06m。
     真因（读图发现）：球场类建筑的"场地平面"也在 y=0 ⇒
       两个**共面的水平面**互相抢深度（z-fighting），
       篮球场的地面只剩中间一条碎块（实测截图），
       其余露出的是地台的网格贴图。
     ★ 这与本项目已归档的「闪烁真因 = 底面共面 + 水平重叠」是同一类，
       解法也一样：**拉开 y 间距**（正交相机 near=1/far=450 下，
       0.06m 对应深度缓冲约 2000 级，足够分辨）。
     ⚠️ 光靠"把场地抬到 +0.03"不够 —— 两侧都要让开才稳。 */
  pl.position.y = -0.06;
  pl.receiveShadow = true;
  pl.userData.noFrame = true;          /* ★ 确定性排除，不靠尺寸阈值 */
  g.add(pl);
  return g;
}

/* 停用默认的固定阴影相机范围 —— 改用**逐栋自适应**（见下）*/
function batFitShadow(radius) {
  /* ★ 变量名不用 `sc` —— 01-core 顶层已有 `var sc = sun.shadow.camera`，
     虽然这里是函数作用域不构成重名，但同名会让后来读代码的人误判。 */
  var shcam = sun.shadow.camera;
  var R = Math.max(24, radius * 1.5);
  shcam.left = -R; shcam.right = R; shcam.top = R; shcam.bottom = -R;
  shcam.near = 10; shcam.far = 420;
  shcam.updateProjectionMatrix();
}

/* ★★★ 模块级半径：`fitCameraTo` 的 `filter` 只用来排除装饰，
   但"排除"用的是 `userData.noFrame`。这里给舞台里的每栋楼
   统一打上标记，避免地面被算进包围盒（§「装饰物撑爆取景包围盒」）。*/
function batClear() {
  while (BAT_STAGE.children.length) {
    var c = BAT_STAGE.children.pop();
    BAT_STAGE.remove(c);
    c.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
    });
  }
}

/* 把一栋楼摆到原点、按它自己的包围盒取景。
   ★ v22a：返回**统计对象**（不再是字符串）—— 探针与截图脚本都要用，
     而且是"数值型"的，可以直接做断言（NaN / 退化 / 构件数）。
   ★ v22a：地台尺寸改为**先量建筑、再定台子**（见 batPlatform 的注释）。*/
function batBuildOne(idx) {
  var d = BAT_DEFS[idx];
  if (!d) return { error: 'no def ' + idx };
  batClear();
  var b = d.build();
  b.position.set(0, 0, 0);
  BAT_STAGE.add(b);
  scene.updateMatrixWorld(true);

  /* ① 先量建筑本身的包围盒（不含地台）*/
  var bb = new THREE.Box3().setFromObject(b);
  var sz = bb.getSize(new THREE.Vector3());
  var ctr = bb.getCenter(new THREE.Vector3());

  /* ② 再按它铺地台，并对齐到建筑中心 */
  var plat = batPlatform(sz.x, sz.z);
  plat.position.set(ctr.x, 0, ctr.z);
  BAT_STAGE.add(plat);

  /* ③ 构件数 + NaN 断言（"建了但没东西" / 形参错位都会在这里暴露）*/
  var meshes = 0, nanCount = 0;
  b.traverse(function (o) {
    if (!o.isMesh) return;
    meshes++;
    ['x', 'y', 'z'].forEach(function (k) {
      var v = o.position[k];
      if (typeof v !== 'number' || !isFinite(v)) nanCount++;
      var s = o.scale[k];
      if (typeof s !== 'number' || !isFinite(s)) nanCount++;
    });
  });

  /* ④ 取景：地台已打 noFrame ⇒ 只框建筑本体（判据确定，不随尺寸漂移）
     ★ v24：第 4 参 `aim` = **主体中心**。小铺这类"主体 + 门前外摆"的
       不对称构图，若按包围盒中心瞄，主体会被外摆拽到画面一角。
       瞄准主体（组原点上方 sz.y*0.46）、范围仍按全包围盒 ⇒ 主体居中且不裁外摆。 */
  var filter = function (o) {
    if (o.userData && o.userData.noFrame) return false;
    return true;
  };
  /* ★ v25：视线中心按**包围盒中心**取（原 sz.y*0.46 对小铺合适，
     对 22m 高的院落会把建筑压到画面下半部）。围合式建筑另有 `viewEl`。 */
  var aimY = (d.shape ? ctr.y * 0.94 : sz.y * 0.46);
  var vw = d.viewEl === undefined ? null : { el: Math.PI * d.viewEl / 180 };
  fitCameraTo([b], 1.05, filter, new THREE.Vector3(0, aimY, 0), vw);
  /* ⑤ 阴影相机按该栋尺寸收拢 ⇒ 纹素密度最大化 */
  batFitShadow(Math.max(sz.x, sz.z) * 0.5 + 8);

  var res = {
    i: idx, id: d.id, name: d.name, batch: d.batch,
    meshes: meshes,
    nan: nanCount,
    size: [+sz.x.toFixed(2), +sz.y.toFixed(2), +sz.z.toFixed(2)],
    height: +sz.y.toFixed(2)
  };
  BAT_LAST = res;
  return res;
}
var BAT_LAST = null;

/* 总览：全部按批次分行网格摆放（只用于出一张索引图）*/
function batBuildAll() {
  batClear();
  var COLS = 6, SPX = 62, SPZ = 58;
  var maxH = 0;
  BAT_DEFS.forEach(function (d, i) {
    var b = d.build();
    var col = i % COLS, row = Math.floor(i / COLS);
    b.position.set((col - (COLS - 1) / 2) * SPX, 0, (row - 3) * SPZ);
    b.traverse(function (o) { o.userData.noFrame2 = (o.isMesh && o.geometry &&
      o.geometry.type === 'PlaneGeometry'); });
    BAT_STAGE.add(b);
    maxH = Math.max(maxH, new THREE.Box3().setFromObject(b).max.y);
  });
  scene.updateMatrixWorld(true);
  fitCameraTo([BAT_STAGE], 1.10, function (o) {
    if (o.userData && o.userData.noFrame) return false;
    return true;
  });
  batFitShadow(200);
  return 'built all ' + BAT_DEFS.length;
}

function batBuildId(id) {
  for (var i = 0; i < BAT_DEFS.length; i++) {
    if (BAT_DEFS[i].id === id) return batBuildOne(i);
  }
  return { error: 'no id ' + id };
}

/* ── 渲染循环（覆盖 core 里的那个：core 的 loop 已被本文件前的 parts 启动过，
      这里改成"只在需要时渲染"，避免截图时读到中间帧）───────────────── */
/* ══════════════════════════════════════════════════════════════════
   渲染循环
   ──────────────────────────────────────────────────────────────────
   ★★★ v22b 必须在本文件里补一个 —— 这是"抽取式拼装"引入的**真 bug**：
     `loop()` 原本定义在 `tower-04-assembly.js` 的**场景段**
     （`var campus = new THREE.Group()` 之后），
     而 `build-batch.py` 只抽取 `makeTower` ~ `skyBridge` 那一段
     ⇒ **批次页里没有任何 `renderer.render()` 调用**。

     症状（实测）：截图**全是天空蓝**，PNG 只有 **5KB**。
     ★★ 最直接的判据是**文件体积**：1410×865 的单色图压缩后就是 5KB 量级，
       正常建筑图是 200~500KB。**"体积异常小"比看图更快、更客观。**
       （已把这条写进 `batch-shot.cjs` 作为常驻断言。）

     ★ 教训（与"闸门不能依赖会漂移的常量"同源）：
       **按函数边界抽取时，必须同时确认"被抽走的段里有没有副作用"**
       —— 这里被抽走的是渲染循环、场景装配、和 `window.__APT` 导出。
   ══════════════════════════════════════════════════════════════════ */
var BAT_RENDER_COUNT = 0;
function batLoop() {
  requestAnimationFrame(batLoop);
  renderer.render(scene, camera);
  BAT_RENDER_COUNT++;
}
batLoop();

window.__BATCH = {
  count: BAT_DEFS.length,
  index: BAT_DEFS.map(function (d) {
    return { i: BAT_DEFS.indexOf(d), id: d.id, name: d.name, batch: d.batch, note: d.note };
  }),
  buildOne: batBuildOne,
  buildId: batBuildId,
  buildAll: batBuildAll,
  last: function () { return BAT_LAST; },
  /* ★ 把舞台根节点暴露出去 —— 探针要按"带贴图的 mesh"找文字/招牌，
     没有这个入口就只能在场景里瞎猜根节点（v23 踩过）。 */
  stage: function () { return BAT_STAGE; },
  /* ★ 渲染计数：截图脚本用它确认"页面真的在渲染"（v22b 的 bug 防线）*/
  renders: function () { return BAT_RENDER_COUNT; },
  /* 诊断：当前舞台的包围盒 / 相机取景 */
  info: function () {
    var bb = new THREE.Box3().setFromObject(BAT_STAGE);
    return {
      stageChildren: BAT_STAGE.children.length,
      bbox: bb.isEmpty() ? null : {
        min: bb.min.toArray(), max: bb.max.toArray()
      },
      cam: {
        left: camera.left, right: camera.right,
        top: camera.top, bottom: camera.bottom,
        pos: camera.position.toArray()
      }
    };
  }
};
