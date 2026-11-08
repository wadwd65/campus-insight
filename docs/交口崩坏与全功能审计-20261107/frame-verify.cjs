/* 连续帧闪烁验证器（不使用单张静态截图下结论）
 *
 * 用法：node frame-verify.cjs <url> <outDir> <mode> [frames]
 *   mode: overview | overview-auto | first
 *
 * 流程：
 *  1) Edge headless + CDP 打开页面，按 mode 设置视角；
 *  2) 从场景里取 junction:road 的每个实例，投影到屏幕得到「每个交口」的 ROI；
 *  3) 连续抓 N 帧 PNG（Page.captureScreenshot）；
 *  4) 对每个 ROI 的中心块计算相邻帧平均绝对差(MAD) + 高频交替指标；
 *  5) 输出逐交口指标与汇总，写 frames/*.png 供人工复核。
 *
 * 判读：z-fighting 会让共面区域在连续帧之间跳变 ⇒ MAD 明显 > 0；
 *      修复后同口径下应显著下降。必须修复前后对比 + 多视角，不能只看一帧。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const URL = process.argv[2];
const OUT = process.argv[3];
const MODE = process.argv[4] || 'overview';
const FRAMES = Number(process.argv[5] || 8);
const VW = 1600, VH = 1000;
if (!URL || !OUT) throw new Error('用法: node frame-verify.cjs <url> <outDir> <overview|overview-auto|first> [frames]');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

/* --- 最小 PNG 解码（8bit RGB/RGBA，非隔行） --- */
function decodePNG(buf) {
  let off = 8, w = 0, h = 0, ct = 0, bd = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const d = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bd !== 8 || ![2, 6].includes(ct)) throw new Error(`png bd=${bd} ct=${ct}`);
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++], row = raw.subarray(rp, rp + stride); rp += stride;
    const cur = px.subarray(y * stride, (y + 1) * stride), prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    rgba[i * 4] = px[i * bpp]; rgba[i * 4 + 1] = px[i * bpp + 1]; rgba[i * 4 + 2] = px[i * bpp + 2];
    rgba[i * 4 + 3] = ct === 6 ? px[i * bpp + 3] : 255;
  }
  return { w, h, rgba };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const PORT = 9700 + Math.floor(Math.random() * 250);
const profile = path.join(os.tmpdir(), 'cdp-frames-' + Date.now());

(async () => {
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=swiftshader',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    '--window-size=' + VW + ',' + VH, '--hide-scrollbars', '--no-first-run',
    '--force-device-scale-factor=1', '--autoplay-policy=no-user-gesture-required', 'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await r.json()).find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch (e) { }
    if (!wsUrl) await sleep(300);
  }
  if (!wsUrl) { child.kill('SIGKILL'); throw new Error('no CDP target'); }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  let id = 1; const pending = new Map(); const errors = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(String(m.params.exceptionDetails.text || '').slice(0, 120));
  });
  const send = (method, params = {}) => new Promise(res => {
    const n = id++; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evalJS = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
    return r.result && r.result.result ? r.result.result.value : null;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL });
  await sleep(6500);

  /* 视角设置 */
  if (MODE === 'overview-auto') {
    await evalJS(`document.getElementById('auto')&&document.getElementById('auto').click();true`);
    await sleep(1200);
  } else if (MODE === 'first' || MODE === 'drive') {
    /* 步行出生点朝向建筑，按 W 会撞墙 → 改为按 S 后退到路面/交口；
       drive 则进小车车内第一人称，按 W 沿路行驶。两种都是真第一人称。 */
    const btn = MODE === 'first' ? 'walk-toggle' : 'drive-toggle';
    const key = MODE === 'first' ? 's' : 'w';
    const code = MODE === 'first' ? 'KeyS' : 'KeyW';
    const vk = MODE === 'first' ? 83 : 87;
    await evalJS(`document.getElementById('${btn}')&&document.getElementById('${btn}').click();true`);
    await sleep(1500);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
    globalThis.__heldKey = { key, code, windowsVirtualKeyCode: vk };
  }
  await sleep(1000);

  /* 每个交口的屏幕 ROI —— ★ 必须每帧重算：第一人称在移动，
     固定 ROI 会落到不同世界位置，帧间差就全是相机位移而不是闪烁。 */
  const getRois = async () => {
    const raw = await evalJS(`(()=>{
      const T=window.__T,scene=window.__scene,cam=window.__cam;
      if(!T||!scene||!cam)return JSON.stringify({rois:[]});
      const cv=document.querySelector('canvas'),r=cv.getBoundingClientRect();
      cam.updateMatrixWorld();
      const m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3(),rois=[];
      scene.traverse(o=>{
        if(o.isInstancedMesh&&/^(junction|pad):road$/.test(o.name||'')){
          for(let i=0;i<o.count;i++){
            o.getMatrixAt(i,m);m.decompose(p,q,s);
            const v=p.clone();v.y=.37;v.project(cam);
            if(v.z>1||v.z<-1)continue;
            rois.push({id:i,x:Math.round((v.x+1)/2*r.width+r.left),y:Math.round((1-v.y)/2*r.height+r.top)});
          }
        }
      });
      return JSON.stringify({rois,w:r.width,h:r.height});
    })()`);
    return JSON.parse(raw || '{"rois":[]}');
  };
  const firstRoi = await getRois();
  console.log(`[${MODE}] 交口 ROI ${firstRoi.rois.length} 个，canvas ${firstRoi.w}×${firstRoi.h}`);

  /* 连续抓帧，每帧记录当帧的交口投影 */
  const imgs = [], frameRois = [];
  for (let f = 0; f < FRAMES; f++) {
    frameRois.push(await getRois());
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (!shot.result || !shot.result.data) { console.error('截图失败', f); continue; }
    const b = Buffer.from(shot.result.data, 'base64');
    fs.writeFileSync(path.join(OUT, 'frames', `${MODE}-${String(f).padStart(2, '0')}.png`), b);
    try { imgs.push(decodePNG(b)); } catch (e) { console.error('解码失败', f, e.message); }
    await sleep(180);
  }
  if (globalThis.__heldKey) await send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, globalThis.__heldKey));

  /* 逐交口计算相邻帧 MAD：两帧各自用当帧投影坐标，ROI 始终跟着同一个交口，
     从而扣掉相机位移，只留下该交口本身的像素跳变。 */
  const R = 12;
  const idPos = new Map(firstRoi.rois.map(r => [r.id, r]));
  const perRoi = [...idPos.keys()].map(id => ({ id, mads: [] }));
  for (let f = 1; f < imgs.length; f++) {
    const A = imgs[f - 1], B = imgs[f];
    if (A.w !== B.w || A.h !== B.h) continue;
    const ra = new Map(((frameRois[f - 1] || {}).rois || []).map(r => [r.id, r]));
    const rb = new Map(((frameRois[f] || {}).rois || []).map(r => [r.id, r]));
    for (const item of perRoi) {
      const pa = ra.get(item.id), pb = rb.get(item.id);
      if (!pa || !pb) continue;
      if (pa.x < R || pa.y < R || pa.x + R >= A.w || pa.y + R >= A.h) continue;
      if (pb.x < R || pb.y < R || pb.x + R >= B.w || pb.y + R >= B.h) continue;
      let sum = 0, n = 0;
      for (let dy = -R; dy < R; dy += 2) for (let dx = -R; dx < R; dx += 2) {
        const ia = ((pa.y + dy) * A.w + (pa.x + dx)) * 4;
        const ib = ((pb.y + dy) * B.w + (pb.x + dx)) * 4;
        sum += Math.abs(A.rgba[ia] - B.rgba[ib]) + Math.abs(A.rgba[ia + 1] - B.rgba[ib + 1]) + Math.abs(A.rgba[ia + 2] - B.rgba[ib + 2]);
        n += 3;
      }
      if (n) item.mads.push(+(sum / n).toFixed(2));
    }
  }
  const summary = perRoi.filter(r => r.mads.length).map(r => {
    const p = idPos.get(r.id) || {};
    return {
      id: r.id, x: p.x, y: p.y,
      mean: +(r.mads.reduce((a, b) => a + b, 0) / r.mads.length).toFixed(2),
      max: Math.max(...r.mads),
    };
  });
  const allMeans = summary.map(s => s.mean).sort((a, b) => a - b);
  const out = {
    url: URL, mode: MODE, frames: imgs.length, roiCount: summary.length,
    medianMeanMAD: allMeans.length ? allMeans[Math.floor(allMeans.length / 2)] : null,
    maxMeanMAD: allMeans.length ? allMeans[allMeans.length - 1] : null,
    worstRois: summary.slice().sort((a, b) => b.mean - a.mean).slice(0, 5),
    errors,
  };
  fs.writeFileSync(path.join(OUT, `${MODE}-result.json`), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  ws.close(); child.kill('SIGKILL');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
