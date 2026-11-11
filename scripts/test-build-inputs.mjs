import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { collectBuildInputs, compareBuildInputs } from './build-inputs.mjs';

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-inputs-'));
let count = 0;
const check = (label, run) => { run(); count++; console.log(`✓ ${label}`); };
const emptyDiff = { missing: [], extra: [], changed: [] };
const files = {
  'index.html': '<html>fixture</html>\n',
  'map-src/building-reference.json': '{}\n',
  'map-src/campus-layout.json': '{}\n',
  'map-src/three-packed.js': '// fixture\n',
  'package-lock.json': '{}\n',
  'package.json': '{"type":"module"}\n',
  'src/app.jsx': '<main className="flex">fixture</main>\n',
  'vite.config.js': 'export default {}\n',
};
try {
  for (const folder of ['src', 'server', 'public', 'scripts', 'map-src/web']) await fs.mkdir(path.join(temporary, folder), { recursive: true });
  for (const [name, text] of Object.entries(files)) await fs.writeFile(path.join(temporary, name), text);
  const clean = collectBuildInputs(temporary);
  const legacy = createHash('sha256');
  for (const name of Object.keys(files).sort()) legacy.update(name).update('\0').update(files[name]).update('\0');
  check('源码摘要沿用旧算法，不通过缩小校验范围获得一致', () => assert.equal(clean.sourceSha256, legacy.digest('hex')));
  await fs.writeFile(path.join(temporary, 'src/app.jsx'), files['src/app.jsx'].replaceAll('\n', '\r\n'));
  check('Windows与Linux文本换行得到同一摘要', () => assert.equal(collectBuildInputs(temporary).sourceSha256, clean.sourceSha256));
  await fs.mkdir(path.join(temporary, '.git'));
  await fs.mkdir(path.join(temporary, '.browser-audit'));
  await fs.writeFile(path.join(temporary, '.browser-audit/cache.html'), '<div class="top-4 z-10"></div>');
  check('Git元数据和根目录浏览器缓存不进入源码摘要', () => assert.deepEqual(collectBuildInputs(temporary), clean));
  await fs.writeFile(path.join(temporary, 'scripts/stale.mjs'), '// leftover\n');
  const stale = collectBuildInputs(temporary);
  check('远端多出旧源码时摘要不同', () => assert.notEqual(stale.sourceSha256, clean.sourceSha256));
  check('逐文件定位仅目标存在的残留', () => assert.deepEqual(compareBuildInputs(clean, stale), { ...emptyDiff, extra: ['scripts/stale.mjs'] }));
  check('逐文件定位目标缺失的文件', () => assert.deepEqual(compareBuildInputs(stale, clean), { ...emptyDiff, missing: ['scripts/stale.mjs'] }));
  await fs.writeFile(path.join(temporary, 'src/app.jsx'), '<main>changed</main>\n');
  check('逐文件定位内容变化', () => assert.deepEqual(compareBuildInputs(stale, collectBuildInputs(temporary)), { ...emptyDiff, changed: ['src/app.jsx'] }));
  check('拒绝重复清单项', () => assert.throws(() => compareBuildInputs(clean, { ...clean, files: [...clean.files, clean.files[0]] })));
  check('拒绝越出目录的清单路径', () => assert.throws(() => compareBuildInputs(clean, { ...clean, files: [{ ...clean.files[0], path: '../private.env' }] })));
  console.log(`构建输入：${count}项通过（临时夹具，未接触生产文件）。`);
} finally {
  const resolved = path.resolve(temporary), parent = path.resolve(os.tmpdir());
  assert.equal(path.dirname(resolved), parent);
  assert.ok(path.basename(resolved).startsWith('campus-inputs-'));
  await fs.rm(resolved, { recursive: true, force: true });
}
