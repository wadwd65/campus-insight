const { spawn } = require('child_process'); const fs=require('fs'); const path=require('path'); const os=require('os');
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250); const profile=path.join(os.tmpdir(),'cdp-m-'+Date.now());
const child=spawn(EDGE,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'--window-size=390,844','http://localhost:5173/'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
  const list=await fetch('http://127.0.0.1:'+PORT+'/json').then(r=>r.json());
  const page=list.find(t=>t.type==='page'&&t.url.startsWith('http'));
  const ws=new WebSocket(page.webSocketDebuggerUrl); let id=0;
  const send=(m,p)=>new Promise(res=>{const i=++id;const h=e=>{const d=JSON.parse(e.data);if(d.id===i){ws.removeEventListener('message',h);res(d.result);}};ws.addEventListener('message',h);ws.send(JSON.stringify({id:i,method:m,params:p||{}}));});
  const js=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result.value;
  ws.onopen=async()=>{
    await send('Page.enable'); await sleep(9000);
    await js("(function(){var b=document.querySelector('.intro-enter button');if(b)b.click();})()");
    await sleep(4000);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await sleep(1500);
    await send('Page.captureScreenshot',{format:'png'});
    const s=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('mobile-map.png',Buffer.from(s.data,'base64')); console.log('saved mobile-map.png');
    // 溢出检查
    console.log('overflowX:', await js("document.documentElement.scrollWidth - document.documentElement.clientWidth"));
    ws.close(); child.kill(); process.exit(0);
  };
},2500);
