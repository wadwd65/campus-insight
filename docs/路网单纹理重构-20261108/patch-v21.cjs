/* 11-08 十五改 b：修路网纹理坐标（v20-final.html → v21-final.html）
 * ① ground UV 是 v=1-(z-minZ)/spanZ，CanvasTexture flipY=true ⇒
 *    canvasY 应正比于 (z-minZ)，v20 写成 1-(z-minZ)/spanZ 多翻一次，
 *    导致人行道层/路面层/虚线层被画到不同位置（只剩错位白色粗带）。
 * ② canvas 固定 4096×4096 但场地 spanX≠spanZ ⇒ 横竖方向 ppm 不同，
 *    线条宽度随方向变化（变形）。改为 canvas 高度按 spanZ/spanX 同比。 */
const fs=require('fs');
const SRC='D:/repro-test/v20-final.html',DST='D:/repro-test/v21-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(a,b,l){const n=s.split(a).length-1;if(n!==1)throw new Error(`[${l}] 期望1处实际${n}处`);s=s.replace(a,b);console.log('  ✓',l);}
sub(
`  const RN=4096;
  const rcan=document.createElement('canvas');rcan.width=RN;rcan.height=RN;
  const rg=rcan.getContext('2d');
  const spanX=gb.max.x-gb.min.x,spanZ=gb.max.z-gb.min.z;
  const sx=RN/spanX,sz=RN/spanZ,ppm=Math.min(sx,sz);
  const RX=x=>(x-gb.min.x)/spanX*RN;
  const RZ=z=>(1-(z-gb.min.z)/spanZ)*RN;   /* CanvasTexture flipY */`,
`  const RN=4096;
  const spanX=gb.max.x-gb.min.x,spanZ=gb.max.z-gb.min.z;
  const rcan=document.createElement('canvas');
  rcan.width=RN;rcan.height=Math.max(1,Math.round(RN*spanZ/spanX));
  const rg=rcan.getContext('2d');
  const ppm=RN/spanX;   /* 宽高同比 ⇒ 各方向线宽一致，不会变形 */
  const RX=x=>(x-gb.min.x)/spanX*rcan.width;
  const RZ=z=>(z-gb.min.z)/spanZ*rcan.height;  /* ground UV + flipY ⇒ 正比 */`,
  '修坐标翻转与画布比例');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
