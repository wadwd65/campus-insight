/* probe-lake.cjs —— 实测湖组渲染 bbox 中心（验证 ShapeGeometry 镜像坑）*/
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
const profile = path.join(os.tmpdir(), 'cdp-lk-' + Date.now());
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
        expression: [
          '(function(){',
          '  var st=window.__CAMP.stage(), lake=null;',
          '  for(var i=0;i<st.children.length;i++) if(st.children[i].name==="lake") lake=st.children[i];',
          '  var bb=new THREE.Box3().setFromObject(lake);',
          '  var c=new THREE.Vector3(); bb.getCenter(c);',
          '  return "rendered lake center=(" + c.x.toFixed(1) + "," + c.z.toFixed(1) + ") expect=(-28.0,+17.5)";',
          '})()'
        ].join('\n'), returnByValue: true
      });
      console.log(r.result.value || JSON.stringify(r.result));
      ws.close(); child.kill(); process.exit(0);
    };
  } catch (e) { console.log('ERR', e.message); child.kill(); process.exit(1); }
}, 14000);
