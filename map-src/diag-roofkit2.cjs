/**
 * v17d 屋顶设备"白到发光"审计：
 *   把每个屋顶设备网格按材质色 + **渲染后的实际像素明度**成对输出。
 *   判据：屋面本身 ~146；设备若 >190 就是"发光"，与屋面反差 >45 则读成"白塑料"。
 */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
              'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const pagePath = process.argv[2] || 'tower.html';
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9500 + Math.floor(Math.random() * 80);
const profile = path.join(require('os').tmpdir(), 'cdp-rk2-' + Date.now());
const child = spawn(EDGE, ['--headless=new','--disable-gpu','--enable-unsafe-swiftshader',
  '--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,
  '--window-size=1440,960','--hide-scrollbars','--no-first-run','--no-default-browser-check', fileUrl], { stdio:'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  const send = (m, p={}) => new Promise(res => { const i = id++; pending.set(i, res); ws.send(JSON.stringify({id:i,method:m,params:p})); });
  await send('Runtime.enable'); await send('Page.enable');
  await sleep(5200);
  const q = [
    '(function(){',
    '  var T = window.__three, THREE = T.THREE, s = T.scene, cam = T.camera;',
    '  T.renderer.render(s, cam);',
    '  var cv = T.renderer.domElement;',
    '  var g2=document.createElement("canvas"); g2.width=cv.width; g2.height=cv.height;',
    '  var cx=g2.getContext("2d"); cx.drawImage(cv,0,0);',
    '  var W=g2.width,H=g2.height,d=cx.getImageData(0,0,W,H).data;',
    '  var v=new THREE.Vector3(), bb=new THREE.Box3();',
    '  var res={};',
    '  s.traverse(function(o){',
    '    if(!o.isMesh||!o.material) return;',
    '    var m=Array.isArray(o.material)?o.material[0]:o.material;',
    '    if(!m.color) return;',
    '    var g3=o.geometry; if(!g3) return;',
    '    if(!g3.boundingBox) g3.computeBoundingBox();',
    '    bb.copy(g3.boundingBox).applyMatrix4(o.matrixWorld);',
    '    if(bb.min.y < 19.0) return;                  /* 只看屋顶层以上 */',
    '    /* 取 AABB 中心投影到屏幕，采 5x5 邻域中位数 */',
    '    bb.getCenter(v); v.project(cam);',
    '    var sx=Math.round((v.x*0.5+0.5)*W), sy=Math.round((-v.y*0.5+0.5)*H);',
    '    if(sx<2||sy<2||sx>=W-2||sy>=H-2) return;',
    '    var lum=[];',
    '    for(var dy=-2;dy<=2;dy++) for(var dx=-2;dx<=2;dx++){',
    '      var i=((sy+dy)*W+(sx+dx))*4;',
    '      lum.push(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2]);',
    '    }',
    '    lum.sort(function(a,b){return a-b;});',
    '    var med=lum[Math.floor(lum.length/2)];',
    '    var key=m.color.getHexString()+"|"+g3.type;',
    '    if(!res[key]) res[key]={n:0,sum:0,min:999,max:-1,col:m.color.getHexString(),geo:g3.type};',
    '    res[key].n++; res[key].sum+=med;',
    '    if(med<res[key].min) res[key].min=med;',
    '    if(med>res[key].max) res[key].max=med;',
    '  });',
    '  var arr=Object.keys(res).map(function(k){var r=res[k];return {col:r.col,geo:r.geo,n:r.n,',
    '    avg:+(r.sum/r.n).toFixed(1), min:+r.min.toFixed(0), max:+r.max.toFixed(0)};});',
    '  arr.sort(function(a,b){return b.avg-a.avg;});',
    '  /* 同时给屋面本身的参考明度 */',
    '  return JSON.stringify({ref: 146, groups: arr});',
    '})()'
  ].join('\n');
  const r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
  const o = JSON.parse(r.result.result.value);
  console.log('屋面参考明度 ≈ 146（v17c 实测）\n');
  console.log('  ' + '材质色'.padEnd(9) + '几何'.padEnd(12) + '数量'.padStart(5) + '  渲染明度(均/最小/最大)  与屋面差');
  o.groups.forEach(g => {
    const diff = (g.avg - o.ref).toFixed(0);
    const flag = g.avg > 190 ? '  <== 发光' : (Math.abs(g.avg - o.ref) > 45 ? '  <== 反差过大' : '');
    console.log('  #' + g.col.padEnd(8) + g.geo.replace('Geometry','').padEnd(12) +
      String(g.n).padStart(5) + '   ' + String(g.avg).padStart(5) + ' / ' +
      String(g.min).padStart(4) + ' / ' + String(g.max).padStart(4) +
      '        ' + String(diff).padStart(5) + flag);
  });
  ws.close(); child.kill('SIGKILL'); setTimeout(()=>process.exit(0),300);
})().catch(e => { console.error('ERR', e.message); try{child.kill('SIGKILL');}catch(x){} process.exit(1); });
