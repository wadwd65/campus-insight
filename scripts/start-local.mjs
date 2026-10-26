/** Beginner entry: run the delivered package without editing any configuration. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { loadEnvironment } from '../server/config.mjs';
import { privateDataDir } from '../server/data-path.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const environment = loadEnvironment({ root });
const [major, minor] = process.versions.node.split('.').map(Number);
const noOpen = process.env.CAMPUS_LAUNCHER_NO_OPEN === '1';
function open(target) {
  if (noOpen) return;
  const child = spawn(process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open', [target], { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log('未能自动打开。请复制上面的位置或网址，手动打开。'));
}
if (major < 24 || major === 24 && minor < 21) {
  console.error('请先安装 Node.js 24.21 或更新版本，再双击“开始使用”。安装说明在“先看这里.html”。');
  process.exitCode = 1;
} else if (process.argv.includes('--open-data')) {
  const directory = privateDataDir(root, environment.CAMPUS_DATA_DIR || '.campus-data');
  if (!fs.existsSync(directory)) console.log('数据文件夹还没有生成。请先双击“开始使用”，注册并创建一个圈子。');
  else { console.log(`你的账号和答卷保存在：\n${directory}\n请保留整个文件夹，更新程序时不要删除。`); open(directory); }
} else if (!fs.existsSync(path.join(root, 'dist/index.html'))) {
  console.error('这个文件夹缺少网页。请重新解压完整管理员部署包，再双击“开始使用”。');
  process.exitCode = 1;
} else if (environment.APP_ORIGIN) {
  console.error('此文件夹已经配置了正式网站。本机体验入口不会改动它，请使用 deploy 文件夹里的“启动网站”。');
  process.exitCode = 1;
} else {
  const port = Number(environment.PORT || 5191);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口配置无效。请用 deploy/配置并启动 修正，或联系提供部署包的人。');
  const url = `http://127.0.0.1:${port}/`;
  console.log('\n校园生活档案 · 正在启动\n无需配置开通口令，也不用先建数据库。');
  const child = spawn(process.execPath, [path.join(root, 'server/index.mjs')], { cwd: root, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), APP_ORIGIN: '' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let ready = false;
  child.stdout.on('data', bytes => {
    if (!ready && bytes.toString().includes('Campus Insight:')) {
      ready = true;
      console.log(`\n网站已打开：${url}\n\n第一次使用：点“登录 / 我的圈子”，再点“注册”。\n选择“创建圈子，我当管理员”，设置自己的账号和6～12位密码。\n以后使用：再次双击“开始使用”，登录原账号即可。\n\n请保留这个窗口。停止网站时按 Ctrl+C。\n本机地址只供这台电脑练习；给别人使用请看“先看这里.html”。\n`);
      open(url);
    }
  });
  child.stderr.on('data', bytes => {
    const message = bytes.toString();
    if (message.includes('EADDRINUSE')) console.error(`\n${port} 端口正在使用。如果已经启动过本网站，请直接回到 ${url}，不要重复启动。\n`);
    else process.stderr.write(bytes);
  });
  child.on('error', () => { console.error('启动没有成功。请检查 Node.js 是否安装完整，再重新双击“开始使用”。'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code || 0; });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}
