/* 单变量光照对照：在页面内动态改光照强度，逐档截图并量化屋顶区指标 */
const { spawn } = require('child_process');
const path = require('path'); const zlib = require('zlib');
const html = 'file:///' + path.resolve('tower.html').replace(/\\/g,'/');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9521;
const child = spawn(EDGE, ['--headless=new','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--window-size=1440,960','--user-data-dir='+path.resolve('.cdp-exp'), html], {stdio:'ignore'});
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

(async () => {
  let ws, id=0; const pend=new Map();
  const send=(m,p)=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  for(let i=0;i<60;i++){ try{const r=await fetch('http://127.0.0.1:'+PORT+'/json');const l=await r.json();const t=l.find(x=>x.type==='page');if(t){ws=new WebSocket(t.webSocketDebuggerUrl);break;}}catch(e){} await sleep(200);}
  await new Promise(r=>ws.addEventListener('open',r));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}});
  await send('Runtime.enable'); await send('Page.enable'); await sleep(6000);

  // 先给光照对象挂上全局引用，方便后续动态改
  await send('Runtime.evaluate',{expression:
    "(function(){var L=[];scene.traverse(function(o){if(o.isLight)L.push(o);});" +
    "window.__L=L;window.__hemi=L.find(function(x){return x.isHemisphereLight;});" +
    "window.__dirs=L.filter(function(x){return x.isDirectionalLight;});" +
    "return JSON.stringify({hemi:!!window.__hemi, dirs:window.__dirs.length});})()"});

  const cases = [
    { name: 'v15c 现状', js: 'sun.intensity=1.05; if(window.__hemi)window.__hemi.intensity=0.58; window.__dirs.forEach(function(d,i){d.intensity=[1.05,0.30,0.22][i];});' },
    { name: '太阳 1.05 -> 0.85', js: 'sun.intensity=0.85;' },
    { name: '太阳 0.85 + 天光 0.58 -> 0.44', js: 'sun.intensity=0.85; if(window.__hemi)window.__hemi.intensity=0.44;' },
    { name: '太阳 0.85 + 天光 0.44 + 补光减半', js: 'sun.intensity=0.85; if(window.__hemi)window.__hemi.intensity=0.44; window.__dirs.forEach(function(d,i){ if(i>=1) d.intensity=[1.05,0.15,0.11][i]; });' },
    { name: '太阳 0.72 + 天光 0.38 + 补光减半', js: 'sun.intensity=0.72; if(window.__hemi)window.__hemi.intensity=0.38; window.__dirs.forEach(function(d,i){ if(i>=1) d.intensity=[1.05,0.15,0.11][i]; });' },
  ];

  for (const c of cases) {
    await send('Runtime.evaluate',{expression:c.js});
    await sleep(1100);
    const s2 = await send('Page.captureScreenshot',{format:'png'});
    const b64 = (s2.result||s2).data;
    const px = pngPixels(Buffer.from(b64,'base64'));
    let sum=0,n=0,hi=0,br=0;
    const x0=480,y0=200,x1=760,y1=420;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){ const i=(y*px.w+x)*px.bpp;
      const R=px.data[i],G=px.data[i+1],B=px.data[i+2];
      const L=0.2126*R+0.7152*G+0.0722*B; sum+=L;n++; if(L>207)hi++; br+=B-R; }
    console.log(c.name.padEnd(30) + ' 均值 ' + (sum/n).toFixed(1) + '  高亮>207 ' + (100*hi/n).toFixed(1) + '%  B-R ' + (br/n).toFixed(1));
  }
  child.kill();
})();
