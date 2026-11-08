/* 11-08 十八改：MC Java 风格「柔和写实光影」（v25-final.html → v26-final.html）
 * 用户选「柔和写实光影」：默认开现有后处理、修好 God rays、暖阳冷天光、
 * 保留烘焙静态阴影、加一键开关；不动几何/道路/实时阴影体系。
 *
 * 关键真因：post.render(sceneToDraw,camera) 漏传第三参 sunWorld ⇒
 * createPostChain 里 sunVis=0 ⇒ shaft = godRays()*rays*sunVis 恒为 0。
 * 历史注释误判为「采样循环问题」，其实是调用处漏参 + 默认 ?post=1 才开。
 */
const fs=require('fs');
const SRC='D:/repro-test/v25-final.html',DST='D:/repro-test/v26-final.html';
let s=fs.readFileSync(SRC,'utf8');const orig=s.length;
function sub(a,b,l){const n=s.split(a).length-1;if(n!==1)throw new Error(`[${l}] 期望1处实际${n}处: ${a.slice(0,90)}`);s=s.replace(a,b);console.log('  ✓',l);}

/* 1 后处理默认开启（?post=0 可显式关） */
sub(
`if(wantPost===null)wantPost=new URLSearchParams(location.search).get("post")==="1";`,
`if(wantPost===null)wantPost=new URLSearchParams(location.search).get("post")!=="0";`,
  '后处理默认开启');

/* 2 修 God rays：传太阳的「无穷远方向点」，而不是漏参 */
sub(
`post?post.render(sceneToDraw,camera):renderer.render(sceneToDraw,camera);`,
`/* 11-08：此前只传两参 ⇒ sunWorld=undefined ⇒ sunVis=0 ⇒ 光轴恒为 0。
     传相机位置 + 太阳方向×2000 的远点，投影稳定且转视角时平滑渐隐。 */
   const sunFar=post?new T.Vector3().copy(sun.position).normalize().multiplyScalar(2000).add(camera.position):null;
   post?post.render(sceneToDraw,camera,sunFar):renderer.render(sceneToDraw,camera);`,
  'God rays 补传太阳位置');

/* 3 后处理参数：光轴从 0 打开，泛光/调色小幅增强 */
sub(
`    strength: 0.20,    // 泛光强度（10-29 由 0.58 上调，亮边更通透）`,
`    strength: 0.24,    // 11-08 柔和写实：泛光略提，亮边更通透`,
  '泛光强度');
sub(
`    saturation: 1.10,  // 饱和度（10-29 由 1.06 上调；再高会把米白墙推成橄榄绿）`,
`    saturation: 1.12,  // 11-08：轻微提饱和，不越过米白墙变橄榄绿的阈值`,
  '饱和度');
sub(
`    contrast: 1.13,    // 对比（10-29 由 1.09 上调）`,
`    contrast: 1.15,    // 11-08：明暗对比更接近 MC Java 光影包`,
  '对比');
sub(
`    vignette: 0.08,    // 暗角`,
`    vignette: 0.10,    // 暗角（11-08 微增）`,
  '暗角');
sub(
`    rays: 0.0,         // 光轴强度（默认关：会糊掉建筑边缘）（无头 SwiftShader 下恒为 0，真机待验）`,
`    rays: 0.32,        // 11-08：漏参已修，默认开；取中等值避免糊掉建筑边缘`,
  '光轴开启');

/* 4 daylight 色板：暖阳 / 冷天光 / 更强明暗对比（其余档保持） */
sub(
`  daylight:{label:'晴朗 · 蓝天',sky:0xdcebf6,bounce:0xa9b29b,ambient:.56,sun:0xffeed0,strength:1.95,exposure:1.00,fill:.30,fillColor:0xa9c6e2,ground:0xffffff,roof:0xfffcf2,stone:0xfffdf5,shadowOpacity:.74,skyTop:'#70afe0',skyBottom:'#d8ebf7',glow:'#ffe2b640',cloud:.20,sunDisc:1.00,fog:0xcbdfee,fogDensity:.00026,warm:.04},`,
`  /* 11-08 柔和写实：太阳转暖、地面/补光转冷蓝、环境光略降、主光略升，
     拉开明暗层次；曝光压 0.02 防高光溢出。Basic 路网不受光照影响，保持原色。 */
  daylight:{label:'晴朗 · 蓝天',sky:0xdcebf6,bounce:0x93aec8,ambient:.50,sun:0xffd9a3,strength:2.08,exposure:.98,fill:.30,fillColor:0x8fb2dc,ground:0xffffff,roof:0xfffcf2,stone:0xfffdf5,shadowOpacity:.74,skyTop:'#70afe0',skyBottom:'#d8ebf7',glow:'#ffe2b640',cloud:.20,sunDisc:1.00,fog:0xcbdfee,fogDensity:.00026,warm:.04},`,
  'daylight 暖阳冷天光');

/* 5 UI 开关按钮 */
sub(
`<button id="shade" aria-pressed="true">静态阴影 <span>开启</span></button>`,
`<button id="shade" aria-pressed="true">静态阴影 <span>开启</span></button><button id="shaders" aria-pressed="true">光影 <span>开启</span></button>`,
  '光影开关按钮');
sub(
`  listen($('shade'),'click',()=>{const visible=!staticShadow.layer.visible;`,
`  /* 11-08 光影总开关：复用 createPostChain.params.enabled（其 render 开头已支持直通） */
  listen($('shaders'),'click',()=>{
    wantPost=!wantPost;if(post)post.params.enabled=wantPost;
    $('shaders').setAttribute('aria-pressed',String(wantPost));
    $('shaders').querySelector('span').textContent=wantPost?'开启':'关闭';requestRender();
  });
  listen($('shade'),'click',()=>{const visible=!staticShadow.layer.visible;`,
  '光影开关事件');
fs.writeFileSync(DST,s,'utf8');
console.log('---');console.log('源文件',orig,'→',s.length,'字符（',s.length-orig,'）');console.log('已写',DST);
