/* 11-08 十四改 b：修正 ribbon 三角形绕序（面朝上）+ 去掉贴图 needsUpdate 警告 */
const fs=require('fs');
const SRC='D:/repro-test/v18-final.html',DST='D:/repro-test/v19-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处`);s=s.replace(from,to);console.log('  ✓',label);}
sub(
`      idx.push(base,base+1,base+2, base,base+2,base+3);`,
`      /* 从上方看需逆时针（法线 +y），否则 FrontSide 背面剔除 ⇒ 整条路不可见 */
      idx.push(base,base+2,base+1, base,base+3,base+2);`,
  '修正三角形绕序');
sub(
`  if(textures.road){textures.road.wrapS=T.RepeatWrapping;textures.road.needsUpdate=true;}
  if(textures.roadNormal){textures.roadNormal.wrapS=T.RepeatWrapping;textures.roadNormal.needsUpdate=true;}
  if(textures.paving){textures.paving.wrapS=T.RepeatWrapping;textures.paving.needsUpdate=true;}`,
`  /* 只改 wrap，不显式 needsUpdate：部分程序化贴图此时还没有 image，会触发
     THREE.WebGLRenderer "Texture marked for update but no image data found" 警告 */
  if(textures.road)textures.road.wrapS=T.RepeatWrapping;
  if(textures.roadNormal)textures.roadNormal.wrapS=T.RepeatWrapping;
  if(textures.paving)textures.paving.wrapS=T.RepeatWrapping;`,
  '去掉贴图警告');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
