/**
 * exp-sat.cjs —— 单变量对照实验：到底是什么在"洗掉"饱和度？
 *
 * 背景：用户说"颜色暗淡"。vivid.cjs 实测发现病是**饱和度低**不是亮度低
 *   （地面 sat=0.011 / 坡面 0.052 / 墙 0.195）。
 *   且单独改材质色只带来 +35~40% 提升，说明**还有别的因素在稀释饱和度**。
 *
 * 可疑变量（逐个单独改，量"全画面平均饱和度"）：
 *   ① 半球光 0xBCCEDC 0.46（冷蓝）—— 冷色光会给暖材质"加蓝",拉低 sat
 *   ② 补光 fill  0x9EB4CA 0.24（冷蓝）—— 同上
 *   ③ 太阳     0xFFF4E4 0.78（暖白偏黄）—— 可能是**帮手**不是凶手
 *   ④ bounce   0xC8B49A 0.22（暖）
 *   ⑤ outputEncoding sRGB vs Linear
 *
 * 用法： node exp-sat.cjs
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const pagePath = process.argv[2] || 'apt.html';
const fileUrl = 'file:///' + path.resolve(pagePath).replace(/\\/g, '/');
const PORT = 9800 + Math.floor(Math.random() * 190);
const profile = path.join(require('os').tmpdir(), 'cdp-expsat-' + Date.now());

const child = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=swiftshader', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + profile, '--window-size=1440,960',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', fileUrl
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ★ 判据：全画面平均饱和度（排除天空与纯黑）
   + 同时给出"砖红墙区"的局部 sat（更贴近用户的观感焦点）*/
const METRIC = `
function() {
  return new Promise(function(resolve){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        var cvs = document.querySelector('canvas');
        var gl = cvs.getContext('webgl2') || cvs.getContext('webgl');
        var W = cvs.width, H = cvs.height;
        var px = new Uint8Array(W*H*4);
        gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
        var satAll=0, nAll=0, lumAll=0;
        var satWarm=0, nWarm=0;     // 暖像素（R>B+18）：建筑的砖红/木色
        for (var i=0;i<px.length;i+=4){
          var r=px[i], g=px[i+1], b=px[i+2];
          if (r+g+b < 60) continue;
          // 排除天空：天空是 B 主导且很亮
          var isSky = (b > r + 12 && b > 150);
          var mx=Math.max(r,g,b), mn=Math.min(r,g,b);
          var s=(mx-mn)/(mx||1);
          if (!isSky) { satAll+=s; lumAll+=0.299*r+0.587*g+0.114*b; nAll++; }
          if (r > b + 18 && r > 60) { satWarm+=s; nWarm++; }
        }
        resolve({
          satAll: nAll? +(satAll/nAll).toFixed(4) : 0,
          lumAll: nAll? +(lumAll/nAll).toFixed(1) : 0,
          nAll: nAll,
          satWarm: nWarm? +(satWarm/nWarm).toFixed(4) : 0,
          nWarm: nWarm
        });
      });
    });
  });
}
`;

/* 变体：每个是一个页面内执行的表达式（设置变量），null = baseline */
const VARIANTS = [
  { name: 'baseline（当前）', set: 'null' },
  { name: '半球光关', set: 'function(){return __setInt("HemisphereLight",0);}' },
  { name: '半球光 0.46→0.20', set: 'function(){return __setInt("HemisphereLight",0.20);}' },
  { name: 'fill 补光关', set: 'function(){return __setInt("DirectionalLight",0,"fill");}' },
  { name: '太阳 0.78→1.05', set: 'function(){return __setInt("DirectionalLight",1.05,"sun");}' },
  { name: 'bounce 关', set: 'function(){return __setInt("DirectionalLight",0,"bounce");}' },
  { name: 'outputEncoding 改 Linear', set: 'function(){__three.renderer.outputEncoding=3000;return "linear";}' }
];

(async () => {
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch (e) {}
    await sleep(300);
  }
  if (!wsUrl) { console.error('no target'); child.kill('SIGKILL'); process.exit(1); }

  const ws = new WebSocket(wsUrl);
  let id = 1; const pending = new Map();
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(res => {
    const myId = id++; pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });

  await send('Runtime.enable');
  await sleep(7000);

  /* 装 __setInt 辅助：按类型 + 可选位置关键词改强度，并返回清单 */
  await send('Runtime.evaluate', {
    expression: `
      window.__lights = [];
      __three.scene.traverse(function(o){ if(o.isLight) window.__lights.push(o); });
      window.__setInt = function(type, v, tag){
        var hits=[];
        window.__lights.forEach(function(o){
          if (o.type !== type) return;
          // tag 用于在多个同类型灯里挑：sun=第一个 Directional(position.y>80)
          if (tag==='sun' && !(o.position.y > 80)) return;
          if (tag==='fill' && !(o.position.y < 40 && o.position.y > 0)) return;
          if (tag==='bounce' && !(o.position.y < 0)) return;
          o.userData.__orig = (o.userData.__orig===undefined)? o.intensity : o.userData.__orig;
          o.intensity = v; hits.push(o.type+'@'+o.position.y.toFixed(0));
        });
        return hits.join(',') || 'none';
      };
      window.__restoreLights = function(){
        window.__lights.forEach(function(o){
          if (o.userData.__orig !== undefined) o.intensity = o.userData.__orig;
        });
        return 'restored '+window.__lights.length;
      };
      'ready '+window.__lights.length+' lights'
    `, returnByValue: true
  });

  console.log('变体                        全画面sat  暖色sat   暖像素数   L均值');
  for (const v of VARIANTS) {
    // 先复位
    await send('Runtime.evaluate', { expression: 'window.__restoreLights()' });
    let note = '';
    if (v.set !== 'null') {
      const r0 = await send('Runtime.evaluate', { expression: `(${v.set})()`, returnByValue: true });
      note = (r0.result && r0.result.result && r0.result.result.value) || '';
    }
    const r = await send('Runtime.evaluate', { expression: `(${METRIC})()`, awaitPromise: true, returnByValue: true, timeout: 30000 });
    const val = r.result && r.result.result && r.result.result.value;
    if (val) {
      console.log(
        v.name.padEnd(26) +
        String(val.satAll).padStart(9) +
        String(val.satWarm).padStart(10) +
        String(val.nWarm).padStart(10) +
        String(val.lumAll).padStart(8) +
        (note ? '   ← ' + note : '')
      );
    } else {
      console.log(v.name.padEnd(26) + ' ERR ' + JSON.stringify(r).slice(0, 120));
    }
  }
  // 复位
  await send('Runtime.evaluate', { expression: 'window.__restoreLights()' });

  ws.close(); child.kill('SIGKILL');
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error('ERR', e.message); try { child.kill('SIGKILL'); } catch (x) {} process.exit(1); });
