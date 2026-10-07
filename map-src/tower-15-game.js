/* -*- coding: utf-8 -*- */
/* ══════════════════════════════════════════════════════════════════
   tower-15-game.js —— 「晴川 · 一日行动」可玩层（原型）

   用户的产品定义（10-07）：
     "点那个地图，就是有一定的行动力，就是体力条，然后根据不同的行为而做出一些反应"
     "像做游戏一般把这个网站做出来"
   ⇒ 本层把静态 3D 校园变成**一天的行动循环**：
     点建筑 → 出行动 → 掉行动力 + 推进时段 + 属性变化 + 现场反馈（镜头飞过去 / 建筑脉冲 / 飘字 / 天光变化）
     行动力耗尽 ⇒ 一天结束 ⇒ 结算卡 ⇒ 新的一天。
   独立文件、不接主站，先验证手感。
   ══════════════════════════════════════════════════════════════════ */
(function () {
  if (!window.__CAMP || !window.__CAMP_CAM) return;
  var THREE_ = THREE;
  var canvas = renderer.domElement;
  var cam = window.__CAMP_CAM;
  var stage = window.__CAMP.stage();

  var buildings = null, lampMats = [];
  stage.children.forEach(function (c) { if (c.name === 'buildings') buildings = c; });
  /* 关灯/开灯用的路灯自发光材质 */
  scene.traverse(function (o) {
    if (o.isMesh && o.material && o.material.emissive &&
        o.material.color && o.material.color.getHex() === 0xFFF0CC) lampMats.push(o.material);
  });

  /* ── 行动表：按建筑 id 前缀给行动 ── */
  var A = function (t, cost, vec, line) { return { t: t, cost: cost, vec: vec, line: line }; };
  function actsFor(id) {
    if (id.indexOf('lib') === 0) return [
      A('来自习', 26, { 学术: 4, 计划: 2 }, '第三自习室的灯永远亮着。'),
      A('翻闲书', 14, { 学术: 2, 尝鲜: 1 }, '随手抽一本，比课本有意思。'),
      A('趴桌睡会儿', 18, { 抗压: 3, 夜猫: 1 }, '趴十分钟，醒来像换了个脑子。')
    ];
    if (id.indexOf('gym') === 0) return [
      A('打一场球', 30, { 运动: 4, 社交: 2 }, '球鞋在木地板上急停，响。'),
      A('坐看台看别人打', 12, { 社交: 2, 抗压: 1 }, '看别人出汗，也算运动过。')
    ];
    if (id.indexOf('canteen') === 0) return [
      A('吃一顿', 16, { 美食: 3 }, '窗口的阿姨今天手很稳。'),
      A('帮厨半小时', 24, { 美食: 2, 抗压: 1, 社交: 1 }, '切了一筐土豆，手酸。')
    ];
    if (id.indexOf('teach') === 0) return [
      A('去上课', 22, { 学术: 3, 计划: 1 }, '早八的空调坏了，后排队倒一片。'),
      A('蹭一场讲座', 16, { 学术: 2, 尝鲜: 1 }, '讲得比想象中有意思。')
    ];
    if (id.indexOf('lab') === 0) return [
      A('做实验', 26, { 学术: 3, 抗压: 2 }, '编译到凌晨三点，报错信息比论文还长。'),
      A('擦仪器', 12, { 计划: 2, 抗压: 1 }, '把镜头擦干净，心里也干净。')
    ];
    if (id.indexOf('apt') === 0) return [
      A('回宿舍躺平', 12, { 抗压: 3 }, '床是最伟大的发明。'),
      A('睡一整觉', 34, { 抗压: 4, 夜猫: 1 }, '一觉睡到自然醒。'),
      A('和室友开黑', 20, { 社交: 2, 夜猫: 2 }, '赢了，也可能输了。')
    ];
    if (id.indexOf('tennis') === 0 || id.indexOf('bball') === 0 || id.indexOf('badminton') === 0) return [
      A('打一场', 22, { 运动: 3, 社交: 1 }, '网带弹回来的声音有点闷。')
    ];
    if (id.indexOf('st-') === 0) return [
      A('吃一份小摊', 14, { 美食: 3, 夜猫: 1 }, '油锅一响，队伍就排起来了。')
    ];
    if (id.indexOf('market') === 0) return [
      A('逛超市补货', 12, { 美食: 1, 计划: 1 }, '推车逛一圈，什么都想买。')
    ];
    if (id.indexOf('pav') === 0) return [
      A('坐一会儿', 10, { 抗压: 2 }, '湖面上有风，什么都不用想。')
    ];
    if (id.indexOf('cscenter') === 0) return [
      A('蹭会空调自习', 18, { 学术: 2, 计划: 1 }, '这里的椅子比图书馆软。')
    ];
    return [ A('进去看看', 12, { 尝鲜: 2 }, '推门进去，比想象中安静。') ];
  }
  var NAMES = {
    'lib': '图书馆', 'gym': '体育馆', 'canteen': '食堂', 'market': '校园超市',
    'cscenter': '计算机中心', 'tuoxin': '通讯楼'
  };
  function nameOf(id) {
    if (NAMES[id]) return NAMES[id];
    if (id.indexOf('apt') === 0) return '学生公寓 ' + id.slice(-1).toUpperCase();
    if (id.indexOf('teach') === 0) return '教学楼 ' + id.slice(-1);
    if (id.indexOf('lab') === 0) return '实验楼 ' + id.slice(-1);
    if (id.indexOf('st-') === 0) return '小吃街摊位';
    if (id.indexOf('tennis') === 0) return '网球场';
    if (id.indexOf('bball') === 0) return '篮球场';
    if (id.indexOf('badminton') === 0) return '羽毛球场';
    if (id.indexOf('pav') === 0) return '湖畔小亭';
    if (id === 'bldg-c1') return '综合楼';
    if (id === 'bldg-c2') return '办公楼';
    return '校园建筑';
  }

  /* ── 状态 ── */
  var SLOTS = ['早上', '中午', '下午', '夜里'];
  var S = { day: 1, slot: 0, stam: 100, max: 100, attrs: {}, sel: null, busy: false, dayLog: [] };
  var ATTR_KEYS = ['学术', '社交', '运动', '美食', '计划', '抗压', '尝鲜', '夜猫'];
  ATTR_KEYS.forEach(function (k) { S.attrs[k] = 0; });

  /* ── HUD 绑定 ── */
  var $ = function (id) { return document.getElementById(id); };
  var stamEl = $('stam');
  for (var i = 0; i < 10; i++) stamEl.appendChild(document.createElement('i'));
  function renderHud() {
    $('dayN').textContent = S.day;
    $('slotN').textContent = SLOTS[S.slot];
    $('stamN').textContent = S.stam;
    var on = Math.round(S.stam / 10);
    [].forEach.call(stamEl.children, function (el, i) { el.className = i < on ? '' : 'off'; });
    $('attrs').innerHTML = ATTR_KEYS.map(function (k) {
      var v = Math.min(100, S.attrs[k] * 8);
      return '<div class="row"><b>' + k + '</b><span class="bar"><i style="width:' + v + '%"></i></span>' +
             '<span class="mono" style="width:22px;text-align:right;color:#9FB4C8">' + S.attrs[k] + '</span></div>';
    }).join('');
  }
  renderHud();

  /* ── 点击拾取 ── */
  var ray = new THREE_.Raycaster(), ndc = new THREE_.Vector2();
  function pick(ev) {
    var r = canvas.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, cam);
    var hits = ray.intersectObjects(buildings ? buildings.children : [], true);
    if (!hits.length) return null;
    var o = hits[0].object;
    while (o && !o.userData.placeId) o = o.parent;
    return o || null;
  }
  canvas.addEventListener('click', function (ev) {
    if (S.busy) return;
    var b = pick(ev);
    if (!b) { hidePanel(); return; }
    showPanel(b);
  });

  /* ── 面板 ── */
  var panel = $('panel'), actsEl = $('acts');
  function hidePanel() { panel.classList.remove('on'); S.sel = null; }
  function showPanel(b) {
    S.sel = b;
    var id = b.userData.placeId;
    $('pName').textContent = nameOf(id);
    $('pSub').textContent = b.userData.placeLine || '在这里能做的事：';
    actsEl.innerHTML = '';
    actsFor(id).forEach(function (a) {
      var el = document.createElement('div');
      el.className = 'act' + (a.cost > S.stam ? ' dis' : '');
      el.innerHTML = '<span>' + a.t + '</span><span class="cost mono">-' + a.cost + '</span>';
      el.addEventListener('click', function () { if (a.cost <= S.stam && !S.busy) doAction(b, a); });
      actsEl.appendChild(el);
    });
    panel.classList.add('on');
    flyTo(b);
  }

  /* ── 镜头飞过去 ── */
  var fly = null;
  function flyTo(b) {
    var box = new THREE_.Box3().setFromObject(b);
    var c = box.getCenter(new THREE_.Vector3());
    var s = box.getSize(new THREE_.Vector3());
    var dist = Math.max(60, Math.max(s.x, s.z) * 2.2);
    var to = new THREE_.Vector3(c.x + dist * 0.72, Math.max(34, s.y * 2.2 + 26), c.z + dist * 0.72);
    fly = { t: 0, p0: cam.position.clone(), p1: to, l0: cam.userData.look || new THREE_.Vector3(0, 6, 0), l1: c.clone() };
  }
  cam.userData.look = new THREE_.Vector3(0, 6, 0);

  /* ── 行动 ── */
  function doAction(b, a) {
    S.busy = true;
    hidePanel();
    var before = S.stam;
    S.stam = Math.max(0, S.stam - a.cost);
    Object.keys(a.vec).forEach(function (k) { S.attrs[k] = (S.attrs[k] || 0) + a.vec[k]; });
    S.dayLog.push({ id: b.userData.placeId, name: nameOf(b.userData.placeId), act: a.t, vec: a.vec });
    pulse(b, a.vec);
    flyTo(b);
    renderHud();
    [].forEach.call(stamEl.children, function (el, i) {
      if (i >= Math.round(S.stam / 10) && i < Math.round(before / 10)) {
        el.classList.add('pulse'); setTimeout(function () { el.classList.remove('pulse'); }, 260);
      }
    });
    setTimeout(function () {
      S.busy = false;
      S.slot++;
      if (S.slot >= SLOTS.length || S.stam <= 0) endDay();
      else setSlot(S.slot);
    }, 1200);
  }

  /* ── 反馈：建筑脉冲 + 飘字 ── */
  function pulse(b, vec) {
    var s0 = b.scale.x;
    b.scale.setScalar(s0 * 1.035);
    setTimeout(function () { b.scale.setScalar(s0); }, 260);
    var box = new THREE_.Box3().setFromObject(b);
    var p = box.getCenter(new THREE_.Vector3());
    p.y = box.max.y + 6;
    var v = p.clone().project(cam);
    var el = document.createElement('div');
    el.id = 'fly';
    el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    el.style.color = '#8CE0A0';
    el.textContent = Object.keys(vec).map(function (k) { return k + ' +' + vec[k]; }).join('  ');
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.style.transform = 'translate(-50%,-46px)';
      el.style.opacity = '0';
    });
    setTimeout(function () { el.remove(); }, 1100);
  }

  /* ── 时段反应：天光/太阳/雾 随 早上→夜里 变化 ── */
  var sunL = null, hemiL = null;
  scene.traverse(function (o) {
    if (o.isDirectionalLight) sunL = o;
    if (o.isHemisphereLight) hemiL = o;
  });
  var SLOT_SUN = [
    { el: 22, col: 0xFFD9A8, inten: 2.0, sky: 0xBFD8F0, fog: 0xD9E4EE, exp: 1.06 },  /* 早上 */
    { el: 52, col: 0xFFF3DC, inten: 2.5, sky: 0xDCEBFB, fog: 0xDCE6F0, exp: 1.14 },  /* 中午 */
    { el: 20, col: 0xFFC98A, inten: 2.1, sky: 0xC9C2E0, fog: 0xE0D3C6, exp: 1.02 },  /* 下午（夕阳）*/
    { el: 10, col: 0x9FB4D8, inten: 0.55, sky: 0x2A3550, fog: 0x39425C, exp: 0.92 }  /* 夜里 */
  ];
  function setSlot(i) {
    var c = SLOT_SUN[i] || SLOT_SUN[0];
    if (sunL) {
      var R = 520;
      var az = [-0.9, 0.2, 2.5, 3.6][i] || 0.2;      /* 方位角随时间扫过 */
      var el = THREE_.MathUtils.degToRad(c.el);
      sunL.position.set(Math.cos(el) * Math.cos(az) * R, Math.sin(el) * R, Math.cos(el) * Math.sin(az) * R);
      sunL.color.setHex(c.col);
      sunL.intensity = c.inten;
    }
    if (hemiL) hemiL.intensity = i === 3 ? 0.30 : 0.42;
    scene.fog.color.setHex(c.fog);
    renderer.toneMappingExposure = c.exp;
    /* 夜里点亮路灯 */
    lampMats.forEach(function (m) { m.emissiveIntensity = i === 3 ? 1.5 : 0.55; });
    var hint = $('hint');
    if (hint) hint.textContent = i === 3 ? '夜里了 —— 还剩 ' + S.stam + ' 行动力，做点夜里才做的事' :
                              '点校园里的建筑 → 选一个行动（会掉行动力、推进时段）';
  }
  setSlot(0);

  /* ── 一天结束 ── */
  function endDay() {
    var top = Object.keys(S.attrs).map(function (k) { return [k, S.attrs[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
    $('sDay').textContent = S.day;
    $('sTitle').textContent = top[0] && top[0][1] > 0 ? ('今天的你：' + top[0][0] + '型') : '今天什么都没做';
    $('sBody').innerHTML = top.map(function (t) {
      return '<div class="line"><span>' + t[0] + '</span><span class="mono">' + t[1] + '</span></div>';
    }).join('') + '<div class="line" style="margin-top:10px;color:#8FA3B8">今天走了 ' + S.dayLog.length + ' 个地方</div>';
    $('summary').classList.add('on');
  }
  $('sGo').addEventListener('click', function () {
    $('summary').classList.remove('on');
    S.day++; S.slot = 0; S.stam = S.max; S.dayLog = [];
    renderHud(); setSlot(0);
  });

  /* ── 主循环补间 ── */
  (function loop() {
    requestAnimationFrame(loop);
    if (fly) {
      fly.t = Math.min(1, fly.t + 0.03);
      var e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
      cam.position.lerpVectors(fly.p0, fly.p1, e);
      var lk = new THREE_.Vector3().lerpVectors(fly.l0, fly.l1, e);
      cam.lookAt(lk);
      cam.userData.look = lk;
      if (fly.t >= 1) fly = null;
    }
  })();

  window.__GAME = { state: S, setSlot: setSlot, acts: actsFor };
})();
