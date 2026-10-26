import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildCampusScene} from '../map-src/web/campus-scene.js';
import {QUALITY,initialQuality,constrainView,fitDistance,detailView,renderPlan,clipPlanes,insidePolygon,shouldUse3D,segmentDistance,polygonRoadClearance} from '../map-src/web/campus-model.js';
import {shadowHull,createStaticShadowLayer,LIGHTING} from '../map-src/web/campus-lighting.js';
import {createWaterClock,waterMotionAllowed,WATER_INTERVAL_MS} from '../map-src/web/campus-water.js';
import {createAtmosphere} from '../map-src/web/campus-atmosphere.js';
import {createGrassMaterial} from '../map-src/web/campus-detail.js';

let passed=0;
function test(name,fn){fn();passed++;console.log(`  ✓ ${name}`);}
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const scope=vm.createContext({});
vm.runInContext(read('map-src/three-packed.js'),scope);
const T=scope.THREE;
const data=JSON.parse(read('public/map/campus-data.json'));
const model=buildCampusScene(T,data);
const shadowCalls=[];
const shadowContext={clearRect(){shadowCalls.push('clear');},beginPath(){},ellipse(){},fill(){shadowCalls.push('fill');},moveTo(){},lineTo(){},closePath(){},save(){},translate(){},rotate(){},scale(){},createRadialGradient(){return {addColorStop(){}};},fillRect(){},restore(){}};
const shadowCanvas={width:1024,height:1024,getContext(){return shadowContext;}};
const shadow=createStaticShadowLayer(T,model,shadowCanvas);
test('34处导览图地点与湖、跑道均可选择，转换后坐标与参考数据一致',()=>{
  assert.equal(model.targets.length,36);assert.equal(new Set(model.targets.map(p=>p.key)).size,36);
  for(const p of data.places){const out=model.targets.find(t=>t.key===p.key);assert.equal(out.x,(p.px-data.transform.ox)*data.transform.k);assert.equal(out.z,(p.py-data.transform.oz)*data.transform.k);}
});
test('页面明确导览图人工标定、外形简化，不冒充测绘模型',()=>{
  assert.ok(data.source.includes('人工标定')&&data.source.includes('非测绘数据'));
  assert.equal(data.reference.filename,'Image_1789184180762_286.jpg');
  assert.equal(data.reference.width,674);assert.equal(data.reference.height,536);
  assert.ok(!read('scripts/build-campus-web.mjs').includes('tower-10-campus.js'));
  assert.ok(read('map-src/web/index.html').includes('导览图人工标定 · 艺术化建筑 · 非导航模型'));
});
test('全校美术保持拾取完整、树干在湖外，且没有改写布局输入',()=>{
  assert.equal(JSON.stringify(data),JSON.stringify(JSON.parse(read('public/map/campus-data.json'))));
  const lib=model.targets.find(t=>t.type==='library');assert.ok(lib&&lib.description.includes('艺术化设计示意'));
  assert.ok(model.pickables.some(mesh=>mesh.name==='box:libraryGlass'&&mesh.userData.keys.includes(lib.key)));
  const tree=model.root.children.find(mesh=>mesh.name==='treeSoft:canopy');assert.ok(tree&&tree.count>0);
  const trunks=model.root.children.find(mesh=>mesh.name==='trunk:trunk'),matrix=new T.Matrix4(),point=new T.Vector3();
  for(let i=0;i<trunks.count;i++){trunks.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert.equal(insidePolygon(point.x/data.transform.k+data.transform.ox,point.z/data.transform.k+data.transform.oz,data.lake),false);}
  assert.ok(model.shadowContacts.length>100);assert.ok(model.root.children.some(mesh=>mesh.name==='static-sun-shadow'));
});
test('精细场景预算：对象不超过40批，实例不超过2900，三角形不超过125万',()=>{
  let triangles=0;model.root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
  assert.ok(model.root.children.length<=40);assert.ok(model.metrics.instances<=2900);assert.ok(triangles<=1250000);
});
test('外观迭代保留源导览图的每个锚点、旋转、比例与整条路网',()=>{
  const layout=JSON.parse(read('map-src/campus-layout.json'));
  assert.deepEqual(data.roads,layout.roads);assert.deepEqual(data.lake,layout.lake);assert.deepEqual(data.boundary,layout.boundary);
  for(const p of layout.places){const target=data.places.find(t=>t.id===p.id);for(const key of Object.keys(p))assert.deepEqual(target[key],p[key]);}
});
test('长立面和楼端使用不同UV，宿舍阳台共享实体轮廓而非逐窗对象',()=>{
  const facade=model.root.children.find(m=>m.name==='facade:brick'),dorm=model.root.children.find(m=>m.name==='dormFacade:sand');
  assert.ok(facade&&dorm);const uv=facade.geometry.attributes.uv;
  // First 36 nonindexed vertices retain distinct long/end-wall atlas coordinates.
  for(let i=0;i<12;i++)assert.ok(uv.getX(i)<=.7501);
  for(let i=24;i<36;i++)assert.ok(uv.getX(i)>=.7499);
  dorm.geometry.computeBoundingBox();assert.ok(dorm.geometry.boundingBox.max.x>.55&&dorm.geometry.boundingBox.min.x<-.55);
  assert.equal(dorm.count,26);assert.ok(dorm.geometry.attributes.position.count>3000&&dorm.geometry.attributes.position.count<24000);
});
test('全体建筑明确为艺术化设计，三个现代平顶生活片区仍可区分',()=>{
  const ref=JSON.parse(read('map-src/building-reference.json'));assert.equal(ref.mode,'artistic-campus');
  for(const p of data.places.filter(p=>['dorm','teaching','library','gym','canteen','shop'].includes(p.type))){assert.equal(p.architecture.mode,'artistic-campus');assert.ok(p.architecture.features.length>20);assert.ok(p.architecture.limit.includes('不代表真实立面'));assert.deepEqual(p.architecture.scenes,[]);}
  const dorms=data.places.filter(p=>p.type==='dorm');assert.equal(new Set(dorms.map(p=>p.architecture.family)).size,3);
  assert.ok(dorms.every(p=>p.architecture.roof==='flat'));
  assert.ok(!model.root.children.some(m=>m.name==='gable:roof'||m.name==='roof:roof'));
  const pergolas=model.pickables.find(m=>m.name==='pergola:timber');
  for(const p of dorms)assert.ok(pergolas.userData.keys.includes(p.key));

});
test('现代矩形柱廊有真实开口，所有门廊实例可拾取且处于地面入口高度',()=>{
  const arches=model.pickables.find(m=>m.name==='portal:white'),matrix=new T.Matrix4(),scale=new T.Vector3(),position=new T.Vector3();assert.ok(arches&&arches.count>=50);
  const ray=new T.Raycaster(new T.Vector3(0,-.3,3),new T.Vector3(0,0,-1));const unit=new T.Mesh(arches.geometry,new T.MeshBasicMaterial());unit.updateMatrixWorld();assert.equal(ray.intersectObject(unit).length,0,'portal entrance must remain open');
  for(let i=0;i<arches.count;i++){arches.getMatrixAt(i,matrix);matrix.decompose(position,new T.Quaternion(),scale);assert.ok(Math.abs(position.y-scale.y/2-.6*(data.places.find(p=>p.key===arches.userData.keys[i]).massScale||1))<.001);}
});
test('建筑近景独立于此前环绕角度，玻璃入口侧和屋面均可稳定查看',()=>{
  const input={x:240,z:-180,distance:900,azimuth:17,elevation:.3},before=JSON.stringify(input),p=model.targets.find(p=>p.id==='complex-2');
  const close=detailView(p,input),roof=detailView(p,input,{roof:true});
  assert.equal(close.x,p.x);assert.equal(close.z,p.z);assert.equal(close.azimuth,p.rotation+.4);assert.ok(close.distance<900);
  assert.equal(roof.azimuth,close.azimuth);assert.equal(roof.distance,close.distance);assert.ok(roof.elevation>close.elevation&&roof.elevation<=1.45);
  assert.equal(JSON.stringify(input),before);assert.equal(detailView(model.targets.find(p=>p.id==='lib'),input).azimuth,Math.PI/2+.22);
});
test('新取景朝向入口侧，所有楼近景与屋面视图都保持可用',()=>{
  for(const p of model.targets){const a=detailView(p,{}),b=detailView(p,{},{roof:true});assert.ok(Object.values(a).every(Number.isFinite));assert.ok(a.distance>=95);assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.equal(a.azimuth,b.azimuth);}
  for(const id of ['teach-1','lab-1','complex-1','tuoxin'])assert.ok(detailView(model.targets.find(p=>p.id===id),{}).azimuth<Math.PI/2);
  for(const id of ['canteen','gym','cscenter'])assert.ok(detailView(model.targets.find(p=>p.id===id),{}).azimuth>Math.PI);
  assert.ok(model.metrics.footpaths>=15&&model.metrics.footpaths<=27);
});
test('各功能建筑具有独立实体方案，不再全部套用三翼坡顶楼',()=>{
  const solid=model.pickables.find(m=>m.name==='facade:libraryStone'),glass=model.pickables.find(m=>m.name==='box:libraryGlass');
  for(const id of ['cscenter','lab-1','lab-2','complex-1','complex-2','canteen'])assert.ok(glass.userData.keys.includes(id));
  for(const id of ['cscenter','lab-1','lab-2','canteen'])assert.ok(solid.userData.keys.includes(id));
  const library=model.targets.find(p=>p.id==='lib'),north=model.targets.find(p=>p.id==='lib-north');assert.ok(library.height>north.height*2);assert.ok(library.width>north.width);
});
test('共享材质的所有实例批次均提供颜色属性，避免未着色柱廊变黑',()=>{
  for(const o of model.root.children.filter(o=>o.isInstancedMesh)){assert.ok(o.instanceColor,o.name);for(const c of o.instanceColor.array)assert.ok(Number.isFinite(c)&&c>0);}
  const arches=model.root.children.find(o=>o.name==='portal:white');for(const c of arches.instanceColor.array)assert.equal(c,1);
});
test('阳光投影按光源反向延展，旋转楼翼的投影有限且不会改写楼体',()=>{
  const caster={x:0,z:0,y:10,h:20,w:8,d:30,rotation:Math.PI/4},before=JSON.stringify(caster);
  const east=shadowHull(caster,0),west=shadowHull(caster,Math.PI);
  assert.ok(Math.min(...east.map(p=>p[0]))<Math.min(...west.map(p=>p[0])));
  assert.ok(Math.max(...west.map(p=>p[0]))>Math.max(...east.map(p=>p[0])));
  assert.ok(east.length>=4&&east.every(p=>p.every(Number.isFinite)));assert.equal(JSON.stringify(caster),before);
});
test('静态阴影仅显式调用时烘焙，阴影层不可拾取、不写深度、贴图尺寸固定',()=>{
  assert.equal(shadow.bakes,0);shadow.bake(220*Math.PI/180);assert.equal(shadow.bakes,1);
  assert.equal(shadowCalls.filter(c=>c==='clear').length,1);assert.ok(shadowCalls.filter(c=>c==='fill').length>150);
  assert.equal(shadow.layer.material.depthWrite,false);assert.equal(shadow.layer.material.transparent,true);
  assert.equal(shadow.texture.image.width,1024);assert.equal(shadow.texture.image.height,1024);
  assert.ok(!model.pickables.includes(shadow.layer));
  assert.ok(Object.values(QUALITY).every(q=>q.shadows===false&&q.shadowSize===0));
  assert.ok(LIGHTING.daylight&&LIGHTING.golden);assert.ok(!read('map-src/web/campus-app.js').includes('shadowMap.needsUpdate=true'));
});
test('所有顶点、实例变换与地点尺寸均有限，不产生NaN或负尺寸',()=>{
  model.root.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));if(o.isInstancedMesh)for(const n of o.instanceMatrix.array)assert.ok(Number.isFinite(n));});
  for(const p of model.targets)for(const key of ['width','depth','height'])assert.ok(Number.isFinite(p[key])&&p[key]>0);
});
test('湖形包围盒保持原坐标方向，没有ShapeGeometry镜像',()=>{
  const water=model.pickables.find(o=>o.userData.key==='lake');water.geometry.computeBoundingBox();const b=water.geometry.boundingBox;
  const x=data.lake.map(p=>(p[0]-data.transform.ox)*data.transform.k),z=data.lake.map(p=>(p[1]-data.transform.oz)*data.transform.k);
  assert.ok(Math.abs(b.min.x-Math.min(...x))<.001);assert.ok(Math.abs(b.max.z-Math.max(...z))<.001);
});
test('所有可点选实例都指向有效地点，湖面单独可选',()=>{
  const keys=new Set(model.targets.map(p=>p.key));for(const mesh of model.pickables){if(mesh.userData.key)assert.ok(keys.has(mesh.userData.key));for(const key of mesh.userData.keys||[])if(key)assert.ok(keys.has(key));}
  assert.ok(model.pickables.some(p=>p.userData.key==='lake'));
});
test('屋顶网球场与体育馆重合落位，实体场面高于体育馆屋顶',()=>{
  const gym=model.targets.find(p=>p.id==='gym'),tennis=model.targets.find(p=>p.id==='tennis-roof');
  assert.equal(tennis.x,gym.x);assert.equal(tennis.z,gym.z);assert.equal(tennis.elevated,true);
  const courts=model.pickables.find(p=>p.name==='box:court'),index=courts.userData.keys.indexOf(tennis.key),matrix=new T.Matrix4();assert.ok(index>=0);courts.getMatrixAt(index,matrix);assert.ok(matrix.elements[13]>14);
});
test('图上明确的南北东西关系与两处图书馆都已保留',()=>{
  const p=id=>data.places.find(p=>p.id===id),lakeX=data.lake.reduce((n,p)=>n+p[0]/data.lake.length,0);
  assert.ok(p('gym').px<data.track.px);assert.ok(p('canteen').py>data.track.py);
  assert.ok(p('lib').px<lakeX&&p('lib-north').py<p('lib').py);
  assert.equal(data.places.filter(p=>p.type==='dorm').length,11);
  assert.equal(data.places.filter(p=>p.id.startsWith('teach-')).length,4);
  assert.equal(data.places.filter(p=>p.type==='shop').length,1);
  assert.ok(p('pav-bp').px>Math.max(...data.lake.map(p=>p[0])));
  assert.ok(p('pav-yr').py<p('plaza-east').py&&p('pav-wy').py>p('plaza-east').py);
  assert.ok(p('teach-1').py<p('teach-4').py&&p('teach-2').py<p('teach-3').py);
});
test('车行路网整体连通，除东门出口外没有悬空端点',()=>{
  const touches=(point,road)=>road.pts.slice(1).some((b,i)=>segmentDistance(...point,road.pts[i],b)<.001);
  for(const road of data.roads){
    if(JSON.stringify(road.pts[0])===JSON.stringify(road.pts.at(-1)))continue;
    for(const i of [0,road.pts.length-1]){
      if(road.id==='gate'&&i===road.pts.length-1)continue;
      assert.ok(data.roads.some(other=>other!==road&&touches(road.pts[i],other)),road.id+' has a disconnected endpoint');
    }
  }
  const reached=new Set([data.roads[0]]);let changed=true;
  while(changed){changed=false;for(const road of data.roads)if(!reached.has(road)&&[...reached].some(other=>road.pts.some(p=>touches(p,other))||other.pts.some(p=>touches(p,road)))){reached.add(road);changed=true;}}
  assert.equal(reached.size,data.roads.length);
});
test('每个建筑与运动地点都具有可点选实体，绿化兼有行道树与园林种植',()=>{
  const keys=new Set(model.pickables.flatMap(p=>p.userData.keys||[]));
  for(const p of data.places)assert.ok(keys.has(p.key),p.key);
  assert.ok(model.metrics.rowTrees>=50);assert.ok(model.metrics.treeCount-model.metrics.rowTrees>=20);
});
test('车道路面两侧均不穿过建筑主体，而不只检查中心线',()=>{
  for(const mesh of model.pickables.filter(m=>['brick','sand','white','libraryStone','libraryGlass'].includes(m.name.split(':')[1])))for(let i=0;i<mesh.count;i++){
    const key=mesh.userData.keys[i];if(!key)continue;
    const inverse=new T.Matrix4();mesh.getMatrixAt(i,inverse);inverse.invert();
    for(const road of data.roads)for(let j=1;j<road.pts.length;j++){
      const a=road.pts[j-1],b=road.pts[j],dx=(b[0]-a[0])*data.transform.k,dz=(b[1]-a[1])*data.transform.k,length=Math.hypot(dx,dz),steps=Math.ceil(length/1.5);
      for(let n=0;n<=steps;n++)for(const offset of [-road.w/2+.25,0,road.w/2-.25]){
        const point=new T.Vector3((a[0]-data.transform.ox)*data.transform.k+dx*n/steps+dz/length*offset,2,(a[1]-data.transform.oz)*data.transform.k+dz*n/steps-dx/length*offset).applyMatrix4(inverse);
        assert.ok(Math.abs(point.x)>=.5||Math.abs(point.y)>=.5||Math.abs(point.z)>=.5,`${key} intersects ${road.id} surface`);
      }
    }
  }
});
test('手机、低内存与减少动态效果默认省电，最高像素比有上限',()=>{
  assert.equal(initialQuality({coarse:true}),'low');assert.equal(initialQuality({memory:2}),'low');assert.equal(initialQuality({reduced:true}),'low');assert.equal(initialQuality({}),'high');assert.equal(initialQuality({memory:6}),'balanced');
  assert.ok(Object.values(QUALITY).every(q=>q.dpr<=2&&q.moveDpr<=1.2&&q.shadowSize===0));assert.equal(QUALITY.low.shadows,false);
});
test('静止增强与交互分辨率分别受总像素和最长边限制，4K/8K不会无限扩大画布',()=>{
  for(const quality of Object.keys(QUALITY))for(const [width,height]of [[609,727],[1002,636],[1920,1080],[3840,2160],[7680,4320],[16000,1000]])for(const moving of [false,true]){
    const plan=renderPlan({width,height,quality,moving}),q=QUALITY[quality];
    assert.ok(plan.pixelWidth*plan.pixelHeight<=(moving?q.movingPixels:q.pixels));
    assert.ok(plan.pixelWidth<=4096&&plan.pixelHeight<=4096);assert.ok(plan.dpr<=(moving?q.moveDpr:q.dpr));
    assert.ok(Number.isInteger(plan.pixelWidth)&&plan.pixelWidth>=1&&Number.isInteger(plan.pixelHeight)&&plan.pixelHeight>=1);
  }
});
test('标准档静止分辨率高于旧1.25倍，交互像素量更低；非法尺寸和受限GPU仍安全',()=>{
  const still=renderPlan({width:1002,height:636}),moving=renderPlan({width:1002,height:636,moving:true});
  assert.ok(still.dpr>1.25);assert.ok(moving.pixelWidth*moving.pixelHeight<1002*636*1.25**2);
  for(const input of [{width:0,height:NaN},{width:Infinity,height:-1},{width:7680,height:4320,maxSide:2048},{width:32768,height:32768,maxSide:1}]){
    const p=renderPlan(input);assert.ok(Number.isFinite(p.dpr)&&p.dpr>0);assert.ok(p.pixelWidth<=Math.max(1,input.maxSide||4096)&&p.pixelHeight<=Math.max(1,input.maxSide||4096));
  }
});
test('近远裁剪面随取景距离分配深度精度，选中建筑不被近裁剪切掉',()=>{
  for(const p of model.targets){const view=detailView(p,{azimuth:0}),clips=clipPlanes(view.distance);assert.ok(clips.near<view.distance-Math.hypot(p.width,p.depth,p.height)/2);assert.ok(clips.far>=view.distance+750);}
  for(const distance of [95,650,1550,NaN,Infinity]){const clips=clipPlanes(distance);assert.ok(clips.near>0&&clips.far>clips.near);assert.ok(clips.far/clips.near<130);}
});
test('手机竖屏、横屏及窄触屏均不启用3D，桌面正常启用',()=>{
  assert.equal(shouldUse3D({width:390,coarse:true}),false);assert.equal(shouldUse3D({width:844,coarse:true}),false);assert.equal(shouldUse3D({width:760}),false);assert.equal(shouldUse3D({width:1280}),true);
});
test('页面先加载轻量分流入口，3D引擎仅由桌面分支动态导入',()=>{
  const html=read('map-src/web/index.html'),boot=read('map-src/web/campus-boot.js');
  assert.ok(html.includes('src="./campus-boot.js"'));assert.ok(!html.includes('src="./campus-app.js"'));assert.ok(!/import\s+['"].*three/.test(boot));assert.ok(boot.includes("await import('./campus-app.js')"));assert.ok(boot.indexOf('if(!desktop)')<boot.indexOf("await import('./campus-app.js')"));
});
test('相机缩放、俯仰与平移均有边界；竖屏扩大取景距离',()=>{
  const v=constrainView({distance:-10,elevation:20,x:10000,z:-10000});assert.equal(v.distance,95);assert.ok(v.elevation<Math.PI/2);assert.equal(v.x,260);assert.equal(v.z,-260);assert.ok(fitDistance(.5)>fitDistance(1.5));
  for(const aspect of [.85,1,1.5,2]){
    const distance=fitDistance(aspect),camera=new T.PerspectiveCamera(45,aspect,5,2400);camera.position.set(0,Math.sin(1.08)*distance,Math.cos(1.08)*distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const positions=model.ground.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){const p=new T.Vector3().fromBufferAttribute(positions,i).project(camera);assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=1,'overview clips campus boundary');}
  }
});
test('绿化生成可复现、有数量上限且不落到湖面',()=>{
  assert.ok(model.metrics.treeCount>100&&model.metrics.treeCount<=210);
  const tree=model.root.children.find(m=>m.name==='tree:foliage'),matrix=new T.Matrix4(),pos=new T.Vector3();
  for(let i=0;i<tree.count;i++){tree.getMatrixAt(i,matrix);pos.setFromMatrixPosition(matrix);assert.equal(insidePolygon(pos.x/data.transform.k+data.transform.ox,pos.z/data.transform.k+data.transform.oz,data.lake),false);}
});
test('行道树与园林树避开整栋建筑及入口前场，树冠不穿雨棚',()=>{
  const trunks=model.root.children.find(o=>o.name==='trunk:trunk'),matrix=new T.Matrix4(),point=new T.Vector3();
  for(let i=0;i<trunks.count;i++){trunks.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);for(const p of model.targets.filter(p=>['dorm','teaching','library','gym','canteen','shop'].includes(p.type))){const dx=point.x-p.x,dz=point.z-p.z,c=Math.cos(p.rotation),s=Math.sin(p.rotation);assert.ok(Math.abs(dx*c-dz*s)>=p.width/2+3.99||Math.abs(dx*s+dz*c)>=p.depth/2+3.99,p.key);}}
});
test('生成文件与源码一致；引擎与模块同源部署，没有CDN',()=>{
  for(const name of ['campus-boot.js','campus-app.js','campus-model.js','campus-scene.js','campus-lighting.js','campus-water.js','campus-walk.js','campus-visibility.js','campus-performance.js','campus-detail.js','campus-atmosphere.js','campus-textures.js','campus.css'])assert.equal(read('map-src/web/'+name),read('public/map/'+name));
  assert.equal(read('map-src/web/index.html'),read('public/map/校园地图-3D实景.html'));assert.equal(read('map-src/three-packed.js'),read('public/map/three-r149.min.js'));
  const html=read('map-src/web/index.html');
  assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)=["']https?:\/\//i.test(html));
  assert.ok(!/https?:\/\//.test(read('map-src/web/campus-app.js')));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});
function triangleOverlap(a,b){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const direction=Math.sign(cross(...b));let out=a.map(p=>[...p]);
  for(let i=0;i<3;i++){
    const c=b[i],d=b[(i+1)%3],input=out;out=[];
    for(let j=0;j<input.length;j++){
      const p=input[j],q=input[(j+1)%input.length],cp=cross(c,d,p)*direction,cq=cross(c,d,q)*direction;
      if(cp>=-1e-9)out.push(p);
      if((cp>1e-9&&cq< -1e-9)||(cp< -1e-9&&cq>1e-9)){const t=cp/(cp-cq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }
  }
  return Math.abs(out.reduce((n,p,i)=>{const q=out[(i+1)%out.length];return n+p[0]*q[1]-p[1]*q[0];},0))/2;
}
test('桥面转角实际三角形无同高重叠，铺装高于静态阴影层',()=>{
  const g=model.siteBase.geometry,p=g.attributes.position,n=g.attributes.normal,triangles=[];
  for(const range of model.siteBase.userData.surfaceRanges.filter(r=>r.tag==='shore'))for(let i=range.start;i<range.start+range.count;i+=3){
    if(n.getY(i)<.99)continue;
    triangles.push([0,1,2].map(j=>[p.getX(i+j),p.getZ(i+j)]));assert.ok(p.getY(i)>.92);
  }
  assert.equal(triangles.length,data.lake.length*2);
  for(let i=0;i<triangles.length;i++)for(let j=i+1;j<triangles.length;j++)assert.ok(triangleOverlap(triangles[i],triangles[j])<1e-5,`shore triangles ${i}/${j} overlap`);
});
test('体育场实际场面、底座、护栏、看台与球门均避开完整路面及人行边带',()=>{
  const triangles=[],matrix=new T.Matrix4();
  const addGeometry=(geometry,start=0,count=geometry.attributes.position.count,transform=null)=>{
    for(let i=start;i<start+count;i+=3){const tri=[];for(let j=0;j<3;j++){const p=new T.Vector3().fromBufferAttribute(geometry.attributes.position,i+j);if(transform)p.applyMatrix4(transform);tri.push([p.x,p.z]);}triangles.push(tri);}
  };
  for(const range of model.siteBase.userData.surfaceRanges.filter(r=>r.tag==='stadium-podium'))addGeometry(model.siteBase.geometry,range.start,range.count);
  for(const mesh of model.pickables){
    const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
    if(mesh.userData.key==='track')addGeometry(source);
    if(mesh.isInstancedMesh)for(let i=0;i<mesh.count;i++)if(mesh.userData.keys[i]==='track'){mesh.getMatrixAt(i,matrix);addGeometry(source,0,source.attributes.position.count,matrix);}
    if(source!==mesh.geometry)source.dispose();
  }
  assert.ok(triangles.length>150);for(const triangle of triangles)assert.ok(polygonRoadClearance(triangle,data)>=3.59,'stadium triangle encroaches on road/pedestrian clearance');
});
test('体育场收边只调整示意外廓，中心及原始布局数据保持不变',()=>{
  const plan=model.stadium;assert.equal(plan.x,(data.track.px-data.transform.ox)*data.transform.k);assert.equal(plan.z,(data.track.py-data.transform.oz)*data.transform.k);
  assert.ok(plan.scale>.8&&plan.scale<=1);assert.ok(plan.clearance>=3.59);
  const track=model.pickables.find(m=>m.userData.key==='track');assert.ok(track&&!track.isInstancedMesh);
  assert.equal(JSON.stringify(data.track),JSON.stringify(JSON.parse(read('map-src/campus-layout.json')).track));
});

function waterHarness(){
  let now=0,id=0,allowed=true,frames=0;const jobs=new Map();
  const clock=createWaterClock({isAllowed:()=>allowed,schedule:(fn,delay)=>{const key=++id;jobs.set(key,{fn,at:now+delay});return key;},cancel:key=>jobs.delete(key),render:()=>{frames++;clock.sync();}});
  const advance=ms=>{const target=now+ms;for(;;){const due=[...jobs.entries()].filter(([,j])=>j.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;jobs.delete(due[0]);due[1].fn();}now=target;};
  return {clock,jobs,advance,setAllowed:v=>{allowed=v;},get frames(){return frames;}};
}
test('轻水纹空闲最多每秒4次；反复交互同步不会叠加定时器',()=>{
  const h=waterHarness();for(let i=0;i<100;i++)h.clock.sync();assert.equal(h.jobs.size,1);
  h.advance(WATER_INTERVAL_MS-1);assert.equal(h.frames,0);h.advance(1);assert.equal(h.frames,1);
  h.advance(750);assert.equal(h.frames,4);assert.equal(h.jobs.size,1);h.clock.dispose();assert.equal(h.jobs.size,0);
});
test('隐藏、离开镜头、低内存、省电与减少动态效果均禁止水纹',()=>{
  assert.equal(waterMotionAllowed(),true);
  for(const state of [{enabled:false},{hidden:true},{visible:false},{memory:4},{memory:2},{quality:'low'},{reduced:true},{disposed:true},{contextLost:true},{budgetPaused:true}])assert.equal(waterMotionAllowed(state),false,JSON.stringify(state));
});
test('暂停后无后台重绘，恢复后只保留一个水纹唤醒',()=>{
  const h=waterHarness();h.clock.sync();h.advance(1000);assert.equal(h.frames,4);
  h.setAllowed(false);h.clock.sync();h.advance(10000);assert.equal(h.frames,4);assert.equal(h.jobs.size,0);
  h.setAllowed(true);h.clock.sync();h.advance(1000);assert.equal(h.frames,8);assert.equal(h.jobs.size,1);h.clock.dispose();
});
test('取消或销毁后已进入队列的旧回调也不能重启水纹',()=>{
  const h=waterHarness();h.clock.sync();const stale=[...h.jobs.values()][0].fn;h.clock.stop();stale();assert.equal(h.frames,0);
  h.clock.sync();const zombie=[...h.jobs.values()][0].fn;h.clock.dispose();zombie();h.clock.sync();h.advance(5000);assert.equal(h.frames,0);assert.equal(h.jobs.size,0);
});
test('水纹复用湖面原几何与贴图，通过单个时间变量改变颜色',()=>{
  const water=model.water,material=water.material,shader={uniforms:{},fragmentShader:T.ShaderLib.phong.fragmentShader};
  const count=water.geometry.attributes.position.count,texture=material.map;
  material.onBeforeCompile(shader);assert.equal(shader.uniforms.campusWaterTime,material.userData.rippleTime);
  shader.uniforms.campusWaterTime.value=4;assert.equal(material.userData.rippleTime.value,4);
  assert.equal(water.geometry.attributes.position.count,count);assert.equal(material.map,texture);assert.ok(shader.fragmentShader.includes('float crest='));
  assert.ok(!/WebGLRenderTarget|new T.Water/.test(read('map-src/web/campus-water.js')));
});

test('细化树冠具有折弯枝叶片、透明裁切与顶点明暗，三种轮廓共享几何',()=>{
  const meshes=model.root.children.filter(m=>m.name.endsWith(':canopy'));assert.equal(meshes.length,3);
  assert.equal(meshes.reduce((n,m)=>n+m.count,0),132);
  for(const mesh of meshes){const g=mesh.geometry;assert.ok(g.userData.leafSprays>=190);assert.ok(g.attributes.color.count===g.attributes.position.count);assert.ok(mesh.material.vertexColors&&mesh.material.alphaTest>0&&!mesh.material.transparent);const colors=g.attributes.color.array;assert.ok(Math.max(...colors)-Math.min(...colors)>.3);}
  assert.ok(model.metrics.grassTufts>=500&&model.metrics.grassTufts<=650);
});

test('省电切换使用真实简化几何，恢复精细档不丢拾取或重复创建对象',()=>{
  const triangleCount=()=>model.root.children.filter(o=>o.isMesh&&o.visible).reduce((n,o)=>n+(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1),0);
  const full=triangleCount(),objects=[...model.root.children],pickables=[...model.pickables],geometries=objects.map(o=>o.geometry),materials=objects.map(o=>o.material);
  model.setDetail('low');const low=triangleCount();assert.ok(low<150000&&low<full*.15);assert.equal(model.root.children.find(m=>m.name==='grass:grass').visible,false);assert.equal(model.metrics.detail,'economy');
  model.setDetail('high');assert.equal(triangleCount(),full);assert.ok(model.root.children.length===objects.length&&model.root.children.every((o,i)=>o===objects[i]));assert.ok(model.pickables.length===pickables.length&&model.pickables.every((o,i)=>o===pickables[i]));for(let i=0;i<objects.length;i++){assert.ok(objects[i].geometry===geometries[i],objects[i].name);assert.ok(objects[i].material===materials[i],objects[i].name);}assert.equal(model.metrics.detail,'full');
});

test('草地使用哑光漫反射与近景细节，关闭细节只更新共享开关',()=>{
  const detail=new T.Texture(),material=createGrassMaterial(T,null,detail),shader={uniforms:{},vertexShader:T.ShaderLib.lambert.vertexShader,fragmentShader:T.ShaderLib.lambert.fragmentShader};
  assert.equal(model.materials.ground.isMeshLambertMaterial,true);assert.ok(!model.materials.ground.bumpMap);
  material.onBeforeCompile(shader);assert.equal(shader.uniforms.campusGrassDetail.value,detail);assert.equal(shader.uniforms.campusGrassStrength,material.userData.detailStrength);assert.equal(shader.uniforms.campusGrassStrength.value,1);
  assert.ok(shader.vertexShader.includes('vCampusGrassDepth = -mvPosition.z'));assert.ok(shader.fragmentShader.includes('smoothstep(100.0, 300.0'));assert.ok(shader.fragmentShader.includes('vUv * 72.0'));assert.ok(!shader.fragmentShader.includes('dFdx('));
  material.userData.detailStrength.value=0;assert.equal(shader.uniforms.campusGrassStrength.value,0);material.dispose();detail.dispose();
});

test('静态天空不创建网格，转动与重复设置不重画，太阳在不同画幅中保持圆形和可见',()=>{
  const context={createLinearGradient(){return {addColorStop(){}};},createRadialGradient(){return {addColorStop(){}};},fillRect(){},save(){},restore(){},translate(){},scale(){},beginPath(){},arc(){},fill(){}};
  const scene=new T.Scene(),previousBackground=new T.Color(0xffffff),previousFog=new T.FogExp2(0xffffff,.001);scene.background=previousBackground;scene.fog=previousFog;
  const sky=createAtmosphere(T,scene,{width:1024,height:1024,getContext(){return context;}}),camera=new T.PerspectiveCamera(45,1,20,1500);
  assert.equal(scene.background,sky.texture);assert.equal(scene.children.length,0);assert.equal(sky.revision,0);sky.setLighting('daylight');assert.equal(sky.revision,1);
  for(let i=0;i<20;i++){camera.position.set(i*5,80,100);sky.update(camera);}assert.equal(sky.revision,1);
  const position=new T.Vector3(100,200,-100);sky.setSun(position);sky.setSun(position);assert.equal(sky.revision,2);sky.setLighting('golden');sky.setLighting('golden');assert.equal(sky.revision,3);
  for(const aspect of [.65,1,2.6]){camera.aspect=aspect;sky.update(camera);const s=sky.layout.sun;assert.ok(Math.abs(s.radiusX*aspect-s.radiusY)<1e-6);assert.ok(s.x>s.radiusX&&s.x<1024-s.radiusX&&s.y>s.radiusY&&s.y<1024*.3);}
  let disposed=0;sky.texture.addEventListener('dispose',()=>disposed++);sky.dispose();assert.equal(disposed,1);assert.equal(scene.children.length,0);assert.equal(scene.background,previousBackground);assert.equal(scene.fog,previousFog);
});

test('销毁场景确实释放共享几何与材质，包括未显示的省电版本',()=>{
  let geometryDisposed=0,materialDisposed=0;const gs=new Set(),ms=new Set();model.root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material]))ms.add(m);});
  model.setDetail('low');model.root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))ms.add(m);});model.setDetail('high');
  let shadowTextureDisposed=0;shadow.texture.addEventListener('dispose',()=>shadowTextureDisposed++);
  gs.forEach(g=>g.addEventListener('dispose',()=>geometryDisposed++));ms.forEach(m=>m.addEventListener('dispose',()=>materialDisposed++));shadow.dispose();model.dispose();assert.equal(geometryDisposed,gs.size);assert.equal(materialDisposed,ms.size);assert.equal(shadowTextureDisposed,1);
});
console.log(`精细3D校园：${passed} 项通过`);
