import {clamp} from './campus-model.js';
import {WALK,walkIntent} from './campus-walk.js';

export const ENTERABLE={lib:{kind:'library',label:'图书馆阅览室'},'teach-1':{kind:'classroom',label:'教学楼自习室'},canteen:{kind:'canteen',label:'食堂休息区'}};
export const CAR={maxSpeed:12,reverseSpeed:4,acceleration:7,drag:4,turnRate:1.35};
export function roofPracticeStart(world,targets){
  const shops=new Set(targets.filter(t=>t.type==='shop').map(t=>t.key));
  const roofs=(world.roofs||[]).filter(r=>r.top>=4&&r.top<=8.2&&targets.some(t=>t.key===r.key&&['shop','pavilion'].includes(t.type))).sort((a,b)=>Number(shops.has(b.key))-Number(shops.has(a.key))||b.w*b.d-a.w*a.d);
  for(const roof of roofs)for(const [localX,localZ]of [[0,roof.d/2+5.3],[0,-roof.d/2-5.3],[roof.w/2+5.3,0],[-roof.w/2-5.3,0]]){
    const x=roof.x+Math.cos(roof.rotation)*localX+Math.sin(roof.rotation)*localZ,z=roof.z-Math.sin(roof.rotation)*localX+Math.cos(roof.rotation)*localZ;
    if(world.canStand(x,z))return {x,z,y:world.floorAt(x,z)+WALK.eyeHeight,yaw:Math.atan2(roof.x-x,z-roof.z),pitch:.08,settling:false,roof};
  }
  return null;
}
export function vehicleCameraPose(car,look={yaw:0,pitch:0}){
  const yaw=car.yaw+(look.yaw||0),pitch=clamp(look.pitch||0,-.65,.65),c=Math.cos(pitch);
  const position={x:car.x-Math.sin(car.yaw)*.28,y:car.y+1.76,z:car.z+Math.cos(car.yaw)*.28};
  return {position,target:{x:position.x+Math.sin(yaw)*c,y:position.y+Math.sin(pitch),z:position.z-Math.cos(yaw)*c}};
}
export function canWalkPastVehicle(car,x,z){
  const dx=x-car.x,dz=z-car.z,side=dx*Math.cos(car.yaw)+dz*Math.sin(car.yaw),front=dx*Math.sin(car.yaw)-dz*Math.cos(car.yaw);
  return Math.hypot(Math.max(0,Math.abs(side)-.9),Math.max(0,Math.abs(front)-1.55))>=WALK.radius;
}
// Test the whole footprint, not just a point at the centre of the vehicle.
export function canPark(world,x,z,yaw){
  const sin=Math.sin(yaw),cos=Math.cos(yaw);
  return [[0,0],[-.72,-1.25],[.72,-1.25],[-.72,1.25],[.72,1.25],[0,-1.25],[0,1.25]].every(([side,front])=>world.canStand(x+cos*side+sin*front,z+sin*side-cos*front));
}
export function vehicleSpawn(world,focus){
  const candidates=[];
  for(const road of world.roads){
    const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],yaw=Math.atan2(dx,-dz);
    for(const t of [.5,.25,.75,.1,.9])candidates.push({x:road.a[0]+dx*t,z:road.a[1]+dz*t,yaw});
  }
  candidates.sort((a,b)=>Math.hypot(a.x-focus.x,a.z-focus.z)-Math.hypot(b.x-focus.x,b.z-focus.z));
  const p=candidates.find(p=>canPark(world,p.x,p.z,p.yaw));
  return p?{...p,y:world.floorAt(p.x,p.z),speed:0,wheelAngle:0}:null;
}
export function vehicleExit(world,car){
  for(const [side,front]of [[2.3,0],[-2.3,0],[0,-3],[0,3],[3.4,0],[-3.4,0]]){
    const x=car.x+Math.cos(car.yaw)*side+Math.sin(car.yaw)*front,z=car.z+Math.sin(car.yaw)*side-Math.cos(car.yaw)*front;
    if(world.canStand(x,z))return {x,z,y:world.floorAt(x,z)+WALK.eyeHeight,yaw:car.yaw,pitch:0,settling:false};
  }
  return null;
}
export function advanceVehicle(car,world,keys,seconds){
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.1),input=walkIntent(keys);
  if(input.forward)car.speed=clamp(car.speed+input.forward*CAR.acceleration*dt,-CAR.reverseSpeed,CAR.maxSpeed);
  else car.speed=Math.sign(car.speed)*Math.max(0,Math.abs(car.speed)-CAR.drag*dt);
  if(Math.abs(car.speed)<.025)car.speed=0;
  const distance=car.speed*dt,steps=Math.max(1,Math.ceil(Math.abs(distance)/.16));
  let moved=0;
  for(let i=0;i<steps;i++){
    const yaw=car.yaw+input.right*CAR.turnRate*dt/steps*clamp(car.speed/3,-1,1);
    const x=car.x+Math.sin(yaw)*distance/steps,z=car.z-Math.cos(yaw)*distance/steps;
    if(!canPark(world,x,z,yaw)){car.speed=0;break;}
    car.x=x;car.z=z;car.yaw=yaw;moved+=distance/steps;
  }
  car.y=world.floorAt(car.x,car.z);car.wheelAngle+=moved/.33;
  return Math.abs(moved)>1e-7;
}

function disposeTree(root){
  const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear();
}
// One shared box and one batch per colour keep furniture and the cart inexpensive.
function boxBuilder(T,root){
  const batches=new Map(),solids=[],geometry=new T.BoxGeometry(1,1,1);
  function box(color,x,y,z,w,h,d,{solid=false}={}){
    if(!batches.has(color))batches.set(color,[]);batches.get(color).push({x,y,z,w,h,d});
    if(solid)solids.push({x,z,w,d});
  }
  function finish(options={}){const dummy=new T.Object3D();for(const[color,parts]of batches){const mesh=new T.InstancedMesh(geometry,new T.MeshLambertMaterial({color,...options[color]}),parts.length);parts.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});root.add(mesh);}return solids;}
  return {box,finish};
}
export function createCampusCar(T,car){
  const root=new T.Group();root.name='campus-electric-cart';
  const {box,finish}=boxBuilder(T,root);
  box(0x5f9281,0,.7,0,1.7,.5,2.95);box(0xf5eed7,0,.98,-.75,1.65,.22,1.35);
  box(0xf5eed7,0,2,0,1.9,.16,2.5);
  for(const x of [-.73,.73])for(const z of [-.95,.95])box(0xf5eed7,x,1.51,z,.075,.95,.075);
  box(0x7398a0,0,1.55,-.97,1.38,.62,.055);box(0x456352,0,.85,.35,1.3,.15,.6);box(0x456352,0,1.12,.61,1.3,.6,.12);
  for(const x of [-.55,.55]){box(0xffebba,x,.82,-1.49,.32,.18,.04);box(0xb56750,x,.81,1.49,.25,.14,.04);}
  box(0x354b46,0,.57,-1.52,1.6,.12,.12);box(0x354b46,0,.57,1.52,1.6,.12,.12);
  finish({[0x7398a0]:{transparent:true,opacity:.22,depthWrite:false}});
  const wheelGeometry=new T.CylinderGeometry(.33,.33,.19,12);wheelGeometry.rotateZ(Math.PI/2);
  const wheels=new T.InstancedMesh(wheelGeometry,new T.MeshLambertMaterial({color:0x34443f}),4);root.add(wheels);
  const steering=new T.Mesh(new T.TorusGeometry(.19,.025,5,16),wheels.material);steering.position.set(0,1.28,-.4);steering.rotation.x=.95;root.add(steering);
  const dummy=new T.Object3D();
  function update(){root.position.set(car.x,car.y,car.z);root.rotation.y=-car.yaw;let i=0;for(const x of [-.86,.86])for(const z of [-.95,.95]){dummy.position.set(x,.36,z);dummy.rotation.set(car.wheelAngle,0,0);dummy.updateMatrix();wheels.setMatrixAt(i++,dummy.matrix);}wheels.instanceMatrix.needsUpdate=true;}
  update();return {root,update,dispose:()=>disposeTree(root)};
}

export function createCampusInterior(T,kind){
  /* ===== 10-28 室内改造 =====
     配色：只保留四类材质 —— 暖白墙 / 橡木 / 亚麻灰绿 / 深墨绿金属件。
           原来的 0xc9ba9b 地板、0xece9db 墙、0x718774 椅子、0xd5ac78 桌子各说各话，
           现在全部收进同一套色板，家具骨架统一橡木、坐垫统一亚麻、腿统一墨绿金属。
     布局：入口玄关(南) → 中央活动区(地毯) → 靠窗安静带(东/西) → 主墙功能带(北)。
           原来的家具是均匀撒在房间里，没有分区；现在中央留空、功能靠墙，动线成"回"字。
     灯光：半球环境 + 一盏主光 + 两盏窗侧暖补光，天花板做三条灯槽（发光条+深色框）。
     细节：踢脚线、门套、窗台、绿植、地毯压边。 */
  const C={oak:0xb98f60,oakD:0x8f6b45,wall:0xf1eee4,ceil:0xf8f5ee,trim:0x49534c,
           linen:0xa9b49e,linenL:0xc6cdb9,metal:0x3e4643,glass:0xd7e6e2,plant:0x4f7a55,
           rug:0x93a08b,stone:0xd6d1c2};
  const scene=new T.Scene();scene.background=new T.Color(0xd9e6e2);
  scene.add(new T.HemisphereLight(0xfff6e2,0xa3aa9e,1.0));
  /* 天花原来是暗橄榄色 —— 半球光的地面色压在上面，整个顶棚发黑。
     加一盏极弱的环境光把它托起来，只提天花不改地面。 */
  scene.add(new T.AmbientLight(0xffffff,.28));
  const key=new T.DirectionalLight(0xfff0d2,.5);key.position.set(-3,7,4);scene.add(key);
  for(const sx of [-1,1]){const w=new T.PointLight(0xffd9a6,.45,15,2);w.position.set(sx*5.4,2.7,0);scene.add(w);}
  const root=new T.Group();root.name='campus-interior-'+kind;scene.add(root);
  const {box,finish}=boxBuilder(T,root);
  const H=4.1;

  /* 地面：橡木长条（每 1 米一条，深浅交替），中央地毯 */
  for(let i=0;i<18;i++)box(i%2?C.oak:0xa8834f,0,-.15,-8.5+i,14,.3,.98);
  box(0x7f8c7c,0,.015,1.2,6.6,.03,5.4);
  for(const dz of [-2.7,2.7])box(C.trim,0,.03,1.2+dz,6.7,.015,.07);

  /* 天花 + 三条灯槽（深色框 + 暖白发光条） */
  box(C.ceil,0,H,0,14,.2,18);
  /* 10-28：灯槽 + 灯泡发光。
     灯管本身只是一个亮色块，看起来"亮"但不"发光"；真正让人觉得是灯的是
     ① 一枚加法混合的光晕 Sprite（拉长成灯管的形状）② 一盏点光把天花、墙、地面照亮。 */
  const glowTex=(()=>{const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d'),grd=g.createRadialGradient(64,64,0,64,64,64);grd.addColorStop(0,'rgba(255,242,210,.98)');grd.addColorStop(.32,'rgba(255,214,150,.42)');grd.addColorStop(1,'rgba(255,198,116,0)');g.fillStyle=grd;g.fillRect(0,0,128,128);const t=new T.CanvasTexture(cv);t.minFilter=T.LinearFilter;return t;})();
  for(const z of [-6.2,-1.2,3.8]){
    box(C.trim,0,H-.13,z,4.4,.1,.56);
    box(0xfff6de,0,H-.19,z,3.6,.06,.34);
    const halo=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:0xffe6bb,transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false}));
    halo.position.set(0,H-.3,z);halo.scale.set(4.8,1.6,1);root.add(halo);
    const lamp=new T.PointLight(0xffd9a0,.9,15,2);lamp.position.set(0,H-.85,z);root.add(lamp);
  }

  /* 墙体：北墙/东西墙整面，南墙留门洞 */
  box(C.wall,0,H/2,-9,14,H,.2);
  box(C.wall,-7,H/2,0,.2,H,18);box(C.wall,7,H/2,0,.2,H,18);
  for(const x of [-4.4,4.4])box(C.wall,x,H/2,9,5.2,H,.2);
  box(C.wall,0,3.66,9,3.6,.68,.2);
  /* 踢脚线：贴墙一圈，深墨绿，给墙面收边 */
  box(C.trim,0,.07,-8.86,13.6,.14,.1);
  for(const sx of [-1,1])box(C.trim,sx*6.86,.07,0,.1,.14,17.6);

  /* 窗：不能真的在墙上开洞，所以用"亮面 + 细框"表现。
     关键是亮面要比墙亮、框要细，否则整扇窗会读成一块深色板。 */
  for(const sx of [-1,1])for(const z of [-6,0,6]){
    const x=sx*6.87;
    box(0xe6f0ea,x,2.35,z,.05,1.72,2.7);
    box(C.trim,x,3.23,z,.08,.07,2.86);
    box(C.trim,x,1.47,z,.08,.07,2.86);
    for(const dz of [-1.39,1.39])box(C.trim,x,2.35,z+dz,.08,1.83,.07);
    box(C.trim,x,2.35,z,.06,1.78,.05);
    box(C.stone,x,1.36,z,.3,.08,3.0);
  }

  /* 门：门套 + 双开玻璃门 + 拉手 */
  box(C.trim,0,2.1,8.9,3.4,.16,.14);
  for(const sx of [-1,1]){box(C.trim,sx*.86,2.05,8.88,.1,4.0,.08);box(C.glass,sx*1.72,2.05,8.86,.06,3.7,1.58);}
  for(const sx of [-1,1])box(C.metal,sx*.2,1.9,8.74,.06,.5,.06);

  /* --- 统一家具族：骨架橡木、坐垫亚麻、腿墨绿金属 --- */
  function table(x,z,w=2.6,d=1.2){
    box(C.oak,x,.96,z,w,.1,d,{solid:true});
    for(const dx of [-w/2+.16,w/2-.16])for(const dz of [-d/2+.14,d/2-.14])box(C.metal,x+dx,.47,z+dz,.07,.94,.07);
  }
  function chair(x,z,flip=1){
    box(C.linen,x,.52,z,.62,.1,.62,{solid:true});
    box(C.linen,x,.86,z+flip*.27,.62,.52,.08);
    for(const dx of [-.24,.24])for(const dz of [-.24,.24])box(C.metal,x+dx,.26,z+dz,.05,.52,.05);
  }
  function shelf(x,z,w=2.4,hgt=2.5){
    box(C.oakD,x,hgt/2,z,w,hgt,.42,{solid:true});
    for(const y of [.55,1.1,1.65,2.2]){box(C.oak,x,y,z,w+.1,.08,.5);for(let i=0;i<7;i++)box([C.linen,C.oak,C.trim,C.plant][i%4],x-w/2+.28+i*.3,y+.26,z+.02,.2,.34,.28);}
  }
  function sofa(x,z,w=2.2,flip=1){
    box(C.linen,x,.46,z,w,.22,1.0,{solid:true});
    box(C.linen,x,.84,z-flip*.42,w,.62,.22);
    for(const dx of [-w/2+.12,w/2-.12])box(C.linen,x+dx,.62,z,.2,.4,1.0);
  }
  function plant(x,z,s=1){
    box(C.stone,x,.28*s,z,.5*s,.56*s,.5*s,{solid:true});
    box(0x6b5b45,x,.86*s,z,.16*s,.9*s,.16*s);
    box(C.plant,x,1.28*s,z,.62*s,.55*s,.62*s);box(C.plant,x,1.62*s,z,.42*s,.34*s,.42*s);
  }

  if(kind==='library'){
    /* 北墙书架带 + 中央长桌 + 两侧靠窗阅读位 */
    for(const x of [-4.6,-1.6,1.6,4.6])shelf(x,-8.3,2.5,2.4);
    for(const z of [-3.4,1.4]){table(0,z,3.6,1.25);chair(-1.1,z+1.05);chair(1.1,z+1.05);chair(-1.1,z-1.05,-1);chair(1.1,z-1.05,-1);}
    for(const sx of [-1,1])for(const z of [-5.2,-1.4,2.6])chair(sx*5.5,z);
    box(C.oakD,4.9,.55,-6.6,2.2,1.1,.8,{solid:true});plant(-5.6,-7.4);plant(5.6,6.6,.9);
  }else if(kind==='classroom'){
    /* 北墙讲台 + 中央 3×2 课桌阵 + 后墙置物 */
    box(C.trim,0,1.9,-8.82,8.2,1.5,.08);box(C.oakD,0,1.06,-6.9,3.2,.12,1.1,{solid:true});
    for(const x of [-3.2,0,3.2])for(const z of [-4.2,-.4,3.4]){
      table(x,z,1.9,1.0);chair(x,z+1.0);chair(x,z-1.0,-1);
    }
    for(const x of [-4.2,4.2])shelf(x,-8.2,2.0,2.2);
    plant(-5.8,7.2);plant(5.8,7.2,.9);
  }else{
    /* 食堂休息区：两组沙发相对 + 中间茶几 + 靠墙边柜 + 角落绿植。
       原来那组沙发摆在入口正前方，一进门就被一块浅色大板挡住视线。 */
    sofa(-3.0,-2.6,3.0,1);sofa(3.0,-2.6,3.0,1);
    table(0,-.2,2.0,1.0);
    for(const z of [1.6,4.4]){chair(-2.4,z);chair(2.4,z);}
    box(C.oakD,0,.6,-8.4,3.4,1.2,.7,{solid:true});
    box(C.oak,0,1.24,-8.4,3.5,.08,.8);
    plant(-5.8,-7.4);plant(5.8,-7.4,.9);plant(-5.8,7.2,.85);
  }

  const solids=finish({[C.glass]:{transparent:true,opacity:.34,depthWrite:false}});
  const world={
    canStand(x,z){return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<6.4&&Math.abs(z)<8.4&&!solids.some(o=>Math.hypot(Math.max(0,Math.abs(x-o.x)-o.w/2),Math.max(0,Math.abs(z-o.z)-o.d/2))<WALK.radius);},
    floorAt:()=>0,ceilingAt:()=>H-.3,
  };
  return {scene,world,spawn:{x:0,z:6.8,y:WALK.eyeHeight,yaw:0,pitch:0,settling:false},nearExit:p=>p.z>6.4&&Math.abs(p.x)<2,dispose(){disposeTree(root);scene.clear();}};
}
