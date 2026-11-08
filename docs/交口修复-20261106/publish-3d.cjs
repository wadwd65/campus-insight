/* 统一发布：把工作副本写回桌面「校园3D-唯一版.html」，并自动清理旧备份。
 *
 * 用法：node publish-3d.cjs <新HTML路径> [--dry]
 *
 * 背景：以前每次改动都手工 cp 一份 .bak-YYYYMMDD.html，桌面越积越多。
 * 现在流程固定为：
 *   ① 校验源（必须存在、是 HTML、含 3D 关键标记）
 *   ② 把当前桌面版备份成 校园3D-唯一版.bak-<日期>[-n].html
 *   ③ 写入新版
 *   ④ 只保留 KEEP_BACKUPS 份最新备份，其余**移入回收站**（可还原）
 *
 * 安全边界：
 *   - 只认严格白名单 ^校园3D-唯一版\.bak-\d{8}(-\d+)?\.html$
 *   - 不递归、不用通配符删、绝不触碰桌面其它文件
 *   - 删除一律走 wb_recycle.py（回收站），不永久删除
 *   - --dry 只列清单不写不删
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DESKTOP = 'C:/Users/123/Desktop';
const TARGET = path.join(DESKTOP, '校园3D-唯一版.html');
const RECYCLE = 'C:/Users/123/.workbuddy/tools/wb_recycle.py';
const BACKUP_RE = /^校园3D-唯一版\.bak-\d{8}(-\d+)?\.html$/;
const KEEP_BACKUPS = 1;               // 只留一份最新备份，避免累积
const SRC = process.argv[2];
const DRY = process.argv.includes('--dry');

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function backupName() {
  const base = `校园3D-唯一版.bak-${stamp()}.html`;
  if (!fs.existsSync(path.join(DESKTOP, base))) return base;
  let n = 2;
  while (fs.existsSync(path.join(DESKTOP, `校园3D-唯一版.bak-${stamp()}-${n}.html`))) n++;
  return `校园3D-唯一版.bak-${stamp()}-${n}.html`;
}
function listBackups() {
  return fs.readdirSync(DESKTOP)
    .filter(n => BACKUP_RE.test(n))
    .map(n => ({ name: n, full: path.join(DESKTOP, n), mtime: fs.statSync(path.join(DESKTOP, n)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
}

if (!SRC || !fs.existsSync(SRC)) throw new Error('用法: node publish-3d.cjs <新HTML路径> [--dry]');
const html = fs.readFileSync(SRC, 'utf8');
if (!/^<!doctype html>/i.test(html) || !html.includes('buildCampusScene') || !html.includes('createFishing')) {
  throw new Error('源文件不是完整的 3D 唯一版（缺少关键标记），已中止');
}
console.log('源:', SRC, html.length, '字符');
console.log('目标:', TARGET);

const before = listBackups();
console.log(`现有备份 ${before.length} 个:`, before.map(b => b.name).join(' | ') || '(无)');

if (DRY) {
  console.log('--dry：仅列清单，未写未删');
  console.log('将保留最新的', KEEP_BACKUPS, '个，其余移入回收站:', before.slice(0, Math.max(0, before.length - KEEP_BACKUPS)).map(b => b.name));
  process.exit(0);
}

/* ① 备份当前桌面版 */
let freshBackup = null;
if (fs.existsSync(TARGET)) {
  freshBackup = backupName();
  fs.copyFileSync(TARGET, path.join(DESKTOP, freshBackup));
  console.log('已备份当前版 →', freshBackup);
}
/* ② 写入新版 */
fs.copyFileSync(SRC, TARGET);
console.log('已写回 →', TARGET, fs.statSync(TARGET).size, 'B');

/* ③ 清理更早的备份（只留最新 N 份） */
const all = listBackups();
const keep = new Set(all.slice(-KEEP_BACKUPS).map(b => b.name));
const stale = all.filter(b => !keep.has(b.name));
if (!stale.length) {
  console.log('无多余备份需要清理');
} else {
  console.log('将移入回收站（仅这些白名单文件）:');
  stale.forEach(b => console.log('  -', b.name));
  if (!fs.existsSync(RECYCLE)) throw new Error('回收站工具不存在，已中止删除: ' + RECYCLE);
  for (const b of stale) {
    try {
      execFileSync('python', [RECYCLE, b.full], { stdio: 'pipe' });
      console.log('  ✓ 已入回收站', b.name);
    } catch (e) {
      console.error('  ✗ 失败（保留不动）', b.name, String(e.message).slice(0, 120));
    }
  }
}
/* ④ 删后复核 */
const after = listBackups();
console.log('--- 结果 ---');
console.log('桌面唯一版:', fs.existsSync(TARGET) ? fs.statSync(TARGET).size + ' B' : '缺失');
console.log('剩余备份:', after.map(b => b.name).join(' | ') || '(无)');
