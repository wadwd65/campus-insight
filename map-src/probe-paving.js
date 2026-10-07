(function () {
  var T = window.__three, s = T.scene, THREE = T.THREE;
  var out = { joints: [], base: null, grounds: [] };

  /* ── A. 7 圈"铺装分格"环：世界 Y、是否渲染、是否与广场面共面 ── */
  var plazaY = null;
  s.traverse(function (o) {
    if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry') {
      var wp = new THREE.Vector3(); o.getWorldPosition(wp);
      plazaY = wp.y;
    }
  });
  out.plazaY = plazaY;

  s.traverse(function (o) {
    if (!o.isMesh || !o.geometry) return;
    if (o.geometry.type !== 'RingGeometry') return;
    var p = o.geometry.parameters;
    if (p.innerRadius >= 33) return;              /* 只看分格环（r < 33） */
    var wp = new THREE.Vector3(); o.getWorldPosition(wp);
    var bb = new THREE.Box3().setFromObject(o);
    out.joints.push({
      r: p.innerRadius.toFixed(2) + '~' + p.outerRadius.toFixed(3),
      width: +(p.outerRadius - p.innerRadius).toFixed(4),
      color: '#' + o.material.color.getHexString(),
      transparent: !!o.material.transparent,
      opacity: o.material.opacity,
      depthWrite: o.material.depthWrite,
      renderOrder: o.renderOrder,
      worldY: +wp.y.toFixed(4),
      yMinusPlaza: plazaY === null ? null : +(wp.y - plazaY).toFixed(4),
      visible: o.visible,
      inFrustumTest: (function () {
        /* 手动判断是否在视锥内：取包围盒中心投影 */
        var c = bb.getCenter(new THREE.Vector3());
        var v = c.clone().project(T.camera);
        return { ndc: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)],
                 inView: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z >= -1 && v.z <= 1 };
      })()
    });
  });

  /* ── B. 220×220 兜底地面：中心区到底可不可见（是否被广场盖住）── */
  s.traverse(function (o) {
    if (!o.isMesh || !o.geometry) return;
    if (o.geometry.type !== 'PlaneGeometry') return;
    var p = o.geometry.parameters;
    if (!(p.width > 100)) return;
    var m = o.material;
    out.base = {
      size: p.width + 'x' + p.height,
      color: m.color ? '#' + m.color.getHexString() : null,
      hasMap: !!m.map,
      mapRepeat: m.map && m.map.repeat ? [m.map.repeat.x, m.map.repeat.y] : null,
      mapEncoding: m.map ? String(m.map.encoding) : null,
      worldY: +new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).y.toFixed(3),
      userData: JSON.stringify(o.userData)
    };
  });

  /* ── C. 相机近远平面（判断 6mm 是否在深度精度以内）── */
  var cam = T.camera;
  out.camera = {
    type: cam.type,
    near: cam.near, far: cam.far,
    zoom: cam.zoom,
    pos: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)]
  };
  /* 深度精度估算：24bit 深度缓冲下，距离 d 处的可分辨间距 */
  var d = cam.position.length();
  var bits = 24;
  out.depthResAtCamDist = +(d * d * (1 / cam.near - 1 / cam.far) / Math.pow(2, bits)).toFixed(5);

  /* ── D. 渲染器尺寸与像素比 ── */
  out.renderer = {
    w: T.renderer.domElement.width,
    h: T.renderer.domElement.height,
    pixelRatio: T.renderer.getPixelRatio()
  };

  return JSON.stringify(out, null, 1);
})()
