/** Per-user offline installation. Program versions and private data stay separate. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markerName = 'campus-install.json';
const appId = 'campus-insight-per-user-v1';
const powershell = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (parent, child) => { const rel = path.relative(parent, child); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };
const exists = file => fs.access(file).then(() => true, () => false);
function privateName(relative) {
  return relative.split(/[\\/]/).some(part => part.startsWith('.env') || ['node_modules', '.git', '.campus-data', '.campus-runtime', '.browser-audit', '.browser-final'].includes(part) || part.startsWith('.browser-')) || /\.sqlite(?:-(?:wal|shm))?$|setup-key\.txt$/i.test(relative);
}
async function noLink(file) {
  const stat = await fs.lstat(file);
  if (stat.isSymbolicLink()) throw new Error('安装来源或目标不能是链接：' + path.basename(file));
  return stat;
}
async function moduleFiles(root, first, files) {
  const relative = path.relative(root, first).replaceAll(path.sep, '/');
  if (!within(root, first) || privateName(relative)) throw new Error('发布依赖越过允许范围。');
  if (files.has(relative)) return;
  await noLink(first); files.set(relative, first);
  if (path.extname(first) === '.json') return;
  const text = await fs.readFile(first, 'utf8');
  for (const match of text.matchAll(/^\s*(?:import\s+(?:[^'";]*?\sfrom\s*)?|export\s+[^'";]*?\sfrom\s*)['"]([^'"]+)['"]/gm)) {
    if (match[1].startsWith('node:')) continue;
    if (!match[1].startsWith('.')) throw new Error('运行依赖尚未打包：' + match[1]);
    await moduleFiles(root, path.resolve(path.dirname(first), match[1]), files);
  }
}
export async function installationPlan(root) {
  root = path.resolve(root); const files = new Map();
  async function directory(folder, prefix) {
    await noLink(folder);
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const relative = `${prefix}/${entry.name}`, file = path.join(folder, entry.name);
      if (privateName(relative)) throw new Error('公开资源中发现私密文件，安装已停止。');
      if (entry.isSymbolicLink()) throw new Error('安装来源中不允许链接。');
      if (entry.isDirectory()) await directory(file, relative);
      else if (entry.isFile()) files.set(relative, file);
    }
  }
  await directory(path.join(root, 'dist'), 'dist');
  for (const name of ['server/index.mjs', 'scripts/start-local.mjs', 'scripts/backup-accounts.mjs', 'scripts/restore-accounts.mjs', 'scripts/configure-deployment.mjs', 'scripts/install-windows.mjs']) await moduleFiles(root, path.join(root, name), files);
  for (const name of ['开始使用.cmd', '打开数据文件夹.cmd', '备份我的数据.cmd', '安装到此电脑.cmd', '先看这里.html', 'scripts/node-required.txt', 'scripts/bootstrap-windows.ps1', 'deploy/启动网站.cmd', 'deploy/配置并启动.cmd', 'docs/素材与版权说明.md', 'docs/音乐来源与授权-v40.md', 'docs/音乐来源与授权-v43.md', 'docs/录屏配乐署名-v43.txt']) {
    const file = path.join(root, name);
    if (await exists(file)) { await noLink(file); files.set(name, file); }
  }
  // Source checkouts keep notices in docs/; portable releases place them at root.
  // Installed copies use the release layout so links survive redistribution.
  for (const prefix of ['', 'docs/']) {
    const notice = path.join(root, prefix, '第三方依赖与素材署名.md');
    if (await exists(notice)) { await noLink(notice); files.set('第三方依赖与素材署名.md', notice); break; }
  }
  for (const prefix of ['', 'docs/']) {
    const licenses = path.join(root, prefix, '第三方许可');
    if (await exists(licenses)) { await directory(licenses, '第三方许可'); break; }
  }
  let runtimeRoot;
  for (const candidate of [path.join(root, 'runtime'), path.join(root, '.campus-runtime'), path.dirname(process.execPath)]) {
    if (await exists(path.join(candidate, 'node.exe')) && await exists(path.join(candidate, 'LICENSE'))) { runtimeRoot = candidate; break; }
  }
  if (!runtimeRoot) throw new Error('尚未准备完整运行环境。请重新双击“安装到此电脑”，让启动器准备 Node 与许可。');
  const runtime = path.join(runtimeRoot, 'node.exe'); await noLink(runtime); await noLink(path.join(runtimeRoot, 'LICENSE'));
  const version = execFileSync(runtime, ['--version'], { windowsHide: true, encoding: 'utf8' }).trim();
  const [major, minor] = version.slice(1).split('.').map(Number);
  if (major < 24 || major === 24 && minor < 21 || !Number.isInteger(major)) throw new Error('安装运行环境需要 Node.js 24.21 或更新版本。');
  if (!(await fs.readFile(path.join(runtimeRoot, 'LICENSE'), 'utf8')).includes('Node.js is licensed')) throw new Error('缺少 Node.js 完整许可。');
  files.set('runtime/node.exe', runtime); files.set('runtime/LICENSE', path.join(runtimeRoot, 'LICENSE'));
  const records = [];
  for (const [relative, file] of [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (privateName(relative)) throw new Error('安装白名单包含私密路径。');
    const input = await fs.readFile(file);
    const bytes = relative.endsWith('.cmd') ? Buffer.from(input.toString('utf8').replace(/\r?\n/g, '\r\n'), 'utf8') : input;
    if (/\.(?:js|mjs|json|html|css|ps1)$/i.test(relative) && /sk-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(bytes.toString('utf8'))) throw new Error('发布文件疑似含密钥，安装已停止。');
    records.push({ path: relative, bytes: bytes.length, sha256: hash(bytes) });
  }
  const edition = JSON.parse(await fs.readFile(path.join(root, 'dist/build-edition.json'), 'utf8'));
  const fingerprint = hash(JSON.stringify(records));
  const editionLabel = `${edition.edition || 'B'}-${edition.version || 'current'}`.replace(/[^A-Za-z0-9._-]/g, '');
  return { files, records, fingerprint, versionId: `${editionLabel}-${fingerprint.slice(0, 12)}`, nodeVersion: version };
}

const installedRunner = `import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(fs.readFileSync(path.join(root,'${markerName}'),'utf8'));
if(config.appId!=='${appId}'||!/^[-A-Za-z0-9._]+$/.test(config.activeVersion))throw new Error('安装记录损坏，请重新运行安装包。');
const app=path.join(root,'versions',config.activeVersion);
async function available(port){const s=net.createServer();return new Promise(resolve=>{s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});}
let port;for(let candidate=15191;candidate<15291;candidate++){if(await available(candidate)){port=candidate;break;}}
if(!port)throw new Error('本机可用端口不足，请关闭已启动的本网站窗口后重试。');
console.log('程序位置：'+app+'\\n数据位置：'+path.join(root,'data')+'\\n不会覆盖其他已运行的网站。');
const child=spawn(process.env.ComSpec||'cmd.exe',['/d','/s','/c','""'+path.join(app,'开始使用.cmd')+'""'],{cwd:app,windowsVerbatimArguments:true,windowsHide:true,stdio:'inherit',env:{...process.env,HOST:'127.0.0.1',PORT:String(port),APP_ORIGIN:'',CAMPUS_DATA_DIR:path.join(root,'data')}});
child.once('error',e=>{console.error('启动失败：'+e.message);process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code||0;});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
`;
export async function installWindows({ root = sourceRoot, env = process.env } = {}) {
  if (process.platform !== 'win32') throw new Error('本安装入口仅用于 Windows；其他系统请使用 README 的源码部署方法。');
  const target = path.resolve(env.CAMPUS_INSTALL_ROOT || path.join(env.LOCALAPPDATA || '', 'CampusInsight'));
  const desktop = path.resolve(env.CAMPUS_INSTALL_DESKTOP || execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8; [Environment]::GetFolderPath("Desktop")'], { windowsHide: true, encoding: 'utf8' }).trim());
  if (!env.CAMPUS_INSTALL_ROOT && !env.LOCALAPPDATA) throw new Error('无法定位当前用户的本机数据目录。');
  if (within(path.resolve(root), target) || target === path.parse(target).root) throw new Error('安装目录不能位于来源目录内或磁盘根目录。');
  if (await exists(target)) {
    await noLink(target);
    const entries = await fs.readdir(target);
    if (entries.length) {
      const record = await fs.readFile(path.join(target, markerName), 'utf8').then(JSON.parse, () => null);
      if (record?.appId !== appId) throw new Error('目标目录中已有其他文件，未覆盖。请联系提供者处理安装位置。');
    }
  }
  const plan = await installationPlan(root);
  await fs.mkdir(target, { recursive: true });
  for (const name of ['versions', 'data']) {
    const folder = path.join(target, name); if (await exists(folder)) await noLink(folder);
    await fs.mkdir(folder, { recursive: true });
  }
  const destination = path.join(target, 'versions', plan.versionId);
  if (await exists(destination)) {
    await noLink(destination);
    for (const record of plan.records) {
      const file = path.join(destination, record.path); await noLink(file);
      if (hash(await fs.readFile(file)) !== record.sha256) throw new Error('已有程序版本校验失败，未覆盖程序或数据。');
    }
  } else {
    const staging = path.join(target, 'versions', `.installing-${randomUUID()}`);
    await fs.mkdir(staging);
    for (const [relative, source] of plan.files) {
      const file = path.join(staging, relative); await fs.mkdir(path.dirname(file), { recursive: true });
      if (relative.endsWith('.cmd')) await fs.writeFile(file, (await fs.readFile(source, 'utf8')).replace(/\r?\n/g, '\r\n'));
      else await fs.copyFile(source, file);
    }
    await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: 'campus-insight-installed', private: true, type: 'module', engines: { node: '>=24.21.0' } }, null, 2) + '\n');
    await fs.writeFile(path.join(staging, 'install-files.json'), JSON.stringify({ fingerprint: plan.fingerprint, files: plan.records }, null, 2) + '\n');
    await fs.rename(staging, destination);
  }
  await fs.writeFile(path.join(target, 'run-installed.mjs'), installedRunner);
  const launcher = '@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\n"%~dp0versions\\' + plan.versionId + '\\runtime\\node.exe" "%~dp0run-installed.mjs"\r\nif errorlevel 1 pause\r\n';
  await fs.writeFile(path.join(target, '启动校园行迹.cmd'), launcher, 'utf8');
  for (const [name, script] of [['备份我的数据.cmd', 'backup-accounts.mjs'], ['打开数据文件夹.cmd', 'start-local.mjs --open-data']]) {
    const [filename, ...args] = script.split(' ');
    const command = '@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\nset "CAMPUS_DATA_DIR=%~dp0data"\r\n"%~dp0versions\\' + plan.versionId + '\\runtime\\node.exe" "%~dp0versions\\' + plan.versionId + '\\scripts\\' + filename + '"' + (args.length ? ' ' + args.join(' ') : '') + '\r\nset "CAMPUS_EXIT=%ERRORLEVEL%"\r\npause\r\nexit /b %CAMPUS_EXIT%\r\n';
    await fs.writeFile(path.join(target, name), command, 'utf8');
  }
  const record = { appId, activeVersion: plan.versionId, nodeVersion: plan.nodeVersion, fingerprint: plan.fingerprint, installedAt: new Date().toISOString(), dataDirectory: path.join(target, 'data') };
  const pendingRecord = path.join(target, `.${markerName}-${randomUUID()}`);
  await fs.writeFile(pendingRecord, JSON.stringify(record, null, 2) + '\n'); await fs.rename(pendingRecord, path.join(target, markerName));
  await fs.mkdir(desktop, { recursive: true });
  const shortcut = path.join(desktop, '校园行迹.lnk');
  execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', '$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut($env:CAMPUS_INSTALL_LINK); $l.TargetPath=$env:CAMPUS_INSTALL_LAUNCHER; $l.WorkingDirectory=$env:CAMPUS_INSTALL_BASE; $l.Description="Campus Insight"; $l.Save()'], { windowsHide: true, stdio: 'pipe', env: { ...env, CAMPUS_INSTALL_LINK: shortcut, CAMPUS_INSTALL_LAUNCHER: path.join(target, '启动校园行迹.cmd'), CAMPUS_INSTALL_BASE: target } });
  console.log(`\n安装完成。以后双击桌面的“校园行迹”。\n程序：${destination}\n数据：${path.join(target, 'data')}\n数据工具：${target} 中的“备份我的数据”和“打开数据文件夹”。\n重新安装会保留账号和答卷；旧程序版本也会保留。\n`);
  if (env.CAMPUS_INSTALL_NO_OPEN !== '1') {
    const child = spawn(process.execPath, [path.join(target, 'run-installed.mjs')], { cwd: target, env, windowsHide: true, stdio: 'inherit' });
    await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code ? reject(new Error('已安装，但网站未能启动。请保留上方错误信息。')) : resolve()); });
  }
  return { target, destination, dataDirectory: path.join(target, 'data'), shortcut, ...record };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installWindows().catch(error => { console.error('安装未完成：' + error.message); process.exitCode = 1; });
}
