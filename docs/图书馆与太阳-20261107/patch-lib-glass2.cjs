/* 11-07 四改：修正台阶/雨棚方向 + 让三级台阶真正可见
 * v7-final.html → v8-final.html
 * 真因：entry 的 oz=-18，广场在更负的 z(-25) 一侧；上一版用 oz+2.35
 * 把台阶放到了朝建筑一侧，被 .40 高的广场平台挡住，近景根本看不出台阶。
 */
const fs=require('fs');
const SRC='D:/repro-test/v7-final.html',DST='D:/repro-test/v8-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,110)}`);s=s.replace(from,to);console.log('  ✓',label);}
sub(
`      /* 薄雨棚 + 前沿压边 */
      part(p,ox,y,oz+1.1,w*.82,.10,2.3,'curb');
      part(p,ox,y-.09,oz+2.22,w*.84,.055,.10,'white');
      /* 三级浅台阶：每级 0.12m 高、0.85m 深、宽度递减。
         顶面 .19/.31/.43 —— 比门前广场平台顶(.40) 高 3cm，
         避免台阶与平台顶面共面导致移动时 z-fighting 闪烁。 */
      for(let i=0;i<3;i++){
        part(p,ox,.13+i*.12,oz+2.35-i*.72,w*.72-i*.5,.12,.85,'paving',p.key);
      }`,
`      /* 薄雨棚 + 前沿压边：朝广场一侧（oz 更负），不是朝建筑一侧 */
      part(p,ox,y,oz-1.1,w*.82,.10,2.3,'curb');
      part(p,ox,y-.09,oz-2.22,w*.84,.055,.10,'white');
      /* 三级浅台阶：从广场平台顶(.40) 起逐级抬到入口(.82)，
         全部落在 oz 更负的广场侧，俯视/近景都能看清；
         每级前缘一条 0.03m 深色踏面线，让层次明确。 */
      for(let i=0;i<3;i++){
        const sy=.47+i*.14, sz=oz-2.7+i*.8, sw=w*.80-i*.55;
        part(p,ox,sy,sz,sw,.14,.90,'curb',p.key);
        part(p,ox,sy-.055,sz-.46,sw+.06,.03,.035,'gap');
      }`,
  '台阶/雨棚翻到广场侧并重做三级');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
