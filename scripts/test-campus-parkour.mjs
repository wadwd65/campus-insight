import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {WALK,createWalkWorld,jumpWalk,advanceWalk,createWalkControls} from '../map-src/web/campus-walk.js';
import {buildCampusScene} from '../map-src/web/campus-scene.js';
import {roofPracticeStart,vehicleCameraPose,createCampusCar} from '../map-src/web/campus-play.js';
import {createCampusCharacter} from '../map-src/web/campus-character.js';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8'),scope=vm.createContext({});vm.runInContext(read('map-src/three-packed.js'),scope);const T=scope.THREE;
const data=JSON.parse(read('public/map/campus-data.json')),campus=buildCampusScene(T,data),world=createWalkWorld(data,campus.navigation);
const fixture={transform:{ox:0,oz:0,k:1},boundary:[[-100,-100],[100,-100],[100,100],[-100,100]],lake:[[70,70],[80,70],[80,80],[70,80]],roads:[]};
const pose=(x=0,z=0,feet=.04)=>({x,z,y:feet+WALK.eyeHeight,yaw:0,pitch:0,settling:false});
let count=0;function test(name,fn){fn();count++;console.log('  ✓ '+name);}
test('二段跳保留当前高度、补一次上升冲量，第三跳拒绝，落地恢复',()=>{
  const p=pose(),w=createWalkWorld(fixture);assert.equal(jumpWalk(p),true);
  for(let i=0;i<40;i++)advanceWalk(p,w,new Set(),1/120);const before=p.y;assert.equal(jumpWalk(p),true);assert.equal(p.y,before);assert.equal(jumpWalk(p),false);let peak=before;
  for(let i=0;i<400;i++){advanceWalk(p,w,new Set(),1/120);peak=Math.max(peak,p.y);}
  assert.ok(peak-before>7&&peak-before<7.2);assert.equal(p.airborne,false);assert.equal(p.jumpsUsed,0);assert.ok(Math.abs(p.y-WALK.eyeHeight-.04)<1e-8);
});
test('真实校园练习点可二段跳落在生活区门廊，停稳后不继续补帧',()=>{
  const start=roofPracticeStart(world,campus.targets);assert.ok(start);assert.ok(world.canStand(start.x,start.z));
  for(const timing of [.25,.32,.37,.43]){
    const p={...start};jumpWalk(p);let second=false;
    for(let i=0;i<360;i++){if(i/120>=timing&&!second){assert.equal(jumpWalk(p),true);second=true;}advanceWalk(p,world,i/120<1.3?new Set(['KeyW']):new Set(),1/120);}
    assert.equal(p.onRoof,true);assert.equal(p.roofKey,start.roof.key);assert.ok(Math.abs(p.y-WALK.eyeHeight-start.roof.top)<.001);assert.equal(p.settling,false);assert.equal(p.jumpsUsed,0);
  }
});
test('屋面遵循实际分翼与旋转，不会把中间院落补成悬空地板',()=>{
  const roofs=[-4,4].map(x=>({x,y:4.9,z:0,w:4,h:.2,d:8,rotation:0,key:'wing'})),w=createWalkWorld(fixture,{surfaces:roofs});
  assert.equal(w.supportAt(0,0,8),.04);assert.equal(w.supportAt(4,0,8),5);assert.equal(w.supportAt(4,0,4),.04);
  const p=pose(4,0,7);p.airborne=true;p.verticalSpeed=-1;p.jumpsUsed=2;
  for(let i=0;i<180;i++)advanceWalk(p,w,new Set(),1/120);assert.equal(p.onRoof,true);assert.equal(p.y,5+WALK.eyeHeight);
  const rotated=createWalkWorld(fixture,{surfaces:[{x:0,y:4.9,z:0,w:3,h:.2,d:12,rotation:Math.PI/4}]});assert.equal(rotated.supportAt(4,0,8),.04);assert.equal(rotated.supportAt(3,3,8),5);
});
test('门廊落地后可继续跳到主屋顶，外檐与内收屋面的缝隙不会卡半空',()=>{
  const start=roofPracticeStart(world,campus.targets),p={...start};jumpWalk(p);
  for(let i=0;i<360;i++){if(i===40)jumpWalk(p);advanceWalk(p,world,i<156?new Set(['KeyW']):new Set(),1/120);}
  assert.equal(p.onRoof,true);
  for(const duration of [.6,.8,1,1.2]){
    const q={...p};jumpWalk(q);
    for(let i=0;i<500;i++){if(i===40)jumpWalk(q);advanceWalk(q,world,i/120<duration?new Set(['KeyW']):new Set(),1/120);}
    assert.equal(q.airborne,false);assert.equal(q.settling,false);assert.ok(q.y-WALK.eyeHeight>=p.y-WALK.eyeHeight);
    if(duration>=.8)assert.ok(q.y-WALK.eyeHeight>9);
  }
});
test('从屋顶走下会真实下落，空中不恢复跳数，不会永久悬空',()=>{
  const w=createWalkWorld(fixture,{surfaces:[{x:0,y:4.9,z:0,w:5,h:.2,d:5,rotation:0,key:'roof'}]}),p=pose(0,0,5);p.yaw=Math.PI/2;
  for(let i=0;i<90;i++)advanceWalk(p,w,new Set(['KeyW']),1/120);
  assert.equal(p.airborne,true);assert.equal(p.jumpsUsed,1);assert.equal(jumpWalk(p),true);assert.equal(jumpWalk(p),false);
  for(let i=0;i<400;i++)advanceWalk(p,w,new Set(),1/120);assert.equal(p.airborne,false);assert.equal(p.onRoof,false);assert.ok(Math.abs(p.y-WALK.eyeHeight-.04)<1e-8);
});
test('二段跳被真实屋檐底和高墙挡住，不能从楼内穿过屋顶',()=>{
  const low=createWalkWorld(fixture,{surfaces:[{x:0,y:3.9,z:0,w:8,h:.2,d:8,rotation:0}]}),p=pose();jumpWalk(p);jumpWalk(p);
  for(let i=0;i<300;i++){advanceWalk(p,low,new Set(),1/120);assert.ok(p.y<=3.8-.18+.001);}
  const wall=createWalkWorld(fixture,{solids:[{kind:'box',material:'white',key:'wall',x:2,y:10,z:0,w:.2,h:20,d:15,rotation:0}]}),q=pose();q.yaw=Math.PI/2;jumpWalk(q);jumpWalk(q);
  for(let i=0;i<240;i++){advanceWalk(q,wall,new Set(['KeyW','ShiftLeft']),1/120);assert.ok(q.x<1.41);}
});
test('驾驶第一人称处于车内眼高，转动车头或环视不会改变车的位置',()=>{
  const car={x:3,y:.375,z:8,yaw:0},original={...car};let c=vehicleCameraPose(car);assert.equal(c.position.y,2.135);assert.ok(c.target.z<c.position.z);
  car.yaw=Math.PI/2;c=vehicleCameraPose(car);assert.ok(c.target.x>c.position.x);const looked=vehicleCameraPose(car,{yaw:.9,pitch:100});assert.ok(looked.target.y>looked.position.y);assert.ok(Math.abs(looked.target.y-looked.position.y)<=Math.sin(.65)+1e-9);
  assert.deepEqual({x:car.x,y:car.y,z:car.z},{x:original.x,y:original.y,z:original.z});
  const model=createCampusCar(T,{...car,wheelAngle:0});assert.ok(model.root.children.some(m=>m.material?.transparent&&m.material.opacity===.22));model.dispose();
});
test('人物有头身四肢、行走摆动与坐姿，第一人称隐藏自己的头，完整释放资源',()=>{
  const model=createCampusCharacter(T),p=pose();model.update(p,{moving:true,seconds:.05});let triangles=0,parts=0;const gs=new Set(),ms=new Set();
  model.root.traverse(o=>{if(o.isMesh){parts++;triangles+=o.geometry.index.count/3;gs.add(o.geometry);ms.add(o.material);}});assert.ok(parts>=15);assert.ok(triangles<2500);assert.ok(gs.size<=4);assert.equal(model.face.visible,true);
  model.update(p,{firstPerson:true});assert.equal(model.face.visible,false);model.update({...p,y:WALK.eyeHeight+.5},{seated:true});assert.equal(model.face.visible,true);model.root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(model.root);assert.ok(bounds.max.y<2.08);
  let releases=0;for(const r of [...gs,...ms])r.addEventListener('dispose',()=>releases++);model.dispose();assert.equal(releases,gs.size+ms.size);assert.equal(model.root.children.length,0);
});
test('空格和V按住不会自动重复触发二段跳或视角，输入框仍不劫持',()=>{
  const canvas=new EventTarget(),doc=new EventTarget(),win=new EventTarget();let jumps=0,views=0;const controls=createWalkControls({canvas,doc,win,isActive:()=>true,onInput(){},onLook(){},onExit(){},onJump:()=>jumps++,onView:()=>views++});
  for(const code of ['Space','KeyV'])for(const repeat of [false,true,true]){const e=new Event('keydown',{cancelable:true});Object.defineProperties(e,{code:{value:code},repeat:{value:repeat}});win.dispatchEvent(e);}assert.equal(jumps,1);assert.equal(views,1);controls.dispose();
});
campus.dispose();console.log(`人物、驾驶第一人称与屋顶二段跳：${count} 项通过`);
