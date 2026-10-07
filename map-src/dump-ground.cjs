/* 把地面 CanvasTexture 的画布原样导出成 PNG —— 直接回答"贴图本身是不是黑的" */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9535;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1440,960', '--user-data-dir=' + path.resolve('.cdp-tex'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0, pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(9000);
  const P = `(function(){
    var stage = window.__CAMP.stage();
    var g = stage.children[1];            /* campGround */
    var out = [];
    g.traverse(function(o){
      if(o.isMesh && o.material && o.material.map && o.material.map.image){
        var im = o.material.map.image;
        /* 采样若干点看是不是黑 */
        var c = document.createElement('canvas');
        c.width = 8; c.height = 8;
        var cx2 = c.getContext('2d');
        cx2.drawImage(im, 0, 0, 8, 8);
        var d = cx2.getImageData(0,0,8,8).data;
        var px = [];
        for(var i=0;i<8;i++) px.push([d[i*32],d[i*32+1],d[i*32+2]].join(','));
        out.push({w: im.width, h: im.height, sample: px});
      }
    });
    return JSON.stringify(out);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log(r.result && r.result.result && r.result.result.value);

  // 导出原尺寸（缩小到 1024 以内便于查看）
  const P2 = `(function(){
    var stage = window.__CAMP.stage();
    var g = stage.children[1];
    var res = null;
    g.traverse(function(o){
      if(res) return;
      if(o.isMesh && o.material && o.material.map && o.material.map.image){
        var im = o.material.map.image;
        var c = document.createElement('canvas');
        c.width = 1024; c.height = 1024;
        c.getContext('2d').drawImage(im, 0, 0, 1024, 1024);
        res = c.toDataURL('image/png');
      }
    });
    return res;
  })()`;
  const r2 = await send('Runtime.evaluate', { expression: P2, returnByValue: true });
  const d = r2.result && r2.result.result && r2.result.result.value;
  if (d && d.length > 100) {
    fs.writeFileSync('ground-tex.png', Buffer.from(d.split(',')[1], 'base64'));
    console.log('saved ground-tex.png');
  } else {
    console.log('no texture found');
  }
  child.kill();
})();
