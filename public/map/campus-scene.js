import { insidePolygon, segmentDistance, closedRibbon, stadiumPlan } from './campus-model.js';
import {createWaterMaterial} from './campus-water.js';
import {createVegetationGeometries,reliefFacade,createGrassMaterial} from './campus-detail.js';
import {createInstanceVisibility} from './campus-visibility.js';

export const TYPE_LABELS={ teaching:'教学与实验', dorm:'学生公寓', library:'图书馆', gym:'体育馆', canteen:'校园食堂', shop:'生活街区', pavilion:'校园廊亭', court:'球类运动', lake:'晴缘湖', track:'田径场',plaza:'校园广场' };

export function buildCampusScene(T,data,textures={}) {
  const root=new T.Group(); root.name='detailed-campus';
  const batches=new Map(), entries=[], targets=[], planted=[], plantingExclusions=[],shadowContacts=[],walkSurfaces=[];
  const geometries={box:new T.BoxGeometry(1,1,1),...createVegetationGeometries(T),panel:new T.PlaneGeometry(1,1),contact:new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),junction:new T.CircleGeometry(.5,20).rotateX(-Math.PI/2)};
  // One atlas: long facades occupy the left 3/4, quiet end walls the right 1/4.
  // Every wing has its long axis along local Z, regardless of its world rotation.
  geometries.facade=geometries.box.clone();
  const facadeUV=geometries.facade.attributes.uv;
  for(let face=0;face<6;face++)for(let i=0;i<4;i++){
    const index=face*4+i,u=facadeUV.getX(index);
    facadeUV.setX(index,face<2?u*.75:.75+u*.25);
  }
  // Balcony ledges are baked into one shared unit geometry (no per-room objects).
  // Two quads per ledge give a real silhouette and a shallow shadow at close range.
  const dormBase=geometries.facade.toNonIndexed(),dp=Array.from(dormBase.attributes.position.array),du=Array.from(dormBase.attributes.uv.array);
  for(let floor=0;floor<6;floor++)for(const side of [-1,1]){
    const y=-.5+(floor+.24)/6,inner=side*.5,outer=side*.565,low=y-.014;
    const quads=side>0?[
      [[inner,y,-.49],[inner,y,.49],[outer,y,.49],[outer,y,-.49]],
      [[outer,low,-.49],[outer,y,-.49],[outer,y,.49],[outer,low,.49]],
    ]:[
      [[inner,y,.49],[inner,y,-.49],[outer,y,-.49],[outer,y,.49]],
      [[outer,low,.49],[outer,y,.49],[outer,y,-.49],[outer,low,-.49]],
    ];
    for(const q of quads)for(const i of [0,1,2,0,2,3]){dp.push(...q[i]);du.push(.02,1-((floor*512/6+50)/512));}
  }
  geometries.dormFacade=new T.BufferGeometry();geometries.dormFacade.setAttribute('position',new T.Float32BufferAttribute(dp,3));geometries.dormFacade.setAttribute('uv',new T.Float32BufferAttribute(du,2));geometries.dormFacade.computeVertexNormals();dormBase.dispose();
  // Windows now have projecting sills, inset-looking surrounds and balcony rails.
  const baseFacade=geometries.facade,baseDorm=geometries.dormFacade;
  geometries.facadeLow=baseFacade.toNonIndexed();geometries.dormFacadeLow=baseDorm.clone();
  geometries.stoneFacade=reliefFacade(T,baseFacade,{stone:true});
  geometries.facade=reliefFacade(T,baseFacade);
  geometries.dormFacade=reliefFacade(T,baseDorm,{dorm:true});baseFacade.dispose();baseDorm.dispose();
  function joinedBoxes(parts){
    const positions=[],uvs=[];
    for(const [x,y,z,w,h,d]of parts){
      const g=geometries.box.toNonIndexed();g.scale(w,h,d);g.translate(x,y,z);
      // Roof details are viewed from above; their hidden undersides add no silhouette.
      for(let i=0;i<36;i++){if(i>=18&&i<24)continue;positions.push(g.attributes.position.getX(i),g.attributes.position.getY(i),g.attributes.position.getZ(i));uvs.push(g.attributes.uv.getX(i),g.attributes.uv.getY(i));}g.dispose();
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
  }
  // Shared terrace deck + parapets, and shared seven-fin screens: detail without
  // multiplying scene objects or per-window draw calls.
  geometries.terrace=joinedBoxes([[0,-.5,0,1,.25,1],[0,.07,-.491,1,.65,.018],[0,.07,.491,1,.65,.018],[-.491,.07,0,.018,.65,1],[.491,.07,0,.018,.65,1]]);
  geometries.screen=joinedBoxes(Array.from({length:7},(_,i)=>[(i-3)/6,0,0,.014,1,1]));
  geometries.pergola=joinedBoxes([...Array.from({length:5},(_,i)=>[(i-2)/5,.47,0,.035,.06,1]),...[-1,1].flatMap(a=>[-1,1].map(b=>[a*.43,0,b*.43,.025,1,.025]))]);
  geometries.roofKit=joinedBoxes([[0,-.3,0,1,.16,1],[-.23,0,0,.38,.45,.8],[.24,-.04,.03,.35,.38,.67],[-.23,.26,0,.42,.08,.86],...Array.from({length:9},(_,i)=>[.24,.18,(i-4)*.069,.37,.035,.025]),[.24,.08,-.38,.08,.35,.08]]);
  // Glazing mullions are part of the same glass instance, not extra window meshes.
  const glazingParts=[[0,0,0,1,1,1]];
  for(const side of [-1,1]){
    for(let i=0;i<=8;i++){glazingParts.push([-.5+i/8,0,side*.506,.005,1,.014]);glazingParts.push([side*.506,0,-.5+i/8,.014,1,.005]);}
    for(let i=0;i<=6;i++){glazingParts.push([0,-.5+i/6,side*.506,1,.006,.014]);glazingParts.push([side*.506,-.5+i/6,0,.014,.006,1]);}
  }
  geometries.glazing=joinedBoxes(glazingParts);
  // Sample the narrow neutral mullion in the atlas on the added frame vertices.
  const glazingUV=geometries.glazing.attributes.uv;for(let i=30;i<glazingUV.count;i++)glazingUV.setXY(i,.001,.99);
  const portalShape=new T.Shape();
  portalShape.moveTo(-.5,0);portalShape.lineTo(-.5,1);portalShape.lineTo(.5,1);portalShape.lineTo(.5,0);
  portalShape.lineTo(.435,0);portalShape.lineTo(.435,.9);portalShape.lineTo(-.435,.9);portalShape.lineTo(-.435,0);portalShape.closePath();
  geometries.portal=new T.ExtrudeGeometry(portalShape,{depth:1,bevelEnabled:false});geometries.portal.translate(0,-.5,-.5);
  geometries.roofBox=geometries.box.clone();const roofBoxUV=geometries.roofBox.attributes.uv;for(let i=0;i<roofBoxUV.count;i++)roofBoxUV.setX(i,roofBoxUV.getX(i)*.85);
  const materials={
    brick:new T.MeshLambertMaterial({color:0xffffff,map:textures.teaching || null}),
    sand:new T.MeshLambertMaterial({color:0xffffff,map:textures.dorm || null}),
    white:new T.MeshLambertMaterial({color:0xf2f2eb}),
    roof:new T.MeshLambertMaterial({color:0xffffff,map:textures.roofMetal||null}),
    accent:new T.MeshLambertMaterial({color:0xa4b5a8}),
    glass:new T.MeshLambertMaterial({color:0x777d6b}),
    foliage:new T.MeshLambertMaterial({color:0xffffff,vertexColors:true}),
    trunk:new T.MeshLambertMaterial({color:0x86765f,vertexColors:true}),
    road:new T.MeshLambertMaterial({color:0xffffff,map:textures.road||null}),
    asphalt:new T.MeshLambertMaterial({color:0x646969}),
    sidewalk:new T.MeshLambertMaterial({color:0xd8dcd4,map:textures.paving||null}),
    curb:new T.MeshLambertMaterial({color:0xf1f2ed}),
    ground:createGrassMaterial(T,textures.ground||null,textures.grassDetail||null),
    base:new T.MeshLambertMaterial({color:0x9aab8f}),
    water:createWaterMaterial(T,textures.water||null),
    libraryStone:new T.MeshLambertMaterial({color:0xffffff,map:textures.libraryStone||null}),
    libraryGlass:new T.MeshPhongMaterial({color:0xffffff,map:textures.libraryGlass||null,shininess:16,specular:0x81795f}),
    paving:new T.MeshLambertMaterial({color:0xffffff,map:textures.paving||null}),
    timber:new T.MeshLambertMaterial({color:0xcfb18a,map:textures.timber||null}),
    canopy:new T.MeshLambertMaterial({color:0xffffff,map:textures.foliage||null,alphaTest:.28,alphaToCoverage:true,vertexColors:true,side:T.DoubleSide}),
    canopyLow:new T.MeshLambertMaterial({color:0xffffff,vertexColors:true}),
    grass:new T.MeshLambertMaterial({color:0xffffff,vertexColors:true,side:T.DoubleSide}),
    mechanical:new T.MeshLambertMaterial({color:0xa7ada4}),
    blossom:new T.MeshLambertMaterial({color:0xb57c78}),
    softShadow:new T.MeshBasicMaterial({map:textures.contact||null,color:0x405447,transparent:true,opacity:.29,depthWrite:false}),
    sign:new T.MeshBasicMaterial({map:textures.librarySign||null,color:0xffffff}),
    track:new T.MeshLambertMaterial({color:0xffffff,map:textures.track || null}),
    court:new T.MeshLambertMaterial({color:0xffffff,map:textures.court || null}),
    basketball:new T.MeshLambertMaterial({color:0xffffff,map:textures.basketball||null}),
    badminton:new T.MeshLambertMaterial({color:0xffffff,map:textures.badminton||null}),
  };
  const dummy=new T.Object3D();
  let frame=null;
  const coord=(px,py)=>[(px-data.transform.ox)*data.transform.k,(py-data.transform.oz)*data.transform.k];
  function add(kind,material,x,y,z,w,h,d,rotation=0,key=null,color=null) {
    if(frame){const dx=(x-frame.x)*frame.scale,dz=(z-frame.z)*frame.scale,c=Math.cos(frame.rotation),s=Math.sin(frame.rotation);x=frame.x+dx*c+dz*s;z=frame.z+dz*c-dx*s;y*=frame.scale;w*=frame.scale;h*=frame.scale;d*=frame.scale;rotation+=frame.rotation;}
    if(kind==='contact'){shadowContacts.push({x,z,w,d,rotation});return;}
    if(kind==='box'&&material==='roof')kind='roofBox';
    if(kind==='box'&&material==='foliage'){kind='tree';w*=.55;h*=.65;d*=.55;}
    const id=kind+':'+material;
    if(!batches.has(id))batches.set(id,[]);
    const object={x,y,z,w,h,d,rotation,key,color};batches.get(id).push(object);
    if(['box','roofBox'].includes(kind)&&w>=2&&d>=2&&h<=1.2&&y>2&&['roof','curb','paving','white','glass','timber'].includes(material))walkSurfaces.push({...object,key:key||frame?.key,top:y+h/2});
    if(key) entries.push({...object,kind,material});
  }
  function flatShape(points,y,material,scale=1) {
    const sx=points.reduce((n,p)=>n+p[0],0)/points.length,sy=points.reduce((n,p)=>n+p[1],0)/points.length;
    const shape=new T.Shape();
    points.forEach((p,i)=>{const [x,z]=coord(sx+(p[0]-sx)*scale,sy+(p[1]-sy)*scale);i?shape.lineTo(x,-z):shape.moveTo(x,-z);});shape.closePath();
    const geo=new T.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);
    const mesh=new T.Mesh(geo,materials[material]);mesh.position.y=y;mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  const center=data.boundary.reduce((a,p)=>[a[0]+p[0]/data.boundary.length,a[1]+p[1]/data.boundary.length],[0,0]);
  const displayBoundary=data.boundary.map(p=>[center[0]+(p[0]-center[0])*1.05,center[1]+(p[1]-center[1])*1.05]);
  const ground=flatShape(displayBoundary,.04,'ground');
  ground.geometry.computeBoundingBox();const gb=ground.geometry.boundingBox,gp=ground.geometry.attributes.position,gu=ground.geometry.attributes.uv;
  for(let i=0;i<gp.count;i++)gu.setXY(i,(gp.getX(i)-gb.min.x)/(gb.max.x-gb.min.x),1-(gp.getZ(i)-gb.min.z)/(gb.max.z-gb.min.z));gu.needsUpdate=true;
  const baseGeo=new T.ExtrudeGeometry(new T.Shape(displayBoundary.map(p=>{const[x,z]=coord(...p);return new T.Vector2(x,-z);})),{depth:7,bevelEnabled:false});
  baseGeo.rotateX(-Math.PI/2);baseGeo.translate(0,-7,0);const siteBase=new T.Mesh(baseGeo,materials.base);root.add(siteBase);
  const siteSurfaces=[{geometry:baseGeo,material:materials.base,tag:'base'}];
  data.roads.forEach(road=>road.pts.slice(1).forEach((b,i)=>{const a=road.pts[i], [ax,az]=coord(...a),[bx,bz]=coord(...b),length=Math.hypot(bx-ax,bz-az),angle=Math.atan2(bx-ax,bz-az);add('box','sidewalk',(ax+bx)/2,.14,(az+bz)/2,road.w+5,.22,length+2,angle);add('box','road',(ax+bx)/2,.29,(az+bz)/2,road.w,.15,length+1,angle);}));
  const junctions=new Map();for(const road of data.roads)for(const p of road.pts){const key=p.join(',');junctions.set(key,{p,w:Math.max(road.w,junctions.get(key)?.w||0)});}
  for(const {p,w}of junctions.values()){const[x,z]=coord(...p);add('junction','sidewalk',x,.255,z,w+5,1,w+5);add('junction','asphalt',x,.375,z,w,1,w);}
  flatShape(data.lake,.48,'curb',1.055);
  const water=flatShape(data.lake,.55,'water');
  water.geometry.computeBoundingBox();
  const wb=water.geometry.boundingBox,wp=water.geometry.attributes.position,wu=water.geometry.attributes.uv;
  for(let i=0;i<wp.count;i++)wu.setXY(i,(wp.getX(i)-wb.min.x)/(wb.max.x-wb.min.x),(wp.getZ(i)-wb.min.z)/(wb.max.z-wb.min.z));
  wu.needsUpdate=true;
  const lakeCenter=data.lake.reduce((a,p)=>[a[0]+p[0]/data.lake.length,a[1]+p[1]/data.lake.length],[0,0]),[lakeX,lakeZ]=coord(...lakeCenter);
  targets.push({key:'lake',id:'lake',type:'lake',name:'晴缘湖',x:lakeX,z:lakeZ,height:1,width:wb.max.x-wb.min.x,depth:wb.max.z-wb.min.z,description:'依用户导览图标定：位于校园中部、湖畔图书馆东侧。湖岸为人工描绘，非测绘轮廓。'});
  // Flat, recessed roofs and a thin pale fascia replace the old pitched silhouette.
  // Every part stays in the established local building frame and instanced batches.
  function wing(p,ox,oz,w,d,h,material,color=null) {
    const c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    const [px,pz]=coord(p.px,p.py),x=px+ox*c+oz*s,z=pz+oz*c-ox*s;
    const angle=p.rotation+(w>d?Math.PI/2:0);
    add(material==='sand'?'dormFacade':'facade',material,x,h/2+.6,z,Math.min(w,d),h,Math.max(w,d),angle,p.key,color);
    add('box','curb',x,h+.9,z,w+1,.3,d+1,p.rotation);
    add('box','roof',x,h+1.07,z,w-1.3,.12,d-1.3,p.rotation);
    if(w>8&&d>8){add('roofKit','mechanical',x,h+1.65,z,Math.min(w*.36,4.4),1.2,Math.min(d*.3,5.4),p.rotation);}
    add('contact','softShadow',x+1,.38,z+1,w+9,1,d+9,p.rotation);
  }
  function part(p,ox,y,oz,w,h,d,material,key=null,color=null){const [x,z]=coord(p.px,p.py),c=Math.cos(p.rotation),s=Math.sin(p.rotation);add('box',material,x+ox*c+oz*s,y,z+oz*c-ox*s,w,h,d,p.rotation,key,color);}
  function colonnade(p,ox,oz,count,span=5.5,h=4.8,y=.6){
    const [x,z]=coord(p.px,p.py),c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    for(let i=0;i<count;i++){const dx=ox+(i-(count-1)/2)*span;add('portal','white',x+dx*c+oz*s,y+h/2,z+oz*c-dx*s,span,h,1.1,p.rotation,p.key);}
  }
  function terrace(p,ox,oz,w,d,y,planted=true){
    const [x,z]=coord(p.px,p.py),c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    add('terrace','curb',x+ox*c+oz*s,y+.48,z+oz*c-ox*s,w,.96,d,p.rotation);
    part(p,ox,y+.15,oz,w-.7,.08,d-.7,'paving');
    for(const dz of [-d/2,d/2])part(p,ox,y+.92,oz+dz,w,.07,.2,'glass');
    if(planted)for(const dx of [-w*.3,w*.3]){part(p,ox+dx,y+.4,oz+d*.25,3,.45,2,'accent');part(p,ox+dx,y+.9,oz+d*.25,2.7,.55,1.7,'foliage');}
  }
  function entry(p,ox,oz,w=12,y=4.5){
    part(p,ox,y,oz,w,.24,4.8,'glass');part(p,ox,y-.18,oz,w-.5,.12,4.4,'timber');
    for(const dx of [-w*.44,w*.44])part(p,ox+dx,y/2,oz+1.7,.2,y,.2,'white');
    for(let i=0;i<3;i++)part(p,ox,.16+i*.17,oz+2.4-i*.6,w+2-i*.8,.32+i*.34,2,'curb');
  }
  function fins(p,ox,oz,count,span,height,y,alongX=true,material='white'){
    const [x,z]=coord(p.px,p.py),c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    add('screen',material,x+ox*c+oz*s,y,z+oz*c-ox*s,(count-1)*span,height,.8,p.rotation+(alongX?0:Math.PI/2),p.key);
  }
  function pergola(p,ox,oz,w,d,y){
    const [x,z]=coord(p.px,p.py),c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    add('pergola','timber',x+ox*c+oz*s,y+1.3,z+oz*c-ox*s,w,2.6,d,p.rotation,p.key);
  }
  function garden(p,ox,oz,w=6,d=4){
    part(p,ox,.6,oz,w,.9,d,'accent');part(p,ox,1.15,oz,w-.7,.6,d-.7,'foliage');
  }
  data.places.forEach(p=>{
    const [x,z]=coord(p.px,p.py);let width=30,depth=20,height=18;
    frame={x,z,scale:p.massScale||1,rotation:p.type==='library'?p.rotation:0,key:p.key};
    if(p.type==='dorm') {
      const len=p.wingLength,gap=p.courtWidth,dep=9,h=p.floors*2.8,left=-(gap+dep)/2,right=-left;
      const family=p.architecture.family,tone={courtyard:0xffffff,terrace:0xf8f7f0,garden:0xf1f6f1}[family];
      wing(p,left,0,dep,len,h,'sand',tone);
      wing(p,right,0,dep,len,family==='terrace'?h-3:h,'sand',tone);
      if(family==='courtyard')wing(p,0,-len/2+dep/2,gap,dep,h-2.8,'sand',tone);
      else {part(p,0,5.4,-len*.32,gap,2.8,3.5,'libraryGlass',p.key);part(p,0,7,-len*.32,gap+.7,.22,4.2,'curb');}
      part(p,0,.31,0,gap,.22,len,'paving');
      pergola(p,left,-len*.23,dep-1.5,7,h+1.5);
      part(p,right,(family==='terrace'?h-3:h)+1.35,-len*.22,dep-2,.18,7,'libraryGlass',p.key);
      terrace(p,left,0,dep+.7,len+.7,h+1.25);
      terrace(p,right,0,dep+.7,len+.7,(family==='terrace'?h-3:h)+1.25);
      if(family==='terrace'){
        // A low garden room makes the stepped neighbourhood distinct.
        part(p,right,h-1.25,-len*.2,dep-2.5,2.2,len*.24,'libraryGlass',p.key);
        part(p,right,h+.1,-len*.2,dep-1.4,.24,len*.24+1,'curb');
      }else if(family==='garden'){
        part(p,0,h+1.9,-len*.32,gap+dep*2-2,.2,5,'curb');
        for(const side of [-1,1])part(p,side*(gap/2+1),h+1,-len*.32,.2,1.6,4.4,'glass');
      }
      const towerH=h+2;
      part(p,left,.6+towerH/2,len/2-2.6,4.8,towerH,4.6,'white',p.key);
      part(p,left,towerH*.52,len/2-.22,3.2,towerH*.83,.25,'libraryGlass',p.key);
      part(p,left-2.5,towerH*.52,len/2-2.6,.24,towerH*.87,4.9,'accent',p.key,{courtyard:0xc69b7d,terrace:0xb5bfa7,garden:0x8aa59e}[family]);
      part(p,left,towerH+.75,len/2-2.6,5.6,.22,5.4,'curb');
      colonnade(p,0,len/2-2,2,5,4.4);entry(p,0,len/2+1,8,4.9);
      garden(p,0,0,gap*.48,7);part(p,0,.5,7,2.4,.2,8,'curb');
      width=gap+dep*2;depth=len+8;height=h+4;
    } else if(p.type==='teaching') {
      const lab=p.id.startsWith('lab-'),teach=p.id.startsWith('teach-');
      if(p.id==='cscenter'){
        wing(p,-7,-1,20,24,19,'libraryStone');wing(p,12,4,13,18,12,'libraryStone');
        part(p,-7,10,-13.25,18,17,.45,'libraryGlass',p.key);part(p,3.2,10,-1,.45,17,22,'libraryGlass',p.key);
        fins(p,-7,-13.8,7,2.6,18,10);fins(p,3.8,-1,7,3,17,10,false);
        terrace(p,12,4,13.8,18.8,13.3);part(p,-7,20.9,0,12,1,14,'libraryGlass',p.key);part(p,-7,21.6,0,14,.25,16,'curb');
        entry(p,-6,-16,22);part(p,0,.25,-19,39,.3,9,'paving');width=39;depth=38;height=23;
      }else if(p.id==='tuoxin'){
        wing(p,0,-3,34,13,19,'brick');wing(p,-10,7,12,10,10,'libraryStone');
        part(p,6,10,4,15,17,2.8,'libraryGlass',p.key);terrace(p,-10,7,12.8,10.8,11.3);
        colonnade(p,5,5.5,3,5.5,5);entry(p,5,8,18,5.8);
        fins(p,0,-9.9,9,3.7,17,10,true,'timber');
        part(p,0,.25,15,38,.3,9,'paving');width=39;depth=38;height=22;
      }else if(lab){
        wing(p,-13,0,11,28,16,'libraryStone');wing(p,13,0,11,28,p.id==='lab-2'?19:16,'libraryStone');
        wing(p,0,-9,16,10,13,'brick');
        part(p,0,9,-4,13,16,10,'libraryGlass',p.key);part(p,0,17.6,-4,15,.25,12,'curb');
        for(const side of [-1,1]){
          const roofY=side===1&&p.id==='lab-2'?20.3:17.3;
          terrace(p,side*13,0,11.8,28.8,roofY,false);
          for(const oz of [-8,0,8]){part(p,side*13,roofY+.5,oz,7,.65,4,'libraryGlass',p.key);part(p,side*13,roofY+.9,oz+2,7.4,.12,.16,'white');}
          fins(p,side*18.8,0,7,4,14,8,false);
        }
        part(p,0,.25,3,17,.3,23,'paving');colonnade(p,0,11,3,5.5,5);entry(p,0,14,9,5.7);width=40;depth=37;height=22;
      }else if(teach){
        const variant=Number(p.id.split('-')[1]);
        wing(p,0,-10,36,10,16,'brick');wing(p,-13,4,10,20,variant%2?16:13,'brick');wing(p,13,3,10,18,variant%2?13:16,'libraryStone');
        terrace(p,13,3,10.8,18.8,(variant%2?13:16)+1.3);
        part(p,0,.25,1,26,.3,27,'paving');colonnade(p,0,12,3,5.6,5.2);
        part(p,0,6,11,18,.24,5,'curb');part(p,0,8,11,17,4,3.5,'libraryGlass',p.key);part(p,0,10.3,11,18,.24,4.5,'curb');
        fins(p,0,-15.35,9,4,14,8.4,true,variant%2?'white':'timber');
        pergola(p,13,3,7,10,(variant%2?13:16)+1.5);
        entry(p,0,15,10,5.8);garden(p,0,2,7,4);width=40;depth=39;height=22;
      }else{
        const taller=p.id==='complex-2';
        wing(p,-12,0,12,28,taller?20:16,'brick');wing(p,12,0,12,28,16,'libraryStone');wing(p,0,-9,12,10,12,'brick');
        part(p,0,10,-7,10,18,11,'libraryGlass',p.key);part(p,0,19.6,-7,12,.25,13,'curb');
        terrace(p,-12,0,12.8,28.8,(taller?20:16)+1.3);terrace(p,12,0,12.8,28.8,17.3);
        part(p,-12,9,14.2,9,16,.4,'libraryGlass',p.key);fins(p,-12,14.7,5,2,17,9,true,'timber');
        part(p,0,.25,3,16,.3,23,'paving');colonnade(p,0,11,3,5,5.2);entry(p,0,14,10,5.8);
        garden(p,0,3,5,5);width=39;depth=37;height=taller?22:21;
      }
    } else if(p.type==='library') {
      const q={...p,rotation:0};
      if(p.id==='lib-north'){
        for(const side of [-1,1]){wing(q,side*21,0,22,25,13,'libraryStone');terrace(q,side*21,0,22.8,25.8,14.3);}
        part(q,0,7,0,20,13,25,'libraryGlass',p.key);part(q,0,14.4,0,23,.25,28,'curb');
        fins(q,0,13,5,4,12,7);colonnade(q,0,14,4,6,5.4);entry(q,0,17,14,6);part(q,0,.3,22,66,.4,13,'paving');
        for(const dx of [-24,24])garden(q,dx,22,12,6);width=66;depth=36;height=18;
      }else{
        // A clear glass reading lantern between two pale, planted book wings.
        part(q,0,.6,0,77,1,29,'paving');
        for(const side of [-1,1]){
          wing(q,side*25,0,25,25,17,'libraryStone');terrace(q,side*25,0,25.8,25.8,18.3);
          part(q,side*25,9,-12.8,22,15,.35,'libraryGlass',p.key);fins(q,side*25,-13.3,7,3.3,16,9);
        }
        part(q,0,12.4,0,25,23,26,'libraryGlass',p.key);
        part(q,0,24.4,0,29,.3,30,'curb');part(q,0,25,0,20,.75,20,'libraryGlass',p.key);part(q,0,25.55,0,21,.2,21,'white');
        for(const side of [-1,1]){fins(q,0,side*13.5,7,3.7,23,12);for(const y of [8,15])part(q,0,y,side*13.7,24,.12,.2,'timber',p.key);}
        colonnade(q,0,-14.2,5,5.6,5.8);entry(q,0,-18,17,6.6);
        add('panel','sign',x,20.8,z-13.8,16,2.6,1,Math.PI,p.key);
        part(q,0,.25,-25,76,.3,16,'paving');for(const dx of [-27,27])garden(q,dx,-25,15,7);
        for(const side of [-1,1])pergola(q,side*25,0,19,13,18.6);
        width=79;depth=39;height=27;
      }
      add('contact','softShadow',x+3,.38,z+3,93,1,47);
    } else if(p.type==='gym') {
      // Keep the roof court at its calibrated height; float a thin entrance canopy.
      wing(p,0,0,46,32,13,'libraryStone');part(p,0,7,-16.4,41,9,.4,'libraryGlass',p.key);
      for(const side of [-1,1])fins(p,side*23.3,0,7,4,12.5,7,false);
      fins(p,0,-17,9,5,12,7);entry(p,0,-20,34,5.5);part(p,0,.25,-24,48,.3,10,'paving');
      width=49;depth=46;height=18;
    } else if(p.type==='canteen') {
      wing(p,0,3,36,19,8,'libraryStone');wing(p,-8,3,20,17,13,'brick');
      terrace(p,11,3,13.8,19.8,9.3);terrace(p,-8,3,20.8,17.8,14.3);
      part(p,7,4.8,-7,20,7,.45,'libraryGlass',p.key);colonnade(p,0,-8,6,6,5.2);
      entry(p,0,-10.5,36,5.7);part(p,0,.25,-17,40,.3,12,'paving');for(const dx of [-14,14])garden(p,dx,-18,6,5);
      pergola(p,-6,3,14,12,14.6);
      fins(p,-8,-6.1,7,3,10,8,true,'timber');width=40;depth=39;height=17;
    } else if(p.type==='shop') {
      wing(p,0,0,13,7,4.5,'libraryStone');
      for(const dx of [-4,0,4])part(p,dx,2,3.6,3.6,3.3,.22,'libraryGlass',p.key);
      entry(p,0,4.4,14,4.3);part(p,0,.25,7,17,.25,5,'paving');garden(p,6,7,2,2);width=15;depth=12;height=7;
    } else if(p.type==='pavilion') {
      width=12;depth=12;height=8;
      for(const a of [-1,1])for(const b of [-1,1])part(p,a*4,2.9,b*4,.2,5.3,.2,'glass',p.key);
      part(p,0,5.6,0,12,.24,12,'white',p.key);for(const dx of [-4,-2,0,2,4])part(p,dx,5.8,0,.24,.18,11,'timber',p.key);
      part(p,0,.35,0,13,.6,13,'paving',p.key);part(p,0,.15,0,15,.3,15,'curb');
      for(const side of [-1,1])part(p,0,1.3,side*3.7,7,.25,1.1,'timber');
    } else if(p.type==='plaza') {
      width=p.width;depth=p.depth;height=2;part(p,0,.18,0,width,.25,depth,'paving',p.key);
      if(width>25){
        for(const dx of [-width*.36,width*.36])for(const dz of [-depth*.34,depth*.34])garden(p,dx,dz,8,6);
        for(const dx of [-width*.24,width*.24]){part(p,dx,.4,0,1,.2,depth*.7,'curb');part(p,dx,1,-depth*.27,8,.3,1.3,'timber');}
        part(p,0,.35,0,12,.3,12,'curb');part(p,0,.55,0,10,.15,10,'paving');
      }
    } else if(p.type==='court') {
      width=p.elevated?36:18;depth=p.elevated?25:22;const y=p.elevated?14.4:.45;height=p.elevated?18:4;
      const material=p.id==='bball'?'basketball':p.id==='badminton'?'badminton':'court';
      add('box',material,x,y,z,width,.35,depth,p.rotation,p.key);
      for(const side of [-1,1]){part(p,side*width/2,y+2.4,0,.16,.16,depth,'glass');part(p,0,y+2.4,side*depth/2,width,.16,.16,'glass');for(const dz of [-depth/2,0,depth/2])part(p,side*width/2,y+1.3,dz,.16,2.5,.16,'glass');}
      part(p,0,y+.6,0,width,.8,.12,'white');
    }
    if(['dorm','teaching','gym','canteen','shop','library'].includes(p.type)){const q=p.type==='library'?{...p,rotation:0}:p;part(q,0,.12,0,width+2,.15,Math.min(depth,40),'paving');}
    frame=null;const scale=p.massScale||1;width*=scale;depth*=scale;height*=scale;
    const descriptions={dorm:'按导览图逐栋落位，保留公寓楼号与分区；三个生活片区分别采用平顶围院、退台花园与架空连廊，搭配浅色阳台和通高采光楼梯间。',teaching:'按导览图定位，按功能设计的浅色学习院落、细框玻璃中庭、竖向遮阳与屋顶露台。',library:p.id==='lib'?'导览图中位于晴缘湖西侧、晴澜广场旁的图书馆。':'导览图中桂香苑内标注的图书馆，与湖畔馆分别保留。',gym:'导览图中位于腾龙运动场西侧，楼顶设凌云网球场。',canteen:'导览图中位于校园南侧、公寓区东南的晴味堂。',shop:'按导览图仅保留食堂与拓新楼之间的超市商业区，不再排列虚构店铺。',pavilion:p.id==='pav-bp'?'按导览图位于晴缘湖东岸。':'按导览图位于晴樱广场两侧。',court:p.elevated?'凌云网球场，位于体育馆楼顶。':'凌跃网球场，位于南侧教学楼西侧。',plaza:'按用户导览图标注位置，广场铺装为简化表达。'};
    targets.push({...p,x,z,width,depth,height,description:(descriptions[p.type]||'')+' 建筑为艺术化设计示意。'});
  });
  // Continuous lakeside walk; the timber section remains a quiet local accent.
  const shoreCenter=data.lake.reduce((a,p)=>[a[0]+p[0]/data.lake.length,a[1]+p[1]/data.lake.length],[0,0]);
  const shore=data.lake.map(p=>coord(shoreCenter[0]+(p[0]-shoreCenter[0])*1.11,shoreCenter[1]+(p[1]-shoreCenter[1])*1.11));
  const ribbon=closedRibbon(shore,4.3),shoreTop=.96,shoreBottom=.69;
  const surfaces={timber:{positions:[],uvs:[]},paving:{positions:[],uvs:[]}};
  let along=0;
  function shoreQuad(part,vertices,uvs){for(const i of [0,1,2,0,2,3]){part.positions.push(...vertices[i]);part.uvs.push(...uvs[i]);}}
  for(let i=0;i<shore.length;i++) {
    const j=(i+1)%shore.length,[ax,az]=shore[i],[bx,bz]=shore[j],length=Math.hypot(bx-ax,bz-az);
    const material=i>=data.timberShore[0]&&i<data.timberShore[1]?'timber':'paving',part=surfaces[material];
    const l0=ribbon.left[i],l1=ribbon.left[j],r0=ribbon.right[i],r1=ribbon.right[j];
    const top=p=>[p[0],shoreTop,p[1]],bottom=p=>[p[0],shoreBottom,p[1]],u0=along/12,u1=(along+length)/12,uv=[[u0,0],[u1,0],[u1,1],[u0,1]];
    shoreQuad(part,[top(l0),top(l1),top(r1),top(r0)],uv);
    shoreQuad(part,[bottom(l0),bottom(r0),bottom(r1),bottom(l1)],uv);
    shoreQuad(part,[top(l0),bottom(l0),bottom(l1),top(l1)],uv);
    shoreQuad(part,[top(r0),top(r1),bottom(r1),bottom(r0)],uv);
    along+=length;plantingExclusions.push({x:(ax+bx)/2,z:(az+bz)/2,r:3+length/2});
  }
  for(const [name,part]of Object.entries(surfaces)){
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(part.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(part.uvs,2));geometry.computeVertexNormals();
    siteSurfaces.push({geometry,material:materials[name],tag:'shore'});
    if(textures[name])textures[name].wrapS=T.RepeatWrapping;
  }
  const[deckX,deckZ]=coord(data.deck.px,data.deck.py),deck={x:deckX,z:deckZ};
  add('box','timber',deck.x,.9,deck.z,13,.6,17);
  for(const dx of [-6,6])for(const dz of [-7,0,7])add('box','timber',deck.x+dx,1.3,deck.z+dz,.3,2,.3);
  for(const dx of [-6,6])add('box','timber',deck.x+dx,2.2,deck.z,.25,.25,15);
  plantingExclusions.push({x:deck.x,z:deck.z,r:13});
  function bench(x,z,rotation=0) {
    const c=Math.cos(rotation),s=Math.sin(rotation);
    const part=(dx,y,dz,w,h,d,material)=>add('box',material,x+dx*c+dz*s,y,z+dz*c-dx*s,w,h,d,rotation);
    for(let slat=0;slat<5;slat++)part(0,1.05,(slat-2)*.28,4,.13,.23,'timber');
    for(const dx of [-1.4,1.4])part(dx,.55,0,.22,1,1.4,'glass');
    for(let slat=0;slat<3;slat++)part(0,1.55+slat*.25,.65,4,.18,.13,'timber');
  }
  for(const i of [1,4,7,10,13,16]){const[x,z]=shore[i];bench(x,z,Math.atan2(shoreCenter[0]-x/data.transform.k-data.transform.ox,shoreCenter[1]-z/data.transform.k-data.transform.oz));}
  for(const p of data.places.filter(p=>p.type==='dorm'||p.type==='canteen').slice(0,6)){const[x,z]=coord(p.px,p.py);bench(x+8,z+6,p.rotation);}
  // East entrance plaza and a restrained conceptual gateway, not a copied gate model.
  const[gx,gz]=coord(data.entrance.px,data.entrance.py);
  add('box','paving',gx,.12,gz,24,.18,53);
  for(const dz of [-19,19]){add('box','white',gx,3.7,gz+dz,1.3,7.4,2);add('box','glass',gx-.7,3.7,gz+dz,.3,6.6,2.5);}
  add('box','white',gx,7.6,gz,2,.7,40);
  for(const dz of [-25,25])add('box','foliage',gx-6,1,gz+dz,10,1.8,5);
  const stadium=stadiumPlan(data),{x:tx,z:tz,width:tw,depth:td}=stadium;
  const podiumShape=new T.Shape(stadium.podium.map(([x,z])=>new T.Vector2(x,-z)));
  const podiumGeo=new T.ExtrudeGeometry(podiumShape,{depth:.3,bevelEnabled:false});podiumGeo.rotateX(-Math.PI/2);podiumGeo.translate(0,.08,0);
  siteSurfaces.push({geometry:podiumGeo,material:materials.paving,tag:'stadium-podium'});
  const stadiumPixels=stadium.outline.map(([x,z])=>[x/data.transform.k+data.transform.ox,z/data.transform.k+data.transform.oz]);
  const trackMesh=flatShape(stadiumPixels,.71,'track'),trackPositions=trackMesh.geometry.attributes.position,trackUV=trackMesh.geometry.attributes.uv;
  for(let i=0;i<trackPositions.count;i++)trackUV.setXY(i,(trackPositions.getX(i)-tx)/tw+.5,.5-(trackPositions.getZ(i)-tz)/td);
  for(const dx of [-tw/2-2,tw/2+2]){add('box','curb',tx+dx,1,tz,2,1.4,td*.68,0,'track');add('box','glass',tx+dx,2,tz,.2,.2,td*.68,0,'track');}
  // The panorama shows low pale terraces on the west side of the running track.
  for(let row=0;row<4;row++){const h=.35*(row+1);add('box','curb',tx-tw/2-3.3-row*1.1,.25+h/2,tz,1.05,h,td*.52,0,'track');}
  for(const side of [-1,1]){
    const gz=tz+side*td*.295;
    for(const dx of [-tw*.13,tw*.13])add('box','curb',tx+dx,2,gz,.22,3.1,.22,0,'track');
    add('box','curb',tx,3.55,gz,tw*.26,.22,.22,0,'track');
  }
  targets.push({key:'track',id:'track',name:'腾龙田径运动场',type:'track',x:tx,z:tz,height:2,width:tw,depth:td,description:'红色塑胶八道跑道、绿色足球场与白色场线。配色参考航拍，尺寸和位置为艺术化示意。'});
  // Pack static site surfaces by material into the existing base mesh. This
  // keeps one shared strip (no coplanar overlaps), not one draw per segment.
  const siteMaterials=[materials.base,materials.timber,materials.paving],positions=[],uvs=[],ranges=[],combined=new T.BufferGeometry();
  for(let materialIndex=0;materialIndex<siteMaterials.length;materialIndex++){
    const start=positions.length/3;
    for(const surface of siteSurfaces.filter(p=>p.material===siteMaterials[materialIndex])){
      const g=surface.geometry.index?surface.geometry.toNonIndexed():surface.geometry;
      const first=positions.length/3;positions.push(...g.attributes.position.array);uvs.push(...g.attributes.uv.array);
      ranges.push({tag:surface.tag,start:first,count:g.attributes.position.count});
      if(g!==surface.geometry)g.dispose();surface.geometry.dispose();
    }
    combined.addGroup(start,positions.length/3-start,materialIndex);
  }
  combined.setAttribute('position',new T.Float32BufferAttribute(positions,3));combined.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));combined.computeVertexNormals();
  siteBase.geometry=combined;siteBase.material=siteMaterials;siteBase.name='continuous-site-surfaces';siteBase.userData.surfaceRanges=ranges;
  function blockedByBuilding(x,z) {
    return entries.some(p=>{
      if(!['brick','sand','white','libraryStone','libraryGlass','glass'].includes(p.material)||p.h<3)return false;
      const dx=x-p.x,dz=z-p.z,c=Math.cos(p.rotation||0),s=Math.sin(p.rotation||0);
      return Math.abs(dx*c-dz*s)<p.w/2+3&&Math.abs(dx*s+dz*c)<p.d/2+3;
    });
  }
  let footpaths=0;
  const inLake=(x,z)=>insidePolygon(x/data.transform.k+data.transform.ox,z/data.transform.k+data.transform.oz,data.lake);
  for(const p of targets.filter(p=>['dorm','teaching','gym','canteen','shop','library'].includes(p.type))){
    const candidates=[],c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    for(const [ox,oz,nx,nz]of [[p.width/2+2,0,1,0],[-p.width/2-2,0,-1,0],[0,p.depth/2+2,0,1],[0,-p.depth/2-2,0,-1]]){
      const ax=p.x+ox*c+oz*s,az=p.z+oz*c-ox*s,normalX=nx*c+nz*s,normalZ=nz*c-nx*s;
      for(const road of data.roads)for(let i=1;i<road.pts.length;i++){
        const [rx,rz]=coord(...road.pts[i-1]),[sx,sz]=coord(...road.pts[i]),dx=sx-rx,dz=sz-rz,t=Math.max(0,Math.min(1,((ax-rx)*dx+(az-rz)*dz)/(dx*dx+dz*dz))),bx=rx+dx*t,bz=rz+dz*t,length=Math.hypot(bx-ax,bz-az);
        if(length<4||length>37||(bx-ax)*normalX+(bz-az)*normalZ<1)continue;
        let clear=true;for(let n=0;n<=Math.ceil(length/2);n++){const k=n/Math.ceil(length/2),x=ax+(bx-ax)*k,z=az+(bz-az)*k;if(blockedByBuilding(x,z)||inLake(x,z)){clear=false;break;}}
        if(clear)candidates.push({ax,az,bx,bz,length});
      }
    }
    candidates.sort((a,b)=>a.length-b.length);const path=candidates[0];if(!path)continue;
    const {ax,az,bx,bz,length}=path;add('box','paving',(ax+bx)/2,.18,(az+bz)/2,3.4,.2,length+2,Math.atan2(bx-ax,bz-az));
    plantingExclusions.push({x:(ax+bx)/2,z:(az+bz)/2,r:3+length/2});footpaths++;
  }
  function canPlant(x,z,treeSpacing=true) {
    const px=x/data.transform.k+data.transform.ox,py=z/data.transform.k+data.transform.oz;
    if(!insidePolygon(px,py,data.boundary)||insidePolygon(px,py,data.lake))return false;
    if(Math.abs(x-tx)<tw/2+8&&Math.abs(z-tz)<td/2+8)return false;
    if(plantingExclusions.some(p=>Math.hypot(x-p.x,z-p.z)<p.r))return false;
    if(treeSpacing&&planted.some(p=>Math.hypot(x-p.x,z-p.z)<9))return false;
    if(data.roads.some(r=>r.pts.slice(1).some((p,i)=>segmentDistance(px,py,r.pts[i],p)<(r.w/2+2)/data.transform.k)))return false;
    if(targets.some(p=>['plaza','pavilion','court'].includes(p.type)&&!p.elevated&&Math.abs(x-p.x)<p.width/2+3&&Math.abs(z-p.z)<p.depth/2+3))return false;
    // Include the entrance apron and roof overhang, not only the solid walls.
    // Otherwise a valid trunk can still put its entire crown through a canopy.
    if(targets.some(p=>{
      if(!['dorm','teaching','library','gym','canteen','shop'].includes(p.type))return false;
      const dx=x-p.x,dz=z-p.z,c=Math.cos(p.rotation),s=Math.sin(p.rotation);
      return Math.abs(dx*c-dz*s)<p.width/2+4&&Math.abs(dx*s+dz*c)<p.depth/2+4;
    }))return false;
    return !blockedByBuilding(x,z);
  }
  function plant(x,z,size,row=false) {
    if(!canPlant(x,z)||planted.length>=132)return false;
    const i=planted.length;planted.push({x,z,row});
    const shape=['treeSoft','treeRound','treeColumn'][i%3],crownY=6.6+(i%4)*.25;
    add('trunk','trunk',x,3.65,z,3.2,7.2,3.2,i*.73);
    add(shape,'canopy',x,crownY,z,size,size*(shape==='treeColumn'?1.15:.98),size*.94,i*.73,null,[0x5b7f4d,0x6b8954,0x76945b,0x7c985e,0x638454][i%5]);
    add('contact','softShadow',x+1,.38,z+1,size*3,1,size*2.7);
    if(row&&i%3===0)add('box','accent',x,.4,z,2.8,.4,2.8);
    return true;
  }
  for(const[px,py,size]of data.planting){const[x,z]=coord(px,py);plant(x,z,size);}
  let rowTrees=0;
  for(const road of data.roads)for(let i=1;i<road.pts.length;i++) {
    const[ax,az]=coord(...road.pts[i-1]),[bx,bz]=coord(...road.pts[i]),length=Math.hypot(bx-ax,bz-az),nx=(bz-az)/length,nz=-(bx-ax)/length;
    for(let dist=9;dist<length-6;dist+=16)for(const side of [-1,1]) {
      if(rowTrees>=90)continue;
      const x=ax+(bx-ax)*dist/length+nx*(road.w/2+5)*side,z=az+(bz-az)*dist/length+nz*(road.w/2+5)*side;
      if(plant(x,z,5.1+(rowTrees%4)*.3,true))rowTrees++;
    }
  }
  let seed=20261020;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const minX=Math.min(...data.boundary.map(p=>p[0])),maxX=Math.max(...data.boundary.map(p=>p[0])),minY=Math.min(...data.boundary.map(p=>p[1])),maxY=Math.max(...data.boundary.map(p=>p[1]));
  for(let n=0;n<3000&&planted.length<132;n++){const[x,z]=coord(minX+rand()*(maxX-minX),minY+rand()*(maxY-minY));plant(x,z,4.8+rand()*1.8);}
  // Sparse physical blades catch light in the close view. The high-resolution
  // macro lawn and repeated bump texture carry the continuous ground cover.
  let grassTufts=0;
  for(let n=0;n<12000&&grassTufts<620;n++){
    const[x,z]=coord(minX+rand()*(maxX-minX),minY+rand()*(maxY-minY));if(!canPlant(x,z,false))continue;
    if(data.roads.some(r=>r.pts.slice(1).some((p,i)=>segmentDistance(x/data.transform.k+data.transform.ox,z/data.transform.k+data.transform.oz,r.pts[i],p)*data.transform.k<r.w/2+3.5)))continue;
    add('grass','grass',x,.08,z,.85+rand()*.7,.2+rand()*.2,.85+rand()*.7,rand()*Math.PI*2,null,[0x637d49,0x718752,0x5d7948,0x7c9059][grassTufts%4]);grassTufts++;
  }
  // Small, bounded garden islands accompany the paving instead of a random forest.
  for(const p of data.places.filter(p=>p.type==='teaching'||p.type==='dorm')) {
    const[x,z]=coord(p.px,p.py);
    if(insidePolygon(p.px,p.py,data.lake))continue;
    if(p.id.startsWith('lab-')){
      frame={x,z,scale:p.massScale||1,rotation:0};
      const island=(ox,y,oz,w,h,d,color)=>{const c=Math.cos(p.rotation),s=Math.sin(p.rotation);add('tree','foliage',x+ox*c+oz*s,y,z+oz*c-ox*s,w,h,d,p.rotation,null,color);};
      // Three small islands in the shared paving, as seen in 27837116_d.
      for(const [ox,oz,s]of [[-5,0,1],[0,6,.9],[5,2,1.1]]){
        island(ox,.55,oz,4.6*s,.5,4*s,0xa99a73);
        island(ox-.6,1.1,oz,2.5*s,1.4,2.2*s);
        island(ox+.9,.95,oz+.6,1.7*s,1.1,1.6*s);
      }
      frame=null;continue;
    }
    for(const dx of [-4,4])add('tree','foliage',x+dx,1,z,3,1.1,2.4);
    add('tree','foliage',x,1.3,z+3,2.1,.8,1.8,0,null,0xb57c78);
  }
  const treeCount=planted.length,clusterTrees=0;
  const pickables=[],shadowCasters=[];
  for(const[id,objects]of batches){const[kind,material]=id.split(':');
    if(material==='canopy')for(const o of objects)shadowCasters.push({...o,kind:'tree'});
    else if(['brick','sand','white','libraryStone','libraryGlass'].includes(material))for(const o of objects){if(o.key&&o.h>3)shadowCasters.push({...o,kind:'building'});}
  }
  for(const[id,objects]of batches) {
    const[kind,material]=id.split(':'),geometry=kind==='facade'&&material==='libraryStone'?geometries.stoneFacade:kind==='box'&&material==='libraryGlass'?geometries.glazing:geometries[kind],mesh=new T.InstancedMesh(geometry,materials[material],objects.length);
    mesh.name=id;mesh.castShadow=['brick','sand','white','roof','libraryStone'].includes(material);mesh.receiveShadow=!['shadow','softShadow','sign'].includes(material);
    mesh.userData.keys=objects.map(o=>o.key);
    // r149 shares shader programs between batches using the same material.
    // Supply instance colours consistently, including neutral white batches.
    objects.forEach((o,i)=>{dummy.position.set(o.x,o.y,o.z);dummy.rotation.set(0,o.rotation,0);dummy.scale.set(o.w,o.h,o.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(material==='canopy')mesh.setColorAt(i,new T.Color(o.color||0x6b8954));else if(material==='foliage')mesh.setColorAt(i,new T.Color(o.color||0x789265));else mesh.setColorAt(i,new T.Color(o.color||0xffffff));});
    mesh.instanceMatrix.needsUpdate=true;
    if(objects.some(o=>o.key))pickables.push(mesh);
    root.add(mesh);
  }
  water.userData.key='lake';pickables.push(water);trackMesh.userData.key='track';pickables.push(trackMesh);
  // Freeze static world transforms. Instance bounds and raycasting still work in r149.
  root.updateMatrixWorld(true);root.traverse(o=>{o.matrixAutoUpdate=false;});
  const visibility=createInstanceVisibility(T,root.children);
  const metrics={placeGroups:targets.length,footpaths,treeCount,clusterTrees,rowTrees,grassTufts,batches:batches.size,instances:[...batches.values()].reduce((n,a)=>n+a.length,0)};
  function setDetail(quality){const low=quality==='low';materials.ground.userData.detailStrength.value=low||!textures.grassDetail?0:1;for(const mesh of root.children){const[kind,material]=(mesh.name||'').split(':');if(material==='canopy'||kind==='trunk'||kind==='tree')mesh.geometry=geometries[kind+(low?'Low':'')];else if(kind==='facade')mesh.geometry=low?geometries.facadeLow:material==='libraryStone'?geometries.stoneFacade:geometries.facade;else if(kind==='dormFacade')mesh.geometry=geometries[low?'dormFacadeLow':'dormFacade'];else if(kind==='box'&&material==='libraryGlass')mesh.geometry=geometries[low?'box':'glazing'];if(material==='canopy')mesh.material=materials[low?'canopyLow':'canopy'];mesh.userData.detailHidden=kind==='grass'&&low;mesh.visible=!mesh.userData.detailHidden&&(!mesh.isInstancedMesh||mesh.count>0);}metrics.detail=low?'economy':'full';}
  return {root,targets,pickables,metrics,ground,water,stadium,ribbon,siteBase,materials,shadowCasters,shadowContacts,navigation:{solids:entries,trees:planted,stadium,surfaces:walkSurfaces},setDetail,updateVisibility(camera,active){metrics.visibleInstances=visibility.update(camera,active);},highlight:key=>visibility.highlight(key),dispose(){visibility.dispose();const gs=new Set(Object.values(geometries)),ms=new Set(Object.values(materials));root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}};
}
