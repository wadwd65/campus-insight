/* 掩膜诊断：把所有 mesh 涂黑、只把 campGround 地面涂白，量它真实可见像素。
   目的：判定"草地发黑"是地面自身被画黑，还是被草簇 InstancedMesh 盖住。 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9533;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1440,960', '--user-data-dir=' + path.resolve('.cdp-grd'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0, pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(9000);

  const PROBE = `(function(){
    var stage = window.__CAMP.stage();
    var subs = stage.children;
    var groundIdx = -1, tuftIdx = -1, furnIdx = -1;
    subs.forEach(function(c,i){
      c.traverse(function(o){
        if(o.isInstancedMesh && o.userData.noFrame) tuftIdx = i;
      });
    });
    subs.forEach(function(c,i){ if(i!==tuftIdx){ groundIdx=i; } });
    /* 存原材质，全部涂黑 */
    var saved = [];
    stage.traverse(function(o){
      if(o.isMesh || o.isInstancedMesh){
        saved.push([o, o.material]);
        o.material = new THREE.MeshBasicMaterial({color:0x000000});
      }
    });
    window.__SAVE = saved;
    return JSON.stringify({total: subs.length, tuftIdx: tuftIdx, groundIdx: groundIdx});
  })()`;
  const r1 = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
  console.log('stage:', r1.result && r1.result.result && r1.result.result.value);

  // 渲染一帧全黑（只有指定子组可见）
  const shot = async (keepIdx, out) => {
    const P = `(function(){
      var stage = window.__CAMP.stage();
      stage.children.forEach(function(c,i){
        c.visible = (i === ${keepIdx});
      });
      window.__three.renderer.render(window.__three.scene, window.__CAMP_CAM);
      return 'ok';
    })()`;
    await send('Runtime.evaluate', { expression: P, returnByValue: true });
    await sleep(1200);
    const S = await send('Page.captureScreenshot', { format: 'png' });
    if (S.result && S.result.data) {
      fs.writeFileSync(out, Buffer.from(S.result.data, 'base64'));
      console.log('saved', out);
    }
  };
  await send('Page.enable');
  // 地面：涂白，其余黑
  const P2 = `(function(){
    window.__SAVE.forEach(function(p){ p[0].material = new THREE.MeshBasicMaterial({color:0x000000}); });
    var stage = window.__CAMP.stage();
    stage.children[${'GROUND'}].traverse(function(o){
      if(o.isMesh) o.material = new THREE.MeshBasicMaterial({color:0xffffff});
    });
    return 'ok';
  })()`.replace('${\'GROUND\'}', '1');
  const r2 = await send('Runtime.evaluate', { expression: P2, returnByValue: true });
  console.log('ground paint:', r2.result && r2.result.result && r2.result.result.value);
  await sleep(800);
  const S1 = await send('Page.captureScreenshot', { format: 'png' });
  if (S1.result && S1.result.data) { fs.writeFileSync('mask-ground.png', Buffer.from(S1.result.data, 'base64')); console.log('saved mask-ground.png'); }
  child.kill();
})();
