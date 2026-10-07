/* probe-dims.cjs —— 量出当前 campus.html 每栋建筑的真实 bbox（给真人资产缩放当目标尺寸）
   用法：node probe-dims.cjs campus.html */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const pagePath = process.argv[2] || 'campus.html';
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9700 + Math.floor(Math.random() * 250);
const profile = path.join(os.tmpdir(), 'cdp-dims-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=800,600', fileUrl
], { stdio: 'ignore' });

setTimeout(async () => {
  try {
    const list = await fetch('http://127.0.0.1:' + PORT + '/json').then(r => r.json());
    const page = list.find(t => t.url.includes('campus.html'));
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const send = (m, p) => new Promise(res => {
      const i = ++id;
      const h = e => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); res(d.result); } };
      ws.addEventListener('message', h);
      ws.send(JSON.stringify({ id: i, method: m, params: p || {} }));
    });
    ws.onopen = async () => {
      const r = await send('Runtime.evaluate', {
        expression: `(function(){
          var st = window.__CAMP.stage();
          var bld = null;
          for (var i=0;i<st.children.length;i++) if (st.children[i].name==='buildings') bld = st.children[i];
          if (!bld) return 'no buildings group';
          var out = [];
          bld.children.forEach(function(b, idx){
            var bb = new THREE.Box3().setFromObject(b);
            if (bb.isEmpty()) { out.push(idx+' EMPTY'); return; }
            var s = new THREE.Vector3(); bb.getSize(s);
            out.push([idx,
              'pos(' + b.position.x.toFixed(1) + ',' + b.position.z.toFixed(1) + ')',
              'W' + s.x.toFixed(1), 'H' + s.y.toFixed(1), 'D' + s.z.toFixed(1)].join(' '));
          });
          return out.join('\\n');
        })()`, returnByValue: true
      });
      console.log(r.result.value || JSON.stringify(r));
      ws.close(); child.kill(); process.exit(0);
    };
  } catch (e) { console.log('ERR', e.message); child.kill(); process.exit(1); }
}, 14000);
