/**
 * 草坪质感对照实验：到底哪种方案能同时做到
 *   ① 标准差上去（有质感）  ② 不出现可辨识的规则图案
 *
 * 五组对照（固定相机、固定光照）：
 *   P0 纯色                —— v15 基线
 *   P1 纯色 + 草叶线        —— 只加高频，不加低频
 *   P2 块(对比强)          —— v16b
 *   P3 块(对比弱)          —— v16c
 *   P4 块(弱) + 草叶线      —— 当前
 *   P5 块(弱) + 草叶线 + 块更小
 * 指标：草坪区 明度 / 标准差 / 唯一色数 / 边缘密度（Sobel 均值，越高越"碎"）
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
const PORT = 9900 + Math.floor(Math.random() * 99);
const profile = path.join(require('os').tmpdir(), 'cdp-lawn2-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

function decodePng(buf) {
  let pos = 8, w = 0, h = 0, ct = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const line = raw.slice(p, p + stride); p += stride;
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.slice(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b;
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

function lawnStats(img) {
  const { w, h, ch, data } = img;
  const CX = 555, CY = 380;
  const R0 = 195, R1 = 560;
  let n = 0, sum = 0, sum2 = 0;
  const uniq = new Set();
  const lum = new Float32Array(w * h); lum.fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - CX, y - CY);
      if (d < R0 || d > R1) continue;
      const i = (y * w + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (!(g > r + 6 && g > b + 6)) continue;
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      lum[y * w + x] = L;
      n++; sum += L; sum2 += L * L;
      uniq.add((r >> 2) << 12 | (g >> 2) << 6 | (b >> 2));
    }
  }
  if (!n) return null;
  const m = sum / n;
  // 边缘密度（Sobel 近似）：草坪内相邻像素差
  let edge = 0, ec = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const c = lum[y * w + x];
      if (c < 0) continue;
      const gx = lum[y * w + x + 1] - lum[y * w + x - 1];
      const gy = lum[(y + 1) * w + x] - lum[(y - 1) * w + x];
      if (gx < 0 && gy < 0) continue;
      edge += Math.hypot(gx, gy); ec++;
    }
  }
  return { n, mean: m, sd: Math.sqrt(sum2 / n - m * m), uniq: uniq.size,
           edge: ec ? edge / ec : 0 };
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
  await sleep(4200);

  // 给页面注入"临时改名"能力：把草坪色块/草叶线的可见性打开关闭
  await send('Runtime.evaluate', { expression: `
    window.__lawnToggle = function(patchOn, lineOn){
      var s = window.__three.scene, pc = 0, lc = 0;
      s.traverse(function(o){
        if (o.isMesh && o.geometry && o.geometry.type === 'ShapeGeometry' && o.userData.noFrame) {
          o.visible = patchOn; pc++;
        }
        if (o.isLineSegments && o.userData.noFrame) { o.visible = lineOn; lc++; }
      });
      return {patch:pc, line:lc};
    };
    window.__lawnInfo = function(){
      var s = window.__three.scene, info = [];
      s.traverse(function(o){
        if (o.isLineSegments && o.userData.noFrame) info.push('LineSegments');
        if (o.isMesh && o.geometry && o.geometry.type==='ShapeGeometry' && o.userData.noFrame) info.push('patch');
        if (o.isMesh && o.geometry && o.geometry.type==='RingGeometry') info.push('ring');
      });
      var u = {}; info.forEach(function(k){ u[k]=(u[k]||0)+1; });
      return JSON.stringify(u);
    };
  ` });
  const info = await send('Runtime.evaluate', { expression: 'window.__lawnInfo()', returnByValue: true });
  console.log('场景草坪相关对象:', info.result.result.value);

  const VARIANTS = [
    ['P4 块+线（当前）',      [true,  true]],
    ['P1 纯色+线',            [false, true]],
    ['P0 纯色（v15基线）',    [false, false]],
    ['P3 只有块（v16c）',     [true,  false]],
  ];

  console.log('');
  console.log('%-24s %9s %8s %8s %7s %8s', '方案', '像素数', '明度', '标准差', '唯一色', '边缘密度');
  for (const [name, [pOn, lOn]] of VARIANTS) {
    const r = await send('Runtime.evaluate', {
      expression: `window.__lawnToggle(${pOn}, ${lOn})`, returnByValue: true
    });
    await sleep(900);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const img = decodePng(Buffer.from(shot.result.data, 'base64'));
    const st = lawnStats(img);
    if (st) console.log('%-24s %9d %8.1f %8.1f %7d %8.3f',
      name, st.n, st.mean, st.sd, st.uniq, st.edge);
    // 存图供人眼复核
    fs.writeFileSync('lawn-' + name.slice(0, 2).replace(/\s/g, '') + '.png',
      Buffer.from(shot.result.data, 'base64'));
  }

  ws.close();
  child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
