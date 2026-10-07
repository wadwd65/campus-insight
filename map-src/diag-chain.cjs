const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('tower.html').replace(/\\/g,'/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9515;
const child = spawn(EDGE, ['--headless=new','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--window-size=1440,960','--user-data-dir='+path.resolve('.cdp-ch'), html], {stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  let ws, id=0, pend=new Map();
  const send = (m,p) => new Promise(res=>{ const i=++id; pend.set(i,res); ws.send(JSON.stringify({id:i,method:m,params:p})); });
  for (let i=0;i<60;i++){ try { const r=await fetch('http://127.0.0.1:'+PORT+'/json'); const l=await r.json(); const t=l.find(x=>x.type==='page'); if(t){ ws=new WebSocket(t.webSocketDebuggerUrl); break; } } catch(e){} await sleep(200); }
  await new Promise(r=>ws.addEventListener('open',r));
  ws.addEventListener('message', e=>{ const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id);} });
  await send('Runtime.enable'); await sleep(6000);
  const PROBE = `(function(){
    var lines=[];
    lines.push('scene.children = '+scene.children.length);
    scene.children.forEach(function(o,i){ lines.push('  ['+i+'] '+o.type+' name='+(o.name||'')+' pos='+o.position.toArray().map(function(v){return v.toFixed(1);}).join(',')+' nchild='+o.children.length); });
    /* 找 x=-39.74 的那个楼梯间，回溯父链 */
    var box=new THREE.Box3(), c, hit=null;
    scene.traverse(function(o){
      if(hit||!o.isMesh) return;
      box.setFromObject(o); if(box.isEmpty()) return;
      c=box.getCenter(new THREE.Vector3());
      if(Math.abs(c.x-(-39.74))<0.5 && Math.abs(c.y-20.77)<0.5) hit=o;
    });
    if(hit){
      lines.push('--- 命中物链 ---');
      var q=hit, k=0;
      while(q && k<6){ lines.push('  L'+k+' '+q.type+' name='+(q.name||'')+' pos='+q.position.toArray().map(function(v){return v.toFixed(2);}).join(',')+' rot='+q.rotation.toArray().slice(0,3).map(function(v){return (+v).toFixed(2);}).join(',')+' child='+q.children.length+(q.parent?'':' [ROOT?]')); q=q.parent; k++; }
      lines.push('  ROOT-IS-SCENE? '+(q===null));
    } else lines.push('--- 未命中 ---');
    /* 统计所有 Group 的 name + 世界位置 */
    lines.push('--- 所有顶层 Group ---');
    scene.traverse(function(o){ if(o.isGroup){ var w=new THREE.Vector3(); o.getWorldPosition(w); lines.push('  G name='+(o.name||'')+' world='+w.toArray().map(function(v){return v.toFixed(1);}).join(',')+' kids='+o.children.length); } });
    return lines.join('\\n');
  })()`;
  const r = await send('Runtime.evaluate', {expression: PROBE, returnByValue: true});
  console.log(((r.result&&r.result.result&&r.result.result.value)||JSON.stringify(r).slice(0,600)));
  child.kill();
})();
