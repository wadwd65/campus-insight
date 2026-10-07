/**
 * v16d 场地实体审计：把「树/灌木/步道是否真在场景里、在哪、多大」
 * 变成可断言的数字。
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
const PORT = 9500 + Math.floor(Math.random() * 200);
const profile = path.join(require('os').tmpdir(), 'cdp-yard-' + Date.now());

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
  await sleep(4500);

  const q = `
  (function(){
    var T = window.__three, s = T.scene;
    /* 相机视锥（世界尺度）—— 判断"什么东西会跑出画面" */
    var cam = T.camera;
    var out = { frustum: { l: cam.left, r: cam.right, t: cam.top, b: cam.bottom } };

    /* 分类统计院子里的构件 */
    var stat = { trunk:0, crown:0, pot:0, shrub:0, walkPlane:0, walkRing:0, curb:0, other:0 };
    var far = [];   /* 超出某个半径的东西 */
    var crowns = [];
    s.traverse(function(o){
      if (!o.isMesh) return;
      var ud = o.userData || {};
      if (!ud.noFrame) return;
      var g = o.geometry, t = g ? g.type : '?';
      var p = o.position;
      var wp = new T.THREE.Vector3(); o.getWorldPosition(wp);
      var rad = Math.hypot(wp.x, wp.z + 4);
      if (t === 'CylinderGeometry') stat.trunk++;
      else if (t === 'SphereGeometry') {
        var pr = g.parameters.radius;
        if (pr > 0.9) { stat.crown++; crowns.push([Math.round(wp.x), Math.round(wp.z), +pr.toFixed(2)]); }
        else stat.shrub++;
      }
      else if (t === 'BoxGeometry') stat.pot++;
      else if (t === 'PlaneGeometry') stat.walkPlane++;
      else if (t === 'RingGeometry') stat.walkRing++;
      else stat.other++;
      if (rad > 70) far.push([t, Math.round(wp.x), Math.round(wp.z), Math.round(rad)]);
      /* 只统计院子装饰（不在三栋楼内部的）*/
    });
    out.stat = stat;
    out.farCount = far.length;
    out.farSample = far.slice(0, 14);
    out.crownSample = crowns.slice(0, 8);
    out.crownCount = crowns.length;
    /* 场景总统计 */
    var tri = 0, mesh = 0;
    s.traverse(function(o){ if(o.isMesh){ mesh++;
      var g2=o.geometry; if(g2.index) tri+=g2.index.count/3; else if(g2.attributes.position) tri+=g2.attributes.position.count/3; }});
    out.total = { mesh: mesh, tri: Math.round(tri) };
    /* 取景包围盒（重算一遍，看有没有被装饰物撑到）*/
    return JSON.stringify(out);
  })()
  `;
  const r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
  console.log(JSON.stringify(JSON.parse(r.result.result.value), null, 2));

  ws.close();
  child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
