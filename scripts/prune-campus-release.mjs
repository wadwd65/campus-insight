import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// v30 is self-contained. Keep the modular source/fixtures for legacy tests,
// but never ship a second copy of Three.js, textures and the old application.
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fs.realpathSync(path.join(root, 'dist'));
const map = path.join(dist, 'map');
const entry = fs.readFileSync(path.join(map, '校园地图-3D实景.html'), 'utf8');
if (/<script\b[^>]*\bsrc\s*=/i.test(entry) || /<link\b[^>]*\bhref\s*=/i.test(entry)) throw new Error('地图不再是自包含页面，必须先更新发布依赖清单');
if (fs.readFileSync(path.join(root, 'map-src/web/index.html')).compare(Buffer.from(entry)) !== 0) throw new Error('发布地图与源码不一致');
const obsolete = ['three-r149.min.js', 'campus-app.js', 'campus-boot.js', 'campus-scene.js', 'campus-model.js', 'campus-lighting.js', 'campus-water.js', 'campus-walk.js', 'campus-play.js', 'campus-character.js', 'campus-visibility.js', 'campus-performance.js', 'campus-detail.js', 'campus-atmosphere.js', 'campus-textures.js', 'campus-fishing.js', 'campus-post.js', 'campus.css', 'campus-data.json', 'tex/tex-data.js'];
let removed = 0;
for (const name of obsolete) {
  const target = path.join(map, name);
  if (!fs.existsSync(target)) continue;
  const actual = fs.realpathSync(target), relative = path.relative(dist, actual);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(actual).isFile()) throw new Error('拒绝清理 dist 外路径或非文件：' + name);
  fs.unlinkSync(actual); removed++;
}
console.log(`3D release: self-contained entry retained; ${removed} unused generated files omitted.`);
