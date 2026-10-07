/* 一次问清三件事：
   ① stage.children 顺序与各自内容（children[1] 到底是谁）
   ② 720m 地面 mesh 的 map.image 真实尺寸
   ③ __CAMP_GROUND_CV 是否存在 */
const { spawn } = require('child_process');
const path = require('path');
const html = 'file:///' + path.resolve('campus.html').replace(/\\/g, '/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9571;
const child = spawn(EDGE, ['--headless=new', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--remote-debugging-port=' + PORT, '--window-size=900,600', '--user-data-dir=' + path.resolve('.cdp-3q'), html], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let ws, id = 0; const pend = new Map();
  const send = (m, p) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  for (let i = 0; i < 60; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); const l = await r.json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) { } await sleep(200); }
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  await send('Runtime.enable'); await sleep(11000);
  const P = `(function(){
    var out={};
    var stage=window.__CAMP.stage();
    out.childCount=stage.children.length;
    out.children=[];
    stage.children.forEach(function(c,i){
      var meshes=0, inst=0, firstGeo='', firstMap='';
      c.traverse(function(o){
        if(o.isInstancedMesh) inst++;
        if(o.isMesh){
          meshes++;
          if(!firstGeo) firstGeo=o.geometry.type+(o.geometry.parameters&&o.geometry.parameters.width?('/w'+o.geometry.parameters.width):'');
          if(!firstMap && o.material&&o.material.map){
            var im=o.material.map.image;
            firstMap = im ? (im.width+'x'+im.height+' tag='+(im.tagName||im.constructor.name)) : 'NULL-IMAGE';
          }
        }
      });
      out.children.push(i+': meshes='+meshes+' inst='+inst+' geo='+firstGeo+' map='+firstMap);
    });
    out.hasCV = typeof window.__CAMP_GROUND_CV;
    if(window.__CAMP_GROUND_CV){
      var cv=window.__CAMP_GROUND_CV;
      out.cvSize= cv.width+'x'+cv.height;
    }
    /* canvas 能力上限 */
    var t=document.createElement('canvas');
    out.maxTex = (function(){try{var gl=document.createElement('canvas').getContext('webgl2');return gl?gl.getParameter(gl.MAX_TEXTURE_SIZE):'n/a';}catch(e){return 'err';}})();
    return JSON.stringify(out,null,1);
  })()`;
  const r = await send('Runtime.evaluate', { expression: P, returnByValue: true });
  console.log(r.result.result.value || JSON.stringify(r.result).slice(0, 800));
  child.kill();
})();
