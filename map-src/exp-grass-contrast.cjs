/**
 * v17b 草坪"反差不倒挂"实验：把草坪材质降到不同档，看**建筑/草坪明度差**是否转正。
 * 判据（DIAG-v17 第二节）：草坪占 71% 却是画面最亮的（169.6），
 *   比建筑(125)/屋面(145)/广场(149) 都亮 ⇒ 主体被背景压住 ⇒ 画面"薄"。
 * 目标：草坪明度落到 ~125（≈ 广场 −24，≈ 建筑同档但色相区分），
 *   即"建筑/草坪反差"从 **−44.6 → ≥ −5**。
 * ★ 只改草地两个环的材质色，其余一律不动（单变量）。
 */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
              'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const pagePath = process.argv[2] || 'tower.html';
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9200 + Math.floor(Math.random() * 80);
const profile = path.join(require('os').tmpdir(), 'cdp-lw2-' + Date.now());
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

  const V = {
    'base      原样':      null,
    'G1 0x44603A (明度88)': 0x44603A,
    'G2 0x3D5734 (明度79)': 0x3D5734,
    'G3 0x364E2E (明度70)': 0x364E2E,
    'G4 0x30462A (明度64)': 0x30462A
  };
  console.log('%-24s %8s %8s %8s | %8s' , '变体', '草坪', '广场', '建筑', '建筑-草坪');
  for (const [name, hex] of Object.entries(V)) {
    const setQ = hex === null ? '0' : String(hex);
    const q = [
      '(function(){',
      '  var T = window.__three;',
      '  var s = T.scene, cam = T.camera, THREE = T.THREE;',
      '  var target = ' + setQ + ';',
      '  /* 只改草地两环：RingGeometry 且材质色是草绿系 */',
      '  var GRASS = [0x4E6B44, 0x45602F, 0x5C7A4E, 0x53703F, 0x6E8450, 0x7A8F58];',
      '  s.traverse(function(o){',
      '    if(!o.isMesh || !o.material) return;',
      '    var c = o.material.color; if(!c) return;',
      '    var h = c.getHex();',
      '    if(!o.userData.__og && GRASS.indexOf(h) >= 0){',
      '      o.userData.__og = h;',
      '      o.userData.__grass = true;',
      '    }',
      '    if(o.userData.__grass && target > 0) c.setHex(target);',
      '    if(o.userData.__grass && target === 0) c.setHex(o.userData.__og);',
      '  });',
      '  /* 重渲染 */',
      '  T.renderer.render(s, cam);',
      '  /* 采样：把画布像素分四类算明度 */',
      '  var cv = T.renderer.domElement;',
      '  var g2 = document.createElement("canvas");',
      '  g2.width = cv.width; g2.height = cv.height;',
      '  var cx = g2.getContext("2d");',
      '  cx.drawImage(cv, 0, 0);',
      '  var W = g2.width, H = g2.height;',
      '  var d = cx.getImageData(0,0,W,H).data;',
      '  var CX = W*0.394, CY = H*0.44;',
      '  var acc = { grass:[0,0], plaza:[0,0], facade:[0,0] };',
      '  for(var y=0;y<H;y+=3){',
      '    for(var x=0;x<W;x+=3){',
      '      var i=(y*W+x)*4, r=d[i], gg=d[i+1], b=d[i+2];',
      '      var lum = 0.299*r+0.587*gg+0.114*b;',
      '      var dd = Math.hypot(x-CX, y-CY);',
      '      if(r>gg+22 && r>b+30 && r>120){ acc.facade[0]+=lum; acc.facade[1]++; }',
      '      else if(dd<W*0.13 && Math.abs(r-gg)<10 && Math.abs(gg-b)<14){ acc.plaza[0]+=lum; acc.plaza[1]++; }',
      '      else if(dd>W*0.46 && gg>r+6 && gg>b+6){ acc.grass[0]+=lum; acc.grass[1]++; }',
      '    }',
      '  }',
      '  function m(a){ return a[1] ? a[0]/a[1] : 0; }',
      '  return JSON.stringify({ grass:+m(acc.grass).toFixed(1), plaza:+m(acc.plaza).toFixed(1),',
      '    facade:+m(acc.facade).toFixed(1), n:acc.grass[1] });',
      '})()'
    ].join('\n');
    const r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
    if (r.result && r.result.result && r.result.result.value) {
      const o = JSON.parse(r.result.result.value);
      const diff = (o.facade - o.grass).toFixed(1);
      console.log('%-24s %8.1f %8.1f %8.1f | %8s  (n=%d)',
        name, o.grass, o.plaza, o.facade, diff, o.n);
    } else {
      console.log(name + '  -> 采样失败');
    }
    await sleep(250);
  }
  ws.close(); child.kill('SIGKILL'); setTimeout(()=>process.exit(0),300);
})().catch(e => { console.error('ERR', e.message); try{child.kill('SIGKILL');}catch(x){} process.exit(1); });
