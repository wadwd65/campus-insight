/* 11-08 十四改：道路系统整体重构（v17-final.html → v18-final.html）
 * 用户明确要求重构，停止补丁式修补。
 * 旧实现：每段一个 box，端点靠 +.6 / -w / 补块 反复调，
 *         必然在「重叠 ⇒ z-fighting 冲突点」与「缝隙 ⇒ 裂纹」之间来回摆。
 * 新实现：每条 polyline 生成一整条连续 ribbon 网格；
 *         每个拐点用 miter 算出左右边界顶点，相邻段共用同一顶点，
 *         单一 mesh、零重叠、零缝隙；UV 按累计弧长铺，虚线沿路连续。
 * 不改材质/贴图资源本身（只给 road/paving 贴图开 S 方向重复以配合连续 UV）。
 */
const fs=require('fs');
const SRC='D:/repro-test/v17-final.html',DST='D:/repro-test/v18-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function block(startMark,endMark,text,label){
  const a=s.indexOf(startMark),b=s.indexOf(endMark,a);
  if(a<0||b<0||b<=a)throw new Error(`[${label}] 边界未找到 a=${a} b=${b}`);
  s=s.slice(0,a)+text+s.slice(b);
  console.log('  ✓',label,`(替换 ${b-a} 字符)`);
}
block(
`  /* 11-06：段长改为 length / length，不再额外 +1/+2 重叠。`,
`  flatShape(data.lake,.34,'shoreOuter',1.062);`,
`  /* ===== 11-08 十四改：道路整体重构 =====
     每条路 = 一条连续 ribbon（单一 BufferGeometry / 单一 Mesh）。
     拐点用 miter=(halfW)/dot(n,n2) 算左右边界，相邻段共享顶点 ⇒
     物理上不存在重叠面（无冲突点）也不存在缝隙（无裂纹）。
     顶面高度：sidewalk .25、road .365，与旧版一致；UV 按累计弧长铺。 */
  function makeRoadRibbon(pts,halfW,y,material,period,name,joints){
    const P=pts.map(p=>{const [x,z]=coord(p[0],p[1]);return [x,z];});
    const n=P.length;
    const closed=n>2&&P[0][0]===P[n-1][0]&&P[0][1]===P[n-1][1];
    const m=closed?n-1:n;
    if(m<2)return null;
    const S=[0];
    for(let i=1;i<m;i++)S[i]=S[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
    const total=S[m-1]+(closed?Math.hypot(P[0][0]-P[m-1][0],P[0][1]-P[m-1][1]):0);
    const L=[],R=[];
    for(let i=0;i<m;i++){
      const prev=P[closed?(i-1+m)%m:Math.max(0,i-1)],cur=P[i],next=P[closed?(i+1)%m:Math.min(m-1,i+1)];
      const d1=[cur[0]-prev[0],cur[1]-prev[1]],d2=[next[0]-cur[0],next[1]-cur[1]];
      const l1=Math.hypot(d1[0],d1[1])||1,l2=Math.hypot(d2[0],d2[1])||1;
      const u1=[d1[0]/l1,d1[1]/l1],u2=[d2[0]/l2,d2[1]/l2];
      const n1=[-u1[1],u1[0]],n2=[-u2[1],u2[0]];
      let nx=n1[0]+n2[0],nz=n1[1]+n2[1],nl=Math.hypot(nx,nz);
      if(nl<1e-6){nx=n2[0];nz=n2[1];nl=1;}
      nx/=nl;nz/=nl;
      const denom=Math.max(.35,nx*n2[0]+nz*n2[1]);  /* 上限钳制，防止急弯爆炸 */
      const sc=halfW/denom;
      L.push([cur[0]+nx*sc,cur[1]+nz*sc]);
      R.push([cur[0]-nx*sc,cur[1]-nz*sc]);
    }
    const pos=[],uv=[],nor=[],idx=[];
    const segCount=closed?m:m-1;
    for(let i=0;i<segCount;i++){
      const j=(i+1)%m;
      const s0=S[i]/period,s1=(closed&&i===m-1)?total/period:S[j]/period;
      const base=pos.length/3;
      pos.push(L[i][0],y,L[i][1], R[i][0],y,R[i][1], R[j][0],y,R[j][1], L[j][0],y,L[j][1]);
      uv.push(s0,0, s0,1, s1,1, s1,0);
      for(let k=0;k<4;k++)nor.push(0,1,0);
      idx.push(base,base+1,base+2, base,base+2,base+3);
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    geo.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
    geo.setIndex(idx);
    const mesh=new T.Mesh(geo,material);
    mesh.name=name;mesh.position.y=0;mesh.receiveShadow=true;
    mesh.userData.joints=joints||P.slice(0,m);
    root.add(mesh);
    return mesh;
  }
  /* 连续 UV 需要贴图在 S 方向重复；road/paving 贴图只服务地面，改 wrap 不影响别处 */
  if(textures.road){textures.road.wrapS=T.RepeatWrapping;textures.road.needsUpdate=true;}
  if(textures.roadNormal){textures.roadNormal.wrapS=T.RepeatWrapping;textures.roadNormal.needsUpdate=true;}
  if(textures.paving){textures.paving.wrapS=T.RepeatWrapping;textures.paving.needsUpdate=true;}
  data.roads.forEach((road,ri)=>{
    const joints=road.pts.map(p=>{const [x,z]=coord(p[0],p[1]);return [x,z];});
    makeRoadRibbon(road.pts,(road.w+5)/2,.25,materials.sidewalk,24,'sidewalk-ribbon-'+ri,joints);
    makeRoadRibbon(road.pts,road.w/2,.365,materials.road,24,'road-ribbon-'+ri,joints);
  });
  /* 旧版 junctions Map / 所有补块逻辑整段删除；道路不再产生任何独立 box 实例 */

`,
  '道路重构为连续 ribbon');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
