/* 找出所有 y 中心 > 30m 或 y 中心 < -1m 的图元（悬空/陷地） */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('tower.html').replace(/\\/g,'/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9512;
const child = spawn(EDGE, ['--headless=new','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--window-size=1440,960','--user-data-dir='+path.resolve('.cdp-tall'), html], {stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  let ws, id=0, pend=new Map();
  const send = (method, params) => new Promise(res=>{ const i=++id; pend.set(i,res); ws.send(JSON.stringify({id:i,method,params})); });
  for (let i=0;i<60;i++){ try { const r = await fetch('http://127.0.0.1:'+PORT+'/json'); const l = await r.json(); const t = l.find(x=>x.type==='page'); if(t){ ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch(e){} await sleep(200); }
  await new Promise(r=>ws.addEventListener('open',r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id);} });
  await send('Runtime.enable'); await sleep(6000);
  const PROBE = `(function(){
    var out=[], box=new THREE.Box3(), c, sz;
    scene.traverse(function(o){
      if(!o.isMesh) return;
      if(o.geometry&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters&&o.geometry.parameters.width>100) return;
      box.setFromObject(o); if(box.isEmpty()) return;
      c=box.getCenter(new THREE.Vector3()); sz=box.getSize(new THREE.Vector3());
      if(c.y>28 || box.min.y<-0.05) out.push({y:+c.y.toFixed(2), ymin:+box.min.y.toFixed(2), ymax:+box.max.y.toFixed(2), x:+c.x.toFixed(2), z:+c.z.toFixed(2), w:+sz.x.toFixed(2), h:+sz.y.toFixed(2), dp:+sz.z.toFixed(2), mat:(o.material&&o.material.color)?('#'+o.material.color.getHexString()):'?', geo:o.geometry.type, name:o.name||''});
    });
    out.sort(function(a,b){return b.y-a.y;});
    return JSON.stringify({total:scene.children.length, n:out.length, top:out.slice(0,20)});
  })()`;
  const r = await send('Runtime.evaluate', {expression: PROBE, returnByValue: true});
  console.log((r.result && r.result.result && r.result.result.value) || JSON.stringify(r).slice(0,800));
  child.kill();
})();
