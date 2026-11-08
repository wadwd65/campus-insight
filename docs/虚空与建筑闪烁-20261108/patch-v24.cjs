/* 11-08 十六改：一次性修「虚空」+「所有建筑持续绘制闪烁」
 * 基于当前桌面唯一版 v23-final.html
 * A 虚空：walkSurfaces 登记条件去掉 y>2（地面层平台从未登记）；
 *        floorAt 改为纳入所有已渲染实体平台顶面，碰撞高度与渲染几何一致。
 * B 闪烁：实测全场景 500 对跨批次共面实例（curb×white 192、glass×terrace:curb 84、
 *        curbLife×facade:canteen 7、curbLife×sand:apt-* 等遍布全部建筑类型），
 *        历史的 resolveCoplanar() 已不存在。按材质给每个批次分配稳定
 *        polygonOffset 层级，让共面时深度确定性分层——覆盖所有同类建筑，
 *        不改几何坐标（碰撞/阴影/射线全不变），不是临时规避。
 */
const fs=require('fs');
const SRC='D:/repro-test/v23-final.html',DST='D:/repro-test/v24-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(a,b,l){const n=s.split(a).length-1;if(n!==1)throw new Error(`[${l}] 期望1处实际${n}处: ${a.slice(0,100)}`);s=s.replace(a,b);console.log('  ✓',l);}

/* A1 放宽可站平台登记：地面层平台也要登记，否则 floorAt 永远看不到它们 */
sub(
`if(['box','roofBox'].includes(kind)&&w>=2&&d>=2&&h<=1.2&&y>2&&['roof','curb','paving','white','glass','timber'].includes(material))walkSurfaces.push({...object,key:key||frame?.key,top:y+h/2});`,
`/* 11-08：去掉 y>2 —— 广场/门前平台等地面层实体此前从未登记，
       导致 floorAt 只认道路 .375 与草地 .04，走上去穿进虚空。 */
    if(['box','roofBox'].includes(kind)&&w>=2&&d>=2&&h<=1.2&&y>=0&&['roof','curb','paving','white','glass','timber','accent','curbLife','curbPublic'].includes(material))walkSurfaces.push({...object,key:key||frame?.key,top:y+h/2});`,
  'A1 平台登记覆盖地面层');

/* A2 floorAt 纳入所有实体平台顶面 */
sub(
`  function floorAt(x,z){
    if(onDeck(x,z))return 1.2;
    if(edgeDistance(x,z,shoreEdges)<=2.15)return .96;
    if(stadium&&insidePolygon(x,z,stadium.outline))return .71;
    if(stadium&&insidePolygon(x,z,stadium.podium))return .38;
    for(const r of roads){const d=segmentDistance(x,z,r.a,r.b);if(d<=r.width/2)return .375;if(d<=r.width/2+2.5)return .26;}
    return .04;
  }`,
`  function floorAt(x,z){
    let base=.04;
    if(stadium&&insidePolygon(x,z,stadium.podium))base=.38;
    if(stadium&&insidePolygon(x,z,stadium.outline))base=.71;
    if(edgeDistance(x,z,shoreEdges)<=2.15)base=.96;
    if(onDeck(x,z))base=1.2;
    for(const r of roads){const d=segmentDistance(x,z,r.a,r.b);if(d<=r.width/2)base=Math.max(base,.375);else if(d<=r.width/2+2.5)base=Math.max(base,.26);}
    /* 11-08：把已渲染的实体平台顶面纳入支撑高度。
       只取 3m 以下的地面层平台，屋顶等高层仍由 roofAt/supportAt 处理。 */
    for(const s of surfaces){
      const top=s.top??(s.y+s.h/2);
      if(top<=base||top>3)continue;
      const p=localPoint(x,z,s);
      if(Math.abs(p.x)<=s.w/2+WALK.radius&&Math.abs(p.z)<=s.d/2+WALK.radius)base=top;
    }
    return base;
  }`,
  'A2 floorAt 与实体平台对齐');

/* B1 深度层级常量（数值越小越靠前/越稳定胜出；未列出的主体材质为 0） */
sub(
`  for(const[id,objects]of batches) {
    const[kind,material,owner]=id.split(':'),geometry=kind==='facade'&&material==='libraryStone'?geometries.stoneFacade:kind==='box'&&material==='libraryGlass'?geometries.glazing:geometries[kind],mesh=new T.InstancedMesh(geometry,owner?PB_material(material,owner):materials[material],objects.length);`,
`  /* 11-08：共面消解（替代已缺失的 resolveCoplanar）。
     实测 500 对跨批次共面遍布食堂/宿舍/实验楼/教学楼/综合楼，
     按材质给每个批次一个确定性深度层级：装饰件稳定压在铺装/主体之上，
     GPU 深度不再逐帧交替。几何坐标完全不动 ⇒ 碰撞/阴影/射线不受影响。 */
  const DEPTH_LAYER={paving:-1,accent:-6,white:-2,curb:-3,curbLife:-3,curbPublic:-3,
    glass:-4,windowBand:-5,timber:-7,libraryGlass:-8,roof:-2,sign:-9};
  for(const[id,objects]of batches) {
    const[kind,material,owner]=id.split(':'),geometry=kind==='facade'&&material==='libraryStone'?geometries.stoneFacade:kind==='box'&&material==='libraryGlass'?geometries.glazing:geometries[kind];
    let mat=owner?PB_material(material,owner):materials[material];
    const layer=DEPTH_LAYER[material];
    if(layer!==undefined){mat=mat.clone();mat.polygonOffset=true;mat.polygonOffsetFactor=layer;mat.polygonOffsetUnits=layer;}
    const mesh=new T.InstancedMesh(geometry,mat,objects.length);`,
  'B1 建筑批次深度分层');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
