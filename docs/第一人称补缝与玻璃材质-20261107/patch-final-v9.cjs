/* 11-07 五改：第一人称驱动的补缝 + 玻璃材质替换（材质本身，非模型）
 * v8-final.html → v9-final.html  —— 所有锚点用无缩进的唯一字符串 */
const fs=require('fs');
const SRC='D:/repro-test/v8-final.html',DST='D:/repro-test/v9-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,100)}`);s=s.replace(from,to);console.log('  ✓',label);}

/* A1 新玻璃贴图资源 */
sub(
`for(let i=0;i<roofBoxUV.count;i++)roofBoxUV.setX(i,roofBoxUV.getX(i)*.85);
  const materials={`,
`for(let i=0;i<roofBoxUV.count;i++)roofBoxUV.setX(i,roofBoxUV.getX(i)*.85);
  /* 11-07 新玻璃贴图：浅青白渐变 + 竖向高光条 + 层线，替代原 textures.libraryGlass。
     这是**材质资源**替换，不改动任何几何/模型。 */
  const GLASS_SHEEN=(()=>{
    const cv=document.createElement('canvas');cv.width=256;cv.height=512;
    const g=cv.getContext('2d'),grd=g.createLinearGradient(0,0,0,512);
    grd.addColorStop(0,'#eaf7f8');grd.addColorStop(.45,'#d6edf0');
    grd.addColorStop(.8,'#c3e0e6');grd.addColorStop(1,'#b6d6de');
    g.fillStyle=grd;g.fillRect(0,0,256,512);
    for(let i=0;i<6;i++){
      const x=22+i*42,hg=g.createLinearGradient(x,0,x+16,0);
      hg.addColorStop(0,'rgba(255,255,255,0)');hg.addColorStop(.5,'rgba(255,255,255,.55)');hg.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=hg;g.fillRect(x,0,16,512);
    }
    g.strokeStyle='rgba(120,165,175,.16)';g.lineWidth=1;
    for(let y=64;y<512;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();}
    const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.minFilter=T.LinearFilter;t.magFilter=T.LinearFilter;
    return t;
  })();
  const materials={`,
  'A1 新增玻璃贴图资源');
/* A2 材质定义整条替换 */
sub(
`libraryGlass:new T.MeshPhongMaterial({color:0xffffff,map:textures.libraryGlass||null,shininess:16,specular:0x81795f}),`,
`/* 11-07：原 MeshPhong + 旧图集玻璃贴图已完全替换。
       新材质 = MeshPhysicalMaterial + 浅青高光贴图 + clearcoat/低粗糙度，类型与参数都不同。 */
    libraryGlass:new T.MeshPhysicalMaterial({color:0xdff1f4,map:GLASS_SHEEN,
      metalness:.10,roughness:.08,clearcoat:1,clearcoatRoughness:.05,
      reflectivity:1,envMapIntensity:1.3,transparent:false,side:T.DoubleSide}),`,
  'A2 替换 libraryGlass 材质定义');
/* A3 按楼分槽短路，保住新材质不被图集覆盖 */
sub(
`function PB_material(baseName,key){`,
`function PB_material(baseName,key){
    /* 11-07：新玻璃材质全局共享，不走按楼图集 clone（否则被换回旧贴图）。
       保留 PB_MAT2PART 映射 ⇒ 批次名与实例数不变，纯材质替换。 */
    if(baseName==='libraryGlass')return materials.libraryGlass;`,
  'A3 按楼分槽对新玻璃短路');

/* B1 室内地板条缝：下方铺整片底层 */
sub(
`for(let i=0;i<18;i++)box(i%2?C.oak:0xa8834f,0,-.15,-8.5+i,14,.3,.98);`,
`/* 11-07 第一人称补缝：木条间距 1m、条宽 .98 ⇒ 0.02m 缝会透出背景。
      先铺整片底层，缝里看到的是木色而不是空洞；底层顶 -.3 正好接木条底。 */
   box(C.oakD,0,-.42,0,14,.24,18.2);
   for(let i=0;i<18;i++)box(i%2?C.oak:0xa8834f,0,-.15,-8.5+i,14,.3,.98);`,
  'B1 室内地板加底层');
/* B2 踢脚线补齐四角 */
sub(
`box(C.trim,0,.07,-8.86,13.6,.14,.1);`,
`box(C.trim,0,.07,-8.86,14,.14,.1);
   /* 11-07：南墙门洞两侧原本没有踢脚线，第一人称看到腰线断开，补齐。 */
   for(const x of [-4.4,4.4])box(C.trim,x,.07,8.86,5.2,.14,.1);`,
  'B2 北墙加长 + 南墙补踢脚');
sub(
`for(const sx of [-1,1])box(C.trim,sx*6.86,.07,0,.1,.14,17.6);`,
`for(const sx of [-1,1])box(C.trim,sx*6.86,.07,0,.1,.14,18);`,
  'B3 东西墙踢脚加长到房间全长');

/* C 室外台阶/门厅衔接 */
sub(
`/* 三级浅台阶：从广场平台顶(.40) 起逐级抬到入口(.82)，`,
`/* 11-07 第一人称补缝：玻璃面底 .10 与台阶顶 .82 之间原本悬空，
         加连续门厅基座 + 门槛平台，把台阶、门厅、幕墙底封成完整结构。 */
      part(p,ox,.41,oz-.10,gw+.30,.82,.42,'curb');
      part(p,ox,.82,oz-.62,gw+.30,.16,1.20,'curb');
      /* 三级浅台阶：从广场平台顶(.40) 起逐级抬到入口(.82)，`,
  'C 门厅基座 + 门槛平台');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
