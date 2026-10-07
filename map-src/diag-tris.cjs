/* campus.html 三角面统计：整体 + 单棵树 + 单盏灯 + 单条长椅 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9531;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1440,960', '--user-data-dir=' + path.resolve('.cdp-tri'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0, pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(9000);
  const PROBE = `(function(){
    function triOf(o){
      var t=0;
      if(o.isMesh || o.isInstancedMesh){
        var gm=o.geometry;
        if(gm){
          if(gm.index) t += gm.index.count/3 * (o.isInstancedMesh? o.count : 1);
          else if(gm.attributes.position) t += gm.attributes.position.count/3 * (o.isInstancedMesh? o.count : 1);
        }
      }
      for(var i=0;i<o.children.length;i++) t+=triOf(o.children[i]);
      return t;
    }
    var stage=window.__CAMP.stage();
    var out={total:0, subs:[]};
    stage.children.forEach(function(c,ci){
      var t=triOf(c), m=0;
      c.traverse(function(o){ if(o.isMesh) m++; });
      out.subs.push({i:ci, tris:Math.round(t), meshes:m});
      out.total+=t;
    });
    /* 单独造一棵树/一盏灯/一条长椅数面数 */
    function proto(fn, args){
      var o = fn.apply(null, args);
      return {tris: Math.round(triOf(o)), meshes: (function(){var n=0;o.traverse(function(x){if(x.isMesh)n++;});return n;})()};
    }
    var mt = mat(0x4A3A2C,{}), ml = mat(0x3E5E28,{});
    out.tree = proto(propTree, [9, mt, ml, 11]);
    out.tree2 = proto(propTree, [7.4, mt, ml, 12]);
    /* 场景里实际的树（从 campGreen 里抓一个 Group 当样本）*/
    var green = stage.children[stage.children.length-4];
    /* 找路灯：campFurniture 是倒数第二或第三，遍历找带 pole 的 Group */
    var found={lamp:null, bench:null};
    stage.traverse(function(o){
      if(found.lamp) return;
      if(o.isGroup && o.children.length>=6 && o.children[0] && o.children[0].geometry &&
         o.children[0].geometry.type==='BoxGeometry' && o.children.length===7){
        if(!found.lamp) found.lamp = o;
      }
    });
    if(found.lamp) out.lamp = {tris: Math.round(triOf(found.lamp))};
    var st = window.__CAMP.stat();
    return JSON.stringify({total: Math.round(out.total), subs: out.subs, tree: out.tree, tree2: out.tree2, lamp: out.lamp, stat: st}, null, 0);
  })()`;
  const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
  const v = r.result && r.result.result && r.result.result.value;
  console.log(v ? v : JSON.stringify(r).slice(0, 1500));
  child.kill();
})();
