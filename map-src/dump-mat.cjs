/* dump 地面 mesh 的完整材质信息 + 把贴图画布导出 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9537;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1440,960', '--user-data-dir=' + path.resolve('.cdp-mt'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0, pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(9000);
  const P = `(function(){
    var g = window.__CAMP.stage().children[1];
    var out = [];
    g.traverse(function(o){
      if(!o.isMesh) return;
      var m = o.material;
      out.push({
        type: m.type,
        color: m.color ? '#'+m.color.getHexString() : null,
        hasMap: !!m.map,
        mapType: m.map ? m.map.constructor.name : null,
        imgType: (m.map && m.map.image) ? m.map.image.constructor.name : null,
        imgW: (m.map && m.map.image) ? m.map.image.width : null,
        imgH: (m.map && m.map.image) ? m.map.image.height : null,
        encoding: m.encoding !== undefined ? m.encoding : null,
        y: o.position.y, rx: o.rotation.x.toFixed(3)
      });
    });
    return JSON.stringify(out);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  const v = r.result && r.result.result && r.result.result.value;
  console.log('MATERIAL:', v);
  // 用 renderer 读地面像素：把相机对准一块空草地，readPixels
  const P2 = `(function(){
    var g = window.__CAMP.stage().children[1];
    var im = window.__CAMP_GROUND_CV;
    if(!im) return 'no cv';
    var c = document.createElement('canvas');
    c.width = 900; c.height = 900;
    c.getContext('2d').drawImage(im, 0, 0, 900, 900);
    return c.toDataURL('image/png');
  })()`;
  const r2 = await send('Runtime.evaluate', { expression: P2, returnByValue: true });
  const d = r2.result && r2.result.result && r2.result.result.value;
  if (d && d.length > 200 && d.indexOf('data:image') === 0) {
    fs.writeFileSync('ground-tex.png', Buffer.from(d.split(',')[1], 'base64'));
    console.log('saved ground-tex.png');
  } else {
    console.log('dump failed:', String(d).slice(0, 120));
  }
  child.kill();
})();
