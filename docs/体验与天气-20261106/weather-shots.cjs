/* 天气系统验证：逐档切换 + 读真实渲染参数 + 过渡连续帧 + 截图 */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const URL = process.argv[2], OUT = process.argv[3];
if (!URL || !OUT) throw new Error('用法: node weather-shots.cjs <url> <outDir>');
fs.mkdirSync(OUT, { recursive: true });
const VW = 1500, VH = 940, sleep = ms => new Promise(r => setTimeout(r, ms));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const PORT = 9700 + Math.floor(Math.random() * 250);
const profile = path.join(os.tmpdir(), 'cdp-weather-' + Date.now());
(async () => {
  const child = spawn(EDGE, ['--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, '--window-size=' + VW + ',' + VH,
    '--hide-scrollbars', '--no-first-run', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = l.find(t => t.type === 'page' && t.webSocketDebuggerUrl); if (p) wsUrl = p.webSocketDebuggerUrl; } catch (e) { }
    if (!wsUrl) await sleep(300);
  }
  if (!wsUrl) { child.kill('SIGKILL'); throw new Error('no CDP'); }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 1; const pending = new Map(), errors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(String(m.params.exceptionDetails.text || '').slice(0, 140));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description || '').join(' ').slice(0, 140));
  });
  const send = (method, params = {}) => new Promise(res => { const n = id++; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
  const js = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : null; };
  const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); if (r.result && r.result.data) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); };
  const readState = `(()=>{
    const sc=window.__scene;if(!sc)return JSON.stringify({error:'no scene'});
    let sunI=null,sunC=null,hemi=null,fog=null;
    sc.traverse(o=>{if(o.isDirectionalLight&&o.intensity>0&&sunI===null){sunI=+o.intensity.toFixed(3);sunC=o.color.getHexString();}
      if(o.isHemisphereLight&&hemi===null)hemi=+o.intensity.toFixed(3);});
    if(sc.fog)fog={color:sc.fog.color.getHexString(),density:+sc.fog.density.toFixed(6)};
    const v=document.querySelector('.viewport');
    return JSON.stringify({sunI,sunC,hemi,fog,skyTop:v&&v.style.getPropertyValue('--sky-top'),
      label:document.getElementById('light-name')&&document.getElementById('light-name').textContent,
      shadow:document.getElementById('runtime')&&document.getElementById('runtime').dataset.shadowOpacity});
  })()`;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL }); await sleep(7000);

  const results = [];
  const modes = ['daylight', 'partly', 'overcast', 'golden', 'dusk'];
  for (const m of modes) {
    await js(`(()=>{const e=document.getElementById('lighting');e.value=${JSON.stringify(m)};e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`);
    await sleep(1050);
    const st = await js(readState);
    await shot('weather-' + m);
    results.push({ mode: m, state: JSON.parse(st || '{}') });
    console.log('  ·', m, st);
  }
  /* 过渡连续帧：从 dusk 切回 daylight，逐帧读太阳强度 */
  await js(`(()=>{const e=document.getElementById('lighting');e.value='daylight';e.dispatchEvent(new Event('change',{bubbles:true}));return 1;})()`);
  const tween = [];
  for (let i = 0; i < 7; i++) {
    const st = JSON.parse(await js(readState) || '{}');
    tween.push({ t: i * 130, sunI: st.sunI });
    await sleep(130);
  }
  /* 太阳滑块联动：改角度后影子应重烘焙 */
  const before = await js(`(()=>{const r=document.getElementById('runtime');return r?r.dataset.shadowBakes:null;})()`);
  await js(`(()=>{const e=document.getElementById('sun');e.value=160;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`);
  await sleep(700);
  const after = await js(`(()=>{const r=document.getElementById('runtime');return r?r.dataset.shadowBakes:null;})()`);
  await shot('sun-160');
  const out = { url: URL, results, tween, shadowBakes: { before, after }, errors, errorCount: errors.length };
  fs.writeFileSync(path.join(OUT, 'weather.json'), JSON.stringify(out, null, 2));
  console.log('--- 过渡 sunI:', JSON.stringify(tween));
  console.log('--- 阴影烘焙:', JSON.stringify(out.shadowBakes), '异常:', errors.length);
  ws.close(); child.kill('SIGKILL');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
