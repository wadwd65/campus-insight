(function () {
  var A = window.__APT;
  if (!A) return 'no __APT';
  var out = [];

  function nanScan(root, label) {
    var bad = 0, total = 0;
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      total++;
      var pos = o.geometry.attributes.position;
      if (!pos) return;
      for (var i = 0; i < pos.count; i++) {
        if (!isFinite(pos.getX(i)) || !isFinite(pos.getY(i)) || !isFinite(pos.getZ(i))) { bad++; break; }
      }
    });
    return label + ' mesh=' + total + ' NaN几何=' + bad;
  }

  /* 屋面材质色统计（坡顶用 roofSlopeA/B）*/
  function roofStats(root, label) {
    var slopeA = 0, slopeB = 0, ridge = 0, fascia = 0, gable = 0, winFrame = 0, winGlass = 0;
    var box = new THREE.Box3().setFromObject(root);
    var topY = 0;
    root.traverse(function (o) {
      if (!o.isMesh) return;
      var c = o.material && o.material.color ? o.material.color.getHexString() : 'none';
      if (c === '8e887c') slopeA++;
      else if (c === '5e5a52') slopeB++;
      else if (c === '5a554e') ridge++;
      else if (c === '6a6255') fascia++;
      else if (c === 'b47a5c') gable++;
      else if (c === 'e4e0d8') winFrame++;
      else if (c === '2a3038') winGlass++;
    });
    return label
      + '\n  包围盒 Y ' + box.min.y.toFixed(2) + ' ~ ' + box.max.y.toFixed(2)
      + '   X ' + box.min.x.toFixed(1) + '~' + box.max.x.toFixed(1)
      + '   Z ' + box.min.z.toFixed(1) + '~' + box.max.z.toFixed(1)
      + '\n  ★ 坡面A(受光) ' + slopeA + '   坡面B(背光) ' + slopeB
      + '   正脊 ' + ridge + '   封檐板 ' + fascia
      + '\n  ★ 山墙 ' + gable + '   老虎窗白套 ' + winFrame + '   老虎窗玻璃 ' + winGlass;
  }

  /* ★★★ v20 新增硬断言：**position/scale/quaternion 必须是向量类型**
     ──────────────────────────────────────────────────────────────
     起因（v20a~c 的真 bug）：`aptGableRoof` 形参 5 个、实参 4 个
     ⇒ 实参左移一位 ⇒ `position.y = {ang:...}`（对象）⇒ matrix NaN
     ⇒ 包围盒 NaN ⇒ 取景失败。三类断言一次拦住：
       ① 类型断言（本条）  ② 包围盒有限性  ③ position.y 数值常规性 */
  function vecTypeScan(root, label) {
    var bad = [];
    root.traverse(function (o) {
      if (!o.isMesh) return;
      if (!(o.position && o.position.isVector3)) bad.push('position 非 Vector3');
      if (!isFinite(o.position.y)) bad.push('position.y 非有限数 = ' + String(o.position.y).slice(0, 60));
      if (!(o.scale && o.scale.isVector3)) bad.push('scale 非 Vector3');
      if (!(o.quaternion && o.quaternion.isQuaternion)) bad.push('quaternion 非 Quaternion');
    });
    return '  [类型断言] ' + label + ' → ' + (bad.length ? ('★ 失败 ' + bad.length + ' 项: ' + bad.slice(0, 3).join('; ')) : 'OK');
  }

  out.push(nanScan(A.aptA, '[A 平顶]'));
  out.push(nanScan(A.aptB, '[B 坡顶]'));
  out.push(vecTypeScan(A.aptA, 'A'));
  out.push(vecTypeScan(A.aptB, 'B'));
  out.push('');
  out.push(roofStats(A.aptA, '[Plan-A 暖驼墙+深蓝平顶]'));
  out.push('');
  out.push(roofStats(A.aptB, '[Plan-B 暖砖红墙+公寓双坡顶]'));
  return out.join('\n');
})()
