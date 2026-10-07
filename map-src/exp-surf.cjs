const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9634;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1400,1000', '--user-data-dir=' + path.resolve('.cdp-exp'), html+'?view=plan'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0; const pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(10000);
  // 把 surf 材质改成纯红
  const P = `(function(){
    function byName(n){var st=window.__CAMP.stage();for(var i=0;i<st.children.length;i++)if(st.children[i].name===n)return st.children[i];return null;}
    var trk=byName('track'), surf=null;
    trk.traverse(function(o){ if(!surf && o.isMesh && o.geometry.type==='PlaneGeometry') surf=o; });
    if(surf){ surf.material.map=null; surf.material.color.setHex(0xFF0000); surf.material.needsUpdate=true; }
    return surf ? 'ok' : 'no surf';
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log('改材质:', r.result.result.value);
  await sleep(2000);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('exp-red.png', Buffer.from(shot.result.data, 'base64'));
  console.log('截图已存');
  child.kill();
})();
