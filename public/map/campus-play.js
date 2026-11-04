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
  const scene=new T.Scene();scene.background=new T.Color(0xd8e7e3);
  scene.add(new T.HemisphereLight(0xfff7dc,0x879e89,1.1));const sun=new T.DirectionalLight(0xffe5ad,.65);sun.position.set(-4,8,3);scene.add(sun);
  const root=new T.Group();root.name='simple-campus-interior-'+kind;scene.add(root);
  const {box,finish}=boxBuilder(T,root),floor=0;
  box(0xc9ba9b,0,-.15,0,14,.3,18);
  box(0xece9db,0,4.1,0,14,.2,18);
  box(0xece9db,-7,2,0,.2,4,18);box(0xece9db,7,2,0,.2,4,18);box(0xece9db,0,2,-9,14,4,.2);
  // A visible, split doorway at the south end. The exit can always be used by button.
  for(const x of [-4.4,4.4])box(0xece9db,x,2,9,5.2,4,.2);
  box(0xece9db,0,3.65,9,3.6,.7,.2);box(0x5c8874,0,3.12,8.86,2.4,.32,.08);
  for(const x of [-6.86,6.86])for(const z of [-5,0,5]){box(0x9fc2c4,x,2.2,z,.04,1.6,2.7);box(0xeee9cf,x,2.2,z,.09,.06,2.8);box(0xeee9cf,x,2.2,z,.09,1.65,.06);}
  for(const z of [-6,-1,4])box(0xfff2d4,0,3.85,z,3.2,.08,.5);
  function seat(x,z){box(0x718774,x,.52,z,.8,.13,.8,{solid:true});box(0x718774,x,.93,z+.35,.8,.8,.1);for(const dx of [-.3,.3])box(0x596956,x+dx,.25,z,.08,.5,.55);}
  function table(x,z,w=2.8){box(0xd5ac78,x,.98,z,w,.15,1.25,{solid:true});for(const dx of [-w/2+.2,w/2-.2])box(0x6d7767,x+dx,.45,z,.12,.9,1);}
  if(kind==='library'){
    for(const x of [-5,5])for(const z of [-5,-.5]){
      box(0x9a7952,x,1.3,z,1.25,2.6,3.3,{solid:true});
      for(const y of [.5,1.15,1.8,2.45]){box(0xd1b68b,x,y,z,1.4,.1,3.5);for(let i=0;i<8;i++)box([0x637f77,0xab7e5d,0xb4a56a][i%3],x,y+.25,z-1.4+i*.39,1.32,.4,.22);}
    }
    for(const z of [-4,1]){table(0,z,3.4);seat(-1,z+1.1);seat(1,z+1.1);box(0xeee6c9,0,1.1,z,1.1,.08,.65);}
  }else if(kind==='classroom'){
    box(0x3c6254,0,2,-8.84,7.6,1.65,.06);box(0xc3b18c,0,1.05,-6.4,3,.15,1.1,{solid:true});
    for(const x of [-3,1.5])for(const z of [-3.5,0,3.5]){table(x,z);seat(x-.65,z+1.15);seat(x+.65,z+1.15);}
  }else{
    box(0x7f9c80,0,.8,-6.8,10,1.6,2,{solid:true});box(0xe6d5b0,0,1.65,-6.8,10.3,.12,2.2);box(0x587564,0,2.6,-8.84,6,1.2,.06);
    for(const x of [-3.2,3.2])for(const z of [-2,2.5]){table(x,z,2.6);seat(x-.7,z+1.1);seat(x+.7,z+1.1);}
  }
  const solids=finish();
  const world={
    canStand(x,z){return Number.isFinite(x)&&Number.isFinite(z)&&Math.abs(x)<6.4&&Math.abs(z)<8.4&&!solids.some(o=>Math.hypot(Math.max(0,Math.abs(x-o.x)-o.w/2),Math.max(0,Math.abs(z-o.z)-o.d/2))<WALK.radius);},
    floorAt:()=>floor,ceilingAt:()=>3.8,
  };
  return {scene,world,spawn:{x:0,z:6.6,y:WALK.eyeHeight,yaw:0,pitch:0,settling:false},nearExit:p=>p.z>6.2&&Math.abs(p.x)<2,dispose(){disposeTree(root);scene.clear();}};
}
