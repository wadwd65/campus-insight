/* ══════════════════════════════════════════════════════════════════════
   样张 A · v12「构造级」重建 —— 实验楼（一栋，做到顶点）
   ──────────────────────────────────────────────────────────────────────
   依据：map-assets/official-360/BUILDING-SPEC.md「A. 实验楼」（已二次精读修正）
   取色：27837116_d.jpg / 27836784_d.jpg / 27837113_d.jpg 三张交叉验证

   ★★★ v12 与 v1~v11 的**根本差别**（用户要求「细节加一下，做到顶点」）：
     v1~v11 = 「一个盒子 + 一张贴图」—— 观感上限就是"干净的塑料模型"
     v12    = **每个立面构件都是独立几何体**：
              墙垛（竖向实心砖柱）/ 窗洞（真凹进去）/ 窗台 / 窗楣
              / 楼层腰线 / 檐口挑出 + 檐下阴影 / 立柱
              / 空调外机 / 屋面锁边棱条（真几何，0.45m 一道）
              / 天窗阵列 / 楼梯间出屋面 / 屋脊戗脊 / 排水天沟
     代价：三角形数会到 10 万级 —— 但用户明确「不要在乎时间/多给他做一下」。

   ★ 实拍读出的六条硬特征（逐条对应到代码）：
     ① 横向带窗（不是竖窗）：每层一条连续玻璃带，被砖墙垛分段    → facade()
     ② 四坡庑殿顶 + 大出檐 1.2~1.5m                            → hipRoof()
     ③ 直立锁边竖棱极密（0.45m 一道）                          → roofRibs()
     ④ 屋面上有成排小天窗                                      → roofWindows()
     ⑤ 楼梯间出屋面（土黄色桶状，高出屋面）                     → stairCore()
     ⑥ 白色钢桁架连廊（二层，平板顶 + 斜拉索）                   → skyBridge()
   ══════════════════════════════════════════════════════════════════════ */

/* ── 实拍取色（v13：对照 1536×1536 原图局部放大 **第三次精读**）─────
   ★★★ v13 关键修正（v12 的色板"太灰"了）：
     实拍砖墙是**橙红陶土砖**（R:G:B ≈ 214:146:110，SAT 很高），
     配**浅色勾缝**（≈ 232:220:205）。v12 把墙压到 0xA87860 太灰，
     看着"脏"。真正的高级感来自 **高饱和砖 + 亮勾缝 + 深色窗** 的强对比，
     而不是"整体降饱和"。 */
/* ★★★ v14 按实拍**直方图**重取（DIAG-v14.md 第一节）
   实拍砖红主峰 (156,84,72)/(144,72,72)/(168,108,96)  ⇒ 基色取 #A85A48
   实拍屋面蓝主峰 (120,144,192)/(96,132,180)          ⇒ 基色取 #7E96C4
   ★ 关键判据：**B−R 的差值**。实拍屋面 B−R ≈ 72~96；v13 只有 44（读成灰瓦）。 */
var C = {
  /* 砖墙（实际颜色由 makeBrickTex 贴图决定，这里给"乘数基色"）
     ★ v14：整体**压暗 + 提饱和** —— v13 的 0xB08066 太亮太粉，是"塑料玩具感"来源。*/
  wallLit:  0xA85A48,   /* 受光面基色 = 实拍砖红主色 */
  wallMid:  0x9A5242,   /* 侧面 */
  wallDark: 0x7E4236,   /* 背光面 */
  wallPier: 0x9E564A,   /* 墙垛 / 转角柱 */
  wallLow:  0x84504A,   /* 基座（勒脚深一档）*/

  /* 屋面：实拍是**高饱和它蓝**（不是灰蓝！），半哑光金属
     ★★★ v16m 压暗（屋面采样数据）：
       v15 的 roofLit 0x7E96C4 在太阳 0.78 直射下，**东坡 47.4% 的像素 >195**
       （≈过曝白）—— 这就是"屋顶是一整块白塑料板"的数字证据。
       采样：北楼东坡 明度 179.2±41.9、>195 占 **47.4%**；
             西坡 160.6±27.5、>195 占 9.6%。
       修法：roofLit 0x7E96C4 → **0x6E86B4**（明度 150 → 130，−13%），
         roofDark 0x5E7AAE → 0x54709E、roofShade 0x44587E → 0x3E5276。
       ★ 判据仍然是 **B−R**：实拍 72~96；0x6E86B4 的 B−R = 70 ✓ 仍在区间内
         （压暗不能把蓝也压掉 —— 压暗时**保持 B−R**才是对的）。 */
  roofLit:  0x6E86B4,   /* 亮坡（B−R = 70 ✓ 接近实拍 72~96）*/
  roofDark: 0x54709E,   /* 暗坡（B−R = 74 ✓）*/
  roofShade:0x3E5276,   /* 檐下暗部 */
  ridge:    0x4A6288,   /* 脊瓦（★ 比坡面**暗**，实拍确认）*/
  ridgeHi:  0xB4C4DC,   /* 脊瓦顶面高光细线 */
  eaveBand: 0x2E4468,   /* 檐口封边带（★ v14 加深：实拍是很深的蓝黑）*/
  fascia:   0x33496E,   /* 立面顶部檐口带（与 eaveBand 同族）*/

  /* 连廊 */
  gallery:  0xCFD3D6,
  galleryE: 0xA6ABB0,
  galleryD: 0x848A90,

  /* 窗（★ v14：玻璃压到**近乎黑蓝** —— 实拍深色像素主峰 (0,0,8)）*/
  win:      0x0C1420,   /* 玻璃本体（近黑蓝）*/
  winLit:   0x2E4A6E,   /* 反光玻璃 */
  frame:    0xE4E0D8,   /* 窗套（浅暖白）*/
  frameD:   0x8E887E,   /* 窗套内圈 / 深色线条 */
  sill:     0xCFC8BA,   /* 窗台 / 腰线（浅）*/
  mullion:  0xDBD7CF,

  ac:       0xC8C4BC,
  vent:     0x9AA0A6,
  metal:    0x8A9096,
  metalD:   0x6E747A,

  /* ★★★ v17d 重定档：**按"渲染后明度"反推材质色**，不再凭眼睛选灰
     ────────────────────────────────────────────────────────────────
     实测（diag-roofkit2.cjs，屋面参考明度 146）：
        材质 0x5E6268 → 渲染 **190.2**（与屋面差 +44，读成"发光白盒"）
        材质 0x8A8880 → 渲染 **184.1**（+38）
        材质 0x9C9A94 → 渲染 **176.1**（+30）  ← v17 我给的"冷中灰"，实际太亮
        材质 0x8E9298 → 渲染 **174.9**（+29）
     ⇒ 屋顶是**朝上/斜向的面**，受太阳 0.78 + 半球 0.46 的近全照度，
       材质值被**抬升约 +90**。所以"中灰"到画面上必然是"浅灰"。
     ✅ 正解：**先定目标渲染值，再减掉光照抬升量**：
        目标 = 屋面 146 ±10（略暗一档最好，屋面设备本来就比屋面旧、脏）
        ⇒ 材质 ≈ 目标 − 90 ⇒ 取明度 55~75 的深灰档。
     ★ 这一条与 v16m 的教训（"改了有效果 ≠ 改对了地方"）一脉相承：
       上一轮我按"概念上的灰"选色，这一轮改成**按渲染回读反推**。 */
  stairWall: 0x4A4C50,   /* 楼梯间墙：目标渲染 ≈140（比屋面略暗一档）*/
  stairTop:  0x42444A,   /* 楼梯间屋面：再深一档，形成"压顶"的收头 */
  tank:      0x565C64,   /* 水箱：目标渲染 ≈150（金属，略反光所以稍亮）*/
  tankLow:   0x3E444C,   /* 水箱下箍/背光 */
  pipeD:     0x34383E,   /* 排气管/细线件：目标渲染 ≈148，且是"深色线"才有读感 */
  roofDeck:  0x46464A,   /* 设备基础地台（混凝土，最暗）*/

  ground:   0x9E9A92,   /* ★ v15c：从 0xB4B0A9 压暗一档（原色占全图 79% 像素、太抢）*/
  grass:    0x6E8450,
  island:   0x7A8F58,
  hedge:    0x456C3C,

  /* ══ 铺装广场（v18 新增）════════════════════════════════════════
     ★★★ 两条实验数据决定了整个做法（exp-plaza.cjs 实测）：
     ① **明度没有向上余量**：
          材质 0x8C8880 → 渲染 **179.8**、广场 >200 占比 **0%**（正好卡在临界点）
          材质 0x969289（+10 明度）→ 渲染 184.6、**广场受光面 70% 冲过 200**
        ⇒ 任何"加亮"都会立刻过曝。分格只能**靠压暗**做（深色缝），零过曝代价。
        ⇒ 传递率实测 **0.45~0.48**（既不是草地的 0.67，也不是屋顶的 +90 抬升）
     ② **屏幕换算 7.564 px/m**：
          旧分格线 0.03m = **0.227 px** —— 亚像素，等于没画
          （这就是"7 圈分格环可见像素 = 0"的真因，不是 z-fighting）
        ⇒ 分格线宽度下限 **0.22m ≈ 1.66px**。
          真实石缝 5mm 在本视角物理上不可能显示，必须做"尺度作弊"。
     ⚠️ BUILDING-SPEC.md：铺装 = **浅灰石材大板**（`#C8C6C2 → #B0AEA9`），
        形态是**正交方格**，不是同心环。 */
  plaza:      0x8C8880,   /* 石材底色 = **材质 color 本体**（不是写进贴图的）
                             ★ 贴图是"纯白基底 + ≤1.0 乘数"的调制层，见 tower-04 的长注释。
                             保持这个值不动 = 与已验证安全的 v17 逐像素相同。*/
  plazaJoint: 0x6E6A62,   /* 大分格缝（相对 plaza 系数 ≈0.78）——
                             ★ 为什么不是更深的 0x5E5A54(0.66)：
                               缝的**面积占比**在 2.1m 格上很大（软肩 0.30m ⇒ 覆盖 24%），
                               缝越深、广场整体被拉得越暗。实测 0.66 时广场掉到 170.7，
                               与草坪的差距从 +19 腰斩到 +10 —— 而参照物（真实航拍）
                               要求"铺装明显比草地亮"。0.78 在 1.36px 的缝芯上仍有
                               约 20 的明度落差，看得见，但少吃掉 5 点广场亮度。*/
  plazaFine:  0x79756D,   /* 细石板缝（相对 plaza 系数 ≈0.86，交给 mipmap 平均成质感）*/
  plazaEdge:  0x585650,   /* 收边带（深色石）——
                             为什么必须有：广场 179.8 与道路环 178.6 **只差 1.2**，
                             几乎同色，所以现在的广场边缘根本读不出来。
                             ⚠️ 没有再加"浅色压边"：广场明度零余量，任何亮边都会爆掉；
                             外侧本来就有路缘石（0.34m）充当那条亮线。 */
  /* 路缘石（0.34m 薄环，内外各一条）
     ★ 09-26 实测旧值 0xA8A49C **渲染 201.6，84.3% 的像素 >200**（纯过曝白线）。
       它不是"广场收边"，但它紧贴广场收边带外侧、属于同一处边缘处理，
       不收下来会让刚做的深色收边被一条白线顶掉。
       修法：按传递率 0.485 反推 —— 目标渲染 ≈187（留 13 的余量）⇒ 材质 ≈0x8A867E。*/
  curb:       0x8A867E
};

var FLOOR = 3.9;          /* ★ 层高 —— 实拍量：5 层楼总高约 19.5m */
var N_FLOOR = 5;
var FL = N_FLOOR * FLOOR;  /* 19.5m */
/* ★★ v12d 屋面参数重校（v12c 截图自查：屋顶占了建筑视觉高度的 1/3，明显过大）
   实拍反推（27836784 左上角那栋）：
     · 建筑总高（含屋顶）≈ 22m
     · 檐口高（墙顶）≈ 19.5m  ⇒  屋顶垂直投影高 ≈ 2.5m
     · 出檐约 1.2m；跨向进深约 12m ⇒ 半进深 6m
     · 屋面坡角 = atan(2.5 / 6) ≈ 22.6°  ← 与实拍目测一致
   v12c 的问题不是角度，而是 **ROOF_ANG=0.40(22.9°) 其实对**，
   真正过大的是 **EAVE_OUT=1.35** —— 出檐让"半径"从 6 涨到 7.35，
   rise 也跟着从 2.51 涨到 3.08，**整体放大 23%**。
   ⇒ 出檐收到 1.05（实拍量：大出檐但没有 1.35 那么夸张）*/
/* ★★ v14 屋面参数按实拍**重新反推**（v13b 的屋顶仍是"帐篷感"，见 DIAG-v14 ①）
   实拍证据（q-b1.png，左上那栋四坡顶）：
     · 四条戗脊很长、**正脊只有中间一小段**（≈ 屋面总长的 34%）
     · 屋面几乎"金字塔感"，坡面比 v13 更陡
     · 出檐**贴着实墙**，几乎看不出挑出（约 0.7m，不是 1.1m）
   反推：
     跨向进深 12m ⇒ 半进深 6m；檐高 19.5m；总高（含屋脊）≈ 22.6m
     屋面垂直投影高 = 22.6 − 19.5 = 3.1m
     坡角 = atan(3.1 / 6) ≈ 27.3°  ⇒ 0.477 rad
   ⇒ v14：ROOF_ANG 0.42→0.48、EAVE_OUT 1.10→0.75、正脊比 0.58→0.34 */
var ROOF_ANG = 0.48;       /* 屋面坡度 27.5°（实拍反推）*/
var EAVE_OUT = 0.75;       /* 出檐 0.75m（实拍：贴着实墙）*/
var RIB_PITCH = 1.20;      /* 屋面板宽 1.2m（实拍量）*/
var RIDGE_RATIO = 0.34;    /* ★ v14 新增：正脊长度占屋面总长比（实拍 34%）*/

/* ══════════════════════════════════════════════════════════════════
   渲染器 / 场景 / 相机
   ══════════════════════════════════════════════════════════════════ */
var W = window.innerWidth, H = window.innerHeight;
var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

var scene = new THREE.Scene();
/* ★★ v24：雾色 0xC6D2DE（冷蓝灰）→ 0xD9D0C0（暖米灰），整体偏暖。
   ⚠️ **不走"半球光地面色"那条路** —— 记忆里明确记着：
     09-26 把半球光地面色从暖橄榄 0x6C7458 改成冷灰蓝 0x5A6A78，
     **同时解决了「阴影偏暖」与「草地偏黄」两个问题**。
     改回去会把阴影重新染成"发闷的土色"—— 那是已验证过的错误方向。
   ⇒ 偏暖只能从**雾 + 天空 + 材质**走，不能从阴影光走。 */
scene.fog = new THREE.Fog(0xD9D0C0, 105, 330);

var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 700);
/* ★ 等距正交视角：方位角 36°、俯角 52° —— 接近实拍航拍又保留立面可见度 */
var CAM_AZ = THREE.MathUtils.degToRad(36);
var CAM_EL = THREE.MathUtils.degToRad(52);
var CAM_DIST = 150;
/* 相机初值（真正的取景在组装完成后由 fitCameraTo() 决定）*/
camera.position.set(
  Math.cos(CAM_EL) * Math.sin(CAM_AZ) * CAM_DIST,
  Math.sin(CAM_EL) * CAM_DIST,
  Math.cos(CAM_EL) * Math.cos(CAM_AZ) * CAM_DIST
);
camera.lookAt(0, 9, 0);

/* ★ 正交视锥自适应（在组装完成后调用一次）
   ★ v12b 教训：手动估 SCENE_EXT 两次都估偏（先偏小裁掉东楼、后偏大留白过多）。
   正解 = **按实际包围盒算**：把相机绕包围盒中心摆好，再按 8 个角在
   相机 right/up 轴上的投影求半跨度。 */
var CAM_TARGET = new THREE.Vector3(0, 9, 0);
function fitCameraTo(roots, margin, filter, aim, view) {
  margin = margin || 1.10;
  var box = new THREE.Box3();
  var tmp = new THREE.Box3();
  var list = Array.isArray(roots) ? roots : [roots];
  list.forEach(function (r) {
    r.updateMatrixWorld(true);
    r.traverse(function (o) {
      if (!o.isMesh && !o.isLine) return;
      if (filter && !filter(o)) return;
      tmp.setFromObject(o);
      if (!tmp.isEmpty()) box.union(tmp);
    });
  });
  if (box.isEmpty()) return;
  var c = box.getCenter(new THREE.Vector3());
  var s = box.getSize(new THREE.Vector3());
  /* ★★★ v24 新增第 4 参 `aim`：显式指定**视线中心**。
     ──────────────────────────────────────────────────────────────
     起因（实测截图）：小铺加了门前桌椅/遮阳伞之后，这些外摆件全在 +Z，
       把**包围盒中心**从主体往 +Z 拽了约 1.5m；
       而相机瞄的是包围盒中心 ⇒ 主体在画面里**偏到右上角**，
       左下一大片空台子。
     ✅ 正解：**瞄主体中心（aim）、但仍按全包围盒算取景范围**
       —— 这样主体居中，外摆也不会被裁掉（取景半跨度是按全盒算的）。
     ⚠️ 不能改成"只按主体算包围盒" —— 那样门前的桌椅会被裁出画面。 */
  if (aim) {
    CAM_TARGET.copy(aim);
  } else {
    CAM_TARGET.copy(c);
    CAM_TARGET.y = c.y * 0.72 + 2.0;      /* 视线中心略低，让屋顶上方留出天空 */
  }

  /* 相机方向（单位向量）
     ★★★ v25 新增第 5 参 `view`：**允许单栋覆盖方位/俯角**。
     起因（实测）：公寓改成 U 形院落之后，22.75m 高的两翼在全局
       **52° 俯角**下会遮住内院 `H / tan52° = 17.8m` —— 而内院净宽只有
       17m ⇒ **内院整个被吃掉，画面里只剩一条缝**。
     解法不是"把内院加宽到 35m"（那会脱离实拍比例），而是
       **对围合式建筑改用更陡的俯角**（照片本身也是近垂直的航拍）。
     不传 `view` ⇒ 完全沿用 CAM_EL / CAM_AZ ⇒ 零回归。 */
  var EL = (view && view.el !== undefined) ? view.el : CAM_EL;
  var AZ = (view && view.az !== undefined) ? view.az : CAM_AZ;
  var dir = new THREE.Vector3(
    Math.cos(EL) * Math.sin(AZ),
    Math.sin(EL),
    Math.cos(EL) * Math.cos(AZ)
  ).normalize();
  camera.position.copy(CAM_TARGET).addScaledVector(dir, CAM_DIST);
  camera.lookAt(CAM_TARGET);

  /* 相机基向量 */
  var fwd = dir.clone().negate();
  var right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
  var up = new THREE.Vector3().crossVectors(fwd, right).normalize();

  var hx = 0, hy = 0, p = new THREE.Vector3();
  for (var i = 0; i < 8; i++) {
    p.set(
      (i & 1) ? box.max.x : box.min.x,
      (i & 2) ? box.max.y : box.min.y,
      (i & 4) ? box.max.z : box.min.z
    ).sub(CAM_TARGET);
    hx = Math.max(hx, Math.abs(p.dot(right)));
    hy = Math.max(hy, Math.abs(p.dot(up)));
  }
  var aspect = W / H;
  var need = Math.max(hy, hx / aspect) * margin;
  camera.left = -need * aspect;
  camera.right = need * aspect;
  camera.top = need;
  camera.bottom = -need;
  camera.near = 1;
  camera.far = CAM_DIST * 3;
  camera.updateProjectionMatrix();
}

/* ══════════════════════════════════════════════════════════════════
   光照（v16：按对照实验重新配平 —— 见下）
   ══════════════════════════════════════════════════════════════════ */
/* ★★★ v16 对照实验（exp-lawn-wash.cjs）结论：
     草坪（占画面 75%）明度 207.8±8.3 —— "接近白的浅绿 + 零层次"。
     逐项单变量对照（量草坪区绿像素明度）：
       base 207.8 ／ 雾关 220.8(+13，雾反而在压暗) ／ 太阳关 144.4(−63)
       ／ 半球光关 192.1(−16) ／ toneMapping 217.9(无效，本就是 NoTone)
     ⇒ **太阳 1.05 是草坪发白的头号元凶（贡献约 3/4）**，半球光次之。
     修法：太阳 1.05 → 0.78，半球光 0.58 → 0.46；
       同时把天光颜色从"冷蓝白"改成"偏中性"（冷白会把绿色往灰白推）。

   ★★★ v16j 阴影配平（exp-shadow.cjs 对照实验）：
     阴影占全图 6.27%、边界梯度 14.06 —— **放大看是一块硬边灰三角**。
     逐项对照**全部无效**（四项参数改掉，指标纹丝不动）：
       PCFSoft→PCF     6.27% / 14.02
       mapSize 4096→8192 6.27% / 14.02
       bias 调 3.6 倍   6.22% / 14.11
     ⇒ 病**不在滤波参数**。真病有两条：
       ① **阴影是暖灰**（B−R=+6.0）—— 真实阴影应是**冷灰蓝**
          （被天空蓝染色），暖灰会让画面"发闷、像覆了一层土"。
          真因：半球光的**地面色 0x6C7458（暖橄榄）**在阴影区占了主导。
       ② 阴影区**明度标准差 15.35** 里几乎没有"边缘柔化带来的过渡"
          —— 因为 `normalBias 0.018` 在小构件（栏杆/窗台）上会**推离表面**，
            让阴影边界"跳"。
     修法：
       ① 半球光地面色 0x6C7458 → **0x5A6A78**（冷灰蓝，模拟天空反射进阴影）
          ★ 这一步同时解决"阴影偏暖"与"草地偏黄"两个问题。
       ② `sun.shadow.radius = 3.2`（PCFSoftShadowMap 支持，软化边界；
          默认 1 —— 这是唯一真正影响"软硬"的旋钮，之前从未设过）。
       ③ 阴影相机紧贴建筑群（left/right ±52 → ±40）⇒ 同样的 4096
          贴图覆盖更小范围 ⇒ 每个纹素代表的面积小 1.7 倍 ⇒ 边界更细。 */
scene.add(new THREE.HemisphereLight(0xBCCEDC, 0x5A6A78, 0.46));

var sun = new THREE.DirectionalLight(0xFFF4E4, 0.78);
sun.position.set(-52, 96, 46);
sun.castShadow = true;
/* ★ v16j：4096 → 8192（配合上面的 ±78 全包，纹素密度反而更细 25%）*/
sun.shadow.mapSize.set(8192, 8192);
var sc = sun.shadow.camera;
/* ★★★ v16j：阴影相机范围 + 贴图档位按「实测需要」定，不再拍脑袋。
   diag-shadowcam.cjs 把场景投影到光源相机空间量出：
     · **核心建筑群**（3122 个投影网格，排除院子装饰）
        需要 x ∈ [−32.1, 29.6]、y ∈ [−24.6, 41.2]
     · 含院子装饰（树/灌木）需要 x ∈ [−75.1, 71.1]、y ∈ [−57.2, 76.2]
   ★ 为什么不"只包建筑把树排除"：树影是**草坪层次的主要来源之一**
     （实测草坪标准差 8 → 15 里树影贡献不小）⇒ 关掉会让画面变差。
   ⇒ 正解 = **全包 ±78，同时把贴图从 4096 提到 8192**：
       纹素密度 = 2×78/8192 = **0.0190 m/纹素**
       对比原方案 2×52/4096 = 0.0254 m/纹素 ⇒ **反而细 25%**。
     这是"覆盖范围 × 贴图档位"的换算，而不是只调其中一个。
   ★ 教训：±52/4096 这套参数从 v12 一直用到 v16，**从没算过一次**。
     现在有了 `diag-shadowcam.cjs`，改建筑尺寸后重跑即可确认。
   ★ 成本：8192² = 6700 万纹素 × 4 字节 ≈ 268MB 显存（单张深度图）。
     对 8GB 卡安全；若未来给移动端，改回 4096 + 缩到 ±60 即可。 */
sc.left = -78; sc.right = 78; sc.top = 78; sc.bottom = -78; sc.near = 20; sc.far = 300;
sun.shadow.bias = -0.00022;
sun.shadow.normalBias = 0.018;
/* ★★★ v16j 新增：`shadow.radius` —— 这是唯一真正控制"软硬"的旋钮，
   之前从未设过（默认 1）。PCFSoftShadowMap 下 radius 直接决定
   模糊核的采样半径。3.2 ⇒ 阴影边缘有 3~4px 的柔和过渡带。 */
sun.shadow.radius = 3.2;
scene.add(sun);

/* 反向补光：把背光面从死黑里救出来（实拍里背光面仍能读出砖色）*/
var fill = new THREE.DirectionalLight(0x9EB4CA, 0.24);
fill.position.set(58, 30, -52);
scene.add(fill);

/* 檐下补光：从下往上打，模拟地面反射光填进大出檐的阴影（★ 出檐 1.35m 必须有这条，
   否则檐下一片黑，那些"檐下阴影带"就变成"檐下一坨黑"）*/
var bounce = new THREE.DirectionalLight(0xC8B49A, 0.22);
bounce.position.set(10, -40, 10);
scene.add(bounce);

/* ── 外部验证钩子（诊断脚本用，不参与渲染）────────────────────────── */
window.__three = { renderer: renderer, scene: scene, camera: camera, THREE: THREE };

/* ★★★ v17e 新增：把**色板本身**暴露出去。
   起因：`gate-geometry.cjs` 的 G1/G7 曾把材质色号**硬编码**在断言里
     （`0x9C9A94` / `0x8E9298`），结果这一轮我把屋顶设备色板整体改深，
     闸门立刻报"未找到楼梯间几何 / 共 0 个水箱" —— **不是几何坏了，
     是闸门在按色号找构件**。
   这条与 §8.4「验证工具自身也要核算」同源：**闸门不能依赖会漂移的常量**。
   ⇒ 改成"闸门按**名字**取色号"。 */
window.__C = {};
Object.keys(C).forEach(function (k) { window.__C[k] = C[k]; });
window.__palette = function () { return C; };
window.__setL = function (type, v) {
  scene.traverse(function (o) { if (o.isLight && o.type === type) o.intensity = v; });
};
window.__lights = function () {
  var a = [];
  scene.traverse(function (o) {
    if (o.isLight) a.push({ type: o.type, intensity: o.intensity,
      color: o.color ? o.color.getHexString() : null });
  });
  return a;
};
window.__setFog = function (near, far, hex) {
  if (near === null) { scene.fog = null; return; }
  if (!scene.fog) scene.fog = new THREE.Fog(hex || 0xC6D2DE, near, far);
  else { scene.fog.near = near; scene.fog.far = far;
         if (hex !== undefined) scene.fog.color.setHex(hex); }
};

/* ══════════════════════════════════════════════════════════════════
   天空（渐变 + 极淡云带）
   ══════════════════════════════════════════════════════════════════ */
(function () {
  var cv = document.createElement('canvas');
  cv.width = 8; cv.height = 512;
  var c2 = cv.getContext('2d');
  var g = c2.createLinearGradient(0, 0, 0, 512);
  /* ★ v24 整体偏暖：顶部仍留蓝（不然像沙尘），中下部往暖白/米黄推。
     原值 → 现值：#7FA8CE→#83A6C6 / #B6CEE2→#C6D2DA /
                    #DCE4E6→#E6E2D6 / #EDE6D8→#F2E3C6 */
  g.addColorStop(0.00, '#83A6C6');
  g.addColorStop(0.42, '#C6D2DA');
  g.addColorStop(0.72, '#E6E2D6');
  g.addColorStop(1.00, '#F2E3C6');
  c2.fillStyle = g; c2.fillRect(0, 0, 8, 512);
  var t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  scene.background = t;
})();

/* ══════════════════════════════════════════════════════════════════
   工具函数
   ══════════════════════════════════════════════════════════════════ */
function mat(color, opt) {
  opt = opt || {};
  var m = new THREE.MeshStandardMaterial({
    color: color,
    roughness: opt.rough === undefined ? 0.82 : opt.rough,
    metalness: opt.metal === undefined ? 0.04 : opt.metal,
    flatShading: !!opt.flat,
    side: opt.side || THREE.FrontSide
  });
  /* ★★★ v22 修复「贴图选项静默失效」。
     症状：`makeApartment` 里写着
       `var brickTex = makeBrickTex(seed, true);
        var mWall = mat(AC.wallLit, { tex: brickTex, rough: 0.92 });
        brickTex.repeat.set(W / BRICK_TILE_M, bodyH / BRICK_TILE_M);`
     但本函数的选项表里**从来没有 `tex`** ⇒ `brickTex` 被创建、被设 repeat、
     然后**被丢弃** ⇒ 公寓墙**从来没有砖纹**，一直是一块纯色。
     （这正是"静默失效"：不报错、不警告、肉眼只看到"素面墙"，
       很容易被当成"设计就是这样"。）

     ★ 判据：调用方传了一个参数、被调方不读 ⇒ 永远是 bug（不是"宽容"）。
       排查手法：`grep -n "opt\." <被调函数>` 与调用点逐一对照。

     ★ 为什么不在这里把 color 强制设成白（§14.1 要求 map×color 不能双重相乘）：
       本项目公寓用的是**中性灰阶贴图**（`makeBrickTex(seed, true)`，R=G=B），
       它本身不含彩度 ⇒ 不存在双向调制，色相**本来就该**由 color 单独承担。
       强制设白反而会让色板失效（详见 tower-05 里那段长注释）。 */
  if (opt.tex) {
    m.map = opt.tex;
    m.needsUpdate = true;
  }
  return m;
}
function box(w, h, d, material, x, y, z) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
/* 确定性伪随机（视觉校对必须"刷十次长一样"）*/
function rnd(i, salt) {
  var s = Math.sin(i * 12.9898 + (salt || 0) * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/* ══════════════════════════════════════════════════════════════════
   材质表 M —— ★★★ v22 改造成「可重算」
   ──────────────────────────────────────────────────────────────────
   为什么要改：v12 至今 `M` 是**加载时固化**的一份材质实例表。
     后果：`C`（实验楼色板）改完之后，`M.wallMid` 里那些实例**不会跟着变**
     —— 所以"给不同教学楼上不同颜色"这件事在结构上做不到。
     （对比：`makeApartment` 之所以能双色板切换，是因为它在函数体内
       **实时**读 `AC.wallLit` 现造材质；`makeTower` 则是直接引用 `M.xxx`。）

   ✅ 做法：把材质表抽成 `buildM()`，`M` 仍是同一个全局 var，
     调用方可配合 `withPalette()` 临时换 `C` 再重建 M。
     ★ 不传色板时 `buildM()` 产出的对象与改造前**逐字段一致** ⇒ 零回归
       （已用同尺寸截图逐像素验证：平均绝对差 0.000、差异像素 0%）。
   ══════════════════════════════════════════════════════════════════ */
function buildM() {
  return {
    wallLit:  mat(C.wallLit,  { rough: 0.90 }),
    wallMid:  mat(C.wallMid,  { rough: 0.90 }),
    wallDark: mat(C.wallDark, { rough: 0.90 }),
    pier:     mat(C.wallPier, { rough: 0.88 }),
    base:     mat(C.wallLow,  { rough: 0.93 }),
    roofLit:  mat(C.roofLit,  { rough: 0.56, metal: 0.26 }),
    roofDark: mat(C.roofDark, { rough: 0.56, metal: 0.26 }),
    roofShd:  mat(C.roofShade,{ rough: 0.66, metal: 0.14 }),
    ridge:    mat(C.ridge,    { rough: 0.50, metal: 0.28 }),
    ridgeHi:  mat(C.ridgeHi,  { rough: 0.25, metal: 0.62 }),   /* 脊瓦高光细线 */
    eaveBand: mat(C.eaveBand, { rough: 0.52, metal: 0.24 }),   /* 檐口封边带 */
    fascia:   mat(C.fascia,   { rough: 0.54, metal: 0.22 }),   /* 立面檐口带 */
    gallery:  mat(C.gallery,  { rough: 0.62 }),
    galleryE: mat(C.galleryE, { rough: 0.55, metal: 0.20 }),
    galleryD: mat(C.galleryD, { rough: 0.58, metal: 0.22 }),
    win:      mat(C.win,      { rough: 0.12, metal: 0.46 }),
    winLit:   mat(C.winLit,   { rough: 0.09, metal: 0.58 }),
    frame:    mat(C.frame,    { rough: 0.58 }),                /* 窗套（浅暖白）*/
    frameD:   mat(C.frameD,   { rough: 0.62 }),                /* 窗套内圈 / 深线 */
    sill:     mat(C.sill,     { rough: 0.66 }),                /* 窗台 / 腰线 */
    mullion:  mat(C.mullion,  { rough: 0.58 }),
    ac:       mat(C.ac,       { rough: 0.62 }),
    vent:     mat(C.vent,     { rough: 0.52, metal: 0.30 }),
    metal:    mat(C.metal,    { rough: 0.66, metal: 0.16 }),
    metalD:   mat(C.metalD,   { rough: 0.68, metal: 0.16 }),
    /* ★ v16m 屋顶设备专用（不再复用"窗套白"）*/
    stairWall: mat(C.stairWall, { rough: 0.88 }),
    stairTop:  mat(C.stairTop,  { rough: 0.86 }),
    tank:      mat(C.tank,      { rough: 0.60, metal: 0.22 }),
    tankLow:   mat(C.tankLow,   { rough: 0.64, metal: 0.20 }),
    pipeD:     mat(C.pipeD,     { rough: 0.70, metal: 0.24 }),
    roofDeck:  mat(C.roofDeck,  { rough: 0.92 })
  };
}
var M = buildM();

/* ★★★ v22 新增：临时换色板执行一段代码，然后**原样还原**。
   用法：`withPalette({ wallLit: 0xEDE0C3 }, function () { return makeTower(...); })`
   保证：① 只覆盖传入的键（其余沿用当前 C）
         ② 无论 fn 是否抛异常，色板与 M 都会还原（try/finally）
         ③ 返回 fn 的返回值 ⇒ 可以 `var g = withPalette(pal, fn)`
    ★★★ v22a 修正：`colorSet` 里**原本 C 没有的键**（如新增的 `wallTint`）
      必须记录并在还原时 `delete` —— 否则第一个色板的值会**残留**给后续所有建筑
      （这是"静默污染"：后面每栋楼都被前一个色板悄悄染色，且不报错）。 */
function withPalette(colorSet, fn) {
  var saved = {}, added = [];
  for (var k in C) saved[k] = C[k];
  for (var k2 in colorSet) {
    if (colorSet[k2] === undefined) continue;
    if (!Object.prototype.hasOwnProperty.call(C, k2)) added.push(k2);
    C[k2] = colorSet[k2];
  }
  M = buildM();
  try {
    return fn();
  } finally {
    for (var k3 in saved) C[k3] = saved[k3];
    for (var a = 0; a < added.length; a++) delete C[added[a]];
    M = buildM();
  }
}
