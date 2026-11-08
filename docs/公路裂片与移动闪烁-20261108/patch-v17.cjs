/* 11-08：修公路裂片 + 移动时闪烁（v13-final.html → v17-final.html）
 * 根因：v13 为避免交口露缝用 length+.6，使相邻段在交点水平重叠 0.6m
 *       且顶面完全同高(road .365 / sidewalk .25) ⇒ 相机移动时深度交替(z-fighting)；
 *       低视角还会露出重叠段的垂直侧面（背光发黑）= 用户拍到的黑色三角裂片。
 * 修法：段长改回 length，端点精确相接、零重叠。不加任何补块、不动材质/贴图/坐标。
 */
const fs=require('fs');
const SRC='D:/repro-test/v13-final.html',DST='D:/repro-test/v17-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,100)}`);s=s.replace(from,to);console.log('  ✓',label);}
sub(
`    /* 11-07 九改：端点各超出交点 .3m，交口由同批次路段自然交叠，
       不再产生任何独立盖板/小方块。 */
    add('box','sidewalk',(ax+bx)/2,.14-(ri%2)*.02,(az+bz)/2,road.w+5,.22,length+.6,angle);
    add('box','road',(ax+bx)/2,.29,(az+bz)/2,road.w,.15,length+.6,angle);`,
`    /* 11-08：端点精确相接（length），零水平重叠 ⇒ 共面交替闪烁与
       露出垂直侧面的黑色三角裂片同时消失。不加任何补块。 */
    add('box','sidewalk',(ax+bx)/2,.14-(ri%2)*.02,(az+bz)/2,road.w+5,.22,length,angle);
    add('box','road',(ax+bx)/2,.29,(az+bz)/2,road.w,.15,length,angle);`,
  '路段端点精确相接');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
