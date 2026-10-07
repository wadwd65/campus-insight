(function () {
  var B = window.__BATCH;
  if (!B) return 'no __BATCH —— 页面脚本可能报错了';
  var rows = [], bad = 0;
  for (var i = 0; i < B.count; i++) {
    var r = B.buildOne(i);
    if (!r || r.error) { rows.push(i + ' ERROR ' + (r && r.error)); bad++; continue; }
    var size = r.size;
    var degenerate = (size[1] < 0.5 || size[0] < 0.5 || size[2] < 0.5);
    var flag = '';
    if (r.nan) { flag += ' ⚠NaN×' + r.nan; bad++; }
    if (degenerate) { flag += ' ⚠退化体量'; bad++; }
    if (r.meshes < 5) { flag += ' ⚠构件过少'; bad++; }
    rows.push(
      String(i).padStart(2) + ' ' + r.id.padEnd(11) +
      ' mesh=' + String(r.meshes).padStart(5) +
      '  体量=' + size[0].toFixed(1) + '×' + size[1].toFixed(1) + '×' + size[2].toFixed(1) +
      '  高=' + r.height.toFixed(1) + flag
    );
  }
  return '__BATCH.count = ' + B.count + '\n' + rows.join('\n') +
         '\n── 异常计数 = ' + bad + ' ──';
})()
