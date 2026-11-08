/* 11-07 八改：修「修公路」后交口局部崩坏（纯几何，不动材质/颜色/贴图）
 * v11-final.html → v12-final.html
 * 实测：junction:road 半径 5（20 边形内切 4.94），矩形路段端面角点距圆心 6.4~6.73
 *       ⇒ 每交口 1.46~1.79m 未被覆盖，低视角露出三角形缺口/断层。
 * 修法：交口覆盖层改用轴对齐方形平面 pad，与矩形路段边缘对齐；
 *       水箱用的圆形 junction 几何保持不变。
 */
const fs=require('fs');
const SRC='D:/repro-test/v11-final.html',DST='D:/repro-test/v12-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,100)}`);s=s.replace(from,to);console.log('  ✓',label);}
/* 1) 新增方形水平铺装几何（与原圆形 junction 并存，不影响水箱） */
sub(
`junction:new T.CircleGeometry(.5,20).rotateX(-Math.PI/2)};`,
`junction:new T.CircleGeometry(.5,20).rotateX(-Math.PI/2),pad:new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)};`,
  '新增 pad 方形铺装几何');
/* 2) 交口由圆盘改方形铺装，边长留 0.2m 余量吸收浮点误差 */
sub(
`    add('junction','sidewalk',x,.27,z,w+5,1,w+5);
    add('junction','road',x,.385,z,w+1,1,w+1);`,
`    /* 11-07：圆形 20 边形盖不住矩形路段端角（实测露 1.46~1.79m）。
       改方形铺装，矩形对矩形边缘齐平，彻底消除三角缺口与断层。 */
    add('pad','sidewalk',x,.27,z,w+5.2,1,w+5.2);
    add('pad','road',x,.385,z,w+1.2,1,w+1.2);`,
  '交口改方形铺装');
/* 3) 平面不投实时阴影 */
sub(
`    mesh.castShadow=kind!=='junction'&&![`,
`    mesh.castShadow=kind!=='junction'&&kind!=='pad'&&![`,
  'pad 不投影');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
