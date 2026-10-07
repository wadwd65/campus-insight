/* 把所有 mesh 投影到屏幕，列出落在画布内但离"三栋楼屏幕范围"较远的图元 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('tower.html').replace(/\\/g,'/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9513;
const child = spawn(EDGE, ['--headless=new','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--window-size=1440,960','--user-data-dir='+path.resolve('.cdp-scr'), html], {stdio:'ignore'});
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
      c=box.getCenter(new THREE.Vector3());
      p=c.clone().project(camera);
      var sx=(p.x*0.5+0.5)*W, sy=(-p.y*0.5+0.5)*H;
      if(sx<0||sx>W||sy<0||sy>H) return;
      sz=box.getSize(new THREE.Vector3());
      /* 建筑群屏幕范围粗估：x 380~830, y 200~580 */
      if(sx<360 || sx>860 || sy<180 || sy>620)
        out.push({sx:Math.round(sx), sy:Math.round(sy), x:+c.x.toFixed(2), y:+c.y.toFixed(2), z:+c.z.toFixed(2), w:+sz.x.toFixed(2), h:+sz.y.toFixed(2), dp:+sz.z.toFixed(2), mat:(o.material&&o.material.color)?('#'+o.material.color.getHexString()):'?', geo:o.geometry.type});
    });
    return JSON.stringify({n:out.length, items:out.slice(0,25)});
  })()`;
  const r = await send('Runtime.evaluate', {expression: PROBE, returnByValue: true});
  console.log(((r.result&&r.result.result&&r.result.result.value)||JSON.stringify(r).slice(0,600)));
  child.kill();
})();
