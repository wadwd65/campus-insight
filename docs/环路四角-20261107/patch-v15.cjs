/* 11-07 十一改：环路四角斜接（v13-final.html → v15-final.html）
 * v14 的轴对齐 w+.2 方块盖不住斜向拐角：两段夹角外侧角点距拐点约 0.7w，
 * 而方块半边长只有 0.5w。本版按 miter 公式、旋转到角平分线，只补真拐点。
 * 补块与路段同批次/同材质/同 y(.29)/同厚度(.15)，顶面 .365 齐平，不是盖板。
 */
const fs=require('fs');
const SRC='D:/repro-test/v13-final.html',DST='D:/repro-test/v15-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(from,to,label){const n=s.split(from).length-1;if(n!==1)throw new Error(`[${label}] 期望1处实际${n}处: ${from.slice(0,100)}`);s=s.replace(from,to);console.log('  ✓',label);}
sub(
`  /* 11-07 九改：删除全部交口盖板。
     无论 20 边形圆盘还是方形铺装，都是把一块「无虚线、不同 UV、
     比路面高 0.02m」的面盖在路上，低视角必然读作色块/三角缺口/断层。
     改由同一 box:road 批次的路段在交点轻微交叠拼接：同批次、同材质、
     同顶面高度，单次 draw call 内实例顺序固定，不会帧间交替闪烁。
     junctions 仍保留给其它逻辑使用，只是不再生成额外几何。 */`,
`  /* 11-07 十一改：外围环路四个转角斜接。
     直线段 length+.6 交叠能接上，但拐角处两段矩形只在中心线相交，
     外侧张口；轴对齐小方块盖不住（外侧角点距拐点约 0.7w）。
     只给「转向角 > 18°」的真拐点补块：按 miter=(w/2)/sin(内角/2)
     算边长，并旋转到两段方向的角平分线，与斜向路段对齐。
     补块与路段同批次 / 同材质 / 同 y(.29) / 同厚度(.15)，顶面 .365 齐平。 */
  const cornerDirs=new Map();
  for(const road of data.roads){
    const pts=road.pts,n=pts.length;
    const closed=n>2&&pts[0][0]===pts[n-1][0]&&pts[0][1]===pts[n-1][1];
    for(let i=0;i<(closed?n-1:n);i++){
      if(!closed&&(i===0||i===n-1))continue;
      const prev=pts[i===0?n-2:i-1],cur=pts[i],next=pts[i+1];
      const u=[prev[0]-cur[0],prev[1]-cur[1]],v=[next[0]-cur[0],next[1]-cur[1]];
      const lu=Math.hypot(u[0],u[1]),lv=Math.hypot(v[0],v[1]);
      if(!lu||!lv)continue;
      const turn=Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(lu*lv))))*180/Math.PI;
      if(turn<18)continue;
      const key=cur.join(',');
      const e=cornerDirs.get(key)||{p:cur,w:0,turn:0,u:[u[0]/lu,u[1]/lu],v:[v[0]/lv,v[1]/lv]};
      e.w=Math.max(e.w,road.w);e.turn=Math.max(e.turn,turn);
      cornerDirs.set(key,e);
    }
  }
  for(const {p,w,turn,u,v}of cornerDirs.values()){
    const [x,z]=coord(...p);
    const bx=u[0]+v[0],bz=u[1]+v[1],bl=Math.hypot(bx,bz)||1;
    const phi=Math.atan2(bx/bl,bz/bl);
    const inner=Math.PI-turn*Math.PI/180;
    const side=(w/Math.max(.70,Math.sin(inner/2)))+.6;
    add('box','sidewalk',x,.12,z,side+5,.22,side+5,phi);
    add('box','road',x,.29,z,side,.15,side,phi);
  }`,
  '环路拐角按 miter 旋转补块');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
