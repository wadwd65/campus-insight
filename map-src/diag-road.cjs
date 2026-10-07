/* 建筑 vs 道路冲突探针：把每栋建筑包围盒与每条道路中心线（按路宽求最近距离）比对 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9591;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=900,600', '--user-data-dir=' + path.resolve('.cdp-rd'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0; const pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(10000);
  const P = `(function(){
    function byName(n){var st=window.__CAMP.stage();for(var i=0;i<st.children.length;i++)if(st.children[i].name===n)return st.children[i];return null;}
    function toPx(x,z){ return [x/CAMP.k+CAMP.ox, z/CAMP.k+CAMP.oz]; }
    var bGrp=byName('buildings');
    var box=new THREE.Box3(), rows=[];
    bGrp.children.forEach(function(b,i){
      box.setFromObject(b); if(box.isEmpty()) return;
      var mn=toPx(box.min.x,box.min.z), mx=toPx(box.max.x,box.max.z);
      var pl=(CAMP_PLACE[i]||{});
      rows.push({id:pl.id||('#'+i), x0:mn[0], y0:mn[1], x1:mx[0], y1:mx[1],
        w:+(mx[0]-mn[0]).toFixed(1), d:+(mx[1]-mn[1]).toFixed(1)});
    });
    /* 道路：线段集合 + 路宽(px) */
    function segDist(px,py, ax,ay, bx,by){
      var vx=bx-ax, vy=by-ay;
      var t=((px-ax)*vx+(py-ay)*vy)/(vx*vx+vy*vy);
      t=Math.max(0,Math.min(1,t));
      return Math.hypot(ax+vx*t-px, ay+vy*t-py);
    }
    function boxSegDist(r, ax,ay,bx,by){
      /* 采样 5x5 点取最小距离（够用的确定性近似）*/
      var best=1e9;
      for(var i=0;i<=4;i++)for(var j=0;j<=4;j++){
        var px=r.x0+(r.x1-r.x0)*i/4, py=r.y0+(r.y1-r.y0)*j/4;
        best=Math.min(best, segDist(px,py,ax,ay,bx,by));
      }
      return best;
    }
    var hits=[];
    CAMP_ROADS.forEach(function(rd,ri){
      var half=rd.w/CAMP.k/2;
      for(var j=0;j<rd.pts.length-1;j++){
        var a=rd.pts[j], b=rd.pts[j+1];
        rows.forEach(function(r){
          if(r.w<0.5) return;              /* 空组跳过 */
          var d=boxSegDist(r,a[0],a[1],b[0],b[1]);
          if(d<half) hits.push(r.id+' × 道路'+ri+'(w'+rd.w+') 距离'+d.toFixed(2)+' < 半宽'+half.toFixed(2));
        });
      }
    });
    return JSON.stringify({rows:rows, hits:hits}, null, 0);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  const v = r.result.result.value;
  if (!v) { console.log(JSON.stringify(r.result).slice(0, 400)); child.kill(); return; }
  const d = JSON.parse(v);
  console.log('=== 建筑落位 ===');
  d.rows.forEach(r => console.log(`  ${r.id.padEnd(11)} ${r.w.toFixed(1)}x${r.d.toFixed(1)}px  x[${r.x0.toFixed(0)},${r.x1.toFixed(0)}] y[${r.y0.toFixed(0)},${r.y1.toFixed(0)}]`));
  console.log('=== 压路 ===');
  d.hits.forEach(h => console.log('  ' + h));
  child.kill();
})();
