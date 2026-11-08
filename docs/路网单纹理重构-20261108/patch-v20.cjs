/* 11-08 十五改：路网改为「单张覆盖纹理 + 单一平面」
 * v17-final.html → v20-final.html
 * 为什么：段拼接(box) 与 多 Mesh ribbon 都失败——
 *   box: 加长⇒共面闪烁/黑裂片；精确相接⇒斜角缝；补块⇒色块/全局污染
 *   ribbon: miter 撑宽拐角⇒变形；每条路独立 Mesh⇒交切处跨 Mesh 闪烁；两套 UV⇒虚线重复
 * 正解：取消"拼接"这个概念。用 canvas 2D 按真实宽度一次画出整张路网
 *   (lineJoin='round' 天然处理所有交接)，贴到覆盖场地的单一平面。
 *   单平面、单材质、无重叠面、无 UV 分裂 ⇒ 变形/重复/闪烁结构性地不存在。
 */
const fs=require('fs');
const SRC='D:/repro-test/v17-final.html',DST='D:/repro-test/v20-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function block(a,b,t,l){const i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<0||j<=i)throw new Error(`[${l}] 边界未找到`);s=s.slice(0,i)+t+s.slice(j);console.log('  ✓',l,`(替换 ${j-i} 字符)`);}
block(
`  /* 11-06：段长改为 length / length，不再额外 +1/+2 重叠。`,
`  flatShape(data.lake,.34,'shoreOuter',1.062);`,
`  /* ===== 11-08 十五改：整个路网 = 一张覆盖纹理 + 一个平面 =====
     取消所有「段拼接」：canvas 2D 用 round join 按真实宽度一次画完，
     拐角/交叉天然连续；单平面单材质，无共面重叠、无 UV 分裂。 */
  const RN=4096;
  const rcan=document.createElement('canvas');rcan.width=RN;rcan.height=RN;
  const rg=rcan.getContext('2d');
  const spanX=gb.max.x-gb.min.x,spanZ=gb.max.z-gb.min.z;
  const sx=RN/spanX,sz=RN/spanZ,ppm=Math.min(sx,sz);
  const RX=x=>(x-gb.min.x)/spanX*RN;
  const RZ=z=>(1-(z-gb.min.z)/spanZ)*RN;   /* CanvasTexture flipY */
  const trace=r=>{rg.beginPath();r.pts.forEach((p,i)=>{const[x,z]=coord(p[0],p[1]);i?rg.lineTo(RX(x),RZ(z)):rg.moveTo(RX(x),RZ(z));});};
  rg.lineCap='round';rg.lineJoin='round';
  /* 人行道：浅色、更宽，先画 */
  rg.strokeStyle='#e7eae1';
  data.roads.forEach(r=>{rg.lineWidth=(r.w+5)*ppm;trace(r);rg.stroke();});
  /* 路面：深灰、较窄 */
  rg.strokeStyle='#8d918c';
  data.roads.forEach(r=>{rg.lineWidth=r.w*ppm;trace(r);rg.stroke();});
  /* 黄色中线虚线：沿每条路一次画完，交接处不会有两套 */
  rg.strokeStyle='#e9cf82';rg.lineWidth=Math.max(1.8,.4*ppm);
  rg.setLineDash([2.6*ppm,3.4*ppm]);
  data.roads.forEach(r=>{trace(r);rg.stroke();});
  rg.setLineDash([]);
  const roadTex=new T.CanvasTexture(rcan);roadTex.minFilter=T.LinearFilter;roadTex.magFilter=T.LinearFilter;
  const roadMat=new T.MeshLambertMaterial({map:roadTex,transparent:false,alphaTest:.5,side:T.DoubleSide});
  const roadPlane=new T.Mesh(ground.geometry.clone(),roadMat);
  roadPlane.name='road-network';roadPlane.position.y=.365;roadPlane.receiveShadow=true;
  roadPlane.userData.joints=data.roads.flatMap(r=>r.pts.map(p=>{const[x,z]=coord(p[0],p[1]);return [x,z];}));
  root.add(roadPlane);
  /* 旧版 junctions Map / box 段 / 所有补块逻辑整段删除 */

`,
  '路网改为单张覆盖纹理');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
