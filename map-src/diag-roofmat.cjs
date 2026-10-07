/* 逐个给屋面相关材质上色，量它在屋顶区的平均亮度 —— 找出是谁在过曝 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('tower.html').replace(/\\/g,'/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9520;
const child = spawn(EDGE, ['--headless=new','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--window-size=1440,960','--user-data-dir='+path.resolve('.cdp-rm'), html], {stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  let ws, id=0, pend=new Map();
  const send = (m,p) => new Promise(res=>{ const i=++id; pend.set(i,res); ws.send(JSON.stringify({id:i,method:m,params:p})); });
  for (let i=0;i<60;i++){ try { const r=await fetch('http://127.0.0.1:'+PORT+'/json'); const l=await r.json(); const t=l.find(x=>x.type==='page'); if(t){ ws=new WebSocket(t.webSocketDebuggerUrl); break; } } catch(e){} await sleep(200); }
  await new Promise(r=>ws.addEventListener('open',r));
  ws.addEventListener('message', e=>{ const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id);} });
  await send('Runtime.enable'); await sleep(6000);

  const PROBE = `(function(){
    var out=[], n=0;
    scene.traverse(function(o){ if(o.isMesh && o.material && o.material.color){ n++;
      var m=o.material, c=m.color, box=new THREE.Box3().setFromObject(o);
      var ctr=box.getCenter(new THREE.Vector3());
      /* 只看屋面高度（y>19.5）的构件 */
      if(ctr.y<19.5) return;
      out.push({hex:'#'+c.getHexString(), y:+ctr.y.toFixed(1), map:!!m.map, geo:o.geometry.type,
                rough:(m.roughness===undefined?'-':m.roughness.toFixed(2))});
    }});
    /* 按 hex 聚合 */
    var agg={};
    out.forEach(function(x){ var k=x.hex+'|map:'+x.map+'|r:'+x.rough; agg[k]=(agg[k]||0)+1; });
    var list=Object.keys(agg).map(function(k){return {k:k,n:agg[k]};}).sort(function(a,b){return b.n-a.n;});
    return JSON.stringify({meshesAboveRoof:out.length, groups:list.slice(0,18)}, null, 1);
  })()`;
  const r = await send('Runtime.evaluate', {expression: PROBE, returnByValue: true});
  console.log(((r.result&&r.result.result&&r.result.result.value)||JSON.stringify(r).slice(0,600)));
  child.kill();
})();
