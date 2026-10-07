/**
 * 立面"砖红被洗掉"定位：直接问 three.js 每个 wall 材质的
 *   color / map 有无 / map 尺寸 / repeat / encoding，
 * 并做**像素反算**：把贴图读回来，算 map×color 的期望值 vs 实际渲染值。
 */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
              'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const pagePath = process.argv[2] || 'tower.html';
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9400 + Math.floor(Math.random() * 80);
const profile = path.join(require('os').tmpdir(), 'cdp-brk-' + Date.now());
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
    '  var T = window.__three; var s = T.scene;',
    '  var seen = {}, out = [];',
    '  s.traverse(function(o){',
    '    if(!o.isMesh || !o.material) return;',
    '    var m = Array.isArray(o.material)?o.material[0]:o.material;',
    '    if(!m.color) return;',
    '    var h = m.color.getHexString();',
    '    /* 只关心砖红系（R 明显 > G,B）*/',
    '    var c = m.color;',
    '    if(!(c.r > c.g*1.25 && c.r > c.b*1.25)) return;',
    '    var key = h + "|" + (m.map?"map":"nomap") + "|" + m.type;',
    '    if(seen[key]){ seen[key].n++; return; }',
    '    var mt = null;',
    '    if(m.map && m.map.image){',
    '      try{',
    '        var cv=document.createElement("canvas"); cv.width=8; cv.height=8;',
    '        var cx=cv.getContext("2d"); cx.drawImage(m.map.image,0,0,8,8);',
    '        var d=cx.getImageData(0,0,8,8).data;',
    '        /* 取中心 4 像素均值 */',
    '        var R=0,G=0,B=0,k=0;',
    '        for(var i=0;i<d.length;i+=4){ R+=d[i];G+=d[i+1];B+=d[i+2];k++; }',
    '        mt = [Math.round(R/k),Math.round(G/k),Math.round(B/k)];',
    '      }catch(e){ mt = "ERR:"+e.message; }',
    '    }',
    '    seen[key] = { n:1, col:h, type:m.type, hasMap:!!m.map,',
    '      mapAvg: mt, mapW: m.map?m.map.image.width:0,',
    '      rep: m.map?[m.map.repeat.x,m.map.repeat.y]:null,',
    '      enc: m.map?m.map.encoding:null, vc: m.vertexColors };',
    '    out.push(seen[key]);',
    '  });',
    '  out.sort(function(a,b){return b.n-a.n;});',
    '  return JSON.stringify(out.slice(0,12));',
    '})()'
  ].join('\n');
  const r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
  const o = JSON.parse(r.result.result.value);
  o.forEach(g => {
    const exp = (g.mapAvg && Array.isArray(g.mapAvg))
      ? '  期望 map x color = rgb(' +
        Math.round(g.mapAvg[0] * parseInt(g.col.slice(0,2),16) / 255) + ',' +
        Math.round(g.mapAvg[1] * parseInt(g.col.slice(2,4),16) / 255) + ',' +
        Math.round(g.mapAvg[2] * parseInt(g.col.slice(4,6),16) / 255) + ')'
      : '';
    console.log('  ' + String(g.n).padStart(5) + 'x  #' + g.col + '  ' + g.type.padEnd(22) +
      ' map=' + (g.hasMap ? ('YES ' + g.mapW + 'px avg rgb(' + g.mapAvg + ')') : 'NO ') +
      ' rep=' + JSON.stringify(g.rep) + ' enc=' + g.enc + ' vc=' + g.vc);
    if (exp) console.log('        ' + exp);
  });
  ws.close(); child.kill('SIGKILL'); setTimeout(()=>process.exit(0),300);
})().catch(e => { console.error('ERR', e.message); try{child.kill('SIGKILL');}catch(x){} process.exit(1); });
