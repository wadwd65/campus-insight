/**
 * 屋顶设备审计：把"屋面上所有附属物"按材质色清点，并算出每个的屏幕尺寸。
 * 判据：任何 <10px 的构件 = 噪点；任何 0xE4E0D8 家族 = 仍在复用窗套白。
 */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
              'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const pagePath = process.argv[2] || 'tower.html';
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9100 + Math.floor(Math.random() * 90);
const profile = path.join(require('os').tmpdir(), 'cdp-rk-' + Date.now());
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
    '  var W = window.innerWidth, H = window.innerHeight;',
    '  var R = [];',
    '  var v = new THREE.Vector3(), bb = new THREE.Box3(), sz = new THREE.Vector3();',
    '  s.traverse(function(o){',
    '    if (!o.isMesh || !o.material) return;',
    '    var m = Array.isArray(o.material) ? o.material[0] : o.material;',
    '    var col = m.color ? m.color.getHexString() : "-";',
    '    var g2 = o.geometry; if (!g2) return;',
    '    if (!g2.boundingBox) g2.computeBoundingBox();',
    '    bb.copy(g2.boundingBox).applyMatrix4(o.matrixWorld);',
    '    if (bb.min.y < 18) return;',
    '    sz.subVectors(bb.max, bb.min);',
    '    var pts = [];',
    '    for (var i=0;i<8;i++){',
    '      pts.push(new THREE.Vector3(i&1?bb.max.x:bb.min.x, i&2?bb.max.y:bb.min.y, i&4?bb.max.z:bb.min.z).project(cam));',
    '    }',
    '    var xs = pts.map(function(p){return (p.x*0.5+0.5)*W;});',
    '    var ys = pts.map(function(p){return (-p.y*0.5+0.5)*H;});',
    '    var pxW = Math.max.apply(null,xs)-Math.min.apply(null,xs);',
    '    var pxH = Math.max.apply(null,ys)-Math.min.apply(null,ys);',
    '    R.push({ col: col, geo: g2.type,',
    '      dim: [+sz.x.toFixed(2), +sz.y.toFixed(2), +sz.z.toFixed(2)],',
    '      px: [Math.round(pxW), Math.round(pxH)],',
    '      pos: [+bb.min.x.toFixed(1), +bb.min.y.toFixed(1), +bb.min.z.toFixed(1)],',
    '      tri: g2.index ? g2.index.count/3 : g2.attributes.position.count/3 });',
    '  });',
    '  var agg = {};',
    '  R.forEach(function(r){',
    '    var k = r.col+"|"+r.geo+"|"+r.dim.join("x")+"|"+r.px.join("x");',
    '    if (!agg[k]) agg[k] = { n:0, col:r.col, geo:r.geo, dim:r.dim, px:r.px, tri:r.tri, y:r.pos[1] };',
    '    agg[k].n++;',
    '  });',
    '  var arr = Object.keys(agg).map(function(k){return agg[k];});',
    '  arr.sort(function(a,b){ return b.n - a.n; });',
    '  return JSON.stringify({ total: R.length, groups: arr });',
    '})()'
  ].join('\n');
  const r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
  const o = JSON.parse(r.result.result.value);
  console.log('屋顶以上网格总数: ' + o.total);
  console.log('--- 按 色|几何|尺寸|屏幕px 聚合（前 30）---');
  o.groups.slice(0,30).forEach(g => {
    console.log('  ' + String(g.n).padStart(4) + 'x  #' + g.col + '  ' + g.geo.replace('Geometry','').padEnd(10) +
      ' dim ' + g.dim.join('x') + '  -> 屏幕 ' + g.px[0] + 'x' + g.px[1] + 'px  y=' + g.y + '  tri=' + g.tri);
  });
  var tiny = o.groups.filter(g => Math.max(g.px[0],g.px[1]) < 10);
  var tsum = tiny.reduce((a,b)=>a+b.n,0);
  console.log('\n* 屏幕 <10px 的构件组: ' + tiny.length + ' 组 / 共 ' + tsum + ' 个网格');
  const WHITE = ['e4e0d8','e8e4dc','ddd9d1','eae6de','dedad2'];
  var wht = o.groups.filter(g => WHITE.indexOf(g.col.toLowerCase()) >= 0);
  console.log('* 仍在用"窗套白"家族的屋顶构件组: ' + wht.map(g=>'#'+g.col+'x'+g.n).join(', '));
  ws.close(); child.kill('SIGKILL'); setTimeout(()=>process.exit(0),300);
})().catch(e => { console.error('ERR', e.message); try{child.kill('SIGKILL');}catch(x){} process.exit(1); });
