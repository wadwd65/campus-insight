/**
 * 定位"草坪上的漂浮圆点"：按屏幕坐标 → 反查场景里的锥体/小球。
 * 输出每个候选的：几何类型、世界坐标、距场地中心半径、局部/世界 y。
 * 判据：草丛（ConeGeometry）应落在 r ∈ [35.5, 54] 且 y ≈ h/2（贴地）。
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
const PORT = 9700 + Math.floor(Math.random() * 200);
const profile = path.join(require('os').tmpdir(), 'cdp-dot-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const p = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) { wsUrl = p.webSocketDebuggerUrl; break; }
    } catch (e) {}
    await sleep(300);
  }
  const ws = new WebSocket(wsUrl);
  let id = 1; const pending = new Map();
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (m, p = {}) => new Promise(res => { const i = id++; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await send('Runtime.enable'); await send('Page.enable');
  await sleep(4800);

  const q = `(function(){
    var T = window.__three, s = T.scene, cam = T.camera;
    var out = { cones: [], spheres_small: [], floaters: [] };
    var proj = new T.THREE.Vector3();
    s.traverse(function(o){
      if (!o.isMesh) return;
      var g = o.geometry; if (!g) return;
      var t = g.type;
      if (t !== 'ConeGeometry' && t !== 'SphereGeometry') return;
      var wp = new T.THREE.Vector3(); o.getWorldPosition(wp);
      var rad = Math.hypot(wp.x, wp.z + 4);
      var pr = (g.parameters && g.parameters.radius) || 0;
      var rec = { t: t, x: +wp.x.toFixed(1), y: +wp.y.toFixed(2), z: +wp.z.toFixed(1),
                  rad: +rad.toFixed(1), r: +pr.toFixed(2) };
      if (t === 'ConeGeometry') out.cones.push(rec);
      else if (pr < 2.0) out.spheres_small.push(rec);
      /* 屏幕投影 */
      proj.copy(wp).project(cam);
      rec.sx = Math.round((proj.x*0.5+0.5)*window.innerWidth);
      rec.sy = Math.round((-proj.y*0.5+0.5)*window.innerHeight);
      if (t === 'ConeGeometry') out.floaters.push([rec.sx, rec.sy, +wp.y.toFixed(2)]);
    });
    out.coneCount = out.cones.length;
    out.smallSphereCount = out.spheres_small.length;
    /* 草丛半径分布 */
    var rs = out.cones.map(function(c){ return c.rad; });
    out.coneRadiusRange = rs.length ? [Math.min.apply(null,rs), Math.max.apply(null,rs)] : null;
    var ys = out.cones.map(function(c){ return c.y; });
    out.coneYRange = ys.length ? [Math.min.apply(null,ys), Math.max.apply(null,ys)] : null;
    out.coneSample = out.cones.slice(0, 6);
    out.smallSphereSample = out.spheres_small.slice(0, 8);
    return JSON.stringify(out);
  })()`;
  const r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
  const o = JSON.parse(r.result.result.value);
  console.log('锥体（草丛）数量:', o.coneCount, ' 半径范围:', o.coneRadiusRange, ' y 范围:', o.coneYRange);
  console.log('锥体样本 (世界坐标/距心/半径/屏幕):');
  o.coneSample.forEach(c => console.log('  ', JSON.stringify(c)));
  console.log('');
  console.log('小球（半径<2）数量:', o.smallSphereCount);
  console.log('小球样本:');
  o.smallSphereSample.forEach(c => console.log('  ', JSON.stringify(c)));
  console.log('');
  console.log('锥体屏幕坐标（找"草坪上的圆点"）:', JSON.stringify(o.floaters.slice(0, 40)));

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
