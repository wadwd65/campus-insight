/* flow-audit.cjs —— 主站全流程截图巡检：进入 → 地图 → 答题门 → 答题 → 报告 → 上传
   用法：node flow-audit.cjs <baseUrl> <outPrefix> */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));
const BASE = process.argv[2] || 'http://localhost:5173/';
const PFX = process.argv[3] || 'flow';
const PORT = 9700 + Math.floor(Math.random() * 250);
const profile = path.join(os.tmpdir(), 'cdp-flow-' + Date.now());
const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,1000', BASE
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

setTimeout(async () => {
  const list = await fetch('http://127.0.0.1:' + PORT + '/json').then(r => r.json());
  const page = list.find(t => t.type === 'page' && t.url.startsWith('http'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const send = (m, p) => new Promise(res => {
    const i = ++id;
    const h = e => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); res(d.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: i, method: m, params: p || {} }));
  });
  const js = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const shot = async (name) => {
    await send('Page.captureScreenshot', { format: 'png' });
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const f = PFX + '-' + name + '.png';
    fs.writeFileSync(f, Buffer.from(s.data, 'base64'));
    console.log('  saved', f);
  };
  ws.onopen = async () => {
    await send('Page.enable');
    await sleep(9000);
    /* ① 入场 → 点进入 */
    console.log('① 入场页');
    await shot('01-intro');
    console.log('   click:', await js("(function(){var b=document.querySelector('.intro-enter button');if(!b)return 'no';b.click();return 'ok';})()"));
    await sleep(3000);
    await shot('02-map');

    /* ② 答题门 */
    console.log('② 答题门');
    console.log('   click:', await js("(function(){var b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('答 10 道题'));if(!b)return 'no';b.click();return 'ok';})()"));
    await sleep(2000);
    await shot('03-gate');

    /* ③ 答题（连点选项 12 次）*/
    console.log('③ 答题');
    console.log('   click:', await js("(function(){var b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('开始答题'));if(!b)return 'no';b.click();return 'ok';})()"));
    await sleep(2000);
    await shot('04-quiz');
    for (let i = 0; i < 16; i++) {
      const r = await js("(function(){var bs=[...document.querySelectorAll('main button')].filter(x=>{var t=x.textContent.trim();return t.length>2&&t.length<200&&t.indexOf('返回')<0;});if(!bs.length)return 'none';bs[0].click();return bs.length;})()");
      await sleep(1200);
      if (r === 'none') break;
    }
    await sleep(3500);
    await shot('05-report');

    /* ③-b 站内 3D 实景校园 */
    console.log('③-b 3D 场景');
    await js("(function(){var b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('3D 实景校园'));if(b){b.click();return 'ok';}return 'no-btn';})()");
    await sleep(22000);
    await shot('07-3d');
    console.log('   back:', await js("(function(){var b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('返回行动地图'));if(!b)return 'no';b.click();return 'ok';})()"));
    await sleep(2500);

    /* ④ 回地图 → 上传页 */
    console.log('④ 上传页');
    await js("(function(){var b=[...document.querySelectorAll('button')].find(x=>/回到地图|返回地图|MAP/i.test(x.textContent));if(b){b.click();return 'back';}location.href='/';return 'reload';})()");
    await sleep(3000);
    console.log('   click:', await js("(function(){var b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('上传班级问卷'));if(!b)return 'no';b.click();return 'ok';})()"));
    await sleep(2000);
    await shot('06-upload');

    ws.close(); child.kill(); process.exit(0);
  };
}, 2500);
