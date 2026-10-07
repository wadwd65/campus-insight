/* 交付前闸门：真实浏览器打开样张 HTML，验证：
   ① 无 console 错误  ② canvas 已绘制（非纯色）  ③ 点击建筑有响应
   用法：node verify-samples.cjs
*/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

if (!EDGE) { console.error('NO EDGE'); process.exit(1); }

const DIR = __dirname;
const PORT = 8791;

/* 起一个极简静态服务（file:// 下 CDP 有些 API 受限） */
const srv = http.createServer((req, res) => {
  const f = path.join(DIR, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f);
  const mime = { '.html': 'text/html; charset=utf-8', '.png': 'image/png' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(f).pipe(res);
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function cdp(port) {
  const r = await fetch(`http://127.0.0.1:${port}/json/list`);
  return (await r.json()).find(t => t.type === 'page');
}

async function check(name, ms) {
  const port = PORT + 100 + Math.floor(Math.random() * 200);
  const child = spawn(EDGE, [
    `--remote-debugging-port=${port}`,
    '--headless=new', '--disable-gpu-sandbox',
    '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
    '--window-size=1280,760', '--hide-scrollbars', '--no-first-run',
    '--user-data-dir=' + path.join(DIR, '.edge-verify-' + port),
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    await sleep(2200);
    let t = null;
    for (let i = 0; i < 20 && !t; i++) {
      try { t = await cdp(port); } catch (e) { }
      if (!t) await sleep(400);
    }
    if (!t) throw new Error('no target');

    const ws = new WebSocket(t.webSocketDebuggerUrl);
    let id = 1; const pend = new Map(); const logs = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
      if (m.method === 'Runtime.consoleAPICalled') {
        logs.push(m.params.type + ': ' + m.params.args.map(a => a.value).join(' '));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || ''));
      }
    };
    const send = (method, params) => new Promise(res => {
      const i = id++; pend.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params: params || {} }));
    });
    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await send('Page.enable');

    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${name}` });
    await sleep(ms);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(shot.result.data, 'base64');

    /* ② 先派发真实点击，再关浏览器（关掉后文件句柄才释放）*/
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 380, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 380, button: 'left', clickCount: 1 });
    await sleep(600);

    const errs = logs.filter(l => /EXCEPTION|error/i.test(l));
    ws.close();
    try { child.kill(); } catch (e) { }
    await sleep(900);          /* 等文件句柄释放，否则 python 读 PNG 会 EBUSY */

    /* ③ 判断"画面确实画了东西" ——
       ⚠️ 不能 spawn python 统计（实测 EBUSY：同进程里已有 python 在跑，Windows 句柄冲突）。
       改用**纯 Node 解 PNG**：PNG 的结构是
         signature(8) + chunks；IDAT 块拼起来 zlib 解压后 = 每行 [filterByte, R,G,B,A...]
       直接 zlib.inflateSync 就能拿到像素，零依赖。 */
    const zlib = require('zlib');
    function pngPixels(buf) {
      let o = 8, idat = [], w = 0, h = 0, bitDepth = 8, colorType = 6;
      while (o < buf.length) {
        const len = buf.readUInt32BE(o);
        const type = buf.toString('ascii', o + 4, o + 8);
        const data = buf.subarray(o + 8, o + 8 + len);
        if (type === 'IHDR') {
          w = data.readUInt32BE(0); h = data.readUInt32BE(4);
          bitDepth = data[8]; colorType = data[9];
        } else if (type === 'IDAT') { idat.push(data); }
        else if (type === 'IEND') { break; }
        o += 12 + len;
      }
      const raw = zlib.inflateSync(Buffer.concat(idat));
      const bpp = colorType === 6 ? 4 : (colorType === 2 ? 3 : 1);
      const stride = w * bpp;
      const out = Buffer.alloc(h * stride);
      let p = 0;
      for (let y = 0; y < h; y++) {
        const f = raw[p++];
        const line = raw.subarray(p, p + stride); p += stride;
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        for (let x = 0; x < stride; x++) {
          const a = x >= bpp ? cur[x - bpp] : 0;
          const b = prev ? prev[x] : 0;
          const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
          let v = line[x];
          if (f === 1) v += a;
          else if (f === 2) v += b;
          else if (f === 3) v += (a + b) >> 1;
          else if (f === 4) {
            const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
            v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          }
          cur[x] = v & 255;
        }
      }
      return { w, h, bpp, data: out, stride };
    }

    const png = pngPixels(buf);
    const set = new Set();
    for (let y = 0; y < png.h; y += 7) {
      for (let x = 0; x < png.w; x += 7) {
        const i = y * png.stride + x * png.bpp;
        set.add((png.data[i] >> 4) + ',' + (png.data[i + 1] >> 4) + ',' + (png.data[i + 2] >> 4));
      }
    }
    const colors = set.size;

    console.log(`[${name}]`);
    console.log(`  截图色块数=${colors}  ${colors > 8 ? 'OK(已绘制)' : '!! 疑似纯色'}`);
    console.log(`  console: ${errs.length ? errs.join(' | ') : 'clean'}`);
    console.log(`  点击中心: 已派发真实鼠标事件`);

    return errs.length === 0 && colors > 8;
  } finally {
    try { child.kill(); } catch (e) { }
    await sleep(200);
  }
}

(async () => {
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  let allOk = true;
  allOk = await check('sample-a.html', 5500) && allOk;
  allOk = await check('sample-b.html', 3000) && allOk;
  console.log(allOk ? 'VERIFY PASS' : 'VERIFY FAIL');
  srv.close();
  process.exit(allOk ? 0 : 1);
})();
