/* 验证太阳盘固定：切两次日光方向，比较天空区域像素；同时确认影子仍随角度重烘焙 */
const {spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250),profile=path.join(os.tmpdir(),'cdp-sun-'+Date.now());
function decodePNG(buf){let off=8,w=0,h=0,ct=0,bd=0;const idat=[];
 while(off+8<=buf.length){const len=buf.readUInt32BE(off),type=buf.toString('ascii',off+4,off+8),d=buf.subarray(off+8,off+8+len);
  if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];}else if(type==='IDAT')idat.push(d);else if(type==='IEND')break;off+=12+len;}
 if(bd!==8||![2,6].includes(ct))throw new Error('png '+bd+' '+ct);
 const bpp=ct===6?4:3,stride=w*bpp,raw=zlib.inflateSync(Buffer.concat(idat)),px=Buffer.alloc(h*stride);let rp=0;
 for(let y=0;y<h;y++){const f=raw[rp++],row=raw.subarray(rp,rp+stride);rp+=stride;
  const cur=px.subarray(y*stride,(y+1)*stride),prev=y?px.subarray((y-1)*stride,y*stride):null;
  for(let x=0;x<stride;x++){const a=x>=bpp?cur[x-bpp]:0,b=prev?prev[x]:0,c=prev&&x>=bpp?prev[x-bpp]:0;let v=row[x];
   if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}cur[x]=v&255;}}
 const rgba=new Uint8Array(w*h*4);for(let i=0,n=w*h;i<n;i++){rgba[i*4]=px[i*bpp];rgba[i*4+1]=px[i*bpp+1];rgba[i*4+2]=px[i*bpp+2];rgba[i*4+3]=ct===6?px[i*bpp+3]:255;}
 return {w,h,rgba};}
(async()=>{
 const child=spawn(EDGE,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'--window-size=1400,900','--hide-scrollbars','--no-first-run','--force-device-scale-factor=1','about:blank'],{stdio:'ignore'});
 let wsUrl;for(let i=0;i<60&&!wsUrl;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(p)wsUrl=p.webSocketDebuggerUrl;}catch(e){}if(!wsUrl)await sleep(300);}
 if(!wsUrl){child.kill('SIGKILL');throw new Error('no CDP');}
 const ws=new WebSocket(wsUrl);await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej);});
 let id=1;const pending=new Map(),errors=[];ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(String(m.params.exceptionDetails.text||'').slice(0,120));});
 const send=(method,params={})=>new Promise(res=>{const n=id++;pending.set(n,res);ws.send(JSON.stringify({id:n,method,params}));});
 const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});return r.result&&r.result.result?r.result.result.value:null;};
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:'file:///D:/repro-test/v5-final.html'});await sleep(8000);
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});const b=Buffer.from(r.result.data,'base64');fs.writeFileSync('D:/repro-test/'+name+'.png',b);return decodePNG(b);};
 const setSun=async v=>{await js(`(()=>{const e=document.getElementById('sun');e.value=${v};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`);await sleep(1200);};
 await setSun(45);const A=await shot('sun-45');const b1=await js(`document.getElementById('runtime').dataset.shadowBakes`);
 await setSun(220);const B=await shot('sun-220');const b2=await js(`document.getElementById('runtime').dataset.shadowBakes`);
 let sum=0,n=0,groundSum=0,gn=0;
 for(let y=0;y<Math.min(A.h,B.h);y+=2){for(let x=0;x<Math.min(A.w,B.w);x+=2){const i=(y*A.w+x)*4;
  const d=Math.abs(A.rgba[i]-B.rgba[i])+Math.abs(A.rgba[i+1]-B.rgba[i+1])+Math.abs(A.rgba[i+2]-B.rgba[i+2]);
  if(y<A.h*.18){sum+=d;n+=3;}else if(y>A.h*.45){groundSum+=d;gn+=3;}}}
 console.log(JSON.stringify({skyMAD:+(sum/n).toFixed(3),lowerFrameMAD:+(groundSum/gn).toFixed(3),shadowBakes:{at45:b1,at220:b2},errors}));
 ws.close();child.kill('SIGKILL');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
