/* 11-07 十二改：消掉人行道 0.02m 错层，让环路四个拐角真正齐平
 * v15-final.html → v16-final.html
 * v15 的拐角 miter 补块已同高同材质，但 sidewalk 段沿用 .14/.12 交替错层，
 * 补块固定 .12 ⇒ 一半路段与补块顶面差 0.02m，拐角处留细台阶/断层。
 * 现在道路与 sidewalk 都各自只在「同一 InstancedMesh 批次」内交叠，
 * 同批次实例顺序固定不会帧间交替，错层已无必要，统一为 .14 / .29。
 */
const fs=require('fs');
const SRC='D:/repro-test/v15-final.html',DST='D:/repro-test/v16-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,100)}`);s=s.replace(from,to);console.log('  ✓',label);}
sub(
`    add('box','sidewalk',(ax+bx)/2,.14-(ri%2)*.02,(az+bz)/2,road.w+5,.22,length+.6,angle);`,
`    /* 11-07 十二改：取消 .14/.12 交替错层，所有人行道顶面统一 .25，
       拐角才不会出现 0.02m 细台阶；同批次交叠不会帧间闪烁。 */
    add('box','sidewalk',(ax+bx)/2,.14,(az+bz)/2,road.w+5,.22,length+.6,angle);`,
  '路段人行道统一标高');
sub(
`    add('box','sidewalk',x,.12,z,side+5,.22,side+5,phi);`,
`    add('box','sidewalk',x,.14,z,side+5,.22,side+5,phi);`,
  '拐角补块与路段齐平');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
