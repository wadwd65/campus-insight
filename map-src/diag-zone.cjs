const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('tower.html').replace(/\\/g,'/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9514;
const child = spawn(EDGE, ['--headless=new','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--window-size=1440,960','--user-data-dir='+path.resolve('.cdp-zone'), html], {stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  let ws, id=0, pend=new Map();
  const send = (m,p) => new Promise(res=>{ const i=++id; pend.set(i,res); ws.send(JSON.stringify({id:i,method:m,params:p})); });
  for (let i=0;i<60;i++){ try { const r=await fetch('http://127.0.0.1:'+PORT+'/json'); const l=await r.json(); const t=l.find(x=>x.type==='page'); if(t){ ws=new WebSocket(t.webSocketDebuggerUrl); break; } } catch(e){} await sleep(200); }
  await new Promise(r=>ws.addEventListener('open',r));
  ws.addEventListener('message', e=>{ const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id);} });
  await send('Runtime.enable'); await sleep(6000);
  const PROBE = `(function(){
    var W=1440,H=960, out=[], box=new THREE.Box3(), c, sz, p;
    scene.traverse(function(o){
      if(!o.isMesh) return;
      if(o.geometry&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters&&o.geometry.parameters.width>100) return;
      box.setFromObject(o); if(box.isEmpty()) return;
      c=box.getCenter(new THREE.Vector3()); p=c.clone().project(camera);
      var sx=(p.x*0.5+0.5)*W, sy=(-p.y*0.5+0.5)*H;
      /* 只查左上漂着方块那一片：sx 420~640, sy 160~330 */
      if(sx<400||sx>660||sy<140||sy>340) return;
      sz=box.getSize(new THREE.Vector3());
      if(sz.x>4) return;   /* 排除地面 */
      out.push({sx:Math.round(sx), sy:Math.round(sy), x:+c.x.toFixed(2), y:+c.y.toFixed(2), z:+c.z.toFixed(2), w:+sz.x.toFixed(2), h:+sz.y.toFixed(2), dp:+sz.z.toFixed(2), mat:(o.material&&o.material.color)?('#'+o.material.color.getHexString()):'?', geo:o.geometry.type, par:o.parent&&o.parent.type});
    });
    out.sort((a,b)=>a.sy-b.sy);
    return JSON.stringify({n:out.length, items:out.slice(0,30)});
  })()`;
  const r = await send('Runtime.evaluate', {expression: PROBE, returnByValue: true});
  console.log(((r.result&&r.result.result&&r.result.result.value)||JSON.stringify(r).slice(0,600)));
  child.kill();
})();
