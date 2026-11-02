export const LIGHTING={
  /* 10-26：shadowOpacity 原来 .25/.23 —— 与材质 color 相乘后实际压暗不足 7%，
     肉眼读不出投影。这是投影强度的**唯一真源**：setLighting() 每轮都会覆盖
     material.opacity，改材质里的字面量无效（踩过一次）。 */
  daylight:{label:'晴朗蓝天',sky:0xdcebf6,bounce:0x8e9879,ambient:.78,sun:0xffeed0,strength:1.14,exposure:1.0,ground:0xffffff,roof:0xfffcf2,stone:0xfffdf5,shadowOpacity:.58,skyTop:'#70afe0',skyBottom:'#d8ebf7',glow:'#ffe2b640'},
  golden:{label:'杏金傍晚',sky:0xf3dec5,bounce:0xa88f70,ambient:.78,sun:0xffd19b,strength:1.04,exposure:.98,ground:0xfff7e8,roof:0xffefd8,stone:0xfff4e2,shadowOpacity:.52,skyTop:'#e5d5c3',skyBottom:'#f2e3ce',glow:'#ffd28d8c'},
};

/* 10-26：太阳位置从 app 里的魔法数字收成单一真源。
   原来 app 写死 (cos*260, 400, sin*260) ⇒ 仰角 57°，而投影系数又另写死 .65。
   两处一旦不同步，就会出现"光从东边来、影子朝西边倒"。
   现在半径与高度都在这里定，投影系数由它们推导（cot 仰角 = 半径/高度）。
   高度 400→234 即仰角 57°→42°，影子长度约 ×1.7。 */
export const SUN={radius:260,height:234};
export const PROJECT=SUN.radius/SUN.height;
/* 建筑底边所在高度（campus-scene.js 里 wing() 用 h/2+.6，故底部为 .6）。
   投影偏移必须从楼底算起，写死 .82 会让影子少算一截。 */
const GROUND_Y=.6;

// Orthographic sunlight projection in world X/Z. Heights and scene units are
// illustrative; this is a static ground shadow, not measured solar analysis.
export function shadowHull(caster,angle) {
  const c=Math.cos(caster.rotation||0),s=Math.sin(caster.rotation||0),dx=-Math.cos(angle)*PROJECT,dz=-Math.sin(angle)*PROJECT;
  const points=[];
  for(const y of [Math.max(GROUND_Y,caster.y-caster.h/2),caster.y+caster.h/2])for(const sx of [-1,1])for(const sz of [-1,1]){
    const ox=sx*caster.w/2,oz=sz*caster.d/2;
    points.push([caster.x+ox*c+oz*s+(y-GROUND_Y)*dx,caster.z+oz*c-ox*s+(y-GROUND_Y)*dz]);
  }
  return convexHull(points);
}
function convexHull(points){
  const sorted=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
  return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
}

export function createStaticShadowLayer(T,campus,canvas){
  const bounds=campus.ground.geometry.boundingBox,spanX=bounds.max.x-bounds.min.x,spanZ=bounds.max.z-bounds.min.z;
  const texture=new T.CanvasTexture(canvas);texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
  /* 10-26：原 color=0x685b49 + opacity=.3，实测只让 2 个像素变暗（等于没有）。
     色彩上改偏冷：晴天阴影区是被蓝色天光填充的，暖褐叠在绿地上会读成"污渍"。
     注意 opacity 的真源在 LIGHTING.shadowOpacity，不在这里（setLighting 会覆盖）。 */
  const material=new T.MeshBasicMaterial({map:texture,color:0x424d56,transparent:true,opacity:.5,depthWrite:false});
  /* 10-26：原为 .82-.04=.78，而建筑实际底边在 0.6（见 campus-scene.js wing() 的 h/2+.6），
     即投影层比楼还高，俯视时会糊在墙面上。现压到 .36：高于路面(.29)与草地(.04)，
     低于接触阴影(.38)与楼体(.6)，既不穿模也不被路面吃掉。 */
  const layer=new T.Mesh(campus.ground.geometry.clone(),material);layer.name='static-sun-shadow';layer.position.y=.36;layer.renderOrder=2;
  campus.root.add(layer);
  let bakes=0;
  function bake(angle){
    const context=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    context.clearRect(0,0,w,h);context.fillStyle='#fff';
    const pixel=(x,z)=>[(x-bounds.min.x)/spanX*w,(z-bounds.min.z)/spanZ*h];
    /* 10-26：原来单层均匀 fill + blur(1px)，出来是一块"灰污渍"——
       真实投影是近处实、远端虚。改成两遍叠画：
         ① 外扩 1.22 倍 + 大模糊 + 低 alpha —— 模拟半影区
         ② 原尺寸 + 小模糊 + 高 alpha —— 模拟本影区
       两遍都是白色遮罩，靠 alpha 累积出浓淡，材质只负责上色。 */
    const drawPass=(alpha,blur,spread)=>{
      context.globalAlpha=alpha;context.filter=`blur(${blur}px)`;context.fillStyle='#fff';
      for(const caster of campus.shadowCasters){
        if(caster.kind==='tree'){
          const dx=-Math.cos(angle)*(caster.y-GROUND_Y)*PROJECT,dz=-Math.sin(angle)*(caster.y-GROUND_Y)*PROJECT,[x,y]=pixel(caster.x+dx,caster.z+dz);
          for(let lobe=0;lobe<7;lobe++){const a=lobe*2.4+(caster.rotation||0),rx=caster.w/spanX*w*spread,ry=caster.d/spanZ*h*spread;context.beginPath();context.ellipse(x+Math.cos(a)*rx*.19,y+Math.sin(a)*ry*.19,rx*(.23+(lobe%2)*.04),ry*.25,-(caster.rotation||0),0,Math.PI*2);context.fill();}
        }else{
          const hull=shadowHull(caster,angle);
          const cx=hull.reduce((n,p)=>n+p[0],0)/hull.length,cy=hull.reduce((n,p)=>n+p[1],0)/hull.length;
          context.beginPath();
          hull.forEach((p,i)=>{const[x,y]=pixel(cx+(p[0]-cx)*spread,cy+(p[1]-cy)*spread);i?context.lineTo(x,y):context.moveTo(x,y);});
          context.closePath();context.fill();
        }
      }
    };
    /* 10-26 二调：影子拉长后（仰角 57°→42°），半影 1.22/9px 摊得太开，
       实测覆盖 25.97% 但平均只压暗 11 级 —— 变成一层灰雾而不是投影。
       收窄外扩、降低半影浓度、加重本影，让"长"和"实"同时成立。 */
    drawPass(.20,7,1.12);   // 半影：只留一圈过渡
    drawPass(.88,1.6,1);    // 本影：贴合、实在
    // Local contact falloff is blended into the same atlas, not hundreds of quads.
    context.globalCompositeOperation='source-over';context.filter='none';
    for(const p of campus.shadowContacts){
      const[x,y]=pixel(p.x,p.z),rx=p.w/spanX*w*.45,ry=p.d/spanZ*h*.45;
      context.save();context.translate(x,y);context.rotate(-(p.rotation||0));context.scale(rx,ry);
      const g=context.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'#ffffff75');g.addColorStop(1,'#ffffff00');context.fillStyle=g;context.fillRect(-1,-1,2,2);context.restore();
    }
    texture.needsUpdate=true;bakes++;
    return bakes;
  }
  return {layer,texture,material,bake,get bakes(){return bakes;},dispose(){texture.dispose();}};
}
