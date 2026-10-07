/* 地面发黑诊断：① 导出地面 canvas 缩略图 ② 列出所有贴近地面的大平面及其颜色 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9541;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1440,960', '--user-data-dir=' + path.resolve('.cdp-gd2'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0, pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(9000);

  const P1 = `(function(){
    var cv = window.__CAMP_GROUND_CV;
    if(!cv) return 'no __CAMP_GROUND_CV';
    var c=document.createElement('canvas'); c.width=6;c.height=6;
    var x=c.getContext('2d'); x.drawImage(cv,0,0,6,6);
    var d=x.getImageData(0,0,6,6).data, px=[];
    for(var i=0;i<6;i++) px.push([d[i*24],d[i*24+1],d[i*24+2]].join(','));
    return JSON.stringify({w:cv.width,h:cv.height,px:px});
  })()`;
  const r1 = await send('Runtime.evaluate', { expression: P1, returnByValue: true });
  console.log('GROUND_CANVAS:', r1.result.result.value);

  /* 导出缩略图 base64 */
  const P2 = `(function(){
    var cv = window.__CAMP_GROUND_CV; if(!cv) return '';
    var c=document.createElement('canvas'); c.width=900;c.height=900;
    c.getContext('2d').drawImage(cv,0,0,900,900);
    return c.toDataURL('image/png');
  })()`;
  const r2 = await send('Runtime.evaluate', { expression: P2, returnByValue: true });
  const d2 = r2.result.result.value;
  if (d2 && d2.length > 100) {
    fs.writeFileSync('ground-thumb.png', Buffer.from(d2.split(',')[1], 'base64'));
    console.log('saved ground-thumb.png');
  }

  /* 列出所有大平面（>200m 宽）与颜色 + y */
  const P3 = `(function(){
    var stage=window.__CAMP.stage(), out=[];
    stage.traverse(function(o){
      if(!o.isMesh||!o.geometry) return;
      var p=o.geometry.parameters;
      var w = p && (p.width||p.radiusX!==undefined?p.width:0) || 0;
      if(!w || w<200) return;
      var m=o.material||{};
      var col = m.color?('#'+m.color.getHexString()):'-';
      out.push({geo:o.geometry.type, w:w, y:+o.position.y.toFixed(2), col:col,
        hasMap: !!m.map, op:m.opacity, side:m.side, rough:m.roughness});
    });
    return JSON.stringify(out);
  })()`;
  const r3 = await send('Runtime.evaluate', { expression: P3, returnByValue: true });
  console.log('BIG_PLANES:', r3.result.result.value);
  child.kill();
})();
