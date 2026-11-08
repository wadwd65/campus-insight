/* 11-06 天气/太阳系统 + 视觉统一 + 建筑比例小幅收敛
 * 输入：D:/repro-test/v2-base.html
 * 输出：D:/repro-test/v3-weather.html
 *
 * 设计原则：不推翻既有系统，只在 LIGHTING / paintSky / createAtmosphere / setLighting
 * 这条既有链路上扩展；所有档位共用一套参数（光色/强度/补光/阴影浓度/雾/云量/太阳盘），
 * 保证「太阳—光照—阴影—天气」同向变化，而不是各改各的。
 */
const fs = require('fs');
const SRC = 'D:/repro-test/v2-base.html';
const DST = 'D:/repro-test/v3-weather.html';
let s = fs.readFileSync(SRC, 'utf8');
const orig = s.length;

function sub(from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`[${label}] 期望 1 处，实际 ${n} 处：${from.slice(0, 100)}`);
  s = s.replace(from, to);
  console.log('  ✓', label);
}
function block(startMark, endMark, text, label) {
  const a = s.indexOf(startMark), b = s.indexOf(endMark, a);
  if (a < 0 || b < 0 || b <= a) throw new Error(`[${label}] 起止边界未找到`);
  s = s.slice(0, a) + text + s.slice(b);
  console.log('  ✓', label, `(替换 ${b - a} 字符)`);
}

/* ===== 1. UI：天气档位从 2 档扩到 5 档 ===== */
sub(
`<label>校园色调<select id="lighting" aria-label="校园色调"><option value="daylight">晴朗蓝天</option><option value="golden">杏金傍晚</option></select></label>`,
`<label>天气 / 光照<select id="lighting" aria-label="天气与光照"><option value="daylight">晴朗 · 蓝天</option><option value="partly">薄云 · 柔光</option><option value="overcast">阴天 · 漫射</option><option value="golden">杏金 · 傍晚</option><option value="dusk">暮色 · 蓝调</option></select></label>`,
  'UI 天气档位'
);

/* ===== 2. LIGHTING：单一真源 ===== */
block('const LIGHTING={', '\n};',
`const LIGHTING={
  /* 11-06 天气系统：每一档都是「太阳 + 天光 + 补光 + 阴影 + 雾 + 云 + 太阳盘」的完整快照。
     所有档位字段必须齐全，setLighting 的插值与 paintSky 都靠它，不要只改一半。 */
  daylight:{label:'晴朗 · 蓝天',sky:0xdcebf6,bounce:0xa9b29b,ambient:.56,sun:0xffeed0,strength:1.95,exposure:1.00,fill:.30,fillColor:0xa9c6e2,ground:0xffffff,roof:0xfffcf2,stone:0xfffdf5,shadowOpacity:.74,skyTop:'#70afe0',skyBottom:'#d8ebf7',glow:'#ffe2b640',cloud:.20,sunDisc:1.00,fog:0xcbdfee,fogDensity:.00026,warm:.04},
  partly:  {label:'薄云 · 柔光',sky:0xdfe9f2,bounce:0xaeb6a4,ambient:.62,sun:0xffeedc,strength:1.58,exposure:1.00,fill:.34,fillColor:0xbfd4e6,ground:0xfdfdfa,roof:0xfffdf6,stone:0xfffef9,shadowOpacity:.48,skyTop:'#8fb9dc',skyBottom:'#e6f0f7',glow:'#ffe8c260',cloud:.58,sunDisc:.55,fog:0xd6e4ee,fogDensity:.00034,warm:.10},
  overcast:{label:'阴天 · 漫射',sky:0xd9e0e4,bounce:0xa8b0ae,ambient:.74,sun:0xe8eaec,strength:.78,exposure:1.03,fill:.40,fillColor:0xc7d2da,ground:0xf7f8f6,roof:0xfafbf8,stone:0xfbfcf9,shadowOpacity:.20,skyTop:'#aebbc4',skyBottom:'#e3e9ec',glow:'#e8edf030',cloud:.92,sunDisc:.10,fog:0xd7dee2,fogDensity:.00052,warm:0},
  golden:  {label:'杏金 · 傍晚',sky:0xf3dec5,bounce:0xa88f70,ambient:.58,sun:0xffd19b,strength:1.42,exposure:.95,fill:.26,fillColor:0xc9a887,ground:0xfff7e8,roof:0xffefd8,stone:0xfff4e2,shadowOpacity:.68,skyTop:'#e5d5c3',skyBottom:'#f2e3ce',glow:'#ffd28d8c',cloud:.42,sunDisc:.90,fog:0xe7ddc9,fogDensity:.00034,warm:.55},
  dusk:    {label:'暮色 · 蓝调',sky:0xaab8cc,bounce:0x7d8794,ambient:.52,sun:0xd8b9a4,strength:.92,exposure:.90,fill:.30,fillColor:0x8ea4c4,ground:0xe9e6e0,roof:0xf0e6da,stone:0xf2ebe2,shadowOpacity:.40,skyTop:'#5b6f92',skyBottom:'#d4b9a6',glow:'#ffb98a70',cloud:.55,sunDisc:.45,fog:0xb9b6bc,fogDensity:.00046,warm:.42},`,
  'LIGHTING 五档天气'
);

/* ===== 3. paintSky：天气化 + 太阳盘与方位角同步 ===== */
block('function paintSky(', '\nfunction createAtmosphere(',
`function paintSky(c,w,h,{weather=null,sun={x:-200,y:400,z:-180},aspect=w/h}={}){
  const W=weather||LIGHTING.daylight;
  const chan=(s0,i)=>parseInt(s0.slice(1+2*i,3+2*i),16);
  const mixCss=(a,b,t,alpha=false)=>{
    const n=alpha?4:3,out=[];
    for(let i=0;i<n;i++)out.push(Math.round(chan(a,i)+(chan(b,i)-chan(a,i))*t).toString(16).padStart(2,'0'));
    return '#'+out.join('');
  };
  /* 天空渐变由当档 skyTop/skyBottom 推导，不再写死两套管子 */
  const grad=c.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,W.skyTop);
  grad.addColorStop(.45,mixCss(W.skyTop,W.skyBottom,.60));
  grad.addColorStop(.82,mixCss(W.skyTop,W.skyBottom,.94));
  grad.addColorStop(1,W.skyBottom);
  c.fillStyle=grad;c.fillRect(0,0,w,h);
  /* 地平线暖辉光：傍晚/暮色更明显，与低角度太阳同向 */
  if(W.warm>0){
    const hg=c.createLinearGradient(0,h*.52,0,h);
    hg.addColorStop(0,'rgba(255,196,130,0)');
    hg.addColorStop(1,'rgba(255,190,120,'+(W.warm*.32).toFixed(3)+')');
    c.fillStyle=hg;c.fillRect(0,h*.52,w,h*.48);
  }
  let seed=61183;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function puff(x,y,rx,ry,alpha,shade=false){
    c.save();c.translate(x,y);c.scale(rx,ry);
    const g=c.createRadialGradient(0,0,.05,0,0,1),color=shade?'132,150,150':'255,253,240';
    g.addColorStop(0,'rgba('+color+','+alpha+')');g.addColorStop(.5,'rgba('+color+','+(alpha*.93)+')');
    g.addColorStop(.82,'rgba('+color+','+(alpha*.46)+')');g.addColorStop(1,'rgba('+color+',0)');
    c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  const banks=[[.16,.18,.16],[.52,.09,.12],[.7,.32,.2],[.23,.43,.23],[.07,.66,.2],[.88,.6,.22]];
  /* 云量驱动云带数量与浓度；阴天用灰云，晴天用白云 */
  const count=Math.max(1,Math.min(banks.length,Math.round(banks.length*(W.cloud+.16))));
  const grey=W.cloud>.7;
  for(let bi=0;bi<count;bi++){
    const [u,v,span]=banks[bi],x=u*w,y=v*h,rx=span*w,ry=(.018+rand()*.014)*h;
    puff(x,y+ry*.3,rx*.7,ry*.65,grey?.30:.12,true);
    for(let lobe=0;lobe<10;lobe++){
      const dx=(rand()-.5)*rx*1.5,dy=(rand()-.65)*ry*.9;
      puff(x+dx,y+dy,rx*(.1+rand()*.18),ry*(.48+rand()*.5),(grey?.34:.30)+rand()*.2,grey);
    }
  }
  /* ★ 太阳盘原来用 angle+2.4 的固定偏移，和影子方向完全对不上。
     现在直接由 sun 的方位角推 x，太阳盘亮度由当档 sunDisc 决定（阴天几乎不可见）。 */
  const angle=Math.atan2(sun.z,sun.x);
  const x=(.5+Math.cos(angle)*.34)*w, y=.145*h;
  const radiusY=h*.019,radiusX=radiusY*w/(h*Math.max(.1,aspect));
  c.save();c.translate(x,y);c.scale(radiusX,radiusY);
  c.globalAlpha=Math.max(0,Math.min(1,W.sunDisc));
  const warm=W.warm>.3;
  const halo=c.createRadialGradient(0,0,0,0,0,8);
  halo.addColorStop(0,warm?'#ffe3afa6':'#fff0c787');halo.addColorStop(.18,warm?'#ffe2ad40':'#fff0c933');
  halo.addColorStop(.55,'#fff0cc16');halo.addColorStop(1,'#fff0cc00');
  c.fillStyle=halo;c.fillRect(-8,-8,16,16);
  const disc=c.createRadialGradient(-.15,-.18,0,0,0,1);
  disc.addColorStop(0,'#fffdf0');disc.addColorStop(.76,warm?'#fff1ce':'#fff8df');disc.addColorStop(1,warm?'#ffe5ad':'#ffedbc');
  c.fillStyle=disc;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();
  return {sun:{x,y,radiusX,radiusY},cloudBanks:count,aspect};
}

`,
  'paintSky 天气化'
);

/* ===== 4. createAtmosphere：支持过渡中间帧 ===== */
block('function createAtmosphere(', '\n/* ===== campus-walk.js ===== */',
`function createAtmosphere(T,scene,canvas){
  const texture=new T.CanvasTexture(canvas);texture.encoding=T.sRGBEncoding;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;
  const previousBackground=scene.background,previousFog=scene.fog,fog=new T.FogExp2(0xcbdfee,.00026);scene.background=texture;scene.fog=fog;
  let weather=LIGHTING.daylight,sun={x:-200,y:400,z:-180},aspect=canvas.width/canvas.height,revision=0,layout=null;
  function paint(){layout=paintSky(canvas.getContext('2d'),canvas.width,canvas.height,{weather,sun,aspect});texture.needsUpdate=true;revision++;}
  function apply(w){weather=w||LIGHTING.daylight;fog.color.setHex(weather.fog);fog.density=weather.fogDensity;paint();}
  return {
    texture,
    update(camera){const next=Math.max(.1,Number(camera.aspect)||1);if(!revision||Math.abs(next-aspect)>.00001){aspect=next;paint();}},
    setLighting(name){apply(LIGHTING[name]||LIGHTING.daylight);},
    setWeather(w){apply(w);},          /* 11-06：天气过渡的中间帧 */
    setSun(position){if(!revision||position.x!==sun.x||position.y!==sun.y||position.z!==sun.z){sun={x:position.x,y:position.y,z:position.z};paint();}},
    get revision(){return revision;},get layout(){return layout;},
    dispose(){if(scene.background===texture)scene.background=previousBackground;if(scene.fog===fog)scene.fog=previousFog;texture.dispose();},
  };
}
`,
  'createAtmosphere 支持 setWeather'
);

/* ===== 5. setLighting：680ms 平滑过渡 ===== */
block('function setLighting(name){', '\nfunction updateSun(',
`let currentMood=LIGHTING.daylight, moodRaf=0;
function mixHex(a,b,t){
  const ar=(a>>16)&255,ag=(a>>8)&255,ab=a&255,br=(b>>16)&255,bg=(b>>8)&255,bb=b&255;
  return (Math.round(ar+(br-ar)*t)<<16)|(Math.round(ag+(bg-ag)*t)<<8)|Math.round(ab+(bb-ab)*t);
}
function mixCssColor(a,b,t,alpha){
  const ch=(s0,i)=>parseInt(s0.slice(1+2*i,3+2*i),16),n=alpha?4:3,out=[];
  for(let i=0;i<n;i++)out.push(Math.round(ch(a,i)+(ch(b,i)-ch(a,i))*t).toString(16).padStart(2,'0'));
  return '#'+out.join('');
}
function lerpMood(a,b,t){
  const m={label:b.label};
  for(const k of ['sky','bounce','sun','fillColor','ground','roof','stone','fog'])m[k]=mixHex(a[k],b[k],t);
  m.skyTop=mixCssColor(a.skyTop,b.skyTop,t,false);
  m.skyBottom=mixCssColor(a.skyBottom,b.skyBottom,t,false);
  m.glow=mixCssColor(a.glow,b.glow,t,true);
  for(const k of ['ambient','strength','exposure','fill','shadowOpacity','cloud','sunDisc','fogDensity','warm'])m[k]=a[k]+(b[k]-a[k])*t;
  return m;
}
function applyMood(m){
  ambientLight.color.setHex(m.sky);ambientLight.groundColor.setHex(m.bounce);ambientLight.intensity=m.ambient;
  sun.color.setHex(m.sun);sun.intensity=m.strength;renderer.toneMappingExposure=m.exposure;
  if(fillLight){fillLight.color.setHex(m.fillColor);fillLight.intensity=m.fill==null?.2:m.fill;}
  campus.materials.ground.color.setHex(m.ground);campus.materials.roof.color.setHex(m.roof);campus.materials.libraryStone.color.setHex(m.stone);
  const sky=document.querySelector('.viewport');
  sky.style.setProperty('--sky-top',m.skyTop);sky.style.setProperty('--sky-bottom',m.skyBottom);sky.style.setProperty('--sun-glow',m.glow);
  staticShadow.material.opacity=m.shadowOpacity;
}
function setLighting(name,instant){
  const key=LIGHTING[name]?name:'daylight',target=LIGHTING[key];
  $('lighting').value=key;$('light-name').textContent=target.label;
  if(moodRaf){cancelAnimationFrame(moodRaf);moodRaf=0;}
  const from=currentMood;
  /* 首次 / 同档 / 减少动态效果：直接落地，不为同档空转 680ms */
  if(instant||reduced.matches||from===target){currentMood=target;applyMood(target);atmosphere?.setLighting(key);requestRender();return;}
  /* 11-06：天气变化改为 680ms 缓动。灯、曝光、阴影浓度逐帧插值；
     天空贴图在中点重绘一次、结束再对齐一次，避免每帧重画大 canvas 拖帧。 */
  const t0=performance.now(),dur=680;let midDone=false;
  const step=(t)=>{
    const k=Math.min(1,(t-t0)/dur),e=k*k*(3-2*k);
    applyMood(lerpMood(from,target,e));
    if(!midDone&&k>=.5){atmosphere?.setWeather(lerpMood(from,target,e));midDone=true;}
    requestRender();
    if(k<1){moodRaf=requestAnimationFrame(step);}
    else{currentMood=target;atmosphere?.setLighting(key);requestRender();moodRaf=0;}
  };
  moodRaf=requestAnimationFrame(step);
}
`,
  'setLighting 平滑过渡'
);

/* ===== 6. 建筑比例与配色收敛（体验图里能指认的） ===== */
sub(
`    mechanical:new T.MeshLambertMaterial({color:0xa7ada4}),`,
`    mechanical:new T.MeshLambertMaterial({color:0xb9c0b6}),`,
  '屋顶设备提亮（减少深色块）'
);
sub(
`    solar:new T.MeshLambertMaterial({color:0x2e4058}),`,
`    solar:new T.MeshLambertMaterial({color:0x40566b}),`,
  '光伏板配色收敛'
);
sub(
`add('junction','mechanical',x+wx*ca+wz*sa,lv+2.2,z+wz*ca-wx*sa,2.4,2.0,2.4,angle);`,
`add('junction','mechanical',x+wx*ca+wz*sa,lv+2.2,z+wz*ca-wx*sa,2.0,1.7,2.0,angle);`,
  '水箱尺寸收敛'
);
sub(
`add('box','mechanical',x+wx*ca+wz*sa,lv+0.55,z+wz*ca-wx*sa,2.2,1.1,2.2,angle);`,
`add('box','mechanical',x+wx*ca+wz*sa,lv+0.55,z+wz*ca-wx*sa,1.9,.95,1.9,angle);`,
  '设备基座尺寸收敛'
);
sub(
`add('box','mechanical',x+ox*ca+oz*sa,lv+0.45,z+oz*ca-ox*sa,1.5,0.9,1.1,angle);`,
`add('box','mechanical',x+ox*ca+oz*sa,lv+0.45,z+oz*ca-ox*sa,1.3,0.8,1.0,angle);`,
  '空调机组尺寸收敛'
);

fs.writeFileSync(DST, s, 'utf8');
console.log('---');
console.log('源文件', orig, '字符 → 输出', s.length, '字符（', s.length - orig, '）');
console.log('已写', DST);
