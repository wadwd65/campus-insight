/* 11-07 九改：交口彻底回到「道路自身拼接」，不再用任何盖板
 * v12-final.html → v13-final.html
 * 真因：抬高到 .385 的圆盘/方形铺装本质是「一块无虚线、不同 UV、
 *       高出路面 0.02m 的面」盖在路上，低视角必然读作色块 + 三角缺口 + 断层。
 * 修法：删除交口盖板，让同一 box:road 批次的路段在交点轻微交叠；
 *       同批次/同材质/同高度，单次 draw call 内实例顺序固定，不会帧间交替。
 */
const fs=require('fs');
const SRC='D:/repro-test/v12-final.html',DST='D:/repro-test/v13-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,100)}`);s=s.replace(from,to);console.log('  ✓',label);}
/* 1) 删除交口盖板循环 */
sub(
`  for(const {p,w}of junctions.values()){
    const[x,z]=coord(...p);
    /* 11-07：圆形 20 边形盖不住矩形路段端角（实测露 1.46~1.79m）。
       改方形铺装，矩形对矩形边缘齐平，彻底消除三角缺口与断层。 */
    add('pad','sidewalk',x,.27,z,w+5.2,1,w+5.2);
    add('pad','road',x,.385,z,w+1.2,1,w+1.2);
  }`,
`  /* 11-07 九改：删除全部交口盖板。
     无论 20 边形圆盘还是方形铺装，都是把一块「无虚线、不同 UV、
     比路面高 0.02m」的面盖在路上，低视角必然读作色块/三角缺口/断层。
     改由同一 box:road 批次的路段在交点轻微交叠拼接：同批次、同材质、
     同顶面高度，单次 draw call 内实例顺序固定，不会帧间交替闪烁。
     junctions 仍保留给其它逻辑使用，只是不再生成额外几何。 */`,
  '删除交口盖板');
/* 2) 路段恢复端点轻微交叠（不再缩短、不再 Math.max 钳小方块） */
sub(
`    add('box','sidewalk',(ax+bx)/2,.14-(ri%2)*.02,(az+bz)/2,road.w+5,.22,Math.max(.5,length-(road.w+5)),angle);
    add('box','road',(ax+bx)/2,.29,(az+bz)/2,road.w,.15,Math.max(.5,length-(road.w+1)),angle);`,
`    /* 11-07 九改：端点各超出交点 .3m，交口由同批次路段自然交叠，
       不再产生任何独立盖板/小方块。 */
    add('box','sidewalk',(ax+bx)/2,.14-(ri%2)*.02,(az+bz)/2,road.w+5,.22,length+.6,angle);
    add('box','road',(ax+bx)/2,.29,(az+bz)/2,road.w,.15,length+.6,angle);`,
  '路段端点交叠拼接');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
