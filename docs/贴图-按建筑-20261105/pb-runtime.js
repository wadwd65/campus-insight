/* ===== 11-05 按建筑 × 部位贴图（PB = Per-Building）========================
   老问题：8 张通用 AI 材质全校园共用，texture.repeat 是全局常量；贴图里的
   分格缝 / 楼层线按贴图自身 UV 走，与每栋楼真实层高、开间、首层高度无关
   ⇒ 建筑下半部分「很多东西对不上」。
   做法：① 每栋楼按 wing() 实测的 h / floors / gH / upH 生成 4 张部位图；
        ② 楼层线、首层带、勒脚分界按真实高度比例画，与几何窗位对齐；
        ③ 竖向不做规则开间缝（box 长短边共用 UV，画了必然错位）；
        ④ 绘世为每栋出的专属材质只取「高通细节层」：斜纹/接缝这类低频
           伪结构被减掉，留下真实颗粒与色偏；
        ⑤ 104 格打进一张图集，材质 clone 靠 offset/repeat 取格，共享同一
           texture source —— 显存只一份，也不额外增加 shader 变体。
   记录者：WorkBuddy / 2026-11-05
   ====================================================================== */
const PB_DETAIL = PB_DETAIL_JSON;
const PB_TYPES = new Set(['teaching','library','dorm','canteen','shop','gym']);
const PB_PARTS = ['wall','window','roof','trim'];
/* 绘世出的四张分别叫 wall/base/roof/trim；base 那张偏暗，正好给玻璃用 */
const PB_DETAIL_PART = { wall:'wall', window:'base', roof:'roof', trim:'trim' };
/* 只给这些材质按楼分槽；窗框 / 台阶 / 雨篷等继续共用，避免批次暴涨 */
const PB_MAT2PART = {
  brick:'wall', brickLife:'wall', brickPublic:'wall', sand:'wall', libraryStone:'wall',
  windowBand:'window', libraryGlass:'window',
  roof:'roof', roofLife:'roof', roofPublic:'roof',
  curb:'trim', curbLife:'trim', curbPublic:'trim',
};
/* 各楼型 × 部位的基色。材质 color 一律置白（贴图×color 双重相乘会洗色），
   所以颜色全部由这张图决定。 */
const PB_BASE = {
  teaching:{ wall:'#eceee4', window:'#6b7d72', roof:'#c9cec6', trim:'#e4e6dc' },
  library: { wall:'#e6e0d0', window:'#6f7c72', roof:'#c8c4b6', trim:'#e0dbca' },
  dorm:    { wall:'#eadfd0', window:'#6a7468', roof:'#b98a6f', trim:'#e3d7c6' },
  canteen: { wall:'#ece0c6', window:'#6f7869', roof:'#b9b5a5', trim:'#e6dcc4' },
  shop:    { wall:'#ece3d2', window:'#6f7869', roof:'#b9b5a5', trim:'#e6ddcd' },
  gym:     { wall:'#dfe4e2', window:'#64766f', roof:'#bfc7c6', trim:'#dce2e0' },
};

function PB_hash(s){ let h=2166136261; for(const c of s){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
function PB_rand(seed){ let s=seed>>>0; return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
function PB_tint(hex,avg,k){
  const m=/^#([0-9a-f]{6})$/i.exec(hex); if(!m||!avg)return hex;
  const v=parseInt(m[1],16), R=v>>16&255, G=v>>8&255, B=v&255;
  /* 只借 AI 图的「色偏」，不借明度 —— 否则灰底会把浅墙压脏 */
  const cl=x=>Math.max(0,Math.min(255,Math.round(x)));
  return '#'+[cl(R+(avg[0]-128)*k),cl(G+(avg[1]-128)*k),cl(B+(avg[2]-128)*k)]
    .map(x=>x.toString(16).padStart(2,'0')).join('');
}
const PB_dc=new Map();
function PB_detailCanvas(key){
  if(PB_dc.has(key))return PB_dc.get(key);
  const d=PB_DETAIL, idx=d&&d.slots?d.slots[key]:undefined;
  if(idx===undefined||!d.bytes)return null;
  const N=d.cell||32, off=idx*N*N;
  const cv=document.createElement('canvas'); cv.width=cv.height=N;
  const ctx=cv.getContext('2d'), im=ctx.createImageData(N,N);
  for(let p=0;p<N*N;p++){
    const v=d.bytes[off+p]??128;
    im.data[p*4]=im.data[p*4+1]=im.data[p*4+2]=v; im.data[p*4+3]=255;
  }
  ctx.putImageData(im,0,0); PB_dc.set(key,cv); return cv;
}
function PB_grain(c,s,seed,strength){
  const rnd=PB_rand(seed), n=Math.min(2600,Math.round(s*s*.16));
  const a=Math.max(.02,Math.min(.10,(strength||8)/160));
  for(let i=0;i<n;i++){
    c.fillStyle=(i&1)?`rgba(255,255,255,${a})`:`rgba(48,54,46,${a})`;
    c.fillRect(rnd()*s,rnd()*s,1,1);
  }
}
/* ★ 治本：楼层线 / 首层带严格按该楼真实 gH + n×upH 画，不再等分贴图 */
function PB_drawFloors(c,s,sp){
  if(!sp||!sp.h||!sp.floors)return;
  const {h,floors,gH,upH}=sp;
  /* ★ 0.6m 抬升补偿：主体方体是 add(..., y=h/2+.6, ...)，底面在世界 y=0.6，
     而 wing() 的几何楼层 yCur 从世界 y=0 起算。不减这 0.6，贴图里的勒脚分界
     和每层楼板线都会比真实窗位高 0.6m —— 就是"下面对不上"的最后一处残留。 */
  const LIFT=0.6;
  const baseFrac=Math.min(.42,Math.max(.10,(gH-LIFT)/h));
  const gy=s*(1-baseFrac);
  const g=c.createLinearGradient(0,gy,0,s);
  g.addColorStop(0,'rgba(60,64,58,0)'); g.addColorStop(1,'rgba(48,52,46,.20)');
  c.fillStyle=g; c.fillRect(0,gy,s,s-gy);
  /* 勒脚分界 = 首层真实高度 */
  c.fillStyle='rgba(52,58,50,.32)'; c.fillRect(0,gy-1.5,s,2);
  c.fillStyle='rgba(255,255,255,.16)'; c.fillRect(0,gy+1,s,1);
  /* 每层楼板线：累积高度，不用 floors 等分（首层比标准层高） */
  let acc=gH;
  for(let f=1;f<floors;f++){
    const yy=s*(1-(acc-LIFT)/h);
    if(yy>2&&yy<s-2){
      c.fillStyle='rgba(58,64,56,.22)'; c.fillRect(0,yy-1,s,1.6);
      c.fillStyle='rgba(255,255,255,.13)'; c.fillRect(0,yy+.8,s,1);
    }
    acc+=upH;
  }
  const gg=c.createLinearGradient(0,s*.94,0,s);
  gg.addColorStop(0,'rgba(40,44,38,0)'); gg.addColorStop(1,'rgba(40,44,38,.18)');
  c.fillStyle=gg; c.fillRect(0,s*.94,s,s*.06);
}
function PB_drawGlass(c,s){
  const g=c.createLinearGradient(0,0,0,s);
  g.addColorStop(0,'#93a59c'); g.addColorStop(.45,'#5d7169'); g.addColorStop(1,'#39473f');
  c.fillStyle=g; c.fillRect(0,0,s,s);
  c.fillStyle='rgba(18,26,22,.42)'; c.fillRect(0,0,s,s*.10);
  c.save(); c.globalAlpha=.12; c.fillStyle='#e8f2ea';
  c.beginPath(); c.moveTo(s*.14,0); c.lineTo(s*.38,0); c.lineTo(s*.10,s); c.lineTo(-s*.14,s); c.closePath(); c.fill();
  c.restore();
  c.fillStyle='rgba(230,238,228,.22)'; c.fillRect(s*.5-1,0,2,s);
  c.fillStyle='rgba(240,246,235,.18)'; c.fillRect(0,s*.52,s,1.5);
}
function PB_drawRoof(c,s){
  c.strokeStyle='rgba(255,255,255,.07)'; c.lineWidth=1;
  for(let k=1;k<4;k++){ c.beginPath(); c.moveTo(k*s/4,0); c.lineTo(k*s/4,s); c.stroke(); }
  const g=c.createLinearGradient(0,0,s,s);
  g.addColorStop(0,'rgba(255,255,255,.05)'); g.addColorStop(1,'rgba(0,0,0,.08)');
  c.fillStyle=g; c.fillRect(0,0,s,s);
}
function PB_drawTrim(c,s){
  c.fillStyle='rgba(255,255,255,.22)'; c.fillRect(0,0,s,3);
  c.fillStyle='rgba(40,48,42,.12)'; c.fillRect(0,s-3,s,3);
}
function PB_drawPart(c,x,y,S,p,part,sp){
  c.save();
  c.beginPath(); c.rect(x+2,y+2,S-4,S-4); c.clip();
  c.translate(x+2,y+2); const s=S-4;
  const style=PB_BASE[p.type]||PB_BASE.teaching;
  const dkey=p.key+'/'+PB_DETAIL_PART[part];
  const avg=PB_DETAIL&&PB_DETAIL.avg?PB_DETAIL.avg[dkey]:null;
  const grain=PB_DETAIL&&PB_DETAIL.grain?PB_DETAIL.grain[dkey]:8;
  c.fillStyle=PB_tint(style[part],avg,.18); c.fillRect(0,0,s,s);
  const dc=PB_detailCanvas(dkey);
  if(dc){ c.save(); c.globalAlpha=.55; c.globalCompositeOperation='soft-light'; c.drawImage(dc,0,0,s,s); c.restore(); }
  PB_grain(c,s,PB_hash(p.key+part),grain);
  if(part==='wall')PB_drawFloors(c,s,sp);
  else if(part==='window')PB_drawGlass(c,s,sp);
  else if(part==='roof')PB_drawRoof(c,s,sp);
  else if(part==='trim')PB_drawTrim(c,s,sp);
  c.restore();
}
function PB_buildAtlas(T,places,spec){
  const COLS=8,S=128,ROWS=Math.ceil(places.length*PB_PARTS.length/COLS);
  const cv=document.createElement('canvas'); cv.width=COLS*S; cv.height=ROWS*S;
  const c=cv.getContext('2d'), slot=new Map();
  c.fillStyle='#ffffff'; c.fillRect(0,0,cv.width,cv.height);
  let i=0;
  for(const p of places)for(const part of PB_PARTS){
    const col=i%COLS,row=(i/COLS)|0;
    PB_drawPart(c,col*S,row*S,S,p,part,spec.get(p.key));
    /* 内缩 2px 做 gutter，防止双线性/mipmap 取到邻格；
       CanvasTexture flipY=true ⇒ canvas 顶部对应 UV v=1 */
    const gx=col*S+2,gy=row*S+2,gw=S-4,gh=S-4;
    slot.set(p.key+'/'+part,[gx/cv.width,1-(gy+gh)/cv.height,gw/cv.width,gh/cv.height]);
    i++;
  }
  const tex=new T.CanvasTexture(cv);
  tex.wrapS=tex.wrapT=T.ClampToEdgeWrapping;
  tex.encoding=T.sRGBEncoding; tex.anisotropy=8;
  tex.minFilter=T.LinearMipmapLinearFilter; tex.generateMipmaps=true;
  return {tex,slot,cells:i,size:[cv.width,cv.height]};
}
