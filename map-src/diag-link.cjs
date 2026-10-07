/* 公寓连廊验证：连廊两端是否真的碰到相邻院落的墙面（"连在一起"= 几何相连） */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9611;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=900,600', '--user-data-dir=' + path.resolve('.cdp-lnk'), html], { stdio: 'ignore' });
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
    var link=byName('aptlinks'), bld=byName('buildings');
    function bb(o){var b=new THREE.Box3().setFromObject(o); if(b.isEmpty())return null;
      var mn=toPx(b.min.x,b.min.z), mx=toPx(b.max.x,b.max.z); return {x0:mn[0],y0:mn[1],x1:mx[0],y1:mx[1]};}
    /* 每个公寓的 bbox */
    var apts=[];
    bld.children.forEach(function(b,i){
      var id=(CAMP_PLACE[i]||{}).id||'';
      if(id.indexOf('apt-')!==0) return;
      var r=bb(b); if(r) apts.push({id:id, r:r});
    });
    apts.sort(function(a,b){return a.r.y0-b.r.y0;});
    /* 每条连廊与相邻两个公寓的间隙 */
    var rep=[];
    link.children.forEach(function(L,li){
      var lr=bb(L); if(!lr) return;
      /* 找它在 y 方向上下的两个公寓 */
      var below=null, above=null;
      apts.forEach(function(a){
        if(a.r.y1<=lr.y0+0.6 && (!below||a.r.y1>below.r.y1)) below=a;
        if(a.r.y0>=lr.y1-0.6 && (!above||a.r.y0<above.r.y0)) above=a;
      });
      rep.push({link:li, y:[+lr.y0.toFixed(1),+lr.y1.toFixed(1)], x:[+lr.x0.toFixed(1),+lr.x1.toFixed(1)],
        below: below? below.id+' 顶'+below.r.y1.toFixed(1):'无',
        above: above? above.id+' 底'+above.r.y0.toFixed(1):'无',
        gapBelow: below? +(lr.y0-below.r.y1).toFixed(2) : null,
        gapAbove: above? +(above.r.y0-lr.y1).toFixed(2) : null});
    });
    return JSON.stringify({apts:apts.map(function(a){return {id:a.id,y:[+a.r.y0.toFixed(1),+a.r.y1.toFixed(1)]};}), links:rep}, null, 0);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log(r.result.result.value || JSON.stringify(r.result).slice(0, 300));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot.result && shot.result.data) { fs.writeFileSync('lnk-check.png', Buffer.from(shot.result.data, 'base64')); }
  child.kill();
})();
