import {clamp,insidePolygon,segmentDistance} from './campus-model.js';

export const WALK={eyeHeight:1.75,radius:.5,speed:5.6,fastSpeed:9.2,fov:67,near:.12,far:1200,gravity:18,jumpSpeed:6.7,airJumpSpeed:16,maxJumps:2};
const BUILDING_TYPES=new Set(['dorm','teaching','library','gym','canteen','shop','pavilion']);
const MOVE_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
const polygonEdges=points=>points.map((a,i)=>[a,points[(i+1)%points.length]]);
function edgeDistance(x,z,edges){let distance=Infinity;for(const[a,b]of edges)distance=Math.min(distance,segmentDistance(x,z,a,b));return distance;}
function nearestPoint(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return {x:a[0]+dx*t,z:a[1]+dz*t};}

// The walking world uses the already-built wall volumes, including open portal
// jambs. It does not close courtyards with whole-building bounding rectangles.
export function createWalkWorld(data,{solids=[],trees=[],stadium=null,surfaces=[]}={}){
  const coord=([x,z])=>[(x-data.transform.ox)*data.transform.k,(z-data.transform.oz)*data.transform.k];
  const boundary=data.boundary.map(coord),lake=data.lake.map(coord),boundaryEdges=polygonEdges(boundary),lakeEdges=polygonEdges(lake);
  const center=lake.reduce((a,p)=>[a[0]+p[0]/lake.length,a[1]+p[1]/lake.length],[0,0]),shore=lake.map(p=>[center[0]+(p[0]-center[0])*1.11,center[1]+(p[1]-center[1])*1.11]),shoreEdges=polygonEdges(shore);
  const roads=data.roads.flatMap(r=>r.pts.slice(1).map((p,i)=>({a:coord(r.pts[i]),b:coord(p),width:r.w})));
  const deck=data.deck?coord([data.deck.px,data.deck.py]):null,obstacles=[],lookVolumes=[],grid=new Map(),cellSize=12;
  function localPoint(x,z,o){const dx=x-o.x,dz=z-o.z,angle=o.rotation||0;return {x:dx*Math.cos(angle)-dz*Math.sin(angle),z:dx*Math.sin(angle)+dz*Math.cos(angle)};}
  for(const p of solids){
    if(p.kind==='portal'){
      for(const side of [-1,1]){const dx=side*p.w*.4675;lookVolumes.push({...p,x:p.x+dx*Math.cos(p.rotation),z:p.z-dx*Math.sin(p.rotation),w:p.w*.065});}
      lookVolumes.push({...p,y:p.y+p.h*.45,h:p.h*.1});
    }else lookVolumes.push(p);
  }
  function insert(o){
    const c=Math.cos(o.rotation||0),s=Math.sin(o.rotation||0),rx=o.radius??(Math.abs(c)*o.w+Math.abs(s)*o.d)/2,rz=o.radius??(Math.abs(s)*o.w+Math.abs(c)*o.d)/2;
    o.cos=c;o.sin=s;obstacles.push(o);
    for(let x=Math.floor((o.x-rx)/cellSize);x<=Math.floor((o.x+rx)/cellSize);x++)for(let z=Math.floor((o.z-rz)/cellSize);z<=Math.floor((o.z+rz)/cellSize);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(o);}
  }
  for(const p of solids){
    if(p.kind==='portal'){
      for(const side of [-1,1]){const dx=side*p.w*.4675;insert({...p,x:p.x+dx*Math.cos(p.rotation),z:p.z-dx*Math.sin(p.rotation),w:p.w*.065});}
    }else if(['brick','sand','white','libraryStone','libraryGlass','glass'].includes(p.material)||p.key==='track'&&p.material==='curb'){
      if(p.kind==='facade'||p.kind==='dormFacade'||p.kind==='box')insert({...p,w:p.w*(p.kind==='dormFacade'?1.15:1.035)});
    }
  }
  for(const p of trees)insert({x:p.x,z:p.z,radius:.48,y:3,h:6,key:'tree'});
  const roofs=surfaces.map(s=>({...s,top:s.top??s.y+s.h/2}));
  for(const p of roofs){insert(p);lookVolumes.push(p);}
  function onDeck(x,z,radius=0){return deck&&Math.abs(x-deck[0])<=6.5-radius&&Math.abs(z-deck[1])<=8.5-radius;}
  function floorAt(x,z){
    if(onDeck(x,z))return 1.2;
    if(edgeDistance(x,z,shoreEdges)<=2.15)return .96;
    if(stadium&&insidePolygon(x,z,stadium.outline))return .71;
    if(stadium&&insidePolygon(x,z,stadium.podium))return .38;
    for(const r of roads){const d=segmentDistance(x,z,r.a,r.b);if(d<=r.width/2)return .375;if(d<=r.width/2+2.5)return .26;}
    return .04;
  }
  function canStand(x,z){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!insidePolygon(x,z,boundary)||edgeDistance(x,z,boundaryEdges)<WALK.radius)return false;
    if(!onDeck(x,z,WALK.radius)&&(insidePolygon(x,z,lake)||edgeDistance(x,z,lakeEdges)<WALK.radius))return false;
    const floor=floorAt(x,z),seen=new Set();
    for(let gx=Math.floor((x-WALK.radius)/cellSize);gx<=Math.floor((x+WALK.radius)/cellSize);gx++)for(let gz=Math.floor((z-WALK.radius)/cellSize);gz<=Math.floor((z+WALK.radius)/cellSize);gz++)for(const o of grid.get(gx+','+gz)||[]){
      if(seen.has(o))continue;seen.add(o);if(o.y+o.h/2<floor+.15||o.y-o.h/2>floor+WALK.eyeHeight+.15)continue;
      if(o.radius!==undefined){if(Math.hypot(x-o.x,z-o.z)<WALK.radius+o.radius)return false;continue;}
      const dx=x-o.x,dz=z-o.z,lx=dx*o.cos-dz*o.sin,lz=dx*o.sin+dz*o.cos;
      if(Math.hypot(Math.max(0,Math.abs(lx)-o.w/2),Math.max(0,Math.abs(lz)-o.d/2))<WALK.radius)return false;
    }
    return true;
  }
  function spawn(focus){
    const goal=focus||{x:center[0],z:center[1]},candidates=[];
    if(!focus||['library','lake'].includes(focus.type))for(const[a,b]of shoreEdges)candidates.push({...nearestPoint(goal.x,goal.z,a,b),group:0});
    for(const r of roads)candidates.push({...nearestPoint(goal.x,goal.z,r.a,r.b),group:1});
    candidates.sort((a,b)=>a.group-b.group||Math.hypot(a.x-goal.x,a.z-goal.z)-Math.hypot(b.x-goal.x,b.z-goal.z));
    for(const r of roads)for(const t of [.25,.5,.75])candidates.push({x:r.a[0]+(r.b[0]-r.a[0])*t,z:r.a[1]+(r.b[1]-r.a[1])*t});
    for(const p of candidates)if(canStand(p.x,p.z))return {x:p.x,z:p.z,y:floorAt(p.x,p.z)+WALK.eyeHeight,yaw:Math.atan2(goal.x-p.x,p.z-goal.z),pitch:.035,settling:false};
    return null;
  }
  function ceilingAt(x,z,feet=floorAt(x,z)){
    let ceiling=Infinity;const floor=feet;
    for(const o of lookVolumes){const bottom=o.y-o.h/2;if(bottom<floor+WALK.eyeHeight+.1||bottom>=ceiling)continue;const p=localPoint(x,z,o);if(Math.abs(p.x)<o.w/2+WALK.radius&&Math.abs(p.z)<o.d/2+WALK.radius)ceiling=bottom;}
    return ceiling;
  }
  function roofAt(x,z,limit=Infinity){
    let roof=null;
    for(const o of roofs){if(o.top>limit+.001||roof&&o.top<=roof.top)continue;const p=localPoint(x,z,o);if(Math.hypot(Math.max(0,Math.abs(p.x)-o.w/2),Math.max(0,Math.abs(p.z)-o.d/2))<WALK.radius)roof=o;}
    return roof;
  }
  function supportAt(x,z,limit){
    let height=Math.max(floorAt(x,z),roofAt(x,z,limit)?.top??-Infinity);const seen=new Set();
    // Solid ledges and wall tops also support the feet. Otherwise a descent
    // beside an inset roof can get wedged against its wider facade forever.
    for(let gx=Math.floor((x-WALK.radius)/cellSize);gx<=Math.floor((x+WALK.radius)/cellSize);gx++)for(let gz=Math.floor((z-WALK.radius)/cellSize);gz<=Math.floor((z+WALK.radius)/cellSize);gz++)for(const o of grid.get(gx+','+gz)||[]){
      if(seen.has(o))continue;seen.add(o);const top=o.y+o.h/2;if(top>limit+.001||top<=height)continue;
      const p=localPoint(x,z,o),overlap=o.radius!==undefined?Math.hypot(p.x,p.z)<WALK.radius+o.radius:Math.hypot(Math.max(0,Math.abs(p.x)-o.w/2),Math.max(0,Math.abs(p.z)-o.d/2))<WALK.radius;
      if(overlap)height=top;
    }
    return height;
  }
  function canOccupy(x,z,feet){
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(feet)||!insidePolygon(x,z,boundary)||edgeDistance(x,z,boundaryEdges)<WALK.radius)return false;
    if(!onDeck(x,z,WALK.radius)&&(insidePolygon(x,z,lake)||edgeDistance(x,z,lakeEdges)<WALK.radius))return false;
    const seen=new Set();
    for(let gx=Math.floor((x-WALK.radius)/cellSize);gx<=Math.floor((x+WALK.radius)/cellSize);gx++)for(let gz=Math.floor((z-WALK.radius)/cellSize);gz<=Math.floor((z+WALK.radius)/cellSize);gz++)for(const o of grid.get(gx+','+gz)||[]){
      if(seen.has(o))continue;seen.add(o);if(o.y+o.h/2<=feet+.025||o.y-o.h/2>=feet+WALK.eyeHeight+.15)continue;
      if(o.radius!==undefined){if(Math.hypot(x-o.x,z-o.z)<WALK.radius+o.radius)return false;continue;}
      const p=localPoint(x,z,o);if(Math.hypot(Math.max(0,Math.abs(p.x)-o.w/2),Math.max(0,Math.abs(p.z)-o.d/2))<WALK.radius)return false;
    }
    return true;
  }
  return {canStand,canOccupy,supportAt,roofAt,roofs,floorAt,ceilingAt,spawn,lookVolumes,obstacles,boundary,lake,roads,shore};
}

export function findWalkTarget(world,targets,player,range=32){
  const c=Math.cos(player.pitch),direction={x:Math.sin(player.yaw)*c,y:Math.sin(player.pitch),z:-Math.cos(player.yaw)*c};
  let nearest=null,limit=range;
  for(const o of world.lookVolumes){
    const cos=Math.cos(o.rotation||0),sin=Math.sin(o.rotation||0),dx=player.x-o.x,dz=player.z-o.z;
    const origin=[dx*cos-dz*sin,player.y-o.y,dx*sin+dz*cos],ray=[direction.x*cos-direction.z*sin,direction.y,direction.x*sin+direction.z*cos],size=[o.w/2,o.h/2,o.d/2];
    let near=0,far=limit;
    for(let i=0;i<3;i++){
      if(Math.abs(ray[i])<1e-8){if(Math.abs(origin[i])>size[i]){far=-1;break;}}
      else{let a=(-size[i]-origin[i])/ray[i],b=(size[i]-origin[i])/ray[i];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);}
      if(near>far)break;
    }
    if(far>=near&&near<limit){limit=near;nearest=o;}
  }
  const place=nearest&&targets.find(t=>t.key===nearest.key&&BUILDING_TYPES.has(t.type));
  return place?{place,distance:limit}:null;
}

export function jumpWalk(player){
  const used=player.airborne?(player.jumpsUsed??1):0;if(used>=WALK.maxJumps)return false;
  player.groundY??=player.y;player.jumpOffset=player.y-player.groundY;player.verticalSpeed=used?WALK.airJumpSpeed:WALK.jumpSpeed;player.jumpsUsed=used+1;player.airborne=true;player.settling=true;return true;
}
export function walkIntent(keys){return {forward:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),right:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),fast:keys.has('ShiftLeft')||keys.has('ShiftRight')};}
export function hasWalkInput(keys){const i=walkIntent(keys);return !!(i.forward||i.right);}
export function turnWalk(player,dx,dy){player.yaw=((player.yaw+dx*.0026+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;player.pitch=clamp(player.pitch-dy*.0021,-1.25,1.25);}
export function advanceWalk(player,world,keys,seconds){
  if(world.canOccupy&&world.supportAt)return advanceSurfaceWalk(player,world,keys,seconds);
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.1),intent=walkIntent(keys),length=Math.hypot(intent.forward,intent.right),speed=(intent.fast?WALK.fastSpeed:WALK.speed)*dt/(length||1);
  const dx=(Math.sin(player.yaw)*intent.forward+Math.cos(player.yaw)*intent.right)*speed,dz=(-Math.cos(player.yaw)*intent.forward+Math.sin(player.yaw)*intent.right)*speed,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));
  const beforeX=player.x,beforeZ=player.z;
  for(let i=0;i<steps;i++){
    const x=player.x+dx/steps,z=player.z+dz/steps;
    if(world.canStand(x,z)){player.x=x;player.z=z;}
    else{if(world.canStand(x,player.z))player.x=x;if(world.canStand(player.x,z))player.z=z;}
  }
  const y=world.floorAt(player.x,player.z)+WALK.eyeHeight;player.groundY??=player.y;
  player.groundY+=(y-player.groundY)*(1-Math.exp(-dt*16));const smoothing=Math.abs(y-player.groundY)>.005;if(!smoothing)player.groundY=y;
  if(player.airborne){
    player.jumpOffset+=player.verticalSpeed*dt-WALK.gravity*dt*dt/2;player.verticalSpeed-=WALK.gravity*dt;
    const headroom=Math.max(0,(world.ceilingAt?.(player.x,player.z)??Infinity)-player.groundY-.18);
    if(player.jumpOffset>headroom){player.jumpOffset=headroom;player.verticalSpeed=Math.min(0,player.verticalSpeed);}
    if(player.jumpOffset<=0&&player.verticalSpeed<=0){player.jumpOffset=0;player.verticalSpeed=0;player.airborne=false;player.jumpsUsed=0;}
  }
  player.y=player.groundY+(player.jumpOffset||0);player.settling=smoothing||!!player.airborne;
  return Math.hypot(player.x-beforeX,player.z-beforeZ)>1e-7;
}

// Vertical sweeps land on actual roof plates, never an entire building's bounds.
// Ground-only canStand remains available to the car and safe spawn searches.
function advanceSurfaceWalk(player,world,keys,seconds){
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.1),intent=walkIntent(keys),len=Math.hypot(intent.forward,intent.right),speed=(intent.fast?WALK.fastSpeed:WALK.speed)/(len||1);
  const dx=(Math.sin(player.yaw)*intent.forward+Math.cos(player.yaw)*intent.right)*speed*dt,dz=(-Math.cos(player.yaw)*intent.forward+Math.sin(player.yaw)*intent.right)*speed*dt;
  const steps=Math.max(1,Math.ceil(dt/.012),Math.ceil(Math.hypot(dx,dz)/.16)),step=dt/steps,beforeX=player.x,beforeZ=player.z;
  let feet=player.y-WALK.eyeHeight;
  for(let i=0;i<steps;i++){
    let next=feet;
    if(player.airborne){next+= (player.verticalSpeed||0)*step-WALK.gravity*step*step/2;player.verticalSpeed=(player.verticalSpeed||0)-WALK.gravity*step;
      const ceiling=world.ceilingAt?.(player.x,player.z,feet)??Infinity,maxFeet=ceiling-WALK.eyeHeight-.18;
      if(next>maxFeet){next=Math.max(feet,maxFeet);player.verticalSpeed=Math.min(0,player.verticalSpeed);}
    }
    const x=player.x+dx/steps,z=player.z+dz/steps;
    let landed=false,accepted=false;
    for(const p of [{x,z},{x,z:player.z},{x:player.x,z},{x:player.x,z:player.z}]){
      const support=world.supportAt(p.x,p.z,feet+(player.airborne ? .035 : .45));
      const landing=player.airborne&&player.verticalSpeed<=0&&support>=next-.001&&support<=feet+.035;
      const standing=!player.airborne&&support>=feet-.45;
      const candidate=landing||standing?support:next;
      if(world.canOccupy(p.x,p.z,candidate)){player.x=p.x;player.z=p.z;next=candidate;landed=landing||standing;accepted=true;break;}
    }
    if(!accepted){next=feet;player.verticalSpeed=Math.min(0,player.verticalSpeed||0);}
    feet=next;
    if(landed){player.airborne=false;player.verticalSpeed=0;player.jumpsUsed=0;}
    else if(!player.airborne){player.airborne=true;player.verticalSpeed=0;player.jumpsUsed=Math.max(1,player.jumpsUsed||0);}
  }
  player.y=feet+WALK.eyeHeight;player.settling=!!player.airborne;
  if(!player.airborne){player.groundY=player.y;player.jumpOffset=0;}else player.jumpOffset=player.y-(player.groundY??player.y);
  const roof=world.roofAt?.(player.x,player.z,feet+.03);player.onRoof=!!roof&&Math.abs(roof.top-feet)<.04;player.roofKey=player.onRoof?roof.key:null;
  return Math.hypot(player.x-beforeX,player.z-beforeZ)>1e-7;
}

// Event wiring is separate from rendering so release/blur/lock-denial behaviour
// can be tested without a browser or a graphics context.
export function createWalkControls({canvas,doc,win,isActive,onInput,onLook,onExit,onJump=()=>{},onInteract=()=>{},onView=()=>{},canMove=()=>true,onLockChange=()=>{},onLockError=()=>{}}){
  const keys=new Set(),removers=[];let drag=null,disposed=false;
  const listen=(target,name,fn,options)=>{target.addEventListener(name,fn,options);removers.push(()=>target.removeEventListener(name,fn,options));};
  const locked=()=>doc.pointerLockElement===canvas;
  const editable=target=>!!target?.closest?.('input,select,textarea,[contenteditable="true"]');
  function clear(){const hadInput=keys.size||drag;keys.clear();if(drag){try{canvas.releasePointerCapture?.(drag.id);}catch{}drag=null;}if(hadInput&&!disposed)onInput();}
  function releaseLock(){if(locked())doc.exitPointerLock?.();}
  listen(win,'keydown',e=>{
    if(!isActive()||e.ctrlKey||e.metaKey||e.altKey||editable(e.target))return;
    if(e.code==='Escape'){if(!locked()){e.preventDefault();onExit();}return;}
    if(e.code==='KeyE'){e.preventDefault();if(!e.repeat)onInteract();return;}
    if(!canMove())return;
    if(e.code==='KeyV'){e.preventDefault();if(!e.repeat)onView();return;}
    if(e.code==='Space'){if(e.target?.closest?.('button,a'))return;e.preventDefault();if(!e.repeat)onJump();return;}
    if(!MOVE_KEYS.has(e.code))return;e.preventDefault();if(!keys.has(e.code)){keys.add(e.code);onInput();}
  });
  listen(win,'keyup',e=>{if(keys.delete(e.code))onInput();});
  listen(canvas,'pointerdown',e=>{
    if(!isActive()||!canMove()||e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();canvas.focus({preventScroll:true});
    if(!locked()){drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);}
  });
  listen(canvas,'pointermove',e=>{
    if(!isActive())return;e.stopImmediatePropagation();if(!canMove()||!drag||drag.id!==e.pointerId||locked())return;
    onLook(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,name,e=>{if(!isActive())return;e.stopImmediatePropagation();if(drag?.id===e.pointerId){drag=null;try{canvas.releasePointerCapture?.(e.pointerId);}catch{}}});
  listen(doc,'mousemove',e=>{if(isActive()&&canMove()&&locked())onLook(e.movementX||0,e.movementY||0);});
  listen(doc,'pointerlockchange',()=>{clear();if(!disposed)onLockChange(locked());});
  listen(doc,'pointerlockerror',()=>{if(!disposed&&isActive())onLockError();});
  listen(canvas,'blur',clear);listen(win,'blur',()=>{clear();releaseLock();});listen(doc,'visibilitychange',()=>{if(doc.hidden){clear();releaseLock();}});
  return {
    keys,clear,releaseLock,get locked(){return locked();},
    async requestLock(){
      if(disposed||!isActive())return false;if(locked()){releaseLock();return true;}
      canvas.focus({preventScroll:true});if(!canvas.requestPointerLock){onLockError();return false;}
      try{await canvas.requestPointerLock();return true;}catch{if(!disposed&&isActive())onLockError();return false;}
    },
    dispose(){disposed=true;removers.forEach(fn=>fn());clear();releaseLock();},
  };
}
