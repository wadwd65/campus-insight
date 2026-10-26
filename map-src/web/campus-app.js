import './three-r149.min.js';
import {buildCampusScene,TYPE_LABELS} from './campus-scene.js';
import {QUALITY,initialQuality,constrainView,fitDistance,detailView,renderPlan,clipPlanes,clamp} from './campus-model.js';
import {LIGHTING,createStaticShadowLayer} from './campus-lighting.js';
import {createWaterClock,waterMotionAllowed} from './campus-water.js';
import {drawGrassDetail,drawFoliageSprite} from './campus-detail.js';
import {teachingTexture,dormTexture,roadTexture,groundTexture,trackTexture,courtTexture,basketballTexture,badmintonTexture,libraryStoneTexture,libraryGlassTexture,waterTexture,timberTexture,librarySignTexture,roofMetalTexture,pavingTexture} from './campus-textures.js';
import {createAtmosphere} from './campus-atmosphere.js';
import {WALK,createWalkWorld,createWalkControls,hasWalkInput,advanceWalk,turnWalk,jumpWalk,findWalkTarget} from './campus-walk.js';
import {createFrameMeter} from './campus-performance.js';
import {ENTERABLE,vehicleSpawn,vehicleExit,advanceVehicle,canWalkPastVehicle,createCampusCar,createCampusInterior,vehicleCameraPose,roofPracticeStart} from './campus-play.js';
import {createCampusCharacter} from './campus-character.js';

export async function startCampus() {
const T=globalThis.THREE,$=id=>document.getElementById(id),host=$('scene'),loading=$('loading');
T.ColorManagement.legacyMode=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer: coarse)');
const state={disposed:false,contextLost:false,frame:0,frames:0,auto:false,flight:null,lastTime:0,selected:null,labels:true,slowFrames:0,dragging:false,interactionUntil:0,settleTimer:0,raster:null,waterEnabled:true,waterVisible:false,waterTick:false,waterFrames:0,waterPhase:0,lastWaterTime:0,waterSlowFrames:0,waterBudgetPaused:false,benchmark:null,moveScale:1,fastWindows:0};
let renderer,campus,scene,camera,sun,ambientLight,staticShadow,waterClock,atmosphere,resizeObserver,view,defaultView,qualityName,layout,selectionOutline,walkWorld,walkControls,walking=null,walkReturn=null,landmarks=[];
const frameMeter=createFrameMeter();let walkFocus=null,walkCardPlace=null,lastFocusCheck=-Infinity;
let car=null,carModel=null,driving=false,interior=null,pedestrianWorld=null;
let character=null,lastCharacterPose=null,walkView='first',carView='first',driveLook={yaw:0,pitch:0};
const cleanups=[],deviceMemory=navigator.deviceMemory||8,waterProbe=new T.Vector3();
function listen(el,event,fn,options){el.addEventListener(event,fn,options);cleanups.push(()=>el.removeEventListener(event,fn,options));}
function fail(message){
  loading.hidden=false;loading.replaceChildren();
  const title=document.createElement('b');title.textContent='暂时无法显示三维校园';
  const text=document.createElement('p');text.textContent=message;
  const retry=document.createElement('button');retry.textContent='重新加载';retry.onclick=()=>location.reload();
  const back=document.createElement('a');back.href='../..';back.textContent='返回网站';loading.append(title,text,retry,back);
}
function texture(draw,w=512,h=512,{scale=1,anisotropy=4}={}){const canvas=document.createElement('canvas'),size=n=>Math.min(renderer.capabilities.maxTextureSize,2**Math.ceil(Math.log2(n*scale)));canvas.width=size(w);canvas.height=size(h);const context=canvas.getContext('2d');context.scale(canvas.width/w,canvas.height/h);draw(context,w,h);const map=new T.CanvasTexture(canvas);map.encoding=T.sRGBEncoding;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),anisotropy);return map;}

function lakeInView(){
  if(!campus?.water||!camera)return false;
  const b=campus.water.geometry.boundingBox;let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
  for(const [x,z]of [[b.min.x,b.min.z],[b.min.x,b.max.z],[b.max.x,b.min.z],[b.max.x,b.max.z],[(b.min.x+b.max.x)/2,(b.min.z+b.max.z)/2]]){
    waterProbe.set(x,.55,z).project(camera);if(waterProbe.z < -1 || waterProbe.z > 1)continue;
    left=Math.min(left,waterProbe.x);right=Math.max(right,waterProbe.x);bottom=Math.min(bottom,waterProbe.y);top=Math.max(top,waterProbe.y);
  }
  return left<1&&right>-1&&bottom<1&&top>-1;
}
function canMoveWater(){return waterMotionAllowed({enabled:state.waterEnabled,quality:qualityName,memory:deviceMemory,reduced:reduced.matches,hidden:document.hidden,visible:state.waterVisible,disposed:state.disposed,contextLost:state.contextLost,budgetPaused:state.waterBudgetPaused});}
function updateWaterControl(){
  const forced=qualityName==='low'||deviceMemory<=4||reduced.matches||state.waterBudgetPaused;
  $('water-motion').disabled=forced;$('water-motion').setAttribute('aria-pressed',String(state.waterEnabled&&!forced));
  $('water-motion').querySelector('span').textContent=forced?'静止':state.waterEnabled?'开启':'关闭';
}
function requestRender(){if(!state.frame&&!state.disposed&&!state.contextLost&&!document.hidden)state.frame=requestAnimationFrame(render);}
function pulseInteraction(){
  state.interactionUntil=performance.now()+170;clearTimeout(state.settleTimer);
  state.settleTimer=setTimeout(()=>{state.settleTimer=0;requestRender();},180);requestRender();
}
function applyRaster(moving){
  const plan=renderPlan({width:host.clientWidth,height:host.clientHeight,quality:qualityName,moving,maxSide:renderer.capabilities.maxTextureSize});
  if(moving){plan.dpr*=state.moveScale;plan.pixelWidth=Math.max(1,Math.floor(plan.width*plan.dpr));plan.pixelHeight=Math.max(1,Math.floor(plan.height*plan.dpr));}
  const old=state.raster;
  if(!old||old.width!==plan.width||old.height!==plan.height||old.dpr!==plan.dpr)renderer.setDrawingBufferSize(plan.width,plan.height,plan.dpr);
  state.raster=plan;
}
function measureLabels(){
  const hidden=landmarks.map(item=>item.el.hidden);landmarks.forEach(item=>{item.el.hidden=false;});
  const widths=landmarks.map(item=>item.el.offsetWidth);
  landmarks.forEach((item,i)=>{item.width=widths[i]||item.width;item.el.hidden=hidden[i];});
}
function walkNeedsFrame(){return !!walking&&((!!walkControls&&hasWalkInput(walkControls.keys)&&!walkCardPlace)||walking.settling||(driving&&Math.abs(car.speed)>.025));}
function setGuideOpen(open){$('toggle-guide').setAttribute('aria-expanded',String(open));$('toggle-guide').textContent=open?'收起导览 −':'展开导览 ＋';$('campus-guide').hidden=!open;document.querySelector('.explorer').classList.toggle('guide-collapsed',!open);}
function updateWalkHint(){
  const locked=!!walkControls?.locked;$('walk-lock').setAttribute('aria-pressed',String(locked));$('walk-lock').textContent=locked?'释放鼠标':'自由转向';
  $('walk-hint').textContent=driving?'W/S 前进倒车 · A/D 转弯 · 空格刹停 · E 下车 · V 切换视角':interior?'WASD 行走 · 空格二段跳 · V 看人物 · 门边 E 返回校园':locked?'WASD 行走 · 空格二段跳 · V 切换视角 · E 交互 · Esc 释放鼠标':'WASD 行走 · 拖动转向 · 空格二段跳 · V 切换视角 · Shift 快走';
  $('drive-toggle').textContent=driving?'下车 E':'开小车';$('drive-toggle').setAttribute('aria-pressed',String(driving));$('drive-toggle').disabled=!!interior;
  $('interior-exit').hidden=!interior;$('walk-jump').textContent=driving?'刹停 Space':'二段跳 Space';$('walk-mode').textContent=driving?(carView==='first'?'车内驾驶':'跟车驾驶'):interior?'室内参观':walkView==='third'?'人物漫游':'地面漫游';
  $('walk-lock').disabled=driving&&carView==='third';$('walk-crosshair').hidden=!walking||driving;
  $('view-toggle').textContent=driving?(carView==='first'?'跟车视角 V':'车内视角 V'):walkView==='first'?'第三人称 V':'第一人称 V';
  if(walking)renderer.domElement.setAttribute('aria-label','校园漫游。'+$('walk-hint').textContent+'。回到湖畔可返回地面。');
}
function togglePersonView(){if(!walking||walkCardPlace||state.benchmark)return;if(driving){carView=carView==='first'?'third':'first';driveLook={yaw:0,pitch:0};if(carView==='third')walkControls.releaseLock();}else walkView=walkView==='first'?'third':'first';updateWalkHint();renderer.domElement.focus({preventScroll:true});pulseInteraction();}
function startRoofPractice(){
  if(interior)exitInterior();if(driving&&!exitDrive())return;
  const pose=roofPracticeStart(walkWorld,campus.targets);if(!pose){$('announce').textContent='暂时找不到合适的练习位置。';return;}
  if(!walking)enterWalk(campus.targets.find(p=>p.key===pose.roof.key));if(!walking)return;
  finishBenchmark(false);closeWalkCard({focus:false});walkControls.clear();walkControls.releaseLock();walking={...pose};walkView='third';lastFocusCheck=-Infinity;updateWalkHint();
  $('announce').textContent='前方是可落脚的低屋顶。按空格起跳，接近最高点时再按一次，同时按W向前；落地后恢复两次跳跃。';renderer.domElement.focus({preventScroll:true});requestRender();
}
function updateCharacter(seconds,moving){
  if(!character)return;
  const parent=interior?.room.scene||scene;if(character.root.parent!==parent)parent.add(character.root);
  if(walking){lastCharacterPose=driving?{x:car.x-Math.sin(car.yaw)*.28,z:car.z+Math.cos(car.yaw)*.28,y:car.y+WALK.eyeHeight+.5,yaw:car.yaw}:walking;
    character.update(lastCharacterPose,{seated:driving,firstPerson:driving?carView==='first':walkView==='first',moving,seconds});
  }else if(lastCharacterPose)character.update(lastCharacterPose,{firstPerson:false});
}
function closeWalkCard({focus=true}={}){
  if(!walkCardPlace)return;walkCardPlace=null;$('walk-card').hidden=true;walkControls.clear();if(focus)renderer.domElement.focus({preventScroll:true});lastFocusCheck=-Infinity;requestRender();
}
function updateWalkFocus(time,force=false){
  if(!walking||walkCardPlace||!force&&time-lastFocusCheck<90)return;lastFocusCheck=time;
  if(interior||driving||car&&!walking.airborne&&Math.abs(walking.y-WALK.eyeHeight-car.y)<1&&Math.hypot(walking.x-car.x,walking.z-car.z)<4){
    walkFocus=null;campus.highlight(null);selectionOutline.visible=false;
    const show=driving||!interior||interior.room.nearExit(walking);$('walk-inspect').hidden=!show;
    $('walk-focus-name').textContent=driving?'停好小车，下车走走':interior?'返回校园':'校园电动小车';
    $('walk-focus-distance').textContent=driving?'下车前会自动刹停':interior?'回到进入这栋楼的位置':'可以驾驶，也可以继续步行';
    $('walk-focus-action').textContent=driving?'下车 →':interior?'离开室内 →':'上车 →';return;
  }
  const hit=findWalkTarget(walkWorld,campus.targets,walking);walkFocus=hit?.place||null;
  campus.highlight(walkFocus?.key||null);$('walk-inspect').hidden=!walkFocus;
  $('walk-focus-action').textContent=walkFocus&&ENTERABLE[walkFocus.key]?'可进入 →':'了解建筑 →';
  if(walkFocus){$('walk-focus-name').textContent=walkFocus.name.split(' · ')[0];$('walk-focus-distance').textContent=hit.distance<12?'就在眼前':'附近可查看';}
  selectionOutline.visible=!!walkFocus;if(walkFocus){selectionOutline.position.set(walkFocus.x,.92,walkFocus.z);selectionOutline.rotation.y=walkFocus.rotation||0;selectionOutline.scale.set(walkFocus.width+3,1,walkFocus.depth+3);}
}
function inspectWalkBuilding(){
  if(driving){exitDrive();return;}if(interior){if(interior.room.nearExit(walking))exitInterior();return;}
  if(walking&&!walking.airborne&&!walkCardPlace&&car&&Math.abs(walking.y-WALK.eyeHeight-car.y)<1&&Math.hypot(walking.x-car.x,walking.z-car.z)<4){enterDrive();return;}
  if(!walking)return;if(walkCardPlace){closeWalkCard();return;}updateWalkFocus(performance.now(),true);if(!walkFocus)return;
  walkCardPlace=walkFocus;walkControls.clear();walkControls.releaseLock();$('walk-inspect').hidden=true;
  $('walk-card-title').textContent=walkCardPlace.name;$('walk-card-type').textContent=TYPE_LABELS[walkCardPlace.type];
  $('walk-card-description').textContent=walkCardPlace.description;$('walk-card').hidden=false;$('walk-card-close').focus({preventScroll:true});
  $('walk-enter').hidden=!ENTERABLE[walkCardPlace.key];
  $('announce').textContent='正在了解'+walkCardPlace.name+'，按 E 或 Escape 继续漫游。';requestRender();
}
function doJump(){if(driving){car.speed=0;requestRender();return;}if(walking&&!walkCardPlace&&!state.benchmark&&jumpWalk(walking))requestRender();}
function escapeWalk(){if(walkCardPlace)closeWalkCard();else if(interior)exitInterior();else if(driving)exitDrive();else leaveWalk();}
function exitDrive(){
  if(!driving)return true;car.speed=0;const pose=vehicleExit(walkWorld,car);
  if(!pose){$('announce').textContent='车旁暂时没有空位，请开到宽一点的地方，或点击回到湖畔。';requestRender();return false;}
  driving=false;walking=pose;walkControls.clear();walkControls.releaseLock();lastFocusCheck=-Infinity;updateWalkHint();renderer.domElement.focus({preventScroll:true});requestRender();return true;
}
function enterDrive(){
  if(interior){$('announce').textContent='先返回校园，再开小车。';return;}
  if(driving){exitDrive();return;}if(!car){$('announce').textContent='暂时没有找到可停放小车的道路。';return;}
  if(!walking)enterWalk();if(!walking)return;
  finishBenchmark(false);closeWalkCard({focus:false});walkControls.clear();walkControls.releaseLock();driving=true;car.speed=0;carView='first';driveLook={yaw:0,pitch:0};
  walking={x:car.x,z:car.z,y:car.y+WALK.eyeHeight,yaw:car.yaw,pitch:0,settling:false};lastFocusCheck=-Infinity;updateWalkHint();
  renderer.domElement.focus({preventScroll:true});$('announce').textContent='已进入小车第一人称。W前进，S倒车，A和D转弯，拖动可看四周，V切换跟车视角，空格刹停，E下车。';requestRender();
}
function enterInterior(place){
  if(!place||!ENTERABLE[place.key]||interior)return;if(driving&&!exitDrive())return;
  if(!walking)enterWalk(place);if(!walking)return;
  finishBenchmark(false);closeWalkCard({focus:false});walkControls.clear();walkControls.releaseLock();
  const room=createCampusInterior(T,ENTERABLE[place.key].kind);
  interior={place,room,returnPose:{...walking}};walking={...room.spawn};campus.highlight(null);walkFocus=null;selectionOutline.visible=false;lastFocusCheck=-Infinity;
  updateWalkHint();waterClock?.sync();renderer.domElement.focus({preventScroll:true});$('announce').textContent='已进入'+ENTERABLE[place.key].label+'，这是可步行的简化示意室内。点击返回校园即可离开。';requestRender();
}
function exitInterior(){
  if(!interior)return;const previous=interior;interior=null;walking={...previous.returnPose};delete walking.area;previous.room.dispose();walkControls.clear();walkControls.releaseLock();lastFocusCheck=-Infinity;updateWalkHint();waterClock?.sync();renderer.domElement.focus({preventScroll:true});$('announce').textContent='已回到校园。';requestRender();
}
function startBenchmark(){
  if(state.benchmark){finishBenchmark(false);return;}if(walkCardPlace)closeWalkCard({focus:false});stopMotion();walkControls.clear();
  state.moveScale=1;state.fastWindows=0;state.benchmark={start:performance.now(),first:null,last:null,frames:0,foreground:document.hasFocus()&&!document.hidden,quality:qualityName,scale:state.moveScale,azimuth:view.azimuth,yaw:walking?.yaw};
  frameMeter.reset();$('measure-fps').textContent='停止测量';$('fps-result').textContent='正在测量 6 秒，请保持页面可见…';requestRender();
}
function finishBenchmark(complete){
  const b=state.benchmark;if(!b)return;state.benchmark=null;if(walking&&b.yaw!==undefined)walking.yaw=b.yaw;else view.azimuth=b.azimuth;
  const seconds=(b.last-b.first)/1000,fps=b.frames/seconds,valid=b.foreground&&!b.suspectedThrottle&&document.hasFocus()&&!document.hidden,result={complete,valid,suspectedThrottle:!!b.suspectedThrottle,seconds:Math.max(0,seconds),frames:b.frames,fps:Number.isFinite(fps)?fps:0,quality:b.quality,finalQuality:qualityName,scale:state.moveScale,mode:walking?'walk':'orbit',pixelWidth:state.raster?.pixelWidth,pixelHeight:state.raster?.pixelHeight,triangles:renderer.info.render.triangles};
  $('runtime').dataset.benchmark=JSON.stringify(result);$('fps-result').textContent=complete&&seconds>0?(valid?'本机实测 '+fps.toFixed(1)+' FPS · '+seconds.toFixed(1)+' 秒 · '+QUALITY[qualityName].label:'疑似后台节流或预览未激活，请保持前台后重测'):'测量已停止';$('measure-fps').textContent='测量流畅度 · 6 秒';requestRender();
}
function enterWalk(place=null){
  const focus=place||state.selected||campus.targets.find(p=>p.id==='lib');let pose=walkWorld.spawn(focus);
  if(pose&&car&&!canWalkPastVehicle(car,pose.x,pose.z))pose=vehicleExit(walkWorld,car);
  if(!pose){$('announce').textContent='暂时没有找到可站立的位置，请先换一个地点。';return;}
  finishBenchmark(false);stopMotion();frameMeter.reset();lastFocusCheck=-Infinity;walkReturn={view:{...view},name:$('view-name').textContent,preset:document.querySelector('[data-preset][aria-pressed="true"]')?.dataset.preset,guideOpen:$('toggle-guide').getAttribute('aria-expanded')==='true',shadowHeight:staticShadow.layer.position.y};
  clearSelection();walking=pose;walkView='first';state.dragging=false;state.lastTime=0;walkControls.clear();
  staticShadow.layer.position.y=.02;document.querySelector('.viewport').classList.add('is-walking');
  $('walk-toggle').setAttribute('aria-pressed','true');$('walk-toggle').textContent='退出漫游';$('walk-toolbar').hidden=false;$('walk-crosshair').hidden=false;$('orbit-hint').hidden=true;$('walk-hint').hidden=false;$('labels').hidden=true;
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));setGuideOpen(false);updateWalkHint();
  renderer.domElement.setAttribute('role','application');renderer.domElement.focus({preventScroll:true});
  $('announce').textContent='已进入第一人称。WASD 行走，空格二段跳，V切换第三人称看人物，E查看建筑，Escape返回。';requestRender();
}
function leaveWalk({focus=true}={}){
  if(interior)exitInterior();driving=false;if(car)car.speed=0;
  if(!walking)return;finishBenchmark(false);closeWalkCard({focus:false});walking=null;walkFocus=null;campus.highlight(null);selectionOutline.visible=false;$('walk-inspect').hidden=true;frameMeter.reset();walkControls.clear();walkControls.releaseLock();view={...walkReturn.view};state.lastTime=0;staticShadow.layer.position.y=walkReturn.shadowHeight;
  document.querySelector('.viewport').classList.remove('is-walking');$('walk-toggle').setAttribute('aria-pressed','false');$('walk-toggle').textContent='第一人称漫游';$('walk-toolbar').hidden=true;$('walk-crosshair').hidden=true;$('orbit-hint').hidden=false;$('walk-hint').hidden=true;$('labels').hidden=false;
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===walkReturn.preset)));$('view-name').textContent=walkReturn.name;setGuideOpen(walkReturn.guideOpen);walkReturn=null;
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','三维校园画布。方向键转动，加减号缩放，Home 恢复全景。也可使用地点选择框。');if(focus)renderer.domElement.focus({preventScroll:true});$('announce').textContent='已返回地图视角。';if(!state.disposed)onResize(true);requestRender();
  updateWalkHint();
}
function applyView(){
  if(!walking)view=constrainView(view);
  const clips=walking?{near:driving&&carView==='first' ? .06 : WALK.near,far:WALK.far}:clipPlanes(view.distance),fov=walking?WALK.fov:45;
  if(camera.near!==clips.near||camera.far!==clips.far||camera.fov!==fov){camera.near=clips.near;camera.far=clips.far;camera.fov=fov;camera.updateProjectionMatrix();}
  if(walking){
    const p=walking,c=Math.cos(p.pitch);
    if(driving&&carView==='first'){const pose=vehicleCameraPose(car,driveLook);camera.position.set(pose.position.x,pose.position.y,pose.position.z);camera.lookAt(pose.target.x,pose.target.y,pose.target.z);}
    else if(driving||walkView==='third'){
      const behind=driving?6:4.2,cx=p.x-Math.sin(p.yaw)*behind,cz=p.z+Math.cos(p.yaw)*behind,world=interior?.room.world||walkWorld;let clear=1;
      for(let t=.15;t<=1;t+=.15){const x=p.x+(cx-p.x)*t,z=p.z+(cz-p.z)*t;if(!(world.canOccupy?world.canOccupy(x,z,p.y-WALK.eyeHeight+.2):world.canStand(x,z))){clear=Math.max(.12,t-.15);break;}}
      camera.position.set(p.x+(cx-p.x)*clear,driving?car.y+2.6:p.y+.9,p.z+(cz-p.z)*clear);camera.lookAt(p.x+(driving?Math.sin(p.yaw)*4:0),driving?car.y+1.2:p.y-.35,p.z-(driving?Math.cos(p.yaw)*4:0));
    }else{camera.position.set(p.x,p.y,p.z);camera.lookAt(p.x+Math.sin(p.yaw)*c,p.y+Math.sin(p.pitch),p.z-Math.cos(p.yaw)*c);}
    if(interior){$('walk-area').textContent=ENTERABLE[interior.place.key].label+' · 示意室内';}
    else{
    const nearest=campus.targets.reduce((a,b)=>Math.hypot(b.x-p.x,b.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?b:a);
    const area=p.onRoof?'roof-'+(p.roofKey||nearest.key):nearest.key;if(p.area!==area){p.area=area;$('walk-area').textContent=p.onRoof?'屋顶 · '+(campus.targets.find(t=>t.key===p.roofKey)||nearest).name.split(' · ')[0]:nearest.name.split(' · ')[0]+'附近';}
    }
  }else{const r=Math.cos(view.elevation)*view.distance;camera.position.set(view.x+Math.sin(view.azimuth)*r,Math.sin(view.elevation)*view.distance,view.z+Math.cos(view.azimuth)*r);camera.lookAt(view.x,4,view.z);}
  camera.updateMatrixWorld();if(!interior)atmosphere?.update(camera);document.querySelector('.compass svg').style.transform=`rotate(${-(walking?walking.yaw:view.azimuth)*180/Math.PI}deg)`;
}
function project(position,el,width,height){
  const point=position.clone().project(camera);
  el.hidden=point.z>1||point.z< -1||Math.abs(point.x)>1.05||Math.abs(point.y)>1.1;
  if(!el.hidden){el.style.left=`${(point.x*.5+.5)*width}px`;el.style.top=`${(-point.y*.5+.5)*height}px`;}
  return {x:(point.x*.5+.5)*width,y:(-point.y*.5+.5)*height};
}
function updateLabels(){
  if(walking){$('selection-marker').hidden=true;for(const item of landmarks)item.el.hidden=true;return;}
  const width=host.clientWidth,height=host.clientHeight,occupied=[];
  const marker=$('selection-marker');
  if(state.selected){const pos=project(new T.Vector3(state.selected.x,state.selected.height+9,state.selected.z),marker,width,height);occupied.push({...pos,w:190});}else marker.hidden=true;
  const planMode=document.querySelector('[data-preset="plan"]').getAttribute('aria-pressed')==='true';
  for(const {place,el,important,width:labelWidth}of landmarks){
    if(!state.labels||state.selected?.key===place.key||(!planMode&&!important)){el.hidden=true;continue;}
    const pos=project(new T.Vector3(place.x,place.height+8,place.z),el,width,height);
    if(pos.y<65||pos.y>height-52||pos.x<45||pos.x>width-50||occupied.some(p=>Math.abs(p.x-pos.x)<(p.w+labelWidth)/2+5&&Math.abs(p.y-pos.y)<26))el.hidden=true;
    if(!el.hidden)occupied.push({...pos,w:labelWidth});
  }
}
function render(time){
  state.frame=0;if(state.disposed||document.hidden||state.contextLost)return;
  const moving=state.auto||state.flight||state.benchmark||walkNeedsFrame()||(walking&&time<state.interactionUntil);
  if(moving&&qualityName==='low'&&time-state.lastTime<32){requestRender();return;}
  const delta=Math.min(.06,(time-state.lastTime)/1000||0);state.lastTime=time;
  if(state.auto)view.azimuth+=delta*.085;
  if(state.benchmark){if(walking)walking.yaw+=delta*.085;else view.azimuth+=delta*.085;}
  let characterMoved=false;
  if(walking&&!walkCardPlace&&!state.benchmark){if(driving){advanceVehicle(car,walkWorld,walkControls.keys,delta);Object.assign(walking,{x:car.x,z:car.z,y:car.y+WALK.eyeHeight,yaw:car.yaw});carModel.update();}else characterMoved=advanceWalk(walking,interior?.room.world||pedestrianWorld,walkControls.keys,delta);}
  updateCharacter(delta,characterMoved);
  if(state.flight){const f=state.flight,t=clamp((time-f.start)/f.duration,0,1),k=1-Math.pow(1-t,3);for(const key of ['x','z','distance','azimuth','elevation'])view[key]=f.from[key]+(f.to[key]-f.from[key])*k;if(t>=1)state.flight=null;}
  applyRaster(!!(state.auto||state.flight||state.benchmark||walkNeedsFrame()||state.dragging||time<state.interactionUntil));applyView();updateWalkFocus(time);if(!interior)campus.updateVisibility(camera,!!walking);
  state.waterVisible=!interior&&lakeInView();
  const waterMoving=canMoveWater();
  if(waterMoving){if(state.lastWaterTime)state.waterPhase+=Math.min(.4,Math.max(0,(time-state.lastWaterTime)/1000));state.lastWaterTime=time;campus.materials.water.userData.rippleTime.value=state.waterPhase;}else state.lastWaterTime=0;
  const waterTick=state.waterTick;state.waterTick=false;
  const before=performance.now();renderer.render(interior?.room.scene||scene,camera);const elapsed=performance.now()-before;
  state.frames++;if(waterTick){state.waterFrames++;state.waterSlowFrames=elapsed>24?state.waterSlowFrames+1:0;if(state.waterSlowFrames>=3){state.waterBudgetPaused=true;updateWaterControl();}}updateLabels();
  waterClock?.sync();
  const foreground=document.hasFocus()&&!document.hidden,continuous=!!(state.auto||state.flight||state.benchmark||walkNeedsFrame()||(walking&&time<state.interactionUntil)),stats=frameMeter.frame(time,continuous&&foreground);
  if(state.benchmark)state.benchmark.foreground&&=foreground;
  if(stats){
    $('frame-meter').textContent=stats.suspectedThrottle?'疑似后台节流 · 请激活预览':stats.fps.toFixed(0)+' FPS';$('runtime').dataset.fps=stats.fps.toFixed(1);$('runtime').dataset.frameP95=stats.p95.toFixed(1);
    if(state.benchmark&&stats.suspectedThrottle)state.benchmark.suspectedThrottle=true;
    if(!stats.suspectedThrottle&&qualityName!=='low'&&(!state.benchmark||time-state.benchmark.start>=2000)){if(stats.fps<48&&stats.frames>=8){state.moveScale=Math.max(.65,state.moveScale*.85);state.fastWindows=0;}else if(stats.fps>57&&++state.fastWindows>=3){state.moveScale=Math.min(1,state.moveScale+.05);state.fastWindows=0;}}
  }else if(!foreground&&continuous)$('frame-meter').textContent='预览未激活 · 暂停采样';else if(!continuous)$('frame-meter').textContent='静止 · 按需绘制';else if(!$('runtime').dataset.fps)$('frame-meter').textContent='正在采样…';
  if(state.benchmark){const b=state.benchmark;if(time-b.start>=1000){if(b.first===null)b.first=time;else b.frames++;b.last=time;}if(time-b.start>=6000)finishBenchmark(true);}
  const info=renderer.info;
  Object.assign($('runtime').dataset,{playMode:interior?'interior':driving?'drive':walking?'walk':'orbit',interior:interior?.place.key||'',vehicleSpeed:car?car.speed.toFixed(2):'0',personView:driving?carView:walkView,jumpsUsed:String(walking?.jumpsUsed||0),onRoof:String(!!walking?.onRoof),roofKey:walking?.roofKey||''});
  $('jump-status').hidden=!walking||driving;$('jump-status').textContent=walking?.onRoof?'屋顶已站稳 · 空格可继续跳':'跳跃 '+Math.max(0,2-(walking?.jumpsUsed||0))+'/2 · 接近最高点再跳一次';
  Object.assign($('runtime').dataset,{frames:String(state.frames),calls:String(info.render.calls),triangles:String(info.render.triangles),geometries:String(info.memory.geometries),textures:String(info.memory.textures),quality:qualityName,cameraMode:walking?'walk':'orbit',walkX:walking?walking.x.toFixed(2):'',walkZ:walking?walking.z.toFixed(2):'',walkY:walking?walking.y.toFixed(3):'',airborne:String(!!walking?.airborne),walkTarget:walkFocus?.key||'',visibleInstances:String(campus.metrics.visibleInstances),moveScale:state.moveScale.toFixed(2),pageFocused:String(foreground),pointerLocked:String(!!walkControls?.locked),continuous:String(!!(state.auto||state.flight||state.benchmark||walkNeedsFrame()||waterClock?.active)),waterMode:canMoveWater()?'gentle':'still',waterVisible:String(state.waterVisible),waterFrames:String(state.waterFrames),waterPhase:state.waterPhase.toFixed(3),waterIntervalMs:'250',waterPending:String(!!waterClock?.active),shadowMode:'static-atlas',detail:campus.metrics.detail,grassTufts:String(campus.metrics.grassTufts),skyBakes:String(atmosphere?.revision||0),shadowBakes:String(staticShadow?.bakes||0),renderMs:elapsed.toFixed(1),rasterMode:state.raster.mode,dpr:String(state.raster.dpr),bufferWidth:String(state.raster.pixelWidth),bufferHeight:String(state.raster.pixelHeight)});
  $('runtime').textContent=`${walking?'第一人称 · ':''}${state.raster.mode==='moving'?'轻量交互':'静止清晰'} · ${state.raster.pixelWidth} × ${state.raster.pixelHeight} · ${campus.metrics.placeGroups} 处地点`;
  if(elapsed>45)state.slowFrames++;else state.slowFrames=Math.max(0,state.slowFrames-1);
  if(state.slowFrames>=12&&qualityName!=='low'){setQuality(qualityName==='high'?'balanced':'low');$('announce').textContent='已降低画面质量，以减少设备负担。';state.slowFrames=0;}
  if(state.auto||state.flight||state.benchmark||walkNeedsFrame())requestRender();
}
function stopMotion(){if(state.benchmark)finishBenchmark(false);state.auto=false;state.flight=null;$('auto').setAttribute('aria-pressed','false');$('auto').querySelector('span').textContent='关闭';}
function flyTo(to){stopMotion();if(reduced.matches){view={...to};requestRender();return;}state.flight={from:{...view},to:{...to},start:performance.now(),duration:coarse.matches?400:600};requestRender();}
function fit(){defaultView={x:0,z:0,distance:fitDistance(host.clientWidth/Math.max(1,host.clientHeight)),azimuth:0,elevation:1.08};}
function select(place,focus=false){
  if(walking)leaveWalk();
  state.selected=place;
  selectionOutline.visible=['dorm','teaching','library','gym','canteen','shop','pavilion'].includes(place.type);selectionOutline.position.set(place.x,.9,place.z);selectionOutline.rotation.y=place.rotation||0;selectionOutline.scale.set(place.width+3,1,place.depth+3);
  $('place-card').hidden=false;$('place-title').textContent=place.name;$('place-category').textContent=TYPE_LABELS[place.type];$('place-description').textContent=place.description;
  $('place-enter').hidden=!ENTERABLE[place.key];
  const roof=['dorm','teaching','library','gym','canteen','shop','pavilion'].includes(place.type);$('roof-view').firstChild.textContent=roof?'俯看屋面 ':'俯看全貌 ';$('roof-view').dataset.caption=roof?'屋面':'全貌';
  $('building-reference').hidden=!place.architecture;$('building-reference').open=false;
  $('reference-detail').textContent=place.architecture?`${place.architecture.features} ${place.architecture.limit}${place.architecture.evidence?' 身份对照：'+place.architecture.evidence+'。':''}${place.architecture.scenes.length?' 历史类型参考机位：'+place.architecture.scenes.join('、')+'。':''}`:'';
  $('place-picker').value=place.key;$('selection-marker').querySelector('b').textContent=place.name;
  $('announce').textContent=`已选择${place.name}，可点击靠近看看。`;requestRender();
  if(focus){activateDetail(place);flyTo(detailView(place,view));}
}
function activateDetail(place){document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));$('view-name').textContent=place.name.split(' · ')[0];}
function clearSelection(){const restore=$('place-card').contains(document.activeElement);state.selected=null;if(selectionOutline)selectionOutline.visible=false;$('place-card').hidden=true;$('selection-marker').hidden=true;$('place-picker').value='';if(restore)($('campus-guide').hidden?renderer.domElement:$('place-picker')).focus({preventScroll:true});requestRender();}
function setPreset(name){
  if(walking)leaveWalk();
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===name)));
  $('view-name').textContent={overview:'艺术化校园全景',lake:'书香湖畔',teaching:'教学街区',dorm:'生活院落',sport:'运动日常',plan:'俯瞰核对'}[name];
  if(name==='overview'){clearSelection();flyTo(defaultView);return;}
  if(name==='plan'){clearSelection();flyTo({...defaultView,azimuth:0,elevation:1.45});return;}
  const place=campus.targets.find(p=>name==='teaching'?p.id==='teach-3':name==='sport'?p.id==='gym':p.type===name);
  if(place){const preset=layout.views[name],{px,py,...cameraView}=preset;select(place);flyTo({...defaultView,x:(px-layout.transform.ox)*layout.transform.k,z:(py-layout.transform.oz)*layout.transform.k,...cameraView});}
}
function setQuality(name){
  qualityName=QUALITY[name]?name:'low';$('quality').value=qualityName;state.moveScale=1;state.fastWindows=0;frameMeter.reset();
  renderer.shadowMap.enabled=false;sun.castShadow=false;campus.setDetail(qualityName);updateWaterControl();waterClock?.sync();requestRender();
}
function setLighting(name){
  const mood=LIGHTING[name]||LIGHTING.daylight;$('lighting').value=LIGHTING[name]?name:'daylight';
  ambientLight.color.setHex(mood.sky);ambientLight.groundColor.setHex(mood.bounce);ambientLight.intensity=mood.ambient;
  sun.color.setHex(mood.sun);sun.intensity=mood.strength;renderer.toneMappingExposure=mood.exposure;
  campus.materials.ground.color.setHex(mood.ground);campus.materials.roof.color.setHex(mood.roof);campus.materials.libraryStone.color.setHex(mood.stone);
  const sky=document.querySelector('.viewport');sky.style.setProperty('--sky-top',mood.skyTop);sky.style.setProperty('--sky-bottom',mood.skyBottom);sky.style.setProperty('--sun-glow',mood.glow);
  atmosphere?.setLighting(name);staticShadow.material.opacity=mood.shadowOpacity;$('light-name').textContent=mood.label;requestRender();
}
function updateSun(){const angle=Number($('sun').value)*Math.PI/180;sun.position.set(Math.cos(angle)*260,400,Math.sin(angle)*260);sun.updateMatrixWorld();atmosphere?.setSun(sun.position);staticShadow.bake(angle);requestRender();}
function onResize(preserve=false){
  if(!camera||state.disposed)return;
  const aspect=host.clientWidth/Math.max(1,host.clientHeight),changed=Math.abs(camera.aspect-aspect)>.00001;camera.aspect=aspect;camera.updateProjectionMatrix();
  const old=defaultView?.distance;fit();
  const preset=document.querySelector('[data-preset][aria-pressed="true"]')?.dataset.preset;
  const overview=!walking&&['overview','plan'].includes(preset)&&!state.selected&&!state.auto;
  if(preserve!==true&&changed){if(overview){state.flight=null;view={...defaultView,...(preset==='plan'?{elevation:1.45}: {})};}else if(old&&Math.abs(view.distance-old)<1)view.distance=defaultView.distance;}
  measureLabels();pulseInteraction();
}

function interactions(){
  const canvas=renderer.domElement,pointers=new Map(),ray=new T.Raycaster(),pointer=new T.Vector2();let down=null,gesture=null;
  walkControls=createWalkControls({canvas,doc:document,win:window,isActive:()=>!!walking&&!state.contextLost&&!state.disposed,onInput:requestRender,onLook:(dx,dy)=>{if(!walking)return;if(driving){if(carView!=='first')return;driveLook.yaw=clamp(driveLook.yaw+dx*.0026,-1.25,1.25);driveLook.pitch=clamp(driveLook.pitch-dy*.0021,-.65,.65);}else turnWalk(walking,dx,dy);pulseInteraction();},onExit:escapeWalk,onJump:doJump,onInteract:inspectWalkBuilding,onView:togglePersonView,canMove:()=>!walkCardPlace&&!state.benchmark,onLockChange:updateWalkHint,onLockError:()=>{$('walk-hint').textContent='鼠标捕获未开启；按住画面拖动看四周，WASD 移动，V切换视角。';$('announce').textContent=$('walk-hint').textContent;}});
  cleanups.push(()=>walkControls.dispose());
  listen($('walk-jump'),'click',()=>{doJump();renderer.domElement.focus({preventScroll:true});});listen($('walk-inspect'),'click',inspectWalkBuilding);listen($('walk-card-close'),'click',()=>closeWalkCard());listen($('walk-map-detail'),'click',()=>{const p=walkCardPlace;if(p){leaveWalk();select(p,true);}});listen($('measure-fps'),'click',startBenchmark);
  listen($('walk-toggle'),'click',()=>walking?leaveWalk():enterWalk());listen($('walk-lock'),'click',()=>walkControls.requestLock());
  listen($('drive-toggle'),'click',enterDrive);listen($('interior-exit'),'click',exitInterior);
  listen($('view-toggle'),'click',togglePersonView);listen($('roof-start'),'click',startRoofPractice);
  listen($('walk-enter'),'click',()=>enterInterior(walkCardPlace));listen($('place-enter'),'click',()=>enterInterior(state.selected));
  document.querySelectorAll('[data-enter]').forEach(button=>listen(button,'click',()=>enterInterior(campus.targets.find(p=>p.key===button.dataset.enter))));
  listen($('walk-home'),'click',()=>{if(!walking)return;if(interior)exitInterior();driving=false;if(car)car.speed=0;finishBenchmark(false);closeWalkCard({focus:false});lastFocusCheck=-Infinity;walkControls.clear();walkControls.releaseLock();const pose=walkWorld.spawn(campus.targets.find(p=>p.id==='lib'));if(pose)walking=pose;updateWalkHint();renderer.domElement.focus({preventScroll:true});requestRender();});
  function gestureValues(){const p=[...pointers.values()];return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};}
  function pan(dx,dy){const scale=view.distance/Math.max(1,host.clientHeight)*.65;view.x+=(-dx*Math.cos(view.azimuth)-dy*Math.sin(view.azimuth))*scale;view.z+=(dx*Math.sin(view.azimuth)-dy*Math.cos(view.azimuth))*scale;}
  listen(canvas,'pointerdown',e=>{if(walking)return;if(e.button>2)return;stopMotion();state.dragging=true;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});down={x:e.clientX,y:e.clientY,moved:false,button:e.button};if(pointers.size>1){gesture=gestureValues();down.moved=true;}canvas.classList.add('is-dragging');pulseInteraction();});
  listen(canvas,'pointermove',e=>{
    if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId),dx=e.clientX-prev.x,dy=e.clientY-prev.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;
    if(pointers.size===2){const next=gestureValues();if(gesture){view.distance*=gesture.d/Math.max(1,next.d);pan(next.x-gesture.x,next.y-gesture.y);}gesture=next;}
    else if(e.shiftKey||down?.button===2)pan(dx,dy);else{view.azimuth-=dx*.006;view.elevation+=dy*.004;}
    pulseInteraction();
  });
  function release(e){
    if(!pointers.has(e.pointerId))return;
    const click=pointers.size===1&&down&&!down.moved&&down.button===0&&e.type==='pointerup';pointers.delete(e.pointerId);gesture=null;
    if(click){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(campus.pickables,false).find(h=>h.object.userData.key||h.object.userData.keys?.[h.instanceId]);const key=hit&&(hit.object.userData.key||hit.object.userData.keys?.[hit.instanceId]);const target=campus.targets.find(p=>p.key===key);if(target)select(target);}
    if(!pointers.size){state.dragging=false;canvas.classList.remove('is-dragging');down=null;pulseInteraction();}
  }
  for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,name,release);
  listen(canvas,'contextmenu',e=>e.preventDefault());
  listen(canvas,'wheel',e=>{e.preventDefault();if(walking)return;stopMotion();view.distance*=Math.exp(clamp(e.deltaY,-120,120)*.0015);pulseInteraction();},{passive:false});
  listen(canvas,'dblclick',()=>{if(!walking)setPreset('overview');});
  listen(canvas,'keydown',e=>{if(walking)return;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','Escape'].includes(e.key))return;e.preventDefault();stopMotion();if(e.key==='Home'){setPreset('overview');return;}if(e.key==='Escape'){clearSelection();return;}if(e.key==='ArrowLeft')view.azimuth-=.12;if(e.key==='ArrowRight')view.azimuth+=.12;if(e.key==='ArrowUp')view.elevation+=.08;if(e.key==='ArrowDown')view.elevation-=.08;if(e.key==='+'||e.key==='=')view.distance*=.85;if(e.key==='-')view.distance*=1.18;pulseInteraction();});
  document.querySelectorAll('[data-preset]').forEach(button=>listen(button,'click',()=>setPreset(button.dataset.preset)));
  listen($('place-picker'),'change',()=>{const place=campus.targets.find(p=>p.key===$('place-picker').value);if(place)select(place,true);else clearSelection();});
  listen($('close-place'),'click',clearSelection);listen($('focus-place'),'click',()=>state.selected&&select(state.selected,true));
  listen($('other-side'),'click',()=>{if(!state.selected)return;const p=state.selected,azimuth=state.flight?.to.azimuth??view.azimuth;activateDetail(p);flyTo({...detailView(p,view),azimuth:azimuth+Math.PI/2});$('announce').textContent=`正在查看${p.name}的另一侧。`;});
  listen($('roof-view'),'click',()=>{if(!state.selected)return;activateDetail(state.selected);flyTo(detailView(state.selected,view,{roof:true}));$('announce').textContent=`正在俯看${state.selected.name}的${$('roof-view').dataset.caption}。`;});
  listen($('zoom-in'),'click',()=>{stopMotion();view.distance*=.8;pulseInteraction();});listen($('zoom-out'),'click',()=>{stopMotion();view.distance*=1.25;pulseInteraction();});
  listen($('rotate-left'),'click',()=>{stopMotion();view.azimuth-=Math.PI/6;pulseInteraction();});listen($('reset'),'click',()=>setPreset('overview'));
  listen($('toggle-guide'),'click',()=>setGuideOpen($('toggle-guide').getAttribute('aria-expanded')!=='true'));
  listen($('quality'),'change',()=>setQuality($('quality').value));listen($('sun'),'change',updateSun);
  listen($('lighting'),'change',()=>setLighting($('lighting').value));
  listen($('water-motion'),'click',()=>{state.waterEnabled=!state.waterEnabled;updateWaterControl();waterClock.sync();requestRender();});
  listen($('shade'),'click',()=>{const visible=!staticShadow.layer.visible;staticShadow.layer.visible=visible;$('shade').setAttribute('aria-pressed',String(visible));$('shade').querySelector('span').textContent=visible?'开启':'关闭';requestRender();});
  listen($('labels'),'click',()=>{state.labels=!state.labels;$('labels').setAttribute('aria-pressed',String(state.labels));$('labels').querySelector('span').textContent=state.labels?'开启':'关闭';requestRender();});
  listen($('auto'),'click',()=>{if(walking)leaveWalk();state.flight=null;state.auto=!state.auto;$('auto').setAttribute('aria-pressed',String(state.auto));$('auto').querySelector('span').textContent=state.auto?'开启':'关闭';requestRender();});
  listen(document,'visibilitychange',()=>{if(document.hidden){finishBenchmark(false);frameMeter.reset();if(state.frame)cancelAnimationFrame(state.frame);state.frame=0;state.lastTime=0;state.lastWaterTime=0;}else requestRender();waterClock?.sync();});
  listen(reduced,'change',()=>{if(reduced.matches){stopMotion();setQuality('low');}requestRender();});
  listen(window,'blur',()=>{if(car)car.speed=0;pointers.clear();gesture=null;down=null;state.dragging=false;canvas.classList.remove('is-dragging');pulseInteraction();});
  listen(canvas,'webglcontextlost',e=>{e.preventDefault();state.contextLost=true;finishBenchmark(false);walkControls?.clear();walkControls?.releaseLock();waterClock?.stop();if(state.frame)cancelAnimationFrame(state.frame);state.frame=0;fail('设备暂停了图形绘制。可尝试关闭其他高负载页面后重新加载。');});
  listen(canvas,'webglcontextrestored',()=>location.reload());
}
function dispose(){if(state.disposed)return;finishBenchmark(false);state.disposed=true;if(walking)leaveWalk({focus:false});character?.dispose();carModel?.dispose();waterClock?.dispose();clearTimeout(state.settleTimer);if(state.frame)cancelAnimationFrame(state.frame);resizeObserver?.disconnect();cleanups.forEach(fn=>fn());walking=null;walkReturn=null;campus?.dispose();scene?.traverse(o=>{if(o.isLight)o.dispose?.();});renderer?.dispose();renderer?.domElement.remove();$('landmarks').replaceChildren();$('place-card').hidden=true;$('selection-marker').hidden=true;}

try{
  // Responsive unmount/remount starts from a coherent UI, not stale switch captions.
  for(const [id,on]of [['shade',true],['labels',true],['auto',false]]){$(id).setAttribute('aria-pressed',String(on));$(id).querySelector('span').textContent=on?'开启':'关闭';}
  $('walk-toggle').setAttribute('aria-pressed','false');$('walk-toggle').textContent='第一人称漫游';$('walk-toolbar').hidden=true;$('walk-crosshair').hidden=true;$('orbit-hint').hidden=false;$('walk-hint').hidden=true;$('labels').hidden=false;document.querySelector('.viewport').classList.remove('is-walking');
  $('walk-inspect').hidden=true;$('walk-card').hidden=true;$('frame-meter').textContent='静止 · 按需绘制';$('measure-fps').textContent='测量流畅度 · 6 秒';
  $('drive-toggle').disabled=false;$('drive-toggle').textContent='开小车';$('drive-toggle').setAttribute('aria-pressed','false');$('interior-exit').hidden=true;$('place-enter').hidden=true;
  $('jump-status').hidden=true;
  $('sun').value='220';$('place-picker').value='';$('view-name').textContent='艺术化校园全景';
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset==='overview')));
  $('place-picker').querySelectorAll('optgroup').forEach(group=>group.remove());
  const response=await fetch('./campus-data.json');if(!response.ok)throw new Error('校园布局暂时无法读取，请稍后重试。');const data=await response.json();
  layout=data;
  try{renderer=new T.WebGLRenderer({antialias:!coarse.matches,alpha:true,powerPreference:deviceMemory<=4||coarse.matches?'low-power':'high-performance'});}catch{throw new Error('此设备未能启用 WebGL。请使用支持硬件加速的浏览器，其他网站功能仍可正常使用。');}
  renderer.setClearColor(0x000000,0);renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.enabled=false;
  const gl=renderer.getContext();$('runtime').dataset.depthBits=String(gl.getParameter(gl.DEPTH_BITS));
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','三维校园画布。方向键转动，加减号缩放，Home 恢复全景。也可使用地点选择框。');renderer.domElement.setAttribute('role','img');host.appendChild(renderer.domElement);
  scene=new T.Scene();camera=new T.PerspectiveCamera(45,1,1,3000);
  const outlineGeometry=new T.BufferGeometry().setFromPoints([[-.46,-.5],[.46,-.5],[.5,-.46],[.5,.46],[.46,.5],[-.46,.5],[-.5,.46],[-.5,-.46]].map(([x,z])=>new T.Vector3(x,0,z)));
  const outlineMaterial=new T.LineBasicMaterial({color:0xc69a64,transparent:true,opacity:.85});
  selectionOutline=new T.LineLoop(outlineGeometry,outlineMaterial);selectionOutline.name='selected-building-boundary';selectionOutline.visible=false;selectionOutline.frustumCulled=false;scene.add(selectionOutline);
  cleanups.push(()=>{outlineGeometry.dispose();outlineMaterial.dispose();});
  ambientLight=new T.HemisphereLight();scene.add(ambientLight);
  sun=new T.DirectionalLight();sun.castShadow=false;scene.add(sun);
  qualityName=initialQuality({coarse:coarse.matches,memory:navigator.deviceMemory||8,reduced:reduced.matches});
  const facadeScale=qualityName==='low'?1:2;
  const textures={foliage:texture(drawFoliageSprite,512,512,{anisotropy:8}),teaching:texture(teachingTexture,1024,512,{scale:facadeScale,anisotropy:8}),dorm:texture(dormTexture,1024,512,{scale:facadeScale,anisotropy:8}),ground:texture(groundTexture,1024,1024,{scale:facadeScale,anisotropy:8}),grassDetail:texture(drawGrassDetail,512,512,{anisotropy:8}),road:texture(roadTexture,128,1024),basketball:texture(basketballTexture,256,512),badminton:texture(badmintonTexture,256,512),track:texture(trackTexture,512,768),court:texture(courtTexture,256,512),libraryStone:texture(libraryStoneTexture,1024,512,{scale:facadeScale,anisotropy:8}),libraryGlass:texture(libraryGlassTexture,512,1024,{scale:facadeScale,anisotropy:8}),water:texture(waterTexture,1024,512),timber:texture(timberTexture,256,256),librarySign:texture(librarySignTexture,512,96,{scale:facadeScale}),roofMetal:texture(roofMetalTexture,512,512,{anisotropy:8}),paving:texture(pavingTexture,512,128)};
  textures.grassDetail.encoding=T.LinearEncoding;textures.grassDetail.wrapS=textures.grassDetail.wrapT=T.RepeatWrapping;
  const skyCanvas=document.createElement('canvas');skyCanvas.width=Math.min(renderer.capabilities.maxTextureSize,qualityName==='low'?512:1024);skyCanvas.height=skyCanvas.width;atmosphere=createAtmosphere(T,scene,skyCanvas);cleanups.push(()=>atmosphere.dispose());
  cleanups.push(()=>Object.values(textures).forEach(t=>t.dispose()));campus=buildCampusScene(T,data,textures);scene.add(campus.root);walkWorld=createWalkWorld(data,campus.navigation);
  car=vehicleSpawn(walkWorld,campus.targets.find(p=>p.id==='lib'));if(car){carModel=createCampusCar(T,car);scene.add(carModel.root);}else $('drive-toggle').disabled=true;
  pedestrianWorld={...walkWorld,canStand:(x,z)=>walkWorld.canStand(x,z)&&(!car||canWalkPastVehicle(car,x,z))};
  pedestrianWorld.canOccupy=(x,z,feet)=>walkWorld.canOccupy(x,z,feet)&&(!car||feet>car.y+2.15||canWalkPastVehicle(car,x,z));
  character=createCampusCharacter(T);scene.add(character.root);lastCharacterPose=walkWorld.spawn(campus.targets.find(p=>p.id==='lib'));
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=1024;shadowCanvas.height=1024;
  staticShadow=createStaticShadowLayer(T,campus,shadowCanvas);cleanups.push(()=>staticShadow.dispose());waterClock=createWaterClock({isAllowed:canMoveWater,render:()=>{state.waterTick=true;requestRender();}});setLighting('daylight');
  const groups=new Map();campus.targets.forEach(p=>{const label=TYPE_LABELS[p.type];if(!groups.has(label))groups.set(label,[]);groups.get(label).push(p);});
  for(const[label,places]of groups){const group=document.createElement('optgroup');group.label=label;const seen=new Map();places.forEach(p=>{const n=(seen.get(p.name)||0)+1;seen.set(p.name,n);const option=document.createElement('option');option.value=p.key;option.textContent=p.name+(n>1?` · ${n}`:'');group.appendChild(option);});$('place-picker').appendChild(group);}
  const names=['lib','lake','track','canteen','apt-10','teach-1','gym','lib-north','plaza-east'];
  for(const place of [...campus.targets].sort((a,b)=>Number(names.includes(b.id))-Number(names.includes(a.id)))){const el=document.createElement('button');el.type='button';el.className='landmark';el.setAttribute('aria-label',`查看${place.name}`);const dot=document.createElement('i');const shortName=place.id==='lib'?'湖畔图书馆':place.id==='lib-north'?'图书馆':place.name.split(' · ')[0].replace('学生公寓','');el.append(dot,shortName);$('landmarks').appendChild(el);listen(el,'click',()=>{select(place,true);$('focus-place').focus({preventScroll:true});});landmarks.push({place,el,important:names.includes(place.id),width:80});}
  fit();view={...defaultView};setQuality(qualityName);updateSun();onResize();interactions();
  resizeObserver=new ResizeObserver(onResize);resizeObserver.observe(host);
  document.fonts?.ready.then(()=>{if(!state.disposed){measureLabels();requestRender();}});
  listen(window,'pagehide',e=>{if(!e.persisted)dispose();else{walkControls?.clear();walkControls?.releaseLock();waterClock?.stop();if(state.frame)cancelAnimationFrame(state.frame);state.frame=0;}});
  listen(window,'pageshow',()=>{if(!state.disposed)requestRender();});
  loading.hidden=true;requestRender();
  return dispose;
}catch(error){console.error('Campus 3D initialization:',error);dispose();fail(error.message||'场景加载失败，请返回网站或稍后重新加载。');return null;}
}
