/* campus.html 红线外物体探针：找出包围盒中心落在用地红线外的所有构件，
   并按"直属 CAMP_STAGE 的子组"归类，定位是哪个子系统漏的。 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9527;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1440,960', '--user-data-dir=' + path.resolve('.cdp-out'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0, pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(8000);
  const PROBE = `(function(){
    function inBound(px,py){
      var inside=false;
      for(var i=0,j=CAMP_BOUND.length-1;i<CAMP_BOUND.length;j=i++){
        var xi=CAMP_BOUND[i][0],yi=CAMP_BOUND[i][1],xj=CAMP_BOUND[j][0],yj=CAMP_BOUND[j][1];
        if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside;
      }
      return inside;
    }
    var stage=window.__CAMP.stage();
    var box=new THREE.Box3(), out=[];
    stage.children.forEach(function(sub,si){
      sub.traverse(function(o){
        if(!o.isMesh) return;
        if(o.userData&&o.userData.noFrame) return;
        if(o.geometry&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters&&o.geometry.parameters.width>60) return;
        box.setFromObject(o); if(box.isEmpty()) return;
        var c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
        var px=c.x/CAMP.k+CAMP.ox, py=c.z/CAMP.k+CAMP.oz;
        if(!inBound(px,py)){
          out.push({sub:si, px:+px.toFixed(1), py:+py.toFixed(1),
            w:+(sz.x).toFixed(1), h:+(sz.y).toFixed(1), d:+(sz.z).toFixed(1),
            col:(o.material&&o.material.color)?('#'+o.material.color.getHexString()):'?'});
        }
      });
    });
    /* 汇总：每个子组各多少个越界 + 前 30 个明细 */
    var agg={};
    out.forEach(function(r){ agg[r.sub]=(agg[r.sub]||0)+1; });
    /* 按 5px 网格聚类，看越界物集中在哪 */
    var grid={};
    out.forEach(function(r){
      var k=r.sub+'@('+Math.round(r.px/5)*5+','+Math.round(r.py/5)*5+')';
      grid[k]=(grid[k]||0)+1;
    });
    var ks=Object.keys(grid).sort(function(a,b){return grid[b]-grid[a];});
    var top=ks.slice(0,20).map(function(k){return k+'×'+grid[k];});
    return JSON.stringify({total:out.length, bySub:agg, top:top}, null, 0);
  })()`;
  const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
  const v = r.result && r.result.result && r.result.result.value;
  console.log(v ? v : JSON.stringify(r).slice(0, 2000));
  child.kill();
})();
