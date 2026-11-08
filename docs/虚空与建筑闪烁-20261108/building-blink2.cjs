/* 自动环绕持续绘制 + 每帧重投影建筑 ROI，找额外跳变的建筑 */
const {spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os'),zlib=require('zlib');
const URL_=process.argv[2],OUT=process.argv[3];fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250),profile=path.join(os.tmpdir(),'cdp-bb2-'+Date.now());
function decodePNG(buf){let off=8,w=0,h=0,ct=0,bd=0;const idat=[];
 while(off+8<=buf.length){const len=buf.readUInt32BE(off),type=buf.toString('ascii',off+4,off+8),d=buf.subarray(off+8,off+8+len);
  if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];}else if(type==='IDAT')idat.push(d);else if(type==='IEND')break;off+=12+len;}
 if(bd!==8||![2,6].includes(ct))throw new Error('png');
 const bpp=ct===6?4:3,stride=w*bpp,raw=zlib.inflateSync(Buffer.concat(idat)),px=Buffer.alloc(h*stride);let rp=0;
 for(let y=0;y<h;y++){const f=raw[rp++],row=raw.subarray(rp,rp+stride);rp+=stride;
  const cur=px.subarray(y*stride,(y+1)*stride),prev=y?px.subarray((y-1)*stride,y*stride):null;
  for(let x=0;x<stride;x++){const a=x>=bpp?cur[x-bpp]:0,b=prev?prev[x]:0,c=prev&&x>=bpp?prev[x-bpp]:0;let v=row[x];
   if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}cur[x]=v&255;}}
 const rgba=new Uint8Array(w*h*4);for(let i=0,n=w*h;i<n;i++){rgba[i*4]=px[i*bpp];rgba[i*4+1]=px[i*bpp+1];rgba[i*4+2]=px[i*bpp+2];rgba[i*4+3]=ct===6?px[i*bpp+3]:255;}
 return {w,h,rgba};}
(async()=>{
 const child=spawn(EDGE,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'--window-size=1500,940','--hide-scrollbars','--no-first-run','--force-device-scale-factor=1','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
 let wsUrl;for(let i=0;i<60&&!wsUrl;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(p)wsUrl=p.webSocketDebuggerUrl;}catch(e){}if(!wsUrl)await sleep(300);}
 if(!wsUrl){child.kill('SIGKILL');throw new Error('no CDP');}
 const ws=new WebSocket(wsUrl);await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej);});
 let id=1;const pending=new Map(),errors=[];ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(String(m.params.exceptionDetails.text||'').slice(0,120));});
 const send=(method,params={})=>new Promise(res=>{const n=id++;pending.set(n,res);ws.send(JSON.stringify({id:n,method,params}));});
 const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});return r.result&&r.result.result?r.result.result.value:null;};
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:URL_});await sleep(8000);
 await js(`(()=>{const b=document.getElementById('water-motion');if(b)b.click();const a=document.getElementById('auto');if(a)a.click();return 1;})()`);
 await sleep(1200);
 const getRois=`(()=>{const T=window.__T,c=window.__cam,cp=window.__campus;if(!T||!c||!cp)return '[]';
  c.updateMatrixWorld();const cv=document.querySelector('canvas'),r=cv.getBoundingClientRect();const out=[];
  for(const t of cp.targets||[]){const v=new T.Vector3(t.x,6,t.z);v.project(c);if(v.z>1||v.z<-1)continue;
   out.push({id:t.id,x:Math.round((v.x+1)/2*r.width+r.left),y:Math.round((1-v.y)/2*r.height+r.top)});}
  return JSON.stringify(out);})()`;
 const frames=[],rois=[];
 for(let f=0;f<12;f++){
  rois.push(JSON.parse(await js(getRois)||'[]'));
  const sh=await send('Page.captureScreenshot',{format:'png'});const b=Buffer.from(sh.result.data,'base64');
  fs.writeFileSync(path.join(OUT,`bb-${String(f).padStart(2,'0')}.png`),b);
  try{frames.push(decodePNG(b));}catch(e){}
  await sleep(230);
 }
 const R=10;const per=new Map();
 for(let f=1;f<frames.length;f++){
  const A=frames[f-1],B=frames[f];if(!A||!B||A.w!==B.w||A.h!==B.h)continue;
  const ra=new Map(rois[f-1].map(r=>[r.id,r])),rb=new Map(rois[f].map(r=>[r.id,r]));
  for(const [key,pa]of ra){const pb=rb.get(key);if(!pb)continue;
   if(pa.x<R||pa.y<R||pa.x+R>=A.w||pa.y+R>=A.h||pb.x<R||pb.y<R||pb.x+R>=B.w||pb.y+R>=B.h)continue;
   let sum=0,n=0;
   for(let dy=-R;dy<R;dy+=2)for(let dx=-R;dx<R;dx+=2){
    const ia=((pa.y+dy)*A.w+(pa.x+dx))*4,ib=((pb.y+dy)*B.w+(pb.x+dx))*4;
    sum+=Math.abs(A.rgba[ia]-B.rgba[ib])+Math.abs(A.rgba[ia+1]-B.rgba[ib+1])+Math.abs(A.rgba[ia+2]-B.rgba[ib+2]);n+=3;}
   if(!n)continue;if(!per.has(key))per.set(key,[]);per.get(key).push(sum/n);}
 }
 const stat=[...per.entries()].map(([id,m])=>({id,mean:+(m.reduce((a,b)=>a+b,0)/m.length).toFixed(2),max:+Math.max(...m).toFixed(2)})).sort((a,b)=>b.mean-a.mean);
 const out={frames:frames.length,errors,errorCount:errors.length,top:stat.slice(0,14),all:stat};
 fs.writeFileSync(path.join(OUT,'blink.json'),JSON.stringify(out,null,2));
 console.log(JSON.stringify({frames:frames.length,errorCount:errors.length,top:stat.slice(0,12)}));
 ws.close();child.kill('SIGKILL');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
