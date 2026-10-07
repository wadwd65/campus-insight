/**
 * 量"太阳平行光阴影相机"需要覆盖多大 —— 用建筑群在世界空间沿
 * 光源方向的投影范围反推，避免猜 ±40/±52。
 * 做法：把场景所有 casting 物体的包围盒 8 角，投影到光源相机空间，
 * 取所需的 left/right/top/bottom（含余量）。
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
const PORT = 9400 + Math.floor(Math.random() * 90);
const profile = path.join(require('os').tmpdir(), 'cdp-sc-' + Date.now());
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
  await sleep(4800);

  const q = `(function(){
    var T = window.__three, THREE = T.THREE, s = T.scene;
    /* 找主太阳（最强的 DirectionalLight）*/
    var sun = null;
    s.traverse(function(o){ if(o.isDirectionalLight && o.castShadow && (!sun || o.intensity>sun.intensity)) sun = o; });
    if (!sun) return JSON.stringify({err:'no shadow light'});
    /* 所有 castShadow 物体的世界包围盒 */
    var box = new THREE.Box3(), tmp = new THREE.Box3();
    var nCast = 0;
    s.traverse(function(o){
      if (!o.isMesh || !o.castShadow) return;
      if (o.userData && o.userData.noFrame) return;   /* 院子装饰不算（它们投影但边界不重要）*/
      tmp.setFromObject(o); if (!tmp.isEmpty()) { box.union(tmp); nCast++; }
    });
    /* 也统计含装饰的范围 */
    var boxAll = new THREE.Box3(), tmp2 = new THREE.Box3();
    s.traverse(function(o){
      if (!o.isMesh || !o.castShadow) return;
      tmp2.setFromObject(o); if (!tmp2.isEmpty()) boxAll.union(tmp2);
    });
    /* 沿光源方向投影：把 8 角变到"光源相机空间" */
    var lp = sun.position.clone().normalize();
    var up = new THREE.Vector3(0,1,0);
    var right = new THREE.Vector3().crossVectors(up, lp).normalize();
    if (right.lengthSq() < 1e-6) right.set(1,0,0);
    var up2 = new THREE.Vector3().crossVectors(lp, right).normalize();
    function extent(b){
      var mx = 0, my = 0, mnx9 = 0;
      var p = new THREE.Vector3();
      var xr = [0,0], yr = [0,0], init = false;
      for (var i=0;i<8;i++){
        p.set((i&1)?b.max.x:b.min.x, (i&2)?b.max.y:b.min.y, (i&4)?b.max.z:b.min.z);
        var x = p.dot(right), y = p.dot(up2);
        if (!init){ xr=[x,x]; yr=[y,y]; init=true; }
        else { xr[0]=Math.min(xr[0],x); xr[1]=Math.max(xr[1],x); yr[0]=Math.min(yr[0],y); yr[1]=Math.max(yr[1],y); }
      }
      return { x: [ +xr[0].toFixed(1), +xr[1].toFixed(1) ], y: [ +yr[0].toFixed(1), +yr[1].toFixed(1) ] };
    }
    var eCore = extent(box), eAll = extent(boxAll);
    var sc = sun.shadow.camera;
    return JSON.stringify({
      light: { pos: [sun.position.x, sun.position.y, sun.position.z], intensity: sun.intensity },
      castShadowMeshes_core: nCast,
      boxCore: { min: box.min.toArray().map(function(v){return +v.toFixed(1);}),
                 max: box.max.toArray().map(function(v){return +v.toFixed(1);}) },
      boxAll: { min: boxAll.min.toArray().map(function(v){return +v.toFixed(1);}),
                max: boxAll.max.toArray().map(function(v){return +v.toFixed(1);}) },
      need_core: eCore,
      need_all: eAll,
      current: { l: sc.left, r: sc.right, t: sc.top, b: sc.bottom, near: sc.near, far: sc.far },
      radius: sun.shadow.radius, mapSize: sun.shadow.mapSize.x
    });
  })()`;
  const r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
  console.log(JSON.stringify(JSON.parse(r.result.result.value), null, 2));
  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
