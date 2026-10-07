const { spawn } = require('child_process'); const fs=require('fs'); const path=require('path'); const os=require('os');
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250); const profile=path.join(os.tmpdir(),'cdp-g-'+Date.now());
const url='file:///'+path.resolve('campus-game.html').replace(/\\/g,'/');
const child=spawn(EDGE,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'--window-size=1440,900',url],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
  const list=await fetch('http://127.0.0.1:'+PORT+'/json').then(r=>r.json());
  const page=list.find(t=>t.url.includes('campus-game'));
  const ws=new WebSocket(page.webSocketDebuggerUrl); let id=0;
  const send=(m,p)=>new Promise(res=>{const i=++id;const h=e=>{const d=JSON.parse(e.data);if(d.id===i){ws.removeEventListener('message',h);res(d.result);}};ws.addEventListener('message',h);ws.send(JSON.stringify({id:i,method:m,params:p||{}}));});
  const js=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result.value;
  const shot=async n=>{await send('Page.captureScreenshot',{format:'png'});const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(n,Buffer.from(s.data,'base64'));console.log('  saved',n);};
  const click=async(x,y)=>{await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
                           await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});};
  ws.onopen=async()=>{
    await send('Page.enable'); await sleep(9000);
    console.log('状态:', await js("JSON.stringify(window.__GAME.state)"));
    await shot('game-01-initial.png');
    /* 图书馆在切片(100,148) → 投到屏幕 */
    const pt = await js("(function(){var s=window.__CAMP.stage(),b=null;s.children.forEach(function(c){if(c.name==='buildings')b=c;});var t=b.children.find(function(x){return x.userData.placeId==='lib';});var v=new THREE.Vector3();new THREE.Box3().setFromObject(t).getCenter(v);v.project(window.__CAMP_CAM);return JSON.stringify({x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight});})()");
    const p = JSON.parse(pt); console.log('图书馆屏幕坐标', p);
    await click(p.x, p.y); await sleep(2500);
    await shot('game-02-panel.png');
    console.log('面板:', await js("document.getElementById('panel').className + ' | ' + document.getElementById('pName').textContent"));
    console.log('行动数:', await js("document.querySelectorAll('#acts .act').length"));
    /* 点第一个行动 */
    await js("document.querySelector('#acts .act').click()");
    await sleep(900);
    await shot('game-03-action.png');
    await sleep(1500);
    console.log('行动后状态:', await js("JSON.stringify({stam:window.__GAME.state.stam,slot:window.__GAME.state.slot,attrs:window.__GAME.state.attrs})"));
    await shot('game-04-after.png');
    ws.close(); child.kill(); process.exit(0);
  };
},2500);
