import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { configureDeployment } from '../server/deployment-config.mjs';
import { loadEnvironment } from '../server/config.mjs';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 21)) throw new Error('请先安装 Node.js 24.21 或更新版本，安装后重新打开本工具。');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rl = createInterface({ input: stdin, output: stdout });
const current = loadEnvironment({ root, env: {} });
const ask = async (label, value) => (await rl.question(`${label} [${value}]：`)).trim() || String(value);
try {
  console.log('\n校园档案 · 部署配置\n1 独立部署：由使用者自行运行和保存数据\n2 公共站点：由维护者运行，多个管理员各管自己的圈子\n两种方式使用相同的程序和权限规则。\n');
  const modeInput = await ask('选择 1 或 2', current.CAMPUS_DEPLOYMENT === 'shared' ? '2' : '1');
  if (!['1', '2'].includes(modeInput)) throw new Error('请输入 1 或 2，配置未保存。');
  const siteName = await ask('网站名称', current.CAMPUS_SITE_NAME || '校园档案');
  const accessInput = await ask('访问方式：1 本机试用；2 已有正式 HTTPS 域名', current.APP_ORIGIN ? '2' : '1');
  if (!['1', '2'].includes(accessInput)) throw new Error('请输入 1 或 2，配置未保存。');
  const origin = accessInput === '2' ? await ask('正式网址（无末尾斜杠）', current.APP_ORIGIN || 'https://campus.example.com') : '';
  const port = Number(await ask('程序端口', current.PORT || '5191'));
  const dataDir = await ask('私有数据目录（更新程序时需保留）', current.CAMPUS_DATA_DIR || '.campus-data');
  const listenInput = await ask('监听：1 仅本机/本机反向代理；2 云平台或容器', current.HOST === '0.0.0.0' ? '2' : '1');
  if (!['1', '2'].includes(listenInput)) throw new Error('请输入 1 或 2，配置未保存。');
  if ((await ask('写入配置？现有模型配置与数据均保留，输入 YES 继续', 'NO')) !== 'YES') { console.log('已取消，配置未修改。'); }
  else {
    const result = configureDeployment({ root, mode: modeInput === '2' ? 'shared' : 'self-hosted', siteName, access: accessInput === '2' ? 'public' : 'local', origin, port, dataDir, host: listenInput === '2' ? '0.0.0.0' : '127.0.0.1' });
    console.log(`\n配置已保存。访问地址：${result.origin || `http://127.0.0.1:${result.port}`}\n数据目录：${result.dataDir}\n打开网页，选择“注册”，即可设置自己的账号和密码并创建圈子，无需开通口令。`);
    if (result.access === 'public') console.log('填写网址不会自动购买服务器或配置域名；请按部署说明完成 HTTPS 和持久磁盘。');
    if (process.argv.includes('--start')) {
      if (!fs.existsSync(path.join(root, 'dist/index.html'))) throw new Error('缺少网页构建，请使用完整部署包，或先运行 npm run build。');
      rl.close();
      const child = spawn(process.execPath, ['server/index.mjs'], { cwd: root, stdio: 'inherit', env: { ...process.env, HOST: result.host, PORT: String(result.port), CAMPUS_DATA_DIR: result.dataDir, APP_ORIGIN: result.origin, CAMPUS_DEPLOYMENT: result.mode, CAMPUS_SITE_NAME: result.siteName } });
      child.on('error', () => { console.error('启动失败，请确认 Node 版本及端口。'); process.exitCode = 1; });
      child.on('exit', code => { process.exitCode = code || 0; });
      process.on('SIGINT', () => child.kill('SIGINT'));
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { rl.close(); }
