/* 全功能连通性 / 交互状态审计：逐项触发 + 状态断言 + 回退 + 跨模块衔接 */
const {spawn}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os');
const URL_=process.argv[2]||'file:///D:/repro-test/v12-final.html';
const OUT=process.argv[3]||'D:/repro-test/audit-v12.json';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const PORT=9700+Math.floor(Math.random()*250),profile=path.join(os.tmpdir(),'cdp-audit-'+Date.now());
const STATE=`(()=>{const r=document.getElementById('runtime'),d=r?r.dataset:{};
 const g=id=>{const e=document.getElementById(id);return e?e.value:null;};
 const t=id=>{const e=document.getElementById(id);return e?e.textContent.trim().slice(0,60):null;};
 const a=id=>{const e=document.getElementById(id);return e?e.getAttribute('aria-pressed'):null;};
 return JSON.stringify({mode:d.playMode,pv:d.personView,quality:d.quality,frames:d.frames,
  waterMode:d.waterMode,shadowOn:d.shadowOn,shadowBakes:d.shadowBakes,
  lighting:g('lighting'),lightName:t('light-name'),sun:g('sun'),place:g('place-picker'),
  viewName:t('view-name'),shade:a('shade'),labels:a('labels'),auto:a('auto'),water:a('water-motion'),
  fps:t('fps-result'),canvas:!!document.querySelector('#scene canvas')});})()`;
(async()=>{
 const child=spawn(EDGE,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--remote-debugging-port='+PORT,'--user-data-dir='+profile,'--window-size=1500,940','--hide-scrollbars','--no-first-run','--force-device-scale-factor=1','--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
 let wsUrl;for(let i=0;i<60&&!wsUrl;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(p)wsUrl=p.webSocketDebuggerUrl;}catch(e){}if(!wsUrl)await sleep(300);}
 if(!wsUrl){child.kill('SIGKILL');throw new Error('no CDP');}
 const ws=new WebSocket(wsUrl);await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej);});
 let id=1;const pending=new Map(),errors=[];ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);return;}
  if(m.method==='Runtime.exceptionThrown')errors.push('EXC '+String(m.params.exceptionDetails.text||'').slice(0,140));
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push('LOG '+m.params.args.map(a=>a.value||a.description||'').join(' ').slice(0,140));});
 const send=(method,params={})=>new Promise(res=>{const n=id++;pending.set(n,res);ws.send(JSON.stringify({id:n,method,params}));});
 const js=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});return r.result&&r.result.result?r.result.result.value:null;};
 const state=async()=>{try{return JSON.parse(await js(STATE)||'{}');}catch(e){return {};}};
 const click=sel=>`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'MISSING';e.click();return 'ok';})()`;
 const sel=(id,v)=>`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)return 'MISSING';e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`;
 const rng=(id,v)=>`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)return 'MISSING';e.value=${v};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.value;})()`;
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:URL_});await sleep(8000);
 const rows=[];
 async function check(name,impact,action,expect,wait=750){
   const before=await state();const act=await js(action);await sleep(wait);const after=await state();
   let pass=false,note='';
   try{pass=!!expect(before,after);}catch(e){note=e.message;}
   if(act==='MISSING'){pass=false;note='控件缺失';}
   rows.push({name,impact,before,after,pass,note,action:typeof act==='string'?act.slice(0,40):''});
   console.log((pass?'  OK  ':'  FAIL'),name);
 }
 /* --- 基础 / 画质 --- */
 await check('初始加载：canvas 与 orbit 模式','全局','1',(b,a)=>a.canvas===true&&a.mode==='orbit',100);
 await check('画质 → low','画质模块',sel('quality','low'),(b,a)=>a.quality==='low');
 await check('画质 → high','画质模块',sel('quality','high'),(b,a)=>a.quality==='high');
 /* --- 天气 5 档 + 过渡 --- */
 for(const w of ['partly','overcast','golden','dusk','daylight'])
   await check('天气 → '+w,'天气模块',sel('lighting',w),(b,a)=>a.lighting===w&&a.lightName!==b.lightName,900);
 /* --- 太阳与跨模块 --- */
 await check('太阳方位 → 200','天气/阴影',rng('sun',200),(b,a)=>a.sun==='200');
 await check('切天气后太阳仍可调（跨模块）','跨模块',rng('sun',90),(b,a)=>a.sun==='90'&&Number(a.shadowBakes)>=Number(b.shadowBakes));
 await check('再切 golden 后太阳仍生效','跨模块',sel('lighting','golden'),(b,a)=>a.lighting==='golden'&&a.sun==='90',900);
 await check('天气回 daylight','天气模块',sel('lighting','daylight'),(b,a)=>a.lighting==='daylight',900);
 /* --- 开关 --- */
 await check('静态阴影开关','渲染开关',click('#shade'),(b,a)=>a.shade!==b.shade);
 await check('静态阴影回退','渲染开关',click('#shade'),(b,a)=>a.shade!==b.shade);
 await check('水面开关','渲染开关',click('#water-motion'),(b,a)=>a.water!==b.water);
 await check('水面回退','渲染开关',click('#water-motion'),(b,a)=>a.water!==b.water);
 await check('地点标记开关','渲染开关',click('#labels'),(b,a)=>a.labels!==b.labels);
 await check('地点标记回退','渲染开关',click('#labels'),(b,a)=>a.labels!==b.labels);
 await check('自动环绕开','视角模块',click('#auto'),(b,a)=>a.auto==='true',900);
 await check('自动环绕关','视角模块',click('#auto'),(b,a)=>a.auto==='false');
 /* --- 预设 / 地点 --- */
 await check('预设 教学街区','视角模块',click('[data-preset="teaching"]'),(b,a)=>a.viewName!==b.viewName,1100);
 await check('预设 生活院落','视角模块',click('[data-preset="dorm"]'),(b,a)=>a.viewName!==b.viewName,1100);
 await check('预设 俯瞰核对','视角模块',click('[data-preset="plan"]'),(b,a)=>a.mode==='orbit',1100);
 await check('地点选择 图书馆','地点模块',`(()=>{const s=document.getElementById('place-picker');if(!s)return 'MISSING';const o=[...s.options].find(x=>x.value==='lib');if(!o)return 'NO OPTION';s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));return o.value;})()`,(b,a)=>a.place==='lib',1200);
 /* --- 漫游模式链路 --- */
 await check('进入第一人称步行','漫游模块',click('#walk-toggle'),(b,a)=>a.mode==='walk'&&a.pv==='first',1400);
 await check('步行切第三人称人物','漫游模块',click('#view-toggle'),(b,a)=>a.pv!==b.pv,900);
 await check('人物视角切回','漫游模块',click('#view-toggle'),(b,a)=>a.pv!==b.pv,900);
 await check('退出步行回俯视','漫游模块',click('#walk-toggle'),(b,a)=>a.mode==='orbit',900);
 await check('开小车','漫游模块',click('#drive-toggle'),(b,a)=>a.mode==='drive',1400);
 await check('跟车视角切换','漫游模块',click('#view-toggle'),(b,a)=>a.pv!==b.pv||a.mode==='walk',900);
 await check('下车','漫游模块',click('#drive-toggle'),(b,a)=>a.mode==='walk'||a.mode==='orbit',900);
 await check('退出漫游回俯视','漫游模块',click('#walk-toggle'),(b,a)=>a.mode==='orbit',900);
 /* --- 室内链路 --- */
 await check('进入示意室内','室内模块',`(()=>{const b=[...document.querySelectorAll('button')].find(e=>(e.textContent||'').includes('图书馆 ↗'));if(!b)return 'MISSING';b.click();return 'ok';})()`,(b,a)=>a.mode==='interior',1600);
 await check('室内切天气仍生效（跨模块）','跨模块',sel('lighting','overcast'),(b,a)=>a.lighting==='overcast',900);
 await check('退出室内','室内模块',click('#walk-toggle'),(b,a)=>a.mode!=='interior',1200);
 await check('天气复位','天气模块',sel('lighting','daylight'),(b,a)=>a.lighting==='daylight',900);
 /* --- 最终态 --- */
 await check('最终回到 orbit 且 canvas 正常','全局',`(()=>{const r=document.getElementById('runtime');if(r&&r.dataset.playMode!=='orbit'){const b=document.getElementById('walk-toggle');if(b)b.click();}return 1;})()`,
    (b,a)=>a.mode==='orbit'&&a.canvas===true,1200);
 const failed=rows.filter(r=>!r.pass);
 const report={url:URL_,total:rows.length,passed:rows.length-failed.length,failed:failed.length,
   failures:failed,rows,errors,errorCount:errors.length};
 fs.writeFileSync(OUT,JSON.stringify(report,null,2));
 console.log('---');console.log(JSON.stringify({total:report.total,passed:report.passed,failed:report.failed,errorCount:errors.length}));
 if(failed.length)failed.forEach(f=>console.log('FAIL:',f.name,'|',f.note,'| before',JSON.stringify(f.before),'| after',JSON.stringify(f.after)));
 if(errors.length)errors.slice(0,8).forEach(e=>console.log('ERR:',e));
 ws.close();child.kill('SIGKILL');
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
