/* 11-08 十八改 c：光轴在俯视也可见（v27 → v28）
 * 俯视相机朝下、太阳在天上 ⇒ behind=true ⇒ vis=0 ⇒ 默认视角永远看不到光轴。
 * 改：太阳在视野内用真实投影；背后/出画时回退到右上天空的柔和散射源。
 * 这是艺术化处理（不是严格物理），会在报告里说明。
 */
const fs=require('fs');
const SRC='D:/repro-test/v27-final.html',DST='D:/repro-test/v28-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
const a=`    let su = 0.5, sv = 0.5, vis = 0;
    if (sunWorld) {
      tmpA.copy(sunWorld);
      tmpB.copy(tmpA).applyMatrix4(cam.matrixWorldInverse);
      const behind = tmpB.z > 0;
      tmpA.project(cam);
      const u = tmpA.x * 0.5 + 0.5, v = tmpA.y * 0.5 + 0.5;
      if (!behind && Number.isFinite(u) && Number.isFinite(v)) {
        const cu = Math.min(1, Math.max(0, u)), cv = Math.min(1, Math.max(0, v));
        vis = Math.max(0.32, 1 - Math.hypot(u - cu, v - cv) * 1.6);
        su = cu; sv = cv;
      }
    }`;
const b=`    /* 11-08：默认给一个右上天空的柔和散射源（艺术化回退）。
       太阳在视野内时用真实投影；俯视相机朝下/太阳在背后时保留回退，
       否则默认视角光轴恒为 0，用户等于看不到任何效果。 */
    let su = 0.78, sv = 0.14, vis = 0.45;
    if (sunWorld) {
      tmpA.copy(sunWorld);
      tmpB.copy(tmpA).applyMatrix4(cam.matrixWorldInverse);
      const behind = tmpB.z > 0;
      tmpA.project(cam);
      const u = tmpA.x * 0.5 + 0.5, v = tmpA.y * 0.5 + 0.5;
      if (!behind && Number.isFinite(u) && Number.isFinite(v)) {
        const cu = Math.min(1, Math.max(0, u)), cv = Math.min(1, Math.max(0, v));
        const off = Math.hypot(u - cu, v - cv);
        if (off < 0.7) { vis = Math.max(0.35, 1 - off * 1.6); su = cu; sv = cv; }
      }
    }`;
if(s.split(a).length-1!==1)throw new Error('太阳坐标段锚点不唯一');
s=s.replace(a,b);console.log('  ✓ 光轴回退光源');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
