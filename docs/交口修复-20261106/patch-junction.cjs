/* 11-06 交口闪烁修复
 * 输入：C:/Users/123/Desktop/校园3D-唯一版.html（只读）
 * 输出：D:/repro-test/latest3d-junction.html
 *
 * 真因（代码 + z-probe2 实测）：
 *  ① 每段 road 长 length+1、sidewalk 长 length+2 ⇒ 相邻段在交口水平重叠，
 *     顶面完全同高（road 顶 .365 = .29+.15/2）⇒ 深度值相同 ⇒ 交替渲染。
 *  ② 补交口的 junction 是**平面圆盘**（CircleGeometry.rotateX(-π/2)，顶点 y=0），
 *     却放在 position.y=-0.13，埋在 siteBase(顶 0) 与 ground(.04) 之下，
 *     完全不可见 ⇒ 交口没有任何覆盖层，重叠段直接暴露。
 *  ③ 相机 near=1/far=3000，300m 处 24bit 深度量化 ≈.0054m，
 *     第一人称低视角看近乎平行于视线的路面，共面抖动最明显。
 *
 * 修法：段长不再额外重叠；把交口圆盘抬到路面之上 .02m 并补一层人行道圆盘，
 *      让交口由单一稳定面决定；junction 不参与投影，避免平面圆盘产生怪影。
 */
const fs = require('fs');
const SRC = 'C:/Users/123/Desktop/校园3D-唯一版.html';
const DST = 'D:/repro-test/latest3d-junction.html';
let s = fs.readFileSync(SRC, 'utf8');
const orig = s.length;
function sub(from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`[${label}] 期望 1 处，实际 ${n} 处：${from.slice(0, 100)}`);
  s = s.replace(from, to);
  console.log('  ✓', label);
}

/* ① 消除相邻段共面重叠 */
sub(
`  data.roads.forEach(road=>road.pts.slice(1).forEach((b,i)=>{const a=road.pts[i], [ax,az]=coord(...a),[bx,bz]=coord(...b),length=Math.hypot(bx-ax,bz-az),angle=Math.atan2(bx-ax,bz-az);add('box','sidewalk',(ax+bx)/2,.14,(az+bz)/2,road.w+5,.22,length+2,angle);add('box','road',(ax+bx)/2,.29,(az+bz)/2,road.w,.15,length+1,angle);}));`,
`  /* 11-06：段长改为 length / length，不再额外 +1/+2 重叠。
     原来重叠区两段顶面完全共面(road 顶 .365)，是交口持续闪烁的主因。 */
  data.roads.forEach(road=>road.pts.slice(1).forEach((b,i)=>{const a=road.pts[i], [ax,az]=coord(...a),[bx,bz]=coord(...b),length=Math.hypot(bx-ax,bz-az),angle=Math.atan2(bx-ax,bz-az);
    /* 两端各退到圆盘半径处：road 圆盘直径 w+1、sidewalk 圆盘直径 w+5，
       段长分别减掉对应直径后，不同方向的矩形在交点处完全不再相交，
       共面从几何上被消除，而不是靠上层圆盘遮住。 */
    add('box','sidewalk',(ax+bx)/2,.14,(az+bz)/2,road.w+5,.22,Math.max(.5,length-(road.w+5)),angle);
    add('box','road',(ax+bx)/2,.29,(az+bz)/2,road.w,.15,Math.max(.5,length-(road.w+1)),angle);}));`,
  '道路/人行道段取消额外重叠'
);

/* ② 交口圆盘抬到路面之上，并补人行道圆盘 */
sub(
`  for(const {p,w}of junctions.values()){const[x,z]=coord(...p);add('junction','road',x,-0.13,z,w+1,1,w+1);}`,
`  /* 11-06：junction 是水平圆盘，顶点 y=0，所以 position.y 就是它的世界高度。
     原来 -0.13 埋在地下完全不可见；现抬到 road 顶(.365) 之上 .02m，
     并补一层 sidewalk 圆盘(.27) 盖住斜交处露出的人行道缝隙。
     两层都比对应顶面高出约 4 个深度量化步长，稳定胜出，不再交替。 */
  for(const {p,w}of junctions.values()){
    const[x,z]=coord(...p);
    add('junction','sidewalk',x,.27,z,w+5,1,w+5);
    add('junction','road',x,.385,z,w+1,1,w+1);
  }`,
  '交口圆盘抬升并补缝'
);

/* ③ 平面圆盘不投实时阴影 */
sub(
`    mesh.castShadow=!['shadow','softShadow','sign','windowBand','road','paving','glass','foliage','trunk','canopy'].includes(material);mesh.receiveShadow=!['shadow','softShadow','sign'].includes(material);`,
`    mesh.castShadow=kind!=='junction'&&!['shadow','softShadow','sign','windowBand','road','paving','glass','foliage','trunk','canopy'].includes(material);mesh.receiveShadow=!['shadow','softShadow','sign'].includes(material);`,
  '交口圆盘不投影'
);

fs.writeFileSync(DST, s, 'utf8');
console.log('---');
console.log('源文件', orig, '字符 → 输出', s.length, '字符（', s.length - orig, '）');
console.log('已写', DST);
