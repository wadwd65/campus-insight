import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { isIP } from 'node:net';
import { randomUUID } from 'node:crypto';
import { privateDataDir } from './data-path.mjs';

const quote = value => {
  const text = String(value);
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  throw new Error('现有配置含无法自动保留的引号组合，请手工编辑 .env.local；文件未修改。');
};

export function configureDeployment({ root, mode, siteName, access, origin = '', port = 5191, dataDir = '.campus-data', host = '127.0.0.1' }) {
  if (!['self-hosted', 'shared'].includes(mode) || !['local', 'public'].includes(access)) throw new Error('请选择独立部署或公共站点，以及本机或正式网址。');
  if (typeof siteName !== 'string' || !siteName.trim() || siteName.trim().length > 60 || /[\x00-\x1f\x7f]/.test(siteName)) throw new Error('站点名称需要 1–60 个字，不能含控制字符。');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('端口应在 1–65535 之间。');
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('监听地址只支持 127.0.0.1 或 0.0.0.0。');
  if (typeof dataDir !== 'string' || !dataDir.trim() || /[\x00-\x1f\x7f]/.test(dataDir)) throw new Error('请填写有效的私有数据目录。');
  let domain = '';
  if (access === 'public') {
    let url;
    try { url = new URL(origin); } catch { throw new Error('请填写 https:// 开头的正式域名。'); }
    if (url.protocol !== 'https:' || url.origin !== origin || url.port || isIP(url.hostname) || !url.hostname.includes('.') || url.username || url.password) throw new Error('请填写不带路径、端口或末尾斜杠的 HTTPS 域名，例如 https://campus.example.com。');
    domain = url.hostname;
  } else origin = '';
  const directory = privateDataDir(root, dataDir);
  const file = path.join(root, '.env.local');
  const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const values = original === null ? {} : parseEnv(original);
  const managed = { CAMPUS_DEPLOYMENT: mode, CAMPUS_SITE_NAME: siteName.trim(), APP_ORIGIN: origin, CAMPUS_DOMAIN: domain, HOST: host, PORT: String(port), CAMPUS_DATA_DIR: directory.replaceAll('\\', '/') };
  const content = '# 服务端私有配置；请勿上传到代码仓库或网站。\n' + Object.entries({ ...values, ...managed }).map(([key, value]) => `${key}=${quote(value)}`).join('\n') + '\n';
  if ((fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null) !== original) throw new Error('配置已被其他进程更新，请重试。');
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, content, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
  return { mode, siteName: siteName.trim(), access, origin, port, dataDir: directory, host };
}
