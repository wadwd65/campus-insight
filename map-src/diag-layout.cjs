/* 布局体检：每栋建筑世界坐标 → 切片坐标 → 是否在红线内；湖/跑道/台地/地面位置 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9621;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=800,600', '--user-data-dir=' + path.resolve('.cdp-chk'), html], { stdio: 'ignore' });
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
    function toSlice(x,z){ return [x/CAMP.k+CAMP.ox, z/CAMP.k+CAMP.oz]; }
    function inBound(px,py){
      var ins=false;
      for(var i=0,j=CAMP_BOUND.length-1;i<CAMP_BOUND.length;j=i++){
        var xi=CAMP_BOUND[i][0],yi=CAMP_BOUND[i][1],xj=CAMP_BOUND[j][0],yj=CAMP_BOUND[j][1];
        if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi) ins=!ins;
      }
      return ins;
    }
    var out={};
    // 建筑
    var bGrp=byName('buildings'), box=new THREE.Box3(), rows=[], outside=[];
    bGrp.children.forEach(function(b,i){
      box.setFromObject(b); if(box.isEmpty()) return;
      var c=box.getCenter(new THREE.Vector3());
      var sl=toSlice(c.x,c.z);
      var pl=(CAMP_PLACE[i]||{});
      var inb=inBound(sl[0],sl[1]);
      rows.push({id:pl.id||('#'+i), px:+sl[0].toFixed(0), py:+sl[1].toFixed(0), in:inb});
      if(!inb) outside.push(pl.id||('#'+i));
    });
    out.buildings=rows; out.outsideBoundary=outside;
    // 湖/跑道/台地
    out.lake = {px:CAMP_LAKE.px, py:CAMP_LAKE.py, rx:CAMP_LAKE.rx, rz:CAMP_LAKE.rz};
    out.track = {px:CAMP_TRACK.px, py:CAMP_TRACK.py, L:CAMP_TRACK.L, W:CAMP_TRACK.W};
    out.ground = CAMP_G;
    // 树的组（green）中心分布
    var grp=byName('green'), treePts=[];
    if(grp){ grp.children.forEach(function(t){ var bb=new THREE.Box3().setFromObject(t); if(bb.isEmpty())return; var c=bb.getCenter(new THREE.Vector3()); var s=toSlice(c.x,c.z); treePts.push([+s[0].toFixed(0),+s[1].toFixed(0)]); }); }
    out.treeCount=treePts.length;
    out.treesSample=treePts.slice(0,8);
    return JSON.stringify(out);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log(r.result.result.value || JSON.stringify(r.result).slice(0, 400));
  child.kill();
})();
