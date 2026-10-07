/* 决定性实验：逐一剥离可疑因素，看哪个才是"冲白"的真凶 */
const { spawn } = require('child_process');
const path = require('path'); const zlib = require('zlib');
const html = 'file:///' + path.resolve('tower.html').replace(/\\/g,'/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9522;
const child = spawn(EDGE, ['--headless=new','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--window-size=1440,960','--user-data-dir='+path.resolve('.cdp-exp2'), html], {stdio:'ignore'});
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function pngPixels(buf){
  let p=8,w,h,ct; const idat=[];
  while(p<buf.length){ const len=buf.readUInt32BE(p); const t=buf.toString('ascii',p+4,p+8);
    if(t==='IHDR'){ w=buf.readUInt32BE(p+8); h=buf.readUInt32BE(p+12); ct=buf[p+17]; }
    else if(t==='IDAT') idat.push(buf.slice(p+8,p+8+len));
    else if(t==='IEND') break;
    p+=12+len; }
  const raw=zlib.inflateSync(Buffer.concat(idat));
  const bpp = ct===6?4:3, stride=w*bpp;
  const out=Buffer.alloc(h*stride); let q=0;
  for(let y=0;y<h;y++){ const f=raw[q++]; const line=raw.slice(q,q+stride); q+=stride;
    const cur=out.slice(y*stride,(y+1)*stride); const prev=y>0?out.slice((y-1)*stride,y*stride):Buffer.alloc(stride);
    for(let i=0;i<stride;i++){ const a=i>=bpp?cur[i-bpp]:0, b=prev[i], c=i>=bpp?prev[i-bpp]:0; let v=line[i];
      if(f===1)v+=a; else if(f===2)v+=b; else if(f===3)v+=(a+b)>>1;
      else if(f===4){ const pp=a+b-c, pa=Math.abs(pp-a), pb=Math.abs(pp-b), pc=Math.abs(pp-c); v+= (pa<=pb&&pa<=pc)?a:(pb<=pc?b:c); }
      cur[i]=v&255; } }
  return {w,h,bpp,data:out};
}

async function shot(send){ const s2=await send('Page.captureScreenshot',{format:'png'}); return pngPixels(Buffer.from((s2.result||s2).data,'base64')); }
function roofStats(px){
  let sum=0,n=0,hi=0,br=0,blue=0;
  const x0=480,y0=200,x1=760,y1=420;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ const i=(y*px.w+x)*px.bpp;
    const R=px.data[i],G=px.data[i+1],B=px.data[i+2];
    const L=0.2126*R+0.7152*G+0.0722*B; sum+=L;n++; if(L>207)hi++; br+=B-R; if(B-R>25)blue++; }
  return { mean:+(sum/n).toFixed(1), hiPct:+(100*hi/n).toFixed(1), br:+(br/n).toFixed(1), bluePct:+(100*blue/n).toFixed(1) };
}

(async () => {
  let ws, id=0; const pend=new Map();
  const send=(m,p)=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  for(let i=0;i<60;i++){ try{const r=await fetch('http://127.0.0.1:'+PORT+'/json');const l=await r.json();const t=l.find(x=>x.type==='page');if(t){ws=new WebSocket(t.webSocketDebuggerUrl);break;}}catch(e){} await sleep(200);}
  await new Promise(r=>ws.addEventListener('open',r));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}});
  await send('Runtime.enable'); await send('Page.enable'); await sleep(6000);

  // 建立材质清单：把所有"屋面族"材质收集起来（按基础色 hex 匹配）
  await send('Runtime.evaluate',{expression:
    "(function(){var targets={'7e96c4':[],'5e7aae':[],'44587e':[],'4a6288':[],'2e4468':[],'33496e':['33496e']};" +
    "window.__roofMats=[];var seen={};" +
    "scene.traverse(function(o){ if(o.isMesh&&o.material&&o.material.color){" +
    "  var h=o.material.color.getHexString();" +
    "  if(['7e96c4','5e7aae','44587e','4a6288','2e4468'].indexOf(h)>=0 && !seen[h]){seen[h]=1;window.__roofMats.push({h:h,m:o.material});}" +
    "}});" +
    "return JSON.stringify(window.__roofMats.map(function(x){return x.h+':map='+!!x.m.map+':enc='+x.m.map.encoding+':encv='+(x.m.map?'?':'-');}));})()"});

  const enc = await send('Runtime.evaluate',{expression:
    "JSON.stringify(window.__roofMats.map(function(x){return x.h+' r='+x.m.roughness+' met='+x.m.metalness+' hasMap='+!!x.m.map+' mapEnc='+(x.m.map?x.m.map.encoding:'-');}))", returnByValue:true});
  console.log('屋面材质清单:\n  ' + (enc.result.result.value||'').split('","').join('\n  ').replace(/[\[\]"]/g,''));

  const log = (name, st) => console.log(name.padEnd(38) + ' 均值 ' + String(st.mean).padStart(6) + '  高亮>207 ' + String(st.hiPct).padStart(5) + '%  蓝占比 ' + String(st.bluePct).padStart(5) + '%  B-R ' + String(st.br).padStart(5));

  log('A 基线 v15c', roofStats(await shot(send)));

  // B: 摘掉屋面贴图（置 null）
  await send('Runtime.evaluate',{expression:"window.__roofMats.forEach(function(x){ if(x.m.map){ x.__saved=x.m.map; x.m.map=null; x.m.needsUpdate=true; } });"});
  await sleep(1100); log('B 摘掉屋面贴图', roofStats(await shot(send)));

  // C: 恢复贴图，改为纯色（关 metalness）
  await send('Runtime.evaluate',{expression:"window.__roofMats.forEach(function(x){ if(x.__saved){ x.m.map=x.__saved; } x.m.metalness=0; x.m.needsUpdate=true; });"});
  await sleep(1100); log('C 恢复贴图 + metalness=0', roofStats(await shot(send)));

  // D: 恢复 metalness，改 roughness=1（全漫反射）
  await send('Runtime.evaluate',{expression:"window.__roofMats.forEach(function(x){ x.m.metalness=x.__met===undefined?(x.m.metalness):x.m.metalness; x.m.roughness=1.0; x.m.needsUpdate=true; });"});
  await sleep(1100); log('D roughness=1.0', roofStats(await shot(send)));

  // E: 全恢复 + 太阳减半
  await send('Runtime.evaluate',{expression:"window.__roofMats.forEach(function(x){ x.m.roughness=0.56; x.m.metalness=0.26; x.m.needsUpdate=true; }); sun.intensity=0.55;"});
  await sleep(1100); log('E 全恢复 + 太阳 0.55', roofStats(await shot(send)));

  child.kill();
})();
