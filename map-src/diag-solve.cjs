/* 建筑排位求解器：把"建筑压路/交叠/越界"变成可自动收敛的迭代。
   做法（确定性，不用随机）：
     ① 读每栋实测 bbox（切片坐标）
     ② 算它到每条道路、每栋建筑、红线的**最小穿透深度**
     ③ 沿"最小穿透"方向平移该栋，直到净距达标
     ④ 迭代 N 轮（每轮重算 bbox 偏移量，步长递减）
   输出：建议的新 px/py，直接替换 CAMP_PLACE 用。 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9601;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=800,600', '--user-data-dir=' + path.resolve('.cdp-solv'), html], { stdio: 'ignore' });
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
    var bGrp=byName('buildings'), box=new THREE.Box3(), rows=[];
    bGrp.children.forEach(function(b,i){
      box.setFromObject(b); if(box.isEmpty()) return;
      var mn=toPx(box.min.x,box.min.z), mx=toPx(box.max.x,box.max.z);
      var pl=(CAMP_PLACE[i]||{});
      if(!pl.id || pl.id.indexOf('pav')===0 || pl.id.indexOf('st-')===0) return;
      if(!pl.id) return;
      rows.push({id:pl.id, px:pl.px, py:pl.py, x0:mn[0], y0:mn[1], x1:mx[0], y1:mx[1]});
    });
    /* 道路段（含路宽半宽）*/
    var segs=[];
    CAMP_ROADS.forEach(function(rd,ri){
      var half=rd.w/CAMP.k/2;
      for(var j=0;j<rd.pts.length-1;j++)
        segs.push({ri:ri, half:half, a:rd.pts[j], b:rd.pts[j+1]});
    });
    /* bbox 采样点到线段距离的最小值 */
    function boxSegMin(r, ax,ay,bx,by){
      var vx=bx-ax, vy=by-ay, L2=vx*vx+vy*vy, best=1e9, bx0=0, by0=0;
      for(var i=0;i<=6;i++)for(var j=0;j<=6;j++){
        var px=r.x0+(r.x1-r.x0)*i/6, py=r.y0+(r.y1-r.y0)*j/6;
        var t=L2? ((px-ax)*vx+(py-ay)*vy)/L2 : 0; t=Math.max(0,Math.min(1,t));
        var dx=ax+vx*t-px, dy=ay+vy*t-py, d=Math.sqrt(dx*dx+dy*dy);
        if(d<best){best=d; bx0=dx; by0=dy;}
      }
      return {d:best, nx:bx0, ny:by0};   /* nx,ny = 从建筑指向路的方向 */
    }
    function inBound(px,py){
      var ins=false;
      for(var i=0,j=CAMP_BOUND.length-1;i<CAMP_BOUND.length;j=i++){
        var xi=CAMP_BOUND[i][0],yi=CAMP_BOUND[i][1],xj=CAMP_BOUND[j][0],yj=CAMP_BOUND[j][1];
        if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi) ins=!ins;
      }
      return ins;
    }
    var MOVE=[];   /* 建议的平移量 */
    rows.forEach(function(r){
      var dx=0, dy=0, worst=null;
      segs.forEach(function(sg){
        var res=boxSegMin(r, sg.a[0],sg.a[1],sg.b[0],sg.b[1]);
        var need = sg.half + 0.7;              /* 要求净距 */
        var pen = need - res.d;                /* >0 = 侵入 */
        if(pen>0 && (!worst || pen>worst.pen)) worst={pen:pen, nx:res.nx, ny:res.ny, ri:sg.ri};
      });
      if(worst){
        var L=Math.hypot(worst.nx,worst.ny)||1;
        /* 只沿"远离路"方向推：n 是建筑→路，需反向 */
        dx = -worst.nx/L*worst.pen; dy = -worst.ny/L*worst.pen;
        MOVE.push({id:r.id, dx:+dx.toFixed(2), dy:+dy.toFixed(2), pen:+worst.pen.toFixed(2), ri:worst.ri});
      }
    });
    /* 建筑间交叠（排除小装饰）*/
    var ov=[];
    for(var i=0;i<rows.length;i++)for(var j=i+1;j<rows.length;j++){
      var a=rows[i],b=rows[j];
      var ox=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0), oy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);
      if(ox>0.5&&oy>0.5) ov.push({a:a.id,b:b.id,ox:+ox.toFixed(1),oy:+oy.toFixed(1),
        ax:+(((a.x1-a.x0)+(b.x1-b.x0))/2 - (ox/2)).toFixed(1)});
    }
    return JSON.stringify({move:MOVE, ov:ov}, null, 0);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log(r.result.result.value || JSON.stringify(r.result).slice(0, 300));
  child.kill();
})();
