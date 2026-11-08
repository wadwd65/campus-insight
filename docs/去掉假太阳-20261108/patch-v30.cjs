/* 11-08 十九改：去掉天空贴图上画的「假太阳」（v29 → v30）
 * 后处理链已提供动态太阳光晕 + God rays，paintSky 里固定右上的 2D 圆盘/光晕
 * 变成重复且扁平。把 5 个天气档 sunDisc 归零 ⇒ c.globalAlpha=0 ⇒ 整段不绘制。
 * 保留：CSS --sun-glow 柔光、后处理全部光影、几何/路网/阴影体系。
 */
const fs=require('fs');
const SRC='D:/repro-test/v29-final.html',DST='D:/repro-test/v30-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
const before=(s.match(/sunDisc:[\d.]+/g)||[]);
if(before.length!==5)throw new Error('sunDisc 档位数不是 5: '+JSON.stringify(before));
s=s.replace(/sunDisc:[\d.]+/g,'sunDisc:0');
const after=(s.match(/sunDisc:[\d.]+/g)||[]);
console.log('  ✓ 5 档 sunDisc 归零:',before.join(','),'→',after.join(','));
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
