import fs from 'node:fs';
const p = 'map-src/web/index.html';
let s = fs.readFileSync(p, 'utf8');
const before = s.length;

const edits = [
  // 1) 下拉框去掉「省电」
  ['<option value="low">省电</option>', ''],
  // 2) 任何入口传 low 都提升为 balanced
  ["function setQuality(name){\n  qualityName=QUALITY[name]?name:'low';",
   "function setQuality(name){\n  if(name==='low')name='balanced';\n  qualityName=QUALITY[name]?name:'balanced';"],
  // 3) 初始档：最低 balanced，不再因为软渲染/弱设备切到 low
  ["  return software || coarse || memory<=4 || reduced ? 'low' : memory>=8 ? 'high' : 'balanced';",
   "  return (!software && !coarse && !reduced && memory>=8) ? 'high' : 'balanced';"],
  // 4) 看门狗：只降一档到 balanced，且不再跳 low
  ["setQuality(avg>90?'low':qualityName==='high'?'balanced':'low');", "setQuality('balanced');"],
  // 5) CPU 帧时兜底降档：也只到 balanced
  ["setQuality(qualityName==='high'?'balanced':'low');$('announce')", "setQuality('balanced');$('announce')"],
  // 6) 低端设备强制档：balanced
  ['else if(DEV_LOW)setQuality("low")', 'else if(DEV_LOW)setQuality("balanced")'],
];

for (const [a, b] of edits) {
  if (!s.includes(a)) { console.log('MISS:', a.slice(0, 60).replace(/\n/g, '\\n')); process.exit(1); }
  s = s.replace(a, b);
}
fs.writeFileSync(p, s);
console.log('ok', before, '->', s.length, 'low refs left:', (s.match(/setQuality\(['"]low['"]\)/g) || []).length);
