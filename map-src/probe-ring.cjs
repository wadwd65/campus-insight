const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9635;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=800,600', '--user-data-dir=' + path.resolve('.cdp-ring'), html], { stdio: 'ignore' });
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
    var out=[];
    trk.traverse(function(o){
      if(!o.isMesh) return;
      var geo=o.geometry;
      var vc = geo.attributes && geo.attributes.position ? geo.attributes.position.count : (geo.parameters? JSON.stringify(geo.parameters) : '?');
      out.push({type:geo.type, verts: vc, pos:[o.position.x.toFixed(1),o.position.y.toFixed(2),o.position.z.toFixed(1)], vis:o.visible});
    });
    return JSON.stringify(out);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log(r.result.result.value || JSON.stringify(r.result).slice(0,400));
  child.kill();
})();
