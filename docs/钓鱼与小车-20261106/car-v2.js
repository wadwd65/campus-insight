function createCampusCar(T,car){
  const root=new T.Group();root.name='campus-electric-cart';
  /* ===== 11-06 第二遍：细节、材质与配色 =================================
     第一遍做出形体后真读图抓到两个问题：① 车灯被车身 bevel 包住，完全看不见；
     ② 轮子是一块黑饼。这一遍把灯外移并加灯罩、给轮子加轮毂与轮辋、
     补窗框/座椅分格/车牌/接地软阴影，并统一到校园的「青绿 + 奶白 + 暖铜」色板。
     ================================================================== */
  const C={body:0x5f9281,bodyDark:0x4a7a6b,cream:0xf5eed7,glass:0x7398a0,
           seat:0x456352,trim:0x354b46,lamp:0xffebba,tail:0xb56750,tire:0x2f3a36,
           hub:0xd9d7c8,frame:0x3e514a,plate:0xf0e6cd,copper:0xb58a4a};
  const mat=(c,o)=>new T.MeshLambertMaterial({color:c,...(o||{})});
  const M={body:mat(C.body),bodyDark:mat(C.bodyDark),cream:mat(C.cream),
    glass:mat(C.glass,{transparent:true,opacity:.22,depthWrite:false}),
    seat:mat(C.seat),trim:mat(C.trim),lamp:mat(C.lamp),tail:mat(C.tail),tire:mat(C.tire),
    hub:mat(C.hub),frame:mat(C.frame),plate:mat(C.plate),copper:mat(C.copper)};

  function rounded(w,h,d,r,material){
    const b=Math.min(r*.5,w/6,h/6,d/6);
    const iw=w-2*b,ih=h-2*b,id=Math.max(.002,d-2*b),q=Math.max(.002,r-b);
    const x=-iw/2,y=-ih/2,sh=new T.Shape();
    sh.moveTo(x+q,y);sh.lineTo(x+iw-q,y);sh.quadraticCurveTo(x+iw,y,x+iw,y+q);
    sh.lineTo(x+iw,y+ih-q);sh.quadraticCurveTo(x+iw,y+ih,x+iw-q,y+ih);
    sh.lineTo(x+q,y+ih);sh.quadraticCurveTo(x,y+ih,x,y+ih-q);
    sh.lineTo(x,y+q);sh.quadraticCurveTo(x,y,x+q,y);
    const g=new T.ExtrudeGeometry(sh,{depth:id,bevelEnabled:true,bevelSegments:2,steps:1,
      bevelSize:b,bevelThickness:b,curveSegments:5});
    g.translate(0,0,-id/2);
    const m=new T.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
  }
  function profile(depth,material){
    const sh=new T.Shape();
    sh.moveTo(-1.44,.60);sh.lineTo(1.16,.60);
    sh.quadraticCurveTo(1.46,.62,1.48,.82);
    sh.lineTo(1.48,1.02);
    sh.quadraticCurveTo(1.46,1.16,1.30,1.18);
    sh.lineTo(-1.32,1.18);
    sh.quadraticCurveTo(-1.46,1.18,-1.46,1.04);
    sh.lineTo(-1.46,.74);
    sh.quadraticCurveTo(-1.46,.60,-1.44,.60);
    const g=new T.ExtrudeGeometry(sh,{depth:depth-2*.07,bevelEnabled:true,bevelSegments:2,steps:1,
      bevelSize:.07,bevelThickness:.07,curveSegments:6});
    g.translate(0,0,-(depth-2*.07)/2);g.rotateY(Math.PI/2);
    const m=new T.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
  }

  profile(1.72,M.body);
  const hood=rounded(1.56,.10,.62,.05,M.bodyDark);hood.position.set(0,1.16,-1.02);hood.rotation.x=-.12;
  /* 车头暖铜色车标：一小点，给大片青绿一个视觉落点 */
  const badge=rounded(.24,.07,.04,.03,M.copper);badge.position.set(0,1.20,-1.33);
  for(const sx of [-1,1]){
    const belt=rounded(.035,.055,2.55,.02,M.bodyDark);belt.position.set(sx*.865,.96,0);
  }
  /* 座椅：坐垫 + 靠背 + 中缝 + 两个头枕，读作双人座 */
  const seat=rounded(1.32,.18,.62,.07,M.seat);seat.position.set(0,1.06,.34);
  const back=rounded(1.32,.60,.14,.06,M.seat);back.position.set(0,1.36,.66);back.rotation.x=-.10;
  const seam=rounded(.035,.02,.60,.01,M.trim);seam.position.set(0,1.16,.34);
  for(const hx of [-.34,.34]){
    const head=rounded(.30,.16,.12,.05,M.seat);head.position.set(hx,1.72,.66);
  }
  /* 挡风玻璃 + 四边细框（旧版没有框，玻璃像悬空的一块） */
  const glass=rounded(1.40,.64,.05,.04,M.glass);glass.position.set(0,1.56,-1.00);glass.rotation.x=.10;
  const gf=[[0,1.90,1.46,.05,.05],[0,1.22,1.46,.05,.05]];
  for(const [gx,gy,gw,gh] of gf){const f=rounded(gw,gh,.07,.02,M.frame);f.position.set(gx,gy,-.99);}
  for(const gx of [-.71,.71]){const f=rounded(.05,.70,.07,.02,M.frame);f.position.set(gx,1.56,-.99);}
  /* 顶棚 */
  const roof=rounded(1.92,.13,2.46,.10,M.cream);roof.position.set(0,2.02,.04);
  const crown=rounded(1.60,.05,2.10,.05,M.cream);crown.position.set(0,2.10,.02);
  const visor=rounded(1.86,.07,.22,.05,M.cream);visor.position.set(0,1.97,-1.20);
  /* 顶棚下沿一圈深绿收边，避免白色顶棚"飘"在柱子上 */
  const rim=rounded(1.96,.035,2.50,.03,M.frame);rim.position.set(0,1.955,.04);
  const poleG=new T.CylinderGeometry(.045,.05,.95,10);
  for(const x of [-.76,.76])for(const z of [-1.06,1.02]){
    const p=new T.Mesh(poleG,M.cream);p.position.set(x,1.51,z);p.castShadow=true;root.add(p);
  }
  /* 轮拱 */
  const archG=new T.TorusGeometry(.43,.055,6,14,Math.PI);
  for(const x of [-.90,.90])for(const z of [-.95,.95]){
    const a=new T.Mesh(archG,M.bodyDark);a.position.set(x,.38,z);a.rotation.y=Math.PI/2;root.add(a);
  }
  /* ★ 灯外移到 z=±1.60：profile 的 bevel 会把车身撑到 z≈1.51，
     旧位置 1.49 整个被包进车壳里，所以上一版车灯凭空消失。 */
  for(const x of [-.55,.55]){
    const fBorder=rounded(.38,.24,.05,.06,M.frame);fBorder.position.set(x,.86,-1.585);
    const f=rounded(.30,.17,.055,.05,M.lamp);f.position.set(x,.86,-1.615);
    const rBorder=rounded(.32,.21,.05,.05,M.frame);rBorder.position.set(x,.85,1.585);
    const r=rounded(.25,.14,.055,.04,M.tail);r.position.set(x,.85,1.615);
  }
  /* 保险杠 + 车牌 */
  for(const z of [-1.60,1.60]){const b=rounded(1.60,.13,.12,.05,M.trim);b.position.set(0,.60,z);}
  const plate=rounded(.44,.13,.035,.02,M.plate);plate.position.set(0,.86,1.625);
  /* 接地软阴影：车不会显得悬空。用径向渐变 CanvasTexture，静态烘焙一次。 */
  const shTex=(()=>{
    const cv=document.createElement('canvas');cv.width=cv.height=128;
    const g=cv.getContext('2d'),gr=g.createRadialGradient(64,64,8,64,64,62);
    gr.addColorStop(0,'rgba(28,40,34,.55)');gr.addColorStop(.6,'rgba(28,40,34,.22)');
    gr.addColorStop(1,'rgba(28,40,34,0)');
    g.fillStyle=gr;g.fillRect(0,0,128,128);
    const t=new T.CanvasTexture(cv);t.minFilter=T.LinearFilter;return t;
  })();
  const shadow=new T.Mesh(new T.PlaneGeometry(2.5,3.8),
    new T.MeshBasicMaterial({map:shTex,transparent:true,opacity:.42,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;root.add(shadow);

  /* 轮胎 + 轮毂：轮毂用银色圆盘 + 深色轮辋，不再是"一块黑饼" */
  const wheelGeometry=new T.CylinderGeometry(.38,.38,.20,16);wheelGeometry.rotateZ(Math.PI/2);
  const wheels=new T.InstancedMesh(wheelGeometry,M.tire,4);wheels.castShadow=true;root.add(wheels);
  const hubGeometry=new T.CylinderGeometry(.225,.225,.215,16);hubGeometry.rotateZ(Math.PI/2);
  const hubs=new T.InstancedMesh(hubGeometry,M.hub,4);root.add(hubs);
  const rimGeometry=new T.TorusGeometry(.225,.028,5,16);rimGeometry.rotateY(Math.PI/2);
  const rims=new T.InstancedMesh(rimGeometry,M.frame,4);root.add(rims);
  const steering=new T.Mesh(new T.TorusGeometry(.19,.025,6,18),M.trim);
  steering.position.set(0,1.30,-.42);steering.rotation.x=.95;root.add(steering);
  const dummy=new T.Object3D();
  const WHEEL_POS=[[-.90,-.95],[-.90,.95],[.90,-.95],[.90,.95]];
  function update(){
    root.position.set(car.x,car.y,car.z);root.rotation.y=-car.yaw;
    WHEEL_POS.forEach(([x,z],i)=>{
      dummy.position.set(x,.38,z);dummy.rotation.set(car.wheelAngle,0,0);dummy.updateMatrix();
      wheels.setMatrixAt(i,dummy.matrix);
      dummy.rotation.set(0,0,0);dummy.position.set(x+(x<0?-.105:.105),.38,z);dummy.updateMatrix();
      hubs.setMatrixAt(i,dummy.matrix);rims.setMatrixAt(i,dummy.matrix);
    });
    wheels.instanceMatrix.needsUpdate=true;
    hubs.instanceMatrix.needsUpdate=true;rims.instanceMatrix.needsUpdate=true;
  }
  update();return {root,update,dispose:()=>disposeTree(root)};
}
