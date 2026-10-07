const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9632;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=800,600', '--user-data-dir=' + path.resolve('.cdp-trk2'), html], { stdio: 'ignore' });
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
    var out=[]; var thumb='';
    trk.traverse(function(o){
      if(!o.isMesh) return;
      var info={geo:o.geometry.type, hasMap:false, mapImg:null};
      var m=o.material;
      if(m && m.map){
        info.hasMap=true;
        info.mapImg = m.map.image ? (m.map.image.width+'x'+m.map.image.height) : 'IMAGE-UNDEFINED';
        info.mapIsCanvas = m.map.image ? (m.map.image.tagName||m.map.image.constructor.name) : '-';
        if(m.map.image && !thumb){
          var c=document.createElement('canvas'); c.width=200; c.height=200;
          c.getContext('2d').drawImage(m.map.image,0,0,200,200);
          thumb=c.toDataURL('image/png');
        }
      }
      out.push(info);
    });
    var r={meshes:out};
    if(thumb) r.thumb=thumb;
    return JSON.stringify(r);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  const v = r.result.result.value;
  if(!v){ console.log(JSON.stringify(r.result).slice(0,400)); child.kill(); return; }
  const d = JSON.parse(v);
  if(d.thumb){ fs.writeFileSync('track-tex.png', Buffer.from(d.thumb.split(',')[1],'base64')); }
  console.log(JSON.stringify(d.meshes, null, 1));
  console.log('thumb saved:', !!d.thumb);
  child.kill();
})();
