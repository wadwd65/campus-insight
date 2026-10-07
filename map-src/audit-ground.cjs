/**
 * audit-ground.cjs —— 场地分层「可见像素级」审计（v18 新增）
 *
 * 为什么不用"按颜色猜区域"：
 *   §4.1 的教训是「采样窗口必须先确认它圈住的是目标」。
 *   按色相/距离猜的窗口会把建筑、树影、道路混进来（本轮第一次尝试就被污染：
 *   扫描线 sd 高达 68，判出的"缝周期 6px"其实是 JPEG 噪点）。
 *
 * 做法（掩膜渲染，确定性）：
 *   ① 把所有 mesh 材质换成纯黑 MeshBasic，只把目标层换成纯白 → 渲染
 *      ⇒ 白色像素 = 该层的**真实可见**像素（遮挡关系由 GPU 处理，天然正确）
 *   ② 恢复全部材质 → 正常渲染一次
 *   ③ 在①得到的掩膜上，量②的明度 / RGB / >200 占比
 *
 * 输出：每层的 像素数 / 明度 / RGB / 过曝占比 + 全图过曝占比
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
const PORT = 9600 + Math.floor(Math.random() * 200);
const profile = path.join(require('os').tmpdir(), 'cdp-gnd-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

const PROBE = `
(function(){
  var T = window.__three, s = T.scene, cam = T.camera, THREE = T.THREE;
  var r = T.renderer;
  var W = r.domElement.width, H = r.domElement.height;

  function grab(){
    var oc = document.createElement('canvas'); oc.width = W; oc.height = H;
    var ox = oc.getContext('2d');
    ox.drawImage(r.domElement, 0, 0);
    return ox.getImageData(0, 0, W, H).data;
  }

  /* ── 1. 清点地面层（Circle / Ring）── */
  var grounds = [];
  s.traverse(function(o){
    if (!o.isMesh || !o.geometry || !o.material || !o.material.color) return;
    var t = o.geometry.type;
    if (t !== 'CircleGeometry' && t !== 'RingGeometry') return;
    grounds.push(o);
  });

  var inv = grounds.map(function(o){
    var g = o.geometry, p = g.parameters || {};
    var lab;
    if (g.type === 'CircleGeometry') {
      lab = 'plaza_Circle(r=' + p.radius + ')';
    } else {
      var w = p.outerRadius - p.innerRadius;
      var i0 = p.innerRadius, i1 = p.outerRadius;
      if (w < 0.6 && i1 < 33)        lab = 'joint(' + i0.toFixed(1) + '~' + i1.toFixed(1) + ')';
      else if (w < 0.6)              lab = 'curb(' + i0.toFixed(1) + '~' + i1.toFixed(1) + ')';
      else if (i0 >= 33 && i1 > 60)  lab = 'lawnOuter(' + i0 + '~' + i1 + ')';
      else if (i0 >= 33 && i1 <= 60) lab = 'lawnInner(' + i0 + '~' + i1 + ')';
      else if (i0 >= 33)             lab = 'road(' + i0 + '~' + i1 + ')';
      else                           lab = 'ring(' + i0.toFixed(1) + '~' + i1.toFixed(1) + ')';
    }
    return { lab: lab, hex: '#' + o.material.color.getHexString() };
  });

  /* ── 2. 逐层掩膜 ── */
  var all = [];
  s.traverse(function(o){ if (o.isMesh && o.material) all.push(o); });
  var orig = all.map(function(o){ return o.material; });
  var BLACK = new THREE.MeshBasicMaterial({ color: 0x000000 });
  var WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });

  var masks = [];
  for (var i = 0; i < grounds.length; i++) {
    for (var k = 0; k < all.length; k++) all[k].material = BLACK;
    grounds[i].material = WHITE;
    r.render(s, cam);
    var d = grab();
    var m = new Uint8Array(W * H), n = 0;
    for (var q = 0; q < W * H; q++) {
      var o4 = q * 4;
      if (d[o4] > 200 && d[o4 + 1] > 200 && d[o4 + 2] > 200) { m[q] = 1; n++; }
    }
    masks.push({ n: n, m: m });
    for (var k2 = 0; k2 < all.length; k2++) all[k2].material = orig[k2];
    grounds[i].material = orig[i];
  }

  /* ── 3. 正常渲染，按掩膜量 ── */
  r.render(s, cam);
  var px = grab();

  var rows = [];
  for (var j = 0; j < masks.length; j++) {
    var mm = masks[j].m, cnt = masks[j].n;
    var sum = 0, hi = 0, sr = 0, sg = 0, sb = 0;
    for (var q2 = 0; q2 < W * H; q2++) {
      if (!mm[q2]) continue;
      var o5 = q2 * 4, rr = px[o5], gg = px[o5 + 1], bb = px[o5 + 2];
      var L = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
      sum += L; sr += rr; sg += gg; sb += bb;
      if (L > 200) hi++;
    }
    rows.push({
      lab: inv[j].lab, hex: inv[j].hex, n: cnt,
      lum: cnt ? +(sum / cnt).toFixed(1) : 0,
      rgb: cnt ? [Math.round(sr / cnt), Math.round(sg / cnt), Math.round(sb / cnt)] : [0,0,0],
      over: cnt ? +(hi / cnt * 100).toFixed(2) : 0
    });
  }

  /* ── 4. 全图过曝 ── */
  var allOver = 0, allN = 0;
  for (var q3 = 0; q3 < W * H; q3++) {
    var o6 = q3 * 4;
    var L2 = 0.2126 * px[o6] + 0.7152 * px[o6 + 1] + 0.0722 * px[o6 + 2];
    allN++; if (L2 > 200) allOver++;
  }

  return JSON.stringify({
    W: W, H: H,
    nGrounds: grounds.length,
    rows: rows,
    frameOver200: +(allOver / allN * 100).toFixed(3)
  });
})()
`;

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

  const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true, timeout: 120000 });
  if (!r.result || !r.result.result || !r.result.result.value) {
    console.error('探针失败:', JSON.stringify(r).slice(0, 600));
    child.kill('SIGKILL'); process.exit(1);
  }
  const o = JSON.parse(r.result.result.value);
  console.log(`画布 ${o.W}x${o.H}   地面层 ${o.nGrounds} 个   全图 >200 占比 ${o.frameOver200}%\n`);
  console.log('%-26s %-11s %9s %8s  %-16s %8s', '层', '材质色', '可见像素', '明度', 'RGB', '>200%');
  console.log('-'.repeat(88));
  o.rows.forEach(x => {
    console.log('%-26s %-11s %9d %8.1f  (%3d,%3d,%3d)      %7.2f',
      x.lab, x.hex, x.n, x.lum, x.rgb[0], x.rgb[1], x.rgb[2], x.over);
  });

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
