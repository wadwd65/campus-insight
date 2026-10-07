/* -*- coding: utf-8 -*- */
/* ══════════════════════════════════════════════════════════════════
   tower-14-look.js —— 现代观感层

   用户定调（10-07）："别管位置对不对了，好看就行，细节拉满，
   连草地都能看出来、人行小道都能看出来。"
   十多年前感的来源逐条治：
     ① 默认 NoToneMapping ⇒ 高光直通、原色平铺   → ACES 电影级色调映射
     ② 补光偏高 ⇒ 暗面被填平、无体积            → 压补光、抬主光、拉低太阳角
     ③ 无大气 ⇒ 远景像贴纸                      → 雾 + 分层天空 + 日晕 + 暗角
     ④ 材质平涂 ⇒ 没有材质感                    → 水面/玻璃/沥青分层微调
   ══════════════════════════════════════════════════════════════════ */
(function () {
  /* ① 色调映射 + 曝光 */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /* ② 光照重配 */
  var sunL = null, hemiL = null;
  scene.traverse(function (o) {
    if (o.isDirectionalLight) sunL = o;
    if (o.isHemisphereLight) hemiL = o;
  });
  if (sunL) {
    sunL.intensity = 2.35;
    sunL.color.setHex(0xFFEAC6);
    var flat = Math.sqrt(sunL.position.x * sunL.position.x + sunL.position.z * sunL.position.z);
    var elNow = Math.atan2(sunL.position.y, flat);
    var elTgt = THREE.MathUtils.degToRad(31);        /* 低角光 = 立体感开关 */
    if (elNow > elTgt) sunL.position.y = flat * Math.tan(elTgt);
    sunL.shadow.normalBias = 0.55;
    sunL.shadow.bias = -0.00045;
  }
  if (hemiL) {
    hemiL.intensity = 0.40;
    hemiL.color.setHex(0xA9C9EA);
    hemiL.groundColor.setHex(0x6C7458);              /* ★ 09-26 验证过的冷橄榄地面色 */
  }
  scene.traverse(function (o) { if (o.isAmbientLight) o.intensity = 0.10; });

  /* ③ 大气（雾按相机距离定：航拍 780m / 俯视 900m 全程清晰）*/
  scene.fog = new THREE.Fog(0xD7E2EC, 620, 2600);

  /* ④ 天空重绘：深天顶 → 暖地平 + 云带 + 日晕 */
  var skyMesh = null;
  scene.traverse(function (o) {
    if (o.isMesh && o.material && o.material.side === THREE.BackSide &&
        o.geometry && o.geometry.type === 'SphereGeometry') skyMesh = o;
  });
  if (skyMesh) {
    var N = 1024, cv = document.createElement('canvas');
    cv.width = 32; cv.height = N;
    var c2 = cv.getContext('2d');
    var grd = c2.createLinearGradient(0, 0, 0, N);
    grd.addColorStop(0.00, '#2A5B94');
    grd.addColorStop(0.28, '#5A8CC2');
    grd.addColorStop(0.52, '#9CBCD8');
    grd.addColorStop(0.74, '#CBD8DE');
    grd.addColorStop(0.90, '#E8E4D6');
    grd.addColorStop(1.00, '#F0E8D4');
    c2.fillStyle = grd; c2.fillRect(0, 0, 32, N);
    var sun = c2.createRadialGradient(8, N * 0.52, 4, 8, N * 0.52, N * 0.30);
    sun.addColorStop(0, 'rgba(255,244,214,.55)');
    sun.addColorStop(1, 'rgba(255,244,214,0)');
    c2.fillStyle = sun; c2.fillRect(0, 0, 32, N);
    for (var i = 0; i < 34; i++) {
      var y = N * (0.40 + (i % 17) / 17 * 0.38);
      var a = 0.045 + (i % 5) * 0.02;
      c2.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      c2.fillRect(0, y, 32, 3 + (i % 4) * 3);
    }
    var tex2 = new THREE.CanvasTexture(cv);
    tex2.encoding = THREE.sRGBEncoding;
    skyMesh.material.map = tex2;
    skyMesh.material.needsUpdate = true;
  }

  /* ⑤ 材质分层：水/玻璃/沥青 */
  scene.traverse(function (o) {
    if (!o.isMesh || !o.material) return;
    var mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(function (m) {
      if (!m.color) return;
      var h = m.color.getHex();
      if (h === 0x2B7CA8) { m.roughness = 0.06; m.metalness = 0.55; }
      if (h === 0x2E3A48) { m.roughness = 0.12; m.metalness = 0.45; }
      if (h === 0x54585E) { m.roughness = 0.86; }
    });
  });

  /* ⑥ 暗角 + 顶部冷调（CSS 层，零渲染开销）*/
  var vig = document.createElement('div');
  vig.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:5;' +
    'background:' +
    'radial-gradient(ellipse 80% 76% at 50% 46%, rgba(0,0,0,0) 44%, rgba(16,22,30,.30) 100%),' +
    'linear-gradient(to bottom, rgba(120,160,210,.06), rgba(0,0,0,0) 38%)';
  document.body.appendChild(vig);
})();
