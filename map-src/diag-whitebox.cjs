/**
 * 精确定位"屋顶上的象牙白盒子"：按屏幕坐标框选，列出框内所有网格的
 * 材质色 + 几何 + 世界位置。判据：框内出现 0xE4E0D8 系材质 ⇒ 就是它。
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
const PORT = 9100 + Math.floor(Math.random() * 90);
const profile = path.join(require('os').tmpdir(), 'cdp-wb-' + Date.now());
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
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const l = await r.json();
      const p = l.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) { wsUrl = p.webSocketDebuggerUrl; break; } } catch (e) {}
    await sleep(300);
  }
  const ws = new WebSocket(wsUrl); let id = 1; const pending = new Map();
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (m, p = {}) => new Promise(res => { const i = id++; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await send('Runtime.enable'); await send('Page.enable');
  await sleep(5200);

  // 屏幕框：北楼西侧那个白盒子（来自 v16l-roof.png 的换算：crop 470,170 + 图上 (50,300)/3.0）
  const X0 = 470 + Math.round(50 / 3.0);
  const Y0 = 170 + Math.round(300 / 3.0);
  const X1 = 470 + Math.round(230 / 3.0);
  const Y1 = 170 + Math.round(400 / 3.0);
  const q = `(function(){
    var T = window.__three, THREE = T.THREE, s = T.scene, cam = T.camera;
    var box = { x0: ${X0}, y0: ${Y0}, x1: ${X1}, y1: ${Y1} };
    var out = [], seen = {};
    var v = new THREE.Vector3();
    s.traverse(function(o){
      if (!o.isMesh || !o.material) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      var col = mats[0].color ? mats[0].color.getHexString() : '-';
      /* 投影到屏幕（取网格中心）*/
      o.getWorldPosition(v);
      var p = v.clone().project(cam);
      var sx = (p.x*0.5+0.5)*window.innerWidth;
      var sy = (-p.y*0.5+0.5)*window.innerHeight;
      if (sx < box.x0 || sx > box.x1 || sy < box.y0 || sy > box.y1) return;
      var key = col + '|' + (o.geometry ? o.geometry.type : '?');
      if (seen[key]) { seen[key].n++; return; }
      seen[key] = { n: 1, col: col, geo: o.geometry ? o.geometry.type : '?',
        pos: [+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)],
        rough: mats[0].roughness, metal: mats[0].metalness };
      out.push(seen[key]);
    });
    return JSON.stringify({ box: box, hits: out.sort(function(a,b){return b.n-a.n;}) });
  })()`;
  const r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
  console.log(JSON.stringify(JSON.parse(r.result.result.value), null, 2));
  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
