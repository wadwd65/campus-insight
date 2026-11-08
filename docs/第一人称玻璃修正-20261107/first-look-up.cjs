/* 尝试复现用户「贴入口仰视」角度：第一人称 + 鼠标上拖改变俯仰 */
const {spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os');
const URL_=process.argv[2]||'file:///D:/repro-test/v10-final.html';
const OUT=process.argv[3]||'D:/repro-test/look-up';fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250),profile=path.join(os.tmpdir(),'cdp-look-'+Date.now());
(async()=>{
 const child=spawn(EDGE,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'--window-size=1400,1000','--hide-scrollbars','--no-first-run','--force-device-scale-factor=1','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
 let wsUrl;for(let i=0;i<60&&!wsUrl;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(p)wsUrl=p.webSocketDebuggerUrl;}catch(e){}if(!wsUrl)await sleep(300);}
 if(!wsUrl){child.kill('SIGKILL');throw new Error('no CDP');}
 const ws=new WebSocket(wsUrl);await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej);});
 let id=1;const pending=new Map(),errors=[];ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(String(m.params.exceptionDetails.text||'').slice(0,120));});
 const send=(method,params={})=>new Promise(res=>{const n=id++;pending.set(n,res);ws.send(JSON.stringify({id:n,method,params}));});
 const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});return r.result&&r.result.result?r.result.result.value:null;};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});if(r.result&&r.result.data)fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.result.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:URL_});await sleep(8000);
 await js(`(()=>{const s=document.getElementById('place-picker');if(s){const o=[...s.options].find(x=>x.value==='lib');if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}return 1;})()`);
 await sleep(2500);
 await js(`document.getElementById('walk-toggle')&&document.getElementById('walk-toggle').click();true`);
 await sleep(1800);
 await shot('look-00-level');
 /* 鼠标从画面中部向上拖，尝试抬头 */
 const M=(type,x,y,buttons)=>send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:buttons||0,clickCount:1});
 await M('mousePressed',700,650,1);
 for(let k=1;k<=6;k++){await M('mouseMoved',700,650-k*70,1);await sleep(180);}
 await M('mouseReleased',700,230,0);
 await sleep(1200);await shot('look-01-up');
 /* 再向上拖一次，更仰 */
 await M('mousePressed',700,650,1);
 for(let k=1;k<=6;k++){await M('mouseMoved',700,650-k*70,1);await sleep(180);}
 await M('mouseReleased',700,230,0);
 await sleep(1200);await shot('look-02-up2');
 const r=await js(`(()=>{const x=document.getElementById('runtime');return x?JSON.stringify({mode:x.dataset.playMode,pv:x.dataset.personView}):null;})()`);
 console.log(JSON.stringify({state:r,errors,errorCount:errors.length}));
 ws.close();child.kill('SIGKILL');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
