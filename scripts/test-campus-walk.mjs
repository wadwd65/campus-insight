import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {buildCampusScene} from '../map-src/web/campus-scene.js';
import {WALK,createWalkWorld,walkIntent,hasWalkInput,turnWalk,advanceWalk,createWalkControls} from '../map-src/web/campus-walk.js';

let passed=0;async function test(name,fn){await fn();passed++;console.log('  ✓ '+name);}
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),scope=vm.createContext({});vm.runInContext(read('map-src/three-packed.js'),scope);
const data=JSON.parse(read('public/map/campus-data.json')),before=JSON.stringify(data),campus=buildCampusScene(scope.THREE,data),world=createWalkWorld(data,campus.navigation);
const pose=(x=0,z=0,yaw=0)=>({x,z,y:.04+WALK.eyeHeight,yaw,pitch:0,settling:false}),open={canStand:()=>true,floorAt:()=>.04};
const fixture={transform:{ox:0,oz:0,k:1},boundary:[[-100,-100],[100,-100],[100,100],[-100,100]],lake:[[25,25],[35,25],[35,35],[25,35]],roads:[]};

await test('全部地点均可在合法地面落位，默认湖畔落位不改写模型数据',()=>{
  for(const place of campus.targets){const p=world.spawn(place);assert.ok(p,place.id);assert.ok(world.canStand(p.x,p.z),place.id);assert.ok([p.x,p.y,p.z,p.yaw,p.pitch].every(Number.isFinite));assert.ok(Math.abs(p.y-world.floorAt(p.x,p.z)-WALK.eyeHeight)<1e-8);}
  assert.ok(world.spawn(campus.targets.find(p=>p.id==='lib')));assert.equal(JSON.stringify(data),before);assert.ok(world.obstacles.length>200);
});
await test('湖面、岸边身体半径与校园边缘均有阻挡',()=>{
  const w=createWalkWorld(fixture);assert.equal(w.canStand(30,30),false);assert.equal(w.canStand(24.7,30),false);assert.equal(w.canStand(24,30),true);assert.equal(w.canStand(99.8,0),false);assert.equal(w.canStand(101,0),false);assert.equal(w.canStand(NaN,0),false);
});
await test('旋转墙体按局部体积阻挡，真实门廊中间保持开放',()=>{
  const wall=createWalkWorld(fixture,{solids:[{kind:'facade',material:'brick',x:0,y:2,z:0,w:2,h:4,d:10,rotation:Math.PI/4}]});assert.equal(wall.canStand(-2.8,-2.8),false);assert.equal(wall.canStand(0,6),true);
  const portal=createWalkWorld(fixture,{solids:[{kind:'portal',material:'white',x:0,y:2.5,z:0,w:6,h:5,d:1,rotation:0}]});assert.equal(portal.canStand(0,0),true);assert.equal(portal.canStand(-2.8,0),false);assert.equal(portal.canStand(2.8,0),false);
});
await test('斜向行走不加速，朝向与快走速度正确',()=>{
  const a=pose(),b=pose(),c=pose(0,0,Math.PI/2),d=pose();
  for(let i=0;i<10;i++){advanceWalk(a,open,new Set(['KeyW']),.1);advanceWalk(b,open,new Set(['KeyW','KeyD']),.1);advanceWalk(c,open,new Set(['KeyW']),.1);advanceWalk(d,open,new Set(['KeyW','ShiftLeft']),.1);}
  assert.ok(Math.abs(Math.hypot(a.x,a.z)-WALK.speed)<1e-8);assert.ok(Math.abs(Math.hypot(b.x,b.z)-WALK.speed)<1e-8);assert.ok(Math.abs(c.x-WALK.speed)<1e-8&&Math.abs(c.z)<1e-8);assert.ok(Math.abs(-d.z-WALK.fastSpeed)<1e-8);
  assert.equal(hasWalkInput(new Set(['ShiftLeft'])),false);assert.equal(hasWalkInput(new Set(['KeyW','KeyS'])),false);assert.equal(walkIntent(new Set(['ArrowRight'])).right,1);
});
await test('微步阻挡薄墙并沿墙滑动，长时间间隔不会跨越障碍',()=>{
  const wall={canStand:(x,z)=>x<=1.5||x>=2.6,floorAt:()=>.04},p=pose(0,0,Math.PI/2);
  for(let i=0;i<300;i++)advanceWalk(p,wall,new Set(['KeyW','ShiftLeft']),.1);assert.ok(p.x<=1.5);
  const slide=pose(1.49,0,Math.PI/2);for(let i=0;i<10;i++)advanceWalk(slide,wall,new Set(['KeyW','KeyD']),.1);assert.ok(slide.x<=1.5&&slide.z>3.8);
  const hitch=pose();advanceWalk(hitch,open,new Set(['KeyW','ShiftLeft']),5);assert.ok(Math.hypot(hitch.x,hitch.z)<=WALK.fastSpeed*.1+.00001);
});
await test('镜头俯仰有边界、地面高度平滑收敛且会停止补帧',()=>{
  const p=pose();turnWalk(p,1e7,-1e7);assert.ok(p.yaw>=-Math.PI&&p.yaw<=Math.PI);assert.equal(p.pitch,1.25);turnWalk(p,0,1e7);assert.equal(p.pitch,-1.25);
  const raised={...open,floorAt:()=>.96};advanceWalk(p,raised,new Set(),.034);assert.equal(p.settling,true);for(let i=0;i<30;i++)advanceWalk(p,raised,new Set(),.034);assert.equal(p.settling,false);assert.equal(p.y,.96+WALK.eyeHeight);
});

function harness(){
  const canvas=new EventTarget(),doc=new EventTarget(),win=new EventTarget();let active=true,inputs=0,exits=0,looks=[],errors=0,locks=[];
  canvas.focus=()=>{};canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};doc.pointerLockElement=null;
  doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'));};
  const controls=createWalkControls({canvas,doc,win,isActive:()=>active,onInput:()=>inputs++,onLook:(x,y)=>looks.push([x,y]),onExit:()=>{exits++;active=false;controls.clear();},onLockChange:v=>locks.push(v),onLockError:()=>errors++});
  function fire(target,name,fields={}){const e=new Event(name,{cancelable:true});for(const[k,v]of Object.entries(fields))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);return e;}
  return {canvas,doc,win,controls,fire,setActive:v=>{active=v;},get inputs(){return inputs;},get exits(){return exits;},get looks(){return looks;},get errors(){return errors;},get locks(){return locks;}};
}
await test('按下/释放、失焦与页面隐藏清除行走输入，不接管编辑框或系统快捷键',()=>{
  const h=harness();h.fire(h.win,'keydown',{code:'KeyW'});assert.equal(hasWalkInput(h.controls.keys),true);h.fire(h.win,'keyup',{code:'KeyW'});assert.equal(hasWalkInput(h.controls.keys),false);
  h.fire(h.win,'keydown',{code:'KeyW',ctrlKey:true});assert.equal(h.controls.keys.size,0);h.fire(h.win,'keydown',{code:'KeyW',target:{closest:()=>true}});assert.equal(h.controls.keys.size,0);
  h.fire(h.win,'keydown',{code:'KeyD'});h.fire(h.win,'blur');assert.equal(h.controls.keys.size,0);h.fire(h.win,'keydown',{code:'KeyS'});h.doc.hidden=true;h.fire(h.doc,'visibilitychange');assert.equal(h.controls.keys.size,0);h.controls.dispose();
});
await test('拖动转向与地图旋转互斥，退出漫游后事件恢复传递',()=>{
  const h=harness();let orbit=0;h.canvas.addEventListener('pointerdown',()=>orbit++);
  h.fire(h.canvas,'pointerdown',{button:0,pointerId:1,clientX:20,clientY:30});h.fire(h.canvas,'pointermove',{pointerId:1,clientX:60,clientY:35});assert.deepEqual(h.looks,[[40,5]]);assert.equal(orbit,0);
  h.fire(h.canvas,'pointerup',{pointerId:1});h.fire(h.canvas,'pointermove',{pointerId:1,clientX:80,clientY:35});assert.equal(h.looks.length,1);h.setActive(false);h.fire(h.canvas,'pointerdown',{button:0,pointerId:2});assert.equal(orbit,1);h.controls.dispose();
});
await test('鼠标捕获拒绝时仍可拖动；捕获释放清键，Esc 分别释放和退出',async()=>{
  const h=harness();h.canvas.requestPointerLock=()=>Promise.reject(new Error('test denied'));assert.equal(await h.controls.requestLock(),false);assert.equal(h.errors,1);
  h.canvas.requestPointerLock=()=>{h.doc.pointerLockElement=h.canvas;h.doc.dispatchEvent(new Event('pointerlockchange'));};await h.controls.requestLock();assert.equal(h.controls.locked,true);h.fire(h.doc,'mousemove',{movementX:9,movementY:2});assert.deepEqual(h.looks.at(-1),[9,2]);
  h.fire(h.win,'keydown',{code:'Escape'});assert.equal(h.exits,0);h.fire(h.win,'keydown',{code:'KeyW'});h.doc.exitPointerLock();assert.equal(h.controls.keys.size,0);h.fire(h.win,'keydown',{code:'Escape'});assert.equal(h.exits,1);h.controls.dispose();
});
await test('销毁移除输入监听，迟到的鼠标捕获拒绝不再写状态',async()=>{
  const h=harness();let reject;h.canvas.requestPointerLock=()=>new Promise((_,no)=>{reject=no;});const pending=h.controls.requestLock();h.controls.dispose();reject(new Error('late rejection'));await pending;assert.equal(h.errors,0);const n=h.inputs;h.fire(h.win,'keydown',{code:'KeyW'});assert.equal(h.inputs,n);assert.equal(h.controls.keys.size,0);
});
campus.dispose();console.log(`第一人称漫游：${passed} 项通过`);
