/* ══════════════════════════════════════════════════════════════════════
   tower-07-prototypes.js —— 批次原型生成器（v22 新增）
   ──────────────────────────────────────────────────────────────────────
   背景：`rank-area.py` 把 40 栋建筑归成 6 个**原型批次**——
     ① rect/wing  ×6   实验楼一/二、综合楼一/二、教学楼四、拓新楼
     ② rect/core  ×11  学生公寓 1~10 栋 + 富梅苑
     ③ U/tower    ×3   教学楼一/二/三
     ④ round      ×3   抱璞亭、迎日亭、望月亭
     ⑤ rect/hall  ×2   凌云体育馆、晴味堂
     ⑥ rect/null  ×15  图书馆、计算机中心、球场×5、小吃街×5、快递驿站、超市周边
   其中 ①② 已各有代表打到顶点（实验楼 v18 / 公寓 v21c）。
   **③④⑤⑥ 完全没有生成器** —— 本文件补齐。

   ★ 统一原则（沿用本项目的教训）：
     · 尺度自查：正交视角 7.564 px/m，**< 6px 的构件 = 噪点**，
       要么做到 ≥6px（≈0.8m），要么**刻意低于阈值**只当肌理。
     · 屋顶语言必须分家：实验楼=四坡蓝金属、公寓=双坡青灰、
       **教学楼=平顶女儿墙**、亭=攒尖锥顶、体育馆=拱壳 —— 同类之间不许"同款"。
     · 色板各自独立，靠 `withPalette()` 隔离，不污染其它批次。
   ══════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   批次色板（各批次独立，互不污染）
   ──────────────────────────────────────────────────────────────────
   ★★★ `wallTint` 是**必须预补偿**的（v22 实测教训）：
     `makeTower` 的墙面 = **中性砖贴图（灰基≈#b4b4b4 ⇒ 系数 0.706）× wallTint × 光照**
     立面受光抬升约 **+43**（本项目实测值）。
     ⇒ 反推式：**wallTint = (目标渲染值 − 43) ÷ 0.706**
     例：目标米黄墙渲染 ≈ (210,200,175)
         ⇒ 材质 (167,157,132) ⇒ wallTint (237,222,187) = 0xEDDEBB
     ⚠️ 不预补偿会怎样：直接写"看着像米黄"的 0xC9BEA0 ⇒
        实际渲染只有 (134,127,110)，**暗成一堵土墙**（这是最容易犯的错）。
   ══════════════════════════════════════════════════════════════════ */
var PAL = {
  /* 教学楼：米黄墙 + 平顶。与实验楼（砖红+蓝四坡）彻底分家 */
  academic: {
    wallTint: 0xF0DCB0,
    wallLit:  0xC9BEA0, wallMid: 0xB8AC8E, wallDark: 0x9A8F74,
    wallPier: 0xC2B698, wallLow: 0xA89C80,
    roofLit:  0x8E949C, roofDark: 0x787E86, roofShade: 0x606670,
    ridge:    0x70767E, ridgeHi: 0xC4CAD2,
    eaveBand: 0x565C64, fascia: 0x5C626A,
    frame:    0xE8E4DA, sill: 0xD2CCBE, frameD: 0x8E887E
  },
  /* 综合楼：浅灰白 + 蓝色檐带（偏"办公/科研"）*/
  general: {
    wallTint: 0xE8E2D2,
    wallLit:  0xC6C4BE, wallMid: 0xB4B2AC, wallDark: 0x96948E,
    wallPier: 0xBEBCB6, wallLow: 0xA29F98,
    roofLit:  0x7E8CA0, roofDark: 0x6A788C, roofShade: 0x546274,
    ridge:    0x62707F, ridgeHi: 0xBCC8D6,
    eaveBand: 0x4A5668, fascia: 0x505C6E,
    frame:    0xE4E0D8, sill: 0xCEC8BA, frameD: 0x8E887E
  },
  /* 图书馆：暖浅砂 + 深青灰檐（比教学楼更"沉稳"）*/
  library: {
    wallTint: 0xF4DFB4,
    wallLit:  0xC0B49A, wallMid: 0xAEA288, wallDark: 0x90846E,
    wallPier: 0xB8AC92, wallLow: 0x9E9278,
    roofLit:  0x7C848C, roofDark: 0x686E76, roofShade: 0x525860,
    ridge:    0x60666E, ridgeHi: 0xBBC1C9,
    eaveBand: 0x484E56, fascia: 0x4E545C,
    frame:    0xE6E2D8, sill: 0xD0CABC, frameD: 0x8E887E
  }
};

/* ══════════════════════════════════════════════════════════════════
   ① makePavilion —— 圆亭（round ×3：抱璞亭 / 迎日亭 / 望月亭）
   ──────────────────────────────────────────────────────────────────
   ★ 形制：台基（两级）→ 6 根檐柱 → 檐枋环 → 圆攒尖顶（锥）→ 宝顶
   ★ 为什么不做成"六角"：SITES 里的 shape 是 `round`（圆形平面），
     台基与顶用**正圆**（径向 32 段）才对得上；柱子仍取 6 根
     （中式亭的惯例是偶数柱，6 根在 3.9m 半径上间距 4.1m ✓）。
   ★ 尺度自查（7.564 px/m）：柱径 0.34m → **2.6px**（偏细）。
     修法：柱径提到 **0.46m → 3.5px**，并靠"深红柱 vs 浅石台基"的
     **强明度对比**换取可读性 —— 单看像素数不够，对比度可以补。
     檐枋 0.40m 高 → 3.0px，作为"一条深色横带"读得出来。
   ══════════════════════════════════════════════════════════════════ */
function makePavilion(R, o) {
  o = o || {};
  R = R === undefined ? 2.6 : R;
  var nCol = o.cols || 6;
  var colH = o.colH === undefined ? 3.10 : o.colH;
  /* ★★★ v22d 修正形制（实测截图：光滑圆锥读作"斗笠/蘑菇"）
     真因：中式亭的顶是**六角攒尖顶**，不是光滑圆锥。
       光滑圆锥没有垂脊、也没有折面 ⇒ 在正交俯视下就是一个"圆盘"，
       完全没有"亭"的辨识特征。
     ✅ 正解：`ConeGeometry(..., radialSegments = nCol)` + **flatShading: true**
        —— 六个折面各自受光不同 ⇒ **不画垂脊也能读出六道明暗分界**，
           这正是"攒尖顶"的读法。零额外几何、零旋转（§19 的安全区）。
     ★ 比例：`rise = eaveR × 1.25`（约 51°），比 v22c 的 1.05 更挺。 */
  var eaveR = R + 0.45;
  var rise = o.rise === undefined ? eaveR * 1.25 : o.rise;
  var cCol   = o.cCol   === undefined ? 0x8E4432 : o.cCol;
  var cBeam  = o.cBeam  === undefined ? 0x7A3A2A : o.cBeam;
  var cBase  = o.cBase  === undefined ? 0xB6AC98 : o.cBase;
  var cBase2 = o.cBase2 === undefined ? 0xA09680 : o.cBase2;
  var cRoof  = o.cRoof  === undefined ? 0x232B35 : o.cRoof;
  var cRoofD = o.cRoofD === undefined ? 0x1A2028 : o.cRoofD;
  var cFin   = o.cFin   === undefined ? 0xB8963E : o.cFin;

  var g = new THREE.Group();
  var mCol  = mat(cCol,  { rough: 0.82 });
  var mBeam = mat(cBeam, { rough: 0.84 });
  var mBase = mat(cBase, { rough: 0.94 });
  var mBase2= mat(cBase2,{ rough: 0.94 });
  var mRoof = mat(cRoof, { rough: 0.62, metal: 0.10, flat: true });
  var mRoofD= mat(cRoofD,{ rough: 0.66, metal: 0.08, flat: true });
  var mFin  = mat(cFin,  { rough: 0.42, metal: 0.42 });

  /* ① 台基：两级**六边形**台（★ v22d：与顶、柱同形制。
     v22c 用 32 段圆台 + 6 段锥顶 ⇒ "圆基配六角顶"是**形制错配**，
     读起来会觉得"哪里不对但说不上来"。）
     ★ 六边形的**外接圆**半径 = Rb；柱位半径 R 要小于它的**内切圆**
       （Rb·cos30°）才落在台面内 ⇒ 取 Rb = (R + 0.30)/0.866 保证内切 ≥ R+0.30。 */
  var Rb = (R + 0.30) / Math.cos(Math.PI / nCol);
  var b1 = new THREE.Mesh(new THREE.CylinderGeometry(Rb + 0.18, Rb + 0.34, 0.30, nCol), mBase2);
  b1.position.y = 0.15; b1.rotation.y = Math.PI / nCol;
  b1.castShadow = true; b1.receiveShadow = true;
  g.add(b1);
  var b2 = new THREE.Mesh(new THREE.CylinderGeometry(Rb, Rb + 0.16, 0.32, nCol), mBase);
  b2.position.y = 0.30 + 0.16; b2.rotation.y = Math.PI / nCol;
  b2.castShadow = true; b2.receiveShadow = true;
  g.add(b2);
  var baseTop = 0.62;

  /* ② 柱 + 柱础 */
  var mBase3 = mat(cBase2, { rough: 0.90 });
  for (var i = 0; i < nCol; i++) {
    var a = (i / nCol) * Math.PI * 2 + Math.PI / nCol;
    var px = Math.sin(a) * R, pz = Math.cos(a) * R;
    var plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.40, 0.22, 12), mBase3);
    plinth.position.set(px, baseTop + 0.11, pz);
    plinth.castShadow = true; plinth.receiveShadow = true;
    g.add(plinth);
    var col = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, colH, 14), mCol);
    col.position.set(px, baseTop + 0.22 + colH / 2, pz);
    col.castShadow = true; col.receiveShadow = true;
    g.add(col);
  }

  /* ③ 檐枋环（一条粗圆环，把 6 根柱"箍"起来 —— 这是"亭"最关键的辨识件）
     ★ 用 TorusGeometry 而不是薄圆柱壁：torus 的**径向厚度**在正交俯视下
       就是那 3px 的深色带，薄壁圆柱会完全看不见（亚像素）。 */
  var ringY = baseTop + 0.22 + colH;
  var beam = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.20, 8, 32), mBeam);
  beam.rotation.x = Math.PI / 2;
  beam.position.y = ringY;
  beam.castShadow = true; beam.receiveShadow = true;
  g.add(beam);
  var beam2 = new THREE.Mesh(new THREE.TorusGeometry(R + 0.05, 0.13, 8, 32), mBeam);
  beam2.rotation.x = Math.PI / 2;
  beam2.position.y = ringY + 0.34;
  beam2.castShadow = true;
  g.add(beam2);

  /* ④ 六角攒尖顶（★ radialSegments = nCol ⇒ 六个折面 + flatShading）
     ★ `ConeGeometry` 的**底面顶点角度**默认从 +X 起；要让 6 个折面
       与 6 根柱子**对齐**（脊压柱顶），需绕 Y 转半个分段角。
       同样的偏移已用在柱位上（`+ Math.PI / nCol`）⇒ 两者一致。 */
  var cone = new THREE.Mesh(new THREE.ConeGeometry(eaveR, rise, nCol, 1, true), mRoof);
  cone.position.y = ringY + 0.40 + rise / 2;
  cone.rotation.y = Math.PI / nCol;
  cone.castShadow = true; cone.receiveShadow = true;
  g.add(cone);
  /* 檐口封边（同样六棱，与顶面同角度）*/
  var eaveRing = new THREE.Mesh(new THREE.CylinderGeometry(eaveR + 0.07, eaveR + 0.07, 0.26, nCol), mRoofD);
  eaveRing.position.y = ringY + 0.40;
  eaveRing.rotation.y = Math.PI / nCol;
  eaveRing.castShadow = true;
  g.add(eaveRing);
  /* 锥底封板（否则从下往上看是通的）*/
  var sky = new THREE.Mesh(new THREE.CylinderGeometry(eaveR, eaveR, 0.06, nCol), mRoofD);
  sky.position.y = ringY + 0.44;
  sky.rotation.y = Math.PI / nCol;
  g.add(sky);

  /* ⑤ 宝顶：珠 + 座 + 尖（★ v22c 放大：0.30→0.42，顶点收头更清楚）*/
  var topY = ringY + 0.40 + rise;
  var seat = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.54, 0.30, 16), mBeam);
  seat.position.y = topY + 0.15; seat.castShadow = true;
  g.add(seat);
  var ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), mFin);
  ball.position.y = topY + 0.66; ball.castShadow = true; ball.receiveShadow = true;
  g.add(ball);
  var spike = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.72, 12), mFin);
  spike.position.y = topY + 1.32; spike.castShadow = true;
  g.add(spike);

  /* ⑥ 柱间坐凳栏（半高环板 —— 亭的实用件，也让亭"不空"）
     ★ 高 0.42m → 3.2px；配合深色侧影可读。只做 3 段留出入口。 */
  for (var s = 0; s < nCol; s++) {
    if (s % 2 === 1) continue;                       /* 隔一段留一开口 */
    var a0 = (s / nCol) * Math.PI * 2 + Math.PI / nCol;
    var a1 = ((s + 1) / nCol) * Math.PI * 2 + Math.PI / nCol;
    var mid = (a0 + a1) / 2;
    /* 长度按**弦长**算，两端才能顶到柱子上（v22b 用 R*0.88 太短，看着像悬空的棍）*/
    var chord = 2 * R * Math.sin(Math.PI / nCol) - 0.30;
    var seatB = new THREE.Mesh(new THREE.BoxGeometry(chord, 0.44, 0.18), mBeam);
    seatB.position.set(Math.sin(mid) * R * 0.965, baseTop + 0.44, Math.cos(mid) * R * 0.965);
    seatB.rotation.y = mid;
    seatB.castShadow = true; seatB.receiveShadow = true;
    g.add(seatB);
  }

  /* ⑦ 匾额（v23 新增）—— 中式亭的关键识别件：檐下正中的横匾。
     ★ 位置：挂在檐枋（beam）下方、朝向 +Z（本项目的取景正面）
     ★ 尺度：匾高 0.46m；**亭的取景分辨率约 150 px/m**（亭只 6m 宽、占满画面）
       ⇒ 0.46m = **69px**，中文非常清楚。
       （注意与教学楼不同：楼名按 0.86m 才够，因为楼高取景时只有 38 px/m。
         —— 同一个"文字尺寸"在不同尺寸的建筑上要分开算，见 §24 的尺度判据。）*/
  if (o.name) {
    var plqTex = makeSignTex(o.name, {
      fs: 168, fg: '#F8ECC8', bg: '#5A2E20', border: '#C8A24A',
      padX: 26, padY: 14
    });
    var pAspect = plqTex.image.width / plqTex.image.height;
    /* ★ 字号 128→168、内边距 54/24→26/14 ⇒ 字占牌面的比例从 ~62% 提到 ~80%。
       起因（实测）：匾额挂在六边形的 +Z 平边上，而相机方位角 36°
       ⇒ **斜视约 60°**，视觉上被压缩一半。放大字号是这里唯一有效的杠杆
         （改朝向只会变成"朝相机偏转"，从别的角度看就歪了）。*/
    var pH2 = 0.60, pW2 = pH2 * pAspect;
    if (pW2 > R * 1.5) { pW2 = R * 1.5; pH2 = pW2 / pAspect; }
    /* ★★ 位置：**必须推到檐口封边之外**（v23b 第二次修正）
       ──────────────────────────────────────────────────────────────
       第一次错：挂在"檐下柱间" ⇒ 52° 俯视时被檐口完全遮挡（实测看不见）。
       第二次错：改挂檐口时，我把 z 写成 `eaveR·cos30°`，
         而**檐口封边环自身**的平边距离是 `(eaveR+0.07)·cos30°`
         —— 两者只差 0.06m ⇒ 匾额**埋进了封边环里**（实测仍看不见）。
       ✅ 正解：以封边环的平边为基准再向外 0.08m：
         `z = (eaveR + 0.07) · cos30° + 0.08`
       ★ 判据（可复用）：**算"贴在某个构件外表面"的坐标时，
         基准必须是"那个构件的最外沿"，而不是"我打算贴的那层的中心半径"**
         —— 用中心半径算，子件必然被母件吃掉（§13 同源：偏移基准错）。 */
    var plqZ = (eaveR + 0.07) * 0.866 + 0.08;
    var plq = new THREE.Mesh(new THREE.PlaneGeometry(pW2, pH2),
      mat(0xFFFFFF, { tex: plqTex, rough: 0.74 }));
    plq.position.set(0, ringY + 0.26, plqZ);
    plq.castShadow = false; plq.receiveShadow = true;
    g.add(plq);
    /* 匾额托架（两根短挑，从檐口向外）*/
    [-1, 1].forEach(function (s2) {
      g.add(box(0.08, 0.08, 0.26, mBeam, s2 * pW2 * 0.44, ringY + 0.48, plqZ - 0.06));
    });
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ② makeHall —— 大跨单体（rect/hall ×2：凌云体育馆 / 晴味堂）
   ──────────────────────────────────────────────────────────────────
   两种形制（o.kind）：
     'gym'     体育馆：**拱壳屋顶**（半圆柱筒壳）+ 高侧窗带 + 大台阶
               ★ 拱的中心高度 = R，跨 30m ⇒ R=15m，rise 15m。
                 在 7.564px/m 下这是 **113px** —— 屋面语言一眼可辨。
     'canteen' 食堂：大平顶 + 女儿墙 + **顶部排气阵列**（食堂烟气多，
               屋面全是排气/新风机组 —— 这是它区别于教学楼的特征件）
   ══════════════════════════════════════════════════════════════════ */
function makeHall(W, D, o) {
  o = o || {};
  var kind = o.kind || 'gym';
  var nf = o.floors || (kind === 'gym' ? 2 : 3);
  var FH = o.floorH === undefined ? (kind === 'gym' ? 5.2 : 4.0) : o.floorH;
  var h = nf * FH;
  var HFW = W / 2, HFD = D / 2;

  var cWall  = o.cWall  === undefined ? (kind === 'gym' ? 0xC4C2BC : 0xC8B489) : o.cWall;
  var cWallD = o.cWallD === undefined ? (kind === 'gym' ? 0xA8A6A0 : 0xAE9A72) : o.cWallD;
  var cShell = o.cShell === undefined ? 0x8E96A0 : o.cShell;      /* 拱壳外皮 */
  var cShellD= o.cShellD=== undefined ? 0x767E88 : o.cShellD;
  var cGlass = o.cGlass === undefined ? 0x24303C : o.cGlass;
  var cSlab  = o.cSlab  === undefined ? 0x707074 : o.cSlab;
  var cPar   = o.cPar   === undefined ? 0x9A9080 : o.cPar;
  var cEquip = o.cEquip === undefined ? 0x828890 : o.cEquip;
  var cEquipD= o.cEquipD=== undefined ? 0x6A7078 : o.cEquipD;

  var g = new THREE.Group();
  var mWall  = mat(cWall,  { rough: 0.92 });
  var mWallD = mat(cWallD, { rough: 0.92 });
  var mShell = mat(cShell, { rough: 0.58, metal: 0.20 });
  var mShellD= mat(cShellD,{ rough: 0.62, metal: 0.16 });
  var mGlass = mat(cGlass, { rough: 0.14, metal: 0.44 });
  var mSlab  = mat(cSlab,  { rough: 0.95 });
  var mPar   = mat(cPar,   { rough: 0.88 });
  var mEquip = mat(cEquip, { rough: 0.64, metal: 0.18 });
  var mEquipD= mat(cEquipD,{ rough: 0.68, metal: 0.16 });

  /* ① 结构体（砖/涂料墙）*/
  var core = box(W, h, D, mWall, 0, h / 2, 0);
  core.material = [mWallD, mWallD, mWall, mWall, mWallD, mWallD];
  g.add(core);

  /* ② 勒脚（深一档，0.6m → 4.5px，可读）*/
  g.add(box(W + 0.16, 0.60, D + 0.16, mWallD, 0, 0.30, 0));

  /* ③ 高侧窗带：每层一条连续玻璃带（大跨建筑的主光来源）
     ★ 带高 1.45m → **11px** ✓ 稳稳可读；被每 3.6m 一根的竖梃分段 */
  var bandH = 1.45;
  for (var fl = 1; fl <= nf; fl++) {
    var by = fl * FH - bandH - 0.35;
    if (by < 0.9) continue;
    /* 长边两面做通长玻璃带 */
    g.add(box(W - 1.2, bandH, 0.10, mGlass, 0, by + bandH / 2, HFD + 0.02));
    g.add(box(W - 1.2, bandH, 0.10, mGlass, 0, by + bandH / 2, -HFD - 0.02));
    /* 竖梃：每 3.6m 一根，0.14m → 1.1px（刻意细，只当分格肌理）*/
    var nMul = Math.max(2, Math.round((W - 1.2) / 3.6));
    for (var mu = 0; mu <= nMul; mu++) {
      var mx = -(W - 1.2) / 2 + mu * (W - 1.2) / nMul;
      g.add(box(0.14, bandH, 0.14, mEquipD, mx, by + bandH / 2, HFD + 0.03));
      g.add(box(0.14, bandH, 0.14, mEquipD, mx, by + bandH / 2, -HFD - 0.03));
    }
  }
  /* 端墙（短边）做竖条窗：大跨的短边通常开窄高窗 */
  for (var s = -1; s <= 1; s += 2) {
    var nv = Math.max(2, Math.round(D / 4.0));
    for (var v = 0; v < nv; v++) {
      var vz = -D / 2 + (v + 0.5) * (D / nv);
      g.add(box(0.10, Math.min(2.6, h - 1.6), 1.5, mGlass, s * (HFW + 0.02), h * 0.52, vz));
    }
  }

  /* ④ 入口雨棚（南面 +Z，大跨建筑的门厅必然显眼）
     ★ v22d 修正（读图发现：雨棚是一块**发白的浮板**，与墙几乎同色 ⇒ 像"贴错的方块"）
       真因：雨棚用了 `mPar`（女儿墙色 = 中亮暖灰），而它**悬挑在墙外、
         朝上受全照度** ⇒ 抬升 +90 后比墙还亮 ⇒ 读成"单独一块"。
       ✅ 修法：改用 `mEquipD`（深色金属），并把出挑从 3.2 收到 2.6
         —— 深色雨棚贴着浅墙，反而读成"檐口的阴影"，这才是对的。 */
  var cw = Math.min(W * 0.40, 13), cd = 2.6;
  var cy0 = h > 6 ? 3.6 : 3.2;
  g.add(box(cw, 0.36, cd, mEquipD, 0, cy0, HFD + cd / 2 - 0.1));
  /* 雨棚下沿的暗带（把"蓬"和"墙"在明度上分开）*/
  g.add(box(cw * 0.99, 0.18, cd * 0.5, mGlass, 0, cy0 - 0.27, HFD + cd * 0.28));
  for (var c = -1; c <= 1; c += 2) {
    g.add(box(0.28, cy0, 0.28, mEquipD, c * cw * 0.38, cy0 / 2, HFD + cd * 0.78));
  }
  /* 台阶：三级平台（用 mSlab 而不是亮色，避免又出现一块白）*/
  for (var st = 0; st < 3; st++) {
    g.add(box(cw + 1.6 - st * 1.1, 0.16, 0.9 + st * 0.7, mSlab,
      0, 0.08 + st * 0.16, HFD + cd + (2 - st) * 0.45));
  }

  if (kind === 'gym') {
    /* ⑤a 拱壳：半圆柱筒壳，轴沿 X（建筑长边）
       ★ 推导（写清楚免得下次再推）：
         Cylinder(axis=Y) 的截面点是 (R sinθ, y, R cosθ)。
         rotation.z = 90° 把 (x,y,z) 映射成 (−y, x, z)
         ⇒ 新 Y = R sinθ、新 Z = R cosθ。
         取 θ∈[0,π] ⇒ 新 Y 从 0→R→0（恒 ≥0），新 Z 从 R→0→−R
         ⇒ **正好是一个开口朝下的拱**，跨度 2R、矢高 R。 */
    var R = D / 2 + 0.30;
    var riseArch = R;                       /* 矢高 = 半径 ⇒ 半圆拱 */
    var shell = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, W + 0.60, 40, 1, true, 0, Math.PI),
      mat(cShell, { rough: 0.58, metal: 0.20, side: THREE.DoubleSide })
    );
    shell.rotation.z = Math.PI / 2;
    shell.position.y = h;
    shell.castShadow = true; shell.receiveShadow = true;
    g.add(shell);
    /* 端头封板（半圆），否则从侧面看是空的 */
    for (var e = -1; e <= 1; e += 2) {
      var cap = new THREE.Mesh(new THREE.CircleGeometry(R, 40, 0, Math.PI), mShellD);
      cap.position.set(e * (W / 2 + 0.30), h, 0);
      cap.rotation.y = e * Math.PI / 2;
      cap.castShadow = true;
      g.add(cap);
    }
    /* 拱顶天窗带（沿脊一条，宽 1.6m → 12px）*/
    g.add(box(W * 0.62, 0.18, 1.6, mGlass, 0, h + riseArch + 0.02, 0));
    /* 拱脚檐口收边（沿两条长边的深色带）*/
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      g.add(box(W + 0.72, 0.34, 0.26, mShellD, 0, h + 0.12, s2 * (R + 0.02)));
    }
  } else {
    /* ⑤b 平顶 + 女儿墙 + 排气阵列（食堂）*/
    g.add(flatRoofWithParapet(W, D, h, {
      cSlab: cSlab, cPar: cPar, cCoping: 0xA99E8A,
      cEquip: cEquip, cEquipD: cEquipD,
      parapetH: 1.05, stairBox: true, stairBoxAt: [-(W / 2 - 3.4), -D / 4]
    }));
    /* ★ 食堂特征：屋面**密集排气阵列**（不成行也成组，读作"厨房在下面"）
       ★★ 更正：v1 草稿写成"烟囱是表现欲"，那是**动机式措辞**（把判断挂在
          我的主观目的上）。判据应当是**行为锚定**的：
          —— 排气阵列承担"这是食堂"的辨识功能，且它能被**零旋转的竖直圆柱**
             实现（不引入 §21 的斜面贴合问题），故保留。
       ★ v22e 放大：v22d 的管径 0.55m→4.2px、帽 0.80m→6.1px，
         实测截图里只是几个小点（**"刚好过阈值"≠"看得清"**）。
         现在管径 **0.76m → 5.8px**、帽 **1.10m → 8.4px**，
         并加高（1.9~2.9m）⇒ 靠"圆柱侧影 + 圆帽 + 投影"三重读感。 */
    var pipes = [[-W * 0.34, D * 0.22], [-W * 0.34 + 1.9, D * 0.22],
                 [-W * 0.34 + 0.9, D * 0.22 + 2.1], [-W * 0.34, -D * 0.26],
                 [-W * 0.34 + 1.9, -D * 0.26]];
    pipes.forEach(function (p, i) {
      var ph = 1.9 + (i % 3) * 0.5;
      var cy = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, ph, 14), mEquip);
      cy.position.set(p[0], h + 0.20 + ph / 2, p[1]);
      cy.castShadow = true; cy.receiveShadow = true;
      g.add(cy);
      var cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.46, 0.22, 14), mEquipD);
      cap2.position.set(p[0], h + 0.20 + ph + 0.11, p[1]);
      cap2.castShadow = true;
      g.add(cap2);
    });
    /* 新风机组 ×2 */
    [[W * 0.26, -D * 0.20], [W * 0.26 + 3.0, -D * 0.20 - 0.9]].forEach(function (p) {
      g.add(box(2.6, 1.30, 1.8, mEquip, p[0], h + 0.20 + 0.65, p[1]));
      g.add(box(2.8, 0.16, 2.0, mEquipD, p[0], h + 0.20 + 1.38, p[1]));
    });
  }

  /* ⑤ 楼名标牌（v23 新增）—— 大跨单体没有 `makeTower` 的楼名系统，
     所以这一批（体育馆 / 食堂）此前**完全没有名字**（探针实测确认）。
     ★ 摆在入口雨棚**上方**（雨棚 y=cy0，标牌 cy0+1.05）—— 这是现实里的做法。
     ★ 尺度：体育馆取景约 20 px/m（42m 宽）⇒ 标牌高 1.0m = **20px**，
       中文可辨（略小但足够读出"这是什么楼"）。*/
  if (o.name) {
    var nmTex = makeSignTex(o.name, {
      fs: 128, fg: '#F4F1E6', bg: '#2A3138', border: '#5A646E',
      padX: 50, padY: 22
    });
    var nmA = nmTex.image.width / nmTex.image.height;
    var nmH = 1.00, nmW = nmH * nmA;
    if (nmW > W * 0.70) { nmW = W * 0.70; nmH = nmW / nmA; }
    var nm = new THREE.Mesh(new THREE.PlaneGeometry(nmW, nmH),
      mat(0xFFFFFF, { tex: nmTex, rough: 0.74 }));
    nm.position.set(0, cy0 + 1.05, HFD + 0.07);
    nm.castShadow = false; nm.receiveShadow = true;
    g.add(nm);
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ③ makeCourtField —— 球场 / 田径场（场地，不是建筑）
   ──────────────────────────────────────────────────────────────────
   ★ 为什么用**贴图**画场地线：
     §17「亚像素 = 等于没画」—— 标准场地线宽 5cm，在 7.564px/m 下
     是 **0.38px**，用真几何必然看不见。但 §16.2 又指出：
     **严格周期/规则图案用贴图是安全的**（不能平铺的是非周期斑块）。
     场地线是**规则图案** ⇒ 贴图是正确载体，真几何反而是错的。
   ★ 尺度：贴图画在固定像素画布上（每 1m = 8px），所以线宽随场地
     物理尺寸自动缩放 —— 画布上是 2px，落到 100m 的田径场上仍是"可见细线"。
   ══════════════════════════════════════════════════════════════════ */
function makeCourtField(W, D, o) {
  o = o || {};
  var kind = o.kind || 'basketball';
  var PXM = o.pxm === undefined ? 8 : o.pxm;        /* 每米多少贴图像素 */
  var cSurf = o.cSurf === undefined ? 0x3E6E48 : o.cSurf;   /* 场地面色 */
  var cOut  = o.cOut  === undefined ? 0x9C6A4E : o.cOut;    /* 场外/跑道 */
  var cLine = o.cLine === undefined ? 0xE8E8E4 : o.cLine;

  var g = new THREE.Group();
  var CW = Math.max(64, Math.round(W * PXM));
  var CH = Math.max(64, Math.round(D * PXM));
  var cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  var c2 = cv.getContext('2d');
  var hx = function (n) { return '#' + ('000000' + n.toString(16)).slice(-6); };

  /* 底色 = 场外面（跑道/走道） */
  c2.fillStyle = hx(cOut); c2.fillRect(0, 0, CW, CH);

  function rect(px, py, pw, ph, col, lw) {
    c2.strokeStyle = hx(col); c2.lineWidth = lw === undefined ? 2 : lw;
    c2.strokeRect(px, py, pw, ph);
  }
  function line(x1, y1, x2, y2, col, lw) {
    c2.strokeStyle = hx(col); c2.lineWidth = lw === undefined ? 2 : lw;
    c2.beginPath(); c2.moveTo(x1, y1); c2.lineTo(x2, y2); c2.stroke();
  }
  function circle(cx, cy, r, col, lw) {
    c2.strokeStyle = hx(col); c2.lineWidth = lw === undefined ? 2 : lw;
    c2.beginPath(); c2.arc(cx, cy, r, 0, Math.PI * 2); c2.stroke();
  }

  /* ★★★ v22c 重写田径场绘制。
     v22b 用 `arcTo` 拼圆角矩形 —— **画出来是一个畸形梯形**（实测截图）。
     真因：`arcTo` 要求"当前点、控制点、终点"三者构成**切线关系**，
     而我把终点的坐标写成了圆弧**之后**的点 ⇒ 圆弧被拉成斜线。
     ✅ 正解：改用**标准 stadium（跑道形）路径** + `fill`：
        ① 外 stadium 填跑道色
        ② 内 stadium（内缩一个跑道宽）填草地色
        —— 用"填两个同心 stadium"代替"描一个环"，
           不依赖任何切线推导，**不可能退化成斜线**。
     ★ 判据（可复用）：凡是要画"两端半圆的跑道/环形"，一律用
       `moveTo + lineTo + arc(+90°) + lineTo + arc(+180°)`，
       **不要用 arcTo**（arcTo 的参数最容易写错且错了不报错）。 */
  if (kind === 'track') {
    function stadium(x, y, w, h) {
      var rr = h / 2;
      c2.beginPath();
      c2.moveTo(x + rr, y);
      c2.lineTo(x + w - rr, y);
      c2.arc(x + w - rr, y + rr, rr, -Math.PI / 2, Math.PI / 2);
      c2.lineTo(x + rr, y + h);
      c2.arc(x + rr, y + rr, rr, Math.PI / 2, Math.PI * 1.5);
      c2.closePath();
    }
    var pad = Math.min(CW, CH) * 0.045;
    var ow = CW - pad * 2, oh = CH - pad * 2;
    var trackW = oh * 0.17;                      /* 跑道宽（8 道）*/
    /* ① 跑道（外 stadium 填色）*/
    c2.fillStyle = hx(0xA8532F);
    stadium(pad, pad, ow, oh);
    c2.fill();
    /* ② 内场草地（内 stadium 填色）*/
    c2.fillStyle = hx(0x4E7A48);
    stadium(pad + trackW, pad + trackW, ow - trackW * 2, oh - trackW * 2);
    c2.fill();
    /* ③ 分道线 ×5（白色细线，画在两级之间）*/
    for (var L = 1; L <= 4; L++) {
      var lw2 = (trackW / 5) * L;
      c2.strokeStyle = hx(cLine); c2.lineWidth = 1.6;
      stadium(pad + lw2, pad + lw2, ow - lw2 * 2, oh - lw2 * 2);
      c2.stroke();
    }
    /* ④ 内外沿各加一条深色收边（把跑道从"色块"读成"场地"）*/
    c2.strokeStyle = 'rgba(0,0,0,.22)'; c2.lineWidth = 2.2;
    stadium(pad, pad, ow, oh); c2.stroke();
    /* ⑤ 直道端线（100m 起跑线的位置感）*/
    c2.strokeStyle = hx(cLine); c2.lineWidth = 1.6;
    c2.beginPath();
    c2.moveTo(pad + trackW * 0.5, pad + trackW * 1.15);
    c2.lineTo(pad + trackW * 0.5, pad + oh - trackW * 1.15);
    c2.stroke();
    /* ⑥ 内场中场标记 */
    c2.strokeStyle = hx(cLine); c2.lineWidth = 1.6;
    c2.beginPath();
    c2.moveTo(CW / 2, pad + trackW);
    c2.lineTo(CW / 2, pad + oh - trackW);
    c2.stroke();
  } else {
    /* 场地类：外框 + 中心线 + 中圈 + 禁区/发球区 */
    var m = Math.min(CW, CH) * 0.045;
    c2.fillStyle = hx(cSurf);
    c2.fillRect(m, m, CW - m * 2, CH - m * 2);
    rect(m, m, CW - m * 2, CH - m * 2, cLine, 2.5);
    if (kind === 'basketball') {
      line(m, CH / 2, CW - m, CH / 2, cLine, 2.5);
      circle(CW / 2, CH / 2, CH * 0.115, cLine, 2.5);
      var kd = CH * 0.36, kw = CW * 0.175;             /* 禁区（含罚球圈）*/
      rect(m, CH / 2 - kd / 2, kw, kd, cLine, 2.5);
      rect(CW - m - kw, CH / 2 - kd / 2, kw, kd, cLine, 2.5);
      circle(m + kw, CH / 2, CH * 0.115, cLine, 2.5);
      circle(CW - m - kw, CH / 2, CH * 0.115, cLine, 2.5);
      /* 三分弧 */
      c2.strokeStyle = hx(cLine); c2.lineWidth = 2.5;
      c2.beginPath(); c2.arc(m + kw * 0.30, CH / 2, CH * 0.40, -Math.PI / 2.2, Math.PI / 2.2); c2.stroke();
      c2.beginPath(); c2.arc(CW - m - kw * 0.30, CH / 2, CH * 0.40, Math.PI - Math.PI / 2.2, Math.PI + Math.PI / 2.2); c2.stroke();
    } else if (kind === 'tennis') {
      line(CW / 2, m, CW / 2, CH - m, cLine, 2.5);          /* 网 */
      var svc = CH * 0.30;
      rect(m, CH / 2 - svc / 2, CW - m * 2, svc, cLine, 2.0);
      line(m, CH / 2 - svc / 2, CW - m, CH / 2 - svc / 2, cLine, 2.0);
      line(m, CH / 2 + svc / 2, CW - m, CH / 2 + svc / 2, cLine, 2.0);
      /* 单打边线 */
      var ins = (CH - m * 2) * 0.115;
      line(m, m + ins, CW - m, m + ins, cLine, 1.6);
      line(m, CH - m - ins, CW - m, CH - m - ins, cLine, 1.6);
    } else {  /* badminton */
      line(m, CH / 2, CW - m, CH / 2, cLine, 2.5);
      var ns = CW * 0.12;
      line(m + ns, m, m + ns, CH - m, cLine, 2.0);
      line(CW - m - ns, m, CW - m - ns, CH - m, cLine, 2.0);
      rect(m, CH / 2 - CH * 0.21, CW - m * 2, CH * 0.42, cLine, 2.0);
      line(CW / 2, m, CW / 2, CH / 2 - CH * 0.21, cLine, 2.0);
      line(CW / 2, CH / 2 + CH * 0.21, CW / 2, CH - m, cLine, 2.0);
    }
  }

  var tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  var surf = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xFFFFFF, { tex: tex, rough: 0.96 }));
  surf.rotation.x = -Math.PI / 2;
  /* ★★★ v22e：场地平面抬高 0.03m —— 与地台（y=−0.06）拉开 0.09m。
     起因：两者原本都在 y=0 ⇒ **共面 z-fighting**，篮球场地面只剩一条碎块。 */
  surf.position.y = 0.03;
  surf.receiveShadow = true;
  g.add(surf);

  /* 围栏（除田径场外都做）：立柱 0.16m → 1.2px（细但成律动）+ 顶横杆 0.10m
     ★ 判据：单根柱看不见，但**每 3m 一根的排列**会在正交俯视下形成
       "虚线节奏" —— 这正是围栏的可读来源，不依赖单根柱的像素宽。 */
  if (o.fence !== false && kind !== 'track') {
    var mFen = mat(o.cFence === undefined ? 0x6E7478 : o.cFence, { rough: 0.66, metal: 0.22 });
    var postH = o.fenceH === undefined ? 3.0 : o.fenceH;
    var per = [];
    var nx = Math.max(2, Math.round(W / 3.0)), nz = Math.max(2, Math.round(D / 3.0));
    for (var ix = 0; ix <= nx; ix++) {
      var xx = -W / 2 + ix * (W / nx);
      per.push([xx, -D / 2], [xx, D / 2]);
    }
    for (var iz = 1; iz < nz; iz++) {
      var zz = -D / 2 + iz * (D / nz);
      per.push([-W / 2, zz], [W / 2, zz]);
    }
    per.forEach(function (p) {
      var po = box(0.16, postH, 0.16, mFen, p[0], postH / 2, p[1]);
      g.add(po);
    });
    /* 顶横杆（通长，0.10m 高 —— 亚像素宽度但**通长** ⇒ 读成一条细线）*/
    g.add(box(W, 0.10, 0.10, mFen, 0, postH - 0.05, -D / 2));
    g.add(box(W, 0.10, 0.10, mFen, 0, postH - 0.05, D / 2));
    g.add(box(0.10, 0.10, D, mFen, -W / 2, postH - 0.05, 0));
    g.add(box(0.10, 0.10, D, mFen, W / 2, postH - 0.05, 0));
  }

  /* 灯柱 ×4（高 8m、径 0.34m → 2.6px 杆 + 1.4m 灯头 → 10px）
     ★ 灯柱是球场在**俯视图里唯一有高度的东西** ⇒ 它是"这是球场"的锚点。 */
  if (o.lights !== false) {
    var mLight = mat(0x8A6E4E, { rough: 0.62, metal: 0.24 });
    var mLamp  = mat(0xB8BCC0, { rough: 0.42, metal: 0.34 });
    var off = 1.4;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      var px = s[0] * (W / 2 + off), pz = s[1] * (D / 2 + off);
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 8.0, 10), mLight);
      pole.position.set(px, 4.0, pz);
      pole.castShadow = true; pole.receiveShadow = true;
      g.add(pole);
      var head = box(1.40, 0.75, 0.55, mLamp, px, 8.35, pz);
      g.add(head);
      g.add(box(1.55, 0.16, 0.70, mLight, px, 8.80, pz));
    });
  }

  /* 场地标牌（v23 新增）—— 场地类此前**完全没有文字**（探针实测确认）。
     ★ 做成"立柱 + 横牌"，立在场地一角、朝 +Z（取景正面）。
     ★ 尺度：球场取景约 32 px/m（28m 宽）⇒ 牌高 0.80m = **26px**，
       中文可辨。牌上写"场地名 + 中文编号"（如"篮球场 · 壹号场"）。 */
  if (o.name) {
    var cSignTex = makeSignTex(o.name, {
      fs: 120, fg: '#F6F2E4', bg: '#243446', border: '#6E8298',
      padX: 48, padY: 22
    });
    var csA = cSignTex.image.width / cSignTex.image.height;
    var csH = 0.80, csW = csH * csA;
    if (csW > W * 0.55) { csW = W * 0.55; csH = csW / csA; }
    var mPost = mat(0x8A9096, { rough: 0.52, metal: 0.30 });
    var postX = -W / 2 + 1.2, postZ = D / 2 + 1.0;
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 2.40, 10), mPost);
    post.position.set(postX, 1.20, postZ);
    post.castShadow = true; post.receiveShadow = true;
    g.add(post);
    var cs = new THREE.Mesh(new THREE.PlaneGeometry(csW, csH),
      mat(0xFFFFFF, { tex: cSignTex, rough: 0.72 }));
    cs.position.set(postX, 2.10, postZ + 0.06);
    cs.castShadow = false; cs.receiveShadow = true;
    g.add(cs);
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ④ makeStall —— 小吃街小铺 / 快递驿站 / 超市周边（rect/null 的一部分）
   ──────────────────────────────────────────────────────────────────
   ★ 形制：主盒 + **斜挑雨棚** + 招牌横带 + 门口台阶
   ★ 批量差异化靠 `o.hue`（雨棚色相）—— 小吃街 5 家各不同色，
     这是"一条街"与"一排仓库"的分界。
   ★ 尺度：招牌带高 0.55m → 4.2px ✓；雨棚出挑 1.5m → 11px ✓。
   ══════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   街具零件库（v24 新增）
   ──────────────────────────────────────────────────────────────────
   为什么单独抽成函数：8 家店要各自不同的桌椅／摊位／货架，
   而这些零件的几何与"是哪家店"无关 ⇒ 抽出来任意组合。

   ★ 尺度自查（小铺单栋取景约 **133 px/m**，阈值 6px）：
       方桌 1.20×0.75×0.74m → **160×100×98 px**   ✓ 主体件
       方凳 0.34×0.34×0.46m → **45×45×61 px**      ✓
       遮阳伞 Ø2.40m        → **319 px**           ✓ 最大的街道元素
       烤炉 1.70×0.85×0.90m → **226×113×120 px**   ✓
       冷柜 1.30×0.70×1.00m → **173×93×133 px**    ✓
       包裹 0.45m 立方        → **60 px**           ✓
     全部远超阈值 ⇒ 都是清晰实体，不会沦为噪点。
   ══════════════════════════════════════════════════════════════════ */

/* 方桌（桌面 + 4 腿）*/
function propTable(w, d, h, mTop, mLeg) {
  var g = new THREE.Group();
  g.add(box(w, 0.07, d, mTop, 0, h - 0.035, 0));
  var lx = w / 2 - 0.09, lz = d / 2 - 0.09;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
    g.add(box(0.07, h - 0.07, 0.07, mLeg, s[0] * lx, (h - 0.07) / 2, s[1] * lz));
  });
  return g;
}

/* 圆桌 */
function propRoundTable(r, h, mTop, mLeg) {
  var g = new THREE.Group();
  var top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.07, 16), mTop);
  top.position.y = h - 0.035; top.castShadow = true; top.receiveShadow = true;
  g.add(top);
  var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h - 0.07, 10), mLeg);
  leg.position.y = (h - 0.07) / 2; leg.castShadow = true;
  g.add(leg);
  var foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.46, 0.06, 14), mLeg);
  foot.position.y = 0.03; foot.receiveShadow = true;
  g.add(foot);
  return g;
}

/* 方凳 / 高脚凳（omitBack=true 时不做靠背）*/
function propStool(h, mSeat, mLeg) {
  var g = new THREE.Group();
  g.add(box(0.36, 0.06, 0.36, mSeat, 0, h - 0.03, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
    g.add(box(0.05, h - 0.06, 0.05, mLeg, s[0] * 0.14, (h - 0.06) / 2, s[1] * 0.14));
  });
  return g;
}

/* 带靠背的椅子 */
function propChair(h, mSeat, mLeg) {
  var g = propStool(h, mSeat, mLeg);
  g.add(box(0.36, 0.44, 0.05, mSeat, 0, h + 0.22, -0.155));
  [-1, 1].forEach(function (s) {
    g.add(box(0.05, 0.44, 0.05, mLeg, s * 0.14, h + 0.22, -0.155));
  });
  return g;
}

/* 遮阳伞（伞杆 + 圆台伞面 + 伞骨端头）
   ★ 伞面用"圆台"而不是圆锥 —— 圆锥太尖像蘑菇（§24.6 亭的教训同源）。*/
function propUmbrella(r, h, mCanopy, mPole) {
  var g = new THREE.Group();
  var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, h, 8), mPole);
  pole.position.y = h / 2; pole.castShadow = true;
  g.add(pole);
  var can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, r, 0.30, 16, 1, true), mCanopy);
  can.position.y = h - 0.15; can.castShadow = true; can.receiveShadow = true;
  g.add(can);
  var rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.06, 16), mCanopy);
  rim.position.y = h - 0.30; rim.castShadow = true;
  g.add(rim);
  var base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.10, 12), mPole);
  base.position.y = 0.05; base.receiveShadow = true;
  g.add(base);
  return g;
}

/* 立式菜单牌（A 字架）*/
function propMenuBoard(mFrame, mFace) {
  var g = new THREE.Group();
  var a = box(0.62, 0.92, 0.05, mFace, 0, 0.50, 0.12);
  a.rotation.x = -0.16; g.add(a);
  var b = box(0.62, 0.92, 0.05, mFace, 0, 0.50, -0.12);
  b.rotation.x = 0.16; g.add(b);
  g.add(box(0.68, 0.06, 0.06, mFrame, 0, 0.96, 0));
  g.add(box(0.68, 0.06, 0.30, mFrame, 0, 0.03, 0));
  return g;
}

/* 水果筐堆（3 层错位）*/
function propCrateStack(mA, mB) {
  var g = new THREE.Group();
  for (var i = 0; i < 3; i++) {
    var w = 0.52 - i * 0.02;
    g.add(box(w, 0.20, 0.38, (i % 2 ? mB : mA),
      (i % 2 ? 0.05 : -0.05), 0.10 + i * 0.21, 0));
  }
  return g;
}

/* 烤炉（不锈钢槽 + 炭槽 + 烟囱）*/
function propGrill(w, mBody, mTop, mChim) {
  var g = new THREE.Group();
  g.add(box(w, 0.62, 0.80, mBody, 0, 0.31, 0));
  g.add(box(w + 0.06, 0.10, 0.86, mTop, 0, 0.67, 0));
  /* 炭槽（深色，坐在台面上）*/
  g.add(box(w - 0.24, 0.12, 0.52, mChim, 0, 0.74, 0));
  /* 烟囱（后侧立管 + 弯头）*/
  var ch = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.10, 10), mChim);
  ch.position.set(-w / 2 + 0.16, 1.15, -0.30);
  ch.castShadow = true; g.add(ch);
  g.add(box(0.11, 0.11, 0.46, mChim, -w / 2 + 0.16, 2.18, -0.14));
  /* 支脚 */
  [-1, 1].forEach(function (s) {
    g.add(box(0.07, 0.14, 0.07, mChim, s * (w / 2 - 0.12), 0.07, 0.28));
    g.add(box(0.07, 0.14, 0.07, mChim, s * (w / 2 - 0.12), 0.07, -0.28));
  });
  return g;
}

/* 炸锅台（台面 + 双油锅 + 沥油架）*/
function propFryer(w, mBody, mTop, mOil) {
  var g = new THREE.Group();
  g.add(box(w, 0.80, 0.72, mBody, 0, 0.40, 0));
  g.add(box(w + 0.06, 0.09, 0.78, mTop, 0, 0.845, 0));
  [-1, 1].forEach(function (s) {
    var p = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.18, 14), mOil);
    p.position.set(s * (w * 0.23), 0.96, 0.02);
    p.castShadow = true; g.add(p);
  });
  /* 上方沥油架 */
  g.add(box(w - 0.20, 0.05, 0.34, mTop, 0, 1.26, -0.20));
  [-1, 1].forEach(function (s) {
    g.add(box(0.05, 0.32, 0.05, mTop, s * (w / 2 - 0.16), 1.10, -0.20));
  });
  return g;
}

/* 保温柜（玻璃门 + 层架示意）*/
function propCabinet(w, h, mBody, mGlass) {
  var g = new THREE.Group();
  g.add(box(w, h, 0.66, mBody, 0, h / 2, 0));
  g.add(box(w - 0.16, h - 0.30, 0.06, mGlass, 0, h / 2 + 0.04, 0.34));
  for (var i = 1; i <= 2; i++) {
    g.add(box(w - 0.20, 0.04, 0.10, mBody, 0, h * (0.30 + i * 0.22), 0.33));
  }
  return g;
}

/* 立式冷柜（双门）*/
function propFreezer(w, h, mBody, mGlass, mTop) {
  var g = new THREE.Group();
  g.add(box(w, h, 0.72, mBody, 0, h / 2, 0));
  g.add(box(w + 0.05, 0.10, 0.78, mTop, 0, h + 0.05, 0));
  [-1, 1].forEach(function (s) {
    g.add(box(w * 0.44, h - 0.34, 0.06, mGlass, s * w * 0.24, h / 2 + 0.05, 0.37));
  });
  g.add(box(0.06, h - 0.34, 0.06, mBody, 0, h / 2 + 0.05, 0.40));
  return g;
}

/* 包裹堆（大小不一的纸箱，错位堆叠）*/
function propParcelStack(mA, mB, mC) {
  var g = new THREE.Group();
  var MS = [mA, mB, mC];
  var i = 0;
  [[0, 0, 0.46], [0.42, 0, 0.40], [-0.40, 0, 0.38],
   [0.20, 0.46, 0.36], [-0.22, 0.46, 0.34], [0.00, 0.88, 0.30]].forEach(function (p) {
    var s2 = p[2];
    g.add(box(s2, s2 * 0.78, s2 * 0.86, MS[i % 3], p[0], p[1] + s2 * 0.39, 0));
    i++;
  });
  return g;
}

/* 灯笼（串挂用；r 为半径）*/
function propLantern(r, mBody, mGlow) {
  var g = new THREE.Group();
  var b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mBody);
  b.scale.set(1, 0.82, 1); b.castShadow = true; g.add(b);
  g.add(box(r * 0.8, 0.05, r * 0.8, mGlow, 0, r * 0.80, 0));
  g.add(box(r * 0.5, 0.10, r * 0.5, mGlow, 0, -r * 0.80, 0));
  var t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, r * 1.2, 6), mGlow);
  t.position.y = r * 1.5; g.add(t);
  return g;
}

/* 花箱（木箱 + 灌木）*/
function propPlanter(w, mBox, mLeaf, mSoil) {
  var g = new THREE.Group();
  g.add(box(w, 0.42, 0.52, mBox, 0, 0.21, 0));
  g.add(box(w - 0.10, 0.06, 0.42, mSoil, 0, 0.45, 0));
  var n = Math.max(2, Math.round(w / 0.42));
  for (var i = 0; i < n; i++) {
    var r = 0.20 + rnd(i, 9) * 0.09;
    var b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mLeaf);
    b.position.set(-w / 2 + (i + 0.5) * (w / n), 0.45 + r * 0.80, 0);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  }
  return g;
}

/* 排队护栏（两立柱 + 两道横杆）*/
function propRail(len, m) {
  var g = new THREE.Group();
  [-1, 1].forEach(function (s) {
    g.add(box(0.07, 0.95, 0.07, m, s * len / 2, 0.475, 0));
  });
  g.add(box(len, 0.06, 0.05, m, 0, 0.90, 0));
  g.add(box(len, 0.05, 0.05, m, 0, 0.48, 0));
  return g;
}

/* 蒸笼塔（面馆的招牌件）*/
function propSteamer(n, r, mBody, mTop) {
  var g = new THREE.Group();
  for (var i = 0; i < n; i++) {
    var c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 14), mBody);
    c.position.y = 0.07 + i * 0.145; c.castShadow = true; c.receiveShadow = true;
    g.add(c);
  }
  var l = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.05, 14), mTop);
  l.position.y = 0.07 + n * 0.145; l.castShadow = true;
  g.add(l);
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   makeStall —— 小吃街单店（★ v24 重写：**8 种行业形制**）
   ──────────────────────────────────────────────────────────────────
   用户要求：「不同的小吃街，他那个建筑不一样，他奶茶店应该有奶茶店的
     装饰，然后小吃店要有小吃店的装饰，然后门面还有一些桌子椅子等」

   ⇒ 三个阶段做完（v22→v23→v24）：
     v22：8 家 = **同一个盒子 + 换雨棚颜色**（用户否掉："建筑不一样"）
     v23：店名/标语/铺位号/窗贴（文字层）
     v24：**形制分家**（屋顶 4 种 × 门面 5 种）＋ **行业专属装饰**
          ＋ **门口桌椅街具** —— 三家共用一套零件库，按 `kind` 组合

   ★ 形制矩阵（`STALL_FORM`）：
     kind       屋顶      门面        行业装饰
     milktea    双坡      大玻璃橱窗   吧台+高脚凳+菜单牌+遮阳伞
     fruit      平顶挑檐  敞开档口     水果筐堆+冷柜+遮阳伞+圆凳
     bbq        单坡大檐  敞开档口     烤炉+烟囱+长桌+方凳
     fry        平顶      柜台面       炸锅台+保温柜+护栏+方凳
     noodle     双坡瓦顶  大玻璃橱窗   方桌×2+靠背椅+灯笼+蒸笼
     stationery 平顶      玻璃门       展板+海报架
     express    大平顶    卷帘门       包裹堆+推车+靠墙货架
     conv       平顶长条  玻璃幕       冷柜+长凳+垃圾桶

   ★★ 尺度：小铺约 **133 px/m** ⇒ 桌椅（0.74m 高 = 98px）、
     遮阳伞（Ø2.4m = 319px）、烤炉（226×120px）全部**远超阈值**，
     不是点缀而是画面主体的一部分。这是"这条街像不像商业街"的关键。
   ══════════════════════════════════════════════════════════════════ */
var STALL_FORM = {
  milktea:    { roof: 'gable', front: 'glass',   awn: 'slope' },
  fruit:      { roof: 'eave',  front: 'open',    awn: 'slope' },
  bbq:        { roof: 'mono',  front: 'open',    awn: 'none'  },
  fry:        { roof: 'flat',  front: 'counter', awn: 'slope' },
  noodle:     { roof: 'gable', front: 'glass',   awn: 'slope' },
  stationery: { roof: 'flat',  front: 'glass',   awn: 'none'  },
  express:    { roof: 'big',   front: 'shutter', awn: 'band'  },
  conv:       { roof: 'flat',  front: 'glass',   awn: 'band'  }
};

function makeStall(W, D, o) {
  o = o || {};
  var kind = o.kind || 'fry';
  var F = STALL_FORM[kind] || STALL_FORM.fry;
  var H = o.h === undefined ? 4.2 : o.h;
  var cWall  = o.cWall  === undefined ? 0xCFC2A6 : o.cWall;
  var cWallD = o.cWallD === undefined ? 0xB2A488 : o.cWallD;
  var cAwn   = o.cAwn   === undefined ? 0x724336 : o.cAwn;
  var cSign  = o.cSign  === undefined ? 0x2E3A46 : o.cSign;
  var cGlass = o.cGlass === undefined ? 0x2A3642 : o.cGlass;
  var cBase  = o.cBase  === undefined ? 0x8E8880 : o.cBase;

  var g = new THREE.Group();
  var mWall  = mat(cWall,  { rough: 0.88 });
  var mWallD = mat(cWallD, { rough: 0.88 });
  var mRoof  = mat(o.cRoof === undefined ? 0x3A4652 : o.cRoof, { rough: 0.78 });
  var mTrim  = mat(o.cTrim === undefined ? 0x2A3138 : o.cTrim, { rough: 0.72 });
  var mAwn   = mat(cAwn,   { rough: 0.78 });
  var mSign  = mat(cSign,  { rough: 0.70 });
  var mGlass = mat(cGlass, { rough: 0.16, metal: 0.40 });
  var mBase  = mat(cBase,  { rough: 0.95 });
  /* 街具用色（暖木 + 金属 + 织物）*/
  var mWood  = mat(o.cWood  === undefined ? 0xA8763E : o.cWood,  { rough: 0.80 });
  var mWood2 = mat(o.cWood2 === undefined ? 0x8A5C30 : o.cWood2, { rough: 0.82 });
  var mMetal = mat(0x9AA0A6, { rough: 0.42, metal: 0.40 });
  var mMetalD= mat(0x6E747A, { rough: 0.48, metal: 0.34 });
  var mFabric= mat(o.cFabric === undefined ? 0xC4703E : o.cFabric, { rough: 0.88 });
  var mLeaf  = mat(0x4E7A42, { rough: 0.92 });
  var mSoil  = mat(0x5A4A36, { rough: 0.96 });
  var mCard  = mat(0xB99A6E, { rough: 0.92 });
  var mCard2 = mat(0xA8865C, { rough: 0.92 });
  var mGlow  = mat(0xE8C46A, { rough: 0.44, metal: 0.20 });

  var HFD = D / 2;

  /* ① 主体墙 */
  var body = box(W, H, D, mWall, 0, H / 2, 0);
  body.material = [mWallD, mWallD, mWall, mWall, mWallD, mWallD];
  g.add(body);
  g.add(box(W + 0.14, 0.45, D + 0.14, mBase, 0, 0.225, 0));

  /* ② 屋顶（★ v24：4 种形制，这是"建筑不一样"的第一层）*/
  var RH = H;
  if (F.roof === 'flat') {
    g.add(box(W + 0.44, 0.20, D + 0.44, mRoof, 0, RH + 0.10, 0));
    g.add(box(W + 0.60, 0.10, D + 0.60, mTrim, 0, RH + 0.24, 0));
    RH += 0.30;
  } else if (F.roof === 'big') {
    /* 大平顶（快递驿站：出檐深，像临时库房）*/
    g.add(box(W + 1.10, 0.24, D + 1.00, mRoof, 0, RH + 0.12, 0));
    g.add(box(W + 1.26, 0.10, D + 1.16, mTrim, 0, RH + 0.28, 0));
    RH += 0.36;
  } else if (F.roof === 'eave') {
    /* 平顶 + 前挑大檐（水果档：靠檐遮阳）*/
    g.add(box(W + 0.44, 0.20, D + 0.44, mRoof, 0, RH + 0.10, 0));
    var ev = box(W + 0.90, 0.14, 2.00, mRoof, 0, RH + 0.02, HFD + 0.80);
    ev.rotation.x = -0.14; ev.castShadow = true; g.add(ev);
    g.add(box(W + 1.02, 0.10, 0.14, mTrim, 0, RH - 0.12, HFD + 1.72));
    RH += 0.30;
  } else if (F.roof === 'gable') {
    /* 双坡小瓦顶（奶茶店 / 面馆：最"成形"的一种）*/
    var rise = 0.86, hD = HFD + 0.34, L = Math.hypot(hD, rise);
    var th = Math.atan2(rise, hD);
    [1, -1].forEach(function (s) {
      var sl = box(W + 0.56, 0.16, L, mRoof, 0, 0, 0);
      sl.position.set(0, RH + rise / 2 + 0.04, s * hD / 2);
      sl.rotation.x = s * th;
      sl.castShadow = true; sl.receiveShadow = true;
      g.add(sl);
    });
    g.add(box(W + 0.72, 0.16, 0.22, mTrim, 0, RH + rise + 0.08, 0));
    RH += rise + 0.16;
  } else if (F.roof === 'mono') {
    /* 单坡（烤串档：前高后低，像临时铁皮棚）*/
    var rise2 = 0.78, L2 = Math.hypot(D + 0.5, rise2), th2 = Math.atan2(rise2, D + 0.5);
    var sl2 = box(W + 0.50, 0.16, L2, mRoof, 0, 0, 0);
    sl2.position.set(0, RH + rise2 / 2 + 0.04, 0);
    sl2.rotation.x = -th2;                 /* 前(+Z)低、后(−Z)高 */
    sl2.castShadow = true; sl2.receiveShadow = true;
    g.add(sl2);
    g.add(box(W + 0.62, 0.12, 0.20, mTrim, 0, RH + 0.06, HFD + 0.24));
    RH += rise2 + 0.16;
  }

  /* ③ 门面（★ 第二层差异：5 种）*/
  var mSignFace = mat(0xFFFFFF, { rough: 0.74 });   /* 占位，后面换贴图 */
  var gw = Math.min(W * 0.72, W - 0.9);
  if (F.front === 'glass') {
    g.add(box(gw, H * 0.54, 0.10, mGlass, -W * 0.10, 0.45 + H * 0.30, HFD + 0.02));
    g.add(box(W * 0.20, H * 0.68, 0.12, mWallD, W * 0.34, 0.45 + H * 0.34, HFD + 0.03));
    /* 玻璃分格竖梃（0.08m → 10px，读作"门窗分格"）*/
    for (var i = 1; i <= 3; i++) {
      g.add(box(0.08, H * 0.54, 0.14, mBase, -W * 0.10 - gw / 2 + i * gw / 4, 0.45 + H * 0.30, HFD + 0.04));
    }
  } else if (F.front === 'open') {
    /* 敞开档口：不做玻璃，做一个深色内凹的"灶间" */
    g.add(box(gw, H * 0.58, 0.10, mat(0x1E242A, { rough: 0.92 }), 0, 0.45 + H * 0.29, HFD - 0.30));
    g.add(box(gw + 0.24, 0.16, 0.34, mBase, 0, 0.45 + H * 0.58 + 0.08, HFD - 0.16));
  } else if (F.front === 'counter') {
    /* 柜台面（炸物铺：半高台 + 上方敞口）*/
    g.add(box(W - 0.7, 1.02, 0.62, mWallD, 0, 0.51, HFD + 0.18));
    g.add(box(W - 0.6, 0.10, 0.74, mMetal, 0, 1.07, HFD + 0.18));
    g.add(box(W - 0.7, H * 0.30, 0.10, mGlass, 0, 1.30 + H * 0.15, HFD + 0.02));
  } else if (F.front === 'shutter') {
    /* 卷帘门（快递驿站：半开的卷帘 + 轨道）*/
    var sh = box(gw, H * 0.34, 0.10, mMetalD, -W * 0.14, 0.45 + H * 0.62 + H * 0.17, HFD + 0.03);
    g.add(sh);
    for (var k = 1; k <= 5; k++) {
      g.add(box(gw, 0.05, 0.13, mMetal, -W * 0.14, 0.45 + H * 0.62 + k * H * 0.034, HFD + 0.04));
    }
    g.add(box(gw, H * 0.60, 0.10, mat(0x1E242A, { rough: 0.92 }), -W * 0.14, 0.45 + H * 0.30, HFD - 0.28));
  }

  /* ④ 招牌系统（沿用 v23：店名 / 横幅 / 侧招 / 窗贴）*/
  var signY = H - 0.15;
  g.add(box(W + 0.10, 0.72, 0.18, mSign, 0, signY, HFD + 0.07));
  g.add(box(W + 0.16, 0.10, 0.24, mBase, 0, signY + 0.41, HFD + 0.07));
  var storeName = o.storeName || '小铺';
  var nameTex = makeSignTex(storeName, {
    fs: 128, fg: '#F8F4E8', bg: '#1E252C', border: '#79838E', padX: 58, padY: 28
  });
  var nA = nameTex.image.width / nameTex.image.height;
  var nH = 0.50, nW = nH * nA;
  if (nW > W * 0.80) { nW = W * 0.80; nH = nW / nA; }
  faceSign(g, 0, W / 2, HFD, 0, signY, nameTex, { h: nH, w: nW, out: 0.17 });

  var slogan = o.slogan || '欢迎光临';
  var banTex = makeSignTex(slogan, {
    fs: 96, fg: '#3A2A1C', bg: '#E8D9B4', border: '#B89A62', padX: 64, padY: 18
  });
  var bA = banTex.image.width / banTex.image.height;
  var bH = 0.34, bW = bH * bA;
  if (bW > (W + 0.10) * 0.94) { bW = (W + 0.10) * 0.94; bH = bW / bA; }
  faceSign(g, 0, W / 2, HFD, 0, signY - 0.60, banTex, { h: bH, w: bW, out: 0.14 });

  if (o.no) {
    var noTex = makeSignTex(o.no, {
      fs: 128, fg: '#FFF3D6', bg: '#8E3A2A', border: '#C8A24A', padX: 40, padY: 24
    });
    var noA = noTex.image.width / noTex.image.height;
    var noH = 0.52, noW = noH * noA;
    var bx = -(W / 2) + 0.42, bz = HFD + 0.72, by = H * 0.80;
    var mBlade = mat(0xFFFFFF, { tex: noTex, rough: 0.72 });
    var bA1 = new THREE.Mesh(new THREE.PlaneGeometry(noW, noH), mBlade);
    bA1.rotation.y = Math.PI / 2; bA1.position.set(bx, by, bz);
    bA1.castShadow = false; bA1.receiveShadow = true; g.add(bA1);
    var bA2 = new THREE.Mesh(new THREE.PlaneGeometry(noW, noH), mBlade);
    bA2.rotation.y = -Math.PI / 2; bA2.position.set(bx - 0.03, by, bz);
    bA2.castShadow = false; bA2.receiveShadow = true; g.add(bA2);
    g.add(box(0.09, 0.09, 1.25, mBase, bx - 0.015, by + noH * 0.5 + 0.10, HFD + 0.28));
  }

  /* ⑤ 雨棚（3 种做法）*/
  if (F.awn === 'slope') {
    var awn = box(W * 0.94, 0.12, 1.25, mAwn, 0, H * 0.60, HFD + 0.50);
    awn.rotation.x = -0.20; awn.castShadow = true; awn.receiveShadow = true;
    g.add(awn);
    g.add(box(W * 0.94, 0.32, 0.09, mSign, 0, H * 0.60 - 0.34, HFD + 1.08));
    [-1, 1].forEach(function (s) {
      g.add(box(0.12, 0.12, 1.15, mBase, s * W * 0.42, H * 0.44, HFD + 0.52));
      g.add(box(0.14, H * 0.44, 0.14, mBase, s * W * 0.42, H * 0.22, HFD + 0.08));
    });
  } else if (F.awn === 'band') {
    /* 灯箱式横带（便利店 / 驿站）*/
    g.add(box(W + 0.06, 0.46, 0.26, mSign, 0, H * 0.52, HFD + 0.14));
    g.add(box(W + 0.02, 0.36, 0.06, mGlow, 0, H * 0.52, HFD + 0.29));
  }

  /* ══════════════════════════════════════════════════════════════
     ⑥ 行业专属装饰 + 门口街具（★ 本次的主体，用户最在意的部分）
        ★ 分工原则：**装饰说"我是哪家店"，街具说"这里是活的"**。
          装饰放在门面两侧/台面上，街具放在门前 1.4~3.2m 的"外摆区"。
     ══════════════════════════════════════════════════════════════ */
  var FRONT_Z = HFD + 1.40;          /* 外摆区基准线 */

  if (kind === 'milktea') {
    /* 奶茶店：门口吧台 + 高脚凳 + 菜单牌 + 遮阳伞 + 立式杯灯箱 */
    var bar = propTable(W * 0.52, 0.46, 1.06, mWood, mMetalD);
    bar.position.set(-W * 0.10, 0, HFD + 0.62); g.add(bar);
    g.add(box(W * 0.52 + 0.06, 0.10, 0.52, mWood2, -W * 0.10, 1.11, HFD + 0.62));
    for (var s1 = 0; s1 < 3; s1++) {
      var st = propStool(0.72, mWood, mMetalD);
      st.position.set(-W * 0.30 + s1 * 0.62, 0, HFD + 1.05);
      st.rotation.y = Math.PI;                 /* 朝店 */
      g.add(st);
    }
    var mb = propMenuBoard(mWood2, mat(0xE8E2D2, { rough: 0.86 }));
    mb.position.set(W * 0.30, 0, HFD + 0.70); mb.rotation.y = -0.35;
    g.add(mb);
    var um1 = propUmbrella(1.20, 2.60, mat(0xB8643A, { rough: 0.88 }), mMetalD);
    um1.position.set(W * 0.16, 0, FRONT_Z + 0.70); g.add(um1);
    /* 立式奶茶杯灯箱（招牌件）*/
    var cup = new THREE.Group();
    var cb = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.22, 0.76, 16), mat(0xF0E4CC, { rough: 0.62 }));
    cb.position.y = 0.92; cb.castShadow = true; cup.add(cb);
    cup.add(box(0.72, 0.10, 0.72, mSign, 0, 0.50, 0));
    cup.add(box(0.20, 0.54, 0.20, mSign, 0, 1.50, 0));
    cup.add(box(0.66, 0.10, 0.66, mGlow, 0, 1.82, 0));
    cup.position.set(-(W / 2) + 0.52, 0, FRONT_Z + 0.30);
    g.add(cup);
  } else if (kind === 'fruit') {
    /* 水果捞：水果筐堆 + 冷柜 + 遮阳伞 + 圆凳 */
    var cr1 = propCrateStack(mat(0xC86A3A, { rough: 0.88 }), mat(0xD89A4A, { rough: 0.88 }));
    cr1.position.set(-(W / 2) + 0.62, 0, FRONT_Z + 0.20); g.add(cr1);
    var cr2 = propCrateStack(mat(0x7EA64A, { rough: 0.88 }), mat(0xC86A3A, { rough: 0.88 }));
    cr2.position.set(-(W / 2) + 1.34, 0, FRONT_Z + 0.46); g.add(cr2);
    var fz = propFreezer(1.40, 1.05, mWall, mGlass, mMetal);
    fz.position.set(W * 0.28, 0, FRONT_Z - 0.15); g.add(fz);
    var um2 = propUmbrella(1.30, 2.55, mat(0x3E7A62, { rough: 0.88 }), mMetalD);
    um2.position.set(0.1, 0, FRONT_Z + 1.05); g.add(um2);
    for (var s2 = 0; s2 < 2; s2++) {
      var rt = propRoundTable(0.42, 0.74, mWood, mMetalD);
      rt.position.set(-0.9 + s2 * 1.8, 0, FRONT_Z + 1.15); g.add(rt);
      [-1, 1].forEach(function (q) {
        var st2 = propStool(0.46, mWood, mMetalD);
        st2.position.set(-0.9 + s2 * 1.8 + q * 0.72, 0, FRONT_Z + 1.15);
        g.add(st2);
      });
    }
  } else if (kind === 'bbq') {
    /* 烤串档：烤炉 + 烟囱 + 长桌 + 方凳（夜市感）*/
    var gr = propGrill(1.80, mMetal, mMetalD, mat(0x3A3E42, { rough: 0.60, metal: 0.30 }));
    gr.position.set(-W * 0.10, 0, HFD + 0.56); g.add(gr);
    /* 长条桌（外摆）*/
    var lt = propTable(W * 0.72, 0.80, 0.76, mWood, mWood2);
    lt.position.set(0, 0, FRONT_Z + 0.95); g.add(lt);
    for (var s3 = 0; s3 < 4; s3++) {
      [-1, 1].forEach(function (q) {
        var st3 = propStool(0.46, mWood2, mMetalD);
        st3.position.set(-W * 0.28 + s3 * (W * 0.19), 0, FRONT_Z + 0.95 + q * 0.72);
        g.add(st3);
      });
    }
    /* 挂串架（贴着雨棚下的横杆）*/
    g.add(box(W * 0.80, 0.06, 0.06, mMetal, 0, H * 0.60 + 0.10, HFD + 1.15));
    var lant = propLantern(0.20, mat(0xC23A2E, { rough: 0.82 }), mGlow);
    lant.position.set(-W * 0.34, H * 0.60 + 0.30, HFD + 1.15); g.add(lant);
    var lant2 = propLantern(0.20, mat(0xC23A2E, { rough: 0.82 }), mGlow);
    lant2.position.set(W * 0.34, H * 0.60 + 0.30, HFD + 1.15); g.add(lant2);
  } else if (kind === 'fry') {
    /* 炸物铺：炸锅台 + 保温柜 + 排队护栏 */
    var fr = propFryer(1.70, mMetalD, mMetal, mat(0xC8A23A, { rough: 0.32, metal: 0.36 }));
    fr.position.set(-W * 0.14, 0, HFD + 0.52); g.add(fr);
    var cb2 = propCabinet(1.20, 1.45, mMetalD, mGlass);
    cb2.position.set(W * 0.30, 0, HFD + 0.50); g.add(cb2);
    var rl = propRail(2.20, mMetal);
    rl.position.set(-0.2, 0, FRONT_Z + 0.55); g.add(rl);
    for (var s4 = 0; s4 < 2; s4++) {
      var st4 = propStool(0.70, mWood, mMetalD);
      st4.position.set(0.9 + s4 * 0.75, 0, FRONT_Z + 0.30);
      st4.rotation.y = Math.PI;
      g.add(st4);
    }
  } else if (kind === 'noodle') {
    /* 面馆：方桌 + 靠背椅 + 灯笼 + 蒸笼塔（最有"馆子"感）*/
    for (var s5 = 0; s5 < 2; s5++) {
      var tx = -W * 0.20 + s5 * (W * 0.44);
      var tb = propTable(1.10, 0.78, 0.75, mWood, mWood2);
      tb.position.set(tx, 0, FRONT_Z + 0.85); g.add(tb);
      [-1, 1].forEach(function (q) {
        var ch1 = propChair(0.46, mWood2, mMetalD);
        ch1.position.set(tx + q * 0.78, 0, FRONT_Z + 0.85);
        ch1.rotation.y = -q * Math.PI / 2;
        g.add(ch1);
        var ch2 = propChair(0.46, mWood2, mMetalD);
        ch2.position.set(tx, 0, FRONT_Z + 0.85 + q * 0.62);
        ch2.rotation.y = q > 0 ? 0 : Math.PI;
        g.add(ch2);
      });
    }
    var sm = propSteamer(5, 0.42, mWood, mWood2);
    sm.position.set(-(W / 2) + 0.66, 0, HFD + 0.50); g.add(sm);
    [-1, 1].forEach(function (q) {
      var ln = propLantern(0.26, mat(0xC8342A, { rough: 0.82 }), mGlow);
      ln.position.set(q * (W * 0.36), H * 0.66, HFD + 0.86); g.add(ln);
    });
  } else if (kind === 'stationery') {
    /* 文具店：门口展板 + 海报架 + 花箱 */
    var bd = propMenuBoard(mWood2, mat(0xE4DCC8, { rough: 0.86 }));
    bd.position.set(-(W / 2) + 0.60, 0, HFD + 0.62); bd.rotation.y = 0.28; g.add(bd);
    var bd2 = propMenuBoard(mWood2, mat(0xD8D0BC, { rough: 0.86 }));
    bd2.position.set((W / 2) - 0.60, 0, HFD + 0.62); bd2.rotation.y = -0.28; g.add(bd2);
    /* 立式海报架 ×2 */
    [-1, 1].forEach(function (q) {
      var po = new THREE.Group();
      po.add(box(0.70, 1.30, 0.06, mat(0xE8E4DA, { rough: 0.86 }), 0, 1.00, 0));
      po.add(box(0.80, 0.08, 0.50, mMetalD, 0, 0.04, 0));
      po.add(box(0.08, 1.00, 0.08, mMetalD, 0, 0.52, -0.14));
      po.position.set(q * (W * 0.30), 0, FRONT_Z + 0.45);
      po.rotation.y = -q * 0.22;
      g.add(po);
    });
    var pl = propPlanter(1.10, mWood2, mLeaf, mSoil);
    pl.position.set(0, 0, FRONT_Z + 1.25); g.add(pl);
  } else if (kind === 'express') {
    /* 快递驿站：包裹堆 + 推车 + 靠墙货架 */
    var pk = propParcelStack(mCard, mCard2, mat(0xC4A47A, { rough: 0.92 }));
    pk.position.set(-(W / 2) + 0.90, 0, FRONT_Z + 0.10); g.add(pk);
    var pk2 = propParcelStack(mCard2, mat(0xC4A47A, { rough: 0.92 }), mCard);
    pk2.position.set((W / 2) - 0.95, 0, FRONT_Z + 0.30);
    pk2.rotation.y = 0.5;
    g.add(pk2);
    /* 手推车 */
    var tc = new THREE.Group();
    tc.add(box(1.05, 0.06, 0.62, mMetal, 0, 0.52, 0));
    tc.add(box(1.05, 0.30, 0.06, mMetalD, 0, 0.70, -0.28));
    tc.add(box(0.06, 0.30, 0.62, mMetalD, -0.50, 0.70, 0));
    tc.add(box(0.06, 0.30, 0.62, mMetalD, 0.50, 0.70, 0));
    tc.add(box(0.06, 0.86, 0.06, mMetalD, 0.50, 0.94, -0.28));
    [-1, 1].forEach(function (q) {
      g.add(tc);
      var w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 12), mMetalD);
      w1.rotation.z = Math.PI / 2;
      w1.position.set(q * 0.36, 0.13, -0.24);
      tc.add(w1);
    });
    var w2 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 12), mMetalD);
    w2.rotation.z = Math.PI / 2; w2.position.set(0, 0.13, 0.26); tc.add(w2);
    tc.position.set(0, 0, FRONT_Z + 0.95);
    tc.rotation.y = 0.22;
    g.add(tc);
    var rl2 = propRail(2.60, mMetal);
    rl2.position.set(0, 0, FRONT_Z + 1.55); g.add(rl2);
  } else if (kind === 'conv') {
    /* 便利店：门口冷柜 + 长凳 + 垃圾桶 + 花箱 */
    var fz2 = propFreezer(1.50, 1.10, mWall, mGlass, mMetal);
    fz2.position.set(-(W * 0.30), 0, FRONT_Z - 0.20); g.add(fz2);
    var bn = new THREE.Group();
    bn.add(box(1.60, 0.08, 0.42, mWood, 0, 0.44, 0));
    [-1, 1].forEach(function (q) {
      bn.add(box(0.08, 0.44, 0.42, mWood2, q * 0.76, 0.22, 0));
    });
    bn.position.set(W * 0.22, 0, FRONT_Z + 0.55); g.add(bn);
    var bin = new THREE.Group();
    var bb = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.78, 14), mat(0x3E5A46, { rough: 0.72 }));
    bb.position.y = 0.39; bb.castShadow = true; bin.add(bb);
    bin.add(box(0.60, 0.08, 0.60, mSign, 0, 0.82, 0));
    bin.position.set(W * 0.02, 0, FRONT_Z + 1.05); g.add(bin);
    var pl2 = propPlanter(1.20, mWood2, mLeaf, mSoil);
    pl2.position.set(-(W / 2) + 0.80, 0, FRONT_Z + 1.20); g.add(pl2);
    var um3 = propUmbrella(1.15, 2.45, mat(0x3E5A86, { rough: 0.88 }), mMetalD);
    um3.position.set(W * 0.30, 0, FRONT_Z + 1.30); g.add(um3);
  }

  /* ⑦ 统一的门口台阶（所有店都有，把"店"和"街"接上）*/
  g.add(box(W + 0.30, 0.14, 1.40, mBase, 0, 0.07, HFD + 0.70));

  return g;
}

/* ══════════════════════════════════════════════════════════════════
   ⑤ makeUComplex —— U 形三翼围合（U/tower ×3：教学楼一/二/三）
   ──────────────────────────────────────────────────────────────────
   ★ 复用 `makeTower` ×3 + `skyBridge` ×2（实验楼那套已验收的构件），
     但**整体换色板**（米黄墙）且**屋顶改平顶** ⇒ 与实验楼分家。
   ★ 内院铺装用地面 plane + 铺装缝贴图（规则图案 ⇒ 安全）。
   ══════════════════════════════════════════════════════════════════ */
function makeUComplex(o) {
  o = o || {};
  var NW = o.NW === undefined ? 30 : o.NW;      /* 北翼宽（东西向）*/
  var ND = o.ND === undefined ? 13 : o.ND;      /* 北翼进深 */
  var SW = o.SW === undefined ? 13 : o.SW;      /* 侧翼宽 */
  var SD = o.SD === undefined ? 22 : o.SD;      /* 侧翼进深（南北向）*/
  var nf = o.floors || 6;
  var gap = o.gap === undefined ? 15.0 : o.gap;    /* 侧翼中心到中轴的距离 */

  var g = new THREE.Group();
  var pal = PAL[o.palette || 'academic'];
  var roofOpts = {
    cSlab: 0x707074, cPar: 0xA29680, cCoping: 0xB2A68E,
    cEquip: 0x828890, cEquipD: 0x6A7078, parapetH: 0.95
  };

  /* 三翼：全部走 withPalette + flatRoof */
  var mk = function (W_, D_, opt) {
    return withPalette(pal, function () {
      return makeTower(W_, D_, opt);
    });
  };

  var north = mk(NW, ND, {
    floors: nf, bays: Math.max(4, Math.round(NW / 4.4)),
    entry: true, entryDir: 0, name: o.nameA || '教学楼', nameDir: 0,
    stair: [-NW * 0.28, 0], ac: true, flatRoof: true, flatRoofOpts: roofOpts
  });
  north.position.set(0, 0, -gap + SD * 0.10);
  g.add(north);

  var west = mk(SW, SD, {
    floors: nf, bays: Math.max(3, Math.round(SD / 4.4)),
    entry: true, entryDir: 1, name: o.nameB || '', nameDir: 1,
    stair: [0, SD * 0.24], ac: true, flatRoof: true, flatRoofOpts: roofOpts
  });
  west.position.set(-gap, 0, -(gap * 0.10) + (SD - ND) * 0.5 - 1.0);
  g.add(west);

  var east = mk(SW, SD, {
    floors: nf, bays: Math.max(3, Math.round(SD / 4.4)),
    entry: true, entryDir: 3, name: o.nameC || '', nameDir: 3,
    stair: [0, SD * 0.24], ac: true, flatRoof: true, flatRoofOpts: roofOpts
  });
  east.position.set(gap, 0, -(gap * 0.10) + (SD - ND) * 0.5 - 1.0);
  g.add(east);

  /* 转角连廊 ×2（用与实验楼同一套 skyBridge，但换色）*/
  var BRY = 3.9 * 1.5 + 0.55;
  [-1, 1].forEach(function (s) {
    var gb = withPalette({ gallery: 0xC8C4BC, galleryE: 0x9EA098, galleryD: 0x7E8088 },
      function () { return skyBridge(5.6, { w: 2.9, h: 3.1 }); });
    gb.position.set(s * gap, BRY, -gap + ND * 0.5 + 1.6);
    g.add(gb);
  });

  /* 内院铺装（规则方格贴图 + 一条主轴）*/
  var CW = gap * 2 - SW - 1.2, CD = SD - 1.4;
  var cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  var c2 = cv.getContext('2d');
  c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, 256, 256);
  c2.strokeStyle = 'rgba(0,0,0,.10)'; c2.lineWidth = 1.6;
  for (var i = 0; i <= 3; i++) {
    var p = i * (256 / 3);
    c2.beginPath(); c2.moveTo(p, 0); c2.lineTo(p, 256); c2.stroke();
    c2.beginPath(); c2.moveTo(0, p); c2.lineTo(256, p); c2.stroke();
  }
  var tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(CW / 7.2, CD / 7.2);
  var yard = new THREE.Mesh(new THREE.PlaneGeometry(CW, CD),
    mat(0x8E8A82, { tex: tex, rough: 0.95 }));
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(0, 0.02, -gap + ND * 0.5 + SD * 0.5 - 0.4);
  yard.receiveShadow = true;
  g.add(yard);

  /* 内院中心圆坛（一块圆形绿岛 + 一圈收边）—— 让庭院不空 */
  var yc = yard.position;
  var isl = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.30, 28),
    mat(0x9A9488, { rough: 0.94 }));
  isl.position.set(yc.x, 0.17, yc.z);
  isl.castShadow = true; isl.receiveShadow = true;
  g.add(isl);
  var grn = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.22, 28),
    mat(0x5E7E48, { rough: 0.96 }));
  grn.position.set(yc.x, 0.36, yc.z);
  grn.receiveShadow = true;
  g.add(grn);
  return g;
}
