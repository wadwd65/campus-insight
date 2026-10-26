import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import {buildCampusScene} from '../map-src/web/campus-scene.js';
import {WALK,createWalkWorld,jumpWalk,advanceWalk,findWalkTarget,createWalkControls} from '../map-src/web/campus-walk.js';
import {createInstanceVisibility} from '../map-src/web/campus-visibility.js';
import {createFrameMeter} from '../map-src/web/campus-performance.js';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'),scope=vm.createContext({});vm.runInContext(read('map-src/three-packed.js'),scope);
const T=scope.THREE,data=JSON.parse(read('public/map/campus-data.json')),campus=buildCampusScene(T,data),world=createWalkWorld(data,campus.navigation);
let passed=0;function test(name,fn){fn();passed++;console.log('  ✓ '+name);}
const open={canStand:()=>true,floorAt:()=>.04},pose=()=>({x:0,y:WALK.eyeHeight+.04,z:0,yaw:0,pitch:0,settling:false});
test('普通起跳有真实顶点与落地，二段跳仅能补一次，落地恢复次数',()=>{
  const p=pose(),base=p.y;assert.equal(jumpWalk(p),true);let peak=0,descending=false;
  for(let i=0;i<80;i++){const old=p.y;advanceWalk(p,open,new Set(),1/120);peak=Math.max(peak,p.y-base);if(p.y<old)descending=true;}
  assert.ok(peak>1.1&&peak<1.35);assert.equal(descending,true);
  for(let i=0;i<60;i++)advanceWalk(p,open,new Set(),1/120);
  assert.equal(p.airborne,false);assert.equal(p.settling,false);assert.equal(p.y,base);assert.equal(p.jumpsUsed,0);assert.equal(jumpWalk(p),true);assert.equal(jumpWalk(p),true);assert.equal(jumpWalk(p),false);
});
test('跳跃受顶部净空限制，空中仍不能穿墙或越过湖岸阻挡',()=>{
  const p=pose(),ceiling=2.22,w={...open,canStand:x=>x<.8,ceilingAt:()=>ceiling};p.yaw=Math.PI/2;jumpWalk(p);
  for(let i=0;i<80;i++){advanceWalk(p,w,new Set(['KeyW','ShiftLeft']),1/60);assert.ok(p.y<=ceiling-.18+.00001);assert.ok(p.x<.8);}
  assert.equal(p.airborne,false);const spawn=world.spawn();jumpWalk(spawn);for(let i=0;i<60;i++){advanceWalk(spawn,world,new Set(['KeyW']),1/60);assert.ok(world.canStand(spawn.x,spawn.z));}
});
test('瞄准只选择射线最近的近处建筑，不穿过遮挡或选中远处建筑',()=>{
  const a={key:'a',type:'library'},b={key:'b',type:'teaching'},box=(key,z)=>({key,x:0,y:2,z,w:4,h:4,d:1,rotation:0});
  let w={lookVolumes:[box('b',-18),box('a',-8)]};assert.equal(findWalkTarget(w,[a,b],pose()).place,a);
  assert.equal(findWalkTarget(w,[a,b],pose(),5),null);assert.equal(findWalkTarget(w,[a,b],{...pose(),yaw:Math.PI}),null);
  w.lookVolumes.unshift(box('fence',-4));assert.equal(findWalkTarget(w,[a,b],pose()),null);
});
test('门廊开口可以透视后方建筑，门柱和顶部按实际形状处理',()=>{
  const fixture={transform:{ox:0,oz:0,k:1},boundary:[[-100,-100],[100,-100],[100,100],[-100,100]],lake:[[25,25],[35,25],[35,35],[25,35]],roads:[]};
  const w=createWalkWorld(fixture,{solids:[{key:'portal',kind:'portal',material:'white',x:0,y:2.5,z:-4,w:6,h:5,d:1,rotation:0},{key:'lib',kind:'facade',material:'brick',x:0,y:2,z:-10,w:4,h:4,d:1,rotation:0}]});
  assert.equal(findWalkTarget(w,[{key:'portal',type:'teaching'},{key:'lib',type:'library'}],pose()).place.key,'lib');
  assert.ok(Math.abs(w.ceilingAt(0,-4)-4.5)<1e-8);
});
test('空格和 E 不因键盘自动重复连续触发，暂停阅读时禁止行走与跳跃',()=>{
  const win=new EventTarget(),doc=new EventTarget(),canvas=new EventTarget();let jumps=0,interactions=0,paused=false;
  const controls=createWalkControls({canvas,doc,win,isActive:()=>true,canMove:()=>!paused,onInput(){},onLook(){},onExit(){},onJump:()=>jumps++,onInteract:()=>interactions++});
  const key=(code,repeat=false)=>{const e=new Event('keydown',{cancelable:true});Object.defineProperties(e,{code:{value:code},repeat:{value:repeat}});win.dispatchEvent(e);};
  key('Space');key('Space',true);key('KeyE');key('KeyE',true);assert.equal(jumps,1);assert.equal(interactions,1);
  paused=true;key('Space');key('KeyW');key('KeyE');assert.equal(jumps,1);assert.equal(controls.keys.size,0);assert.equal(interactions,2);controls.dispose();
});

const meshes=campus.root.children.filter(m=>m.isInstancedMesh),snapshots=meshes.map(m=>({mesh:m,count:m.count,keys:[...m.userData.keys],matrix:m.instanceMatrix.array.slice(),colors:m.instanceColor.array.slice(),geometry:m.geometry}));
const p=world.spawn(),camera=new T.PerspectiveCamera(WALK.fov,1.22,WALK.near,WALK.far);camera.position.set(p.x,p.y,p.z);camera.lookAt(p.x+Math.sin(p.yaw),p.y,p.z-Math.cos(p.yaw));camera.updateMatrixWorld(true);
const triangles=()=>meshes.filter(m=>m.visible).reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3*m.count,0),full=triangles();
test('第一人称实例裁剪降低提交面数，保留原批次、几何和合法拾取键',()=>{
  campus.updateVisibility(camera,true);assert.ok(triangles()<full*.8);assert.ok(campus.metrics.visibleInstances>0&&campus.metrics.visibleInstances<campus.metrics.instances);
  for(const s of snapshots){assert.equal(s.mesh.geometry,s.geometry);assert.equal(s.mesh.count,s.mesh.userData.keys.length);for(const key of s.mesh.userData.keys)assert.ok(s.keys.includes(key));}
  const versions=meshes.map(m=>m.instanceMatrix.version);campus.updateVisibility(camera,true);assert.deepEqual(meshes.map(m=>m.instanceMatrix.version),versions);
});
test('裁剪和高亮可往返，退出后矩阵、颜色、实例顺序与地点映射精确恢复',()=>{
  campus.highlight('lib');campus.updateVisibility(camera,true);assert.ok(meshes.some(m=>m.userData.keys.includes('lib')));campus.highlight(null);campus.updateVisibility(camera,false);
  for(const s of snapshots){assert.equal(s.mesh.count,s.count);assert.deepEqual(s.mesh.userData.keys,s.keys);assert.deepEqual(s.mesh.instanceMatrix.array,s.matrix);assert.deepEqual(s.mesh.instanceColor.array,s.colors);}
});
test('裁剪使用保守体积保留视野边缘实体，且尊重省电隐藏状态',()=>{
  const m=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial(),3),matrix=new T.Matrix4();m.userData.keys=['edge','off','front'];
  for(const[i,x,z,w]of [[0,12,-10,20],[1,100,-10,1],[2,0,-8,1]]){matrix.makeScale(w,1,1);matrix.setPosition(x,0,z);m.setMatrixAt(i,matrix);m.setColorAt(i,new T.Color(0xffffff));}
  const v=createInstanceVisibility(T,[m]),c=new T.PerspectiveCamera(60,1,.1,100);c.updateMatrixWorld(true);v.update(c,true);assert.deepEqual(m.userData.keys,['edge','front']);
  m.userData.detailHidden=true;v.update(c,true);assert.equal(m.visible,false);v.update(c,false);assert.equal(m.count,3);assert.equal(m.visible,false);v.dispose();m.geometry.dispose();m.material.dispose();
});
test('帧率依据真实间隔计算，低帧率不会被显示成目标 60，空闲间隔不计入移动帧率',()=>{
  const meter=createFrameMeter();let stats;for(let i=0;i<=60;i++)stats=meter.frame(i*1000/60,true)||stats;assert.ok(Math.abs(stats.fps-60)<.01);
  meter.frame(10000,false);assert.equal(meter.frame(20000,true),null);let low;for(let i=1;i<=25;i++)low=meter.frame(20000+i*40,true)||low;assert.equal(low.fps,25);assert.equal(low.p95,40);
  meter.reset();assert.equal(meter.frame(40000,true),null);assert.equal(meter.frame(40000,true),null);assert.equal(meter.frame(41000,true).suspectedThrottle,true);
});
campus.dispose();console.log(`跳跃、交互与渲染：${passed} 项通过`);
