/* 找出视野里所有"离群"图元：距离三栋楼中心 > 45m 的构件 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const html = 'file:///' + path.resolve('tower.html').replace(/\\/g,'/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9511;
const child = spawn(EDGE, ['--headless=new','--disable-gpu-sandbox','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--window-size=1440,960','--user-data-dir='+path.resolve('.cdp-far'), html], {stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  let ws, id=0, pend=new Map();
  const send = (method, params) => new Promise(res=>{ const i=++id; pend.set(i,res); ws.send(JSON.stringify({id:i,method,params})); });
  for (let i=0;i<50;i++){ try { const r = await fetch('http://127.0.0.1:'+PORT+'/json'); const l = await r.json(); const t = l.find(x=>x.type==='page'); if(t){ ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch(e){} await sleep(200); }
  await new Promise(r=>ws.addEventListener('open',r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id);} });
  await send('Runtime.enable'); await sleep(5000);
  const PROBE = `(function(){
    var out=[], box=new THREE.Box3(), c, sz;
    var CENTERS=[[0,-13],[ -19,1],[19,1]];
    scene.traverse(function(o){
      if(!o.isMesh) return;
      if(o.geometry&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters&&o.geometry.parameters.width>100) return;
      box.setFromObject(o); c=box.getCenter(new THREE.Vector3()); sz=box.getSize(new THREE.Vector3());
      if(box.isEmpty()) return;
      var dx=c.x, dz=c.z;
      var dmin=1e9;
      for(var i=0;i<CENTERS.length;i++){ var d=Math.hypot(c.x-CENTERS[i][0], c.z-CENTERS[i][1]); if(d<dmin)dmin=d; }
      if(dmin>40) out.push({d:+dmin.toFixed(1), x:+c.x.toFixed(2), y:+c.y.toFixed(2), z:+c.z.toFixed(2), w:+sz.x.toFixed(2), h:+sz.y.toFixed(2), dp:+sz.z.toFixed(2), mat:(o.material&&o.material.color)?('#'+o.material.color.getHexString()):'?', geo:o.geometry.type});
    });
    out.sort(function(a,b){return b.d-a.d;});
    return JSON.stringify({n:out.length, top:out.slice(0,25)});
  })()`;
  const r = await send('Runtime.evaluate', {expression: PROBE, returnByValue: true});
  console.log(JSON.stringify(r.result && r.result.result && r.result.result.value || r, null, 1).slice(0,4000));
  child.kill();
})();
