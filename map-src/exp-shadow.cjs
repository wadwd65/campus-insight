/**
 * 阴影质量审计：把「阴影像一块硬边灰牛角」变成可量的指标。
 * 测：① 阴影区（灰、低饱和）占全图比例
 *     ② 阴影区内的明度标准差（越低越"死板"）
 *     ③ 阴影边界梯度（越高越"硬边"）
 *     ④ 阴影色相（是否偏蓝/偏暖 —— 真实阴影应偏冷）
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
const PORT = 9800 + Math.floor(Math.random() * 99);
const profile = path.join(require('os').tmpdir(), 'cdp-sh-' + Date.now());
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

function decodePng(buf) {
  let pos = 8, w = 0, h = 0, ct = 6; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const d = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1, stride = w * ch;
  const out = Buffer.alloc(h * stride); let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++]; const line = raw.slice(p, p + stride); p += stride;
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += ((a + b) >> 1);
      else if (ft === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

async function run() {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const l = await r.json();
      const p = l.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) { wsUrl = p.webSocketDebuggerUrl; break; } } catch (e) {}
    await sleep(300);
  }
  const ws = new WebSocket(wsUrl); let id = 1; const pending = new Map();
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (m, p = {}) => new Promise(res => { const i = id++; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  await send('Runtime.enable'); await send('Page.enable');
  await sleep(4800);

  const SHADOW_PROBE = `
  (function(){
    var T = window.__three, r = T.renderer;
    return JSON.stringify({ map: r.shadowMap.enabled, type: r.shadowMap.type,
      lights: window.__lights().filter(function(l){ return l.type==='DirectionalLight'; }) });
  })()`;
  const pr = await send('Runtime.evaluate', { expression: SHADOW_PROBE, returnByValue: true });
  console.log('阴影配置:', pr.result.result.value);

  /** 阴影区检测：灰、低饱和、比周围暗 */
  function shadowStats(img) {
    const { w, h, ch, data } = img;
    let n = 0, sum = 0, sum2 = 0, bMinusR = 0;
    const lum = new Float32Array(w * h); lum.fill(-1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch, r = data[i], g = data[i+1], b = data[i+2];
      const L = 0.299*r + 0.587*g + 0.114*b;
      lum[y*w+x] = L;
      const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
      if (mx - mn < 16 && L > 90 && L < 190) {      /* 低饱和且中灰 */
        n++; sum += L; sum2 += L*L; bMinusR += (b - r);
      }
    }
    if (!n) return null;
    const m = sum/n;
    /* 边界梯度：阴影区内相邻像素的差 */
    let edge = 0, ec = 0;
    for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
      const c = lum[y*w+x]; if (c < 0) continue;
      const i = (y*w+x)*ch, r = data[i], g = data[i+1], b = data[i+2];
      const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
      if (!(mx - mn < 16 && c > 90 && c < 190)) continue;
      edge += Math.hypot(lum[y*w+x+1]-lum[y*w+x-1], lum[(y+1)*w+x]-lum[(y-1)*w+x]); ec++;
    }
    return { n, ratio: 100.0*n/(w*h), mean: m, sd: Math.sqrt(sum2/n-m*m),
             bmr: bMinusR/n, edge: ec ? edge/ec : 0 };
  }

  const SHOTS = [
    ['base 原样', ''],
    ['PCFSoft→PCF', 'T.renderer.shadowMap.type=1;T.renderer.shadowMap.needsUpdate=true;T.scene.traverse(function(o){if(o.material)o.material.needsUpdate=true;})'],
    ['mapSize 4096→8192', 'T.scene.traverse(function(o){if(o.isDirectionalLight&&o.castShadow)o.shadow.mapSize.set(8192,8192);o.shadow.map=null;});T.renderer.shadowMap.needsUpdate=true;'],
    ['bias -0.00022→-0.0008', 'T.scene.traverse(function(o){if(o.isDirectionalLight&&o.castShadow)o.shadow.bias=-0.0008;});T.renderer.shadowMap.needsUpdate=true;'],
  ];

  // 需要 T 变量
  await send('Runtime.evaluate', { expression: 'window.T = window.__three;' });

  console.log('');
  console.log('%-24s %8s %8s %8s %8s %7s', '变体', '阴影占比', '明度', '标准差', 'B−R', '边界梯度');
  for (const [name, expr] of SHOTS) {
    if (expr) await send('Runtime.evaluate', { expression: `(function(){var T=window.__three;${expr}})()` });
    await sleep(900);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const img = decodePng(Buffer.from(shot.result.data, 'base64'));
    const st = shadowStats(img);
    if (st) console.log('%-24s %7.1f%% %8.1f %8.1f %8.1f %7.3f',
      name, st.ratio, st.mean, st.sd, st.bmr, st.edge);
    fs.writeFileSync('sh-' + name.replace(/[^A-Za-z0-9]/g, '').slice(0, 10) + '.png',
      Buffer.from(shot.result.data, 'base64'));
  }

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
}
run().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
