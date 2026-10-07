/**
 * batch-shot.cjs —— 逐栋截图（v22 新增）
 *
 * 用法： node batch-shot.cjs [页面] [输出目录]
 * 例：   node batch-shot.cjs batch.html ../map-assets/batch-40
 *
 * 为什么单独写一个：`shot.cjs` 只截当前画面（一张）。
 * 本任务要 **40 张，每张一个建筑**，且每次都要"换建筑 → 重建 → 重渲 → 截"。
 *
 * ★ 关键点（全部来自本项目的实测坑）：
 *   1. Edge 必须由 Node `spawn` 持有 child 引用，否则被回收
 *   2. `buildOne` 之后**不能立刻截图** —— 渲染在 requestAnimationFrame 里，
 *      必须等**至少 2 帧**，否则拿到的是上一栋的画面（本项目在 vivid.cjs 踩过）
 *   3. 软渲染（swiftshader）下一帧可能 200~500ms，所以等待要按"帧"等而不是按毫秒等
 *   4. 截图前先丢一张（等 WebGL 出首帧）—— `shot.cjs` 同款处理
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const pagePath = process.argv[2] || 'batch.html';
const outDir = process.argv[3] || path.join('..', 'map-assets', 'batch-40');
/* ★ 可选第 4 参：只截指定的序号（逗号分隔）。
   用途：先冒烟测几种**新几何**（U 形楼 / 亭 / 拱壳 / 场地），
   确认没问题再全量跑 40 张 —— 避免"跑完 40 张才发现全错"。 */
const onlyArg = process.argv[4] || '';
const ONLY = onlyArg ? onlyArg.split(',').map(s => parseInt(s.trim(), 10)) : null;

const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9800 + Math.floor(Math.random() * 190);
const profile = path.join(require('os').tmpdir(), 'cdp-batch-' + Date.now());

fs.mkdirSync(outDir, { recursive: true });

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 页面内：建第 i 栋，等 3 帧，回传统计 */
const BUILD_FN = `
function(i) {
  return new Promise(function(resolve){
    var B = window.__BATCH;
    if (!B) return resolve({error:'no __BATCH'});
    var r;
    try { r = B.buildOne(i); }
    catch (e) { return resolve({error: 'buildOne 抛异常: ' + e.message}); }
    var n = 0;
    function tick(){
      n++;
      if (n < 3) return requestAnimationFrame(tick);
      /* 再多等一帧，确保阴影贴图也更新完 */
      requestAnimationFrame(function(){ resolve(r); });
    }
    requestAnimationFrame(tick);
  });
}
`;

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
  await sleep(8000);       // 等首帧 + 初始化

  const ev = await send('Runtime.evaluate', {
    expression: 'JSON.stringify((window.__BATCH && window.__BATCH.index) || null)',
    returnByValue: true
  });
  const idx = ev.result && ev.result.result && ev.result.result.value;
  if (!idx || idx === 'null') { console.error('__BATCH.index 读不到 —— 页面脚本可能报错'); child.kill('SIGKILL'); process.exit(1); }
  const index = JSON.parse(idx);
  console.log('清单 ' + index.length + ' 栋');

  /* 丢弃首张（等 WebGL 稳定）*/
  await send('Page.captureScreenshot', { format: 'png' });

  const manifest = [];
  let blankCount = 0;
  const todo = ONLY ? index.filter(x => ONLY.indexOf(x.i) >= 0) : index;
  console.log('本次要截 ' + todo.length + ' 栋');
  for (const item of todo) {
    const i = item.i;
    const r = await send('Runtime.evaluate', {
      expression: `(${BUILD_FN})(${i})`,
      awaitPromise: true, returnByValue: true, timeout: 60000
    });
    const stat = r.result && r.result.result && r.result.result.value;
    if (!stat || stat.error) {
      console.log('  !! ' + i + ' ' + item.id + ' → ' + JSON.stringify(stat));
      continue;
    }
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const b64 = shot.result && shot.result.data;
    if (!b64) { console.log('  !! ' + i + ' ' + item.id + ' 截图无数据'); continue; }
    const nn = String(i).padStart(2, '0');
    const fn = path.join(outDir, nn + '-' + item.id + '.png');
    fs.writeFileSync(fn, Buffer.from(b64, 'base64'));
    const bytes = fs.statSync(fn).size;
    const kb = (bytes / 1024).toFixed(0);
    /* ★★★ 常驻断言：单色图的 PNG 压缩后只有几 KB。
       判据 = 20KB。低于它几乎必然是"空画面 / 全天空"。
       起因：v22b 曾经把渲染循环漏掉，40 张全是 5KB 的纯天空蓝，
        而"看图"要一张一张看才发现 —— 体积断言能一次拦住。 */
    const blankWarn = bytes < 20 * 1024 ? '  ⚠⚠ 体积异常小（疑似空画面）' : '';
    console.log('  ✓ ' + nn + ' ' + item.id.padEnd(11) + ' mesh=' +
      String(stat.meshes).padStart(5) + ' 高=' + stat.height.toFixed(1) + '  ' + kb + 'KB' + blankWarn);
    if (blankWarn) blankCount++;
    manifest.push({
      i: i, id: item.id, name: item.name, batch: item.batch, note: item.note,
      file: nn + '-' + item.id + '.png',
      meshes: stat.meshes, size: stat.size, height: stat.height
    });
  }

  fs.writeFileSync(path.join(outDir, 'index.json'),
    JSON.stringify(manifest, null, 2), 'utf8');
  console.log('已写 ' + path.join(outDir, 'index.json') + '（' + manifest.length + ' 条）');
  if (blankCount) {
    console.log('!! 有 ' + blankCount + ' 张体积异常小 —— 请检查是否空画面（渲染循环 / 相机取景）');
  }

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
