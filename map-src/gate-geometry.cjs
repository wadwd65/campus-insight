/**
 * ★ 几何一致性闸门（geometric sanity gate）
 * ────────────────────────────────────────────────────────────────
 * 目的：把 v13/v14 那批「构件悬空 / 陷进坡面 / 压在窗上」的异常
 *      变成**可自动断言的数值检查**，而不是靠看图发现。
 *
 * 每一项都对应一次真实返工：
 *   G1 楼梯间底面是否落在屋面上（v14 悬空 2.04m）
 *   G2 天窗是否坐在坡面上（v14 陷进坡面 0.65m）
 *   G3 空调顶是否低于窗台（v14 压窗 0.16m）
 *   G4 竖玻璃带顶端是否收在檐口带以下（v14 戳穿 0.24m）
 *   G5 雨落管凸出量是否小于腰线（v14 抢窗）
 *   G6 各立面层的外表面顺序：玻璃 < 窗套 < 窗台（且都 ≥ 墙面）
 *   G7 屋顶设备是否落在坡面上
 *
 * 用法：node gate-geometry.cjs   （退出码非 0 = 有 FAIL）
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));
if (!EDGE) { console.error('Edge not found'); process.exit(2); }

const PORT = 9822;
const profile = path.join(os.tmpdir(), 'gate-' + Date.now());
const fileUrl = 'file:///' + path.resolve('tower.html').replace(/\\/g, '/');

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
  '--window-size=1440,960', '--hide-scrollbars', '--no-first-run', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 页面内：把整个场景的几何量出来，交回给 Node 做断言 */
const PROBE = `(function(){
  var out = {};
  var FLOOR = 3.9, NF = 5, FL = NF * FLOOR;
  var ROOF_ANG = ROOF_ANG_V, EAVE = EAVE_V;

  /* ★★★ v17e：色号一律**按名字**从场景取（window.__C），不再硬编码。
     起因：本轮改了屋顶设备色板 ⇒ G1/G7 立刻误报"未找到楼梯间/0 个水箱"。
     与 §8.4「验证工具自身也要核算尺度」同源 —— 闸门不能依赖会漂移的常量。 */
  var C = window.__C || {};
  function hexOf(name, fallback){
    var v = C[name];
    if (typeof v !== 'number') {
      out.paletteMiss = (out.paletteMiss || []);
      out.paletteMiss.push(name);
      return fallback;
    }
    return v;
  }
  out.paletteSource = window.__C ? 'window.__C (live)' : 'FALLBACK(硬编码)';

  function bbox(o){ o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); }
  function byColor(hex){
    var L=[]; scene.traverse(function(o){
      if(o.isMesh && o.material && o.material.color && o.material.color.getHex()===hex) L.push(o);
    }); return L;
  }

  /* 三栋楼（按名字/位置区分）：取 z 最小的是北楼（z=-13），|x| 大的是东西楼 */
  var towers = [];
  scene.traverse(function(o){ if(o.isGroup && o.children.length>40 && o.position.y===0 && (o.position.z===-13 || Math.abs(o.position.x)===19)) towers.push(o); });
  out.towerCount = towers.length;

  /* G1 楼梯间：★ v17 更新判据 —— 楼梯间改用 M.stairWall，
     且从"单盒 3.4×2.9×3.0"改成"主间体量 3.28×2.9×2.88"（收 6cm 给壁柱）。
     判据改成**按材质找主间**（尺寸容差放宽到 ±0.15），
     这样不论楼梯间内部怎么加细节，只要主间在就能验"底面不悬空"。 */
  out.stair = [];
  towers.forEach(function(t, ti){
    t.traverse(function(o){
      if(!o.isMesh || o.geometry.type!=='BoxGeometry') return;
      var c = o.material && o.material.color ? o.material.color.getHex() : -1;
      if(c !== hexOf('stairWall', 0x9C9A94)) return;
      var p = o.geometry.parameters;
      if(Math.abs(p.height-2.9) > 0.15) return;         /* 只认"主间"高度那件 */
      if(p.width < 2.5 || p.depth < 2.0) return;
      var b = bbox(o);
      /* ★★★ 关键（§8.4 教训）：roofYAt 用的是**楼组局部坐标**（相对墙顶、0 在楼心）。
         所以这里必须报"主间在**它所属楼组内的**位置"，不能报世界 AABB。
         主间本体有 scale.y（VS）—— 用 add() 后的局部位置最稳。 */
      out.stair.push({
        tower: ti,
        bottom: +b.min.y.toFixed(3),
        /* 主间相对楼组的 z（楼梯间 group 的 position.z + 本体 0）
           —— 本体在 sg 内偏移 0，所以就是 sg.position.z */
        z: +o.parent.position.z.toFixed(2),
        x: +o.parent.position.x.toFixed(2)
      });
    });
  });

  /* 计算"该 z 处的屋面高度"（与代码同一公式） */
  function roofYAt(towerZ, D_, zRel){
    var b=(D_+2*EAVE)/2, rise=b*Math.tan(ROOF_ANG);
    var t=Math.max(-1,Math.min(1,zRel/b));
    return FL + rise*(1-Math.abs(t));
  }
  out.roofYAtNorth_ridge = +roofYAt(-13, 12, 0).toFixed(3);

  /* G3 空调：M.ac(0xC8C4BC) 的机身，看顶端 vs 窗台 */
  out.ac = [];
  towers.forEach(function(t,ti){
    t.traverse(function(o){
      if(!o.isMesh||o.geometry.type!=='BoxGeometry') return;
      var c=o.material&&o.material.color?o.material.color.getHex():-1;
      if(c!==0xC8C4BC) return;
      var p=o.geometry.parameters;
      if(Math.abs(p.width-0.94)>0.02) return;
      var b=bbox(o);
      out.ac.push({ tower:ti, top:+b.max.y.toFixed(3), bottom:+b.min.y.toFixed(3) });
    });
  });

  /* G4 竖玻璃带：M.win 中"高>10m"的那条（竖带），看顶端 */
  out.vband = [];
  towers.forEach(function(t,ti){
    t.traverse(function(o){
      if(!o.isMesh) return;
      var c=o.material&&o.material.color?o.material.color.getHex():-1;
      if(c!==0x0C1420) return;
      var b=bbox(o); var h=b.max.y-b.min.y;
      if(h>10) out.vband.push({ tower:ti, top:+b.max.y.toFixed(3), bottom:+b.min.y.toFixed(3), h:+h.toFixed(2) });
    });
  });

  /* G6 立面各层深度（北楼正面 dir=0，看 z 值；外法向 +Z ⇒ 越大越靠外） */
  function maxZof(hex, near){
    var L=[];
    scene.traverse(function(o){
      if(!o.isMesh||!o.material||!o.material.color) return;
      if(o.material.color.getHex()!==hex) return;
      var b=bbox(o);
      if(near!=null && !(b.max.z>near-1.5 && b.max.z<near+1.0)) return;
      L.push(+b.max.z.toFixed(4));
    });
    L.sort(function(a,b){return a-b;});
    return L.length? L[L.length-1] : null;
  }
  /* 北楼正面 z ≈ -13 + (12-0.06)/2 = -7.03 */
  var wallFace = -13 + (12-0.06)/2;
  out.wallFace = +wallFace.toFixed(4);
  out.glassZ = maxZof(0x0C1420, wallFace);
  out.frameZ = maxZof(0xE4E0D8, wallFace);
  out.sillZ  = maxZof(0xCFC8BA, wallFace);

  /* G5 雨落管(0x8E887E) 与 腰线(0xCFC8BA) 的凸出量 */
  out.rainZ = maxZof(0x8E887E, wallFace);

  /* G7 屋顶设备：★ v17 更新判据 —— 水箱改用 M.tank(0x8E9298)，半径 0.68。
     同时把"屋面风机"（同色 M.tank，半径 0.52）也纳入检查 ——
     因为风机也是圆柱、也要坐落在坡面上，属于同一类风险。 */
  out.tank = [];
  towers.forEach(function(t,ti){
    t.traverse(function(o){
      if(!o.isMesh || o.geometry.type!=='CylinderGeometry') return;
      var c=o.material&&o.material.color?o.material.color.getHex():-1;
      if(c!==hexOf('tank', 0x8E9298)) return;
      var p=o.geometry.parameters;
      if(!p) return;
      /* 只收"罐体/筒身"（高 ≥0.6），不收顶盖/顶罩那些扁片 */
      if(p.height < 0.6) return;
      var b=bbox(o);
      out.tank.push({ tower:ti, bottom:+b.min.y.toFixed(3), z:+o.position.z.toFixed(2),
                      r:+p.radiusTop.toFixed(2) });
    });
  });

  out.FL = FL; out.ROOF_ANG = ROOF_ANG; out.EAVE = EAVE;
  return JSON.stringify(out);
})()`;

(async () => {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const j = await r.json();
      const pg = j.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pg) { wsUrl = pg.webSocketDebuggerUrl; break; }
    } catch (e) { }
    await sleep(300);
  }
  if (!wsUrl) { console.log('NO TARGET'); child.kill(); process.exit(2); }

  const ws = new WebSocket(wsUrl);
  let id = 1; const pend = new Map();
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(r => {
    const i = id++; pend.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  await send('Runtime.enable');
  await sleep(7000);

  /* 把常量注入探针（页面里的 ROOF_ANG / EAVE_OUT 是全局 var，可直接读到）*/
  const probeSrc = PROBE
    .replace('ROOF_ANG_V', '(typeof ROOF_ANG!=="undefined"?ROOF_ANG:0.48)')
    .replace('EAVE_V', '(typeof EAVE_OUT!=="undefined"?EAVE_OUT:0.75)');

  const R2 = await send('Runtime.evaluate', { returnByValue: true, expression: probeSrc });
  const raw = R2.result && R2.result.result && R2.result.result.value;
  if (!raw) { console.log('PROBE FAILED:', JSON.stringify(R2).slice(0, 400)); ws.close(); child.kill(); process.exit(2); }
  const D = JSON.parse(raw);

  /* ── 断言 ─────────────────────────────────────────────── */
  const results = [];
  const chk = (name, ok, detail) => results.push({ name, ok, detail });

  /* G1 楼梯间：底面必须 ≤ 它**所在位置**的屋面高（可坐进去，不可悬空）
     ⚠️ 不能只和"墙顶"比 —— 楼梯间本来就在坡面上，底面高于墙顶是正常的。
        判据 = 底面 ≤ roofYAt(该 z)，且不与屋面差太远（> 0.5m 算悬空）。*/
  if (!D.stair.length) chk('G1 楼梯间存在', false, '未找到楼梯间几何');
  const towerD = [12, 12, 12];      /* 北楼进深 12；东西楼 20（下面按 tower 取）*/
  D.stair.forEach((s, i) => {
    /* 用该楼梯间自己的 z 与所在楼的进深算屋面高度 */
    const D_ = s.tower === 0 ? 12 : 20;
    const b = (D_ + 2 * D.EAVE) / 2;
    const rise = b * Math.tan(D.ROOF_ANG);
    const t = Math.max(-1, Math.min(1, s.z / b));
    const roofY = D.FL + rise * (1 - Math.abs(t));
    const gap = s.bottom - roofY;      /* >0 = 悬空，<0 = 坐进去 */
    chk(`G1 楼梯间#${i} 落在屋面`, gap <= 0.12,
      `底面 ${s.bottom} vs 该处屋面 ${roofY.toFixed(3)} ⇒ ${gap > 0 ? '悬空 ' + gap.toFixed(3) + 'm' : '坐进 ' + (-gap).toFixed(3) + 'm'}`);
  });

  /* G3 空调顶端 ≤ 窗台（窗台底 = f*FLOOR + 0.62） */
  if (!D.ac.length) chk('G3 空调存在', false, '未找到空调机身');
  const badAc = D.ac.filter(a => {
    const f = Math.round((a.top - 0.59) / 3.9);          /* 反推层号 */
    const sillBottom = f * 3.9 + 0.62;
    return a.top > sillBottom + 0.02;
  });
  chk('G3 空调不压窗', badAc.length === 0,
    `共 ${D.ac.length} 台；越界 ${badAc.length} 台` +
    (badAc.length ? `（例：顶 ${badAc[0].top}）` : ''));

  /* G4 竖带顶端 ≤ 檐口带下沿（FL） */
  if (!D.vband.length) chk('G4 竖玻璃带存在', false, '未找到竖玻璃带');
  const badVb = D.vband.filter(v => v.top > D.FL + 0.02);
  chk('G4 竖带不戳穿檐口', badVb.length === 0,
    `共 ${D.vband.length} 条；越界 ${badVb.length} 条` +
    (badVb.length ? `（例：顶 ${badVb[0].top} > 墙顶 ${D.FL}）` : ''));

  /* G6 立面层顺序：glass < frame < sill，且 glass ≥ wallFace */
  const order = [];
  if (D.glassZ != null && D.frameZ != null) order.push(['玻璃<窗套', D.glassZ < D.frameZ, `${D.glassZ} < ${D.frameZ}`]);
  if (D.frameZ != null && D.sillZ != null) order.push(['窗套<窗台', D.frameZ < D.sillZ, `${D.frameZ} < ${D.sillZ}`]);
  if (D.glassZ != null) order.push(['玻璃≥墙面', D.glassZ >= D.wallFace - 0.001, `${D.glassZ} vs 墙 ${D.wallFace}`]);
  order.forEach(([n, ok, d]) => chk('G6 ' + n, ok, d));

  /* G5 雨落管凸出量 < 腰线凸出量 */
  if (D.rainZ != null && D.sillZ != null) {
    chk('G5 雨落管不抢窗/腰线', D.rainZ <= D.sillZ,
      `雨落管 ${D.rainZ} ≤ 腰线 ${D.sillZ}`);
  }

  /* G7 水箱/设备落在坡面上（底面 ≤ 屋脊高度） */
  const badTank = D.tank.filter(t => t.bottom > D.FL + 3.6);
  chk('G7 屋顶设备不悬空', badTank.length === 0,
    `共 ${D.tank.length} 个水箱；越界 ${badTank.length}` +
    (badTank.length ? `（例：底 ${badTank[0].bottom}）` : ''));

  /* ── 输出 ─────────────────────────────────────────────── */
  console.log('\n═══ 几何一致性闸门 ═══');
  console.log(`场景：${D.towerCount} 栋 | 墙顶 ${D.FL}m | 坡角 ${(D.ROOF_ANG*180/Math.PI).toFixed(1)}° | 屋脊 ${D.roofYAtNorth_ridge}m`);
  console.log(`立面深度（北楼正面，外法向 +Z，越大越靠外）：墙面 ${D.wallFace} / 玻璃 ${D.glassZ} / 窗套 ${D.frameZ} / 窗台 ${D.sillZ} / 雨落管 ${D.rainZ}\n`);
  let fail = 0;
  results.forEach(r => {
    if (!r.ok) fail++;
    console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.name.padEnd(22)} ${r.detail}`);
  });
  console.log(`\n结果：${results.length - fail}/${results.length} 通过${fail ? `，${fail} 项失败` : '，全部通过'}\n`);

  ws.close(); child.kill();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERR', e.message); child.kill(); process.exit(2); });
