/* 11-06 3D 地图三症修复
 * 输入：C:/Users/123/Desktop/校园3D-唯一版.html（只读）
 * 输出：D:/repro-test/latest3d-mapfix.html
 *
 * 证据（z-probe2.js 实测）：static-sun-shadow y=.36；box:road 顶 .365（差 .005）、
 * junction:road 顶 .37（差 .01）、部分 paving .34/.40。相机 near=1 far=3000，
 * 300m 处 24bit 深度量化约 .0054m ⇒ .005m 必然 z-fighting，移动时交替 ⇒ 交错残影。
 * 另：1522 行每棵树都 add('contact', size*3, size*2.7)，bake 按 p.w/spanX*w*.45
 * 放大成巨大椭圆 + 位置偏移 ⇒ 草地/广场上的黑斑（"贴到不该贴的地方"）。
 */
const fs = require('fs');
const SRC = 'C:/Users/123/Desktop/校园3D-唯一版.html';
const DST = 'D:/repro-test/latest3d-mapfix.html';
let s = fs.readFileSync(SRC, 'utf8');
const orig = s.length;

function sub(from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`[${label}] 期望 1 处，实际 ${n} 处：${from.slice(0, 90)}`);
  s = s.replace(from, to);
  console.log('  ✓', label);
}

/* ===== A. z-fighting 主修 ================================================ */

/* A1 烘焙阴影贴片：把深度往远推，让所有实面稳定胜出 */
sub(
`  const material=new T.MeshBasicMaterial({map:texture,color:0x424d56,transparent:true,opacity:.5,depthWrite:false});`,
`  /* 11-06：透明贴片与路面几乎共面时，光靠 y 分层仍会抖；polygonOffset 把
     贴片深度稳定往远推，路面/铺装永远稳定胜出，不再交替渲染。 */
  const material=new T.MeshBasicMaterial({map:texture,color:0x424d56,transparent:true,opacity:.5,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:2});`,
  '阴影贴片加 polygonOffset'
);

/* A2 纠正注释里的错误前提，并把贴片压到所有硬质面之下 */
sub(
`  /* 10-26：原为 .82-.04=.78，而建筑实际底边在 0.6（见 campus-scene.js wing() 的 h/2+.6），
     即投影层比楼还高，俯视时会糊在墙面上。现压到 .36：高于路面(.29)与草地(.04)，
     低于接触阴影(.38)与楼体(.6)，既不穿模也不被路面吃掉。 */
  const layer=new T.Mesh(campus.ground.geometry.clone(),material);layer.name='static-sun-shadow';layer.position.y=.36;layer.renderOrder=2;`,
`  /* 11-06 更正：旧注释写的「高于路面(.29)」是错的 —— .29 是路面方体的**中心 y**，
     顶面其实是 .29+.15/2=.365，路口 .37。贴片放在 .36 只差 .005m，
     在 near=1/far=3000 的深度精度下正好等于一个量化步长 ⇒ 移动时交错残影。
     现压到 .20：低于 sidewalk(.25)/paving(.34)/road(.365)/junction(.37)，
     高于草地(.04)，并配合上面的 polygonOffset 双保险。 */
  const layer=new T.Mesh(campus.ground.geometry.clone(),material);layer.name='static-sun-shadow';layer.position.y=.20;layer.renderOrder=2;`,
  '阴影贴片 y .36→.20'
);

/* A3 小车接地阴影：世界 y≈.4 与部分 paving .4 完全共面，往近推稳定盖在地面上 */
sub(
`    new T.MeshBasicMaterial({map:shTex,transparent:true,opacity:.42,depthWrite:false}));`,
`    new T.MeshBasicMaterial({map:shTex,transparent:true,opacity:.42,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));`,
  '小车接地阴影加反向 polygonOffset'
);

/* ===== B. 烘焙接触阴影：巨大黑斑 ======================================== */

/* B1 每棵树都塞一个 size*3 的大椭圆 → 几百个叠加成脏斑；直接去掉。
   树靠草地纹理与全局建筑投影已经够，不需要独立接触阴影。 */
sub(
`    add('contact','softShadow',x+1,.38,z+1,size*3,1,size*2.7);`,
`    /* 11-06：删掉每棵树的巨型接触阴影。size*3 的椭圆经 bake 放大后
       几百个叠在一起，在草地/广场上变成一片片黑斑（"贴到不该贴的地方"）。 */`,
  '删除每棵树的巨型接触阴影'
);

/* B2 图书馆那块去掉 +3m 位置偏移（斑本来就不在楼底下），尺寸收敛到体块附近 */
sub(
`      add('contact','softShadow',x+3,.38,z+3,93,1,47);`,
`      add('contact','softShadow',x,.38,z,width*.55,1,depth*.55);`,
  '图书馆接触阴影对齐并收敛尺寸'
);

/* B3 bake 里夹紧半径、降低浓度：即便调用处传大尺寸也不会铺满画布 */
sub(
`      const[x,y]=pixel(p.x,p.z),rx=p.w/spanX*w*.45,ry=p.d/spanZ*h*.45;`,
`      const[x,y]=pixel(p.x,p.z);
      /* 11-06：半径夹紧到画布 1.8%，防止历史调用里 93×47 之类的整片尺寸
         把接触阴影放大成盖住草地/广场的黑色椭圆。 */
      const rx=Math.min(p.w/spanX*w*.45,w*.018),ry=Math.min(p.d/spanZ*h*.45,h*.018);`,
  'bake 接触阴影半径夹紧'
);
sub(
`      const g=context.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'#ffffff75');g.addColorStop(1,'#ffffff00');`,
`      const g=context.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'#ffffff38');g.addColorStop(1,'#ffffff00');`,
  '接触阴影浓度降低'
);

/* B4 ★ 黑椭圆的真因：bake() 的 tree 分支给每棵树画 7 个 lobe，
   半影+本影两遍、本影 alpha=.88 叠到近 1 ⇒ 几乎纯黑的椭圆簇，
   再按太阳角度偏移到草地/广场，看起来就像贴错的黑色贴纸。
   单变量修法：树影浓度压到 30%，建筑投影浓度完全不变。 */
sub(
`    const drawPass=(alpha,blur,spread)=>{
      context.globalAlpha=alpha;context.filter=\`blur(\${blur}px)\`;context.fillStyle='#fff';
      for(const caster of campus.shadowCasters){
        if(caster.kind==='tree'){`,
`    const drawPass=(alpha,blur,spread)=>{
      context.globalAlpha=alpha;context.filter=\`blur(\${blur}px)\`;context.fillStyle='#fff';
      for(const caster of campus.shadowCasters){
        /* 11-06 ★ 射线探针确认：黑椭圆像素最上层就是这层烘焙阴影。
           树冠的 7-lobe 椭圆被半影+本影两遍叠成死黑，钉在草地/广场上；
           压 alpha 不够，直接不烘焙树影，建筑投影完整保留。 */
        if(caster.kind==='tree')continue;
        if(caster.kind==='tree'){`,
  '树影不参与烘焙（黑斑真因）'
);

/* ===== C. 贴图分槽收敛：非立面构件不再贴 trim 图 ======================== */
/* 11-05 把 curb* 纳入按楼分槽后，台阶 / 女儿墙 / 看台 / 路缘都被贴上了
   带「顶边亮线 + 底边暗线」的 trim 贴图，小方块上看着像贴纸。
   屋顶仍保留按楼分槽（屋顶贴屋顶图是合理的）。 */
sub(
`  roof:'roof', roofLife:'roof', roofPublic:'roof',
  curb:'trim', curbLife:'trim', curbPublic:'trim',`,
`  roof:'roof', roofLife:'roof', roofPublic:'roof',`,
  'curb/女儿墙/台阶退出按楼贴图分槽'
);

/* ===== D. 阴影体系：默认回到烘焙层，实时阴影改为显式开关 ============== */
/* 依据：3784 行原本 staticShadow.layer.visible=false（烘焙层不上屏），
   3776 行 renderer.shadowMap.enabled=true（实时阴影开）。2048 shadow map
   摊在 600m 校区上 ≈ 0.3m/texel，且 shadowMap.autoUpdate=false —— 阴影相机
   随视角/玩家移动却不重算贴图 ⇒ 公路与铺装上交错残影；树冠实时投影落成
   死黑椭圆。上面 A 段修好的「烘焙层 y=.20 + polygonOffset」只有把烘焙层
   重新启用才真正生效。?shadow=1 保留实时阴影供对比，不删功能。 */
sub(
`  const COMPAT=new URLSearchParams(location.search).get("shadow")==="0"; /* 10-29 默认关闭实时阴影：它是最可能把低配显卡顶崩的一步；?shadow=1 可开回 */`,
`  /* 11-06：默认只用烘焙阴影（稳定、可复现、零实时开销）；实时阴影需 ?shadow=1。
     旧逻辑默认开实时阴影并关掉烘焙层，是移动时交错残影与黑椭圆的根因。 */
  const COMPAT=new URLSearchParams(location.search).get("shadow")!=="1";`,
  '默认关闭实时阴影'
);
sub(
`    if(staticShadow&&staticShadow.layer)staticShadow.layer.visible=false;`,
`      /* 实时阴影关掉时把烘焙层开回来，别让两层都没有 */
      if(staticShadow&&staticShadow.layer)staticShadow.layer.visible=COMPAT;`,
  '启用烘焙阴影层'
);
/* setQuality 比 COMPAT 声明更早被调用，不能直接引用 COMPAT（TDZ）；直接读 URL */
sub(
`renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;sun.castShadow=true;campus.setDetail(qualityName);`,
`const rtShadow=new URLSearchParams(location.search).get("shadow")==="1";renderer.shadowMap.enabled=rtShadow;renderer.shadowMap.type=T.PCFSoftShadowMap;sun.castShadow=rtShadow;if(staticShadow&&staticShadow.layer)staticShadow.layer.visible=!rtShadow;campus.setDetail(qualityName);`,
  '切画质时不把实时阴影偷偷开回来'
);

/* ===== E. 建模：被压扁成近黑大盘的花坛/灌木 ============================ */
/* 探针实证：tree:foliage 有 6.29×0.31×2.77m 的扁平实例，成对对称，
   正对应广场两侧的「黑椭圆」。其最终色 = 白材质 × 几何灰度≈.7 ×
   实例深绿(0.19,.29,.13) × 光照 ⇒ 近黑；且 0.31m 厚根本不像灌木，
   这是「建模没修好」+「贴到不该贴的地方」的同一处。
   只修被压扁的那一类：厚度下限 .85m，并给它们浅一档的绿；
   正常灌木（h≥.85）与显式传 color 的花坛完全不动。 */
sub(
`    if(kind==='contact'){shadowContacts.push({x,z,w,d,rotation});return;}
    if(kind==='box'&&material==='roof')kind='roofBox';`,
`    if(kind==='contact'){shadowContacts.push({x,z,w,d,rotation});return;}
    /* 11-06：花坛/灌木别再被压成 0.3m 厚的近黑大盘（广场上的黑椭圆）。 */
    if(material==='foliage'){
      const flat=h<.85;
      h=Math.max(h,.85);
      if(flat&&!color)color=0x9dbb8c;
    }
    if(kind==='box'&&material==='roof')kind='roofBox';`,
  '扁平花坛厚度下限 + 提亮'
);

/* ===== F. 构建时让树不投影（黑椭圆的最后一环） ========================= */
/* 对照链：隐藏 foliage+trunk 批次 → 黑斑消失；隐藏 canopy → 黑斑仍在；
   运行时关 castShadow → 无效；改实例厚度/颜色 → 无效。
   ⇒ 黑斑是初始化那一帧烤进 shadow map 的树影。renderer.shadowMap.autoUpdate=false
   之后贴图永不重算，于是这些椭圆被"钉"在草地和广场上，移动视角时还和路面抢深度。
   必须在**构建批次时**排除，运行时改来不及。 */
sub(
`    mesh.castShadow=!['shadow','softShadow','sign','windowBand','road','paving','glass'].includes(material);mesh.receiveShadow=!['shadow','softShadow','sign'].includes(material);`,
`    /* 11-06：树/灌木/树干不进阴影贴图 —— 否则 2048 贴图罩 600m 校区，
       树影被烤成死黑椭圆并因 autoUpdate=false 永久钉在地面与广场上。 */
    mesh.castShadow=!['shadow','softShadow','sign','windowBand','road','paving','glass','foliage','trunk','canopy'].includes(material);mesh.receiveShadow=!['shadow','softShadow','sign'].includes(material);`,
  '构建时排除树的投影'
);

fs.writeFileSync(DST, s, 'utf8');
console.log('---');
console.log('源文件', orig, '字符 → 输出', s.length, '字符（', s.length - orig, '）');
console.log('已写', DST);
