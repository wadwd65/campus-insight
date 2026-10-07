/**
 * 屋面质感对照实验：把"屋顶像塑料板"拆成可量的指标。
 * 量屋顶区（蓝色像素）：明度 / 标准差 / B−R / 边缘密度 / 高光占比
 * 对照项（单变量）：
 *   base          原样
 *   关金属度       roughness→1, metalness→0
 *   加粗糙度抖动   （材质无法批量改 —— 只能看现有参数贡献）
 *   板缝加粗       改 ribs 可见性（若找得到）
 *   顶点色         （需要重建，跳过，先看现有）
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
const PORT = 9200 + Math.floor(Math.random() * 90);
const profile = path.join(require('os').tmpdir(), 'cdp-rf-' + Date.now());
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

/** 屋顶区（蓝色像素：b > r+15）统计 */
function roofStats(img) {
  const { w, h, ch, data } = img;
  let n = 0, sum = 0, sum2 = 0, bmr = 0, bright = 0;
  const lum = new Float32Array(w * h); lum.fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * ch, r = data[i], g = data[i+1], b = data[i+2];
    if (!(b > r + 15)) continue;
    const L = 0.299*r + 0.587*g + 0.114*b;
    lum[y*w+x] = L;
    n++; sum += L; sum2 += L*L; bmr += (b - r);
    if (L > 195) bright++;
  }
  if (!n) return null;
  const m = sum/n;
  let edge = 0, ec = 0;
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
    const c = lum[y*w+x]; if (c < 0) continue;
    edge += Math.hypot(lum[y*w+x+1]-lum[y*w+x-1], lum[(y+1)*w+x]-lum[(y-1)*w+x]); ec++;
  }
  return { n, mean: m, sd: Math.sqrt(sum2/n-m*m), bmr: bmr/n,
           bright: 100.0*bright/n, edge: ec ? edge/ec : 0 };
}

(async () => {
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
  await sleep(5500);

  // 先看屋面材质现状
  const pr = await send('Runtime.evaluate', { expression: `(function(){
    var T = window.__three, s = T.scene, seen = [];
    var names = {};
    s.traverse(function(o){
      if (!o.isMesh || !o.material) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function(m){
        var key = m.type + '|' + (m.color ? m.color.getHexString() : '-') + '|r' + m.roughness + '|m' + m.metalness + '|map' + (m.map?'Y':'N');
        names[key] = (names[key]||0)+1;
      });
    });
    return JSON.stringify(names);
  })()`, returnByValue: true });
  console.log('=== 材质清单（出现次数 > 20 的）===');
  const mats = JSON.parse(pr.result.result.value);
  Object.entries(mats).filter(([k,v])=>v>20).sort((a,b)=>b[1]-a[1]).slice(0,18)
    .forEach(([k,v]) => console.log('  %s  ×%d', k, v));

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
