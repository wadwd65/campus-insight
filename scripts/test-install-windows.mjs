/** Real per-user install test in an explicit D-drive sandbox, never the real desktop. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installWindows, installationPlan } from './install-windows.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'win32') { console.log('SKIP: Windows 安装/快捷方式实测需要 Windows。'); process.exit(0); }
const sandbox = path.join('D:/CampusInsight-提交验收-20261112/installer-test', randomUUID());
const fixture = path.join(sandbox, '来源 中文 (有空格)');
const target = path.join(sandbox, '本机安装 中文 (有空格)');
const desktop = path.join(sandbox, '测试桌面 中文');
let checks = 0, child, reservation;
const check = label => { checks++; console.log('✓ ' + label); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const plan = await installationPlan(source);
  await fs.mkdir(fixture, { recursive: true });
  for (const [relative, input] of plan.files) {
    const file = path.join(fixture, relative); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.copyFile(input, file);
  }
  await fs.writeFile(path.join(fixture, 'package.json'), '{"type":"module"}\n');
  const privateFiles = ['.env.local', '.campus-data/fake.sqlite', 'node_modules/fake-secret.txt', '.browser-audit/session.txt'];
  for (const name of privateFiles) { const file = path.join(fixture, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, 'PRIVATE-FIXTURE-DO-NOT-COPY'); }
  const env = { ...process.env, CAMPUS_INSTALL_ROOT: target, CAMPUS_INSTALL_DESKTOP: desktop, CAMPUS_INSTALL_NO_OPEN: '1', CAMPUS_LAUNCHER_NO_OPEN: '1' };
  const first = await installWindows({ root: fixture, env });
  assert.ok(first.destination.startsWith(path.join(target, 'versions'))); assert.equal(first.dataDirectory, path.join(target, 'data'));
  check('中文/空格/括号来源与目标可安装，程序与数据分开保存');
  for (const name of privateFiles) await assert.rejects(fs.access(path.join(first.destination, name)));
  check('环境配置、数据库、依赖目录和浏览器会话不进入安装结果');
  const installedRecord = JSON.parse(await fs.readFile(path.join(first.destination, 'install-files.json'), 'utf8'));
  for (const record of installedRecord.files) assert.equal(hash(await fs.readFile(path.join(first.destination, record.path))), record.sha256);
  check('已安装文件逐字节符合安装清单，Windows入口为CRLF');
  assert.ok(plan.files.has('第三方依赖与素材署名.md'));
  assert.ok(plan.records.some(record => record.path.startsWith('第三方许可/依赖许可/')));
  assert.ok((await fs.readFile(path.join(first.destination, '第三方依赖与素材署名.md'), 'utf8')).length > 100);
  assert.ok((await fs.stat(path.join(first.destination, '第三方许可/Node.js-LICENSE.txt'))).isFile());
  check('源码docs许可与便携根目录许可均随安装保留，许可链接保持同一布局');
  const link = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut($env:CAMPUS_TEST_LINK); [Console]::OutputEncoding=[Text.Encoding]::UTF8; Write-Output $l.TargetPath; Write-Output $l.WorkingDirectory'], { windowsHide: true, encoding: 'utf8', env: { ...env, CAMPUS_TEST_LINK: first.shortcut } });
  assert.ok(link.includes(path.join(target, '启动校园行迹.cmd'))); assert.ok(link.includes(target));
  check('在测试桌面真实建立指向启动入口的Windows快捷方式');
  const sentinel = path.join(first.dataDirectory, '保留数据.txt'); await fs.writeFile(sentinel, '账号与答卷保留测试');
  const second = await installWindows({ root: fixture, env });
  assert.equal(second.destination, first.destination); assert.equal(await fs.readFile(sentinel, 'utf8'), '账号与答卷保留测试');
  check('相同版本可再次安装且不覆盖已有数据');
  const before = await fs.readFile(path.join(first.destination, 'dist/index.html'));
  await fs.appendFile(path.join(fixture, 'dist/index.html'), '\n<!-- isolated installer revision test -->\n');
  const updated = await installWindows({ root: fixture, env });
  assert.notEqual(updated.destination, first.destination); assert.deepEqual(await fs.readFile(path.join(first.destination, 'dist/index.html')), before);
  assert.equal(await fs.readFile(sentinel, 'utf8'), '账号与答卷保留测试');
  check('更新安装启用新版本，保留旧程序与同一份数据');
  const occupied = path.join(sandbox, '已有其他文件'); await fs.mkdir(occupied); await fs.writeFile(path.join(occupied, 'user.txt'), 'keep');
  await assert.rejects(installWindows({ root: fixture, env: { ...env, CAMPUS_INSTALL_ROOT: occupied } }), /已有其他文件/);
  assert.equal(await fs.readFile(path.join(occupied, 'user.txt'), 'utf8'), 'keep');
  await assert.rejects(installWindows({ root: fixture, env: { ...env, CAMPUS_INSTALL_ROOT: path.join(fixture, 'bad-install') } }), /来源目录/);
  check('拒绝覆盖未知目录或把程序安装进来源文件夹');
  const secretAsset = path.join(fixture, 'dist', '.env.local'); await fs.writeFile(secretAsset, 'private fixture');
  await assert.rejects(installationPlan(fixture), /私密文件/); await fs.rename(secretAsset, path.join(sandbox, 'blocked-dist-env-fixture.txt'));
  check('公开资源中夹带私密文件时拒绝安装');
  // Reserve the preferred installed-app port. The generated entry must pick another,
  // and leave the existing listener intact rather than killing or reusing it.
  reservation = net.createServer(); let reserved;
  try { await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(15191, '127.0.0.1', resolve); }); reserved = true; }
  catch (error) { if (error.code !== 'EADDRINUSE') throw error; }
  const launcher = path.join(target, '启动校园行迹.cmd');
  const cleanEnv = { ...env, APP_ORIGIN: '', PORT: '', CAMPUS_DATA_DIR: '' }; delete cleanEnv.Path; cleanEnv.PATH = path.join(process.env.SystemRoot || 'C:/Windows', 'System32');
  child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${launcher}""`], { cwd: target, env: cleanEnv, windowsVerbatimArguments: true, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', bytes => { output += bytes.toString('utf8'); }); child.stderr.on('data', bytes => { output += bytes.toString('utf8'); });
  const deadline = Date.now() + 25000;
  while (!output.includes('网站已打开') && Date.now() < deadline) { if (child.exitCode !== null) break; await new Promise(resolve => setTimeout(resolve, 80)); }
  assert.ok(output.includes('网站已打开'), output);
  const match = output.match(/网站已打开：(http:\/\/127\.0\.0\.1:(\d+)\/)/); assert.ok(match, output); assert.notEqual(Number(match[2]), 15191);
  let response = await fetch(match[1] + 'api/campus/session'); assert.equal(response.status, 200); assert.equal((await response.json()).setupRequired, false);
  check('真实桌面启动入口在无系统Node/PATH时启动自带运行时，避开已有端口');
  response = await fetch(match[1]); assert.equal(response.status, 200); assert.ok((await response.text()).includes('<html'));
  response = await fetch(match[1] + 'api/campus/register', { method: 'POST', headers: { Origin: match[1].replace(/\/$/, ''), 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'installtest', password: '123456', registrationMode: 'create', circleName: '隔离安装验收圈' }) });
  assert.equal(response.status, 200); assert.ok((await response.json()).circleId); assert.ok(await fs.stat(path.join(target, 'data/campus.sqlite')));
  check('已安装版本真实提供首页、注册与SQLite账号落库');
  const runTool = name => {
    const result = execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${path.join(target, name)}""`], { cwd: target, env: cleanEnv, windowsHide: true, windowsVerbatimArguments: true, input: '\r\n', encoding: 'utf8', timeout: 15000 });
    assert.ok(!/not recognized|不是内部或外部命令/.test(result), result); return result;
  };
  assert.ok(runTool('备份我的数据.cmd').includes('一致性备份已保存'));
  const backups = await fs.readdir(path.join(target, 'data/backups')); assert.ok(backups.some(file => file.endsWith('.sqlite')));
  const inspect = execFileSync(path.join(updated.destination, 'runtime/node.exe'), ['--input-type=module', '-e', 'import {DatabaseSync} from "node:sqlite";const db=new DatabaseSync(process.argv[1],{readOnly:true});console.log(db.prepare("SELECT username FROM users").all().map(x=>x.username).join(","));db.close();', path.join(target, 'data/backups', backups.find(file => file.endsWith('.sqlite')))], { windowsHide: true, encoding: 'utf8' });
  assert.ok(inspect.includes('installtest'));
  assert.ok(runTool('打开数据文件夹.cmd').includes(path.join(target, 'data')));
  await assert.rejects(fs.access(path.join(updated.destination, '.campus-data')));
  check('安装根目录的数据工具真实备份刚注册的账号，并打开同一持久数据目录');
  if (reserved) { assert.ok(reservation.listening); await new Promise(resolve => reservation.close(resolve)); }
  console.log(`Windows安装器：${checks} 项通过。测试目录保留在 ${sandbox}`);
} finally {
  if (reservation?.listening) await new Promise(resolve => reservation.close(resolve));
  if (child?.pid) { try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* Already stopped. */ } }
}
