import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvironment } from '../server/config.mjs';
import { privateDataDir } from '../server/data-path.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = loadEnvironment({ root });
const dataDir = privateDataDir(root, env.CAMPUS_DATA_DIR || '.campus-data');
const source = path.join(dataDir, 'campus.sqlite');
if (!fs.existsSync(source)) throw new Error('尚未建立账号数据库，请先启动服务。');
const output = path.resolve(process.argv[2] || path.join(dataDir, 'backups', `campus-${new Date().toISOString().replaceAll(':', '-')}.sqlite`));
for (const name of ['dist', 'public', 'src']) {
  const relative = path.relative(path.join(root, name), output);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw new Error('备份不能放在公开资源目录中。');
}
if (output === source || fs.existsSync(output)) throw new Error('备份目标已存在；请使用新文件名。');
fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(source, { readOnly: true });
try { db.prepare('VACUUM INTO ?').run(output); }
finally { db.close(); }
try { fs.chmodSync(output, 0o600); } catch { /* Windows inherits the current user's directory ACL. */ }
console.log(`一致性备份已保存：${output}\n备份含账号和原始答卷，请放在私有磁盘中；不要上传到网站或代码仓库。`);
console.log('可双击“打开数据文件夹”，进入 backups 文件夹，把备份再保存到自己的另一处私人位置。');
