/* 11-06 综合改造（分段累积）
 * 输入：D:/repro-test/latest3d-junction.html
 * 输出：D:/repro-test/v2-base.html
 * 后续段（建筑 / 天气）由后续 patch 脚本在这份基础上继续叠加。
 */
const fs = require('fs');
const SRC = 'D:/repro-test/latest3d-junction.html';
const DST = 'D:/repro-test/v2-base.html';
let s = fs.readFileSync(SRC, 'utf8');
const orig = s.length;
function sub(from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`[${label}] 期望 1 处，实际 ${n} 处：${from.slice(0, 110)}`);
  s = s.replace(from, to);
  console.log('  ✓', label);
}

/* P1：修掉最后 1 对人行道共面（coplanar-probe 实测 box:sidewalk#5 × #28，gap=0）。
   两条相邻路的人行道细长重叠，同材质同贴图但 UV 不同，重叠区仍会跳纹理。
   按路段索引给 2cm 错层（≈3.7 个深度量化步长），肉眼不可见但深度稳定。 */
sub(
`  data.roads.forEach(road=>road.pts.slice(1).forEach((b,i)=>{const a=road.pts[i], [ax,az]=coord(...a),[bx,bz]=coord(...b),length=Math.hypot(bx-ax,bz-az),angle=Math.atan2(bx-ax,bz-az);
    /* 两端各退到圆盘半径处：road 圆盘直径 w+1、sidewalk 圆盘直径 w+5，
       段长分别减掉对应直径后，不同方向的矩形在交点处完全不再相交，
       共面从几何上被消除，而不是靠上层圆盘遮住。 */
    add('box','sidewalk',(ax+bx)/2,.14,(az+bz)/2,road.w+5,.22,Math.max(.5,length-(road.w+5)),angle);
    add('box','road',(ax+bx)/2,.29,(az+bz)/2,road.w,.15,Math.max(.5,length-(road.w+1)),angle);}));`,
`  data.roads.forEach((road,ri)=>road.pts.slice(1).forEach((b,i)=>{const a=road.pts[i], [ax,az]=coord(...a),[bx,bz]=coord(...b),length=Math.hypot(bx-ax,bz-az),angle=Math.atan2(bx-ax,bz-az);
    /* 两端各退到圆盘半径处：road 圆盘直径 w+1、sidewalk 圆盘直径 w+5，
       段长分别减掉对应直径后，不同方向的矩形在交点处完全不再相交，
       共面从几何上被消除，而不是靠上层圆盘遮住。 */
    /* 11-06：不同道路的人行道偶尔仍会细长重叠(实测 1 对 gap=0)，
       按路段奇偶给 2cm 错层，深度稳定且肉眼不可见。 */
    /* 向下错层（.14/.12 → 顶 .25/.23），不能向上：向上会顶到 .27 的
       junction:sidewalk 圆盘，实测会把共面对从 1 对放大到 20 对。 */
    add('box','sidewalk',(ax+bx)/2,.14-(ri%2)*.02,(az+bz)/2,road.w+5,.22,Math.max(.5,length-(road.w+5)),angle);
    add('box','road',(ax+bx)/2,.29,(az+bz)/2,road.w,.15,Math.max(.5,length-(road.w+1)),angle);}));`,
  'P1 人行道共面错层'
);

fs.writeFileSync(DST, s, 'utf8');
console.log('---');
console.log('源文件', orig, '字符 → 输出', s.length, '字符（', s.length - orig, '）');
console.log('已写', DST);
