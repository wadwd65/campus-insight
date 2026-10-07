/**
 * 单变量对照实验：草坪发白到底怪谁？
 * 固定相机，只改一个变量，量「草坪区绿像素明度」。
 * 对照项：
 *   base  原样
 *   hemi0 半球光 → 0
 *   sun0  太阳 → 0
 *   fill0 补光 → 0
 *   bounce0 反弹 → 0
 *   tone  toneMapping 关掉
 *   srgb  输出色彩空间改 Linear
 * 判据：改掉谁之后明度明显下降 ⇒ 就是它把草坪打白的。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const pagePath = process.argv[2] || 'tower.html';
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9600 + Math.floor(Math.random() * 300);
const profile = path.join(require('os').tmpdir(), 'cdp-lawn-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- 纯 Node 解 PNG（只取草坪环带区域） ----
function decodePng(buf) {
  let pos = 8, w = 0, h = 0, bd = 8, ct = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bd = data[8]; ct = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : 4;
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const line = raw.slice(p, p + stride); p += stride;
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += ((a + b) >> 1);
      else if (ft === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

/** 草坪环带（以 555,380 为心，半径 195~520）绿像素明度统计 */
function lawnStats(img) {
  const { w, h, ch, data } = img;
  const CX = 555, CY = 380;
  let n = 0, sum = 0, sum2 = 0, mx = 0, mn = 255;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const d = Math.hypot(x - CX, y - CY);
      if (d < 195 || d > 560) continue;
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (!(g > r + 6 && g > b + 6)) continue;   // 只要绿像素
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      n++; sum += lum; sum2 += lum * lum;
      if (lum > mx) mx = lum; if (lum < mn) mn = lum;
    }
  }
  if (!n) return null;
  const m = sum / n;
  return { n, mean: m, sd: Math.sqrt(sum2 / n - m * m), min: mn, max: mx };
}

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
  await sleep(4000);

  // 探测场景里有哪些光 + 渲染器设置
  const probe = await send('Runtime.evaluate', {
    expression: `(function(){
      var T = window.__three;
      if (!T) return JSON.stringify({err:'no __three'});
      var r = T.renderer, s = T.scene;
      return JSON.stringify({ lights: window.__lights(),
        tone: r.toneMapping, toneExp: r.toneMappingExposure,
        out: r.outputEncoding, gamma: r.gammaFactor,
        fog: s.fog ? {color:s.fog.color.getHexString(), near:s.fog.near, far:s.fog.far} : null });
    })()`, returnByValue: true
  });
  console.log('=== 场景探测 ===');
  console.log(probe.result && probe.result.result && probe.result.result.value);

  const VARIANTS = [
    ['base   原样',              ''],
    ['fog=null  雾关',           '__setFog(null)'],
    ['fog近=300 雾推远',         '__setFog(300,700)'],
    ['sun=0  太阳关',            '__setL("DirectionalLight",0)'],
    ['hemi=0 半球光关',          '__setL("HemisphereLight",0)'],
    ['all=0  全光关',            '__setL("DirectionalLight",0);__setL("HemisphereLight",0);__setL("AmbientLight",0)'],
    ['tone=NoTone',              '__three.renderer.toneMapping=0'],
    ['expo=0.55',                '__three.renderer.toneMappingExposure=0.55'],
  ];

  console.log('');
  console.log('%-22s %10s %8s %8s %6s %6s' , '变体', '绿像素数', '明度', '标准差', '最深', '最亮');
  for (const [name, expr] of VARIANTS) {
    if (expr) {
      const r = await send('Runtime.evaluate', { expression: `(function(){${expr};return 1;})()` });
      if (r.result && r.result.exceptionDetails) console.log('  !! ' + name + ' 执行异常 ' + JSON.stringify(r.result.exceptionDetails).slice(0,160));
    }
    await sleep(800);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (!shot.result || !shot.result.data) { console.log('  ' + name + ' 截图失败'); continue; }
    const img = decodePng(Buffer.from(shot.result.data, 'base64'));
    const st = lawnStats(img);
    if (st) {
      console.log('%-22s %10d %8.1f %8.1f %6.0f %6.0f', name, st.n, st.mean, st.sd, st.min, st.max);
    }
    // 复位：重新加载太慢，改为把关键设置还原
    await send('Runtime.evaluate', { expression: `(function(){
      __setFog(105,330,0xC6D2DE);
      __setL("DirectionalLight",1.05);
      __setL("HemisphereLight",0.58);
      __three.renderer.toneMapping=0; __three.renderer.toneMappingExposure=1;
    })()` });
  }

  ws.close();
  child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
