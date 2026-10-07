/* 抓页面加载期的 JS 异常与 console.error —— 定位"贴图画一半就停"的真凶 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9561;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=900,600', '--user-data-dir=' + path.resolve('.cdp-err'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0; const pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  const logs = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push('EXCEPTION: ' + (d.exception && d.exception.description ? d.exception.description.split('\n').slice(0, 3).join(' | ') : d.text));
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const a = m.params.args.map(x => x.value !== undefined ? x.value : (x.description || x.type)).join(' ');
      logs.push('CONSOLE.' + m.params.type + ': ' + String(a).slice(0, 300));
    }
    if (m.method === 'Log.entryAdded') {
      logs.push('LOG.' + m.params.entry.level + ': ' + String(m.params.entry.text).slice(0, 300));
    }
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.reload', { ignoreCache: true });
  await sleep(12000);
  console.log('──── 页面日志 ────');
  logs.slice(0, 25).forEach(l => console.log(l));
  if (!logs.length) console.log('(无异常/无 console 输出)');
  child.kill();
})();
