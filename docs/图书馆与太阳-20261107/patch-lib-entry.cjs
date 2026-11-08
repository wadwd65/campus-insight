/* 11-07 图书馆门前：真正删掉那个凸出的玻璃门斗方块
 * 输入 v5-final.html → v6-final.html
 * 用户明确指出「门前那个玻璃方块还在」= entry() 里的 libraryGlass 门斗盒，
 * 上一轮只收敛了柱廊/花坛/格栅，没动它。本轮给 entry 加 plain 开关，
 * 仅图书馆两处调用生效，其余建筑入口保持原样。
 */
const fs=require('fs');
const SRC='D:/repro-test/v5-final.html',DST='D:/repro-test/v6-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,100)}`);s=s.replace(from,to);console.log('  ✓',label);}
sub(
`function entry(p,ox,oz,w=12,y=4.5){
    /* 10-28：原来是"一块玻璃板 + 两根细杆 + 三级台阶"，人视高度看是飘在墙上的。
       改成真正的门头：台阶 → 门斗（有进深的玻璃盒）→ 雨棚（带檐口压边）→ 方柱加柱础。 */`,
`function entry(p,ox,oz,w=12,y=4.5,plain=false){
    /* 11-07 plain：图书馆门前用户明确要求删掉凸出的玻璃方块。
       去掉玻璃门斗、三级台阶块、两根方柱与柱础、木饰条，只留一条薄雨棚线，
       入口直接贴玻璃幕墙。其它建筑不传 plain，保持原门头。 */
    if(plain){part(p,ox,y,oz+1.1,w,.12,2.2,'curb');return;}
    /* 10-28：原来是"一块玻璃板 + 两根细杆 + 三级台阶"，人视高度看是飘在墙上的。
       改成真正的门头：台阶 → 门斗（有进深的玻璃盒）→ 雨棚（带檐口压边）→ 方柱加柱础。 */`,
  'entry 增加 plain 干净入口');
sub(`entry(q,0,17,14,6);`,`entry(q,0,17,14,6,true);`,'lib-north 用干净入口');
sub(`entry(q,0,-18,17,6.6);`,`entry(q,0,-18,17,6.6,true);`,'lib 用干净入口');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
