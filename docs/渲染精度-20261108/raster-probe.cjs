/* 静止 vs 持续移动 的实际渲染分辨率 */
const {spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os');
const URL_=process.argv[2];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250),profile=path.join(os.tmpdir(),'cdp-rp-'+Date.now());
(async()=>{
 const child=spawn(EDGE,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'--window-size=1400,900','--hide-scrollbars','--no-first-run','--force-device-scale-factor=1','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
 let wsUrl;for(let i=0;i<60&&!wsUrl;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(p)wsUrl=p.webSocketDebuggerUrl;}catch(e){}if(!wsUrl)await sleep(300);}
 if(!wsUrl){child.kill('SIGKILL');throw new Error('no CDP');}
 const ws=new WebSocket(wsUrl);await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej);});
 let id=1;const pending=new Map(),errors=[];ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(String(m.params.exceptionDetails.text||'').slice(0,120));});
 const send=(method,params={})=>new Promise(res=>{const n=id++;pending.set(n,res);ws.send(JSON.stringify({id:n,method,params}));});
 const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});return r.result&&r.result.result?r.result.result.value:null;};
 const read=`(()=>{const r=document.getElementById('runtime');if(!r)return '{}';const d=r.dataset;return JSON.stringify({quality:d.quality,mode:d.rasterMode,dpr:d.dpr,bw:d.bufferWidth,bh:d.bufferHeight,renderMs:d.renderMs,frames:d.frames});})()`;
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:URL_});await sleep(9000);
 const still=await js(read);
 await js(`document.getElementById('walk-toggle')&&document.getElementById('walk-toggle').click();true`);
 await sleep(1500);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
 const samples=[];for(let i=0;i<6;i++){await sleep(800);samples.push(await js(read));}
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
 console.log(JSON.stringify({still:JSON.parse(still||'{}'),moving:samples.map(x=>JSON.parse(x||'{}')),errors}));
 ws.close();child.kill('SIGKILL');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
