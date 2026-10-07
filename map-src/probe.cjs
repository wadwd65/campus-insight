/**
 * probe.cjs —— 通用页面内探针（v18 新增）
 *
 * 用法：  node probe.cjs <页面> <js表达式文件>
 * 例：    node probe.cjs tower.html probe-paving.js
 *
 * 为什么要它：§2「永远不要靠截图上"看不见"下结论」——
 *   写个页面内探测表达式把子对象的 geometry.type / material.color /
 *   position / scale / 世界包围盒 打出来。
 *   每次临时写一个 CDP 脚本太啰嗦，做成通用壳。
 *
 * 表达式文件里直接写 IIFE，返回值需是字符串（推荐 JSON.stringify）。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const pagePath = process.argv[2] || 'tower.html';
const exprFile = process.argv[3];
if (!exprFile) { console.error('用法: node probe.cjs <页面> <表达式文件>'); process.exit(2); }

const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9800 + Math.floor(Math.random() * 190);
const profile = path.join(require('os').tmpdir(), 'cdp-probe-' + Date.now());
const WAIT = Number(process.argv[4] || 5200);

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const PROBE = fs.readFileSync(exprFile, 'utf8');

(async () => {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch (e) {}
    await sleep(300);
  }
  if (!wsUrl) { console.error('no target'); child.kill('SIGKILL'); process.exit(1); }

  const ws = new WebSocket(wsUrl);
  let id = 1; const pending = new Map();
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const myId = id++; pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });

  await send('Runtime.enable'); await send('Page.enable');
  await sleep(WAIT);

  const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true, timeout: 120000 });
  if (!r.result) { console.error('无结果:', JSON.stringify(r).slice(0, 500)); }
  else if (r.result.exceptionDetails) {
    console.error('页面内异常:', JSON.stringify(r.result.exceptionDetails).slice(0, 800));
  } else {
    console.log(r.result.result && r.result.result.value !== undefined
      ? r.result.result.value : JSON.stringify(r.result, null, 2));
  }

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
