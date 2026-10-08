/**
 * verify-dist.mjs —— 构建产物完整性校验（进 `npm run check`）
 *
 * ── 它解决的问题（用户 10-08 指出） ───────────────────────────────
 * 「构建失败」以前只有在我主动跑 `npm run build` 时才会暴露；而 `check` 里那步 smoke
 * 构建的是 SSR 产物（.smoke-out），**不是真正要发布的 dist/**。
 * 于是完全可能出现：`check` 全绿，但 `dist/` 缺文件、缺样式、或干脆没生成。
 *
 * 这里在每次 check 的末尾强制断言 dist/ 的关键文件，并顺手拦两类"慢性病"：
 *   ① **死重量**：未被引用的素材被塞进 public/（10-08 实测曾占 7.3MB）
 *   ② **体积回涨**：总量超阈值就报警（防止又被谁塞回几个 MB 的图）
 *
 * ★ 注意先 mkdirSync：`emptyOutDir:false` 之后，若 dist 被手动删掉，
 *   Vite 不会自动重建目录 —— 那时"构建成功但 dist 不存在"就是假绿。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + label + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ✗ ' + label + (extra ? '  ' + extra : '')); }
};

console.log('\nD · 构建产物完整性（dist/）');

/* ── 0. 目录必须存在（不存在就先建，避免"假绿"）── */
fs.mkdirSync(DIST, { recursive: true });
ok(fs.existsSync(DIST), 'dist/ 目录存在', DIST);

/* ── 1. 关键文件清单：缺一个就 exit 1 ── */
const REQUIRED = [
  'index.html',                                        // 入口 HTML
  'map/校园地图-3D实景.html',                          // 3D 附加展示页（外链目标）
  'data/示例-班级问卷.csv',                            // 示例数据（评委一键试）
  'data/问卷基准数据.csv',                             // 2000 人基准
];
for (const rel of REQUIRED) {
  const p = path.join(DIST, rel);
  const exists = fs.existsSync(p);
  const size = exists ? fs.statSync(p).size : 0;
  ok(exists && size > 0, '存在且非空：' + rel, exists ? `${(size / 1024).toFixed(0)} KB` : '(缺失)');
}

/* ── 2. 带哈希的产物：用通配匹配（名里带 hash，不能写死）── */
const assetsDir = path.join(DIST, 'assets');
const assets = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
ok(assets.some((f) => /^index-.*\.js$/.test(f)), '主 JS 入口 assets/index-*.js',
   assets.filter((f) => /^index-.*\.js$/.test(f)).join(', '));
ok(assets.some((f) => /\.css$/.test(f)), '样式 assets/*.css',
   assets.filter((f) => /\.css$/.test(f)).join(', '));
/* 懒加载分块（报告页/群体画像页按需加载）也要在包里 */
ok(assets.some((f) => /^ReportView-.*\.js$/.test(f)), '懒加载块 ReportView-*.js');
ok(assets.some((f) => /^CohortPage-.*\.js$/.test(f)), '懒加载块 CohortPage-*.js');

/* ── 3. 死重量：旧地图素材不该再出现在部署包里（10-08 纪律）── */
for (const dead of ['map/map-art', 'map/map-assets']) {
  ok(!fs.existsSync(path.join(DIST, dead)), '无死重量：dist/' + dead + ' 已移出');
}

/* ── 4. 体积闸门：防止又被塞回几 MB ── */
function dirSize(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    n += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return n;
}
const total = dirSize(DIST);
const MB = total / 1048576;
ok(MB < 6, 'dist/ 总体积 < 6MB（防死重量回涨）', MB.toFixed(2) + ' MB');

const mapDir = path.join(DIST, 'map');
if (fs.existsSync(mapDir)) {
  const mapMB = dirSize(mapDir) / 1048576;
  ok(mapMB < 2, 'dist/map < 2MB（只应有 3D 附加展示页）', mapMB.toFixed(2) + ' MB');
}

console.log(`\n${fail === 0 ? '✓' : '✗'} 构建产物校验：${pass} 项通过${fail ? '，' + fail + ' 项失败' : ''}`);
process.exit(fail === 0 ? 0 : 1);
