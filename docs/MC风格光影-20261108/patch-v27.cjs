/* 11-08 十八改 b：God rays 真生效 + 消除草地条纹（v26 → v27） */
const fs=require('fs');
const SRC='D:/repro-test/v26-final.html',DST='D:/repro-test/v27-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(a,b,l){const n=s.split(a).length-1;if(n!==1)throw new Error(`[${l}] 期望1处实际${n}处`);s=s.replace(a,b);console.log('  ✓',l);}

/* A 光轴：不再依赖 tBright 里恰好有太阳；用解析式亮斑 + 场景亮度遮挡 */
sub(
`vec3 godRays(){
      vec2 delta = (vUv - sun) * (density / 28.0);
      vec2 coord = vUv;
      vec3 sum = vec3(0.0);
      float illum = 1.0;
      for(int i = 0; i < 28; i++){
        coord -= delta;
        sum += texture2D(tBright, clamp(coord, 0.0, 1.0)).rgb * illum;
        illum *= decay;
      }
      return sum * rayWeight;
    }`,
`/* 11-08：俯视时太阳常出画 ⇒ tBright 里没有亮源 ⇒ 旧版光轴恒 0。
       改为解析式太阳亮斑（sun 已钳到画面边缘）+ 用场景亮度做遮挡：
       亮处透光、暗建筑挡光，既出光束又不会糊掉建筑边缘。 */
    vec3 godRays(){
      vec2 delta = (vUv - sun) * (density / 28.0);
      vec2 coord = vUv;
      vec3 sum = vec3(0.0);
      float illum = 1.0;
      for(int i = 0; i < 28; i++){
        coord -= delta;
        vec2 sc = clamp(coord, 0.0, 1.0);
        vec2 d = sc - sun;
        float src = exp(-dot(d, d) * 110.0);
        vec3 sceneC = texture2D(tDiffuse, sc).rgb;
        float lum = dot(sceneC, vec3(0.2126, 0.7152, 0.0722));
        float occl = smoothstep(0.10, 0.55, lum);
        sum += vec3(1.0, 0.90, 0.72) * src * occl * illum;
        illum *= decay;
      }
      return sum * rayWeight;
    }`,
  '光轴改解析式太阳源');
/* B 太阳在相机前方但出画时，保留最低可见度（背后仍为 0） */
sub(
`        vis = Math.max(0, 1 - Math.hypot(u - cu, v - cv) * 1.6);`,
`        vis = Math.max(0.32, 1 - Math.hypot(u - cu, v - cv) * 1.6);`,
  '出画时保留光轴可见度');
/* C 调色保守回调，避免放大草地程序化纹理的周期条纹 */
sub(`    strength: 0.24,    // 11-08 柔和写实：泛光略提，亮边更通透`,
    `    strength: 0.22,    // 11-08：泛光温和，避免放大草地高频纹理`, '泛光回调');
sub(`    saturation: 1.12,  // 11-08：轻微提饱和，不越过米白墙变橄榄绿的阈值`,
    `    saturation: 1.10,  // 11-08：回到不放大条纹的保守值`, '饱和回调');
sub(`    contrast: 1.15,    // 11-08：明暗对比更接近 MC Java 光影包`,
    `    contrast: 1.12,    // 11-08：对比略提但不放大周期纹理`, '对比回调');
sub(`    vignette: 0.10,    // 暗角（11-08 微增）`,
    `    vignette: 0.08,    // 暗角保持原值`, '暗角回调');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
