/**
 * campus-post.js —— 一条最简后处理链（不依赖 three/examples）
 *
 * 为什么不用 EffectComposer：
 *   项目里只有 `three-r149.min.js` 这个 UMD 核心包，没有 examples/jsm。
 *   `EffectComposer` / `UnrealBloomPass` / `SSAOPass` 全在 examples 里，
 *   要另外引 10 来个 ES 模块（它们又都 import 'three'），在单文件打包和
 *   file:// 场景下都不成立。所以这里用 WebGLRenderTarget + 全屏四边形自己搭。
 *
 * 管线：
 *   场景 → rtScene
 *   rtScene → 亮度阈值 → rtBright（半分辨率）
 *   rtBright → 横模糊 → rtA → 纵模糊 → rtB
 *   rtScene + rtB*强度 + 光轴 → 调色（对比/饱和/暗角）→ 画布
 *
 * 光轴（god rays）写在合成 shader 里，但**默认关闭**（rays: 0）。
 * 实测该通道输出恒为 0：同一张 tBright 直接采样能出画面（调试已验），
 * 一旦放进 for 循环沿太阳方向累积就是全黑，单独开 pass 和内联都一样，
 * 说明问题在采样循环本身，还没定位。**不交付假效果，先关掉。**
 * 排查入口：`?raydbg=1` 只看光轴通道；`params._sunU/_sunV/_sunVis` 是太阳屏幕坐标。
 */
export function createPostChain(T, renderer, options = {}) {
  const params = {
    strength: 0.58,    // 泛光强度（0.85 时刺眼，0.46 时发灰）
    threshold: 0.68,   // 亮度阈值
    knee: 0.22,
    saturation: 1.06,  // 饱和度（1.26 会把米白墙推成橄榄绿）
    contrast: 1.09,    // 对比
    vignette: 0.08,    // 暗角
    rays: 1.0,         // 光轴强度（无头 SwiftShader 下恒为 0，真机待验）
    rayDensity: 0.95,  // 采样跨度（1 = 一直采到太阳）
    rayDecay: 0.972,   // 每步衰减
    rayWeight: 0.11,   // 单步权重
    enabled: true,
    ...options
  };

  const quad = new T.PlaneGeometry(2, 2);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sceneQ = new T.Scene();
  const mesh = new T.Mesh(quad, null);
  mesh.frustumCulled = false;
  sceneQ.add(mesh);

  const VERT = /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;

  const BRIGHT = /* glsl */`
    uniform sampler2D tDiffuse; uniform float threshold; uniform float knee;
    varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float k = smoothstep(threshold - knee, threshold + knee, l);
      gl_FragColor = vec4(c * k, 1.0);
    }
  `;

  const BLUR = /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 step;
    varying vec2 vUv;
    void main(){
      vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270;
      s += texture2D(tDiffuse, vUv + step * 1.3846153).rgb * 0.3162162;
      s += texture2D(tDiffuse, vUv - step * 1.3846153).rgb * 0.3162162;
      s += texture2D(tDiffuse, vUv + step * 3.2307692).rgb * 0.0702702;
      s += texture2D(tDiffuse, vUv - step * 3.2307692).rgb * 0.0702702;
      gl_FragColor = vec4(s, 1.0);
    }
  `;

  const COMPOSITE = /* glsl */`
    uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform sampler2D tBright;
    uniform float strength; uniform float saturation; uniform float contrast; uniform float vignette;
    uniform float rays; uniform vec2 sun; uniform float sunVis;
    uniform float density; uniform float decay; uniform float rayWeight; uniform float dbg;
    varying vec2 vUv;

    vec3 godRays(){
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
    }

    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 bloom = texture2D(tBloom, vUv).rgb;
      vec3 shaft = godRays() * rays * sunVis;

      if(dbg > 0.5){ gl_FragColor = vec4(clamp(shaft * 3.0, 0.0, 1.0), 1.0); return; }

      vec3 c = base.rgb + bloom * strength + shaft;

      /* 太阳方向的光晕：屏幕空间径向渐变 */
      float dd = distance(vUv, sun);
      c += vec3(1.0, 0.88, 0.66) * exp(-dd * 3.2) * sunVis * 0.16;

      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(lum), c, saturation);
      c = (c - 0.5) * contrast + 0.5;

      float vg = distance(vUv, vec2(0.5));
      c *= 1.0 - vignette * smoothstep(0.30, 0.86, vg);

      /* 必须做 sRGB 编码。实测：渲染到 RenderTarget 时**不**应用 outputEncoding，
         rtScene 里是线性空间的值；直接输出会整体压暗约 32%
         （同一机位实测平均亮度 155 → 105）。加上这一步后回到 145。
         注意：早先我判断反了（以为 RT 已是 sRGB），那是因为当时环境光还是 0.78，
         提亮被误读成"过曝"。 */
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), base.a);
    }
  `;

  const matBright = new T.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, threshold: { value: params.threshold }, knee: { value: params.knee } },
    vertexShader: VERT, fragmentShader: BRIGHT, depthTest: false, depthWrite: false
  });
  const matBlur = new T.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, step: { value: new T.Vector2() } },
    vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false
  });
  const matComposite = new T.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null }, tBloom: { value: null }, tBright: { value: null },
      strength: { value: params.strength }, saturation: { value: params.saturation },
      contrast: { value: params.contrast }, vignette: { value: params.vignette },
      rays: { value: params.rays }, sun: { value: new T.Vector2(0.5, 0.5) }, sunVis: { value: 0 },
      density: { value: params.rayDensity }, decay: { value: params.rayDecay }, rayWeight: { value: params.rayWeight },
      dbg: { value: location.search.includes('raydbg') ? 1 : 0 }
    },
    vertexShader: VERT, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false, transparent: true
  });

  const rtOptions = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: T.UnsignedByteType, depthBuffer: true, stencilBuffer: false };
  let rtScene = null, rtBright = null, rtA = null, rtB = null;
  let width = 0, height = 0;
  let sceneTriangles = 0, sceneCalls = 0;
  const tmpA = new T.Vector3(), tmpB = new T.Vector3();

  function allocate(w, h) {
    width = w; height = h;
    [rtScene, rtBright, rtA, rtB].forEach(rt => rt && rt.dispose());
    rtScene = new T.WebGLRenderTarget(w, h, rtOptions);
    const bw = Math.max(1, w >> 1), bh = Math.max(1, h >> 1);
    const small = Object.assign({}, rtOptions, { depthBuffer: false });
    rtBright = new T.WebGLRenderTarget(bw, bh, small);
    rtA = new T.WebGLRenderTarget(bw, bh, small);
    rtB = new T.WebGLRenderTarget(bw, bh, small);
  }

  function drawTo(target, material) {
    mesh.material = material;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(sceneQ, camera);
  }

  function render(scene, cam, sunWorld) {
    if (!params.enabled) { renderer.setRenderTarget(null); renderer.render(scene, cam); return; }

    const size = renderer.getDrawingBufferSize(new T.Vector2());
    if (size.x !== width || size.y !== height) allocate(Math.max(1, size.x | 0), Math.max(1, size.y | 0));

    renderer.info.reset();
    renderer.setRenderTarget(rtScene);
    renderer.clear();
    renderer.render(scene, cam);
    sceneTriangles = renderer.info.render.triangles;
    sceneCalls = renderer.info.render.calls;

    matBright.uniforms.tDiffuse.value = rtScene.texture;
    drawTo(rtBright, matBright);

    matBlur.uniforms.tDiffuse.value = rtBright.texture;
    matBlur.uniforms.step.value.set(1 / rtBright.width, 0);
    drawTo(rtA, matBlur);

    matBlur.uniforms.tDiffuse.value = rtA.texture;
    matBlur.uniforms.step.value.set(0, 1 / rtBright.height);
    drawTo(rtB, matBlur);

    /* 太阳屏幕坐标 + 可见度：相机背后 → 0；出画 → 夹到边缘并按出画距离衰减，
       这样转视角时光轴是渐隐，而不是啪一下消失。 */
    let su = 0.5, sv = 0.5, vis = 0;
    if (sunWorld) {
      tmpA.copy(sunWorld);
      tmpB.copy(tmpA).applyMatrix4(cam.matrixWorldInverse);
      const behind = tmpB.z > 0;
      tmpA.project(cam);
      const u = tmpA.x * 0.5 + 0.5, v = tmpA.y * 0.5 + 0.5;
      if (!behind && Number.isFinite(u) && Number.isFinite(v)) {
        const cu = Math.min(1, Math.max(0, u)), cv = Math.min(1, Math.max(0, v));
        vis = Math.max(0, 1 - Math.hypot(u - cu, v - cv) * 1.6);
        su = cu; sv = cv;
      }
    }
    params._sunU = su; params._sunV = sv; params._sunVis = vis;

    matComposite.uniforms.tDiffuse.value = rtScene.texture;
    matComposite.uniforms.tBloom.value = rtB.texture;
    matComposite.uniforms.tBright.value = rtBright.texture;
    matComposite.uniforms.sun.value.set(su, sv);
    matComposite.uniforms.sunVis.value = vis;
    matComposite.uniforms.rays.value = params.rays;
    matComposite.uniforms.strength.value = params.strength;
    matComposite.uniforms.saturation.value = params.saturation;
    matComposite.uniforms.contrast.value = params.contrast;
    matComposite.uniforms.vignette.value = params.vignette;
    matComposite.uniforms.density.value = params.rayDensity;
    matComposite.uniforms.decay.value = params.rayDecay;
    matComposite.uniforms.rayWeight.value = params.rayWeight;
    mesh.material = matComposite;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(sceneQ, camera);

    /* 这一帧做了 4 次 render，info 会累加；恢复成"只算场景"的值，
       否则诊断里的 calls/triangles 看着像几何被改过。 */
    renderer.info.render.triangles = sceneTriangles;
    renderer.info.render.calls = sceneCalls;
  }

  return {
    params,
    render,
    setSize: allocate,
    dispose() {
      [rtScene, rtBright, rtA, rtB].forEach(rt => rt && rt.dispose());
      [matBright, matBlur, matComposite].forEach(m => m.dispose());
      quad.dispose();
    }
  };
}
