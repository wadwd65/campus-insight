/**
 * exp-plaza.cjs —— 铺装广场的两个基础量（v18 新增）
 *
 * 目的①  **屏幕换算**：这块广场在画面上到底多少 px/m？
 *         —— 决定"分格线要多宽才不是亚像素"（现在 0.03m 只有 0.21px）
 * 目的②  **明度传递率**：广场材质色 → 渲染明度，单变量 5 档
 *         —— 决定要不要提亮、提多少，以及过曝(>200)的代价
 *
 * 用法: node exp-plaza.cjs [tower.html]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const pagePath = process.argv[2] || 'tower.html';
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9700 + Math.floor(Math.random() * 180);
const profile = path.join(require('os').tmpdir(), 'cdp-plz-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── 页面内：先建立 plaza / lawn 掩膜与 px/m，再跑明度阶梯 ── */
const SETUP = `
(function(){
  var T = window.__three, s = T.scene, cam = T.camera, THREE = T.THREE, r = T.renderer;
  var W = r.domElement.width, H = r.domElement.height;
  window.__g = { W: W, H: H };

  function grab(){
    var oc = document.createElement('canvas'); oc.width = W; oc.height = H;
    var ox = oc.getContext('2d'); ox.drawImage(r.domElement, 0, 0);
    return ox.getImageData(0, 0, W, H).data;
  }
  window.__grab = grab;

  /* ① px/m：把世界两点投到屏幕 */
  var c0 = new THREE.Vector3(0, 0.05, -4).project(cam);
  var c1 = new THREE.Vector3(1, 0.05, -4).project(cam);
  var c2 = new THREE.Vector3(0, 0.05, -3).project(cam);
  var pxPerMX = Math.abs((c1.x - c0.x)) * 0.5 * W;
  var pxPerMZ = Math.abs((c2.y - c0.y)) * 0.5 * H;
  window.__g.pxPerM = { x: +pxPerMX.toFixed(3), z: +pxPerMZ.toFixed(3) };
  window.__g.centerPX = [Math.round((c0.x*0.5+0.5)*W), Math.round((-c0.y*0.5+0.5)*H)];

  /* ② 找 plaza 与 lawn 网格 */
  var plaza = null, lawn = null;
  s.traverse(function(o){
    if (!o.isMesh || !o.geometry) return;
    var t = o.geometry.type, p = o.geometry.parameters || {};
    if (t === 'CircleGeometry' && p.radius === 34) plaza = o;
    if (t === 'RingGeometry' && p.innerRadius === 34 && p.outerRadius === 108) lawn = o;
  });
  window.__g.hasPlaza = !!plaza; window.__g.hasLawn = !!lawn;

  /* ③ 掩膜：plaza（含被建筑遮挡的剔除）与 lawn */
  var all = []; s.traverse(function(o){ if (o.isMesh && o.material) all.push(o); });
  var orig = all.map(function(o){ return o.material; });
  var BLACK = new THREE.MeshBasicMaterial({ color: 0x000000 });
  var WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
  function maskOf(target){
    for (var k=0;k<all.length;k++) all[k].material = BLACK;
    if (target) target.material = WHITE;
    r.render(s, cam);
    var d = grab(), m = new Uint8Array(W*H), n = 0;
    for (var q=0;q<W*H;q++){ var o4=q*4;
      if (d[o4]>200 && d[o4+1]>200 && d[o4+2]>200){ m[q]=1; n++; } }
    for (var k2=0;k2<all.length;k2++) all[k2].material = orig[k2];
    return { m: m, n: n };
  }
  window.__g.plazaMask = maskOf(plaza);
  window.__g.lawnMask  = maskOf(lawn);
  window.__g.plazaOrigHex = plaza ? plaza.material.color.getHex() : 0;
  /* 恢复渲染 */
  if (plaza) plaza.material.color.setHex(window.__g.plazaOrigHex);
  r.render(s, cam);
  window.__g.plazaMat = plaza ? plaza.material : null;

  return JSON.stringify({ pxPerM: window.__g.pxPerM, centerPX: window.__g.centerPX,
    hasPlaza: window.__g.hasPlaza, hasLawn: window.__g.hasLawn,
    plazaPx: window.__g.plazaMask.n, lawnPx: window.__g.lawnMask.n });
})()
`;

/* ── 页面内：把 plaza 材质设为给定色，量 plaza / lawn / 全图过曝 ── */
function stepExpr(hex) {
  return `
(function(){
  var T = window.__three, s = T.scene, cam = T.camera, r = T.renderer, THREE = T.THREE;
  var g = window.__g, W = g.W, H = g.H;
  g.plazaMat.color.setHex(${hex});
  r.render(s, cam);
  var px = g.__grab ? g.__grab() : (function(){
    var oc=document.createElement('canvas'); oc.width=W; oc.height=H;
    var ox=oc.getContext('2d'); ox.drawImage(r.domElement,0,0);
    return ox.getImageData(0,0,W,H).data; })();

  function measure(mask){
    var sum=0, cnt=mask.n, hi=0, sr=0,sg=0,sb=0;
    for (var q=0;q<W*H;q++){
      if (!mask.m[q]) continue;
      var o=q*4, rr=px[o], gg=px[o+1], bb=px[o+2];
      sum += 0.2126*rr+0.7152*gg+0.0722*bb; sr+=rr; sg+=gg; sb+=bb;
      if (0.2126*rr+0.7152*gg+0.0722*bb > 200) hi++;
    }
    return { lum: cnt? +(sum/cnt).toFixed(1):0, rgb: cnt?[Math.round(sr/cnt),Math.round(sg/cnt),Math.round(sb/cnt)]:[0,0,0],
             over: cnt? +(hi/cnt*100).toFixed(2):0 };
  }
  var P = measure(g.plazaMask), L = measure(g.lawnMask);

  var allOver=0, allN=0, bright=0;
  for (var q2=0;q2<W*H;q2++){
    var o2=q2*4;
    var L2 = 0.2126*px[o2]+0.7152*px[o2+1]+0.0722*px[o2+2];
    allN++; if (L2>200) allOver++; if (L2>190) bright++;
  }
  return JSON.stringify({ plaza:P, lawn:L,
    frameOver200:+(allOver/allN*100).toFixed(3),
    frameOver190:+(bright/allN*100).toFixed(3) });
})()
`;
}

(async () => {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch (e) {}
    await sleep(300);
  }
  if (!wsUrl) { console.error('no target'); child.kill('SIGKILL'); process.exit(1); }

  const ws = new WebSocket(wsUrl);
  let id = 1; const pending = new Map();
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const myId = id++; pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });

  await send('Runtime.enable'); await send('Page.enable');
  await sleep(5200);

  const rs = await send('Runtime.evaluate', { expression: SETUP, returnByValue: true, timeout: 120000 });
  if (!rs.result || !rs.result.result || !rs.result.result.value) {
    console.error('SETUP 失败:', JSON.stringify(rs).slice(0, 700));
    child.kill('SIGKILL'); process.exit(1);
  }
  const setup = JSON.parse(rs.result.result.value);
  console.log('=== ① 屏幕换算 ===');
  console.log('  水平 %.3f px/m    纵向 %.3f px/m    广场中心屏幕坐标 %s' ,
    setup.pxPerM.x, setup.pxPerM.z, JSON.stringify(setup.centerPX));
  const ppm = setup.pxPerM.x;
  console.log('  ⇒ 分格线宽度换算：');
  [0.03, 0.06, 0.10, 0.15, 0.21, 0.30, 0.45].forEach(w => {
    console.log('     %5.2f m  =  %5.2f px  %s', w, w * ppm,
      w * ppm < 0.6 ? '← 亚像素，等于没画' : (w * ppm < 1.2 ? '← 勉强' : '← 看得见'));
  });
  console.log('\n  掩膜: 广场 %d px   草坪 %d px', setup.plazaPx, setup.lawnPx);

  console.log('\n=== ② 广场明度阶梯（单变量）===');
  console.log('%-12s %9s %8s  %-15s %8s   %10s %10s', '材质色', '材质明度', '渲染明度', 'RGB', '>200%', '全图>200%', '全图>190%');
  const LADDER = [0x8C8880, 0x969289, 0xA09C93, 0xAAA69C, 0xB4B0A6, 0xBEBAAF];
  const res = [];
  for (const hex of LADDER) {
    const r = await send('Runtime.evaluate', { expression: stepExpr(hex), returnByValue: true, timeout: 60000 });
    if (!r.result || !r.result.result || !r.result.result.value) { console.log('  0x' + hex.toString(16) + ' 失败'); continue; }
    const o = JSON.parse(r.result.result.value);
    const rr = (hex >> 16) & 255, gg = (hex >> 8) & 255, bb = hex & 255;
    const mlum = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
    res.push({ hex, mlum, ...o });
    console.log('0x%s %9.1f %8.1f  (%3d,%3d,%3d) %7.2f   %9.3f %10.3f',
      hex.toString(16).padStart(6, '0'), mlum, o.plaza.lum,
      o.plaza.rgb[0], o.plaza.rgb[1], o.plaza.rgb[2], o.plaza.over,
      o.frameOver200, o.frameOver190);
    await sleep(150);
  }

  /* 传递率 */
  console.log('\n=== ③ 传递率（材质 → 渲染）===');
  for (let i = 1; i < res.length; i++) {
    const dM = res[i].mlum - res[0].mlum;
    const dR = res[i].plaza.lum - res[0].plaza.lum;
    console.log('  材质 %+6.1f  ⇒  渲染 %+6.1f   传递率 %s',
      dM, dR, dM === 0 ? '-' : (dR / dM).toFixed(3));
  }

  /* 与草坪的关系 */
  console.log('\n=== ④ 广场 − 草坪 反差（参照物：真实航拍 +38.0）===');
  res.forEach(x => {
    console.log('  0x%s  广场 %6.1f  草坪 %6.1f  差 %+6.1f',
      x.hex.toString(16).padStart(6, '0'), x.plaza.lum, x.lawn.lum, x.plaza.lum - x.lawn.lum);
  });

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
