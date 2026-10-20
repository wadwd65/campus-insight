import { insidePolygon, segmentDistance } from './campus-model.js';

export const TYPE_LABELS={ teaching:'教学与实验', dorm:'学生公寓', library:'图书馆', gym:'体育馆', canteen:'校园食堂', shop:'生活街区', pavilion:'校园廊亭', court:'球类运动', lake:'晴缘湖', track:'田径场',plaza:'校园广场' };

export function buildCampusScene(T,data,textures={}) {
  const root=new T.Group(); root.name='lightweight-campus';
  const batches=new Map(), entries=[], targets=[], planted=[], plantingExclusions=[],shadowContacts=[];
  const geometries={box:new T.BoxGeometry(1,1,1),tree:new T.IcosahedronGeometry(1,0),treeSoft:new T.SphereGeometry(1,7,4),trunk:new T.CylinderGeometry(.65,1,1,5),panel:new T.PlaneGeometry(1,1),contact:new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),junction:new T.CircleGeometry(.5,12).rotateX(-Math.PI/2)};
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
  // Shallow floor cornices add readable relief to teaching/stone facades.
  // Baked once into the shared wing geometry, never one object per window.
  const facadeBase=geometries.facade.toNonIndexed(),fp=Array.from(facadeBase.attributes.position.array),fu=Array.from(facadeBase.attributes.uv.array);
  for(let floor=0;floor<5;floor++)for(const side of [-1,1]){
    const y=-.5+(floor+.18)/5,inner=side*.5,outer=side*.54;
    const qs=side>0?[[[inner,y,-.5],[inner,y,.5],[outer,y,.5],[outer,y,-.5]],[[outer,y-.012,-.5],[outer,y,-.5],[outer,y,.5],[outer,y-.012,.5]]]:[[[inner,y,.5],[inner,y,-.5],[outer,y,-.5],[outer,y,.5]],[[outer,y-.012,.5],[outer,y,.5],[outer,y,-.5],[outer,y-.012,-.5]]];
    for(const q of qs)for(const i of [0,1,2,0,2,3]){fp.push(...q[i]);fu.push(.99,.99);}
  }
  geometries.facade.dispose();geometries.facade=new T.BufferGeometry();geometries.facade.setAttribute('position',new T.Float32BufferAttribute(fp,3));geometries.facade.setAttribute('uv',new T.Float32BufferAttribute(fu,2));geometries.facade.computeVertexNormals();facadeBase.dispose();
  const roof=new T.BufferGeometry();
  const rv=[[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[0,1,-.32],[0,1,.32]],rp=[],ru=[],roofIndices=[0,4,1,3,2,5,0,3,5,0,5,4,1,4,5,1,5,2];
  for(const i of roofIndices){rp.push(...rv[i]);ru.push((rv[i][2]+.5)*.85,rv[i][0]+.5);}
  roof.setAttribute('position',new T.Float32BufferAttribute(rp,3));roof.setAttribute('uv',new T.Float32BufferAttribute(ru,2));roof.computeVertexNormals();geometries.roof=roof;
  const gv=rv.map(p=>[...p]);gv[4][2]=-.5;gv[5][2]=.5;const gablePositions=[],gableUV=[];
  roofIndices.forEach((i,n)=>{gablePositions.push(...gv[i]);gableUV.push(n<6?.94:(gv[i][2]+.5)*.85,n<6?.5:gv[i][0]+.5);});
  geometries.gable=new T.BufferGeometry();geometries.gable.setAttribute('position',new T.Float32BufferAttribute(gablePositions,3));geometries.gable.setAttribute('uv',new T.Float32BufferAttribute(gableUV,2));geometries.gable.computeVertexNormals();
  // One reusable masonry arch; the opening is real geometry, not a dark decal.
  // All colonnades share this 6-segment profile and one instanced draw batch.
  const archShape=new T.Shape();
  archShape.moveTo(-.5,0);archShape.lineTo(-.5,1);archShape.lineTo(.5,1);archShape.lineTo(.5,0);archShape.lineTo(.34,0);archShape.lineTo(.34,.53);
  archShape.absarc(0,.53,.34,0,Math.PI,false);archShape.lineTo(-.34,0);archShape.closePath();
  geometries.arch=new T.ExtrudeGeometry(archShape,{depth:1,bevelEnabled:false,curveSegments:4});geometries.arch.translate(0,-.5,-.5);
  geometries.roofBox=geometries.box.clone();const roofBoxUV=geometries.roofBox.attributes.uv;for(let i=0;i<roofBoxUV.count;i++)roofBoxUV.setX(i,roofBoxUV.getX(i)*.85);
  const materials={
    brick:new T.MeshLambertMaterial({color:0xffffff,map:textures.teaching || null}),
    sand:new T.MeshLambertMaterial({color:0xffffff,map:textures.dorm || null}),
    white:new T.MeshLambertMaterial({color:0xeee6d5}),
    roof:new T.MeshLambertMaterial({color:0xffffff,map:textures.roofMetal||null}),
    accent:new T.MeshLambertMaterial({color:0xc4b294}),
    glass:new T.MeshLambertMaterial({color:0x557f83}),
    foliage:new T.MeshLambertMaterial({color:0xffffff}),
    trunk:new T.MeshLambertMaterial({color:0x8e8370}),
    road:new T.MeshLambertMaterial({color:0xffffff,map:textures.road||null}),
    asphalt:new T.MeshLambertMaterial({color:0x646969}),
    sidewalk:new T.MeshLambertMaterial({color:0xdfc6ab,map:textures.paving||null}),
    curb:new T.MeshLambertMaterial({color:0xf4f0df}),
    ground:new T.MeshLambertMaterial({color:0xffffff,map:textures.ground||null}),
    base:new T.MeshLambertMaterial({color:0x9aab8f}),
    water:new T.MeshLambertMaterial({color:0xffffff,map:textures.water||null}),
    libraryStone:new T.MeshLambertMaterial({color:0xffffff,map:textures.libraryStone||null}),
    libraryGlass:new T.MeshLambertMaterial({color:0xffffff,map:textures.libraryGlass||null}),
    paving:new T.MeshLambertMaterial({color:0xffffff,map:textures.paving||null}),
    timber:new T.MeshLambertMaterial({color:0xcfb18a,map:textures.timber||null}),
    canopy:new T.MeshLambertMaterial({color:0xffffff}),
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
    const id=kind+':'+material;
    if(!batches.has(id))batches.set(id,[]);
    const object={x,y,z,w,h,d,rotation,key,color};batches.get(id).push(object);
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
  baseGeo.rotateX(-Math.PI/2);baseGeo.translate(0,-7,0);root.add(new T.Mesh(baseGeo,materials.base));
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
  function wing(p,ox,oz,w,d,h,material,pitched=true,terrace=false,color=null) {
    const c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    const [px,pz]=coord(p.px,p.py);const x=px+ox*c+oz*s,z=pz+oz*c-ox*s;
    const longX=w>d,angle=p.rotation+(longX?Math.PI/2:0),short=Math.min(w,d),long=Math.max(w,d);
    add(material==='sand'?'dormFacade':'facade',material==='white'?'libraryStone':material,x,h/2+.6,z,short,h,long,angle,p.key,color);
    add('box','curb',x,.5,z,w+1,.8,d+1,p.rotation);
    add('box','glass',x,h+.55,z,w+1.8,.65,d+1.8,p.rotation);
    if(pitched) {const rise=Math.min(short*.27,4),cut=terrace?6:0,rx=x-Math.sin(angle)*cut/2,rz=z-Math.cos(angle)*cut/2;add(p.architecture?.roof==='gable'?'gable':'roof','roof',rx,h+.9,rz,short+2.5,rise,long+2.5-cut,angle,p.key);add('box','curb',rx,h+rise+.95,rz,.22,.2,(long+2.5-cut)*.64,angle);}
    else add('box','roof',x,h+.9,z,w+1.4,.6,d+1.4,p.rotation);
    add('contact','softShadow',x+1,.38,z+1,w+9,1,d+9,p.rotation);
  }
  function part(p,ox,y,oz,w,h,d,material,key=null,color=null){const [x,z]=coord(p.px,p.py),c=Math.cos(p.rotation),s=Math.sin(p.rotation);add('box',material,x+ox*c+oz*s,y,z+oz*c-ox*s,w,h,d,p.rotation,key,color);}
  function arcade(p,ox,oz,count,span=5.5,h=4.8,y=.6){
    const [x,z]=coord(p.px,p.py),c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    for(let i=0;i<count;i++){const dx=ox+(i-(count-1)/2)*span;add('arch','white',x+dx*c+oz*s,y+h/2,z+oz*c-dx*s,span,h,1.1,p.rotation,p.key);}
  }
  function terrace(p,ox,oz,w,d,y,planted=true){
    part(p,ox,y,oz,w,.45,d,'curb');part(p,ox,y+.25,oz,w-1,.12,d-1,'paving');
    for(const dz of [-d/2,d/2])part(p,ox,y+.8,oz+dz,w,1.1,.4,'curb');
    for(const dx of [-w/2,w/2])part(p,ox+dx,y+.8,oz,.4,1.1,d,'curb');
    if(planted)for(const dx of [-w*.3,w*.3]){part(p,ox+dx,y+.65,oz+d*.25,3,.7,2,'accent');part(p,ox+dx,y+1.2,oz+d*.25,2.7,.65,1.7,'foliage');}
  }
  function entry(p,ox,oz,w=12,y=4.5){
    part(p,ox,y,oz,w,.45,4.8,'timber');
    for(const dx of [-w*.44,w*.44])part(p,ox+dx,y/2,oz+1.7,.35,y,.35,'curb');
    for(let i=0;i<3;i++)part(p,ox,.16+i*.17,oz+2.4-i*.6,w+2-i*.8,.32+i*.34,2,'curb');
  }
  function garden(p,ox,oz,w=6,d=4){
    part(p,ox,.6,oz,w,.9,d,'accent');part(p,ox,1.15,oz,w-.7,.6,d-.7,'foliage');
  }
  data.places.forEach(p=>{
    const [x,z]=coord(p.px,p.py);let width=30,depth=20,height=18;
    frame={x,z,scale:p.massScale||1,rotation:p.type==='library'?p.rotation:0};
    if(p.type==='dorm') {
      const len=p.wingLength,gap=p.courtWidth,dep=9,h=p.floors*2.8,left=-(gap+dep)/2,right=-left;
      const family=p.architecture.family;
      const colors={courtyard:0xfff4df,terrace:0xf0e2cc,garden:0xe7efdf},tone=colors[family];
      wing(p,left,0,dep,len,h,'sand',family!=='terrace',false,tone);
      wing(p,right,0,dep,len,family==='terrace'?h-3:h,'sand',family!=='terrace',false,tone);
      // Three neighbourhoods: pitched cloister, stepped garden, paired gable wings.
      if(family==='courtyard')wing(p,0,-len/2+dep/2,gap,dep,h-2.8,'sand',true,false,tone);
      else {part(p,0,5.4,-len*.32,gap,2.8,4,'libraryGlass',p.key);part(p,0,7,-len*.32,gap+1,.35,5,'curb');}
      part(p,0,.31,0,gap,.22,len,'paving');
      if(family==='terrace'){
        terrace(p,left,0,dep+1,len+1,h+1);terrace(p,right,0,dep+1,len+1,h-2);
        part(p,right,6.9,len*.12,dep+1,.3,16,'curb');
      }else{
        // An inset dormer and a brick stair tower break the long roof silhouette.
        part(p,right,h+1.15,-len*.18,5.5,2.1,4.2,'white',p.key);
        part(p,right,h+2.4,-len*.18,6,.4,4.8,'roof');
      }
      const towerH=h+2.2;
      part(p,left,.6+towerH/2,len/2-3,5.8,towerH,5.3,'white',p.key,family==='garden'?0xb1bdab:0xc79472);
      part(p,left,towerH+1,len/2-3,6.5,.6,6,'curb');
      part(p,left,towerH*.53,len/2-.25,1.7,towerH*.7,.2,'libraryGlass',p.key);
      arcade(p,0,len/2-2,2,5,4.4);entry(p,0,len/2+1,7,4.9);
      garden(p,0,0,gap*.48,7);part(p,0,.5,7,2.4,.2,8,'curb');
      for(const side of [-1,1])part(p,side*(gap/2+dep+.15),h*.48,-3,.35,h*.84,2.3,'curb');
      width=gap+dep*2;depth=len+8;height=h+4;
    } else if(p.type==='teaching') {
      const lab=p.id.startsWith('lab-'),teach=p.id.startsWith('teach-');
      if(p.id==='cscenter'){
        wing(p,-7,-1,20,24,19,'white',false);wing(p,12,4,13,18,12,'white',false);
        part(p,-7,10,-13.2,18,17,.6,'libraryGlass',p.key);part(p,3.2,10,-1,.6,17,22,'libraryGlass',p.key);
        for(const dx of [-15,-11,-7,-3,1])part(p,dx,10,-13.8,.45,18,1.3,'curb');
        terrace(p,12,4,14,19,13);part(p,-7,20.3,0,22,.7,26,'roof');
        part(p,-7,21.3,0,12,1.4,14,'libraryGlass',p.key);part(p,-7,22.2,0,14,.35,16,'curb');
        entry(p,-6,-16,22);part(p,0,.25,-19,39,.3,9,'paving');
        width=39;depth=38;height=23;
      }else if(p.id==='tuoxin'){
        wing(p,0,-3,34,13,19,'brick',false);wing(p,-10,7,12,10,10,'white',false);
        part(p,6,9.7,4,15,17,3,'libraryGlass',p.key);terrace(p,-10,7,13,11,11);
        arcade(p,5,5.5,3,5.5,5);entry(p,5,8,18,5.8);
        for(const dx of [-15,-10,-5,0,5,10,15])part(p,dx,20.2,-3,.4,.7,15,'timber');
        part(p,0,.25,15,38,.3,9,'paving');width=39;depth=38;height=22;
      }else if(lab){
        // Pale laboratory wings around a glazed atrium, with three roof lanterns.
        wing(p,-13,0,11,28,16,'white',false);wing(p,13,0,11,28,p.id==='lab-2'?19:16,'white',false);
        wing(p,0,-9,16,10,13,'brick',false,false,0xf4dfc4);
        part(p,0,9,-4,13,16,10,'libraryGlass',p.key);part(p,0,17.6,-4,15,.65,12,'curb');
        for(const side of [-1,1]){
          terrace(p,side*13,0,12,29,side===1&&p.id==='lab-2'?20:17,false);
          for(const oz of [-8,0,8]){part(p,side*13,side===1&&p.id==='lab-2'?21:18,oz,7,1.1,4,'libraryGlass',p.key);}
          for(const oz of [-10,-3,4,11])part(p,side*18.8,8,oz,.65,14,1,'accent');
        }
        part(p,0,.25,3,17,.3,23,'paving');arcade(p,0,11,3,5.5,5);entry(p,0,14,9,5.7);
        width=40;depth=37;height=22;
      }else if(teach){
        const variant=Number(p.id.split('-')[1]),warm=variant%2===0?0xe9c5a6:0xffead0;
        wing(p,0,-10,36,10,16,'brick',true,false,warm);
        wing(p,-13,4,10,20,variant%2?16:13,'brick',true,false,warm);
        wing(p,13,3,10,18,variant%2?13:16,'white',false);
        terrace(p,13,3,11,19,(variant%2?13:16)+1);
        part(p,0,.25,1,26,.3,27,'paving');arcade(p,0,12,3,5.6,5.2);
        part(p,0,6,11,18,.5,5,'curb');part(p,0,8,11,17,4,4,'libraryGlass',p.key);part(p,0,10.5,11,18,.6,5,'roof');
        for(const dx of [-14,-7,0,7,14])part(p,dx,8.4,-15.3,.9,14,.7,'accent',null,variant%2?0xc39b72:0xa36a50);
        entry(p,0,15,9,5.8);garden(p,0,2,7,4);
        width=40;depth=39;height=22;
      }else{
        const taller=p.id==='complex-2';
        wing(p,-12,0,12,28,taller?20:16,'brick',false,false,0xffecd9);
        wing(p,12,0,12,28,16,'white',false);
        wing(p,0,-9,12,10,12,'brick',false);
        part(p,0,10,-7,10,18,11,'libraryGlass',p.key);part(p,0,19.6,-7,12,.5,13,'curb');
        terrace(p,-12,0,13,29,(taller?20:16)+1);terrace(p,12,0,13,29,17);
        part(p,-12,9,14.2,9,16,.5,'libraryGlass',p.key);
        for(const dx of [-15,-12,-9])part(p,dx,9,14.7,.4,17,1,'timber');
        part(p,0,.25,3,16,.3,23,'paving');arcade(p,0,11,3,5,5.2);entry(p,0,14,9,5.8);
        garden(p,0,3,5,5);width=39;depth=37;height=taller?22:21;
      }
    } else if(p.type==='library') {
      // The two libraries have independent massing; local frame applies rotation once.
      const q={...p,rotation:0};
      if(p.id==='lib-north'){
        for(const side of [-1,1]){wing(q,side*21,0,22,25,13,'libraryStone',true);}
        part(q,0,7,0,20,13,25,'libraryGlass',p.key);part(q,0,14.4,0,22,.5,27,'curb');
        arcade(q,0,14,4,6,5.4);entry(q,0,17,13,6);part(q,0,.3,22,66,.4,13,'paving');
        for(const dx of [-24,24])garden(q,dx,22,12,6);
        width=66;depth=36;height=18;
      }else{
        part(q,0,.6,0,77,1,29,'paving');
        for(const side of [-1,1]){
          wing(q,side*25,0,25,25,17,'libraryStone',false);
          terrace(q,side*25,0,26,26,18);
          part(q,side*25,3,-12.8,21,4,.5,'libraryGlass',p.key);
          for(const offset of [-8,0,8])part(q,side*25+offset,9,-13.3,.55,16,1,'curb');
        }
        part(q,0,12.4,0,25,23,26,'libraryGlass',p.key);
        part(q,0,24.4,0,28,.6,29,'curb');
        add('gable','roof',x,24.7,z,28,4.4,30,Math.PI/2,p.key);
        for(const dx of [-11,-5.5,0,5.5,11])for(const side of [-1,1])part(q,dx,12,side*13.4,.42,23,.7,'curb');
        arcade(q,0,-14.2,5,5.6,5.8);entry(q,0,-18,15,6.6);
        add('panel','sign',x,20.8,z-13.8,16,2.6,1,Math.PI,p.key);
        part(q,0,.25,-25,76,.3,16,'paving');for(const dx of [-27,27])garden(q,dx,-25,15,7);
        // A quiet timber reading pergola on the two planted roof terraces.
        for(const side of [-1,1])for(const dz of [-7,7])part(q,side*25,20.8,dz,20,.3,.4,'timber');
        for(const side of [-1,1])for(const dx of [-9,9])for(const dz of [-7,7])part(q,side*25+dx,19.6,dz,.3,2.6,.3,'timber');
        width=79;depth=39;height=30;
      }
      add('contact','softShadow',x+3,.38,z+3,93,1,47);
    } else if(p.type==='gym') {
      wing(p,0,0,46,32,13,'white',false);
      part(p,0,7,-16.4,40,8,.5,'libraryGlass',p.key);
      for(const side of [-1,1])for(const oz of [-12,-6,0,6,12])part(p,side*23.3,7,oz,.7,12.5,1.2,'accent');
      for(const dx of [-21,-14,-7,0,7,14,21])part(p,dx,7,-17,.6,12,1.4,'curb');
      entry(p,0,-20,30,5.5);part(p,0,.25,-24,48,.3,10,'paving');
      for(const dz of [-16,16])part(p,0,15.7,dz,47,3.5,.25,'glass');
      width=49;depth=46;height=18;
    } else if(p.type==='canteen') {
      // Three occupied terraces, a glazed dining hall, and an open market loggia.
      wing(p,0,3,36,19,8,'white',false);wing(p,-8,3,20,17,13,'brick',false,false,0xf2d1b2);
      terrace(p,11,3,14,20,9);terrace(p,-8,3,21,18,14);
      part(p,7,4.8,-7,20,7,.6,'libraryGlass',p.key);arcade(p,0,-8,6,6,5.2);
      for(const side of [-1,1]){part(p,side*12,6,-10.5,10,.55,5,'timber');for(const dx of [-4,4])part(p,side*12+dx,3,-12.5,.35,5.7,.35,'curb');}
      part(p,0,.25,-17,40,.3,12,'paving');for(const dx of [-14,14])garden(p,dx,-18,6,5);
      for(const dx of [-12,-8,-4,0])part(p,dx,16,3,.35,.3,14,'timber');
      for(const dx of [-12,0])for(const dz of [-3,9])part(p,dx,15, dz,.25,2,.25,'timber');
      for(const dz of [-3,9])part(p,-6,16,dz,14,.3,.4,'timber');
      width=40;depth=39;height=17;
    } else if(p.type==='shop') {
      wing(p,0,0,13,7,4.5,'white',false);terrace(p,0,0,14,8,5,false);
      for(const dx of [-4,0,4]){part(p,dx,2,3.6,3.3,3,.3,'libraryGlass',p.key);part(p,dx,4.1,4.8,3.7,.4,3,'timber');}
      part(p,0,.25,7,17,.25,5,'paving');garden(p,6,7,2,2);width=15;depth=12;height=7;
    } else if(p.type==='pavilion') {
      width=12;depth=12;height=8;
      for(const a of [-1,1])for(const b of [-1,1])part(p,a*3.8,2.6,b*3.8,.45,5,.45,'timber');
      add('roof','roof',x,5.2,z,13,2.4,13,p.rotation,p.key);part(p,0,5,0,12,.4,12,'curb');
      part(p,0,.35,0,13,.6,13,'paving',p.key);part(p,0,.15,0,15,.3,15,'curb');
      part(p,0,1.3,3.7,7,.35,1.1,'timber');part(p,0,1.3,-3.7,7,.35,1.1,'timber');
      for(const side of [-1,1])part(p,side*3.8,2,0,.2,.2,7,'timber');
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
    const descriptions={dorm:'按导览图逐栋落位，保留公寓楼号与分区；三个生活片区分别采用坡顶围院、退台花园与双翼连廊。',teaching:'按导览图定位，按功能设计的围院、通廊、露台与玻璃采光空间。',library:p.id==='lib'?'导览图中位于晴缘湖西侧、晴澜广场旁的图书馆。':'导览图中桂香苑内标注的图书馆，与湖畔馆分别保留。',gym:'导览图中位于腾龙运动场西侧，楼顶设凌云网球场。',canteen:'导览图中位于校园南侧、公寓区东南的晴味堂。',shop:'按导览图仅保留食堂与拓新楼之间的超市商业区，不再排列虚构店铺。',pavilion:p.id==='pav-bp'?'按导览图位于晴缘湖东岸。':'按导览图位于晴樱广场两侧。',court:p.elevated?'凌云网球场，位于体育馆楼顶。':'凌跃网球场，位于南侧教学楼西侧。',plaza:'按用户导览图标注位置，广场铺装为简化表达。'};
    targets.push({...p,x,z,width,depth,height,description:(descriptions[p.type]||'')+' 建筑为艺术化设计示意。'});
  });
  // Continuous lakeside walk; the timber section remains a quiet local accent.
  const shoreCenter=data.lake.reduce((a,p)=>[a[0]+p[0]/data.lake.length,a[1]+p[1]/data.lake.length],[0,0]);
  const shore=data.lake.map(p=>coord(shoreCenter[0]+(p[0]-shoreCenter[0])*1.11,shoreCenter[1]+(p[1]-shoreCenter[1])*1.11));
  for(let i=0;i<shore.length;i++) {
    const [ax,az]=shore[i],[bx,bz]=shore[(i+1)%shore.length],angle=Math.atan2(bx-ax,bz-az),length=Math.hypot(bx-ax,bz-az);
    add('box',i>=data.timberShore[0]&&i<data.timberShore[1]?'timber':'paving',(ax+bx)/2,.64,(az+bz)/2,4.3,.25,length+1,angle);
    plantingExclusions.push({x:(ax+bx)/2,z:(az+bz)/2,r:3+length/2});
  }
  const[deckX,deckZ]=coord(data.deck.px,data.deck.py),deck={x:deckX,z:deckZ};
  add('box','timber',deck.x,.9,deck.z,13,.6,17);
  for(const dx of [-6,6])for(const dz of [-7,0,7])add('box','trunk',deck.x+dx,1.3,deck.z+dz,.3,2,.3);
  for(const dx of [-6,6])add('box','timber',deck.x+dx,2.2,deck.z,.25,.25,15);
  plantingExclusions.push({x:deck.x,z:deck.z,r:13});
  function bench(x,z,rotation=0) {
    const c=Math.cos(rotation),s=Math.sin(rotation);
    const part=(dx,y,dz,w,h,d,material)=>add('box',material,x+dx*c+dz*s,y,z+dz*c-dx*s,w,h,d,rotation);
    part(0,1.05,0,4,.25,1.4,'timber');
    for(const dx of [-1.4,1.4])part(dx,.55,0,.22,1,1.4,'glass');
    part(0,1.9,.65,4,1,.18,'timber');
  }
  for(const i of [1,4,7,10,13,16]){const[x,z]=shore[i];bench(x,z,Math.atan2(shoreCenter[0]-x/data.transform.k-data.transform.ox,shoreCenter[1]-z/data.transform.k-data.transform.oz));}
  for(const p of data.places.filter(p=>p.type==='dorm'||p.type==='canteen').slice(0,6)){const[x,z]=coord(p.px,p.py);bench(x+8,z+6,p.rotation);}
  // East entrance plaza and a restrained conceptual gateway, not a copied gate model.
  const[gx,gz]=coord(data.entrance.px,data.entrance.py);
  add('box','paving',gx,.12,gz,24,.18,53);
  for(const dz of [-19,19]){add('box','white',gx,3.7,gz+dz,1.3,7.4,2);add('box','glass',gx-.7,3.7,gz+dz,.3,6.6,2.5);}
  add('box','white',gx,7.6,gz,2,.7,40);
  for(const dz of [-25,25])add('box','foliage',gx-6,1,gz+dz,10,1.8,5);
  const [tx,tz]=coord(data.track.px,data.track.py),tw=data.track.L*data.transform.k,td=data.track.W*data.transform.k;
  add('box','paving',tx,.23,tz,tw+7,.3,td+7);
  add('box','track',tx,.46,tz,tw,.5,td,0,'track');
  for(const dx of [-tw/2-2,tw/2+2]){add('box','curb',tx+dx,1,tz,2,1.4,td*.68);add('box','glass',tx+dx,2,tz,.2,.2,td*.68);}
  // The panorama shows low pale terraces on the west side of the running track.
  for(let row=0;row<4;row++){const h=.35*(row+1);add('box','curb',tx-tw/2-3.3-row*1.1,.25+h/2,tz,1.05,h,td*.52);}
  for(const side of [-1,1]){
    const gz=tz+side*td*.295;
    for(const dx of [-tw*.13,tw*.13])add('box','curb',tx+dx,2,gz,.22,3.1,.22);
    add('box','curb',tx,3.55,gz,tw*.26,.22,.22);
  }
  targets.push({key:'track',id:'track',name:'腾龙田径运动场',type:'track',x:tx,z:tz,height:2,width:tw,depth:td,description:'红色塑胶八道跑道、绿色足球场与白色场线。配色参考航拍，尺寸和位置为艺术化示意。'});
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
  function canPlant(x,z) {
    const px=x/data.transform.k+data.transform.ox,py=z/data.transform.k+data.transform.oz;
    if(!insidePolygon(px,py,data.boundary)||insidePolygon(px,py,data.lake))return false;
    if(Math.abs(x-tx)<tw/2+8&&Math.abs(z-tz)<td/2+8)return false;
    if(plantingExclusions.some(p=>Math.hypot(x-p.x,z-p.z)<p.r))return false;
    if(planted.some(p=>Math.hypot(x-p.x,z-p.z)<9))return false;
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
    add('trunk','trunk',x,2.3,z,.65,4.5,.65);
    add('treeSoft','canopy',x,7.1,z,size,size*.95,size*.88,i*.73);
    if(i%4===0)add('treeSoft','canopy',x+1.8,6,z+1,size*.65,size*.7,size*.64,i*.43);
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
  const treeCount=planted.length,clusterTrees=planted.filter((_,i)=>i%4===0).length;
  const pickables=[],shadowCasters=[];
  for(const[id,objects]of batches){const[kind,material]=id.split(':');
    if(material==='canopy')for(const o of objects)shadowCasters.push({...o,kind:'tree'});
    else if(['brick','sand','white','libraryStone','libraryGlass'].includes(material))for(const o of objects){if(o.key&&o.h>3)shadowCasters.push({...o,kind:'building'});}
    else if(kind==='roof'||kind==='gable')for(const o of objects)shadowCasters.push({...o,y:o.y+o.h/2,kind:'building'});
  }
  for(const[id,objects]of batches) {
    const[kind,material]=id.split(':'),mesh=new T.InstancedMesh(geometries[kind],materials[material],objects.length);
    mesh.name=id;mesh.castShadow=['brick','sand','white','roof','libraryStone'].includes(material);mesh.receiveShadow=!['shadow','softShadow','sign'].includes(material);
    mesh.userData.keys=objects.map(o=>o.key);
    // r149 shares shader programs between batches using the same material.
    // Supply instance colours consistently, including neutral white batches.
    objects.forEach((o,i)=>{dummy.position.set(o.x,o.y,o.z);dummy.rotation.set(0,o.rotation,0);dummy.scale.set(o.w,o.h,o.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(material==='canopy')mesh.setColorAt(i,new T.Color(i%19===0?0xbe9da0:[0x5d805f,0x70905e,0x8caa74,0xa9b77e,0x7d9664][i%5]));else if(material==='foliage')mesh.setColorAt(i,new T.Color(o.color||0x55794f));else mesh.setColorAt(i,new T.Color(o.color||0xffffff));});
    mesh.instanceMatrix.needsUpdate=true;
    if(objects.some(o=>o.key))pickables.push(mesh);
    root.add(mesh);
  }
  water.userData.key='lake';pickables.push(water);
  // Freeze static world transforms. Instance bounds and raycasting still work in r149.
  root.updateMatrixWorld(true);root.traverse(o=>{o.matrixAutoUpdate=false;});
  const metrics={placeGroups:targets.length,footpaths,treeCount,clusterTrees,rowTrees,batches:batches.size,instances:[...batches.values()].reduce((n,a)=>n+a.length,0)};
  return {root,targets,pickables,metrics,ground,materials,shadowCasters,shadowContacts,dispose(){const gs=new Set(Object.values(geometries)),ms=new Set(Object.values(materials));root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}};
}
