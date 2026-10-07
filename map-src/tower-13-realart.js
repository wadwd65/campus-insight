/* -*- coding: utf-8 -*- */
/* ══════════════════════════════════════════════════════════════════
   tower-13-realart.js —— 真人美术资产运行时（CC0：KayKit 楼/家具 + Quaternius 树）

   ★ 为什么有这一层：程序化几何+程序贴图"没有真人美术"是地图丑的根源
     （10-06 用户裁决）。本层把真人制作的 GLTF 资产接进既有装配体系：
     · 解析**一次**成模板，之后全部 .clone(true)（几何/材质共享，内存安全）
     · 所有生成函数**同步返回包装组**，模型异步到位后自动填入
       —— campGreen/campBuildings/campFurniture 的调用处不用改异步
     · 建筑包装组带**不可见占位盒**（ghost）：Box3.setFromObject 不查 visible，
       连廊(campAptLinks)/探针在模型到位前就能量到确定尺寸
   ══════════════════════════════════════════════════════════════════ */
var RA = (function () {
  var loader = new THREE.GLTFLoader();
  var tpl = {};          /* key -> 模板 Group（已归一：脚底 y=0、中心 x/z=0）*/
  var dim = {};          /* key -> {w,h,d} 天然尺寸 */
  var waiters = [];      /* {key, apply} 模板未就绪时挂起 */
  var kayTex = null;     /* KayKit 共享图集（全模型一张，JSON 里已剥引用）*/

  /* ── 模板注册：归一化（脚底落地、中心对齐、投影/共享贴图）── */
  function register(key, root) {
    root.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (key.indexOf('kay:') === 0 && o.material && !o.material.map && kayTex) {
        o.material.map = kayTex;
        o.material.needsUpdate = true;
      }
    });
    var bb = new THREE.Box3().setFromObject(root);
    var s = new THREE.Vector3(); bb.getSize(s);
    dim[key] = { w: s.x, h: s.y, d: s.z };
    /* 归一：把模型平移到"中心 x/z = 0、脚底 y = 0"（存进模板自身）*/
    root.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    var holder = new THREE.Group();
    holder.add(root);
    tpl[key] = holder;
    for (var i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].key === key) { var a = waiters[i].apply; waiters.splice(i, 1); a(); }
    }
  }

  function parseKay(name) {
    loader.parse(RA_KAY[name], '', function (g) { register('kay:' + name, g.scene); });
  }
  function parseGlb(name) {
    var bin = Uint8Array.from(atob(RA_GLB[name]), function (c) { return c.charCodeAt(0); }).buffer;
    loader.parse(bin, '', function (g) { register('glb:' + name, g.scene); });
  }

  /* KayKit 等共享贴图先就绪（GLTF UV 约定 flipY=false）*/
  (function () {
    var img = new Image();
    img.onload = function () {
      kayTex = new THREE.Texture(img);
      kayTex.encoding = THREE.sRGBEncoding;
      kayTex.flipY = false;
      kayTex.needsUpdate = true;
      RA_KAY_LIST.forEach(parseKay);
    };
    img.src = RA_KAY_TEX;
  })();
  RA_TREE_LIST.forEach(parseGlb);

  /* 模板就绪则立即 apply，否则挂起（模板到齐后自动调用）*/
  function when(key, apply) {
    if (tpl[key]) apply();
    else waiters.push({ key: key, apply: apply });
  }
  /* 克隆模板进包装组，返回天然尺寸 */
  function cloneInto(key, wrap) {
    wrap.add(tpl[key].clone(true));
    return dim[key];
  }

  /* ══ 对外 ①：树（高度归一 + 轻微形态抖动破"复制粘贴"）══ */
  function tree(h, seed) {
    var wrap = new THREE.Group();
    var name = RA_TREE_LIST[seed % RA_TREE_LIST.length];
    var key = 'glb:' + name;
    when(key, function () {
      var d = cloneInto(key, wrap);
      var s = h / d.h;
      /* 同种树也要有高矮胖瘦：±8% 抖动（seed 确定性，不换帧就闪）*/
      var j1 = 0.92 + ((seed * 37) % 13) / 13 * 0.16;
      var j2 = 0.92 + ((seed * 53) % 11) / 11 * 0.16;
      wrap.scale.set(s * j1, s, s * j2);
      wrap.rotation.y = (seed * 2.399) % 6.283;
    });
    return wrap;
  }

  /* ══ 对外 ②：家具（按最大天然边归一到目标尺寸）══ */
  function furn(kind, size, rot, y) {
    var wrap = new THREE.Group();
    var key = 'kay:' + kind;
    when(key, function () {
      var d = cloneInto(key, wrap);
      var s = size / Math.max(d.w, d.h, d.d);
      wrap.scale.setScalar(s);
      if (rot) wrap.rotation.y = rot;
      if (y) wrap.position.y = y;
    });
    return wrap;
  }

  /* ══ 对外 ③：建筑（带 ghost 占位盒；等比为主、横向最多放宽 1.35 倍填院）══ */
  function block(name, W, D, H, opts) {
    opts = opts || {};
    var wrap = new THREE.Group();
    /* ghost：同步期供 Box3 测量（连廊/探针/统计），永不渲染 */
    var ghost = box(W, H, D, mat(0x888888, { rough: 0.9 }), 0, H / 2, 0);
    ghost.visible = false;
    wrap.add(ghost);
    var key = 'kay:' + name;
    when(key, function () {
      var d = cloneInto(key, wrap);
      var s = H / d.h;
      var sx = Math.min(W / d.w, s * 1.35);
      var sz = Math.min(D / d.d, s * 1.35);
      var inner = new THREE.Group();
      inner.scale.set(sx, s, sz);
      inner.position.set(opts.dx || 0, 0, opts.dz || 0);
      if (opts.rot) inner.rotation.y = opts.rot;
      /* cloneInto 直接加在 wrap 上了 —— 挪进 inner */
      var last = wrap.children[wrap.children.length - 1];
      wrap.remove(last);
      inner.add(last);
      wrap.add(inner);
    });
    return wrap;
  }

  /* ══ 对外 ④：按 CAMP_PLACE 的 id 组楼（艺术指派表；null = 回退程序化）══
     尺寸来源：probe-dims 实测当前每栋 bbox（与落位同一真源）。
     指派原则：功能分区用形制区分 —— 教学=高块(C/D/G/H 轮)，公寓=双板院落(E/F)，
     图书馆=双联长楼(B+B)，体育馆=大小组合(H+A)，食堂=双体(C+B)，小铺=带雨篷 A。 */
  var COMPOSE = {
    'apt-c2':   { apt: ['building_E', 'building_E'], W: 35, D: 49, H: 20 },
    'apt-c3':   { apt: ['building_E', 'building_E'], W: 35, D: 49, H: 20 },
    'apt-c4':   { apt: ['building_E', 'building_F'], W: 35, D: 49, H: 21 },
    'apt-c5':   { apt: ['building_E', 'building_E'], W: 35, D: 49, H: 20 },
    'apt-c1':   { apt: ['building_F', 'building_E'], W: 50, D: 39, H: 22 },
    'bldg-c1':  { one: 'building_D', W: 16, D: 32, H: 24 },
    'bldg-c2':  { one: 'building_G', W: 15, D: 25, H: 22 },
    'lab-2':    { one: 'building_C', W: 14, D: 28, H: 21 },
    'lab-1':    { one: 'building_F', W: 32, D: 53, H: 24 },
    'teach-1':  { one: 'building_G', W: 46, D: 33, H: 26 },
    'teach-2':  { one: 'building_F', W: 48, D: 33, H: 26 },
    'teach-3':  { one: 'building_C', W: 42, D: 30, H: 23 },
    'teach-4':  { one: 'building_D', W: 28, D: 14, H: 24 },
    'gym':      { duo: ['building_H', 'building_A'], W: 34, D: 43, H: 15, gap: 10 },
    'canteen':  { duo: ['building_C', 'building_B'], W: 28, D: 36, H: 12, gap: 8 },
    'cscenter': { one: 'building_E', W: 19, D: 26, H: 19 },
    'tuoxin':   { one: 'building_B', W: 13, D: 22, H: 17 },
    'lib':      { duo: ['building_B', 'building_B'], W: 30, D: 23, H: 13, gap: 7, axis: 'x' },
    'st-milk':  { one: 'building_A', W: 7, D: 8, H: 4.2 },
    'st-fruit': { one: 'building_A', W: 7, D: 8, H: 4.4 },
    'st-bbq':   { one: 'building_A', W: 6, D: 7, H: 4.0 },
    'st-fry':   { one: 'building_A', W: 6, D: 7, H: 4.2 },
    'st-noodle':{ one: 'building_A', W: 6, D: 8, H: 4.3 },
    'st-stat':  { one: 'building_A', W: 6, D: 7, H: 4.1 },
    'express':  { one: 'building_A', W: 8, D: 9, H: 4.6 },
    'market':   { one: 'building_A', W: 12, D: 9, H: 4.8 }
  };

  function compose(id) {
    var c = COMPOSE[id];
    if (!c) return null;
    if (c.one) return block(c.one, c.W, c.D, c.H);
    if (c.apt) {
      /* 双板院落：两栋沿 Z 前后错开，中间留院（连廊由 campAptLinks 串）*/
      var wrap = new THREE.Group();
      var ghost = box(c.W, c.H + 6, c.D, mat(0x888888, { rough: 0.9 }), 0, (c.H + 6) / 2, 0);
      ghost.visible = false;
      wrap.add(ghost);
      var half = c.D / 4 + 1;
      var b1 = block(c.apt[0], c.W, c.D / 2 - 2, c.H, { dz: -half });
      var b2 = block(c.apt[1], c.W, c.D / 2 - 2, c.H - 1.5, { dz: half });
      wrap.add(b1); wrap.add(b2);
      return wrap;
    }
    if (c.duo) {
      var w2 = new THREE.Group();
      var gh = box(c.W, c.H + 4, c.D, mat(0x888888, { rough: 0.9 }), 0, (c.H + 4) / 2, 0);
      gh.visible = false;
      w2.add(gh);
      if (c.axis === 'x') {
        w2.add(block(c.duo[0], c.W / 2, c.D, c.H, { dx: -c.gap / 2 - 2 }));
        w2.add(block(c.duo[1], c.W / 2, c.D, c.H, { dx: c.gap / 2 + 2, rot: Math.PI }));
      } else {
        w2.add(block(c.duo[0], c.W, c.D / 2, c.H, { dz: -c.gap / 2 - 2 }));
        w2.add(block(c.duo[1], c.W, c.D / 2, c.H - 2, { dz: c.gap / 2 + 2 }));
      }
      return w2;
    }
    return null;
  }

  return { tree: tree, furn: furn, block: block, compose: compose,
           ready: function () { return waiters.length === 0; } };
})();
