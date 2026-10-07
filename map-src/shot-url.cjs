/* shot-url.cjs —— 对 http 页面截图（含点击进场景）
   用法：node shot-url.cjs <url> <out.png> [waitMs] [clickSel] */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));
const url = process.argv[2];
const out = process.argv[3] || 'url-shot.png';
const WAIT = Number(process.argv[4] || 9000);
const CLICK = process.argv[5] || '';
const PORT = 9700 + Math.floor(Math.random() * 250);
const profile = path.join(os.tmpdir(), 'cdp-url-' + Date.now());
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960', url
], { stdio: 'ignore' });
setTimeout(async () => {
  try {
    const list = await fetch('http://127.0.0.1:' + PORT + '/json').then(r => r.json());
    const page = list.find(t => t.type === 'page' && t.url.startsWith('http'));
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
      if (CLICK) {
        const r = await send('Runtime.evaluate', {
          expression: "(function(){var el=document.querySelector('" + CLICK + "');" +
                      "if(!el) return 'no-el';el.click();return 'clicked';})()",
          returnByValue: true
        });
        console.log('click:', r.result.value);
        await new Promise(r2 => setTimeout(r2, 2500));
      }
      await send('Page.captureScreenshot', { format: 'png' });
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
      console.log('saved', out, fs.statSync(out).size);
      ws.close(); child.kill(); process.exit(0);
    };
  } catch (e) { console.log('ERR', e.message); child.kill(); process.exit(1); }
}, WAIT);
