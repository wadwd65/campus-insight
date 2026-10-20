export const LIGHTING={
  daylight:{label:'晴日校园',sky:0xc9dfe7,bounce:0x899078,ambient:.66,sun:0xfff2df,strength:1.12,exposure:1,ground:0xffffff,roof:0xffffff,stone:0xffffff,shadowOpacity:.27},
  golden:{label:'暖金傍晚',sky:0xcbd8df,bounce:0x9c927e,ambient:.68,sun:0xffe0b0,strength:1.1,exposure:1.04,ground:0xffffff,roof:0xf5f2ed,stone:0xfff3e3,shadowOpacity:.29},
};

// Orthographic sunlight projection in world X/Z. Heights and scene units are
// illustrative; this is a static ground shadow, not measured solar analysis.
export function shadowHull(caster,angle) {
  const c=Math.cos(caster.rotation||0),s=Math.sin(caster.rotation||0),dx=-Math.cos(angle)*.65,dz=-Math.sin(angle)*.65;
  const points=[];
  for(const y of [Math.max(.82,caster.y-caster.h/2),caster.y+caster.h/2])for(const sx of [-1,1])for(const sz of [-1,1]){
    const ox=sx*caster.w/2,oz=sz*caster.d/2;
    points.push([caster.x+ox*c+oz*s+(y-.82)*dx,caster.z+oz*c-ox*s+(y-.82)*dz]);
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
  const material=new T.MeshBasicMaterial({map:texture,color:0x253b46,transparent:true,opacity:.3,depthWrite:false});
  const layer=new T.Mesh(campus.ground.geometry.clone(),material);layer.name='static-sun-shadow';layer.position.y=.82-.04;layer.renderOrder=2;
  campus.root.add(layer);
  let bakes=0;
  function bake(angle){
    const context=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    context.clearRect(0,0,w,h);context.fillStyle='#fff';
    const pixel=(x,z)=>[(x-bounds.min.x)/spanX*w,(z-bounds.min.z)/spanZ*h];
    // Max-composite white silhouettes: overlaps stay at one shadow density.
    context.globalAlpha=1;context.filter='blur(1px)';
    for(const caster of campus.shadowCasters){
      if(caster.kind==='tree'){
        const dx=-Math.cos(angle)*caster.y*.65,dz=-Math.sin(angle)*caster.y*.65,[x,y]=pixel(caster.x+dx,caster.z+dz);
        context.beginPath();context.ellipse(x,y,caster.w/spanX*w*.48,caster.d/spanZ*h*.48,-(caster.rotation||0),0,Math.PI*2);context.fill();
      }else{
        const hull=shadowHull(caster,angle);context.beginPath();hull.forEach((p,i)=>{const[x,y]=pixel(...p);i?context.lineTo(x,y):context.moveTo(x,y);});context.closePath();context.fill();
      }
    }
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
