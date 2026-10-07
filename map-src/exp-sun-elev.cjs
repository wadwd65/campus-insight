/**
 * v17c 光照结构性实验：太阳高度角 = 决定"水平面 vs 垂直面"的照度比。
 *   elev 54° ⇒ 水平面拿到 cos(0)=1、立面只拿到 cos(54°)=0.59  ⇒ 地面过亮
 *   elev 35° ⇒ 立面拿到 cos(35°)=0.82                          ⇒ 立面提亮
 * 目标：把"建筑−草坪"从 −46.4 拉到 ≈ −10 以内，**且不破坏用户已认可的观感**。
 * ★ 单变量：只动 sun.position 的高度分量，强度/色温/阴影贴图一律不动。
 */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
              'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const pagePath = process.argv[2] || 'tower.html';
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9300 + Math.floor(Math.random() * 80);
const profile = path.join(require('os').tmpdir(), 'cdp-sun-' + Date.now());
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

  /* 水平距离保持 69.3（hypot(52,46)），只变 y ⇒ 改变高度角 */
  const H = Math.hypot(52, 46).toFixed(1);
  const CASES = [
    ['A y=96 (elev 54°, 原样)',      96],
    ['B y=69 (elev 45°)',            69],
    ['C y=49 (elev 35°)',            49],
    ['D y=35 (elev 27°)',            35],
    ['E y=25 (elev 20°)',            25]
  ];
  console.log('%-26s %8s %8s %8s | %9s %8s', '变体', '草坪', '广场', '建筑', '建筑-草坪', '阴影面积%');
  for (const [name, yy] of CASES) {
    const q = [
      '(function(){',
      '  var T = window.__three; var s = T.scene, cam = T.camera;',
      '  s.traverse(function(o){ if(o.isLight && o.isDirectionalLight && o.castShadow){',
      '    o.position.set(-52, ' + yy + ', 46);',
      '    if(o.shadow && o.shadow.camera){ o.shadow.camera.updateProjectionMatrix(); }',
      '  }});',
      '  T.renderer.shadowMap.needsUpdate = true;',
      '  T.renderer.render(s, cam);',
      '  var cv = T.renderer.domElement;',
      '  var g2 = document.createElement("canvas"); g2.width=cv.width; g2.height=cv.height;',
      '  var cx = g2.getContext("2d"); cx.drawImage(cv,0,0);',
      '  var W=g2.width,H=g2.height, d=cx.getImageData(0,0,W,H).data;',
      '  var CX=W*0.394, CY=H*0.44;',
      '  var acc={grass:[0,0],plaza:[0,0],facade:[0,0]}, dark=0, tot=0;',
      '  for(var y=0;y<H;y+=3){ for(var x=0;x<W;x+=3){',
      '    var i=(y*W+x)*4, r=d[i], gg=d[i+1], b=d[i+2];',
      '    var lum=0.299*r+0.587*gg+0.114*b;',
      '    var dd=Math.hypot(x-CX,y-CY); tot++;',
      '    if(lum < 0.55*255 && dd>W*0.10) dark++;',
      '    if(r>gg+22&&r>b+30&&r>120){acc.facade[0]+=lum;acc.facade[1]++;}',
      '    else if(dd<W*0.13&&Math.abs(r-gg)<10&&Math.abs(gg-b)<14){acc.plaza[0]+=lum;acc.plaza[1]++;}',
      '    else if(dd>W*0.46&&gg>r+6&&gg>b+6){acc.grass[0]+=lum;acc.grass[1]++;}',
      '  }}',
      '  function m(a){return a[1]?a[0]/a[1]:0;}',
      '  return JSON.stringify({grass:+m(acc.grass).toFixed(1),plaza:+m(acc.plaza).toFixed(1),',
      '    facade:+m(acc.facade).toFixed(1), darkPct:+(100*dark/tot).toFixed(2)});',
      '})()'
    ].join('\n');
    const r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
    if (r.result && r.result.result && r.result.result.value) {
      const o = JSON.parse(r.result.result.value);
      console.log('%-26s %8.1f %8.1f %8.1f | %9s %8s',
        name, o.grass, o.plaza, o.facade, (o.facade-o.grass).toFixed(1), o.darkPct);
    } else { console.log(name + ' 失败'); }
    await sleep(250);
  }
  ws.close(); child.kill('SIGKILL'); setTimeout(()=>process.exit(0),300);
})().catch(e => { console.error('ERR', e.message); try{child.kill('SIGKILL');}catch(x){} process.exit(1); });
