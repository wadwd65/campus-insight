/* campus.html 布局碰撞体检：
   ① 逐栋建筑的包围盒（切片坐标）② 建筑两两交叠 ③ 建筑压湖/压田径场
   ④ 道路折线与建筑包围盒相交 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9528;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=1440,960', '--user-data-dir=' + path.resolve('.cdp-ovl'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0, pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(8000);
  const PROBE = `(function(){
    function byName(n){var st=window.__CAMP.stage();for(var i=0;i<st.children.length;i++)if(st.children[i].name===n)return st.children[i];return null;}
    function toPx(x,z){ return [x/CAMP.k+CAMP.ox, z/CAMP.k+CAMP.oz]; }
    var stage=window.__CAMP.stage();
    var bGrp=byName('buildings');
    var box=new THREE.Box3(), rows=[];
    bGrp.children.forEach(function(b,i){
      box.setFromObject(b); if(box.isEmpty()) return;
      var mn=toPx(box.min.x,box.min.z), mx=toPx(box.max.x,box.max.z);
      var pl=CAMP_PLACE[i]||{};
      rows.push({id:pl.id||('#'+i), x0:+mn[0].toFixed(1), y0:+mn[1].toFixed(1),
        x1:+mx[0].toFixed(1), y1:+mx[1].toFixed(1), h:+(box.max.y).toFixed(1)});
    });
    /* ① 两两交叠（容差 0.4px）*/
    var ovl=[];
    for(var i=0;i<rows.length;i++)for(var j=i+1;j<rows.length;j++){
      var a=rows[i],b=rows[j];
      var ox=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0), oy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);
      if(ox>0.4&&oy>0.4) ovl.push(a.id+'×'+b.id+' ('+ox.toFixed(1)+'×'+oy.toFixed(1)+'px)');
    }
    /* ② 压湖（椭圆<1.06 或臂道）/ 压田径场 */
    function inLake(px,py){
      var dx=(px-CAMP_LAKE.px)/(CAMP_LAKE.rx*1.06), dz=(py-CAMP_LAKE.py)/(CAMP_LAKE.rz*1.06);
      if(dx*dx+dz*dz<1) return true;
      var sp=CAMP_LAKE_ARM.spine, lim=CAMP_LAKE_ARM.w/2*1.4;
      for(var i=0;i<sp.length-1;i++){
        var ax=sp[i][0],ay=sp[i][1],bx=sp[i+1][0],by=sp[i+1][1];
        var vx=bx-ax,vy=by-ay,t=((px-ax)*vx+(py-ay)*vy)/(vx*vx+vy*vy);
        t=Math.max(0,Math.min(1,t));
        var ex=ax+vx*t-px,ey=ay+vy*t-py;
        if(ex*ex+ey*ey<lim*lim) return true;
      }
      return false;
    }
    var bad=[];
    rows.forEach(function(r){
      if(r.id==='track') return;
      var pts=[[r.x0,r.y0],[r.x1,r.y0],[r.x0,r.y1],[r.x1,r.y1],[(r.x0+r.x1)/2,(r.y0+r.y1)/2]];
      for(var k=0;k<pts.length;k++){
        if(inLake(pts[k][0],pts[k][1])){ bad.push(r.id+' 压湖@('+pts[k][0].toFixed(0)+','+pts[k][1].toFixed(0)+')'); break; }
      }
      var inT = r.x0 < CAMP_TRACK.px+CAMP_TRACK.L/2+1 && r.x1 > CAMP_TRACK.px-CAMP_TRACK.L/2-1 &&
                r.y0 < CAMP_TRACK.py+CAMP_TRACK.W/2+1 && r.y1 > CAMP_TRACK.py-CAMP_TRACK.W/2-1;
      if(inT) bad.push(r.id+' 压田径场');
    });
    return JSON.stringify({n:rows.length, rows:rows, overlap:ovl, bad:bad}, null, 0);
  })()`;
  const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
  const v = r.result && r.result.result && r.result.result.value;
  console.log(v ? v : JSON.stringify(r).slice(0, 2000));
  child.kill();
})();
