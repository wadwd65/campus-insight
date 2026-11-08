/* 11-07 六改：第一人称截图指出的三处 —— 玻璃读成瓷砖墙 / 门厅与主体脱开 / 雨棚底面悬空
 * v9-final.html → v10-final.html，严格限这三处 */
const fs=require('fs');
const SRC='D:/repro-test/v9-final.html',DST='D:/repro-test/v10-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,100)}`);s=s.replace(from,to);console.log('  ✓',label);}

/* A1 玻璃贴图提亮（材质资源） */
sub(
`grd.addColorStop(0,'#eaf7f8');grd.addColorStop(.45,'#d6edf0');
    grd.addColorStop(.8,'#c3e0e6');grd.addColorStop(1,'#b6d6de');`,
`grd.addColorStop(0,'#f6fdfe');grd.addColorStop(.40,'#e2f4f7');
    grd.addColorStop(.75,'#cfe9ef');grd.addColorStop(1,'#bcdde5');`,
  'A1 玻璃贴图渐变提亮');
/* A2 去掉横向层线（近看像瓷砖缝），改两道斜向天空反光 */
sub(
`g.strokeStyle='rgba(120,165,175,.16)';g.lineWidth=1;
    for(let y=64;y<512;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(256,y);g.stroke();}`,
`/* 11-07：横向层线在第一人称近看会读成瓷砖缝，全部去掉；
       改成斜向天空反光带，保留原有 6 道竖向高光。 */
    for(let i=0;i<2;i++){
      const sx=-40+i*150,hg=g.createLinearGradient(sx,0,sx+90,512);
      hg.addColorStop(0,'rgba(255,255,255,0)');
      hg.addColorStop(.5,'rgba(255,255,255,.42)');
      hg.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=hg;g.beginPath();
      g.moveTo(sx,0);g.lineTo(sx+46,0);g.lineTo(sx+136,512);g.lineTo(sx+90,512);
      g.closePath();g.fill();
    }`,
  'A2 去横层线 + 斜向高光');
/* B 玻璃材质高反光化（仍是材质本身） */
sub(
`    libraryGlass:new T.MeshPhysicalMaterial({color:0xdff1f4,map:GLASS_SHEEN,
      metalness:.10,roughness:.08,clearcoat:1,clearcoatRoughness:.05,
      reflectivity:1,envMapIntensity:1.3,transparent:false,side:T.DoubleSide}),`,
`    libraryGlass:new T.MeshPhysicalMaterial({color:0xffffff,map:GLASS_SHEEN,
      metalness:.04,roughness:.03,clearcoat:1,clearcoatRoughness:.02,
      reflectivity:1,envMapIntensity:1.8,transparent:false,side:T.DoubleSide}),`,
  'B 玻璃材质高反光化');
/* C 门厅：收窄玻璃面 + 两侧实体翼墙接回主体 */
sub(
`      const gw=w*.62, gh=4.3, gy=gh/2+.10;
      /* 通透玻璃面：0.08m 薄片，几乎贴着幕墙 */
      part(p,ox,gy,oz-.06,gw,gh,.08,'libraryGlass',p.key);
      /* 细竖框 6 道 + 上下横梁，做出幕墙分格而不是一整块玻璃板 */
      for(let i=0;i<6;i++){
        const fx=ox-gw/2+(i+.5)*gw/6;
        part(p,fx,gy,oz-.13,.055,gh,.075,'white');
      }`,
`      const gw=w*.40, gh=4.3, gy=gh/2+.10, span=w*.62;
      /* 11-07：第一人称截图显示原 10.5m 宽玻璃板是一堵孤立的「瓷砖墙」，
         两侧透出远处树木 = 与主体脱开。收窄玻璃面，两侧补实体翼墙接回主体。 */
      for(const side of [-1,1]){
        const ww=(span-gw)/2;
        part(p,ox+side*(gw/2+ww/2),gy,oz-.10,ww,gh,.22,'libraryStone',p.key);
      }
      part(p,ox,gy,oz-.06,gw,gh,.08,'libraryGlass',p.key);
      for(let i=0;i<4;i++){
        const fx=ox-gw/2+(i+.5)*gw/4;
        part(p,fx,gy,oz-.13,.055,gh,.075,'white');
      }`,
  'C 门厅收窄 + 两侧翼墙');
/* D 雨棚：收窄、底面提亮 */
sub(
`      part(p,ox,y,oz-1.1,w*.82,.10,2.3,'curb');
      part(p,ox,y-.09,oz-2.22,w*.84,.055,.10,'white');`,
`      /* 11-07：雨棚由 13.9m 收到 10.5m、进深 2.3→1.8，并给底面加浅色层，
         从下往上看不再是一整块深色无支撑悬板。 */
      part(p,ox,y,oz-.95,w*.62,.10,1.8,'curb');
      part(p,ox,y-.07,oz-.95,w*.62,.02,1.8,'white');
      part(p,ox,y-.09,oz-1.86,w*.64,.055,.10,'white');`,
  'D 雨棚收窄 + 底面提亮');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
