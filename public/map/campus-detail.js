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
  /* 10-29 草地重建：
     原来"草太平"的根因不是贴图不够细，而是**缺少大尺度明暗**——
     贴图在 4m/像素 的取景下被 mipmap 抹成一整片同色。
     这里用世界坐标的程序化噪声（三个尺度）直接调制颜色，
     与距离无关：22m 的色块、6m 的斑、0.9m 的颗粒，远看近看都有层次。 */
  const material=new T.MeshLambertMaterial({color:0xffffff,map});
  const strength={value:detail?1:0};material.userData.detailStrength=strength;
  material.onBeforeCompile=shader=>{
    shader.uniforms.campusGrassDetail={value:detail};
    shader.uniforms.campusGrassStrength=strength;
    shader.vertexShader=[
      'varying float vCampusGrassDepth;',
      'varying vec2 vCampusXZ;',
      shader.vertexShader
    ].join('\n');
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n'+
      'vCampusGrassDepth=-mvPosition.z;\n'+
      'vCampusXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
    shader.fragmentShader=[
      'uniform sampler2D campusGrassDetail;',
      'uniform float campusGrassStrength;',
      'varying float vCampusGrassDepth;',
      'varying vec2 vCampusXZ;',
      'float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
      '  return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}',
      shader.fragmentShader
    ].join('\n');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',[
      '#include <map_fragment>',
      '#ifdef USE_MAP',
      '  float macroA=vn(vCampusXZ*0.042);',
      '  float macroB=vn(vCampusXZ*0.155);',
      '  float micro=vn(vCampusXZ*1.15);',
      '  float zoneA=vn(vCampusXZ*0.0085);',
      '  float zoneB=vn(vCampusXZ*0.0210);',
      '  float zz=zoneA*0.7+zoneB*0.3;',
      '  vec3 cDeep=vec3(0.78,0.95,0.84);',
      '  vec3 cLush=vec3(0.96,1.05,0.92);',
      '  vec3 cDry =vec3(1.16,1.09,0.80);',
      '  vec3 tint=mix(cDeep,cLush,smoothstep(0.24,0.52,zz));',
      '  tint=mix(tint,cDry,smoothstep(0.60,0.84,zz));',
      '  diffuseColor.rgb*=tint;',
      '  vec3 warm=vec3(1.08,1.02,0.86), cool=vec3(0.90,1.03,0.98);',
      '  diffuseColor.rgb*=mix(cool,warm,macroA);',
      '  diffuseColor.rgb*=0.80+0.34*macroA;',
      '  diffuseColor.rgb*=0.93+0.13*macroB;',
      '  diffuseColor.rgb*=0.965+0.07*micro;',
      '  float near=1.0-smoothstep(90.0,280.0,vCampusGrassDepth);',
      '  if(campusGrassStrength>0.5&&near>0.005){',
      '    float blade=texture2D(campusGrassDetail,vUv*72.0).r;',
      '    diffuseColor.rgb*=1.0+(blade-0.5)*0.55*near;',
      '  }',
      '#endif'
    ].join('\n'));
  };
  material.customProgramCacheKey=()=> 'campus-matte-grass-v3';
  return material;
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
  /* 10-29 墙面重做：
     窗已经全部改成几何构件（独立的洞 + 框 + 台），
     所以贴图**不再画窗**，只负责"墙是什么材料"：
     抹灰/涂料的颗粒、分格缝、雨痕、局部的修补色差。
     以前画窗 + 几何窗两层叠在一起，是"墙很丑"的主因之一。 */
  const rand=seeded(dorm?781:stone?1283:619);
  const base=stone?'#e3e0d4':dorm?'#e9ebe1':'#ecedE4';
  c.fillStyle=base;c.fillRect(0,0,w,h);

  /* 细颗粒（石灰/涂料的砂感） */
  for(let n=0;n<24000;n++){
    c.fillStyle=n%2?'#ffffff14':'#565f500f';
    c.fillRect(rand()*w,rand()*h,.8+rand()*1.6,.8);
  }
  /* 中尺度色差：修补过的墙面从来不是一个颜色 */
  for(let i=0;i<26;i++){
    const x=rand()*w,y=rand()*h,r=w*(.03+rand()*.09);
    const g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,i%3?'#cdb98c14':'#8a938211');
    g.addColorStop(1,'#00000000');
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
  /* 分格缝：竖向每 ~2.4m 一道，横向每层一道 */
  const bays=dorm?7:8;
  for(let i=0;i<=bays;i++){
    const x=i*w/bays;
    c.fillStyle='#6f76631f';c.fillRect(x-.9,0,1.8,h);
    c.fillStyle='#ffffff10';c.fillRect(x+.9,0,.9,h);
  }
  c.fillStyle='#6f766326';c.fillRect(0,0,w,2);
  c.fillStyle='#ffffff14';c.fillRect(0,2,w,1.4);

  /* 雨痕：从分缝处往下拖，长短不一 */
  for(let i=0;i<14;i++){
    const x=rand()*w,len=h*(.18+rand()*.5),y=rand()*h*.5;
    const g=c.createLinearGradient(0,y,0,y+len);
    g.addColorStop(0,'#4a53401c');g.addColorStop(1,'#4a534000');
    c.fillStyle=g;c.fillRect(x,y,1.2+rand()*2.2,len);
  }
  /* 石材：加砌缝 */
  if(stone){
    for(let y=0;y<h;y+=h/6)for(let x=0;x<w;x+=w/bays){
      c.strokeStyle='#8b908720';c.lineWidth=1.1;
      c.strokeRect(x+(Math.round(y/(h/6))%2)*(w/bays/2),y,w/bays,h/6);
    }
  }
  /* 底部积灰：越靠近层底越暗一点（每题层重复一次，读作楼层交接） */
  const gb=c.createLinearGradient(0,h*.82,0,h);
  gb.addColorStop(0,'#5a63500a');gb.addColorStop(1,'#5a635022');
  c.fillStyle=gb;c.fillRect(0,h*.82,w,h*.18);
}
