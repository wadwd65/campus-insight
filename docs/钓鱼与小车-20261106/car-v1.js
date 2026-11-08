function createCampusCar(T,car){
  const root=new T.Group();root.name='campus-electric-cart';
  /* ===== 11-06 第一遍：形体与比例 =====================================
     旧版 = 9 个直角方盒 + 4 根细圆柱轮，远看是积木；轮子被车身完全挡住。
     这一遍只改"形状"：侧视轮廓挤出车身（斜切车头 + 圆角 + 底边上翘）、
     外露的大轮 + 轮拱、圆柱支柱、带檐的圆角顶棚。材质细节留到第二遍。
     ================================================================== */
  const C={body:0x5f9281,bodyDark:0x4a7a6b,cream:0xf5eed7,glass:0x7398a0,
           seat:0x456352,trim:0x354b46,lamp:0xffebba,tail:0xb56750,tire:0x2f3a36};
  const mat=(c,o)=>new T.MeshLambertMaterial({color:c,...(o||{})});
  const M={body:mat(C.body),bodyDark:mat(C.bodyDark),cream:mat(C.cream),
    glass:mat(C.glass,{transparent:true,opacity:.22,depthWrite:false}),
    seat:mat(C.seat),trim:mat(C.trim),lamp:mat(C.lamp),tail:mat(C.tail),tire:mat(C.tire)};

  /* 圆角盒：圆角矩形 bevel 挤出，尺寸即 (w,h,d)，棱边不再死直 */
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
  /* 侧视轮廓挤出：shape.x↔车长(z)，shape.y↔车高(y)，挤出方向↔车宽(x)。
     rotateY(π/2) 完成 (sx,sy,sz) → (sz,sy,-sx) 的轴置换。 */
  function profile(depth,material){
    const sh=new T.Shape();
    sh.moveTo(-1.44,.60);
    sh.lineTo(1.16,.60);
    sh.quadraticCurveTo(1.46,.62,1.48,.82);   /* 车头下方圆角 */
    sh.lineTo(1.48,1.02);
    sh.quadraticCurveTo(1.46,1.16,1.30,1.18);/* 斜切车头上沿 */
    sh.lineTo(-1.32,1.18);
    sh.quadraticCurveTo(-1.46,1.18,-1.46,1.04);
    sh.lineTo(-1.46,.74);
    sh.quadraticCurveTo(-1.46,.60,-1.44,.60);
    const g=new T.ExtrudeGeometry(sh,{depth:depth-2*.07,bevelEnabled:true,bevelSegments:2,steps:1,
      bevelSize:.07,bevelThickness:.07,curveSegments:6});
    g.translate(0,0,-(depth-2*.07)/2);g.rotateY(Math.PI/2);
    const m=new T.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
  }

  /* 主车身：一体成型的侧轮廓，底边抬到 .60 让轮子露出来 */
  profile(1.72,M.body);
  /* 车头引擎盖斜面（比车身略暗，读作另一个面） */
  const hood=rounded(1.56,.10,.62,.05,M.bodyDark);hood.position.set(0,1.16,-1.02);hood.rotation.x=-.12;
  /* 侧面腰线：一条细的深绿带，把"一大块绿"分成上下两个面 */
  for(const sx of [-1,1]){
    const belt=rounded(.035,.055,2.55,.02,M.bodyDark);belt.position.set(sx*.865,.96,0);
  }
  /* 座椅：坐垫 + 靠背，圆角 */
  const seat=rounded(1.32,.18,.62,.07,M.seat);seat.position.set(0,1.06,.34);
  const back=rounded(1.32,.60,.14,.06,M.seat);back.position.set(0,1.36,.66);back.rotation.x=-.10;
  /* 挡风玻璃：独立斜面，稍前倾 */
  const glass=rounded(1.40,.64,.05,.04,M.glass);glass.position.set(0,1.56,-1.00);glass.rotation.x=.10;
  /* 顶棚：圆角盒 + 前檐 + 中间微拱（三块叠出弧度，不用平面贴图） */
  const roof=rounded(1.92,.13,2.46,.10,M.cream);roof.position.set(0,2.02,.04);
  const crown=rounded(1.60,.05,2.10,.05,M.cream);crown.position.set(0,2.10,.02);
  const visor=rounded(1.86,.07,.22,.05,M.cream);visor.position.set(0,1.97,-1.20);
  /* 支柱改圆柱，比 0.075 的方柱柔和 */
  const poleG=new T.CylinderGeometry(.045,.05,.95,10);
  for(const x of [-.76,.76])for(const z of [-1.06,1.02]){
    const p=new T.Mesh(poleG,M.cream);p.position.set(x,1.51,z);p.castShadow=true;root.add(p);
  }
  /* 轮拱：半环遮住轮胎上缘，读作车身开了轮口 */
  const archG=new T.TorusGeometry(.43,.055,6,14,Math.PI);
  for(const x of [-.90,.90])for(const z of [-.95,.95]){
    const a=new T.Mesh(archG,M.bodyDark);a.position.set(x,.38,z);a.rotation.y=Math.PI/2;root.add(a);
  }
  /* 保险杠 */
  for(const z of [-1.52,1.52]){const b=rounded(1.60,.13,.12,.05,M.trim);b.position.set(0,.60,z);}
  /* 前后灯 */
  for(const x of [-.55,.55]){
    const f=rounded(.32,.18,.06,.05,M.lamp);f.position.set(x,.86,-1.49);
    const r=rounded(.26,.15,.06,.04,M.tail);r.position.set(x,.85,1.49);
  }
  /* 方向盘（沿用原有接口） */
  const wheelGeometry=new T.CylinderGeometry(.38,.38,.20,16);wheelGeometry.rotateZ(Math.PI/2);
  const wheels=new T.InstancedMesh(wheelGeometry,M.tire,4);wheels.castShadow=true;root.add(wheels);
  const steering=new T.Mesh(new T.TorusGeometry(.19,.025,6,18),M.trim);
  steering.position.set(0,1.30,-.42);steering.rotation.x=.95;root.add(steering);
  const dummy=new T.Object3D();
  function update(){
    root.position.set(car.x,car.y,car.z);root.rotation.y=-car.yaw;
    let i=0;for(const x of [-.90,.90])for(const z of [-.95,.95]){
      dummy.position.set(x,.38,z);dummy.rotation.set(car.wheelAngle,0,0);dummy.updateMatrix();
      wheels.setMatrixAt(i++,dummy.matrix);
    }
    wheels.instanceMatrix.needsUpdate=true;
  }
  update();return {root,update,dispose:()=>disposeTree(root)};
}
