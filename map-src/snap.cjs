/**
 * 用 Node spawn 持有 Edge 子进程，CDP 截图。
 * （坑：Git Bash 里起的 Edge 会被 shell 回收，必须 Node 持有 child 引用）
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

if (!EDGE) { console.error('Edge not found'); process.exit(1); }

const pagePath = process.argv[2];
const outPath = process.argv[3] || 'shot.png';
const waitMs = parseInt(process.argv[4] || '3500', 10);
const XPATH = process.argv[5] || '';

const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9333 + Math.floor(Math.random() * 300);
const profile = path.join(require('os').tmpdir(), 'cdp-prof-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile,
  '--window-size=1440,960',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  fileUrl
], { stdio: 'ignore', detached: false });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* retry */ }
    await sleep(300);
  }
  throw new Error('no devtools target');
}

(async () => {
  try {
    const wsUrl = await getWs();
    const ws = new WebSocket(wsUrl);
    let id = 1;
    const pending = new Map();
    const logs = [];

    await new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', rej);
    });

    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        logs.push('[' + msg.params.type + '] ' + msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        logs.push('[EXCEPTION] ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      }
    });

    const send = (method, params = {}) => new Promise(res => {
      const myId = id++;
      pending.set(myId, res);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });

    await send('Runtime.enable');
    await send('Page.enable');
    await sleep(waitMs);

    // 若指定了 xpath（如切场景），先点它
    if (XPATH) {
      await send('Runtime.evaluate', {
        expression: `(function(){var r=document.evaluate(${JSON.stringify(XPATH)},document,null,9,null).singleNodeValue; if(r) r.click();})()`
      });
      await sleep(1200);
    }

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (shot.result && shot.result.data) {
      fs.writeFileSync(outPath, Buffer.from(shot.result.data, 'base64'));
      console.log('SHOT ' + outPath + ' ' + fs.statSync(outPath).size + ' bytes');
    } else {
      console.error('no screenshot data', JSON.stringify(shot).slice(0, 300));
    }

    if (logs.length) {
      console.log('--- console ---');
      logs.slice(0, 25).forEach(l => console.log(l));
    } else {
      console.log('(console clean)');
    }

    ws.close();
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    try { child.kill('SIGKILL'); } catch (e) {}
    setTimeout(() => process.exit(0), 400);
  }
})();
