/* 11-08 十七改：恢复渲染精度（v24-final.html → v25-final.html）
 * 实测：quality=high 静止应为 dpr=2，但 raster-probe 显示静止也是
 *       mode='moving', dpr=1.2, 缓冲 1644×865（本应 2800×1800）。
 * 根因 ① applyRaster 的 moving 判定含 state.waterTick，水面动画常驻 ⇒ 永远移动档；
 *      ② renderPlan 里 iframe/预览面板强制 quality='low' ⇒ dpr 1.0 / 0.85；
 *      ③ 动态自适应 moveScale 下限 .65，移动时进一步糊到 1.2*.65=.78。
 * 修：静止回清晰档、预览不再强制降档、自适应下限提到 .85（仍保留性能保护）。
 * 不动几何/材质/贴图/路网。
 */
const fs=require('fs');
const SRC='D:/repro-test/v24-final.html',DST='D:/repro-test/v25-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(a,b,l){const n=s.split(a).length-1;if(n!==1)throw new Error(`[${l}] 期望1处实际${n}处: ${a.slice(0,100)}`);s=s.replace(a,b);console.log('  ✓',l);}
sub(
`  if (typeof window !== 'undefined' && window.self !== window.top) quality = 'low';
  else if (!quality || quality === 'balanced') quality = 'high';`,
`  /* 11-08：预览面板/iframe 不再一刀切钉死省电档（用户实际在预览里看，
       远处一片糊）。低端设备仍由 DEV_LOW / ?q= 在初始化时降档，保护仍在。 */
  if (!quality || quality === 'balanced') quality = 'high';`,
  '预览不再强制低画质');
sub(
`applyRaster(!!(state.auto||state.flight||state.benchmark||walkNeedsFrame()||state.dragging||time<state.interactionUntil||state.waterTick));applyView();`,
`/* 11-08：只有「相机真的在动」才降采样；水面动画(waterTick)属于画面动、
      相机不动，不该把静止帧长期压在 moveDpr。静止回到 high 的 dpr=2。 */
   const cameraMoving=!!(state.auto||state.flight||state.benchmark||walkNeedsFrame()||state.dragging||time<state.interactionUntil);
   applyRaster(cameraMoving);applyView();`,
  '静止恢复清晰档');
sub(
`state.moveScale=Math.max(.65,state.moveScale*.85)`,
`state.moveScale=Math.max(.85,state.moveScale*.9)`,
  '自适应降采样下限提高');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
