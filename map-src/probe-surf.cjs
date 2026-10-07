const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9633;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=800,600', '--user-data-dir=' + path.resolve('.cdp-srf'), html], { stdio: 'ignore' });
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
    var surf=null, block=null;
    trk.traverse(function(o){
      if(!surf && o.isMesh && o.geometry.type==='PlaneGeometry') surf=o;
      if(!block && o.isMesh && o.geometry.type==='BoxGeometry' && o.material.length) block=o;
    });
    function wpos(o){ var p=new THREE.Vector3(); o.getWorldPosition(p); return [p.x.toFixed(1),p.y.toFixed(2),p.z.toFixed(1)]; }
    var out={};
    out.trackGroup = { pos: wpos(trk), visible: trk.visible, childCount: trk.children.length };
    if(surf){
      out.surf = { pos: wpos(surf), visible: surf.visible,
        matColor: '#'+surf.material.color.getHexString(),
        hasMap: !!surf.material.map,
        mapImage: surf.material.map && surf.material.map.image ? surf.material.map.image.width+'x'+surf.material.map.image.height : 'NONE',
        mapNeedsUpdate: surf.material.map ? surf.material.map.needsUpdate : null,
        geometrySize: [surf.geometry.parameters.width, surf.geometry.parameters.height] };
    }
    if(block){
      out.block = { pos: wpos(block), visible: block.visible,
        topMat: block.material[2] ? '#'+block.material[2].color.getHexString() : 'none' };
    }
    // 相机信息
    var cam = (window.__CAMP.camera)||window.__CAMP.cam;
    out.camera = cam ? {pos:[cam.position.x.toFixed(1),cam.position.y.toFixed(1),cam.position.z.toFixed(1)]} : null;
    return JSON.stringify(out);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log(r.result.result.value || JSON.stringify(r.result).slice(0,400));
  child.kill();
})();
