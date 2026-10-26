import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildCampusScene} from '../map-src/web/campus-scene.js';
import {WALK,createWalkWorld,advanceWalk} from '../map-src/web/campus-walk.js';
import {ENTERABLE,CAR,canPark,vehicleSpawn,vehicleExit,advanceVehicle,canWalkPastVehicle,createCampusCar,createCampusInterior} from '../map-src/web/campus-play.js';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const scope=vm.createContext({});vm.runInContext(read('map-src/three-packed.js'),scope);
const T=scope.THREE,data=JSON.parse(read('public/map/campus-data.json')),campus=buildCampusScene(T,data),world=createWalkWorld(data,campus.navigation);
let passed=0;function test(name,fn){fn();passed++;console.log('  ✓ '+name);}
const open={canStand:(x,z)=>Number.isFinite(x)&&Number.isFinite(z),floorAt:()=>.375};
const pose=()=>({x:0,z:0,y:.375,yaw:0,speed:0,wheelAngle:0});

test('小车在真实校园道路合法落位，附近有安全下车点',()=>{
  const p=vehicleSpawn(world,campus.targets.find(p=>p.id==='lib'));assert.ok(p);assert.ok(canPark(world,p.x,p.z,p.yaw));
  assert.equal(p.y,world.floorAt(p.x,p.z));const exit=vehicleExit(world,p);assert.ok(exit);assert.ok(world.canStand(exit.x,exit.z));assert.ok(Math.hypot(exit.x-p.x,exit.z-p.z)>2);
});
test('前进倒车有速度上限，松开后自然停止，不会永久补帧',()=>{
  const p=pose();for(let i=0;i<200;i++)advanceVehicle(p,open,new Set(['KeyW']),1/60);
  assert.ok(p.z<0);assert.equal(p.speed,CAR.maxSpeed);
  for(let i=0;i<250;i++)advanceVehicle(p,open,new Set(),1/60);assert.equal(p.speed,0);
  const stop=p.z;advanceVehicle(p,open,new Set(),.1);assert.equal(p.z,stop);
  for(let i=0;i<150;i++)advanceVehicle(p,open,new Set(['KeyS']),1/60);assert.equal(p.speed,-CAR.reverseSpeed);assert.ok(p.z>stop);
});
test('方向键可驾驶，右转及倒车转向符合朝向，静止不原地旋转',()=>{
  const p=pose();advanceVehicle(p,open,new Set(['ArrowRight']),.1);assert.equal(p.yaw,0);
  for(let i=0;i<60;i++)advanceVehicle(p,open,new Set(['ArrowUp','ArrowRight']),1/60);assert.ok(p.yaw>0&&p.x>0);
  const q=pose();for(let i=0;i<60;i++)advanceVehicle(q,open,new Set(['KeyS','KeyD']),1/60);assert.ok(q.yaw<0&&q.z>0);
});
test('车体边缘和分步检测阻止穿墙，长帧不会跨过薄墙',()=>{
  const wall={...open,canStand:(x,z)=>x<5&&!(z< -4&&z> -4.25)},p=pose();
  for(let i=0;i<300;i++)advanceVehicle(p,wall,new Set(['KeyW']),.1);
  assert.ok(p.z> -2.8);assert.ok(canPark(wall,p.x,p.z,p.yaw));assert.equal(p.speed,0);
  const q=pose();advanceVehicle(q,open,new Set(['KeyW']),100);assert.ok(Math.abs(q.z)<.08);
  assert.equal(canPark(wall,4.8,0,0),false);assert.equal(vehicleExit({canStand:()=>false},p),null);
});
test('实际路网驾驶过程中持续保持全车合法，位置和高度有效',()=>{
  const p=vehicleSpawn(world,campus.targets.find(p=>p.id==='lib'));
  for(let i=0;i<600;i++){advanceVehicle(p,world,new Set(i<180?['KeyW']:i<350?['KeyW','KeyD']:['KeyS']),1/60);assert.ok(canPark(world,p.x,p.z,p.yaw));assert.ok([p.x,p.y,p.z,p.speed,p.wheelAngle].every(Number.isFinite));}
});
test('步行不能穿过停放车体，旋转后侧面仍可正确绕行',()=>{
  const car=pose();assert.equal(canWalkPastVehicle(car,0,0),false);assert.equal(canWalkPastVehicle(car,1.1,0),false);assert.equal(canWalkPastVehicle(car,2.3,0),true);
  car.yaw=Math.PI/2;assert.equal(canWalkPastVehicle(car,1.5,0),false);assert.equal(canWalkPastVehicle(car,0,2.3),true);
});
test('三间室内对应真实地图地点，入口、边界与家具碰撞可用',()=>{
  assert.equal(Object.keys(ENTERABLE).length,3);
  for(const [id,spec]of Object.entries(ENTERABLE)){
    assert.ok(campus.targets.some(p=>p.key===id));const room=createCampusInterior(T,spec.kind),p={...room.spawn};
    assert.ok(room.world.canStand(p.x,p.z));assert.ok(room.nearExit(p));
    for(let i=0;i<120;i++){advanceWalk(p,room.world,new Set(['KeyW']),1/60);assert.ok(room.world.canStand(p.x,p.z));}
    assert.ok(p.z<room.spawn.z-1);assert.equal(room.world.canStand(7,0),false);assert.equal(room.world.canStand(0,9),false);assert.equal(room.world.canStand(NaN,0),false);
    assert.ok(room.world.ceilingAt(0,0)>WALK.eyeHeight);assert.equal(room.nearExit({x:0,z:0}),false);room.dispose();
  }
});
test('小车和室内共享轻量几何，退出后资源完整释放，重复进入不累积',()=>{
  const car=createCampusCar(T,pose());let triangles=0,meshes=0;car.root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index.count/3)*(o.count||1);}});
  assert.ok(meshes<=9);assert.ok(triangles<1000);car.dispose();assert.equal(car.root.children.length,0);
  for(let i=0;i<9;i++){
    const room=createCampusInterior(T,Object.values(ENTERABLE)[i%3].kind),gs=new Set(),ms=new Set();let batches=0;
    room.scene.traverse(o=>{if(o.geometry){gs.add(o.geometry);batches++;}if(o.material)ms.add(o.material);});assert.equal(gs.size,1);assert.ok(batches<=16);
    let released=0;for(const resource of [...gs,...ms])resource.addEventListener('dispose',()=>released++);
    room.dispose();assert.equal(released,gs.size+ms.size);assert.equal(room.scene.children.length,0);
  }
});

campus.dispose();console.log(`小车与可进入建筑：${passed} 项通过`);
