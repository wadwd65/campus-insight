/* ══════════════════════════════════════════════════════════════════════
   v13 · 屋顶（★ 按 1536×1536 原图放大后**重写**）
   ══════════════════════════════════════════════════════════════════════
   ★★★ 本轮精读纠正：
     | v12 | 实拍真值 |
     |---|---|
     | 屋面板宽 0.42m | **约 1.2m**（q-facade 右侧大屋面，板缝清晰可数）|
     | 板缝是**亮凸条** | 板缝是**深色细缝**（0.02~0.03m 宽，压得很深）|
     | 正脊/戗脊是**亮色** | 脊瓦比坡面**略暗**（深灰蓝），是"压边"不是"亮条"|
     | 出檐 1.35m | **约 1.0~1.2m**，且檐口有**深蓝灰封边带** |
     | 无双坡的屋脊压条 | 有 **屋脊压条**（贴合在正脊上，比坡面暗 0.08）|

   ★ 屋面做法（实拍 q-facade 右侧大屋面）：
     一块"大坡面" = 金属锁边屋面板密铺（板宽 1.2m），
     板与板之间有**深色细缝**，板面本身有**极淡的纵向拉丝**。
     ⇒ 用 **一张贴图** 表达板缝（比 geometric 板条省 90% 三角形，
       且不会出现 v12 那种"亮条纹"误解）。
     但**檐口压条 / 正脊压条 / 戗脊** 用**真几何**（它们在轮廓上，必须准）。
   ══════════════════════════════════════════════════════════════════════ */

/* ── 金属屋面贴图（板缝 + 板面明暗微差 + 端部搭接）─────────────────
   ★★★ v16l 重做（放大读图 + 尺寸换算）：v15 的屋面在屏幕上**是一整块均匀板**。
     诊断（换算而非感觉）：
       · 贴图 256px 铺在 **4.8m** 上 ⇒ 1px = 18.75mm
       · v15 板缝宽 2px = **37.5mm** ⇒ 在屏幕上（≈7px/m）只有 **0.26px**
       · ⇒ **被 mipmap 完全平均掉**，所以"板缝根本不存在"。
     ✅ 三条修法：
       ① **板缝 2px → 5px**（= 94mm，真实直立锁边板缝含折边约 60~90mm ✓ 合理），
          α 0.30 → 0.44（在屏幕上 ≈ 0.7px，**刚好在可辨识边缘**，配合 aniso=8）
       ② ★★★ **板面明暗微差**（这是最关键的一条）：每块板给一个**独立亮度**，
          幅度 ±7%。真实金属板每块的**安装角度/受光**都略有差异，
          这个微差让屋面从"一整块"变成"一块一块"——**这是"金属感"的真正来源**。
          （与树冠的"顶点色"是同一个道理：破掉均匀材质。）
       ③ **端部搭接的横向暗带**：每 128px 一条 2.5px 的 α .14 横线
          （板长方向搭接，真实金属屋面每隔几米必有一条）
       ④ 折边高光/背光从 1.4px 加到 2.2px（跟着板缝一起加宽） */
function makeMetalRoofTex() {
  var cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  var c2 = cv.getContext('2d');
  c2.fillStyle = '#ffffff';
  c2.fillRect(0, 0, 256, 256);

  /* ★★★ v25：板宽 1.2m → **0.40m**（棱距加密 3 倍）
     ──────────────────────────────────────────────────────────────
     依据 `BUILDING-SPEC.md`「一、全局结论」对实验楼屋面的二次精读：
       「屋面肌理（原记录漏）| 直立锁边竖棱**极密**（约 **0.4~0.5m 一道**），
        远比 v1 做的 1.2m 密。**密集竖棱是俯视下"金属感"的唯一来源**」
     ⇒ 贴图物理尺寸固定 4.8m（世界尺度已编进 UV），只改"一张贴图里几块板"：
       · 4 块  ⇒ 板宽 1.2m（旧）
       · 12 块 ⇒ 板宽 **0.40m** ✓
     ⚠️ 这张贴图是**实验楼与公寓共用**的单例（ROOF_TEX），
        所以实验楼的屋面肌理也会一起变密 —— 这是**按实拍修正**，
        不是回归（规范明确记着 1.2m 是错的）。 */
  var NB = 12, BW = 256 / NB;
  for (var b = 0; b < NB; b++) {
    var dk = (rnd(b, 501) - 0.5) * 0.14;          /* ±7% */
    c2.fillStyle = dk >= 0
      ? 'rgba(255,255,255,' + (dk * 1.6).toFixed(3) + ')'
      : 'rgba(0,0,0,' + (-dk * 1.6).toFixed(3) + ')';
    c2.fillRect(b * BW, 0, BW, 256);
  }

  /* 板缝：竖线（沿 y 方向通长），每 BW px 一条 = 1 块板。
     ★ 线宽必须跟着板宽同比缩 —— 21px 宽的板配 5px 的缝会糊成一片。
       取 缝 2.0 + 高光 0.9 + 背光 0.9，与旧版（64px 板配 5/2.2/2.2）比例一致。 */
  for (var i = 0; i < NB; i++) {
    var x = i * BW;
    c2.fillStyle = 'rgba(0,0,0,.44)';
    c2.fillRect(x, 0, 2.0, 256);
    c2.fillStyle = 'rgba(255,255,255,.30)';
    c2.fillRect(x + 2.0, 0, 0.9, 256);
    c2.fillStyle = 'rgba(0,0,0,.16)';
    c2.fillRect(x - 0.9, 0, 0.9, 256);
    /* 板面中线极淡的高光（板本身微微起拱）*/
    c2.fillStyle = 'rgba(255,255,255,.09)';
    c2.fillRect(x + BW * 0.50, 0, BW * 0.40, 256);
  }
  /* 板面纵向拉丝（极淡，给"金属"一点方向感）*/
  for (var k = 0; k < 220; k++) {
    var yy = rnd(k, 21) * 256;
    c2.fillStyle = 'rgba(0,0,0,' + (0.008 + rnd(k, 22) * 0.014).toFixed(3) + ')';
    c2.fillRect(0, yy, 256, 1);
  }
  /* ★③ 板端横向接缝（每 128px 一道 = 板长方向搭接）★ v16l：1.6px → 2.5px，α 加浓 */
  c2.fillStyle = 'rgba(0,0,0,.16)';
  c2.fillRect(0, 0, 256, 2.5);
  c2.fillRect(0, 128, 256, 2.5);
  c2.fillStyle = 'rgba(255,255,255,.14)';
  c2.fillRect(0, 2.5, 256, 1.6);
  c2.fillRect(0, 130.5, 256, 1.6);

  var t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  t.repeat.set(1, 1);      /* ★ 世界坐标已编进 UV，repeat 必须为 1 */
  return t;
}

/* ★ 全局单例：屋面贴图（所有坡面共用，省内存；UV 自带尺度，无需 per-face repeat）*/
var ROOF_TEX = makeMetalRoofTex();

/* ── 砖墙贴图（★★★ v14 重写 —— 这是"玩具感"的第一真凶）
   ────────────────────────────────────────────────────────────────
   ★ v13 的两个致命错误（DIAG-v14 ②）：

   ① **砖小了 3.9 倍**（真凶，不是配色！）
      实拍：一层楼（3.9m）排 **约 19 行砖**；一张 1.0m 高的贴图排 19 行
            ⇒ 贴图物理高应该是 **1.0m 对应 19 行**，但 v13 把这张贴图
              铺在 **1.0m** 上、而 repeat.y 又按 `h/1.0` = 19.5 ⇒
              整个 19.5m 高的墙铺了 19.5 张 = **370 行砖**
              ⇒ 每行砖只有 5cm 高 ⇒ 远看糊成纯色。
      ⚠️ 我 v13 的注释里写着"一张贴图 = 1.6m×1.0m（砖 200×55mm）"，
         但 **55mm 的砖行在 19.5m 高的墙上就是 354 行** —— 这是**物理上算错**，
         不是参数没调好。（标准砖 240×115×53mm，53mm 是砖厚、不是行高；
         砌筑行高 = 53 + 10 灰缝 = **63mm**，19.5m / 0.063 ≈ **310 行**）
      ⇒ **正解**：贴图做成 **1.6m × 1.6m 含 25 行砖**（一行 = 64mm ✓ 接近真值 63mm）
         repeat.y = 墙高 / 1.6

   ② **配色发白泛粉**：v13 基色 rgb(214,146,110)，实拍直方图主峰 (156,84,72)
      ⇒ R −58、G −62、B −38。v14 改为 rgb(168,90,72)。
   ──────────────────────────────────────────────────────────────── */
var BRICK_TILE_M = 1.6;    /* ★ 一张贴图的物理尺寸（米）—— 立面/结构体都用它算 repeat */

function makeBrickTex(seed, neutral) {
  var cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  var c2 = cv.getContext('2d');

  /* ★★★ v19 新增 `neutral` 模式（关键修正）：
     ──────────────────────────────────────────────────────────────
     旧版把砖色**写死成 (168,90,72) 砖红** ⇒ 材质 color 再乘上去就是
     「白 × 砖红 = 砖红」⇒ **材质 color 完全失效**。后果：任何"换墙色"的
     方案（如公寓改成卡其）都**做不出来**，两套色板渲染结果逐像素相同。
     ★ 根因链：色板写的 AC.wallLit 从头到尾没被调用过；
       真颜色在贴图里，而贴图不吃参数。
     ✅ 正解：`neutral=true` 时贴图只画**中性灰阶**（保留砖缝/高光/暗线的
       全部明度结构，但 R=G=B）⇒ **色彩由材质 color 单独承担**。
       这样既不会双重相乘（贴图无彩度），又让色板真正可控：
       **改墙色 = 改一个十六进制值，不用重画贴图**。
     ★ 默认（neutral 省略/false）保持旧行为（砖红贴图），v18 实验楼零回归。 */
  var NEUTRAL = !!neutral;
  /* 底色 = 灰缝色（★ 实拍是**暖灰褐**，不是亮米白）*/
  c2.fillStyle = NEUTRAL ? '#b4b4b4' : '#b8a48c';
  c2.fillRect(0, 0, 256, 256);

  /* 砖：错缝排列。一张贴图 1.6m×1.6m = 256px
     · 行数 25 ⇒ 行高 = 256/25 = 10.24px ⇒ 物理 64mm ✓（实拍砌筑行高 63mm）
     · 砖长取 5 列 ⇒ 每块 51.2px ⇒ 物理 320mm（略大于标准砖 240，含灰缝观感更"砖"）
     · 灰缝 1px（物理 6mm，合理）*/
  var ROWS = 25, COLS = 5;
  var BH = 256 / ROWS, BW = 256 / COLS, GAP = 1.1;

  for (var row = 0; row < ROWS; row++) {
    var off = (row % 2) ? -BW / 2 : 0;
    for (var col = -1; col <= COLS; col++) {
      var x = col * BW + off, y = row * BH;
      /* 砖色：在实拍基色 168,90,72 上做**小幅**明度抖动
         ★ v13 的抖动范围 0.86~1.14（±14%）太大 ⇒ 远看像噪声；
           实拍砖的色差其实很小，主要靠**灰缝**分层。收紧到 0.92~1.08。*/
      var k = rnd(col * 13 + row * 29 + (seed || 0) * 7, 5);
      var v = 0.92 + k * 0.16;
      var r, g, b;
      if (NEUTRAL) {
        /* 中性灰：用砖红的**相对明度**换算成灰阶，保持完全相同的明暗结构
           （0.2126R+0.7152G+0.0722B，基色 (168,90,72) → 111.0）*/
        var lum = Math.round(111.0 * v);
        r = g = b = Math.min(255, lum);
      } else {
        r = Math.min(255, Math.round(168 * v));
        g = Math.min(255, Math.round(90 * v));
        b = Math.min(255, Math.round(72 * v));
      }
      c2.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      c2.fillRect(x + GAP, y + GAP, BW - GAP, BH - GAP);
      /* ★ v14 新增：每块砖**顶边一道极淡高光** —— 实拍砖有立体感
         （砖是凸出灰缝的，上缘受光）。这是"砖感"的关键，v13 完全没有。*/
      c2.fillStyle = NEUTRAL ? 'rgba(255,255,255,.13)' : 'rgba(255,235,215,.13)';
      c2.fillRect(x + GAP, y + GAP, BW - GAP, 0.9);
      /* 下缘一道极淡暗线（砖下沿的阴影）*/
      c2.fillStyle = NEUTRAL ? 'rgba(20,20,20,.16)' : 'rgba(60,30,20,.16)';
      c2.fillRect(x + GAP, y + BH - GAP - 0.9, BW - GAP, 0.9);
    }
  }
  var t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  return t;
}

/* ── 四坡庑殿顶（v15：正脊沿**长边**，修正 a<b 时正脊长度为负的致命 bug）
   ────────────────────────────────────────────────────────────────
   ★★ v15 修异常 [I]（由 gate-geometry.cjs 手算暴露）：
     v14 的 rise 用 `b·tan(ang)`、正脊用 `min(a·0.34, a−b·0.85)`，
     这套公式**只在 a > b（W > D，即建筑沿 X 长）时成立**。
     西楼/东楼是 12×20（**沿 Z 长**）⇒ a=6.75 < b=10.75
       ⇒ r = min(2.30, 6.75−9.14) = **−2.39**（负数！）
       ⇒ 正脊两点 R1=[2.39, rise, 0] / R2=[−2.39, rise, 0] **顺序颠倒**，
         且 rise 被算成 5.60m（用的是长边的一半）⇒ 屋面高度**虚高 60%**。
     ✅ 正解：把"长边"和"短边"显式区分：
        · 正脊沿**长边**方向
        · rise 由**短边**（半跨）决定（坡从檐到脊的水平距离 = 短边半长）
        · 正脊半长 r = 长边半长 × RIDGE_RATIO，且必然 ≤ 长边半长 − 短边半长
     为了让"长边是 X 还是 Z"都能正确，本函数内部统一按
     **(水平轴 = 长边)** 建模，若长边是 Z 则整组绕 Y 旋转 90°。 */
function hipRoof(W, D, eaveY, o) {
  o = o || {};
  var E = o.eave === undefined ? EAVE_OUT : o.eave;
  var ang = o.ang === undefined ? ROOF_ANG : o.ang;
  var thick = 0.30;

  /* ★★★ v19 新增：可选色板覆盖 `o.roofC`
     ──────────────────────────────────────────────────────────────
     背景：pick('roofLit') 等在**加载时**就固化成材质实例，公寓的坡屋顶版本
       需要"与实验楼同色但可按方案切换"。直接改 M 会污染实验楼。
     ✅ 做法：传 o.roofC = { lit, dark, shade, ridge, ridgeHi, eaveBand } 时，
       本函数**临时用新材质**替换局部引用；不传则完全沿用旧行为（零回归）。 */
  var RM = null;
  if (o.roofC) {
    var rc = o.roofC;
    RM = {
      roofLit:  mat(rc.lit,      { rough: 0.56, metal: 0.26 }),
      roofDark: mat(rc.dark,     { rough: 0.56, metal: 0.26 }),
      roofShd:  mat(rc.shade,    { rough: 0.66, metal: 0.14 }),
      ridge:    mat(rc.ridge,    { rough: 0.50, metal: 0.28 }),
      ridgeHi:  mat(rc.ridgeHi,  { rough: 0.25, metal: 0.62 }),
      eaveBand: mat(rc.eaveBand, { rough: 0.52, metal: 0.24 })
    };
  }
  function pick(name) { return RM ? RM[name] : M[name]; }

  /* 判断长边方向：长边沿 X（W≥D）时不转；沿 Z（D>W）时整体转 90° */
  var longIsX = (W + 2 * E) >= (D + 2 * E);
  var LONG = longIsX ? (W + 2 * E) : (D + 2 * E);   /* 长边总长 */
  var SHORT = longIsX ? (D + 2 * E) : (W + 2 * E);  /* 短边总长 */
  var a = LONG / 2, b = SHORT / 2;
  var rise = b * Math.tan(ang);                      /* ★ 由**短边半跨**决定 */
  /* 正脊半长：既要按实拍比例(34%)，又不能超过 (长边半长 − 短边半长) */
  var r = Math.min(a * RIDGE_RATIO, a - b * 0.92);
  if (r < 0.60) r = 0.60;

  var g = new THREE.Group();
  g.position.y = eaveY;
  /* 长边是 Z 时，把"以 X 为长边"建好的模型转 90° 对齐 */
  if (!longIsX) g.rotation.y = Math.PI / 2;

  var A = [-a, 0, -b], B = [a, 0, -b], C = [a, 0, b], Dp = [-a, 0, b];
  var R1 = [-r, rise, 0], R2 = [r, rise, 0];

  /* 屋面材质（带板缝贴图）
     ★★★ v13b 修正（v13 截图：**板缝完全看不见**）
       真因：UV 我用了世界坐标 `(x/4.8, z/4.8)` —— 已经把"4.8m 一张贴图"
             编进 UV 了；同时又设了 `tex.repeat.set(span/4.8, slope/4.8)`
             ⇒ **两次缩放叠加**，贴图被压到 1/N，板缝糊成纯色。
       正解（二选一，本项目选前者）：
         · **UV 用世界坐标，repeat 保持 (1,1)** ← 已采用，最简单
       ⚠️ 注意 UV 的 v 必须对应"坡向"，否则板缝方向错（见 §11.1 教训）。
          南北坡的坡向是 ±Z ⇒ v 用 z；东西坡的坡向是 ±X ⇒ v 用 x。
          为让同一张贴图在两个方向都对，**不旋转贴图**而是**分别用两个纹理**：
            texX（板缝沿 v=z 方向）用于南北坡
            texZ（把条纹转 90°）用于东西坡
          但四坡顶的两组坡方向本来就不同，这里简单起见：
            **统一让板缝沿 z 方向**（南北坡正确，东西坡的板缝方向会差 90°，
            但东西坡是三角形小面，观感影响很小）。 */
  function roofMat(dark) {
    var m = (dark ? pick('roofDark') : pick('roofLit')).clone();
    m.map = ROOF_TEX;
    m.needsUpdate = true;
    return m;
  }

  var faces = [
    { pts: [Dp, C, R2, R1], span: W, slope: b / Math.cos(ang) * 1.0, dark: false },  /* 南坡 */
    { pts: [B, A, R1, R2], span: W, slope: b / Math.cos(ang) * 1.0, dark: true },    /* 北坡 */
    { pts: [C, B, R2], span: D, slope: Math.sqrt((a - r) * (a - r) + rise * rise), dark: true }, /* 东 */
    { pts: [A, Dp, R1], span: D, slope: Math.sqrt((a - r) * (a - r) + rise * rise), dark: false } /* 西 */
  ];

  function normalOf(pts) {
    var v1 = new THREE.Vector3().fromArray(pts[1]).sub(new THREE.Vector3().fromArray(pts[0]));
    var v2 = new THREE.Vector3().fromArray(pts[2]).sub(new THREE.Vector3().fromArray(pts[0]));
    var n = new THREE.Vector3().crossVectors(v1, v2).normalize();
    if (n.y < 0) n.negate();
    return n;
  }

  faces.forEach(function (f) {
    var n = normalOf(f.pts);
    var up = f.pts.map(function (p) { return [p[0] + n.x * thick / 2, p[1] + n.y * thick / 2, p[2] + n.z * thick / 2]; });
    var dn = f.pts.map(function (p) { return [p[0] - n.x * thick / 2, p[1] - n.y * thick / 2, p[2] - n.z * thick / 2]; }).reverse();

    var upMat = roofMat(f.dark);
    [up, dn].forEach(function (poly, idx) {
      var geo = new THREE.BufferGeometry();
      var verts = [], idxs = [];
      poly.forEach(function (p) { verts.push(p[0], p[1], p[2]); });
      for (var i = 1; i < poly.length - 1; i++) {
        if (idx === 0) idxs.push(0, i, i + 1); else idxs.push(0, i + 1, i);
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idxs);
      geo.computeVertexNormals();
      /* ★ UV：用世界 XZ 投影做平面映射 —— 保证板缝方向沿坡向
         （板缝贴图里的竖线沿贴图 y 轴 ⇒ UV.v 必须对应"坡向"）*/
      var uv = [];
      poly.forEach(function (p) {
        uv.push(p[0] / 4.8, p[2] / 4.8);
      });
      /* 对南北坡（屋脊沿 X）板缝应沿 Z ⇒ 用 (x,z) 直接映射即可；
         对东西坡（三角）板缝沿 X ⇒ 也是 (x,z)，方向自动正确 */
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      var mm = new THREE.Mesh(geo, idx === 0 ? upMat : pick('roofShd'));
      mm.castShadow = true; mm.receiveShadow = true;
      g.add(mm);
    });

    /* 檐口封边（侧面带）*/
    var sideGeo = new THREE.BufferGeometry();
    var sv = [], si = [];
    f.pts.forEach(function (p) {
      sv.push(p[0] + n.x * thick / 2, p[1] + n.y * thick / 2, p[2] + n.z * thick / 2);
      sv.push(p[0] - n.x * thick / 2, p[1] - n.y * thick / 2, p[2] - n.z * thick / 2);
    });
    for (var k = 0; k < f.pts.length; k++) {
      var k2 = (k + 1) % f.pts.length;
      si.push(k * 2, k2 * 2, k * 2 + 1);
      si.push(k2 * 2, k2 * 2 + 1, k * 2 + 1);
    }
    sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    sideGeo.setIndex(si);
    sideGeo.computeVertexNormals();
    var sm = new THREE.Mesh(sideGeo, pick('eaveBand'));
    sm.castShadow = true; sm.receiveShadow = true;
    g.add(sm);
  });

  /* ── 正脊压条（★ v13：改**暗色**，是"压边"不是"亮条"）
     ★★★ v15c 修异常 [N]：v14 用 `2r+0.6` —— 比正脊每端长出 0.30，
       而四条戗脊正好从 R1/R2 出发 ⇒ 压条**盖住戗脊根部 0.30m**，
       交叠处露出一块亮白端面（放大图里那个刺眼的白三角）。
     ✅ 正解：压条长度 = 正脊净长 + 只留 0.10 的咬合，让戗脊能"接"上去。
     ★★★ v15c 修异常 [O]：宽度 0.86 太宽（正脊两侧坡面各被盖 0.43m）。
       实拍正脊瓦宽约 0.42m。改 0.46。 */
  g.add(box(2 * r + 0.20, 0.26, 0.46, pick('ridge'), 0, rise + 0.01, 0));
  /* 正脊顶面的一道极细亮线（金属脊瓦的高光）*/
  g.add(box(2 * r + 0.16, 0.040, 0.16, pick('ridgeHi'), 0, rise + 0.155, 0));

  /* ── 四条戗脊（同样暗色）
     ★★★ v15c 修异常 [P]：v14 的戗脊盒**中心正好在斜线中点**，
       盒宽 0.40 × 高 0.24 在斜置后有一半沉进坡面、一半露在坡外
       ⇒ 从正面看戗脊"时有时无"。正解：把盒**沿坡面法向抬起半高**，
          并用"底边贴着坡面"的方式摆 —— 简化做法 = 中心沿 Z 轴（面法向）
          抬 0.10、盒宽收到 0.30。 */
  [[R1, A], [R1, Dp], [R2, B], [R2, C]].forEach(function (pr) {
    var p0 = new THREE.Vector3().fromArray(pr[0]);
    var p1 = new THREE.Vector3().fromArray(pr[1]);
    var mid = p0.clone().add(p1).multiplyScalar(0.5);
    var len = p0.distanceTo(p1);
    var hg = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.20, len + 0.12), pick('ridge'));
    hg.position.copy(mid);
    hg.position.y += 0.06;
    hg.lookAt(p1.x, p1.y + 0.06, p1.z);
    hg.castShadow = true; hg.receiveShadow = true;
    g.add(hg);
  });

  /* ── 檐口封边带（★ v13 新增：深蓝灰一圈，实拍很明显）
     ★★★ v15c 修异常 [Q]：v14 的封边带 y = −0.17、高 0.34 ⇒ 顶面在 y = 0，
       与屋面**下表面**（斜切的 −thick/2 = −0.15 附近）几乎齐平
       ⇒ 从斜上方看**完全被屋面盖住**（放大图里那条深蓝带根本看不到）。
     ✅ 正解：封边带**下移到檐口正下方**（y = −0.30），并加高到 0.44，
        让它在"屋面厚度"之下露出一道明确的深色水平带。 */
  var gw = 2 * a + 0.10, gd = 2 * b + 0.10;
  g.add(box(gw, 0.44, 0.26, pick('eaveBand'), 0, -0.30, -b));
  g.add(box(gw, 0.44, 0.26, pick('eaveBand'), 0, -0.30, b));
  g.add(box(0.26, 0.44, gd, pick('eaveBand'), a, -0.30, 0));
  g.add(box(0.26, 0.44, gd, pick('eaveBand'), -a, -0.30, 0));
  /* 檐口上沿细亮线（金属收边高光）*/
  g.add(box(gw + 0.06, 0.05, 0.32, pick('ridgeHi'), 0, -0.06, -b));
  g.add(box(gw + 0.06, 0.05, 0.32, pick('ridgeHi'), 0, -0.06, b));
  g.add(box(0.32, 0.05, gd + 0.06, pick('ridgeHi'), a, -0.06, 0));
  g.add(box(0.32, 0.05, gd + 0.06, pick('ridgeHi'), -a, -0.06, 0));
  /* 檐口下沿的滴水线（深色细条，实拍檐口有明确的"滴水"投影）*/
  g.add(box(gw, 0.055, 0.30, pick('roofShd'), 0, -0.51, -b));
  g.add(box(gw, 0.055, 0.30, pick('roofShd'), 0, -0.51, b));
  g.add(box(0.30, 0.055, gd, pick('roofShd'), a, -0.51, 0));
  g.add(box(0.30, 0.055, gd, pick('roofShd'), -a, -0.51, 0));

  /* 檐下阴影构造（深色凹槽，强化"有檐"）
     ★ v15c：原在 y=−0.42，与新的封边带（−0.52~−0.08）**完全重叠** ⇒ 改为
       贴着封边带内侧、略低，形成"檐口下的一道暗影"。 */
  var shOff = 0.62;
  g.add(box(gw - 1.5, 0.30, 0.12, pick('roofShd'), 0, -0.62, -b + shOff));
  g.add(box(gw - 1.5, 0.30, 0.12, pick('roofShd'), 0, -0.62, b - shOff));
  g.add(box(0.12, 0.30, gd - 1.5, pick('roofShd'), a - shOff, -0.62, 0));
  g.add(box(0.12, 0.30, gd - 1.5, pick('roofShd'), -a + shOff, -0.62, 0));

  return g;
}

/* ── ★ v15 新增：屋面几何的**单一真源**（single source of truth）
   ────────────────────────────────────────────────────────────────
   屋面上任何附属物（天窗 / 楼梯间 / 水箱 / 排气管）都必须用**同一套公式**
   求"某点的屋面高度"，否则就是 v14 那种"手工插值 vs 真实坡面不一致"
   ⇒ 构件悬空或陷进坡里。本函数是唯一入口。 */
function roofGeom(W, D, o) {
  o = o || {};
  var E = o.eave === undefined ? EAVE_OUT : o.eave;
  var ang = o.ang === undefined ? ROOF_ANG : o.ang;
  var longIsX = (W + 2 * E) >= (D + 2 * E);
  var LONG = longIsX ? (W + 2 * E) : (D + 2 * E);
  var SHORT = longIsX ? (D + 2 * E) : (W + 2 * E);
  var a = LONG / 2, b = SHORT / 2;
  var rise = b * Math.tan(ang);
  var r = Math.min(a * RIDGE_RATIO, a - b * 0.92);
  if (r < 0.60) r = 0.60;
  return { E: E, ang: ang, longIsX: longIsX, LONG: LONG, SHORT: SHORT,
           a: a, b: b, rise: rise, r: r };
}

/* 屋面在**世界局部坐标 (x, z)** 处的高度（相对檐口）。
   ★ 四坡顶的真实形状：南北坡是梯形（沿长边到 a），东西坡是三角（从 r 到 a）。
      统一做法：把 (x,z) 变换到"长边=u、短边=v"的坐标，
      再取"从两条檐口各按坡度上升"的**较小值** —— 这正是四坡顶的数学定义。 */
function roofRiseAt(G, x, z) {
  var u = G.longIsX ? x : z;      /* 沿长边 */
  var v = G.longIsX ? z : -x;     /* 沿短边 */
  /* 短边方向：从两侧檐口向脊上升，坡角固定 ⇒ 高度 = tan(ang) · (b − |v|) */
  var hV = Math.tan(G.ang) * (G.b - Math.abs(v));
  /* 长边方向：两端的"歇山三角"也按同一坡角内收 ⇒ 高度 = tan(ang) · (a − |u|) */
  var hU = Math.tan(G.ang) * (G.a - Math.abs(u));
  var h = Math.min(hV, hU);
  return Math.max(0, h);
}

/* ── 屋面附属：天窗阵列 ───────────────────────────────────────────
   ★ v15 修异常 [B]：v14 的天窗 y 用 `0.15 + (rise−0.24)·t` —— 手工插值，
     与屋面真实几何不一致 ⇒ 实测 t=0.40 处天窗**陷进坡面 0.65m**。
   正解：改用 roofRiseAt()（单一真源），再抬高 0.06m 坐在坡面上。

   ★★★ v15c 修异常 [L]（放大图暴露，最扎眼的一处）：
     v15 里天窗写成两个盒子：
        s = Box(1.12, 0.10, 0.92)   ← "底板"
        m = Box(0.92, 0.12, 0.74)   ← "盖板"，抬 0.05
     两块都是**水平盒子**，只绕 X 转 −sg·ang。
     问题：① 两个盒子之间留 0.05 空隙 ⇒ 放大后读成**"小房子"**（底板是屋檐、
              盖板是屋顶），完全不是实拍的"平板式天窗"；
           ② 只在 `longIsX` 为真时才转对 —— 西/东楼（长边 Z）坡面绕 **Z** 轴倾斜，
              v15 用 `rotation.x` ⇒ 天窗**歪在坡上**（`rotation.z = 0` 那行是自欺）。
     ✅ 正解：
       · 天窗 = **单个扁盒**（0.12 厚），贴着坡面放，不再做"双层小屋"；
       · 用 `Euler` 按坡面真实倾斜方向旋转：
           长边是 X（南北坡）⇒ 绕 X 轴 ±ang
           长边是 Z（东西坡）⇒ 绕 Z 轴 ∓ang
       · 并在坡面法向抬起 0.06（盒底贴坡面）。 */
function roofWindows(W, D, eaveY, o) {
  o = o || {};
  var G = roofGeom(W, D, o);
  var g = new THREE.Group();
  g.position.y = eaveY;

  var n = o.n === undefined ? 4 : o.n;
  /* ★ v15c：天窗不再只收在正脊 0.86r 内 —— 实拍天窗沿坡面分两排铺开，
     这里沿长边铺 n 个、在短边方向各偏 0.44b（与 v15 同），
     但间距按可用跨度分配，避免全挤在脊附近。 */
  for (var i = 0; i < n; i++) {
    var u = -G.r * 0.82 + (i / Math.max(1, n - 1)) * G.r * 1.64;
    [1, -1].forEach(function (sg) {
      var v = sg * G.b * 0.44;
      /* 世界坐标：长边是 X 则 u→x、v→z；长边是 Z 则 u→z、v→-x */
      var x = G.longIsX ? u : -v;
      var z = G.longIsX ? v : u;
      var ySurf = roofRiseAt(G, x, z);

      /* 坡面法向：长边 X 时坡向 ±Z ⇒ 法向 (0, cos, ∓sin)；
         长边 Z 时坡向 ±X ⇒ 法向 (∓sin, cos, 0)。 */
      var nx = G.longIsX ? 0 : -sg * Math.sin(G.ang);
      var nz = G.longIsX ? sg * Math.sin(G.ang) : 0;
      var ny = Math.cos(G.ang);

      /* ── 天窗基座（★ v17：从"扁盒"改成有**坡面抬起的框体**）
         diag-roofkit.cjs 实测：`1.16×0.14×0.86` 的基座屏幕仅 **9×9px**、
         `0.92×0.04×0.64` 的玻璃面 **10×10px** —— 勉强在线。
         病：扁盒贴在坡面上，斜面朝向相机时**读成"屋面上的一块补丁"**。
         正解 = 让天窗**离面抬起**（凸窗感）：
           框体抬高到 0.20（原来 0.14），玻璃面下沉到框内 3cm
           ⇒ 斜视时能看到框体的侧壁（有厚度 = 立体），且产生自阴影。 ── */
      var sk = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.20, 0.86), M.metalD);
      sk.position.set(x + nx * 0.10, ySurf + ny * 0.10 + 0.01, z + nz * 0.10);
      if (G.longIsX) sk.rotation.x = -sg * G.ang;
      else sk.rotation.z = sg * G.ang;
      sk.castShadow = true; sk.receiveShadow = true;
      g.add(sk);

      /* 天窗中央的玻璃小面（比基座小一圈，**下沉**进框内 ⇒ 读成窗洞而不是贴片）*/
      var gl = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.05, 0.64), M.vent);
      gl.position.set(x + nx * 0.10, ySurf + ny * 0.10 - 0.020, z + nz * 0.10);
      if (G.longIsX) gl.rotation.x = -sg * G.ang;
      else gl.rotation.z = sg * G.ang;
      gl.castShadow = true; gl.receiveShadow = true;
      g.add(gl);

      /* 天窗两侧的挡水翼（实拍：天窗两侧各有一条薄板）*/
      [-1, 1].forEach(function (w2) {
        var wi = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.20, 0.05), M.metalD);
        wi.position.set(x + w2 * (G.longIsX ? 0.10 : 0.46) + nx * 0.12,
                        ySurf + ny * 0.12 + 0.04,
                        z + (G.longIsX ? w2 * 0.46 : 0.10) + nz * 0.12);
        if (G.longIsX) wi.rotation.x = -sg * G.ang;
        else wi.rotation.z = sg * G.ang;
        wi.castShadow = true;
        g.add(wi);
      });
    });
  }
  return g;
}

/* ══════════════════════════════════════════════════════════════════
   平屋顶 + 女儿墙 + 屋面设备（v22 新增）
   ──────────────────────────────────────────────────────────────────
   为什么要它：`makeTower` 只会建 `hipRoof`（四坡庑殿顶）。
     `U/tower` 批次的**教学楼**若也用四坡顶，就会和实验楼"同款"——
     用户对"是实验楼的复制品"这个判断非常敏感（v20 的原话）。
   ⇒ 教学楼整体改用 **平顶 + 女儿墙 + 屋面设备**，屋顶语言与实验楼分家。

   ★ 尺度自查（本项目正交视角 7.564 px/m，判据 <6px = 噪点）：
       女儿墙高 0.95m → **7.2 px** ✓ 恰好过阈值（再矮就看不见了）
       压顶条  0.22m → 1.7 px  ⇒ **刻意低于阈值**，只当"收头亮线"的肌理
       ⇒ 女儿墙的**可读性完全靠那 7.2px 的深色侧影**，不靠压顶。
   ══════════════════════════════════════════════════════════════════ */
function flatRoofWithParapet(W, D, topY, o) {
  o = o || {};
  var PH  = o.parapetH === undefined ? 0.95 : o.parapetH;   /* 女儿墙高 */
  var PT  = 0.30;                                            /* 女儿墙厚 */
  var cSlab   = o.cSlab   === undefined ? 0x6C6C70 : o.cSlab;
  var cPar    = o.cPar    === undefined ? 0x8E8474 : o.cPar;
  var cCoping = o.cCoping === undefined ? 0xA29682 : o.cCoping;
  var cEquip  = o.cEquip  === undefined ? 0x7E848A : o.cEquip;
  var cEquipD = o.cEquipD === undefined ? 0x666C72 : o.cEquipD;

  var g = new THREE.Group();
  g.position.y = topY;

  var mSlab = mat(cSlab, { rough: 0.95 });
  var mPar  = mat(cPar,  { rough: 0.88 });
  var mCop  = mat(cCoping, { rough: 0.80 });
  var mEq   = mat(cEquip, { rough: 0.62, metal: 0.18 });
  var mEqD  = mat(cEquipD, { rough: 0.68, metal: 0.16 });

  /* ① 屋面板（略内缩，让女儿墙有 0.10 的"压边"读感）*/
  var slab = box(W - 0.20, 0.22, D - 0.20, mSlab, 0, 0.11, 0);
  slab.receiveShadow = true;
  g.add(slab);

  /* ② 四边女儿墙 + 压顶 */
  [[0, (D - PT) / 2], [0, -(D - PT) / 2]].forEach(function (p) {
    g.add(box(W, PH, PT, mPar, p[0], PH / 2 + 0.20, p[1]));
    g.add(box(W + 0.10, 0.22, PT + 0.14, mCop, p[0], PH + 0.20 + 0.11, p[1]));
  });
  [[(W - PT) / 2, 0], [-(W - PT) / 2, 0]].forEach(function (p) {
    g.add(box(PT, PH, D - PT * 2, mPar, p[0], PH / 2 + 0.20, p[1]));
    g.add(box(PT + 0.14, 0.22, D - PT * 2, mCop, p[0], PH + 0.20 + 0.11, p[1]));
  });

  /* ③ 出屋面楼梯间（学术楼一定有，且它是屋面层次的主要来源）*/
  if (o.stairBox !== false) {
    var SBW = Math.min(W * 0.22, 5.0), SBD = Math.min(D * 0.34, 3.6);
    var SBH = 3.0;
    var sx = o.stairBoxAt ? o.stairBoxAt[0] : -(W / 2 - SBW / 2 - 1.2);
    var sz = o.stairBoxAt ? o.stairBoxAt[1] : 0;
    g.add(box(SBW, SBH, SBD, mPar, sx, 0.20 + SBH / 2, sz));
    g.add(box(SBW + 0.40, 0.26, SBD + 0.40, mCop, sx, 0.20 + SBH + 0.13, sz));
    /* 楼梯间的门（朝内院侧）*/
    g.add(box(SBW * 0.30, 2.05, 0.10, mEqD, sx, 0.20 + 1.06, sz + SBD / 2 + 0.03));
  }

  /* ④ 屋面设备：水箱 + 空调机组 + 排气管
     ★ 刻意**不对称、不成行**摆 —— 成行就是"图例"，零散才是"设备"。 */
  var eq = o.equip;
  var tankX = W * 0.26, tankZ = D * 0.16;
  if (eq !== 'none') {
    /* 水箱（圆柱 + 底座 + 出气管）*/
    var TR = 1.15, TH = 2.0;
    var tk = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR * 1.04, TH, 20), mEq);
    tk.position.set(tankX, 0.20 + TH / 2, tankZ);
    tk.castShadow = true; tk.receiveShadow = true;
    g.add(tk);
    g.add(box(TR * 2.5, 0.34, TR * 2.5, mEqD, tankX, 0.20 + 0.17, tankZ));
    g.add(box(TR * 1.2, 1.5, TR * 1.2, mEqD, tankX, 0.20 + TH + 0.75, tankZ));

    /* 空调机组 ×2（偏置摆放）*/
    [[-W * 0.30, -D * 0.24], [-W * 0.30 + 2.9, -D * 0.24 - 0.7]].forEach(function (p, i) {
      var hh = 1.05 + i * 0.18;
      g.add(box(2.2, hh, 1.5, mEq, p[0], 0.20 + hh / 2, p[1]));
      g.add(box(2.2 + 0.22, 0.14, 1.5 + 0.22, mEqD, p[0], 0.20 + hh + 0.07, p[1]));
    });

    /* 排气管 ×3（细长件，靠"深色"才有读感）*/
    [[W * 0.06, -D * 0.30], [W * 0.13, -D * 0.30], [W * 0.20, -D * 0.30]].forEach(function (p) {
      var cy = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.35, 10), mEqD);
      cy.position.set(p[0], 0.20 + 0.70, p[1]);
      cy.castShadow = true;
      g.add(cy);
    });
  }
  return g;
}
