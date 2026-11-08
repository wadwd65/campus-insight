/* 11-07 图书馆门前二次收敛：双花坛合一、去掉两片木格栅、柱数 5→3 */
const fs=require('fs');
const SRC='D:/repro-test/v4-fix.html',DST='D:/repro-test/v5-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,90)}`);s=s.replace(from,to);console.log('  ✓',label);}
sub(`    part(q,0,.25,-25,76,.3,16,'paving');for(const dx of [-27,27])garden(q,dx,-25,15,7);
        for(const side of [-1,1])pergola(q,side*25,0,19,13,18.6);`,
`    part(q,0,.25,-25,76,.3,16,'paving');
        /* 11-07：门前原为左右两个花坛 + 两片木格栅，叠上门廊柱与三级台阶后
           读成「一堆方块」。合成一个中央花坛、移除两片格栅，广场留白更干净。 */
        garden(q,0,-25,15,7);`,
  '双花坛合一 + 去木格栅');
sub(`colonnade(q,0,-14.2,5,5.6,5.8,.6,true);`,`colonnade(q,0,-14.2,3,5.6,5.8,.6,true);`,'门廊柱 5→3');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
