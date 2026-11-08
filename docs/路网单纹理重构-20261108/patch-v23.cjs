/* 11-08 十五改 d：路网纹理配色/虚线收尾（v22 → v23）
 * 结构已正确，仅让路面回到旧版深灰观感、黄虚线清晰可见。
 * 全部是同一张 canvas 里的常量，不涉及几何/拼接/材质类型。 */
const fs=require('fs');
const SRC='D:/repro-test/v22-final.html',DST='D:/repro-test/v23-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(a,b,l){if(s.split(a).length-1!==1)throw new Error(`[${l}] 锚点不唯一`);s=s.replace(a,b);console.log('  ✓',l);}
sub(`rg.strokeStyle='#e7eae1';`,`rg.strokeStyle='#dcded6';`,'人行道色');
sub(`rg.strokeStyle='#8d918c';`,`rg.strokeStyle='#72766f';`,'路面深灰');
sub(`rg.strokeStyle='#e9cf82';rg.lineWidth=Math.max(1.8,.4*ppm);`,
    `rg.strokeStyle='#f0cf6a';rg.lineWidth=Math.max(2.2,.55*ppm);`,'虚线色与宽度');
sub(`rg.setLineDash([2.6*ppm,3.4*ppm]);`,`rg.setLineDash([3.2*ppm,3.0*ppm]);`,'虚线节奏');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
