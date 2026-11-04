/* 钓鱼系统
   设计要点：
   1. 只在第一人称（漫游）里生效——站立在人视角才有"甩杆"的手感
   2. 甩杆 → 浮漂抛物线落水 → 涟漪扩散 → 鱼影靠近 → 咬钩 → 按 F 收杆
   3. 三档鱼竿：木杆 / 碳素 / 路亚，影响等待时间与稀有度
   4. 背包：捕获的鱼有名字/重量，可以"丢出去"（生成一条会飞的鱼模型）
   5. 全部自包含，不依赖外部资源；UI 用 DOM，模型用基础几何体
*/

const SPECIES = [
  { id: 'crucian', name: '鲫鱼', min: .2, max: .9, color: 0x9aa98a, tier: 0 },
  { id: 'carp', name: '鲤鱼', min: .8, max: 3.2, color: 0xb98a55, tier: 0 },
  { id: 'grass', name: '草鱼', min: 1.5, max: 5.0, color: 0x8e9a6d, tier: 1 },
  { id: 'bass', name: '鳜鱼', min: .6, max: 2.4, color: 0x7a8f7a, tier: 1 },
  { id: 'catfish', name: '鲶鱼', min: 2.0, max: 7.5, color: 0x5f5a4e, tier: 2 },
  { id: 'koi', name: '锦鲤', min: 1.0, max: 4.0, color: 0xe08a4a, tier: 2 },
];

const RODS = [
  { id: 'wood', name: '木杆', wait: [3.0, 6.5], bite: 1.5, bonus: 0, color: 0xb08b5a },
  { id: 'carbon', name: '碳素竿', wait: [2.0, 4.5], bite: 1.1, bonus: 1, color: 0x4a4f55 },
  { id: 'lure', name: '路亚竿', wait: [1.4, 3.2], bite: .85, bonus: 2, color: 0x2f6f6a },
];

export function createFishing(T, ctx) {
  const { scene, camera, getPlayer, lakeWorld } = ctx;
  const waterY = 0.52;
  let holder = null, rodObj = null, rodTip = null, linePos = null, castAnim = 0, nearWater = null, animMode = 'idle', animT = 0;

  /* ---------- 状态 ---------- */
  let active = false;        // 是否在漫游
  let rodIndex = 0;
  let state = 'idle';        // idle | flying | waiting | bite | cooldown
  let timer = 0, biteWindow = 0, waitFor = 0, waitTimer = null, missTimer = null;
  let bobber = null, ripple = null, fishShadow = null;
  let bobberTarget = new T.Vector3();
  let bag = [];
  let ui = null;
  let toastEl = null;
  let lineGeo = null, lineObj = null;
  let dropped = [], previewFish = null;

  /* ---------- 材质/几何（复用） ---------- */
  const geoSph = new T.SphereGeometry(0.16, 12, 8);
  const matBob = new T.MeshLambertMaterial({ color: 0xe8503a });
  const geoRing = new T.RingGeometry(0.9, 1.05, 32);
  const matRing = new T.MeshBasicMaterial({ color: 0xbfe6dd, transparent: true, opacity: .55, side: T.DoubleSide, depthWrite: false });
  const fishGeo = new T.SphereGeometry(1, 10, 8);
  const tailGeo = new T.ConeGeometry(0.5, 1.1, 6);

  /* ---------- UI ---------- */
  function buildUI() {
    const wrap = document.createElement('div');
    wrap.id = 'fish-ui';
    wrap.style.cssText = 'position:fixed;right:16px;bottom:76px;z-index:9000;display:none;font:13px/1.5 system-ui,-apple-system,"Microsoft YaHei",sans-serif;color:#22312b';

    wrap.innerHTML = `
      <div id="fish-hint" style="background:rgba(255,255,255,.9);border:1px solid rgba(30,60,45,.14);border-radius:10px;padding:7px 11px;margin-bottom:8px;box-shadow:0 6px 20px rgba(20,40,30,.12);white-space:nowrap">
        <b>F</b> 甩杆 · <b>I</b> 背包 · <b>1/2/3</b> 换竿
      </div>
      <div id="fish-rods" style="display:flex;gap:6px;justify-content:flex-end"></div>
      <div id="fish-bag" style="display:none;margin-top:8px;width:262px;max-height:260px;overflow:auto;background:rgba(255,255,255,.94);border:1px solid rgba(30,60,45,.14);border-radius:12px;padding:10px;box-shadow:0 10px 30px rgba(20,40,30,.16)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <b style="font-size:13px">鱼篓</b><span id="fish-count" style="color:#6b7a72">0 条</span>
        </div>
        <div id="fish-list" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>`;
    document.body.appendChild(wrap);
    ui = wrap;

    const rods = wrap.querySelector('#fish-rods');
    RODS.forEach((r, i) => {
      const b = document.createElement('button');
      b.dataset.rod = r.id;
      b.textContent = (i + 1) + ' ' + r.name;
      b.style.cssText = 'padding:5px 9px;border-radius:8px;border:1px solid rgba(30,60,45,.16);background:rgba(255,255,255,.9);cursor:pointer;font:12px system-ui';
      b.onclick = () => { rodIndex = i; refreshRodUI(); toast('换上 ' + r.name); };
      rods.appendChild(b);
    });

    toastEl = document.createElement('div');
    toastEl.style.cssText = 'position:fixed;left:50%;bottom:130px;transform:translateX(-50%);z-index:9500;padding:9px 16px;border-radius:10px;background:rgba(26,42,34,.9);color:#f2f7f3;font:13px system-ui;opacity:0;transition:opacity .25s;pointer-events:none';
    document.body.appendChild(toastEl);

    refreshRodUI();
    refreshBag();
  }

  function refreshRodUI() {
    ui.querySelectorAll('[data-rod]').forEach((b, i) => {
      const on = i === rodIndex;
      b.style.background = on ? '#1f3a30' : 'rgba(255,255,255,.9)';
      b.style.color = on ? '#f4f9f6' : '#22312b';
      b.style.borderColor = on ? '#1f3a30' : 'rgba(30,60,45,.16)';
    });
  }

  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.style.opacity = '0'; }, 1700);
  }

  function refreshBag() {
    const list = ui.querySelector('#fish-list');
    const cnt = ui.querySelector('#fish-count');
    cnt.textContent = bag.length + ' 条';
    list.innerHTML = '';
    if (!bag.length) {
      list.innerHTML = '<div style="color:#7d8a83;padding:6px 2px">还是空的，去湖边甩一杆。</div>';
      return;
    }
    bag.forEach((f, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;border-radius:8px;background:#f3f7f4';
      row.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:#${f.color.toString(16).padStart(6, '0')}"></span>
        <span style="flex:1">${f.name}<span style="color:#7d8a83"> · ${f.weight.toFixed(2)}kg</span></span>`;
      const btn = document.createElement('button');
      btn.textContent = '丢出';
      btn.style.cssText = 'padding:3px 8px;border-radius:7px;border:1px solid rgba(30,60,45,.16);background:#fff;cursor:pointer;font:12px system-ui';
      btn.onclick = () => { bag.splice(i, 1); refreshBag(); dropFish(f); };
      row.appendChild(btn);
      list.appendChild(row);
    });
  }

  /* ---------- 3D 物件 ---------- */
  function makeBobber() {
    const g = new T.Group();
    const ball = new T.Mesh(geoSph, matBob);
    const top = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.34, 6), new T.MeshLambertMaterial({ color: 0xf4f1e8 }));
    top.position.y = 0.2;
    g.add(ball, top);
    return g;
  }

  function makeRing() {
    const m = new T.Mesh(geoRing, matRing.clone());
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    return m;
  }

  /* 10-31 鱼体：环切面拉出来的实体（头粗尾细），配尾鳍 / 背鳍 / 眼睛。
     之前是"球 + 圆锥"，侧面看是一坨；现在是连续曲面，能看出鱼形。 */
  let fishGeoCache = null;
  function getFishGeos() {
    if (fishGeoCache) return fishGeoCache;
    const L = 1, H = .30, W = .17, SEG = 18, RIM = 10;
    const pos = [], idx = [];
    for (let i = 0; i < SEG; i++) {
      const t = i / (SEG - 1), x = (t - .5) * L;
      /* 头部略钝、中段最粗、尾部收细 */
      const s0 = Math.max(0, Math.sin(Math.PI * Math.min(1, t * 1.03)));
      const taper = Math.pow(s0, .62) * (1 - .34 * t);
      for (let j = 0; j < RIM; j++) {
        const ang = j / RIM * Math.PI * 2;
        pos.push(x, Math.sin(ang) * H * taper, Math.cos(ang) * W * taper);
      }
    }
    for (let i = 0; i < SEG - 1; i++) for (let j = 0; j < RIM; j++) {
      const a0 = i * RIM + j, b0 = i * RIM + (j + 1) % RIM;
      const c0 = (i + 1) * RIM + j, d0 = (i + 1) * RIM + (j + 1) % RIM;
      idx.push(a0, c0, b0, b0, c0, d0);
    }
    const bodyG = new T.BufferGeometry();
    bodyG.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    bodyG.setIndex(idx); bodyG.computeVertexNormals();

    /* 尾鳍：两片三角，呈叉形 */
    const tailG = new T.BufferGeometry();
    tailG.setAttribute('position', new T.Float32BufferAttribute([
      0, .02, 0, -.30, .30, 0, -.34, 0, 0, -.30, -.30, 0,
    ], 3));
    tailG.setIndex([0, 1, 2, 0, 2, 3]); tailG.computeVertexNormals();

    /* 背鳍：竖在背上的一小片 */
    const dorsalG = new T.BufferGeometry();
    dorsalG.setAttribute('position', new T.Float32BufferAttribute([
      .10, .26, 0, -.16, .30, 0, -.10, .52, 0,
    ], 3));
    dorsalG.setIndex([0, 1, 2]); dorsalG.computeVertexNormals();

    fishGeoCache = { bodyG, tailG, dorsalG };
    return fishGeoCache;
  }

  /* 用内建几何体拼装鱼：压扁的球做身体、圆锥做尾鳍与背鳍、小球做眼睛。
     自建 BufferGeometry 那版顶点算出 NaN，整条鱼被视锥剔除、完全看不见，已弃用。 */
  const geoBody = new T.SphereGeometry(1, 18, 12);
  const geoTail = new T.ConeGeometry(.5, 1, 12);
  const geoEye = new T.SphereGeometry(.045, 8, 6);
  const matEye = new T.MeshLambertMaterial({ color: 0x111417 });

  function makeFishMesh(color) {
    const mat = new T.MeshLambertMaterial({ color, side: T.DoubleSide });
    const g = new T.Group();

    const body = new T.Mesh(geoBody, mat);
    body.scale.set(.52, .21, .13);
    g.add(body);

    const tail = new T.Group();
    tail.position.x = -.46;
    const stem = new T.Mesh(geoBody, mat);
    stem.scale.set(.10, .07, .05);
    const fin = new T.Mesh(geoTail, mat);
    fin.rotation.z = Math.PI / 2;
    fin.scale.set(.30, .34, .06);
    fin.position.x = -.14;
    tail.add(stem, fin);
    g.add(tail);

    const dorsal = new T.Mesh(geoTail, mat);
    dorsal.scale.set(.12, .26, .04);
    dorsal.position.set(-.02, .24, 0);
    dorsal.rotation.z = .25;
    g.add(dorsal);

    const e1 = new T.Mesh(geoEye, matEye); e1.position.set(.40, .07, .09);
    const e2 = new T.Mesh(geoEye, matEye); e2.position.set(.40, .07, -.09);
    g.add(e1, e2);

    g.userData.tail = tail;
    g.userData.phase = Math.random() * 6.28;
    return g;
  }

  function ensureWaterObjects() {
    if (!bobber) { bobber = makeBobber(); bobber.visible = false; scene.add(bobber); }
    if (!ripple) { ripple = makeRing(); scene.add(ripple); }
  }

  /* ---------- 甩杆 ---------- */
  function cast() {
    const p = getPlayer();
    if (!p) return;
    ensureWaterObjects();

    /* 朝着视线方向找一个落点：水平 9~13 米，落点必须在湖里 */
    const yaw = p.yaw || 0;
    const dist = 11;
    let landed = null;
    for (let d = dist; d > 4; d -= 1) {
      const x = p.x + Math.sin(yaw) * d;
      const z = p.z - Math.cos(yaw) * d;
      if (inLake(x, z)) { landed = new T.Vector3(x, waterY, z); break; }
    }
    if (!landed) { toast('这里没有水，去湖边再甩'); return; }

    bobberTarget.copy(landed);
    bobber.position.copy(landed);
    bobber.scale.setScalar(.4);
    bobber.visible = true;
    state = 'waiting'; timer = 0;
    clearTimeout(waitTimer);
    const r0=RODS[rodIndex];
    waitFor = r0.wait[0] + Math.random() * (r0.wait[1] - r0.wait[0]);
    waitTimer = setTimeout(bite, waitFor * 1000);
    spawnRipple(bobberTarget, .6);
    setAnim('cast');
    toast('甩杆！');
  }

  function inLake(x, z) {
    /* 湖面多边形已在外层转成世界坐标，这里做标准射线法判定 */
    if (!lakeWorld || !lakeWorld.length) return false;
    let inside = false;
    for (let i = 0, j = lakeWorld.length - 1; i < lakeWorld.length; j = i++) {
      const xi = lakeWorld[i][0], zi = lakeWorld[i][1];
      const xj = lakeWorld[j][0], zj = lakeWorld[j][1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
  }

  /* ---------- 更新 ---------- */
  function update(dt) {
    if (!active) return;
    updateViewmodel(dt);
    updateProximity();
    timer += dt;

    /* 浮漂飞行：简单插值 + 轻微抛物线 */

    /* 等待咬钩：浮漂轻微上下起伏 */
    if (state === 'waiting') {
      bobber.position.y = waterY + Math.sin(timer * 2.2) * 0.045;

    } else if (state === 'bite') {
      bobber.position.y = waterY - 0.1 + Math.sin(timer * 26) * 0.06;
      /* 鱼影绕圈 */
      if (fishShadow) {
        const a = timer * 3.4;
        fishShadow.position.set(bobberTarget.x + Math.cos(a) * .7, waterY - 0.12, bobberTarget.z + Math.sin(a) * .7);
        fishShadow.rotation.y = -a;
        const tl=fishShadow.userData.tail;if(tl)tl.rotation.y=Math.sin(performance.now()/70)*.45;
      }

    } else if (state === 'cooldown') {
      if (timer > .6) { state = 'idle'; bobber.visible = false; }
    }

    if(previewFish){previewFish.rotation.z=Math.sin(performance.now()/900)*.08;const t2=previewFish.userData.tail;if(t2)t2.rotation.y=Math.sin(performance.now()/160)*.5;}
    updateRipple(dt);
    updateDropped(dt);
  }

  function bite() {
    if (state !== 'waiting') return;
    state = 'bite'; timer = 0; biteWindow = RODS[rodIndex].bite;
    spawnFishShadow(bobberTarget);
    spawnRipple(bobberTarget, 1.0);
    toast('咬钩了！按 F 收杆');
    clearTimeout(missTimer);
    missTimer = setTimeout(() => {
      clearTimeout(waitTimer);clearTimeout(missTimer);
    setAnim('reel');
    if (state === 'bite') { state = 'idle'; bobber.visible = false; removeFishShadow(); toast('鱼跑了…'); }
    }, biteWindow * 1000);
  }

  function spawnRipple(pos, scale) {
    if (!ripple) return;
    ripple.position.set(pos.x, waterY + 0.02, pos.z);
    ripple.scale.setScalar(scale);
    ripple.material.opacity = .55;
    ripple.visible = true;
    ripple.userData.t = 0;
    ripple.userData.spd = 1.6;
  }

  function updateRipple(dt) {
    if (ripple && ripple.visible) {
      ripple.userData.t += dt;
      const t = ripple.userData.t;
      ripple.scale.setScalar(0.9 + t * 2.6);
      ripple.material.opacity = Math.max(0, .55 - t * .35);
      if (ripple.material.opacity <= 0.01) ripple.visible = false;
    }
    if (state !== 'bite' && state !== 'waiting' && ripple) ripple.visible = ripple.visible && state === 'waiting';
  }

  function spawnFishShadow(pos) {
    if (!fishShadow) {
      fishShadow = makeFishMesh(0x2c3a33);
      fishShadow.scale.setScalar(1.6);
      fishShadow.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = .55; } });
      scene.add(fishShadow);
    }
    fishShadow.visible = true;
    fishShadow.position.set(pos.x, waterY - 0.12, pos.z);
  }
  function removeFishShadow() { if (fishShadow) fishShadow.visible = false; }

  /* ---------- 收杆 / 捕获 ---------- */
  function reel() {
    if (state === 'bite') {
      const f = rollFish();
      bag.push(f);
      refreshBag();
      toast(`钓到 ${f.name} ${f.weight.toFixed(2)}kg`);
      removeFishShadow();
      spawnRipple(bobberTarget, 1.4);
      state = 'cooldown'; timer = 0;
      bobber.visible = false;
      return true;
    }
    if (state === 'waiting' || state === 'flying') {
      state = 'cooldown'; timer = 0; bobber.visible = false; removeFishShadow();
      toast('收杆');
      return true;
    }
    cast();
    return true;
  }

  function rollFish() {
    const r = RODS[rodIndex];
    const pool = SPECIES.filter(s => s.tier <= r.bonus + 1);
    /* 越稀有的越难：按 tier 加权 */
    const weighted = [];
    pool.forEach(s => { const w = Math.max(1, 6 - s.tier * 2); for (let i = 0; i < w; i++) weighted.push(s); });
    const s = weighted[Math.floor(Math.random() * weighted.length)];
    const weight = s.min + Math.random() * (s.max - s.min);
    return { id: s.id, name: s.name, weight, color: s.color };
  }

  /* ---------- 丢鱼：让它飞出去再消失 ---------- */
  function dropFish(f) {
    const p = getPlayer(); if (!p) return;
    const mesh = makeFishMesh(f.color);
    mesh.position.set(p.x, p.y - 0.2, p.z);
    scene.add(mesh);
    const dirX = Math.sin(p.yaw || 0), dirZ = -Math.cos(p.yaw || 0);
    dropped.push({ mesh, vx: dirX * 7, vy: 4.2, vz: dirZ * 7, t: 0 });
    toast('放生 ' + f.name);
  }

  function updateDropped(dt) {
    for (let i = dropped.length - 1; i >= 0; i--) {
      const d = dropped[i];
      d.t += dt;
      d.vy -= 12 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.y += dt * 8;
      const tl2=d.mesh.userData.tail;if(tl2)tl2.rotation.y=Math.sin((d.t*9)+(d.mesh.userData.phase||0))*.55;
      if (d.mesh.position.y < 0.3) { d.vy *= -0.35; d.vx *= .7; d.vz *= .7; d.mesh.position.y = 0.3; }
      if (d.t > 6) { scene.remove(d.mesh); dropped.splice(i, 1); }
    }
  }

  /* ---------- 输入 ---------- */
  /* ---------- 第一人称视模型：鱼竿 + 鱼线 ---------- */
  function initViewmodel() {
    holder = new T.Object3D();
    scene.add(holder);

    rodObj = new T.Group();

    const grip = new T.Mesh(new T.CylinderGeometry(.024, .028, .44, 8), new T.MeshLambertMaterial({ color: 0x6b4a2f }));
    grip.position.y = -.18;
    const blank = new T.Mesh(new T.CylinderGeometry(.007, .019, 1.55, 8), new T.MeshLambertMaterial({ color: 0x2b2f33 }));
    blank.position.y = .58;
    const reel = new T.Mesh(new T.CylinderGeometry(.052, .052, .036, 12), new T.MeshLambertMaterial({ color: 0x8d949a }));
    reel.rotation.z = Math.PI / 2; reel.position.set(.02, -.05, .04);
    const knob = new T.Mesh(new T.SphereGeometry(.028, 8, 6), new T.MeshLambertMaterial({ color: 0x1f2326 }));
    knob.position.set(.06, -.05, .04);

    rodTip = new T.Object3D();
    rodTip.position.y = 1.35;
    rodObj.add(grip, blank, reel, knob, rodTip);
    rodObj.position.set(.30, -.26, -.62);
    rodObj.rotation.set(-.78, .26, -.16);
    rodObj.scale.setScalar(.42);  /* 视模型按“手臂长度”缩放，否则 1.5m 的竿在眼前会糊满屏幕 */
    holder.add(rodObj);

    /* 鱼线：两点线段，每帧更新 */
    linePos = new Float32Array(5 * 3);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(linePos, 3));
    lineObj = new T.Line(g, new T.LineBasicMaterial({ color: 0xdfe8e2, transparent: true, opacity: .7 }));
    lineObj.frustumCulled = false;
    lineObj.visible = false;
    scene.add(lineObj);
  }

  /* ---------- 动画：待机呼吸 / 抛竿三段 / 收杆回抽 ---------- */
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function setAnim(mode) { animMode = mode; animT = 0; }

  function updateViewmodel(dt) {
    if (!holder) return;
    holder.position.copy(camera.position);
    holder.quaternion.copy(camera.quaternion);

    animT += dt;
    const t = performance.now() / 1000;

    /* 基准位姿：右下方、竿尖朝左上 */
    let rx = -.78, ry = .26, rz = -.16, py = -.26, pz = -.62;

    if (animMode === 'cast') {
      const p = Math.min(1, animT / .62);
      /* 0~0.42 后拉蓄力，0.36~0.62 前甩，之后回位 */
      const back = p < .42 ? easeOut(p / .42) : 1 - easeInOut((p - .42) / .58);
      const whip = (p > .34 && p < .64) ? Math.sin((p - .34) / .30 * Math.PI) : 0;
      rx += .40 * back - .58 * whip;
      py += .06 * back - .07 * whip;
      rz += -.28 * whip;
      if (p >= 1) setAnim('idle');
    } else if (animMode === 'reel') {
      const p = Math.min(1, animT / .48);
      const k = Math.sin(p * Math.PI);
      rx -= .22 * k;
      rz += .12 * Math.sin(p * Math.PI * 2);
      py += .04 * k;
      if (p >= 1) setAnim('idle');
    } else {
      /* 待机：呼吸 + 极缓摆动，幅度小到不干扰瞄准 */
      const s1 = Math.sin(t * 1.55), s2 = Math.sin(t * 1.13 + 1.2), s3 = Math.sin(t * .87 + .4);
      rx += s1 * .013; ry += s2 * .010; rz += s3 * .008;
      py += Math.sin(t * 1.9) * .005;
      pz += Math.sin(t * 1.4) * .004;
    }

    rodObj.rotation.set(rx, ry, rz);
    rodObj.position.set(.30, py, pz);

    /* 鱼线：5 点二次曲线，带垂度，不是一条直线 */
    if (lineObj) {
      const show = bobber && bobber.visible;
      lineObj.visible = !!show;
      if (show) {
        rodTip.updateWorldMatrix(true, false);
        const tip = new T.Vector3();
        rodTip.getWorldPosition(tip);
        const end = bobber.position;
        const dist = Math.hypot(end.x - tip.x, end.z - tip.z);
        const sag = Math.min(1.6, .10 + dist * .045);
        for (let i = 0; i < 5; i++) {
          const k = i / 4;
          const x = tip.x + (end.x - tip.x) * k;
          const z = tip.z + (end.z - tip.z) * k;
          const y = tip.y + (end.y + .16 - tip.y) * k - Math.sin(k * Math.PI) * sag;
          linePos[i * 3] = x; linePos[i * 3 + 1] = y; linePos[i * 3 + 2] = z;
        }
        lineObj.geometry.attributes.position.needsUpdate = true;
        lineObj.geometry.computeBoundingSphere();
      }
    }

    /* 视模型每帧变化，必须主动请求重绘（应用默认是"按需绘制"） */
    if (typeof requestRender === 'function') requestRender();
    else if (ctx.requestRender) ctx.requestRender();
  }

  /* 到湖边的最近距离（米）；在湖里则为 0 */
  function distToLake(x, z) {
    if (inLake(x, z)) return 0;
    let best = Infinity;
    for (let i = 0, j = lakeWorld.length - 1; i < lakeWorld.length; j = i++) {
      const ax = lakeWorld[j][0], az = lakeWorld[j][1], bx = lakeWorld[i][0], bz = lakeWorld[i][1];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      const px = ax + dx * t, pz = az + dz * t;
      best = Math.min(best, Math.hypot(x - px, z - pz));
    }
    return best;
  }

  /* 只有靠近湖面（14 米内）才显示甩杆 UI —— 站在教学楼前不该出现鱼竿按钮 */
  function updateProximity() {
    const p = getPlayer(); if (!p) return;
    const near = distToLake(p.x, p.z) <= 14;
    if (near === nearWater) return;
    nearWater = near;
    const rods = ui.querySelector('#fish-rods');
    const hint = ui.querySelector('#fish-hint');
    if (rods) rods.style.display = near ? 'flex' : 'none';
    if (hint) hint.innerHTML = near
      ? '<b>F</b> 甩杆 · <b>I</b> 背包 · <b>1/2/3</b> 换竿'
      : '走近湖边才能下杆';
    if (!near) {
      const bagEl = ui.querySelector('#fish-bag'); if (bagEl) bagEl.style.display = 'none';
      if (state !== 'idle') { state = 'idle'; if (bobber) bobber.visible = false; removeFishShadow(); }
    }
  }

  function onKey(e) {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (k === 'i') { const bagEl = ui.querySelector('#fish-bag'); bagEl.style.display = bagEl.style.display === 'none' ? 'block' : 'none'; e.preventDefault(); }
    else if (k === 'f') { reel(); e.preventDefault(); }
    else if (k === '1' || k === '2' || k === '3') { rodIndex = Number(k) - 1; refreshRodUI(); toast('换上 ' + RODS[rodIndex].name); }
  }

  window.__T=T; /* 调试用：让探针能直接造几何体 */
  buildUI();
  initViewmodel();
  window.addEventListener('keydown', onKey);

  /* 10-31 自带 rAF：应用是静止·按需绘制，渲染循环不保证每帧都跑，
     钓鱼的浮漂/涟漪必须自己驱动，否则状态机会卡在 flying。 */
  let rafLast = 0;
  function loop(t) {
    if (active) {
      const dt = rafLast ? Math.min(.05, (t - rafLast) / 1000) : 0;
      rafLast = t;
      update(dt);
    } else rafLast = 0;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    setActive(v) {
      active = !!v;
      ui.style.display = active ? 'block' : 'none';
      if (!active) {
        state = 'idle'; timer = 0;
        if (bobber) bobber.visible = false;
        if (ripple) ripple.visible = false;
        removeFishShadow();
        const bagEl = ui.querySelector('#fish-bag'); bagEl.style.display = 'none';
      }
    },
    update,
    spawnPreview(color){
      const f=makeFishMesh(color||0xb98a55);
      const dir=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
      f.position.copy(camera.position).addScaledVector(dir,2.4);
      f.quaternion.copy(camera.quaternion);
      f.rotateY(Math.PI/2);
      f.scale.setScalar(1.6);
      scene.add(f); previewFish=f; return f;
    },
    get state() { return state; },
    get bag() { return bag; },
  };
}
