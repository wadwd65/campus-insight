/* 证明光影真的生效：关 / 开 / 光轴调试通道 / 开关按钮切换 */
const {spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OUT='D:/repro-test/shader-out';fs.mkdirSync(OUT,{recursive:true});
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250),profile=path.join(os.tmpdir(),'cdp-sc-'+Date.now());
(async()=>{
 const child=spawn(EDGE,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'--window-size=1500,940','--hide-scrollbars','--no-first-run','--force-device-scale-factor=1','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
 let wsUrl;for(let i=0;i<60&&!wsUrl;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(p)wsUrl=p.webSocketDebuggerUrl;}catch(e){}if(!wsUrl)await sleep(300);}
 if(!wsUrl){child.kill('SIGKILL');throw new Error('no CDP');}
 const ws=new WebSocket(wsUrl);await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej);});
 let id=1;const pending=new Map(),errors=[];ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push(String(m.params.exceptionDetails.text||'').slice(0,140));
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='warning')errors.push('WARN '+m.params.args.map(a=>a.value||'').join(' ').slice(0,120));});
 const send=(method,params={})=>new Promise(res=>{const n=id++;pending.set(n,res);ws.send(JSON.stringify({id:n,method,params}));});
 const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});return r.result&&r.result.result?r.result.result.value:null;};
 const shot=async n=>{const r=await send('Page.captureScreenshot',{format:'png'});if(r.result&&r.result.data)fs.writeFileSync(path.join(OUT,n+'.png'),Buffer.from(r.result.data,'base64'));};
 await send('Page.enable');await send('Runtime.enable');
 const base='file:///D:/repro-test/v26-final.html';
 for(const [name,url]of [['A-off',base+'?post=0'],['B-on',base],['C-rays',base+'?raydbg=1']]){
  await send('Page.navigate',{url});await sleep(9000);await shot(name);
  console.log(name,JSON.parse(await js(`(()=>{const r=document.getElementById('runtime');return r?JSON.stringify({mode:r.dataset.rasterMode,dpr:r.dataset.dpr,renderMs:r.dataset.renderMs}):'{}';})()`)||'{}'));
 }
 /* 回到默认页，测开关按钮 */
 await send('Page.navigate',{url:base});await sleep(9000);
 const before=await js(`document.getElementById('shaders').getAttribute('aria-pressed')`);
 await js(`document.getElementById('shaders').click();true`);await sleep(1500);await shot('D-toggle-off');
 const after=await js(`document.getElementById('shaders').getAttribute('aria-pressed')`);
 await js(`document.getElementById('shaders').click();true`);await sleep(1500);await shot('E-toggle-on');
 const back=await js(`document.getElementById('shaders').getAttribute('aria-pressed')`);
 fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({before,after,back,errors,errorCount:errors.length},null,2));
 console.log(JSON.stringify({before,after,back,errorCount:errors.length,errors:errors.slice(0,4)}));
 ws.close();child.kill('SIGKILL');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
