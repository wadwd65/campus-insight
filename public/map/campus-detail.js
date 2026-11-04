// Shared, deterministic geometry: the finer silhouettes cost triangles, not
// hundreds of scene objects. No downloads, per-leaf animation or render passes.
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

function geometryWriter(T){
  const positions=[],normals=[],colors=[],uvs=[];
  function triangle(a,b,c,color=[1,1,1],tip=null,texcoords=null){
    const normal=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a)).normalize();
    [a,b,c].forEach((p,i)=>{positions.push(p.x,p.y,p.z);normals.push(normal.x,normal.y,normal.z);colors.push(...(i===2&&tip?tip:color));uvs.push(...(texcoords?texcoords[i]:[0,0]));});
  }
  function append(g,matrix,shade=1){
    const source=g.index?g.toNonIndexed():g,normalMatrix=new T.Matrix3().getNormalMatrix(matrix);
    for(let i=0;i<source.attributes.position.count;i++){
      const p=new T.Vector3().fromBufferAttribute(source.attributes.position,i).applyMatrix4(matrix);
      const n=new T.Vector3().fromBufferAttribute(source.attributes.normal,i).applyMatrix3(normalMatrix).normalize();
      positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);
      const light=shade*(.79+.21*Math.max(-.5,n.y));colors.push(light*.94,light,light*.83);uvs.push(0,0);
    }
    if(source!==g)source.dispose();
  }
  function finish(){const g=new T.BufferGeometry();for(const[name,values,size]of[['position',positions,3],['normal',normals,3],['color',colors,3],['uv',uvs,2]])g.setAttribute(name,new T.Float32BufferAttribute(values,size));g.computeBoundingBox();g.computeBoundingSphere();return g;}
  return {triangle,append,finish};
}

export function createVegetationGeometries(T){
  function crown(variant=0,fine=true){
    const rand=seeded(71819+variant*999),writer=geometryWriter(T),core=new T.IcosahedronGeometry(1,fine?1:0),dummy=new T.Object3D();
    const tiers=variant===1?[[5,-.48,.35],[8,-.05,.45],[6,.34,.3],[3,.65,.12]]:[[6,-.35,.47],[9,.02,.57],[7,.36,.39],[3,.6,.14]];
    let clump=0;
    for(const[count,y,radius]of tiers)for(let n=0;n<count;n++){
      const angle=n/count*Math.PI*2+y*3+rand()*.55,cx=Math.cos(angle)*radius,cz=Math.sin(angle)*radius,cy=y+(rand()-.5)*.14;
      const r=.21+rand()*.085,sx=variant===2?1.12:1,sy=variant===1?1.14:.92;
      dummy.position.set(cx*sx,cy*sy,cz);dummy.scale.set(r*sx,r*.86*sy,r*.92);dummy.rotation.set(rand(),rand()*6,rand());dummy.updateMatrix();
      if(!fine)writer.append(core,dummy.matrix,.76+rand()*.22);
      // Crossed, slightly bent sprays carry many small cut-out leaves. There is
      // no solid spherical core in the full model, including at the silhouette.
      if(fine)for(let spray=0;spray<9;spray++){
        const az=rand()*Math.PI*2,v=rand()*2-1,ring=Math.sqrt(1-v*v),reach=r*(.2+rand()*.8),size=.34+rand()*.26;
        const center=new T.Vector3((cx+Math.cos(az)*ring*reach)*sx,(cy+v*reach)*sy,cz+Math.sin(az)*ring*reach),rotation=new T.Euler(rand()*Math.PI,az,rand()*Math.PI),q=new T.Quaternion().setFromEuler(rotation);
        const points=[],light=.64+rand()*.35+Math.max(0,cy)*.1,color=[light*.94,light,light*.84];
        for(let gy=0;gy<3;gy++)for(let gx=0;gx<3;gx++){const px=(gx/2-.5)*size,py=(gy/2-.5)*size;points.push(new T.Vector3(px,py,(1-Math.abs(gx-1))*.07).applyQuaternion(q).add(center));}
        for(let gy=0;gy<2;gy++)for(let gx=0;gx<2;gx++){
          const a=gy*3+gx,b=a+1,c=a+4,d=a+3,u=gx/2,v=gy/2;
          writer.triangle(points[a],points[b],points[c],color,null,[[u,v],[u+.5,v],[u+.5,v+.5]]);
          writer.triangle(points[a],points[c],points[d],color,null,[[u,v],[u+.5,v+.5],[u,v+.5]]);
        }
      }
      clump++;
    }
    core.dispose();const g=writer.finish();g.userData={clumps:clump,leafSprays:fine?clump*9:0,paintedLeaves:fine?clump*9*108:0,variant};return g;
  }
  // The trunk includes exposed roots, a tapering leader and branching forks.
  const wood=geometryWriter(T),axis=new T.Vector3(0,1,0);
  function branch(a,b,r0,r1){const delta=new T.Vector3().subVectors(b,a),g=new T.CylinderGeometry(r1,r0,delta.length(),9,1,true),m=new T.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new T.Quaternion().setFromUnitVectors(axis,delta.normalize()),new T.Vector3(1,1,1));wood.append(g,m);g.dispose();}
  branch(new T.Vector3(0,-.5,0),new T.Vector3(.04,.48,.01),.15,.055);
  for(let i=0;i<7;i++){const a=i*2.399963,b=new T.Vector3(Math.cos(a)*(.48+i%2*.08),.2+i%3*.12,Math.sin(a)*.48);branch(new T.Vector3(0,-.08+i%3*.06,0),b,.065,.015);branch(b,b.clone().add(new T.Vector3(Math.cos(a+.5)*.2,.15,Math.sin(a+.5)*.2)),.018,.006);}
  for(let i=0;i<5;i++){const a=i*Math.PI*.4;branch(new T.Vector3(Math.cos(a)*.36,-.49,Math.sin(a)*.36),new T.Vector3(0,-.32,0),.025,.075);}
  const shrub=geometryWriter(T),shrubCore=new T.IcosahedronGeometry(1,1),dummy=new T.Object3D();
  for(let i=0;i<9;i++){const a=i*2.4;dummy.position.set(Math.cos(a)*.38,(i%3-1)*.13,Math.sin(a)*.32);dummy.scale.set(.48,.56,.45);dummy.rotation.set(i*.3,i,.2);dummy.updateMatrix();shrub.append(shrubCore,dummy.matrix,.72+i%4*.08);}shrubCore.dispose();
  const grass=geometryWriter(T),grassRand=seeded(4881);
  for(let i=0;i<28;i++){
    const a=grassRand()*Math.PI*2,r=Math.sqrt(grassRand())*.56,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.3+grassRand()*.7,w=.018+grassRand()*.015,bend=.1+grassRand()*.15;
    const across=new T.Vector3(Math.cos(a),0,Math.sin(a)),base=new T.Vector3(x,0,z),mid=base.clone().add(new T.Vector3(Math.sin(a)*bend*.35,h*.56,-Math.cos(a)*bend*.35)),tip=base.clone().add(new T.Vector3(Math.sin(a)*bend,h,-Math.cos(a)*bend));
    const l=base.clone().addScaledVector(across,w),r0=base.clone().addScaledVector(across,-w),ml=mid.clone().addScaledVector(across,w*.65),mr=mid.clone().addScaledVector(across,-w*.65),color=[.66+grassRand()*.19,.8+grassRand()*.2,.53+grassRand()*.14];
    grass.triangle(l,r0,mr,color);grass.triangle(l,mr,ml,color);grass.triangle(ml,mr,tip,color,[.92,1,.72]);
  }
  return {treeSoft:crown(0),treeRound:crown(2),treeColumn:crown(1),treeSoftLow:crown(0,false),treeRoundLow:crown(2,false),treeColumnLow:crown(1,false),trunk:wood.finish(),trunkLow:new T.CylinderGeometry(.055,.15,1,7),tree:shrub.finish(),treeLow:new T.IcosahedronGeometry(1,1),grass:grass.finish()};
}

// Add actual reveals and sills to the existing atlas geometry. These are shared
// per building family, and remain part of the selectable building instance.
export function reliefFacade(T,base,{dorm=false,stone=false}={}){
  const g=base.index?base.toNonIndexed():base.clone(),positions=Array.from(g.attributes.position.array),uvs=Array.from(g.attributes.uv.array),box=new T.BoxGeometry(1,1,1).toNonIndexed();
  function part(x,y,z,w,h,d,dim=false){for(let i=0;i<36;i++){if(Math.abs(x)-w/2<=.502&&((x>0&&i>=6&&i<12)||(x<0&&i<6)))continue;positions.push(x+box.attributes.position.getX(i)*w,y+box.attributes.position.getY(i)*h,z+box.attributes.position.getZ(i)*d);uvs.push(dim?.036:.002,dim?.946:.992);}}
  const floors=dorm?6:stone?4:5,cols=dorm?9:10,cell=1/cols;
  for(const side of [-1,1])for(let row=0;row<floors;row++){
    const top=.5-(row+.17)/floors,bottom=.5-(row+.745)/floors;
    for(let col=0;col<cols;col++){
      const center=-.5+(col+.52)*cell,width=cell*(dorm?.73:.78),x=side*.51;
      part(x,top+.003,center,.022,.007,width+.009);
      part(side*(dorm?.559:.522),bottom-.005,center,dorm?.12:.053,.011,width+.016);
      for(const end of [-1,1])part(x,(top+bottom)/2,center+end*width*.5,.026,top-bottom,.005);
      if(dorm)part(side*.568,bottom+.037,center,.012,.008,width+.008);
    }
    // Continuous balcony handrail with individual vertical supports.
    if(dorm){const y=-.5+(floors-row-1+.24)/floors;part(side*.574,y+.05,0,.012,.008,.98);for(let col=0;col<=cols;col++)part(side*.574,y+.022,-.48+col*.96/cols,.011,.055,.006);}
  }
  box.dispose();g.dispose();const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));result.computeVertexNormals();result.computeBoundingBox();return result;
}

export function drawDetailedGround(c,w,h){
  const rand=seeded(20261022);c.fillStyle='#687f50';c.fillRect(0,0,w,h);
  for(let i=0;i<90;i++){const x=rand()*w,y=rand()*h,r=w*(.025+rand()*.11),g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%4?'#294e3b20':'#a9b07419');g.addColorStop(1,'#687f5000');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  // Quiet mowing bands and short, low-contrast strokes keep the overview soft.
  c.save();c.translate(w/2,h/2);c.rotate(-.28);for(let y=-h;y<h;y+=h/24){c.fillStyle=Math.round(y/(h/24))%2?'#bbc69608':'#294b3207';c.fillRect(-w,y,w*2,h/24);}c.restore();
  for(let i=0;i<80000;i++){
    const x=rand()*w,y=rand()*h,length=.5+rand()*1.6;c.strokeStyle=['#a0b2802b','#304e3623','#849c6530','#65864d38'][i%4];c.lineWidth=.3+rand()*.35;c.beginPath();c.moveTo(x,y);c.lineTo(x+(rand()-.5)*.9,y-length);c.stroke();
  }
  for(let i=0;i<3500;i++){c.fillStyle=i%3?'#b0bf8b22':'#304e3720';c.fillRect(rand()*w,rand()*h,.4+rand()*.5,.3+rand()*.4);}
}

export function drawGrassDetail(c,w,h){
  const rand=seeded(19283);c.fillStyle='#808080';c.fillRect(0,0,w,h);
  for(let i=0;i<15000;i++){
    const x=rand()*w,y=rand()*h,length=2+rand()*6,bend=(rand()-.5)*3;
    c.strokeStyle=i%2?'#c9c9c952':'#34343447';c.lineWidth=.45+rand()*.4;
    for(const dx of x<4?[0,w]:x>w-4?[0,-w]:[0])for(const dy of y<9?[0,h]:[0]){c.beginPath();c.moveTo(x+dx,y+dy);c.quadraticCurveTo(x+dx+bend*.25,y+dy-length*.55,x+dx+bend,y+dy-length);c.stroke();}
  }
}

export function createGrassMaterial(T,map=null,detail=null){
  const material=new T.MeshLambertMaterial({color:0xffffff,map}),strength={value:detail?1:0};material.userData.detailStrength=strength;
  material.onBeforeCompile=shader=>{
    shader.uniforms.campusGrassDetail={value:detail};shader.uniforms.campusGrassStrength=strength;
    shader.vertexShader='varying float vCampusGrassDepth;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvCampusGrassDepth = -mvPosition.z;');
    shader.fragmentShader='uniform sampler2D campusGrassDetail;\nuniform float campusGrassStrength;\nvarying float vCampusGrassDepth;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
        float grassNear = 1.0 - smoothstep(100.0, 300.0, vCampusGrassDepth);
        if (campusGrassStrength > 0.5 && grassNear > 0.005) {
          float blade = texture2D(campusGrassDetail, vUv * 72.0).r;
          diffuseColor.rgb *= 1.0 + (blade - 0.5) * 0.55 * grassNear;
        }
      #endif`);
  };
  material.customProgramCacheKey=()=> 'campus-matte-grass-detail-v2';return material;
}

export function drawFoliageSprite(c,w,h){
  const rand=seeded(19831);c.clearRect(0,0,w,h);
  function leaf(x,y,length,angle){c.save();c.translate(x,y);c.rotate(angle);const g=c.createLinearGradient(-length*.27,0,length*.27,0);g.addColorStop(0,'#a6b99c');g.addColorStop(.46,'#e3e6cd');g.addColorStop(.54,'#f0efda');g.addColorStop(1,'#c0cfad');c.fillStyle=g;c.beginPath();c.moveTo(0,-length*.55);c.bezierCurveTo(length*.36,-length*.3,length*.34,length*.15,0,length*.5);c.bezierCurveTo(-length*.33,length*.13,-length*.29,-length*.29,0,-length*.55);c.fill();c.strokeStyle='#f0f1d36b';c.lineWidth=.65;c.beginPath();c.moveTo(0,-length*.47);c.lineTo(0,length*.4);c.stroke();c.restore();}
  // A loose fork of small broad leaves, leaving irregular holes at all edges.
  for(let arm=0;arm<6;arm++){
    const endX=w*(.12+arm%3*.35)+(rand()-.5)*w*.11,endY=h*(.12+Math.floor(arm/3)*.24),startX=w*.5,startY=h*.9;
    c.strokeStyle='#b6c4a4';c.lineWidth=1.7;c.beginPath();c.moveTo(startX,startY);c.quadraticCurveTo((startX+endX)/2+w*.04,(startY+endY)/2,endX,endY);c.stroke();
    for(let pair=0;pair<9;pair++){
      const t=.12+pair*.095,x=startX+(endX-startX)*t,y=startY+(endY-startY)*t;
      for(const side of [-1,1]){const length=h*(.065+rand()*.035),a=Math.atan2(endX-startX,startY-endY)+side*(.5+rand()*.55);leaf(x+Math.sin(a)*length*.35,y-Math.cos(a)*length*.35,length,a);}
    }
  }
}

export function drawFacadeAtlas(c,w,h,{dorm=false,stone=false}={}){
  const rand=seeded(dorm?781:stone?1283:619),front=w*.75,rows=dorm?6:stone?4:5,cols=dorm?9:10,cw=front/cols,ch=h/rows;
  c.fillStyle=stone?'#e4e5dc':dorm?'#e5e8df':'#e9ebe3';c.fillRect(0,0,w,h);
  // Fine mineral grain and joints stay much quieter than the windows.
  for(let n=0;n<10000;n++){c.fillStyle=n%2?'#ffffff12':'#5d63550b';c.fillRect(rand()*w,rand()*h,.5+rand(),.5);}
  if(stone)for(let y=0;y<h;y+=ch/3)for(let x=0;x<w;x+=48){c.strokeStyle='#8b908718';c.lineWidth=.6;c.strokeRect(x+(Math.round(y/(ch/3))%2)*24,y,48,ch/3);}
  const palette=['#9aa28d','#abb09c','#b9b8a5','#969f92','#c4beaa'];
  function room(x,top,width,height,index){
    c.fillStyle='#606957';c.fillRect(x-2,top-2,width+4,height+4);
    const glass=c.createLinearGradient(x,top,x+width*.4,top+height);glass.addColorStop(0,'#d0cfbc');glass.addColorStop(.33,palette[index%palette.length]);glass.addColorStop(1,'#737e6b');c.fillStyle=glass;c.fillRect(x,top,width,height);
    c.save();c.beginPath();c.rect(x+1,top+1,width-2,height-2);c.clip();
    c.fillStyle='#354a3c24';c.fillRect(x,top+height*.64,width,height*.36);
    c.fillStyle='#d9c8a569';c.fillRect(x+4,top+height*.71,width-8,2);
    c.fillStyle='#4e5c4438';for(let item=0;item<3;item++)c.fillRect(x+7+item*width*.24,top+height*.79,3+rand()*5,height*.12);
    if(index%4===0){c.fillStyle='#e2d5b8be';c.fillRect(x+2,top+1,width*.27,height-2);for(let pleat=0;pleat<4;pleat++){c.fillStyle='#9b987d25';c.fillRect(x+4+pleat*width*.055,top+2,1,height-4);}}
    if(index%7===2){for(let slat=0;slat<6;slat++){c.fillStyle='#e8e3cb88';c.fillRect(x,top+2+slat*3.5,width,1.2);}}
    c.fillStyle='#f4efdb40';c.fillRect(x+2,top+2,width-4,height*.13);
    c.fillStyle='#36453845';c.fillRect(x,top,width,3);c.fillRect(x,top,2,height);
    c.restore();
    c.fillStyle='#e8e5d3';c.fillRect(x+width*.5-1,top,1.8,height);c.fillStyle='#48554333';c.fillRect(x+width*.5+.8,top,1,height);
    c.fillStyle='#f3f1e5';c.fillRect(x-3,top+height+2,width+6,2.4);c.fillStyle='#5c6b5338';c.fillRect(x-4,top+height+4.4,width+8,2.2);
  }
  for(let row=0;row<rows;row++){
    for(let col=0;col<cols;col++){
      const x=(col+.13)*cw,y=(row+.17)*ch,width=cw*(dorm?.73:.78),height=ch*.575;room(x,y,width,height,col+row*7);
      if(dorm){c.fillStyle='#e4e5da';c.fillRect(col*cw+3,y+height*.79,cw-6,7);c.fillStyle='#82907b';c.fillRect(col*cw+3,y+height*.79,cw-6,1);if((col+row)%6===0){c.fillStyle='#9d8e73';c.fillRect(x+width-14,y+height-8,12,5);c.fillStyle='#687e53';for(let leaf=0;leaf<5;leaf++){c.beginPath();c.ellipse(x+width-13+leaf*2.5,y+height-10-(leaf%2)*2,2.5,4,.4,0,Math.PI*2);c.fill();}}}
    }
    c.fillStyle='#7f8e781c';c.fillRect(0,(row+1)*ch-6,front,2);c.fillStyle='#f4f3e8';c.fillRect(0,(row+1)*ch-4,front,3);
    for(const dx of [.13,.76])room(front+(w-front)*dx,(row+.2)*ch,(w-front)*.12,ch*.52,row+Math.round(dx*10));
  }
  c.fillStyle='#b7bfae';c.fillRect(front+(w-front)*.4,0,(w-front)*.19,h);for(let y=4;y<h;y+=ch/2){c.fillStyle='#dde1d4';c.fillRect(front+(w-front)*.41,y,(w-front)*.17,2);}
  const plinth=c.createLinearGradient(0,h-12,0,h);plinth.addColorStop(0,'#a4ae9820');plinth.addColorStop(1,'#7c8c7055');c.fillStyle=plinth;c.fillRect(0,h-12,w,12);
}
