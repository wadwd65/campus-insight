/* ══════════════════════════════════════════════════════════════════════
   样张 A —— three.js 真 3D 精细重建（只做「实验楼」一组）
   ──────────────────────────────────────────────────────────────────────
   依据：map-assets/official-360/BUILDING-SPEC.md 的「A. 实验楼」档案
   取色：全部来自 27837116_d.jpg 实拍

   ★★★ v7 定调：**低饱和冷灰写实**（不是明信片彩色）
      v6 截图自查结论：形体已经对了（U 型 + 双坡 + 连廊都能读出来），
      但**配色像儿童积木** —— 砖红 #B5704F 太艳、草坪太翠、白色连廊太白。
      对照实拍航拍（27837116_d.jpg）：真实校园在漫射光下是**灰调、低饱和**的，
      砖墙偏"土黄褐"而不是"红砖红"，草坪偏"橄榄黄绿"而不是"草皮绿"。
      ⇒ 本轮把整条色带往**灰、暗、低饱和**推一档，并加一层轻微空气雾。
   ══════════════════════════════════════════════════════════════════════ */

/* ── 实拍取色 · v7 灰调校正（唯一色源）────────────────────────────
   ★ 校正原则：实拍航拍受大气散射影响，**饱和度比肉眼低 30~40%**，
     明度也低一档。直接照肉眼印象取色 → 出来就是"积木色"。 */
var C = {
  wallLit:  0x9C6E55,   /* 砖红墙 · 受光面（原 0xB5704F → 去艳、加灰） */
  wallMid:  0x8A6350,   /* 砖红墙 · 侧面 */
  wallDark: 0x6E4E40,   /* 砖红墙 · 背光面 */
  wallLow:  0x7E5C4C,   /* 底部基座稍深 */

  roofLit:  0x7C8CA0,   /* 蓝灰金属屋面 · 受光坡（原 0x8AA0BC → 压蓝压亮） */
  roofDark: 0x5A6C82,   /* 蓝灰金属屋面 · 背光坡 */
  ridge:    0x8B99A8,   /* 正脊 */
  roofGable:0x8E6552,   /* 山墙（砖红，与墙同族）*/

  gallery:  0xD3D6D8,   /* 白色连廊（原 0xEDEFF1 → 太"荧白"，压灰） */
  galleryE: 0xA9AEB3,

  win:      0x2E3B48,   /* 窗玻璃 */
  frame:    0xC9C6C0,   /* 窗框 */

  acUnit:   0xC2BEB6,   /* 空调外机 */

  ground:   0xACA9A3,   /* 石材铺装 */
  grass:    0x6E8450,   /* 草坪（偏橄榄黄绿）*/
  island:   0x778C56,   /* 内院绿岛 */
  hedge:    0x45663C,   /* 球形灌木 */
  walk:     0xB89A96    /* 粉红人行道（压灰） */
};

var FLOOR = 3.5;          /* 层高 */
var N_FLOOR = 5;          /* 实验楼 5 层（实拍数出 5 排窗）*/
var FL = N_FLOOR * FLOOR; /* 总高 17.5m */
var ROOF_ANG = 0.38;      /* 屋面坡度 ≈22° */

/* ── 场景 ────────────────────────────────────────────────────────── */
var W = window.innerWidth, H = window.innerHeight;
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

var scene = new THREE.Scene();
/* v7：雾起得更早、更浓一点 —— 实拍航拍远处建筑是有明显空气透视的（越远越灰白） */
scene.fog = new THREE.Fog(0xC8D4E0, 88, 300);

var FRUST = 27;
var aspect = W / H;
var camera = new THREE.OrthographicCamera(-FRUST * aspect, FRUST * aspect, FRUST, -FRUST, 1, 600);
camera.position.set(26, 58, 42);
/* ★ 目标点抬到 y=11（约建筑半高）—— 原来 y=4 导致建筑群整体偏上、下方大片留白 */
camera.lookAt(0, 11, 1.0);

/* ── 光照 ────────────────────────────────────────────────────────── */
/* 光照：v7 把整体照度降一档、色温收中性 —— 原来 1.15 的暖白光把砖墙照"发亮"了 */
scene.add(new THREE.HemisphereLight(0xC8D8E8, 0x6E7660, 0.62));
var sun = new THREE.DirectionalLight(0xFFF4E4, 0.92);
sun.position.set(-34, 82, 26);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
var sc = sun.shadow.camera;
sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 220;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);
var fill = new THREE.DirectionalLight(0x9EB6CC, 0.26);
fill.position.set(42, 26, -38);
scene.add(fill);

/* ── 天空渐变 ────────────────────────────────────────────────────── */
(function () {
  var cv = document.createElement('canvas');
  cv.width = 4; cv.height = 256;
  var cx = cv.getContext('2d');
  var g = cx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#8FB6D8');
  g.addColorStop(0.5, '#C6DAEA');
  g.addColorStop(1, '#E8E2D4');
  cx.fillStyle = g;
  cx.fillRect(0, 0, 4, 256);
  var t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  scene.background = t;
})();

/* ── 工具 ────────────────────────────────────────────────────────── */
function mat(color, opt) {
  opt = opt || {};
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: opt.rough === undefined ? 0.80 : opt.rough,
    metalness: opt.metal === undefined ? 0.05 : opt.metal,
    flatShading: !!opt.flat
  });
}
function box(w, h, d, material, x, y, z) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* 共享材质（省 draw call，也保证同色一致） */
var M = {
  wallLit:  mat(C.wallLit),
  wallMid:  mat(C.wallMid),
  wallDark: mat(C.wallDark),
  roofLit:  mat(C.roofLit,  { rough: 0.72, metal: 0.10 }),
  roofDark: mat(C.roofDark, { rough: 0.72, metal: 0.10 }),
  ridge:    mat(C.ridge,    { rough: 0.55, metal: 0.22 }),
  gable:    mat(C.roofGable),
  gallery:  mat(C.gallery,  { rough: 0.58 }),
  galleryE: mat(C.galleryE, { rough: 0.50, metal: 0.18 }),
  win:      mat(C.win,      { rough: 0.24, metal: 0.28 }),
  frame:    mat(C.frame,    { rough: 0.60 }),
  ac:       mat(C.acUnit,   { rough: 0.58 }),
  base:     mat(C.wallLow)
};

/* ══ ⓪ 屋面「直立锁边」贴图生成器 ══════════════════════════════
   一块金属屋面：底色 + 均匀竖棱（每条棱左暗右亮 = 立体感）+ 极淡的横向拼缝。

   ★★★ v9 方向修正（v8 截图自查）：
     直立锁边屋面板是**顺着坡面方向铺**的 —— 板长沿水流（垂直屋脊），
     所以棱条应该**垂直于屋脊**，从屋脊向檐口一条到底。
     v8 的棱是**平行屋脊**的（横着），读成"瓦楞纸"。
     原因：BoxGeometry 的顶面 UV 里，**U 轴 = 宽度 w（屋脊方向）**，
     V 轴 = 深度 slope（坡向）。所以竖棱必须画在 **V 轴**上 —— 即把条纹改成**横纹**，
     再由 BoxGeometry 的顶面 UV 映射到"沿坡向重复"。
     ⇒ 画布改 64 x 256，条纹沿 y 方向（横条），repeat.y 按坡长密度。 */
function makeRibTexture(spanW) {
  var cv = document.createElement('canvas');
  cv.width = 64; cv.height = 256;
  var cx = cv.getContext('2d');
  cx.fillStyle = '#ffffff';                    /* 白底 —— 由材质 color 乘出真色 */
  cx.fillRect(0, 0, 64, 256);

  var PITCH = 32;                              /* 一格 8 条棱 */
  for (var i = 0; i < 256 / PITCH; i++) {
    var y0 = i * PITCH;
    for (var k = 0; k < 8; k++) {
      var y = y0 + k * (PITCH / 8);
      cx.fillStyle = 'rgba(0,0,0,.07)';
      cx.fillRect(0, y, 64, 1.6);              /* 棱的一侧暗 */
      cx.fillStyle = 'rgba(255,255,255,.30)';
      cx.fillRect(0, y + 1.6, 64, 1.4);        /* 棱的另一侧亮 */
    }
  }
  /* 极淡的板端拼缝（沿坡向每 4.5m 一道）*/
  cx.fillStyle = 'rgba(0,0,0,.05)';
  cx.fillRect(0, 0, 1.5, 256);
  cx.fillRect(32, 0, 1.5, 256);

  var t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  /* ★ repeat.y = 坡长 / 1.2m（每 1.2m 一块板宽）——
     repeat.x = 1（沿屋脊只要一条，因为板是通长的） */
  t.repeat.set(1, Math.max(2, Math.round((spanW || 6) / 1.2)));
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  return t;
}

/* ══ ① 双坡屋顶（实拍最强特征）═══════════════════════════════════
   ★ rise 由「坡度固定」反算，不再手填 —— 否则浅进深楼会顶个大帽子
   ★★ v5 修正：`w` 是「屋脊方向长度」，`d` 是「跨向进深」。
      正脊长度必须用 w（原来正脊写死 w+0.12 是对的），
      但**纵楼调用时必须交换 w/d**，否则屋脊方向与楼体垂直。 */
function pitchedRoof(w, d) {
  var g = new THREE.Group();
  var half = d / 2;
  var rise = half * Math.tan(ROOF_ANG);
  var slope = Math.sqrt(half * half + rise * rise);
  var thick = 0.30;

  /* ★★ 直立锁边竖棱 —— v2/v3 用「几何棱条」两次失败（斜置后在俯视投影里向上飘，
     穿出屋面轮廓，读成一排竖梳子）。**改用贴图**（这才是金属屋面工业上的正确做法）：
     画一张「带竖棱明暗」的纹理，repeat 铺满坡面 —— 棱是"画"上去的，
     永远收在坡面内，且明暗自然。 */
  var ribTex = makeRibTexture(slope);
  var rl = M.roofLit.clone(); rl.map = ribTex; rl.needsUpdate = true;
  var rd = M.roofDark.clone(); rd.map = ribTex; rd.needsUpdate = true;

  /* ★★ v9：屋面单坡只用「一层极薄的板」，下沿加一圈**檐口封边**。
     原来 thick=0.30 的厚板，在正交俯视下侧棱会被看见，读成"两块斜板"。
     改为 0.16 薄板 + 檐口细线，观感接近实拍的金属压型板。 */
  [1, -1].forEach(function (sgn, i) {
    var slab = box(w, 0.16, slope, i === 0 ? rd : rl, 0, 0, 0);
    slab.rotation.x = -sgn * ROOF_ANG;
    slab.position.set(0, rise / 2, sgn * half / 2);
    g.add(slab);
    /* 檐口封边（沿坡底一条与坡面垂直的窄条）*/
    var eave = box(w + 0.26, 0.30, 0.22, M.ridge, 0, 0, 0);
    eave.rotation.x = -sgn * ROOF_ANG;
    eave.position.set(0, 0.14, sgn * (half + 0.05));
    g.add(eave);
  });

  /* 【1 号最严重的观感问题】原写 g.add(box(w + 0.12, 0.34, 0.62, M.ridge, 0, rise + 0.02, 0))
      —— 「w 加 0.12」比屋脊方向长 12cm，俯视投影里就是**两根飘在屋面上方的细杆**；
      而且 0.34 高 x 0.62 宽 = 又高又厚的"脊梁"，把双坡屋顶读成了"双坡 + 一根横梁"。
      ⇒ 改为 **矮而扁**（0.24 高 x 1.05 宽）+ 与坡面**齐平**（y = rise - 0.02），
        并让它在两端正好收在山墙里。 */
  g.add(box(w - 0.30, 0.30, 1.20, M.ridge, 0, rise + 0.10, 0));

  /* 两端山墙三角（砖红封头）——
     ⚠️ 坑：ExtrudeGeometry 沿 **+Z** 挤出；rotation.y=π/2 后挤出方向变成 **+X**，
        所以位置必须放在 `sgn*w/2 - sgn*depth`（往回退一个板厚），
        否则三角会顺着挤出方向**飞出屋面**（v4 图里那四片飘着的板）。
     另：三角形的 x 轴是「进深方向」，绕 y 转 90° 后要落到 -z..+z 上，
        所以顶点要用 (-half..half) 定义 —— 已如此。 */
  var depth = 0.34;
  var shapeT = new THREE.Shape();
  shapeT.moveTo(-half, 0); shapeT.lineTo(half, 0); shapeT.lineTo(0, rise); shapeT.closePath();
  var triGeo = new THREE.ExtrudeGeometry(shapeT, { depth: depth, bevelEnabled: false });
  [1, -1].forEach(function (sgn) {
    var tri = new THREE.Mesh(triGeo, M.gable);
    tri.rotation.y = Math.PI / 2;
    tri.position.set(sgn * w / 2 - sgn * depth, 0, 0);
    tri.castShadow = true; tri.receiveShadow = true;
    g.add(tri);
  });

  g.position.y = 0;
  return g;
}

/* ══ ①b 立面贴图（腰线 + 砖缝 + 窗套投影）═══════════════════════
   ★★★ v10 定调：**立面细节交给贴图，不交给几何**。
     理由（v7~v9 三轮尝试得出）：每多一个几何盒，在正交俯视下就多一条硬边，
     硬边一多，整体就越来越"塑料玩具"。真实建筑的立面信息量 90% 在**明暗与线脚**，
     而这些用一张贴图就能表达，且**零 draw call 增量**。
     贴图内容（白底，由材质 color 乘出真色）：
       · 每层一道**腰线**（浅色横带 + 上下细阴影）→ 读出"这是第几层"
       · **砖缝**（极淡的错缝横线）→ 读出材质，不是纯色块
       · 每开间一道**竖向分格**（浅于墙，暗示结构柱位）
*/
function makeFacadeTexture(bays, nf) {
  var cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  var cx = cv.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, 512, 512);

  /* 砖缝：每 6px 一道极淡错缝横线（512px 高 = nf 层楼，一层 102px）*/
  cx.fillStyle = 'rgba(0,0,0,.030)';
  for (var y = 0; y < 512; y += 6) cx.fillRect(0, y, 512, 1);

  var fh = 512 / nf;                       /* 单层高（像素）*/
  for (var f = 0; f < nf; f++) {
    var yb = 512 - (f + 1) * fh;           /* 该层底边（canvas y 向下）*/

    /* 腰线：层底上方 8px 的一道浅色横带（比墙亮），上下各 2px 暗线 */
    cx.fillStyle = 'rgba(255,255,255,.34)';
    cx.fillRect(0, yb + fh - 10, 512, 7);
    cx.fillStyle = 'rgba(0,0,0,.22)';
    cx.fillRect(0, yb + fh - 3, 512, 2);
    cx.fillStyle = 'rgba(255,255,255,.16)';
    cx.fillRect(0, yb + fh - 12, 512, 2);
  }

  /* 竖向分格（每开间一道，宽 2px 的浅线 + 右侧 1px 暗线）*/
  for (var b = 1; b < bays; b++) {
    var xb = Math.round(512 * b / bays);
    cx.fillStyle = 'rgba(0,0,0,.10)';
    cx.fillRect(xb, 0, 2, 512);
    cx.fillStyle = 'rgba(255,255,255,.18)';
    cx.fillRect(xb + 2, 0, 1, 512);
  }

  var t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 8;
  return t;
}

/* ══ ② 砖墙立面（每层独立方窗 —— 实拍就是这样，v1 做成通高窗是错的）═ */
function brickBlock(w, d, o) {
  o = o || {};
  var g = new THREE.Group();
  var nf = o.floors || N_FLOOR;
  var h = nf * FLOOR;

  /* 主体（四面都有墙！v1 缺后墙导致看到内部）
     ★ v10：四面都贴立面纹理 —— 因为屋顶悬挑后，**背光面也会入镜** */
  var baysN = o.bays || 5;
  var faceTexW = makeFacadeTexture(baysN, nf);          /* 宽面（东西向 w）*/
  var baysD0 = Math.max(1, Math.round(d / (w / baysN)));
  var faceTexD = makeFacadeTexture(baysD0, nf);         /* 深面（南北向 d）*/
  var mw = M.wallMid.clone(); mw.map = faceTexW; mw.needsUpdate = true;
  var md = M.wallMid.clone(); md.map = faceTexD; md.needsUpdate = true;
  var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    [md, md, M.wallDark, M.base, mw, mw]);              /* +X,-X,+Y,-Y,+Z,-Z */
  body.position.y = h / 2;
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  /* 基座（实拍楼底有一圈稍深）*/
  g.add(box(w + 0.30, 0.75, d + 0.30, M.base, 0, 0.375, 0));

  var bays = baysN;
  var bw = w / bays;
  var winW = Math.min(bw * 0.50, 1.5);
  var winH = 1.85;

  /* ⚠️ 只做「看得见的两个立面」= 前面(+Z) + 右面(+X)
     —— 其余两面正常视角看不到，做了纯浪费（这是性能与观感的平衡） */
  for (var b = 0; b < bays; b++) {
    var x = -w / 2 + (b + 0.5) * bw;
    for (var f = 0; f < nf; f++) {
      var y = f * FLOOR + 1.75;
      /* 前面窗 */
      g.add(box(winW + 0.22, winH + 0.22, 0.10, M.frame, x, y, d / 2 + 0.05));
      g.add(box(winW, winH, 0.12, M.win, x, y, d / 2 + 0.09));
    }
  }
  /* 右面窗（同样规律）*/
  var baysD = Math.round(d / bw);
  for (var b2 = 0; b2 < baysD; b2++) {
    var z = -d / 2 + (b2 + 0.5) * (d / baysD);
    for (var f2 = 0; f2 < nf; f2++) {
      var y2 = f2 * FLOOR + 1.75;
      g.add(box(0.10, winH + 0.22, winW + 0.22, M.frame, w / 2 + 0.05, y2, z));
      g.add(box(0.12, winH, winW, M.win, w / 2 + 0.09, y2, z));
    }
  }

  /* 空调外机（实拍：白机成排，间距不均，才有"活人味"）*/
  if (o.ac !== false) {
    for (var f3 = 1; f3 < nf; f3++) {
      for (var b3 = 0; b3 < bays; b3++) {
        if ((b3 * 7 + f3 * 3) % 4 === 0) {
          var x3 = -w / 2 + (b3 + 0.5) * bw + bw * 0.28;
          g.add(box(0.85, 0.55, 0.42, M.ac, x3, f3 * FLOOR + 0.95, d / 2 + 0.42));
        }
      }
    }
  }
  g.position.y = 0;
  return g;
}

/* ══ ③ 白色钢桁架连廊（★ 正交连接，不斜搭）═══════════════════════ */
function skyBridge(len, width, height) {
  width = width || 2.8;
  height = height || 3.2;
  var g = new THREE.Group();
  var hf = height / 2;

  /* 底板 + 顶板（顶板略出檐 = 实拍那圈白色边框）*/
  g.add(box(len, 0.34, width, M.gallery, 0, -hf, 0));
  g.add(box(len, 0.28, width + 0.9, M.galleryE, 0, hf, 0));
  /* 两侧栏板 */
  g.add(box(len, height - 0.62, 0.20, M.gallery, 0, -0.16, width / 2 - 0.10));
  g.add(box(len, height - 0.62, 0.20, M.gallery, 0, -0.16, -width / 2 + 0.10));
  /* 端头封板（让连廊"插进"楼里，而不是悬空）*/
  g.add(box(0.3, height, width, M.galleryE, -len / 2, 0, 0));
  g.add(box(0.3, height, width, M.galleryE, len / 2, 0, 0));

  /* 斜拉索（实拍可见的一排细杆）*/
  var n = Math.max(2, Math.round(len / 3.6));
  for (var i = 0; i < n; i++) {
    var x = -len / 2 + (i + 0.5) * (len / n);
    [1, -1].forEach(function (sgn) {
      var c = box(0.09, 0.09, width * 0.72, M.galleryE, x, hf - 0.35, sgn * width * 0.18);
      c.rotation.x = sgn * 0.85;
      g.add(c);
    });
  }
  return g;
}

/* ══ 组装：U 型围合（北楼 + 西楼 + 东楼 + 四座连廊 + 内院）═════════
   ★ 约定：每栋楼用「砖体块 bx×bz」描述（bx=东西向尺寸，bz=南北向尺寸）。
     屋顶**始终让屋脊沿楼体的长边**，这样不管横楼纵楼，屋脊方向都自然正确。 */
var campus = new THREE.Group();
scene.add(campus);


/* 通用：造一栋「砖体 + 双坡屋顶」，屋脊自动沿长边 */
function makeBuilding(bx, bz, o) {
  o = o || {};
  var g = new THREE.Group();
  var baysMain = o.bays || Math.max(3, Math.round(Math.max(bx, bz) / 4.0));
  g.add(brickBlock(bx, bz, { bays: baysMain, floors: o.floors || N_FLOOR, ac: o.ac }));

  var alongX = bx >= bz;                       /* 屋脊是否沿 X 轴 */
  var ridgeLen = alongX ? bx : bz;             /* 屋脊方向长度 */
  var span = alongX ? bz : bx;                 /* 跨向进深 */
  var roof = pitchedRoof(ridgeLen, span);
  if (!alongX) roof.rotation.y = Math.PI / 2;  /* 纵楼把屋顶转 90° */
  roof.position.y = (o.floors || N_FLOOR) * FLOOR;
  g.add(roof);
  return g;
}

/* ══ 北楼（东西向 24 × 南北向 11）══ */
var north = makeBuilding(24, 11, { bays: 6 });
north.position.set(0, 0, -12.0);
campus.add(north);

/* ══ 西楼（南北向 19 × 东西向 11）== 用 bx=11, bz=19 */
var westG = makeBuilding(11, 19, { bays: 3 });
westG.position.set(-17.5, 0, 0.5);
campus.add(westG);

/* ══ 东楼 ══ */
var eastG = makeBuilding(11, 19, { bays: 3 });
eastG.position.set(17.5, 0, 0.5);
campus.add(eastG);

/* ★ 连廊：实拍里连廊**跨在内院外侧、把两栋楼在二层连起来**。
   ⚠️ v2 教训：连廊位置埋进楼体里 → 完全看不见。
   正解：连廊要**架在楼与楼之间的空档**，起点终点都落在楼的外墙面上。
   布局：北楼背面 z=-12+5.5=-6.5；西楼东面 x=-17.5+5.5=-12；空档宽 12-5.5=6.5m */
var BR_Y = FLOOR * 1.5 + 0.6;      /* 二层楼面稍上 */
var GAP = 6.4;
var gb1 = skyBridge(GAP + 1.6, 2.6, 3.0);
gb1.position.set(-14.8, BR_Y, -6.4);
campus.add(gb1);

var gb2 = skyBridge(GAP + 1.6, 2.6, 3.0);
gb2.position.set(14.8, BR_Y, -6.4);
campus.add(gb2);

/* 南侧再补一条（实拍是"U 型三面围合 + 多处连廊"）*/
var gb3 = skyBridge(GAP + 1.6, 2.6, 3.0);
gb3.position.set(-14.8, BR_Y, 10.2);
campus.add(gb3);

var gb4 = skyBridge(GAP + 1.6, 2.6, 3.0);
gb4.position.set(14.8, BR_Y, 10.2);
campus.add(gb4);

/* ══ 地面 ════════════════════════════════════════════════════════ */
var base = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), mat(C.ground, { rough: 0.96 }));
base.rotation.x = -Math.PI / 2;
base.receiveShadow = true;
scene.add(base);

/* 内院绿岛（实拍：不规则六边形）*/
var islShape = new THREE.Shape();
var IR = 5.0;
for (var i = 0; i < 6; i++) {
  var a = i / 6 * Math.PI * 2 + 0.32;
  var rr = IR * (i % 2 === 0 ? 1 : 0.70);
  var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
  if (i === 0) islShape.moveTo(px, py); else islShape.lineTo(px, py);
}
islShape.closePath();
var island = new THREE.Mesh(new THREE.ShapeGeometry(islShape), mat(C.island, { rough: 1 }));
island.rotation.x = -Math.PI / 2;
island.position.set(0, 0.03, 1.5);
island.receiveShadow = true;
scene.add(island);

/* 内院草坪 */
var lawn = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), mat(C.grass, { rough: 1 }));
lawn.rotation.x = -Math.PI / 2;
lawn.position.set(0, 0.01, 2.5);
lawn.receiveShadow = true;
scene.add(lawn);

/* 粉红人行道（实拍特征）*/
[[0, -7.0, 34, 2.4], [0, 13.5, 34, 2.4]].forEach(function (p) {
  var wk = new THREE.Mesh(new THREE.PlaneGeometry(p[2], p[3]), mat(C.walk, { rough: 0.95 }));
  wk.rotation.x = -Math.PI / 2;
  wk.position.set(p[0], 0.02, p[1]);
  wk.receiveShadow = true;
  scene.add(wk);
});

/* 球形灌木（实拍：修剪圆润，成组分布）*/
var hedgeGeo = new THREE.SphereGeometry(1.0, 14, 10);
var hedgeM = mat(C.hedge, { rough: 0.95 });
[[-9, -2.5], [-7, 7.5], [9, -2.5], [7.5, 8], [-2.5, 9], [3.5, -9.5], [-13, 10], [13, 10.5]]
  .forEach(function (p, i) {
    var s = new THREE.Mesh(hedgeGeo, hedgeM);
    var k = 0.85 + (i % 3) * 0.14;
    s.scale.set(k, k * 0.82, k);
    s.position.set(p[0], k * 0.78, p[1]);
    s.castShadow = true;
    scene.add(s);
  });

/* ── 交互：点击建筑弹跳 ─────────────────────────────────────────── */
var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
var picked = null;

renderer.domElement.addEventListener('pointerdown', function (e) {
  ndc.x = (e.clientX / W) * 2 - 1;
  ndc.y = -(e.clientY / H) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  var hits = ray.intersectObjects([north, westG, eastG], true);
  if (!hits.length) return;
  var o = hits[0].object;
  while (o.parent && o.parent !== north && o.parent !== westG && o.parent !== eastG) o = o.parent;
  if (o === picked) { picked.position.y = 0; picked = null; return; }
  if (picked) picked.position.y = 0;
  picked = o;
});

/* ── 主循环 ─────────────────────────────────────────────────────── */
var t0 = performance.now();
function loop() {
  requestAnimationFrame(loop);
  var t = (performance.now() - t0) / 1000;
  if (picked) picked.position.y = Math.abs(Math.sin(t * 4.5)) * 0.8;
  renderer.render(scene, camera);
}
loop();

window.addEventListener('resize', function () {
  W = window.innerWidth; H = window.innerHeight;
  aspect = W / H;
  camera.left = -FRUST * aspect; camera.right = FRUST * aspect;
  camera.top = FRUST; camera.bottom = -FRUST;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
});
