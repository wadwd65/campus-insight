/* 第一人称实拍：真键盘 S 后退到图书馆门前广场，逐秒连续截图；并尝试进入室内 */
const {spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os');
const URL_=process.argv[2]||'file:///D:/repro-test/v8-final.html';
const OUT=process.argv[3]||'D:/repro-test/first-survey';fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250),profile=path.join(os.tmpdir(),'cdp-first-'+Date.now());
(async()=>{
 const child=spawn(EDGE,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'--window-size=1600,1000','--hide-scrollbars','--no-first-run','--force-device-scale-factor=1','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
 let wsUrl;for(let i=0;i<60&&!wsUrl;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(p)wsUrl=p.webSocketDebuggerUrl;}catch(e){}if(!wsUrl)await sleep(300);}
 if(!wsUrl){child.kill('SIGKILL');throw new Error('no CDP');}
 const ws=new WebSocket(wsUrl);await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej);});
 let id=1;const pending=new Map(),errors=[];ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(String(m.params.exceptionDetails.text||'').slice(0,120));});
 const send=(method,params={})=>new Promise(res=>{const n=id++;pending.set(n,res);ws.send(JSON.stringify({id:n,method,params}));});
 const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});return r.result&&r.result.result?r.result.result.value:null;};
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});if(r.result&&r.result.data)fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(r.result.data,'base64'));};
 const key=(type,k,code,vk)=>send('Input.dispatchKeyEvent',{type,key:k,code,windowsVirtualKeyCode:vk});
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:URL_});await sleep(8000);
 /* 先聚焦图书馆，让第一人称出生点落在图书馆附近 */
 await js(`(()=>{const s=document.getElementById('place-picker');if(s){const o=[...s.options].find(x=>x.value==='lib');if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}return 1;})()`);
 await sleep(2500);
 await js(`document.getElementById('walk-toggle')&&document.getElementById('walk-toggle').click();true`);
 await sleep(1800);
 await shot('fp-00-spawn');
 /* 按 S 后退，逐秒截图，覆盖从门口到广场 */
 await key('keyDown','s','KeyS',83);
 for(let i=1;i<=6;i++){await sleep(1000);await shot(`fp-0${i}-back`);}
 await key('keyUp','s','KeyS',83);
 await sleep(600);
 /* 按 A 侧移一点，换角度看台阶侧面 */
 await key('keyDown','a','KeyA',65);await sleep(1200);await key('keyUp','a','KeyA',65);
 await sleep(700);await shot('fp-07-side');
 const state=await js(`(()=>{const r=document.getElementById('runtime');return r?JSON.stringify({mode:r.dataset.playMode,personView:r.dataset.personView,frames:r.dataset.frames}):null;})()`);
 fs.writeFileSync(path.join(OUT,'survey.json'),JSON.stringify({state,errors,errorCount:errors.length},null,2));
 console.log(JSON.stringify({state,errors,errorCount:errors.length,shots:8}));
 ws.close();child.kill('SIGKILL');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
