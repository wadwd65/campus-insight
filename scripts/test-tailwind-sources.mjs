import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const repo = fileURLToPath(new URL('../', import.meta.url));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-tailwind-'));
const fixtures = ['checkout', 'source-zip'].map(name => path.join(temporary, name));
async function css(root) {
  const result = await build({ configFile: false, root, publicDir: false, logLevel: 'silent', plugins: [tailwindcss()], build: { write: false, emptyOutDir: false, rollupOptions: { input: path.join(root, 'src/index.css') } } });
  const files = result.output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css'));
  assert.equal(files.length, 1, '检查实际主样式的Tailwind编译结果');
  return String(files[0].source);
}
try {
  for (const fixture of fixtures) {
    await fs.mkdir(fixture, { recursive: true });
    await fs.cp(path.join(repo, 'src'), path.join(fixture, 'src'), { recursive: true });
    await fs.copyFile(path.join(repo, 'index.html'), path.join(fixture, 'index.html'));
    await fs.symlink(path.join(repo, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
  }
  await fs.mkdir(path.join(fixtures[0], '.git'));
  await fs.writeFile(path.join(fixtures[0], '.gitignore'), '.browser-*/\n');
  for (const name of ['.browser-audit', '.browser-final', '.smoke-out']) {
    await fs.mkdir(path.join(fixtures[1], name));
    await fs.writeFile(path.join(fixtures[1], name, 'cache.html'), '<div class="invisible top-4 right-4 z-[2147483001]"></div>');
  }
  const checkout = await css(fixtures[0]), withoutGit = await css(fixtures[1]);
  assert.equal(checkout, withoutGit);
  console.log('✓ 实际业务主CSS：有Git目录与无Git且含浏览器缓存时逐字节相同');
  assert.equal(withoutGit.includes('2147483001'), false);
  console.log('✓ 缓存夹具中的独有原子类未进入主CSS');
  assert.match(checkout, /\.flex\{/);
  console.log('✓ 业务源码中的真实flex类仍被生成');
  await fs.writeFile(path.join(fixtures[1], 'src/source-probe.html'), '<div class="z-[2147483001]"></div>');
  assert.ok((await css(fixtures[1])).includes('2147483001'));
  console.log('✓ 相同类名加入业务源码后会被生成，未关闭必要样式');
  console.log(`Tailwind来源隔离：4项通过；主CSS ${Buffer.byteLength(checkout)} B（真实源码编译，非完整浏览器排版验收）。`);
} finally {
  for (const fixture of fixtures) await fs.unlink(path.join(fixture, 'node_modules')).catch(error => { if (error.code !== 'ENOENT') throw error; });
  const resolved = path.resolve(temporary), parent = path.resolve(os.tmpdir());
  assert.equal(path.dirname(resolved), parent);
  assert.ok(path.basename(resolved).startsWith('campus-tailwind-'));
  await fs.rm(resolved, { recursive: true, force: true });
}
