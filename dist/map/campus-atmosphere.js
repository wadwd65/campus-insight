// One static canvas background. Orbiting the campus cannot move the sun out of
// the sky, and there is no dome geometry, bloom pass or cloud animation loop.
export function paintSky(c,w,h,{golden=false,sun={x:-200,y:400,z:-180},aspect=w/h}={}){
  const stops=golden?[[0,'#bbcbc9'],[.38,'#e4dfcb'],[.7,'#f0dfc2'],[1,'#e4dfcf']]:[[0,'#559dd8'],[.4,'#87bee6'],[.72,'#b8daf1'],[1,'#dbeef8']];
  const gradient=c.createLinearGradient(0,0,0,h);for(const[offset,color]of stops)gradient.addColorStop(offset,color);c.fillStyle=gradient;c.fillRect(0,0,w,h);
  let seed=61183;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function puff(x,y,rx,ry,alpha,shade=false){
    c.save();c.translate(x,y);c.scale(rx,ry);
    const g=c.createRadialGradient(0,0,.05,0,0,1),color=shade?'145,162,157':'255,253,240';
    g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(.5,`rgba(${color},${alpha*.93})`);g.addColorStop(.82,`rgba(${color},${alpha*.46})`);g.addColorStop(1,`rgba(${color},0)`);
    c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  const banks=[[.16,.18,.16],[.52,.09,.12],[.7,.32,.2],[.23,.43,.23],[.07,.66,.2],[.88,.6,.22]];
  for(const [u,v,span]of banks){
    const x=u*w,y=v*h,rx=span*w,ry=(.018+rand()*.014)*h;
    puff(x,y+ry*.3,rx*.7,ry*.65,.12,true);
    for(let lobe=0;lobe<10;lobe++){
      const dx=(rand()-.5)*rx*1.5,dy=(rand()-.65)*ry*.9;
      puff(x+dx,y+dy,rx*(.1+rand()*.18),ry*(.48+rand()*.5),.3+rand()*.2);
    }
  }
  // Keep a pixel-circular sun inside the upper sky in both narrow and wide views.
  const angle=Math.atan2(sun.z,sun.x),x=(.5+Math.cos(angle+2.4)*.32)*w,y=(.12+(.5+.5*Math.sin(angle+.6))*.035)*h;
  const radiusY=h*.019,radiusX=radiusY*w/(h*Math.max(.1,aspect));
  c.save();c.translate(x,y);c.scale(radiusX,radiusY);
  const halo=c.createRadialGradient(0,0,0,0,0,8);halo.addColorStop(0,golden?'#ffe3afa6':'#fff0c787');halo.addColorStop(.18,golden?'#ffe2ad40':'#fff0c933');halo.addColorStop(.55,'#fff0cc16');halo.addColorStop(1,'#fff0cc00');c.fillStyle=halo;c.fillRect(-8,-8,16,16);
  const disc=c.createRadialGradient(-.15,-.18,0,0,0,1);disc.addColorStop(0,'#fffdf0');disc.addColorStop(.76,golden?'#fff1ce':'#fff8df');disc.addColorStop(1,golden?'#ffe5ad':'#ffedbc');c.fillStyle=disc;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();
  return {sun:{x,y,radiusX,radiusY},cloudBanks:banks.length,aspect};
}

export function createAtmosphere(T,scene,canvas){
  const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
  const previousBackground=scene.background,previousFog=scene.fog,fog=new T.FogExp2(0xcbdfee,.00026);scene.background=texture;scene.fog=fog;
  let golden=false,sun={x:-200,y:400,z:-180},aspect=canvas.width/canvas.height,revision=0,layout=null;
  function paint(){layout=paintSky(canvas.getContext('2d'),canvas.width,canvas.height,{golden,sun,aspect});texture.needsUpdate=true;revision++;}
  return {
    texture,
    update(camera){const next=Math.max(.1,Number(camera.aspect)||1);if(!revision||Math.abs(next-aspect)>.00001){aspect=next;paint();}},
    setLighting(name){const next=name==='golden';if(!revision||next!==golden){golden=next;fog.color.setHex(golden?0xe7ddc9:0xcbdfee);paint();}},
    setSun(position){if(!revision||position.x!==sun.x||position.y!==sun.y||position.z!==sun.z){sun={x:position.x,y:position.y,z:position.z};paint();}},
    get revision(){return revision;},get layout(){return layout;},
    dispose(){if(scene.background===texture)scene.background=previousBackground;if(scene.fog===fog)scene.fog=previousFog;texture.dispose();},
  };
}
