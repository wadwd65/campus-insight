/* 自动完整体验：逐项操作 3D 场景控件与交互，收集 console 异常、状态与截图。
 * 用法：node walkthrough.cjs <url> <outDir>
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const URL = process.argv[2], OUT = process.argv[3];
if (!URL || !OUT) throw new Error('用法: node walkthrough.cjs <url> <outDir>');
fs.mkdirSync(OUT, { recursive: true });
const VW = 1500, VH = 940;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const PORT = 9700 + Math.floor(Math.random() * 250);
const profile = path.join(os.tmpdir(), 'cdp-walk-' + Date.now());

(async () => {
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--window-size=' + VW + ',' + VH, '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required', 'about:blank'
  ], { stdio: 'ignore' });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl); if (p) wsUrl = p.webSocketDebuggerUrl; } catch (e) { }
    if (!wsUrl) await sleep(300);
  }
  if (!wsUrl) { child.kill('SIGKILL'); throw new Error('no CDP'); }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 1; const pending = new Map(); const errors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + String(m.params.exceptionDetails.text || '').slice(0, 140));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('LOG ' + m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 140));
  });
  const send = (method, params = {}) => new Promise(res => { const n = id++; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
  const js = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) errors.push('EVAL ' + String(r.result.exceptionDetails.text).slice(0, 140));
    return r.result && r.result.result ? r.result.result.value : null;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(7000);

  const steps = [];
  async function step(name, action, waitMs = 900, shot = false) {
    let result = null;
    try { result = await js(action); } catch (e) { result = 'ERR ' + e.message; }
    await sleep(waitMs);
    if (shot) {
      const s = await send('Page.captureScreenshot', { format: 'png' });
      if (s.result && s.result.data) fs.writeFileSync(path.join(OUT, name.replace(/[^\w\u4e00-\u9fa5]/g, '_') + '.png'), Buffer.from(s.result.data, 'base64'));
    }
    const state = await js(`(()=>{const r=document.getElementById('runtime');if(!r)return null;const d=r.dataset;return JSON.stringify({mode:d.playMode,frames:d.frames,quality:d.quality,fps:d.fps,calls:d.calls,triangles:d.triangles,waterMode:d.waterMode,shadowOn:d.shadowOn});})()`);
    steps.push({ name, result: typeof result === 'string' ? result.slice(0, 160) : result, state });
    console.log('  ·', name, '→', String(result).slice(0, 90));
  }
  const click = sel => `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'MISSING';e.click();return 'ok';})()`;
  const setSel = (sel, v) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'MISSING';e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`;
  const setRange = (sel, v) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'MISSING';e.value=${v};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`;

  await step('01-默认俯视加载', `(()=>{const r=document.getElementById('runtime');return r?r.dataset.playMode:'no runtime';})()`, 300, true);
  await step('02-画质切low', setSel('#quality', 'low'), 800);
  await step('03-画质切high', setSel('#quality', 'high'), 800);
  await step('04-光照切golden', setSel('#lighting', 'golden'), 900, true);
  await step('05-光照回daylight', setSel('#lighting', 'daylight'), 900);
  await step('06-太阳角度滑块', setRange('#sun', 135), 900, true);
  await step('07-太阳角度复位', setRange('#sun', 45), 700);
  await step('08-阴影开关往返', `(()=>{const e=document.getElementById('shade');if(!e)return 'MISSING';e.click();e.click();return 'ok';})()`, 700);
  await step('09-水面开关往返', `(()=>{const e=document.getElementById('water-motion');if(!e)return 'MISSING';e.click();e.click();return 'ok';})()`, 700);
  await step('10-地点标记往返', `(()=>{const e=document.getElementById('labels');if(!e)return 'MISSING';e.click();e.click();return 'ok';})()`, 700);
  await step('11-预设教学街区', click('[data-preset="teaching"]'), 1100, true);
  await step('12-预设生活院落', click('[data-preset="dorm"]'), 1100, true);
  await step('13-预设俯瞰核对', click('[data-preset="plan"]'), 1100);
  await step('14-地点选择器教学楼一', `(()=>{const s=document.getElementById('place-picker');if(!s)return 'MISSING';const o=[...s.options].find(x=>x.textContent.includes('教学楼一'));if(!o)return 'NO OPTION';s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));return o.value;})()`, 1200, true);
  await step('15-自动环绕开关', `(()=>{const e=document.getElementById('auto');if(!e)return 'MISSING';e.click();return 'on';})()`, 900);
  await step('16-关闭自动环绕', click('#auto'), 600);
  await step('17-进入第一人称步行', click('#walk-toggle'), 1400, true);
  await step('18-步行W前进', `(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',code:'KeyW'}));return 'down';})()`, 700);
  await step('19-步行停止', `(()=>{window.dispatchEvent(new KeyboardEvent('keyup',{key:'w',code:'KeyW'}));return 'up';})()`, 500);
  await step('20-切第三人称人物', click('#view-toggle'), 900, true);
  await step('21-回第一人称', click('#view-toggle'), 700);
  await step('22-退出步行', click('#walk-toggle'), 800);
  await step('23-开小车', click('#drive-toggle'), 1400, true);
  await step('24-切跟车视角', click('#view-toggle'), 900, true);
  await step('25-下车', click('#drive-toggle'), 900);
  await step('26-退出漫游', click('#walk-toggle'), 800);
  await step('27-最终俯视状态', `(()=>{const r=document.getElementById('runtime');return r?r.dataset.playMode:'no runtime';})()`, 300, true);

  const report = { url: URL, steps, errors, errorCount: errors.length };
  fs.writeFileSync(path.join(OUT, 'walkthrough.json'), JSON.stringify(report, null, 2));
  console.log('---');
  console.log('步骤', steps.length, '异常', errors.length);
  if (errors.length) console.log(errors.slice(0, 12).join('\n'));
  ws.close(); child.kill('SIGKILL');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
