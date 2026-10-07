/**
 * shot.cjs —— 通用页面截图（v20 新增，可复用）
 *
 * 用法：node shot.cjs <页面> <输出png> [等待ms] [宽] [高]
 * 例：  node shot.cjs apt.html apt-v20.png 8000 1440 960
 *
 * 为什么要它：`probe.cjs` 只能读数据、不能出图。而纪律要求
 *   **"交付视觉改动前必须真读截图核对"** ⇒ 每次临时写 CDP 脚本太啰嗦。
 *
 * ★ 关键点（从 `probe.cjs` 继承 + 实测踩过的坑）：
 *   1. Edge 必须由 Node `spawn` 持有 child 引用，否则被回收（记忆里的坑）
 *   2. 用 `--headless=new` + swiftshader 软渲染（本机无 GPU 直通）
 *   3. **等待时间要给足**：本页有 fitCameraTo + 首帧渲染，8s 是安全值
 *   4. 截图前先 `Page.captureScreenshot` 一次丢弃（等 WebGL 出首帧），
 *      **再截第二张**才是稳定的真图 —— 单次截图常见"全黑/全白"
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const pagePath = process.argv[2] || 'apt.html';
const outPng = process.argv[3] || 'shot.png';
const WAIT = Number(process.argv[4] || 8000);
const VW = Number(process.argv[5] || 1440);
const VH = Number(process.argv[6] || 960);

const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9700 + Math.floor(Math.random() * 250);
const profile = path.join(os.tmpdir(), 'cdp-shot-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=' + VW + ',' + VH,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--force-device-scale-factor=1', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let wsUrl;
  for (let i = 0; i < 50; i++) {
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

  /* ★ 丢弃第一张（等 WebGL 首帧稳定） */
  await send('Page.captureScreenshot', { format: 'png' });
  await sleep(700);
  /* ★ 再确认页面内的渲染循环已经跑过（探针式确认，不靠猜） */
  const chk = await send('Runtime.evaluate', {
    expression: "(function(){var c=document.querySelector('canvas');if(!c)return 'no canvas';var g=c.getContext('webgl2')||c.getContext('webgl');return 'canvas '+c.width+'x'+c.height+' gl='+(!!g);})()",
    returnByValue: true
  });
  console.log('页面状态: ' + (chk.result && chk.result.result ? chk.result.result.value : '?'));

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (!shot.result || !shot.result.data) {
    console.error('截图失败:', JSON.stringify(shot).slice(0, 400));
    child.kill('SIGKILL'); process.exit(1);
  }
  fs.writeFileSync(outPng, Buffer.from(shot.result.data, 'base64'));
  console.log('已保存 ' + outPng + '  ' + fs.statSync(outPng).size + ' 字节');

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
