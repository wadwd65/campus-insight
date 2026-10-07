/* 找一盏路灯 + 一条长椅的世界坐标，供特写机位使用 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9581;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=800,600', '--user-data-dir=' + path.resolve('.cdp-fu'), html], { stdio: 'ignore' });
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
    var f=byName('furniture');
    var box=new THREE.Box3(), lamps=[], benches=[];
    f.children.forEach(function(o,i){
      box.setFromObject(o);
      if(box.isEmpty()) return;
      var c=box.getCenter(new THREE.Vector3());
      var h=box.max.y;
      (h>4? lamps:benches).push({i:i, x:+c.x.toFixed(1), z:+c.z.toFixed(1), h:+h.toFixed(1)});
    });
    /* 挑一处"附近有树、有路"的灯做机位 */
    lamps.sort(function(a,b){return (Math.abs(a.x+100)+Math.abs(a.z-150)) - (Math.abs(b.x+100)+Math.abs(b.z-150));});
    return JSON.stringify({lamp:lamps[0], lamps:lamps.length, benches:benches.length, all:lamps.slice(0,3)});
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log(r.result.result.value);
  child.kill();
})();
