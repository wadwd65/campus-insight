/* ══════════════════════════════════════════════════════════════════════
   v13 · 立面生成器（★ 按 1536×1536 原图局部放大后的**第三次精读**重写）
   ══════════════════════════════════════════════════════════════════════
   ★★★ 本轮精读纠正了 v12 的 5 处根本性错误（对照 q-court.png / q-facade.png / q-corner.png）：

   | # | v12 做的 | 实拍真值 | 证据 |
   |---|---|---|---|
   | 1 | 屋面板宽 0.42m | **约 1.2m**，板间是**深色细缝**（不是亮凸条） | q-facade 右侧大屋面 |
   | 2 | 屋脊/戗脊是**亮色** | 脊瓦比坡面**略暗**，是深灰蓝 | q-court 左侧四坡顶 |
   | 3 | 立面无砖缝 | 砖墙有**纵横浅色勾缝网格**（"高级感"之源） | q-corner 左侧大面积 |
   | 4 | 只有横向窗带 | **同时有「横向带窗」+「竖向贯通玻璃带」** | q-corner 左下深蓝竖带 |
   | 5 | 无檐口带 | 屋顶与墙之间有**深蓝灰檐口带**（约 0.7m） | q-facade 屋面下沿 |

   立面真正的构成（自上而下）：
     ══ 深蓝灰檐口带（0.70m）═══════════════
     ── 横向腰线（浅色挑出 0.15m）──────────
     │ 第5层：窗（白窗套 + 深玻璃）× n + 空调外机 │
     ── 腰线 ──
     │ 第4层 …                                 │
     ── 腰线 ──
     │ 第2层 …                                 │
     ── 腰线 ──
     │ 第1层 …                                 │
     ── 基座（勒脚 0.85m）──
   ══════════════════════════════════════════════════════════════════════ */

/* 立面朝向：0=+Z, 1=+X, 2=-Z, 3=-X
   ────────────────────────────────────────────────────────────────
   ★★★ v14 关键修正（v13 的**致命逻辑错误**，导致窗户全部变成白块）
   v13 的语义是「**内表面**贴在墙面上，外表面在 v+d 处」：
       out = v + d/2   ⇒   box 中心 = halfD + v + d/2
       ⇒ 内表面在 halfD + v，外表面在 halfD + v + d
   调用方传 v = -0.15 想让"玻璃凹进 0.15" —— 结果**内表面真的凹进去了**，
   但外表面在 -0.15+0.05 = **-0.10**，仍比窗套的 v=+0.010 靠里 ——
   然而窗套的 d=0.030、外表面在 +0.010+0.030 = **+0.040**…
   于是 6 层构件的**外表面**分别是：窗套 +0.040 / 内圈 +0.007 / 玻璃 -0.100
   ⇒ 玻璃确实最靠里 ✓ …… 但**窗套比玻璃大出 0.13m**（w+0.13、h+0.13），
     而窗套是被渲染成**一整块实心板**（不是框！）⇒ **窗套把玻璃整块盖住了**。
   ⇒ 现象：所有窗渲染成**纯白方块**（实测：立面区深色玻璃像素 = 0）。

   ✅ 正解：**函数语义改为"外表面恰好贴在墙面上，向内长 d"**，
      这样调用方给 v 就能直接控制"凸出墙面多少 / 凹进墙面多少"，不会自相矛盾：
        外表面 = halfD + v，内表面 = halfD + v − d
      ⇒ v > 0 = 凸出墙面；v < 0 = 凹进墙里。这正是调用方**一直在假定的语义**。
      另外把窗套从"实心板"改成**四根边框条**（真窗套），玻璃才露得出来。
   ──────────────────────────────────────────────────────────────── */
function faceBox(parent, dir, halfW, halfD, u, y, v, w, h, d, material) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(
    (dir === 0 || dir === 2) ? w : d,
    h,
    (dir === 0 || dir === 2) ? d : w
  ), material);
  /* ★ v = 外表面相对墙面的**外法向**偏移（>0 凸出、<0 凹进）；
       盒子向墙内长 d ⇒ 中心比外表面靠里 d/2。 */
  var c = v - d / 2;
  if (dir === 0) m.position.set(u, y, halfD + c);       /* +Z 面：外法向 +Z */
  else if (dir === 2) m.position.set(u, y, -halfD - c); /* -Z 面：外法向 -Z */
  else if (dir === 1) m.position.set(halfW + c, y, u);  /* +X 面：外法向 +X */
  else m.position.set(-halfW - c, y, u);                /* -X 面：外法向 -X */
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ── 一扇标准窗（★★★ v14 重写：**横向扁窗** + **真窗套**）
   ────────────────────────────────────────────────────────────────
   ★ v13b 的窗是 **1.50m 宽 × 2.05m 高的竖高窗** —— 方向**完全反了**。
   实拍量值（q-fac.png 右下角那栋的立面，4 开间）：
     · 开间中心距 ≈ 3.4m
     · 窗净宽   ≈ 2.05m  ⇒ 占开间 **60%**
     · 窗净高   ≈ 1.75m  ⇒ **比宽小**，是扁窗
     · 窗下墙   ≈ 0.75m，窗上墙 ≈ 1.40m
   ★★★ v14 第二处致命修正：v13 的"窗套"是 **w+0.13 × h+0.13 的实心板**，
       它把玻璃**整块盖住** ⇒ 实测立面上深色玻璃像素 = **0**。
       ✅ 改为**四根边框条**（上/下/左/右），玻璃才漏得出来。 */
function aWindow(parent, dir, halfW, halfD, u, y, w, h) {
  var FB = 0.075;          /* 窗套边框条宽（沿墙面方向）*/
  var FD = 0.030;          /* 窗套边框条厚（垂直墙面）*/
  /* ★★★ v14c：v 是**外法向**偏移，正数朝外。
     结构体墙面已在 halfWf/halfDf（= 真实墙表面），所以：
       玻璃 v = +0.008  ⇒ 玻璃外表面比墙面凸出 8mm（读作"嵌在墙里的窗"）
       窗套 v = +0.030  ⇒ 窗套比玻璃再凸 22mm（框住玻璃）
     之前给 −0.075 是**朝墙内**跑 ⇒ 玻璃埋进墙里（实测像素 0）。 */
  var GLASS_V = 0.008;

  /* ① 玻璃（最里层）*/
  faceBox(parent, dir, halfW, halfD, u, y, GLASS_V, w, h, 0.045, M.win);
  /* ② 竖向窗梃（扁窗分 4 格，3 条细梃）—— 比玻璃再凸一点 */
  [-1.5, 0, 1.5].forEach(function (k) {
    faceBox(parent, dir, halfW, halfD, u + k * w / 4, y, GLASS_V + 0.014,
            0.045, h, 0.030, M.frame);
  });
  /* ③ 窗套 = 四根边框条（★ 不再用实心板，否则盖住玻璃）*/
  faceBox(parent, dir, halfW, halfD, u, y + h / 2 + FB / 2, 0.030, w + FB * 2, FB, FD, M.frame);
  faceBox(parent, dir, halfW, halfD, u, y - h / 2 - FB / 2, 0.030, w + FB * 2, FB, FD, M.frame);
  faceBox(parent, dir, halfW, halfD, u - w / 2 - FB / 2, y, 0.030, FB, h, FD, M.frame);
  faceBox(parent, dir, halfW, halfD, u + w / 2 + FB / 2, y, 0.030, FB, h, FD, M.frame);
  /* ④ 下窗台挑出（浅色，受光，比窗套更凸）*/
  faceBox(parent, dir, halfW, halfD, u, y - h / 2 - FB - 0.055, 0.075,
          w + 0.30, 0.075, 0.11, M.sill);
  /* ⑤ 上窗楣挑出（浅色，下方投出暗影）*/
  faceBox(parent, dir, halfW, halfD, u, y + h / 2 + FB + 0.050, 0.062,
          w + 0.24, 0.075, 0.09, M.sill);
}

/* ── 竖向贯通玻璃带（★ v13 新增 —— 实拍 q-corner 左下那条深蓝竖带）
   从第 1 层一直到檐口，宽度约 1.6~2.2m，每层有横向分格。
   实拍里这是**楼梯间/电梯厅的开窗**，是立面上唯一的竖向元素。 */
function verticalGlassBand(parent, dir, halfW, halfD, u, nf, w) {
  w = w || 1.9;
  var h = nf * FLOOR;
  /* ★ v14c：v 改为**外法向**正值（原先 −0.14 是朝墙内跑 ⇒ 整条带埋进墙里不可见）
     ★★ v15 修异常 [C]：顶端封头原在 h+0.24 ⇒ **高出墙顶 0.24m**，
        会插进檐口带（檐口带底正好在 h）⇒ 截图上竖带顶部"戳穿"檐口。
        正解：竖带整体下移，顶端收到**檐口带下沿**（h − 0.10）。 */
  var topY = h - 0.10;                  /* 竖带顶端 */
  var botY = 0.55;                      /* 竖带底端（地面以上）*/
  var bandH = topY - botY;
  var yc = (topY + botY) / 2;
  /* 背板（深蓝玻璃，整条贯通）*/
  faceBox(parent, dir, halfW, halfD, u, yc, 0.006, w, bandH, 0.06, M.win);
  /* 两侧白色边梃（通高）*/
  [-1, 1].forEach(function (k) {
    faceBox(parent, dir, halfW, halfD, u + k * (w / 2 + 0.055), yc, 0.030,
            0.11, bandH + 0.06, 0.09, M.frame);
  });
  /* 层间横向分格（每层一道白框）*/
  for (var f = 1; f < nf; f++) {
    faceBox(parent, dir, halfW, halfD, u, f * FLOOR + 0.30, 0.030,
            w, 0.10, 0.08, M.frame);
  }
  /* 顶端封头（★ 收到檐口带下沿，不再戳穿）*/
  faceBox(parent, dir, halfW, halfD, u, topY - 0.07, 0.030, w + 0.22, 0.14, 0.10, M.frame);
  /* 底端封头（勒脚）*/
  faceBox(parent, dir, halfW, halfD, u, botY + 0.07, 0.030, w + 0.22, 0.14, 0.10, M.frame);
}

/* ── 单层：一排窗 + 腰线（★ v14 重写开间与窗宽）
   ★ 实拍真相（q-fac.png）：**窗带是主、砖墙是次** —— 深色玻璃面积甚至比砖还多。
     v13 让窗只占开间 40% ⇒ 立面变成"砖墙为主、窗是点缀"，与实拍相反。
   ⇒ v14：开间 3.4m、窗宽 2.05m（占 60%）、窗间砖垛仅 1.35m。 */
function windowRow(parent, dir, halfW, halfD, len, yBase, bays, o) {
  o = o || {};
  var winH = o.winH === undefined ? 1.75 : o.winH;   /* ★ v14：扁窗 1.75m */
  var winW = o.winW;
  var yC = yBase + 0.75 + winH / 2;          /* 窗中心（窗下留 0.75m 砖墙）*/
  var bw = len / bays;
  if (winW === undefined) winW = Math.min(bw * 0.60, 2.10);   /* ★ 60% 开间 */
  var entryBay = o.entryBay === undefined ? -1 : o.entryBay;
  var skip = o.skip || [];                    /* ★ v14：让给竖向玻璃带的开间 */

  for (var b = 0; b < bays; b++) {
    if (skip.indexOf(b) >= 0) continue;       /* 该开间整间让给竖带 */
    var uC = -len / 2 + (b + 0.5) * bw;
    if (b === entryBay) {
      /* 入口开间：整间玻璃门（从地面起）
         ★ v14c：v 改正值（外法向），玻璃门才不会埋进墙里 */
      var dh = 3.05;
      faceBox(parent, dir, halfW, halfD, uC, dh / 2 + 0.30, 0.008,
              bw * 0.70, dh, 0.06, M.winLit);
      faceBox(parent, dir, halfW, halfD, uC, dh / 2 + 0.30, 0.034,
              bw * 0.70 + 0.28, dh + 0.28, 0.05, M.frame);
      /* 门中挺 */
      faceBox(parent, dir, halfW, halfD, uC, dh / 2 + 0.30, 0.044,
              0.07, dh, 0.05, M.frame);
      continue;
    }
    aWindow(parent, dir, halfW, halfD, uC, yC, winW, winH);
  }

  /* 层间腰线（通长，浅色挑口 —— 分层最强读数）
     ★ v15c 修异常 [K]：v14 用 v=0.11 / 厚 0.22 / len+0.12。
       三个问题：① 0.22m 厚 = 在立面上读成"一道梁"而不是"一条线"；
       ② len+0.12 两端**伸出墙外 0.06**，在北楼正面看到腰线戳出墙角；
       ③ 凸出 0.11 与窗台(0.075)差得太小，腰线和窗台糊成一片。
     ✅ 实拍（q-fac 局部放大）：腰线是**薄挑口**，凸出约 0.07、净厚约 0.09。 */
  faceBox(parent, dir, halfW, halfD, 0, yBase + FLOOR - 0.12, 0.070,
          len - 0.10, 0.115, 0.16, M.sill);
  /* 腰线下的暗线（让腰线浮起）*/
  faceBox(parent, dir, halfW, halfD, 0, yBase + FLOOR - 0.205, 0.030,
          len - 0.16, 0.055, 0.085, M.frameD);
}

/* ── 整面墙（多层）────────────────────────────────────────────────
   ★ v14：竖向玻璃带移到**楼体端部**（实拍位置），且该开间**不画窗阵**。
   ★ v14：檐口带加宽到 0.90m（实拍存在感极强），颜色加深。*/
function facade(parent, dir, halfW, halfD, len, nf, o) {
  o = o || {};
  var bays = o.bays || Math.max(3, Math.round(len / 3.4));   /* ★ 开间约 3.4m */
  var winW = Math.min((len / bays) * 0.60, 2.10);

  /* ★★ v14 竖带位置 = **楼体端部**（实拍：楼梯间在端部，不在开间中部）
     v13 放在 `floor(bays/3)`（中部）⇒ 与窗阵挤在一起、且不合实拍。
     取「第 0 开间」= 最西/最北端。 */
  var vbands = o.vbands === undefined
    ? (bays >= 4 ? [0] : [])
    : o.vbands;

  for (var f = 0; f < nf; f++) {
    windowRow(parent, dir, halfW, halfD, len, f * FLOOR, bays, {
      winW: winW,
      entryBay: (f === 0 && o.entry) ? Math.floor(bays / 2) : -1,
      winH: o.winH,
      skip: vbands            /* ★ 让给竖带的开间不画窗 */
    });
  }

  /* 竖向贯通玻璃带（覆盖在窗阵列之上）*/
  vbands.forEach(function (bi) {
    var u = -len / 2 + (bi + 0.5) * (len / bays);
    verticalGlassBand(parent, dir, halfW, halfD, u, nf, Math.min(2.0, len / bays * 0.62));
  });

  /* ★ 檐口带（深蓝灰，0.90m）—— 屋顶与墙之间的过渡，实拍存在感极强 */
  faceBox(parent, dir, halfW, halfD, 0, nf * FLOOR + 0.45, 0.045,
          len + 0.24, 0.90, 0.19, M.fascia);

  /* 基座（勒脚）：深一档，高 0.85m，放出 0.10m */
  faceBox(parent, dir, halfW, halfD, 0, 0.425, 0.05, len + 0.20, 0.85, 0.20, M.base);

  /* 雨落管（垂直深色细管，从檐口到地面 —— 实拍每面可见 2~3 根）
     ★ v15 修异常 [H]：原 v=0.075、厚 0.13 ⇒ 外表面 0.075，比窗套(0.030)更凸
       ⇒ 视觉上"管子压住窗"。且它会**穿过腰线**（腰线凸 0.11）。
     正解：雨落管收到 v=0.048、厚 0.09（外表面 0.048），比腰线(0.11)靠里、
       比窗套(0.030)略凸 ⇒ 读作"贴着墙的细管"，不抢窗。 */
  var nD = Math.max(2, Math.round(len / 8));
  for (var i = 0; i < nD; i++) {
    var ud = -len / 2 + (i + 0.5) * (len / nD) + (rnd(i, dir + 40) - 0.5) * 1.4;
    faceBox(parent, dir, halfW, halfD, ud, nf * FLOOR / 2, 0.048,
            0.10, nf * FLOOR, 0.09, M.frameD);
  }

  return bays;
}

/* ── 空调外机（★ v15：修"压在窗上"）
   ────────────────────────────────────────────────────────────────
   ★ 实测异常 [F]：v14 的空调 y = f*FLOOR + 0.62，高 0.58
     ⇒ 顶端在 f*FLOOR + 0.91，而第 f 层**窗底**在 f*FLOOR + 0.75
     ⇒ 空调**压住窗下沿 0.16m**（截图上看到"白盒子啃掉窗角"）。
   正解：空调应放在**窗下墙**里（0.75m 高的砖墙），窗台以下：
     窗台底 = f*FLOOR + 0.75 - 0.055 - 0.075(窗台厚) ≈ f*FLOOR + 0.62
     ⇒ 空调顶必须 ≤ f*FLOOR + 0.60，取高 0.52、中心 f*FLOOR + 0.33。 */
function acUnits(parent, dir, halfW, halfD, len, nf, o) {
  o = o || {};
  var bays = o.bays || 6;
  var bw = len / bays;
  var H = 0.52;                       /* 空调机身净高 */
  for (var f = 1; f < nf; f++) {
    for (var b = 0; b < bays; b++) {
      if (rnd(b * 3 + f * 11, 7) > 0.36) continue;
      var u = -len / 2 + (b + 0.5) * bw + bw * 0.30 + (rnd(b + f, 3) - 0.5) * 0.5;
      /* ★ 顶端 = f*FLOOR + 0.59 ≤ 窗台 0.62，绝不压窗 */
      var yTop = f * FLOOR + 0.59;
      var y = yTop - H / 2;
      /* 支架（两根，从机身下方伸到墙）*/
      faceBox(parent, dir, halfW, halfD, u - 0.38, y - H / 2 - 0.10, 0.055, 0.07, 0.20, 0.30, M.metalD);
      faceBox(parent, dir, halfW, halfD, u + 0.38, y - H / 2 - 0.10, 0.055, 0.07, 0.20, 0.30, M.metalD);
      /* 机身 */
      faceBox(parent, dir, halfW, halfD, u, y, 0.075, 0.94, H, 0.42, M.ac);
      /* 出风格栅（深色横线）*/
      faceBox(parent, dir, halfW, halfD, u, y + 0.07, 0.29, 0.82, 0.12, 0.02, M.metalD);
    }
  }
}

/* ── 入口雨棚 ─────────────────────────────────────────────────── */
function entryCanopy(parent, dir, halfW, halfD, len, o) {
  o = o || {};
  var w = o.w || 5.6, u = o.u === undefined ? 0 : o.u, y = 3.65, depth = 2.6;
  faceBox(parent, dir, halfW, halfD, u, y + 0.15, 0.48, w, 0.14, depth, M.gallery);
  faceBox(parent, dir, halfW, halfD, u, y + 0.32, 0.48, w + 0.16, 0.22, depth + 0.16, M.galleryE);
  [-1, 1].forEach(function (sg) {
    var rod = faceBox(parent, dir, halfW, halfD, u + sg * (w / 2 - 0.40), y - 0.60, 0.22,
                      0.09, 1.42, 0.09, M.galleryD);
    rod.rotation.z = sg * 0.44;
  });
  for (var i = 0; i < 3; i++) {
    faceBox(parent, dir, halfW, halfD, u, 0.075 + i * 0.16, 0.10 + i * 0.32,
            w * 0.74, 0.16, 0.36, M.base);
  }
  var ramp = faceBox(parent, dir, halfW, halfD, u - w * 0.74, 0.24, 0.60, 2.8, 0.11, 1.6, M.base);
  ramp.rotation.z = 0.082;
}

/* ══════════════════════════════════════════════════════════════════
   中文文字贴图 + 立面贴字（v23 新增）
   ──────────────────────────────────────────────────────────────────
   为什么必须走 canvas 贴图，而不是几何挤出：
     用 `ExtrudeGeometry` 做中文字**需要字体轮廓数据**（typeface.json /
     TTF 解析），而本项目是**单文件零依赖**（three.js 内联、不能外链字体）
     ⇒ 没有轮廓数据就做不出几何字。
     ✅ canvas 2D 画字 → `CanvasTexture` 贴到薄面上，是**无依赖的正解**，
        而且 `ctx.font` 可以直接用系统字体 `"Microsoft YaHei"`。

   ★ 可读尺度的判据 —— 这里有个容易被误判的点：
     全局是 7.564 px/m（看整片校园时），但**单栋取景时分辨率完全不同**：
       26m 的教学楼占约 1000px ⇒ **38 px/m**
       6m 的小铺占约 800px   ⇒ **133 px/m**
     ⇒ 判据必须按**单栋取景的分辨率**算，不能拿全局值套。
       本项目取：楼名标牌高 **0.78m**（38px/m ⇒ 30px 高，中文可读）；
       小铺招牌高 **0.62m**（133px/m ⇒ 82px 高，非常清楚）。
   ══════════════════════════════════════════════════════════════════ */

/* 把一段文字画成贴图。
   o: { fs 字号(px) / fg 字色 / bg 底色(null=透明) / border 边框色 /
        sub 第二行小字 / subFg 小字色 / fgStroke 描边色(透明底时可读性保障) /
        padX / padY / radius 圆角 } */
function makeSignTex(text, o) {
  o = o || {};
  var s = String(text);
  var fs = o.fs || 96;
  var padX = o.padX === undefined ? Math.round(fs * 0.30) : o.padX;
  var padY = o.padY === undefined ? Math.round(fs * 0.16) : o.padY;
  var hasSub = !!o.sub;
  /* ★ 中文是**方块字**，字宽 ≈ 字高。用 1.06 留一点字距，
     并额外留一点右边缘（最后一行字不贴边）。 */
  var cw = Math.max(48, Math.ceil(s.length * fs * 1.06 + padX * 2));
  var ch = Math.ceil(fs * 1.30 + padY * 2 + (hasSub ? Math.round(fs * 0.62) : 0));

  var cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  var g = cv.getContext('2d');
  if (o.bg) {
    if (o.radius) {
      var r = Math.min(o.radius, ch / 2, cw / 2);
      g.beginPath();
      g.moveTo(r, 0); g.lineTo(cw - r, 0);
      g.arcTo(cw, 0, cw, r, r);
      g.lineTo(cw, ch - r); g.arcTo(cw, ch, cw - r, ch, r);
      g.lineTo(r, ch); g.arcTo(0, ch, 0, ch - r, r);
      g.lineTo(0, r); g.arcTo(0, 0, r, 0, r);
      g.closePath();
      g.fillStyle = o.bg; g.fill();
    } else {
      g.fillStyle = o.bg; g.fillRect(0, 0, cw, ch);
    }
  }
  if (o.border) {
    g.strokeStyle = o.border;
    g.lineWidth = Math.max(2, Math.round(fs * 0.05));
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2,
                 cw - g.lineWidth, ch - g.lineWidth);
  }
  var FONT = '"Microsoft YaHei","Microsoft YaHei UI","PingFang SC",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  var yMain = padY + fs * 0.65;
  if (o.fgStroke) {
    g.font = 'bold ' + fs + 'px ' + FONT;
    g.lineWidth = Math.max(3, Math.round(fs * 0.10));
    g.strokeStyle = o.fgStroke;
    g.strokeText(s, cw / 2, yMain);
  }
  g.font = 'bold ' + fs + 'px ' + FONT;
  g.fillStyle = o.fg || '#F4F1E8';
  g.fillText(s, cw / 2, yMain);
  if (hasSub) {
    g.font = 'bold ' + Math.round(fs * 0.46) + 'px ' + FONT;
    g.fillStyle = o.subFg || o.fg || '#F4F1E8';
    g.fillText(String(o.sub), cw / 2, padY + fs * 1.30 + fs * 0.30);
  }

  var t = new THREE.CanvasTexture(cv);
  t.encoding = THREE.sRGBEncoding;
  /* ★ anisotropy 必须设：招牌是**斜看**的，不设的话侧面会糊成一片
     （本项目相机俯角 52°、方位 36°，立面上的字几乎全是斜视）*/
  t.anisotropy = 8;
  t.userData = { cw: cw, ch: ch };
  return t;
}

/* 把贴图贴到立面上（按 dir 自动旋转对齐，且**宽高比跟随贴图**，不拉伸文字）
   dir 约定与 faceBox 完全一致：
     0 = +Z 面（u 沿 X）／1 = +X 面（u 沿 Z）／2 = -Z 面／3 = -X 面 */
function faceSign(parent, dir, halfW, halfD, u, y, tex, o) {
  o = o || {};
  var h = o.h === undefined ? 0.78 : o.h;      /* 标牌实物高度（m）*/
  var aspect = tex.image.width / tex.image.height;
  var w = o.w === undefined ? h * aspect : o.w;
  var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    mat(0xFFFFFF, { tex: tex, rough: o.rough === undefined ? 0.74 : o.rough }));
  var eps = o.out === undefined ? 0.045 : o.out;
  if (dir === 0) { m.position.set(u, y, halfD + eps); }
  else if (dir === 2) { m.position.set(u, y, -halfD - eps); m.rotation.y = Math.PI; }
  else if (dir === 1) { m.position.set(halfW + eps, y, u); m.rotation.y = Math.PI / 2; }
  else { m.position.set(-halfW - eps, y, u); m.rotation.y = -Math.PI / 2; }
  /* ★ 文字面**不投影** —— 否则这块薄面会在墙上投出一条直边黑线
     （本项目在"匾额/标牌"这类薄面上踩过）。*/
  m.castShadow = false; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ── 楼名（★★★ v23 重写：**真文字**，替换 v12~v22 的"一排深色方块"）
   ────────────────────────────────────────────────────────────────
   v12 的注释自己写着「最终成品换 canvas 文字贴图」——也就是说
   楼名从 v12 到 v22 一直是**占位符**（一串等距深色小方块，
   放大看是"假字"，读不出任何信息）。
   ✅ v23 换成 `makeSignTex` 画的真实中标牌：深底 + 浅字 + 细边框。
   ★ 位置沿用旧值（y = FLOOR*4 + 0.62），不动 ⇒ 只换"方块 → 文字"，
     不引入位置回归。 */
function buildingName(parent, dir, halfW, halfD, len, text) {
  var s = String(text);
  if (!s) return;
  var tex = makeSignTex(s, {
    fs: 96, fg: '#F2EFE6', bg: '#2A3138', border: '#525C66',
    padX: 40, padY: 22
  });
  var y = FLOOR * 4 + 0.62;
  faceSign(parent, dir, halfW, halfD, 0, y, tex, { h: 0.86, out: 0.05 });
}
