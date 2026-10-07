/**
 * vivid.cjs —— 量测"某个材质色在实际渲染中输出成什么颜色"
 *
 * 为什么要它：用户说"颜色太暗淡"。但要"提亮/提饱和"必须先知道
 *   ① 现在渲染出来是多少（不是材质色，是像素值）
 *   ② 还有多少余量（p90 / p99 离 255 多远 ⇒ 会不会一调就过曝）
 *
 * 手法：掩膜渲染 —— 只留目标色的 mesh 可见，其余全隐藏，背景涂黑，
 *   渲染一帧后 readPixels。非黑像素 = 该材质的真实贡献（遮挡由 GPU 处理）。
 *
 * ★ 关键坑：renderer 没有暴露，但主循环用 requestAnimationFrame 持续渲染。
 *   所以"改完可见性"之后必须等**下一帧**再 readPixels，否则读到的是旧帧。
 *   用 CDP 的 evaluate + awaitPromise，把"等一帧"包成 Promise。
 *
 * 用法： node vivid.cjs [页面] [色号1,色号2,...]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const pagePath = process.argv[2] || 'apt.html';
const hexes = (process.argv[3] || 'a3855f,c08466,b3936e,8e887c,5e5a52,6e6c68').split(',');

const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9800 + Math.floor(Math.random() * 190);
const profile = path.join(require('os').tmpdir(), 'cdp-vivid-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 页面内：量一个色号。返回 Promise（等 rAF 下一帧） */
const MEASURE_FN = `
function(hex) {
  return new Promise(function(resolve){
    var A = window.__APT;
    var cvs = document.querySelector('canvas');
    var gl = cvs.getContext('webgl2') || cvs.getContext('webgl');
    var W = cvs.width, H = cvs.height;
    var scene = A.scene;
    if (scene.__bg0 === undefined) scene.__bg0 = scene.background;
    var keep = 0;
    scene.traverse(function(o){
      if (!o.isMesh || !o.material) return;
      var c = o.material.color ? o.material.color.getHexString() : '';
      o.visible = (c === hex);
      if (o.visible) keep++;
    });
    scene.background = new THREE.Color(0x000000);
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        var px = new Uint8Array(W * H * 4);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
        // 还原
        scene.traverse(function(o){ if (o.isMesh) o.visible = true; });
        scene.background = scene.__bg0;
        var lum=[], rs=[], gs=[], bs=[], satSum=0;
        for (var i=0;i<px.length;i+=4){
          var r=px[i], g=px[i+1], b=px[i+2];
          if (r+g+b < 30) continue;
          rs.push(r); gs.push(g); bs.push(b);
          var mx=Math.max(r,g,b), mn=Math.min(r,g,b);
          satSum += (mx-mn)/(mx||1);
          lum.push(0.299*r+0.587*g+0.114*b);
        }
        if (!lum.length) return resolve({hex:hex, keep:keep, n:0});
        lum.sort(function(a,b){return a-b;});
        function mean(a){var s=0;for(var k=0;k<a.length;k++)s+=a[k];return s/a.length;}
        function pc(a,p){return a[Math.min(a.length-1,Math.floor(a.length*p))];}
        resolve({
          hex:hex, keep:keep, n:lum.length,
          r:+mean(rs).toFixed(0), g:+mean(gs).toFixed(0), b:+mean(bs).toFixed(0),
          L:+mean(lum).toFixed(1),
          med:+pc(lum,.5).toFixed(1),
          p90:+pc(lum,.9).toFixed(1),
          p99:+pc(lum,.99).toFixed(1),
          sat:+(satSum/rs.length).toFixed(3)
        });
      });
    });
  });
}
`;

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

  await send('Runtime.enable');
  await sleep(7000);   // 等首帧 + 阴影贴图

  console.log('色号        keep   可见px   RGB均值        L_mean  med    p90    p99    sat');
  for (const h of hexes) {
    const r = await send('Runtime.evaluate', {
      expression: `(${MEASURE_FN})(${JSON.stringify(h)})`,
      awaitPromise: true, returnByValue: true, timeout: 30000
    });
    if (r.result && r.result.result && r.result.result.value) {
      const v = r.result.result.value;
      if (v.n === 0) console.log(`#${h}  keep=${v.keep}  ** 0 可见像素 **`);
      else console.log(
        `#${h}  keep=${String(v.keep).padStart(3)}  ${String(v.n).padStart(7)}   ` +
        `(${String(v.r).padStart(3)},${String(v.g).padStart(3)},${String(v.b).padStart(3)})   ` +
        `${String(v.L).padStart(6)}  ${String(v.med).padStart(5)}  ` +
        `${String(v.p90).padStart(5)}  ${String(v.p99).padStart(5)}  ${v.sat}`
      );
    } else {
      console.log(`#${h}  ERR`, JSON.stringify(r).slice(0, 200));
    }
  }

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
