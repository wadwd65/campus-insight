/* 11-07 图书馆门前规整 + 太阳盘固定
 * 输入 v3-weather.html → 输出 v4-fix.html
 * 依据：三版对照（latest3d-mapfix / v2-base / v3-weather）图书馆门前一致，
 *       不是上一轮新增；真因是 colonnade 生成 5 个 span=5.6m 的宽 portal 方块
 *       + garden 双层方块底座。用户明确要求清理，故只做收敛不做重排。
 */
const fs = require('fs');
const SRC = 'D:/repro-test/v3-weather.html';
const DST = 'D:/repro-test/v4-fix.html';
let s = fs.readFileSync(SRC, 'utf8');
const orig = s.length;
function sub(from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`[${label}] 期望 1 处，实际 ${n} 处：${from.slice(0, 90)}`);
  s = s.replace(from, to); console.log('  ✓', label);
}
function block(startMark, endMark, text, label) {
  const a = s.indexOf(startMark), b = s.indexOf(endMark, a);
  if (a < 0 || b < 0 || b <= a) throw new Error(`[${label}] 边界未找到`);
  s = s.slice(0, a) + text + s.slice(b);
  console.log('  ✓', label, `(替换 ${b - a} 字符)`);
}

/* ===== A. 太阳盘固定 ===== */
sub(
`  const angle=Math.atan2(sun.z,sun.x);
  const x=(.5+Math.cos(angle)*.34)*w, y=.145*h;
  const radiusY=h*.019,radiusX=radiusY*w/(h*Math.max(.1,aspect));`,
`  /* 11-07：太阳盘固定在右上天空，与 .viewport 的 --sun-glow(76% 12%) 对齐。
     原来用 Math.cos(angle)*.34 随「日光方向」滑块横移，观感太抽象；
     滑块仍控制真实光色与影子方向，但太阳盘不再乱跑。 */
  const x=.76*w, y=.13*h;
  const radiusY=h*.014,radiusX=radiusY*w/(h*Math.max(.1,aspect));`,
  '太阳盘固定位置并缩小'
);
sub(
`    setSun(position){if(!revision||position.x!==sun.x||position.y!==sun.y||position.z!==sun.z){sun={x:position.x,y:position.y,z:position.z};paint();}},`,
`    setSun(position){sun={x:position.x,y:position.y,z:position.z};},  /* 太阳盘固定，改方位不再重绘整张天空 */`,
  'setSun 不再重绘天空'
);
sub(
`  const disc=c.createRadialGradient(-.15,-.18,0,0,0,1);`,
`  const disc=c.createRadialGradient(-.15,-.18,0,0,0,1.18);`,
  '太阳盘边缘柔化'
);

/* ===== B. 图书馆门前规整（只影响图书馆） ===== */
block('function colonnade(', 'function terrace(',
`function colonnade(p,ox,oz,count,span=5.5,h=4.8,y=.6,slim=false){
    const [x,z]=coord(p.px,p.py),c=Math.cos(p.rotation),s=Math.sin(p.rotation);
    /* 11-07：slim 把「一排 5.6m 宽的方块」变成细柱廊，消除门前一堆方块的观感；
       其它建筑不传 slim，保持原样。 */
    const bw=slim?Math.max(.5,span*.16):span, bd=slim?.9:1.1;
    for(let i=0;i<count;i++){const dx=ox+(i-(count-1)/2)*span;add('portal','white',x+dx*c+oz*s,y+h/2,z+oz*c-dx*s,bw,h,bd,p.rotation,p.key);}
  }
  `, 'colonnade 支持细柱');
sub(`colonnade(q,0,14,4,6,5.4);`, `colonnade(q,0,14,4,6,5.4,.6,true);`, 'lib-north 改细柱');
sub(`colonnade(q,0,-14.2,5,5.6,5.8);`, `colonnade(q,0,-14.2,5,5.6,5.8,.6,true);`, 'lib 改细柱');

block('function garden(', 'data.places.forEach(',
`function garden(p,ox,oz,w=6,d=4){
    /* 11-07：花坛底座由 .9m 压到 .32m，削掉方块体量，保留绿化层次。 */
    part(p,ox,.28,oz,w,.32,d,'accent');part(p,ox,.62,oz,w-.7,.42,d-.7,'foliage');
  }
  `, '花坛底座压薄');

fs.writeFileSync(DST, s, 'utf8');
console.log('---');
console.log('源文件', orig, '字符 → 输出', s.length, '字符（', s.length - orig, '）');
console.log('已写', DST);
