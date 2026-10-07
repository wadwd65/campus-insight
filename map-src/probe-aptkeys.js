(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  var keys = Object.keys(A);
  var out = ['__APT keys = ' + JSON.stringify(keys)];
  keys.forEach(function (k) {
    var v = A[k];
    var t = v === null ? 'null' : (Array.isArray(v) ? 'Array(' + v.length + ')' : typeof v);
    var extra = '';
    if (v && v.isObject3D) extra = ' [Object3D ' + v.type + ' children=' + v.children.length + ']';
    if (v && v.domElement) extra = ' [renderer canvas ' + v.domElement.width + 'x' + v.domElement.height + ']';
    if (v && v.isCamera) extra = ' [camera ' + v.type + ']';
    out.push('  ' + k + ' : ' + t + extra);
  });
  /* 找 renderer：从 canvas 反查 */
  var cvs = document.querySelectorAll('canvas');
  out.push('页面 canvas 数 = ' + cvs.length);
  for (var i = 0; i < cvs.length; i++) {
    out.push('  canvas[' + i + '] ' + cvs[i].width + 'x' + cvs[i].height + ' id=' + cvs[i].id);
  }
  var gl = cvs[0] && (cvs[0].getContext('webgl2') || cvs[0].getContext('webgl'));
  out.push('canvas[0] gl = ' + (gl ? 'OK' : 'null'));
  return out.join('\n');
})()
