/** Package the production server and its exact local module closure. No env, keys or npm dependencies. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Pass an explicit new output directory.');
const target = path.resolve(process.argv[2]);
if (target === root || target.startsWith(root + path.sep)) throw new Error('Release staging must be outside the source project.');
await fs.mkdir(target, { recursive: true });
if ((await fs.readdir(target)).length) throw new Error('Release staging must be a new empty directory.');
const included = new Set();
async function copyFile(source, relative) {
  const file = path.join(target, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (path.extname(source).toLowerCase() === '.cmd') {
    const text = await fs.readFile(source, 'utf8');
    await fs.writeFile(file, text.replace(/\r?\n/g, '\r\n'), 'utf8');
  } else await fs.copyFile(source, file);
  included.add(relative.replaceAll(path.sep, '/'));
}
async function moduleClosure(file) {
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Module outside project.');
  if (included.has(relative.replaceAll(path.sep, '/'))) return;
  await copyFile(file, relative);
  if (path.extname(file) === '.json') return;
  const source = await fs.readFile(file, 'utf8');
  for (const match of source.matchAll(/^\s*import\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)) {
    const specifier = match[1];
    if (specifier.startsWith('node:')) continue;
    if (!specifier.startsWith('.')) throw new Error(`Runtime needs an external dependency: ${specifier}`);
    await moduleClosure(path.resolve(path.dirname(file), specifier));
  }
}
async function directory(source, relative) {
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Symlinks are not allowed in release assets.');
    const input = path.join(source, entry.name), output = path.join(relative, entry.name);
    if (entry.isDirectory()) await directory(input, output);
    else await copyFile(input, output);
  }
}
await directory(path.join(root, 'dist'), 'dist');
await moduleClosure(path.join(root, 'server/index.mjs'));
await moduleClosure(path.join(root, 'scripts/backup-accounts.mjs'));
await moduleClosure(path.join(root, 'scripts/restore-accounts.mjs'));
await moduleClosure(path.join(root, 'scripts/configure-deployment.mjs'));
await moduleClosure(path.join(root, 'scripts/start-local.mjs'));
for (const name of ['开始使用.cmd', '打开数据文件夹.cmd', '备份我的数据.cmd', '先看这里.html']) await copyFile(path.join(root, name), name);
await copyFile(path.join(root, 'scripts/node-required.txt'), 'scripts/node-required.txt');
await directory(path.join(root, 'deploy'), 'deploy');
await copyFile(path.join(root, '.dockerignore'), '.dockerignore');
await copyFile(path.join(root, 'docs/双方案部署与交接.md'), '双方案部署与交接.md');
await copyFile(path.join(root, 'docs/给部署者的交接.md'), '给部署者的交接.md');
await copyFile(path.join(root, 'docs/上线与交接-20261023-v34.md'), '本版本变化-v34.md');
await copyFile(path.join(root, 'docs/迭代-20261023-校园小车与室内.md'), '本版本变化-v35.md');
await copyFile(path.join(root, 'docs/迭代-20261023-人物驾驶与屋顶二段跳.md'), '本版本变化-v36.md');
await copyFile(path.join(root, 'docs/迭代-20261023-参与感与校园片段.md'), '本版本变化-v37.md');
await copyFile(path.join(root, 'docs/迭代-20261023-B版校园行迹.md'), '本版本变化-v38-B.md');
await copyFile(path.join(root, 'docs/迭代-20261023-同行曲库与答题收整.md'), '本版本变化-v39-B.md');
await copyFile(path.join(root, 'docs/迭代-20261024-场景配乐与同行归位.md'), '本版本变化-v40-B.md');
await copyFile(path.join(root, 'docs/音乐来源与授权-v40.md'), '音乐来源与授权-v40.md');
await copyFile(path.join(root, 'docs/迭代-20261024-可拖动同行与彩蛋恢复.md'), '本版本变化-v41-B.md');
await copyFile(path.join(root, 'docs/迭代-20261024-可接续校园故事-v42.md'), '本版本变化-v42-B.md');
await copyFile(path.join(root, 'docs/迭代-20261024-剧情特效与国内外配乐-v43.md'), '本版本变化-v43-B.md');
await copyFile(path.join(root, 'docs/音乐来源与授权-v43.md'), '音乐来源与授权-v43.md');
await copyFile(path.join(root, 'docs/录屏配乐署名-v43.txt'), '录屏配乐署名-v43.txt');
await copyFile(path.join(root, 'docs/迭代-20261024-多剧场与连续体验-v44.md'), '本版本变化-v44-B.md');
await copyFile(path.join(root, 'docs/迭代-20261024-地图中的十个决定-v45.md'), '本版本变化-v45-B.md');
await copyFile(path.join(root, 'docs/迭代-20261024-地图细化与圈子定位-v46.md'), '本版本变化-v46-B.md');
await copyFile(path.join(root, 'docs/迭代-20261024-问卷主线与游戏联动-v47.md'), '本版本变化-v47-B.md');
await copyFile(path.join(root, '.env.example'), '.env.example');
const runtimeArgument = process.argv.find(argument => argument.startsWith('--windows-runtime='));
if (runtimeArgument) {
  const runtimeRoot = path.resolve(runtimeArgument.slice('--windows-runtime='.length));
  const executable = path.join(runtimeRoot, 'node.exe');
  const version = execFileSync(executable, ['--version'], { windowsHide: true, encoding: 'utf8' }).trim();
  const [major, minor] = version.replace(/^v/, '').split('.').map(Number);
  if (!Number.isInteger(major) || major < 24 || major === 24 && minor < 21) throw new Error('Windows runtime must be Node.js 24.21 or newer.');
  const license = path.join(runtimeRoot, 'LICENSE');
  if (!(await fs.readFile(license, 'utf8')).includes('Node.js is licensed')) throw new Error('Node runtime license is required.');
  await copyFile(executable, 'runtime/node.exe');
  await copyFile(license, 'runtime/LICENSE');
  const notice = `Windows x64 即用包内含 Node.js ${version}。许可全文见 runtime/LICENSE。\n无需安装 Node.js，直接双击最外层的“开始使用”。\n`;
  await fs.writeFile(path.join(target, 'Windows即用包说明.txt'), '\ufeff' + notice);
  included.add('Windows即用包说明.txt');
}
await fs.writeFile(path.join(target, 'package.json'), JSON.stringify({ name: 'campus-insight-server', private: true, version: '0.1.0', type: 'module', engines: { node: '>=24.21.0' }, scripts: { start: 'node server/index.mjs', configure: 'node scripts/configure-deployment.mjs', 'accounts:backup': 'node scripts/backup-accounts.mjs', 'accounts:restore': 'node scripts/restore-accounts.mjs' } }, null, 2) + '\n');
included.add('package.json');
await copyFile(path.join(root, 'docs/账号与圈子使用指南.md'), '启动说明.md');
for (const entry of await fs.readdir(target)) if (entry.startsWith('.env') && entry !== '.env.example') throw new Error('Unexpected private environment file in staging.');
const records = [];
for (const relative of [...included].sort()) {
  const bytes = await fs.readFile(path.join(target, relative));
  if (/\.(?:js|mjs|json|html|css)$/.test(relative) && /sk-[A-Za-z0-9_-]{20,}/.test(bytes.toString('utf8'))) throw new Error(`Possible credential in ${relative}; content redacted.`);
  records.push({ path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await fs.writeFile(path.join(target, 'release-manifest.json'), JSON.stringify({ files: records }, null, 2) + '\n');
console.log(`Node release ready: ${target} · ${records.length} files · zero external runtime dependencies`);
