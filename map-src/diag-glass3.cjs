/* 玻璃可见性诊断（纯 Node，用 Node22 内置 WebSocket + 内置 zlib 解 PNG）
   目的：搞清"窗户渲染成白块"到底是几何问题还是着色问题。 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');

const ROOT = __dirname;
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const fileUrl = 'file:///' + path.resolve('tower.html').replace(/\\/g, '/');
const PORT = 9601;
const profile = path.join(os.tmpdir(), 'diag-prof-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
  '--window-size=1440,960', '--hide-scrollbars', '--no-first-run', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

function pngPixels(buf) {
  let p = 8, w = 0, h = 0, ct = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[o++];
    const line = raw.slice(o, o + stride); o += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}

(async () => {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const pg = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pg) { wsUrl = pg.webSocketDebuggerUrl; break; }
    } catch (e) { }
    await sleep(300);
  }
  if (!wsUrl) { console.log('NO TARGET'); child.kill(); return; }

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
  await sleep(7000);

  /* ① 场景统计：玻璃网格数、尺寸、世界位置 */
  const st = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function(){
      var glass=[], frame=0, sill=0, all=0, other={};
      scene.traverse(function(o){
        if(!o.isMesh) return; all++;
        var hex = o.material && o.material.color ? o.material.color.getHex() : -1;
        if(hex===0x0C1420) glass.push(o);
        else if(hex===0xE4E0D8) frame++;
        else if(hex===0xCFC8BA) sill++;
        var k='0x'+hex.toString(16).toUpperCase(); other[k]=(other[k]||0)+1;
      });
      var top=Object.entries(other).sort((a,b)=>b[1]-a[1]).slice(0,10);
      var r={ meshes:all, glassMeshes:glass.length, frameMeshes:frame, sillMeshes:sill,
              topColors:top };
      if(glass.length){
        var g=glass[0]; g.updateMatrixWorld(true);
        var b=new THREE.Box3().setFromObject(g);
        r.sampleGlassSize=[+(b.max.x-b.min.x).toFixed(3),+(b.max.y-b.min.y).toFixed(3),+(b.max.z-b.min.z).toFixed(3)];
        r.sampleGlassCenter=[+((b.max.x+b.min.x)/2).toFixed(2),+((b.max.y+b.min.y)/2).toFixed(2),+((b.max.z+b.min.z)/2).toFixed(2)];
      }
      return JSON.stringify(r);
    })()`
  });
  console.log('① 场景统计:', st.result && st.result.value);

  /* ② 把玻璃全部染成亮品红 + 隐藏所有 frame，看"窗"到底在哪 */
  const probe = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(function(){
      var n=0;
      scene.traverse(function(o){
        if(!o.isMesh) return;
        var hex=o.material&&o.material.color?o.material.color.getHex():-1;
        if(hex===0xE4E0D8||hex===0xCFC8BA){ o.visible=false; n++; }        // 隐藏窗套/窗台
        if(hex===0x0C1420){ o.material=new THREE.MeshBasicMaterial({color:0xFF00FF}); }
      });
      return 'hiddenFrame='+n;
    })()`
  });
  console.log('② RAW:', JSON.stringify(probe).slice(0,400));
  await sleep(1200);
  const s2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ROOT, 'diag-probe.png'), Buffer.from(s2.data, 'base64'));

  const im = pngPixels(Buffer.from(s2.data, 'base64'));
  let mag = 0, tot = 0;
  for (let y = 0; y < im.h; y += 2) for (let x = 0; x < im.w; x += 2) {
    const i = (y * im.w + x) * im.ch; tot++;
    if (im.data[i] > 200 && im.data[i + 1] < 80 && im.data[i + 2] > 200) mag++;
  }
  console.log(`③ 品红（=玻璃）像素占比 ${(mag / tot * 100).toFixed(3)}%  (${mag}/${tot})`);

  ws.close(); child.kill();
})().catch(e => { console.log('ERR', e.message); child.kill(); });
