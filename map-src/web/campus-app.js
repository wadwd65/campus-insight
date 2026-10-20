import './three-r149.min.js';
import {buildCampusScene,TYPE_LABELS} from './campus-scene.js';
import {QUALITY,initialQuality,constrainView,fitDistance,detailView,renderPlan,clipPlanes,clamp} from './campus-model.js';
import {LIGHTING,createStaticShadowLayer} from './campus-lighting.js';

export async function startCampus() {
const T=globalThis.THREE,$=id=>document.getElementById(id),host=$('scene'),loading=$('loading');
T.ColorManagement.legacyMode=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer: coarse)');
const state={disposed:false,contextLost:false,frame:0,frames:0,auto:false,flight:null,lastTime:0,selected:null,labels:true,slowFrames:0,dragging:false,interactionUntil:0,settleTimer:0,raster:null};
let renderer,campus,scene,camera,sun,ambientLight,staticShadow,resizeObserver,view,defaultView,qualityName,layout,selectionOutline,landmarks=[];
const cleanups=[];
function listen(el,event,fn,options){el.addEventListener(event,fn,options);cleanups.push(()=>el.removeEventListener(event,fn,options));}
function fail(message){
  loading.hidden=false;loading.replaceChildren();
  const title=document.createElement('b');title.textContent='暂时无法显示三维校园';
  const text=document.createElement('p');text.textContent=message;
  const retry=document.createElement('button');retry.textContent='重新加载';retry.onclick=()=>location.reload();
  const back=document.createElement('a');back.href='../..';back.textContent='返回网站';loading.append(title,text,retry,back);
}
function texture(draw,w=512,h=512,{scale=1,anisotropy=4}={}){const canvas=document.createElement('canvas'),size=n=>Math.min(renderer.capabilities.maxTextureSize,2**Math.ceil(Math.log2(n*scale)));canvas.width=size(w);canvas.height=size(h);const context=canvas.getContext('2d');context.scale(canvas.width/w,canvas.height/h);draw(context,w,h);const map=new T.CanvasTexture(canvas);map.encoding=T.sRGBEncoding;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),anisotropy);return map;}
function teachingTexture(c,w,h){
  const front=w*.75;c.fillStyle='#ceb18d';c.fillRect(0,0,w,h);
  for(let row=0;row<5;row++){
    const y=row*h/5+18,g=c.createLinearGradient(0,y,0,y+55);
    g.addColorStop(0,'#a0b9b6');g.addColorStop(.25,'#6e9292');g.addColorStop(1,'#385f63');
    c.fillStyle='#a28668';c.fillRect(10,y-3,front-20,59);c.fillStyle=g;c.fillRect(14,y,front-28,50);
    for(let col=0;col<10;col++){const x=14+col*(front-28)/10;c.fillStyle='#ddc4a1';c.fillRect(x-2,y-3,10,59);c.fillStyle='#dfdfc8';c.fillRect(x+35,y,2,50);c.fillStyle='#edf3e222';c.fillRect(x+10,y+3,24,8);}
    c.fillStyle='#f0e2c8';c.fillRect(0,y+53,front,6);c.fillStyle='#947d6333';c.fillRect(0,y+60,front,3);
    c.fillStyle='#e4d5b9';c.fillRect(front,y+10,w-front,3);
    for(const dx of [46,157]){c.fillStyle='#a28668';c.fillRect(front+dx-4,y-3,44,58);c.fillStyle=g;c.fillRect(front+dx,y,36,49);c.fillStyle='#f0e2c8';c.fillRect(front+dx-5,y+51,46,5);}
  }
  c.fillStyle='#eee4ce';c.fillRect(front+106,0,45,h);
}
function dormTexture(c,w,h){
  const front=w*.75;c.fillStyle='#d4c4a4';c.fillRect(0,0,w,h);
  for(let row=0;row<6;row++)for(let col=0;col<9;col++){
    const x=col*front/9+9,y=row*h/6+11,room=front/9-18;
    c.fillStyle='#a79b84';c.fillRect(x-3,y-3,room+6,59);
    const g=c.createLinearGradient(0,y,0,y+44);g.addColorStop(0,'#a0b6b2');g.addColorStop(.3,'#688b8c');g.addColorStop(1,'#365c60');c.fillStyle=g;c.fillRect(x,y,room,44);
    c.fillStyle='#e9e2cc';c.fillRect(x+room*.48,y,3,44);
    c.fillStyle='#e8dfc6';c.fillRect(x-4,y+41,room+8,15);c.fillStyle='#a79b84';c.fillRect(x-5,y+57,room+10,3);
    c.fillStyle='#798b7e';for(let k=0;k<6;k++)c.fillRect(x+2+k*(room-4)/6,y+44,1.5,9);
    if((col+row)%5===0){c.fillStyle='#799064';c.fillRect(x+room-15,y+43,12,5);c.fillStyle='#bb9173';c.fillRect(x+room-15,y+48,12,4);}
  }
  c.fillStyle='#e6d9be';c.fillRect(front,0,w-front,h);c.fillStyle='#d2bd9d';c.fillRect(front+90,0,76,h);
  for(let row=0;row<6;row++){
    const y=row*h/6+16;c.fillStyle='#6d9292';c.fillRect(front+106,y,44,37);c.fillStyle='#f3e9d1';c.fillRect(front+104,y+37,48,5);c.fillRect(front+127,y,2,37);
    c.fillStyle='#80999a';c.fillRect(front+26,y+7,22,21);c.fillRect(front+205,y+7,22,21);
  }
}
function roadTexture(c,w,h){
  c.fillStyle='#646969';c.fillRect(0,0,w,h);
  for(let i=0;i<4000;i++){c.fillStyle=i%2?'#ffffff06':'#15212b0a';c.fillRect((i*73%w),(i*127%h),1,1);}
  c.fillStyle='#d2d2bd';c.fillRect(3,0,1.5,h);c.fillRect(w-4.5,0,1.5,h);
  c.fillStyle='#ddc57f';for(let y=16;y<h;y+=64)c.fillRect(w/2-1,y,2,29);
}
function groundTexture(c,w,h){
  c.fillStyle='#8fa47b';c.fillRect(0,0,w,h);
  for(let i=0;i<75;i++){const x=(Math.sin(i*31.9)*.5+.5)*w,y=(Math.sin(i*13.7)*.5+.5)*h,r=30+i%7*19,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%3?'#557b5730':'#e0d1a22e');g.addColorStop(1,'#8fa47b00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
function trackTexture(c,w,h){
  c.fillStyle='#c8d3ae';c.fillRect(0,0,w,h);roundRect(c,18,12,w-36,h-24,180);c.fillStyle='#b77364';c.fill();
  for(let i=0;i<8;i++){const inset=26+i*7;roundRect(c,inset,inset,w-inset*2,h-inset*2,180-inset/2);c.strokeStyle='#efdfc8';c.lineWidth=1.5;c.stroke();}
  roundRect(c,83,80,w-166,h-160,118);c.fillStyle='#829e77';c.fill();
  for(let row=0;row<12;row++){c.fillStyle=row%2?'#618b64':'#769b6d';c.fillRect(122,155+row*(h-310)/12,w-244,(h-310)/12);}
  c.strokeStyle='#e4e9d1';c.lineWidth=3;c.strokeRect(122,155,w-244,h-310);c.beginPath();c.moveTo(122,h/2);c.lineTo(w-122,h/2);c.stroke();c.beginPath();c.arc(w/2,h/2,36,0,Math.PI*2);c.stroke();
  for(const side of [-1,1]){const y=side<0?155:h-155,dy=side<0?1:-1;c.strokeRect(w/2-68,Math.min(y,y+dy*67),136,67);c.strokeRect(w/2-32,Math.min(y,y+dy*25),64,25);c.beginPath();c.arc(w/2,y+dy*49,2,0,Math.PI*2);c.fillStyle='#e4e9d1';c.fill();}
}
function courtTexture(c,w,h){c.fillStyle='#adc3cd';c.fillRect(0,0,w,h);c.fillStyle='#739aab';c.fillRect(35,50,w-70,h-100);c.strokeStyle='#eef0dc';c.lineWidth=2;c.strokeRect(35,50,w-70,h-100);c.strokeRect(56,50,w-112,h-100);c.strokeRect(56,h*.28,w-112,h*.44);c.beginPath();c.moveTo(35,h/2);c.lineTo(w-35,h/2);c.moveTo(w/2,h*.28);c.lineTo(w/2,h*.72);c.stroke();}
function basketballTexture(c,w,h){
  c.fillStyle='#6d9f77';c.fillRect(0,0,w,h);c.fillStyle='#bd677b';c.fillRect(w*.32,24,w*.36,h*.2);c.fillRect(w*.32,h*.8-24,w*.36,h*.2);c.beginPath();c.arc(w/2,h/2,w*.12,0,Math.PI*2);c.fill();
  c.strokeStyle='#efe9d5';c.lineWidth=2;c.strokeRect(22,24,w-44,h-48);c.beginPath();c.moveTo(22,h/2);c.lineTo(w-22,h/2);c.stroke();
  for(const y of [h*.22,h*.78]){c.beginPath();c.arc(w/2,y,w*.17,0,Math.PI*2);c.stroke();}
  c.strokeRect(w*.32,24,w*.36,h*.2);c.strokeRect(w*.32,h*.8-24,w*.36,h*.2);
}
function badmintonTexture(c,w,h){c.fillStyle='#93b293';c.fillRect(0,0,w,h);c.strokeStyle='#f0f0d9';c.lineWidth=2;for(let col=0;col<2;col++)for(let row=0;row<2;row++){const x=col*w/2+18,y=row*h/2+24,cw=w/2-36,ch=h/2-48;c.strokeRect(x,y,cw,ch);c.beginPath();c.moveTo(x,y+ch/2);c.lineTo(x+cw,y+ch/2);c.moveTo(x+cw/2,y);c.lineTo(x+cw/2,y+ch);c.stroke();}}
function libraryStoneTexture(c,w,h){
  c.fillStyle='#d8c9ae';c.fillRect(0,0,w,h);
  for(let row=0;row<32;row++)for(let col=0;col<16;col++){
    const x=col*64+(row%2)*32,y=row*16;
    c.fillStyle=`rgba(255,250,224,${.04+(row*17+col*13)%9*.009})`;c.fillRect(x,y,62,14);
    c.strokeStyle='#bbae9638';c.lineWidth=.6;c.strokeRect(x,y,64,16);
  }
  for(let floor=0;floor<4;floor++){
    const y=floor*128+27,g=c.createLinearGradient(0,y,w,y+65);
    g.addColorStop(0,'#36565a');g.addColorStop(.32,'#73908f');g.addColorStop(.5,'#a4b6a9');g.addColorStop(.64,'#617e82');g.addColorStop(1,'#3f6064');
    c.fillStyle='#a8977d';c.fillRect(14,y-3,w-28,70);c.fillStyle=g;c.fillRect(18,y,w-36,61);
    for(let col=0;col<12;col++){c.fillStyle='#e5d8bf';c.fillRect(18+col*84,y-2,7,67);c.fillStyle='#2c47472e';c.fillRect(25+col*84,y,3,61);}
    c.fillStyle='#f0e6cf';c.fillRect(0,y+65,w,7);c.fillStyle='#998f7a';c.fillRect(0,y+72,w,2);
  }
}
function libraryGlassTexture(c,w,h){
  const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#a5bfc0');g.addColorStop(.3,'#718f96');g.addColorStop(.7,'#3e6269');g.addColorStop(1,'#24464c');c.fillStyle=g;c.fillRect(0,0,w,h);
  c.fillStyle='#dbe8da22';c.beginPath();c.moveTo(0,0);c.lineTo(w*.4,0);c.lineTo(w,h);c.lineTo(w*.6,h);c.fill();
  for(let x=0;x<w;x+=w/9){c.fillStyle='#cbd2c277';c.fillRect(x,0,3,h);c.fillStyle='#203d4244';c.fillRect(x+3,0,2,h);}
  for(let y=0;y<h;y+=h/5){c.fillStyle='#b4c2b8';c.fillRect(0,y,w,5);c.fillStyle='#203d4266';c.fillRect(0,y+5,w,5);}
}
function waterTexture(c,w,h){
  const g=c.createRadialGradient(w*.52,h*.45,15,w*.52,h*.45,w*.7);g.addColorStop(0,'#376a74');g.addColorStop(.55,'#518a8f');g.addColorStop(1,'#a2c1ad');c.fillStyle=g;c.fillRect(0,0,w,h);
  for(let i=0;i<130;i++){
    const x=(Math.sin(i*9.73)*.5+.5)*w,y=(Math.sin(i*4.81+2)*.5+.5)*h,length=12+(i*19%65);
    c.strokeStyle=`rgba(213,235,223,${.05+i%4*.025})`;c.lineWidth=1+i%2*.4;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+length*.5,y-2,x+length,y);c.stroke();
  }
  const reflection=c.createRadialGradient(w*.35,h*.25,0,w*.35,h*.25,w*.55);reflection.addColorStop(0,'#dfe6c929');reflection.addColorStop(1,'#dfe6c900');c.fillStyle=reflection;c.fillRect(0,0,w,h);
}
function timberTexture(c,w,h){c.fillStyle='#b89870';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=16){c.fillStyle=y%32?'#d3b68b':'#c4a47c';c.fillRect(0,y,w,14);c.fillStyle='#796548';c.fillRect(0,y+14,w,2);for(let n=0;n<5;n++){c.strokeStyle='#856b4826';c.beginPath();c.moveTo(0,y+2+n*2);c.bezierCurveTo(w*.3,y+n*2,w*.65,y+7+n,w,y+2+n*2);c.stroke();}}}
function contactTexture(c,w,h){c.clearRect(0,0,w,h);const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(.5,'rgba(255,255,255,.45)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);}
function librarySignTexture(c,w,h){c.fillStyle='#38534e';c.fillRect(0,0,w,h);c.fillStyle='#f6ecd1';c.textAlign='center';c.font='500 42px "Microsoft YaHei",sans-serif';c.fillText('图 书 馆',w/2,52);c.fillStyle='#b8cbb7';c.font='11px sans-serif';c.fillText('LIBRARY · A PLACE TO SLOW DOWN',w/2,77);}
function roofMetalTexture(c,w,h){const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#779399');g.addColorStop(.5,'#526f78');g.addColorStop(1,'#3b5561');c.fillStyle=g;c.fillRect(0,0,w,h);for(let x=0;x<w;x+=10){c.fillStyle='#293f4c55';c.fillRect(x,0,1.5,h);c.fillStyle='#c2d3cc66';c.fillRect(x+1.5,0,.8,h);}c.fillStyle='#e5e4d9';c.fillRect(w*.87,0,w*.13,h);}
function pavingTexture(c,w,h){c.fillStyle='#c9c8bb';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=12)for(let x=0;x<w;x+=24){c.fillStyle=`rgba(247,245,231,${.12+(x*7+y*11)%5*.025})`;c.fillRect(x+(y%24?12:0),y,23.5,11.5);c.strokeStyle='#8e968b55';c.lineWidth=.45;c.strokeRect(x+(y%24?12:0),y,24,12);}}

function requestRender(){if(!state.frame&&!state.disposed&&!state.contextLost&&!document.hidden)state.frame=requestAnimationFrame(render);}
function pulseInteraction(){
  state.interactionUntil=performance.now()+170;clearTimeout(state.settleTimer);
  state.settleTimer=setTimeout(()=>{state.settleTimer=0;requestRender();},180);requestRender();
}
function applyRaster(moving){
  const plan=renderPlan({width:host.clientWidth,height:host.clientHeight,quality:qualityName,moving,maxSide:renderer.capabilities.maxTextureSize});
  const old=state.raster;
  if(!old||old.width!==plan.width||old.height!==plan.height||old.dpr!==plan.dpr)renderer.setDrawingBufferSize(plan.width,plan.height,plan.dpr);
  state.raster=plan;
}
function measureLabels(){
  const hidden=landmarks.map(item=>item.el.hidden);landmarks.forEach(item=>{item.el.hidden=false;});
  const widths=landmarks.map(item=>item.el.offsetWidth);
  landmarks.forEach((item,i)=>{item.width=widths[i]||item.width;item.el.hidden=hidden[i];});
}
function applyView(){
  view=constrainView(view);const r=Math.cos(view.elevation)*view.distance;
  const clips=clipPlanes(view.distance);if(camera.near!==clips.near||camera.far!==clips.far){camera.near=clips.near;camera.far=clips.far;camera.updateProjectionMatrix();}
  camera.position.set(view.x+Math.sin(view.azimuth)*r,Math.sin(view.elevation)*view.distance,view.z+Math.cos(view.azimuth)*r);
  camera.lookAt(view.x,4,view.z);camera.updateMatrixWorld();
  document.querySelector('.compass svg').style.transform=`rotate(${-view.azimuth*180/Math.PI}deg)`;
}
function project(position,el,width,height){
  const point=position.clone().project(camera);
  el.hidden=point.z>1||point.z< -1||Math.abs(point.x)>1.05||Math.abs(point.y)>1.1;
  if(!el.hidden){el.style.left=`${(point.x*.5+.5)*width}px`;el.style.top=`${(-point.y*.5+.5)*height}px`;}
  return {x:(point.x*.5+.5)*width,y:(-point.y*.5+.5)*height};
}
function updateLabels(){
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
  const moving=state.auto||state.flight;
  if(moving&&time-state.lastTime<32){requestRender();return;}
  const delta=Math.min(.06,(time-state.lastTime)/1000||0);state.lastTime=time;
  if(state.auto)view.azimuth+=delta*.085;
  if(state.flight){const f=state.flight,t=clamp((time-f.start)/f.duration,0,1),k=1-Math.pow(1-t,3);for(const key of ['x','z','distance','azimuth','elevation'])view[key]=f.from[key]+(f.to[key]-f.from[key])*k;if(t>=1)state.flight=null;}
  applyRaster(!!(state.auto||state.flight||state.dragging||time<state.interactionUntil));applyView();
  const before=performance.now();renderer.render(scene,camera);const elapsed=performance.now()-before;
  state.frames++;updateLabels();
  const info=renderer.info;
  Object.assign($('runtime').dataset,{frames:String(state.frames),calls:String(info.render.calls),triangles:String(info.render.triangles),geometries:String(info.memory.geometries),textures:String(info.memory.textures),quality:qualityName,continuous:String(!!(state.auto||state.flight)),shadowMode:'static-atlas',shadowBakes:String(staticShadow?.bakes||0),renderMs:elapsed.toFixed(1),rasterMode:state.raster.mode,dpr:String(state.raster.dpr),bufferWidth:String(state.raster.pixelWidth),bufferHeight:String(state.raster.pixelHeight)});
  $('runtime').textContent=`${state.raster.mode==='moving'?'轻量交互':'静止清晰'} · ${state.raster.pixelWidth} × ${state.raster.pixelHeight} · ${campus.metrics.placeGroups} 处地点`;
  if(elapsed>45)state.slowFrames++;else state.slowFrames=Math.max(0,state.slowFrames-1);
  if(state.slowFrames>=12&&qualityName!=='low'){setQuality('low');$('announce').textContent='已降低画面质量，以减少设备负担。';state.slowFrames=0;}
  if(state.auto||state.flight)requestRender();
}
function stopMotion(){state.auto=false;state.flight=null;$('auto').setAttribute('aria-pressed','false');$('auto').querySelector('span').textContent='关闭';}
function flyTo(to){stopMotion();if(reduced.matches){view={...to};requestRender();return;}state.flight={from:{...view},to:{...to},start:performance.now(),duration:coarse.matches?400:600};requestRender();}
function fit(){defaultView={x:0,z:0,distance:fitDistance(host.clientWidth/Math.max(1,host.clientHeight)),azimuth:0,elevation:1.08};}
function select(place,focus=false){
  state.selected=place;
  selectionOutline.visible=['dorm','teaching','library','gym','canteen','shop','pavilion'].includes(place.type);selectionOutline.position.set(place.x,.9,place.z);selectionOutline.rotation.y=place.rotation||0;selectionOutline.scale.set(place.width+3,1,place.depth+3);
  $('place-card').hidden=false;$('place-title').textContent=place.name;$('place-category').textContent=TYPE_LABELS[place.type];$('place-description').textContent=place.description;
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
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===name)));
  $('view-name').textContent={overview:'艺术化校园全景',lake:'书香湖畔',teaching:'教学街区',dorm:'生活院落',sport:'运动日常',plan:'俯瞰核对'}[name];
  if(name==='overview'){clearSelection();flyTo(defaultView);return;}
  if(name==='plan'){clearSelection();flyTo({...defaultView,azimuth:0,elevation:1.45});return;}
  const place=campus.targets.find(p=>name==='teaching'?p.id==='teach-3':name==='sport'?p.id==='gym':p.type===name);
  if(place){const preset=layout.views[name],{px,py,...cameraView}=preset;select(place);flyTo({...defaultView,x:(px-layout.transform.ox)*layout.transform.k,z:(py-layout.transform.oz)*layout.transform.k,...cameraView});}
}
function setQuality(name){
  qualityName=QUALITY[name]?name:'low';$('quality').value=qualityName;
  renderer.shadowMap.enabled=false;sun.castShadow=false;requestRender();
}
function setLighting(name){
  const mood=LIGHTING[name]||LIGHTING.daylight;$('lighting').value=LIGHTING[name]?name:'daylight';
  ambientLight.color.setHex(mood.sky);ambientLight.groundColor.setHex(mood.bounce);ambientLight.intensity=mood.ambient;
  sun.color.setHex(mood.sun);sun.intensity=mood.strength;renderer.toneMappingExposure=mood.exposure;
  campus.materials.ground.color.setHex(mood.ground);campus.materials.roof.color.setHex(mood.roof);campus.materials.libraryStone.color.setHex(mood.stone);
  staticShadow.material.opacity=mood.shadowOpacity;$('light-name').textContent=mood.label;requestRender();
}
function updateSun(){const angle=Number($('sun').value)*Math.PI/180;sun.position.set(Math.cos(angle)*260,400,Math.sin(angle)*260);sun.updateMatrixWorld();staticShadow.bake(angle);requestRender();}
function onResize(){
  if(!camera||state.disposed)return;
  camera.aspect=host.clientWidth/Math.max(1,host.clientHeight);camera.updateProjectionMatrix();
  const old=defaultView?.distance;fit();
  const preset=document.querySelector('[data-preset][aria-pressed="true"]')?.dataset.preset;
  const overview=['overview','plan'].includes(preset)&&!state.selected&&!state.auto;
  if(overview){state.flight=null;view={...defaultView,...(preset==='plan'?{elevation:1.45}: {})};}else if(old&&Math.abs(view.distance-old)<1)view.distance=defaultView.distance;
  measureLabels();pulseInteraction();
}

function interactions(){
  const canvas=renderer.domElement,pointers=new Map(),ray=new T.Raycaster(),pointer=new T.Vector2();let down=null,gesture=null;
  function gestureValues(){const p=[...pointers.values()];return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};}
  function pan(dx,dy){const scale=view.distance/Math.max(1,host.clientHeight)*.65;view.x+=(-dx*Math.cos(view.azimuth)-dy*Math.sin(view.azimuth))*scale;view.z+=(dx*Math.sin(view.azimuth)-dy*Math.cos(view.azimuth))*scale;}
  listen(canvas,'pointerdown',e=>{if(e.button>2)return;stopMotion();state.dragging=true;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});down={x:e.clientX,y:e.clientY,moved:false,button:e.button};if(pointers.size>1){gesture=gestureValues();down.moved=true;}canvas.classList.add('is-dragging');pulseInteraction();});
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
  listen(canvas,'wheel',e=>{e.preventDefault();stopMotion();view.distance*=Math.exp(clamp(e.deltaY,-120,120)*.0015);pulseInteraction();},{passive:false});
  listen(canvas,'dblclick',()=>setPreset('overview'));
  listen(canvas,'keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home','Escape'].includes(e.key))return;e.preventDefault();stopMotion();if(e.key==='Home'){setPreset('overview');return;}if(e.key==='Escape'){clearSelection();return;}if(e.key==='ArrowLeft')view.azimuth-=.12;if(e.key==='ArrowRight')view.azimuth+=.12;if(e.key==='ArrowUp')view.elevation+=.08;if(e.key==='ArrowDown')view.elevation-=.08;if(e.key==='+'||e.key==='=')view.distance*=.85;if(e.key==='-')view.distance*=1.18;pulseInteraction();});
  document.querySelectorAll('[data-preset]').forEach(button=>listen(button,'click',()=>setPreset(button.dataset.preset)));
  listen($('place-picker'),'change',()=>{const place=campus.targets.find(p=>p.key===$('place-picker').value);if(place)select(place,true);else clearSelection();});
  listen($('close-place'),'click',clearSelection);listen($('focus-place'),'click',()=>state.selected&&select(state.selected,true));
  listen($('other-side'),'click',()=>{if(!state.selected)return;const p=state.selected,azimuth=state.flight?.to.azimuth??view.azimuth;activateDetail(p);flyTo({...detailView(p,view),azimuth:azimuth+Math.PI/2});$('announce').textContent=`正在查看${p.name}的另一侧。`;});
  listen($('roof-view'),'click',()=>{if(!state.selected)return;activateDetail(state.selected);flyTo(detailView(state.selected,view,{roof:true}));$('announce').textContent=`正在俯看${state.selected.name}的${$('roof-view').dataset.caption}。`;});
  listen($('zoom-in'),'click',()=>{stopMotion();view.distance*=.8;pulseInteraction();});listen($('zoom-out'),'click',()=>{stopMotion();view.distance*=1.25;pulseInteraction();});
  listen($('rotate-left'),'click',()=>{stopMotion();view.azimuth-=Math.PI/6;pulseInteraction();});listen($('reset'),'click',()=>setPreset('overview'));
  listen($('toggle-guide'),'click',()=>{const open=$('toggle-guide').getAttribute('aria-expanded')==='true';$('toggle-guide').setAttribute('aria-expanded',String(!open));$('toggle-guide').textContent=open?'展开导览 ＋':'收起导览 −';$('campus-guide').hidden=open;document.querySelector('.explorer').classList.toggle('guide-collapsed',open);});
  listen($('quality'),'change',()=>setQuality($('quality').value));listen($('sun'),'change',updateSun);
  listen($('lighting'),'change',()=>setLighting($('lighting').value));
  listen($('shade'),'click',()=>{const visible=!staticShadow.layer.visible;staticShadow.layer.visible=visible;$('shade').setAttribute('aria-pressed',String(visible));$('shade').querySelector('span').textContent=visible?'开启':'关闭';requestRender();});
  listen($('labels'),'click',()=>{state.labels=!state.labels;$('labels').setAttribute('aria-pressed',String(state.labels));$('labels').querySelector('span').textContent=state.labels?'开启':'关闭';requestRender();});
  listen($('auto'),'click',()=>{state.flight=null;state.auto=!state.auto;$('auto').setAttribute('aria-pressed',String(state.auto));$('auto').querySelector('span').textContent=state.auto?'开启':'关闭';requestRender();});
  listen(document,'visibilitychange',()=>{if(document.hidden){if(state.frame)cancelAnimationFrame(state.frame);state.frame=0;state.lastTime=0;}else requestRender();});
  listen(reduced,'change',()=>{if(reduced.matches){stopMotion();setQuality('low');}requestRender();});
  listen(window,'blur',()=>{pointers.clear();gesture=null;down=null;state.dragging=false;canvas.classList.remove('is-dragging');pulseInteraction();});
  listen(canvas,'webglcontextlost',e=>{e.preventDefault();state.contextLost=true;if(state.frame)cancelAnimationFrame(state.frame);state.frame=0;fail('设备暂停了图形绘制。可尝试关闭其他高负载页面后重新加载。');});
  listen(canvas,'webglcontextrestored',()=>location.reload());
}
function dispose(){if(state.disposed)return;state.disposed=true;clearTimeout(state.settleTimer);if(state.frame)cancelAnimationFrame(state.frame);resizeObserver?.disconnect();cleanups.forEach(fn=>fn());campus?.dispose();scene?.traverse(o=>{if(o.isLight)o.dispose?.();});renderer?.dispose();renderer?.domElement.remove();$('landmarks').replaceChildren();$('place-card').hidden=true;$('selection-marker').hidden=true;}

try{
  // Responsive unmount/remount starts from a coherent UI, not stale switch captions.
  for(const [id,on]of [['shade',true],['labels',true],['auto',false]]){$(id).setAttribute('aria-pressed',String(on));$(id).querySelector('span').textContent=on?'开启':'关闭';}
  $('sun').value='220';$('place-picker').value='';$('view-name').textContent='艺术化校园全景';
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset==='overview')));
  $('place-picker').querySelectorAll('optgroup').forEach(group=>group.remove());
  const response=await fetch('./campus-data.json');if(!response.ok)throw new Error('校园布局暂时无法读取，请稍后重试。');const data=await response.json();
  layout=data;
  try{renderer=new T.WebGLRenderer({antialias:!coarse.matches,alpha:true,powerPreference:'low-power'});}catch{throw new Error('此设备未能启用 WebGL。请使用支持硬件加速的浏览器，其他网站功能仍可正常使用。');}
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
  const textures={teaching:texture(teachingTexture,1024,512,{scale:facadeScale,anisotropy:8}),dorm:texture(dormTexture,1024,512,{scale:facadeScale,anisotropy:8}),ground:texture(groundTexture,1024,1024),road:texture(roadTexture,128,1024),basketball:texture(basketballTexture,256,512),badminton:texture(badmintonTexture,256,512),track:texture(trackTexture,512,768),court:texture(courtTexture,256,512),libraryStone:texture(libraryStoneTexture,1024,512),libraryGlass:texture(libraryGlassTexture,512,1024),water:texture(waterTexture,1024,512),timber:texture(timberTexture,256,256),librarySign:texture(librarySignTexture,512,96,{scale:facadeScale}),roofMetal:texture(roofMetalTexture,512,512,{anisotropy:8}),paving:texture(pavingTexture,512,128)};
  cleanups.push(()=>Object.values(textures).forEach(t=>t.dispose()));campus=buildCampusScene(T,data,textures);scene.add(campus.root);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=1024;shadowCanvas.height=1024;
  staticShadow=createStaticShadowLayer(T,campus,shadowCanvas);cleanups.push(()=>staticShadow.dispose());setLighting('daylight');
  const groups=new Map();campus.targets.forEach(p=>{const label=TYPE_LABELS[p.type];if(!groups.has(label))groups.set(label,[]);groups.get(label).push(p);});
  for(const[label,places]of groups){const group=document.createElement('optgroup');group.label=label;const seen=new Map();places.forEach(p=>{const n=(seen.get(p.name)||0)+1;seen.set(p.name,n);const option=document.createElement('option');option.value=p.key;option.textContent=p.name+(n>1?` · ${n}`:'');group.appendChild(option);});$('place-picker').appendChild(group);}
  const names=['lib','lake','track','canteen','apt-10','teach-1','gym','lib-north','plaza-east'];
  for(const place of [...campus.targets].sort((a,b)=>Number(names.includes(b.id))-Number(names.includes(a.id)))){const el=document.createElement('button');el.type='button';el.className='landmark';el.setAttribute('aria-label',`查看${place.name}`);const dot=document.createElement('i');const shortName=place.id==='lib'?'湖畔图书馆':place.id==='lib-north'?'图书馆':place.name.split(' · ')[0].replace('学生公寓','');el.append(dot,shortName);$('landmarks').appendChild(el);listen(el,'click',()=>{select(place,true);$('focus-place').focus({preventScroll:true});});landmarks.push({place,el,important:names.includes(place.id),width:80});}
  fit();view={...defaultView};setQuality(qualityName);updateSun();onResize();interactions();
  resizeObserver=new ResizeObserver(onResize);resizeObserver.observe(host);
  document.fonts?.ready.then(()=>{if(!state.disposed){measureLabels();requestRender();}});
  listen(window,'pagehide',e=>{if(!e.persisted)dispose();else{if(state.frame)cancelAnimationFrame(state.frame);state.frame=0;}});
  listen(window,'pageshow',()=>{if(!state.disposed)requestRender();});
  loading.hidden=true;requestRender();
  return dispose;
}catch(error){console.error('Campus 3D initialization:',error);dispose();fail(error.message||'场景加载失败，请返回网站或稍后重新加载。');return null;}
}
