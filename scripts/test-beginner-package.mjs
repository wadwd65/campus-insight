import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync, execFileSync } from 'node:child_process';

if (!process.argv[2]) throw new Error('Pass the packaged runtime directory.');
const source = path.resolve(process.argv[2]);
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-beginner-'));
const root = path.join(temporary, '新用户解压 (有空格)');
let child, passed = 0;
const check = (label, fn) => { fn(); passed++; console.log(`✓ ${label}`); };
try {
  await fs.cp(source, root, { recursive: true });
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  const directory = path.join(temporary, 'private-data');
  const bundled = await fs.access(path.join(root, 'runtime/node.exe')).then(() => true, () => false);
  const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_ORIGIN: '', CAMPUS_DATA_DIR: directory, CAMPUS_LAUNCHER_NO_OPEN: '1', CAMPUS_SETUP_TOKEN: '', LLM_API_KEY: '', LLM_API_KEY_FILE: '', LLM_BASE_URL: '', LLM_MODEL: '' };
  // The portable package must work even when Node is absent from PATH.
  if (bundled && process.platform === 'win32') { delete env.Path; env.PATH = path.join(process.env.SystemRoot || 'C:/Windows', 'System32'); }
  const windows = filename => {
    const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${path.join(root, filename)}""`], { cwd: root, env, windowsHide: true, windowsVerbatimArguments: true, input: '\r\n', encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.ok(!/not recognized|不是内部或外部命令/.test(result.stdout + result.stderr), result.stdout + result.stderr);
    return result.stdout;
  };
  if (process.platform === 'win32') child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${path.join(root, '开始使用.cmd')}""`], { cwd: root, env, windowsHide: true, windowsVerbatimArguments: true, stdio: ['pipe', 'pipe', 'pipe'] });
  else child = spawn(process.execPath, ['scripts/start-local.mjs'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', bytes => { output += bytes.toString(); });
  child.stderr.on('data', bytes => { output += bytes.toString(); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { clearInterval(poll); reject(new Error('Launcher did not become ready: ' + output)); }, 20000);
    const poll = setInterval(() => { if (output.includes('网站已打开')) { clearTimeout(timer); clearInterval(poll); resolve(); } }, 50);
    child.once('error', error => { clearTimeout(timer); clearInterval(poll); reject(error); });
    child.once('close', code => { clearTimeout(timer); clearInterval(poll); reject(new Error(`Launcher ended (${code}): ${output}`)); });
  });
  check('解压到中文、空格目录后，最外层开始使用可真实启动', () => { assert.ok(output.includes(url)); assert.ok(!/not recognized|不是内部或外部命令/.test(output)); });
  if (bundled && process.platform === 'win32') check('Windows即用包不依赖系统安装Node或npm', () => assert.ok(output.includes('网站已打开')));
  let response = await fetch(url + '/api/campus/session'), data = await response.json();
  check('全新安装直接允许注册，没有初始化步骤', () => { assert.equal(response.status, 200); assert.equal(data.setupRequired, false); });
  response = await fetch(url + '/api/campus/register', { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'beginner', password: '123456', registrationMode: 'create', circleName: '解压即用验收圈' }) });
  data = await response.json();
  check('同一部署包内注册账号并创建自己的圈子成功', () => { assert.equal(response.status, 200); assert.ok(data.circleId); });
  const files = await fs.readdir(directory);
  check('自动生成私有数据库，不生成开通口令', () => { assert.ok(files.includes('campus.sqlite')); assert.ok(!files.includes('setup-key.txt')); });
  const hasConfiguration = await fs.access(path.join(root, '.env.local')).then(() => true, () => false);
  check('便捷启动不写入或改动环境配置', () => assert.equal(hasConfiguration, false));
  if (process.platform === 'win32') {
    const backup = windows('备份我的数据.cmd');
    check('最外层备份按钮真实生成数据库备份', () => assert.ok(backup.includes('一致性备份已保存')));
    check('打开数据位置入口识别实际私有目录', () => assert.ok(windows('打开数据文件夹.cmd').includes(directory)));
  }
  response = await fetch(url + '/api/campus/session');
  check('辅助工具操作后网站继续运行', () => assert.equal(response.status, 200));
  console.log(`新手部署包实测：${passed} 项通过；未打开桌面窗口或浏览器。`);
} finally {
  if (child?.pid) {
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { /* Already stopped. */ } }
    else child.kill('SIGTERM');
    await new Promise(resolve => { if (child.exitCode !== null) resolve(); else { const timer = setTimeout(resolve, 3000); child.once('close', () => { clearTimeout(timer); resolve(); }); } });
  }
  const relative = path.relative(os.tmpdir(), temporary);
  if (!relative.startsWith('campus-beginner-') || relative.includes(path.sep)) throw new Error('Unexpected temporary directory');
  await fs.rm(temporary, { recursive: true, force: true });
}
