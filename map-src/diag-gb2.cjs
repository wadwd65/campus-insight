/* 地面发黑：单变量对照 + 数值取证
   ① 正常加载 vs __NO_TUFT=1（关掉草簇层）→ 地面像素对比
   ② 地面 canvas 本体采样
   ③ InstancedMesh 的 instanceMatrix 是否有 NaN */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

function session(port, userDir, preScript) {
  return new Promise(async (resolve) => {
    const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + port, '--window-size=900,600', '--user-data-dir=' + path.resolve(userDir), html], { stdio: 'ignore' });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let ws, id = 0; const pend = new Map();
    const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
    await new Promise(r => ws.addEventListener('open', r));
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    await send('Runtime.enable');
    if (preScript) await send('Page.addScriptToEvaluateOnNewDocument', { source: preScript });
    await send('Page.enable');
    await send('Page.reload', { ignoreCache: true });
    await sleep(10000);
    resolve({ send, kill: () => child.kill() });
  });
}

/* 在页面里取"画面中心偏下一点"的像素（那是地面）*/
const READ_PIX = `(function(){
  var cv=document.querySelector('canvas');
  var g=cv.getContext('webgl2')||cv.getContext('webgl');
  return 'canvas '+cv.width+'x'+cv.height+' gl='+!!g;
})()`;

(async () => {
  // ── A：正常
  const A = await session(9551, '.cdp-a1', null);
  const ra = await A.send('Runtime.evaluate', { expression: READ_PIX, returnByValue: true });
  console.log('A(normal):', ra.result.result.value);
  const shotA = await A.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('gb-A-normal.png', Buffer.from(shotA.result.data, 'base64'));
  A.kill();

  // ── B：关草簇
  const B = await session(9552, '.cdp-b1', 'window.__NO_TUFT=1;');
  const rb = await B.send('Runtime.evaluate', { expression: READ_PIX, returnByValue: true });
  console.log('B(noTuft):', rb.result.result.value);
  const shotB = await B.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('gb-B-notuft.png', Buffer.from(shotB.result.data, 'base64'));
  B.kill();

  // ── C：地面 canvas 本体 + NaN 检查
  const C = await session(9553, '.cdp-c1', null);
  const P = `(function(){
    var out={};
    var cv=window.__CAMP_GROUND_CV;
    out.hasCV = !!cv;
    if(cv){
      out.size = cv.width+'x'+cv.height;
      var c=document.createElement('canvas'); c.width=8;c.height=8;
      var x=c.getContext('2d'); x.drawImage(cv,0,0,8,8);
      var d=x.getImageData(0,0,8,8).data, px=[];
      for(var i=0;i<8;i++) px.push(d[i*32]+','+d[i*32+1]+','+d[i*32+2]);
      out.px=px;
    }
    var stage=window.__CAMP.stage(), nan=0, tot=0, inst=[];
    stage.traverse(function(o){
      if(o.isInstancedMesh){
        var m=o.instanceMatrix.array, n=0;
        for(var i=0;i<m.length;i++){ if(!isFinite(m[i])) n++; }
        nan+=n; tot++;
        inst.push({count:o.count, cap:o.instanceMatrix.count, nan:n,
          mat:'#'+(o.material.color?o.material.color.getHexString():'-')});
      }
    });
    out.inst=inst; out.nanTotal=nan;
    /* 灯光与地面材质 */
    var gm=null;
    stage.traverse(function(o){ if(o.isMesh&&o.geometry&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters.width===720) gm=o.material; });
    if(gm){ out.gmat={rough:gm.roughness, metal:gm.metalness, col:'#'+gm.color.getHexString(), mapImg: gm.map&&gm.map.image? gm.map.image.width+'x'+gm.map.image.height : 'NONE'}; }
    return JSON.stringify(out);
  })()`;
  const rc = await C.send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log('C(probe):', rc.result.result.value || JSON.stringify(rc.result).slice(0, 500));
  C.kill();
})();
