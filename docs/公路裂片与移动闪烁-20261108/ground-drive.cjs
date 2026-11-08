/* 复现用户截图：第一人称贴地低视角 + 持续移动，连续抓帧看路面裂片/闪烁 */
const {spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os');
const URL_=process.argv[2],OUT=process.argv[3];fs.mkdirSync(path.join(OUT,'frames'),{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250),profile=path.join(os.tmpdir(),'cdp-gb-'+Date.now());
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
 const M=(type,x,y,buttons)=>send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:buttons||0,clickCount:1});
 const shot=async n=>{const r=await send('Page.captureScreenshot',{format:'png'});if(r.result&&r.result.data)fs.writeFileSync(path.join(OUT,'frames',n+'.png'),Buffer.from(r.result.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:URL_});await sleep(8000);
 await js(`document.getElementById('drive-toggle')&&document.getElementById('drive-toggle').click();true`);
 await sleep(1800);
 /* 向下拖，俯向路面 */
 await M('mousePressed',700,300,1);
 for(let k=1;k<=4;k++){await M('mouseMoved',700,300+k*42,1);await sleep(160);}
 await M('mouseReleased',700,468,0);
 await sleep(1000);
 await shot('g-00-static');
 /* 持续按 W 前进，连续 9 帧 */
 const key=(type,k,code,vk)=>send('Input.dispatchKeyEvent',{type,key:k,code,windowsVirtualKeyCode:vk});
 await key('keyDown','w','KeyW',87);
 for(let f=1;f<=9;f++){await sleep(230);await shot(`g-0${f}-move`);}
 await key('keyUp','w','KeyW',87);
 const r=await js(`(()=>{const x=document.getElementById('runtime');return x?JSON.stringify({mode:x.dataset.playMode,pv:x.dataset.personView}):null;})()`);
 fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({state:r,errors,frames:10},null,2));
 console.log(JSON.stringify({state:r,errors,errorCount:errors.length,frames:10}));
 ws.close();child.kill('SIGKILL');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
