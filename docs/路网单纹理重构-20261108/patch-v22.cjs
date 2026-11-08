/* 11-08 十五改 c：路网平面改 MeshBasicMaterial（v21-final.html → v22-final.html）
 * canvas 三层像素都在（白69.8万/深灰122万/黄3.4万），但 Lambert 在本场景
 * ambient .56 + sun 1.95 + fill .30 的照度下把深灰过曝洗成白。
 * 改 Basic：颜色完全由纹理决定，恒定、不过曝、不随光照波动。
 * 静态阴影层仍在 y=.38 之上，投影照常可见。 */
const fs=require('fs');
const SRC='D:/repro-test/v21-final.html',DST='D:/repro-test/v22-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
const a=`  const roadMat=new T.MeshLambertMaterial({map:roadTex,transparent:false,alphaTest:.5,side:T.DoubleSide});`;
const b=`  /* Basic 而非 Lambert：场景照度约 2.8 会把深灰路面过曝成白；
     路面颜色由纹理唯一决定，也避免天气/太阳变化带来的明暗跳变。 */
  const roadMat=new T.MeshBasicMaterial({map:roadTex,transparent:false,alphaTest:.5,side:T.DoubleSide});`;
if(s.split(a).length-1!==1)throw new Error('roadMat 锚点不唯一');
s=s.replace(a,b);console.log('  ✓ roadMat 改 Basic');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
