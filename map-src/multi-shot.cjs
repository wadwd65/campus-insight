/* multi-shot.cjs —— 一次起浏览器、多视角连拍（campus.html?view=xxx）
   用法：node multi-shot.cjs campus.html out-prefix 等待ms view1,view2,... */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));
const pagePath = process.argv[2] || 'campus.html';
const prefix = process.argv[3] || 'ra';
const WAIT = Number(process.argv[4] || 25000);
const views = (process.argv[5] || 'lake,gate,plan').split(',');
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9700 + Math.floor(Math.random() * 250);
const profile = path.join(os.tmpdir(), 'cdp-ms-' + Date.now());
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  fileUrl + '?view=' + views[0]
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
      await send('Page.enable');
      /* 首个视角已随 URL 加载并等待完毕，直接拍 */
      for (var v = 0; v < views.length; v++) {
        if (v > 0) {
          await send('Runtime.evaluate', { expression: 'window.__CAMP.view("' + views[v] + '")' });
          await new Promise(r => setTimeout(r, 2500));   /* 等两帧稳定 */
        }
        await send('Page.captureScreenshot', { format: 'png' });   /* 丢弃首帧 */
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const fn = prefix + '-' + views[v] + '.png';
        fs.writeFileSync(fn, Buffer.from(shot.data, 'base64'));
        console.log('saved', fn);
      }
      /* 顺带探针：树/楼数量 + RA 就绪 */
      const st = await send('Runtime.evaluate', {
        expression: 'JSON.stringify(window.__CAMP.stat())', returnByValue: true });
      console.log('stat:', st.result.value);
      ws.close(); child.kill(); process.exit(0);
    };
  } catch (e) { console.log('ERR', e.message); child.kill(); process.exit(1); }
}, WAIT);
