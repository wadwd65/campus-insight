/* 11-07 三改：图书馆玻璃入口「做得好看」+「加回台阶」
 * 输入 v6-final.html → v7-final.html
 * 上一版把玻璃门斗整组删掉；用户要的是优化而非消失。
 * 做法：贴幕墙的薄玻璃面(0.08m) + 细金属分格 + 薄雨棚 + 三级浅台阶，
 * 所有构件厚度 ≤0.16m，避免再读成「一堆方块」；台阶顶面与广场平台(.4)齐平。
 * 仅 entry(...,plain=true) 的图书馆两处生效，其它建筑原样。
 */
const fs=require('fs');
const SRC='D:/repro-test/v6-final.html',DST='D:/repro-test/v7-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,110)}`);s=s.replace(from,to);console.log('  ✓',label);}
sub(
`    /* 11-07 plain：图书馆门前用户明确要求删掉凸出的玻璃方块。
       去掉玻璃门斗、三级台阶块、两根方柱与柱础、木饰条，只留一条薄雨棚线，
       入口直接贴玻璃幕墙。其它建筑不传 plain，保持原门头。 */
    if(plain){part(p,ox,y,oz+1.1,w,.12,2.2,'curb');return;}`,
`    /* 11-07 三改：用户要「玻璃模型更好看」并「加回台阶」。
       不再用 2.2m 深的凸出玻璃盒，改成贴幕墙的薄玻璃面 + 细金属分格，
       配薄雨棚与三级低矮浅台阶；所有构件都做薄，不回到方块堆。 */
    if(plain){
      const gw=w*.62, gh=4.3, gy=gh/2+.10;
      /* 通透玻璃面：0.08m 薄片，几乎贴着幕墙 */
      part(p,ox,gy,oz-.06,gw,gh,.08,'libraryGlass',p.key);
      /* 细竖框 6 道 + 上下横梁，做出幕墙分格而不是一整块玻璃板 */
      for(let i=0;i<6;i++){
        const fx=ox-gw/2+(i+.5)*gw/6;
        part(p,fx,gy,oz-.13,.055,gh,.075,'white');
      }
      part(p,ox,gy+gh/2,oz-.13,gw+.18,.10,.10,'white');
      part(p,ox,.14,oz-.13,gw+.18,.10,.10,'white');
      /* 中央双开门缝：一条深色细线 */
      part(p,ox,gy,oz-.18,.05,gh*.90,.05,'glass');
      /* 薄雨棚 + 前沿压边 */
      part(p,ox,y,oz+1.1,w*.82,.10,2.3,'curb');
      part(p,ox,y-.09,oz+2.22,w*.84,.055,.10,'white');
      /* 三级浅台阶：每级 0.12m 高、0.85m 深、宽度递减。
         顶面 .19/.31/.43 —— 比门前广场平台顶(.40) 高 3cm，
         避免台阶与平台顶面共面导致移动时 z-fighting 闪烁。 */
      for(let i=0;i<3;i++){
        part(p,ox,.13+i*.12,oz+2.35-i*.72,w*.72-i*.5,.12,.85,'paving',p.key);
      }
      return;
    }`,
  '图书馆玻璃入口重做 + 三级浅台阶');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
