/* 11-08 十八改 d：光轴回退源挪到右上天空（v28 → v29） */
const fs=require('fs');
const SRC='D:/repro-test/v28-final.html',DST='D:/repro-test/v29-final.html';
let s=fs.readFileSync(SRC,'utf8');
const a=`    let su = 0.78, sv = 0.14, vis = 0.45;`;
const b=`    let su = 0.78, sv = 0.86, vis = 0.45;  /* v 向上 = 天空侧，光束从右上下来 */`;
if(s.split(a).length-1!==1)throw new Error('锚点不唯一');
s=s.replace(a,b);console.log('  ✓ 回退光源移到右上天空');
fs.writeFileSync(DST,s,'utf8');console.log('已写',DST);
