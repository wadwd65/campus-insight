/* 11-07 七改：只修图书馆入口「几何结构 / 坐标 / 衔接」，不动任何颜色材质贴图
 * v10-final.html → v11-final.html
 * 依据 lib-geom-probe：frame 带旋转，入口沿世界 +x 排开；
 * 主体东边界 x≈-26.9，原 entry oz=-18 → x≈-24.1（离墙 2.8m 悬空），
 * 台阶再散到 x≈-22，中间断一块、留下凸起。
 */
const fs=require('fs');
const SRC='D:/repro-test/v10-final.html',DST='D:/repro-test/v11-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,100)}`);s=s.replace(from,to);console.log('  ✓',label);}
/* 1) 门厅与柱廊整体收回贴主体东边界；柱数 3→2 且拉开间距，不再在入口正中插一根孤柱 */
sub(
`colonnade(q,0,-14.2,3,5.6,5.8,.6,true);entry(q,0,-18,17,6.6,true);`,
`colonnade(q,0,-14.75,2,11.2,5.8,.6,true);entry(q,0,-14.75,17,6.6,true);`,
  '门厅/柱廊 oz 收回贴主体');
/* 2) 门厅基座改为「从墙内伸到门厅」的连续实体，消除墙与门厅之间的断口 */
sub(
`part(p,ox,.41,oz-.10,gw+.30,.82,.42,'curb');`,
`part(p,ox,.41,oz+.40,gw+.30,.82,.90,'curb');`,
  '基座跨接主体与门厅');
/* 3) 主体地板延伸到门前广场边缘，填平实测的 2.0m 断口（只改深度尺寸） */
sub(
`part(q,0,.6,0,77,1,29,'paving');`,
`part(q,0,.6,0,77,1,34,'paving');`,
  '主体地板延伸至广场边缘');
/* 4) 台阶移到延伸后的地板外侧，从主体标高逐级下降到广场，不再被埋/悬空 */
sub(
`const sy=.47+i*.14, sz=oz-2.7+i*.8, sw=w*.80-i*.55;`,
`const sy=.47+i*.14, sz=oz-4.2+i*.8, sw=w*.80-i*.55;`,
  '台阶移到地板外侧');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
