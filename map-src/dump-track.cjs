const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9631;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=800,600', '--user-data-dir=' + path.resolve('.cdp-trk'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0; const pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(10000);
  const P = `(function(){
    function byName(n){var st=window.__CAMP.stage();for(var i=0;i<st.children.length;i++)if(st.children[i].name===n)return st.children[i];return null;}
    var trk=byName('track');
    var out={};
    var surf=null, block=null;
    trk.traverse(function(o){
      if(!surf && o.isMesh && o.material && o.material.map) surf=o;
      if(!block && o.isMesh && Array.isArray(o.material)) block=o;
    });
    out.hasSurf = !!surf;
    if(surf){
      var im=surf.material.map.image;
      out.mapSize = im.width+'x'+im.height;
      var c=document.createElement('canvas'); c.width=6; c.height=6;
      var x=c.getContext('2d'); x.drawImage(im,0,0,6,6);
      var d=x.getImageData(0,0,6,6).data, px=[];
      for(var i=0;i<6;i++) px.push([d[i*24],d[i*24+1],d[i*24+2]].join(','));
      out.sample=px;
      out.surfPos = [surf.position.x.toFixed(1), surf.position.y.toFixed(2), surf.position.z.toFixed(1)];
      out.surfSize = [surf.geometry.parameters.width.toFixed(1), surf.geometry.parameters.height.toFixed(1)];
      // 导出缩略图 base64
      var big=document.createElement('canvas'); big.width=256; big.height=256;
      big.getContext('2d').drawImage(im,0,0,256,256);
      out.thumb = big.toDataURL('image/png');
    }
    out.track = {px:CAMP_TRACK.px,py:CAMP_TRACK.py,L:CAMP_TRACK.L,W:CAMP_TRACK.W};
    return JSON.stringify(out);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  const v = r.result.result.value;
  if(!v){ console.log(JSON.stringify(r.result).slice(0,300)); child.kill(); return; }
  const d = JSON.parse(v);
  if(d.thumb && d.thumb.length>100){ fs.writeFileSync('track-tex.png', Buffer.from(d.thumb.split(',')[1],'base64')); }
  delete d.thumb;
  console.log(JSON.stringify(d, null, 1));
  child.kill();
})();
