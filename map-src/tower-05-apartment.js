/* ══════════════════════════════════════════════════════════════════════
   ★★★ tower-05-apartment.js —— 学生公寓原型（v19 新增）
   ──────────────────────────────────────────────────────────────────────
   依据：map-assets/official-360/outdoor/27836784_d.jpg（4× 放大精读）
         + 27837109_d.jpg（侧面实例）
   ★ 用户口径（2026-09-29）：「**不用真实还原，只要长得差不多、并且好看就行了，
     主要是好看**」⇒ 不再纠结"层高 3.2m 还是 3.0m"这类数字准确，
     参数按**审美与剪影关系**定；形制特征（可辨识度）必须保留。

   ★★★ 实拍精读得到的**六条公寓硬特征**（逐条对应代码）：
     ① **平顶 + 深蓝屋面**（不是坡顶！）—— 4× 放大图确认：
        大面积是深蓝卷材屋面（#2C3C5D，明度仅 59）
     ② **屋面成排设备箱**（浅蓝方箱 + 白顶，明度 ~180）—— 最强"俯视辨识点"
     ③ **屋面分格缝**（田字形）
     ④ **横向带窗**：每层一条连续玻璃带 + 白色横档分 2 档
     ⑤ **外挑阳台**：浅色栏板 + **深棕侧墙**（#775C4B，明度 96）
        —— 侧墙的深色是立体感来源，不能省
     ⑥ **墙面**：#A38261（明度 134）—— **土黄卡其，比实验楼砖红暗**

   ★ 与实验楼（v18）的**工艺复用**（关键杠杆）：
     makeBrickTex / mat / box / faceBox / acUnits /
     光照三灯 / fitCameraTo 取景 —— 全部沿用，只换几何骨架与色板。
   ══════════════════════════════════════════════════════════════════════ */

/* ── 公寓参数（审美定档，非实测）───────────────────────────────────── */
var APT_FLOOR  = 3.25;     /* 层高：宿舍取 3.25m（规范 3.0~3.3 的中位）*/
var APT_NFLOOR = 6;
var APT_FL     = APT_NFLOOR * APT_FLOOR;   /* 19.5m —— 与实验楼齐高 */
var APT_BAY    = 3.6;      /* 开间：宿舍 3.6m */

/* ★★★ v20 修正：JS **没有** `Math.radians`（那是 Python/GLSL 的）
   ⇒ 误用会让 `Math.tan(undefined) = NaN`，整个屋顶坐标变 NaN ⇒ 模型消失。
   本文件统一改用这个显式换算，禁止直接手写 `Math.PI*x/180` 之外的写法。 */
function RAD(deg) { return deg * Math.PI / 180; }

/* ── 公寓专用色板（AC）── 与实验楼 C 并列，互不干扰 ──────────────────
   ★ 定色方法沿用 v17d 那条铁律：**先定目标渲染值，再减掉光照抬升量**。
     · 立面（竖直面）：传递率 ≈0.67，抬升 ≈ +43
     · 屋面（朝上面）：抬升 ≈ +90
   ★ 但本文件的两个调色方案（Plan-A / Plan-B）由 tower-06-plan 覆盖，
     这里给的是 **Plan-A（与实验楼统一调子）** 的基色。 */
var AC = {
  wallLit:   0xB3936E,
  wallMid:   0xA3855F,
  wallDark:  0x846B4C,
  wallPier:  0xA78A64,
  wallLow:   0x8C7355,

  roofFlat:  0x161C26,   /* 平屋面板（目标渲染 ≈100）*/
  roofFlat2: 0x111621,

  /* ★★★ v23 屋面改「中钢蓝」（依据官方参照图，见下）
     ──────────────────────────────────────────────────────────────
     依据：`map-assets/official-360/overview.jpg` 的「宿舍楼 2」实拍 ——
       屋面是**明确的中钢蓝金属**（不是暖灰，也不是 v21c 那种"冷青灰"），
       而且**屋面占画面比例极大**（大出檐 + 双坡 ⇒ 俯视时屋面就是主体）。
     定色用 v17d 铁律的实测版本（对**无贴图的坡面**验证过的线性关系）：
       实测 材质(110,122,132) → 渲染(178,186,191)
       ⇒ **渲染 ≈ 255 − 0.528 × (255 − 材质)**（三个通道的系数一致，可信）
       ⇒ 反推 **材质 = 255 − (255 − 目标) ÷ 0.528**
     目标：南坡受光渲染 ≈ (150,168,190)（中钢蓝）
       ⇒ 材质 = (255−105/0.528, 255−87/0.528, 255−65/0.528) = (56,90,132)
               = **0x385A84** */
  roofSlopeA: 0x385A84,   /* 南坡（受光）中钢蓝 */
  roofSlopeB: 0x24405E,   /* 北坡（背光）深钢蓝 */
  roofSeam:   0x22303E,   /* 屋面分缝/压缝 深 */
  roofSeamHi: 0x8CA2BC,   /* 屋面瓦带（亮条，形成横向韵律）*/
  roofUnder:  0x2E3A46,   /* 屋面下表面/滴水 深 */
  fascia:     0x344355,   /* 檐口封檐带（★ 规范：「深蓝灰檐口带」——
                             竖向面抬升 ≈ +43 ⇒ 目标渲染 ≈(95,110,128)）
                             v22 的 0x565046 是**暖灰**，与蓝屋面不同族，已改掉。*/
  ridgeCap:   0x2A3A4E,   /* 正脊压条（同蓝族、更深）*/
  ridgeHi:    0xA8BACC,   /* 脊顶高光线 */
  gableWall:  0xA3855F,   /* 山墙（同墙色，读作"墙延伸到山尖"）*/
  gableTrim:  0x6E5A42,   /* 山墙斜边装饰线 */
  winGlass:   0x2A3038,   /* 老虎窗玻璃 */
  winFrame:   0xE4E0D8,   /* 老虎窗窗套（只做 3 边，控面积）*/

  /* ★★★ v23 新增：屋面**太阳能热水器**（规范「大量太阳能热水器阵（深色格栅，成排）」）
     集热板：近黑蓝 —— 目标渲染 ≈70（是屋面上最暗的实体，形成"格栅"的读感）
     水箱：  亮银灰 —— 与深色板形成**强明度对比**，一眼看出"这是设备不是屋面色块" */
  solarPanel: 0x1A2430,
  solarTank:  0x7E868E,

  equBox:    0x5E6670,
  equTop:    0x606872,
  equEdge:   0x8890A0,

  balSlab:   0x9E8768,
  balPanel:  0xC2B79E,
  balSide:   0x7A5E42,   /* ★★ 阳台侧墙（深棕）—— 立体感来源 */
  balInner:  0x60482F,

  /* ★★★ v20f 新增：**公寓自己的窗分格件色**
     ──────────────────────────────────────────────────────────────
     起因（探针实测）：公寓窗横档/竖梃原本直接引用实验楼的
     `M.frameD = 0x8E887E`（中性灰），探针统计 **486 个 mesh** 全是它。
     两个问题：
       ① 「中性灰」不属于公寓的暖色族 ⇒ 与砖红墙不协调；
       ② 它与我新定的坡面色 `0x8E887C` **只差 2 个最低位**（巧合）
          ⇒ 屋面与窗分格会被读成同一种材料。
     ✅ 正解：公寓自己定义暖棕系深分格色，不再借用实验楼的材质。 */
  winBar:    0x6E5A46,   /* 窗横档（暖深棕）*/
  winMull:   0x5A4838,   /* 窗竖梃（更深的暖棕）*/

  parapet:   0x2A3038,
  coping:    0x1C222A
};

/* ══════════════════════════════════════════════════════════════════
   aptBandWindow —— 横向连续带窗（特征④）
   ──────────────────────────────────────────────────────────────────
   ★ 与实验楼的 aWindow（独立扁窗）**不同**：公寓实拍是**每层一条连续带窗**，
     被砖墙垛分段，且每条带内**白色横档分 2 档**。
   参数：
     bandW  带窗总长（本开间内）
     yC     带窗中心高度
     bandH  带窗净高
   ══════════════════════════════════════════════════════════════════ */
function aptBandWindow(parent, dir, halfW, halfD, u, yC, bandW, bandH) {
  /* ★★★ v19c 修正：白色构件从 4 根降到 **2 根**（原 830 个 mesh 的元凶）
     ──────────────────────────────────────────────────────────────
     证据（probe 统计 Plan-A）：M.frame 材质 mesh = **830 个**，占全部 1397 的 60%。
     ⇒ 立面被读成"白色格栅楼"，墙与窗都被白框吃掉。
     真因：每个窗带画了「1 横档 + 2 竖梃 + 上下窗套 ×2 横条」= 5 个白件，
           10 开间 × 5 层 × 3 面 ≈ 750 个，加上腰线等 = 830。
     ✅ 正解：白件只保留**上下窗套**（2 个），横档与竖梃改用**深色**（M.frameD）
        —— 深色构件在浅色窗玻璃上仍是明确的"分格线"，
        但不占"白色面积"，立面的**墙面占比**立刻回升。 */
  var GLASS_V = 0.008;
  /* ① 玻璃（连续一条）*/
  faceBox(parent, dir, halfW, halfD, u, yC, GLASS_V, bandW, bandH, 0.045, M.win);
  /* ② 横档：**深色**（把带窗分 2 档，但不用白色）*/
  faceBox(parent, dir, halfW, halfD, u, yC, GLASS_V + 0.016,
          bandW, 0.05, 0.030, mat(AC.winBar, { rough: 0.70 }));
  /* ③ 两端竖梃：**深色** */
  [-1, 1].forEach(function (k) {
    faceBox(parent, dir, halfW, halfD, u + k * (bandW / 2 - 0.028),
            yC, GLASS_V + 0.016, 0.055, bandH, 0.030, mat(AC.winMull, { rough: 0.72 }));
  });
  /* ④ 上下窗套（浅色收边，让带窗"嵌"进墙里）—— 只留这 2 个白件 */
  faceBox(parent, dir, halfW, halfD, u, yC + bandH / 2 + 0.038, 0.028,
          bandW + 0.10, 0.075, 0.038, M.frame);
  faceBox(parent, dir, halfW, halfD, u, yC - bandH / 2 - 0.038, 0.028,
          bandW + 0.10, 0.075, 0.038, M.frame);
}

/* ══════════════════════════════════════════════════════════════════
   aptFacade —— 公寓整面墙（多层带窗 + 层间腰线 + 勒脚）
   ══════════════════════════════════════════════════════════════════ */
function aptFacade(parent, dir, halfW, halfD, len, nf, o) {
  o = o || {};
  var bays  = o.bays || Math.max(2, Math.round(len / APT_BAY));
  var bw    = len / bays;
  var bandH = o.bandH === undefined ? 1.60 : o.bandH;   /* 带窗净高 1.6m */
  var balc  = o.balconyFloors || null;   /* ★ 有阳台的楼层（这些层不画外圈带窗）*/

  for (var f = 0; f < nf; f++) {
    var yBase = f * APT_FLOOR;
    /* 带窗中心：窗下留墙 0.90m（首层 1.35m 抬高）*/
    var yC = yBase + (f === 0 ? 1.35 : 0.90) + bandH / 2;
    /* ★★ 有阳台的层：带窗**退到阳台内侧**（不画在最外面的墙面）
       否则阳台栏板与带窗在同一平面高度重叠 ⇒ 阳台被窗套盖住看不见。 */
    var hasBal = balc && balc.indexOf(f) >= 0;

    for (var b = 0; b < bays; b++) {
      if (o.skip && o.skip.indexOf(b) >= 0) continue;
      var uC = -len / 2 + (b + 0.5) * bw;
      var wW = bw * 0.72;
      if (hasBal) {
        /* 阳台层：只在阳台栏板**后面**留一段矮带窗（露一点玻璃给"门"的读感）
           —— 真正的阳台构件由 aptBalcony 叠加在外侧 */
        aptBandWindow(parent, dir, halfW, halfD, uC,
                      yC - 0.10, wW * 0.82, bandH * 0.62);
      } else {
        aptBandWindow(parent, dir, halfW, halfD, uC, yC, wW, bandH);
      }
    }

    /* 层间腰线（薄挑口，分层读数）—— 有阳台的层不加（栏杆会挡住）*/
    if (f > 0 && !hasBal) {
      faceBox(parent, dir, halfW, halfD, 0, yBase - 0.10, 0.060,
              len - 0.12, 0.10, 0.14, M.sill);
      faceBox(parent, dir, halfW, halfD, 0, yBase - 0.175, 0.026,
              len - 0.20, 0.05, 0.08, mat(AC.winBar, { rough: 0.70 }));
    }
  }
  /* 勒脚（基座，深一档）*/
  faceBox(parent, dir, halfW, halfD, 0, 0.30, 0.045, len - 0.04, 0.60, 0.10, M.sill);
}

/* ══════════════════════════════════════════════════════════════════
   aptBalcony —— 外挑阳台（特征⑤）★ 公寓最关键的立面构件
   ──────────────────────────────────────────────────────────────────
   ★ 实拍读数（27836784 4× 放大）：
     · 阳台**外挑明显**，进深约占楼深 40%
     · 栏板是**浅色实体板**（明度 ~200）
     · **侧墙是深棕**（#775C4B，明度 96）—— 这个深色对比是全楼立体感的来源
     · 阳台内侧有明显阴影（读作"凹进去"）
   ══════════════════════════════════════════════════════════════════ */
function aptBalcony(parent, dir, halfW, halfD, u, yC, w, out) {
  /* ★★★ v19c 关键修复：「阳台构件数 = 0」的真因
     ──────────────────────────────────────────────────────────────
     症状：aptBalcony 手工调用产出 7 个 mesh、位置尺寸全对，
           但探针统计"阳台材质构件数 = 0"，屏幕上阳台完全不见。
     真因：faceBox(parent, ..., material) 要的是**Material 实例**，
           而我一直传的是 AC.balSide 这类**十六进制数字**（如 0x6A5240）。
           `new THREE.Mesh(geo, 0x6A5240)` **不报错**（three.js 静默接受），
           但材质无效 ⇒ 该 mesh 不可见 ⇒ 等于没画。
     ★ 为什么实验楼从没暴露：v18 的调用方全部传 M.sill / M.frame 这类
       **已实例化**的材质，从没传过裸数字 ⇒ 这个坑藏了很久。
     ✅ 修法：本函数内部把色板数字**显式转材质**（走 mat()，带正确 rough/metal）。*/
  var mSlab  = mat(AC.balSlab,  { rough: 0.90 });
  var mPanel = mat(AC.balPanel, { rough: 0.86 });
  var mSide  = mat(AC.balSide,  { rough: 0.88 });
  var mInner = mat(AC.balInner, { rough: 0.94 });

  var slabT = 0.18;       /* 底板厚 */
  /* ★★★ v19b 关键修正：栏板从 1.05m 加到 **1.45m**
     ──────────────────────────────────────────────────────────────
     量化证据（apt-v19-b.png 实测）：屏幕换算 7.72 px/m
       · 栏板 1.05m × 俯角压缩 0.6 ⇒ **4.9 px** —— 低于"6px 可见阈值"，
         读作一条模糊的横边，这就是"阳台看不见"的真因之一。
       · 加高到 1.45m ⇒ 6.7px，越过阈值；再加**栏板厚度**到 0.16 与
         **顶部压顶**，才有明确的"栏板"读感。
     ★ 判据依据：本项目"<6px = 噪点"铁律（v15c 草丛那条的推广）。 */
  var railH = 1.45;
  var railT = 0.16;
  /* ① 底板（外挑）—— v = out/2 让板中心落在墙面外 out/2 处 */
  faceBox(parent, dir, halfW, halfD, u, yC, out * 0.5, w, slabT, out, mSlab);
  /* ② 前端栏板（加大加厚）*/
  faceBox(parent, dir, halfW, halfD, u, yC + slabT / 2 + railH / 2,
          out + railT * 0.5, w, railH, railT, mPanel);
  /* ③ ★★ 两侧深棕侧墙（立体感核心）—— 侧墙比栏板略高，形成"包围感" */
  [-1, 1].forEach(function (k) {
    faceBox(parent, dir, halfW, halfD, u + k * (w / 2 - 0.08),
            yC + slabT / 2 + railH / 2 + 0.06, out * 0.5, 0.16, railH + 0.12, out,
            mSide);
  });
  /* ④ ★★ 阳台内侧深色凹槽（读作"凹进去的空间"）——
        这是让阳台**脱离墙面**的最强手段：一道纵向深色带 */
  faceBox(parent, dir, halfW, halfD, u, yC + 0.45,
          out * 0.22, w - 0.24, railH * 0.82, out * 0.44, mInner);
  /* ⑤ 底板下沿的阴影线（让阳台"浮"起来）*/
  faceBox(parent, dir, halfW, halfD, u, yC - slabT / 2 - 0.055,
          out * 0.5, w - 0.06, 0.11, out - 0.04, mInner);
  /* ⑥ 栏板顶面压顶（浅色细线，收头）*/
  faceBox(parent, dir, halfW, halfD, u, yC + slabT / 2 + railH + 0.035,
          out + railT * 0.5 + 0.02, w + 0.05, 0.07, railT + 0.06, M.frame);
}

/* ══════════════════════════════════════════════════════════════════
   ★★★ aptGableRoof —— 公寓双坡屋顶（v20 新增，B 方向深挖的产物）
   ──────────────────────────────────────────────────────────────────
   ★ 用户 2026-09-29 拍板：**B 方向 —— 坡顶做公寓特色**。
     前一轮 Plan-B 直接复用实验楼 `hipRoof` ⇒ 用户看后判定"是实验楼的
     复制品"。本函数的作用就是**与实验楼在六个维度上拉开**：

   ┌──────────┬──────────────────┬──────────────────────┐
   │ 维度      │ 实验楼 v18        │ 公寓 v20（本函数）    │
   ├──────────┼──────────────────┼──────────────────────┤
   │ 形制      │ 四坡庑殿 hip      │ ★ **双坡 gable**      │
   │ 坡度      │ 27.5°            │ 33°（更陡、更挺）      │
   │ 正脊      │ 短脊 34%         │ ★ **全程脊 100%**      │
   │ 屋面      │ 锁边竖棱金属      │ ★ 横向大分缝 + 素色    │
   │ 檐下      │ 回字带 + 挑檐线脚 │ ★ 仅一道封檐板         │
   │ 山墙      │ 无               │ ★ 三角山墙 + 装饰线    │
   │ 老虎窗    │ 无               │ ★★ **2 个**（最强辨识）│
   └──────────┴──────────────────┴──────────────────────┘

   ★★ 为什么"双坡"是最强的差异化手段（量化依据）：
     · 四坡顶在俯视下读作"一个躺倒的梯形/六边形"，正脊只有 34% 长；
     · 双坡顶读作"**一道贯穿到底的长脊 + 两片大坡面**" —— 45° 俯视时
       这条长脊就是最强的一条横向构图线，与实验楼的短脊完全不同。
     · 再叠加两个老虎窗，屋面立刻有"节奏"，**治好 Plan-A "像灰板"的病**。

   ★★★ 尺度校验（本项目 7.722 px/m，阈值 6px，见技能 §17）：
     屋脊升高 4.32m = **33px**  ✅（实验楼才 27px）
     坡面斜长 7.93m = **61px**  ✅ 主要视觉面
     出檐 0.90m    = **6.9px**  ✅ 刚过阈值，必须做
     ⇒ 相对 Plan-A 平顶（屋面几乎零竖向信息），本方案多出 61px 的斜向
        受光面 —— 这就是"好看"的物理来源。

   ★★★ 老虎窗必须坐落在**真实坡面**上（v15 踩过的坑）：
     严禁"手工插值猜高度" ⇒ 本函数内部用 `gableY(z)` 这个**单一真源**
     求坡面高度，老虎窗、正脊、山墙全部走它。
   ══════════════════════════════════════════════════════════════════ */
function aptGableRoof(W, D, topY, o) {
  o = o || {};
  var ang   = o.ang  === undefined ? RAD(33) : o.ang;
  var E     = o.eave === undefined ? 0.90 : o.eave;      /* 出檐（与实验楼同级但形式不同）*/
  var thick = 0.26;                                       /* 屋面板厚 */

  var HALF_D = D / 2 + E;          /* 含出檐的半跨 */
  var RISE   = HALF_D * Math.tan(ang);

  /* ★ 单一真源：坡面上任意 z 处的屋面高度（相对 topY）。
     双坡的特点：**只随 z 变化，与 x 无关** ⇒ 老虎窗沿 x 挪动高度不变。 */
  function gableY(z) { return RISE - Math.abs(z) * Math.tan(ang); }

  var g2 = new THREE.Group();
  g2.position.y = topY;

  var mRoofA  = mat(o.cRoofLit  || AC.roofSlopeA, { rough: 0.80, metal: 0.06 });
  var mRoofB  = mat(o.cRoofDark || AC.roofSlopeB, { rough: 0.82, metal: 0.06 });
  var mUnder  = mat(o.cRoofUnd  || AC.roofUnder,  { rough: 0.92 });
  var mFascia = mat(o.cFascia   || AC.fascia,     { rough: 0.80 });
  var mRidge  = mat(o.cRidge    || AC.ridgeCap,   { rough: 0.62, metal: 0.10 });
  var mSeam   = mat(o.cSeam     || AC.roofSeam,   { rough: 0.88 });
  var mGable  = mat(o.cGable    || AC.gableWall,  { rough: 0.90 });
  var mGableT = mat(o.cGableTrim|| AC.gableTrim,  { rough: 0.70 });

  /* ── ① 两片坡面 ────────────────────────────────────────────────────
     南坡（+Z，朝阳 → 亮）/ 北坡（−Z → 暗）
     用 BufferGeometry 手搓两片四边形（含厚度）。
     ★ UV 用世界 XZ 投影（与 hipRoof 同一套约定），让横向分缝贴图方向正确。*/
  var a = W / 2, b = HALF_D;
  function slopeMesh(sign, mtl) {
    /* 四角：屋脊端（z=0, y=RISE）→ 檐口端（z=±b, y=0）*/
    var zR = 0, yR = RISE, zE = sign * b, yE = 0;
    var n = new THREE.Vector3(0, Math.cos(ang), -sign * Math.sin(ang)).normalize();
    var pts = [
      [-a, yE, zE], [a, yE, zE], [a, yR, zR], [-a, yR, zR]
    ];
    /* ★★★ v20c 修正：**只搓两片四边形（上/下表面），不再手写封边索引**
       ──────────────────────────────────────────────────────────────
       v20a/b 用手写的 36 元素索引数组拼"檐口封边"，其中若干三角形
       **退化**（面积 0）⇒ `computeVertexNormals()` 对退化的法线做
       `normalize(0,0,0)` = **NaN** ⇒ 光照/包围盒全 NaN ⇒ 相机取景失败
       （对照实验：删掉封边后 NaN 消失，几何其余部分完好）。
       ✅ 正解：封边改**在坡面四边形上直接加厚**（上下表面各偏 ±thick/2，
          侧向由几何自身封闭），或干脆用 box 拼 —— 本函数选前者 +
          底部补一块薄 box 做"滴水线"，两者都是**规整几何**，不可能出 NaN。 */
    function quadGeo(poly, flip) {
      var geo = new THREE.BufferGeometry();
      var verts = [];
      poly.forEach(function (p) { verts.push(p[0], p[1], p[2]); });
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      var uv = [];
      poly.forEach(function (p) { uv.push(p[0] / 5.2, p[2] / 5.2); });
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      return geo;
    }
    var up = pts.map(function (p) {
      return [p[0] + n.x * thick / 2, p[1] + n.y * thick / 2, p[2] + n.z * thick / 2];
    });
    var dn = pts.map(function (p) {
      return [p[0] - n.x * thick / 2, p[1] - n.y * thick / 2, p[2] - n.z * thick / 2];
    });
    var mUp = new THREE.Mesh(quadGeo(up, false), mtl);
    mUp.castShadow = true; mUp.receiveShadow = true;
    g2.add(mUp);
    var mDn = new THREE.Mesh(quadGeo(dn, true), mUnder);
    mDn.castShadow = true; mDn.receiveShadow = true;
    g2.add(mDn);
    /* ── 封边：★★★ v20h **彻底改为"手搓几何"，不再用旋转的盒子** ──────
       ──────────────────────────────────────────────────────────────
       踩坑史（三轮，全部记进技能）：
         v20a 手写 36 元素索引 ⇒ 退化三角形 ⇒ 法线 NaN ⇒ 整栋 NaN
         v20b 改 `lookAt(p1)` ⇒ NaN 依旧（**病不在此**，对照实验证伪）
         v20c 改 3 分支 rotation（沿Z/沿X/斜边）⇒ 复现验证：
              **4 条边里有 3 条角度算错**（长轴方向与目标差 90° 或镜像）
              ⇒ 屏幕上就是"从屋檐戳出去几根斜棒子"
       ★ 根因是**结构**不是公式：只要用"旋转盒子"去贴一条任意方向的边，
         就必然要处理 3 种退化情形（轴对齐 ×2 + 斜边），分支一多必错。
       ✅ 正解：**封边本身就是两根直线之间的四边形**（梁的顶面/底面/侧面），
          直接用顶点构造 BufferGeometry —— **零旋转、零分支、不可能错**。
          封边 = 沿这条边、宽度 edgeW、从 up 面垂到 dn 面的一个"扁盒子"，
          用 8 个顶点 + 12 个三角面显式写出（规整拓扑，不可能退化）。 */
    var edgeW = 0.09;
    for (var k = 0; k < pts.length; k++) {
      var k2 = (k + 1) % pts.length;
      var A0 = up[k], A1 = up[k2], B0 = dn[k], B1 = dn[k2];
      /* 边的方向（用来算"朝外"的偏移方向，只在水平面内）*/
      var ex = A1[0] - A0[0], ey = A1[1] - A0[1], ez = A1[2] - A0[2];
      var elen = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (elen < 0.001) continue;
      /* 向外法向（水平、垂直于边）：n × up 近似 —— 这里对矩形坡面，
         直接用"从边中点指向坡面外侧"的简单近似即可（只用来做几厘米偏移）*/
      var out = new THREE.Vector3(ex, 0, ez).normalize();
      var perp = new THREE.Vector3(-out.z, 0, out.x).multiplyScalar(edgeW / 2);
      /* 判断 perp 指向坡外还是坡内：与"边中点 → 坡面中心"比较 */
      var mx = (A0[0] + A1[0]) / 2, mz = (A0[2] + A1[2]) / 2;
      if ((mx + perp.x) * (mx + perp.x) + (mz + perp.z) * (mz + perp.z)
          < mx * mx + mz * mz) perp.negate();
      /* 8 顶点：外/内 × 上/下 × 两端 */
      var vs = [
        [A0[0] + perp.x, A0[1] + perp.y, A0[2] + perp.z],
        [A1[0] + perp.x, A1[1] + perp.y, A1[2] + perp.z],
        [A1[0] - perp.x, A1[1] - perp.y, A1[2] - perp.z],
        [A0[0] - perp.x, A0[1] - perp.y, A0[2] - perp.z],
        [B0[0] + perp.x, B0[1] + perp.y, B0[2] + perp.z],
        [B1[0] + perp.x, B1[1] + perp.y, B1[2] + perp.z],
        [B1[0] - perp.x, B1[1] - perp.y, B1[2] - perp.z],
        [B0[0] - perp.x, B0[1] - perp.y, B0[2] - perp.z]
      ];
      var eg = new THREE.BufferGeometry();
      var fv = [];
      vs.forEach(function (p) { fv.push(p[0], p[1], p[2]); });
      eg.setAttribute('position', new THREE.Float32BufferAttribute(fv, 3));
      /* 12 个三角面显式列出（每个面都被两个方向各列一次 ⇒ 闭合且法线朝外）*/
      eg.setIndex([
        0, 1, 5, 0, 5, 4,   /* 外上 */
        1, 2, 6, 1, 6, 5,   /* 端面1 */
        2, 3, 7, 2, 7, 6,   /* 内上 */
        3, 0, 4, 3, 4, 7,   /* 端面2 */
        4, 5, 6, 4, 6, 7,   /* 底 */
        0, 3, 2, 0, 2, 1    /* 顶 */
      ]);
      eg.computeVertexNormals();
      var em = new THREE.Mesh(eg, mFascia);
      em.castShadow = true; em.receiveShadow = true;
      g2.add(em);
    }
  }
  slopeMesh(1, mRoofA);    /* 南坡（朝阳，受光 → 亮）*/
  slopeMesh(-1, mRoofB);   /* 北坡（背光 → 暗）*/

  /* ── ② 正脊：**贯穿全程**（公寓标志，与实验楼 34% 短脊形成最大反差）── */
  g2.add(box(W + 0.30, 0.30, 0.50, mRidge, 0, RISE + 0.06, 0));
  /* 脊顶高光细线 */
  g2.add(box(W + 0.24, 0.045, 0.18, mat(o.cRidgeHi || AC.ridgeHi, { rough: 0.3, metal: 0.5 }),
           0, RISE + 0.215, 0));
  /* 脊下压缝（让脊不"浮"在坡上）*/
  g2.add(box(W + 0.26, 0.05, 0.62, mSeam, 0, RISE + 0.015, 0));

  /* ── ③ 屋面横向瓦垄 —— ★★★ v20k **决策：撤掉这个构件**
     ──────────────────────────────────────────────────────────────
     三轮试错记录（每一轮都"改了有效果"，但**目标指标没变好**）：
       v20f  4 道 × 0.34m  ⇒ 2.63px，低于 6px 阈值，**完全看不见**
       v20h  3 道 × 0.70m  ⇒ 看见了，但读作"一排排细木条钉在屋顶上"
       v20j  改旋转贴合坡面   ⇒ 反而**更糟**：旋转后露出盒子的侧面厚度，
                              在 61px 的斜面上变成"百叶窗/木栅栏"
     ★ 判断（纪律 §4.1：改掉可疑变量而目标指标不动 ⇒ 病不在此，必须换口径）：
       —— "瓦垄"这个构件**在这个尺度上不成立**。坡面斜长只有 61px，
          已经被"南坡亮/北坡暗 + 出檐投影 + 老虎窗 ×2"三层信息占满，
          再塞凸起几何只能糊成一团。
       —— 对照真实宿舍楼：屋面本就朴素（水泥瓦/彩钢瓦），**素色更像**。
     ✅ 决策：**撤掉凸起瓦垄**，改为在坡面上做**极浅的横向分格缝**
        （厚度仅 0.02m 的深色细带，只提供"这是一片大屋面"的尺度感，
         不做立体造型）——从"做造型"退回到"做质感"，避免抢戏。 */
  var nSeam = 4;
  var seamW = 0.16;                 /* 0.16m ≈ 1.2px —— 刻意**低于**阈值：
                                       目的是"若有若无的肌理"，不是"看得见的分格"*/
  var mSeam = mat(o.cSeam || AC.roofSeam, { rough: 0.88 });
  [1, -1].forEach(function (sign) {
    for (var i = 1; i <= nSeam; i++) {
      var t = i / (nSeam + 1);
      var zz = sign * (b * t);
      var yy = gableY(zz);
      var rib = new THREE.Group();
      rib.add(box(W - 0.90, 0.018, seamW, mSeam, 0, 0.009, 0));
      rib.rotation.x = -ang;
      rib.position.set(0, yy + thick / 2, zz);
      g2.add(rib);
    }
  });

  /* ── ④ 檐口封檐板（★ 实验楼是"回字带+挑檐线脚"，这里**只一道平板**）── */
  var gw = W + E * 2;
  [-1, 1].forEach(function (s) {
    g2.add(box(gw, 0.30, 0.16, mFascia, 0, 0.02, s * b));
    /* 滴水线（檐口下沿暗线）*/
    g2.add(box(gw, 0.07, 0.20, mUnder, 0, -0.15, s * b));
  });

  /* ── ⑤ ★★ 三角山墙（双坡特有；实验楼的四坡顶根本没有山墙）─────────
     用一块三角形 + 一道装饰线，把"双坡 gable"的形制说清楚。 */
  [1, -1].forEach(function (s) {
    var tri = new THREE.BufferGeometry();
    var x = s * (W / 2 + E * 0.06);
    var dg = D / 2 - 0.05;
    var verts = [x, 0, -dg, x, 0, dg, x, RISE, 0];
    tri.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    tri.setIndex(s > 0 ? [0, 1, 2] : [2, 1, 0]);
    tri.computeVertexNormals();
    var tm = new THREE.Mesh(tri, mGable);
    tm.castShadow = true; tm.receiveShadow = true;
    g2.add(tm);
    /* ★★★ v20i 决策：**删掉"山墙斜边装饰线"这个构件**（不是修角度）
       ──────────────────────────────────────────────────────────────
       三轮踩坑史（全部留痕，见技能 §19）：
         v20a `hg.lookAt(p1)`        ⇒ 矩阵 NaN
         v20b 换显式 rotations        ⇒ 屏幕上出现"从屋檐戳出去的斜棒子"
         v20c `atan2(RISE, z2*dg)`    ⇒ **第二象限给"绕远路"的解**：
              z2=−1 时 atan2(4.32, −5.70) = 142.9°（而非 −33°）
              ⇒ 盒子翻了个身，长轴朝坡外 ⇒ 就是那 4 根棒子
              （探针实测：`0.16x0.22x7.15 rot.x=-2.493` ×2 根）
       ★ 判断依据（纪律 E-6：**"和原来的区别不大"→ 病在结构不在皮肤**）：
         这个构件对"双坡 gable"的辨识**没有贡献**（山墙三角形本身已经
         把形制说清楚了），但它让几何复杂度凭空多一层"任意方向细长体"
         —— 这种构件每加一个就多一次出错机会。
       ✅ 决策：**删掉它**。山墙改为：
         ① 三角面本身（浅色，读作"墙延伸到山尖"）
         ② 沿山墙底边一条**水平通长压边**（零旋转，不可能错）
         ③ 山墙顶点的"尖"用一小段**竖直**短盒收头（零旋转）*/
    g2.add(box(0.20, 0.40, 2 * dg + 0.10, mGableT, x, 0.20, 0));   /* 底边压边 */
    g2.add(box(0.24, 0.34, 0.34, mGableT, x, RISE + 0.10, 0));     /* 山尖收头 */
  });

  /* ── ⑥ ★★★ 老虎窗 ×2（最强辨识特征；公寓特有）────────────────────
     ★★★ v20j 重大重构：**老虎窗改为"整体旋转的 Group"**（不是逐个构件摆位）
     ──────────────────────────────────────────────────────────────
     病（放大图实测）：老虎窗沿 z 深 2.1m，而坡面在这段范围内高度变了
       Δy = 2.1 × tan33° = **1.364m**。旧写法把底面按 `gableY(1.55)` 取平
       ⇒ **内侧悬空 0.682m、外侧埋入 0.682m** ⇒ 屏幕上就是"补丁"和"穿模"。
     ★ 这是**结构问题**：任何"平底箱子放斜面上"都必然一头悬空一头埋没。
     ✅ 正解（数学已解析验证）：
        把老虎窗的所有构件先建在**局部坐标系**（底在 y=0，向上为 +Y），
        再整体 `group.rotation.x = -ang`（=−33°），此时局部 +Y 恰好等于
        坡面法向 (0, cos33°, sin33°) = (0, 0.8387, 0.5446)
        ⇒ **底面与坡面解析共面**，无论多深多宽都严丝合缝。
        最后把 group 定位到坡面上 (dx, gableY(zc), zc)。
     ★ 为什么不会重蹈 v20a~c 的覆辙：这里**只有一个** rotation.x（整体），
       不是"给任意方向的细长体算角度"（那种才需要 3 分支、必然出错）。 */
  var dxs = [-W * 0.26, W * 0.26];
  dxs.forEach(function (dx) {
    var zc = 1.55;                       /* 老虎窗贴合点（偏屋脊侧）*/
    var wW = 2.40, wH = 1.75, wD = 2.10;
    var hw = new THREE.Group();          /* ← 老虎窗自己的局部坐标系 */
    /* ① 窗箱体（局部：底在 y=0）*/
    hw.add(box(wW, wH, wD, mat(o.cGable || AC.gableWall, { rough: 0.9 }),
              0, wH / 2, 0));
    /* ② 窗洞（深色玻璃）—— 开在 +Z 侧面 */
    hw.add(box(wW * 0.62, wH * 0.46, 0.10,
               mat(o.cWinGlass || AC.winGlass, { rough: 0.25, metal: 0.2 }),
               0, wH * 0.60, wD / 2 + 0.02));
    /* ③ 白色窗套（只做上/下两条，避免 v19 Bug 3 的"白件占 60%"）*/
    var fr = mat(o.cWinFrame || AC.winFrame, { rough: 0.72 });
    hw.add(box(wW * 0.70, 0.12, 0.13, fr, 0, wH * 0.60 + wH * 0.23 + 0.06, wD / 2 + 0.03));
    hw.add(box(wW * 0.70, 0.10, 0.13, fr, 0, wH * 0.60 - wH * 0.23 - 0.05, wD / 2 + 0.03));
    /* ④ 老虎窗自己的小双坡顶（局部几何，不旋转 —— 随 Group 一起转）*/
    var cRise = 0.52, cHalf = wD / 2 + 0.16, cHalfW = wW / 2 + 0.20;
    var cAng = Math.atan(cRise / cHalf);
    [1, -1].forEach(function (s2) {
      var g3 = new THREE.BufferGeometry();
      var P = [
        [-cHalfW, 0, s2 * cHalf], [cHalfW, 0, s2 * cHalf],
        [cHalfW, cRise, 0], [-cHalfW, cRise, 0]
      ].map(function (p) { return [p[0], wH + p[1], p[2]]; });
      var vv = [];
      P.forEach(function (p) { vv.push(p[0], p[1], p[2]); });
      g3.setAttribute('position', new THREE.Float32BufferAttribute(vv, 3));
      g3.setIndex([0, 1, 2, 0, 2, 3]);
      g3.computeVertexNormals();
      var cm = new THREE.Mesh(g3, mRoofA);
      cm.castShadow = true; cm.receiveShadow = true;
      hw.add(cm);
    });
    /* ⑤ 小坡顶正脊 */
    hw.add(box(wW + 0.30, 0.13, 0.18, mRidge, 0, wH + cRise + 0.05, 0));
    /* ★★★ v23b 正解：**不旋转**，改为"底面取前沿最低点"
       ──────────────────────────────────────────────────────────────
       这一处前后错了两次，根因是**把两条互斥的约束混在一起求**：

         约束 A：底面不能悬空          （否则读作"飘着的补丁"）
         约束 B：窗面必须**竖直朝外**  （否则窗朝坡内 ⇒ 读不出"老虎窗"）

       · v19：平底箱直接摆斜面 ⇒ 违反 A（内悬空 / 外埋入各 0.682m）
       · v20j~v22：`rotation.x = ∓ang` 整体旋转
                  ⇒ 满足 A，但**违反 B**（局部 +Z 随旋转倒向"朝坡内"）
                  —— 实测截图确认：渲成"贴着坡面的一片褐色补丁"，
                     既没有窗、也没有体积感。
       ✅ v23b：**不旋转**（四面墙保持竖直 ⇒ 满足 B），
          底面高度取**前沿最低点** `gableY(zc + wD/2 − 收进)`
          ⇒ 满足 A。后沿被坡面埋入 ⇒ **物理正确**
            （真实老虎窗本来就把后半截埋进屋面，这是它"坐实"的来源）。

       ★ 判据（可复用，已写入技能）：
         **斜面上的"房间类"构件（老虎窗／天窗／屋顶间）——
           优先满足"墙面竖直 + 底面不悬空"，而不是"底面与坡面共面"。**
         共面必然要旋转，旋转就会把窗/门朝向坡内。
         只有**薄片类**构件（集热板／瓦条／盖板）才该追求共面。 */
    var frontZ = zc + wD / 2 - 0.22;   /* 前沿略收进，避免露出盒底棱线 */
    hw.position.set(dx, gableY(frontZ), zc);
    g2.add(hw);
  });

  /* ── ⑦ ★★★ 太阳能热水器阵（v23 新增）────────────────────────────
     依据：`BUILDING-SPEC.md`「C. 学生公寓」明确写
       「屋顶设备：**大量太阳能热水器阵（深色格栅，成排）** + 空调外机」；
       `overview.jpg` 的「宿舍楼 1/2/3」三张实拍里，屋面成排的深色格栅
       也是最醒目的非屋面条带。

     ★ 为什么它是"宿舍"最强的辨识件（而不只是装饰）：
       独栋住宅不需要**集体热水系统**，只有成栋宿舍才会在屋面铺满集热器。
       所以这一条同时回答了"这是什么楼"——比任何配色都有效。

     ★★★ v23b 修正（实测截图：渲成"一排白色卷状物"，与规范的
       「**深色格栅**」不符）——
       真因：`solarTank` 用 0xB8BCC0（亮银）且半径 0.31m，而水箱坐在集热板
       **上方** ⇒ 正交俯视时**水箱盖住了板**，于是整体读作亮色。
       ✅ 修法（三条一起改，缺一条都不成立）：
         ① 水箱改**中灰** 0x7E868E（不再抢亮）并缩小半径 0.31→0.22
         ② 集热板**加宽加厚**（2.0×1.45×0.10 → 2.15×1.50×0.15）
         ③ 排距**加密**（1.30 → 0.88）⇒ 从"几个白点"变成"一片格栅"
       判据：屋面设备的读感由**最上层构件的颜色**决定 ——
             要让"深色格栅"成立，最上层就不能是亮色。

     ★ 贴合方式：与老虎窗同一套 §21 整体旋转（`sign(zc)·ang`），
       局部按水平面建模 ⇒ 底面与坡面**解析共面**（推导见上面老虎窗那段）。
       ⚠️ 但注意：**集热板属于"薄片类"构件**，追求共面是对的；
         老虎窗属于"房间类"，才必须"不旋转 + 底面取前沿"（见上）。
     ★ 尺度（单栋取景约 25 px/m）：集热板 2.15×1.50m = **54×38px**；
       水箱 Ø0.44m = **11px** ⇒ 全部远超 6px 阈值，是**实体**不是噪点。
     ★ 只放南坡（+Z，朝阳）——真实屋面也是朝南铺。 */
  var SOLAR_ROWS = o.solar === undefined ? 2 : o.solar;
  if (SOLAR_ROWS > 0) {
    /* ★★★ v23c：板面"压不暗"的正解 = **提高金属度**，不是继续改色号
       ──────────────────────────────────────────────────────────────
       症状（实测两轮）：无论把 `solarPanel` 取到多黑（0x1A2430），
         朝上的板面渲出来仍是中灰甚至发白，读不出"深色格栅"。
       真因（先算再改）：朝上的面受全照度，本场景的实测传递关系是
         **渲染 ≈ 255 − 0.528 × (255 − 材质)**
         ⇒ 材质取 26（0x1A…）也只到 **134**；要渲染到 70 需要材质 **负数**
         ⇒ **在这套光照下，朝上的面物理上不可能压到"近黑"。**
       ✅ 正解：改用**金属反射**而不是漫反射 ——
         `MeshStandardMaterial` 在 `metalness → 1` 且**没有环境贴图**时，
         漫反射项消失、只剩很弱的镜面项 ⇒ 自然渲成深色。
         这是"让某类构件变黑"的正确杠杆（而不是把 color 一直往回取）。
       ★ 附带修掉：v23b 我还在板上叠了一条 `mTank` 的"高光条"，
         它覆盖了 88% 的板面 ⇒ **主视觉变成了那条亮带**。
         高光条已删除（判据：图层顺序里**最上面那一层的颜色决定读感**）。 */
    var mSolar = mat(o.cSolar || AC.solarPanel, { rough: 0.34, metal: 0.90 });
    var mTank  = mat(o.cTank  || AC.solarTank,  { rough: 0.34, metal: 0.38 });
    var pw = 2.15, pd = 1.50;                       /* 集热板宽 / 进深 */
    var gapX = 0.88;                                /* ★ 加密 ⇒ 读作"格栅" */
    var nPer = Math.max(2, Math.floor((W - 4.0) / (pw + gapX)));
    var totalW = nPer * pw + (nPer - 1) * gapX;
    for (var sr = 0; sr < SOLAR_ROWS; sr++) {
      var zc2 = 2.05 + sr * 2.30;                   /* 沿坡向两排 */
      if (zc2 > HALF_D - pd * 0.5 - 0.5) break;     /* 超出檐口就不放 */
      for (var sk = 0; sk < nPer; sk++) {
        var xc2 = -totalW / 2 + pw / 2 + sk * (pw + gapX);
        var u = new THREE.Group();
        /* 集热板（深色主体，金属度 0.76 ⇒ 渲成深色）
           ★ v23c：**不放"高光条"** —— 它会在最上层盖住板面，
             让整个阵列读成亮色（见上面注释）。 */
        u.add(box(pw, 0.15, pd, mSolar, 0, 0.14, 0));
        /* 圆柱水箱：横躺在上缘（`rotation.z` 让圆柱轴沿 X）
           ★ v23b：半径 0.31→0.22、色号改中灰 —— 见上面注释 */
        var tk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, pw * 0.94, 12), mTank);
        tk.rotation.z = Math.PI / 2;
        tk.position.set(0, 0.40, -pd * 0.60);
        u.add(tk);
        /* 支腿 ×2（把板垫离屋面，产生投影 ⇒ 读感更强）*/
        [-1, 1].forEach(function (s) {
          u.add(box(0.10, 0.24, 0.10, mSolar, s * pw * 0.34, 0.02, pd * 0.32));
        });
        u.traverse(function (o2) {
          if (o2.isMesh) { o2.castShadow = true; o2.receiveShadow = true; }
        });
        u.rotation.x = ang;                         /* ★ 南坡：+ang（与老虎窗同规则）*/
        u.position.set(xc2, gableY(zc2), zc2);
        g2.add(u);
      }
    }
  }

  return g2;
}

/* ══════════════════════════════════════════════════════════════════
   aptFlatRoof —— 平屋顶 + 女儿墙檐口（特征①③）
   ──────────────────────────────────────────────────────────────────
   ★ 实拍：深蓝卷材屋面（明度 59）+ 分格缝 + 深色女儿墙压顶。
   ★★ 沿用 v17d 的"按渲染反推"：屋面板受全照度抬升 +90，
      所以材质取 0x161C26（明度约 24）才能渲染出 ≈100 的深蓝。
   ══════════════════════════════════════════════════════════════════ */
function aptFlatRoof(g, W, D, topY, o) {
  o = o || {};
  var T = 0.13;                       /* 屋面板厚 */
  /* ★ v19c 修正：女儿墙从 0.75 降到 0.42、厚度 0.24 → 0.18
     ──────────────────────────────────────────────────────────────
     证据（对比图 apt-v19-compare.png）：0.75 高 + 0.24 厚的女儿墙
     把屋顶**框成了一个盒子**，压掉了屋面面积 —— 而实拍里"屋面占俯视
     面积约 50%，是视觉主角"（BUILDING-SPEC 第二节）。
     ⇒ 降到 0.42 高：仍有"女儿墙"的读感，但屋面完整露出来。 */
  var PH = o.parapetH === undefined ? 0.42 : o.parapetH;
  var PT = 0.18;                      /* 女儿墙厚 */

  /* ① 屋面板（一块平板，略小于轮廓让女儿墙包住）*/
  var deck = box(W - 0.02, T, D - 0.02, mat(AC.roofFlat, { rough: 0.86 }),
                 0, topY + T / 2, 0);
  g.add(deck);

  /* ② 屋面分格缝（田字 + 长向多道）—— 用极薄的深色条贴在屋面板上
     ★ 屏幕换算提醒：本项目 7.564 px/m，所以缝宽必须 ≥0.22m（1.66px）才看得见 */
  var seamM = 0.24;
  var nx = Math.max(2, Math.round(W / 6.0));
  var nz = Math.max(2, Math.round(D / 6.0));
  var mSeam = mat(AC.roofFlat2, { rough: 0.9 });
  for (var i = 1; i < nx; i++) {
    var x = -W / 2 + i * (W / nx);
    g.add(box(seamM, 0.02, D - 0.3, mSeam, x, topY + T + 0.012, 0));
  }
  for (var j = 1; j < nz; j++) {
    var z = -D / 2 + j * (D / nz);
    g.add(box(W - 0.3, 0.02, seamM, mSeam, 0, topY + T + 0.012, z));
  }

  /* ③ 女儿墙（四面）+ 压顶（深色收头）*/
  var py = topY + PH / 2;
  var mP = mat(AC.parapet, { rough: 0.9 });
  var mC = mat(AC.coping, { rough: 0.85 });
  /* 南北两面（长边）*/
  [-1, 1].forEach(function (s) {
    g.add(box(W, PH, PT, mP, 0, py, s * (D / 2 - PT / 2)));
    /* 压顶（比女儿墙略宽，形成挑出的细线）*/
    g.add(box(W + 0.10, 0.09, PT + 0.08, mC, 0, topY + PH + 0.045, s * (D / 2 - PT / 2)));
  });
  /* 东西两面（短边）*/
  [-1, 1].forEach(function (s) {
    g.add(box(PT, PH, D - PT * 2, mP, s * (W / 2 - PT / 2), py, 0));
    g.add(box(PT + 0.08, 0.09, D - PT * 2, mC, s * (W / 2 - PT / 2), topY + PH + 0.045, 0));
  });
}

/* ══════════════════════════════════════════════════════════════════
   aptRoofEquip —— 屋面设备箱阵（特征②）★ 俯视辨识的核心
   ──────────────────────────────────────────────────────────────────
   ★ 实拍（4× 放大）：屋面上有**成排的浅蓝方箱**（空调外机/新风机组），
     顶面接白，是俯视画面里**最亮的点**；排列整齐，间距均匀。
   ★ 这是让"公寓"在俯视图里一眼可辨的关键——比立面重要。
   ══════════════════════════════════════════════════════════════════ */
function aptRoofEquip(g, W, D, topY, o) {
  o = o || {};
  var T = 0.13;
  var ledge = topY + T + 0.01;
  var mB = mat(AC.equBox, { rough: 0.55 });
  var mT = mat(AC.equTop, { rough: 0.5 });
  var mE = mat(AC.equEdge, { rough: 0.45 });

  /* ★ 排布用"屋面分区"而不是全铺：实拍是**成排**，中间留检修通道。
     ★ v19 调整：箱子放大（首版太小太碎，读成"屋面噪点"），
       列距加大到 4.2m，箱体 2.2×1.3×0.95 —— 在 52° 俯角下才有"设备"的体量感。 */
  var cols = o.equCols || Math.max(2, Math.floor((W - 4.0) / 4.2));
  var pitch = W / (cols + 0.35);
  var bw = Math.min(2.2, pitch * 0.56);
  var bd = 1.30, bh = 0.95;

  for (var i = 0; i < cols; i++) {
    var x = -W / 2 + (i + 0.68) * pitch;
    /* 每列 2 个（南侧一排、北侧一排），中间留检修通道 */
    [-1, 1].forEach(function (s) {
      var z = s * (D * 0.26);
      /* 箱体 */
      var b = box(bw, bh, bd, mB, x, ledge + bh / 2, z);
      g.add(b);
      /* ★ 顶面亮边（白顶）—— 俯视最亮的点，用薄板贴面 */
      g.add(box(bw + 0.08, 0.055, bd + 0.08, mT, x, ledge + bh + 0.026, z));
      /* 顶面前缘细亮线（画龙点睛）*/
      g.add(box(bw + 0.12, 0.035, 0.07, mE, x, ledge + bh + 0.056, z + s * (bd / 2)));
      /* 箱体朝向通道的一侧加深（形成"箱体阵列"的层次）*/
      g.add(box(bw, bh * 0.9, 0.05, mat(AC.roofFlat2, { rough: 0.9 }),
                x, ledge + bh / 2, z - s * (bd / 2 + 0.026)));
    });
  }
}

/* ══════════════════════════════════════════════════════════════════
   aptStairBox —— 楼梯间出屋面（特征④）
   ══════════════════════════════════════════════════════════════════ */
function aptStairBox(g, W, D, topY, pos) {
  var T = 0.13;
  var w = 4.2, d = 3.6, h = 2.6;
  var m = mat(AC.wallMid, { rough: 0.9 });
  g.add(box(w, h, d, m, pos[0], topY + h / 2, pos[1]));
  /* 小坡顶（薄四坡，收头）*/
  var cap = box(w + 0.5, 0.22, d + 0.5, mat(AC.coping, { rough: 0.85 }),
                pos[0], topY + h + 0.11, pos[1]);
  g.add(cap);
}

/* ══════════════════════════════════════════════════════════════════
   makeApartment(W, D, o) —— 公寓工厂
   ══════════════════════════════════════════════════════════════════ */
function makeApartment(W, D, o) {
  o = o || {};
  var nf = o.floors || APT_NFLOOR;
  var g = new THREE.Group();
  var HF_W = W / 2, HF_D = D / 2;
  var bays = o.bays || Math.max(2, Math.round(W / APT_BAY));
  var bodyH = APT_FLOOR * nf;

  /* ① 主体墙
     ★★★ v19 关键修正：贴图改用 **中性灰阶**（neutral=true），
        颜色由**材质 color = AC.wallLit** 承担。
     ──────────────────────────────────────────────────────────────
     为什么必须这样（否则两套色板渲出同一张图）：
       · 旧 makeBrickTex 把砖色写死 (168,90,72)，材质 color 乘白 ⇒ 恒为砖红
       · ⇒ AC.wallLit 从没生效，Plan-A（卡其）/ Plan-B（砖红）逐像素相同
     为什么这**不违反** §14.1（"有贴图的材质 color 必须为白"）：
       §14.1 的**目的**是防止「贴图与材质重复调制同一份色彩」。
       中性贴图**不含彩度**（R=G=B），色相只来自 color ⇒ 不存在双重相乘，
       而色板变成真正的单点控制 ⇒ **换墙色不用重画贴图**。 */
  var brickTex = makeBrickTex(o.seed || 7, true);
  var mWall = mat(AC.wallLit, { tex: brickTex, rough: 0.92 });
  brickTex.repeat.set(W / BRICK_TILE_M, bodyH / BRICK_TILE_M);
  g.add(box(W, bodyH, D, mWall, 0, bodyH / 2, 0));

  /* ② 四面立面
     ★ 先算出"哪些楼层有阳台"，把它传给 aptFacade ⇒ 那些层的带窗会退后，
       阳台才能露出来（否则阳台被同一平面的窗套盖住，视觉上不存在）。 */
  var balcFloors = null;
  if (o.balcony) {
    balcFloors = [];
    for (var fl0 = 1; fl0 < nf; fl0++) balcFloors.push(fl0);   /* 首层不做阳台 */
  }
  var FACES = [
    { dir: 0, len: W, odd: false },   /* +Z */
    { dir: 1, len: D, odd: true  },   /* +X */
    { dir: 2, len: W, odd: false },   /* -Z */
    { dir: 3, len: D, odd: true  }    /* -X */
  ];
  FACES.forEach(function (f) {
    var fb = f.odd ? Math.max(1, Math.round(D / APT_BAY)) : bays;
    /* 该面是否有阳台 ⇒ 只有有阳台的那一面才启用"带窗退后" */
    var hasBalHere = o.balcony && o.balcony.indexOf(f.dir) >= 0;
    aptFacade(g, f.dir, HF_W, HF_D, f.len, nf, {
      bays: fb,
      balconyFloors: hasBalHere ? balcFloors : null
    });
  });

  /* ③ 阳台（外挑；o.balcony 列出朝哪几侧）
     ★ v19：凸出量从 0.95 加到 1.35，且阳台板顶面提高 —— 这样在 52° 俯角下
       阳台底板与栏板都能投出可见阴影，才是"外挑阳台"的读感。 */
  if (o.balcony) {
    var OUT = o.balconyOut || 1.35;
    o.balcony.forEach(function (d) {
      var f = FACES[d];
      var fb = f.odd ? Math.max(1, Math.round(D / APT_BAY)) : bays;
      var bw = f.len / fb;
      for (var fl = 1; fl < nf; fl++) {          /* 首层不做阳台（有门厅）*/
        var yC = fl * APT_FLOOR + 0.12;
        for (var b = 0; b < fb; b++) {
          var uC = -f.len / 2 + (b + 0.5) * bw;
          aptBalcony(g, f.dir, HF_W, HF_D, uC, yC, bw * 0.90, OUT);
        }
      }
    });
  }

  /* ④ 屋顶：★ v20 起两条路线都是"公寓自己的屋顶"，不再借用实验楼的语言
     ──────────────────────────────────────────────────────────────
     用户 2026-09-29 拍板 **B 方向**：坡顶做出公寓特色。
     旧做法（v19）是直接 `hipRoof(...)` 复用实验楼四坡庑殿顶 ⇒ 用户看后
     判定"**是实验楼的复制品**"。v20 改为调用本文件的 `aptGableRoof`：
       双坡 · 33° · 全程脊 · 横向瓦带 · 三角山墙 · 老虎窗 ×2
     ⇒ 与实验楼在**形制层面**分家，而不是只换个颜色。 */
  if (o.hipRoof) {
    /* ★★★ v20e 修正：**只有调用方显式传 `o.roofC` 时才用外部色板**。
       ──────────────────────────────────────────────────────────────
       v20a~d 的写法是 `var roofC = o.roofC || {实验楼那套}`，
       然后**无条件**把 roofC 的值传给 aptGableRoof ⇒ 即使调用方没传，
       也会用实验楼的冷蓝金属覆盖公寓自己的暖灰石板瓦
       ⇒ 探针查 `8e887c`（公寓坡面色）返回 0，色板形同虚设。
       ✅ 正解：`o.roofC` 存在才传色板；不存在则 **不传**
          ⇒ aptGableRoof 内部 `o.cRoofLit || AC.roofSlopeA` 自然取 AC
          ⇒ 公寓用 AC_B 的暖灰，实验楼若复用可显式传 roofC。 */
    var roofOpts = {
      ang:  o.roofAng || RAD(33),
      eave: o.roofEave === undefined ? 0.90 : o.roofEave
    };
    /* ★ v23：透传屋面设备的开关/色号 —— 否则 `o.solar` 根本到不了
       `aptGableRoof`（选项链断在这里，属于"传了但没接上"，与 §24.3 同类）。 */
    if (o.solar !== undefined) roofOpts.solar = o.solar;
    if (o.cSolar !== undefined) roofOpts.cSolar = o.cSolar;
    if (o.cTank !== undefined) roofOpts.cTank = o.cTank;
    if (o.roofC) {
      roofOpts.cRoofLit  = o.roofC.lit;
      roofOpts.cRoofDark = o.roofC.dark;
      roofOpts.cFascia   = o.roofC.eaveBand;
      roofOpts.cRidge    = o.roofC.ridge;
      roofOpts.cRidgeHi  = o.roofC.ridgeHi;
      roofOpts.cRoofUnd  = o.roofC.shade;
    }
    g.add(aptGableRoof(W, D, bodyH, roofOpts));
  } else {
    aptFlatRoof(g, W, D, bodyH, o);
    /* ⑤ 屋面设备箱阵（仅平顶需要 —— 坡屋顶上按实拍没有设备箱）*/
    aptRoofEquip(g, W, D, bodyH, o);
  }
  /* ⑥ 楼梯间出屋面（平顶才有；坡顶不做，避免戳穿坡面）*/
  if (o.core && !o.hipRoof) aptStairBox(g, W, D, bodyH, o.core);

  /* ⑦ 楼名 */
  if (o.name && o.nameDir != null) {
    var f2 = FACES[o.nameDir === 1 || o.nameDir === 3 ? 1 : 0];
    buildingName(g, f2.dir, HF_W, HF_D, f2.len, o.name);
  }

  g.userData.tower = true;
  return g;
}
